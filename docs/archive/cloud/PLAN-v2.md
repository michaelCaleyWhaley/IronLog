# ironLog — Implementation Plan v2

A basic multi-platform workout tracker inspired by Hevy, built as a TypeScript monorepo for a solo developer. Prioritises simplicity, reliable workout logging, and low running cost. Supersedes `PLAN.md` (v1); v1 is kept for reference.

## 1. Tech stack

### Monorepo

- pnpm workspaces + Turborepo, TypeScript strict, ESLint, Prettier, Vitest, shared tsconfig
- Commit the lockfile; keep dependencies minimal

### Frontend

- Expo + React Native + TypeScript, Expo Router, React Native Web — one app for iOS, Android, web
- Expo SecureStore for native token storage; localStorage-backed implementation for web behind the same abstraction
- AsyncStorage for active-workout drafts
- Prefer React Native components; platform-specific modules only when required

### Backend

- AWS Lambda (TypeScript), API Gateway HTTP API, **Hono** for grouped routing inside a **single API Lambda**
- Cognito User Pools, DynamoDB (on-demand), AWS SDK v3, Zod validation
- Latest AWS-supported Node.js LTS (verify at implementation time; Node 22+ expected)

### Infrastructure

- SST v3 (Ion), TypeScript-native: Cognito, HTTP API, Lambda, DynamoDB
- S3 deferred until exercise images exist; separate `dev` and `prod` stages

### Shared package — `packages/core`

Domain types, API request/response types, Zod schemas, shared constants, typed API client, common error types. The backend consumes the shared Zod schemas **at runtime** — frontend and backend never maintain separate entity definitions.

## 2. Monorepo layout

```text
ironLog/
├── apps/
│   ├── mobile/            # Expo app (app/, src/, assets/)
│   └── api/
│       └── src/           # index.ts, router.ts, middleware/, routes/, services/, repositories/
├── packages/
│   ├── core/              # types, schemas, api-client, constants
│   ├── config/            # shared tsconfig / eslint presets
│   └── ui/                # optional — leave empty until genuinely useful
├── infra/                 # sst.config.ts, stacks/
├── docs/
│   ├── PLAN.md            # v1 (superseded)
│   └── PLAN-v2.md         # this file
├── .github/workflows/ci.yml
├── .env.example, .gitignore, package.json, pnpm-workspace.yaml,
│   pnpm-lock.yaml, turbo.json, tsconfig.base.json, README.md
```

No shared UI framework prematurely.

## 3. Data model

Three DynamoDB tables (Exercises, Routines, Workouts), on-demand billing. All user data scoped to the authenticated Cognito user (`sub` claim only — never client-supplied).

### 3.1 Validation limits (Zod, in `packages/core`)

- Max 30 exercises per workout or routine
- Max 20 sets per exercise
- Name max 100 chars, notes max 1000 chars
- reps 0–1000 (integer), weightKg 0–1000, rpe 1–10 (steps of 0.5)

These bounds also keep completion transactions under DynamoDB's 100-item limit.

### 3.2 Exercises

```text
Global: pk = GLOBAL           sk = EXERCISE#<exerciseId>
Custom: pk = USER#<userId>    sk = EXERCISE#<exerciseId>
```

Attributes: exerciseId, name, muscleGroup, equipment, isCustom, createdAt, updatedAt, deletedAt (custom only).

- Seed ~50–100 common exercises. Global exercises use stable slug IDs (e.g. `barbell-bench-press`); the seed script upserts with `PutItem` so re-runs never duplicate.
- Global exercises readable by all authenticated users; read-only through the API.
- Users CRUD only their own custom exercises.
- Custom exercise deletion is a **soft delete** (`deletedAt` set). Excluded from `GET /exercises` and pickers, still resolvable by ID. History is unaffected because workouts store name snapshots.

### 3.3 Routines

```text
pk = USER#<userId>   sk = ROUTINE#<routineId>
```

Attributes: routineId, name, ordered exercises, createdAt, updatedAt.

```typescript
interface RoutineExercise {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
}
```

Full CRUD; exercise order preserved.

### 3.4 Workouts

Workout ID is a **client-generated ULID** (time-sortable, retry-safe).

```text
pk = USER#<userId>   sk = WORKOUT#<workoutId>
```

```typescript
interface Workout {
  workoutId: string;
  routineId?: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  completedLocalDate?: string; // YYYY-MM-DD, client local date, set on completion
  status: "active" | "completed";
  exercises: WorkoutExercise[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkoutExercise {
  exerciseId: string;
  name: string; // snapshot
  order: number;
  sets: WorkoutSet[];
}

interface WorkoutSet {
  setId: string;
  type: "normal" | "warmup" | "drop" | "failure";
  reps?: number;
  weightKg?: number;
  completed: boolean;
  rpe?: number;
  notes?: string;
}
```

