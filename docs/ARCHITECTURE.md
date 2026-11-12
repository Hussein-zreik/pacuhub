# PACU Hub — Architecture

## 1. Goals that drive every decision

1. **Isolation.** A bug in one module must never break another module or the shell.
2. **Extension without modification.** New tabs, forms and audits are *added*, never *edited into* core code.
3. **Clinical ergonomics.** It should be fast, legible, work well with touch, and take as few clicks as possible under pressure.
4. **Privacy on shared workstations.** Sessions time out on inactivity, and nothing clinical is left behind after sign-out.

## 2. Layers and dependency rules

```
src/
├── app/            Composition root: providers, router, guards, shell layout, session guard
├── core/modules/   Module registry: contract, validation, auto-discovery
├── features/       One folder per module (plugin); also auth screens
│   ├── home/  schedule/  forms/  audits/  staff-access/
│   └── auth/       Login, Access Pending, Access Error (not a module)
├── components/
│   ├── ui/         Presentational primitives (Button, Card, Dialog, EmptyState…)
│   ├── feedback/   ErrorBoundary, fallbacks, loaders, offline banner
│   └── brand/      BrandMark: the single logo slot
├── context/        AuthContext (auth + authorization state machine)
├── hooks/          Reusable hooks (idle timeout, online status, document title)
├── services/       ALL external I/O: firebase/, auth/, users/, firestore/, monitoring/
├── config/         env (validated), permissions matrix, app constants
├── utils/          Pure helpers (permissions, errors, cn)
└── styles/         Design tokens (Tailwind @theme)
```

**Allowed dependency direction:** `app → features → (core, context, components, hooks, services, config, utils)`

These rules are enforced by ESLint (`eslint.config.js`). They are not just conventions:

| Rule | Why |
|---|---|
| `features/*` may **not** import another feature | Prevents hidden coupling, so deleting or changing one module cannot break another |
| `features/*` may **not** import `firebase` | All data access goes through `services/`, so the backend can change without touching the UI |
| `components/*` may **not** import `services` or `features` | Keeps UI primitives pure and reusable |

## 3. Module registry (plugin architecture)

Every module is a folder containing a `module.ts` file:

```ts
export default defineModule({
  id: 'audits', label: 'Unit Audits', path: 'audits', order: 30,
  icon: ClipboardCheck, description: '…',
  requires: 'audits.view',
  load: () => import('./AuditsModule'),
});
```

- **Discovery:** `core/modules/discovered.ts` uses `import.meta.glob('/src/features/*/module.ts')`. Adding the folder registers the module. No list needs editing.
- **Validation at startup:** duplicate ids or paths, malformed slugs and reserved paths throw immediately in dev and CI.
- **Generated UI:** the sidebar, bottom nav, Home cards and route table are all derived from the registry.
- **Code splitting:** each module is its own lazy chunk, so the initial load stays small (app chunk is about 13 KB gzipped).
- **Sub-routes:** each module owns `/<path>/*`, so it can add internal pages without touching the router.

## 4. Module isolation (`app/router/ModuleHost.tsx`)

Each module renders inside a fixed safety envelope. Each layer handles one kind of failure:

```
Permission check  →  ErrorBoundary  →  Suspense(skeleton)  →  <Module />
```

| Failure | What the user sees |
|---|---|
| Runtime error inside a module | That module's card shows "ran into a problem", with **Try again** and a reference ID (e.g. `PH-…`). Navigation and other modules keep working. |
| Chunk fails to download (network loss, or a new deploy) | "couldn't be loaded", with **Reload page** |
| Missing permission (deep link) | "You don't have access", with **Back to Home** |
| Slow network | A skeleton placeholder, never a blank screen |

The boundary resets automatically on navigation. A root-level boundary in `main.tsx` is the last resort.

## 5. Authentication and authorization

`context/AuthContext.tsx` is an explicit state machine. Each state renders exactly one screen:

```
initializing ─┬─► signedOut                 → Login
              └─► resolving ─┬─► authorized   → App shell
                             ├─► unauthorized → "Access request sent" (pending) / "Access deactivated"
                             └─► error        → Retry screen (never a lock-out)
```

- **Separate Firebase project:** PACU Hub has its own Firebase project, isolated from SNV2 (`schedule-nursing-f14e5`). SNV2 is a single-manager app whose rules treat any password account as a manager, so sharing its project would have weakened SNV2's security.
- **Sign-in:** **email + password**, with accounts the Nurse Manager creates for each person. Self sign-up is closed. Every credential failure shows the same message, so the screen never reveals which emails have accounts. "Forgot password?" sends Firebase's reset email.
  - **Google sign-in is supported but off** (`VITE_SIGN_IN_METHODS`). If it's ever enabled, it uses a popup that falls back to redirect, with `prompt=select_account` set so the next nurse on a shared workstation never inherits the previous Google session.
- **Single source of truth:** each user's Firestore record `pacuhub_users/{uid}` holds their `access` map and `status`. Setup steps are in [ACCESS_SETUP.md](ACCESS_SETUP.md).
  - **First sign-in** creates a *pending request* (`services/users/userProfileService.ts → ensureUserProfile`).
  - **Live subscription:** the app watches the user's own record, so approvals, role changes and revocations apply to open sessions within seconds. A revocation also clears the data cache.
  - **Access rule:** `status === 'active'` **and** access to at least one tab (`services/users/access.ts → decideAccess`). Malformed data fails closed: non-string levels are dropped, and an unknown status reads as pending.
