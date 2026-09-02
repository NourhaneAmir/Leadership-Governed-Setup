# Leadership Practice — Working Context

> Handoff notes for anyone (human or AI) picking this project up cold.
> Written 30 Aug 2026, updated 01 Sep 2026, updated 02 Sep 2026 (twice)
> against branch `leadership-practice`.
>
> This file records **decisions, hard-won schema facts and open questions** —
> the things that are expensive to rediscover. It is not a substitute for the
> BRD or the prototype specification; it points at them and records how they
> relate.

---

## 1. What this is

**Andalusia Pulse · Leadership Practice** — a Power Apps Code App (Vite + React 18)
covering the governance execution cycle: Reports & Plans → Meetings & Committees →
Meeting Minutes (MOM) → Audit Grid scoring → Decisions → TMS Tasks.

| | |
|---|---|
| Environment | `https://org319b4ea9.crm4.dynamics.com/` |
| Solution | `LeadershipPractice` |
| Branch | `leadership-practice` |
| Dataverse tables | 42 registered in `power.config.json`, including Minutes, MOM Notes, Audit Grid instances/answers, Approval Cycles/Steps, Authority Matrix rows, `wlog_decisions`, and (02 Sep) `pm_kpiachievments`/`stf_kpiachievmentbreakdowns` — see §6 |
| Two modules | `src/modules/leadership/LeadershipApp.jsx` (execution), `src/modules/governance/GovernanceApp.jsx` (setup) |

---

## 2. THE GOVERNING RULE (decided by the product owner)

> **Implement as the prototype specification says. Where the specification is
> silent on how something is handled, take it from the BRD.**

This matters constantly, because the two documents disagree in ~29 places.

**Consequences of this rule that surprise people:**

- **AG-15 and AG-16 stay.** The BRD's catalogue has **13** active questions
  (AG-01…AG-14 minus retired AG-07). The prototype spec and the code have **15**
  (it adds AG-15 invitation lead time and AG-16 MOM write-up period). Every score
  therefore uses a different denominator than the BRD baseline. *This is accepted.*
- **The governance settings stay null.** The BRD confirms a 90% pass threshold, a
  48-hour MOM approval period and a 2-working-day agenda lead time. The spec leaves
  all three unresolved, so the app does too. Nothing is judged pass/fail.
- **`delegatedAttend` stays `'exclude'`** even though the BRD says a delegated
  attendance counts as present.
- **Decisions stay one entity** with a single six-value status, not the BRD's
  three entities (Intake / Request / Decision) with two status models.
- **Auto-scored Audit Grid answers are NOT stored.** The BRD requires retaining the
  score and its computed inputs (FR-MOM-13, NFR-15); the spec stores only manual
  answers and evidence. The spec wins.

**If a Grid is ever produced as accreditation evidence, the numbers will not
reconcile to the BRD.** That is a known, accepted gap — flag it in writing if it
comes up.

---

## 3. Source documents

| Document | Status | Use |
|---|---|---|
| `leadership-practice-prototype-spec.md` | **The specification** | Leads on every conflict |
| `Andalusia_Pulse_Leadership_Practice_BRD_V1.0.pdf` (30 Jul 2026) | Approved business baseline | Fills gaps only |
| `README.md` | Conversion notes | How the HTML prototype became this Vite project |
| `prototype.html` (repo root, added 01 Sep 2026) | The actual static HTML prototype | Not built or served by Vite — a reference file only, for checking visual/copy fidelity against the original |
| `Leadership Practice Extension.html` | A **second**, richer prototype — shared in chat 02 Sep, **not saved to the repo** | Defines the full "Report/Plan Composition" feature: Sections with a Diagnostic Angle, KPI/Breakdown/Process/child-report citations, the Build-a-Report screen, Reports-received review actions, Sharing, Reporting Hierarchy. Source for the plan below — re-request it from the user if it's needed again, it only exists in that chat turn. |
| `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md` | Approved implementation plan (02 Sep), not part of the repo | Dataverse schema + phased implementation steps for the Report/Plan Composition feature above. Read this before doing any further work on Reports & Plans — see §5/§7.8/§9. |

The BRD **contradicts itself** in three places, and the code picked a side:

1. **Setup Type** — §6 says "Business Meeting / Accreditation Committee"; §7.2 says
   "Business Meeting / Committee". `lm_setuptype` follows §6. **This decides which
   meetings get an Audit Grid at all** and is still open (see §7).
2. **Team of Teams** — a Category in FR-SET-02, a classification under
   Cross-functional in §7.2. Schema follows §7.2.
3. **Report Category** — three values in FR-RPT-07, four in FR-SET-12. Schema has four;
   the spec says three.

---

## 4. What is actually wired to Dataverse

