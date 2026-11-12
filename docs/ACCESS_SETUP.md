# Staff access: one-time setup

PACU Hub stores each staff member's access in Firestore at `users/{uid}`. The flow is:

1. **A nurse signs in** with Google. PACU Hub automatically creates a **pending access request**, and the nurse sees "Access request sent".
2. **An admin opens Staff Access**, reviews the request and assigns one or more roles.
3. **The nurse's screen opens PACU Hub by itself** within seconds. They don't need to sign in again.

Deactivating someone works the same way: they are signed out of every open session within seconds. Records are never deleted, so the history is kept.

---

## Step 1: Publish the security rules (required)

The rules in [`firestore.rules`](../firestore.rules) are what actually enforce access. The app's screens only hide things.

1. Open **Firebase Console → Firestore Database → Rules**.
2. **If the editor contains rules for other collections** (for example SNV2 data, if SNV2 uses the same Firebase project): copy only the helper functions and the `match /users/{uid} { … }` block from `firestore.rules` into the existing file. **Do not delete the existing rules.**
3. **If it only has the default rules:** replace them with the full contents of `firestore.rules`.
4. Click **Publish**.

> Optional: to accept only institutional accounts, edit `institutionalEmail()` in the rules (instructions are in the comment there). Also set `VITE_ALLOWED_EMAIL_DOMAINS` in `.env.local` so users see a friendly message.

## Step 2: Create the first admin (one time only)

The rules deliberately stop anyone from granting themselves access, so the very first admin is set up by hand in the Console:

1. Open PACU Hub and **sign in** with the Nurse Manager's account. You'll see "Access request sent".
2. Open **Firebase Console → Firestore Database → Data → `users`**.
3. Open the document whose `email` matches that account.
4. Edit two fields:
   - `status` → `active` (string)
   - `roles` → an **array** with one string item: `admin`
5. Save. The waiting PACU Hub screen opens the app automatically.

From then on, manage everyone from **Staff Access** inside PACU Hub. Use the Console only in an emergency. We recommend at least **two admins**, because an admin can't change their own access.

## Roles

| Role (stored value) | Shown as | Can do |
|---|---|---|
| `staff_nurse` | Staff Nurse | Schedule, PACU forms |
| `charge_nurse` | Charge Nurse | + view all forms, co-sign |
| `educator` | Educator / Auditor | + audits, education records, exports |
| `admin` | Nurse Manager / Admin | Everything, including Staff Access |

A person can hold several roles. Their permissions are combined. The matrix is defined in `src/config/permissions.ts`.

## Record format (`users/{uid}`)

| Field | Type | Set by |
|---|---|---|
| `uid`, `email` | string | The app on first sign-in (cannot change later) |
| `displayName`, `photoURL` | string or null | The app, refreshed each sign-in |
| `roles` | array of strings | Admins only |
| `status` | `pending`, `active` or `disabled` | Admins only (users start as `pending`) |
| `createdAt`, `lastSignInAt` | timestamp | The app (server time) |
| `updatedAt`, `updatedBy` | timestamp, admin uid | Recorded automatically on every admin change |

## Verifying the rules

The rules have an automated test suite (30 scenarios) that runs against the local Firestore emulator:

```bash
npm run test:rules   # requires Java 11+
```

Run it after **any** change to `firestore.rules`.