- **Per-person, per-tab access** (`core/permissions/`): each module declares its own access **levels** in `module.ts` (low → high; higher includes lower), plus optional **sub-areas** such as audit types. A person's access is a flat map, e.g. `{ "schedule": "view", "audits:infection-control": "enter" }`.
  - **Catalog:** the permission catalog is built from the module registry, so new tabs and audit types appear in Staff Access automatically.
  - **Checks:** UI code asks *what* someone can do (`usePermissions().can('audits:brief-op-notes', 'view')`), never *who* they are. Unknown keys or levels grant nothing.
  - **Templates** (`config/accessPresets.ts`) fill in common sets, with wildcards (`audits:*`, `*`, `max`) so future areas are covered.
- **Staff Access module (admin):** approve, decline, edit per-tab access (from templates or by hand), deactivate and reactivate. It is a regular plugin module whose single level is `admin`. It warns while there are fewer than two admins.
- **Domain restriction:** `VITE_ALLOWED_EMAIL_DOMAINS` signs out non-institutional accounts with a clear message.
- **Race safety:** a request counter means a stale lookup or subscription can never overwrite a newer user's state.

### Security rules (`firestore.rules`)

The UI only *shows or hides*. The rules *enforce*:

- Users can create only their **own** record, and only as `pending` with no access. Their email must match their sign-in token. Verification isn't required, because unit-created accounts are unverified; admin approval is the gate.
- Users can update only their name, photo and last sign-in, **never** their access or status.
- Only an **active admin** (`"staff-access": "admin"`) can change another user's `access` and `status`. Every change is stamped with `updatedBy` and `updatedAt`.
- Admins can adjust their **own** tab access, but can never remove their own admin level or deactivate themselves, so there's no lockout.
- Future data collections use the `hasLevel(key, levels)` helper, e.g. `hasLevel('audits:infection-control', ['enter', 'full'])`.
- **Owner accounts** (`owner: true`, set only in the console) are hidden from the Staff Access list for other admins and cannot be modified by anyone but the owner. The flag is in no rule's allowed-keys, so it can never be set or cleared through the app.
- Nothing can be deleted (audit trail). Anything not explicitly allowed is denied.
- `rules-tests/users.rules.test.ts` holds 34 executable scenarios, run against the Firestore emulator with `npm run test:rules`.

## 6. Inactivity auto-logout (`hooks/useIdleTimeout.ts`)

- **Default:** 5 minutes, with a 60-second "Are you still there?" countdown. Both are configurable.
- **Timestamp-based**, so it stays accurate even when browsers throttle timers in background tabs.
- **Cross-tab:** last activity is shared through `localStorage`. Working in any tab keeps all tabs alive, and all tabs time out together.
- **Stale-session check:** reopening the browser after the timeout signs out immediately instead of resuming the old session.
- **Explicit confirmation:** once the warning shows, mouse movement does not extend the session. The user must press **Stay signed in**, which has keyboard focus so it is the safe default.
- **On sign-out:** the query cache is cleared, so no clinical data survives into the next session.

## 7. Data layer

- **TanStack Query** manages server state: caching, retries with backoff, no retries on permission errors, and bounded memory (`gcTime` 5 min) for workstations left open through a 12-hour shift.
- **`services/firestore/repository.ts`**: a typed repository factory. Writes are validated with Zod. On reads, malformed documents are skipped and logged instead of crashing a screen. Lists are always bounded by `limit`.
- **Firestore cache is in-memory only.** We deliberately avoid persisting clinical data to disk on shared machines.

## 8. Design system

- **Tokens** live in `styles/index.css` (`@theme`): the AUBMC white and light-blue palette, semantic text and line colors, and high-contrast status colors. To re-brand, change this one block.
- **Logo:** `components/brand/BrandMark.tsx` is the single logo slot (the logo is pending approval).
- **Ergonomics:** 44 px minimum touch targets, always-visible focus rings, `prefers-reduced-motion` support, and a skip link.
- **Responsive navigation:** full sidebar at `lg` and up (workstations), an icon rail at `md` (tablets), and a bottom tab bar on phones.

## 9. Open decisions (pending discovery answers)

| Area | Current default | Waiting on |
|---|---|---|
| Access model | ✅ Decided: per-person, per-tab levels, per-audit-type for Audits, templates, 2 admins | — |
| Access storage | ✅ Decided: Firestore `pacuhub_users/{uid}` + Staff Access module | — |
| SNV2 | ✅ Staff: "Request a day off" (SNV2 staff link, stored in `pacuhub_settings/schedule`). Managers: open SNV2, set the link | Published roster view (needs a publish step in SNV2) |
| Forms engine | Not yet built | E1–E5 (form list, fields, sign-off rules) |
| Audits | Not yet built | F1–F5 (items, scoring, thresholds, exports) |
| Patient identifiers | None stored | D1 (PHI decision drives rules and retention) |
