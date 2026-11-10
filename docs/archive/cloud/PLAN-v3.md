# ironLog — Implementation Plan v3

A basic multi-platform workout tracker inspired by Hevy, built as a TypeScript monorepo for a solo developer. Prioritises simplicity, reliable workout logging, and low running cost. This is the canonical plan; earlier drafts are in `docs/archive/` for reference.

## 0. Working instructions

Before making changes:

1. Inspect the repository. Determine whether it is empty, partially scaffolded, or already implemented.
2. Read `README.md`, this plan, and config files.
3. Preserve useful existing work rather than overwriting it.
4. Raise any architectural question that blocks progress before proceeding.

For each phase:

1. Briefly state what you will implement.
2. Implement it.
3. Run the relevant build, typecheck, lint, and test commands.
4. Fix issues you introduced.
5. Document decisions and deviations in this file's decisions log.
6. Summarise what works and what remains.

Rules:

- Do not claim something works unless verified. **Show the actual command output** (or relevant excerpt) in each phase report.
- Do not skip tests because an implementation is straightforward.
- Do not implement future-phase features.
- Keep dependencies minimal. In each phase report, list every dependency added with a one-line justification.
- If AWS deployment needs credentials or interaction you do not have, implement the infrastructure and give the exact commands to deploy. Never claim a deployment succeeded when it did not.
- Default to the **current stable Expo SDK**, the **latest AWS-supported Node.js LTS** (Node 22+ expected; verify against current AWS docs and document the choice), and latest stable pnpm, Turborepo, and SST v3.
- **Start with Phase 0 only. Do not attempt the whole application in one pass.**

## 1. Tech stack

### Monorepo

- pnpm workspaces + Turborepo, TypeScript strict, ESLint, Prettier, Vitest, shared tsconfig
- Commit the lockfile; keep dependencies minimal

### Frontend

- Expo + React Native + TypeScript, Expo Router, React Native Web — one app for iOS, Android, web
- Expo SecureStore for native token storage; localStorage-backed implementation for web behind the same abstraction
- AsyncStorage for active-workout drafts and small preferences (e.g. kg/lb)
- Prefer React Native components; platform-specific modules only when required

### Backend

- AWS Lambda (TypeScript), API Gateway HTTP API, **Hono** for grouped routing inside a **single API Lambda**
- Cognito User Pools, DynamoDB (on-demand), AWS SDK v3, Zod validation
- Latest AWS-supported Node.js LTS (verify at implementation time)

### Infrastructure

- SST v3 (Ion), TypeScript-native: Cognito, HTTP API, Lambda, DynamoDB
- S3 deferred until exercise images exist; separate `dev` and `prod` stages

### Shared package — `packages/core`

Domain types, API request/response types, Zod schemas, shared constants (including the enums in §3.1), typed API client, common error types. The backend consumes the shared Zod schemas **at runtime** — frontend and backend never maintain separate entity definitions.

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
│   ├── PLAN-v3.md         # this file (canonical)
│   └── archive/           # PLAN-v1.md, PLAN-v2.md
├── .github/workflows/ci.yml
├── .env.example, .gitignore, package.json, pnpm-workspace.yaml,
│   pnpm-lock.yaml, turbo.json, tsconfig.base.json, README.md
```

No shared UI framework prematurely.

## 3. Data model

Three DynamoDB tables (Exercises, Routines, Workouts), on-demand billing. All user data scoped to the authenticated Cognito user (`sub` claim only — never client-supplied).

### 3.1 Validation limits and enums (Zod, in `packages/core`)

- Max 30 exercises per workout or routine
- Max 20 sets per exercise
- Name max 100 chars, notes max 1000 chars
- reps 0–1000 (integer), weightKg 0–1000, rpe 1–10 (steps of 0.5)

These bounds also keep completion transactions under DynamoDB's 100-item limit.

Muscle group enum (shared by Zod validation and UI pickers):

```text
chest, back, shoulders, biceps, triceps, forearms, quads,
hamstrings, glutes, calves, core, full_body, cardio, other
```

Equipment enum:

```text
barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, other
```

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
- **Cap: 200 custom exercises per user** (enforced server-side).

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

Full CRUD; exercise order preserved. **Cap: 50 routines per user** (enforced server-side).

### 3.4 Workouts

Workout ID is a **client-generated ULID** (time-sortable, retry-safe). The server validates ULID format on all workout endpoints.

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

- Weight stored canonically in **kilograms**; UI converts to/from lb at the display boundary per user preference (stored in AsyncStorage — local only for MVP). Never store both units.
- Exercise names snapshotted so history stays readable if the library changes.
- Warm-up sets excluded from PR calculations.
- **Completed workouts are immutable** in the MVP.
- **Optional DynamoDB TTL on active workouts:** set a ~30-day TTL refreshed on each `PUT /workouts/:id` and removed on completion, so abandoned actives don't accumulate forever but a long-forgotten draft doesn't vanish the moment someone returns. Decide at implementation time whether to include; document the choice.

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

The main workout item is the source of truth. History items are created and deleted only together with the workout (§4.4, §4.6). Because the sort key is a ULID, history is ordered by **workout start time**, not completion time — this is intended; query with pagination.

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

Updated inside the completion transaction and the delete flow. Streak = consecutive calendar days (client-local dates) with ≥1 completed workout.

Streak rules on completion with local date D and previous last date L:

- `D = L` or `D < L` (backdated, timezone travel): streak unchanged; total still increments
- `D = L + 1`: streak increments
- `D > L + 1`: streak resets to 1

On workout delete, `lastWorkoutLocalDate` **and** `currentStreakDays` are both recomputed (see §4.6). The client displays the streak as 0 when `lastWorkoutLocalDate` is older than yesterday (stale-streak rule applied at read time).

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
GET    /exercises            (optional search / muscle-group filter params)
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
GET    /workouts?status=     (completed default | active)
GET    /workouts/:id
PUT    /workouts/:id
POST   /workouts/:id/complete
DELETE /workouts/:id
GET    /stats
```

