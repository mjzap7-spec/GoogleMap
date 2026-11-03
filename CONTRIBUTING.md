# Contributing

## Setup

Use Node.js 24 LTS, run `npm ci`, and start with `npx expo start --clear`. Configure Firebase using [README.md](README.md). Preserve existing `.env` values; do not commit environment files or service-account credentials.

Read [AGENTS.md](AGENTS.md) for this repository's Expo-specific rules and [ARCHITECTURE.md](docs/ARCHITECTURE.md) for layer responsibilities. SDK APIs change: verify the version in package.json and use the matching Expo documentation before adding native APIs or dependencies.

## Everyday changes

1. Find the relevant file using the source map in README.md.
2. Keep behavior in a ViewModel, pure data rules in Models, and JSX in Views.
3. Reuse shared UI controls and motion tokens. Keep the persistent dark surface outside animated content.
4. Add or adjust tests for changed behavior. Small layout/copy edits normally need visual verification rather than new unit tests.
5. Run `npm run format`, then `npm run check`.
6. For routing, dependency, or platform changes, also run `npx expo export --platform all` and inspect the app.

Use `npx expo install <package>` for dependencies so versions match Expo SDK 58. Do not hand-edit generated `ios/` or `android/` projects. Custom development builds need rebuilding when native dependencies/plugins change.

## Commands

| Command                          | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `npm start`                      | Start Metro                                                                 |
| `npm run format`                 | Apply consistent formatting to source, tests, scripts, and docs             |
| `npm run format:check`           | Check formatting without writing files                                      |
| `npm run lint`                   | Check code and architecture import boundaries                               |
| `npm run typecheck`              | Check TypeScript                                                            |
| `npm test`                       | Clean generated test output, compile test targets, run local behavior tests |
| `npm run check`                  | Run formatting, lint, typecheck, and tests                                  |
| `npx expo export --platform all` | Verify Android, iOS, and web bundles                                        |

## Conventions

- PascalCase for React components and ViewModel classes; camelCase for hooks/functions.
- Prefer named exports. Route files use default exports because Expo Router requires them.
- Use direct imports so the file defining a symbol is obvious; avoid chains of re-export barrels.
- Explicit interfaces at adapter boundaries; no Firebase or native SDK types in Model contracts.
- State snapshots are readonly. Change state through commands and observable updates.
- Comments explain lifecycle, cross-service ordering, and recovery choices; avoid narrating straightforward code.
- Separate SDK error translation from user interaction handling.
- Avoid new libraries when shared components or the existing framework solve the problem.

## Before review

Check sign-in, sign-up, reset, avatar change/remove, and returning between routes. Watch for white flashes, scrolling/keyboard issues, and duplicate submissions. Test with reduced motion enabled. For backend changes, use a disposable test account in your own Firebase project and verify owner-only rules; unit tests do not contact live Firebase.

Explain what changed, why, verification performed, and any remaining live/device checks. Do not include `.expo`, `.test-build`, `dist`, `node_modules`, or private configuration in commits.

## App language

App-owned text uses `useTranslation()` from `src/shared/i18n/LanguageProvider.tsx`. Keep English source phrases and their Spanish, French, German, Chinese, and Japanese translations in `src/shared/i18n/catalog.ts`. Call `t('Save')` for static labels and `t('Edit {name}', { name: contact.name })` for dynamic labels. Do not translate user-entered names, emails, or saved locations.

`LanguageViewModel` owns the selected language, restores the existing device preference, and serializes saves. The map subscribes to the same preference without restarting GPS. Validation and data adapters return English source messages; views translate them at render time so visible messages also respond to a language change. Keep platform dialogs and provider attribution under their respective owners. Run `npm run check` after adding translations.
