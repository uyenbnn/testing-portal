# Testing Portal

Testing Portal is a role-based Angular web application where teachers publish timed objective tests and students join by test code to complete them.

This MVP version does not require user authentication.

## App Summary

- Welcome page for role selection (Teacher or Student).
- Teacher flow to create, validate, and publish a test with a unique 6-digit code.
- Student flow to join by code, complete a timed test, and see immediate scoring.
- Firebase Realtime Database persistence for published tests.
- CI + deployment workflow for Firebase Hosting.

## Installation and Quick Start

### Prerequisites

- Node.js 18+ (recommended)
- npm (project uses packageManager npm@11.6.2)

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm start
```

Open http://localhost:4200 in your browser.

### Run tests

```bash
npm test
```

### Build for production

```bash
npm run build -- --configuration production
```

Build output is generated at:

dist/testing-portal/browser

## Core Features

### Teacher Features

- Create a test with title and duration (minutes).
- Paste plain text question blocks.
- Paste plain text answer key.
- Validate parsed questions and answers before publish.
- Publish test and receive a unique 6-digit code.

### Student Features

- Join test using test code, student name, and class.
- Take timed multiple-choice test.
- Auto-submit when timer reaches zero.
- Submit manually before time ends.
- View result summary with score percentage and per-question correctness.

## Core Functions (Technical)

### Services

- TestRepositoryService:
  - Initializes Firebase app and Realtime Database.
  - Checks if a test code already exists.
  - Publishes tests under tests/{code}.
  - Retrieves tests by code and validates payload structure.
  - Caches loaded tests in-memory for faster repeated access.

- TestTemplateService:
  - Parses question text into structured question objects.
  - Parses answer key text into number-to-option mappings.
  - Returns parse errors for invalid format, missing answers, or mismatched question numbers.
  - Enforces expected formats:
    - Question header: Question N: ...
    - Options: A. ..., B. ..., C. ..., D. ...
    - Answer key: N. X

- TestCodeService:
  - Generates random 6-digit test codes.
  - Retries uniqueness checks up to max attempts.

- ScoringService:
  - Compares student answers with answer key.
  - Computes total correct answers and percentage.
  - Produces per-question correctness details.

### Main Models

- PublishedTest: test identity, metadata, questions, and answer key.
- TestQuestion: question number, prompt, and options A-D.
- StudentProfile: student name and class.
- ResultSummary: scoring output for student submission.
- ParseResult: parsed questions/answers with validation errors.

## Routes and Workflows

### Route Map

- / -> Welcome page
- /teacher -> Teacher workspace
- /student -> Student workspace
- /** -> Redirect to /

### Teacher Workflow

1. Open /teacher.
2. Enter test title and duration.
3. Paste question template text.
4. Paste answer key text.
5. Parse and validate content.
6. Publish and share generated 6-digit test code.

### Student Workflow

1. Open /student.
2. Enter test code, name, and class.
3. Load test and start timer.
4. Select answers.
5. Submit test manually or by timer auto-submit.
6. Review result summary.

## Template Formats

### Question Template

```text
Question 1: What is 2 + 2?
A. 2
B. 3
C. 4
D. 5

Question 2: Which one is a prime number?
A. 8
B. 9
C. 11
D. 12
```

### Answer Key Template

```text
1. C
2. C
```

## Firebase Setup

1. Create or select a Firebase project.
2. Enable Realtime Database for the project.
3. Update Firebase web config in:
   - src/environments/environment.ts
   - src/environments/environment.prod.ts
4. Ensure .firebaserc points to the same Firebase project ID.
5. Publish database rules from database.rules.json.

## Deployment

Firebase hosting is configured in firebase.json with:

- public directory: dist/testing-portal/browser
- SPA rewrite to /index.html
- database rules file: database.rules.json

GitHub Actions deployment workflow expects repository secrets:

- FIREBASE_SERVICE_ACCOUNT
- FIREBASE_PROJECT_ID

On push to main, deployment workflow builds the app, deploys database rules, and deploys hosting.

## Known Limitations and Notes

- MVP has no authentication.
- Student profile data and result summaries are not persisted to Firebase.
- Timer is client-side; network interruptions can affect active test sessions.
- Input parser expects strict plain text formats for questions and answer keys.
- Project uses Firebase Web SDK directly (firebase package).