Rules:

- Weight stored canonically in **kilograms**; UI converts to/from lb at the display boundary per user preference. Never store both units.
- Exercise names snapshotted so history stays readable if the library changes.
- Warm-up sets excluded from PR calculations.
- **Completed workouts are immutable** in the MVP.

### 3.5 Exercise history items (denormalised)

DynamoDB cannot index into nested lists, so one history item is written per exercise per completed workout, in the Workouts table:

```text
pk = USER#<userId>#EXERCISE#<exerciseId>   sk = WORKOUT#<workoutId>
```

```typescript
interface ExerciseHistoryItem {
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  startedAt: string;
  completedLocalDate: string;
  sets: WorkoutSet[];
}
```

The main workout item is the source of truth. History items are created and deleted only together with the workout (§4.4, §4.6). ULID sort keys make history chronological and paginatable.

### 3.6 User stats item

```text
pk = USER#<userId>   sk = STATS
```

```typescript
interface UserStats {
  totalWorkouts: number;
  lastWorkoutLocalDate?: string;
  currentStreakDays: number; // streak as of lastWorkoutLocalDate
  updatedAt: string;
}
```

Updated inside the completion transaction and the delete flow. Streak = consecutive calendar days (client-local dates) with ≥1 completed workout. On completion with local date D and previous last date L: D = L leaves streak unchanged; D = L+1 increments; later resets to 1. Client displays streak as 0 when `lastWorkoutLocalDate` is older than yesterday.

### 3.7 PR definition

Per exercise, computed from non-warm-up, completed sets only:

1. **Heaviest weight** lifted for ≥1 rep
2. **Best estimated 1RM** via Epley (`weight * (1 + reps / 30)`), sets of 1–12 reps
3. **Most reps** in a single set, when no weight is recorded (bodyweight)

PRs computed client-side by fetching that exercise's history pages (page size up to 100) — not a full-history fetch. A dedicated PR item can come later if histories grow long.

## 4. API design

Every endpoint requires a valid Cognito JWT via the API Gateway JWT authorizer. Shared error response format; Zod validation on all inputs; correct HTTP status codes.

### 4.1 Endpoints

```text
GET    /exercises            (search and muscle-group filter)
POST   /exercises
GET    /exercises/:id
PUT    /exercises/:id
DELETE /exercises/:id        (soft delete)
GET    /exercises/:id/history

GET    /routines
POST   /routines
GET    /routines/:id
PUT    /routines/:id
DELETE /routines/:id

POST   /workouts/start
GET    /workouts
GET    /workouts/:id
PUT    /workouts/:id
POST   /workouts/:id/complete
DELETE /workouts/:id
GET    /stats
```

### 4.2 Start workout

Request: workoutId (ULID), optional routineId, name, startedAt, initial exercises. Conditional put (`attribute_not_exists`). First call → 201; repeat with same workoutId by same user → 200 with existing workout, no duplicate.

### 4.3 Update workout

`PUT /workouts/:id` replaces whole workout state. Client sends last-seen `version`; server writes conditioned on it and increments.

- Completed workout → `409 WORKOUT_COMPLETED` (editing completed workouts is out of scope).
- Version mismatch → `409 VERSION_CONFLICT` including the server's current `version`.
- **Client on VERSION_CONFLICT:** local state is authoritative — adopt the server's version number and resend local state; never discard local state or overwrite with server copy. (Single-user, single-device MVP.)
- Client debounces updates and serialises requests (one in flight) so older requests can't overtake newer ones.

### 4.4 Complete workout

`POST /workouts/:id/complete` (body: `completedAt`, `completedLocalDate`, final workout state) performs a **single `TransactWriteItems`**:

1. Update workout `active` → `completed` with final state, conditioned on `status = active` + version check.
2. Put one `ExerciseHistoryItem` per exercise.
3. Update `STATS` (increment total, update streak).

Max 1 + 30 + 1 = 32 items — under the 100-item limit.

**Retry semantics:** if the transaction fails because the workout is already `completed` (retry after a lost response), return the completed workout with **200**, not an error. Other failures return normal errors, so the client distinguishes "already done" from "failed". Completion must never double-count stats or duplicate history items.

### 4.5 List and read workouts

`GET /workouts` returns **completed** workouts, newest first, cursor-based pagination (opaque cursor wrapping `LastEvaluatedKey`), page size default 20 / max 100. Because active workouts share the key prefix, filter on `status = completed` and keep querying until the page is full or data exhausted — pages must not be short. `GET /exercises/:id/history` paginates identically.