**Pagination policy:** `GET /exercises` and `GET /routines` are **not paginated** — return everything (bounded by the 200-custom-exercise and 50-routine caps). This lets the client cache the exercise list and do search/muscle-group filtering locally; the API filter params are optional conveniences. `GET /workouts` and `GET /exercises/:id/history` use cursor-based pagination.

### 4.2 Start workout

Request: workoutId (ULID), optional routineId, name, startedAt, initial exercises. Conditional put (`attribute_not_exists`). First call → 201; repeat with same workoutId by same user → 200 with existing workout, no duplicate.

### 4.3 Update workout

`PUT /workouts/:id` replaces whole workout state. Client sends last-seen `version`; server writes conditioned on it and increments.

- Completed workout → `409 WORKOUT_COMPLETED` (editing completed workouts is out of scope).
- Version mismatch → `409 VERSION_CONFLICT` including the server's current `version`.
- **Client on VERSION_CONFLICT:** local state is authoritative — adopt the server's version number and resend local state; never discard local state or overwrite with server copy. (Single-user, single-device MVP.)
- **Max 3 consecutive VERSION_CONFLICT responses:** stop retrying and surface the problem to the user — at that point it indicates a bug or a second device.
- Client debounces updates and serialises requests (one in flight) so older requests can't overtake newer ones.
- If a debounced `PUT` lands after completion and receives `WORKOUT_COMPLETED`, the client treats it as "already done" and ignores it — not an error.

### 4.4 Complete workout

`POST /workouts/:id/complete` (body: `completedAt`, `completedLocalDate`, final workout state) performs a **single `TransactWriteItems`**:

1. Update workout `active` → `completed` with final state, `completedAt`, `completedLocalDate`, conditioned on **`status = active` only** — the body already carries the authoritative final state, so no version check (it would only add a failure mode).
2. Put one `ExerciseHistoryItem` per exercise.
3. Update `STATS` (increment total, update streak per §3.6).

Max 1 + 30 + 1 = 32 items — under the 100-item limit. Add a code comment noting this bound depends on the 30-exercise cap, and a test asserting the worst case stays under 100.

**Retry semantics:** if the transaction fails because the workout is already `completed` (retry after a lost response), return the completed workout with **200**, not an error. Other failures return normal errors, so the client distinguishes "already done" from "failed". Completion must never double-count stats or duplicate history items.

### 4.5 List and read workouts

`GET /workouts?status=completed` (default) returns completed workouts, newest first, cursor-based pagination (opaque cursor wrapping `LastEvaluatedKey`), page size default 20 / max 100. Because active workouts share the key prefix, filter on `status` and keep querying until the page is full or data exhausted — pages must not be short.

`GET /workouts?status=active` returns the user's active workouts (there should normally be at most one). The app calls this on login when there is no local draft, and offers **resume or discard** — this covers reinstall/new-device recovery. `GET /exercises/:id/history` paginates identically (always completed-workout history items).

### 4.6 Delete workout

`DELETE /workouts/:id` handles abandoning an active workout or removing a wrong completed one.

- Active: delete the workout item.
- Completed: delete workout + all its history items, decrement `totalWorkouts`, and **recompute both `lastWorkoutLocalDate` and `currentStreakDays`** by querying recent completed workouts newest-first, recomputing the streak from the remaining dates, and stopping at the first date gap. Transaction for the deletes and stats update (bounded by the 30-exercise history-item cap, ~32 items — same comment/test as §4.4).
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
- On login with **no** local draft, call `GET /workouts?status=active` and offer resume or discard (§4.5).
- Local state authoritative for the session; local logging never depends on network.
- Clear draft only after successful completion or explicit discard (which also calls `DELETE /workouts/:id`).
- Failed API requests must never cause local state loss.
- Completion retry after network failure is safe (§4.4).

## 7. Frontend requirements

Expo Router, bottom tabs: **Workout**, **History**, **Profile**.

