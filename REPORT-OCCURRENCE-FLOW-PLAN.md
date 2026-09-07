# Report Occurrence Generator — Flow Plan

> A weekly Power Automate flow that creates next week's **Report Occurrences**
> from approved Report Template Setups — **one per Business Unit/Region AND
> per Department/Function line**, not one per unit — with each occurrence's
> own sections and citations copied from the template.
>
> **This is a plan, not code.** Written 05 Sep 2026 against the live schema.
> Updated 06 Sep 2026, then **rebuilt 07 Sep 2026**: the 06 Sep version let one
> occurrence carry several Department/Function lines as child rows
> (`lm_reportoccurrencedepartmentfunctions`). That model is **reversed** —
> every occurrence now carries exactly one Department/Function, and a
> Template with several lines produces several occurrences instead. See "Why
> this changed" right after §1.
>
> **Updated again, 07 Sep 2026:** Child Report citations (§8) no longer look
> up the child's occurrence at all. `lm_reportsectioncitations` gained
> `lm_ChildReportTemplate` — the flow sets that directly and leaves
> `lm_CitedReportOccurrence` empty on every Type 4 citation, by explicit
> decision, since a child Template can now have several occurrences for the
> same date and the flow has no way to know which one is meant. A person
> picks it later. **This column is unverified against live Dataverse** — see
> Open item 7.

---

## 1. What it does, in one line

Every week it looks at the **coming week (Sunday → Saturday)**, asks each
approved Report Template *"do any of your dates fall in this week?"*, and for
each date that does, creates one Report Occurrence **per unit, per Department/
Function line** — with its own sections and citations.

### Worked example — the number to hold onto

> A **Weekly** Report Template scoped to **2 Business Units**, with **3
> Department/Function lines** on the Template.
>
> **On the one day a week it fires, that is 2 × 3 = 6 Report Occurrences** —
> one for each (Business Unit, Department) pair:
>
> | | Cardiology | Radiology | Nursing |
> |---|---|---|---|
> | **BU — Al Ahli** | Occurrence 1 | Occurrence 2 | Occurrence 3 |
> | **BU — Andalusia Care** | Occurrence 4 | Occurrence 5 | Occurrence 6 |
>
> Each cell is its **own** `lm_reportoccurrences` row, with its **own** copy
> of every Template section and citation. None of the 6 shares a row with
> any other — that is the entire point of this rebuild.

### Why this changed (06 Sep → 07 Sep)

The 06 Sep version kept **one** occurrence per unit and fanned every
Department/Function line out as **child rows** underneath it
(`lm_reportoccurrencedepartmentfunctions`, one row per line, all pointing back
at the same occurrence). That models "this report covers several
departments." The actual requirement is different: **each department fills in
its own report**, independently — so each department needs its own
occurrence, review chain progress, and set of section answers, not a shared
occurrence with a list of departments attached to it. Reversing the model
means:

- The new inner loop (§10, Loop CD) creates **one occurrence per department
  line**, not one child row per line.
- `lm_Department`/`lm_Function` on the occurrence — which already existed,
  unchanged since 04 Sep — go back to holding **that occurrence's one and
  only** department, exactly as they were always shaped to.
- `lm_reportoccurrencedepartmentfunctions` (registered 06 Sep) has **no job
  left in this flow**. It is not deleted — `pac code delete-data-source` is
  never a casual operation on this project (see `PROJECT-CONTEXT.md` §6) —
  but nothing here writes to it any more. If nothing else in the app ever
  starts using it, it is dead schema, not a mistake to panic over.

---

## 2. When it runs

| | |
|---|---|
| Trigger | **Recurrence — weekly** |
| Day | **Thursday** |
| Time | **06:00**, time zone **Arab Standard Time** |
| Window it creates | **next Sunday → next Saturday** (offsets **+3 … +9** from Thursday) — seven days, not five. See §5 rule A. |

Set the time zone explicitly. Left blank the flow runs on UTC and every date can
shift by a day.

---

## 3. Tables it touches

**Reads**

| Table | For |
|---|---|
| `lm_report_templates` | the approved Setups and their cadence |
| `lm_reporttemplatebusinessunits` | BU units — owner, submitting position, channel |
| `lm_reporttemplateregions` | Region units — same shape |
| `lm_reporttemplatecontentchecklists` | the sections to copy (heading, angle) |
| `lm_reporttemplatesectionitems` | each section's KPI / Breakdown / Process / Child Template |
| `lm_reporttemplatedepartmentfunctions` | department + function for the occurrence |
| `lm_reportoccurrences` | the duplicate check only — a Child Report citation no longer looks up the child's occurrence, see §8 |

