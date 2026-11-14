# PACU Hub

The digital workspace for the **AUBMC Post-Anesthesia Care Unit**: one place for nurses, charge nurses and unit leadership to reach the unit schedule, standardized PACU forms and quality audits.

| Module | Status |
|---|---|
| Home | ✅ Live |
| Bay Board | ✅ Live: real-time PACU bays (Epic terms), timers with amber/red alerts, delay reasons, capacity signal, today's numbers. No patient data |
| Schedule (SNV2) | ✅ Live: **published roster** (locked SNV2 fortnights, own row + My shifts), "Request a day off", **approve / reject day-off requests in-app** with history and undo |
| PACU Forms | 🛠 Shell in place; forms pending definitions |
| Unit Audits | 🛠 Shell in place; audit tools pending definitions |
| Staff Access (admin) | ✅ Live: approve requests, set access per tab and per audit type, deactivate |
| Settings | ✅ Live: dark mode, text size, start page, personal sign-out time; admins: unit sign-out, shift times, announcement, sign-up controls, default access, activity log |

## Tech stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · Zod 4 · Radix primitives · Firebase 12 (Auth + Firestore) · Vitest + Testing Library

## Getting started

```bash
npm install
npm run dev                  # http://localhost:5173 (project config is in .env)
```

Until `.env` holds the PACU Hub Firebase config, the app shows a **Configuration required** screen listing what's missing. It does not crash.

**First deployment:** create the PACU Hub Firebase project, publish the security rules and create the first admin. Follow [docs/ACCESS_SETUP.md](docs/ACCESS_SETUP.md). It takes about 15 minutes.

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

- **`VITE_SIGN_IN_METHODS`**: `password` (default; accounts created by the Nurse Manager) and/or `google`

- **`VITE_ALLOWED_EMAIL_DOMAINS`**: restricts sign-in to institutional email addresses
- **`VITE_IDLE_TIMEOUT_MINUTES`**: auto sign-out (default 5, with a 60-second warning)
- **`VITE_SNV2_URL`**: the SNV2 manager app, opened from Schedule by people with "Manage schedule". The staff request link is set inside the app, because it must not be in this public repo.

## Deploying

Automatic, via GitHub Actions, whenever `main` changes:
- **GitHub Pages (now):** https://hussein-zreik.github.io/pacuhub/
- **Firebase Hosting (later):** https://pacuhub.web.app. This switches on by itself once its deployment key is added.

Setup, and how to move to Firebase later: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Manual:

```bash
npm run build
firebase deploy --only hosting           # the web app
firebase deploy --only firestore:rules   # the security rules (after `npm run test:rules`)
```

PACU Hub has its own Firebase project, so deploying its rules can't affect any other app. Pasting them in the Console works too; see [ACCESS_SETUP.md](docs/ACCESS_SETUP.md).

`firebase.json` sets SPA routing, security headers and long-lived caching for hashed assets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, dependency rules, auth state machine and resilience design
- [Adding a module](docs/ADDING_A_MODULE.md): how to add a new tab without touching core code
- [Staff access setup](docs/ACCESS_SETUP.md): security rules, first admin, per-tab access and record format
- [Deployment](docs/DEPLOYMENT.md): publishing to pacuhub.web.app
- [Epic integration](docs/EPIC_INTEGRATION.md): feeding audits from the EHR instead of manual entry (design + governance)
- [Epic data request — Brief Op Notes](docs/epic-data-request-brief-op-notes.md): one-page spec to hand AUBMC's Epic team
