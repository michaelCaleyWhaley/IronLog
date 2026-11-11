# ironLog

A local-first workout tracker for iOS and Android, built with Expo and
React Native. No backend, no account — all data lives in a single
app-managed JSON document on the device.

See `docs/PLAN-v1-local-first` for the product and implementation plan.

## Tech stack

- Expo SDK 58 / React Native 0.88 / React 19
- TypeScript (strict)
- Expo Router (file-based navigation, bottom tabs)
- Vitest for unit tests
- ESLint (`eslint-config-expo`) and Prettier

## Project layout

```text
app/            Expo Router routes (screens and layouts)
components/     Shared UI components
constants/      App-wide constants
src/domain/     Types, Zod schemas, seed data
src/storage/    Local JSON persistence (repository, FileSystem adapter)
docs/           Product and implementation plan
assets/         Icons, splash screen, fonts
```

## Getting started

Requirements: Node.js 20+ and either Xcode (iOS) or Android Studio
(Android) for running on simulators/emulators. Expo Go works for the
foundation phase; later phases may require a development build.

```bash
npm install
npm start        # start the Expo dev server
npm run ios      # launch on iOS simulator/device
npm run android  # launch on Android emulator/device
```

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm test             # vitest run
npm run format       # prettier --write .
npm run format:check # prettier --check .
```