**Writes**

| Table | What |
|---|---|
| `lm_reportoccurrences` | one row per unit, **per Department/Function line**, per date |
| `lm_reportoccurrencesections` | one row per template section, **per occurrence** |
| `lm_reportsectioncitations` | one row per citation on that section |

`lm_reportoccurrencedepartmentfunctions` is **not written by this flow** — see
"Why this changed" in §1.

---

## 4. Shape of the flow

```
Recurrence — Thursday 06:00
  │
  ├── Compose  Today          (local date)
  ├── Compose  WeekDates      (the 7 dates: +3 … +9)
  │
  └── List rows: lm_report_templates   where lm_reportstatus = 4 (Active/Approved)
        │
        └── LOOP A · each Template
              │
              ├── List rows: BU units   (filter: this template)
              ├── List rows: Region units (filter: this template)
              ├── List rows: checklist sections (filter: this template, sort lm_checklistitemstep)
              │
              └── LOOP B · each of the 7 candidate dates
                    │
                    ├── Does it fire?  ← the frequency rules in §5
                    │                    no → skip this date
                    │
                    └── LOOP C · each unit  (BU rows, then Region rows)
                          │
                          └── LOOP CD · each department/function line   ← §6, replaces the old Loop DF
                                │
                                ├── Already exists?  → skip        (§7 — now checks department too)
                                ├── Create lm_reportoccurrences    (§6 — Department/Function = THIS line)
                                │
                                └── LOOP D · each template section
                                      ├── Create lm_reportoccurrencesections
                                      └── LOOP E · each section item
                                            └── Create lm_reportsectioncitations
```

**Rows written per run** = Templates × DueDates × Units × DeptFnLines × (1 + Sections + Citations).
The `Units × DeptFnLines` multiplication is the whole redesign — a Weekly
Template with 2 units and 3 lines creates **6** occurrences a week, each with
its own Sections/Citations, not 2 occurrences sharing 3 department child rows.
Build Loop A→C first, then add Loop CD and confirm the occurrence **count**
before adding D and E.

---

## 5. The frequency rules

`lm_frequency` on the template. **Calendar year**: quarters start **Jan / Apr /
Jul / Oct**, semesters start **Jan / Jul**.

| # | Frequency | Rule | Occurrences in a week |
|---|---|---|---|
| 1 | **Daily** | Every **working** day of the window | **5** (Sun–Thu) |
| 2 | **Twice Weekly** | The two days in `lm_dayoftheweek` + `lm_seconddayoftheweek` | **2** |
| 3 | **Weekly** | The day in `lm_dayoftheweek` | **1** |
| 4 | **Twice Monthly** | Each of `lm_dayofthemonth` + `lm_seconddayofthemonth` that **falls inside the window** | 0, 1 or 2 |
| 5 | **Monthly** | `lm_dayofthemonth`, if it **falls inside the window** | 0 or 1 |
| 6 | **Quarterly** | Month-of-quarter must match `lm_monthofthequarter` **and** `lm_dayofthemonth` falls in the window | 0 or 1 |
| 7 | **Semesterly** | Month-of-semester must match `lm_monthofthesemester` **and** the day falls in the window | 0 or 1 |
| 8 | **Annual** | Month must match `lm_month` **and** `lm_dayofthemonth` falls in the window | 0 or 1 |
| 9 | **Custom** | No rule exists. Skip it. | 0 |

