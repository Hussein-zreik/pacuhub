# Staff access: one-time setup

PACU Hub has its **own Firebase project**, completely separate from SNV2. Nothing done here can affect the ward roster.

How access works:

1. **You create an account** (email + password) for each person and give them their login.
2. **They sign in.** PACU Hub creates a **pending access request**, and they see "Access request sent".
3. **An admin opens Staff Access**, reviews the request, and chooses which tabs (and which audit types) the person can use, and at what level.
4. **Their screen opens PACU Hub by itself** within seconds.

Deactivating someone works the same way: they are signed out of every open session within seconds. Records are never deleted, so the history is kept.

---

## Step 1: Create the PACU Hub Firebase project (about 10 minutes)

1. Go to **console.firebase.google.com** → **Create a project**.
   - Name: `PACU Hub`
   - **Google Analytics: turn it OFF** (not needed for a clinical tool).
2. **Add a web app:** Project Overview → the **Web `</>`** icon → nickname `PACU Hub` → **Register app**. Copy the `firebaseConfig` block and send it to the developer. It goes into `.env`.
3. **Turn on email + password sign-in:** Build → **Authentication** → Get started → **Sign-in method** → **Email/Password** → Enable → Save. Leave "Email link" off.
4. **Close self sign-up:** Authentication → **Settings** → **User actions** → untick **Enable create (sign-up)** → Save. Now only you can create accounts.
5. **Create the database:** Build → **Firestore Database** → Create database → **Start in production mode**. Choose a location close to Beirut, e.g. `europe-west3 (Frankfurt)` or `me-central1 (Doha)`. Check first whether AUBMC IT has a data-location rule, because **the location can't be changed later**.

## Step 2: Publish the security rules (required)

The rules in [`firestore.rules`](../firestore.rules) are what actually enforce access. The app's screens only hide things.

1. Firestore Database → **Rules**.
2. **Replace everything** in the editor with the full contents of `firestore.rules`. This project belongs to PACU Hub alone.
3. Click **Publish**.

> Optional: to accept only institutional email addresses, edit `hasAccountEmail()` in the rules (instructions are in the comment there). Also set `VITE_ALLOWED_EMAIL_DOMAINS` in `.env` so users see a friendly message.

## Step 3: Create accounts

Authentication → **Users** → **Add user** → their email and a temporary password. Give them the login privately. They can change the password with **Forgot password?** on the sign-in screen.

## Step 4: Create the first admin (one time only)

The rules deliberately stop anyone from granting themselves access, so the very first admin is set up by hand in the Console:

1. Create **your own** account (Step 3), open PACU Hub and **sign in**. You'll see "Access request sent".
2. Open **Firestore Database → Data → `pacuhub_users`**.
3. Open the document whose `email` matches your account.
4. Edit two fields:
   - `status` → `active` (type: string)
   - `access` → it's an empty **map**. Click **+** to add one field inside it: name `staff-access`, type string, value `admin`.
5. Save. The waiting PACU Hub screen opens the app automatically, showing the **Staff Access** tab.
6. In **Staff Access → Active → Edit my access**, choose the **Nurse Manager / Admin** template (or any tabs you need) and save.

From then on, manage everyone from **Staff Access** inside PACU Hub. Use the Console only to create accounts, or in an emergency.

## Owner ("master") account — optional

An **owner** account is a normal admin login with two extra properties:

- It is **hidden from the Staff Access list** for every other admin.
- **No other admin can change, demote or deactivate it.** Only you, from the Firebase console, can.

It is still an ordinary email + password account enforced by the database — not a secret password in the code. To make your account an owner:

1. Firebase console → **Firestore Database → Data → `pacuhub_users`** → your record.
2. **+ Add field** → name **`owner`**, type **boolean**, value **true** → save.

That's it. In Staff Access you'll see yourself with an **Owner** badge; other admins won't see your row at all.

> One honest limit: "hidden" means hidden from the app's screens. The database still lets any admin's app download all records (that's how the staff list loads), so a technically skilled second admin could in theory see that the record exists via browser developer tools. They still can't change it. For a trusted colleague this is fine; if you ever need it fully invisible even at that level, tell me and I'll add stricter database queries.

**Make a second admin straight away.** PACU Hub shows a warning until there are two. An admin can adjust their own tabs but can never remove their own admin access or deactivate themselves, so the unit can't lose its last admin by accident.

## Access: per person, per tab

Each person's access is chosen **tab by tab**. For **Unit Audits** it's chosen **audit type by audit type**. Each tab offers levels, and a higher level includes everything below it:

| Tab | Levels (low → high) | Stored key |
|---|---|---|
| Schedule | Request days off → Manage schedule (open SNV2, set the staff request link) | `schedule` |
| PACU Forms | Fill forms → Fill & review | `forms` |
| Unit Audits: Brief Op Notes | View results → Enter & view → Enter, view & export | `audits:brief-op-notes` |
| Unit Audits: Staff Education | (same) | `audits:staff-education` |
| Unit Audits: Infection Control & Safety | (same) | `audits:infection-control` |
| Staff Access | Admin | `staff-access` |

**Examples**
- *Nurse X, Infection Control audits only:* `{ "audits:infection-control": "enter" }`
- *Nurse Y, schedule only:* `{ "schedule": "view" }`

**Templates** fill in a typical set in one click. You can then adjust it, and it shows as "Custom".

| Template | Gives |
|---|---|
| Staff Nurse | Schedule (request days off), Fill forms |
| Charge Nurse | Schedule (request days off), Fill & review forms |
| Educator / Auditor | Schedule, Fill forms, and *Enter, view & export* on **every** audit type |
| Nurse Manager / Admin | Everything at the highest level, including Staff Access |

Templates are defined in `src/config/accessPresets.ts`. A tab's levels are declared in its own `module.ts`, and audit types live in `src/features/audits/categories.ts`. A new tab or audit type appears in Staff Access automatically.

## Linking staff to their roster name

In **Staff Access → Edit** (or when approving), choose the person under **Name on the published roster**. Their own row is then highlighted in Schedule, with a **My shifts** strip. Names come from fortnights already published from SNV2, so lock at least one fortnight first.

## Settings tab

Every approved person has **Settings → My preferences** (dark mode, text size, start page, a shorter personal sign-out time). Admins also see:

- **Unit:** auto sign-out maximum, shift times, the Home announcement, sign-up on/off with allowed email domains, and the default access template for new staff.
- **Activity log:** a read-only list of access changes, day-off decisions and unit-setting changes.

**Blocking sign-up completely:** turning sign-up off hides the button and the domain list is enforced by the rules, but Firebase Authentication can still create a bare login. For a full stop, also untick *Enable create (sign-up)* in Firebase → Authentication → Settings → User actions. Such a login still gets no access without your approval.

## Record format (`pacuhub_users/{uid}`)

| Field | Type | Set by |
|---|---|---|
| `uid`, `email` | string | The app on first sign-in (cannot change later) |
| `displayName`, `photoURL` | string or null | The app, refreshed each sign-in |
| `access` | map: tab key → level (see above) | Admins only (starts empty) |
| `status` | `pending`, `active` or `disabled` | Admins only (users start as `pending`) |
| `createdAt`, `lastSignInAt` | timestamp | The app (server time) |
| `updatedAt`, `updatedBy` | timestamp, admin uid | Recorded automatically on every admin change |

## Verifying the rules

The rules have an automated test suite (30 scenarios) that runs against the local Firestore emulator:

```bash
npm run test:rules   # requires Java 11+
```

Run it after **any** change to `firestore.rules`.
