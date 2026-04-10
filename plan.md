## Plan: Testing Portal MVP Foundation

Build a role-based Angular frontend (Teacher/Student) with a Firebase Realtime Database draft integration, no-auth welcome entry flow, text-based test/answer upload templates, timed test-taking, and auto-scored objective results; then add GitHub Actions auto-deploy to Firebase Hosting on pushes to main.

**Implementation Progress (Apr 10, 2026)**
- Completed: route shell, welcome/teacher/student pages, parser, 6-digit code generation, timer + auto-submit, objective auto-scoring.
- Completed: Firebase draft config files and placeholders, firebase hosting config, GitHub Actions CI + deploy workflows.
- Completed validation: production build and unit tests pass.
- Next: replace in-memory repository with real Firebase Realtime Database reads/writes and add service-level tests.

**Steps**
1. Phase 1 - Project foundations and architecture
2. Confirm route-first structure in existing app shell and define feature boundaries: welcome, teacher, student, shared/core.
3. Add app routes for no-login flow: welcome as default, teacher workspace, student workspace, plus fallback redirect. Depends on existing router provider.
4. Define core domain models for Test, Question, AnswerKey, StudentSubmission, and ResultSummary. Parallel with route wiring.
5. Phase 2 - Teacher flow (test creation/upload)
6. Implement Teacher page layout with sections for: test metadata, timer setup, test text input, answer key text input, validation preview, and publish action. Depends on Phase 1 routes/models.
7. Implement 6-digit test code generator with uniqueness check against persisted tests; retry strategy on collision.
8. Implement strict plain-text parser for selected template (MCQ blocks + answer key list), with clear validation errors and line references.
9. Save draft/published tests to Firebase Realtime Database using a repository/service abstraction and placeholder Firebase config values (real credentials deferred).
10. Phase 3 - Student flow (join + take test + result)
11. Implement Student entry page: input test code, student name, class; validate and load test/timer state from backend.
12. Implement timed test runner page with countdown, autosave of selected options, and hard stop at time expiry. Depends on test retrieval and timer model.
13. Implement submission and auto-scoring (objective only) by comparing selections against answer key; compute score, percent, and per-question correctness.
14. Implement Student result page with summary and detailed review (question, chosen answer, correct answer).
15. Phase 4 - Firebase draft integration and deployment automation
16. Add Firebase Realtime Database client wiring via environment-backed config placeholders and app-level providers.
17. Implement data access services: create test, fetch by code, submit answer, fetch result.
18. Add GitHub Actions workflow for deploy on push to main to Firebase Hosting using repository secrets and Firebase CLI action.
19. Add CI quality gate workflow (install, build, test) as a deployment prerequisite or separate workflow.
20. Phase 5 - UX hardening and verification
21. Add template helper text/examples for teacher text inputs and parser error UX.
22. Add loading/error/empty states for all asynchronous views.
23. Add unit tests for parser, scoring, timer behavior, and code generation collision handling.
24. Add integration tests for end-to-end critical path: teacher publish -> student join -> submit -> result display.

**Relevant files**
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/src/app/app.routes.ts - define role entry and feature route map.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/src/app/app.ts - keep root shell and RouterOutlet composition.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/src/app/app.config.ts - register providers (router, Firebase app/database providers).
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/src/app/app.html - minimal shell layout and route outlet framing.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/src/styles.scss - global design tokens and responsive defaults.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/angular.json - environment/file replacement and build target adjustments for deployment.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/package.json - add Firebase dependencies and scripts for CI/deploy.
- c:/Users/bnnuyen/NHI_UYEN/projects/testing-portal/testing-portal/README.md - document text templates, local run, Firebase setup, and deployment.

**Verification**
1. Run unit tests for parser/scoring/timer and confirm pass in CI.
2. Build production bundle and verify routes render correctly with direct navigation refresh.
3. Manual path: create test as teacher, capture generated 6-digit code, join as student, complete timed attempt, verify score/result persistence.
4. Validate timer expiry behavior: auto-submit or lock according to defined rule, with consistent persisted outcome.
5. Validate parser error handling on malformed test/answer text and ensure actionable line-level messages.
6. Push to main in a test branch mirror (or workflow_dispatch) and verify Firebase Hosting deployment workflow completes.

**Decisions**
- Included now: no-auth role selection, text-template upload, objective auto-scoring, Firebase Realtime Database draft wiring, auto deploy to Firebase Hosting.
- Deferred explicitly: authentication/authorization, advanced analytics dashboard, subjective/manual grading, anti-cheat/proctoring, multi-teacher org management.
- Upload format decision: MCQ block template plus separate answer key list.
- Scoring decision: objective auto-scoring in v1.
- Deployment decision: GitHub Actions deploy to Firebase Hosting on main branch pushes.

**Further Considerations**
1. Timer expiry rule recommendation: auto-submit current answers at zero to preserve student work and reduce support issues.
2. Persistence model recommendation: store immutable published test snapshots and separate submission records for auditability.
3. Security recommendation (pre-auth phase): apply basic Firebase Realtime Database rules to limit write shapes and reduce accidental misuse during MVP testing.