⚠️ **"Occurrences in a week" here is per (unit, department) pair, not the
Template's real total.** A Weekly Template fires once — but if it has 2 units
and 3 department lines, that "once" still becomes **6** actual
`lm_reportoccurrences` rows (§1's worked example). This table answers "does it
fire this week", not "how many rows does it write."

### Two rules that differ from the Meeting flow — read these

**A. The window is SEVEN days, and weekend dates are KEPT.**
If a Monthly report is due on the 5th and the 5th is a Saturday, **create it on
the 5th anyway** — the author reschedules it in the execution module. There is no
roll-forward here. *(The Meeting generator does the opposite — do not copy that
logic.)*

This is why the window runs **Sunday → Saturday (+3 … +9)** and not Sunday →
Thursday: a five-day window silently drops every date-based report landing on a
Friday or Saturday. **Only Daily** narrows to the five working days; every
date-based frequency tests all seven.

**B. A window can span two months.**
The week 30 Aug → 5 Sep contains the 30th, 31st, 1st, 2nd, 3rd, 4th, 5th. So
"day 5" and "day 31" can both fall in one window. Test each of the seven dates
against the rule — do not test "the month".

### Working out the month-of-quarter / month-of-semester

For a candidate date, using calendar anchors:

```
monthOfQuarter  = ((month - 1) mod 3) + 1        // 1, 2 or 3
monthOfSemester = ((month - 1) mod 6) + 1        // 1 … 6
```
`month` is 1–12. So September (9) → quarter month **3**, semester month **3**.

**Annual needs no arithmetic** — compare the candidate date's month directly
against `lm_month` (1 = January … 12 = December).

---

## 6. Creating the occurrence

One row in `lm_reportoccurrences` per unit, **per Department/Function line**,
per due date — this is the nested-loop pairing §4's diagram calls Loop CD.

| Column | Value |
|---|---|
| `lm_name` | **date + template name + department**, e.g. `5/9 Daily Performance Report — Cardiology` — see "Naming" below, this is not optional |
| `lm_period` | **the exact due date** (not the first of the month) |
| `lm_status` | `1` — Draft |
| `lm_reviewstep` | `0` |
| `lm_version` | `1` |
| `lm_locked` | `false` |
| `lm_nosetupflag` | `false` |
| `lm_reportstage` | copy `lm_stage` from the template |
| `lm_reportobjective` | template objective — ⚠️ **max 100 chars**, see §9 |
| `lm_ReportTemplate` | `/lm_report_templates({id})` |
| `lm_BusinessUnit` | the BU row's business unit — **BU units only** |
| `lm_Region` | the Region row's region — **Region units only** |
| `lm_Department` | **this Loop CD iteration's** Department (`cr603_chklst_departmentses`) — every occurrence has exactly one |
| `lm_Function` | this iteration's Function (`hr_functions`), only if this line has one |
| `lm_CreatorPosition` | the unit's **Submitting Position** |

**Leave `lm_fileurl` empty.** The working copy does not exist yet.

### Naming — the department has to be in `lm_name`

Before this rebuild, `lm_name` was just `date + template name` because one
occurrence covered every department at once. Now that 3 departments in the
same BU on the same date each get their **own** occurrence, that name alone
is no longer unique — all 3 would read `5/9 Daily Performance Report`, and
the register would show three identical rows with no way to tell them apart
without opening each one. Append the department (and the function, if the
line has one): `5/9 Daily Performance Report — Cardiology` or
`5/9 Daily Performance Report — Cardiology (Nursing)`.

Getting the department's *display name* rather than its GUID into that string
needs the lookup's formatted-value annotation, not the raw
`_lm_department_value` id — see Step 12 for the exact expression, and confirm
the annotation's property name against your own `DeptFn` List rows output
before relying on it, the same way this plan already asks you to confirm
entity-set names.

### About the review chain

`lm_reportoccurrences` has **`lm_reviewstep` only** — there is no per-occurrence
reviewer table. The chain is **not copied**; it is **read from the template** for
that unit (`lm_reporttemplatereviewchains`, filtered by the BU or Region row, or
by the template alone for a group-wide Setup). Setting `lm_reviewstep = 0` is all
the flow needs to do — the occurrence starts at step 1 of that chain. This is
unchanged by the department rebuild: the chain is still read per **unit**, so
every department's occurrence for the same BU shares the same chain.

---

## 7. The duplicate guard — do not skip this

The flow reruns every week and a monthly date can appear in two consecutive
windows. Before creating, check `lm_reportoccurrences` for:

```
_lm_reporttemplate_value eq {templateId}
  and lm_period eq {dueDate}
  and _lm_businessunit_value eq {buId}          ← Region branch: _lm_region_value
  and _lm_department_value eq {deptId}
```

Set **Row count = 1** and create only when the result is empty.

⚠️ **The unit must be in the filter.** One template on one date legitimately
produces several occurrences — one per unit. Checking only template + date would
create the first unit and treat every other one as a duplicate, silently losing
all but one report per week.

⚠️ **The department must be in the filter too — this is the same bug, one
axis further.** Once occurrences fan out per department (§1, §6), one
template + date + unit legitimately produces **several** occurrences again —
one per department. Leaving the department out of the guard makes the first
department's occurrence look like it satisfies the check for every other
department on the same unit and date, and every one of them silently gets
skipped. This is exactly the failure mode the unit clause above already warns
about — it did not go away, it just moved to a new axis.

**If a line also has a Function**, decide whether two lines can share a
Department with different Functions (e.g. "Cardiology — Nursing" and
"Cardiology — Medical" as separate `DeptFn` rows). If they can, the department
clause alone is not enough to tell them apart either — add
`and _lm_function_value eq {functionId}` (or `and _lm_function_value eq null`
when the line has none) so two Function-scoped lines under the same
Department don't collide the same way two departments would without the
department clause.

---

## 8. Sections and citations

Runs once per occurrence, and there is now one occurrence per (unit,
department) pair — so a 3-department, 2-unit Weekly Template with 4 sections
writes **24** section rows a week (6 occurrences × 4 sections), each an
independent copy. Nothing here reads or filters by department; the Template's
sections are the same set for every department, copied identically into each
occurrence.

### Sections — copy from the template

For each `lm_reporttemplatecontentchecklists` row, in `lm_checklistitemstep`
order, create one `lm_reportoccurrencesections`:

| Column | Value |
|---|---|
| `lm_heading` | `lm_checklistitemname` |
| `lm_sequence` | `lm_checklistitemstep` |
| `lm_diagnosticangle` | copy from the checklist row |
| `lm_source` | `1` — Migrated (from Template) |
| `lm_body` | **empty** — the author writes it |
| `lm_ReportOccurrence` | the row from §6 |
| `lm_SourceSectionChecklistItem` | the checklist row it came from |

### Citations — copy each section's items

For each `lm_reporttemplatesectionitems` under that checklist row, create one
`lm_reportsectioncitations`:

| Template item type | → citation `lm_kind` | Carry across |
|---|---|---|
| `1` KPI | `1` KPI | `lm_KPI` |
| `2` Breakdown | `2` Breakdown | `lm_KPI` + `lm_breakdowndimension` |
| `3` Process | `3` Process | `lm_Process` |
| `4` Child Template | `11` Child Report | **see below** |

**Child Report — cite the Template, let a person pick the Occurrence.**
Set `lm_ChildReportTemplate` directly from `_lm_childreporttemplate_value` on
the template's own citation item — no lookup needed, it's already on the row
being read. **`lm_CitedReportOccurrence` is never set by this flow.** Once
occurrences fan out per department (§1), a child Template can have several
occurrences for the same due date — one per department — so there is no
longer a single correct row for the flow to guess. The person filling in the
parent report picks the exact occurrence later, from that Template's own list
of occurrences.

⚠️ **Column not yet confirmed against live Dataverse.** This plan assumes a
lookup named `lm_ChildReportTemplate` was added to `lm_reportsectioncitations`,
targeting `lm_report_templates` — matching the existing `lm_ChildReportTemplate`
column already on `lm_reporttemplatesectionitems` (04 Sep). Confirm the real
logical name and target before building this step; see Open item 7.

This also **removes the ordering problem the previous version of this plan had
to work around**: since nothing here looks up the child's occurrence any more,
it no longer matters whether the parent or the child gets generated first in
the same run.

---

## 9. Open items — settle these before building

| # | Item | Why it matters |
|---|---|---|
| 1 | ~~Annual has no month column~~ — **resolved 05 Sep.** `lm_month` (1–12, January–December) now exists on `lm_report_templates` and is wired in the Setup form. | Annual works like Quarterly: match `lm_month` against the candidate date's month, then check the day falls in the window. |
| 2 | **The citation's parent link.** `lm_reportsectioncitations` has five lookups — `lm_KPI`, `lm_Process`, `lm_CitedSection`, `lm_CitedReportOccurrence`, and (07 Sep) `lm_ChildReportTemplate` — and no separate parent column. This plan assumes **`lm_CitedSection` is the parent Report Occurrence Section**. | If that assumption is wrong, citations will be created orphaned. Confirm before building §8. Consequence of this reading: a **Paragraph** citation (kind 8) has no target column — not needed by this flow, which only creates kinds 1, 2, 3 and 11. |
| 3 | **`lm_reportobjective` is 100 characters.** | A longer template objective is **rejected with a 400**, not truncated. Either widen the column or don't copy the objective at all. |
| 4 | **Custom frequency has no rule field.** | Templates set to Custom are skipped. If they need to generate, a rule column is required. |
| 5 | **Group-wide (Stage 3/4) templates have no unit rows.** | Decide: create **one occurrence per department line** with BU and Region left null, or skip them. Neither `Units_BU` nor `Units_Region` returns a row for a group-wide Template (Step 10/13), so Loop CD (§4/§6) would need a third copy that runs directly off `DeptFn` with no unit wrapping it, still reading the owner/review chain off the template's parent row. Not built out step-by-step below — flag it if a group-wide Report Template needs this flow. |
| 6 | **`lm_reportoccurrencedepartmentfunctions` is now unused by this flow.** It was registered 06 Sep specifically so one occurrence could carry several departments; that model is reversed (§1). | Not a blocker — it stays registered (never call `delete-data-source` casually, see `PROJECT-CONTEXT.md` §6) but nothing here writes to it. Confirm nothing else in the app has since started reading or writing it before treating it as fully dead. |
| 7 | **`lm_ChildReportTemplate` on `lm_reportsectioncitations` is unverified.** Added 07 Sep per an explicit ask, but not yet inspected against live Dataverse — every attempt to refresh this table's cached schema this session hit a CLI limitation (neither connector could pull real column metadata for an already-registered native table). This plan assumes the logical name is `lm_ChildReportTemplate`, targeting `lm_report_templates`, matching the existing column of the same name on `lm_reporttemplatesectionitems`. | If the real logical name or target differs, Step 14's Type 4 handling (§8) will fail with a 400 or bind to the wrong table. Confirm before building. |

---

## 10. Building it, step by step

Every Compose below is **named**, because later expressions refer to those names
— `outputs('DOW')` only works if a Compose is actually called `DOW`. Keep names
single-word: Power Automate turns a space into an underscore inside expressions.

Build in this order. Steps 1–4 run on their own and prove the window; add Loop A
only after seeing seven correct dates in the run history.

### Step 1 — Create the flow inside a solution

Solutions → the solution holding the Report tables → **New → Automation → Cloud
flow → Scheduled**. Name it `Generate Report Occurrences — Weekly`.
Outside a solution it cannot be exported, and its connection references pin to
your account.

### Step 2 — Trigger: Recurrence

| Setting | Value |
|---|---|
| Interval / Frequency | `1` / **Week** |
| Time zone | **Arab Standard Time** |
| Start time | a past Thursday, e.g. `2026-09-03T06:00:00` |
| On these days | **Thursday** |
| At these hours / minutes | `6` / `0` |

Left blank, the time zone defaults to UTC and every date in the run can land a
day early.

### Step 3 — Compose `Today`

```
formatDateTime(convertFromUtc(utcNow(),'Arab Standard Time'),'yyyy-MM-dd')
```

`utcNow()` ignores the trigger's time zone. Convert once, at the top, so every
later date derives from the same local anchor.

### Step 4 — Select `WeekDates`

| Field | Value |
|---|---|
| **From** | `range(3,7)` |
| **Map** *(switch to text mode — the T icon)* | `addDays(outputs('Today'), item(), 'yyyy-MM-dd')` |

**Save and test now.** Seven dates: next Sunday → next Saturday.

`range(3,7)`, not `range(3,5)`. Thursday + 3 is Sunday; seven days reaches
Saturday. A five-day window looks right but silently drops every Monthly,
Quarterly, Semesterly and Annual report landing on a Friday or Saturday (§5 rule
A). Text mode on the Map, or each date comes back wrapped in an object.

### Step 5 — List rows: the approved Templates

Table `lm_report_templates`, action renamed `Templates`.

```
Filter rows:
lm_reportstatus eq 4

Select columns:
lm_report_templateid,lm_newcolumn,lm_frequency,lm_stage,lm_reportobjective,
lm_dayoftheweek,lm_seconddayoftheweek,lm_dayofthemonth,lm_seconddayofthemonth,
lm_monthofthequarter,lm_monthofthesemester,lm_month
```

While testing append ` and lm_report_templateid eq {your-test-guid}`; remove at
step 15.

### Step 6 — Loop A: Apply to each Template

Over `value` from `Templates`. Rename `Loop_A`. **Concurrency Control → Off** —
the step 11 guard reads then writes, and parallel branches can both read "nothing
there" before either writes.

### Step 7 — Inside Loop A: the Template's facts as named Composes

| Name | Expression | Scale |
|---|---|---|
| `F` | `items('Loop_A')?['lm_frequency']` | 1–9 |
| `D1` | `coalesce(items('Loop_A')?['lm_dayoftheweek'],0)` | 1=Sun … 5=Thu |
| `D2` | `coalesce(items('Loop_A')?['lm_seconddayoftheweek'],0)` | same |
| `M1` | `coalesce(items('Loop_A')?['lm_dayofthemonth'],0)` | 1–31 |
| `M2` | `coalesce(items('Loop_A')?['lm_seconddayofthemonth'],0)` | 1–31 |
| `Q` | `coalesce(items('Loop_A')?['lm_monthofthequarter'],0)` | 1–3 |
| `S` | `coalesce(items('Loop_A')?['lm_monthofthesemester'],0)` | 1–6 |
| `Y` | `coalesce(items('Loop_A')?['lm_month'],0)` | 1=Jan … 12=Dec |

`coalesce` matters: step 9 evaluates **every** branch of the nested `if()` before
picking one, so a raw null throws on `sub(null,1)` and fails the whole run.

Then four **List rows**, all filtered
`_lm_reporttemplate_value eq @{items('Loop_A')?['lm_report_templateid']}`:

| Rename to | Table | Also set |
|---|---|---|
| `Units_BU` | `lm_reporttemplatebusinessunitses` | — |
| `Units_Region` | `lm_reporttemplateregions` | — |
| `Sections` | `lm_reporttemplatecontentchecklists` | Sort `lm_checklistitemstep asc` |
| `DeptFn` | `lm_reporttemplatedepartmentfunctions` | — |

### Step 8 — Loop B: each of the seven dates

Apply to each over `body('WeekDates')`. Rename `Loop_B`, concurrency **Off**.

| Name | Expression |
|---|---|
| `DueDate` | `item()` |
| `DOW` | `dayOfWeek(outputs('DueDate'))` — 0=Sun … 6=Sat |
| `DOM` | `dayOfMonth(outputs('DueDate'))` |
| `MO` | `int(formatDateTime(outputs('DueDate'),'MM'))` |

Capture `item()` immediately. Inside the nested loops of steps 10–14 it stops
meaning "the date" and starts meaning "the unit", then "the department", then
"the section". This is the most common way the flow goes wrong.

### Step 9 — Compose `Fires`: the frequency test

```
if(equals(outputs('F'),1), less(outputs('DOW'),5),
if(equals(outputs('F'),2), or(equals(outputs('DOW'),sub(outputs('D1'),1)),
                              equals(outputs('DOW'),sub(outputs('D2'),1))),
if(equals(outputs('F'),3), equals(outputs('DOW'),sub(outputs('D1'),1)),
if(equals(outputs('F'),4), or(equals(outputs('DOM'),outputs('M1')),
                              equals(outputs('DOM'),outputs('M2'))),
if(equals(outputs('F'),5), equals(outputs('DOM'),outputs('M1')),
if(equals(outputs('F'),6), and(equals(add(mod(sub(outputs('MO'),1),3),1),outputs('Q')),
                               equals(outputs('DOM'),outputs('M1'))),
if(equals(outputs('F'),7), and(equals(add(mod(sub(outputs('MO'),1),6),1),outputs('S')),
                               equals(outputs('DOM'),outputs('M1'))),
if(equals(outputs('F'),8), and(equals(outputs('MO'),outputs('Y')),
                               equals(outputs('DOM'),outputs('M1'))),
false))))))))
```

Follow with a **Condition**: `outputs('Fires')` **is equal to** `true` (entered
as an expression). Everything from step 10 on goes in **If yes**.

> ⚠️ **`sub(outputs('D1'),1)` is not optional.** `lm_dayoftheweek` stores
> **1 = Sunday … 5 = Thursday**; `dayOfWeek()` returns **0 = Sunday … 6 =
> Saturday**. Compare them raw and every weekly report generates one day late,
> every time — which reads like a time-zone bug and is not one.

One Compose rather than a Switch on `lm_frequency`: a Switch would need steps
10–14 duplicated into eight cases. This collapses the decision to one boolean so
the create logic is built once.

### Step 10 — Loop C: each Business Unit

Apply to each over `value` from `Units_BU`, renamed `Loop_C`, concurrency
**Off**. Two Composes: `UnitId` = `item()?['_lm_businessunit_value']`,
`SubmitPos` = `item()?['_lm_submittingposition_value']`.

### Step 11 — Loop CD: each department/function line

**Inside** Loop C (not a sibling of it) — this is the new nesting level that
replaces the old Loop DF. **Apply to each** over `value` from `DeptFn`
(already listed in Step 7), renamed `Loop_CD`, concurrency **Off**. Two
Composes: `DeptId` = `item()?['_lm_department_value']`, `FnId` =
`item()?['_lm_function_value']`.

Everything from Step 12 on now runs **once per (unit, department) pair**, not
once per unit — that pairing is what produces the 6 occurrences in §1's
worked example instead of 2.

### Step 12 — The duplicate guard, then the occurrence

**List rows** on `lm_reportoccurrences`, renamed `Existing`, **Row count = 1**:

```
_lm_reporttemplate_value eq @{items('Loop_A')?['lm_report_templateid']}
  and lm_period eq @{outputs('DueDate')}
  and _lm_businessunit_value eq @{outputs('UnitId')}
  and _lm_department_value eq @{outputs('DeptId')}
```

Condition: `empty(body('Existing')?['value'])` **is equal to** `true`. In
**If yes**, **Add a new row** on `lm_reportoccurrences`, renamed `NewOcc` — the
field list is §6, with these expressions:

| Column | Value |
|---|---|
| `lm_name` | `concat(outputs('DOM'),'/',outputs('MO'),' ',items('Loop_A')?['lm_newcolumn'],' — ',item()?['_lm_department_value@OData.Community.Display.V1.FormattedValue'])` |
| `lm_period` | `outputs('DueDate')` |
| `lm_reportstage` | `items('Loop_A')?['lm_stage']` |
| `lm_ReportTemplate` | `/lm_report_templates(@{items('Loop_A')?['lm_report_templateid']})` |
| `lm_BusinessUnit` | `/businessunits(@{outputs('UnitId')})` |
| `lm_Department` | `/cr603_chklst_departmentses(@{outputs('DeptId')})` |
| `lm_Function` | `/hr_functions(@{outputs('FnId')})` — only when `FnId` is not empty |
| `lm_CreatorPosition` | `/positions(@{outputs('SubmitPos')})` |

Confirm each lookup's entity-set name in the Add-a-row form — the shapes above
are the pattern, not a guarantee of the set name in your environment. The
`@OData.Community.Display.V1.FormattedValue` annotation on `lm_name` is the
standard Dataverse convention for a lookup column's display text, but confirm
it appears under that exact property name in your own `DeptFn` List rows
output before relying on it — if it doesn't, add a **List rows** on
`cr603_chklst_departmentses` (Row count 1, filtered by `DeptId`) and read the
department's name column from that instead.

⚠️ **The unit *and* the department must both be in the guard's filter** —
see §7 for what breaks with either one missing.

⚠️ **If `lm_period` is Date *and Time*, not Date Only**, `eq` will not match.
Use `lm_period ge @{outputs('DueDate')} and lm_period lt @{addDays(outputs('DueDate'),1,'yyyy-MM-dd')}`.

### Step 13 — Loop C2: the same again for Regions

Copy **all of Steps 10–12 as one block** — Loop C, its nested Loop CD, and the
guard/create inside that. Iterate `Units_Region` instead of `Units_BU`;
`UnitId` = `item()?['_lm_region_value']`; the guard's third clause becomes
`_lm_region_value eq …` (the department clause stays as it is); and on the
create action set `lm_Region` = `/lm_regions(@{outputs('UnitId')})` with
`lm_BusinessUnit` left empty. `DeptFn`, `DeptId` and `FnId` are unchanged —
the department loop does not care which unit table it sits under.

Two copies of the unit loop rather than one merged array — the two unit
tables have different lookup columns and write to different fields. A Stage
3/4 group-wide Template returns rows from neither `Units_BU` nor
`Units_Region`; see open item 5.

### Step 14 — Loop D and Loop E: sections, then citations

After `NewOcc`, Apply to each over `value` from `Sections`, renamed `Loop_D`.
Inside: Compose `SecSrc` = `item()?['lm_reporttemplatecontentchecklistid']`, then
**Add a new row** on `lm_reportoccurrencesections` renamed `NewSec` — fields per
§8, with:

| Column | Value |
|---|---|
| `lm_heading` | `item()?['lm_checklistitemname']` |
| `lm_sequence` | `item()?['lm_checklistitemstep']` |
| `lm_diagnosticangle` | `item()?['lm_diagnosticangle']` |
| `lm_ReportOccurrence` | `/lm_reportoccurrences(@{outputs('NewOcc')?['body/lm_reportoccurrenceid']})` |
| `lm_SourceSectionChecklistItem` | `/lm_reporttemplatecontentchecklists(@{outputs('SecSrc')})` |

Then **List rows** on `lm_reporttemplatesectionitemses`, renamed `Items`,
filtered `_lm_sectionchecklistitem_value eq @{outputs('SecSrc')}`, and Apply to
each over its `value`, renamed `Loop_E`. One **Add a new row** on
`lm_reportsectioncitations`:

| Column | Value |
|---|---|
| `lm_kind` | `if(equals(item()?['lm_itemtype'],4), 11, item()?['lm_itemtype'])` |
| `lm_KPI` | `/lm_kpis(@{item()?['_lm_kpi_value']})` — item types 1 and 2 |
| `lm_breakdowndimension` | `item()?['lm_breakdowndimension']` — type 2 only |
| `lm_Process` | `/lm_processes(@{item()?['_lm_process_value']})` — type 3 |
| `lm_CitedSection` | `/lm_reportoccurrencesections(@{outputs('NewSec')?['body/lm_reportoccurrencesectionid']})` |
| `lm_ChildReportTemplate` | `/lm_report_templates(@{item()?['_lm_childreporttemplate_value']})` — type 4 only |

An empty lookup is fine; a null GUID is not. Guard each with a Condition on the
item type rather than binding all five every time.

**Type 4, the child report — simpler than it used to be.** `lm_ChildReportTemplate`
above is the whole job: set it straight from the item's own
`_lm_childreporttemplate_value`, no List rows, no lookup. **`lm_CitedReportOccurrence`
is not set here at all** — leave it empty, on every Type 4 citation, always
(see §8 for why). There is no longer a second pass or an ordering concern to
manage, because nothing here reaches across to another occurrence.

### Step 15 — Remove the test filter and turn it on

Delete ` and lm_report_templateid eq {guid}` from step 5, save, switch on — after
working through §11.

---

## 11. Build and test order

1. **Trigger + WeekDates only.** Run it and read the seven dates in the run
   history. Confirm they are next Sunday → next Saturday.
2. **Add Loop A and one frequency — Weekly.** Filter to a single template while
   testing (`and lm_report_templateid eq {guid}`). Use a test Template with
   **more than one** unit and **more than one** department line from the
   start — a 1-unit, 1-department test Template can't catch a broken Loop CD
   or a missing department clause in the guard, because everything still
   works by accident when there's only one of each.
3. **Add Loop C, then Loop CD, then the duplicate guard.** Then **run it
   twice** — the second run must create nothing at all, for every
   (unit, department) pair, not just the first one.
4. **Check the count.** A Daily Template with 3 BUs and 2 department lines
   should create **30** occurrences a week (5 dates × 3 units × 2
   departments). **Not 15** — that's what you get if the department
   multiplication silently drops out and only the unit axis survives, the
   exact failure mode §7's second warning describes.
5. **Add the remaining frequencies one at a time.** Test Monthly with a date that
   lands on a **Friday or Saturday** and confirm it is created, not moved.
6. **Test a window spanning two months** — set the window to cover 30 Aug → 5 Sep
   and confirm both a day-31 and a day-5 template fire.
7. **Add sections (Loop D), then citations (Loop E).** Check a section's
   citations come back attached to the right occurrence — with 3+ departments
   in play, it's easy for a copy-paste mistake in Loop CD to leave every
   department's sections pointing at the same (wrong) occurrence.
8. **Open the register and read the names.** Confirm each of the 6 (or
   however many) occurrences for the same date and unit is individually
   named and distinguishable — see §6's "Naming" note — not 6 identical rows
   you can't tell apart without opening every one.
9. Remove the single-template filter.

**Deleting test rows:** an occurrence has sections, and sections have citations.
Delete parents only if the relationships cascade — check first, or you will leave
orphaned citation rows behind.
