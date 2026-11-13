# Feeding audits from Epic (instead of manual entry)

This is the design for getting PACU Hub's **Unit Audits** data from AUBMC's Epic
EHR automatically, rather than typing it in. It is a **design + plan**, not a
switch we can flip: Epic access is owned by AUBMC, and Epic data is patient
health information (PHI), so this needs the hospital's Epic / Clinical
Informatics and Information Security teams.

Companion document: [`epic-data-request-brief-op-notes.md`](./epic-data-request-brief-op-notes.md)
— the one-page spec to hand that team.

---

## 0. Guardrails (read first)

> **PACU Hub today holds NO patient data, by design**, and runs as a public web
> page (GitHub Pages) with a standard Firebase project. That is the correct
> design for non-PHI data — and it is **not an appropriate place to store Epic
> patient data.**

Two rules this design never breaks:

1. **PHI never lands in the current public app.** We import **de-identified or
   computed** audit results only (e.g. "case 4471, Brief Op Note present: yes,
   completed within 24 h: no"), not names, MRNs or raw clinical notes.
2. **Secrets never live in the browser.** The app is public code; an Epic
   credential or private key in it would be exposed to the world. Any
   credentialed call to Epic happens on a **server**, never in the page.

Anything that would break these rules (storing real PHI, per-patient clinical
detail) requires a **separate, governed deployment** — a signed Business
Associate Agreement (BAA) with the cloud processor, an Information Security
review, access logging, data-residency sign-off, and minimum-necessary scoping.
That is a hospital project, not a change inside this repo.

---

## 1. How Epic data can reach an audit (ranked for our case)

Audits are a **reporting** problem — many charts, a few fields each, looked at
periodically — not a real-time one. That shapes the recommendation.

### ① Scheduled reporting extract — **recommended**
AUBMC's Epic reporting team (Reporting Workbench / Clarity / Caboodle) produces
a **scheduled file** (e.g. nightly CSV) containing only the audit's data points,
ideally already de-identified. PACU Hub imports it.

- ➕ Least integration; the analysts already produce extracts like this.
- ➕ No live credentials, no browser-side PHI, smallest security surface.
- ➕ De-identified at source → the result can live in the current Firebase.
- ➖ Not real-time (fine for audits); depends on the reporting team's queue.

### ② Backend FHIR service (SMART Backend Services)
A small **secure server** (inside AUBMC, or a HIPAA-eligible cloud under a BAA)
holds the Epic credentials, calls Epic's FHIR R4 API for the needed resources,
**computes the audit result**, and writes only that result to the app.

- ➕ Can run unattended; richer than a flat extract.
- ➖ Needs a real backend, Epic app registration, key management, and full
  security governance. Months, not days.

### ③ Per-case SMART-on-FHIR launch
A nurse opens a case and the app pulls that one encounter's fields via a
user-authorized SMART launch.

- ➕ Good for **forms** (fill one patient's form from the chart).
- ➖ Per-patient and user-driven; not how you run a batch compliance audit.

**Recommendation:** start with **①** for the one chart-based audit (Brief Op
Notes). Keep **②/③** as a later phase if a real integration is funded.

---

## 2. Which audits Epic can actually feed

Epic only holds what's charted in Epic. Setting expectations up front:

| Audit | From Epic? | How |
|---|---|---|
| **Brief Op Notes** | ✅ Yes | Note presence + timeliness + required sections, from the chart |
| **Staff education / competencies** | ❌ No | Lives in HR / the learning system, not Epic |
| **Infection control / safety rounds** | ❌ No | Observational — a nurse records what they see |

So Epic auto-fills **some** audits; others stay manual. The module must support
**both at once**.

### Epic/FHIR resources for Brief Op Notes (for the IT conversation)
- `DocumentReference` — the operative/brief-op note (type, author, **created
  time**, status).
- `Procedure` / `Encounter` — the surgery/case and its **time**, to measure
  "note completed within X hours of the procedure".
- Completeness = required sections/fields present in the note per AUBMC policy.

> Field availability depends on **AUBMC's own Epic build** — every site
> configures Epic differently, so the reporting team confirms what's queryable.

---

## 3. Making the Audits module "import-ready"

This is what we build **in this repo now** (no PHI, safe): design the Audits
data so an extract drops in with zero rework, and manual entry still works.

### 3.1 Audit record shape (blueprint)
```ts
// Every audit observation — however it arrived.
interface AuditRecord {
  id: string;
  category: string;          // e.g. 'brief-op-notes' (matches the access area)
  caseRef: string;           // DE-IDENTIFIED case/encounter number — never a name/MRN
  periodMonth: string;       // 'YYYY-MM', for monthly compliance rollups
  items: Record<string, 'yes' | 'no' | 'na'>;  // the audit's checklist answers
  // Provenance — the key to mixing manual + imported safely:
  source: 'manual' | 'import' | 'epic';
  importBatchId?: string;    // which upload/extract this came from
  enteredBy: string;         // uid (manual) or 'system:import'
  createdAt: Date;
}
```
The `source` field is what lets a hand-entered record and an Epic-derived record
live side by side, and lets a summary say "82% compliant (of which 40 auto, 3
manual)".

### 3.2 Import pipeline (CSV)
```
Upload CSV ──▶ Parse ──▶ Validate (Zod) ──▶ Map columns to items ──▶
   Preview (what will be added / skipped / malformed) ──▶ Confirm ──▶ Write batch
```
- **Validate before write:** bad rows are shown and skipped, never saved.
- **De-identification check:** the importer **rejects** a file that contains a
  column that looks like a name, MRN or date of birth — a safety net so PHI
  can't be pasted in by accident.
- **Idempotent:** re-importing the same extract updates, not duplicates
  (keyed on `category` + `caseRef` + `periodMonth`).
- **Manual entry** remains available for the non-Epic audits.

### 3.3 Where it lives & security rules
- De-identified audit **results** → fine in the current Firebase, under a new
  `pacuhub_audits` collection.
- Rules mirror the existing model: reading/entering gated by the person's
  **Unit Audits** level for that category (`audits:<category>`), using the same
  `hasLevel(...)` helper already in `firestore.rules`. Imports require the
  `full`/entry level; `source` and provenance fields are immutable after write.

### 3.4 What stays out
No raw notes, no patient identifiers, no Epic credentials. If a future audit
genuinely needs per-patient clinical detail, that is the **governed backend**
path (§1②) on a separate deployment — not this app.

---

## 4. Suggested phases

1. **Now (this repo, no PHI):** build the import-ready Audits module (data model,
   CSV import with the de-identification guard, manual entry, summaries) once the
   audit checklists are confirmed. Hand AUBMC the data-request spec.
2. **With AUBMC Epic/reporting:** agree the de-identified Brief Op Notes extract;
   wire the importer to its exact columns.
3. **Later, if funded:** a governed backend (SMART Backend Services) for
   unattended pulls, on a HIPAA-eligible deployment under a BAA.

---

## 5. What to ask AUBMC (Clinical Informatics / IT / Information Security)

1. Who owns **Epic reporting extracts** (Reporting Workbench / Clarity /
   Caboodle), and what's the request process?
2. Can we get a **scheduled, de-identified** extract of the Brief Op Notes data
   points (see the data-request spec) — case number, note present y/n, note
   time, procedure time, required sections present?
3. What are AUBMC's rules for a **non-Epic app consuming** even de-identified
   audit data — any Information Security review needed?
4. If we ever need live/PHI data: what's the path for **BAA + HIPAA-eligible
   hosting + Epic app registration**?

The answers decide how far beyond Phase 1 we can go.
