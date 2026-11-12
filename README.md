# PACU Hub

The digital workspace for the **AUBMC Post-Anesthesia Care Unit**: one place for nurses, charge nurses and unit leadership to reach the unit schedule, standardized PACU forms and quality audits.

| Module | Status |
|---|---|
| Home | ✅ Live |
| Schedule (SNV2) | ✅ Live — launchpad or embedded, set in config |
| PACU Forms | 🛠 Shell in place; forms pending definitions |
| Unit Audits | 🛠 Shell in place; audit tools pending definitions |
| Staff Access (admin) | ✅ Live: approve requests, set access per tab and per audit type, deactivate |

## Tech stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · Zod 4 · Radix primitives · Firebase 12 (Auth + Firestore) · Vitest + Testing Library

## Getting started

```bash
npm install
npm run dev                  # http://localhost:5173 (project config is in .env)
```

Without a Firebase config, the app shows a **Configuration required** screen listing what's missing. It does not crash.

**First deployment:** publish the security rules and create the first admin. Follow [docs/ACCESS_SETUP.md](docs/ACCESS_SETUP.md). It takes about 5 minutes.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run check` | Type-check, lint and run all tests (run this before every commit) |
| `npm test` | Unit and integration tests |
| `npm run test:rules` | Security-rules tests on the Firestore emulator (needs Java 11+) |

## Configuration

Shared settings live in [`.env`](.env) (committed; the Firebase web config is public by design). Put personal overrides in `.env.local`. [`.env.example`](.env.example) lists every option. Key settings:

- **`VITE_SIGN_IN_METHODS`**: `password` (default, using the same accounts as SNV2) and/or `google`

- **`VITE_ALLOWED_EMAIL_DOMAINS`**: restricts sign-in to institutional email addresses
- **`VITE_IDLE_TIMEOUT_MINUTES`**: auto sign-out (default 5, with a 60-second warning)
- **`VITE_SNV2_URL`** / **`VITE_SNV2_MODE`**: schedule integration (`launch` or `embed`)

## Deploying (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting   # deploys the web app only; rules and backend are untouched
```

Security rules are published separately, by pasting them in the Console. See [ACCESS_SETUP.md](docs/ACCESS_SETUP.md). This is deliberate: it stops a routine web deploy from overwriting rules that other apps in the same Firebase project may depend on.

`firebase.json` sets SPA routing, security headers and long-lived caching for hashed assets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, dependency rules, auth state machine and resilience design
- [Adding a module](docs/ADDING_A_MODULE.md): how to add a new tab without touching core code
- [Staff access setup](docs/ACCESS_SETUP.md): security rules, first admin, per-tab access and record format
