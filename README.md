# Testing Portal

Testing Portal is a role-based web app (Teacher + Student) to create and take timed tests without login in MVP.

## Current implementation status

- Role selection welcome page.
- Teacher workspace:
  - create test with title and timer,
  - paste plain text question blocks,
  - paste plain text answer key,
  - publish test with auto-generated 6-digit code.
- Student workspace:
  - join with test code + name + class,
  - take timed objective test,
  - auto-submit when timer reaches zero,
  - view score summary.
- Firebase draft layout:
  - placeholders for Firebase config in environment files,
  - repository service contains clear integration points for Realtime Database.
- GitHub Actions:
  - CI workflow on pull requests to main,
  - auto deployment workflow on push to main (Firebase Hosting).

## Plain text templates

### Question template

```text
Question 1: What is 2 + 2?
A) 2
B) 3
C) 4
D) 5

Question 2: Which one is a prime number?
A) 8
B) 9
C) 11
D) 12
```

### Answer key template

```text
1: C
2: C
```

## Development

```bash
npm install
npm start
```

Open http://localhost:4200.

## Test and build

```bash
npm test -- --watch=false
npm run build -- --configuration production
```

## Firebase setup

1. Ensure Realtime Database is enabled for your Firebase project.
2. Confirm `src/environments/environment.ts` and `src/environments/environment.prod.ts` contain your Firebase web config.
3. Confirm `.firebaserc` uses your Firebase project ID.
4. Publish Realtime Database rules from `database.rules.json`.

## GitHub Actions deployment to Firebase Hosting

The deploy workflow expects these repository secrets:

- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_PROJECT_ID`

On each push to `main`, workflow `.github/workflows/deploy-firebase.yml` builds, deploys Realtime Database rules, and deploys hosting.
