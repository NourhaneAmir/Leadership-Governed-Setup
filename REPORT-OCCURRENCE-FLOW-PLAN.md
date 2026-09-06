# Report Occurrence Generator — Flow Plan

> A weekly Power Automate flow that creates next week's **Report Occurrences**
> from approved Report Template Setups, one per Business Unit or Region, with
> their sections and citations copied from the template.
>
> **This is a plan, not code.** Written 05 Sep 2026 against the live schema.
> Updated 06 Sep 2026: a Report Occurrence can now carry more than one
> Department/Function line, once `lm_reportoccurrencedepartmentfunctions` was
> registered — see the new subsection under §6 and the new Loop DF in §10.

---

## 1. What it does, in one line

Every week it looks at the **coming week (Sunday → Saturday)**, asks each
approved Report Template *"do any of your dates fall in this week?"*, and for
each date that does, creates one Report Occurrence per unit — with its sections
and citations.

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
| `lm_reportoccurrences` | the duplicate check, and to find a child report's occurrence |

**Writes**

| Table | What |
|---|---|
| `lm_reportoccurrences` | one row per unit per date |
| `lm_reportoccurrencedepartmentfunctions` | one row per template Department/Function line, per occurrence |
| `lm_reportoccurrencesections` | one row per template section |
| `lm_reportsectioncitations` | one row per citation on that section |

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
                          ├── Already exists?  → skip        (§7)
                          ├── Create lm_reportoccurrences    (§6)
                          │
                          ├── LOOP DF · each department/function line
                          │     └── Create lm_reportoccurrencedepartmentfunctions
                          │
                          └── LOOP D · each template section
                                ├── Create lm_reportoccurrencesections
                                └── LOOP E · each section item
                                      └── Create lm_reportsectioncitations
```

**Rows written per run** = Templates × DueDates × Units × (1 + DeptFnLines + Sections + Citations).
Build Loop A→C first and confirm the counts before adding DF, D and E.

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

One row in `lm_reportoccurrences` per unit per due date.

| Column | Value |
|---|---|
| `lm_name` | **date + template name**, e.g. `5/9 Daily Performance Report` |
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
| `lm_Department` | from the template's **first** department/function line only — see the subsection below for the rest |
| `lm_Function` | from the same line |
| `lm_CreatorPosition` | the unit's **Submitting Position** |

**Leave `lm_fileurl` empty.** The working copy does not exist yet.

### About the review chain

`lm_reportoccurrences` has **`lm_reviewstep` only** — there is no per-occurrence
reviewer table. The chain is **not copied**; it is **read from the template** for
that unit (`lm_reporttemplatereviewchains`, filtered by the BU or Region row, or
by the template alone for a group-wide Setup). Setting `lm_reviewstep = 0` is all
the flow needs to do — the occurrence starts at step 1 of that chain.

### Multiple departments — `lm_reportoccurrencedepartmentfunctions`

A Report Template can name more than one Department/Function line
(`lm_reporttemplatedepartmentfunctions`, already read as `DeptFn` in §3/Step 7).
`lm_Department`/`lm_Function` on the occurrence itself only ever hold the
**first** line — they were never meant to carry all of them. For **every** line
on the template, create one child row:

| Column | Value |
|---|---|
| `lm_Linkeddepartment` | that line's Department (`cr603_chklst_departmentses`) |
| `lm_LinkedFunction` | that line's Function (`hr_functions`), only if the line has one |
| `lm_Reportoccurrence` | the occurrence created above |

⚠️ **The lookup names do not match the template-side table.**
`lm_reporttemplatedepartmentfunctions` uses `lm_Department`/`lm_Function`; this
table uses `lm_Linkeddepartment`/`lm_LinkedFunction` for the equivalent two
relationships — copy the *values* across, not the field names. There is no
sequence/step column here, so line order is not preserved, only which lines
exist. `lm_Department`/`lm_Function` on the occurrence stay as they are (first
line only) — this table is additive, not a replacement.

---

## 7. The duplicate guard — do not skip this

The flow reruns every week and a monthly date can appear in two consecutive
windows. Before creating, check `lm_reportoccurrences` for:

```
_lm_reporttemplate_value eq {templateId}
  and lm_period eq {dueDate}
  and _lm_businessunit_value eq {buId}          ← Region branch: _lm_region_value
