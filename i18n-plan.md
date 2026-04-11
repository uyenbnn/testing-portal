# Draft Plan: Multilanguage Implementation

## Goal

Add multilingual support to the Angular 21 Testing Portal in a way that:

- localizes the app UI for welcome, teacher, student, and admin flows
- allows runtime language switching without separate deployments per language
- preserves compatibility with existing Firebase data
- creates a clean path for multilingual teacher-authored test content later

## Recommendation

Use a runtime translation layer for application chrome and system messages, not Angular compile-time i18n as the primary solution.

Reasoning:

- this app has multiple authenticated and unauthenticated flows where users may need to switch language in-session
- the current app stores and computes many messages in component TypeScript, not only templates
- compile-time i18n would force multiple builds and adds friction for a language toggle
- runtime translation keeps rollout incremental and works better with Firebase-backed dynamic data

Suggested stack:

- runtime translation library: Transloco
- locale formatting: browser Intl APIs plus Angular locale data where needed
- persisted language preference: Firebase profile fields for teachers, optional localStorage fallback for guests and students

## Scope Split

Treat multilingual support as two separate layers.

### Layer 1: App UI localization

This includes:

- navigation labels
- buttons, headings, field labels, helper text
- auth notices and validation messages
- timer labels, result summaries, admin moderation labels
- empty, loading, and error states

This layer should be implemented first.

### Layer 2: Teacher-authored test content localization

This includes:

- test title
- reading passage titles and content
- question prompts
- option labels/content if the option text itself is language-specific

This layer should be deferred until Layer 1 is stable. It changes the data model and publishing workflow and should not block initial multilingual UI delivery.

## Proposed Initial Languages

Start with 2 languages only for the first release.

- English
- Vietnamese

That keeps translation review manageable and matches the likely usage pattern for this app. Additional languages should be added only after the translation key structure is stable.

## Rollout Phases

### Phase 1: Inventory and architecture decisions

1. Audit all user-facing text in templates and TypeScript.
2. Classify each string into one of these buckets:
   - static UI copy
   - computed UI copy
   - validation/error copy
   - teacher-authored content
   - database-stored status text that should remain language-neutral in storage
3. Define supported locale codes, for example `en` and `vi`.
4. Decide language fallback rules:
   - app default locale
   - guest fallback locale
   - missing key fallback locale
5. Define translation key naming conventions before extraction begins.

Output of this phase:

- approved locale list
- translation key structure
- decision log for runtime localization

### Phase 2: Foundation setup

1. Add the runtime translation library and app-level i18n configuration.
2. Create translation files under a shared structure such as:
   - `src/assets/i18n/en.json`
   - `src/assets/i18n/vi.json`
3. Add a locale service responsible for:
   - reading the current language
   - switching language
   - persisting guest preference locally
   - exposing a signal-based current locale state
4. Add a language switcher in the shell or feature headers where it is always reachable.
5. Register locale data for date, time, and number formatting if those formats become visible in UI.

Notes:

- keep stored enum/status values language-neutral, for example `approved`, `pending`, `rejected`
- only translate at the presentation layer

### Phase 3: Localize existing UI surfaces

Implement by feature, not by random string extraction.

Priority order:

1. Welcome page
2. Student flow
3. Teacher auth flow
4. Teacher test builder and test library
5. Admin moderation flow
6. Shared error and status messaging from services

Expected refactor pattern:

- replace inline template text with translation keys
- replace component string literals and computed message branches with translated lookups
- keep business logic independent from language selection

Key files likely affected in this phase:

- `src/app/features/welcome/welcome-page.component.html`
- `src/app/features/student/student-page.component.html`
- `src/app/features/student/student-page.component.ts`
- `src/app/features/teacher/teacher-page.component.html`
- `src/app/features/teacher/teacher-page.component.ts`
- `src/app/features/teacher/components/teacher-test-builder/teacher-test-builder.html`
- `src/app/features/teacher/components/teacher-test-library/teacher-test-library.html`
- `src/app/features/admin/admin-page.component.html`
- `src/app/features/admin/admin-page.component.ts`

### Phase 4: Validation and message strategy cleanup

Current validation and error messaging appears to be partly produced in TypeScript. Standardize this before translation spreads further.

1. Replace raw English literals in services/components with message keys or structured error codes.
2. Map those codes to translated UI copy in the component layer.
3. Keep parser and auth services language-agnostic where practical.
4. Review ARIA labels and live-region announcements so they change with locale too.

