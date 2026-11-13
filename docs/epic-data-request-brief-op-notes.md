# Data request: Brief Op Notes audit (PACU)

**To:** AUBMC Clinical Informatics / Epic Reporting team
**From:** PACU Nurse Manager
**Re:** A scheduled, de-identified extract to automate the PACU "Brief Op Notes"
compliance audit (currently done by manual chart review)

> This asks only for the **minimum data needed to score the audit**, and
> **de-identified** (no patient name, MRN or date of birth). We do not need the
> note text — only whether it exists, when, and whether required sections are
> present.

---

## 1. What we're asking for

A **recurring extract** (file or report) of PACU surgical cases with the fields
below, so our audit tool can compute compliance automatically instead of a
nurse opening each chart.

- **Population:** cases that pass through PACU (please advise the best filter —
  e.g. by location/unit, procedure area, or encounter type).
- **Period:** rolling — e.g. the previous full month, refreshed monthly (or a
  cadence you recommend).
- **Delivery:** whichever is standard and secure at AUBMC — e.g. a scheduled
  Reporting Workbench export, a Clarity/Caboodle extract to a secure location,
  or a SFTP drop. We can consume a **CSV**.

---

## 2. Fields requested (minimum necessary)

| # | Column | Meaning | Likely Epic / FHIR source |
|---|---|---|---|
| 1 | `case_ref` | **De-identified** case / encounter number (a stable code, **not** MRN or name) | Encounter ID (surrogate key) |
| 2 | `case_date` | Date of the procedure/case (date only; no time-of-birth etc.) | Procedure / Encounter date |
| 3 | `procedure_time` | Timestamp the procedure ended (to measure note timeliness) | Procedure / OR log |
| 4 | `op_note_present` | Is a brief/operative note on file? (yes/no) | DocumentReference exists |
| 5 | `op_note_time` | Timestamp the note was filed | DocumentReference.date |
| 6 | `note_author_role` | Role of author (e.g. surgeon/resident) — **role, not name** | DocumentReference.author (role only) |
| 7 | `sections_present` | Required sections present? One y/n column per required section (see §3) | Note template fields |

**Not requested / please exclude:** patient name, MRN, date of birth, address,
free-text note body, provider personal identifiers. Role is fine; individual
staff names are not needed for this audit.

---

## 3. "Required sections" to confirm

The completeness check needs AUBMC's agreed list of required brief-op-note
elements. Typical examples (please correct to AUBMC policy):

- [ ] Pre-operative diagnosis
- [ ] Post-operative diagnosis
- [ ] Procedure performed
- [ ] Surgeon / assistants (roles)
- [ ] Findings
- [ ] Estimated blood loss
- [ ] Specimens removed
- [ ] Complications (or "none")

Each becomes one yes/no column (e.g. `sec_preop_dx`, `sec_procedure`, …), or a
single "all required sections present" yes/no if that's easier to produce.

---

## 4. Example CSV (de-identified, illustrative)

```csv
case_ref,case_date,procedure_time,op_note_present,op_note_time,note_author_role,sec_procedure,sec_findings,sec_ebl,sec_complications
PACU-2026-04471,2026-11-02,2026-11-02T11:40,yes,2026-11-02T12:05,surgeon,yes,yes,yes,yes
PACU-2026-04472,2026-11-02,2026-11-02T14:10,yes,2026-11-03T18:20,resident,yes,no,yes,yes
PACU-2026-04473,2026-11-03,2026-11-03T09:15,no,,,,,, 
```

From these columns our tool computes, with no PHI:
- **Note present rate** = op_note_present = yes ÷ all cases
- **Timeliness** = (op_note_time − procedure_time) ≤ AUBMC threshold (e.g. 24 h)
- **Completeness** = all required `sec_*` = yes

---

## 5. Questions for the team

1. What's the correct **PACU case filter** in your Epic build?
2. Can `case_ref` be a **stable de-identified surrogate** (so month-to-month
   trends line up) rather than MRN?
3. What **timeliness threshold** does AUBMC policy use for brief op notes?
4. Please confirm the **required sections** list (§3).
5. Preferred **delivery method and cadence**, and any **Information Security**
   review needed for a unit tool to consume this de-identified extract.
6. Any existing **PACU/quality report** we should build on instead of a new one?

---

## 6. Privacy stance (for the record)

- We request **minimum-necessary, de-identified** data only.
- The receiving tool (PACU Hub) stores only **computed compliance results and a
  de-identified case code** — never names, MRNs, DOB or note text.
- If AUBMC would prefer we receive only the **already-scored** result (e.g. a
  report that outputs compliant y/n per case), that works too and is even
  lower-risk — we can consume that instead of the raw fields.

**Contacts:** ____________________   **Date:** ____________
