# ironLog — Phased Plan for a Basic Multi-Platform Workout Tracker

Build **ironLog** — a basic workout tracker in the spirit of Hevy — as a pnpm + Turborepo monorepo containing an Expo (React Native) app for iOS/Android/web, a TypeScript AWS Lambda backend, and SST (Ion) infrastructure-as-code targeting AWS free-tier services. The plan is phased so each phase produces a working, deployable increment.

## Decisions

- **Frontend:** Expo + React Native + TypeScript (iOS, Android, and web from one codebase)
- **IaC:** SST v3 (Ion), TypeScript-native
- **Auth:** AWS Cognito User Pools (JWT authorizers on the API)

## Target Architecture

- **Compute:** AWS Lambda (Node.js 20, TypeScript) behind API Gateway HTTP API
- **Data:** Amazon DynamoDB, on-demand billing (stays in free tier), one table per domain entity for simplicity
- **Auth:** Cognito User Pools + JWT authorizer; user identity via `sub` claim
- **File storage:** S3 — deferred to a later phase (exercise images)
- **IaC:** SST Ion app in `infra/`, deployed per-stage (`dev`, `prod`)
- **Shared code:** `packages/core` holds domain types, API request/response types, and a typed fetch client used by both app and (types only) backend
- **Tooling:** pnpm workspaces + Turborepo for build orchestration; ESLint + Prettier; Vitest for unit tests

## Monorepo Layout

```
ironLog/
├── apps/
│   ├── mobile/          # Expo app (ios, android, web)
│   └── api/             # Lambda handlers (one folder per resource or grouped router)
├── packages/
│   ├── core/            # Shared types, constants, API client, validation schemas (zod)
│   ├── ui/              # (optional, later) shared presentational components
│   └── config/          # Shared tsconfig/eslint presets
├── infra/               # SST Ion app: stacks, DynamoDB tables, Cognito, API, Lambda wiring
├── docs/
│   └── PLAN.md          # This plan
└── turbo.json / pnpm-workspace.yaml
```

## Data Model (DynamoDB, on-demand)

Three tables keeps it simple for a solo dev (single-table design can come later if needed):

- **Exercises** — global seeded exercises + per-user custom exercises. `pk = userId | "global"`, `sk = exerciseId`. Attributes: name, muscle group, equipment, isCustom, createdAt.
- **Routines** — `pk = userId`, `sk = routineId`. Attributes: name, ordered list of exerciseIds + target sets/reps.
- **Workouts** — `pk = userId`, `sk = workoutId#startedAt`. Attributes: routineId (optional), name, startedAt, completedAt, status, and exercise entries with sets (reps, weight, completed flag). Query by `begins_with(sk)` patterns for history; a GSI on `exerciseId` (or denormalized entries) enables per-exercise history later.

## Phases

### Phase 0 — Repo scaffold & docs

- Initialize pnpm workspace + Turborepo, TypeScript configs, ESLint/Prettier, Vitest.
- Create `apps/`, `packages/`, `infra/` skeletons.
- Save this plan to `docs/PLAN.md` and flesh out `README.md` with dev commands.
- Deliverable: `pnpm install`, `pnpm dev`/`pnpm build` run end-to-end on empty scaffolds.

### Phase 1 — Infrastructure & backend skeleton

- SST Ion `infra/` app: Cognito User Pool (email sign-up), HTTP API with JWT authorizer, DynamoDB tables (Exercises, Routines, Workouts), Lambda functions.
- API endpoints (all JWT-protected):
  - `GET /exercises` — list global + user's custom exercises
  - `POST /exercises` — create custom exercise
  - `GET/POST/PUT/DELETE /routines`
  - `POST /workouts/start`, `PUT /workouts/:id/sets`, `POST /workouts/:id/complete`, `GET /workouts`, `GET /workouts/:id`
- Seed script for ~50–100 common exercises.
- `packages/core`: all request/response + entity types, zod schemas, typed API client.
- Deploy to a `dev` stage; verify with curl/Postman against real Cognito tokens.
- Deliverable: working API on AWS free tier, documented in README.

