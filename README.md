# PACU Hub

The digital workspace for the **AUBMC Post-Anesthesia Care Unit**: one place for nurses, charge nurses and unit leadership to reach the unit schedule, standardized PACU forms and quality audits.

| Module | Status |
|---|---|
| Home | ✅ Live |
| Schedule (SNV2) | ✅ Live — launchpad or embedded, set in config |
| PACU Forms | 🛠 Shell in place; forms pending definitions |
| Unit Audits | 🛠 Shell in place; audit tools pending definitions |

## Tech stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · Zod 4 · Radix primitives · Firebase 12 (Auth + Firestore) · Vitest + Testing Library

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Firebase web config
npm run dev                  # http://localhost:5173
```

Without a Firebase config, the app shows a **Configuration required** screen listing what's missing. It does not crash.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run check` | Type-check, lint and run all tests (run this before every commit) |
| `npm test` | Unit and integration tests |

## Configuration

All settings live in `.env.local`. See [`.env.example`](.env.example) for the full list with explanations. Key settings:

- **`VITE_ROLE_SOURCE`**: where roles are read from (`claims`, `firestore`, or `claims-firestore`)
- **`VITE_ALLOWED_EMAIL_DOMAINS`**: restricts sign-in to institutional accounts
- **`VITE_IDLE_TIMEOUT_MINUTES`**: auto sign-out (default 5, with a 60-second warning)
- **`VITE_SNV2_URL`** / **`VITE_SNV2_MODE`**: schedule integration (`launch` or `embed`)

## Deploying (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting   # deploys the web app only; rules and backend are untouched
```

`firebase.json` sets SPA routing, security headers and long-lived caching for hashed assets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, dependency rules, auth state machine and resilience design
- [Adding a module](docs/ADDING_A_MODULE.md): how to add a new tab without touching core code