| Area | State |
|---|---|
| Governance Setup module (Meeting + Report Template register) | ✅ live |
| **Group-wide (Stage 3/4) Chairman/Co-Chairman/Facilitator (Meeting) and Owner/Submitting Position/Team Channel/Speciality (Report)** | ✅ **live** (this session) |
| Meeting Occurrences — create, edit, **cancel**, **reschedule**, mark Held, **Agenda add/remove/reorder/record-distribution**, attendance | ✅ live (Attendance/Held/Edit from an earlier session; Cancel/Reschedule/Agenda edit **this session**) |
| Report Occurrences — create (Template **and** Custom), file URL, review chain (submit / approve / RMI) + history | ⚠️ **built, but disconnected from the nav as of 02 Sep** — `NewReportModal`/`DvReportDetail`/`dvReportOccs` still exist and still work end to end against `lm_reportoccurrences`, but nothing currently opens them (see the row below and §5's 02 Sep entry) |
| **Meeting Minutes tab** (nav screen) — reads `lm_meetingminuteses` directly | ✅ **live** (01 Sep — the write path itself, `DvMinutesBody`, was already live from an earlier session; only the top-level list screen was still seeded until now) |
| **Reports & Plans tab** (nav screen) | 🔴 **reverted from live to seeded, on purpose, 02 Sep** — was reading `lm_reportoccurrences` directly as of 01 Sep; rebuilt this session as the citation-based composer from `prototype.html` (sections that cite live KPIs/tactics/PM entries/issues/tasks/other reports), which has no Dataverse equivalent yet, so it now runs on seeded `db.reports`/`db.paragraphs`/`db.templates` instead. This was an explicit product-owner instruction, not a regression found by accident — see §5. |
| Authority Matrix + Approval Cycles | ✅ live, read-only by design (`AuthorityMatrixPanel`, embedded in Governance Settings) |
| **Audit Grid scoring** — Meeting Occurrence's own Grid tab | ✅ **live** (this session) — `liveScoreGrid()` computes all 16 questions from the live occurrence/Minutes/Template; full Facilitator→Chair lifecycle (score, evidence, submit, approve+publish, return, open a correction version) writes through the backend functions that were already built |
| **My Workspace (nav screen)** | ✅ **live** — reads its Work Queue, Upcoming panel and This Month stats directly off the full `dvMeetingOccs`/`dvReportOccs` arrays via `dvWorkItems()`. Two silent-data-loss bugs fixed here 01 Sep — see §5: an overdue Meeting with partial attendance recording used to vanish from Work Queue, and a blank/unrecognized status code used to vanish a row from every screen at once. Its Decisions filter tab still shows 0 because Decisions (below) only just went live. |
| **Decisions register** | 🟡 **partially live** (this session) — `wlog_decisions` read + minimal create wired as its own list on the Decisions tab, alongside (not replacing) the existing seeded Decision workflow. Not yet linked to the Meeting Agenda Item or Report that raised it — deferred by explicit instruction, see §5/§6/§7. |
| **Committee Scores (nav screen)** | ✅ **live** (01 Sep) — `ScreenGrid` now reads `fetchAuditGridInstances()` joined against `dvMeetingOccs`, instead of seeded `db.grids`. See §5 for the join details and the Approved-only Coverage/Score rule. |
| Tasks, Comments, Governance Settings (persisted values) | ❌ **seeded demo data only** |

**`scoreGrid()` (seeded) and `liveScoreGrid()` (live) are two separate functions**,
not one shared implementation — the live version reads a Dataverse occurrence/
Minutes/Template shape that doesn't line up with the seeded `db`, so it re-derives
the same 16 questions independently rather than adapting live data into the
seeded function's expected shape. Two of its rows are deliberately simplified
(AG-01 checks only TOR presence, not a review date; AG-06 counts only Discussion
Notes, not Task/Decision outputs) and five always read Not Applicable — **AG-10
through AG-14 still can't move onto live data until Decisions and Tasks exist.**

---

## 5. Recent work

`dec7171 "Add audit scoring"` and `98f1012 "Add a rescheduale option..."`, on
top of `b9b76e3 "meeting minutes"`, were committed in an earlier pass.
`6fdde05 "Add cadence-aware Meeting dates and base wlog_decisions wiring"`
covers the section right below. `fe84b2b "Add the new prototype"` covers the
one after it, bundled together with `prototype.html` — the original static
HTML prototype, now checked into the repo root (see §3).

### This session: cadence-aware New Meeting date, and a live bug fix found along the way

`naturalRecurrenceDate(frequency, dayOfMonth, monthInQuarter, fromDate)` (new,
`LeadershipApp.jsx`, just above `NewMeetingModal`) computes the soonest real
calendar date a Setup's own cadence lands on — e.g. a Monthly Setup on day 1
next lands on the 1st of the soonest qualifying month. Wired into
`NewMeetingModal`'s existing "Setup detail loaded" effect so `f.date` defaults
to that computed date instead of a generic `today+5`. The existing
`bookedDate`/`moved` logic in that same form (already built by a parallel
session before this pass) picks the result up automatically — if the natural
date lands on a weekend or holiday, the form shows the "will be booked on…"
note and books the next working day on save. No new UI needed for that half.

`MEETING_MONTH_IN_QUARTER` (new export, `dataverse.js`) is the read-side
decode for `lm_monthofthequarter` — only the write-side key existed before.

**Semesterly/Annually reading of `monthInQuarter` is an assumption, not a
confirmed rule.** `lm_monthofthequarter` only has three values ("1st/2nd/3rd
month"), which is exact for Quarterly (a real 3-month quarter). For
Semesterly (6 months) and Annually (12 months) there is no equivalent field
in the schema, so "1st/2nd/3rd month of a quarter" is generalized here to
"1st/2nd/3rd slice of the period" (month 1/3/5 of a semester, month 1/5/9 of
a year). Flag this if it ever needs to match a real HR calendar precisely.

**Bug found and fixed along the way:** `DvRescheduleOccModal` called
`isWeekend()`, which a parallel session's edit had deleted from the file
while replacing most weekend-handling with the unified `isNonWorking()` +
auto-roll-forward approach above. Reschedule was never updated to match — it
deliberately still hard-blocks a weekend pick outright (a holiday there is
only a soft warning), so it needed its own `isWeekend()`, not the auto-roll
one. This would have thrown a `ReferenceError` the moment anyone opened
Reschedule on a live occurrence. Restored.

**Verified, no change needed:** My Workspace already read fully from
`dvMeetingOccs`/`dvReportOccs` (see §4) — asked, checked, confirmed, nothing
to fix.

### This session: `wlog_decisions` registered and wired at a base level

Per an explicit ask to add a Decisions table linked to the Decisions tab and
to Reports/Templates. What actually happened, and why it stopped short of
the full ask:

- Registered `wlog_decisions` (see §6 for the exact command — it is **not**
  the same invocation as every other table here) and inspected its real
  columns before writing any app code.
- **Found it has no lookup to any table in this app** — only to an unrelated
  employee time-log table (`wlog_worklogs`, also inspected, confirmed
  irrelevant, not kept registered). Reported this rather than guessing a
  link. The user's call: link it later (from the Report section / Meeting
  Agenda item), set up the base only for now.
- Also decided (same round): keep the existing seeded Decision workflow
  (Direct/Authority-Check types, Approval Cycle, Proposals, exec owner,
  outputs) as-is, and add `wlog_decisions` as a separate live list alongside
  it, not a replacement.
- Built accordingly: `fetchWorkLogDecisions()` / `createWorkLogDecision()` in
  `dataverse.js`, a `dvDecisions` array threaded through `refreshOccurrences()`
  same as `dvMeetingOccs`/`dvMinutes`, and a "Live Decisions (wlog_decisions)"
  card + `WorkLogDecisionModal` on `ScreenDecisions` (`LeadershipApp.jsx`).
  Status/Review Status/Escalation Result are read via the connector's
  `_xxx_label` sibling fields, not a hand-maintained numeric map — see §6 for
  why. No status is set on create; Dataverse's own option-set default applies.

**Near-miss during registration, worth knowing about:** `pac code
delete-data-source`, used to back out an exploratory registration, does a
full regeneration of `src/generated/` and silently renamed/deleted the
model/service files for a large number of **already-registered, unrelated**
tables — even though `power.config.json` itself came back clean. Caught via
`git status` before anything was committed; restored with `git checkout --
src/generated/ .power/schemas/appschemas/dataSourcesInfo.ts`. See §6 for the
safe way to back out a registration instead.

| File | What changed |
|---|---|
| `src/services/dataverse.js` | Added `updateMeetingOccurrenceStatus`, `updateMeetingOccurrenceAttendance`, `updateMeetingOccurrence` (edit), `cancelMeetingOccurrence`, `recordAgendaDistribution`, `createMeetingOccurrenceAgendaItem`, `archiveMeetingOccurrenceAgendaItem`, `updateMeetingOccurrenceAgendaSequence`. Widened `meetingTemplateParentPayload()` / `reportTemplateParentPayload()` and their matching `fetch*TemplateDetail()` selects for the Stage 3/4 parent-row fields (see §6). Fixed a systemic bug: every `create()`/`update()` call used to assume success whenever nothing *threw*, silently discarding the SDK's own `result.success`/`result.error` — a shared `idOrThrow()` / `assertSuccess()` pair now surfaces Dataverse's real error message instead of a generic "no id was returned." (`fetchMeetingMinutes()` already existed, unused by any screen, until it was wired into `ScreenMinutes`.) The Audit Grid backend (`saveAuditGridAnswer`, `archiveAuditGridAnswer`, `approveAuditGridInstance`, `createAuditGridInstance`, `updateAuditGridState`) was already fully built before this pass — none of it needed changing, only calling. |
| `src/modules/leadership/LeadershipApp.jsx` | `DvMeetingDetail`: Mark as Held, Edit (`DvEditOccModal`), Cancel (`DvCancelOccModal`), Reschedule (`DvRescheduleOccModal` — creates a new occurrence + cancels the old one, see below), Attendance recording, Agenda add/remove/reorder/record-distribution, and now full **Audit Grid scoring** (`DvGridBody`/`DvGridQuestion`/`DvGridCorrectionModal`, driven by a new `liveScoreGrid()`/`liveAttendance()` pair — see §4). `ScreenMinutes` and `ScreenReports` switched from seeded `db.moms`/`db.reports` to live `dvMinutes`/`dvReportOccs`, with the now-redundant seed-only detail routes removed (`ReportDetail`, `RptTable`, `MomDetail`, `MomEditBody` are dead code as of this change, same situation `MeetingDetail` was already in). `NewMeetingModal`/`NewReportModal`: group-wide (Stage 3/4) Chairman/Facilitator/Owner/Submitting Position now fall back to the Setup's own parent-row fields instead of coming back empty. Excel file-reading proof of concept (`readExcelComponents`, via `xlsx` sourced from the SheetJS CDN, not npm — see §8) wired into the Report file field, client-side only, no Dataverse write. |
| `src/modules/governance/GovernanceApp.jsx` | `dataverseMeetingToSetup()` / `dataverseReportToSetup()`: a Stage 3/4 Setup's Chairman/Co-Chairman/Facilitator or Owner/Submitting Position/Team Channel/Speciality now hydrate from the parent row into a synthetic one-entry `units` list (keyed `GROUP_KEY`) when editing, instead of coming back blank. `meetingTemplateParentPayload()`/`reportTemplateParentPayload()` write them back out the same way on save. Verified (no change needed): Supportive Function Representation already saves and reads back correctly end to end, and the Setup Register's Usage tab already reads live from `lm_meetingoccurrences`/`lm_reportoccurrences`. |
| `power.config.json`, `.power/schemas/...`, generated services/models | Refreshed for the new parent-row fields on `lm_meetingtemplates` and `lm_report_templates` (§6), and re-pulled after the tables in §4 were added. |

### Reschedule, specifically

Built as **create a new occurrence + cancel the old one**, not an in-place date
edit — because `lm_rescheduledfrom` is a lookup *from* a new row *to* the one it
replaced, and there's no `Rescheduled` value on `lm_meetingstatus`. The new
occurrence carries the same Setup, scope, Chair, Facilitator, Agenda (relabelled
source `'Rescheduled'`) and Attendees across; Agenda coverage and Attendance
already recorded stay behind on the original, now-cancelled occurrence.

### Audit Grid scoring, specifically

`liveScoreGrid()` is a **separate function from the seeded `scoreGrid()`**, not a
shared one adapted for live data — the live occurrence/Minutes/Template shape
doesn't line up cleanly with the seeded `db`, so re-deriving the same 16
questions independently was more reliable than forcing an adapter. Same
thresholds and bands throughout. Two rows are simplified because the data to do
better doesn't exist live yet (AG-01: TOR presence only, not a review date;
AG-06: counts only Discussion Notes, not Task/Decision outputs) — both say so in
their own "Computed from" trace text. AG-10 through AG-14 always read Not
Applicable. A "Clear" action was added for AG-02 (archives the Answer row,
`archiveAuditGridAnswer()`) since the backend already supported it and the UI
had no way to unset a manual score once picked. A full test scenario with a
worked-out expected score (91.4%, 7 of 15 coverage, from a specific fixture) is
in the Reference list, §10.