### Phase 2 — App scaffold & auth

- `apps/mobile`: `create-expo-app` (TypeScript, Expo Router for file-based navigation).
- Auth screens: sign up, log in, forgot password — using `aws-amplify` (Auth category only) or `amazon-cognito-identity-js` against the deployed User Pool.
- Navigation shell: bottom tabs (Workout / History / Profile placeholder).
- Environment config per stage (`EXPO_PUBLIC_API_URL`, Cognito IDs) via `.env` files.
- Deliverable: can sign up/log in on iOS, Android, and web builds.

### Phase 3 — Exercise library & routines

- Exercises screen: searchable list grouped by muscle group, "custom exercise" creation form.
- Routines screens: list, create/edit routine by picking exercises + target sets/reps.
- Deliverable: full CRUD usable end-to-end against the API.

### Phase 4 — Workout logging (core loop)

- "Start workout" from a routine (or blank workout).
- Active workout screen: exercise cards with set rows (weight, reps), check-off, rest timer (basic, local state), add/remove sets.
- Finish workout → `POST /workouts/:id/complete`.
- Optimistic local state; keep it simple — no offline sync yet (online-only MVP).
- Deliverable: the Hevy-style core loop works on all platforms.

### Phase 5 — History & basic stats

- History list: past workouts grouped by date, expandable detail.
- Exercise detail: last N performances, simple PR detection (max weight/reps per exercise).
- Profile: stats overview (total workouts, current streak — computed client-side from history).
- Deliverable: feature-complete MVP.

### Phase 6 — Hardening & release prep

- Error handling + loading states pass, form validation, accessibility basics.
- CI (GitHub Actions): typecheck, lint, test, `sst deploy` to dev on PR.
- EAS Build for iOS/Android; TestFlight + Play internal testing; web deploy (S3+CloudFront or Vercel/Netlify — free tier).
- Cost check: confirm everything stays within AWS free tier; document in README.
- Deliverable: public-ish beta usable by a few people.

### Future phases (post-MVP, not committed)

- Exercise images (S3 + presigned URLs), muscle-group diagrams.
- Offline logging + sync queue (PowerSync or local-first with conflict handling).
- Apple Health / Health Connect import-export.
- Social features: following, shared workouts.
- i18n, theming, widgets.

## Files to Create / Modify

- `docs/PLAN.md` — this plan
- `README.md` — project overview, setup, deploy commands
- `pnpm-workspace.yaml`, `turbo.json`, `package.json` (root), `tsconfig.base.json`
- `packages/core/**` — types, schemas, API client
- `apps/api/**` — Lambda handlers + shared handler wrapper (auth context, error mapping)
- `apps/mobile/**` — Expo app
- `infra/**` — SST stacks (`stack.ts` or per-resource files)
- `.github/workflows/ci.yml` — lint/typecheck/test/deploy-dev

## Verification

- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` in CI and locally
- `sst deploy --stage dev` succeeds; API smoke-tested with curl + Cognito token
- Manual: Expo web + iOS simulator run-through of sign-up → routine → log workout → view history
- AWS Cost Explorer check after a week of dev usage confirms free-tier fit

## Risks / Considerations

- **Cognito UX is clunky** — mitigated by building clean custom auth screens; acceptable for MVP.
- **Expo + AWS Amplify v6** has some sharp edges (tree-shaking, ESM); pin versions and verify early in Phase 2 — fallback is direct Cognito SDK calls.
- **DynamoDB access patterns** — the per-exercise history query may need a GSI or denormalized entries; design keys carefully in Phase 1 before data accumulates.
- **Free tier limits** — Lambda 1M req/mo, DynamoDB 25GB + 25 RCU/WCU, API Gateway 1M HTTP calls/mo (first 12 months for some; on-demand pricing is cheap regardless). Comfortable for a personal/small-beta app.
- **Scope discipline** — Hevy has many features; this plan deliberately defers social, images, offline, and health integrations to keep it solo-dev achievable.
