# Andalusia Pulse · Leadership Practice — Data Dictionary

Generated 2026-09-20 against DT New (`https://org319b4ea9.crm4.dynamics.com`), from `src/services/dataverse.js`.

## Scope

This document covers every Dataverse table this app's code actually reads or writes (via `dvTable()` in `src/services/dataverse.js`), not every table or column that exists in Dataverse. Columns are limited to the ones the app itself references.

Every table also carries Dataverse's own standard system columns — `createdon`, `createdby`, `modifiedon`, `modifiedby`, `ownerid`, `statecode`, `statuscode`, `versionnumber`, and similar — which are the same on every table and are **not** repeated per table below.

A `Lookup → X` datatype means the column is a foreign key to table X. A `Choice: A(1), B(2)…` datatype lists the allowed labels with their real numeric codes in Dataverse in parentheses. `(not in cached schema, inferred from usage)` flags a column the cached connector schema file doesn't list, usually because it was added to Dataverse after that schema was last refreshed.

**Coverage: 56 tables, 428 columns.**

## Contents

- **Citation Reference Tables (added 19-20 Sep, no registration needed)**
  - [`and_microsoftgroupmembers`](#and_microsoftgroupmembers) — and_microsoftgroupmember
  - [`crd04_specialtieses`](#crd04_specialtieses) — crd04_specialties
  - [`hx_taskses`](#hx_taskses) — hx_tasks
  - [`lm_bireportdashboards`](#lm_bireportdashboards) — lm_bireportdashboard
  - [`lm_meetingcategories`](#lm_meetingcategories) — lm_meetingcategory
  - [`stf_executioncategories`](#stf_executioncategories) — stf_executioncategory
  - [`stf_strategypocs`](#stf_strategypocs) — stf_strategypoc
  - [`strategy_strategies`](#strategy_strategies) — strategy_strategy
- **Meeting Template Setup & Occurrences**
  - [`lm_meetingattendeeslists`](#lm_meetingattendeeslists) — lm_meetingattendeeslist
  - [`lm_meetingoccurrenceagendas`](#lm_meetingoccurrenceagendas) — lm_meetingoccurrenceagenda
  - [`lm_meetingoccurrenceattendeeses`](#lm_meetingoccurrenceattendeeses) — lm_meetingoccurrenceattendees
  - [`lm_meetingoccurrencedepartmentfunctions`](#lm_meetingoccurrencedepartmentfunctions) — lm_meetingoccurrencedepartmentfunction
  - [`lm_meetingoccurrences`](#lm_meetingoccurrences) — lm_meetingoccurrence
  - [`lm_meetingtemplateagendaitems`](#lm_meetingtemplateagendaitems) — lm_meetingtemplateagendaitem
  - [`lm_meetingtemplatebusinessunitses`](#lm_meetingtemplatebusinessunitses) — lm_meetingtemplatebusinessunits
  - [`lm_meetingtemplatedepartmentfunctions`](#lm_meetingtemplatedepartmentfunctions) — lm_meetingtemplatedepartmentfunction
  - [`lm_meetingtemplatelinkedreportses`](#lm_meetingtemplatelinkedreportses) — lm_meetingtemplatelinkedreports
  - [`lm_meetingtemplateregions`](#lm_meetingtemplateregions) — lm_meetingtemplateregion
  - [`lm_meetingtemplates`](#lm_meetingtemplates) — lm_meetingtemplate
  - [`lm_meetingtemplatesupportivefunctionses`](#lm_meetingtemplatesupportivefunctionses) — lm_meetingtemplatesupportivefunctions
- **Reference & Organisation Data**
  - [`and_teamschannels`](#and_teamschannels) — and_teamschannel
  - [`businessunits`](#businessunits) — businessunit
  - [`cr301_specialtyksa_service_hubs`](#cr301_specialtyksa_service_hubs) — cr301_specialtyksa_service_hub
  - [`cr603_chklst_departmentses`](#cr603_chklst_departmentses) — cr603_chklst_departments
  - [`cr603_organizationstructures`](#cr603_organizationstructures) — cr603_organizationstructure
  - [`crd04_regionses`](#crd04_regionses) — crd04_regions
  - [`hr_employees`](#hr_employees) — hr_employee
  - [`hr_functions`](#hr_functions) — hr_function
  - [`pm_kpiachievments`](#pm_kpiachievments) — pm_kpiachievment
  - [`strategy_kpises`](#strategy_kpises) — strategy_kpis
  - [`strategy_processes`](#strategy_processes) — strategy_process
  - [`systemusers`](#systemusers) — systemuser
- **Report Occurrences, Audit Grid, Minutes & Decisions**
  - [`lm_auditgridanswers`](#lm_auditgridanswers) — lm_auditgridanswer
  - [`lm_auditgridinstances`](#lm_auditgridinstances) — lm_auditgridinstance
  - [`lm_meetingminuteses`](#lm_meetingminuteses) — lm_meetingminutes
  - [`lm_meetingoccurrencelinkedreportses`](#lm_meetingoccurrencelinkedreportses) — lm_meetingoccurrencelinkedreports
  - [`lm_momnoteses`](#lm_momnoteses) — lm_momnotes
  - [`lm_reportoccurrencehistories`](#lm_reportoccurrencehistories) — lm_reportoccurrencehistory
  - [`lm_reportoccurrences`](#lm_reportoccurrences) — lm_reportoccurrence
  - [`lm_reportoccurrencesectionses`](#lm_reportoccurrencesectionses) — lm_reportoccurrencesections
  - [`lm_reportoccurrenceshares`](#lm_reportoccurrenceshares) — lm_reportoccurrenceshare
  - [`lm_reportsectioncitationses`](#lm_reportsectioncitationses) — lm_reportsectioncitations
  - [`wlog_decisions`](#wlog_decisions) — wlog_decision
- **Report Template Setup (Governance)**
  - [`lm_approvalcycles`](#lm_approvalcycles) — lm_approvalcycle
  - [`lm_approvalcyclesteps`](#lm_approvalcyclesteps) — lm_approvalcyclestep
  - [`lm_authoritymatrixrows`](#lm_authoritymatrixrows) — lm_authoritymatrixrow
  - [`lm_report_templates`](#lm_report_templates) — lm_report_template
  - [`lm_reporttemplatebusinessunitses`](#lm_reporttemplatebusinessunitses) — lm_reporttemplatebusinessunits
  - [`lm_reporttemplatecontentchecklists`](#lm_reporttemplatecontentchecklists) — lm_reporttemplatecontentchecklist
  - [`lm_reporttemplatedepartmentfunctions`](#lm_reporttemplatedepartmentfunctions) — lm_reporttemplatedepartmentfunction
  - [`lm_reporttemplateregions`](#lm_reporttemplateregions) — lm_reporttemplateregion
  - [`lm_reporttemplaterelatedkpises`](#lm_reporttemplaterelatedkpises) — lm_reporttemplaterelatedkpis
  - [`lm_reporttemplaterelatedprocesseses`](#lm_reporttemplaterelatedprocesseses) — lm_reporttemplaterelatedprocesses
  - [`lm_reporttemplatereviewchains`](#lm_reporttemplatereviewchains) — lm_reporttemplatereviewchain
  - [`lm_reporttemplatesectionitemses`](#lm_reporttemplatesectionitemses) — lm_reporttemplatesectionitems
  - [`lm_setupactivities`](#lm_setupactivities) — lm_setupactivity

---

## Citation Reference Tables (added 19-20 Sep, no registration needed)

### `and_microsoftgroupmembers`

**Logical name:** `and_microsoftgroupmember`

One row per member of a Microsoft 365 (Entra) group. Lets a Meeting Setup's Attendee list use a whole group instead of one person, and lets a group's members be looked up for reference. Added directly via the generic cross-environment connector -- never registered with pac code add-data-source, so it has no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `and_microsoftgroupmemberid` | Microsoft Group Member | Unique ID (GUID) | Primary key. Also the record a Meeting Attendee's group lookup binds to -- the group's lowest-id membership row stands in for the group itself, since there is no separate 'group' row. |
| `and_groupname` | Group Name | Text | Plain text Microsoft 365 group name, not a lookup -- the same name repeats once per member row, since there is no separate groups table. |
| `and_member` | Member | Text | Plain text name of one member of the group named in Group Name. |

### `crd04_specialtieses`

**Logical name:** `crd04_specialties`

A Specialty list a POC can be recorded against -- a DIFFERENT table from the Setup wizard's own Speciality list (cr301_specialtyksa_service_hubs), despite the similar name. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `crd04_specialtiesid` | Specialty | Unique ID (GUID) | Primary key. |
| `crd04_title` | Title | Text | The Specialty's display name, shown in the POC picker's Specialty filter. |

### `hx_taskses`

**Logical name:** `hx_tasks`

A large, pre-existing Tasks table shared with other systems, not owned by this app. This app reads a filtered set of tasks for the Task citation kind in Build-a-Report, and creates new rows when a report reviewer raises a follow-up Task. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `hx_tasksid` | Task | Unique ID (GUID) | Primary key. |
| `hx_tasktitle` | Task Title | Text | Task title, shown as the citation's label. |
| `hx_taskdescription` | Task Description | Text, multi-line | Task description. |
| `hx_justifications` | Justifications | Text, multi-line | Repurposed by this app to carry the 'action to be taken and why' text when raising a Task from a Report -- there is no dedicated 'action' column on this shared table. |
| `hx_status` | Status | Choice: New(123200004), In Progress(100000001), Submitted(123200005), On Hold(100000005), Closed(123200002), Cancelled(123200003), Rejected(931940001) | The task's current status. |
| `hx_priority` | Priority | Choice: Low(123200000), Medium(123200001), High(123200002), Critical(931940001) | The task's priority. |
| `hx_duedate` | Due Date | Date/time | The task's due date. |
| `hx_startdate` | Start Date | Date/time | The task's start date. |
| `_hx_assignee_value` | Assignee | Lookup → systemusers | Who the task is assigned to. |

### `lm_bireportdashboards`

**Logical name:** `lm_bireportdashboard`

A Power BI report/dashboard reference. Citable from a Build-a-Report Section, and shown framed under whichever KPI it is linked to on the Business Intelligence screen. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_bireportdashboardid` | BI Report Dashboard | Unique ID (GUID) | Primary key. |
| `lm_reportname` | Report Name | Text | The dashboard's display name. |
| `lm_dashboardlink` | Dashboard Link | Text (URL) | The report's Power BI portal link, as copied out of Power BI; converting a portal link to an embeddable one is the Business Intelligence screen's job, not this table's. |
| `_lm_kpi_value` | KPI | Lookup → strategy_kpises | Which KPI's figures this dashboard shows -- lets the Business Intelligence screen frame the right dashboard under a KPI. A KPI can have more than one dashboard. |

### `lm_meetingcategories`

**Logical name:** `lm_meetingcategory`

The governed list of allowed (Stage, Type/Classification, Category) combinations for a Meeting Setup. Owned by a separate Taxonomy application and bulk-uploaded from lm_meetingcategory-bulk-upload.xlsx; this app only reads it, never writes it. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingcategoryid` | Meeting Category | Unique ID (GUID) | Primary key. |
| `lm_name` | Name | Text | The Category's display name, offered in the Meeting Setup wizard's Category picker. |
| `lm_stage` | Stage | Choice (lm_meetingstage, shared with Meeting Template) | Which of the 4 governance Stages this Category applies to. |
| `lm_typeclassification` | Type/Classification | Choice (lm_meetingclassification, shared with Meeting Template) | Narrows which Type/Classification values are valid for this Stage/Category combination, so the two lists cannot disagree. |
| `lm_labelpattern` | Label Pattern | Text | A naming-convention pattern this app can draw on when deriving a Setup's display name from this Category. |
| `lm_regionchip` | Region Chip | Text | A short region tag shown alongside the Category in the picker. |
| `lm_requiresspecialty` | Requires Specialty | Yes/No | Whether choosing this Category requires the Setup to also record a Speciality. |
| `lm_sortorder` | Sort Order | Whole number | Controls the Category picker's display order (sorted ascending, then by Name). |

### `stf_executioncategories`

**Logical name:** `stf_executioncategory`

The category list a POC is classified under -- the target of stf_strategypocs' POC Category lookup. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `stf_executioncategoryid` | Execution Category | Unique ID (GUID) | Primary key. |
| `stf_categoryname` | Category Name | Text | The category's display name, shown in the POC picker's Category filter. |

### `stf_strategypocs`

**Logical name:** `stf_strategypoc`

A Proof-of-Concept / execution initiative record owned by the Strategy module. Cited as a real link (not free text) from a Build-a-Report Section's POC citation, with five filterable attributes for the picker. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `stf_strategypocid` | POC | Unique ID (GUID) | Primary key. |
| `stf_pocname` | POC Name | Text | Display name shown in the POC picker and used as the citation's label. |
| `stf_pocdescription` | Description | Text, multi-line | The POC's description, shown alongside its name. |
| `stf_pocstatus` | POC Status | Choice: Active(1), Succeeded(2), Failed(3), Retired(4) | The POC's current lifecycle status. |
| `_stf_region_value` | Region | Lookup → another table (Region) | One of the picker's five filters. |
| `_stf_poccategory_value` | POC Category | Lookup → stf_executioncategories | Groups the POC by category; resolved against stf_executioncategories. |
| `_stf_specialty_value` | Specialty | Lookup → crd04_specialtieses | One of the picker's five filters. |
| `_stf_strategykpi_value` | Strategy KPI | Lookup → strategy_kpises | Links the POC to the KPI it is meant to move. |
| `stf_successcriteria` | Success Criteria | Text | Free text describing what success looks like for this POC. |
| `stf_target` | Target | Number | The POC's numeric target value, read alongside its other attributes. |

### `strategy_strategies`

**Logical name:** `strategy_strategy`

A Strategy/tactic record from the Strategy module, cited as a real link (not free text) from a Build-a-Report Section's Strategy citation. Added directly via the generic cross-environment connector -- no cached connector schema file.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `strategy_strategyid` | Strategy | Unique ID (GUID) | Primary key. |
| `strategy_newcolumn` | Strategy Name | Text | The Strategy's display name -- carries the same 'renamed column keeps its generic logical name' naming accident as strategy_kpises/strategy_processes. |
| `strategy_strategydescription` | Description | Text, multi-line | Description of the Strategy. |
| `strategy_strategystatus` | Status | Choice (read via its formatted-value label; numeric codes not decoded locally) | Current status of the Strategy. |
| `strategy_strategylevel` | Strategy Level | Choice (read via its formatted-value label; numeric codes not decoded locally) | The Strategy's organisational level. |
| `_strategy_region_value` | Region | Lookup → another table (Region) -- only the formatted name is kept, not the id | The Region the Strategy belongs to, shown as plain text. |
| `_strategy_kpi_value` | KPI | Lookup → strategy_kpises | The KPI this Strategy is meant to move. |

## Meeting Template Setup & Occurrences

### `lm_meetingattendeeslists`

**Logical name:** `lm_meetingattendeeslist`

The template-level Attendees list, one row per attendee per Business-Unit/Region unit row -- who is invited to a recurring meeting, as either a Position pick or (since 19-20 Sep) a Microsoft Group, each marked Core or Supportive for the quorum calculation.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingattendeeslistid` | Meeting Attendees List | Unique ID (GUID) | Primary key for one Attendee row. |
| `lm_attendeename` | Attendee Name | Text (max 850) | For a Position attendee, left to the Position behind the lookup; for a Microsoft Group attendee, carries the group's own name, since the bound and_microsoftgroupmembers row's own name belongs to a person, not the group. |
| `lm_attendeeposition` | Attendee Position | Lookup → cr603_organizationstructures | The Position attending, for a Position-kind attendee (the app treats every Chairman/Co-Chairman/Facilitator/Agenda-owner/Attendee as a Position pick, not a direct User lookup). |
| `lm_attendeetype` | Attendee Type | Choice: Core (1), Supportive (2) | Core vs Supportive -- the quorum percentage on the Setup counts only Core attendees; the card lets either be chosen, so this is not always Core. |
| `lm_isgroup` | Is Group | Yes/No (not in cached schema, inferred from usage) | True when this attendee is a Microsoft Group rather than a Position -- added 19-20 Sep so a group attendee (which has no Position at all) can be told apart from a Position attendee on read. |
| `lm_microsoftgroup` | Microsoft Group | Lookup → and_microsoftgroupmembers (not in cached schema, inferred from usage) | Added 19-20 Sep: binds a group attendee to its and_microsoftgroupmembers row (one row per group/member pair) instead of a Position, for attendees that are a Microsoft Group rather than a person. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | The template-level bind, kept alongside the per-unit bind so template-level Attendee queries can still see the row. |
| `lm_meetingtemplateperbusinessunit` | Meeting Template Per Business Unit | Lookup → lm_meetingtemplatebusinessunitses | Binds this Attendee to the specific Business Unit row it belongs to, for a Stage 1 Setup. |
| `lm_meetingtemplateperregion` | Meeting Template Per Region | Lookup → lm_meetingtemplateregions | Binds this Attendee to the specific Region row it belongs to, for a Stage 2 Setup. |

### `lm_meetingoccurrenceagendas`

**Logical name:** `lm_meetingoccurrenceagenda`

One occurrence's actual Agenda -- items carried forward from the Setup's Standing Agenda or added ad hoc, kept in sequence and each tracked for whether it was covered when the Minutes are written up.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingoccurrenceagendaid` | Meeting Occurrence Agenda | Unique ID (GUID) | Primary key for one occurrence agenda item; also what a MOM Note and the reorder/coverage actions target. |
| `lm_title` | Title | Text (max 850) | The agenda item's text/title for this occurrence. |
| `lm_sequence` | Sequence | Whole number | The item's order on the occurrence's agenda; the Up/Down reorder buttons patch this on the pair of rows being swapped. |
| `lm_source` | Source | Text (max 100) | Where the item came from -- e.g. 'Ad Hoc' for one added directly on the occurrence, or the Setup's standing agenda when carried forward. |
| `lm_covered` | Covered | Choice: Yes (1), No (2), Not Yet Recorded (3) | Whether the item was actually discussed, recorded during Minutes write-up (AG-04 scores fully covered / uncovered-but-carried-forward / uncovered differently), left at Not Yet Recorded is not neutral. |
| `lm_meetingoccurrence` | Meeting Occurrence | Lookup → lm_meetingoccurrences | Links this agenda item back to its occurrence. |
| `lm_ownerposition` | Owner Position | Lookup → cr603_organizationstructures | The Position responsible for this agenda item during the occurrence. |
| `lm_carriedfromagendaitem` | Carried From Agenda Item | Lookup → lm_meetingtemplateagendaitems | When this item originated on the Setup's Standing Agenda, points back at that template agenda item. |

### `lm_meetingoccurrenceattendeeses`

**Logical name:** `lm_meetingoccurrenceattendees`

One occurrence's actual Attendee roster (distinct from the Template's Attendees list) -- who was expected (Required/Optional) and, after the meeting, whether they showed up (Present/Absent).

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingoccurrenceattendeesid` | Meeting Occurrence Attendees | Unique ID (GUID) | Primary key for one occurrence attendee row; also what the attendance-marking patch targets. |
| `lm_name` | Name | Text (max 850) | The attendee's display name for this occurrence, set from the Position behind lm_attendeeposition. |
| `lm_present` | Present | Choice: Present (1), Absent (2), Not Yet Recorded (3) | Whether the attendee actually showed up, recorded after the meeting via updateMeetingOccurrenceAttendance(). |
| `lm_type` | Type | Choice: Required (1), Optional (2) | Whether the attendee was Required or Optional for this occurrence; decoded by code rather than label since Dataverse's option labels carry stray whitespace. |
| `lm_meetingoccurrence` | Meeting Occurrence | Lookup → lm_meetingoccurrences | Links this attendee row back to its occurrence. |
| `lm_attendeeposition` | Attendee Position | Lookup → cr603_organizationstructures | The Position attending this occurrence. |
| `lm_delegateposition` | Delegate Position | Lookup → cr603_organizationstructures (target inferred by naming convention; no @odata.bind for it appears in dataverse.js, which only reads this column) | The Position delegating for the attendee, when one attended in another's place; read by fetchMeetingOccurrences() but not written by any create/update in this file. |

### `lm_meetingoccurrencedepartmentfunctions`

**Logical name:** `lm_meetingoccurrencedepartmentfunction`

One row per Department/Function line copied onto an Occurrence when it was generated from a Setup (added 13 Sep) -- describes who is in the room without multiplying the meeting into more than one Occurrence per Department/Function.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingoccurrencedepartmentfunctionid` | Meeting Occurrence Department/Function | Unique ID (GUID) | Primary key for one Department/Function line on an occurrence. |
| `lm_name` | Name | Text (max 850) | The line's display name. |
| `lm_department` | Department | Lookup → cr603_chklst_departmentses (target inferred by consistency with the Department lookup elsewhere in this file; no @odata.bind for it appears in dataverse.js, which only reads this column) | The Department this line covers, copied from the Setup when the occurrence was generated. |
| `lm_departmentname` | Department Name | Text (max 850) | The Department's name, stored directly on the row (not just via the lookup) so it can be read without resolving the lookup. |
| `lm_function` | Function | Lookup → hr_functions (target inferred by consistency with the Function lookup elsewhere in this file; no @odata.bind for it appears in dataverse.js, which only reads this column) | The Function within that Department this line covers, when one applies. |
| `lm_functionname` | Function Name | Text (max 850) | The Function's name, stored directly on the row (not just via the lookup) so it can be read without resolving the lookup. |

### `lm_meetingoccurrences`

**Logical name:** `lm_meetingoccurrence`

The execution side: one row per actual sitting of a meeting -- either generated from a Meeting Template or created as a Custom Ad Hoc Meeting -- carrying its date/time/mode/location/status/sync state and the scope (Business Unit/Region/Department, Chairman/Facilitator positions) it actually ran under.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingoccurrenceid` | Meeting Occurrence | Unique ID (GUID) | Primary key; every child table (agenda, attendees, department/functions, minutes, audit grid, linked reports) binds back to this. |
| `lm_name` | Name | Text (max 850) | The occurrence's display name. |
| `lm_date` | Date | Date/time | The date the meeting is/was held, trimmed to a plain YYYY-MM-DD on read. |
| `lm_starttime` | Start Time | Text (max 100) | The meeting's scheduled start time, e.g. 'HH:mm'. |
| `lm_endtime` | End Time | Text (max 100) | The meeting's scheduled end time, e.g. 'HH:mm'. |
| `lm_timezone` | Time Zone | Text (max 100) | The time zone the scheduled times are expressed in. |
| `lm_mode` | Mode | Choice: Physical (1), Online (2), Hybrid (3) | In person/Online/Hybrid -- Dataverse's own labels differ slightly from the app's ('Physical' vs 'In person'), mapped explicitly. |
| `lm_meetingstatus` | Meeting Status | Choice: Scheduled (1), Held (2), Cancelled (3) | The occurrence's lifecycle status; every occurrence this app creates starts Scheduled, and every screen reading this field branches on an exact match, defaulting blank/unrecognized codes back to Scheduled. |
| `lm_meetinglocation` | Meeting Location | Text (max 100) | The physical location, for an In person/Hybrid meeting. |
| `lm_meetinglink` | Meeting Link | Text (max 100) | The online meeting link, for an Online/Hybrid meeting. |
| `lm_adhoctype` | Ad Hoc Type | Text (max 100) | Free-text label describing the kind of Custom Ad Hoc Meeting this is, when it has no Template. |
| `lm_restricted` | Restricted | Yes/No | Whether the occurrence is access-restricted, mirroring the Setup's confidentiality intent at the occurrence level. |
| `lm_agendasentdate` | Agenda Sent Date | Date/time | Stamped when the Agenda was distributed (AG-03/AG-15 lead-time measurement); a simple action tied to the occurrence, not to any one agenda item. |
| `lm_invitesentdate` | Invite Sent Date | Date/time | When the meeting invite was sent, feeding the same lead-time measurement as lm_agendasentdate. |
| `lm_cancelreason` | Cancel Reason | Text (max 100) | The reason recorded when the occurrence is cancelled; written together with the Cancelled status in one patch. |
| `lm_syncstatus` | Sync Status | Choice: Synchronized (1), Pending (2), Failed (3) | Tracks whether this occurrence row is synchronized; every occurrence this app creates is stamped Synchronized on create. |
| `lm_meetingstage` | Meeting Stage | Choice: Stage 1 BU Operational (1), Stage 2 Regional Functional (2), Stage 3 Group Functional (3), Stage 4 Top Management, COO & CEO (4) | Records the occurrence's governance Stage in the same global option set the Setup's Stages use, so an occurrence matches its Template's terms. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | The Setup this occurrence was generated from; omitted for a Custom Ad Hoc Meeting. |
| `lm_businessunit` | Business Unit | Lookup → businessunits | The Business Unit scope this occurrence ran under (Stage 1 only). |
| `lm_chairmanposition` | Chairman Position | Lookup → cr603_organizationstructures | The Position who chaired this specific occurrence. |
| `lm_region` | Region | Lookup → crd04_regionses | The Region scope this occurrence ran under (Stage 2 only). |
| `lm_department` | Department | Lookup → cr603_chklst_departmentses | The Department scope this occurrence ran under. |
| `lm_facilitatorposition` | Facilitator Position | Lookup → cr603_organizationstructures | The Position who facilitated this specific occurrence. |
| `lm_rescheduledfrom` | Rescheduled From | Lookup → lm_meetingoccurrences | When this occurrence is a reschedule, points back at the original occurrence it replaces. |

### `lm_meetingtemplateagendaitems`

**Logical name:** `lm_meetingtemplateagendaitem`

The template-level Standing Agenda for a Meeting Setup: an ordered list of recurring agenda items (each with a step number and an owning Position) that every Occurrence generated from this Setup starts with.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplateagendaitemid` | Meeting Template Agenda Item | Unique ID (GUID) | Primary key for one standing agenda line. |
| `lm_agendaitemname` | Agenda Item Name | Text (max 850) | The agenda item's text/title. |
| `lm_step` | Step | Whole number | The agenda item's order within the standing agenda. |
| `lm_agendaitemtype` | Agenda Item Type | Choice: Migrated - Initial (1), Added (2) | Whether the item was migrated in as the Setup's initial agenda or added afterward; drives the default written on create. |
| `lm_agendaitemowner` | Agenda Item Owner | Lookup → cr603_organizationstructures | The Position responsible for presenting/owning this agenda item. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | Links this agenda item back to its parent Setup. |

### `lm_meetingtemplatebusinessunitses`

**Logical name:** `lm_meetingtemplatebusinessunits`

One row per Business Unit configured on a Stage 1 (BU-level) Meeting Setup, each carrying its own Chairman/Co-Chairman/Facilitator/Team Channel so one Setup can still give every Business Unit its own leadership and its own Attendees list.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplatebusinessunitsid` | Meeting Template Business Units | Unique ID (GUID) | Primary key; Attendees rows bind back to a specific unit row via this id. |
| `lm_name` | Name | Text (max 850) | The unit row's display name, taken from the Setup's per-unit configuration. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | Links this unit row back to its parent Setup; template-level queries filter on this. |
| `lm_businessunit` | Business Unit | Lookup → businessunits | Which Business Unit this row represents; used as the reconcile key to tell an existing unit from a new one when a Setup is edited. |
| `lm_meetingchairman` | Meeting Chairman | Lookup → cr603_organizationstructures | The Chairman Position for this specific Business Unit's instance of the meeting. |
| `lm_meetingcochairman` | Meeting Co-Chairman | Lookup → cr603_organizationstructures | The Co-Chairman Position for this Business Unit's instance of the meeting. |
| `lm_meetingorganizerfacilitator` | Meeting Organizer/Facilitator | Lookup → cr603_organizationstructures | The Facilitator Position for this Business Unit's instance of the meeting. |
| `lm_teamchannel` | Team Channel | Lookup → and_teamschannels | The Microsoft Teams channel associated with this Business Unit's meeting. |

### `lm_meetingtemplatedepartmentfunctions`

**Logical name:** `lm_meetingtemplatedepartmentfunction`

One row per Department/Function line configured on a Meeting Setup -- which Department (optionally narrowed to a Function within it) the meeting concerns.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplatedepartmentfunctionid` | Meeting Template Department/Function | Unique ID (GUID) | Primary key for one Department/Function line. |
| `lm_newcolumn` | New column | Text (max 850) | This table's primary-name field; not explicitly written by dataverse.js, so it is left to Dataverse's own default. |
| `lm_department` | Department | Lookup → cr603_chklst_departmentses | The Department this line covers. |
| `lm_function` | Function | Lookup → hr_functions | The Function within that Department this line covers, when one is chosen. |
| `lm_meetingtemplate` | Meeting template | Lookup → lm_meetingtemplates | Links this Department/Function line back to its parent Setup. |

### `lm_meetingtemplatelinkedreportses`

**Logical name:** `lm_meetingtemplatelinkedreports`

One row per Report linked to a Meeting Setup as an Input to or Output of the meeting -- pointing at a real lm_report_templates row when the Report is a known Template, otherwise keeping only the free-text name.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplatelinkedreportsid` | Meeting Template Linked Reports | Unique ID (GUID) | Primary key for one linked-report row. |
| `lm_name` | Name | Text (max 850) | The linked Report's display name, kept even when a real Template link exists, for readability on the row. |
| `lm_reporttype` | Report Type | Choice: Output (1), Input (2) | Whether this Report feeds into the meeting (Input) or is produced by it (Output). |
| `lm_reporttemplate` | Report Template | Lookup → lm_report_templates | The real Report Template this link points to, when the linked Report is a known Template rather than free text. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | Links this Linked Report row back to its parent Setup. |

### `lm_meetingtemplateregions`

**Logical name:** `lm_meetingtemplateregion`

The Stage 2 (Regional) counterpart to lm_meetingtemplatebusinessunitses: one row per Region configured on a Setup, each with its own Chairman/Co-Chairman/Facilitator/Team Channel and its own Attendees list.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplateregionid` | Meeting Template Region | Unique ID (GUID) | Primary key; Attendees rows bind back to a specific region row via this id. |
| `lm_name` | Name | Text (max 850) | The region row's display name, taken from the Setup's per-unit configuration. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | Links this region row back to its parent Setup; template-level queries filter on this. |
| `lm_region` | Region | Lookup → crd04_regionses | Which Region this row represents; used as the reconcile key to tell an existing region from a new one when a Setup is edited. |
| `lm_meetingchairman` | Meeting Chairman | Lookup → cr603_organizationstructures | The Chairman Position for this specific Region's instance of the meeting. |
| `lm_meetingcochairman` | Meeting Co-Chairman | Lookup → cr603_organizationstructures | The Co-Chairman Position for this Region's instance of the meeting. |
| `lm_meetingorganizerfacilitator` | Meeting Organizer/Facilitator | Lookup → cr603_organizationstructures | The Facilitator Position for this Region's instance of the meeting. |
| `lm_teamchannel` | Team Channel | Lookup → and_teamschannels | The Microsoft Teams channel associated with this Region's meeting. |

### `lm_meetingtemplates`

**Logical name:** `lm_meetingtemplate`

A Committee/Meeting Setup: the reusable, published definition of a recurring (or ad hoc) meeting -- its cadence, mode, confidentiality, quorum and governance-clock settings. The app creates/updates/reads this as the parent row of a Setup, with every child table below (per-unit rows, agenda, attendees, supportive functions, linked reports) hanging off it.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplateid` | Meeting Template | Unique ID (GUID) | Primary key, referenced by every child table's lm_MeetingTemplate lookup. |
| `lm_meetingtemplatename` | Meeting template Name | Text (max 850) | The Setup's display name, shown in the Setup Register list and detail view. |
| `lm_setuptype` | Setup Type | Choice: Business Meeting (1), Accreditation Committee (2) | Distinguishes an ordinary Business Meeting Setup from an Accreditation Committee Setup. |
| `lm_typeclassification` | Type / Classification | Choice: Planning Meeting (124330000), Performance Monitoring Meeting (124330001), Clinical Meeting (124330002), Operational Meeting (124330003), Technology Meeting (124330004), Cross-Functional Meeting (124330005), Cross-Functional Team of Teams (124330006) | The meeting's category/classification, shown on the register and used for filtering Setups. |
| `lm_category` | Category | Lookup → lm_meetingcategories | Not in the cached schema file, inferred from usage: links the Setup to a real Meeting Category row from the Taxonomy application (lm_meetingcategories), never bound with an empty id since that would be a 400. |
| `lm_category_name` | Category Name | Text (max 850, inferred) | Not in the cached schema file, inferred from usage: the category's name stamped beside the lookup rather than derived from it on read, so a Setup keeps saying what its Category was even after a later rename in the Taxonomy application, and even for Setups saved before the Category list existed. |
| `lm_stages` | Stages | Choice: Stage 1 BU Operational (1), Stage 2 Regional Functional (2), Stage 3 Group Functional (3), Stage 4 Top Management, COO & CEO (4) | The governance level (stageLevel) the Setup runs at -- decides whether it creates per-Business-Unit, per-Region, or group-wide child rows. |
| `lm_frequency` | Frequency | Choice: Daily (1), Twice Weekly (2), Weekly (3), Twice Monthly (4), Monthly (5), Quarterly (6), Semesterly (7), Annually (8), Custom (9) | How often the meeting recurs, driving which of the day-of-week/month/quarter/semester fields below apply. |
| `lm_daysoftheweek` | Days of the week | Choice: Sunday (124330000), Monday (124330001), Tuesday (124330002), Wednesday (124330003), Thursday (124330004) | The scheduled day of the week for a Weekly/Twice-Weekly cadence. |
| `lm_dayofthemonth` | Day of the Month | Whole number | The scheduled day of the month for a Monthly/Twice-Monthly cadence. |
| `lm_monthofthequarter` | Month of the quarter | Choice: 1st Month (124330000), 2nd Month (124330001), 3rd Month (124330002) | Which month of the quarter the meeting falls in, for a Quarterly cadence. |
| `lm_seconddayoftheweek` | Second Day of the Week | Choice: Sunday (1), Monday (2), Tuesday (3), Wednesday (4), Thursday (5) | The second scheduled weekday, for a Twice Weekly cadence. |
| `lm_seconddayofthemonth` | Second Day of the Month | Whole number | The second scheduled day of the month, for a Twice Monthly cadence. |
| `lm_monthofthesemesterseme` | Month of the Semester | Choice: 1st Month (1), 2nd Month (2), 3rd Month (3), 4th Month (4), 5th Month (5), 6th Month (6) | Which month of the semester the meeting falls in, for a Semesterly cadence. |
| `lm_defaultmeetingmode` | Default Meeting Mode | Choice: Physical (1), Online (2), Hybrid (3) | The default mode (In person/Online/Hybrid) each Occurrence generated from this Setup starts with. |
| `lm_meetingconfidentiality` | Meeting Confidentiality | Choice: Public (124330000), Internal (124330001), Confidential (124330002), High Confidential (124330003), Restricted (124330004) | The confidentiality level governing who may see this Setup and its meetings. |
| `lm_quorumthreshold` | Quorum Threshold % | Decimal number | The percentage of Core attendees required for quorum, used against the Attendees list's Core/Supportive split. |
| `lm_momwriteuphours` | MOM Write-up Hours | Decimal number (not in cached schema, inferred from usage) | Elapsed hours allowed from Meeting ends to MOM (Minutes of Meeting) submitted -- feeds the governance/audit clocks. |
| `lm_momapprovalhours` | MOM Approval Hours | Decimal number (not in cached schema, inferred from usage) | Elapsed hours allowed from MOM submitted to the Chair's approval -- feeds the governance/audit clocks. |
| `lm_gridsubmithours` | Grid Submit Hours | Decimal number (not in cached schema, inferred from usage) | Elapsed hours allowed from Audit Grid created to submitted to the Chair -- feeds the governance/audit clocks. |
| `lm_torpolicylink` | TOR / Policy Link | Text (max 100) | A link to the Setup's Terms of Reference / governing policy document. |
| `lm_meetingstatus` | Meeting Status | Choice: Under Review (1), Expired (2), Draft (3), Active / Approved (4) | The Setup's own lifecycle status (Draft/Under Review/Active/Expired), patched directly by the Approve action and by publish/re-publish. |
| `lm_version` | Version | Decimal number | The Setup's version number, bumped on each re-publish; a validation failure on update must not silently leave this stale. |
| `lm_meetingchairman` | Meeting Chairman | Lookup → cr603_organizationstructures | The Chairman Position for a Stage 3/4 (group-wide) Setup, which has no per-unit child table of its own, so this role lives on the parent row instead of on a Business-Unit/Region row. |
| `lm_meetingcochairman` | Meeting Co-Chairman | Lookup → cr603_organizationstructures | The Co-Chairman Position for a Stage 3/4 (group-wide) Setup, same reasoning as lm_meetingchairman. |
| `lm_meetingorganizerfacilitator` | Meeting Organizer/Facilitator | Lookup → cr603_organizationstructures | The Facilitator Position for a Stage 3/4 (group-wide) Setup, same reasoning as lm_meetingchairman. |

### `lm_meetingtemplatesupportivefunctionses`

**Logical name:** `lm_meetingtemplatesupportivefunctions`

Template-level Supportive Functions declared on a Setup -- functions that attend in a supportive rather than Core capacity. Flat and ordered, so it is deleted and recreated whole whenever a Setup is edited.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingtemplatesupportivefunctionsid` | Meeting Template Supportive Functions | Unique ID (GUID) | Primary key for one Supportive Function line. |
| `lm_newcolumn` | New column | Text (max 850) | The Supportive Function's free-text name (this table's primary-name field, despite its generic Dataverse column name). |
| `lm_function` | Function | Lookup → hr_functions | The real HR Function record for this Supportive Function, when one is known. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | Links this Supportive Function row back to its parent Setup. |

## Reference & Organisation Data

### `and_teamschannels`

**Logical name:** `and_teamschannel`

One row per Microsoft Teams CHANNEL (there is no separate Teams table -- a "Team" exists only as its name repeated across channel rows); used to build the Team/Channel picker and to auto-fill a Report Template's document source link.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `and_teamschannelid` | Teams Channel | Unique ID (GUID) | Primary key; bound via lm_TeamChannel@odata.bind wherever a Setup/template needs a channel. |
| `and_channelname` | Channel Name | Text (max 850) | The channel's display name (primary name column). |
| `and_channellink` | Channel Link | Text (max 4000) | Direct link to the Teams channel, returned as `link`. |
| `lm_team` | Team | Text (max 100) | Plain-text Team name (not a lookup, since there is no Teams table); the app derives its distinct Team list from the values in this column. |
| `lm_sharepointsitepath` | SharePoint Site Path | Text (max 300) | Part of the channel's document location, joined by the caller into a Report Template's Source link. |
| `lm_documentlibrary` | Document Library | Text (max 100) | Part of the channel's document location, joined into the Source link. |
| `lm_folder` | Folder | Text (max 100) | Part of the channel's document location, joined into the Source link. |

### `businessunits`

**Logical name:** `businessunit`

A Business Unit (a hospital/entity in the Andalusia Group org hierarchy); the app reads it to populate Business Unit pickers and scoping for Setups, Report/Meeting Templates and KPI Achievements, and to relate each unit to its Region.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `businessunitid` | Business Unit | Unique ID (GUID) | Primary key identifying the business unit row; referenced everywhere via lm_BusinessUnit@odata.bind. |
| `name` | Name | Text (max 160) | The business unit's display name, shown in every Business Unit picker/list in the app. |
| `cr603_region` | Region | Lookup → crd04_regionses (Regions) | Links the business unit to its Region so it can be filtered/matched by region. |

### `cr301_specialtyksa_service_hubs`

**Logical name:** `cr301_specialtyksa_service_hub`

Master list of Sections/Specialties ("KSA Service Hubs"), each linked directly to a Business Unit; used to drive the app's Section/Specialty cascade (Business Unit → Specialty) and bound onto Setups/templates as the Speciality/Report Specialty.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `cr301_specialtyksa_service_hubid` | Specialty KSA_Service_Hub | Unique ID (GUID) | Primary key; bound via lm_ReportSpecialty@odata.bind / lm_Speciality@odata.bind / lm_ReportSpeciality@odata.bind. |
| `cr301_title` | Title | Text (max 850) | The specialty's display name (primary name column), returned as `name` by fetchSections(). |
| `cr301_businessunit` | Business Unit | Lookup → businessunits | Links the specialty directly to its Business Unit, reflecting the app's BU → Specialty cascade (Departments are not involved). |

### `cr603_chklst_departmentses`

**Logical name:** `cr603_chklst_departments`

Master list of organizational Departments; the app reads it for Department pickers/filters. It has no real Business Unit relationship of its own -- that relationship is derived separately from Organization Structure rows via departmentBuIndex().

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `cr603_chklst_departmentsid` | Departments | Unique ID (GUID) | Primary key for the department row; bound via lm_Department@odata.bind on template scope lines. |
| `cr603_department` | Department | Text (max 850) | The department's display name (the table's primary name column). |
| `owningbusinessunit` | Owning Business Unit | Lookup → businessunits | Dataverse's security-owner field, exposed honestly as `owningBu` but explicitly NOT used to relate a Department to a Business Unit -- it is almost always the root org, not a real org relationship. |

### `cr603_organizationstructures`

**Logical name:** `cr603_organizationstructure`

"Organization Structure": each row is one concrete Position assignment (Position + Business Unit + Department + Function + the employee currently holding it), used throughout the app as the Positions reference list and bound into meetings, reports, tasks and attendee lists.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `cr603_organizationstructureid` | Organization Structure | Unique ID (GUID) | Primary key for the position row; used pervasively as the position id in @odata.bind lookups (attendees, chairmen, owners, reviewers, actors, etc.). |
| `cr603_name` | Name | Text (max 850) | The position's display name (primary name column); used as-is because the synthetic cr603_positionname field cannot be selected directly. |
| `cr603_businessunit` | Business Unit | Lookup → businessunits | The Business Unit this position belongs to, used for the Governed List filter and cascade matching. |
| `cr18c_departments_lkp` | Department | Lookup → cr603_chklst_departmentses | The Department this position belongs to, used for cascade matching and to derive the Department↔BusinessUnit index. |
| `hr_funtion` | Function | Lookup → hr_functions | The Function this position belongs to, used for cascade matching. |
| `hr_currentemployee` | Current Employee | Lookup → hr_employees (falls back to systemusers) | The employee currently holding this position; resolved first via hr_employees, then via systemusers, then via the reverse Employee→Position link, purely for display. |

### `crd04_regionses`

**Logical name:** `crd04_regions`

A geographic Region; used as the reference list behind fetchRegions() and to scope Business Units, Setups, and Report/Meeting Templates by region.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `crd04_regionsid` | Regions | Unique ID (GUID) | Primary key for the region row; matches a Business Unit's cr603_region value. |
| `crd04_id` | Region | Text (max 850) | The region's display name (the table's primary name column), returned as `name` by fetchRegions(). |

### `hr_employees`

**Logical name:** `hr_employee`

Employee master data; the app reads it once to resolve which real person currently holds each Organization Structure position, purely for display under Position pickers.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `hr_employeeid` | Employee | Unique ID (GUID) | Primary key for the employee row; used as the key of the byEmployeeId lookup map built from hr_CurrentEmployee. |
| `hr_id` | HR-Code | Text (max 850) | The table's actual primary name column (an HR employee code); included as the primary name field though not selected by the app. |
| `cr603_organizationstructure` | Organization Structure | Lookup → cr603_organizationstructures | The Position this employee holds; used as the reverse-lookup path (byPositionId) when a Position's own Current Employee lookup is blank. |
| `hr_firstname` | First Name | Text (max 100) | First part of the employee's display name, joined with second/last name to compose the holder's full name. |
| `hr_secondname` | Second Name | Text (max 100) | Middle part of the employee's display name, joined into the composed full name. |
| `hr_lastname` | Last Name | Text (max 100) | Last part of the employee's display name, joined into the composed full name. |

### `hr_functions`

**Logical name:** `hr_function`

Master list of job Functions, each tied to a Department; used for Function pickers/filters and stored on Report/Meeting template scope lines and on Organization Structure positions.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `hr_functionid` | Function | Unique ID (GUID) | Primary key for the function row; bound via lm_Function@odata.bind on template/supervision lines. |
| `hr_name` | Name | Text (max 850) | The table's actual primary name column; included for completeness though the app displays hr_functionname instead. |
| `hr_functionname` | Function Name | Text (max 100) | The function's human-readable name, returned as `name` by fetchFunctions() and used for display. |
| `hr_department` | Department  | Lookup → cr603_chklst_departmentses (Departments) | Real lookup linking a Function to its Department, matching the mock data's `dept` field for cascading filters. |

### `pm_kpiachievments`

**Logical name:** `pm_kpiachievment`

A pre-existing, shared table (not owned by this app) recording one Actual/Target/Baseline/Historical measurement for a given KPI, Business Unit, Department, Function, month and year; the Reports/Business Intelligence screens read it to show a KPI's performance for the scope a report covers.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `pm_kpiachievmentid` | KPI Achievement | Unique ID (GUID) | Primary key for the achievement row. |
| `pm_name` | KPI Achievement ID | Text (max 100) | The table's actual primary name column (an auto-generated id-like code); included as the primary name field though not selected by the app. |
| `_pm_kpi_value` | KPI | Lookup → strategy_kpises | The KPI this measurement is for; confirmed from live metadata to target the same strategy_kpises table the app's KPI list comes from, matched via an OR-chain filter when a specific KPI set is requested. |
| `_pm_businessunit_value` | Business Unit | Lookup → businessunits | The Business Unit this measurement applies to (blank means it applies to any unit); its formatted name is also read for display. |
| `stf_department` | Department | Text (max 4000) | Plain-text Department name, not a lookup; matched client-side, case-insensitively, against a report's Department scope since exact live casing isn't guaranteed. |
| `stf_function` | Function | Text (max 4000) | Plain-text Function name, not a lookup; matched client-side, case-insensitively, against a report's Function scope. |
| `pm_month` | Month Value | Whole number (1–12, calendar order, confirmed from live metadata) | The month the measurement is for; filtered server-side (pm_month eq N) only when a specific month is requested. |
| `pm_year` | Year | Whole number | The year the measurement is for; always filtered server-side (pm_year eq N). |
| `pm_actual` | Actual | Decimal number | The actual measured value achieved for the KPI in that scope/period. |
| `pm_target` | Target | Decimal number | The target value set for the KPI in that scope/period. |
| `pm_baseline` | baseline | Decimal number | The baseline value recorded for the KPI in that scope/period. |
| `pm_historical` | historical | Decimal number | A historical value recorded for the KPI in that scope/period. |

### `strategy_kpises`

**Logical name:** `strategy_kpis`

Master list of KPIs, each carrying its own Department and Process; the app reads it for KPI pickers/filters on the Business Intelligence screen and links a chosen KPI onto a Report Template.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `strategy_kpisid` | KPIS | Unique ID (GUID) | Primary key; bound via lm_RelatedKPI@odata.bind / lm_KPI@odata.bind when saving a Report Template, and used to filter KPI Achievements by KPI. |
| `strategy_newcolumn` | KPI | Text (max 850) | The KPI's actual display name (primary name column) despite its generic column name -- flagged in code as likely renamed after creation; only rows with this set are returned. |
| `strategy_department` | Department | Lookup → cr603_chklst_departmentses | The Department this KPI belongs to; its id and denormalised formatted name both feed the Governed List's BU/Department filter. |
| `strategy_process` | Process | Lookup → strategy_processes | The Process this KPI is associated with; its id and denormalised formatted name feed the Business Intelligence screen's Process filter. |

### `strategy_processes`

**Logical name:** `strategy_process`

Master list of Processes, each tied to a Department; the app reads it for Process pickers/filters and links a chosen Process onto a Report Template.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `strategy_processid` | Process | Unique ID (GUID) | Primary key; bound via lm_RelatedProcess@odata.bind / lm_Process@odata.bind when saving a Report Template. |
| `strategy_newcolumn` | Process Name | Text (max 850) | The process's actual display name (primary name column); same "renamed generic column" caveat as strategy_kpises. Only rows with this set are returned. |
| `strategy_department` | Department | Lookup → cr603_chklst_departmentses | The Department this Process belongs to; its id and denormalised formatted name feed the Governed List's BU/Department filter. |

### `systemusers`

**Logical name:** `systemuser`

Dataverse's built-in Users table; the app uses it to identify the signed-in user (matched from their Entra identity), as a fallback for resolving Position holders, and to list users assignable to tasks, shared reports and actor/audit entries.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `systemuserid` | User | Unique ID (GUID) | Primary key; bound via hx_Assignee@odata.bind, lm_SharedUser@odata.bind and lm_ActorUser@odata.bind wherever a real user reference is needed. |
| `fullname` | Full Name | Text (max 200) | Display name of the user; used both to resolve a Position's current holder and to show assignable/shared users. |
| `internalemailaddress` | Primary Email | Text (max 100) | The user's email; matched against the signed-in host identity's UPN, and shown next to assignable users. |
| `domainname` | User Name | Text (max 1024) | Fallback match target (domain/UPN) for identifying the signed-in user's systemusers row when the Entra object id column isn't populated. |
| `azureactivedirectoryobjectid` | Azure AD Object ID | Unique ID (GUID) | The stable Entra (Azure AD) identity link, used as the primary match for finding the signed-in user's systemusers row. |
| `isdisabled` | Status | Yes/No (Enabled (0) / Disabled (1)) | Filtered on (isdisabled eq false) so fetchAssignableUsers() only offers enabled users -- systemuser doesn't use statecode the way custom tables do. |

## Report Occurrences, Audit Grid, Minutes & Decisions

### `lm_auditgridanswers`

**Logical name:** `lm_auditgridanswer`

One row per manually-scored Audit Grid question's answer and evidence note on one Instance; auto-scored questions are never stored here because they are always re-derived live from the occurrence, its agenda, attendance and Minutes, so only the Facilitator's manual input needs a permanent home.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_auditgridanswerid` | Audit Grid Answer | Unique ID (GUID) | Primary key of the Answer row. |
| `lm_name` | Name | Text (max 850) | Display name of the Answer, set to the question's id on create. |
| `lm_questionid` | Question Id | Text (max 100) | The id of the Audit Grid question this Answer scores; used as the key when grouping Answers into the manual/evidence maps a Grid reads. |
| `lm_score` | Score | Whole number | The Facilitator's manually entered score for the question. |
| `lm_evidence` | Evidence | Text (max 100) | A short evidence note supporting the score; still at Dataverse's default 100-character width, too narrow for a real evidence note and flagged in code as needing widening. |
| `lm_auditgridinstance` | Audit Grid Instance | Lookup → lm_auditgridinstances | The Audit Grid Instance this Answer belongs to. |

### `lm_auditgridinstances`

**Logical name:** `lm_auditgridinstance`

One row per version of a Committee Meeting's Audit Grid — created when its Minutes are closed, and again with a higher version when a Chair opens a correction; score/coverage/total are written only once, on Chair approval, and then locked and frozen so a later Template or settings change can never rewrite a published accreditation result.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_auditgridinstanceid` | Audit Grid Instance | Unique ID (GUID) | Primary key of the Instance. |
| `lm_name` | Name | Text (max 850) | Display name of the Instance, defaulting to 'Audit Grid Instance' on create. |
| `lm_state` | State | Choice: Pending Facilitator Review (1), Submitted for Approval (2), Approved (3), Returned for Revision (4), Void (5) | The Instance's approval-workflow state. |
| `lm_score` | Score | Decimal number | The overall published percentage score; null until the Chair approves the Instance, at which point it is fixed. |
| `lm_coverage` | Coverage | Whole number | Count (not a percentage) of applicable questions the score was computed over; also written only at approval. |
| `lm_total` | Total | Whole number | The active question count the Audit Grid Template carried at the time; captured on create and optionally refreshed on approval. |
| `lm_version` | Version | Whole number | The Instance's version number; a correction opens a new, higher version rather than editing the approved Instance. |
| `lm_locked` | Locked | Yes/No | Set true on approval, together with lm_frozen, to stop the published result from being recomputed later. |
| `lm_frozen` | Frozen | Yes/No | Set true on approval alongside lm_locked; freezes the published score against any later governance-setting or Template change. |
| `lm_approvedat` | Approved At | Date/time | Stamped at the moment the Chair approves and publishes the Instance's score. |
| `lm_templateversion` | Template Version | Text (max 100) | A label (e.g. 'AGT v1.2') recording which Audit Grid Template version produced this Instance. |
| `lm_returnreason` | Return Reason | Text (max 100) | Reason recorded when the Instance is moved to Returned for Revision. |
| `lm_correctionreason` | Correction Reason | Text (max 100) | Reason recorded only on a correction version, set when a Chair reopens an approved Instance. |
| `lm_meetingoccurrence` | Meeting Occurrence | Lookup → lm_meetingoccurrences | The Committee Meeting Occurrence this Audit Grid Instance scores. |
| `lm_facilitatorposition` | Facilitator Position | Lookup → cr603_organizationstructures | The organizational position of the Facilitator responsible for the manual scoring. |
| `lm_chairposition` | Chair Position | Lookup → cr603_organizationstructures | The organizational position of the Chair who approves the Instance. |

### `lm_meetingminuteses`

**Logical name:** `lm_meetingminutes`

One Meeting Minutes row per Meeting Occurrence, carrying the Recorder/Chair write-up, approval and closure lifecycle plus the Chair's signature; the Audit Grid's Facilitator and Chair clocks (AG-16, AG-05) are measured against its submitted/approved timestamps.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingminutesid` | Meeting Minutes | Unique ID (GUID) | Primary key of the Minutes row. |
| `lm_name` | Name | Text (max 850) | Display name of the Minutes, defaulting to 'Meeting Minutes' on create. |
| `lm_status` | Status | Choice: Draft (1), Approved (2), Closed (3) | The Minutes' lifecycle stage; submission does not change it (still Draft), only Chair approval and closure do. |
| `lm_submittedat` | Submitted At | Date/time | Stamped when the Facilitator/Recorder submits a Draft for review; starts the AG-16 write-up window and is left standing across a return so the original submission time is not overwritten. |
| `lm_approvedat` | Approved At | Date/time | Stamped when the Chair approves the Minutes; closes the AG-05 approval window. |
| `lm_closedat` | Closed At | Date/time | Stamped when the Minutes are closed, which is also what triggers creation of the Meeting's Audit Grid Instance. |
| `lm_returnreason` | Return Reason | Text (max 2000) | The Chair's reason for sending the Minutes back to Draft; cleared again when resubmitted. |
| `lm_signedname` | Signed Name | Text (max 100) | The name recorded as having signed the Minutes. |
| `lm_signeddate` | Signed Date | Date/time | The date the Minutes were signed, defaulting to today when not supplied. |
| `lm_signedtime` | Signed Time | Text (max 100) | The time of day the Minutes were signed. |
| `_lm_meetingoccurrence_value` | Meeting Occurrence | Lookup → lm_meetingoccurrences | The Meeting Occurrence these Minutes belong to; each occurrence owns exactly one Minutes row. |
| `_lm_signedbyposition_value` | Signed By Position | Lookup → cr603_organizationstructures | The organizational position of the person who signed the Minutes. |

### `lm_meetingoccurrencelinkedreportses`

**Logical name:** `lm_meetingoccurrencelinkedreports`

One row per document linked to a Meeting Occurrence from the Meeting Detail Documents tab, pointing at a Report Occurrence, a Report Template, or both — a Template-only link covers 'no occurrence exists for this yet' until one is picked or attached later.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_meetingoccurrencelinkedreportsid` | Meeting Occurrence Linked Reports | Unique ID (GUID) | Primary key of the link row. |
| `lm_reportname` | Report Name | Text (max 850) | Display name of the linked document; renamed to the Report Occurrence's own name once a link made against a Template alone is filled in with an occurrence. |
| `_lm_meetingoccurrence_value` | Meeting Occurrence | Lookup → lm_meetingoccurrences | The Meeting Occurrence the document is linked to; every link is read and filtered by this. |
| `_lm_reportoccurrence_value` | Report Occurrence | Lookup → lm_reportoccurrences | The specific submitted Report Occurrence the document points at, when one has been matched or created. |
| `_lm_reporttemplate_value` | Report Template | Lookup → lm_report_templates | The Report Template the document is linked to when no matching occurrence exists yet. |

### `lm_momnoteses`

**Logical name:** `lm_momnotes`

One discussion note per Agenda Item, written up as part of a Meeting's Minutes; feeds the notesByAgenda map that the Audit Grid's AG-06 question reads, and is archived rather than deleted when a Recorder clears an item's note.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_momnotesid` | MOM Notes | Unique ID (GUID) | Primary key of the note row. |
| `lm_name` | Name | Text (max 850) | Display name of the note, set to the literal 'MOM Note' on create. |
| `lm_notes` | Notes | Text (max 4000) | The discussion text recorded for the Agenda Item, widened from Dataverse's default so it can hold real prose. |
| `_lm_meetingminutes_value` | Meeting Minutes | Lookup → lm_meetingminuteses | The Minutes row this note belongs to; notes are fetched and grouped by this per Minutes. |
| `_lm_agendaitem_value` | Agenda Item | Lookup → lm_meetingoccurrenceagendas | The Agenda Item the note discusses; keys the notesByAgenda map the Minutes tab and Audit Grid read. |

### `lm_reportoccurrencehistories`

**Logical name:** `lm_reportoccurrencehistory`

Append-only audit trail for one Report Occurrence's review lifecycle — every submit, approve, Request-More-Information, and final-approval transition appends a row here rather than overwriting anything, so the full review history survives a resubmission; this is the module's only real audit-trail table (Meetings and Minutes still have nowhere to write one).

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reportoccurrencehistoryid` | Report Occurrence History | Unique ID (GUID) | Primary key of the history row. |
| `lm_action` | Action | Text (max 850) | Description of the transition that occurred, e.g. 'Submitted for review' or 'Request More Information — returned to Draft'; also this table's primary-name column. |
| `lm_note` | Note | Text (max 100) | An optional reviewer note or reason attached to the transition; still at Dataverse's default 100-character width, which the app caps to. |
| `lm_reportoccurrence` | Report Occurrence | Lookup → lm_reportoccurrences | The Report Occurrence this history entry belongs to; the trail is fetched filtered by this and read oldest-first. |
| `lm_actorposition` | Actor position | Lookup → cr603_organizationstructures | The organizational position of the person who performed the transition. |

### `lm_reportoccurrences`

**Logical name:** `lm_reportoccurrence`

One row per actual submission of a Report Template — the execution side of Leadership Practice reporting; carries the per-unit context (Business Unit/Region/Department/Function), the review lifecycle (Draft → In Review → Approved), and version, and drives the Reports/Plans, Build, and Report Submission review screens.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reportoccurrenceid` | Report Occurrence | Unique ID (GUID) | Primary key of the Report Occurrence. |
| `lm_name` | Name | Text (max 850) | The report's title, defaulting to 'Untitled Report' on create and '(untitled report)' when blank on read. |
| `lm_period` | Period | Date/time | The period (e.g. month) the report covers. |
| `lm_status` | Status | Choice: Draft (1), In Review (2), Approved (3), Rejected (4), Returned (5) | The submission's review-lifecycle state; the app only ever writes Draft, In Review and Approved — Rejected/Returned exist on the option set but are deliberately never set by this module. |
| `lm_version` | Version | Whole number | The occurrence's version number, defaulting to 1 on create. |
| `lm_reviewstep` | Review Step | Whole number | Zero-based index of where the submission sits in its configured review chain; reset to 0 on submission and on Request More Information. |
| `lm_fileurl` | File URL | Text (max 500) | Location of the report's working file/attachment, set once the occurrence exists from the Report Detail page's Attachments card. |
| `lm_reportobjective` | Report Objective | Text (max 100) | The report's stated objective, captured at creation. |
| `lm_locked` | Locked | Yes/No | True once the submission is fully Approved; stops any further edit so a later change must become a new version. |
| `lm_nosetupflag` | No Setup Flag | Yes/No | True for an Ad Hoc Report created with no approved Setup/Template behind it. |
| `lm_reportstage` | Report Stage | Choice: Stage 1 BU Operational (1), Stage 2 Regional Functional (2), Stage 3 Group Functional (3), Stage 4 Top Management, COO & CEO (4) | The organizational stage the report belongs to, using the same global option set as a Meeting Occurrence's stage. |
| `lm_reporttemplate` | Report Template | Lookup → lm_report_templates | The Report Template this occurrence is an instance of; omitted for an Ad Hoc Report. |
| `lm_businessunit` | Business Unit | Lookup → businessunits | The Business Unit the report was created for. |
| `lm_region` | Region | Lookup → crd04_regionses | The Region the report was created for. |
| `lm_department` | Department | Lookup → cr603_chklst_departmentses | The Department the report was created for. |
| `lm_function` | Function | Lookup → another table | The Function the report was created for; read by this app but not currently set through any create/update call. |
| `lm_creatorposition` | Creator Position | Lookup → cr603_organizationstructures | The organizational position of the person who created the occurrence. |

### `lm_reportoccurrencesectionses`

**Logical name:** `lm_reportoccurrencesections`

One row per Section of a Report Occurrence's content, shown and edited on the Reports/Plans and Build screens; a Section is either migrated from the Report Template or added on this occurrence only, and owns the Citations found through lm_reportsectioncitations.lm_citedsection.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reportoccurrencesectionsid` | Report Occurrence Sections | Unique ID (GUID) | Primary key of the Section. |
| `lm_heading` | Heading | Text (max 850) | The Section's heading text. |
| `lm_body` | Body | Text (max 4000) | The Section's written content. |
| `lm_diagnosticangle` | Diagnostic Angle | Choice: Untyped (default) (1), Descriptive (2), Diagnostic (3), Predictive (4), Prescriptive (5) | Classifies the analytical angle of the Section's content. |
| `lm_sequence` | Sequence | Whole number | The Section's display order within the report; rewritten on every save to match the edited order. |
| `lm_source` | Source | Choice: Migrated (from Template) (1), Added (this occurrence only) (2) | Whether the Section came from the Report Template or was added directly on this occurrence; a Section created in the Build screen is always Added. |
| `lm_reportoccurrence` | Report Occurrence | Lookup → lm_reportoccurrences | The Report Occurrence this Section belongs to. |

### `lm_reportoccurrenceshares`

**Logical name:** `lm_reportoccurrenceshare`

One row per time a Report Occurrence was sent to someone — who sent it (the row's standard createdby) and who received it (lm_shareduser) — read as a single table to serve both the Inbox and Sent views of the sharing feature.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reportoccurrenceshareid` | Report Occurrence Share | Unique ID (GUID) | Primary key of the share record. |
| `lm_name` | Name | Text (max 850) | An optional label for the share, supplied by the sender. |
| `lm_sharedon` | Shared On | Date/time | Stamped explicitly at share time rather than left to the generic createdon, because the two are meant to diverge if a share is ever edited. |
| `lm_reportoccurrence` | Report Occurrence | Lookup → lm_reportoccurrences | The Report Occurrence being shared. |
| `lm_shareduser` | Shared User | Lookup → systemusers | The recipient the report was shared with. |

### `lm_reportsectioncitationses`

**Logical name:** `lm_reportsectioncitations`

One row per citation inside a Report Section — a KPI, Process, POC, Strategy, BI Report, Task, child report, breakdown or free paragraph cited as evidence; the table carries no direct lookup to its Report Occurrence or an explicit parent-section field beyond lm_citedsection, so citations are grouped under their Section by that column.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reportsectioncitationsid` | Report Section Citations | Unique ID (GUID) | Primary key of the citation. |
| `lm_name` | Label Text | Text (max 850) | The citation's display label as entered by the report author. |
| `lm_kind` | Kind | Choice: KPI (1), Breakdown (2), Process (3), POC (4), Project (5), Strategy (6), BI Report (7), Paragraph (8), Issue (9), Task (10), Child Report (11) | The type of thing being cited; code 11 (Child Report) is the value the Report Occurrence flow writes when citing a child report, which pins the numbering used elsewhere. |
| `lm_breakdowndimension` | Breakdown Dimension | Choice: Account (1), Payment Type (2), Physician (3), Department (4), Platform (5), Employee (6), Speciality (7) | For a Breakdown-kind citation, which dimension the breakdown is sliced by. |
| `lm_citedsection` | Cited Section | Lookup → lm_reportoccurrencesectionses | The parent Section this citation belongs to; used as the de facto parent-section link since the table has no other section field. |
| `lm_kpi` | KPI | Lookup → strategy_kpises | The KPI cited, when Kind is KPI. |
| `lm_process` | Process | Lookup → strategy_processes | The Process cited, when Kind is Process. |
| `lm_citedreportoccurrence` | Cited Report Occurrence | Lookup → lm_reportoccurrences | The child Report Occurrence cited, when Kind is Child Report. |
| `lm_poc` | POC | Lookup → stf_strategypocs | Not in the cached schema file, inferred from usage: the Strategy POC cited, when Kind is POC; added 19-20 Sep with the target confirmed from live relationship metadata. |
| `lm_strategy` | Strategy | Lookup → strategy_strategies | Not in the cached schema file, inferred from usage: the Strategy cited, when Kind is Strategy; added 19-20 Sep. |
| `lm_bireport` | BI Report | Lookup → lm_bireportdashboards | Not in the cached schema file, inferred from usage: the BI Report/Dashboard cited, when Kind is BI Report; added 19-20 Sep. |
| `lm_task` | Task | Lookup → hx_taskses | Not in the cached schema file, inferred from usage: the Task cited, when Kind is Task; added 19-20 Sep. |

### `wlog_decisions`

**Logical name:** `wlog_decision`

Pre-existing corporate 'Work Log Decisions' table owned by another system (an employee time-logging/work-log module), not built for Leadership Practice. This app reads its decisions and performs a minimal create so they can be surfaced on the module's own Decisions tab alongside — not replacing — the existing seeded Decision workflow; the table has no lookup to a Meeting Occurrence, Report Occurrence, or either Template, only to an unrelated Work Log record, so that linkage is not yet possible here.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `wlog_decisionid` | Work Log Decision | Unique ID (GUID) | Primary key of the Decision row. |
| `wlog_name` | Decision ID | Text (max 100) | Display name/identifier of the Decision; left unset (undefined) on create when no name is supplied so Dataverse's own default applies. |
| `wlog_decisiontaken` | Decision Taken | Text (max 4000) | The substance of the decision that was made. |
| `wlog_expectedoutput` | Expected Output | Text (max 1000) | What outcome the decision is expected to produce. |
| `wlog_managernote` | Manager Note | Text (max 2000) | A manager's note attached to the decision. |
| `wlog_evidenceurl` | Based On / Evidence | Text (max 500) | A link to supporting evidence or basis for the decision. |
| `wlog_decisionstatus` | Decision Status Value | Choice: Completed (1), Pending (2), Waiting (3), Escalated (4) | The decision's current status; read from its formatted-value annotation rather than a hand-maintained numeric map since this table rides the legacy Common Data Service connector, and left unset by this app's own create so Dataverse's option-set default applies. |
| `wlog_reviewstatus` | Review Status Value | Choice: Draft (1), Pending Validation (2), Validated (3), Escalated (4), Rejected (5) | The decision's review status, read the same formatted-value way as Decision Status. |
| `wlog_reviewedon` | Reviewed On | Date/time | Date the decision was reviewed. |
| `wlog_escalatedon` | Escalated On | Date/time | Date the decision was escalated, if it was. |
| `wlog_escalationreason` | Escalation Reason | Text (max 2000) | Why the decision was escalated. |
| `wlog_escalationreply` | Escalation Reply | Text (max 2000) | The reply given to the escalation. |
| `wlog_escalationresolvedon` | Escalation Resolved On | Date/time | Date the escalation was resolved. |
| `wlog_escalationresult` | Escalation Result Value | Choice: Upheld (Validated) (1), Overturned (Rejected) (2), Returned to reviewer (3) | The outcome of the escalation, read via its formatted-value annotation like the other choice columns on this table. |

## Report Template Setup (Governance)

### `lm_approvalcycles`

**Logical name:** `lm_approvalcycle`

A named, ordered approval route (e.g. code "AC-1") owned by the Authority Matrix outside Leadership Practice. This module reads it strictly read-only to route a Decision to the correct approvers — it never authors, edits or substitutes a cycle.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_approvalcycleid` | Approval Cycle | Unique ID (GUID) | Primary key of the approval cycle. |
| `lm_name` | Name | Text (max 850) | Display name of the approval cycle. |
| `lm_code` | Code | Text (max 100) | Short code (e.g. "AC-1") the Authority Matrix and UI reference the cycle by, and the key used to build a code-to-cycle lookup map. |

### `lm_approvalcyclesteps`

**Logical name:** `lm_approvalcyclestep`

One ordered step within an Approval Cycle, naming the position/role that approves at that step. Owned outside this module and read strictly read-only, same as the parent cycle.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_approvalcyclestepid` | Approval Cycle Step | Unique ID (GUID) | Primary key of the step row. |
| `lm_name` | Name | Text (max 850) | Primary name column; not explicitly read by this app, which selects the position/order fields directly instead. |
| `lm_approvalcycle` | Approval Cycle | Lookup → lm_approvalcycles | The Approval Cycle this step belongs to, used to group steps under their cycle. |
| `lm_steporder` | Step Order | Whole number | This step's position within the cycle's sequence, used to sort steps so a Decision routes to the right approver in order. |
| `lm_positionrole` | Position Role | Lookup → another table | The Position/Role id that approves at this step. |
| `lm_positionrolename` | lm_positionrolename | Text (max 850) | Resolved display name of the approving position/role, read directly rather than through a separate lookup call. |

### `lm_authoritymatrixrows`

**Logical name:** `lm_authoritymatrixrow`

One tier of the Authority Matrix: for a given Decision Type, the maximum value that tier covers, the authority level required to approve it, and which Approval Cycle applies. Owned outside this module and read strictly read-only to run the Authority Check; a missing mapping blocks submission rather than falling back to an invented route.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_authoritymatrixrowid` | Authority Matrix Row | Unique ID (GUID) | Primary key of the authority-tier row. |
| `lm_name` | Name | Text (max 850) | Display name of the authority tier row. |
| `lm_decisiontype` | Decision Type | Choice: Quality Improvement Action (124330000), Clinical Protocol Change (124330001), Establishment or Staffing Change (124330004), Capital Expenditure (124330005), Technology Adoption (124330003) | Which category of Decision this tier applies to; code 124330002 exists in the option set but is unused. |
| `lm_maxvalue` | Max Value | Decimal number (currency) | The ceiling amount for this tier; null means no ceiling. Tiers are sorted by this value so the Authority Check takes the first tier a Decision's amount fits. |
| `lm_requiredlevel` | Required Level | Whole number | The authority level (0-6) a Decision's creator must meet or exceed at this tier. |
| `lm_approvalcycle` | Approval Cycle | Lookup → lm_approvalcycles | Which Approval Cycle routes a Decision that falls into this tier. |

### `lm_report_templates`

**Logical name:** `lm_report_template`

The parent row of a Report Template (Governance Setup): the reusable definition of one recurring Report, Plan or Dashboard a Business Unit, Region or Group must produce, carrying its name, cadence, category, confidentiality and destination. This module creates/updates it as the template side of a Setup and reads it back for the Setup Register and detail view.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_report_templateid` | Report_Template | Unique ID (GUID) | Primary key of the Report Template row. |
| `lm_newcolumn` | Report Name | Text (max 850) | The Report/Plan's display name, written from the Setup's name (falling back to its objective or "Untitled Report Template"). |
| `lm_objective` | Objective | Text (max 100) | Free-text objective/goal of the report. |
| `lm_reporttype` | Report Type  | Choice: Plan (1), Dashboard (2), Report (3) | Which of the three report kinds this Setup produces; live Dataverse metadata replaced this option set on 15 Sep 2026, and code 3's real Dataverse label is "Report Conclusion" though the app displays it as just "Report". |
| `lm_reportcategory` | Report Category  | Choice: Executive (1), Core (2), ADHOC (3) | Categorizes the report's importance/tier; this option set was also replaced live on 15 Sep 2026 (the cached schema file still shows the old four-value list). |
| `lm_submissiontiming` | (not in cached schema; global option set lm_submissiontiming) | Choice: Submission within same Month (1), Submission After Month (2) | Only meaningful when Report Type is Report/Conclusion: whether the report is due within the same month or after it. |
| `lm_frequency` | Frequency  | Choice: Daily (1), Twice Weekly (2), Weekly (3), Twice Monthly (4), Monthly (5), Quarterly (6), Semesterly (7), Annual (8), Custom (9) | How often the report recurs. |
| `lm_dayoftheweek` | Day of the Week | Choice: Sunday (1), Monday (2), Tuesday (3), Wednesday (4), Thursday (5) | Day of the week the report is due, for Weekly/Twice Weekly cadences. |
| `lm_dayofthemonth` | Day of the Month | Whole number | Day of the month the report is due, for Monthly-type cadences. |
| `lm_monthofthequarter` | Month of the quarter  | Choice: 1st Month (1), 2nd Month (2), 3rd Month (3) | Which month within a quarter the report is due, for Quarterly cadence. |
| `lm_seconddayoftheweek` | Second Day of the Week  | Choice: Sunday (1), Monday (2), Tuesday (3), Wednesday (4), Thursday (5) | The second due-day of the week, for a Twice Weekly cadence. |
| `lm_seconddayofthemonth` | Second Day of the Month | Whole number | The second due-day of the month, for a Twice Monthly cadence. |
| `lm_monthofthesemester` | Month of the Semester | Choice: 1st Month (1), 2nd Month (2), 3rd Month (3), 4th Month (4), 5th Month (5), 6th Month (6) | Which of the six months in a semester the report is due, for Semesterly cadence. |
| `lm_month` | Month | Choice: January (1), February (2), March (3), April (4), May (5), June (6), July (7), August (8), September (9), October (10), November (11), December (12) | The calendar month an Annual report is due in. |
| `lm_confidentiality` | Confidentiality  | Choice: Public (1), Internal (2), Confidential (3), High Confidential (4), Restricted (5) | Confidentiality classification of the report's content. |
| `lm_destinationsharepointlink` | Destination SharePoint Link | Text (max 1000) | SharePoint URL where the finished report is delivered. |
| `lm_fileattachement` | (not in cached schema) | Text (max 2000, per code comment) | Legacy plain-text/URL attachment link, kept for compatibility but no longer editable in the UI since the native File column was added. |
| `lm_attachementfile` | (not in cached schema) | File attachment | Native Dataverse File column holding the uploaded Report Template file, added after lm_fileattachement; only writable once the template row already exists. |
| `lm_stage` | Stage | Choice: Stage 1 BU Operational (1), Stage 2 Regional Functional (2), Stage 3 Group Functional (3), Stage 4 Top Management, COO & CEO (4) | Which Setup stage the template belongs to; added as a real column so a Stage 4 template round-trips correctly instead of being inferred (and confused with Stage 3) from its child rows. |
| `lm_reportstatus` | Report Status | Choice: Under Review (1), Expired (2), Draft (3), Active / Approved (4) | Lifecycle status of the Setup; can be patched alone (without touching child rows) for status-only transitions like Approve. |
| `lm_version` | Version  | Decimal number | Version number bumped on each republish, used to detect a save that silently failed to persist. |
| `lm_ownerposition` | Owner Position | Lookup → cr603_organizationstructures | Owner Position for a group-wide (Stage 3/4) Setup, which has no per-unit child row to carry this instead. |
| `lm_submittingposition` | Submitting Position  | Lookup → cr603_organizationstructures | Submitting Position for a group-wide Setup, for the same reason as Owner Position. |
| `lm_teamchannel` | Team Channel | Lookup → and_teamschannels | Team Channel used for notifications on a group-wide Setup. |
| `lm_reportspecialty` | Report Specialty | Lookup → cr301_specialtyksa_service_hubs | Speciality scope for a group-wide Setup. |

### `lm_reporttemplatebusinessunitses`

**Logical name:** `lm_reporttemplatebusinessunits`

One row per Business Unit configured on a BU-level (Stage 1) Report Template Setup, carrying that unit's own Speciality, Owner/Submitting Position and Team Channel, and anchoring that unit's own Review Chain steps.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplatebusinessunitsid` | Report Template Business Units | Unique ID (GUID) | Primary key of the unit row. |
| `lm_name` | Name | Text (max 850) | Display name of the unit row, taken from the Setup's unit.name. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The parent Report Template this Business Unit scope row belongs to. |
| `lm_businessunit` | Business Unit  | Lookup → businessunits | The real Business Unit this scope row represents. |
| `lm_speciality` | Speciality | Lookup → cr301_specialtyksa_service_hubs | This unit's Speciality for the report. |
| `lm_ownerposition` | Owner Position | Lookup → cr603_organizationstructures | This unit's Owner Position. |
| `lm_submittingposition` | Submitting Position  | Lookup → cr603_organizationstructures | This unit's Submitting Position. |
| `lm_teamchannel` | Team Channel  | Lookup → and_teamschannels | This unit's Team Channel for notifications. |

### `lm_reporttemplatecontentchecklists`

**Logical name:** `lm_reporttemplatecontentchecklist`

One row per Section in a Report Template's Expected Content Checklist — an ordered, optionally file-attached checklist item that groups the citation Section Items (KPI/Breakdown/Process/Child Template/File) filed underneath it.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplatecontentchecklistid` | Report Template Content Checklist  | Unique ID (GUID) | Primary key of the checklist/Section row. |
| `lm_checklistitemname` | Checklist Item Name | Text (max 850) | The Section's text label, from the Setup's checklist item text. |
| `lm_checklistitemstep` | Checklist Item Step  | Whole number | 1-based ordering of this Section within the checklist. |
| `lm_diagnosticangle` | Diagnostic Angle | Choice: Untyped (default) (1), Descriptive (2), Diagnostic (3), Predictive (4), Prescriptive (5) | Classifies the analytical angle of this Section; defaults to Untyped when the Setup doesn't specify one. |
| `lm_fileattachement` | (not in cached schema) | Text (URL/plain text; max length not in cached schema) | Optional file/URL attachment for this checklist Section. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The parent Report Template this checklist Section belongs to. |

### `lm_reporttemplatedepartmentfunctions`

**Logical name:** `lm_reporttemplatedepartmentfunction`

One row per Department (optionally narrowed to a Function within it) that a Report Template's scope covers — the report's "who this covers" department/function lines.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplatedepartmentfunctionid` | Report Template Department/Function | Unique ID (GUID) | Primary key of the scope-line row. |
| `lm_newcolumn` | New column | Text (max 850) | Primary name column; not set explicitly by this app, so it carries Dataverse's own default naming. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The parent Report Template this scope line belongs to. |
| `lm_department` | Department | Lookup → cr603_chklst_departmentses | The Department in scope for the report. |
| `lm_function` | Function | Lookup → hr_functions | The optional Function within that Department, further narrowing the scope. |

### `lm_reporttemplateregions`

**Logical name:** `lm_reporttemplateregion`

The Region-level counterpart of the Business Units child table: one row per Region configured on a Stage 2 (Regional) Report Template Setup, with its own Speciality, Owner/Submitting Position, Team Channel and Review Chain.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplateregionid` | Report Template Region  | Unique ID (GUID) | Primary key of the region row. |
| `lm_name` | Name | Text (max 850) | Display name of the region row, taken from the Setup's unit.name. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The parent Report Template this Region scope row belongs to. |
| `lm_region` | Region | Lookup → crd04_regionses | The real Region this scope row represents. |
| `lm_reportspeciality` | Report Speciality | Lookup → cr301_specialtyksa_service_hubs | This region's Speciality for the report. |
| `lm_ownerposition` | Owner Position | Lookup → cr603_organizationstructures | This region's Owner Position. |
| `lm_submittingposition` | Submitting Position | Lookup → cr603_organizationstructures | This region's Submitting Position. |
| `lm_teamchannel` | Team Channel | Lookup → and_teamschannels | This region's Team Channel for notifications. |

### `lm_reporttemplaterelatedkpises`

**Logical name:** `lm_reporttemplaterelatedkpis`

A junction row linking a Report Template to one KPI it reports on at the template level, distinct from KPIs cited inside individual checklist Sections.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplaterelatedkpisid` | Report Template Related KPIs | Unique ID (GUID) | Primary key of the related-KPI junction row. |
| `lm_newcolumn` | New column | Text (max 850) | Primary name column; not set explicitly by this app. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The Report Template this related KPI belongs to. |
| `lm_relatedkpi` | Related KPI | Lookup → strategy_kpises | The KPI related to (tracked by) the report as a whole. |

### `lm_reporttemplaterelatedprocesseses`

**Logical name:** `lm_reporttemplaterelatedprocesses`

A junction row linking a Report Template to one Process it relates to at the template level.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplaterelatedprocessesid` | Report Template Related Processes | Unique ID (GUID) | Primary key of the related-process junction row. |
| `lm_newcolumn` | New column | Text (max 850) | Primary name column; not set explicitly by this app. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The Report Template this related process belongs to. |
| `lm_relatedprocess` | Related Process | Lookup → strategy_processes | The Process related to the report as a whole. |

### `lm_reporttemplatereviewchains`

**Logical name:** `lm_reporttemplatereviewchain`

One row per step in a Report Template's review/approval chain: who reviews the report at that step, scoped either to a specific Business Unit/Region row or, for a group-wide Setup, bound to the Template directly with no per-unit lookup set.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplatereviewchainid` | Report Template Review Chain | Unique ID (GUID) | Primary key of the review-chain step row. |
| `lm_newcolumn` | New column | Text (max 850) | Holds the reviewer's Position name as plain text, preserved even when no real Position/User lookup has been resolved yet. |
| `lm_reporttemplate` | Report Template  | Lookup → lm_report_templates | The Report Template this review step belongs to; for a group-wide Setup this is the step's only binding. |
| `lm_reporttemplateperbusinessunit` | Report Template Per Business Unit | Lookup → lm_reporttemplatebusinessunitses | The specific Business Unit row this step's chain hangs off (the current write path, added 06 Sep 2026). |
| `lm_reporttemplateperregion` | Report Template Per Region | Lookup → lm_reporttemplateregions | The specific Region row this step's chain hangs off (the current write path, added 06 Sep 2026). |
| `lm_meetingtemplateperbusinessunit` | Meeting Template Per Business Unit | Lookup → lm_meetingtemplatebusinessunitses | Legacy per-Business-Unit binding reused from the Meeting module before 06 Sep 2026; still read so older saved chains aren't lost, but no longer written. |
| `lm_meetingtemplateperregion` | Meeting Template Per Region | Lookup → lm_meetingtemplateregions | Legacy per-Region binding, same backward-compatibility reasoning as its Business Unit counterpart. |
| `lm_step` | Step | Whole number | The step's position within its chain; identifies a step so an edit can be reconciled in place rather than deleted and recreated. |
| `lm_reviewerposition` | Reviewer Position  | Lookup → cr603_organizationstructures | The real Position record for this reviewer, when resolvable. |

### `lm_reporttemplatesectionitemses`

**Logical name:** `lm_reporttemplatesectionitems`

The individual citations inside one checklist Section — one row per cited KPI, Breakdown (a KPI plus a dimension), Process, child Report Template, or uploaded File — letting a Section reference any number of these at once (written by the createSectionItems helper).

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_reporttemplatesectionitemsid` | Report Template Section Items | Unique ID (GUID) | Primary key of the citation row. |
| `lm_sectionitemname` | Section Item Name | Text (max 850) | Display label for the citation (the item's label, or its type if unlabeled). |
| `lm_itemtype` | Item Type | Choice: KPI (1), Breakdown (2), Process (3), Child Template (4) | Which kind of citation this row is; left null for a File citation since this option set has no File value. |
| `lm_kpi` | KPI | Lookup → strategy_kpises | The cited KPI, used for both a plain KPI citation and the KPI half of a Breakdown citation. |
| `lm_breakdowndimension` | Breakdown Dimension | Choice: Account (1), Payment Type (2), Physician (3), Department (4), Platform (5), Employee (6), Speciality (7) | The dimension a Breakdown citation slices its KPI by; there is no column for a specific member, so members resolve when the report is actually built. |
| `lm_process` | Process | Lookup → strategy_processes | The cited Process for a Process-type citation. |
| `lm_childreporttemplate` | Child Report Template | Lookup → lm_report_templates | The cited child Report Template for a "Child Template" citation, letting one report cite another as a sub-report. |
| `lm_attachementfile` | (not in cached schema) | File attachment | Holds the uploaded file's bytes for a File-type citation; its presence (rather than lm_itemtype) is what identifies a row as a File citation on read. |
| `lm_sectionchecklistitem` | Section Checklist Item | Lookup → lm_reporttemplatecontentchecklists | The parent checklist Section this citation belongs to. |

### `lm_setupactivities`

**Logical name:** `lm_setupactivity`

An audit-trail row recording one change to a Report or Meeting Template Setup (created, edited, published, approved, expired, etc.), so the Setup Detail's Activity tab can show a history of who changed what and when.

| Column | Title | Datatype | Purpose |
|---|---|---|---|
| `lm_setupactivityid` | Setup Activity | Unique ID (GUID) | Primary key of the activity row. |
| `lm_name` | Name | Text (max 850) | Composed label "{action} · {field}" for the entry. |
| `lm_action` | Action | Choice: Created (1), Edited (2), Edit opened (3), Published (4), Approved (5), Expired (6) | Which lifecycle action this entry records; mapped by code because Dataverse renders option 3 as "Editopened" with no space, and the app keeps saying "Edit opened". |
| `lm_field` | Field | Text (max 100) | Name of the field or aspect of the Setup that changed. |
| `lm_before` | Before | Text (max 2000) | The value before the change; truncated with an ellipsis rather than dropped if it overflows, since the trail entry must not fail the save it describes. |
| `lm_after` | After | Text (max 2000) | The value after the change, with the same truncation rule as lm_before. |
| `lm_actor` | Actor | Text (max 200) | Display name of who made the change, stored as plain text. |
| `lm_actoruser` | Actor User | Lookup → systemusers | The real system user who made the change, when known. |
| `lm_version` | Version  | Whole number | The Setup's version number at the time of this change. |
| `lm_reporttemplate` | Report Template | Lookup → lm_report_templates | The Report Template this activity is about; mutually exclusive with lm_meetingtemplate — exactly one is ever set. |
| `lm_meetingtemplate` | Meeting Template | Lookup → lm_meetingtemplates | The Meeting Template this activity is about, when the Setup being logged is a Meeting Template rather than a Report Template. |
