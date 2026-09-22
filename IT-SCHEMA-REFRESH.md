# IT environment — schema refresh

`pac modelbuilder build` run against **both** environments over the same 57 tables the apps reach through `dvTable()`, then compared. Same generator on both sides, so every difference below is real metadata — not a rendering artifact.

| | |
|---|---|
| IT | `org2f45e702` (24b23b77-4d64-e7f5-9796-36a7b12bb75e) |
| DT New | `org319b4ea9` |
| Tables requested | 57 |
| Present in IT | 55 |
| Present in DT New | 58 |

## What has to change in the code

### 1. `lm_TeamChannel` was repointed — 9 write sites are now wrong

**In BOTH environments**, not just IT:

| | |
|---|---|
| Lookup now targets | `and_teamschannellink` |
| Code binds to | `/and_teamschannels(...)` |
| Sites | 9 `@odata.bind` writes across Meeting and Report Template save/create/update |

The read side was already switched to `and_teamschannellinks` on 22 Sep and
left deliberately read-only, pending exactly this. Because the repoint is in
**both** orgs, saving a Setup with a Channel chosen fails in Leadership too,
not only in Governance.

⚠️ **This is invisible to an environment-vs-environment diff** — both sides
agree. It only appears when the live schema is compared against what the code
writes.

⚠️ The old and new tables do not share ids, so **existing rows carrying an
`and_teamschannels` id cannot simply be rebound** — a stored Channel points at
a row in a table the lookup no longer targets.

### 2. `lm_meetingoccurrencedepartmentfunction` — two selected columns are absent from IT

`lm_departmentname` and `lm_functionname` exist in DT New and **not** in IT. The
code selects both. One unknown column fails the **whole** query, so this breaks
the moment that table is read against IT. It is Meeting-side, so it is DT New
today and therefore not yet live — it becomes a break if Meetings ever follow
Reports across.

### 3. Not a problem, checked rather than assumed

- `lm_attachementfile` is selected only on `lm_report_templates` and
  `lm_reporttemplatesectionitemses`. IT has it on both, which is consistent
  with the file viewer working there.
- `lm_reportoccurrence` in IT has **no** `lm_attachementfile` and no
  `lm_teamchannel`. Neither is selected, so nothing breaks — but the paused
  occurrence-file work (§7.6) has nowhere to store a file in IT.
- Every other lookup target the code binds to still matches.

⚠️ **Datatype changes could not be verified.** Nothing differs between the two
environments, but modelbuilder's C# cannot express a max-length or precision
change — a text column widened from 100 to 2000 is `string` on both sides. If
a datatype change was made, it is not detectable this way; name the column and
it can be checked directly.

---

## Tables absent from IT

- `lm_approvalcycle`
- `lm_approvalcyclestep`
- `lm_authoritymatrixrow`

## 1. Lookups repointed in IT

| Table | Column | DT New target | **IT target** |
|---|---|---|---|
| `crd04_regions` | `crd04_manager` | `_(no relationship emitted)_` | **`SystemUser`** |
| `crd04_regions` | `crd04_mediaassignees` | `_(no relationship emitted)_` | **`SystemUser`** |
| `hx_tasks` | `cr18c_assignto` | `_(no relationship emitted)_` | **`hr_Employee`** |

## 2. Columns whose TYPE differs

_None._

## 3. Columns IT has that DT New does not

_None on app-owned tables._

<sub>20 further additions on shared/master-data tables, not listed.</sub>

## 4. Columns DT New has that IT does NOT

⚠️ A `$select` naming any of these fails the **entire** query against IT, not just that column.

| Table | Column | Type |
|---|---|---|
| `and_teamschannel` | **`and_channelobjectid`** | string |
| `and_teamschannel` | **`and_planchannel`** | EntityReference |
| `and_teamschannel` | **`and_rootfolderlink`** | string |
| `and_teamschannel` | **`and_roottype`** | string |
| `and_teamschannel` | **`and_sharepointsitelink`** | string |
| `and_teamschannel` | **`and_teamobjectid`** | string |
| `and_teamschannel` | **`lm_documentlibrary`** | string |
| `and_teamschannel` | **`lm_folder`** | string |
| `and_teamschannel` | **`lm_sharepointsitepath`** | string |
| `and_teamschannel` | **`lm_team`** | string |
| `lm_reportoccurrence` | **`lm_attachementfile`** | Nullable<Guid> |
| `lm_reportoccurrence` | **`lm_teamchannel`** | EntityReference |
| `lm_reportsectioncitations` | **`lm_attachementfile`** | Nullable<Guid> |
| `wlog_decision` | **`lm_citedreportsection`** | EntityReference |
| `wlog_decision` | **`pms_cadecision`** | pms_pmscadecisionglobalchoice? |
| `wlog_decision` | **`pms_cadecisiondescription`** | string |
| `wlog_decision` | **`pms_caoccasion`** | pms_pmscaoccasionglobalchoice? |
| `wlog_decision` | **`pms_currentkpiactual`** | Nullable<double> |
| `wlog_decision` | **`pms_currentkpitarget`** | Nullable<double> |
| `wlog_decision` | **`pms_employeebusinessunit`** | string |
| `wlog_decision` | **`pms_employeedepartment`** | string |
| `wlog_decision` | **`pms_employeesector`** | string |
| `wlog_decision` | **`pms_expectedkpiactual`** | Nullable<double> |
| `wlog_decision` | **`pms_expectedkpitarget`** | Nullable<double> |
| `wlog_decision` | **`pms_feedback`** | byte[] |
| `wlog_decision` | **`pms_feedback_timestamp`** | Nullable<long> |
| `wlog_decision` | **`pms_feedback_url`** | string |
| `wlog_decision` | **`pms_feedbackid`** | Nullable<Guid> |
| `wlog_decision` | **`pms_outcomekpi`** | string |
| `wlog_decision` | **`pms_raisedby`** | pms_pmsraisedbyglobalchoice? |
| `wlog_decision` | **`pms_relevancy`** | pms_pmsvalidityglobalchoice? |
| `wlog_decision` | **`pms_rootcausedescription`** | string |
| `wlog_decision` | **`pms_taskowner`** | EntityReference |
| `wlog_decision` | **`pms_taskownermail`** | string |
| `wlog_decision` | **`pms_validity`** | pms_pmsvalidityglobalchoice? |
| `wlog_decision` | **`wlog_wlogworklogid`** | EntityReference |

<sub>12 further on shared/master-data tables.</sub>