This phase is important because translated strings embedded directly in services become hard to maintain and test.

### Phase 5: Persist user language preference

Teachers already have Firebase-backed profiles, so their preference can be stored persistently.

Plan:

1. Add optional `preferredLanguage` to teacher profile data.
2. On sign-in, load and apply stored language before rendering the main workspace.
3. On language change, write the new preference back to the profile.
4. For guest/student flows, persist preference in localStorage first.
5. If student accounts are introduced later, move student preference to persisted profile storage.

### Phase 6: Multilingual test content design

Do not mix this into the initial UI-only rollout.

Recommended model direction:

- keep existing single-language fields working as the backward-compatible source
- add optional localized field maps later, for example:
  - `titleByLocale`
  - `promptByLocale`
  - `contentByLocale`
  - `optionTextByLocale`
- keep answer keys and structural metadata language-neutral

Possible publishing workflow later:

1. Teacher selects a base language for the test.
2. Teacher publishes a single-language version first.
3. Teacher optionally adds translated variants for supported locales.
4. Student sees translated content when available, otherwise the base-language content.

Recommended rule:

- never require multilingual test content for publish in v1
- make translations optional per test

### Phase 7: Testing and QA

Add coverage for both translation behavior and fallback behavior.

Required checks:

1. Unit tests for locale service state and persistence.
2. Component tests verifying language switch updates visible text.
3. Tests for fallback behavior when a translation key is missing.
4. Tests ensuring service error codes still map correctly to translated messages.
5. Manual QA for teacher, student, and admin flows in each supported language.
6. Accessibility checks for translated labels, buttons, and live regions.

## Data and Backend Considerations

### Keep neutral values in Firebase

Store neutral codes, not translated display text.

Examples:

- status: `pending`, `approved`, `rejected`
- auth errors: symbolic codes, not English sentences
- test type: `standard`, `reading`

This prevents database data from becoming tied to one language.

### Migration safety

For the first rollout, do not migrate existing tests.

- existing tests remain valid as-is
- UI translation rollout should not require changing `PublishedTest`
- multilingual content fields can be added later as optional fields

## Suggested Translation Key Structure

Use feature-based namespaces.

Example:

- `common.back`
- `common.loading`
- `welcome.title`
- `welcome.teacherCta`
- `student.join.title`
- `student.result.score`
- `teacher.auth.loginTitle`
- `teacher.status.pendingDescription`
- `teacher.builder.publish`
- `admin.review.approve`

This aligns with the existing feature directory structure and keeps keys predictable.

## File and Component Strategy

Add new infrastructure files first.

Likely additions:

- `src/assets/i18n/en.json`
- `src/assets/i18n/vi.json`
- `src/app/core/services/locale.service.ts`
- optional shared language-switcher component under `src/app/shared/`

Likely refactor targets:

- welcome, teacher, student, and admin component templates
- feature component TypeScript files that currently compute English status text
- auth and parser flows that emit user-facing messages

## Risks

1. Hardcoded strings inside component logic will be missed unless the initial audit is deliberate.
2. Error messages generated in services can create duplicated translation logic if not normalized into codes.
3. If multilingual test content is started too early, the data model and builder UI will expand significantly.
4. Layout regressions are likely in Vietnamese if components have tight width assumptions.
5. Accessibility can regress if translated ARIA text is not updated with visible copy.

## Draft Delivery Sequence

Recommended implementation order:

1. Approve language list and runtime approach.
2. Add locale service, translation assets, and language switcher.
3. Localize welcome and student flow.
4. Localize teacher auth and teacher workspace.
5. Localize admin flow.
6. Normalize error/message handling into codes where needed.
7. Persist teacher language preference.
8. Plan multilingual test content as a separate milestone.

## Acceptance Criteria For The First Milestone

The first multilingual milestone should be considered complete when:

- the app can switch between English and Vietnamese at runtime
- welcome, teacher, student, and admin UI text is translated
- teacher preference persists across sessions
- guest/student preference persists locally
- missing translation keys fall back safely to the default locale
- Firebase records remain language-neutral except for optional preference fields
- existing tests still publish, load, and score without schema migration

## Recommended Next Step

Before implementation starts, do a text inventory and convert the current string set into a key map. That will expose how much copy is in templates versus TypeScript and will prevent rework once translation files are introduced.