```

Set **Row count = 1** and create only when the result is empty.

⚠️ **The unit must be in the filter.** One template on one date legitimately
produces several occurrences — one per unit. Checking only template + date would
create the first unit and treat every other one as a duplicate, silently losing
all but one report per week.

---

## 8. Sections and citations

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

**Child Report — cite the occurrence, never create one.**
The template points at a child *Template*; the occurrence must point at that
child's *Occurrence*. So look up an existing `lm_reportoccurrences` row where
`_lm_reporttemplate_value` = the child template **and** `lm_period` = the same
due date. If one exists, set `lm_CitedReportOccurrence` to it. **If none exists,
create the citation with that lookup empty** and let it be filled in later —
never create the child occurrence from here.

> ⚠️ **Ordering:** if parent and child are both generated in the same run, the
> child may not exist yet when the parent is built. Two options, pick one:
> **(a)** accept the empty lookup and fill it in on the next run, or
> **(b)** add a second pass at the end of the flow that revisits citations with
> `lm_kind = 11` and an empty occurrence lookup. (a) is simpler; (b) is complete.

---

## 9. Open items — settle these before building

| # | Item | Why it matters |
|---|---|---|
| 1 | ~~Annual has no month column~~ — **resolved 05 Sep.** `lm_month` (1–12, January–December) now exists on `lm_report_templates` and is wired in the Setup form. | Annual works like Quarterly: match `lm_month` against the candidate date's month, then check the day falls in the window. |
| 2 | **The citation's parent link.** `lm_reportsectioncitations` has four lookups — `lm_KPI`, `lm_Process`, `lm_CitedSection`, `lm_CitedReportOccurrence` — and no separate parent column. This plan assumes **`lm_CitedSection` is the parent Report Occurrence Section**. | If that assumption is wrong, citations will be created orphaned. Confirm before building §8. Consequence of this reading: a **Paragraph** citation (kind 8) has no target column — not needed by this flow, which only creates kinds 1, 2, 3 and 11. |
| 3 | **`lm_reportobjective` is 100 characters.** | A longer template objective is **rejected with a 400**, not truncated. Either widen the column or don't copy the objective at all. |
| 4 | **Custom frequency has no rule field.** | Templates set to Custom are skipped. If they need to generate, a rule column is required. |
| 5 | **Group-wide (Stage 3/4) templates have no unit rows.** | Decide: create **one** occurrence with BU and Region left null, or skip them. This plan creates one, since its review chain and owner live on the template's parent row. |
| 6 | **`lm_Department`/`lm_Function` on the occurrence are now redundant with `lm_reportoccurrencedepartmentfunctions`.** Both get populated — the singular fields keep the first line only, for whatever still reads them directly. | Not a blocker, just an open question: decide later whether to keep both or drop the singular fields once every consumer reads the child table instead. |

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

Capture `item()` immediately. Inside the nested loops of steps 10–13 it stops
meaning "the date" and starts meaning "the unit", then "the section". This is the
most common way the flow goes wrong.

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
10–13 duplicated into eight cases. This collapses the decision to one boolean so
the create logic is built once.

### Step 10 — Loop C: each Business Unit

Apply to each over `value` from `Units_BU`, renamed `Loop_C`, concurrency
**Off**. Two Composes: `UnitId` = `item()?['_lm_businessunit_value']`,
`SubmitPos` = `item()?['_lm_submittingposition_value']`.

### Step 11 — The duplicate guard, then the occurrence

**List rows** on `lm_reportoccurrences`, renamed `Existing`, **Row count = 1**:

```
_lm_reporttemplate_value eq @{items('Loop_A')?['lm_report_templateid']}
  and lm_period eq @{outputs('DueDate')}
  and _lm_businessunit_value eq @{outputs('UnitId')}