### This session (01 Sep): two silent-data-loss bugs fixed, Committee Scores gone live

**Bug 1 — Work Queue silently dropped overdue Meetings with partial
attendance.** `dvWorkItems()`'s "Mark the Meeting as Held, or cancel it"
prompt only fired when *every* Attendee was still unrecorded
(`unrecorded===o.attendees.length`). The moment even one Attendee had a
presence set while the Meeting itself was never marked Held, the condition
went false and the Meeting vanished from Work Queue entirely — no prompt,
no visibility. Fixed by decoupling it from attendance state: any Meeting
still `Scheduled` past its date now fires the prompt regardless of how much
attendance recording has happened.

**Bug 2 — a much bigger one, found while chasing the first: `status: null`
silently vanishes a row from every screen that reads it.** Proven directly
from a live screenshot: the Meetings tab showed 44 rows in the table but its
Not-yet-held/Held-record-open/Held-and-closed/Cancelled tabs summed to only
3. `MEETING_OCC_STATUS[o.lm_meetingstatus] || null` defaulted to `null` for
any row whose `lm_meetingstatus` was blank or unrecognized — and **every**
screen that reads Meeting/Report status (Work Queue, the Meetings tab, the
Calendar) branches on an exact `'Scheduled'`/`'Held'`/`'Cancelled'` string
match with no `null` case, so those rows disappeared everywhere at once,
not just from one screen. Fixed in all four status-decoding spots in
`dataverse.js` (`fetchMeetingOccurrences()`, `fetchReportOccurrences()`,
and their `*ByTemplate()` counterparts): default to `'Scheduled'` /
`'Draft'` instead of `null` — the state every occurrence/report starts in
when this app itself creates one. **Open question for whoever owns that
data:** 41 of 44 live Meeting Occurrences had no recognized status, which
strongly suggests they came from somewhere other than this app's own New
Meeting form (which always writes `Scheduled` explicitly) — most likely a
bulk-created batch (e.g. the Meeting Occurrence Generator flow, §10, if
it's live and isn't setting `lm_meetingstatus` on the rows it creates).
This fix is a safety net in the app, not a substitute for fixing that at
the source.

### This session (02 Sep): Reports & Plans rebuilt as a citation-based composer — **reverted from live Dataverse back to seeded, on purpose**