### 4.6 Delete workout

`DELETE /workouts/:id` handles abandoning an active workout or removing a wrong completed one.

- Active: delete the workout item.
- Completed: delete workout + all history items, decrement `totalWorkouts`, recompute streak by querying recent completed workouts newest-first until the first date gap. Transaction for deletes + stats update.
- Non-existent → 204 (idempotent).

### 4.7 Stats

`GET /stats` returns the `STATS` item; client applies the "streak is 0 if stale" rule.

## 5. Authentication

Cognito User Pools: email sign-up, email verification, login, logout, forgot password, reset, token refresh. Clean custom screens. Token storage behind a small abstraction.

**Library rule:** time-box `aws-amplify` v6 (Auth category only) to one working session; if it needs bundler/ESM workarounds for Expo or web, switch to `amazon-cognito-identity-js` and record the decision. No other Amplify categories.

**Token storage:**

- Native: Expo SecureStore. Never plain AsyncStorage for Cognito tokens on native.
- Web: **localStorage** for MVP behind the same abstraction (SecureStore doesn't work on web). Document the XSS tradeoff vs. cookie infrastructure in README.

## 6. Local workout persistence (core requirement)

An active workout must survive app suspension, navigation, restart, and temporary network loss. This is **not** full offline sync.

- Persist active workout (ID, routine ID, exercises/sets, start time, last-updated, last known server version) to AsyncStorage, debounced.
- Restore draft on app start; user can resume.
- Local state authoritative for the session; local logging never depends on network.
- Clear draft only after successful completion or explicit discard (which also calls `DELETE /workouts/:id`).
- Failed API requests must never cause local state loss.
- Completion retry after network failure is safe (§4.4).

## 7. Frontend requirements

Expo Router, bottom tabs: **Workout**, **History**, **Profile**.

- **Workout tab:** routines list, start from routine, start blank, resume active workout.
- **Exercise library:** search, muscle-group filter, details, create custom exercise.
- **Routines:** list, create, edit, delete, reorder exercises, target sets/reps.
- **Active workout:** exercise cards, set rows; edit reps/weight; set type; check off; add/remove sets and exercises; duration; local persistence.
- **Rest timer:** local only. Manual start, optional auto-start after completed set, pause, reset, adjustable duration.
- **History:** paginated list grouped by date, workout detail, delete workout, per-exercise history and PRs.
- **Profile:** total workouts + streak from `GET /stats`, basic stats, kg/lb preference.

Do not fetch entire workout history for the profile.

## 8. Phases

### Phase 0 — Repository scaffold

pnpm workspace, Turborepo, TS config, ESLint, Prettier, Vitest, root scripts, Expo skeleton, API skeleton, `packages/core`, SST skeleton, README, this doc. **Verify Expo/Metro workspace resolution early** — check whether current pnpm + Expo SDK need `node-linker=hoisted` or explicit Metro config; don't apply old monorepo workarounds the current SDK doesn't need.

Done when: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` all succeed; Expo web starts; native dev setup documented.

### Phase 1 — Infrastructure and backend

SST app, Cognito User Pool, HTTP API + JWT authorizer, DynamoDB tables, Hono Lambda, shared schemas/error handling, repositories, exercise seed script, all §4.1 endpoints, API tests. Deploy to `dev` only if credentials exist; otherwise document exact deploy commands.

Done when: API testable with curl/Postman using real Cognito JWTs.

### Phase 2 — App shell and authentication

Expo Router, bottom tabs, sign-up/login/forgot-password/logout, token refresh, auth state, API client integration, platform token storage, env config. May proceed in parallel with Phase 1 using mocked API responses.

Done when: sign-up and login work on web, iOS, Android.

### Phase 3 — Exercise library and routines

Exercise list, search, muscle-group filter, custom exercise creation; routine CRUD, exercise selection/ordering, target sets/reps.

Done when: exercise and routine CRUD works against the API.

### Phase 4A — Active workout UI (local only)

Full active workout interface on local state: blank or routine start, add/remove exercises and sets, edit reps/weight, set types, check-off, duration. No API required.

Done when: a complete workout can be logged locally.

### Phase 4B — API integration and persistence

Client ULIDs, start/update calls (debounced, serialised), draft persistence/restore, resume, VERSION_CONFLICT handling, completion, discard/delete.

Done when: workouts survive restarts and persist in DynamoDB.

### Phase 4C — Rest timer and polish

Rest timer with auto-start option, haptics on native, loading/error states, improved set interactions.

Done when: workout logging is reliable and usable.

### Phase 5 — History and statistics

Paginated history, workout detail, exercise history, PRs per §3.7 (warm-ups excluded), total workouts + streak from `/stats`, basic statistics.

Done when: feature-complete MVP.

### Phase 6 — Hardening and release preparation

Error handling, form validation, accessibility, loading/empty states, unit + integration tests, CI, deployment docs, EAS build config, web deploy docs, release checklist incl. cost review.

Done when: beta suitable for a small number of users.

## 9. CI/CD

GitHub Actions. PRs run install, typecheck, lint, unit tests. Merge to main deploys to `dev` when AWS credentials configured — **not** per-PR deploys; isolated per-PR stages only if genuinely needed. Production deploys explicit and manual; documented.

AWS access via GitHub OIDC + scoped IAM role; document required permissions. Never commit AWS keys, Cognito secrets, prod env files, or tokens.

## 10. Cost constraints

Prefer Lambda, HTTP API, DynamoDB on-demand, Cognito. Avoid RDS, ECS, EC2, NAT gateways, always-on compute, provisioned DynamoDB capacity, unbounded CloudWatch retention (set short retention).

Document precisely which allowances are always-free vs. expiring (e.g. API Gateway free tier is time-limited for new accounts; Lambda/DynamoDB allowances ongoing) and distinguish free allowances from promotional credits. Don't promise the app stays free indefinitely. Cost review is part of the release checklist.

## 11. Testing

Vitest. No live AWS for ordinary tests — mocks or DynamoDB Local.

Unit: Zod schemas/limits, weight conversion, workout state updates, PR detection (warm-up exclusion, Epley), streak calculation, pagination cursors, API error mapping.

Backend: auth context, user data isolation, exercise/routine CRUD, soft delete, workout start idempotency, version conflicts, `WORKOUT_COMPLETED` rejection, completion transaction (history + stats written, retry → 200 without double-counting), delete (history removed, stats corrected), pagination with status filter.

Document any integration tests needing a deployed environment.

## 12. Non-functional requirements

Strict TypeScript, no `any`, shared domain types, validated API input, enforced user isolation, loading/error handling, preserved drafts, no unnecessary requests or AWS resources, iOS/Android/web, clear local dev workflow.

Out of scope for MVP: social features, exercise images, offline sync infrastructure, Apple Health / Health Connect, advanced analytics.

## 13. Documentation

- **README.md:** overview, architecture, structure, prerequisites, install, local dev, running Expo on web/iOS/Android, tests, SST deploy, Cognito setup, env vars, token-storage tradeoff, AWS cost considerations.
- **docs/PLAN.md / PLAN-v2.md:** plans, updated as phases complete; record decisions and reasons whenever a decision changes.
- **.env.example** with placeholders. Mobile uses `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`, `EXPO_PUBLIC_AWS_REGION`. Never put secrets in Expo public variables.

## 14. Definition of done

A phase is complete only when: implementation exists, relevant commands succeed (output shown), tests pass, docs updated, deliverable demonstrable, limitations documented.

MVP complete when a user can, on iOS, Android and web: sign up; log in; browse exercises; create a custom exercise; create a routine; start a workout; log sets/reps/weights; resume an interrupted workout; complete a workout; delete a workout; view history; view exercise-specific history; see PRs and basic statistics.

## 15. Open questions / issues to resolve

Raised during review of the v2 brief — resolve before or during Phase 1:

1. **Listing active workouts.** `GET /workouts` returns only completed workouts. If a user reinstalls or switches devices, the AsyncStorage draft is gone and the active workout is orphaned — `GET /workouts/:id` requires already knowing the ID. Options: `GET /workouts?status=active`, or include actives in the list response. Needs a decision.
2. **Muscle group / equipment enums.** Not yet defined — should be constants in `packages/core` so frontend pickers and backend validation share one source. Needs a defined value list.
3. **`GET /exercises` and `GET /routines` pagination.** Unspecified; likely fine unpaginated for MVP but should be stated explicitly.
4. **Delete-completed transaction size.** Workout + up to 30 history items + stats ≈ 32 items — under the 100-item `TransactWriteItems` limit only because of the 30-exercise cap. Fine, but the dependency should be noted.
5. **VERSION_CONFLICT retry loop.** "Local is authoritative, resend" is correct for single-user, but a buggy client could loop indefinitely. Consider a max-retry count or surfacing the conflict to the user after N attempts.
6. **FilterExpression cost on `GET /workouts`.** Filtering `status = completed` reads active items too (consumes RCU). Negligible at MVP scale; noted for completeness.
