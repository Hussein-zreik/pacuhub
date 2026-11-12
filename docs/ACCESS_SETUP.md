# Staff access: one-time setup

PACU Hub stores each staff member's access in Firestore at `pacuhub_users/{uid}`. The flow is:

1. **A nurse signs in** with their SNV2 email and password. PACU Hub automatically creates a **pending access request**, and the nurse sees "Access request sent".
2. **An admin opens Staff Access**, reviews the request and assigns one or more roles.
3. **The nurse's screen opens PACU Hub by itself** within seconds. They don't need to sign in again.

Deactivating someone works the same way: they are signed out of every open session within seconds. Records are never deleted, so the history is kept.

---

## Step 0: Sign-in method (nothing to enable)

PACU Hub signs staff in with the **same email and password accounts as SNV2**. They share the same Firebase project, so a nurse has one login for both apps. Email/password sign-in is already enabled in the project.

- **New staff:** create their account exactly as you do for SNV2 (Firebase Console → Authentication → Users → Add user). Their first PACU Hub sign-in creates an access request, which you approve in **Staff Access**. Having an SNV2 account does **not** automatically give PACU Hub access.
- **Forgotten password:** the login screen's "Forgot password?" emails a reset link. Because the account is shared, it changes the SNV2 password too.

> ⚠️ **Keep Google sign-in OFF in this project.** If a nurse signs in with Google using the same email as their SNV2 account, Firebase can **replace their password login**, and they lose access to SNV2. That's why `VITE_SIGN_IN_METHODS=password` is the default.

> 🔒 **Recommended:** if SNV2 never lets people register themselves, turn off self sign-up: **Authentication → Settings → User actions → untick "Enable create (sign-up)"**. Then only you can create accounts. Check that SNV2 still works afterwards.

## Step 1: Publish the security rules (required)

The rules in [`firestore.rules`](../firestore.rules) are what actually enforce access. The app's screens only hide things.

1. Open **Firebase Console → Firestore Database → Rules**.
2. This project (`schedule-nursing-f14e5`) is **shared with SNV2**, so its existing rules protect SNV2's data. **Do not delete or replace them.**
3. Copy the helper functions and the `match /pacuhub_users/{uid} { … }` block from `firestore.rules`. Paste them **inside** the existing `match /databases/{database}/documents { … }` block, next to SNV2's rules. If a helper with the same name already exists (e.g. `signedIn`), keep a single copy.
4. Click **Publish**, then re-test SNV2 quickly to confirm nothing changed for it.
> Optional: to accept only institutional email addresses, edit `hasAccountEmail()` in the rules (instructions are in the comment there). Also set `VITE_ALLOWED_EMAIL_DOMAINS` in `.env` so users see a friendly message.

## Step 2: Create the first admin (one time only)

The rules deliberately stop anyone from granting themselves access, so the very first admin is set up by hand in the Console:

1. Open PACU Hub and **sign in** with the Nurse Manager's SNV2 email and password. You'll see "Access request sent".
2. Open **Firebase Console → Firestore Database → Data → `pacuhub_users`**.
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

## Record format (`pacuhub_users/{uid}`)

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
