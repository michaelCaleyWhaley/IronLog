# Release Checklist

ironLog is a local-first app: no backend, no accounts, no network
calls. A "release" is a signed store build of the Expo app.

## Pre-release verification

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` — all tests pass
- [ ] `npm run format:check` clean
- [ ] `npx expo export --platform ios` and `--platform android` bundle
- [ ] Manual smoke test on a physical iPhone: start workout, log sets,
      complete, restart app, confirm history/stats
- [ ] Manual smoke test on a physical Android device: same flow
- [ ] Export → delete app data (or reinstall) → import round-trip
      preserves workouts
- [ ] Airplane-mode check: entire app works with no connectivity

## App identity

- [ ] `app.json` → `expo.name`, `slug`, `version`
- [ ] `expo.ios.bundleIdentifier` = `com.michaelcaleywhaley.ironlog`
- [ ] `expo.android.package` = `com.michaelcaleywhaley.ironlog`
- [ ] App icons and splash screen are final artwork

## EAS Build

```bash
npm install -g eas-cli   # or npx eas-cli
npx eas-cli login
npx eas-cli build:configure   # once, links the EAS project
```

Profiles in `eas.json`:

- `development` — dev client for local/on-device debugging
- `preview` — internal distribution (Android APK, iOS ad-hoc/TestFlight
  via `eas submit`)
- `production` — store builds with auto-incremented version codes

```bash
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

## Store submission notes

- Data safety: the app stores all data on-device; declare no data
  collection in App Store Connect / Play Console.
- Permissions: no special permissions beyond internet (dev support);
  haptics and file sharing are standard.
- Local network permission (`ACCESS_LOCAL_NETWORK`) is only needed by
  the dev client — verify it is not required in production builds.

## Post-release

- [ ] Tag the release commit (`git tag vX.Y.Z`)
- [ ] Monitor crash reports via the store consoles