- **Workout tab:** routines list, start from routine, start blank, resume active workout.
- **Exercise library:** search, muscle-group filter, details, create custom exercise. Search/filter runs locally against the cached exercise list.
- **Routines:** list, create, edit, delete, reorder exercises, target sets/reps.
- **Active workout:** exercise cards, set rows; edit reps/weight; set type; check off; add/remove sets and exercises; duration; local persistence.
- **Rest timer:** local only. Manual start, optional auto-start after completed set, pause, reset, adjustable duration.
- **History:** paginated list grouped by date, workout detail, delete workout, per-exercise history and PRs.
- **Profile:** pinned to **total workouts, current streak, and last workout date** from `GET /stats` — no invented metrics. kg/lb preference toggle (AsyncStorage).

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

Exercise list, local search + muscle-group filter, custom exercise creation; routine CRUD, exercise selection/ordering, target sets/reps.

Done when: exercise and routine CRUD works against the API.

### Phase 4A — Active workout UI (local only)

Full active workout interface on local state: blank or routine start, add/remove exercises and sets, edit reps/weight, set types, check-off, duration, draft persistence/restore. No API required.

Done when: a complete workout can be logged locally and survives restart.

### Phase 4B — API integration

Client ULIDs, start/update calls (debounced, serialised), VERSION_CONFLICT handling (max 3 retries), resume-or-discard via `GET /workouts?status=active`, completion, discard/delete.

Done when: workouts survive restarts and persist in DynamoDB.

### Phase 4C — Rest timer and polish

Rest timer with auto-start option, haptics on native, loading/error states, improved set interactions.

Done when: workout logging is reliable and usable.

### Phase 5 — History and statistics

Paginated history, workout detail, exercise history, PRs per §3.7 (warm-ups excluded), total workouts + streak + last workout date from `/stats`.

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

Unit: Zod schemas/limits, weight conversion, workout state updates, PR detection (warm-up exclusion, Epley), streak calculation (incl. D ≤ L cases), pagination cursors, API error mapping, ULID validation, transaction-size bound test (§4.4).

Backend: auth context, user data isolation, exercise/routine CRUD + caps, soft delete, workout start idempotency, version conflicts (incl. 3-strike client rule is client-side; server just returns 409), `WORKOUT_COMPLETED` rejection, completion transaction (history + stats written, retry → 200 without double-counting), delete (history removed, stats + lastWorkoutLocalDate recomputed), pagination with status filter, `status=active` listing.

Document any integration tests needing a deployed environment.

## 12. Non-functional requirements

Strict TypeScript, no `any`, shared domain types, validated API input, enforced user isolation, loading/error handling, preserved drafts, no unnecessary requests or AWS resources, iOS/Android/web, clear local dev workflow.

Out of scope for MVP: social features, exercise images, offline sync infrastructure, Apple Health / Health Connect, advanced analytics.

## 13. Documentation

- **README.md:** overview, architecture, structure, prerequisites, install, local dev, running Expo on web/iOS/Android, tests, SST deploy, Cognito setup, env vars, token-storage tradeoff, AWS cost considerations.
- **docs/PLAN-v3.md:** this plan — updated as phases complete; decisions and reasons recorded in the decisions log whenever a decision changes.
- **docs/archive/:** superseded plans, kept for reference only — do not update.
- **.env.example** with placeholders. Mobile uses `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`, `EXPO_PUBLIC_AWS_REGION`. Never put secrets in Expo public variables.

## 14. Definition of done

A phase is complete only when: implementation exists, relevant commands succeed (output shown), tests pass, docs updated, deliverable demonstrable, limitations documented.

MVP complete when a user can, on iOS, Android and web: sign up; log in; browse exercises; create a custom exercise; create a routine; start a workout; log sets/reps/weights; resume an interrupted workout (local draft or server-side active); complete a workout; delete a workout; view history; view exercise-specific history; see PRs and basic statistics (total workouts, streak, last workout date).

## 15. Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-10 | v3 consolidates v1 + v2; earlier drafts archived | Single canonical plan; Claude's review resolved all open questions |
| 2026-11-10 | `GET /workouts?status=active` added; resume-or-discard on login with no local draft | Covers reinstall/new-device recovery; optional 30-day TTL on actives prevents unbounded accumulation |
| 2026-11-10 | Muscle-group and equipment enums defined in `packages/core` | Single source for Zod validation and UI pickers |
| 2026-11-10 | Exercises/routines unpaginated with caps (200 / 50); client-side search/filter | Small bounded datasets; enables local caching and offline-capable pickers |
| 2026-11-10 | VERSION_CONFLICT: max 3 consecutive retries then surface error | Prevents infinite retry loop; 3+ conflicts implies bug or second device |
| 2026-11-10 | Complete conditions on `status = active` only (no version check) | Body carries authoritative final state; version check only adds failure modes |
| 2026-11-10 | Streak rule extended: `D ≤ L` unchanged; delete recomputes `lastWorkoutLocalDate` too | Covers backdated workouts and timezone travel; keeps stats correct after deletes |
| 2026-11-10 | History ordered by start time (ULID), not completion time | Intended; documented so nobody "fixes" it later |
| 2026-11-10 | Profile stats pinned to total workouts, streak, last workout date | Prevents undefined "basic statistics" scope creep |
| 2026-11-10 | kg/lb preference in AsyncStorage (local only) | Sufficient for MVP; no server round-trip needed |