**This directly reverses the previous entry in this file** ("Reports & Plans
tab ... same story: the detail page was already live"). Read this before
touching `ScreenReports`/`ReportDetail` again.

**Why:** the product owner wants the tab to match `prototype.html`'s fuller
design — a Report authored as sections that each cite a live record (a KPI
with target/actual and an embedded Power BI preview, a Strategy tactic/POC/
project, a Planning & Monitoring entry, an issue from another system, a
task, another paragraph, or a whole child Report) instead of an uploaded
working-copy file — plus three more views (Section templates, Paragraph
pool, Reporting hierarchy). Explicit instruction: build this on **seeded
mock data first**, wire it to Dataverse later, because no tables exist yet
for sections/citations/templates. Full turn-by-turn requirements-gathering
for this is in the chat transcript, not repeated here.

**What actually changed in `LeadershipApp.jsx`:**
- `ScreenReports` and `ReportDetail` — previously listed as **dead code** in
  §9's "Smaller, self-contained gaps" (superseded by the live
  `dvReportOccs`-based screen) — are **revived and rewritten** to the
  citation-composer model, ported near line-for-line from `prototype.html`'s
  `LeadershipApp` IIFE (`ScreenReports`/`ReportDetail` around its line
  4529–4802). `RptTable` similarly revived/updated (still not called from
  anywhere, same as it wasn't in the prototype — kept for parity/reuse).
- New components, all in the same file, inserted right after
  `ReportDetail`: `BIEmbed`, `CiteCard`, `CitePicker`, `SectionRow`,
  `ReportComposer`, `KpiCascade`, `citeLabel`, `TemplateSectionEditor`,
  `TemplatesTab`, `PoolTab`, `reportChildIds`/`reportParentIds`,
  `HierarchyTab`, `ReportWizard` (+ its `WizSteps`/`shiftPeriod`/
  `WIZ_STEPS`/`WIZ_DEPTS`/`TPL_STYLE` helpers).
- New mock catalogues (all seeded consts, not Dataverse-backed):
  `DIAG`/`DiagChip`, `PROC_REG`, `BI_REPORTS`, `KPI_CAT` (+ `achFor`/
  `achPct`/`achCls`/`findKpi`/`bdDims`), `STRAT`, `PM_ENTRIES`, `ISSUES`,
  `SECTION_TPL_SEED`, `CITE_KINDS` (+ `citeKind`/`citeId`/`citeCls`) — all
  inserted right after the existing `RPT_SETUPS`. Each `RPT_SETUPS` entry
  gained a `tpl:` field pointing at its matching `SECTION_TPL_SEED` id
  (`rs1→TPL-QLT`, `rs2→TPL-NUR`, `rs4→TPL-BME`, `rs3→TPL-EXE`) — separate
  from the pre-existing `template:` field (a cosmetic working-copy filename,
  unrelated, left alone).
- `seed()` gained `paragraphs:[...]` (12 seeded sections, content ported
  verbatim from `prototype.html`) and `templates:
  JSON.parse(JSON.stringify(SECTION_TPL_SEED))`. The 8 existing seeded
  `db.reports` rows (`sub1`…`sub8`) had `file`/`url`/`ver`-as-upload-count
  replaced with `blocks:[...]` (an ordered array of paragraph ids) — same
  ids/people/statuses/periods as before, so every other place that reads
  `db.reports` (canSeeReport, reportDue, the meeting-input linker) needed no
  changes.
- New `A.*` action functions for the composer (`addTemplate`,
  `editTemplate`, `deleteTemplate`, `addTplSection`/`editTplSection`/
  `moveTplSection`/`removeTplSection`, `addTplItem`/`removeTplItem`,
  `applyTemplate`, `addSection`/`reuseSection`/`removeSection`/
  `moveSection`, `editPara`/`citePara`/`uncitePara`,
  `createReportFromWizard`) — all additive, existing `submitReport`/
  `reviewApprove`/`reviewRMI` untouched since they never referenced `file`.
- `ScreenWorkspace`'s "+ New Report" button used to open the live
  `NewReportModal` directly; now navigates to the Reports & Plans tab
  instead (`go('rpt')`), since a report created via `NewReportModal` would
  land in `dvReportOccs` and never show up on the now-seeded Register.

**What did NOT change:** `NewReportModal`, `DvReportDetail`, `dvReportOccs`
and every Dataverse call behind them are all still in the file, untested-
but-presumably-still-correct, simply **no longer reachable from any nav
path**. They are the natural starting point once real tables exist for the
section/citation content model — see the new Open Decision §7.8.

**Pre-existing bug fixed along the way, unrelated to the port itself:**
`ScreenReports` was already mid-edit and broken before this session started
(`git status` showed it uncommitted) — a JSX tag mismatch (4 `<>` vs 3
`</>`) that meant **the file didn't compile at all**. The rewrite above
replaced the whole function, incidentally fixing this.

**Second bug, found only after deploying to the live Power Apps player:**
the app hydrates its whole `db` from `localStorage` on load
(`localStorage.getItem(KEY)`, `KEY='andalusia_lp_v06'` at the time) and only
calls `seed()` if nothing is cached. A browser that had ever loaded the
*old* schema (no `paragraphs`/`templates`, `blocks` missing) kept that old
save, so on reload the app skipped `seed()`, loaded the stale shape, and
something reading `db.paragraphs.length` hit `undefined` — an **uncaught
render error with no error boundary, which blanks the entire app**, not
just the Reports tab (confirmed via a live screenshot: sidebar and top bar
gone too). Fixed by bumping `KEY` to `'andalusia_lp_v07'` — same pattern
already used for prior schema changes, forces a fresh `seed()` for anyone
with an old save cached. **Generalizes the same lesson already in §6** about
never letting a stale/unexpected shape silently propagate instead of
resetting to a known-good state — this time via a `localStorage` cache
rather than a Dataverse null default.

**Committee Scores tab (`ScreenGrid`) rewired to Dataverse.** Was 100%
seeded (`db.grids`/`db.occs`/`MTG_SETUPS`) despite the Audit Grid itself
being fully live per-occurrence (§4) — a real gap, not a stale doc note.
Now reads `fetchAuditGridInstances()` (already existed in `dataverse.js`,
never called by any screen until now) joined against `dvMeetingOccs`.
Simplification worth knowing: a live Grid Instance is only ever created for
an Accreditation Committee occurrence (`createAuditGridInstance()` is only
reachable from the `accred`-gated path in `DvMeetingDetail`/`DvGridBody`),
so unlike the seeded version there's no separate Committee-vs-Business-
Meeting filter to apply — every row already is one. Coverage/Score only
render once a Grid is `Approved`, matching when Dataverse actually
populates `lm_coverage`/`lm_score`; everything else shows "Pending Review"
rather than a stale or fabricated number. The question-catalogue card at
the bottom is untouched — it's the static, Taxonomy-owned list, not
per-org data.

**Also surfaced, not yet acted on:** re-reading the Authority Matrix /
Approval Cycle backend while answering a question about the Decisions tab
found it's considerably more ready than §7.2 implied — `lm_authoritymatrixrows`
(Type/Max Value/Required Level/Cycle), `lm_approvalcycles` +
`lm_approvalcyclesteps` (ordered routing), the 5-value `DECISION_TYPE` enum,
and `authorityCheckLive()` itself are all already built and live. See the
revised §7.2 below — the real remaining gap is narrower than it reads today.

### This session (02 Sep, continued): Report/Plan Composition — full plan approved, no application code yet

**Directly answers Open Decision §7.8** (below) — the "content model" gap
the seeded composer entry above left open. A second, richer prototype
(`Leadership Practice Extension.html`, chat-only, see §3) was walked
through in detail, and a full implementation plan was produced and
approved: `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md`.
**Read that file before doing anything else on Reports & Plans** — this
entry is a summary, not a substitute.

**Scope, as decided with the user:**
- Sections carry a Diagnostic Angle (Untyped/Descriptive/Diagnostic/
  Predictive/Prescriptive) and, at the Template level, links to multiple
  KPIs, KPI Breakdowns, Processes, or a child Report Template.
- At execution (Build a Report), the same Sections cite ten possible kinds:
  KPI, Breakdown, Process, POC, Project, Strategy, BI Report, Paragraph
  (another report's section), Issue, Task, or a whole child Report.
  **Only KPI and Breakdown resolve live figures** — everything else
  (POC/Project/Strategy/BI Report/Issue/Task) is a **text-only label**, by
  explicit instruction, since none of those have a live table in this app.
- **Task and Escalation tables: deferred.** Both would otherwise back two
  of the "Reports received" review actions (assign-a-task, escalate); for
  now both save as the same text-only citation treatment as POC/Project/
  etc. `PROJECT-CONTEXT.md` §9 already separately tracks a Tasks table as
  blocked for the unrelated MOM/Decision follow-up feature — this decision
  doesn't resolve that one, it just avoids building a second, different
  Tasks table for this feature in the meantime.
- **Sequencing: nothing gets built until every table in the plan's Part 1
  exists.** Explicit instruction — including the one step (wiring the
  orphaned `DvReportDetail` into navigation) that has no schema dependency
  at all.

**Two tables in the plan turned out to already exist** — registered and
inspected rather than assumed:
- `pm_kpiachievments` (real logical name, plural) — the periodic KPI
  actuals row: `_pm_kpi_value`, `_pm_businessunit_value`, `stf_department`/
  `stf_function` (as **text**, not lookups), `pm_month`/`pm_year`,
  `pm_target`/`pm_actual`, plus a `pm_breakdown` text column of unclear
  purpose (see §6).
- `stf_kpiachievmentbreakdowns` — richer than the plan first assumed: a
  real `stf_breakdowntype` choice column (not free text), **seven**
  separate optional member lookups (specialty/physician/account/
  sub-account/department/employee/platform — one active per row per the
  usual convention), a `stf_name` text column that may be a ready-made
  display label, and a `_stf_total_value` lookup back to the parent
  `pm_kpiachievments` row (there is no direct KPI lookup on this table).
  Full column notes in §6 and in the plan file's Part 1 §B.

**Open technical unknowns, not product decisions** (full detail in the
plan file's "Open items"): which table `_pm_kpi_value` actually points at;
whether `stf_name` alone is enough to display a breakdown without resolving
which of the seven member lookups applies; how `pm_breakdown` (text, on
the achievement row itself) relates to the separate breakdown table; and
whether Dataverse's record-sharing (`GrantAccess`) is reachable from this
SDK at all, needed for the plan's Sharing step.

**This directly overlaps with the seeded composer built earlier the same
day** (previous entry above) — that work is effectively a working UI
reference implementation of much of what this plan's Part 2 calls for
(`ReportComposer`, `SectionRow`, `CitePicker`, `TemplateSectionEditor`,
`HierarchyTab`, etc., all already written against seeded data in
`LeadershipApp.jsx`). Once the plan's tables exist, porting those
components to read/write the real tables is likely far less work than
building the UI from scratch — check that code before writing new
components for any of the plan's Part 2 steps.

---

## 6. Schema facts that are expensive to rediscover

### NEW this session: group-wide (Stage 3/4) roles now live on the parent row
`lm_meetingtemplates` gained `lm_meetingchairman`, `lm_meetingcochairman`,
`lm_meetingorganizerfacilitator`. `lm_report_templates` gained `lm_ownerposition`,
`lm_submittingposition`, `lm_teamchannel`, `lm_reportspecialty` — note this is a
**different logical name** than the per-unit tables' `lm_speciality`/
`lm_reportspeciality`, not a typo.

Why: a Stage 3/4 Setup has no per-unit child table at all (see the section below),
so it had nowhere to record who chairs/facilitates/owns it. These four/three
columns exist specifically to cover that one case — they are **not** used when a
Setup has real Business Unit or Region placements, which still use the per-unit
columns exclusively. `lm_report_templates` has no stage field of any kind, so
group-wide-ness is inferred purely from having neither a Business Unit nor a
Region child row.

### Logical names are inconsistent — some singular, some plural
`pac code add-data-source -t <name>` needs the exact logical name:

| Plural | Singular |
|---|---|
| `lm_meetingminutes`, `lm_momnotes` | `lm_auditgridinstance`, `lm_auditgridanswer`, `lm_approvalcycle`, `lm_approvalcyclestep`, `lm_authoritymatrixrow` |

Guessing wrong gives `Failed to get entity definition`. **The CLI also fails
transiently** — a name that fails once often works on retry.

### `wlog_decisions` — registered differently from every `lm_` table, and not linked to anything here
Added this session. Worth reading in full before touching it again:

- **Logical name is `wlog_decisions`, plural** — the ask named `wlog_decision`.
- **`-t <name>` alone is no longer enough.** Every `lm_` table above was
  registered that way at some point, but as of this CLI version (`2.6.4`)
  plain `pac code add-data-source -t <name>` fails with `A required argument
  --apiId is missing.` The working invocation for this table was:
  `pac code add-data-source -a shared_commondataservice -c
  39b0e662674844b79a870b4e5a7485c9 -d default.cds -t wlog_decisions` — the
  legacy "Common Data Service" connector and connection id, **not**
  `shared_commondataserviceforapps` (a different, newer connector present in
  the same environment that registers tables under `connectionReferences`
  with no working `default.cds` dataset at all — tried first, backed out).
  Run `pac connection list` to re-find these ids if they ever need
  rediscovering; they are not environment variables or config anywhere.
- **Registered as `"dataSourceType": "Connector"` in `dataSourcesInfo.ts`,
  not `"Dataverse"`** like every other table. It lives in
  `power.config.json` under `connectionReferences`, not
  `databaseReferences.default.cds` where the other 39 sit. Functionally it
  behaves the same from a call-site's point of view (`Wlog_decisionsService`
  has the identical `create`/`update`/`get`/`getAll` shape), but it is a
  genuinely different integration path.
- **No lookup column to `lm_meetingoccurrences`, `lm_reportoccurrences`,
  `lm_meetingtemplates` or `lm_report_templates`.** Its only relationship is
  `_wlog_worklog_value` → `wlog_worklogs`, a separate, unrelated employee
  time-log table (activity/hours/manager/department — nothing governance-
  related). Confirmed by registering and inspecting `wlog_worklogs` too, then
  removing that registration once it turned out irrelevant. **Decided
  2026-08-31: the link to a Meeting Agenda Item / Report comes later** — see
  §7's new open decision.
- **Choice columns have no discoverable numeric codes.** `wlog_decisionstatus`,
  `wlog_reviewstatus` and `wlog_escalationresult` are Picklists whose values
  come from a live `GetOptionSetMetadata` connector operation, not from the
  cached schema file — unlike every `MEETING_*`/`REPORT_*` status this file
  hand-maps to a number. Read them via the `_wlog_decisionstatus_label` /
  `_wlog_reviewstatus_label` / `_wlog_escalationresult_label` sibling fields
  the connector returns instead (already how `fetchWorkLogDecisions()` does
  it). `createWorkLogDecision()` sets no status on create for the same
  reason — Dataverse's own option-set default applies.
- Field caps, if writing to it again: `wlog_name` 100 chars, `wlog_decisiontaken`
  4000, `wlog_expectedoutput` 1000, `wlog_managernote` 2000, `wlog_evidenceurl`
  500 (from the cached `.power/schemas/commondataservice/worklogdecisions.Schema.json`).

### ⚠️ `pac code delete-data-source` is not a safe undo
Used once this session to back out an exploratory `wlog_worklogs`
registration. It triggered a **full regeneration of `src/generated/`** that
silently renamed and deleted the model/service files of a large number of
already-registered, completely unrelated tables (`lm_meetingoccurrences`,
`lm_meetingtemplates`, and roughly thirty others) — even though
`power.config.json` itself came back clean. Caught via `git status` before
it was committed; fixed with `git checkout -- src/generated/
.power/schemas/appschemas/dataSourcesInfo.ts`, which is now the recommended
way to back out an unwanted `add-data-source` call: **hand-edit
`power.config.json` + `.power/schemas/appschemas/dataSourcesInfo.ts` +
`src/generated/index.ts` to remove just the one entry, delete that table's
own two generated files, and never call `delete-data-source`** unless the
plan is to immediately diff the entire `src/generated/` tree afterward.

### Chair / Co-Chair / Facilitator are NOT on the Setup — except now, sometimes
They live on the **per-scope child rows** for a Business-Unit- or Region-scoped
Setup:
- `lm_meetingtemplatebusinessunits` — has chairman, co-chairman, facilitator, Teams channel
- `lm_meetingtemplateregions` — same shape
- `lm_meetingtemplatedepartment_functions` — **has NONE of them**, only department + function

...and on the **parent row** for a group-wide (Stage 3/4) Setup — see above. This
is correct and deliberate: the same Committee runs in different BUs with
different chairs. It also means **one Setup produces one occurrence per scope**.

⚠️ **A department-scoped occurrence has no chair, no facilitator and no attendees**
— `lm_meetingattendeeslists` can only link to a BU row or a Region row, never a
department.

### `lm_meetingtemplates` has NO start time, end time, duration or time zone
The occurrence has all three columns; the Setup has nothing to populate them from.
**Meetings are created with blank times.** This also makes AG-16 unscoreable.

### Attendee type changes meaning between tables
| Table | Code 1 | Code 2 |
|---|---|---|
| `lm_meetingattendeeslists` (Setup) | **Core** | **Supportive** |
| `lm_meetingoccurrenceattendeeses` | **Required** | **Optional** |

Same codes, different labels — copying the raw integer works but reads like a bug.
AG-09 measures **Required** only.

### Columns still capped at Dataverse's default 100 characters
Dataverse **rejects with a 400 rather than truncating**, so all writes are guarded
client-side. Widened so far: `lm_momnotes.lm_notes` → 4000,
`lm_meetingminutes.lm_returnreason` → 2000.

**Still narrow and should be widened:**
- `lm_auditgridanswers.lm_evidence` — every manual score needs an evidence note
- `lm_auditgridinstances.lm_returnreason`
- `lm_auditgridinstances.lm_correctionreason`
- `lm_reportoccurrencehistories.lm_note` — the Request More Information reason

Constants to keep in step: `MOM_NOTE_MAX`, `MOM_REASON_MAX`, `GRID_EVIDENCE_MAX`,
`GRID_REASON_MAX`, `REPORT_NOTE_MAX` in `dataverse.js`.

### Every create()/update() must be checked, not just try/caught
The Power Apps SDK's `create()`/`update()` calls **do not throw on a Dataverse
validation failure** — they resolve normally with `{ success: false, error }`.
Code that only wraps the call in try/catch and checks whether an id came back
(the pattern this whole file used before this session) silently reports a
misleading "succeeded but no id was returned" instead of the real reason
(a length cap, a required field, a permission error). Always route through
`idOrThrow()` (create) or `assertSuccess()` (update) in `dataverse.js`.

### A status decode must never default to null — default to the row's real starting state
Found 01 Sep via a live screenshot, not a hunch (see §5 for the full story):
`MEETING_OCC_STATUS[o.lm_meetingstatus] || null` and the equivalent for
`REPORT_OCC_STATUS` silently dropped **41 of 44** live Meeting Occurrences
from Work Queue, the Meetings tab and the Calendar simultaneously, because
every one of those screens branches on an exact `'Scheduled'`/`'Held'`/
`'Cancelled'` string match with no `null` case. Fixed by defaulting to
`'Scheduled'` (Meetings) / `'Draft'` (Reports) instead of `null` — the state
every row starts in when this app's own create path writes it. **The lesson
generalizes**: any status/state decode read by more than one screen should
default to the record's real starting value, never to `null`, unless every
consumer explicitly has a null case. A blank Dataverse choice column is a
normal, expected condition (a row created outside this app's own create
functions, e.g. a flow or a bulk import, may never set it) — treating it as
"unknown, so hide the row everywhere" is almost never the right read.

### The app hydrates from `localStorage` — bump `KEY` on any seed shape change
`const KEY='andalusia_lp_v07'` near the top of `App()` in `LeadershipApp.jsx`.
On load, if `localStorage[KEY]` exists it is used as-is, **`seed()` is never
called**. A browser holding a save from before a schema change (e.g. a
report missing the `blocks` array added 02 Sep) will hit an uncaught error
on whatever field is now missing, and — with no error boundary anywhere in
the tree — that blanks the **entire app**, not just the affected screen.
Full story in §5's 02 Sep entry. Bump the version suffix any time a seeded
data shape changes; there is no migration path, only cache-busting.

### `pm_kpiachievments` / `stf_kpiachievmentbreakdowns` — pre-existing, shared, multi-prefix tables
Registered 02 Sep for the Report/Plan Composition plan (§5). Both are
**org-wide tables used by other modules too** — columns mix `pm_`, `stf_`,
`pms_`, `comp_` prefixes on the same rows, a strong signal they're shared
infrastructure, not something owned by this app. Only the columns relevant
to this app are noted here; many more exist and don't matter here.

`pm_kpiachievments` (note: real logical name has no "e" — "achievments",
and is plural): `_pm_kpi_value` (lookup, target table **not yet
confirmed** — over 40 tables in this org have "KPI" in the name, see the
plan file's Open items), `_pm_businessunit_value`, `stf_department`/
`stf_function` (**plain text**, not lookups — convenient, since the Build
screen's Department→Function filter can match against them directly),
`pm_month` (+ `_pm_month_label`), `pm_year`, `pm_target`, `pm_actual`,
`pm_breakdown` (text — relationship to the breakdown table below is
unconfirmed), `_pm_parent_value` (self lookup, purpose unconfirmed).

`stf_kpiachievmentbreakdowns`: no direct KPI lookup — joins back via
`_stf_total_value` → the parent `pm_kpiachievments` row. `stf_breakdowntype`
(+ `_stf_breakdowntype_label`) is a real choice column for the dimension
(e.g. "Specialty"), not free text. The breakdown's *member* is one of
**seven** separate optional lookups — `_stf_specialty_value`,
`_stf_physician_value`, `_stf_account_value`, `_stf_subaccount_value`,
`_stf_department_value`, `_stf_employee_value`, `_stf_platform_value` —
same one-active-per-row convention as `wlog_decisions`'s citation columns,
which one is populated depends on `stf_breakdowntype`. `stf_name` (text)
may already be a ready-made display label, which would make resolving
those seven lookups unnecessary for this app — not yet confirmed against
live data. Figures: `stf_value` (actual), `comp_breakdowntarget` (target).
`stf_breakdownlevel`/`stf_breakdownpath`/`_stf_parent_value` suggest a
nested/hierarchical breakdown structure beyond a flat dimension·member
shape — also unconfirmed.

### Other gaps found by reading the schema
- **No TOR review date** on `lm_meetingtemplates` — only the link. AG-01 can return
  5 or 0, never 3 ("present but past its review date").
- **No `Rescheduled` value** on `lm_meetingstatus`, and `lm_rescheduledfrom` is a
  **lookup to another occurrence** — this is now actually wired (§5), but it means
  a reschedule is always a new row, never an in-place date change.
- **No recorder position** anywhere. The spec falls back to Facilitator.
- **No `taxonomyState`** on report or meeting occurrences — the no-setup flag is
  written but nothing consumes it and no sync exists.
- **`lm_customname`** exists on report occurrences and is never written.
- **Stray `lm_newcolumn`** on `lm_meetingtemplatedepartment_functions` and
  `lm_reporttemplatereviewchains` — accidental default-named columns, safe to delete.
- **`DATAVERSE_CONFIG.publisherPrefix` is `'lp'`** but every table is `lm_`.

---

## 7. Open decisions — these block work

1. **Is Setup Type "Accreditation Committee" or "Committee"?**
   Decides which occurrences get an Audit Grid. **The code currently disagrees with
   itself** — the seeded path scores every Committee, the live path (now built and
   in use) scores only accreditation ones. This is no longer a theoretical gap:
   the live Grid tab is real and gated on `accred` today, so resolving this
   decides whether real Committees are being under- or over-scored right now,
   not just whether a future feature gets built correctly.
2. **Where does the 0–6 authority level live?**
   The only candidate is `hr_level` (an HR grade). Visibility scope and role family
   exist nowhere. *Blocks the full Decisions workflow* (Direct vs. Authority-Check
   routing, Approval Cycle, Proposals) from ever moving off seeded data. Does
   **not** block the base `wlog_decisions` read/create wired this session (§5) —
   that table has no authority-check concept at all, it's a separate, flatter thing.
   **Revised 01 Sep — this blocks less than it looks like it does.** Re-read the
   backend while answering a question about this exact gap: `lm_authoritymatrixrows`
   (Type/Max Value/Required Level/Cycle), `lm_approvalcycles` + `lm_approvalcyclesteps`
   (ordered routing), the 5-value `DECISION_TYPE` enum, and `authorityCheckLive()`
   itself are **all already built, live and ready to call** — none of that needs
   building. What's actually still missing, precisely:
   (a) this authority-level question itself, unchanged;
   (b) a live table to hold an actual Decision record (Type/Value/Creator/Path) —
   nothing in Dataverse stores this today, `wlog_decisions` doesn't either (see §6,
   it has no Type/Value/Path columns at all, it's a different shape for a different
   purpose);
   (c) Proposals, Outputs (also needs the still-missing Tasks table), Observers,
   and the classification fields (Topic Nature/Categories, Impact, Confidentiality)
   the seeded UI filters by — none of these have a live equivalent anywhere.
3. **How do Custom Reports get reviewers?**
   The review chain hangs off `lm_reporttemplatereviewchains` → Template. A Custom
   Report has no Template, so **it can be created but never reviewed**. Needs either
   a per-occurrence reviewer table or a borrowed chain. *Currently shows an explicit
   warning in the UI rather than failing silently.*
4. **Quorum: percentage or minimum head count?** The BRD flags this as unresolved in
   its own dependencies. Schema and code both assume percentage.
5. **One history table or three?** Reports have `lm_reportoccurrencehistories`.
   Meetings, Minutes and Grids have none.
6. **File storage direction (reporting behaviour) — paused on the product owner's
   instruction.** Report files currently save as a short text pointer
   (`lm_fileurl`, ≤100 chars — the CLI shortener route was tried and abandoned:
   the hosted app's CSP blocks calls to any external shortener). What "real"
   storage should mean (SharePoint upload? a longer URL column? something else)
   is intentionally on hold while reporting behaviour is being rethought — don't
   build further on this until asked.
7. **How does a live Decision link to the Meeting Agenda Item / Report that raised
   it?** `wlog_decisions` (§6) has no lookup column for either today. Deferred by
   explicit instruction (2026-08-31): the link is added later, base read/create
   was wired without it. Don't build the Report/Meeting-side "Decisions raised
   here" embedding (the other half of the original ask) until this lands — there
   is nothing to join on yet. **Candidate shape, discussed but not yet built**:
   two separate nullable lookups on `wlog_decisions` — one to
   `lm_meetingoccurrenceagendas` (Meeting Agenda Item), one to
   `lm_reportoccurrences` (Report) — never both on the same row, matching how
   this schema already handles "either/or" scope elsewhere (Business Unit vs.
   Region on occurrences) rather than one polymorphic field.
8. **How does the new Reports & Plans citation composer (02 Sep, §5) reconcile
   with the already-live `lm_reportoccurrences` occurrence flow
   (`NewReportModal`/`DvReportDetail`/`dvReportOccs`)?** — **Answered, later
   the same day.** `lm_reportoccurrences` gains new child tables (Sections,
   Citations) plus a Template-side Section/citation-item model, per the
   approved plan at
   `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md`
   (see §5's second 02 Sep entry). Not yet built — every table in the
   plan's Part 1 needs to exist first, per explicit instruction. The
   seeded composer stays as-is and as the UI reference until then.

---

## 8. Environment gotchas

- **`npx power-apps run` needs port 3000.** `power.config.json` pins
  `localAppUrl: http://localhost:3000`; Vite defaults to 5173. Fixed via
  `server.port` + `strictPort` in `vite.config.js`. **Side effect:** if 3000 is
  already in use, `npm run dev` now fails hard instead of moving to 3001.
- **`npm run dev` alone gives an app with NO data.** Dataverse calls are caught and
  swallowed, so everything renders empty. Use the Power Apps play URL to test with
  real data.
- **`xlsx` installs from the SheetJS CDN**, not npm. The npm registry's `xlsx`
  package (0.18.x) carries an unpatched prototype-pollution CVE with no fix
  available via npm — the maintainers only publish patched releases (0.19.3+) to
  `cdn.sheetjs.com`. `package.json` points at
  `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` for this reason. A
  checkout without network access to that host fails the build with
  `failed to resolve import "xlsx"`. Fix: `npm install`.
- **Lint cannot run on this machine.** An Application Control policy blocks the
  oxlint native binary. No static analysis is running at all. *(A different
  sandbox in this session's history could run `npx oxlint` directly — if that's
  available to you, use it; the note above describes the maker's own machine.)*
- **`pac` calls fail transiently** with `ETIMEDOUT` against
  `*.environment.api.powerplatform.com` (an Azure Private Link host). Retry.
  Telemetry warnings (`OneDS`) are noise and never block anything.
- **Bundle is ~1 MB** in one chunk, over Vite's advisory limit. `xlsx` is the
  obvious dynamic-import candidate.

---

## 9. Remaining features checklist

Organized by what actually unblocks each item — not by how big it feels.

### Done
- [x] **Audit Grid scoring UI.** Built — `liveScoreGrid()` computes all 16
      questions from live data, and the full Facilitator→Chair lifecycle writes
      through the backend functions. **Still gated by Open Decision §7.1** —
      the UI only appears for `accred` (Accreditation Committee) occurrences,
      so resolving that decision may mean it should show for more (or fewer)
      occurrences than it does today. AG-10…AG-14 stay Not Applicable until
      Tasks/Decisions exist.
- [x] **Committee Scores tab gone live** (01 Sep) — `ScreenGrid` reads
      `fetchAuditGridInstances()` joined against `dvMeetingOccs` instead of
      seeded `db.grids`. See §5.
- [x] **Two silent-data-loss bugs in Work Queue/Meetings/Calendar, fixed**
      (01 Sep) — an overdue Meeting with partial attendance recording used to
      vanish from Work Queue, and any row with a blank/unrecognized
      `lm_meetingstatus`/`lm_status` used to vanish from every screen at
      once (41 of 44 live Meeting Occurrences were affected). See §5/§6.
- [x] **Reports & Plans citation-based composer, on seeded data** (02 Sep) —
      Register/Section templates/Paragraph pool/Reporting hierarchy, ported
      from `prototype.html`. **Deliberately reverted the tab from the live
      `dvReportOccs` flow back to seeded**, since that flow has no
      section/citation concept and no table exists for one yet. See §5's
      02 Sep entry and Open Decision §7.8 before building this onto real
      tables.

Nothing is currently sitting in a "ready to build, just not built yet" state —
the two items that were here (Edit/Cancel/Reschedule/Agenda, then Audit Grid
scoring) have both been picked up. Everything left below is blocked on
something, except the one item below that's now live at a base level.

### Live, base only — not the full feature
- [x] **Decisions, base plumbing.** `wlog_decisions` read + minimal create
      wired this session as its own list on the Decisions tab (§4/§5). What's
      still missing, in order: (1) a lookup column linking it to a Meeting
      Agenda Item / Report — Open Decision §7.7, deferred on purpose; (2) once
      that exists, embedding it into the Report/Meeting Follow-up tabs, which
      is the other half of the original ask; (3) the seeded Decision workflow
      (Direct/Authority-Check routing, Approval Cycle, Proposals) staying
      seeded-only until Open Decision §7.2 resolves — `wlog_decisions` was a
      deliberate choice not to build that onto this flatter table.

### Blocked — needs a new Dataverse table
- [ ] **Tasks** — `lm_tasks` (1 table), plus its own screen (Tasks are currently
      only a sub-object of MOM/Decision follow-up). Worth deciding what "sync"
      means in production before building real sync logic — the seeded version
      already fakes a sync-failure state.
- [ ] **Comments** — `lm_comments` (1 table). Decide up front: one shared table
      across every screen, or one per feature.
- [ ] **Governance Settings persistence** — `lm_governancesettings` (1 table).
      The real blocker isn't the table, it's getting sign-off on each of the 8
      OD-xx values (§2) — the screen exists specifically to simulate a value
      without pretending it's approved.
- [ ] **Reports & Plans content model** — **Open Decision §7.8 is now
      answered**: the full schema (Template Sections + citation items,
      Occurrence Sections + citations, Sharing) is specified in the
      approved plan at
      `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md`.
      What's still blocking: the plan's Part 1 tables need to be built —
      two (`pm_kpiachievments`, `stf_kpiachievmentbreakdowns`) already
      existed and are now registered (§5/§6), the rest do not exist yet.
      No application code until they do, per explicit instruction.

### Blocked — needs a decision, not a table
See §7 in full. In priority order by what they unblock: Setup Type (Audit Grid),
authority-level location (seeded Decision workflow), Custom Report reviewers,
quorum definition, Decision↔Meeting/Report linking (§7.7, deferred on purpose).

### Paused — by explicit instruction, not by a blocker
- [ ] Real file storage for Report working copies (SharePoint upload or
      equivalent) — see §7.6. Don't pick this up without asking first.

### Smaller, self-contained gaps
- [ ] `fetchSetups()` in `dataverse.js` is a literal stub
      (`return notWiredYet('fetchSetups')`) — confirm nothing still calls it, or
      implement it.
- [ ] Governance Setup's Report Template "destination SharePoint link" field has
      its own "Coming soon" placeholder, separate from the per-occurrence file
      field — same underlying pause as §7.6.
- [ ] Four narrow 100-character columns still need widening (§6) — a five-minute
      fix that unblocks usable Audit Grid evidence/reasons once that UI exists.
- [ ] Dead code, current as of 02 Sep (this list flips direction easily —
      check §5 before deleting anything on it): `MeetingDetail`, `MomDetail`,
      `MomEditBody` are still superseded seed-only components, safe to treat
      as reference-only. **`ReportDetail`/`RptTable` are NOT dead anymore** —
      they were revived 02 Sep as the citation composer. `NewReportModal`
      and `DvReportDetail` are the ones now unreferenced from any nav path
      (still fully working against live Dataverse, just orphaned) — see §5's
      02 Sep entry and Open Decision §7.8 before deleting either.

---

## 10. Reference

Three working documents were produced alongside an earlier version of this file:

- **BRD Conformance Ledger** — 29 divergences between the build and the BRD, each
  showing whether the prototype spec pointed the same way
  <https://claude.ai/code/artifact/f5edcacd-187a-4c69-bec5-aacff1a2ae68>
- **Build-Out Checklist** — 63 tickable items across tables, columns, services,
  screens, integrations and decisions
  <https://claude.ai/code/artifact/59f13ef0-773f-438e-b172-c24820fe0e66>
- **Meeting Occurrence Generator** — step-by-step Power Automate build for the
  weekly Thursday flow that creates next week's occurrences, one per BU / Region /
  Department
  <https://claude.ai/code/artifact/6d7fefca-78cf-4172-a967-ce99bab2dbd1>

Three more were produced this session:

- **Feature Readiness** — every feature sorted by ready-now vs. blocked, with the
  exact prerequisite for each blocked item (kept up to date across this session —
  most of its "ready now" list is now in §5's "done" column instead)
  <https://claude.ai/code/artifact/8544c8a9-9875-404b-b562-fe4bb99766db>
- **Occurrence Detection Flow** — Power Automate build guide for detecting which
  Templates are due for an occurrence next week, plus the schema gaps (Twice
  Weekly/Monthly have no second-day field, Custom frequency has no rule field)
  that block full automation
  <https://claude.ai/code/artifact/f6d4a4e8-6138-4f7b-a183-6f50b47ceff8>
- **Testing the Audit Grid** — a test scenario built around one specific fixture
  (Accreditation Committee, 75% quorum, 2 agenda items, 4 required attendees),
  with the expected score worked out in advance (91.4%, 7 of 15 coverage) so the
  live scoring can be checked against a real prediction rather than eyeballed
  <https://claude.ai/code/artifact/8c97f86f-6daf-4558-9509-b8142f9c3170>

### A note on verification

Every schema claim in this file was read from the generated definitions in
`.power/schemas/dataverse/` or from the actual code in `src/services/dataverse.js`,
not from documentation. Where this file and the BRD disagree about what a column
contains, **this file describes what is actually deployed.**