```

Condition: `empty(body('Existing')?['value'])` **is equal to** `true`. In
**If yes**, **Add a new row** on `lm_reportoccurrences`, renamed `NewOcc` — the
field list is §6, with these expressions:

| Column | Value |
|---|---|
| `lm_name` | `concat(outputs('DOM'),'/',outputs('MO'),' ',items('Loop_A')?['lm_newcolumn'])` |
| `lm_period` | `outputs('DueDate')` |
| `lm_reportstage` | `items('Loop_A')?['lm_stage']` |
| `lm_ReportTemplate` | `/lm_report_templates(@{items('Loop_A')?['lm_report_templateid']})` |
| `lm_BusinessUnit` | `/businessunits(@{outputs('UnitId')})` |
| `lm_CreatorPosition` | `/positions(@{outputs('SubmitPos')})` |

Confirm each lookup's entity-set name in the Add-a-row form — the shapes above
are the pattern, not a guarantee of the set name in your environment.

⚠️ **The unit must be in the guard's filter** — see §7 for what breaks otherwise.

⚠️ **If `lm_period` is Date *and Time*, not Date Only**, `eq` will not match.
Use `lm_period ge @{outputs('DueDate')} and lm_period lt @{addDays(outputs('DueDate'),1,'yyyy-MM-dd')}`.

### Step 12 — Loop C2: the same again for Regions

Copy Loop C. Iterate `Units_Region`; `UnitId` = `item()?['_lm_region_value']`;
guard's third clause becomes `_lm_region_value eq …`; set `lm_Region` =
`/lm_regions(@{outputs('UnitId')})` and leave `lm_BusinessUnit` empty.

Two loops rather than one merged array — the two unit tables have different
lookup columns and write to different fields. A Stage 3/4 group-wide Template
returns rows from neither; see open item 5.

### Step 13 — Loop D and Loop E: sections, then citations

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
| `lm_CitedReportOccurrence` | type 4 only — below |

An empty lookup is fine; a null GUID is not. Guard each with a Condition on the
item type rather than binding all four every time.

**Type 4, the child report.** List rows on `lm_reportoccurrences`, Row count 1:

```
_lm_reporttemplate_value eq @{item()?['_lm_childreporttemplate_value']}
  and lm_period eq @{outputs('DueDate')}
```

Row found → set `lm_CitedReportOccurrence`. Nothing found → create the citation
with that lookup empty. Never create the child occurrence here; see §8.

### Step 14 — Loop DF: one row per department/function line

Still inside Loop C (after `NewOcc`), a sibling of Loop D — not nested inside
it. **Apply to each** over `value` from `DeptFn` (already listed in Step 7),
renamed `Loop_DF`. Inside it, one **Add a new row** on
`lm_reportoccurrencedepartmentfunctions`:

| Column | Value |
|---|---|
| `lm_Linkeddepartment` | `/cr603_chklst_departmentses(@{item()?['_lm_department_value']})` |
| `lm_LinkedFunction` | `/hr_functions(@{item()?['_lm_function_value']})` — only if the line has a Function |
| `lm_Reportoccurrence` | `/lm_reportoccurrences(@{outputs('NewOcc')?['body/lm_reportoccurrenceid']})` |

Guard `lm_LinkedFunction` behind a Condition on whether `_lm_function_value` is
empty, same as the citation lookups in Step 13 — a lookup left empty is fine, a
null GUID is not.

### Step 15 — Remove the test filter and turn it on

Delete ` and lm_report_templateid eq {guid}` from step 5, save, switch on — after
working through §11.

---

## 11. Build and test order

1. **Trigger + WeekDates only.** Run it and read the seven dates in the run
   history. Confirm they are next Sunday → next Saturday.
2. **Add Loop A and one frequency — Weekly.** Filter to a single template while
   testing (`and lm_report_templateid eq {guid}`).
3. **Add Loop C and the duplicate guard.** Then **run it twice** — the second run
   must create nothing.
4. **Check the count.** A template with 3 BUs, Daily, should create
   **15** occurrences in a week (5 dates × 3 units). Not 5, not 45.
5. **Add the remaining frequencies one at a time.** Test Monthly with a date that
   lands on a **Friday or Saturday** and confirm it is created, not moved.
6. **Test a window spanning two months** — set the window to cover 30 Aug → 5 Sep
   and confirm both a day-31 and a day-5 template fire.
7. **Add sections (Loop D), then citations (Loop E).** Check a section's
   citations come back attached to the right section.
8. **Add Loop DF.** Test a Template with 3 department/function lines and
   confirm the occurrence gets 3 `lm_reportoccurrencedepartmentfunctions`
   rows — not 1 (only the first, as `lm_Department`/`lm_Function` do), and
   not duplicated on a second run of the same week.
9. Remove the single-template filter.

**Deleting test rows:** an occurrence has sections, and sections have citations.
Delete parents only if the relationships cascade — check first, or you will leave
orphaned citation rows behind.
