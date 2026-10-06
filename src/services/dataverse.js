/* =========================================================================
   Dataverse service wrapper — Governance Setup
   ========================================================================= *
   Target environment : https://org319b4ea9.crm4.dynamics.com/
   Target solution     : LeadershipPractice  (publisher prefix: lp)

   Each export here mirrors a piece of Governance Setup's current mock
   reference data (POSITIONS, TEAMS, REGIONS, ...) so wiring one in is a
   like-for-like swap, not a redesign of GovernanceApp.jsx.
   ========================================================================= */

export const DATAVERSE_CONFIG = {
  environmentUrl: 'https://org319b4ea9.crm4.dynamics.com/',
  solutionName: 'LeadershipPractice',
  publisherPrefix: 'lp',
};

/** Pulls the new row's id out of a create() result, or throws with
 *  Dataverse's OWN error message when the SDK reports the operation
 *  actually failed (created.success === false / created.error) --
 *  previously every create() call here assumed success whenever no
 *  exception was thrown and, finding no id, threw a generic "succeeded
 *  but no id was returned" that buried the real reason (a validation
 *  or permission error) the SDK had already captured on the result. */
function idOrThrow(created, idField){
  const id = created?.data?.[idField] ?? null;
  if(id) return id;
  if(created?.error) throw new Error(created.error.message || String(created.error));
  throw new Error('Create succeeded but no id was returned in the response.');
}

/** Same blind spot as idOrThrow above, for update() calls -- these have no
 *  id to look for, so a failed update() otherwise looks identical to a
 *  successful one unless result.success / result.error is actually read. */
function assertSuccess(result){
  if(result?.success===false || result?.error){
    throw new Error(result?.error?.message || String(result?.error) || 'The operation did not succeed.');
  }
}

/** Same blind spot again, for getAll() reads: `res?.data ?? []` on a failed
 *  read (permission denied, bad $select, wrong entity set...) silently
 *  yields an empty array -- indistinguishable from "the table is really
 *  empty" -- so the caller's try/catch never fires and the real Dataverse
 *  error is never seen anywhere, not even in the console. Use this instead
 *  of `res?.data ?? []` on any read whose failure needs to be diagnosable. */
function rowsOrThrow(res){
  if(res?.success===false || res?.error){
    throw new Error(res?.error?.message || String(res?.error) || 'The read did not succeed.');
  }
  return res?.data ?? [];
}

/* ---------------------------------------------------------------------
   WIRED: Regions (crd04_regions) and Business Units (businessunit)
   ---------------------------------------------------------------------
   NOTE on getAll(): the generated service's getAll() resolves with the
   record array directly on .data (IOperationResult<T[]> -- .data IS the
   T[]), not nested under .data.value like a raw Dataverse Web API/OData
   response. Every fetch* function below reads res.data accordingly. */
/* The generated Dataverse SDK is imported through the @generated alias, not a
   relative path. This file is shared by both Code Apps in this repo, but the
   SDK is not: `pac code add-data-source` writes one per app root, beside that
   app's own power.config.json. Each app's vite.config.js maps @generated to
   its own copy. See each app's vite.config.js under apps/. */
/* ---------------------------------------------------------------------
   Every table in this file is resolved against DATA_ORG in xenv.js -- the
   environment the DATA lives in -- not the environment this app happens to
   be deployed to. The generated per-table services (Lm_xxxService.getAll
   and friends) can only ever reach the app's own environment, which is why
   they are no longer imported; the header of xenv.js explains why in full.

   Each dvTable(...) below keeps the exact shape of the service it replaced
   -- getAll / get / create / update / delete -- so every call site in this
   file is unchanged. Restoring the generated imports reverts to
   home-environment-only behaviour and needs no other edit.

   The entity set (plural) names come from each generated service's own
   dataSourceName constant, not from guesswork. The second argument, on
   the 28 tables this file creates rows in, is the primary key column --
   read from each generated service's create() signature -- which lets
   create() supply the new row's GUID itself; see xenv.js.
   --------------------------------------------------------------------- */
import { dvTable, uploadFileColumn, PIN_ORG } from './xenv.js';

/* All IT. Every record that carries a Business Unit / Region / Department /
   Function id -- Report Templates, Report Occurrences, Meeting Templates,
   Meeting Occurrences -- is now read from and written to IT, so the id in the
   record and the id in the name map have to come from the same place.

   IT and DT New do not share ids for any of these (§9's GUID evidence), and
   the counts differ too: BU 36/35, Region 4/3, Department 71/57,
   Function 252/294. A record's id simply does not appear in the other org's
   table, which is what "(Business Unit not in the loaded list)" was.

   No-op for Governance, whose DATA_ORG is already IT. */
const BusinessunitsService = dvTable('businessunits', undefined, PIN_ORG);
const Crd04_regionsesService = dvTable('crd04_regionses', undefined, PIN_ORG);
const Cr603_chklst_departmentsesService = dvTable('cr603_chklst_departmentses', undefined, PIN_ORG);
const Hr_functionsService = dvTable('hr_functions', undefined, PIN_ORG);
/* ⚠️ SUPERSEDED 26 Sep, and now pure duplication. Kept only because
   BuildReport.jsx still calls the fetch*ForIT() wrappers below.

   The 24 Sep rationale for forking these was sound at the time and is worth
   preserving: Business Unit/Region/Department/Function/Position were read by
   BOTH Meeting-side data (Meeting Occurrences, DT New) and Report-side data
   (Report Occurrences, IT since 22 Sep). One set of services could not serve
   both, so repointing them would have fixed Build a report/plan's Scope panel
   and broken 40+ Meeting-side name resolutions in the same stroke.

   **That ceased to be true on 26 Sep**, when the Meeting family moved to IT.
   Both sides now carry IT ids, the four services above are pinned to IT, and
   these five read the same tables in the same org as their counterparts.

   ⚠️ So the app now reads each of these tables TWICE per load -- and for
   Organization Structure that is 11.4k rows each time. Removing them means
   pointing BuildReport.jsx's Scope panel at the context's existing dvLookup
   resolvers instead of fetching its own copy; left as its own change rather
   than bundled into this one. */
const BusinessunitsItService = dvTable('businessunits', undefined, PIN_ORG);
const Crd04_regionsesItService = dvTable('crd04_regionses', undefined, PIN_ORG);
const Cr603_chklst_departmentsesItService = dvTable('cr603_chklst_departmentses', undefined, PIN_ORG);
const Hr_functionsItService = dvTable('hr_functions', undefined, PIN_ORG);
const Cr603_organizationstructuresItService = dvTable('cr603_organizationstructures', undefined, PIN_ORG);

/** IT-side siblings of fetchBusinessUnits/fetchDepartments/fetchFunctions/
 *  fetchRegions/fetchPositions (name only, no holder chain) -- see the note
 *  on the *ItService consts above for why these exist as a second, separate
 *  set rather than the existing functions repointed to IT_ORG. */
export async function fetchBusinessUnitsForIT(){
  const res = await BusinessunitsItService.getAll({ select: ['businessunitid', 'name'] });
  return (res?.data ?? []).map(r => ({ id: r.businessunitid, name: r.name }));
}
export async function fetchRegionsForIT(){
  const res = await Crd04_regionsesItService.getAll({ select: ['crd04_regionsid', 'crd04_id'] });
  return (res?.data ?? []).map(r => ({ id: r.crd04_regionsid, name: r.crd04_id }));
}
export async function fetchDepartmentsForIT(){
  const res = await Cr603_chklst_departmentsesItService.getAll({
    select: ['cr603_chklst_departmentsid', 'cr603_department'],
  });
  return (res?.data ?? []).map(r => ({ id: r.cr603_chklst_departmentsid, name: r.cr603_department }));
}
export async function fetchFunctionsForIT(){
  const res = await Hr_functionsItService.getAll({ select: ['hr_functionid', 'hr_functionname'] });
  return (res?.data ?? []).map(r => ({ id: r.hr_functionid, name: r.hr_functionname }));
}
export async function fetchPositionNamesForIT(){
  const res = await Cr603_organizationstructuresItService.getAll({
    select: ['cr603_organizationstructureid', 'cr603_name'],
  });
  return (res?.data ?? []).map(r => ({ id: r.cr603_organizationstructureid, name: r.cr603_name }));
}
/* Pinned to IT_ORG (24 Sep) -- both feed Build a report/plan's KPI/Process
   citation pickers, and a citation row is created in IT (see
   Lm_reportsectioncitationsesService below), binding lm_KPI/lm_Process
   straight to whatever id the picker offered. Leaving these on this app's
   own DATA_ORG (DT New for Leadership) would have handed the citation a
   DT-New id to bind against an IT row -- the two environments do not share
   ids for the same conceptual record anywhere else in this app either, so
   the bind would fail. Business Intelligence and Communication also read
   these two tables (fetchKpis/fetchProcesses are shared, not
   Build-a-report/plan-only), so this moves their KPI/Process/Task data to
   IT too, on purpose -- see PROJECT-CONTEXT.md for the scope decision. */
const Strategy_kpisesService = dvTable('strategy_kpises', undefined, PIN_ORG);
const Strategy_processesService = dvTable('strategy_processes', undefined, PIN_ORG);
/* Pinned to IT_ORG (24 Sep) same day as strategy_kpises above, for the same
   reason: fetchKpiAchievements() filters this table by _pm_kpi_value, and
   since a KPI citation's id now comes from IT's strategy_kpises, an
   unpinned (DT New) copy of this table would never match it -- DT New's
   achievement rows point at DT New's KPI ids, not IT's. Both readers
   (BuildReport.jsx, OrgReports.jsx) are Report Occurrence / citation
   screens, already IT-hosted, so this is a plain repoint, not a fork. */
const Pm_kpiachievmentsService = dvTable('pm_kpiachievments', undefined, PIN_ORG);
/* IT: lm_Speciality / lm_ReportSpeciality on Report and Meeting Templates
   all bind to this, and those rows are IT. */
const Cr301_specialtyksa_service_hubsService = dvTable('cr301_specialtyksa_service_hubs', undefined, PIN_ORG);
const And_microsoftgroupmembersService = dvTable('and_microsoftgroupmembers', undefined, PIN_ORG);
/* IT, not the app's own org. Every record that binds lm_CreatorPosition /
   lm_ChairPosition / lm_ReviewerPosition and friends to
   /cr603_organizationstructures(id) is now written to IT, so the id has to be
   an IT id or the bind resolves against nothing.

   The data says the same thing: IT holds 11,372 Positions of which 4,641 name
   their current holder; DT New holds 307, of which 11 do. The Position
   pickers were listing the 307.

   No-op for Governance, whose own DATA_ORG is already IT -- the divergence is
   Leadership's, exactly as with the Report and Meeting families.

   ⚠️ hr_employees and systemusers are deliberately NOT moved with it. They
   feed fetchPositions()' FALLBACK holder routes only; the primary route is
   the Organization Structure row's own hr_fullnameofcurrentemployee, which
   is what the 4,641 above counts. Those fallbacks simply stop matching, and
   holder resolution degrades to the name route rather than breaking.

   ⚠️ Cost: ~11.4k rows at app load, three pages instead of one. */
const Cr603_organizationstructuresService = dvTable('cr603_organizationstructures', undefined, PIN_ORG);
/* ⚠️ IT_ORG (27 Sep). This was a FORK -- one service on DT New for name
   resolution, an IT-pinned sibling for picking a user to bind -- and the fork
   collapsed the moment hr_employees moved to IT (26 Sep, below). Its stated
   reason was that fetchUserNameMap()'s systemuserid keys come from
   hr_employees.hr_User "and hr_employees is itself still DT New". It is not,
   any more, so on DT New that map was joining IT employee ids against DT New
   users and could never match.

   Everything this app binds a systemuser INTO now lives in IT --
   hx_tasks.hx_Assignee, lm_reportoccurrenceshares.lm_SharedUser and
   lm_reportoccurrencehistories.lm_ActorUser -- and a DT New id in any of them
   fails with "Entity 'SystemUser' With Id = ... Does Not Exist". Nothing on
   the remaining DT New tables binds a user at all, so there is no case left
   that wants the old org.

   ⚠️ This also changes fetchCurrentUser(): currentUser.systemUserId is now an
   IT id, so myPositionIds can finally match it against holderUserId (which
   hr_employees, also IT, supplies) instead of always falling through to the
   name comparison. */
const SystemusersService = dvTable('systemusers', undefined, PIN_ORG);
/* ⚠️ IT_ORG (26 Sep), and it has to be. Its ONLY caller is
   fetchEmployeeIndex(), whose whole job is to join employees to Positions --
   and cr603_organizationstructures is IT-pinned above. On this app's own
   DATA_ORG it was joining IT Position ids against DT New employee rows, which
   share no ids with them, so every fallback holder route silently missed and
   a Position whose hr_fullnameofcurrentemployee happened to be blank showed
   no name at all. Confirmed live: position 030331ea… carries employee
   20005-AHJ, whose IT hr_employee row names Yousef Abdulrahman Altalhi, while
   its hr_fullnameofcurrentemployee is empty.

   This does NOT disturb myPositionIds: holderUserId now carries IT
   systemuserids, which still cannot match a DT New currentUser.systemUserId,
   so that match finds nothing exactly as before and falls through to the name
   route -- which this change makes work for many more Positions. */
const Hr_employeesService = dvTable('hr_employees', undefined, PIN_ORG);
/* and_teamschannels retired 22 Sep in favour of and_teamschannellinks (below)
   -- a newly-registered table with a real Team/Channel object id on each
   row, not just a repeated name.

   COMPLETED 23 Sep. The 22 Sep pass deliberately moved the VIEW side only,
   leaving lm_TeamChannel still targeting the old table, so a Channel picked
   from the new rows could not be saved. A schema refresh against IT confirmed
   lm_TeamChannel has since been repointed to and_teamschannellink -- in BOTH
   environments, which is why comparing the two orgs shows nothing -- so all
   nine `lm_TeamChannel@odata.bind` writes now target
   /and_teamschannellinks(...) to match. See IT-SCHEMA-REFRESH.md.

   ⚠️ The two tables share no ids: a Setup saved BEFORE this carries an
   and_teamschannels id in a lookup that no longer points at that table. Those
   rows need their Channel re-picked; nothing here repairs them. */
/* IT: lm_TeamChannel binds to this from Report and Meeting Templates, which
   are IT -- and the bind was only repointed to this table on 23 Sep. */
const And_teamschannellinksService = dvTable('and_teamschannellinks', undefined, PIN_ORG);

/** Regions -- table crd04_regions (generated as Crd04_regionsesService).
 *  Primary key crd04_regionsid; crd04_id holds the display name. */
export async function fetchRegions(){
  const res = await Crd04_regionsesService.getAll({
    select: ['crd04_regionsid', 'crd04_id'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.crd04_regionsid,
    name: r.crd04_id,
    tz: '', // not sourced from Dataverse -- kept for shape-compatibility
            // with the existing REGIONS mock data (which had a tz field)
  }));
}

/** Business Units -- table businessunit. cr603_region is a lookup to
 *  crd04_regions; Dataverse Web API exposes lookup values as
 *  "_<lookupname>_value" (the related record's GUID). */
/* Filtered to HR-tagged rows only, per an explicit ask (23 Sep).
   cr603_application_tag is a multi-select Choices column; this reads its
   FormattedValue annotation -- a "; "-joined label string, e.g.
   "Onboarding; HR; Laptop" -- the same annotation-over-hand-kept-map
   convention this file already uses for every other choice column (see FV
   below), rather than a raw OData Microsoft.Dynamics.CRM.ContainValues
   filter, which nothing in this app has exercised against this connector
   yet. Confirmed live against IT: 15 of 36 rows carry HR. */
/* Unfiltered again as of 24 Sep -- every Business Unit, whether or not it
   has any Organization Structure rows of its own. Went through two other
   shapes first (an HR application-tag filter, then a "has at least one
   Position" filter) before landing here; see PROJECT-CONTEXT.md for why
   each was tried and dropped. A BU with no Positions of its own is no
   longer a dead end for the pickers that need one -- positionsInScope()
   (GovernanceApp.jsx) now falls back to every Position company-wide,
   labelled by its real BU, exactly for this case. */
export async function fetchBusinessUnits(){
  const res = await BusinessunitsService.getAll({
    select: ['businessunitid', 'name', '_cr603_region_value'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.businessunitid,
    name: r.name,
    region: r._cr603_region_value ?? null, // matches a Region's id above
  }));
}

/* ---------------------------------------------------------------------
   WIRED: Departments, Functions, Processes, KPIs
   ---------------------------------------------------------------------
   Departments: cr603_chklst_departmentses has NO Business Unit lookup --
   its only real lookups are Company, Cost Center and Department Sector.
   The standard "owningbusinessunit" field on it is Dataverse's security
   owner, which is the root org for practically every row, so filtering
   Departments by it does not work. It is still returned below, named
   honestly as `owningBu`, but nothing should narrow by it.

   The real link between a Department and a Business Unit is the
   Organization Structure table: each position assignment carries both a
   Business Unit and a Department. departmentBuIndex() below derives the
   relationship from those rows.

   Functions: hr_Department is a real lookup to the Department table, so
   _hr_department_value maps directly to a Department's id (matches the
   mock's `dept` field).

   Processes / KPIs: the app only ever stores/display these by name
   (never by id -- see the Checks/multi-select usage in the wizards), so
   these two return plain name strings, matching PROCESSES/KPIS' existing
   flat-array-of-strings shape exactly. No id needed, no shape change
   for anything that already reads PROCESSES/KPIS. */

export async function fetchDepartments(){
  const res = await Cr603_chklst_departmentsesService.getAll({
    select: ['cr603_chklst_departmentsid', 'cr603_department', '_owningbusinessunit_value'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.cr603_chklst_departmentsid,
    name: r.cr603_department,
    // Security owner, NOT an org relationship -- see the note above. Kept only
    // so nothing silently loses the column; use departmentBuIndex() to relate a
    // Department to a Business Unit.
    owningBu: r._owningbusinessunit_value ?? null,
  }));
}

/** Department <-> Business Unit, derived from the Organization Structure rows,
 *  each of which names both. Takes the result of fetchPositions().
 *  A Department can legitimately map to more than one Business Unit, so both
 *  directions are sets rather than single ids. */
export function departmentBuIndex(positions){
  const buIdsByDept = new Map(), deptIdsByBu = new Map();
  (positions || []).forEach(p => {
    if(!p.dept || !p.bu) return;
    if(!buIdsByDept.has(p.dept)) buIdsByDept.set(p.dept, new Set());
    buIdsByDept.get(p.dept).add(p.bu);
    if(!deptIdsByBu.has(p.bu)) deptIdsByBu.set(p.bu, new Set());
    deptIdsByBu.get(p.bu).add(p.dept);
  });
  return { buIdsByDept, deptIdsByBu };
}

export async function fetchFunctions(){
  const res = await Hr_functionsService.getAll({
    select: ['hr_functionid', 'hr_functionname', '_hr_department_value'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.hr_functionid,
    name: r.hr_functionname,
    dept: r._hr_department_value ?? null,
  }));
}

export async function fetchKpis(){
  const res = await Strategy_kpisesService.getAll({
    // strategy_newcolumn is required/no-default in the model, which is the
    // Dataverse signature of a primary name column -- likely renamed after
    // creation without updating the logical name. Confirm this is really
    // the KPI's display name; swap for the right column if not.
    /* A lookup's name column (strategy_departmentname, strategy_processname)
        is NOT selectable -- $select-ing one fails the whole read with
        0x80060888 "Could not find a property named ...". The display name
        comes from the lookup's formatted-value annotation instead; the
        adapter requests those on every list read. See PROJECT-CONTEXT section 6,
        "A lookup's display name is already on the row". */
    select: ['strategy_kpisid', 'strategy_newcolumn',
             '_strategy_department_value', '_strategy_process_value'],
  });
  const rows = rowsOrThrow(res);
  // {id, name, dept} -- id is needed to write lm_RelatedKPI@odata.bind when
  // saving a Report Template; dept feeds the Governed List's BU/Department
  // filter. GovernanceApp derives the flat name list the existing
  // Checks/ComboMulti UI expects from this same fetch. processId/processName
  // and deptName are additive -- a KPI carries its own Department AND its own
  // Process directly (both denormalised names already on the row, no second
  // lookup needed), for the Business intelligence screen's Process/Department
  // filters.
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({
    id: r.strategy_kpisid,
    name: r.strategy_newcolumn,
    dept: r._strategy_department_value ?? null,
    deptName: r['_strategy_department_value' + FV] || null,
    processId: r._strategy_process_value ?? null,
    processName: r['_strategy_process_value' + FV] || null,
  }));
}

export async function fetchProcesses(){
  const res = await Strategy_processesService.getAll({
    // same strategy_newcolumn caveat as fetchKpis above.
    /* same rule as fetchKpis above -- no name columns in $select. The extra
       columns below are this table's own metadata -- Function, Type, Scope,
       Section, Main Process -- read for citation display/export (27 Sep).
       Deliberately NOT read: the several btm_-prefixed columns also on this
       table -- a different, unrelated app's overlay data on the same shared
       table, not this app's concept of a Process at all. */
    select: ['strategy_processid', 'strategy_newcolumn', '_strategy_department_value',
             '_strategy_function_value', '_strategy_mainprocess_value',
             'strategy_processtype', 'strategy_scope', '_strategy_section_value'],
  });
  const rows = rowsOrThrow(res);
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({
    id: r.strategy_processid,
    name: r.strategy_newcolumn,
    dept: r._strategy_department_value ?? null,
    deptName: r['_strategy_department_value' + FV] || null,
    functionName: r['_strategy_function_value' + FV] || null,
    mainProcessName: r['_strategy_mainprocess_value' + FV] || null,
    processType: r['strategy_processtype' + FV] || null,
    scope: r['strategy_scope' + FV] || null,
    sectionName: r['_strategy_section_value' + FV] || null,
  }));
}

/** KPI Achievements -- table pm_kpiachievments (§6: a pre-existing, shared,
 *  multi-prefix table, not owned by this app). Actual/Target/Baseline for one
 *  KPI, one Department, one Function, one month.
 *
 *  stf_department/stf_function are PLAIN TEXT columns, not lookups, so they
 *  are matched client-side, case-insensitively, rather than filtered server
 *  side -- exact live casing isn't guaranteed. pm_year is a plain integer and
 *  IS filtered server-side, as is pm_month when one is asked for.
 *
 *  Two things this comment used to flag as unknown are now confirmed from live
 *  metadata, so neither is guessed at any more:
 *    - pm_month runs 1..12 in calendar order (new_pm_kpiachievment_pm_month),
 *      so a month can be filtered by code instead of matched against its label.
 *    - _pm_kpi_value targets strategy_kpis (relationship pm_kpiachievment_kpi)
 *      -- the same table this app's KPIs come from, so the join is sound. This
 *      table itself is IT_ORG-pinned (24 Sep) for that reason: a KPI
 *      citation's id comes from IT, so this table has to live in IT too, or
 *      the join would compare an IT id against DT New's copy of the row.
 *
 *  Called two ways. With a year alone it returns that whole year, which is what
 *  the Reports screen reads. With `only`, it narrows to particular KPIs and one
 *  month -- one filtered read for a single report occurrence, instead of
 *  pulling a year to use a month of it.
 *
 *  @param {number} year
 *  @param {{kpiIds?:string[], month?:number}} [only]
 */
export async function fetchKpiAchievements(year, only = {}){
  const ids = [...new Set((only.kpiIds || []).filter(Boolean))];
  if(only.kpiIds && !ids.length) return [];      // asked for none, so none
  const clauses = [`pm_year eq ${Number(year)}`];
  if(only.month) clauses.push(`pm_month eq ${Number(only.month)}`);
  /* `in` is not dependable through this connector, so a KPI set goes as an
     or-chain. Left off entirely when no ids were asked for. */
  if(ids.length) clauses.push('(' + ids.map(id => `_pm_kpi_value eq ${id}`).join(' or ') + ')');
  const res = await Pm_kpiachievmentsService.getAll({
    select: ['pm_kpiachievmentid', '_pm_kpi_value', '_pm_businessunit_value',
             'stf_department', 'stf_function',
             'pm_month', 'pm_year', 'pm_actual', 'pm_target', 'pm_baseline', 'pm_historical'],
    filter: clauses.join(' and '),
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.pm_kpiachievmentid,
    kpiId: r._pm_kpi_value || null,
    businessUnitId: r._pm_businessunit_value || null,
    businessUnitName: r['_pm_businessunit_value' + FV] || null,
    department: r.stf_department || null,
    function: r.stf_function || null,
    month: r.pm_month ?? null,
    monthLabel: r['pm_month' + FV] || null,
    year: r.pm_year ?? null,
    actual: r.pm_actual ?? null,
    target: r.pm_target ?? null,
    baseline: r.pm_baseline ?? null,
    historical: r.pm_historical ?? null,
  }));
}

const Stf_kpiachievmentbreakdownsService =
  dvTable('stf_kpiachievmentbreakdowns', 'stf_kpiachievmentbreakdownid', PIN_ORG);

/* ⚠️ stf_breakdowntype is NOT SECTION_BREAKDOWN_DIM. Only "Account" shares a
   code; everything else is offset, so passing the citation's own code through
   would return the wrong dimension's rows while looking entirely correct.
   Mapped by name, deliberately. */
const BREAKDOWN_TYPE_BY_DIM = {
  'Account': 1, 'Physician': 2, 'Department': 3, 'Platform': 4,
  'Employee': 5, 'Speciality': 6, 'Payment Type': 7,
};

/* A breakdown names its member through whichever of these applies to its
   dimension; the rest are null on that row. Read as formatted values, so one
   pass over the list finds the name without needing to know the dimension.
   stf_paymenttype is a CHOICE, not a lookup, so it is handled separately. */
const BREAKDOWN_MEMBER_FIELDS = [
  '_stf_specialty_value', '_stf_physician_value', '_stf_account_value',
  '_stf_subaccount_value', '_stf_employee_value', '_stf_platform_value',
  '_stf_department_value', '_pm_function_value', '_pm_servicecategory_value',
];

/** The members behind one Breakdown citation, with their figures.
 *
 *  `achievementId` is the pm_kpiachievments row pickAchievement() already
 *  settled on, which is what fixes Department / Function / Month / Year /
 *  Business Unit -- the breakdowns hang off it through stf_total.
 *
 *  ⚠️ The table holds over 50,000 rows in IT, so this ALWAYS filters on the
 *  parent and the dimension. Never read it unfiltered.
 *
 *  -> [{ id, member, actual, target, baseline, historical }], biggest first
 */
export async function fetchKpiBreakdowns(achievementId, dimension){
  const type = BREAKDOWN_TYPE_BY_DIM[dimension];
  if(!achievementId || !type) return [];
  const res = await Stf_kpiachievmentbreakdownsService.getAll({
    select: ['stf_kpiachievmentbreakdownid', 'stf_name', 'stf_breakdowntype',
             'stf_value', 'stf_baseline', 'comp_breakdowntarget', 'stf_historical',
             'stf_paymenttype', ...BREAKDOWN_MEMBER_FIELDS],
    /* statecode 0 = Active. An inactive breakdown is a withdrawn row, and
       including it double-counts a member -- live 26 Sep there is exactly one
       in IT, and it sits in the only achievement that carries targets. */
    filter: `_stf_total_value eq ${achievementId} and stf_breakdowntype eq ${type}`
          + ' and statecode eq 0',
  });
  return (res?.data ?? [])
    .map(r => ({
      id: r.stf_kpiachievmentbreakdownid,
      member: BREAKDOWN_MEMBER_FIELDS.map(f => r[f + FV]).find(Boolean)
           || r['stf_paymenttype' + FV]
           /* stf_name is an auto-number (BRK-115983), not a member name --
              only worth showing when every lookup on the row is empty. */
           || r.stf_name || '(unnamed member)',
      actual: r.stf_value ?? null,
      target: r.comp_breakdowntarget ?? null,
      baseline: r.stf_baseline ?? null,
      historical: r.stf_historical ?? null,
    }))
    .sort((a, b) => (b.actual ?? -Infinity) - (a.actual ?? -Infinity));
}

/* ⚠️ "All Departments" is a real row in cr603_chklst_departments (one row,
   live 27 Sep) and it means the OPPOSITE of a department: the report covers
   every one of them. Matched as a plain name it is a Department like any
   other, so it was compared against the achievement's own "Medical",
   "Contact Center" and so on, disagreed with all of them, and every row was
   rejected -- an All-Departments report showed no figures at all, not merely
   no Target.

   Detected by NAME, not by id: the id differs between IT and DT New, as every
   id does, and this has to hold in both. There is no "All Functions" row --
   checked; selecting All Departments releases the Function too, because a
   report covering every department is not scoped to one department's
   function either. */
export const ALL_DEPARTMENTS_NAME = 'All Departments';
export const isAllDepartments = name =>
  String(name || '').trim().toLowerCase() === ALL_DEPARTMENTS_NAME.toLowerCase();

/** The scope one report matches achievement rows with.
 *
 *  Built in one place because three screens need the identical answer, and
 *  they have disagreed about achievement scope twice already.
 *
 *  -> { businessUnitId, departmentName, functionName, allDepartments }
 *     with Department and Function released to null for an All-Departments
 *     report, so it matches on Business Unit and Period alone and every
 *     department's and function's row qualifies.
 */
export function reportAchievementScope({ businessUnitId, departmentName, functionName } = {}){
  const all = isAllDepartments(departmentName);
  return {
    businessUnitId: businessUnitId || null,
    departmentName: all ? null : (departmentName || null),
    functionName:   all ? null : (functionName || null),
    allDepartments: all,
  };
}

/* The three scope dimensions an achievement row can be recorded against.
   Period is NOT among them: fetchKpiAchievements() already filters pm_year and
   pm_month server-side, so every row reaching here is the right month. */
const ACH_SAME = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const ACH_SET = v => v !== null && v !== undefined && String(v).trim() !== '';

/** Every achievement row that could serve a scope, best first.
 *
 *  ⚠️ A dimension only DISQUALIFIES a row when BOTH sides name it and they
 *  disagree. The earlier rule -- reject a row whose Function the report does
 *  not also name -- matched nothing at all in practice: 1,051 of IT's 1,055
 *  achievement rows carry a Function (26 Sep), so any report without one found
 *  no achievement, and every figure including the Target read as "not
 *  recorded" when the real cause was the report leaving Function blank.
 *
 *  Ranking, per dimension: an agreed value is worth most; a row that leaves
 *  the dimension blank is the "applies to any" row and comes next; a row
 *  naming a dimension the report does NOT constrain is still eligible but
 *  ranks last, because choosing between several such rows is a guess.
 *
 *  -> { row, candidates, ambiguousOn }  ambiguousOn lists the dimensions on
 *     which equally-ranked rows disagree, so a caller can say so rather than
 *     presenting one row's figure as though it were the only one.
 */
export function matchAchievement(rows, { businessUnitId, departmentName, functionName }){
  const dims = [
    ['Business Unit', r => r.businessUnitId, businessUnitId, (a, b) => a === b],
    ['Department',    r => r.department,     departmentName, ACH_SAME],
    ['Function',      r => r.function,       functionName,   ACH_SAME],
  ];

  const fits = r => dims.every(([, get, want, eq]) => {
    const have = get(r);
    return !(ACH_SET(have) && ACH_SET(want) && !eq(have, want));
  });

  const score = r => dims.reduce((n, [, get, want, eq]) => {
    const have = get(r);
    if(ACH_SET(have) && ACH_SET(want)) return n + (eq(have, want) ? 4 : 0);
    if(!ACH_SET(have) && ACH_SET(want)) return n + 2;   // applies to any
    if(ACH_SET(have) && !ACH_SET(want)) return n + 0;   // report unconstrained
    return n + 1;                                       // neither names it
  }, 0);

  /* Sorted by score, then by id so repeated reads of the same data agree --
     an export run twice must not pick a different row. */
  const candidates = (rows || []).filter(fits)
    .sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));

  const row = candidates[0] || null;
  const top = row ? candidates.filter(r => score(r) === score(row)) : [];
  const ambiguousOn = row
    ? dims.filter(([, get, want]) =>
        !ACH_SET(want) && new Set(top.map(r => String(get(r) ?? ''))).size > 1)
        .map(([label]) => label)
    : [];

  return { row, candidates, ambiguousOn };
}

/** The one achievement row that best fits a scope, or null.
 *  Thin wrapper over matchAchievement() for callers that only want the row. */
export function pickAchievement(rows, scope){
  return matchAchievement(rows, scope).row;
}

/* The fields of one Attendee row, whichever kind it is.

   A Position attendee binds lm_AttendeePosition and leaves lm_attendeename to
   the Position behind the lookup. A GROUP attendee has no Position at all: it
   binds lm_MicrosoftGroup instead, sets lm_isgroup, and carries the group name
   in lm_attendeename, since and_microsoftgroupmembers holds one row per
   (group, member) pair and the bound row's own name is a person's.

   lm_attendeetype is the Core/Supportive choice -- 1 Core, 2 Supportive, read
   from live metadata. It is NOT always Core; the card offers both and the
   quorum percentage counts only the Core ones. */
const attendeeFields = a => a.groupRowId
  ? { lm_attendeename: a.groupName || undefined,
      lm_isgroup: true,
      'lm_MicrosoftGroup@odata.bind': `/and_microsoftgroupmembers(${a.groupRowId})`,
      lm_attendeetype: a.type || 1 }
  : { 'lm_AttendeePosition@odata.bind': `/cr603_organizationstructures(${a.positionId})`,
      lm_isgroup: false,
      lm_attendeetype: a.type || 1 };

/* One Attendee's identity within its unit, for the reconcile diff. A group and
   a Position can never collide: the group key is prefixed. */
const attendeeKey = a => a.groupRowId ? 'g:' + a.groupRowId
                       : a.positionId ? 'p:' + a.positionId
                       : null;
const attendeeKeyOfRow = r => r._lm_microsoftgroup_value
  ? 'g:' + r._lm_microsoftgroup_value
  : r._lm_attendeeposition_value ? 'p:' + r._lm_attendeeposition_value : null;

/* Columns every Attendee read needs -- the two kinds are told apart by
   _lm_microsoftgroup_value, so leaving it out would read every group row back
   as an attendee with no Position. */
const ATTENDEE_SELECT = ['lm_meetingattendeeslistid', '_lm_attendeeposition_value',
                         'lm_attendeetype', 'lm_isgroup', '_lm_microsoftgroup_value',
                         'lm_attendeename'];

// Same reasoning as the Report Template maps above: explicit, not
// auto-matched, since Dataverse's labels differ slightly (trailing
// spaces, "Online" vs "Virtual", non-sequential option codes, etc.).
const MEETING_FREQUENCY_KEY = {
  'Daily':1, 'Twice Weekly':2, 'Weekly':3, 'Twice Monthly':4, 'Monthly':5,
  'Quarterly':6, 'Semesterly':7, 'Annually':8, 'Custom':9,
};
const MEETING_DAY_OF_WEEK_KEY = { 'Sunday':124330000, 'Monday':124330001, 'Tuesday':124330002, 'Wednesday':124330003, 'Thursday':124330004 };
const MEETING_MONTH_IN_QUARTER_KEY = { '1st month':124330000, '2nd month':124330001, '3rd month':124330002 };
/* Added 08 Sep with lm_seconddayoftheweek / lm_seconddayofthemonth /
   lm_monthofthesemesterseme.

   ⚠️ The second day of the week is 1..5, NOT 124330000-based like
   lm_daysoftheweek directly above it. Two columns on the same table, holding
   the same five weekdays, on two different scales -- so the two cannot share a
   map, and anything reading them has to know which is which. The semester
   month is likewise a plain 1..6, matching the Report table's
   lm_monthofthesemester rather than the Meeting table's own quarter column. */
const MEETING_SECOND_DAY_OF_WEEK_KEY = { 'Sunday':1, 'Monday':2, 'Tuesday':3, 'Wednesday':4, 'Thursday':5 };

/* lm_dayofweeks -- a multi-select Choices column added 23 Sep to BOTH
   lm_report_templates and lm_meetingtemplates, same codes on each (confirmed
   via a fresh pac modelbuilder pull, not assumed -- see the note on
   lm_daysofmonth's real shape below). Per explicit instruction, this is a
   genuinely separate, parallel way of naming which day(s) a Weekly or Twice
   Weekly Setup runs on -- an alternative to the single lm_dayoftheweek pick
   above, not a replacement for it. The wizard offers a toggle between the
   two; whichever is inactive is cleared, so only one is ever actually
   written.

   ⚠️ The column is bound to the org's "Days of Month" global choice set
   (lm_daysofmonth, values 1..31, codes 124330000-based), not a weekday list
   -- confirmed live 23 Sep. This is NOT a mistake to route around: the
   numbers themselves are what gets chosen (up to 4 for Weekly, 8 for Twice
   Weekly), not weekday names. Dataverse's own labels for this column ARE
   the plain numbers 1..31, so there is nothing to relabel. */
const DAY_OF_WEEKS_MULTI_KEY = {};
const DAY_OF_WEEKS_MULTI = {};
for (let n = 1; n <= 31; n++) {
  DAY_OF_WEEKS_MULTI_KEY[n] = 124330000 + (n - 1);
  DAY_OF_WEEKS_MULTI[124330000 + (n - 1)] = n;
}
export const DAY_OF_WEEKS_CAP = freq => (freq === 'Twice Weekly' ? 8 : 4);

/* A multi-select Choices column's read shape through this connector has
   never been exercised in this app before now -- everything else that reads
   a multi-select (cr603_application_tag on businessunit, 23 Sep) only ever
   read its FormattedValue annotation, never the raw attribute. Documented
   Dataverse Web API behaviour is a plain array of the option-set integers;
   accepting a comma-separated string too costs nothing and covers the one
   other shape a connector could plausibly hand back. ⚠️ Not yet confirmed
   against a real save -- see the note on the write side in
   reportTemplateParentPayload()/meetingTemplateParentPayload(). */
function parseMultiChoice(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter(n => !Number.isNaN(n));
  if (typeof raw === 'string') {
    return raw.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
  }
  return [];
}
/** lm_dayofweeks, whichever raw shape it came back as, decoded to the plain
 *  1..31 numbers the wizard's picker and the Setup's own dayOfWeeks field
 *  both use directly. */
export function decodeDayOfWeeksMulti(raw) {
  return parseMultiChoice(raw).map(code => DAY_OF_WEEKS_MULTI[code]).filter(n => n != null);
}
const MEETING_MONTH_IN_SEMESTER_KEY = { '1st month':1, '2nd month':2, '3rd month':3,
                                        '4th month':4, '5th month':5, '6th month':6 };
const MEETING_CONFIDENTIALITY_KEY = { 'Public':124330000, 'Internal':124330001, 'Confidential':124330002, 'High Confidential':124330003, 'Restricted':124330004 };
const MEETING_MODE_KEY = { 'Physical':1, 'Virtual':2, 'Hybrid':3 };
const MEETING_SETUP_TYPE_KEY = { 'Business Meeting':1, 'Accreditation Committee':2 };
/** The governed Category list -- one row per (Stage, Classification, Category).
 *  Reference data owned by the Taxonomy application: this module only reads it,
 *  and a new Category is a row there, never a change here.
 *
 *  Inactive rows are left out so a retired Category stops being offered, while
 *  Setups already pointing at one keep resolving it (nothing is hard-deleted).
 *  lm_stage and lm_typeclassification are the same global option sets the
 *  Meeting Template uses, so their codes need no translation between the two. */
export async function fetchMeetingCategories(){
  const res = await Lm_meetingcategoriesService.getAll({
    select: ['lm_meetingcategoryid','lm_name','lm_stage','lm_typeclassification',
             'lm_labelpattern','lm_regionchip','lm_requiresspecialty','lm_sortorder'],
    filter: 'statecode eq 0',
    orderby: 'lm_sortorder asc,lm_name asc',
  });
  return (res?.data ?? []).map(r => ({
    id: r.lm_meetingcategoryid,
    name: r.lm_name || '(unnamed)',
    stageCode: r.lm_stage ?? null,
    typeCode: r.lm_typeclassification ?? null,
    labelPattern: r.lm_labelpattern || null,
    regionChip: r.lm_regionchip || null,
    requiresSpecialty: r.lm_requiresspecialty === true,
    sortOrder: r.lm_sortorder ?? null,
  }));
}



/** Sections / Specialties -- table cr301_specialtyksa_service_hubs.
 *  Links directly to Business Unit (cr301_BusinessUnit), not Department --
 *  the app's Section/Specialty cascade now reflects that (BU -> Specialty). */
export async function fetchSections(){
  const res = await Cr301_specialtyksa_service_hubsService.getAll({
    select: ['cr301_specialtyksa_service_hubid', 'cr301_title', '_cr301_businessunit_value'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.cr301_specialtyksa_service_hubid,
    name: r.cr301_title,
    bu: r._cr301_businessunit_value ?? null,
  }));
}

/** Positions -- table cr603_organizationstructures ("Organization Structure").
 *  Each row is a concrete Position assignment (Position + Business Unit +
 *  Department + Function + the employee currently holding it), not a bare
 *  Position record, so this is used as-is: one selectable row per real
 *  assignment. cr603_name is the table's real, required primary-name
 *  column, used as the display name -- cr603_positionname was tried
 *  first but is a synthetic lookup-display field, not a real column, and
 *  Dataverse rejects selecting it directly. bu/dept/fn below are the raw
 *  lookup GUIDs (Business Unit, Department, Function), used for the
 *  Governed List filter and cascade matching elsewhere in the app. */
/** Resolves cr603_organizationstructures' hr_CurrentEmployee lookup to a
 *  real name via the systemusers table. Kept as a fallback behind the
 *  Employees-based resolution below, in case a Position's current
 *  employee isn't in hr_employees for some reason. Fetches every user
 *  once and builds an id->fullname map rather than querying per-position,
 *  since the SDK's select doesn't support server-side joins across
 *  tables. */
async function fetchUserNameMap(){
  try{
    const res = await SystemusersService.getAll({ select: ['systemuserid', 'fullname'] });
    const rows = res?.data ?? [];
    const map = {};
    rows.forEach(u => { if(u.systemuserid) map[u.systemuserid] = u.fullname || null; });
    return map;
  }catch(e){
    console.warn('[dataverse] fetchUserNameMap() failed -- falling back to hr_employees only:', e);
    return {};
  }
}

/** Employees, read once from hr_employees and indexed two ways.
 *
 *  A Position dropdown names the POSITION; the person shown under it is
 *  whoever currently holds it -- read straight off the Organization
 *  Structure row's own hr_fullnameofcurrentemployee column now (see
 *  fetchPositions()), so byEmployeeId/byPositionId below are a fallback
 *  for that column only, not the primary route any more. They stay the
 *  primary (only) route for holderUserId, which has no equivalent column
 *  to read directly -- Organization Structure names its holder, not their
 *  systemuserid.
 *
 *   - byEmployeeId   -- the forward path. The Organization Structure row names
 *                       its Current Employee (hr_CurrentEmployee), and that id
 *                       is looked up here.
 *   - byPositionId   -- the reverse path, kept as a backstop. Every Employee
 *                       carries a required lookup back to the Position it holds
 *                       (cr603_OrganizationStructure), so a Position whose
 *                       Current Employee is blank can still be resolved.
 *
 *  hr_User is a further lookup, Employee -> systemusers -- titled plainly
 *  "User" in Dataverse, target unconfirmed by pac modelbuilder (no CLI
 *  access from here), but systemusers is the only real candidate for a
 *  field with that name and shape. byEmployeeIdUser/byPositionIdUser mirror
 *  the two name indexes above, but resolve to a systemuserid instead of a
 *  display string -- what "is this Position mine" needs to compare against
 *  the signed-in user's own systemUserId (fetchCurrentUser()) by id, not by
 *  matching text.
 *
 *  hr_fullname is a read-only calculated column and Dataverse rejects some such
 *  fields in a plain $select, so the name is composed from the writable parts. */
async function fetchEmployeeIndex(){
  try{
    const res = await Hr_employeesService.getAll({
      select: ['hr_employeeid', '_cr603_organizationstructure_value', '_hr_user_value',
               'hr_firstname', 'hr_secondname', 'hr_lastname'],
    });
    const rows = res?.data ?? [];
    const byEmployeeId = {}, byPositionId = {}, byEmployeeIdUser = {}, byPositionIdUser = {};
    rows.forEach(e => {
      const name = [e.hr_firstname, e.hr_secondname, e.hr_lastname].filter(Boolean).join(' ').trim();
      const userId = e._hr_user_value || null;
      const posId = e._cr603_organizationstructure_value;
      if(e.hr_employeeid){
        if(name)   byEmployeeId[e.hr_employeeid] = name;
        if(userId) byEmployeeIdUser[e.hr_employeeid] = userId;
      }
      if(posId){
        if(name   && !byPositionId[posId])     byPositionId[posId] = name;
        if(userId && !byPositionIdUser[posId]) byPositionIdUser[posId] = userId;
      }
    });
    return { byEmployeeId, byPositionId, byEmployeeIdUser, byPositionIdUser };
  }catch(e){
    console.warn('[dataverse] fetchEmployeeIndex() failed -- Position holders will be unresolved:', e);
    return { byEmployeeId:{}, byPositionId:{}, byEmployeeIdUser:{}, byPositionIdUser:{} };
  }
}

export async function fetchPositions(){
  const [posRes, employees, userMap] = await Promise.all([
    Cr603_organizationstructuresService.getAll({
      select: [
        'cr603_organizationstructureid', 'cr603_name', '_cr603_businessunit_value',
        '_cr18c_departments_lkp_value', '_hr_funtion_value', '_hr_currentemployee_value',
        'hr_fullnameofcurrentemployee',
      ],
    }),
    fetchEmployeeIndex(),
    fetchUserNameMap(),
  ]);
  const rows = posRes?.data ?? [];
  return rows.map(r => {
    const posId = r.cr603_organizationstructureid;
    const currentEmployeeId = r._hr_currentemployee_value;
    /* The Organization Structure row names its own holder directly --
       hr_fullnameofcurrentemployee, a real (read-only) StringType column,
       not a synthetic lookup-display field Dataverse would reject on
       $select (unlike cr603_positionname, see the note above). Per an
       explicit ask, this is now the primary source. The old three-route
       resolution through hr_employees/systemusers stays as a fallback only
       for a row where that column itself is blank -- fetchEmployeeIndex()/
       fetchUserNameMap() are still called regardless, since holderUserId
       below still depends on them. */
    const holder =
         r.hr_fullnameofcurrentemployee
      || (currentEmployeeId && employees.byEmployeeId[currentEmployeeId])
      || (currentEmployeeId && userMap[currentEmployeeId])
      || employees.byPositionId[posId]
      || null;
    /* Same three routes, but landing on a systemuserid instead of a name --
       route 2 doesn't need a further lookup: if userMap already resolved
       currentEmployeeId as a systemuser, that id IS the systemuserid. */
    const holderUserId =
         (currentEmployeeId && employees.byEmployeeIdUser[currentEmployeeId])
      || (currentEmployeeId && userMap[currentEmployeeId] ? currentEmployeeId : null)
      || employees.byPositionIdUser[posId]
      || null;
    return {
      id: posId,
      name: r.cr603_name,
      bu: r._cr603_businessunit_value ?? null,
      dept: r._cr18c_departments_lkp_value ?? null,
      fn: r._hr_funtion_value ?? null,
      holder,
      holderUserId,
    };
  });
}

/* ---- reference data reads (not wired yet) -------------------------------- */

function notWiredYet(name){
  throw new Error(
    `[dataverse] ${name}() is not wired to a real table yet. `+
    `Run "pac code add-data-source" for the relevant table, then `+
    `fill in this function in src/services/dataverse.js.`
  );
}

export async function fetchSetups(){ return notWiredYet('fetchSetups'); }

/** Teams and Channels -- table and_teamschannellinks (22 Sep, replaces
 *  and_teamschannels). One row per CHANNEL; the Team it belongs to is
 *  and_teamname, a plain text column rather than a lookup to a Teams table
 *  (there is still no Teams table -- a "Team" exists only as the name
 *  repeated across its channels' rows, same limitation the old table had).
 *  So the app derives its Team list from the distinct and_teamname values,
 *  and a Team's channels are the rows carrying that exact name.
 *
 *  and_teamobjectid / and_channelobjectid (the real Microsoft Teams/Graph
 *  object ids) are read live but not used yet -- nothing in the app
 *  currently needs them, kept for whoever wires the next step.
 *
 *  Consequence worth knowing: a Team here still has no Business Unit or
 *  Region relationship, so Teams can't be narrowed to the unit a Setup runs
 *  in -- every unit is offered every Team, same as before.
 *
 *  The channel's document location is and_rootpath ALONE -- checked against
 *  IT's 288 live rows on 28 Sep, after the first mapping (inferred from
 *  column names) turned out wrong:
 *
 *    and_rootpath        "/sites/StrategicHR/Shared Documents/General" --
 *                        site, library AND folder in one server-relative path
 *                        (285 of 288 rows; the other 3 have no location)
 *    and_rootfolder      "General" -- the DISPLAY name of the path's last
 *                        folder, not a further part of it: "Documents" when
 *                        the channel sits at the library root, and on one row
 *                        "General Central HR" for a path ending ".../General".
 *    and_documentlibrary empty on all 288 rows.
 *
 *  The old mapping joined rootpath + rootfolder, so every auto-filled Report
 *  destination got a bogus extra folder: ".../General/General",
 *  ".../Shared Documents/Documents" -- 50 of the 53 saved on
 *  lm_report_templates as of 28 Sep (the other 3 were typed by hand). So site / library / folder are now split
 *  out of and_rootpath ("/sites/X", "Shared Documents", "General"), which
 *  channelPath() in GovernanceApp.jsx rejoins into exactly that path and the
 *  destination cascade lists as three real levels. and_sharepointsitelink and
 *  and_rootfolderlink carry the same location as absolute URLs, read for
 *  whoever needs a clickable link. */
export async function fetchTeamsChannels(){
  const res = await And_teamschannellinksService.getAll({
    select: ['and_teamschannellinkid','and_channelname','and_channellink','and_teamname',
             'and_teamobjectid','and_channelobjectid',
             'and_rootpath','and_sharepointsitelink','and_rootfolderlink'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => {
    /* "/sites/X/Shared Documents/A/B" -> ["sites","X","Shared Documents","A","B"].
       A path that is not "/sites|teams/<name>/<library>..." keeps the whole
       thing as its site, so nothing is silently dropped. */
    const seg = String(r.and_rootpath || '').split('/').map(s => s.trim()).filter(Boolean);
    const std = seg.length >= 3 && /^(sites|teams)$/i.test(seg[0]);
    return {
      id: r.and_teamschannellinkid,
      name: r.and_channelname || '(unnamed channel)',
      link: r.and_channellink ?? null,
      team: (r.and_teamname || '').trim() || null,
      sitePath: std ? '/' + seg[0] + '/' + seg[1] : (seg.length ? '/' + seg.join('/') : null),
      library:  std ? seg[2] : null,
      folder:   std && seg.length > 3 ? seg.slice(3).join('/') : null,
      siteLink: r.and_sharepointsitelink ?? null,
      folderLink: r.and_rootfolderlink ?? null,
      /* Microsoft Teams ids -- what a channel post needs (05 Oct). */
      teamObjectId: r.and_teamobjectid || null,
      channelObjectId: r.and_channelobjectid || null,
    };
  });
}

/** A channel's document path, from one fetchTeamsChannels() row: site,
 *  library and folder joined without the leading slash, e.g.
 *  "sites/StrategicHR/Shared Documents/General" -- the same string
 *  channelPath() in GovernanceApp.jsx builds for a Report Template's
 *  lm_destinationsharepointlink, so a report and its template agree. */
export function channelDestinationPath(c){
  if(!c) return '';
  return [c.sitePath, c.library, c.folder]
    .map(x => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .map(x => x.replace(/^\/+|\/+$/g, ''))
    .join('/');
}

/** Microsoft Group membership -- and_microsoftgroupmembers, one row per
 *  (group, member) pair. Both and_groupname and and_member are plain text,
 *  not lookups -- there is no separate "groups" table, so the same group
 *  name repeats across every one of its members' rows. The caller derives
 *  the distinct group list itself; this just returns every row. */
export async function fetchMicrosoftGroupMembers(){
  const res = await And_microsoftgroupmembersService.getAll({
    select: ['and_microsoftgroupmemberid','and_groupname','and_member'],
  });
  const rows = res?.data ?? [];
  return rows
    .map(r => ({ id: r.and_microsoftgroupmemberid, group: r.and_groupname || null, member: r.and_member || null }))
    .filter(r => r.group && r.member);
}

/* =========================================================================
   Who is signed in
   ========================================================================= *
   Two halves, deliberately separate:

   1. The HOST tells us who the user is -- getContext() from the Power Apps
      SDK returns the Entra (Azure AD) identity the app is running as:
      fullName, objectId, userPrincipalName. This works even if the user
      has no Dataverse systemuser row at all.

   2. That identity is then matched to a real `systemusers` row, which is
      what the rest of Dataverse actually references. Matched on
      azureactivedirectoryobjectid first (the exact, stable link between an
      Entra identity and its Dataverse user), falling back to comparing the
      UPN against internalemailaddress/domainname for environments where
      the AAD object id column isn't populated.

   Every step degrades rather than throws: running under plain `npm run dev`
   (no Power Apps host) gives no context, and a user with no matching
   systemuser row still gets their host identity back with systemUserId
   null. Callers just show what they got. */

/** The Entra identity the app is running as, straight from the host.
 *  Returns null when there's no Power Apps host (e.g. plain `vite dev`).
 *
 *  On a fresh embed, the host's own handshake (and its identity/auth
 *  resolution behind it) can still be in flight the instant this app's first
 *  script runs -- getContext() can come back with no usable identity before
 *  the host has caught up. Left as a single attempt, that's exactly what
 *  produced the "works after a manual reload" symptom: nothing here ever
 *  asked again. Retried a few times with a short backoff instead, so the
 *  caller gets the real identity within a couple of seconds of the app
 *  opening rather than needing a reload to get a second attempt. */
async function fetchHostUserContext(){
  let getContext;
  try{
    ({ getContext } = await import('@microsoft/power-apps/app'));
  }catch(e){
    // The SDK itself isn't there at all -- e.g. plain `npm run dev` with no
    // Power Apps host. Nothing to retry.
    console.warn('[dataverse] @microsoft/power-apps unavailable -- no Power Apps host?', e);
    return null;
  }

  const attempts = 5;
  for(let attempt=0; attempt<attempts; attempt++){
    try{
      const ctx = await getContext();
      const user = ctx?.user;
      if(user && (user.fullName || user.userPrincipalName || user.objectId)) return user;
    }catch(e){
      console.warn(`[dataverse] getContext() failed on attempt ${attempt+1}/${attempts}:`, e);
    }
    if(attempt < attempts-1) await new Promise(r=>setTimeout(r, 400*(attempt+1)));
  }
  return null;
}

/** Looks up the `systemusers` row for an Entra identity. Returns null if
 *  nothing matches (a perfectly normal case -- not every signed-in user has
 *  a Dataverse user record). */
async function fetchSystemUserFor({ objectId, userPrincipalName }){
  const select = ['systemuserid','fullname','internalemailaddress','domainname','azureactivedirectoryobjectid'];

  if(objectId){
    try{
      const res = await SystemusersService.getAll({
        filter: `azureactivedirectoryobjectid eq ${objectId}`, select,
      });
      const hit = (res?.data ?? [])[0];
      if(hit) return hit;
    }catch(e){
      console.warn('[dataverse] systemusers lookup by azureactivedirectoryobjectid failed, trying email:', e);
    }
  }

  if(userPrincipalName){
    // Single-quotes are escaped by doubling them in OData, so an apostrophe
    // in an address can't break out of the literal.
    const upn = String(userPrincipalName).replace(/'/g, "''");
    try{
      const res = await SystemusersService.getAll({
        filter: `internalemailaddress eq '${upn}' or domainname eq '${upn}'`, select,
      });
      const hit = (res?.data ?? [])[0];
      if(hit) return hit;
    }catch(e){
      console.warn('[dataverse] systemusers lookup by email/domainname failed:', e);
    }
  }

  return null;
}

/**
 * The signed-in user, linked to their Dataverse `systemusers` row.
 *
 * @returns {Promise<{fullName:string|null, email:string|null, azureObjectId:string|null,
 *                    systemUserId:string|null, linked:boolean}|null>}
 *          null only when there's no host context at all to identify anyone.
 *          `linked` is false when the identity is known but has no matching
 *          systemusers row.
 */
export async function fetchCurrentUser(){
  const host = await fetchHostUserContext();
  if(!host) return null;

  const sysUser = await fetchSystemUserFor(host);
  return {
    fullName: sysUser?.fullname || host.fullName || null,
    email: sysUser?.internalemailaddress || sysUser?.domainname || host.userPrincipalName || null,
    azureObjectId: host.objectId || null,
    systemUserId: sysUser?.systemuserid || null,
    linked: !!sysUser,
  };
}

/* =========================================================================
   Can the signed-in reader open a record in another IT app? (29 Sep)
   ========================================================================= *
   Used before recordLinks.js opens a cited KPI/Process/Project/Task/... in
   its model-driven app, so a reader without access is told so in this app
   instead of landing on Dataverse's own error page. Two checks, both run AS
   the reader (the connector reads with their permissions):

   1. The record -- a one-column read of it. Refused -> no access to that
      record (or its table). A "does not exist" answer is reported apart.
   2. The app -- a model-driven app opens for the security roles assigned to
      it (appmoduleroles). The reader's roles are their own
      (systemuserroles) plus their teams' (teammembership -> teamroles).
      ⚠️ Dataverse keeps one COPY of every role per business unit, each
      pointing at its root through role.parentrootroleid, and an app is
      assigned the root -- so each of the reader's roles is compared by its
      own id AND its root id.

   Neither check may stop a reader who does have access: when a check can't
   be run (the reader can't read the role tables, no linked user, a read
   fails), it answers "unknown" and the caller opens the link as before. The
   reader's roles are read once per session; each app's roles once. */
const AppmodulerolesService  = dvTable('appmodulerolescollection', 'appmoduleroleid', PIN_ORG);
const SystemuserrolesService = dvTable('systemuserrolescollection', 'systemuserroleid', PIN_ORG);
const TeammembershipsService = dvTable('teammemberships', 'teammembershipid', PIN_ORG);
const TeamrolesService       = dvTable('teamrolescollection', 'teamroleid', PIN_ORG);
const RolesService           = dvTable('roles', 'roleid', PIN_ORG);

const orFilter = (field, ids) => ids.map(id => `${field} eq ${id}`).join(' or ');
async function getAllChunked(service, field, ids, select){
  const out = [];
  for(let i = 0; i < ids.length; i += 15){
    const res = await service.getAll({ filter: orFilter(field, ids.slice(i, i + 15)), select });
    assertSuccess(res);
    out.push(...(res.data ?? []));
  }
  return out;
}

let myRoleIdsPromise = null;   // Set of role ids AND their root ids, or null when unknown
async function readMyRoleIds(){
  const me = await fetchCurrentUser();
  if(!me?.systemUserId) return null;
  const own = await SystemuserrolesService.getAll({
    filter: `systemuserid eq ${me.systemUserId}`, select: ['roleid'] });
  assertSuccess(own);
  const teams = await TeammembershipsService.getAll({
    filter: `systemuserid eq ${me.systemUserId}`, select: ['teamid'] });
  assertSuccess(teams);
  const teamIds = [...new Set((teams.data ?? []).map(t => t.teamid).filter(Boolean))];
  const teamRoles = teamIds.length ? await getAllChunked(TeamrolesService, 'teamid', teamIds, ['roleid']) : [];
  const roleIds = [...new Set([...(own.data ?? []), ...teamRoles].map(r => r.roleid).filter(Boolean))];
  const roles = roleIds.length ? await getAllChunked(RolesService, 'roleid', roleIds, ['roleid', '_parentrootroleid_value']) : [];
  const ids = new Set(roleIds);
  for(const r of roles) if(r._parentrootroleid_value) ids.add(r._parentrootroleid_value);
  return ids;
}
function myRoleIds(){
  if(!myRoleIdsPromise)
    myRoleIdsPromise = readMyRoleIds().catch(e => {
      console.warn('[dataverse] reading the signed-in user\'s security roles failed:', e);
      myRoleIdsPromise = null;   // try again next time rather than caching the failure
      return null;
    });
  return myRoleIdsPromise;
}

const appRoleCache = new Map();   // appId -> Promise<Set<roleId>|null>
function appRoleIds(appId){
  if(!appRoleCache.has(appId))
    /* Both columns here are LOOKUPS (unlike the plain-GUID ids on
       systemuserroles/teamroles/teammembership), so they are read as
       _x_value -- a lookup selected by its plain name fails the read. */
    appRoleCache.set(appId, AppmodulerolesService.getAll({
        filter: `_appmoduleid_value eq ${appId}`, select: ['_roleid_value'] })
      .then(res => { assertSuccess(res); return new Set((res.data ?? []).map(r => r._roleid_value).filter(Boolean)); })
      .catch(e => {
        console.warn('[dataverse] reading the app\'s security roles failed:', e);
        appRoleCache.delete(appId);
        return null;
      }));
  return appRoleCache.get(appId);
}

/** -> { state: 'ok' | 'noRecord' | 'missing' | 'noApp' | 'unknown', error? }
 *  ok and unknown both mean "open it". */
export async function checkRecordAccess({ entitySet, pkField, id, appId }){
  try{
    const res = await dvTable(entitySet, pkField, PIN_ORG).get(id, { select: [pkField] });
    if(!res?.success){
      const msg = String(res?.error?.message || res?.error || '');
      return { state: /does not exist|not found|404/i.test(msg) ? 'missing' : 'noRecord', error: res?.error };
    }
  }catch(e){
    const msg = String(e?.message || e || '');
    return { state: /does not exist|not found|404/i.test(msg) ? 'missing' : 'noRecord', error: e };
  }
  if(!appId) return { state: 'ok' };
  const [mine, app] = await Promise.all([myRoleIds(), appRoleIds(appId)]);
  if(!mine || !app || !app.size) return { state: 'unknown' };
  for(const r of app) if(mine.has(r)) return { state: 'ok' };
  return { state: 'noApp' };
}

/* =========================================================================
   Report Template save -- lm_report_templates and its five child tables
   ========================================================================= *
   Status: WRITES THE PART THAT'S SAFELY RESOLVABLE. Two things are
   deliberately left out, not silently guessed at:

   1. lm_OwnerUser / lm_SubmittingUser / lm_ReviewerUser all expect a real
      Dataverse User (systemuser) lookup. The app's "Positions" (Owner
      Position, Submitting Position, the review chain) are plain mock
      data with a display name only -- no systemuser record behind them.
      Until Positions are connected to real users, these three lookups
      are left unset on every write. The review chain's *order* and the
      *position name* are still preserved as plain text (lm_step /
      lm_newcolumn on the child row) so the information isn't lost, it's
      just not a real user reference yet.

   2. lm_report_templates has ONE BusinessUnit/Speciality/TeamChannel per
      row, but the app's Setup can span many Business Units/regions (see
      "runs in N units" in the Setup Register). This first pass creates
      ONE Dataverse row per Setup, using the FIRST configured unit's
      Business Unit/Section for those three fields -- it does not create
      one row per unit. If every unit needs its own Dataverse row
      (matching its own Business Unit/Speciality/Owner/Submitter), that's
      a bigger structural change worth confirming before building.

   Everything else -- name, objective, type/category/frequency/day/month
   choices, confidentiality, destination link, the content checklist,
   the Department/Function scope lines, and the linked Processes/KPIs --
   is fully resolved against real ids and written correctly. */

/* The whole Report Template family -- the Template itself, its Business
   Unit/Region scope, its Sections/Section Items, its per-unit review chains
   and related KPIs/Processes/Departments (below) -- reads and writes
   IT_ORG always, independent of this app's own DATA_ORG. Per an explicit
   ask (22 Sep): Leadership's Reporting hierarchy "Report Templates" view
   (fetchReportTemplateHierarchyContent()) and its app-wide Template name
   lookup (fetchReportTemplatesList(), feeding BuildReport's picker and
   every screen naming a linked Template) now read the SAME Report
   Templates Governance Setup itself writes to in IT, rather than a
   DT New copy no longer being written to. Governance Setup's own DATA_ORG
   already equals IT_ORG, so this whole block is a no-op there -- see
   xenv.js's IT_ORG for the full rationale, same pattern as the Report
   Occurrence family a few sections down. */
const Lm_report_templatesService = dvTable('lm_report_templates', 'lm_report_templateid', PIN_ORG);
const Lm_reporttemplatebusinessunitsesService =
  dvTable('lm_reporttemplatebusinessunitses', 'lm_reporttemplatebusinessunitsid', PIN_ORG);
const Lm_reporttemplateregionsService = dvTable('lm_reporttemplateregions', 'lm_reporttemplateregionid', PIN_ORG);
const Lm_reporttemplatecontentchecklistsService =
  dvTable('lm_reporttemplatecontentchecklists', 'lm_reporttemplatecontentchecklistid', PIN_ORG);
const Lm_reporttemplatesectionitemsesService =
  dvTable('lm_reporttemplatesectionitemses', 'lm_reporttemplatesectionitemsid', PIN_ORG);

/* Report Template Section (Expected Content Checklist item) option sets.
   Mapped by CODE, not by label -- 'Physician ' carries a trailing space in the
   deployed option set, the same defect ATTENDEE_TYPE documents. */
export const SECTION_ANGLE = {
  1:'Untyped', 2:'Descriptive', 3:'Diagnostic', 4:'Predictive', 5:'Prescriptive',
};
export const SECTION_ANGLE_KEY = {
  'Untyped':1, 'Descriptive':2, 'Diagnostic':3, 'Predictive':4, 'Prescriptive':5,
};
export const SECTION_ITEM_TYPE = { 1:'KPI', 2:'Breakdown', 3:'Process', 4:'Child Template' };
export const SECTION_ITEM_TYPE_KEY = { 'KPI':1, 'Breakdown':2, 'Process':3, 'Child Template':4 };
export const SECTION_BREAKDOWN_DIM = {
  1:'Account', 2:'Payment Type', 3:'Physician', 4:'Department',
  5:'Platform', 6:'Employee', 7:'Speciality',
};
export const SECTION_BREAKDOWN_DIM_KEY = {
  'Account':1, 'Payment Type':2, 'Physician':3, 'Department':4,
  'Platform':5, 'Employee':6, 'Speciality':7,
};

/* Writes the citation items belonging to one Section (checklist row).
   Each item is its own row, which is what makes a Section able to carry any
   number of KPIs, Breakdowns, Processes, child Templates and (20 Sep) files
   at once. A Breakdown stores the KPI plus a dimension -- there is no column
   for a specific member, so the members resolve when the Report is actually
   built.

   A File item is a citation whose content is an uploaded file rather than a
   lookup -- lm_reporttemplatesectionitems gained its own lm_attachementfile
   File column (confirmed via `pac modelbuilder build -enf
   lm_reporttemplatesectionitems`, same shape as lm_report_templates'; see
   PROJECT-CONTEXT.md §6). lm_itemtype (lm_reportsectionitemtype) has ONLY
   four values -- KPI/Breakdown/Process/ChildTemplate, confirmed live, no
   File value exists -- so a File item writes lm_itemtype null (the ?? null
   fallback below already does this, since 'File' has no entry in
   SECTION_ITEM_TYPE_KEY) and is recognised on read purely by having content
   in lm_attachementfile. it.fileBase64 is populated by
   GovernanceApp.jsx's payload builder from a module-level pending-file map,
   NOT stored on the Setup itself -- same reasoning as the Report Template's
   own pending-file map, see PENDING_TEMPLATE_FILE there. */
async function createSectionItems(checklistId, items, errors){
  const bind = `/lm_reporttemplatecontentchecklists(${checklistId})`;
  for(const it of (items||[])){
    if(!it?.type) continue;
    let itemId = null;
    try{
      const row = {
        lm_sectionitemname: (it.label || it.type).slice(0,100),
        lm_itemtype: SECTION_ITEM_TYPE_KEY[it.type] ?? null,
        'lm_SectionChecklistItem@odata.bind': bind,
      };
      if(it.type==='KPI' && it.kpiId)
        row['lm_KPI@odata.bind'] = `/strategy_kpises(${it.kpiId})`;
      if(it.type==='Breakdown'){
        if(it.kpiId) row['lm_KPI@odata.bind'] = `/strategy_kpises(${it.kpiId})`;
        row.lm_breakdowndimension = SECTION_BREAKDOWN_DIM_KEY[it.dimension] ?? null;
      }
      if(it.type==='Process' && it.processId)
        row['lm_Process@odata.bind'] = `/strategy_processes(${it.processId})`;
      if(it.type==='Child Template' && it.childTemplateId)
        row['lm_ChildReportTemplate@odata.bind'] = `/lm_report_templates(${it.childTemplateId})`;
      const created = await Lm_reporttemplatesectionitemsesService.create(row);
      itemId = created?.data?.lm_reporttemplatesectionitemsid;
    }catch(e){ errors.push({ table:'lm_reporttemplatesectionitemses', error:e }); continue; }
    /* The row must exist before a File column has anything to attach content
       to -- same reason the parent Report Template's own upload is deferred
       until after its create/update resolves an id. Tagged with its own
       `what` and kept OUT of the try/catch above: the citation row itself
       already saved successfully by this point, so a failed upload here is
       "the file didn't attach", not "the row failed to save" -- lumping the
       two together under one generic table-name error hid exactly which
       part failed and why (see PROJECT-CONTEXT.md §5, 20 Sep). */
    if(it.type==='File' && it.fileBase64 && itemId){
      try{
        await uploadFileColumn('lm_reporttemplatesectionitemses', itemId, 'lm_attachementfile',
          it.fileName || 'file', it.fileBase64);
      }catch(e){
        errors.push({ table:'lm_reporttemplatesectionitemses', error:e,
          what:`file upload for "${it.fileName || 'file'}"` });
      }
    }
  }
}
/* Rest of the Report Template family -- see the comment above
   Lm_report_templatesService, same IT_ORG pin, same reason. */
const Lm_reporttemplatedepartmentfunctionsService =
  dvTable('lm_reporttemplatedepartmentfunctions', 'lm_reporttemplatedepartmentfunctionid', PIN_ORG);
const Lm_reporttemplaterelatedkpisesService =
  dvTable('lm_reporttemplaterelatedkpises', 'lm_reporttemplaterelatedkpisid', PIN_ORG);
const Lm_reporttemplaterelatedprocessesesService =
  dvTable('lm_reporttemplaterelatedprocesseses', 'lm_reporttemplaterelatedprocessesid', PIN_ORG);
const Lm_reporttemplatereviewchainsService =
  dvTable('lm_reporttemplatereviewchains', 'lm_reporttemplatereviewchainid', PIN_ORG);

// Dataverse choice fields take the numeric key, not the label, on write.
// These map the app's exact label strings to the real keys from the
// generated models -- built explicitly rather than by auto-matching
// labels, since a few differ slightly (trailing spaces, "Annually" vs
// "Annual", different capitalization on "1st Month" etc.).
const FREQUENCY_KEY = {
  'Daily':1, 'Twice Weekly':2, 'Weekly':3, 'Twice Monthly':4, 'Monthly':5,
  'Quarterly':6, 'Semesterly':7, 'Annually':8, 'Custom':9,
};
const DAY_OF_WEEK_KEY = { 'Sunday':1, 'Monday':2, 'Tuesday':3, 'Wednesday':4, 'Thursday':5 };
const MONTH_IN_QUARTER_KEY = { '1st month':1, '2nd month':2, '3rd month':3 };
/* lm_monthofthesemester runs 1..6 -- a semester is six months, so it needs its
   own map rather than reusing the quarter's 1..3. The second day of the week
   reuses DAY_OF_WEEK_KEY above: lm_seconddayoftheweek carries the same 1..5
   Sunday-to-Thursday codes as the first. */
const MONTH_IN_SEMESTER_KEY = { '1st month':1, '2nd month':2, '3rd month':3,
                                '4th month':4, '5th month':5, '6th month':6 };
/* lm_month is a plain 1..12 calendar month, used by an Annual cadence to say
   WHICH month the report is due in. Distinct from the quarter (1..3) and
   semester (1..6) fields, which say which month *within* their period. */
const MONTH_KEY = { 'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,
                    'July':7,'August':8,'September':9,'October':10,'November':11,'December':12 };
const CONFIDENTIALITY_KEY = { 'Public':1, 'Internal':2, 'Confidential':3, 'High Confidential':4, 'Restricted':5 };
// Both choice lists were REPLACED in Dataverse (15 Sep), not extended --
// codes read straight from live metadata via `pac modelbuilder build -enf
// lm_report_template`, the only route that actually returns an already-
// registered table's choice values (the cached schema file never inlines
// them; every add-data-source refresh route documented elsewhere in this
// file is a dead end for that). The old 3/4-value lists are gone.
// Code 3's real Dataverse label is "Report Conclusion" (the generated enum
// name, run together); displayed here as just "Report", on explicit
// instruction. Only the label is this app's own choice -- the code (3) is
// what actually gets written and has to stay the same.
const REPORT_TYPE_KEY = { 'Plan':1, 'Dashboard':2, 'Report':3 };
/* Global option set lm_submissiontiming, values read from live metadata. Only
   a Report/Conclusion carries one -- see SUBMISSION_TIMING's note in
   GovernanceApp.jsx. */
const SUBMISSION_TIMING_KEY = {
  'Submission within same Month':1, 'Submission After Month':2,
};
const REPORT_CATEGORY_KEY = { 'Executive':1, 'Core':2, 'ADHOC':3 };

// lm_reportstatus and lm_meetingstatus are both the same global option set
// ("Template Status"), so one map covers both tables' status field and both
// directions (label -> code for writes, code -> label for reads).
export const TEMPLATE_STATUS_KEY = { 'Under Review':1, 'Expired':2, 'Draft':3, 'Active / Approved':4 };
export const TEMPLATE_STATUS_LABEL = { 1:'Under Review', 2:'Expired', 3:'Draft', 4:'Active / Approved' };

// Builds the lm_report_templates parent field payload from the app's
// resolved-id payload shape. Shared by create and update: every field is
// explicit (null, never omitted) so that update() actually clears a field
// the user emptied out in the wizard, instead of silently leaving Dataverse's
// old value in place because an omitted key never reaches the PATCH body.
// Owner Position/Submitting Position/Team Channel/Speciality are normally
// per-unit (see the loop above) -- but a Stage 3/4 (group-wide) Setup has
// no per-unit child table, so its one "section" is payload.units[0], and
// these four now live on the parent row instead (added to
// lm_report_templates specifically to cover this case), same reasoning as
// meetingTemplateParentPayload()'s Chairman/Co-Chairman/Facilitator.
// Conditionally SET only, never explicitly cleared -- same as every other
// lookup written by this file.
function reportTemplateParentPayload(payload){
  const groupUnit = payload.stageLevel==='group' ? (payload.units||[])[0] : null;
  const row = {
    lm_newcolumn: payload.name || payload.objective || 'Untitled Report Template',
    lm_objective: payload.objective || null,
    lm_reporttype: payload.reportType ? REPORT_TYPE_KEY[payload.reportType] : null,
    lm_reportcategory: payload.reportCategory ? REPORT_CATEGORY_KEY[payload.reportCategory] : null,
    /* Null for Plan and Dashboard, which have no same-month/after-month
       question to answer -- the form clears it when Report Type changes. */
    lm_submissiontiming: payload.submissionTiming
      ? SUBMISSION_TIMING_KEY[payload.submissionTiming] : null,
    lm_frequency: payload.frequency ? FREQUENCY_KEY[payload.frequency] : null,
    ...reportScheduleColumns(payload),
    lm_confidentiality: payload.confidentiality ? CONFIDENTIALITY_KEY[payload.confidentiality] : null,
    lm_destinationsharepointlink: payload.destinationLink || null,
    lm_fileattachement: payload.fileAttachment || null,
    /* Stage is now a real column. It used to be inferred on read from whether
       the Template had Business Unit or Region child rows, which could not tell
       Stage 3 from Stage 4 -- both are group-wide -- so a Stage 4 Template came
       back as Stage 3 and was silently renamed on the next save. */
    lm_stage: REPORT_STAGE_KEY[payload.stage] ?? null,
    lm_reportstatus: payload.status ? TEMPLATE_STATUS_KEY[payload.status] : null,
    lm_version: typeof payload.version === 'number' ? payload.version : null,
  };
  if(groupUnit?.ownerPositionId)      row['lm_OwnerPosition@odata.bind']      = `/cr603_organizationstructures(${groupUnit.ownerPositionId})`;
  if(groupUnit?.submittingPositionId) row['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${groupUnit.submittingPositionId})`;
  if(groupUnit?.channelId)            row['lm_TeamChannel@odata.bind']        = `/and_teamschannellinks(${groupUnit.channelId})`;
  if(groupUnit?.specialityId)         row['lm_ReportSpecialty@odata.bind']    = `/cr301_specialtyksa_service_hubs(${groupUnit.specialityId})`;
  return row;
}

/* The submission-day columns. lm_report_templates carries them for the whole
   Setup; lm_reporttemplatebusinessunitses and lm_reporttemplateregions carry the
   same eight (added 29 Sep) for a Setup whose units submit on different days.
   Same logical names and the same choice codes on all three tables -- read from
   IT with `pac modelbuilder build` (the unit tables' second day of week is bound
   to lm_weekdays rather than lm_dayoftheweek, but both run Sunday=1..Thursday=5).
   Frequency is NOT here: it stays on the parent, shared by every unit. */
export const REPORT_SCHEDULE_COLS = ['lm_dayoftheweek','lm_dayofweeks','lm_dayofthemonth',
  'lm_monthofthequarter','lm_seconddayoftheweek','lm_seconddayofthemonth',
  'lm_monthofthesemester','lm_month'];

function reportScheduleColumns(payload){
  return {
    lm_dayoftheweek: payload.dayOfWeek ? DAY_OF_WEEK_KEY[payload.dayOfWeek] : null,
    /* The wizard keeps dayOfWeek/dayOfWeeks mutually exclusive (switching the
       toggle clears whichever just went inactive), so this can write straight
       from whatever payload.dayOfWeeks currently holds with no extra "which
       mode" logic here -- same reasoning FREQUENCY_KEY's neighbours already
       rely on for their own second-day/month fields.

       ⚠️ CONFIRMED live 23 Sep, the hard way: a plain array (the documented
       OData v4 shape) 400s outright -- "An unexpected 'StartArray' node was
       found when reading from the JSON reader. A 'PrimitiveValue' node was
       expected." This connector targets api/data/v9.1.0, which reads a
       multi-select Choices value as a single primitive: a comma-separated
       STRING of the option-set integers, e.g. "124330000,124330010". Never
       send an array here -- parseMultiChoice() on the read side already
       expected this and needs no change. */
    lm_dayofweeks: (payload.dayOfWeeks||[]).length
      ? payload.dayOfWeeks.map(n => DAY_OF_WEEKS_MULTI_KEY[n]).filter(n => n != null).join(',')
      : null,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : null,
    lm_monthofthequarter: payload.monthInQuarter ? MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : null,
    /* Twice Weekly and Twice Monthly carry a second day; Semesterly picks a
       month within its six. Each is only meaningful for its own frequency, and
       the form clears the others when Frequency changes, so a null here means
       "not applicable to this cadence" rather than "not filled in". */
    lm_seconddayoftheweek: payload.secondDayOfWeek ? DAY_OF_WEEK_KEY[payload.secondDayOfWeek] : null,
    lm_seconddayofthemonth: typeof payload.secondDayOfMonth === 'number' ? payload.secondDayOfMonth : null,
    lm_monthofthesemester: payload.monthInSemester ? MONTH_IN_SEMESTER_KEY[payload.monthInSemester] : null,
    lm_month: payload.month ? MONTH_KEY[payload.month] : null,
  };
}

/* A unit row's own submission day, or all nulls when the Setup submits on one
   shared day -- nulls, not omitted, so switching the toggle off clears what a
   unit row held instead of leaving a stale day behind. */
const unitScheduleColumns = unit => reportScheduleColumns(unit?.schedule || {});

/* The PATCH for a kept unit row: only the schedule columns that changed.
   lm_dayofweeks comes back as a comma-separated string whose order is not
   guaranteed, so it is compared as a sorted set. */
function unitScheduleDiff(unit, row){
  const want = unitScheduleColumns(unit);
  const norm = (col, v) => {
    if(v == null || v === '') return '';
    return col === 'lm_dayofweeks' ? String(v).split(',').map(x=>x.trim()).filter(Boolean).sort().join(',') : String(v);
  };
  const patch = {};
  for(const col of REPORT_SCHEDULE_COLS)
    if(norm(col, row[col]) !== norm(col, want[col])) patch[col] = want[col];
  return patch;
}

/** Deletes a batch of already-fetched rows by id, one service.delete() call
 *  per row, collecting failures into `errors` rather than throwing -- a
 *  single row that fails to delete shouldn't abort the whole reconcile. */
async function deleteRows(service, rows, idField, table, errors){
  for(const row of (rows||[])){
    const id = row?.[idField];
    if(!id) continue;
    try{ await service.delete(id); }
    catch(e){ errors.push({ table, error:e }); }
  }
}

/* =========================================================================
   Reconcile, instead of delete-and-recreate

   The update path used to delete EVERY child row and write them all back.
   Adding one Business Unit therefore rewrote all of them: every row got a new
   GUID and a reset createdon, and anything holding a reference to one -- an
   Attendees list bound to its Business Unit row, a Review Chain step bound to
   the same -- had to be torn down and rebuilt with it.

   reconcileRows() diffs instead. `keyOf` decides what makes two rows the same
   thing; rows present on both sides are KEPT (and patched only if a field
   actually changed), rows only in Dataverse are deleted, rows only in the
   Setup are created.

   It returns a Map of key -> row id covering BOTH kept and newly created rows,
   so children of those rows (attendees, review chain steps) can bind to a
   stable parent whether or not it is new.
   ========================================================================= */
async function reconcileRows({ service, existing, wanted, idField, table,
                               keyOfExisting, keyOfWanted, build, diff, errors }){
  const have = new Map();
  for(const r of (existing || [])){
    const k = keyOfExisting(r);
    if(k != null) have.set(String(k), r);
  }

  const byKey = new Map();
  const seen  = new Set();

  for(const w of (wanted || [])){
    const k = keyOfWanted(w);
    if(k == null) continue;              // an unconfigured row cannot be identified
    const key = String(k);
    if(seen.has(key)) continue;          // the Setup listed the same thing twice
    seen.add(key);

    const row = have.get(key);
    if(row){
      byKey.set(key, row[idField]);
      /* Only PATCH when something actually differs -- an untouched row should
         not get a new modifiedon just because its Setup was saved. */
      const patch = diff ? diff(w, row) : null;
      if(patch && Object.keys(patch).length){
        try{ assertSuccess(await service.update(row[idField], patch)); }
        catch(e){ errors.push({ table, error:e }); }
      }
    }else{
      try{
        const created = await service.create(build(w));
        const id = created?.data?.[idField];
        if(id) byKey.set(key, id);
        else errors.push({ table, error:new Error('created but no id returned') });
      }catch(e){ errors.push({ table, error:e }); }
    }
  }

  /* Whatever the Setup no longer lists is removed -- and only that. */
  for(const [key, row] of have){
    if(seen.has(key)) continue;
    try{ await service.delete(row[idField]); }
    catch(e){ errors.push({ table, error:e }); }
  }

  return byKey;
}

/** True when a lookup column's current value differs from what is wanted.
 *  `_x_value` columns come back as a GUID string or undefined. */
const lookupChanged = (current, wantedId) =>
  (current || null) !== (wantedId || null);

/** Creates every child row (per-unit Business Unit/Region rows, each with
 *  its own Review Chain, plus the template-level checklist/lines/KPI/
 *  Process rows) for an already-existing lm_report_templates row. Shared by
 *  create (fresh parent) and update (existing parent, after its old
 *  children were deleted) -- same fan-out either way, just a different
 *  `templateId` source. Mutates `errors` in place; nothing is returned. */
/* A Report Template's Review Chain rows hang off a per-unit row through one of
   two lookup pairs. Writes use lm_ReportTemplatePerBusinessUnit /
   lm_ReportTemplatePerRegion (added 06 Sep 2026); rows saved before that date
   sit on the Meeting module's lm_MeetingTemplatePerBusinessUnit /
   ...PerRegion, which were the only per-unit columns the table had. Reads have
   to accept both or editing an older Setup silently loses its chain. */
function unitChainFilter(kind, rowId){
  const pair = kind === 'region'
    ? ['_lm_reporttemplateperregion_value', '_lm_meetingtemplateperregion_value']
    : ['_lm_reporttemplateperbusinessunit_value', '_lm_meetingtemplateperbusinessunit_value'];
  return `(${pair[0]} eq ${rowId} or ${pair[1]} eq ${rowId})`;
}

/* A group-wide (Stage 3/4) chain is one bound to the Template with NO per-unit
   row at all -- so all four lookups must be null, not just the two we write.
   Checking only the Meeting pair would sweep up every per-unit chain saved
   since the new columns landed, since those leave the Meeting pair null. */
const GROUP_CHAIN_UNBOUND = [
  '_lm_reporttemplateperbusinessunit_value eq null',
  '_lm_reporttemplateperregion_value eq null',
  '_lm_meetingtemplateperbusinessunit_value eq null',
  '_lm_meetingtemplateperregion_value eq null',
].join(' and ');

async function createReportTemplateChildren(templateId, payload, errors, opts = {}){
  const bind = `/lm_report_templates(${templateId})`;

  // One lm_reporttemplatebusinessunitses / lm_reporttemplateregions row per
  // configured unit, each with its own Speciality/Owner/Submitter, and its
  // own Review Chain bound back to that specific unit row (not just the
  // parent template) via lm_ReportTemplatePerBusinessUnit /
  // lm_ReportTemplatePerRegion on lm_reporttemplatereviewchains.
  // These two lookups were added on 06 Sep 2026. Before that the chain was
  // bound through lm_MeetingTemplatePerBusinessUnit / ...PerRegion -- the
  // Meeting module's lookups, reused because they were the only per-unit
  // columns the table had. Rows written that way still exist, so every read
  // below accepts EITHER lookup; only writes use the new columns.
  // Group-level Setups have no dedicated child table yet, so their units
  // (if any) are skipped with a console note rather than guessed at.
  /* On the update path the unit rows and their chains have already been
     reconciled in place; running this loop again would duplicate them. */
  for(const unit of (opts.skipUnits ? [] : payload.units||[])){
    let unitBind = null, unitLookupField = null;

    if(payload.stageLevel==='bu' && unit?.businessUnitId){
      try{
        const rowPayload = {
          'lm_ReportTemplate@odata.bind': bind,
          'lm_BusinessUnit@odata.bind': `/businessunits(${unit.businessUnitId})`,
          lm_name: unit.name || undefined,
          ...unitScheduleColumns(unit),
        };
        if(unit.specialityId) rowPayload['lm_Speciality@odata.bind'] = `/cr301_specialtyksa_service_hubs(${unit.specialityId})`;
        if(unit.ownerPositionId) rowPayload['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${unit.ownerPositionId})`;
        if(unit.submittingPositionId) rowPayload['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${unit.submittingPositionId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${unit.channelId})`;
        const created = await Lm_reporttemplatebusinessunitsesService.create(rowPayload);
        const rowId = created?.data?.lm_reporttemplatebusinessunitsid;
        if(rowId){ unitBind = `/lm_reporttemplatebusinessunitses(${rowId})`; unitLookupField = 'lm_ReportTemplatePerBusinessUnit@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_reporttemplatebusinessunitses', error:e }); }
    }else if(payload.stageLevel==='region' && unit?.regionId){
      try{
        const rowPayload = {
          'lm_ReportTemplate@odata.bind': bind,
          'lm_Region@odata.bind': `/crd04_regionses(${unit.regionId})`,
          lm_name: unit.name || undefined,
          ...unitScheduleColumns(unit),
        };
        if(unit.specialityId) rowPayload['lm_ReportSpeciality@odata.bind'] = `/cr301_specialtyksa_service_hubs(${unit.specialityId})`;
        if(unit.ownerPositionId) rowPayload['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${unit.ownerPositionId})`;
        if(unit.submittingPositionId) rowPayload['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${unit.submittingPositionId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${unit.channelId})`;
        const created = await Lm_reporttemplateregionsService.create(rowPayload);
        const rowId = created?.data?.lm_reporttemplateregionid;
        if(rowId){ unitBind = `/lm_reporttemplateregions(${rowId})`; unitLookupField = 'lm_ReportTemplatePerRegion@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_reporttemplateregions', error:e }); }
    }
    /* A group-wide (Stage 3/4) Setup has no per-unit child table -- there is no
       Business Unit or Region row for its Review Chain steps to hang off. That
       used to `continue` here, which silently discarded the whole chain.
       It does NOT have to: lm_reporttemplatereviewchains carries a direct
       lm_ReportTemplate lookup as well as the per-unit ones, and the loop
       below already binds the template on every row and adds the per-unit
       lookup only when there is one. So the chain is written against the
       template itself, with the per-unit link left null. That null is what
       identifies a group-wide chain on read, which is why the group-wide
       queries have to null-check all FOUR per-unit lookups, not just the
       two currently written. */

    for(const step of (unit.reviewChain||[])){
      try{
        const rcPayload = {
          'lm_ReportTemplate@odata.bind': bind,
          lm_step: step.step,
          lm_newcolumn: step.positionName || undefined,
        };
        if(step.positionId) rcPayload['lm_ReviewerPosition@odata.bind'] = `/cr603_organizationstructures(${step.positionId})`;
        if(unitBind && unitLookupField) rcPayload[unitLookupField] = unitBind;
        await Lm_reporttemplatereviewchainsService.create(rcPayload);
      }catch(e){ errors.push({ table:'lm_reporttemplatereviewchains', error:e }); }
    }
  }

  for(const item of (payload.checklist||[])){
    if(!item.text) continue;
    try{
      /* The checklist row must exist before its Section items can bind to it,
         so this create is awaited for its id rather than fired blind. */
      const created = await Lm_reporttemplatecontentchecklistsService.create({
        lm_checklistitemname: item.text,
        lm_checklistitemstep: (payload.checklist.indexOf(item)+1),
        lm_diagnosticangle: SECTION_ANGLE_KEY[item.angle || 'Untyped'] ?? SECTION_ANGLE_KEY.Untyped,
        lm_fileattachement: item.fileAttachment || null,
        'lm_ReportTemplate@odata.bind': bind,
      });
      const checklistId = idOrThrow(created, 'lm_reporttemplatecontentchecklistid');
      await createSectionItems(checklistId, item.items, errors);
    }catch(e){ errors.push({ table:'lm_reporttemplatecontentchecklists', error:e }); }
  }

  /* One row per Department & Function -- or, when the Setup submits "per
     Department & Function" (29 Sep), one per unit x line, each carrying that
     unit (lm_BU / lm_Region) and its own Submitting Position, Owner Position
     (Accountable) and Team Channel. Those five lookups exist in DT New only
     (added 29 Sep); IT lacks them, so they are bound only when set -- a Setup
     in the ordinary one-submitter-per-unit mode writes exactly what it always
     did, and saves in either environment. */
  for(const line of (payload.lines||[])){
    if(!line?.departmentId) continue;
    try{
      const rowPayload = { 'lm_ReportTemplate@odata.bind': bind, 'lm_Department@odata.bind': `/cr603_chklst_departmentses(${line.departmentId})` };
      if(line.functionId) rowPayload['lm_Function@odata.bind'] = `/hr_functions(${line.functionId})`;
      /* The line's position on the Setup, in the row's name (lm_newcolumn,
         100 chars) -- "3. Nursing › Quality" (30 Sep). A Report Setup may list
         the same Department & Function more than once, each with its own
         people, and this is what tells the copies apart and puts them back in
         order on reopen (see readReportTemplateLines). */
      if(line.seq) rowPayload.lm_newcolumn = `${line.seq}. ${line.label || ''}`.trim().slice(0, 100);
      if(line.businessUnitId)       rowPayload['lm_BU@odata.bind']                  = `/businessunits(${line.businessUnitId})`;
      if(line.regionId)             rowPayload['lm_Region@odata.bind']              = `/crd04_regionses(${line.regionId})`;
      if(line.submittingPositionId) rowPayload['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${line.submittingPositionId})`;
      if(line.ownerPositionId)      rowPayload['lm_OwnerPosition@odata.bind']      = `/cr603_organizationstructures(${line.ownerPositionId})`;
      if(line.channelId)            rowPayload['lm_TeamChannel@odata.bind']        = `/and_teamschannellinks(${line.channelId})`;
      await Lm_reporttemplatedepartmentfunctionsService.create(rowPayload);
    }catch(e){ errors.push({ table:'lm_reporttemplatedepartmentfunctions', error:e }); }
  }

  for(const kpiId of (payload.kpiIds||[])){
    try{
      await Lm_reporttemplaterelatedkpisesService.create({
        'lm_ReportTemplate@odata.bind': bind,
        'lm_RelatedKPI@odata.bind': `/strategy_kpises(${kpiId})`,
      });
    }catch(e){ errors.push({ table:'lm_reporttemplaterelatedkpises', error:e }); }
  }

  for(const procId of (payload.processIds||[])){
    try{
      await Lm_reporttemplaterelatedprocessesesService.create({
        'lm_ReportTemplate@odata.bind': bind,
        'lm_RelatedProcess@odata.bind': `/strategy_processes(${procId})`,
      });
    }catch(e){ errors.push({ table:'lm_reporttemplaterelatedprocesseses', error:e }); }
  }
}

/* The Report counterpart of reconcileMeetingUnits(): unit rows and the Review
   Chain steps that hang off them are kept in place, so adding one Business
   Unit no longer rewrites the others or rebuilds their chains.

   Everything else on a Report Setup -- checklist, section items, department/
   function lines, related KPIs and Processes -- stays delete-and-recreate.
   Those are flat template-level lists nothing references by id. */
async function reconcileReportUnits(templateId, payload, existing, errors){
  const bind = `/lm_report_templates(${templateId})`;
  const level = payload.stageLevel;
  const units = payload.units || [];

  const buWanted     = level === 'bu'     ? units.filter(u => u?.businessUnitId) : [];
  const regionWanted = level === 'region' ? units.filter(u => u?.regionId)       : [];

  const posBind = id => `/cr603_organizationstructures(${id})`;
  const common = (u, specialityField) => {
    const f = {};
    if(u.specialityId)        f[specialityField] = `/cr301_specialtyksa_service_hubs(${u.specialityId})`;
    if(u.ownerPositionId)     f['lm_OwnerPosition@odata.bind'] = posBind(u.ownerPositionId);
    if(u.submittingPositionId) f['lm_SubmittingPosition@odata.bind'] = posBind(u.submittingPositionId);
    if(u.channelId)           f['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${u.channelId})`;
    return { ...f, ...unitScheduleColumns(u) };
  };
  const diffOf = specialityValueField => (u, row) => {
    const patch = unitScheduleDiff(u, row);
    if((row.lm_name || null) !== (u.name || null)) patch.lm_name = u.name || null;
    if(u.specialityId && lookupChanged(row[specialityValueField], u.specialityId))
      patch[specialityValueField === '_lm_speciality_value' ? 'lm_Speciality@odata.bind' : 'lm_ReportSpeciality@odata.bind']
        = `/cr301_specialtyksa_service_hubs(${u.specialityId})`;
    if(u.ownerPositionId && lookupChanged(row._lm_ownerposition_value, u.ownerPositionId))
      patch['lm_OwnerPosition@odata.bind'] = posBind(u.ownerPositionId);
    if(u.submittingPositionId && lookupChanged(row._lm_submittingposition_value, u.submittingPositionId))
      patch['lm_SubmittingPosition@odata.bind'] = posBind(u.submittingPositionId);
    if(u.channelId && lookupChanged(row._lm_teamchannel_value, u.channelId))
      patch['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${u.channelId})`;
    /* Per Department & Function (30 Sep): the people live on the line rows,
       so the unit's own Submitter, Owner and Channel are CLEARED -- only what
       the Setup currently uses is saved. A lookup is cleared by binding it to
       null; only ones that hold a value are touched. */
    if(u.clearPeople){
      if(row._lm_ownerposition_value)      patch['lm_OwnerPosition@odata.bind'] = null;
      if(row._lm_submittingposition_value) patch['lm_SubmittingPosition@odata.bind'] = null;
      if(row._lm_teamchannel_value)        patch['lm_TeamChannel@odata.bind'] = null;
    }
    return patch;
  };

  const buIds = await reconcileRows({
    service: Lm_reporttemplatebusinessunitsesService,
    existing: existing?.businessUnits, wanted: buWanted,
    idField: 'lm_reporttemplatebusinessunitsid', table: 'lm_reporttemplatebusinessunitses',
    keyOfExisting: r => r._lm_businessunit_value,
    keyOfWanted:   u => u.businessUnitId,
    build: u => ({ 'lm_ReportTemplate@odata.bind': bind,
                   'lm_BusinessUnit@odata.bind': `/businessunits(${u.businessUnitId})`,
                   lm_name: u.name || undefined, ...common(u, 'lm_Speciality@odata.bind') }),
    diff: diffOf('_lm_speciality_value'), errors,
  });

  const regionIds = await reconcileRows({
    service: Lm_reporttemplateregionsService,
    existing: existing?.regions, wanted: regionWanted,
    idField: 'lm_reporttemplateregionid', table: 'lm_reporttemplateregions',
    keyOfExisting: r => r._lm_region_value,
    keyOfWanted:   u => u.regionId,
    build: u => ({ 'lm_ReportTemplate@odata.bind': bind,
                   'lm_Region@odata.bind': `/crd04_regionses(${u.regionId})`,
                   lm_name: u.name || undefined, ...common(u, 'lm_ReportSpeciality@odata.bind') }),
    diff: diffOf('_lm_reportspeciality_value'), errors,
  });

  /* Review Chain steps, per surviving unit. A step is identified by its step
     NUMBER within its unit: changing who reviews at step 2 is an edit to that
     step, not the removal of one step and the addition of another. */
  const byUnit = existing?.chainsByUnit || new Map();
  const doChain = async (unit, unitRowId, lookupField, unitSet) => {
    if(!unitRowId) return;
    await reconcileRows({
      service: Lm_reporttemplatereviewchainsService,
      existing: byUnit.get(unitRowId) || [],
      wanted: (unit.reviewChain || []).filter(st => st && st.step != null),
      idField: 'lm_reporttemplatereviewchainid', table: 'lm_reporttemplatereviewchains',
      keyOfExisting: r => r.lm_step,
      keyOfWanted:   st => st.step,
      build: st => {
        const row = { 'lm_ReportTemplate@odata.bind': bind,
                      [lookupField]: `/${unitSet}(${unitRowId})`,
                      lm_step: st.step, lm_newcolumn: st.positionName || undefined };
        if(st.positionId) row['lm_ReviewerPosition@odata.bind'] = posBind(st.positionId);
        return row;
      },
      diff: (st, row) => {
        const patch = {};
        if((row.lm_newcolumn || null) !== (st.positionName || null))
          patch.lm_newcolumn = st.positionName || null;
        if(st.positionId && lookupChanged(row._lm_reviewerposition_value, st.positionId))
          patch['lm_ReviewerPosition@odata.bind'] = posBind(st.positionId);
        return patch;
      },
      errors,
    });
  };

  for(const u of buWanted)
    await doChain(u, buIds.get(String(u.businessUnitId)),
      'lm_ReportTemplatePerBusinessUnit@odata.bind', 'lm_reporttemplatebusinessunitses');
  for(const u of regionWanted)
    await doChain(u, regionIds.get(String(u.regionId)),
      'lm_ReportTemplatePerRegion@odata.bind', 'lm_reporttemplateregions');
}

/* A Report Setup's Department & Function rows. The five columns added 29 Sep
   (lm_BU, lm_Region, lm_SubmittingPosition, lm_OwnerPosition, lm_TeamChannel)
   exist in DT New but NOT in IT, and $select-ing a missing column fails the
   whole read -- so the wide read is tried first and, if it is refused, the
   narrow one it always was. Leadership reads Setups from IT through this, and
   must keep working there. */
const LINE_SELECT_BASE = ['_lm_department_value','_lm_function_value','lm_newcolumn','createdon'];
const LINE_SELECT_WIDE = [...LINE_SELECT_BASE, '_lm_bu_value','_lm_region_value',
  '_lm_submittingposition_value','_lm_ownerposition_value','_lm_teamchannel_value'];
async function readReportTemplateLines(filter){
  try{
    const wide = await Lm_reporttemplatedepartmentfunctionsService.getAll({ filter, select: LINE_SELECT_WIDE });
    if(wide?.success !== false) return wide;
  }catch{ /* falls through to the narrow read */ }
  return Lm_reporttemplatedepartmentfunctionsService.getAll({ filter, select: LINE_SELECT_BASE });
}
const lineSeqOf = r => { const m = /^(\d+)\./.exec(r.lm_newcolumn || ''); return m ? Number(m[1]) : 1e6; };
/* Each Department & Function pair once, in the order first seen. */
function uniqueLines(rows){
  const seen = new Set();
  return rows.filter(r => {
    const k = `${r._lm_department_value || ''}|${r._lm_function_value || ''}`;
    if(seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** Ids only (not the full display shape fetchReportTemplateDetail() builds)
 *  for every child row -- including each Business-Unit/Region row's own
 *  Review Chain -- of one Report Template. Used by
 *  updateReportTemplateToDataverse() to know exactly what to delete before
 *  recreating from the edited payload. */
async function fetchReportTemplateChildIds(dvId){
  const filter = `_lm_reporttemplate_value eq ${dvId}`;
  const [checklistRes, linesRes, kpisRes, procsRes, busRes, regionsRes] = await Promise.all([
    Lm_reporttemplatecontentchecklistsService.getAll({ filter, select:['lm_reporttemplatecontentchecklistid'] }),
    Lm_reporttemplatedepartmentfunctionsService.getAll({ filter, select:['lm_reporttemplatedepartmentfunctionid'] }),
    Lm_reporttemplaterelatedkpisesService.getAll({ filter, select:['lm_reporttemplaterelatedkpisid'] }),
    Lm_reporttemplaterelatedprocessesesService.getAll({ filter, select:['lm_reporttemplaterelatedprocessesid'] }),
    /* Identifying lookup and own fields, not just the id — reconcileRows()
       needs them to tell an existing unit from a new one. */
    Lm_reporttemplatebusinessunitsesService.getAll({ filter, select:['lm_reporttemplatebusinessunitsid',
      'lm_name','_lm_businessunit_value','_lm_speciality_value','_lm_ownerposition_value',
      '_lm_submittingposition_value','_lm_teamchannel_value', ...REPORT_SCHEDULE_COLS] }),
    Lm_reporttemplateregionsService.getAll({ filter, select:['lm_reporttemplateregionid',
      'lm_name','_lm_region_value','_lm_reportspeciality_value','_lm_ownerposition_value',
      '_lm_submittingposition_value','_lm_teamchannel_value', ...REPORT_SCHEDULE_COLS] }),
  ]);
  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];
  const [buChains, regionChains] = await Promise.all([
    Promise.all(businessUnits.map(bu => Lm_reporttemplatereviewchainsService.getAll({
      filter: unitChainFilter('businessunit', bu.lm_reporttemplatebusinessunitsid),
      select: ['lm_reporttemplatereviewchainid','lm_step','_lm_reviewerposition_value','lm_newcolumn'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
    Promise.all(regions.map(rg => Lm_reporttemplatereviewchainsService.getAll({
      filter: unitChainFilter('region', rg.lm_reporttemplateregionid),
      select: ['lm_reporttemplatereviewchainid','lm_step','_lm_reviewerposition_value','lm_newcolumn'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
  ]);
  /* Section items hang off the checklist rows, not off the Template, so they
     can only be found once the checklist ids are known -- same two-hop shape
     as the Review Chains above. */
  const checklist = checklistRes?.data ?? [];
  const sectionItemLists = await Promise.all(checklist.map(c =>
    Lm_reporttemplatesectionitemsesService.getAll({
      filter: `_lm_sectionchecklistitem_value eq ${c.lm_reporttemplatecontentchecklistid}`,
      select: ['lm_reporttemplatesectionitemsid'],
    }).then(r=>r?.data??[]).catch(()=>[])));

  /* A group-wide Setup's Review Chain hangs off the template alone, with both
     per-unit lookups null, so the per-BU/per-Region queries above never see it.
     Without this the update path would leave those rows behind as orphans every
     time a group-wide template was edited. */
  const groupChainRes = await Lm_reporttemplatereviewchainsService.getAll({
    filter: `${filter} and ${GROUP_CHAIN_UNBOUND}`,
    select: ['lm_reporttemplatereviewchainid','lm_step','_lm_reviewerposition_value','lm_newcolumn'],
  }).catch(()=>null);
  /* keyed by unit row id, for the reconcile path */
  const chainsByUnit = new Map([
    ...businessUnits.map((bu,i) => [bu.lm_reporttemplatebusinessunitsid, buChains[i]]),
    ...regions.map((rg,i) => [rg.lm_reporttemplateregionid, regionChains[i]]),
  ]);

  return {
    checklist,
    sectionItems: sectionItemLists.flat(),
    lines: linesRes?.data ?? [],
    kpis: kpisRes?.data ?? [],
    processes: procsRes?.data ?? [],
    businessUnits, regions, chainsByUnit,
    reviewChains: [...buChains.flat(), ...regionChains.flat(), ...(groupChainRes?.data ?? [])],
  };
}

/**
 * Saves a Report Template Setup to Dataverse: creates the parent
 * lm_report_templates row, then its child rows (checklist, department/
 * function lines, related KPIs, related processes, review chain).
 *
 * Takes an already-resolved payload -- GovernanceApp.jsx owns the live
 * reference data (DEPARTMENTS, FUNCTIONS, KPIs/Processes with ids,
 * POSITIONS, buOf/unitOf/stageLevel) and is responsible for resolving
 * names to ids before calling this; this function only knows table and
 * field names, not the app's internal scope/cascade logic.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} [payload.objective]
 * @param {string} [payload.reportType] one of REPORT_TYPE_KEY's keys
 * @param {string} [payload.submissionTiming] one of SUBMISSION_TIMING_KEY's keys --
 *        only meaningful when reportType is 'Report'
 * @param {string} [payload.reportCategory] one of REPORT_CATEGORY_KEY's keys
 * @param {string} [payload.frequency] one of FREQUENCY_KEY's keys
 * @param {string} [payload.dayOfWeek] one of DAY_OF_WEEK_KEY's keys
 * @param {number} [payload.dayOfMonth]
 * @param {string} [payload.monthInQuarter] one of MONTH_IN_QUARTER_KEY's keys
 * @param {string} [payload.confidentiality] one of CONFIDENTIALITY_KEY's keys
 * @param {string} [payload.destinationLink]
 * @param {string} [payload.fileAttachment] plain text/URL, max 2000 chars (lm_fileattachement)
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' currently create per-unit child rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,specialityId?:string,ownerPositionId?:string,submittingPositionId?:string,reviewChain?:{step:number,positionId?:string,positionName:string}[]}[]} [payload.units] one entry per configured unit, each with its own Review Chain
 * @param {{text:string, fileAttachment?:string}[]} [payload.checklist]
 * @param {{departmentId:string, functionId?:string}[]} [payload.lines]
 * @param {string[]} [payload.kpiIds]
 * @param {string[]} [payload.processIds]
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function saveReportTemplateToDataverse(payload){
  const errors = [];

  let templateId = null;
  try{
    const created = await Lm_report_templatesService.create(reportTemplateParentPayload(payload));
    templateId = idOrThrow(created, 'lm_report_templateid');
  }catch(e){
    errors.push({ table:'lm_report_templates', error:e });
    return { id:null, errors }; // nothing else can be linked without a parent id
  }

  await createReportTemplateChildren(templateId, payload, errors);
  return { id: templateId, errors };
}

/**
 * Updates an existing Report Template Setup in Dataverse in place: patches
 * the parent lm_report_templates row, then reconciles every child table
 * (per-unit Business Unit/Region rows and their Review Chains, checklist,
 * department/function lines, related KPIs, related processes) by deleting
 * every existing child row for this template and recreating the full set
 * from the edited payload.
 *
 * A full delete-then-recreate, rather than a field-by-field diff, because
 * the app's Setup doesn't retain stable Dataverse row ids for most child
 * rows (only the per-unit Business Unit/Region rows keep theirs, as
 * `dvu-<guid>` ids) -- and because a Stage change (e.g. Stage 1 BU to
 * Stage 2 Region) swaps which child table owns the scope rows entirely,
 * which a same-table diff can't express anyway. This is exactly "delete
 * the rows that no longer apply, recreate the rows that do."
 *
 * @param {string} dvId the real lm_report_templateid being edited
 * @param {object} payload same shape as saveReportTemplateToDataverse's payload
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function updateReportTemplateToDataverse(dvId, payload){
  const errors = [];

  try{
    /* assertSuccess, not a bare await. The SDK does NOT throw on a Dataverse
       validation failure -- it resolves with { success:false, error } -- so
       this PATCH could be rejected and the caller would still be told the
       Setup saved. That silently swallowed the lm_version bump on a
       re-publish: the local Setup showed version N+1 while Dataverse kept N,
       and the next publish computed N+1 again from the stale read. */
    const parentRow = reportTemplateParentPayload(payload);
    /* A group-wide Setup keeps its one section's people on this row. Per
       Department & Function they move to the line rows, so clear them here
       (30 Sep) -- same rule as the unit rows in reconcileReportUnits(). */
    if(payload.stageLevel==='group' && (payload.units||[])[0]?.clearPeople){
      parentRow['lm_OwnerPosition@odata.bind'] = null;
      parentRow['lm_SubmittingPosition@odata.bind'] = null;
      parentRow['lm_TeamChannel@odata.bind'] = null;
    }
    const parentResult = await Lm_report_templatesService.update(dvId, parentRow);
    assertSuccess(parentResult);
  }catch(e){
    errors.push({ table:'lm_report_templates', error:e });
    return { id:null, errors };
  }

  let existing = null;
  try{
    existing = await fetchReportTemplateChildIds(dvId);
  }catch(e){
    errors.push({ table:'lm_report_templates(read existing children)', error:e });
  }

  if(existing){
    /* Unit rows and the Review Chain steps hanging off them are RECONCILED,
       not deleted: adding one Business Unit must not rewrite the others or
       rebuild their chains. */
    await reconcileReportUnits(dvId, payload, existing, errors);
    // A Section item hangs off a checklist row, so it must go before that row does.
    await deleteRows(Lm_reporttemplatesectionitemsesService, existing.sectionItems, 'lm_reporttemplatesectionitemsid', 'lm_reporttemplatesectionitemses', errors);
    await deleteRows(Lm_reporttemplatecontentchecklistsService, existing.checklist, 'lm_reporttemplatecontentchecklistid', 'lm_reporttemplatecontentchecklists', errors);
    await deleteRows(Lm_reporttemplatedepartmentfunctionsService, existing.lines, 'lm_reporttemplatedepartmentfunctionid', 'lm_reporttemplatedepartmentfunctions', errors);
    await deleteRows(Lm_reporttemplaterelatedkpisesService, existing.kpis, 'lm_reporttemplaterelatedkpisid', 'lm_reporttemplaterelatedkpises', errors);
    await deleteRows(Lm_reporttemplaterelatedprocessesesService, existing.processes, 'lm_reporttemplaterelatedprocessesid', 'lm_reporttemplaterelatedprocesseses', errors);
  }

  await createReportTemplateChildren(dvId, payload, errors, { skipUnits: !!existing });
  return { id: dvId, errors };
}

/* =========================================================================
   Meeting Template save (Committee/Meeting Setups)
   Mirrors the Report Template save above -- parent row, then children
   (agenda items, supportive functions, department/function lines, linked
   reports, attendees).
   ========================================================================= */

const Lm_meetingtemplatesService = dvTable('lm_meetingtemplates', 'lm_meetingtemplateid', PIN_ORG);
const Lm_meetingtemplatebusinessunitsesService = dvTable('lm_meetingtemplatebusinessunitses', 'lm_meetingtemplatebusinessunitsid', PIN_ORG);
const Lm_meetingtemplateregionsService = dvTable('lm_meetingtemplateregions', 'lm_meetingtemplateregionid', PIN_ORG);
const Lm_meetingtemplateagendaitemsService = dvTable('lm_meetingtemplateagendaitems', 'lm_meetingtemplateagendaitemid', PIN_ORG);
const Lm_meetingtemplatesupportivefunctionsesService = dvTable('lm_meetingtemplatesupportivefunctionses', 'lm_meetingtemplatesupportivefunctionsid', PIN_ORG);
const Lm_meetingtemplatedepartmentfunctionsService = dvTable('lm_meetingtemplatedepartmentfunctions', 'lm_meetingtemplatedepartmentfunctionid', PIN_ORG);
const Lm_meetingtemplatelinkedreportsesService = dvTable('lm_meetingtemplatelinkedreportses', 'lm_meetingtemplatelinkedreportsid', PIN_ORG);
/* Stage 4 (Top Management) meetings' Categories, one row per (Setup, Category)
   -- added to IT by 28 Sep. Lookups: lm_MeetingTemplate and lm_Meetingcategory
   (lowercase c: the bind name must match the schema name exactly). */
const Lm_topmanagementmeetingcategoriesService = dvTable('lm_topmanagementmeetingcategories', 'lm_topmanagementmeetingcategoryid', PIN_ORG);
const TOP_CATEGORY_SELECT = ['lm_topmanagementmeetingcategoryid','lm_name','_lm_meetingcategory_value'];
const topCategoryRow = (templateId, c) => ({
  'lm_MeetingTemplate@odata.bind': `/lm_meetingtemplates(${templateId})`,
  'lm_Meetingcategory@odata.bind': `/lm_meetingcategories(${c.categoryId})`,
  lm_name: c.name || undefined,
});
const Lm_meetingattendeeslistsService = dvTable('lm_meetingattendeeslists', 'lm_meetingattendeeslistid', PIN_ORG);
const Lm_meetingcategoriesService = dvTable('lm_meetingcategories', 'lm_meetingcategoryid', PIN_ORG);

/* ========================================================================
   Strategy execution -- POCs, Strategies, BI reports and Tasks.

   These four are what a report SECTION cites when it rests on something other
   than a KPI or a Process. Until now all four were typed by hand and saved as
   a bare label, because none of them had a table in this app. They do now.

   ⚠️ lm_reportsectioncitations still has no lookup column for any of the four
   -- its only lookups are lm_kpi, lm_process, lm_citedsection,
   lm_childcitedsection, lm_childreporttemplate and lm_citedreportoccurrence.
   So the PICKER is governed (you choose a real record) but the CITATION still
   stores the chosen record's name in lm_name. Adding lm_poc, lm_strategy,
   lm_bireport and lm_task lookups would make the reference resolvable; the
   pickers below already carry the ids ready for that day.
   ======================================================================== */
/* All pinned to IT_ORG (24 Sep) -- same reasoning as strategy_kpises/
   strategy_processes above: every citation these back is written to a
   Report Occurrence row that lives in IT, and stf_executioncategories/
   crd04_specialtieses specifically resolve ids that sit directly on a POC
   row (_stf_poccategory_value/_stf_specialty_value) -- once POC itself
   reads from IT, those ids are IT's ids, and resolving them against DT
   New's copies of the two lookup tables would fail the same way an
   unpinned KPI/Process bind would have. */
const Stf_strategypocsService       = dvTable('stf_strategypocs', 'stf_strategypocid', PIN_ORG);
const Stf_executioncategoriesService= dvTable('stf_executioncategories', 'stf_executioncategoryid', PIN_ORG);
const Crd04_specialtiesesService    = dvTable('crd04_specialtieses', 'crd04_specialtiesid', PIN_ORG);
const Strategy_strategiesService    = dvTable('strategy_strategies', 'strategy_strategyid', PIN_ORG);
const Lm_bireportdashboardsService  = dvTable('lm_bireportdashboards', 'lm_bireportdashboardid', PIN_ORG);
const Hx_taskesService              = dvTable('hx_taskses', 'hx_tasksid', PIN_ORG);
/* cr603_projects -- entity set cr603_projectses (double-s, same publisher
   convention as cr603_chklst_departmentses/crd04_specialtieses), confirmed
   via `pac modelbuilder build -enf cr603_projects`. Read-only: this app
   only cites a Project, never creates or edits one. Pinned to IT_ORG (24
   Sep), same reasoning as its siblings above. */
const Cr603_projectsesService       = dvTable('cr603_projectses', undefined, PIN_ORG);

/** POC status, read from the live option set stf_stfpocstatus. */
export const POC_STATUS = { 1:'Active', 2:'Succeeded', 3:'Failed', 4:'Retired' };

/** Every POC, with the five things the picker filters on.
 *
 *  Each lookup comes back twice -- the id to filter on and the formatted value
 *  to show -- so the filter dropdowns can be built from the rows themselves
 *  rather than from five more reads. */
/** Users who can be assigned a task -- systemusers, enabled ones only.
 *  `isdisabled eq false` rather than statecode, which systemuser does not use
 *  the way a custom table does.
 *
 *  ⚠️ IT_ORG (via SystemusersService), not DT New: both callers -- the Task
 *  assignee picker and the "send a report" recipient picker -- bind the id
 *  straight into a create on an IT-hosted table (hx_tasks,
 *  lm_reportoccurrenceshares). A DT New systemuserid bound there 404s with
 *  "Entity 'SystemUser' ... Does Not Exist", since a lookup can't resolve
 *  across environments. */
export async function fetchAssignableUsers(){
  const res = await SystemusersService.getAll({
    select: ['systemuserid', 'fullname', 'internalemailaddress'],
    filter: 'isdisabled eq false',
  });
  return (res?.data ?? [])
    .filter(r => r.fullname)
    .map(r => ({ id: r.systemuserid, name: r.fullname, email: r.internalemailaddress || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Users by systemuser id, with what a Teams @mention needs (05 Oct): the
 *  Microsoft Entra object id, else the sign-in name / email. Chunked, as an
 *  OData filter has a length limit. A failed chunk is skipped, so a person
 *  is then named without an @mention rather than stopping the caller. */
export async function fetchUsersByIds(ids = []){
  const list = [...new Set((ids || []).filter(Boolean))];
  const out = [];
  for(let i = 0; i < list.length; i += 25){
    const chunk = list.slice(i, i + 25);
    try{
      const res = await SystemusersService.getAll({
        select: ['systemuserid', 'fullname', 'internalemailaddress', 'domainname', 'azureactivedirectoryobjectid'],
        filter: chunk.map(id => `systemuserid eq ${id}`).join(' or '),
      });
      for(const r of (res?.data ?? [])) out.push({
        id: r.systemuserid, name: r.fullname || null,
        email: r.internalemailaddress || null, upn: r.domainname || null,
        aadId: r.azureactivedirectoryobjectid || null,
      });
    }catch(e){ console.warn('[dataverse] fetchUsersByIds() chunk failed:', e); }
  }
  return out;
}

export async function fetchStrategyPocs(){
  const res = await Stf_strategypocsService.getAll({
    select: ['stf_strategypocid','stf_pocname','stf_pocdescription','stf_pocstatus',
             '_stf_region_value','_stf_poccategory_value','_stf_specialty_value',
             '_stf_strategykpi_value','stf_successcriteria','stf_target','_stf_project_value'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? []).map(r => ({
    id: r.stf_strategypocid,
    name: r.stf_pocname || '(unnamed POC)',
    description: r.stf_pocdescription || null,
    status: POC_STATUS[r.stf_pocstatus] || null,
    statusCode: r.stf_pocstatus ?? null,
    regionId: r._stf_region_value || null,
    regionName: r['_stf_region_value' + FV] || null,
    categoryId: r._stf_poccategory_value || null,
    categoryName: r['_stf_poccategory_value' + FV] || null,
    specialtyId: r._stf_specialty_value || null,
    specialtyName: r['_stf_specialty_value' + FV] || null,
    kpiId: r._stf_strategykpi_value || null,
    kpiName: r['_stf_strategykpi_value' + FV] || null,
    successCriteria: r.stf_successcriteria || null,
    target: r.stf_target ?? null,
    /* stf_project -> cr603_projects (109 of 112, 29 Sep): the Strategy chain
       reaches a POC through its Project. */
    projectId: r._stf_project_value || null,
  }));
}

/** POC Category -- stf_executioncategory. */
export async function fetchExecutionCategories(){
  const res = await Stf_executioncategoriesService.getAll({
    select: ['stf_executioncategoryid','stf_categoryname'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? [])
    .map(r => ({ id: r.stf_executioncategoryid, name: r.stf_categoryname || '(unnamed)' }))
    .sort((a,b)=>a.name.localeCompare(b.name));
}

/** Specialties -- crd04_specialties. NOT the same table as the Section /
 *  Specialty list the Setup wizard uses (cr301_specialtyksa_service_hubs);
 *  this is the one a POC is recorded against. */
export async function fetchSpecialties(){
  const res = await Crd04_specialtiesesService.getAll({
    select: ['crd04_specialtiesid','crd04_title'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? [])
    .map(r => ({ id: r.crd04_specialtiesid, name: r.crd04_title || '(untitled)' }))
    .sort((a,b)=>a.name.localeCompare(b.name));
}

/* ---- Strategy chain (29 Sep) ------------------------------------------
   Strategy -> KPI -> execution (Planning & Monitoring) -> actuals. What IT
   actually links, checked 29 Sep: strategy_strategy.strategy_kpi (346 of
   1,182), cr18c_planningmonitoring.cr18c_kpi (4,544 of 24,731 entries),
   pm_kpiachievments.pm_kpi. The Tactic table (stf_strategytactic) refuses
   read to ordinary roles and the Strategy-KPI junction holds 3 rows, so
   neither is used. */
const Cr18c_planningmonitoringsService = dvTable('cr18c_planningmonitorings', 'cr18c_planningmonitoringid', PIN_ORG);

/* Reads a KPI-filtered table 15 ids at a time -- an or-chain over hundreds
   of ids is a URL the service will not accept. */
async function byKpiChunks(ids, read){
  const out = [];
  const list = [...new Set((ids || []).filter(Boolean))];
  for(let i = 0; i < list.length; i += 15) out.push(...(await read(list.slice(i, i + 15))));
  return out;
}

/** Planning & Monitoring entries (the execution) for these KPIs. */
export async function fetchPlanningMonitoringByKpis(kpiIds){
  return byKpiChunks(kpiIds, async ids => {
    const res = await Cr18c_planningmonitoringsService.getAll({
      select: ['cr18c_planningmonitoringid','_cr18c_kpi_value','cr18c_tacticdescription',
               'cr18c_year','cr18c_month','cr18c_startdate','cr18c_enddate',
               'cr18c_targetoutput','cr18c_monthactual','cr18c_businessunit','cr18c_department'],
      filter: `statecode eq 0 and (${ids.map(id => `_cr18c_kpi_value eq ${id}`).join(' or ')})`,
    });
    assertSuccess(res);
    return (res.data ?? []).map(r => ({
      id: r.cr18c_planningmonitoringid,
      kpiId: r._cr18c_kpi_value || null,
      text: r.cr18c_tacticdescription || null,
      year: r.cr18c_year ?? null,
      month: r.cr18c_month || null,
      start: r.cr18c_startdate || null,
      end: r.cr18c_enddate || null,
      target: r.cr18c_targetoutput ?? null,
      actual: r.cr18c_monthactual ?? null,
      businessUnit: r.cr18c_businessunit || null,
      department: r.cr18c_department || null,
    }));
  });
}

/** One year's actuals for these KPIs -- fetchKpiAchievements(), in chunks. */
export async function fetchKpiAchievementsForKpis(year, kpiIds){
  return byKpiChunks(kpiIds, ids => fetchKpiAchievements(year, { kpiIds: ids }));
}

/** Strategies -- strategy_strategy. The name is strategy_newcolumn, the same
 *  naming accident the KPI and Process tables carry. */
export async function fetchStrategies(){
  const res = await Strategy_strategiesService.getAll({
    select: ['strategy_strategyid','strategy_newcolumn','strategy_strategydescription',
             'strategy_strategystatus','strategy_strategylevel','_strategy_region_value',
             '_strategy_kpi_value','_cr18c_process_value'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? []).map(r => ({
    id: r.strategy_strategyid,
    name: r.strategy_newcolumn || '(unnamed strategy)',
    description: r.strategy_strategydescription || null,
    status: r['strategy_strategystatus' + FV] || null,
    level: r['strategy_strategylevel' + FV] || null,
    regionName: r['_strategy_region_value' + FV] || null,
    kpiId: r._strategy_kpi_value || null,
    kpiName: r['_strategy_kpi_value' + FV] || null,
    /* cr18c_process -> strategy_process, filled on ~555 of 1,182 (29 Sep). */
    processId: r._cr18c_process_value || null,
    processName: r['_cr18c_process_value' + FV] || null,
  })).sort((a,b)=>a.name.localeCompare(b.name));
}

/** Project status, read from the live option set cr603_projectstatus. */
export const PROJECT_STATUS = {
  322020000:'In Progress', 322020001:'Completed', 322020002:'Not Started',
  322020003:'Delayed', 322020004:'Cancelled', 322020005:'Pending',
  322020006:'On Schedule', 819930001:'On Hold',
};
/** Project category, read from the live option set cr603_projectcategories. */
export const PROJECT_CATEGORY = {
  322020000:'Revenue Generating', 322020001:'Non-Revenue Generating', 322020002:'Cost Saving',
};

/** Projects -- cr603_projects. A large pre-existing table (not owned by this
 *  app, dozens of columns spanning several prefixes) -- only what a citation
 *  and its filters need is read. Region/Business Unit/Department are offered
 *  from the projects themselves in the picker rather than from their own
 *  tables, same reasoning as fetchStrategyPocs' filters: a filter listing a
 *  value no Project carries only ever empties the list. */
export async function fetchProjects(){
  const res = await Cr603_projectsesService.getAll({
    /* Beyond status/category (already read, both hand-mapped since PROJECT_
       STATUS/PROJECT_CATEGORY predate the FormattedValue convention used
       everywhere else): sub-category, strategic type, priority, approval
       status, period and sponsor, for citation display/export (27 Sep).
       Deliberately NOT read: cr603_assigned/projectcreator/oldcreator
       (unclear ownership fields, redundant with sponsor), cr603_company/
       entity/id (not this app's concept), cr603_mainproject/subproject
       (a project hierarchy this app doesn't otherwise surface),
       cr603_resubmissionstatus/followup/smopmo1/smopmo2 (process-internal
       to whichever team owns this table, not reviewed closely enough to
       show with confidence). */
    select: ['cr603_projectsid','cr603_projectname','cr603_projectstatus','cr603_projectcategory',
             '_project_strategyname_value',
             '_cr603_region_value','_cr603_bu_value','_cr603_department_value',
             'cr603_projectsubcategory','cr603_projectstrategictype','cr603_prioritylevel',
             'cr603_approvalstatus','cr603_projectperiod','cr603_progress',
             '_cr603_projectsponsor_value'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? []).map(r => ({
    id: r.cr603_projectsid,
    name: r.cr603_projectname || '(unnamed project)',
    status: PROJECT_STATUS[r.cr603_projectstatus] || null,
    statusCode: r.cr603_projectstatus ?? null,
    category: PROJECT_CATEGORY[r.cr603_projectcategory] || null,
    categoryCode: r.cr603_projectcategory ?? null,
    regionId: r._cr603_region_value || null,
    regionName: r['_cr603_region_value' + FV] || null,
    buId: r._cr603_bu_value || null,
    buName: r['_cr603_bu_value' + FV] || null,
    deptId: r._cr603_department_value || null,
    deptName: r['_cr603_department_value' + FV] || null,
    subCategory: r['cr603_projectsubcategory' + FV] || null,
    strategicType: r['cr603_projectstrategictype' + FV] || null,
    priority: r['cr603_prioritylevel' + FV] || null,
    approvalStatus: r['cr603_approvalstatus' + FV] || null,
    period: r['cr603_projectperiod' + FV] || null,
    progress: r.cr603_progress ?? null,
    sponsorName: r['_cr603_projectsponsor_value' + FV] || null,
    /* project_strategyname -> strategy_strategy (213 projects, 29 Sep) -- the
       Strategy chain's Strategy -> Project link. */
    strategyId: r._project_strategyname_value || null,
  })).sort((a,b)=>a.name.localeCompare(b.name));
}

/** BI reports / dashboards -- lm_bireportdashboard.
 *
 *  lm_dashboardlink is the report's URL as copied out of Power BI; converting
 *  a portal link to the embeddable one is the BI screen's job, not this
 *  layer's. lm_kpi points at strategy_kpis -- the same table the app's KPIs
 *  come from -- so "which dashboard is behind this measure" is a lookup, not
 *  a guess. */
export async function fetchBiReportDashboards(){
  const res = await Lm_bireportdashboardsService.getAll({
    select: ['lm_bireportdashboardid','lm_reportname','lm_dashboardlink','_lm_kpi_value'],
    filter: 'statecode eq 0',
  });
  return (res?.data ?? [])
    .map(r => ({
      id: r.lm_bireportdashboardid,
      name: r.lm_reportname || '(unnamed report)',
      link: r.lm_dashboardlink || null,
      kpiId: r._lm_kpi_value || null,
      kpiName: r['_lm_kpi_value' + FV] || null,
    }))
    .sort((a,b)=>a.name.localeCompare(b.name));
}

/** The BI reports behind each KPI, keyed by KPI id.
 *
 *  A KPI can have more than one dashboard, so the value is an array -- taking
 *  only the first would silently hide the rest. Reports with no KPI are left
 *  out: they exist, and the BI screen lists them, but nothing cites them
 *  through a measure. */
export async function fetchBiReportsByKpi(){
  const rows = await fetchBiReportDashboards();
  const map = new Map();
  for(const r of rows){
    if(!r.kpiId) continue;
    if(!map.has(r.kpiId)) map.set(r.kpiId, []);
    map.get(r.kpiId).push(r);
  }
  return map;
}

/* Live option sets on hx_tasks. */
export const TASK_PRIORITY = { 123200000:'Low', 123200001:'Medium', 123200002:'High', 931940001:'Critical' };
export const TASK_PRIORITY_KEY = { 'Low':123200000, 'Medium':123200001, 'High':123200002, 'Critical':931940001 };
export const TASK_STATUS = {
  123200004:'New', 100000001:'In Progress', 123200005:'Submitted', 100000005:'On Hold',
  123200002:'Closed', 123200003:'Cancelled', 931940001:'Rejected',
};
/* cr18c_tasksource -- which system raised the Task. Values read from IT's
   stringmap on 28 Sep, not guessed: the cr18c_ publisher numbers each choice
   column from its own base, so no other column's values carry over. */
export const TASK_SOURCE_KEY = {
  'Teams':989230000, 'TMS':989230001, 'Leadership':989230002, 'Steering':989230003,
  'Planning&Monitoring':989230004, 'Strategy':989230005, 'Projects':989230007,
  'Objectives':989230008, 'Excel':989230009,
};

/** Tasks -- hx_tasks. A large shared table; only what a citation needs is read. */
export async function fetchTasks(){
  const res = await Hx_taskesService.getAll({
    /* ⚠️ The filter columns were chosen by counting what IT's 44,552 rows
       actually hold (27 Sep), not from the column list:

         tms_isdelayed  44,552 -- and it is a STRING with THREE values, not a
                        boolean: "Delayed" 15,900, "Delayed Submission" 8,946,
                        "No" 19,706.
         tms_bu         44,537 -- real BU codes as text (AHQ 11,822, ASH 6,084,
                        AMH 3,957 ...). ⚠️ hx_businessunit is NOT usable: it is
                        a choice reading "BU1" on all 44,552 rows.
         tms_department 42,257 -- ⚠️ hx_targeteddepartment is not usable either,
                        it is "HR" on 44,551 of them. */
    select: ['hx_tasksid','hx_tasktitle','hx_taskdescription','hx_status','hx_priority',
             'hx_duedate','hx_startdate','_hx_assignee_value',
             'tms_isdelayed','tms_bu','tms_department'],
    filter: 'statecode eq 0',
    orderby: 'createdon desc',
  });
  return (res?.data ?? []).map(r => ({
    id: r.hx_tasksid,
    name: r.hx_tasktitle || '(untitled task)',
    description: r.hx_taskdescription || null,
    status: TASK_STATUS[r.hx_status] || null,
    priority: TASK_PRIORITY[r.hx_priority] || null,
    due: isoDay(r.hx_duedate),
    start: isoDay(r.hx_startdate),
    assigneeId: r._hx_assignee_value || null,
    assigneeName: r['_hx_assignee_value' + FV] || null,
    /* Free text, so it is compared case-insensitively wherever it is matched
       against a Business Unit's name -- same rule as the achievement table's
       stf_department. */
    bu: r.tms_bu || null,
    department: r.tms_department || null,
    delayed: r.tms_isdelayed || null,
  }));
}

/** The full record of each cited Task, for the Reports / Plans view.
 *
 *  A citation stores only a Task's id and name, and fetchTasks() above is the
 *  picker's list -- all 44k rows, so it stays lean. This reads just the Tasks a
 *  report actually cites, with everything a reader needs to judge one. Columns
 *  chosen 28 Sep by how often each is filled on IT's live rows (e.g. code,
 *  status, delay, type and recurrence on all 44,581; assignee/BU on 44,566;
 *  accountable and the related Leadership Practice on ~20,400), and each
 *  column's TYPE read from metadata, since selecting a lookup by its plain name
 *  fails the whole read:
 *    lookups -> hx_assignee, hx_accountable, cr18c_relatedleadershippractice
 *    choices -> hx_status, hx_priority, hx_recurrencetype, cr18c_tasksource
 *    text    -> hx_taskcode, hx_tasktype, tms_* (bu, department, isdelayed,
 *               leadershiptasklevel), hx_servicelevel
 *  Choice and lookup values come back as their formatted labels.
 *  cr18c_progressrollup is a 0-100 percentage.
 *
 *  Chunked by 15 ids, like fetchReportOccurrenceForEdit(), so the OR filter
 *  stays a URL the service accepts. Includes inactive Tasks: a report cites a
 *  Task whatever its state later becomes.
 *
 *  -> Map(taskId -> task) */
const TASK_FULL_SELECT = ['hx_tasksid','hx_tasktitle','hx_taskcode','hx_taskdescription','hx_justifications',
               'hx_status','hx_priority','hx_startdate','hx_duedate',
               '_hx_assignee_value','_hx_accountable_value','_cr18c_relatedleadershippractice_value',
               'tms_bu','tms_department','tms_isdelayed','hx_servicelevel','cr18c_progressrollup',
               'hx_tasktype','hx_recurrencetype','tms_leadershiptasklevel','cr18c_tasksource',
               'statecode'];
export async function fetchTasksByIds(ids = []){
  const out = new Map();
  const want = [...new Set(ids.filter(Boolean))];
  for(let i = 0; i < want.length; i += 15){
    const chunk = want.slice(i, i + 15);
    const res = await Hx_taskesService.getAll({
      filter: chunk.map(id => `hx_tasksid eq ${id}`).join(' or '),
      select: TASK_FULL_SELECT,
    });
    assertSuccess(res);
    for(const r of res.data ?? []) out.set(r.hx_tasksid, taskFromRow(r));
  }
  return out;
}

/* One hx_tasks row in the shape every task screen uses. */
function taskFromRow(r){
  return {
        id: r.hx_tasksid,
        name: r.hx_tasktitle || '(untitled task)',
        code: r.hx_taskcode || null,
        description: r.hx_taskdescription || null,
        action: r.hx_justifications || null,
        status: r['hx_status' + FV] || TASK_STATUS[r.hx_status] || null,
        priority: r['hx_priority' + FV] || TASK_PRIORITY[r.hx_priority] || null,
        start: isoDay(r.hx_startdate),
        due: isoDay(r.hx_duedate),
        /* the assignee's systemuser id -- a Teams @mention resolves it (05 Oct) */
        assigneeId: r._hx_assignee_value || null,
        assigneeName: r['_hx_assignee_value' + FV] || null,
        accountableName: r['_hx_accountable_value' + FV] || null,
        leadershipPractice: r['_cr18c_relatedleadershippractice_value' + FV] || null,
        bu: r.tms_bu || null,
        department: r.tms_department || null,
        delayed: r.tms_isdelayed || null,
        serviceLevel: r.hx_servicelevel || null,
        progress: typeof r.cr18c_progressrollup === 'number' ? r.cr18c_progressrollup : null,
        type: r.hx_tasktype || null,
        recurrence: r['hx_recurrencetype' + FV] || null,
        level: r.tms_leadershiptasklevel || null,
        source: r['cr18c_tasksource' + FV] || null,
        inactive: r.statecode === 1,
        /* the meeting links -- DT New only for now, see fetchTasksForMeeting */
        meetingId: r._lm_meetingoccurrence_value || null,
        agendaItemId: r._lm_meetingoccurrenceagendaitem_value || null,
  };
}

/** The Tasks raised in one meeting (01 Oct): linked to the occurrence itself
 *  (lm_MeetingOccurrence) or to one of its agenda items
 *  (lm_MeetingOccurrenceAgendaItem). Both lookups exist on hx_tasks in DT New;
 *  IT has neither yet (requested 29 Sep), and selecting a missing column fails
 *  the read -- so this returns NULL there, meaning "not available in this
 *  environment", which the Actions tab says in words. [] means "none". */
export async function fetchTasksForMeeting(occurrenceId, agendaItemIds = []){
  if(!occurrenceId) return [];
  const conds = [`_lm_meetingoccurrence_value eq ${occurrenceId}`,
                 ...[...new Set(agendaItemIds.filter(Boolean))].map(id => `_lm_meetingoccurrenceagendaitem_value eq ${id}`)];
  const byId = new Map();
  try{
    for(let i = 0; i < conds.length; i += 15){
      const res = await Hx_taskesService.getAll({
        filter: conds.slice(i, i + 15).join(' or '),
        select: [...TASK_FULL_SELECT, '_lm_meetingoccurrence_value', '_lm_meetingoccurrenceagendaitem_value'],
      });
      if(res?.success === false) return null;
      for(const r of res?.data ?? []) byId.set(r.hx_tasksid, taskFromRow(r));
    }
  }catch(e){
    console.warn('[dataverse] fetchTasksForMeeting(): tasks are not linked to meetings in this environment', e);
    return null;
  }
  return [...byId.values()];
}

/** Every Task linked to any of these meetings, directly or through one of
 *  their agenda items, in batched reads (15 conditions a request) -- for the
 *  Meetings export (06 Oct), so 100 meetings is a handful of requests, not
 *  100. Each Task carries `occurrenceId` and `agendaItemId`, resolved through
 *  the agenda item when the Task is linked only to that.
 *  @param {{id:string, agenda?:{id:string}[]}[]} occs
 *  @returns {Promise<object[]|null>} null when Tasks have no meeting link in
 *           this environment (the same signal as fetchTasksForMeeting). */
export async function fetchTasksForMeetings(occs = []){
  const occOfItem = new Map();
  const conds = [];
  for(const o of occs){
    if(!o?.id) continue;
    conds.push(`_lm_meetingoccurrence_value eq ${o.id}`);
    for(const a of o.agenda || []) if(a?.id){
      occOfItem.set(a.id, o.id);
      conds.push(`_lm_meetingoccurrenceagendaitem_value eq ${a.id}`);
    }
  }
  if(!conds.length) return [];
  const byId = new Map();
  try{
    for(let i = 0; i < conds.length; i += 15){
      const res = await Hx_taskesService.getAll({
        filter: conds.slice(i, i + 15).join(' or '),
        select: [...TASK_FULL_SELECT, '_lm_meetingoccurrence_value', '_lm_meetingoccurrenceagendaitem_value'],
      });
      if(res?.success === false) return null;
      for(const r of res?.data ?? []){
        const agendaItemId = r._lm_meetingoccurrenceagendaitem_value || null;
        byId.set(r.hx_tasksid, { ...taskFromRow(r), agendaItemId,
          occurrenceId: r._lm_meetingoccurrence_value || (agendaItemId && occOfItem.get(agendaItemId)) || null });
      }
    }
  }catch(e){
    console.warn('[dataverse] fetchTasksForMeetings(): tasks are not linked to meetings in this environment', e);
    return null;
  }
  return [...byId.values()];
}

/** Raises a Task on hx_tasks.
 *
 *  Status is left to Dataverse's own default rather than set here: the option
 *  set has seven values across three prefixes (hx_, tms_, a 931940001 from a
 *  fourth), which is the shape of a column several teams have added to, and
 *  guessing which one means "new" for their process is not this module's call.
 *
 *  Source, unlike Status, IS set: every Task raised from this app is a
 *  Leadership Task, so it defaults to 'Leadership' unless a caller names
 *  another TASK_SOURCE_KEY label.
 *
 *  @param {{title:string, description?:string, action?:string, assigneeId?:string,
 *           priority?:string, startDate?:string, dueDate?:string, source?:string}} t
 */
export async function createTask(t){
  const errors = [];
  const row = {
    hx_tasktitle: t.title,
    cr18c_tasksource: TASK_SOURCE_KEY[t.source || 'Leadership'] ?? TASK_SOURCE_KEY.Leadership,
    hx_taskdescription: t.description || null,
    /* "Action to be taken" has no column of its own; hx_justifications is the
       free-text field on this table that carries what is to be done and why. */
    hx_justifications: t.action || null,
    hx_priority: t.priority ? TASK_PRIORITY_KEY[t.priority] ?? null : null,
    hx_startdate: t.startDate || null,
    hx_duedate: t.dueDate || null,
  };
  if(t.assigneeId) row['hx_Assignee@odata.bind'] = `/systemusers(${t.assigneeId})`;
  /* Raised from a meeting's Minutes (01 Oct): the meeting and the agenda item.
     Both lookups exist on hx_tasks in DT New only; IT lacks them, so they are
     bound only when given -- a task raised anywhere else saves as before. */
  if(t.meetingOccurrenceId) row['lm_MeetingOccurrence@odata.bind'] = `/lm_meetingoccurrences(${t.meetingOccurrenceId})`;
  if(t.agendaItemId)        row['lm_MeetingOccurrenceAgendaItem@odata.bind'] = `/lm_meetingoccurrenceagendas(${t.agendaItemId})`;
  try{
    const created = await Hx_taskesService.create(row);
    /* idOrThrow() (top of file) surfaces created.error.message when the
       create genuinely fails -- e.g. a 404/insufficient-privilege response
       from the connector -- instead of the generic "created but no id
       returned" this used to always show regardless of the real cause. */
    const id = idOrThrow(created, 'hx_tasksid');
    return { id, errors };
  }catch(e){
    return { id:null, errors:[{ table:'hx_taskses', error:e }] };
  }
}

/** Existing Tasks to attach to a meeting agenda item (04 Oct), found on the
 *  SERVER by title or task code -- hx_tasks is far too large to list in the
 *  browser (44k+ rows in IT). Active Tasks only, newest first; the caller asks
 *  only once at least 3 characters are typed. Carries the current meeting
 *  links so the picker can say when attaching would move a Task.
 *  -> { rows: task[], more: boolean } -- `more` when over `limit` matched. */
export async function searchTasks(text, limit = 50){
  const q = String(text || '').trim();
  if(q.length < 3) return { rows: [], more: false };
  const lit = q.replace(/'/g, "''");
  const res = await Hx_taskesService.getAll({
    filter: `statecode eq 0 and (contains(hx_tasktitle,'${lit}') or contains(hx_taskcode,'${lit}'))`,
    select: [...TASK_FULL_SELECT, '_lm_meetingoccurrence_value', '_lm_meetingoccurrenceagendaitem_value'],
    orderBy: 'createdon desc',
  });
  assertSuccess(res);
  const all = (res.data ?? []).map(taskFromRow);
  return { rows: all.slice(0, limit), more: all.length > limit };
}

/** Attaches an EXISTING Task to a meeting and one of its agenda items -- the
 *  same two lookups createTask() binds when a Task is raised from the Minutes
 *  (DT New only; IT lacks both). Each lookup holds one target, so a Task
 *  already attached elsewhere moves here; the caller says so first. */
export async function linkTaskToMeeting(taskId, { meetingOccurrenceId, agendaItemId } = {}){
  if(!taskId || !meetingOccurrenceId)
    return { id: null, errors: [{ table:'hx_taskses', error: new Error('a task and a meeting are both required') }] };
  const patch = { 'lm_MeetingOccurrence@odata.bind': `/lm_meetingoccurrences(${meetingOccurrenceId})` };
  if(agendaItemId) patch['lm_MeetingOccurrenceAgendaItem@odata.bind'] = `/lm_meetingoccurrenceagendas(${agendaItemId})`;
  try{
    assertSuccess(await Hx_taskesService.update(taskId, patch));
    return { id: taskId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'hx_taskses', error:e }] };
  }
}

const MEETING_STAGE_KEY = {
  'Stage 1 BU Operational':1, 'Stage 2 Regional Functional':2,
  'Stage 3 Group Functional':3, 'Stage 4 Top Management, COO & CEO':4,
};
const MEETING_CATEGORY_KEY = {
  'Planning Meeting':124330000, 'Monitoring Meeting':124330001,
  'Clinical Meeting':124330002, 'Operational Meeting':124330003,
  'Technology Meeting':124330004, 'Cross-Functional Meeting':124330005,
  'Cross-Functional Team of Teams':124330006,
};
const AGENDA_ITEM_TYPE_KEY = { 'Migrated - Initial':1, 'Added':2 };
const LINKED_REPORT_TYPE_KEY = { 'Input':2, 'Output':1 };

// Read-side decodes for a Meeting Template's setupTypeCode / categoryCode /
// frequencyCode / dayOfWeekCode (see fetchMeetingTemplatesList below) --
// the inverse of the *_KEY maps above, which only serve the write path.
export const MEETING_SETUP_TYPE = { 1:'Business Meeting', 2:'Accreditation Committee' };
export const MEETING_CATEGORY = {
  124330000:'Planning Meeting', 124330001:'Monitoring Meeting',
  124330002:'Clinical Meeting', 124330003:'Operational Meeting',
  124330004:'Technology Meeting', 124330005:'Cross-Functional Meeting',
  124330006:'Cross-Functional Team of Teams',
};
export const MEETING_FREQUENCY = {
  1:'Daily', 2:'Twice Weekly', 3:'Weekly', 4:'Twice Monthly', 5:'Monthly',
  6:'Quarterly', 7:'Semesterly', 8:'Annually', 9:'Custom',
};
export const MEETING_DAY_OF_WEEK = {
  124330000:'Sunday', 124330001:'Monday', 124330002:'Tuesday',
  124330003:'Wednesday', 124330004:'Thursday',
};
export const MEETING_SECOND_DAY_OF_WEEK = {
  1:'Sunday', 2:'Monday', 3:'Tuesday', 4:'Wednesday', 5:'Thursday',
};
export const MEETING_MONTH_IN_SEMESTER = {
  1:'1st month', 2:'2nd month', 3:'3rd month', 4:'4th month', 5:'5th month', 6:'6th month',
};
export const MEETING_MONTH_IN_QUARTER = {
  124330000:'1st month', 124330001:'2nd month', 124330002:'3rd month',
};

/**
 * Saves a Committee/Meeting Setup to Dataverse: creates the parent
 * lm_meetingtemplates row, then its child rows.
 *
 * Chairman/Co-Chairman/Facilitator/Agenda-item-owner/Attendees are all
 * Position lookups (cr603_organizationstructures), matching how the app
 * already treats every one of these as a Position pick -- not a direct
 * User lookup.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} [payload.setupType] one of MEETING_SETUP_TYPE_KEY's keys
 * @param {string} [payload.category] one of MEETING_CATEGORY_KEY's keys
 * @param {string} [payload.stage] one of MEETING_STAGE_KEY's keys
 * @param {string} [payload.frequency] one of MEETING_FREQUENCY_KEY's keys
 * @param {string} [payload.dayOfWeek] one of MEETING_DAY_OF_WEEK_KEY's keys
 * @param {number} [payload.dayOfMonth]
 * @param {string} [payload.monthInQuarter] one of MEETING_MONTH_IN_QUARTER_KEY's keys
 * @param {string} [payload.secondDayOfWeek] one of MEETING_SECOND_DAY_OF_WEEK_KEY's keys (Twice Weekly)
 * @param {number} [payload.secondDayOfMonth] (Twice Monthly)
 * @param {string} [payload.monthInSemester] one of MEETING_MONTH_IN_SEMESTER_KEY's keys (Semesterly)
 * @param {string} [payload.mode] one of MEETING_MODE_KEY's keys
 * @param {string} [payload.confidentiality] one of MEETING_CONFIDENTIALITY_KEY's keys
 * @param {number} [payload.quorum]
 * @param {number} [payload.momWriteupHours] elapsed hours, Meeting ends -> MOM submitted
 * @param {number} [payload.momApprovalHours] elapsed hours, MOM submitted -> Chair approves
 * @param {number} [payload.gridSubmitHours] elapsed hours, Audit Grid created -> submitted to Chair
 * @param {string} [payload.torLink]
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' currently create per-unit child rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,chairmanId?:string,coChairmanId?:string,facilitatorId?:string,attendees?:{positionId?:string,groupRowId?:string,groupName?:string,type?:number}[]}[]} [payload.units] one entry per configured unit, each with its own Attendees list --
 *        an attendee is either a Position (`positionId`) or a Microsoft Group (`groupRowId` + `groupName`), `type` 1 Core / 2 Supportive
 * @param {string} [payload.meetingCategoryId] lm_meetingcategory row id, from fetchMeetingCategories()
 * @param {string} [payload.meetingCategoryName] that row's name, stamped so a later rename
 *        in the Taxonomy application cannot restate Setups already published
 * @param {{step:number, text:string, ownerId?:string, source:string}[]} [payload.agenda]
 * @param {{departmentId:string, functionId?:string}[]} [payload.lines]
 * @param {{name:string, functionId?:string}[]} [payload.supportive]
 * @param {{name:string, role:string, reportTemplateId?:string}[]} [payload.linkedReports] role is 'Input'|'Output'; reportTemplateId links a real lm_report_templates row when known (see REPORT_DATAVERSE_ID in GovernanceApp.jsx), otherwise the name is still written as free text
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
// Same reasoning as reportTemplateParentPayload above: shared by create and
// update, every field explicit (null, never omitted) so update() can
// actually clear a field the user emptied out.
//
// Chairman/Co-Chairman/Facilitator are normally per-unit (see
// createMeetingTemplateChildren) -- but a Stage 3/4 (group-wide) Setup has
// no per-unit child table, so its one "section" is payload.units[0], and
// these three now live on the parent row instead (added to
// lm_meetingtemplates specifically to cover this case). Only ever
// conditionally SET, never explicitly cleared -- same as every other
// lookup written by this file, since Dataverse doesn't clear a lookup via
// a plain PATCH value the way it clears a text/choice field.
function meetingTemplateParentPayload(payload){
  const groupUnit = payload.stageLevel==='group' ? (payload.units||[])[0] : null;
  const row = {
    lm_meetingtemplatename: payload.name || 'Untitled Meeting Setup',
    lm_setuptype: payload.setupType ? MEETING_SETUP_TYPE_KEY[payload.setupType] : null,
    lm_typeclassification: payload.category ? MEETING_CATEGORY_KEY[payload.category] : null,
    /* The name is stamped beside the lookup, not derived from it on read --
       see this file's note on lm_Category_Name. Written even when the lookup
       is empty, so a Setup saved before the Category list existed still says
       what it was. */
    lm_category_name: payload.meetingCategoryName || null,
    lm_stages: payload.stage ? MEETING_STAGE_KEY[payload.stage] : null,
    lm_frequency: payload.frequency ? MEETING_FREQUENCY_KEY[payload.frequency] : null,
    lm_daysoftheweek: payload.dayOfWeek ? MEETING_DAY_OF_WEEK_KEY[payload.dayOfWeek] : null,
    /* Same either/or toggle as the Report Template side -- see
       reportTemplateParentPayload()'s note on lm_dayofweeks: a comma-
       separated string, confirmed live 23 Sep, never an array. */
    lm_dayofweeks: (payload.dayOfWeeks||[]).length
      ? payload.dayOfWeeks.map(n => DAY_OF_WEEKS_MULTI_KEY[n]).filter(n => n != null).join(',')
      : null,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : null,
    lm_monthofthequarter: payload.monthInQuarter ? MEETING_MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : null,
    lm_seconddayoftheweek: payload.secondDayOfWeek ? MEETING_SECOND_DAY_OF_WEEK_KEY[payload.secondDayOfWeek] : null,
    lm_seconddayofthemonth: typeof payload.secondDayOfMonth === 'number' ? payload.secondDayOfMonth : null,
    lm_monthofthesemesterseme: payload.monthInSemester ? MEETING_MONTH_IN_SEMESTER_KEY[payload.monthInSemester] : null,
    /* The calendar month an Annual Meeting falls in (29 Sep). cr18c_month is
       the global pm_month choice, 1 = January ... 12 = December -- the same
       numbers as the Report Template's lm_month, so MONTH_KEY serves both.
       Present in IT and DT New alike. */
    cr18c_month: payload.month ? MONTH_KEY[payload.month] : null,
    lm_defaultmeetingmode: payload.mode ? MEETING_MODE_KEY[payload.mode] : null,
    lm_meetingconfidentiality: payload.confidentiality ? MEETING_CONFIDENTIALITY_KEY[payload.confidentiality] : null,
    lm_quorumthreshold: typeof payload.quorum === 'number' ? payload.quorum : null,
    lm_momwriteuphours: typeof payload.momWriteupHours === 'number' ? payload.momWriteupHours : null,
    lm_momapprovalhours: typeof payload.momApprovalHours === 'number' ? payload.momApprovalHours : null,
    lm_gridsubmithours: typeof payload.gridSubmitHours === 'number' ? payload.gridSubmitHours : null,
    lm_torpolicylink: payload.torLink || null,
    lm_meetingstatus: payload.status ? TEMPLATE_STATUS_KEY[payload.status] : null,
    lm_version: typeof payload.version === 'number' ? payload.version : null,
  };
  /* Never bound with an empty id -- `/lm_meetingcategories()` is a 400. */
  if(payload.meetingCategoryId) row['lm_Category@odata.bind'] = `/lm_meetingcategories(${payload.meetingCategoryId})`;
  if(groupUnit?.chairmanId)    row['lm_MeetingChairman@odata.bind']            = `/cr603_organizationstructures(${groupUnit.chairmanId})`;
  if(groupUnit?.coChairmanId)  row['lm_MeetingCoChairman@odata.bind']          = `/cr603_organizationstructures(${groupUnit.coChairmanId})`;
  if(groupUnit?.facilitatorId) row['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${groupUnit.facilitatorId})`;
  /* lm_meetingtemplate carries its own lm_TeamChannel, same as Chairman/
     Co-Chairman/Facilitator above -- the group-wide unit card renders a
     Channel picker identically to a BU/Region one (UnitSetup has no
     scope-level gate on it), so this was a real, silent data-loss gap, not a
     deliberate omission: reportTemplateParentPayload() already writes the
     equivalent field for a group-wide Report Template (see groupUnit above
     there too) -- confirmed live 23 Sep while auditing every Template lookup
     against the real schema. */
  if(groupUnit?.channelId)     row['lm_TeamChannel@odata.bind']                = `/and_teamschannellinks(${groupUnit.channelId})`;
  return row;
}

/* Reconciles a Meeting Setup's unit rows and their Attendees against what the
   Setup now says, keeping every row that is still wanted.

   Everything else on a Meeting Setup -- agenda, department/function lines,
   supportive functions, linked reports -- is still delete-and-recreate. Those
   are flat, ordered, template-level lists that nothing holds a reference to,
   so churning their ids costs nothing. Unit rows are different: the Attendees
   list points at one, so recreating a unit orphaned or rebuilt its people. */
async function reconcileMeetingUnits(templateId, payload, existing, errors){
  const bind = `/lm_meetingtemplates(${templateId})`;
  const level = payload.stageLevel;
  const units = payload.units || [];

  /* A group-wide Setup has no sections, but a Stage 4 MEETING may name the
     units it covers (payload.scopeBusinessUnits / scopeRegions, 28 Sep). Those
     reconcile through the same tables as scope-only rows: no roles, no
     Attendees -- so roleFields()/roleDiff() below write nothing but the name,
     and the Attendees pass further down finds no attendees on them. With
     neither list set, a group-wide Setup still wants no unit rows at all. */
  const buWanted     = level === 'bu'     ? units.filter(u => u?.businessUnitId)
                     : level === 'group'  ? (payload.scopeBusinessUnits || []).filter(u => u?.businessUnitId)
                     : [];
  const regionWanted = level === 'region' ? units.filter(u => u?.regionId)
                     : level === 'group'  ? (payload.scopeRegions || []).filter(u => u?.regionId)
                     : [];

  const posBind = id => id ? `/cr603_organizationstructures(${id})` : undefined;
  const roleFields = u => {
    const f = {};
    if(u.chairmanId)    f['lm_MeetingChairman@odata.bind'] = posBind(u.chairmanId);
    if(u.coChairmanId)  f['lm_MeetingCoChairman@odata.bind'] = posBind(u.coChairmanId);
    if(u.facilitatorId) f['lm_MeetingOrganizerFacilitator@odata.bind'] = posBind(u.facilitatorId);
    if(u.channelId)     f['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${u.channelId})`;
    return f;
  };
  /* Only the fields that actually differ. A lookup that was cleared in the
     Setup is left alone: Dataverse does not clear a lookup through a plain
     PATCH value, which is the same limitation every other write here has. */
  const roleDiff = (u, row) => {
    const patch = {};
    if((row.lm_name || null) !== (u.name || null)) patch.lm_name = u.name || null;
    if(u.chairmanId    && lookupChanged(row._lm_meetingchairman_value, u.chairmanId))
      patch['lm_MeetingChairman@odata.bind'] = posBind(u.chairmanId);
    if(u.coChairmanId  && lookupChanged(row._lm_meetingcochairman_value, u.coChairmanId))
      patch['lm_MeetingCoChairman@odata.bind'] = posBind(u.coChairmanId);
    if(u.facilitatorId && lookupChanged(row._lm_meetingorganizerfacilitator_value, u.facilitatorId))
      patch['lm_MeetingOrganizerFacilitator@odata.bind'] = posBind(u.facilitatorId);
    if(u.channelId     && lookupChanged(row._lm_teamchannel_value, u.channelId))
      patch['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${u.channelId})`;
    return patch;
  };

  const buIds = await reconcileRows({
    service: Lm_meetingtemplatebusinessunitsesService,
    existing: existing?.businessUnits, wanted: buWanted,
    idField: 'lm_meetingtemplatebusinessunitsid', table: 'lm_meetingtemplatebusinessunitses',
    keyOfExisting: r => r._lm_businessunit_value,
    keyOfWanted:   u => u.businessUnitId,
    build: u => ({ 'lm_MeetingTemplate@odata.bind': bind,
                   'lm_BusinessUnit@odata.bind': `/businessunits(${u.businessUnitId})`,
                   lm_name: u.name || undefined, ...roleFields(u) }),
    diff: roleDiff, errors,
  });

  const regionIds = await reconcileRows({
    service: Lm_meetingtemplateregionsService,
    existing: existing?.regions, wanted: regionWanted,
    idField: 'lm_meetingtemplateregionid', table: 'lm_meetingtemplateregions',
    keyOfExisting: r => r._lm_region_value,
    keyOfWanted:   u => u.regionId,
    build: u => ({ 'lm_MeetingTemplate@odata.bind': bind,
                   'lm_Region@odata.bind': `/crd04_regionses(${u.regionId})`,
                   lm_name: u.name || undefined, ...roleFields(u) }),
    diff: roleDiff, errors,
  });

  /* Attendees, per surviving unit. */
  const byUnit = existing?.attendeesByUnit || new Map();
  const doAttendees = async (unit, unitRowId, lookupField, unitSet) => {
    if(!unitRowId) return;
    await reconcileRows({
      service: Lm_meetingattendeeslistsService,
      existing: byUnit.get(unitRowId) || [],
      wanted: (unit.attendees || []).filter(a => attendeeKey(a)),
      idField: 'lm_meetingattendeeslistid', table: 'lm_meetingattendeeslists',
      keyOfExisting: attendeeKeyOfRow,
      keyOfWanted:   attendeeKey,
      build: a => ({
        /* Same shape the create path writes: the template bind AND the
           per-unit one. Dropping the template bind here would leave rows the
           template-level queries cannot see. */
        'lm_MeetingTemplate@odata.bind': `/lm_meetingtemplates(${templateId})`,
        [lookupField]: `/${unitSet}(${unitRowId})`,
        ...attendeeFields(a),
      }),
      /* Who the attendee is cannot change without changing the key, so the
         only thing a surviving row can differ in is Core vs Supportive. */
      diff: (a, row) => (row.lm_attendeetype || 1) === (a.type || 1)
        ? {} : { lm_attendeetype: a.type || 1 },
      errors,
    });
  };

  for(const u of buWanted)
    await doAttendees(u, buIds.get(String(u.businessUnitId)),
      'lm_MeetingTemplatePerBusinessUnit@odata.bind', 'lm_meetingtemplatebusinessunitses');
  for(const u of regionWanted)
    await doAttendees(u, regionIds.get(String(u.regionId)),
      'lm_MeetingTemplatePerRegion@odata.bind', 'lm_meetingtemplateregions');
}

/** Same role as createReportTemplateChildren above, for the Meeting side:
 *  creates every child row (per-unit Business Unit/Region rows with their
 *  own Attendees, plus template-level agenda/lines/supportive/linked-report
 *  rows) for an already-existing lm_meetingtemplates row. Mutates `errors`
 *  in place. */
async function createMeetingTemplateChildren(templateId, payload, errors, opts = {}){
  const bind = `/lm_meetingtemplates(${templateId})`;

  /* A Stage 4 meeting's Categories -- one lm_topmanagementmeetingcategories row
     each, on first save. The update path reconciles them instead. */
  if(!opts.skipUnits){
    for(const c of (payload.topCategories || [])){
      if(!c?.categoryId) continue;
      try{ await Lm_topmanagementmeetingcategoriesService.create(topCategoryRow(templateId, c)); }
      catch(e){ errors.push({ table:'lm_topmanagementmeetingcategories', error:e }); }
    }
  }

  /* A Stage 4 meeting's covered units (see reconcileMeetingUnits): scope-only
     rows, created once here on first save; the update path reconciles them
     instead, so they are skipped with the other unit rows there. */
  if(payload.stageLevel === 'group' && !opts.skipUnits){
    for(const u of (payload.scopeBusinessUnits || [])){
      if(!u?.businessUnitId) continue;
      try{
        await Lm_meetingtemplatebusinessunitsesService.create({
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_BusinessUnit@odata.bind': `/businessunits(${u.businessUnitId})`,
          lm_name: u.name || undefined,
        });
      }catch(e){ errors.push({ table:'lm_meetingtemplatebusinessunitses', error:e }); }
    }
    for(const u of (payload.scopeRegions || [])){
      if(!u?.regionId) continue;
      try{
        await Lm_meetingtemplateregionsService.create({
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_Region@odata.bind': `/crd04_regionses(${u.regionId})`,
          lm_name: u.name || undefined,
        });
      }catch(e){ errors.push({ table:'lm_meetingtemplateregions', error:e }); }
    }
  }

  // One lm_meetingtemplatebusinessunitses / lm_meetingtemplateregions row
  // per configured unit, each with its own Chairman/Co-Chairman/
  // Facilitator, and its own Attendees list bound back to that specific
  // unit row via lm_MeetingTemplatePerBusinessUnit /
  // lm_MeetingTemplatePerRegion on lm_meetingattendeeslists. A group-wide
  // Setup has no per-unit row to create -- lm_meetingattendeeslists binds
  // straight to lm_MeetingTemplate instead (the same lookup every attendee
  // row already carries regardless of scope), so its single synthetic unit
  // still reaches the Attendees loop below with unitBind/unitLookupField
  // left null. Confirmed live 23 Sep while auditing every Template lookup:
  // the wizard's Attendees picker already renders for a group-wide unit
  // exactly like a BU/Region one, so attendees typed in there were being
  // silently discarded -- this branch, plus the matching read-side fix in
  // fetchMeetingTemplateDetail()/fetchMeetingTemplateChildIds(), closes it.
  for(const unit of (payload.units||[])){
    let unitBind = null, unitLookupField = null;

    if(payload.stageLevel==='bu' && unit?.businessUnitId){
      /* On the update path this unit row and its Attendees have already been
         reconciled in place, so this branch must not run again here -- it
         would create a second copy of the unit. Group-wide has no equivalent
         reconcile (see reconcileMeetingUnits, which only ever handles 'bu'/
         'region'), so it is deliberately NOT covered by this same skip --
         see the delete-then-recreate pair in updateMeetingTemplateToDataverse
         instead, the same treatment every other flat list already gets. */
      if(opts.skipUnits) continue;
      try{
        const rowPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_BusinessUnit@odata.bind': `/businessunits(${unit.businessUnitId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.chairmanId)    rowPayload['lm_MeetingChairman@odata.bind'] = `/cr603_organizationstructures(${unit.chairmanId})`;
        if(unit.coChairmanId)  rowPayload['lm_MeetingCoChairman@odata.bind'] = `/cr603_organizationstructures(${unit.coChairmanId})`;
        if(unit.facilitatorId) rowPayload['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${unit.facilitatorId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${unit.channelId})`;
        const created = await Lm_meetingtemplatebusinessunitsesService.create(rowPayload);
        const rowId = created?.data?.lm_meetingtemplatebusinessunitsid;
        if(rowId){ unitBind = `/lm_meetingtemplatebusinessunitses(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerBusinessUnit@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_meetingtemplatebusinessunitses', error:e }); }
    }else if(payload.stageLevel==='region' && unit?.regionId){
      if(opts.skipUnits) continue; // see the comment on the 'bu' branch above
      try{
        const rowPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_Region@odata.bind': `/crd04_regionses(${unit.regionId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.chairmanId)    rowPayload['lm_MeetingChairman@odata.bind'] = `/cr603_organizationstructures(${unit.chairmanId})`;
        if(unit.coChairmanId)  rowPayload['lm_MeetingCoChairman@odata.bind'] = `/cr603_organizationstructures(${unit.coChairmanId})`;
        if(unit.facilitatorId) rowPayload['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${unit.facilitatorId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannellinks(${unit.channelId})`;
        const created = await Lm_meetingtemplateregionsService.create(rowPayload);
        const rowId = created?.data?.lm_meetingtemplateregionid;
        if(rowId){ unitBind = `/lm_meetingtemplateregions(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerRegion@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_meetingtemplateregions', error:e }); }
    }else if(payload.stageLevel==='group'){
      /* No per-unit row exists or is needed -- fall straight through to the
         Attendees loop below with unitBind/unitLookupField still null, which
         it already tolerates (see the guard right before the create call). */
    }else{
      console.warn(`[dataverse] Meeting Template unit "${unit?.name||unit?.key}" at "${payload.stageLevel}" level matched no known scope -- its Attendees, if any, were not saved.`);
      continue;
    }

    for(const att of (unit.attendees||[])){
      if(!attendeeKey(att)) continue;
      try{
        const attPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          ...attendeeFields(att),
        };
        if(unitBind && unitLookupField) attPayload[unitLookupField] = unitBind;
        await Lm_meetingattendeeslistsService.create(attPayload);
      }catch(e){ errors.push({ table:'lm_meetingattendeeslists', error:e }); }
    }
  }

  for(const item of (payload.agenda||[])){
    if(!item.text) continue;
    try{
      const rowPayload = {
        'lm_MeetingTemplate@odata.bind': bind,
        lm_agendaitemname: item.text,
        lm_step: item.step,
        lm_agendaitemtype: AGENDA_ITEM_TYPE_KEY[item.source] ?? AGENDA_ITEM_TYPE_KEY['Migrated - Initial'],
      };
      if(item.ownerId) rowPayload['lm_AgendaItemOwner@odata.bind'] = `/cr603_organizationstructures(${item.ownerId})`;
      await Lm_meetingtemplateagendaitemsService.create(rowPayload);
    }catch(e){ errors.push({ table:'lm_meetingtemplateagendaitems', error:e }); }
  }

  for(const line of (payload.lines||[])){
    if(!line?.departmentId) continue;
    try{
      const rowPayload = { 'lm_Meetingtemplate@odata.bind': bind, 'lm_Department@odata.bind': `/cr603_chklst_departmentses(${line.departmentId})` };
      if(line.functionId) rowPayload['lm_Function@odata.bind'] = `/hr_functions(${line.functionId})`;
      await Lm_meetingtemplatedepartmentfunctionsService.create(rowPayload);
    }catch(e){ errors.push({ table:'lm_meetingtemplatedepartmentfunctions', error:e }); }
  }

  for(const sup of (payload.supportive||[])){
    if(!sup?.name) continue;
    try{
      const rowPayload = { 'lm_MeetingTemplate@odata.bind': bind, lm_newcolumn: sup.name };
      if(sup.functionId) rowPayload['lm_Function@odata.bind'] = `/hr_functions(${sup.functionId})`;
      await Lm_meetingtemplatesupportivefunctionsesService.create(rowPayload);
    }catch(e){ errors.push({ table:'lm_meetingtemplatesupportivefunctionses', error:e }); }
  }

  for(const lr of (payload.linkedReports||[])){
    if(!lr?.name) continue;
    try{
      const rowPayload = {
        'lm_MeetingTemplate@odata.bind': bind,
        lm_name: lr.name, // kept even with a real link, for readability on the row
        lm_reporttype: LINKED_REPORT_TYPE_KEY[lr.role] ?? LINKED_REPORT_TYPE_KEY['Input'],
      };
      if(lr.reportTemplateId) rowPayload['lm_ReportTemplate@odata.bind'] = `/lm_report_templates(${lr.reportTemplateId})`;
      await Lm_meetingtemplatelinkedreportsesService.create(rowPayload);
    }catch(e){ errors.push({ table:'lm_meetingtemplatelinkedreportses', error:e }); }
  }
}

/** Ids only for every child row -- including each Business-Unit/Region
 *  row's own Attendees list -- of one Meeting Template. Used by
 *  updateMeetingTemplateToDataverse() to know exactly what to delete
 *  before recreating from the edited payload. */
async function fetchMeetingTemplateChildIds(dvId){
  const filter = `_lm_meetingtemplate_value eq ${dvId}`;
  const [agendaRes, linesRes, supportiveRes, linkedRes, busRes, regionsRes, topCatRes] = await Promise.all([
    Lm_meetingtemplateagendaitemsService.getAll({ filter, select:['lm_meetingtemplateagendaitemid'] }),
    Lm_meetingtemplatedepartmentfunctionsService.getAll({ filter, select:['lm_meetingtemplatedepartmentfunctionid'] }),
    Lm_meetingtemplatesupportivefunctionsesService.getAll({ filter, select:['lm_meetingtemplatesupportivefunctionsid'] }),
    Lm_meetingtemplatelinkedreportsesService.getAll({ filter, select:['lm_meetingtemplatelinkedreportsid'] }),
    /* The unit rows carry their identifying lookup and their own fields, not
       just an id: reconcileRows() needs them to tell an existing unit from a
       new one, and to know whether anything on it actually changed. */
    Lm_meetingtemplatebusinessunitsesService.getAll({ filter, select:['lm_meetingtemplatebusinessunitsid',
      'lm_name','_lm_businessunit_value','_lm_meetingchairman_value','_lm_meetingcochairman_value',
      '_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
    Lm_meetingtemplateregionsService.getAll({ filter, select:['lm_meetingtemplateregionid',
      'lm_name','_lm_region_value','_lm_meetingchairman_value','_lm_meetingcochairman_value',
      '_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
    Lm_topmanagementmeetingcategoriesService.getAll({ filter, select: TOP_CATEGORY_SELECT }),
  ]);
  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];
  /* Attendees are kept PER UNIT rather than flattened: an attendee is only
     the same attendee within the same unit, so the diff has to run per unit. */
  const [buAttendees, regionAttendees, groupAttendeesRes] = await Promise.all([
    Promise.all(businessUnits.map(bu => Lm_meetingattendeeslistsService.getAll({
      filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_meetingtemplatebusinessunitsid}`,
      select: ATTENDEE_SELECT,
    }).then(r=>r?.data??[]).catch(()=>[]))),
    Promise.all(regions.map(rg => Lm_meetingattendeeslistsService.getAll({
      filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_meetingtemplateregionid}`,
      select: ATTENDEE_SELECT,
    }).then(r=>r?.data??[]).catch(()=>[]))),
    /* A group-wide (Stage 3/4) attendee has neither per-unit lookup set --
       there is no unit row for it to bind to -- so it is told apart from a
       stray/orphaned row the same way, by both being null, not by scope
       level (this function does not know payload.stageLevel, only the id). */
    Lm_meetingattendeeslistsService.getAll({
      filter: `${filter} and _lm_meetingtemplateperbusinessunit_value eq null and _lm_meetingtemplateperregion_value eq null`,
      select: ATTENDEE_SELECT,
    }).then(r=>r?.data??[]).catch(()=>[]),
  ]);
  return {
    agenda: agendaRes?.data ?? [],
    lines: linesRes?.data ?? [],
    supportive: supportiveRes?.data ?? [],
    linkedReports: linkedRes?.data ?? [],
    businessUnits, regions,
    topCategories: topCatRes?.data ?? [],
    attendees: [...buAttendees.flat(), ...regionAttendees.flat()],
    groupAttendees: groupAttendeesRes,
    /* keyed by unit row id, for the reconcile path */
    attendeesByUnit: new Map([
      ...businessUnits.map((bu,i) => [bu.lm_meetingtemplatebusinessunitsid, buAttendees[i]]),
      ...regions.map((rg,i) => [rg.lm_meetingtemplateregionid, regionAttendees[i]]),
    ]),
  };
}

/**
 * Saves a Committee/Meeting Setup to Dataverse: creates the parent
 * lm_meetingtemplates row, then its child rows.
 *
 * Chairman/Co-Chairman/Facilitator/Agenda-item-owner/Attendees are all
 * Position lookups (cr603_organizationstructures), matching how the app
 * already treats every one of these as a Position pick -- not a direct
 * User lookup.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} [payload.setupType] one of MEETING_SETUP_TYPE_KEY's keys
 * @param {string} [payload.category] one of MEETING_CATEGORY_KEY's keys
 * @param {string} [payload.stage] one of MEETING_STAGE_KEY's keys
 * @param {string} [payload.frequency] one of MEETING_FREQUENCY_KEY's keys
 * @param {string} [payload.dayOfWeek] one of MEETING_DAY_OF_WEEK_KEY's keys
 * @param {number} [payload.dayOfMonth]
 * @param {string} [payload.monthInQuarter] one of MEETING_MONTH_IN_QUARTER_KEY's keys
 * @param {string} [payload.secondDayOfWeek] one of MEETING_SECOND_DAY_OF_WEEK_KEY's keys (Twice Weekly)
 * @param {number} [payload.secondDayOfMonth] (Twice Monthly)
 * @param {string} [payload.monthInSemester] one of MEETING_MONTH_IN_SEMESTER_KEY's keys (Semesterly)
 * @param {string} [payload.mode] one of MEETING_MODE_KEY's keys
 * @param {string} [payload.confidentiality] one of MEETING_CONFIDENTIALITY_KEY's keys
 * @param {number} [payload.quorum]
 * @param {number} [payload.momWriteupHours] elapsed hours, Meeting ends -> MOM submitted
 * @param {number} [payload.momApprovalHours] elapsed hours, MOM submitted -> Chair approves
 * @param {number} [payload.gridSubmitHours] elapsed hours, Audit Grid created -> submitted to Chair
 * @param {string} [payload.torLink]
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' create per-unit SECTION rows
 * @param {{businessUnitId:string,name?:string}[]} [payload.scopeBusinessUnits] Stage 4 meeting only: Business Units it covers, written as scope-only lm_meetingtemplatebusinessunitses rows (no roles, no Attendees)
 * @param {{regionId:string,name?:string}[]} [payload.scopeRegions] Stage 4 meeting only: Regions it covers, as scope-only lm_meetingtemplateregions rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,chairmanId?:string,coChairmanId?:string,facilitatorId?:string,attendees?:{positionId?:string,groupRowId?:string,groupName?:string,type?:number}[]}[]} [payload.units] one entry per configured unit, each with its own Attendees list --
 *        an attendee is either a Position (`positionId`) or a Microsoft Group (`groupRowId` + `groupName`), `type` 1 Core / 2 Supportive
 * @param {string} [payload.meetingCategoryId] lm_meetingcategory row id, from fetchMeetingCategories()
 * @param {string} [payload.meetingCategoryName] that row's name, stamped so a later rename
 *        in the Taxonomy application cannot restate Setups already published
 * @param {{step:number, text:string, ownerId?:string, source:string}[]} [payload.agenda]
 * @param {{departmentId:string, functionId?:string}[]} [payload.lines]
 * @param {{name:string, functionId?:string}[]} [payload.supportive]
 * @param {{name:string, role:string, reportTemplateId?:string}[]} [payload.linkedReports] role is 'Input'|'Output'; reportTemplateId links a real lm_report_templates row when known (see REPORT_DATAVERSE_ID in GovernanceApp.jsx), otherwise the name is still written as free text
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function saveMeetingTemplateToDataverse(payload){
  const errors = [];

  let templateId = null;
  try{
    const created = await Lm_meetingtemplatesService.create(meetingTemplateParentPayload(payload));
    templateId = idOrThrow(created, 'lm_meetingtemplateid');
  }catch(e){
    errors.push({ table:'lm_meetingtemplates', error:e });
    return { id:null, errors };
  }

  await createMeetingTemplateChildren(templateId, payload, errors);
  return { id: templateId, errors };
}

/**
 * Updates an existing Committee/Meeting Setup in Dataverse in place: patches
 * the parent lm_meetingtemplates row, then reconciles every child table
 * (per-unit Business Unit/Region rows and their Attendees, agenda items,
 * department/function lines, supportive functions, linked reports) by
 * deleting every existing child row for this template and recreating the
 * full set from the edited payload.
 *
 * Same delete-then-recreate reasoning as updateReportTemplateToDataverse
 * above -- e.g. a Setup that goes from Stage 1 with 2 Business Units to
 * Stage 2 with Regions has its lm_meetingtemplatebusinessunitses rows (and
 * their Attendees) deleted, and fresh lm_meetingtemplateregions rows (with
 * fresh Attendees) created in their place.
 *
 * @param {string} dvId the real lm_meetingtemplateid being edited
 * @param {object} payload same shape as saveMeetingTemplateToDataverse's payload
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function updateMeetingTemplateToDataverse(dvId, payload){
  const errors = [];

  try{
    /* assertSuccess, not a bare await. The SDK does NOT throw on a Dataverse
       validation failure -- it resolves with { success:false, error } -- so
       this PATCH could be rejected and the caller would still be told the
       Setup saved. That silently swallowed the lm_version bump on a
       re-publish: the local Setup showed version N+1 while Dataverse kept N,
       and the next publish computed N+1 again from the stale read. */
    const parentResult = await Lm_meetingtemplatesService.update(dvId, meetingTemplateParentPayload(payload));
    assertSuccess(parentResult);
  }catch(e){
    errors.push({ table:'lm_meetingtemplates', error:e });
    return { id:null, errors };
  }

  let existing = null;
  try{
    existing = await fetchMeetingTemplateChildIds(dvId);
  }catch(e){
    errors.push({ table:'lm_meetingtemplates(read existing children)', error:e });
  }

  if(existing){
    /* Unit rows and their Attendees are RECONCILED, not deleted: adding one
       Business Unit or one Attendee must not rewrite the others. Everything
       below is a flat, template-level list that nothing references by id, so
       delete-and-recreate stays -- it is simpler and costs nothing there.
       Group-wide Attendees have no unit row to reconcile against (see
       createMeetingTemplateChildren's 'group' branch), so they get the same
       delete-and-recreate treatment as the other flat lists here, not the
       reconcileMeetingUnits() treatment above. */
    await reconcileMeetingUnits(dvId, payload, existing, errors);
    /* Stage 4 Categories: keep the rows still ticked, add new ones, remove the
       rest -- including every row when the Setup is no longer Stage 4. */
    await reconcileRows({
      service: Lm_topmanagementmeetingcategoriesService,
      existing: existing.topCategories, wanted: (payload.topCategories || []).filter(c => c?.categoryId),
      idField: 'lm_topmanagementmeetingcategoryid', table: 'lm_topmanagementmeetingcategories',
      keyOfExisting: r => r._lm_meetingcategory_value,
      keyOfWanted:   c => c.categoryId,
      build: c => topCategoryRow(dvId, c),
      diff: (c, row) => (row.lm_name || null) === (c.name || null) ? {} : { lm_name: c.name || null },
      errors,
    });

    await deleteRows(Lm_meetingtemplateagendaitemsService, existing.agenda, 'lm_meetingtemplateagendaitemid', 'lm_meetingtemplateagendaitems', errors);
    await deleteRows(Lm_meetingtemplatedepartmentfunctionsService, existing.lines, 'lm_meetingtemplatedepartmentfunctionid', 'lm_meetingtemplatedepartmentfunctions', errors);
    await deleteRows(Lm_meetingtemplatesupportivefunctionsesService, existing.supportive, 'lm_meetingtemplatesupportivefunctionsid', 'lm_meetingtemplatesupportivefunctionses', errors);
    await deleteRows(Lm_meetingtemplatelinkedreportsesService, existing.linkedReports, 'lm_meetingtemplatelinkedreportsid', 'lm_meetingtemplatelinkedreportses', errors);
    await deleteRows(Lm_meetingattendeeslistsService, existing.groupAttendees, 'lm_meetingattendeeslistid', 'lm_meetingattendeeslists', errors);

    /* Units are already handled above, so the recreate pass must skip them. */
    await createMeetingTemplateChildren(dvId, payload, errors, { skipUnits:true });
    return { id: dvId, errors };
  }

  await createMeetingTemplateChildren(dvId, payload, errors);
  return { id: dvId, errors };
}

/** Patches ONLY the status field on an existing lm_report_templates row --
 *  no child-row reconciliation. For lifecycle transitions that don't touch
 *  content, such as the Approve action (Under Review -> Active / Approved),
 *  a full delete-and-recreate of every child row would be pointless risk. */
export async function updateReportTemplateStatus(dvId, status){
  try{
    const result = await Lm_report_templatesService.update(dvId, { lm_reportstatus: TEMPLATE_STATUS_KEY[status] ?? null });
    assertSuccess(result);
    return { id: dvId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_report_templates', error:e }] };
  }
}

/** Same as updateReportTemplateStatus above, for the Meeting side. */
export async function updateMeetingTemplateStatus(dvId, status){
  try{
    const result = await Lm_meetingtemplatesService.update(dvId, { lm_meetingstatus: TEMPLATE_STATUS_KEY[status] ?? null });
    assertSuccess(result);
    return { id: dvId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingtemplates', error:e }] };
  }
}

/* =========================================================================
   Reading Report/Meeting Templates back out of Dataverse -- for the Setup
   Register to list them, and for opening one to view/edit.

   Two tiers:
   - fetch*TemplatesList(): lightweight, one row per template, for the
     register table. Cheap -- a handful of scalar columns, one request.
   - fetch*TemplateDetail(id): everything -- parent + every child table,
     including each Business-Unit/Region row's own Review Chain/Attendees.
     Several requests (one per child table, plus one per unit for Review
     Chain/Attendees), only run when the user actually opens a record.
   ========================================================================= */

export async function fetchReportTemplatesList(){
  const res = await Lm_report_templatesService.getAll({
    /* lm_objective added 28 Sep: the Create Report page shows it on each
       template card. Same column fetchReportTemplateDetail() already reads. */
    select: ['lm_report_templateid','lm_newcolumn','lm_objective','lm_reporttype','lm_reportcategory','lm_frequency','lm_reportstatus','lm_version','modifiedon','createdon'],
  });
  const rows = res?.data ?? [];
  // One extra pair of requests per row (Business Unit + Region scope) so
  // the register can show real scope/tags on the shadow row instead of
  // dashes -- codes are returned raw (e.g. lm_reporttype) rather than
  // resolved to labels here, since the label maps already live in
  // GovernanceApp.jsx (DV_REPORT_TYPE etc.) and shouldn't be duplicated.
  return Promise.all(rows.map(async r => {
    const id = r.lm_report_templateid;
    const [buRes, rgRes] = await Promise.all([
      Lm_reporttemplatebusinessunitsesService.getAll({ filter:`_lm_reporttemplate_value eq ${id}`, select:['_lm_businessunit_value'] }).catch(()=>null),
      Lm_reporttemplateregionsService.getAll({ filter:`_lm_reporttemplate_value eq ${id}`, select:['_lm_region_value'] }).catch(()=>null),
    ]);
    return {
      id,
      name: r.lm_newcolumn || '(untitled)',
      objective: r.lm_objective || null,
      reportTypeCode: r.lm_reporttype ?? null,
      reportCategoryCode: r.lm_reportcategory ?? null,
      frequencyCode: r.lm_frequency ?? null,
      statusCode: r.lm_reportstatus ?? null,
      version: r.lm_version ?? null,
      businessUnitIds: (buRes?.data ?? []).map(x=>x._lm_businessunit_value).filter(Boolean),
      regionIds: (rgRes?.data ?? []).map(x=>x._lm_region_value).filter(Boolean),
      updated: r.modifiedon || r.createdon || null,
    };
  }));
}

export async function fetchMeetingTemplatesList(){
  const res = await Lm_meetingtemplatesService.getAll({
    select: ['lm_meetingtemplateid','lm_meetingtemplatename','lm_setuptype','lm_typeclassification','lm_stages','lm_frequency','lm_daysoftheweek','lm_quorumthreshold','lm_torpolicylink','lm_meetingstatus','lm_version','modifiedon','createdon',
             'lm_momwriteuphours','lm_momapprovalhours','lm_gridsubmithours'],
  });
  const rows = res?.data ?? [];
  return Promise.all(rows.map(async r => {
    const id = r.lm_meetingtemplateid;
    const [buRes, rgRes] = await Promise.all([
      Lm_meetingtemplatebusinessunitsesService.getAll({ filter:`_lm_meetingtemplate_value eq ${id}`, select:['_lm_businessunit_value'] }).catch(()=>null),
      Lm_meetingtemplateregionsService.getAll({ filter:`_lm_meetingtemplate_value eq ${id}`, select:['_lm_region_value'] }).catch(()=>null),
    ]);
    return {
      id,
      name: r.lm_meetingtemplatename || '(untitled)',
      setupTypeCode: r.lm_setuptype ?? null,
      categoryCode: r.lm_typeclassification ?? null,
      stageCode: r.lm_stages ?? null,
      frequencyCode: r.lm_frequency ?? null,
      dayOfWeekCode: r.lm_daysoftheweek ?? null,
      quorumPct: r.lm_quorumthreshold ?? null,
      torLink: r.lm_torpolicylink || null,
      /* The Setup's time limits (hours) -- see meetingLimits() in LeadershipApp. */
      momWriteupHours: r.lm_momwriteuphours ?? null,
      momApprovalHours: r.lm_momapprovalhours ?? null,
      gridSubmitHours: r.lm_gridsubmithours ?? null,
      statusCode: r.lm_meetingstatus ?? null,
      version: r.lm_version ?? null,
      businessUnitIds: (buRes?.data ?? []).map(x=>x._lm_businessunit_value).filter(Boolean),
      regionIds: (rgRes?.data ?? []).map(x=>x._lm_region_value).filter(Boolean),
      updated: r.modifiedon || r.createdon || null,
    };
  }));
}

/** Uploads a file's content into `lm_report_templates.lm_attachementfile` --
 *  a native Dataverse File column, added after `lm_fileattachement` (the
 *  plain-text link column, still present but no longer editable in the UI --
 *  see PROJECT-CONTEXT.md §5, "remove the url field for now"). The Report
 *  Template row must already exist in Dataverse; a File column has nothing
 *  to attach content to on a row that hasn't been created yet, so this is
 *  called only after a create/update returns a real id.
 *  @param {string} templateId lm_report_templateid of an EXISTING row
 *  @param {string} fileName original file name, shown back by Dataverse
 *  @param {string} base64Content the file's bytes, base64-encoded
 */
export async function uploadReportTemplateFile(templateId, fileName, base64Content){
  return uploadFileColumn('lm_report_templates', templateId, 'lm_attachementfile', fileName, base64Content);
}

/** The KPIs and Processes a Report Setup declares as related to it.
 *
 *  These hang off the TEMPLATE, not off a section: they are what the Setup
 *  says this report is about, independently of what any one section happens to
 *  cite. fetchReportTemplateDetail() already returns their ids, but it fans out
 *  into review chains and per-checklist section items to do it -- far too much
 *  work for a panel that only wants two lists, so this reads just the two link
 *  tables.
 *
 *  Names come from the lookup's own formatted value, so no KPI/Process catalog
 *  has to be loaded first -- Reports / Plans has none.
 *
 *  -> { kpis: [{id, name}], processes: [{id, name}] }
 */
export async function fetchReportTemplateRelated(templateId){
  if(!templateId) return { kpis: [], processes: [] };
  const filter = `_lm_reporttemplate_value eq ${templateId}`;
  const [kpiRes, procRes] = await Promise.all([
    Lm_reporttemplaterelatedkpisesService.getAll({ filter, select: ['_lm_relatedkpi_value'] })
      .catch(e => { console.warn('[dataverse] related KPIs fetch failed:', e); return null; }),
    Lm_reporttemplaterelatedprocessesesService.getAll({ filter, select: ['_lm_relatedprocess_value'] })
      .catch(e => { console.warn('[dataverse] related Processes fetch failed:', e); return null; }),
  ]);

  /* A Setup can name the same KPI twice; de-duplicated on id so the panel does
     not show it twice and the achievement read does not ask for it twice. */
  const uniq = (rows, idField) => {
    const seen = new Map();
    for(const r of rows ?? []){
      const id = r[idField];
      if(id && !seen.has(id)) seen.set(id, { id, name: r[idField + FV] || null });
    }
    return [...seen.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  return {
    kpis:      uniq(kpiRes?.data,  '_lm_relatedkpi_value'),
    processes: uniq(procRes?.data, '_lm_relatedprocess_value'),
  };
}

export async function fetchReportTemplateDetail(id){
  const parentRes = await Lm_report_templatesService.get(id, {
    select: ['lm_report_templateid','lm_newcolumn','lm_objective','lm_reporttype','lm_reportcategory',
      'lm_submissiontiming',
      'lm_frequency','lm_dayoftheweek','lm_dayofweeks','lm_dayofthemonth','lm_monthofthequarter',
      'lm_seconddayoftheweek','lm_seconddayofthemonth','lm_monthofthesemester','lm_month','lm_confidentiality',
      'lm_destinationsharepointlink','lm_fileattachement','lm_attachementfile','lm_reportstatus','lm_version','lm_stage','modifiedon','createdon',
      // Group-wide (Stage 3/4) Owner/Submitting Position, Team Channel and
      // Speciality -- see reportTemplateParentPayload()'s comment for why
      // these live here instead of on a per-unit child row.
      '_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value','_lm_reportspecialty_value'],
  });
  const parent = parentRes?.data;
  if(!parent) throw new Error(`Report Template ${id} not found`);

  const filter = `_lm_reporttemplate_value eq ${id}`;
  const [checklistRes, linesRes, kpisRes, procsRes, busRes, regionsRes] = await Promise.all([
    Lm_reporttemplatecontentchecklistsService.getAll({ filter, select:['lm_reporttemplatecontentchecklistid','lm_checklistitemname','lm_checklistitemstep','lm_diagnosticangle','lm_fileattachement'] }),
    readReportTemplateLines(filter),
    Lm_reporttemplaterelatedkpisesService.getAll({ filter, select:['_lm_relatedkpi_value'] }),
    Lm_reporttemplaterelatedprocessesesService.getAll({ filter, select:['_lm_relatedprocess_value'] }),
    Lm_reporttemplatebusinessunitsesService.getAll({ filter, select:['lm_reporttemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_speciality_value','_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value', ...REPORT_SCHEDULE_COLS] }),
    Lm_reporttemplateregionsService.getAll({ filter, select:['lm_reporttemplateregionid','lm_name','_lm_region_value','_lm_reportspeciality_value','_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value', ...REPORT_SCHEDULE_COLS] }),
  ]);

  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];

  const [buChains, regionChains] = await Promise.all([
    Promise.all(businessUnits.map(bu =>
      Lm_reporttemplatereviewchainsService.getAll({
        filter: unitChainFilter('businessunit', bu.lm_reporttemplatebusinessunitsid),
        select: ['lm_step','_lm_reviewerposition_value','lm_newcolumn'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
    Promise.all(regions.map(rg =>
      Lm_reporttemplatereviewchainsService.getAll({
        filter: unitChainFilter('region', rg.lm_reporttemplateregionid),
        select: ['lm_step','_lm_reviewerposition_value','lm_newcolumn'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
  ]);

  /* A Stage 3/4 Setup's Review Chain binds to the template only, so it is
     invisible to the per-BU / per-Region queries above and needs its own read. */
  const groupChainDetailRes = await Lm_reporttemplatereviewchainsService.getAll({
    filter: `${filter} and ${GROUP_CHAIN_UNBOUND}`,
    select: ['lm_reporttemplatereviewchainid','lm_step','_lm_reviewerposition_value','lm_newcolumn'],
  }).catch(e=>{ console.warn('[dataverse] group-wide review chain fetch failed:', e); return null; });

  /* Each checklist row carries its own Section items -- one row per cited KPI,
     Breakdown, Process or child Template. Fetched per checklist row because
     the items point at the checklist row, not at the Template. */
  const checklistRows = checklistRes?.data ?? [];
  const itemLists = await Promise.all(checklistRows.map(c =>
    Lm_reporttemplatesectionitemsesService.getAll({
      filter: `_lm_sectionchecklistitem_value eq ${c.lm_reporttemplatecontentchecklistid}`,
      select: ['lm_reporttemplatesectionitemsid','lm_sectionitemname','lm_itemtype',
               'lm_breakdowndimension','_lm_kpi_value','_lm_process_value',
               '_lm_childreporttemplate_value','lm_attachementfile'],
    }).then(r=>r?.data??[]).catch(e=>{
      console.warn('[dataverse] section items fetch failed:', e); return []; })));

  return {
    parent,
    checklist: checklistRows.map((c,i) => ({
      ...c,
      items: itemLists[i].map(it => ({
        id: it.lm_reporttemplatesectionitemsid,
        /* lm_itemtype has no File value (see createSectionItems' comment) --
           a File citation is recognised by having content in
           lm_attachementfile instead, with lm_itemtype left null. */
        type: SECTION_ITEM_TYPE[it.lm_itemtype] || (it.lm_attachementfile ? 'File' : null),
        label: it.lm_sectionitemname || '',
        kpiId: it._lm_kpi_value || null,
        processId: it._lm_process_value || null,
        childTemplateId: it._lm_childreporttemplate_value || null,
        dimension: SECTION_BREAKDOWN_DIM[it.lm_breakdowndimension] || null,
        hasFile: !!it.lm_attachementfile,
        /* The FILE's own name, which is not lm_sectionitemname -- that is
           the citation's label and is stored prefixed ("File: x.xlsx").
           Same `<column>_name` projection the Template uses, and kept out
           of the $select for the same reason. */
        fileStoredName: it.lm_attachementfile_name || '',
      })),
    })),
    /* One entry per Department & Function, as before -- a Setup saved "per
       Department & Function" has one row per unit x line, so the same pair
       repeats; readers that want the lines see each once. The rows as stored,
       with their unit and people, are `lineRoles`. */
    lines: uniqueLines(linesRes?.data ?? []),
    lineRoles: (linesRes?.data ?? []).filter(r =>
      r._lm_submittingposition_value || r._lm_ownerposition_value || r._lm_teamchannel_value),
    /* Every row, in line order -- the number saved at the start of lm_newcolumn,
       then creation time for rows saved before that (30 Sep). Governance
       rebuilds its lines from these, repeated pairs included. */
    lineRows: [...(linesRes?.data ?? [])].sort((a, b) =>
      (lineSeqOf(a) - lineSeqOf(b)) || String(a.createdon || '').localeCompare(String(b.createdon || ''))),
    kpiIds: (kpisRes?.data ?? []).map(r => r._lm_relatedkpi_value).filter(Boolean),
    processIds: (procsRes?.data ?? []).map(r => r._lm_relatedprocess_value).filter(Boolean),
    businessUnits: businessUnits.map((bu,i) => ({ ...bu, reviewChain: buChains[i] })),
    regions: regions.map((rg,i) => ({ ...rg, reviewChain: regionChains[i] })),
    /* The group-wide Review Chain, if any -- steps bound to the template with
       neither per-unit lookup set. Read separately because the two queries
       above are keyed on a Business Unit or Region row that does not exist for
       a Stage 3/4 Setup. */
    groupReviewChain: (groupChainDetailRes?.data ?? [])
      .slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0)),
  };
}

export async function fetchMeetingTemplateDetail(id){
  const parentRes = await Lm_meetingtemplatesService.get(id, {
    select: ['lm_meetingtemplateid','lm_meetingtemplatename','lm_setuptype','lm_typeclassification','lm_stages',
      '_lm_category_value','lm_category_name',
      'lm_frequency','lm_daysoftheweek','lm_dayofweeks','lm_dayofthemonth','lm_monthofthequarter',
      'lm_seconddayoftheweek','lm_seconddayofthemonth','lm_monthofthesemesterseme','lm_defaultmeetingmode',
      'lm_meetingconfidentiality','lm_quorumthreshold','lm_torpolicylink','lm_meetingstatus','lm_version','modifiedon','createdon',
      'cr18c_month',
      'lm_momwriteuphours','lm_momapprovalhours','lm_gridsubmithours',
      // Group-wide (Stage 3/4) Chairman/Co-Chairman/Facilitator/Team-Channel --
      // see meetingTemplateParentPayload()'s comment for why these live here
      // instead of on a per-unit child row. TeamChannel was missing from this
      // select entirely until 23 Sep -- the write side had nowhere to read
      // its own value back from, on top of never writing it either.
      '_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value',
      '_lm_teamchannel_value',
      /* Who created the Setup -- only they may write its name by hand
         (06 Oct, see customNameAllowed() in GovernanceApp.jsx). */
      '_createdby_value'],
  });
  const parent = parentRes?.data;
  if(!parent) throw new Error(`Meeting Template ${id} not found`);

  const filter = `_lm_meetingtemplate_value eq ${id}`;
  const [agendaRes, linesRes, supportiveRes, linkedRes, busRes, regionsRes, topCatRes] = await Promise.all([
    Lm_meetingtemplateagendaitemsService.getAll({ filter, select:['lm_agendaitemname','lm_step','lm_agendaitemtype','_lm_agendaitemowner_value'] }),
    Lm_meetingtemplatedepartmentfunctionsService.getAll({ filter, select:['_lm_department_value','_lm_function_value'] }),
    Lm_meetingtemplatesupportivefunctionsesService.getAll({ filter, select:['lm_newcolumn','_lm_function_value'] }),
    Lm_meetingtemplatelinkedreportsesService.getAll({ filter, select:['lm_name','lm_reporttype','_lm_reporttemplate_value'] }),
    Lm_meetingtemplatebusinessunitsesService.getAll({ filter, select:['lm_meetingtemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
    Lm_meetingtemplateregionsService.getAll({ filter, select:['lm_meetingtemplateregionid','lm_name','_lm_region_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
    /* Never fails the Setup read: a missing table just means no Stage 4 list. */
    Lm_topmanagementmeetingcategoriesService.getAll({ filter, select: TOP_CATEGORY_SELECT }).catch(()=>null),
  ]);

  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];

  const [buAttendees, regionAttendees, groupAttendeesRes] = await Promise.all([
    Promise.all(businessUnits.map(bu =>
      Lm_meetingattendeeslistsService.getAll({
        filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_meetingtemplatebusinessunitsid}`,
        select: ATTENDEE_SELECT,
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
    Promise.all(regions.map(rg =>
      Lm_meetingattendeeslistsService.getAll({
        filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_meetingtemplateregionid}`,
        select: ATTENDEE_SELECT,
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
    /* Same either/or identity as fetchMeetingTemplateChildIds() above: a
       group-wide attendee has both per-unit lookups null, since there is no
       unit row for it to bind to. */
    Lm_meetingattendeeslistsService.getAll({
      filter: `${filter} and _lm_meetingtemplateperbusinessunit_value eq null and _lm_meetingtemplateperregion_value eq null`,
      select: ATTENDEE_SELECT,
    }).then(r => r?.data ?? []).catch(()=>[]),
  ]);

  return {
    parent,
    agenda: agendaRes?.data ?? [],
    lines: linesRes?.data ?? [],
    supportive: supportiveRes?.data ?? [],
    linkedReports: linkedRes?.data ?? [],
    businessUnits: businessUnits.map((bu,i) => ({ ...bu, attendees: buAttendees[i] })),
    regions: regions.map((rg,i) => ({ ...rg, attendees: regionAttendees[i] })),
    groupAttendees: groupAttendeesRes,
    topCategories: topCatRes?.data ?? [],
  };
}
/* =========================================================================
   OCCURRENCES -- the execution side (Leadership Execution module)
   =========================================================================
   A Meeting Occurrence is one actual sitting of a Meeting Template; a Report
   Occurrence is one actual submission of a Report Template. Both carry the
   per-unit context on the row itself, and a Meeting Occurrence owns two child
   tables of its own: its agenda and its attendee list.

   NOTE on the attendees table: its logical name really is plural
   (lm_meetingoccurrenceattendees, entity set lm_meetingoccurrenceattendeeses)
   -- same quirk as lm_meetingtemplatesupportivefunctions. Kept as generated. */

const Lm_meetingoccurrencesService = dvTable('lm_meetingoccurrences', 'lm_meetingoccurrenceid', PIN_ORG);
const Lm_meetingoccurrenceagendasService = dvTable('lm_meetingoccurrenceagendas', 'lm_meetingoccurrenceagendaid', PIN_ORG);
const Lm_meetingoccurrenceattendeesesService = dvTable('lm_meetingoccurrenceattendeeses', 'lm_meetingoccurrenceattendeesid', PIN_ORG);
const Lm_meetingoccurrencedepartmentfunctionsService = dvTable('lm_meetingoccurrencedepartmentfunctions', 'lm_meetingoccurrencedepartmentfunctionid', PIN_ORG);
const Lm_meetingoccurrencelinkedreportsesService = dvTable('lm_meetingoccurrencelinkedreportses', 'lm_meetingoccurrencelinkedreportsid', PIN_ORG);
/* The whole Report Occurrence family -- the occurrence itself plus its own
   Sections, Citations, History and Shares -- reads and writes
   IT_ORG (the IT environment) always, independent of this
   app's own DATA_ORG. Per an explicit ask (22 Sep): Leadership's Reports/
   Plans screens now read the same Report Occurrences Governance Setup's own
   Report Templates already live next to in IT, rather than DT New. See
   xenv.js's IT_ORG for the full rationale. Everything else on
   this page -- Meeting Occurrences included -- is unaffected and still
   follows this app's own DATA_ORG. */
const Lm_reportoccurrencesService = dvTable('lm_reportoccurrences', 'lm_reportoccurrenceid', PIN_ORG);
const Lm_meetingminutesesService = dvTable('lm_meetingminuteses', 'lm_meetingminutesid', PIN_ORG);
const Lm_momnotesesService = dvTable('lm_momnoteses', 'lm_momnotesid', PIN_ORG);
const Lm_auditgridinstancesService = dvTable('lm_auditgridinstances', 'lm_auditgridinstanceid', PIN_ORG);
const Lm_auditgridanswersService = dvTable('lm_auditgridanswers', 'lm_auditgridanswerid', PIN_ORG);
/* ⚠️ IT_ORG (27 Sep) -- every table this app reads now points at IT.

   These three have NO TABLE in IT: lm_approvalcycle, lm_approvalcyclestep and
   lm_authoritymatrixrow simply do not exist there. That is deliberate rather
   than an oversight: they hold **0 rows in DT New as well**, so nothing is
   lost, and showing one environment's governance rules against the other
   environment's records was worse than showing none.

   Safe because getAll() RETURNS { success:false } rather than throwing (see
   xenv.js's fail()), so `res?.data ?? []` degrades to an empty list and the
   Authority Matrix and Approval Cycle panels render empty with a console
   warning instead of failing. When the tables are created in IT they will
   start reading with no code change. */
const Lm_approvalcyclesService = dvTable('lm_approvalcycles', undefined, PIN_ORG);
const Lm_approvalcyclestepsService = dvTable('lm_approvalcyclesteps', undefined, PIN_ORG);
const Lm_authoritymatrixrowsService = dvTable('lm_authoritymatrixrows', undefined, PIN_ORG);
const Lm_reportoccurrencehistoriesService =
  dvTable('lm_reportoccurrencehistories', 'lm_reportoccurrencehistoryid', PIN_ORG);
/* A Report Occurrence's content: its Sections, and the Citations inside them.
   Entity sets are double-plural -- the logical names are already plural. */
const Lm_reportoccurrencesectionsesService =
  dvTable('lm_reportoccurrencesectionses', 'lm_reportoccurrencesectionsid', PIN_ORG);
const Lm_reportsectioncitationsesService =
  dvTable('lm_reportsectioncitationses', 'lm_reportsectioncitationsid', PIN_ORG);
const Wlog_decisionsService = dvTable('wlog_decisions', 'wlog_decisionid', PIN_ORG);
const Lm_reportoccurrencesharesService =
  dvTable('lm_reportoccurrenceshares', 'lm_reportoccurrenceshareid', PIN_ORG);

/** Every Report Occurrence share -- who sent what to whom, and when.
 *
 *  Read whole rather than filtered by the signed-in user: the tab shows both
 *  directions, so one read serves Inbox and Sent, and the table is small.
 *  `createdby` is the sender; lm_shareduser is the recipient. */
export async function fetchReportShares(){
  const res = await Lm_reportoccurrencesharesService.getAll({
    select: ['lm_reportoccurrenceshareid','lm_name','lm_sharedon',
             '_lm_reportoccurrence_value','_lm_shareduser_value',
             '_createdby_value','createdon'],
    orderby: 'createdon desc',
  });
  return (res?.data ?? []).map(r => ({
    id: r.lm_reportoccurrenceshareid,
    name: r.lm_name || null,
    reportId: r._lm_reportoccurrence_value || null,
    reportName: r['_lm_reportoccurrence_value' + FV] || null,
    toUserId: r._lm_shareduser_value || null,
    toUserName: r['_lm_shareduser_value' + FV] || null,
    fromUserId: r._createdby_value || null,
    fromUserName: r['_createdby_value' + FV] || null,
    sharedOn: isoDay(r.lm_sharedon) || isoDay(r.createdon),
    created: r.createdon || null,
  }));
}

/** Sends a Report Occurrence to someone. lm_sharedon is stamped here rather
 *  than left to createdon, because the two mean different things the moment a
 *  share is ever edited. */
export async function shareReportOccurrence({ reportOccurrenceId, userId, name }){
  try{
    const row = {
      'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${reportOccurrenceId})`,
      'lm_SharedUser@odata.bind': `/systemusers(${userId})`,
      lm_sharedon: new Date().toISOString(),
    };
    if(name) row.lm_name = String(name).slice(0, 850);
    const created = await Lm_reportoccurrencesharesService.create(row);
    const id = idOrThrow(created, 'lm_reportoccurrenceshareid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrenceshares', error:e }] };
  }
}

export const MEETING_OCC_STATUS = { 1:'Scheduled', 2:'Held', 3:'Cancelled' };
export const MEETING_OCC_STATUS_KEY = { 'Scheduled':1, 'Held':2, 'Cancelled':3 };
// Dataverse says "Physical / Online / Hybrid", and since 01 Oct so does the app
// (it said "In person" before; the key map still accepts that).
export const MEETING_OCC_MODE = { 1:'Physical', 2:'Online', 3:'Hybrid' };
export const MEETING_OCC_MODE_KEY = { 'In person':1, 'Physical':1, 'Online':2, 'Hybrid':3 };
export const MEETING_OCC_SYNC = { 1:'Synchronized', 2:'Pending', 3:'Failed' };
export const MEETING_OCC_SYNC_KEY = { 'Synchronized':1, 'Pending':2, 'Failed':3 };
export const AGENDA_COVERED = { 1:'Yes', 2:'No', 3:'Not Yet Recorded' };
export const AGENDA_COVERED_KEY = { 'Yes':1, 'No':2, 'Not Yet Recorded':3 };
export const ATTENDEE_PRESENT = { 1:'Present', 2:'Absent', 3:'Not Yet Recorded' };
export const ATTENDEE_PRESENT_KEY = { 'Present':1, 'Absent':2, 'Not Yet Recorded':3 };
// lm_type on the attendee row. The option labels in Dataverse carry stray
// whitespace ("Optional "), so these map by code rather than by label.
export const ATTENDEE_TYPE = { 1:'Required', 2:'Optional' };
export const ATTENDEE_TYPE_KEY = { 'Required':1, 'Optional':2 };
export const REPORT_OCC_STATUS = { 1:'Draft', 2:'In Review', 3:'Approved', 4:'Rejected', 5:'Returned' };
// Read-side decodes for a Report Template's reportTypeCode / reportCategoryCode
// / frequencyCode (see fetchReportTemplatesList in the section above) --
// mirrors the MEETING_* decodes below for the meeting side.
export const REPORT_TYPE = { 1:'Plan', 2:'Dashboard', 3:'Report' };
export const SUBMISSION_TIMING = { 1:'Submission within same Month', 2:'Submission After Month' };
export const REPORT_CATEGORY = { 1:'Executive', 2:'Core', 3:'ADHOC' };
export const REPORT_FREQUENCY = {
  1:'Daily', 2:'Twice Weekly', 3:'Weekly', 4:'Twice Monthly', 5:'Monthly',
  6:'Quarterly', 7:'Semesterly', 8:'Annual', 9:'Custom',
};
/* lm_meetingstage is the same global option set the Governance module's Setup
   Stages use, so an occurrence records the stage in exactly the same terms its
   template does. The execution module labels them more briefly. */
export const MEETING_OCC_STAGE = {
  1:'Stage 1 BU Operational', 2:'Stage 2 Regional Functional',
  3:'Stage 3 Group Functional', 4:'Stage 4 Top Management, COO & CEO',
};
export const MEETING_OCC_STAGE_KEY = {
  'Business Unit':1, 'Region':2, 'Group':3, 'ExCom':4,
  'Stage 1 BU Operational':1, 'Stage 2 Regional Functional':2,
  'Stage 3 Group Functional':3, 'Stage 4 Top Management, COO & CEO':4,
};
export const REPORT_OCC_STATUS_KEY = { 'Draft':1, 'In Review':2, 'Approved':3, 'Rejected':4, 'Returned':5 };

/* lm_stage on lm_report_templates -- codes run 1..4 in the same order as the
   app's own STAGES list, so a Stage 4 Template now round-trips instead of
   being inferred back as Stage 3. */
export const REPORT_STAGE = {
  1:'Stage 1 BU Operational', 2:'Stage 2 Regional Functional',
  3:'Stage 3 Group Functional', 4:'Stage 4 Top Management, COO & CEO',
};
export const REPORT_STAGE_KEY = {
  'Stage 1 BU Operational':1, 'Stage 2 Regional Functional':2,
  'Stage 3 Group Functional':3, 'Stage 4 Top Management, COO & CEO':4,
};

/** A Dataverse DateTime comes back as a full ISO string; the app works in
 *  plain 'YYYY-MM-DD' dates throughout, so trim rather than re-parse (which
 *  would shift the day across time zones). */
const isoDay = v => (typeof v === 'string' && v.length >= 10) ? v.slice(0,10) : null;

/* Every live occurrence agenda item. lm_confidential (a Stage 4 confidential
   item, 03 Oct) exists in DT New only; selecting a missing column fails the
   whole read, so IT falls back to the base set and no item is confidential. */
const OCC_AGENDA_SELECT = ['lm_meetingoccurrenceagendaid','lm_title','lm_sequence','lm_source','lm_covered',
  '_lm_meetingoccurrence_value','_lm_ownerposition_value','_lm_carriedfromagendaitem_value'];
async function fetchOccurrenceAgendaRows(){
  const filter = 'statecode eq 0';
  try{
    const res = await Lm_meetingoccurrenceagendasService.getAll({ filter, select:[...OCC_AGENDA_SELECT, 'lm_confidential'] });
    if(res?.success === false) throw new Error('lm_confidential not readable');
    return res;
  }catch{
    return Lm_meetingoccurrenceagendasService.getAll({ filter, select:OCC_AGENDA_SELECT });
  }
}

/** Every Meeting Occurrence, with its agenda and attendee list attached.
 *  Three requests total, not one per occurrence: the two child tables are
 *  fetched whole and grouped client-side, which is far cheaper than a
 *  per-row fetch once there are more than a handful of occurrences.
 *  Lookups come back as raw GUIDs -- the caller resolves them to names
 *  against the reference data it already holds. */
export async function fetchMeetingOccurrences(){
  const [occRes, agendaRes, attRes] = await Promise.all([
    Lm_meetingoccurrencesService.getAll({
      select: ['lm_meetingoccurrenceid','lm_name','lm_date','lm_starttime','lm_endtime','lm_timezone',
               'lm_mode','lm_meetingstatus','lm_meetinglocation','lm_meetinglink','lm_adhoctype',
               'lm_restricted','lm_agendasentdate','lm_invitesentdate','lm_cancelreason','lm_syncstatus',
               'lm_meetingstage','lm_momwriteuphours','lm_momapprovalhours','lm_gridsubmithours',
               'lm_torpolicylink',
               '_lm_meetingtemplate_value','_lm_businessunit_value','_lm_chairmanposition_value',
               '_lm_region_value','_lm_department_value','_lm_facilitatorposition_value',
               '_lm_meetingcochairman_value','_lm_teamchannel_value',
               '_lm_rescheduledfrom_value','modifiedon','createdon'],
    }),
    fetchOccurrenceAgendaRows()
      .catch(e=>{ console.warn('[dataverse] occurrence agenda fetch failed:', e); return null; }),
    Lm_meetingoccurrenceattendeesesService.getAll({
      select: ['lm_meetingoccurrenceattendeesid','lm_name','lm_present','lm_type',
               '_lm_meetingoccurrence_value','_lm_attendeeposition_value','_lm_delegateposition_value'],
    }).catch(e=>{ console.warn('[dataverse] occurrence attendees fetch failed:', e); return null; }),
  ]);

  const byOcc = (rows, key) => {
    const m = new Map();
    (rows ?? []).forEach(r => {
      const k = r[key]; if(!k) return;
      if(!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return m;
  };
  const agendaBy = byOcc(agendaRes?.data, '_lm_meetingoccurrence_value');
  const attBy    = byOcc(attRes?.data,    '_lm_meetingoccurrence_value');
  /* Who may read each confidential agenda item, read only for those items. */
  const agendaViewers = await fetchViewersBy('_lm_meetingoccurrenceagenda_value',
    (agendaRes?.data ?? []).filter(a => a.lm_confidential).map(a => a.lm_meetingoccurrenceagendaid));

  return (occRes?.data ?? []).map(o => {
    const id = o.lm_meetingoccurrenceid;
    return {
      id,
      name: o.lm_name || '(untitled meeting)',
      date: isoDay(o.lm_date),
      start: o.lm_starttime || null,
      end: o.lm_endtime || null,
      timezone: o.lm_timezone || null,
      mode: MEETING_OCC_MODE[o.lm_mode] || null,
      /* A row with lm_meetingstatus blank or an unrecognized code defaults to
         'Scheduled', not null -- every occurrence this app creates starts
         Scheduled (see createMeetingOccurrence()), and every screen that
         reads this field (Work Queue, the Meetings list, Calendar) branches
         on an exact 'Scheduled'/'Held'/'Cancelled' match with no null case,
         so a null status silently vanished the row everywhere instead of
         surfacing it as needing attention. */
      status: MEETING_OCC_STATUS[o.lm_meetingstatus] || 'Scheduled',
      location: o.lm_meetinglocation || null,
      link: o.lm_meetinglink || null,
      adhocType: o.lm_adhoctype || null,
      restricted: !!o.lm_restricted,
      agendaSent: isoDay(o.lm_agendasentdate),
      inviteSent: isoDay(o.lm_invitesentdate),
      cancelReason: o.lm_cancelreason || null,
      sync: MEETING_OCC_SYNC[o.lm_syncstatus] || null,
      stage: MEETING_OCC_STAGE[o.lm_meetingstage] || null,
      /* This occurrence's own time limits (hours), null = use the Setup's. */
      momWriteupHours: o.lm_momwriteuphours ?? null,
      momApprovalHours: o.lm_momapprovalhours ?? null,
      gridSubmitHours: o.lm_gridsubmithours ?? null,
      /* The occurrence's OWN TOR / Policy link -- AG-01 and AG-02 read this
         (01 Oct); empty = those questions are Not Applicable. */
      torLink: o.lm_torpolicylink || null,
      coChairPositionId: o._lm_meetingcochairman_value || null,
      /* The meeting's Teams channel (and_teamschannellink), 03 Oct. */
      teamChannelId: o._lm_teamchannel_value || null,
      templateId: o._lm_meetingtemplate_value || null,
      businessUnitId: o._lm_businessunit_value || null,
      regionId: o._lm_region_value || null,
      departmentId: o._lm_department_value || null,
      chairPositionId: o._lm_chairmanposition_value || null,
      facilitatorPositionId: o._lm_facilitatorposition_value || null,
      rescheduledFromId: o._lm_rescheduledfrom_value || null,
      updated: o.modifiedon || o.createdon || null,
      created: o.createdon || null,
      agenda: (agendaBy.get(id) || [])
        .slice().sort((a,b)=>(a.lm_sequence||0)-(b.lm_sequence||0))
        .map(a=>({ id:a.lm_meetingoccurrenceagendaid, title:a.lm_title||'', seq:a.lm_sequence??null,
                   source:a.lm_source||null, covered:AGENDA_COVERED[a.lm_covered]||null,
                   ownerPositionId:a._lm_ownerposition_value||null,
                   carriedFromId:a._lm_carriedfromagendaitem_value||null,
                   confidential:!!a.lm_confidential,
                   viewers:agendaViewers.get(a.lm_meetingoccurrenceagendaid) || [] })),
      attendees: (attBy.get(id) || [])
        .map(a=>({ id:a.lm_meetingoccurrenceattendeesid, name:a.lm_name||null,
                   present:ATTENDEE_PRESENT[a.lm_present]||null,
                   type:ATTENDEE_TYPE[a.lm_type]||null,
                   positionId:a._lm_attendeeposition_value||null,
                   delegatePositionId:a._lm_delegateposition_value||null })),
    };
  });
}

/**
 * Resolves the Co-Chairman behind a Meeting Occurrence's scope, for every
 * Meeting Template's every unit at once -- three bulk reads, no per-
 * occurrence fan-out. Chairman and Facilitator are already on the
 * occurrence itself (lm_ChairmanPosition/lm_FacilitatorPosition -- an
 * occurrence can override the Setup's default for either), but Co-Chairman
 * has no column of its own there at all, so it can only ever be read from
 * the Setup: the per-unit row for a Business-Unit- or Region-scoped
 * occurrence, or the Template's own parent row for a group-wide one (no
 * Business Unit or Region set on the occurrence at all).
 *
 * Returns { forOccurrence(o) => coChairPositionId|null }, so a caller never
 * has to know which of the three sources answered it.
 */
export async function fetchMeetingUnitRoles(){
  const [buRes, rgRes, tplRes] = await Promise.all([
    Lm_meetingtemplatebusinessunitsesService.getAll({
      select: ['_lm_meetingtemplate_value','_lm_businessunit_value','_lm_meetingcochairman_value'],
    }),
    Lm_meetingtemplateregionsService.getAll({
      select: ['_lm_meetingtemplate_value','_lm_region_value','_lm_meetingcochairman_value'],
    }),
    Lm_meetingtemplatesService.getAll({
      select: ['lm_meetingtemplateid','_lm_meetingcochairman_value'],
    }),
  ]);
  const byBu = new Map(), byRegion = new Map(), byTemplate = new Map();
  (buRes?.data ?? []).forEach(r => {
    if(!r._lm_meetingtemplate_value || !r._lm_businessunit_value) return;
    byBu.set(r._lm_meetingtemplate_value+':'+r._lm_businessunit_value, r._lm_meetingcochairman_value||null);
  });
  (rgRes?.data ?? []).forEach(r => {
    if(!r._lm_meetingtemplate_value || !r._lm_region_value) return;
    byRegion.set(r._lm_meetingtemplate_value+':'+r._lm_region_value, r._lm_meetingcochairman_value||null);
  });
  (tplRes?.data ?? []).forEach(r => {
    byTemplate.set(r.lm_meetingtemplateid, r._lm_meetingcochairman_value||null);
  });
  return {
    forOccurrence(o){
      if(!o.templateId) return null;
      if(o.businessUnitId) return byBu.get(o.templateId+':'+o.businessUnitId) || null;
      if(o.regionId)       return byRegion.get(o.templateId+':'+o.regionId) || null;
      return byTemplate.get(o.templateId) || null;
    },
  };
}

/** Every Report Occurrence. One request -- this table has no child tables the
 *  calendar needs (its history lives in lm_reportoccurrencehistories). */
export async function fetchReportOccurrences(){
  const res = await Lm_reportoccurrencesService.getAll({
    select: ['lm_reportoccurrenceid','lm_name','lm_period','lm_status','lm_version','lm_reviewstep',
             'lm_fileurl','lm_reportobjective','lm_locked','lm_nosetupflag','lm_reportstage',
             '_lm_reporttemplate_value','_lm_businessunit_value','_lm_department_value','_lm_region_value',
             '_lm_function_value','_lm_creatorposition_value','modifiedon','createdon'],
  });
  return (res?.data ?? []).map(r => ({
    id: r.lm_reportoccurrenceid,
    name: r.lm_name || '(untitled report)',
    period: isoDay(r.lm_period),
    /* Same reasoning as the Meeting Occurrence status default above: every
       Report Occurrence this app creates starts Draft, and every screen
       that reads this field branches on an exact status match with no null
       case, so default a blank/unrecognized code to 'Draft' rather than
       letting the row disappear everywhere. */
    status: REPORT_OCC_STATUS[r.lm_status] || 'Draft',
    version: r.lm_version ?? null,
    reviewStep: r.lm_reviewstep ?? null,
    fileUrl: r.lm_fileurl || null,
    objective: r.lm_reportobjective || null,
    locked: !!r.lm_locked,
    noSetupFlag: !!r.lm_nosetupflag,
    stage: MEETING_OCC_STAGE[r.lm_reportstage] || null,   // same global option set as a Meeting
    templateId: r._lm_reporttemplate_value || null,
    businessUnitId: r._lm_businessunit_value || null,
    regionId: r._lm_region_value || null,
    departmentId: r._lm_department_value || null,
    functionId: r._lm_function_value || null,
    creatorPositionId: r._lm_creatorposition_value || null,
    updated: r.modifiedon || r.createdon || null,
  }));
}

/**
 * Resolves the Owner Position and Review Chain behind a Report Occurrence's
 * scope, for every Report Template's every unit at once -- four bulk reads,
 * no per-occurrence fan-out (unlike fetchReportTemplateDetail(), which reads
 * one Template's chain at a time for Governance Setup's editor).
 *
 * A Report Occurrence has no per-occurrence reviewer table of its own (see
 * PROJECT-CONTEXT.md §6, "A Report Occurrence has no per-occurrence
 * reviewer table") -- the chain is read from the Template for that unit,
 * same as everywhere else in this app that needs it. The Owner Position is
 * the same either/or shape: a per-unit row for a Business-Unit- or Region-
 * scoped occurrence, or the Template's own parent row for a group-wide one.
 *
 * Returns { forOccurrence(o) => {ownerId, reviewerIds: Set<string>} }.
 */
export async function fetchReportUnitRoles(){
  const [buRes, rgRes, tplRes, chainRes] = await Promise.all([
    Lm_reporttemplatebusinessunitsesService.getAll({
      select: ['lm_reporttemplatebusinessunitsid','_lm_reporttemplate_value','_lm_businessunit_value','_lm_ownerposition_value'],
    }),
    Lm_reporttemplateregionsService.getAll({
      select: ['lm_reporttemplateregionid','_lm_reporttemplate_value','_lm_region_value','_lm_ownerposition_value'],
    }),
    Lm_report_templatesService.getAll({
      select: ['lm_report_templateid','_lm_ownerposition_value'],
    }),
    Lm_reporttemplatereviewchainsService.getAll({
      select: ['_lm_reviewerposition_value','_lm_reporttemplate_value',
               '_lm_reporttemplateperbusinessunit_value','_lm_reporttemplateperregion_value',
               '_lm_meetingtemplateperbusinessunit_value','_lm_meetingtemplateperregion_value'],
    }),
  ]);

  const byBu = new Map(), byRegion = new Map(), byTemplate = new Map();
  (buRes?.data ?? []).forEach(r => {
    if(!r._lm_reporttemplate_value || !r._lm_businessunit_value) return;
    byBu.set(r._lm_reporttemplate_value+':'+r._lm_businessunit_value,
      { unitRowId: r.lm_reporttemplatebusinessunitsid, ownerId: r._lm_ownerposition_value||null });
  });
  (rgRes?.data ?? []).forEach(r => {
    if(!r._lm_reporttemplate_value || !r._lm_region_value) return;
    byRegion.set(r._lm_reporttemplate_value+':'+r._lm_region_value,
      { unitRowId: r.lm_reporttemplateregionid, ownerId: r._lm_ownerposition_value||null });
  });
  (tplRes?.data ?? []).forEach(r => {
    byTemplate.set(r.lm_report_templateid, { unitRowId: null, ownerId: r._lm_ownerposition_value||null });
  });

  /* Every reviewer Position, grouped by the SAME key a unit lookup above
     resolves to -- a per-unit row's own id (either lookup pair, per
     unitChainFilter()'s own reasoning: writes use the newer
     lm_ReportTemplatePerBusinessUnit/PerRegion pair, but a chain saved
     before 06 Sep still sits on the Meeting module's pair), or the
     Template id directly for a group-wide chain (all four per-unit lookups
     null on that row). */
  const reviewersByUnitRow = new Map(), reviewersByTemplate = new Map();
  (chainRes?.data ?? []).forEach(r => {
    const pos = r._lm_reviewerposition_value; if(!pos) return;
    const unitRowId = r._lm_reporttemplateperbusinessunit_value || r._lm_reporttemplateperregion_value
      || r._lm_meetingtemplateperbusinessunit_value || r._lm_meetingtemplateperregion_value || null;
    if(unitRowId){
      if(!reviewersByUnitRow.has(unitRowId)) reviewersByUnitRow.set(unitRowId, new Set());
      reviewersByUnitRow.get(unitRowId).add(pos);
    } else if(r._lm_reporttemplate_value){
      const t = r._lm_reporttemplate_value;
      if(!reviewersByTemplate.has(t)) reviewersByTemplate.set(t, new Set());
      reviewersByTemplate.get(t).add(pos);
    }
  });

  return {
    forOccurrence(r){
      if(!r.templateId) return { ownerId:null, reviewerIds:new Set() };
      const unit = r.businessUnitId ? byBu.get(r.templateId+':'+r.businessUnitId)
        : r.regionId ? byRegion.get(r.templateId+':'+r.regionId)
        : byTemplate.get(r.templateId);
      const ownerId = unit?.ownerId || null;
      const reviewerIds = unit?.unitRowId ? (reviewersByUnitRow.get(unit.unitRowId) || new Set())
        : (!r.businessUnitId && !r.regionId ? (reviewersByTemplate.get(r.templateId) || new Set()) : new Set());
      return { ownerId, reviewerIds };
    },
  };
}

/* lm_kind on lm_reportsectioncitations, in the column's own option order. The
   Report Occurrence flow writes 11 for a child report, which pins the numbering. */
export const REPORT_CITATION_KIND = {
  1:'KPI', 2:'Breakdown', 3:'Process', 4:'POC', 5:'Project', 6:'Strategy',
  7:'BI Report', 8:'Paragraph', 9:'Issue', 10:'Task', 11:'Child Report',
};

/* Formatted-value annotation suffix. The adapter asks Dataverse for these on
   every list read, so a lookup's display name and a choice's label arrive
   beside the raw value -- no second query, no catalogue to resolve against. */
const FV = '@OData.Community.Display.V1.FormattedValue';

/**
 * Every Section and every Citation on every Report Occurrence, for the
 * Reports / Plans screen. Two reads, run together; the screen groups them.
 *
 * Sections hang off their report through lm_reportoccurrence. Citations carry
 * NO lookup to the report and no explicit parent-section column -- only
 * lm_citedsection. The Report Occurrence flow writes the citation's parent
 * section there, so that is how they are grouped here. See PROJECT-CONTEXT
 * section 6, "lm_reportsectioncitations has no explicit parent-section lookup".
 *
 * lm_ChildReportTemplate is deliberately not selected: the cached schema for
 * this table predates it and its exact logical name is unconfirmed, and an
 * unknown column in $select fails the WHOLE read, not just that field.
 *
 * Throws when either read fails, so the screen can say so rather than render
 * a report that silently has no content.
 */
export async function fetchReportOccurrenceContent(){
  const [secRes, citeRes] = await Promise.all([
    Lm_reportoccurrencesectionsesService.getAll({
      select: ['lm_reportoccurrencesectionsid','lm_heading','lm_body','lm_diagnosticangle',
               'lm_sequence','lm_source','_lm_reportoccurrence_value','_createdby_value','createdon'],
    }),
    Lm_reportsectioncitationsesService.getAll({
      select: ['lm_reportsectioncitationsid','lm_name','lm_kind','lm_breakdowndimension',
               '_lm_citedsection_value','_lm_kpi_value','_lm_process_value',
               '_lm_citedreportoccurrence_value',
               '_lm_poc_value','_lm_strategy_value','_lm_bireport_value','_lm_task_value',
               '_lm_project_value'],
    }),
  ]);
  assertSuccess(secRes);
  assertSuccess(citeRes);

  const sections = (secRes.data ?? []).map(s => ({
    id: s.lm_reportoccurrencesectionsid,
    reportId: s._lm_reportoccurrence_value || null,
    heading: s.lm_heading || '(untitled section)',
    body: s.lm_body || '',
    angle: SECTION_ANGLE[s.lm_diagnosticangle] || 'Untyped',
    sequence: s.lm_sequence ?? null,
    source: s['lm_source' + FV] || null,
    author: s['_createdby_value' + FV] || null,
    created: s.createdon || null,
  }));

  const citations = (citeRes.data ?? []).map(c => ({
    id: c.lm_reportsectioncitationsid,
    sectionId: c._lm_citedsection_value || null,
    kind: c['lm_kind' + FV] || REPORT_CITATION_KIND[c.lm_kind] || 'Citation',
    label: c.lm_name || null,
    breakdown: c['lm_breakdowndimension' + FV] || SECTION_BREAKDOWN_DIM[c.lm_breakdowndimension] || null,
    kpiId: c._lm_kpi_value || null,
    kpiName: c['_lm_kpi_value' + FV] || null,
    /* The id as well as the name: the export resolves a Process to its own row
       for the department behind it, which a formatted value cannot give. The
       edit-side read (fetchReportOccurrenceForEdit) always carried both. */
    processId: c._lm_process_value || null,
    processName: c['_lm_process_value' + FV] || null,
    citedReportId: c._lm_citedreportoccurrence_value || null,
    citedReportName: c['_lm_citedreportoccurrence_value' + FV] || null,
    pocId: c._lm_poc_value || null,
    pocName: c['_lm_poc_value' + FV] || null,
    strategyId: c._lm_strategy_value || null,
    strategyName: c['_lm_strategy_value' + FV] || null,
    biId: c._lm_bireport_value || null,
    biName: c['_lm_bireport_value' + FV] || null,
    taskId: c._lm_task_value || null,
    taskName: c['_lm_task_value' + FV] || null,
    projectId: c._lm_project_value || null,
    projectName: c['_lm_project_value' + FV] || null,
  }));

  return { sections, citations };
}

/**
 * Every Report Template, plus every checklist Section and Section Item on
 * every Template, for the Reporting hierarchy's Templates view. Three bulk
 * reads, run together -- unlike fetchReportTemplateDetail() (Governance
 * Setup's per-Template editor), this does not fan out per template into
 * review chains, related KPIs/Processes or scope rows this view has no use
 * for, so it stays cheap regardless of how many Templates exist.
 *
 * A Template is worth drawing in that graph when it has an attached file of
 * its own, a Section Item that cites a child Report Template, or a Section
 * Item that itself carries an uploaded file -- the screen decides which;
 * this just hands back the raw shape, the same division of labour as
 * fetchReportOccurrenceContent() above.
 */
export async function fetchReportTemplateHierarchyContent(){
  const [tplRes, checklistRes, itemsRes] = await Promise.all([
    Lm_report_templatesService.getAll({
      select: ['lm_report_templateid','lm_newcolumn','lm_reporttype','lm_reportcategory','lm_reportstatus','lm_attachementfile'],
    }),
    Lm_reporttemplatecontentchecklistsService.getAll({
      select: ['lm_reporttemplatecontentchecklistid','lm_checklistitemname','lm_checklistitemstep','lm_diagnosticangle','_lm_reporttemplate_value'],
    }),
    Lm_reporttemplatesectionitemsesService.getAll({
      select: ['lm_reporttemplatesectionitemsid','lm_sectionitemname','lm_itemtype',
               '_lm_childreporttemplate_value','lm_attachementfile','_lm_sectionchecklistitem_value'],
    }),
  ]);
  assertSuccess(tplRes);
  assertSuccess(checklistRes);
  assertSuccess(itemsRes);

  const templates = (tplRes.data ?? []).map(t => ({
    id: t.lm_report_templateid,
    name: t.lm_newcolumn || '(untitled)',
    typeCode: t.lm_reporttype ?? null,
    categoryCode: t.lm_reportcategory ?? null,
    statusCode: t.lm_reportstatus ?? null,
    hasFile: !!t.lm_attachementfile,
    /* The `<column>_name` projection does NOT reliably ride along on a LIST
       read through this connector -- confirmed live 21 Sep, empty here even
       for a Template with a real file. Recovered below with a targeted GET,
       the same read fetchReportTemplateDetail() already uses successfully. */
    fileStoredName: t.lm_attachementfile_name || '',
  }));

  const checklist = (checklistRes.data ?? []).map(c => ({
    id: c.lm_reporttemplatecontentchecklistid,
    templateId: c._lm_reporttemplate_value || null,
    heading: c.lm_checklistitemname || '(untitled section)',
    step: c.lm_checklistitemstep ?? null,
    angle: SECTION_ANGLE[c.lm_diagnosticangle] || 'Untyped',
  }));

  const items = (itemsRes.data ?? []).map(it => ({
    id: it.lm_reporttemplatesectionitemsid,
    checklistId: it._lm_sectionchecklistitem_value || null,
    label: it.lm_sectionitemname || '',
    /* lm_itemtype has no File value -- a File citation is recognised by
       having content in lm_attachementfile instead. Same rule
       fetchReportTemplateDetail() already applies. */
    type: SECTION_ITEM_TYPE[it.lm_itemtype] || (it.lm_attachementfile ? 'File' : null),
    childTemplateId: it._lm_childreporttemplate_value || null,
    hasFile: !!it.lm_attachementfile,
    /* Same list-read gap as the Template row above -- recovered below. */
    fileStoredName: it.lm_attachementfile_name || '',
  }));

  /* Recover the stored file NAME for every row that actually has one, via
     one targeted GET per row -- bounded by how many Templates/Section Items
     carry an attachment, not by how many exist, so this stays cheap even
     though fetchReportTemplateDetail()'s per-Template fan-out was avoided
     above for exactly that reason. Without this, a Template/Item whose file
     name came back empty falls back to a placeholder string with no
     extension in it ("Template file"/"File") -- which broke BOTH ends at
     once, live 21 Sep: previewKind() read that placeholder as the file's
     own "extension" and refused to show it, and a download saved under that
     same nameless string instead of the file's real name. */
  await Promise.all(templates.filter(t=>t.hasFile).map(async t => {
    try{
      const r = await Lm_report_templatesService.get(t.id, { select: ['lm_attachementfile'] });
      if(r?.data?.lm_attachementfile_name) t.fileStoredName = r.data.lm_attachementfile_name;
    }catch(e){ console.warn('[dataverse] Report Template file name read failed:', t.id, e); }
  }));
  await Promise.all(items.filter(it=>it.hasFile).map(async it => {
    try{
      const r = await Lm_reporttemplatesectionitemsesService.get(it.id, { select: ['lm_attachementfile'] });
      if(r?.data?.lm_attachementfile_name) it.fileStoredName = r.data.lm_attachementfile_name;
    }catch(e){ console.warn('[dataverse] Section Item file name read failed:', it.id, e); }
  }));

  return { templates, checklist, items };
}

/* =========================================================================
   Build a report/plan -- editing one Report Occurrence's content.
   ========================================================================= */

/* lm_source on a Section: 1 Migrated (from Template), 2 Added (this occurrence
   only). A Section created by the Build screen is always Added. */
const SECTION_SOURCE_ADDED = 2;
/* Exported because the Build screen locks a migrated Section's angle: the
   Template governs it, so the occurrence must not re-type it. Callers compare
   the CODE, never the FormattedValue label, which is renameable in Dataverse. */
export const SECTION_SOURCE_MIGRATED = 1;

export const REPORT_CITATION_KIND_KEY = Object.fromEntries(
  Object.entries(REPORT_CITATION_KIND).map(([code, label]) => [label, Number(code)]));

const EDIT_SECTION_SELECT = ['lm_reportoccurrencesectionsid','lm_heading','lm_body','lm_diagnosticangle',
  'lm_sequence','lm_source','_lm_reportoccurrence_value','_createdby_value','createdon'];
const EDIT_CITATION_SELECT = ['lm_reportsectioncitationsid','lm_name','lm_kind','lm_breakdowndimension',
  '_lm_citedsection_value','_lm_kpi_value','_lm_process_value','_lm_citedreportoccurrence_value',
  '_lm_poc_value','_lm_strategy_value','_lm_bireport_value','_lm_task_value','_lm_project_value'];

/**
 * One Report Occurrence's Sections, in order, each carrying its Citations --
 * in RAW form (an empty heading stays empty), because this feeds an editor
 * whose changes are diffed against it on save.
 *
 * Citations are found through lm_citedsection, the parent-section convention
 * the Report Occurrence flow writes (see fetchReportOccurrenceContent). They
 * are read in chunks, because a long OR filter over many section ids becomes a
 * URL the service will not accept.
 */
export async function fetchReportOccurrenceForEdit(occurrenceId){
  const secRes = await Lm_reportoccurrencesectionsesService.getAll({
    filter: `_lm_reportoccurrence_value eq ${occurrenceId}`,
    select: EDIT_SECTION_SELECT,
  });
  assertSuccess(secRes);
  const secRows = secRes.data ?? [];

  const citeRows = [];
  const ids = secRows.map(s => s.lm_reportoccurrencesectionsid);
  for(let i = 0; i < ids.length; i += 15){
    const chunk = ids.slice(i, i + 15);
    const res = await Lm_reportsectioncitationsesService.getAll({
      filter: chunk.map(id => `_lm_citedsection_value eq ${id}`).join(' or '),
      select: EDIT_CITATION_SELECT,
    });
    assertSuccess(res);
    citeRows.push(...(res.data ?? []));
  }

  const citesBySection = {};
  for(const c of citeRows){
    const sid = c._lm_citedsection_value; if(!sid) continue;
    (citesBySection[sid] = citesBySection[sid] || []).push({
      id: c.lm_reportsectioncitationsid,
      kind: REPORT_CITATION_KIND[c.lm_kind] || c['lm_kind' + FV] || 'Citation',
      label: c.lm_name || '',
      breakdown: SECTION_BREAKDOWN_DIM[c.lm_breakdowndimension] || null,
      kpiId: c._lm_kpi_value || null,
      kpiName: c['_lm_kpi_value' + FV] || null,
      processId: c._lm_process_value || null,
      processName: c['_lm_process_value' + FV] || null,
      citedReportId: c._lm_citedreportoccurrence_value || null,
      citedReportName: c['_lm_citedreportoccurrence_value' + FV] || null,
      pocId: c._lm_poc_value || null,
      pocName: c['_lm_poc_value' + FV] || null,
      strategyId: c._lm_strategy_value || null,
      strategyName: c['_lm_strategy_value' + FV] || null,
      biId: c._lm_bireport_value || null,
      biName: c['_lm_bireport_value' + FV] || null,
      taskId: c._lm_task_value || null,
      taskName: c['_lm_task_value' + FV] || null,
      projectId: c._lm_project_value || null,
      projectName: c['_lm_project_value' + FV] || null,
    });
  }

  return secRows
    .map(s => ({
      id: s.lm_reportoccurrencesectionsid,
      heading: s.lm_heading || '',
      body: s.lm_body || '',
      angle: SECTION_ANGLE[s.lm_diagnosticangle] || 'Untyped',
      sequence: s.lm_sequence ?? null,
      source: s['lm_source' + FV] || null,
      /* The raw choice code beside the label. `source` is the display text and
         is renameable; anything BRANCHING on where a Section came from has to
         use this. Compare against SECTION_SOURCE_MIGRATED / _ADDED. */
      sourceCode: s.lm_source ?? null,
      author: s['_createdby_value' + FV] || null,
      created: s.createdon || null,
      citations: citesBySection[s.lm_reportoccurrencesectionsid] || [],
    }))
    .sort((a, b) => (a.sequence ?? 1e9) - (b.sequence ?? 1e9)
                 || String(a.created).localeCompare(String(b.created)));
}

/** Cites an existing Task on one Report Occurrence Section.
 *
 *  The whole-report save (saveReportOccurrenceContent) reconciles every
 *  section and citation at once, which is right for the author's editor and
 *  wrong here: a reader adding one Task must not rewrite the rest of someone
 *  else's report. This writes exactly one citation row and touches nothing
 *  else.
 *
 *  -> { id, errors }
 */
export async function citeTaskOnSection(sectionId, task){
  if(!sectionId || !task?.id)
    return { id:null, errors:[{ table:'lm_reportsectioncitations',
                                error:new Error('a section and a task are both required') }] };
  try{
    const created = await Lm_reportsectioncitationsesService.create(
      reportCitationRow({ kind:'Task', taskId:task.id,
                          label:'Task: ' + (task.name || 'task') }, sectionId));
    return { id: idOrThrow(created, 'lm_reportsectioncitationsid'), errors: [] };
  }catch(e){
    return { id:null, errors:[{ table:'lm_reportsectioncitations', error:e }] };
  }
}

/** A reader answers a section of someone else's report by writing a section in
 *  one of their OWN Draft/Returned reports (Leadership Practice Extension:
 *  "comment on a report as a draft paragraph").
 *
 *  Writes exactly two rows and touches nothing else in either report:
 *    - a new lm_reportoccurrencesections row at the end of the reader's report
 *      (source Added), holding the response;
 *    - one lm_reportsectioncitations row on it, kind Paragraph, with
 *      lm_CitedReportOccurrence -> the answered report. A citation has no
 *      lookup to a single section (lm_citedsection is its own parent), so
 *      the answered section is named in the label.
 *  The caller checks the target is the reader's and still editable.
 *
 *  -> { id: new section id | null, errors } */
export async function respondToReportSection({ targetOccurrenceId, heading, body, angle,
                                               citedReportId, citedLabel }){
  const errors = [];
  if(!targetOccurrenceId || !citedReportId)
    return { id:null, errors:[{ table:'lm_reportoccurrencesections',
                                error:new Error('a target report and the answered report are both required') }] };
  let sectionId = null;
  try{
    const res = await Lm_reportoccurrencesectionsesService.getAll({
      filter: `_lm_reportoccurrence_value eq ${targetOccurrenceId}`,
      select: ['lm_reportoccurrencesectionsid', 'lm_sequence'],
    });
    assertSuccess(res);
    const last = Math.max(0, ...(res.data ?? []).map(s => s.lm_sequence ?? 0));
    const created = await Lm_reportoccurrencesectionsesService.create({
      lm_heading: capped(heading, 850, 'Section heading'),
      lm_body: capped(body, 4000, 'Section text'),
      lm_diagnosticangle: SECTION_ANGLE_KEY[angle] ?? SECTION_ANGLE_KEY.Untyped,
      lm_sequence: last + 1,
      lm_source: SECTION_SOURCE_ADDED,
      'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${targetOccurrenceId})`,
    });
    sectionId = idOrThrow(created, 'lm_reportoccurrencesectionsid');
  }catch(e){
    return { id:null, errors:[{ table:'lm_reportoccurrencesections', error:e }] };
  }
  try{
    const c = await Lm_reportsectioncitationsesService.create(
      reportCitationRow({ kind:'Paragraph', citedReportId, label:citedLabel || 'Responds to a section' }, sectionId));
    idOrThrow(c, 'lm_reportsectioncitationsid');
  }catch(e){
    /* The response itself is saved; only the link back is missing. */
    errors.push({ table:'lm_reportsectioncitations', error:e });
  }
  return { id: sectionId, errors };
}

/* One lm_reportsectioncitations row. Lookups are bound only when they have a
   value -- an empty bind path is a 400 (see PROJECT-CONTEXT section 5, 17 Sep). */
function reportCitationRow(c, sectionId){
  const row = {
    lm_name: capped(c.label, 850, 'Citation label'),
    lm_kind: REPORT_CITATION_KIND_KEY[c.kind] ?? null,
    'lm_CitedSection@odata.bind': `/lm_reportoccurrencesectionses(${sectionId})`,
  };
  if(c.kpiId)         row['lm_KPI@odata.bind'] = `/strategy_kpises(${c.kpiId})`;
  if(c.processId)     row['lm_Process@odata.bind'] = `/strategy_processes(${c.processId})`;
  if(c.citedReportId) row['lm_CitedReportOccurrence@odata.bind'] = `/lm_reportoccurrences(${c.citedReportId})`;
  /* Four added 20 Sep, a fifth (Project) added later the same week. Targets
     confirmed from the relationship names in live metadata. Bound only when
     set, like every lookup above -- an empty bind path is a 400. */
  if(c.pocId)         row['lm_POC@odata.bind'] = `/stf_strategypocs(${c.pocId})`;
  if(c.strategyId)    row['lm_Strategy@odata.bind'] = `/strategy_strategies(${c.strategyId})`;
  if(c.biId)          row['lm_BIReport@odata.bind'] = `/lm_bireportdashboards(${c.biId})`;
  if(c.taskId)        row['lm_Task@odata.bind'] = `/hx_taskses(${c.taskId})`;
  if(c.projectId)     row['lm_Project@odata.bind'] = `/cr603_projectses(${c.projectId})`;
  /* A Child Report citation names the child TEMPLATE, never one of its
     occurrences -- REPORT-OCCURRENCE-FLOW-PLAN section 8, revised 07 Sep: a
     child Template can have several occurrences for one period once they fan
     out per department, so which one is meant is a person's decision. */
  if(c.childTemplateId)
    row['lm_ChildReportTemplate@odata.bind'] = `/lm_report_templates(${c.childTemplateId})`;
  if(c.breakdown && SECTION_BREAKDOWN_DIM_KEY[c.breakdown])
    row.lm_breakdowndimension = SECTION_BREAKDOWN_DIM_KEY[c.breakdown];
  return row;
}

/* ⚠️ The KPI-gap section is identified by its HEADING, because there is
   nowhere else to mark it: lm_source is a two-value choice (Migrated / Added)
   with no spare option, and the section table carries no other flag. So
   renaming this section in the editor means the next sync will not recognise
   it and will create a second one. Worth a column of its own if this feature
   stays -- noted in PROJECT-CONTEXT.md.

   It IS a real section: it sequences, exports and round-trips through
   saveReportOccurrenceContent() like any other, and the author can read and
   reorder it. */
export const KPI_GAP_SECTION_HEADING = 'KPI data gaps';

const gapHeadingMatches = h =>
  String(h || '').trim().toLowerCase() === KPI_GAP_SECTION_HEADING.toLowerCase();

/** Brings the KPI-gap section on one Report Occurrence into line with the gaps
 *  that exist right now.
 *
 *  ⚠️ Never called on open. It WRITES -- creating a section, adding and
 *  deleting citations -- so it runs only when someone asks for it. A reader
 *  opening a report must never mutate it, and a submitted or approved report
 *  must not change after the fact; the caller enforces that.
 *
 *  Reconciled, not rewritten: a KPI still missing keeps its existing citation
 *  row, so re-running this does not churn ids.
 *
 *  @param {string} occurrenceId
 *  @param {Array<{id:string,name?:string}>} gapKpis  the KPIs missing data NOW
 *  @returns {Promise<{sectionId:string|null, added:string[], removed:string[],
 *                     kept:number, sectionDeleted:boolean, errors:object[]}>}
 */
export async function syncKpiGapSection(occurrenceId, gapKpis = []){
  const errors = [];
  const fail = (table, error, what) => errors.push({ table, error, what });
  if(!occurrenceId) throw new Error('syncKpiGapSection: an occurrence id is required');

  /* De-duplicated: the same KPI can reach here from the Setup and from a
     section citation, and it is one gap either way. */
  const want = new Map();
  for(const k of gapKpis || []) if(k?.id && !want.has(k.id)) want.set(k.id, k.name || null);

  const secRes = await Lm_reportoccurrencesectionsesService.getAll({
    filter: `_lm_reportoccurrence_value eq ${occurrenceId}`,
    select: ['lm_reportoccurrencesectionsid', 'lm_heading', 'lm_sequence'],
  });
  const sections = secRes?.data ?? [];
  const found = sections.find(s => gapHeadingMatches(s.lm_heading));
  let sectionId = found?.lm_reportoccurrencesectionsid || null;

  const citationsOf = id => Lm_reportsectioncitationsesService.getAll({
    filter: `_lm_citedsection_value eq ${id}`,
    select: ['lm_reportsectioncitationsid', '_lm_kpi_value', 'lm_name'],
  }).then(r => r?.data ?? []).catch(e => {
    fail('lm_reportsectioncitations', e, 'reading the gap section'); return [];
  });

  /* ---- nothing missing any more: the section has served its purpose ---- */
  if(!want.size){
    if(!sectionId)
      return { sectionId: null, added: [], removed: [], kept: 0, sectionDeleted: false, errors };
    const removed = [];
    for(const c of await citationsOf(sectionId)){
      try{
        await Lm_reportsectioncitationsesService.delete(c.lm_reportsectioncitationsid);
        removed.push(c['_lm_kpi_value' + FV] || c.lm_name || 'a KPI');
      }catch(e){ fail('lm_reportsectioncitations', e, 'removing a filled KPI'); }
    }
    try{
      await Lm_reportoccurrencesectionsesService.delete(sectionId);
    }catch(e){
      fail('lm_reportoccurrencesections', e, 'removing the empty gap section');
      return { sectionId, added: [], removed, kept: 0, sectionDeleted: false, errors };
    }
    return { sectionId: null, added: [], removed, kept: 0, sectionDeleted: true, errors };
  }

  /* ---- the body, rewritten every time so its count cannot go stale ----- */
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const body = `${want.size} KPI${want.size === 1 ? '' : 's'} cited here `
    + `${want.size === 1 ? 'has' : 'have'} no Actual or no Target recorded for this `
    + `report's Business Unit, Department, Function and period. This is missing source `
    + `data in Dataverse, not something the report itself can supply. Checked ${stamp}.`;

  if(!sectionId){
    const maxSeq = sections.reduce((n, s) => Math.max(n, s.lm_sequence ?? 0), 0);
    try{
      const created = await Lm_reportoccurrencesectionsesService.create({
        lm_heading: KPI_GAP_SECTION_HEADING,
        lm_body: capped(body, 4000, 'Section text'),
        lm_diagnosticangle: SECTION_ANGLE_KEY.Descriptive ?? SECTION_ANGLE_KEY.Untyped,
        lm_sequence: maxSeq + 1,
        lm_source: SECTION_SOURCE_ADDED,
        'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${occurrenceId})`,
      });
      sectionId = idOrThrow(created, 'lm_reportoccurrencesectionsid');
    }catch(e){
      fail('lm_reportoccurrencesections', e, 'creating the gap section');
      return { sectionId: null, added: [], removed: [], kept: 0, sectionDeleted: false, errors };
    }
  }else{
    try{
      await Lm_reportoccurrencesectionsesService.update(sectionId,
        { lm_body: capped(body, 4000, 'Section text') });
    }catch(e){ fail('lm_reportoccurrencesections', e, 'updating the gap section text'); }
  }

  /* ---- reconcile the citations ----------------------------------------- */
  const have = await citationsOf(sectionId);
  const haveByKpi = new Map();
  const strays = [];
  for(const c of have){
    if(c._lm_kpi_value && !haveByKpi.has(c._lm_kpi_value)) haveByKpi.set(c._lm_kpi_value, c);
    else strays.push(c);           // a duplicate, or a citation naming no KPI
  }

  const added = [], removed = [];
  let kept = 0;

  for(const [kpiId, c] of haveByKpi){
    if(want.has(kpiId)){ kept++; continue; }
    /* Its data has arrived. Dropping it is the whole point of re-running:
       the section shrinks as the gaps are filled, and disappears entirely
       once the last one is. */
    try{
      await Lm_reportsectioncitationsesService.delete(c.lm_reportsectioncitationsid);
      removed.push(c['_lm_kpi_value' + FV] || c.lm_name || 'a KPI');
    }catch(e){ fail('lm_reportsectioncitations', e, 'removing a filled KPI'); }
  }

  for(const c of strays){
    try{ await Lm_reportsectioncitationsesService.delete(c.lm_reportsectioncitationsid); }
    catch(e){ fail('lm_reportsectioncitations', e, 'removing a stray citation'); }
  }

  for(const [kpiId, name] of want){
    if(haveByKpi.has(kpiId)) continue;
    try{
      await Lm_reportsectioncitationsesService.create(reportCitationRow(
        { kind: 'KPI', kpiId, label: 'KPI: ' + (name || 'missing data') }, sectionId));
      added.push(name || 'a KPI');
    }catch(e){ fail('lm_reportsectioncitations', e, `citing ${name || kpiId}`); }
  }

  return { sectionId, added, removed, kept, sectionDeleted: false, errors };
}

/**
 * Writes an edited report back, changing only what changed.
 *
 * @param {string} occurrenceId
 * @param {object} p
 * @param {string} [p.name]  the new title -- pass only when it changed
 * @param {Array}  p.before  exactly what fetchReportOccurrenceForEdit returned
 * @param {Array}  p.after   the edited copy, in the order to save
 * @returns {Promise<{errors:{table:string,error:any,what?:string}[]}>}
 *
 * Order matters for integrity: removed sections lose their citations first,
 * then the section; each kept or new section is written before the citations
 * that bind to it. A failure is recorded and the rest carries on, so one bad
 * row does not strand every other change -- the caller reloads afterwards and
 * shows what actually landed.
 */
export async function saveReportOccurrenceContent(occurrenceId, { name, before = [], after = [] } = {}){
  const errors = [];
  const fail = (table, error, what) => errors.push({ table, error, what });

  if(name !== undefined){
    try{
      const r = await Lm_reportoccurrencesService.update(occurrenceId,
        { lm_name: capped(name, 850, 'Title') || '(untitled report)' });
      assertSuccess(r);
    }catch(e){ fail('lm_reportoccurrences', e, 'title'); }
  }

  const beforeById = new Map(before.map(s => [s.id, s]));
  const keptIds = new Set(after.map(s => s.id).filter(Boolean));

  for(const s of before){
    if(keptIds.has(s.id)) continue;
    for(const c of s.citations || []){
      try{ await Lm_reportsectioncitationsesService.delete(c.id); }
      catch(e){ fail('lm_reportsectioncitations', e, `citation on removed section "${s.heading}"`); }
    }
    try{ await Lm_reportoccurrencesectionsesService.delete(s.id); }
    catch(e){ fail('lm_reportoccurrencesections', e, `removing section "${s.heading}"`); }
  }

  for(let i = 0; i < after.length; i++){
    const s = after[i];
    const seq = i + 1;
    let fields;
    try{
      fields = {
        lm_heading: capped(s.heading, 850, 'Section heading'),
        lm_body: capped(s.body, 4000, 'Section text'),
        lm_diagnosticangle: SECTION_ANGLE_KEY[s.angle] ?? SECTION_ANGLE_KEY.Untyped,
        lm_sequence: seq,
      };
    }catch(e){ fail('lm_reportoccurrencesections', e, `section ${seq}`); continue; }

    let sectionId = s.id;
    const was = sectionId ? beforeById.get(sectionId) : null;
    if(!sectionId){
      try{
        const created = await Lm_reportoccurrencesectionsesService.create({
          ...fields,
          lm_source: SECTION_SOURCE_ADDED,
          'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${occurrenceId})`,
        });
        sectionId = idOrThrow(created, 'lm_reportoccurrencesectionsid');
      }catch(e){ fail('lm_reportoccurrencesections', e, `adding section ${seq}`); continue; }
    }else if(!was || was.heading !== s.heading || was.body !== s.body
                  || was.angle !== s.angle || was.sequence !== seq){
      try{
        const r = await Lm_reportoccurrencesectionsesService.update(sectionId, fields);
        assertSuccess(r);
      }catch(e){ fail('lm_reportoccurrencesections', e, `section ${seq}`); }
    }

    const nowIds = new Set((s.citations || []).map(c => c.id).filter(Boolean));
    for(const c of (was?.citations || [])){
      if(nowIds.has(c.id)) continue;
      try{ await Lm_reportsectioncitationsesService.delete(c.id); }
      catch(e){ fail('lm_reportsectioncitations', e, `removing a citation from section ${seq}`); }
    }
    /* ⚠️ Written in bounded parallel, not one at a time. The picker's
       select-all is deliberately uncapped (product owner's call, 27 Sep), so a
       section can arrive with thousands of new citations -- and serially, at a
       round trip each, "every delayed task in AHQ" took tens of minutes.

       Ten at a time: enough to turn that into minutes, far enough below
       Dataverse's per-user request limit to be safe, and each one keeps its own
       try/catch so a single failure is still attributed to its own citation
       rather than losing the whole batch. */
    const fresh = (s.citations || []).filter(c => !c.id);
    const CITE_CONCURRENCY = 10;
    for(let i = 0; i < fresh.length; i += CITE_CONCURRENCY){
      await Promise.all(fresh.slice(i, i + CITE_CONCURRENCY).map(async c => {
        try{
          const created = await Lm_reportsectioncitationsesService.create(reportCitationRow(c, sectionId));
          idOrThrow(created, 'lm_reportsectioncitationsid');
        }catch(e){ fail('lm_reportsectioncitations', e, `citing "${c.label}" in section ${seq}`); }
      }));
    }
  }

  return { errors };
}

/** Every Meeting Occurrence created from one Meeting Template -- filtered
 *  server-side, and far lighter than fetchMeetingOccurrences() (no agenda or
 *  attendee child rows), since this only needs to answer "is this Template
 *  actually in use, and by what." Used by the Setup Register's Usage tab. */
export async function fetchMeetingOccurrencesByTemplate(templateId){
  const res = await Lm_meetingoccurrencesService.getAll({
    filter: `_lm_meetingtemplate_value eq ${templateId}`,
    select: ['lm_meetingoccurrenceid','lm_name','lm_date','lm_meetingstatus',
             '_lm_businessunit_value','_lm_region_value','createdon'],
  });
  return (res?.data ?? []).map(o => ({
    id: o.lm_meetingoccurrenceid,
    name: o.lm_name || '(untitled meeting)',
    date: isoDay(o.lm_date),
    status: MEETING_OCC_STATUS[o.lm_meetingstatus] || 'Scheduled',
    businessUnitId: o._lm_businessunit_value || null,
    regionId: o._lm_region_value || null,
    created: o.createdon || null,
  }));
}

/** Every Report Occurrence created from one Report Template -- same
 *  server-side-filtered shape as fetchMeetingOccurrencesByTemplate above. */
export async function fetchReportOccurrencesByTemplate(templateId){
  const res = await Lm_reportoccurrencesService.getAll({
    filter: `_lm_reporttemplate_value eq ${templateId}`,
    select: ['lm_reportoccurrenceid','lm_name','lm_period','lm_status',
             '_lm_businessunit_value','_lm_region_value','createdon'],
  });
  return (res?.data ?? []).map(r => ({
    id: r.lm_reportoccurrenceid,
    name: r.lm_name || '(untitled report)',
    period: isoDay(r.lm_period),
    status: REPORT_OCC_STATUS[r.lm_status] || 'Draft',
    businessUnitId: r._lm_businessunit_value || null,
    regionId: r._lm_region_value || null,
    created: r.createdon || null,
  }));
}

/**
 * Creates one Meeting Occurrence: the parent lm_meetingoccurrences row, then
 * its agenda rows and attendee rows. Mirrors the template-save functions
 * above -- a child row that fails is collected into `errors` rather than
 * aborting the rest, since the occurrence itself is already real by then.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} [payload.templateId] lm_meetingtemplates id -- omitted for a Custom Ad Hoc Meeting
 * @param {string} [payload.businessUnitId] Stage 1 only
 * @param {string} [payload.regionId] Stage 2 only
 * @param {string} [payload.departmentId]
 * @param {string} [payload.stage] 'Business Unit'|'Region'|'Group'|'ExCom', or a full Stage label
 * @param {string} [payload.chairPositionId]
 * @param {string} [payload.facilitatorPositionId]
 * @param {string} payload.date 'YYYY-MM-DD'
 * @param {string} [payload.start] 'HH:mm'
 * @param {string} [payload.end] 'HH:mm'
 * @param {string} [payload.timezone]
 * @param {string} [payload.mode] 'Physical'|'Online'|'Hybrid'
 * @param {string} [payload.status] defaults to 'Scheduled'
 * @param {string} [payload.location]
 * @param {string} [payload.link]
 * @param {string} [payload.adhocType]
 * @param {boolean} [payload.restricted]
 * @param {string} [payload.inviteSent] 'YYYY-MM-DD'
 * @param {string} [payload.rescheduledFromId]
 * @param {string} [payload.teamChannelId] and_teamschannellinks id
 * @param {{title:string, ownerPositionId?:string, source?:string}[]} [payload.agenda]
 * @param {{positionId:string, name?:string, type?:string}[]} [payload.attendees] `type` is
 *        'Required' or 'Optional', written to lm_type; defaults to Required.
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function createMeetingOccurrence(payload){
  const errors = [];

  const parent = {
    lm_name: payload.name || 'Untitled Meeting',
    lm_date: payload.date || null,
    lm_starttime: payload.start || null,
    lm_endtime: payload.end || null,
    lm_timezone: payload.timezone || null,
    lm_mode: payload.mode ? (MEETING_OCC_MODE_KEY[payload.mode] ?? null) : null,
    lm_meetingstatus: MEETING_OCC_STATUS_KEY[payload.status || 'Scheduled'] ?? 1,
    lm_meetinglocation: payload.location || null,
    lm_meetinglink: payload.link || null,
    lm_adhoctype: payload.adhocType || null,
    lm_restricted: !!payload.restricted,
    lm_invitesentdate: payload.inviteSent || null,
    lm_syncstatus: MEETING_OCC_SYNC_KEY.Synchronized,
    lm_meetingstage: payload.stage ? (MEETING_OCC_STAGE_KEY[payload.stage] ?? null) : null,
  };
  /* A Custom Ad Hoc Meeting's own Type / Classification / Category (01 Oct) --
     a Setup-based one inherits them from its Setup. Written only when given.
     ⚠️ lm_Meetingcategory exists on lm_meetingoccurrence in DT New only
     (added 01 Oct); IT needs it before a Custom meeting with a Category can
     be saved there. */
  /* The Setup's TOR / Policy link travels with the occurrence (01 Oct). */
  if(payload.torLink) parent.lm_torpolicylink = String(payload.torLink).trim();
  /* Time limits copied from the Setup (or the meeting being rescheduled). */
  for(const [k, col] of [['momWriteupHours','lm_momwriteuphours'],['momApprovalHours','lm_momapprovalhours'],
                         ['gridSubmitHours','lm_gridsubmithours']])
    if(typeof payload[k] === 'number') parent[col] = payload[k];
  if(payload.setupType)      parent.lm_setuptype = MEETING_SETUP_TYPE_KEY[payload.setupType] ?? null;
  if(payload.classification) parent.lm_meetingclassification = MEETING_CATEGORY_KEY[payload.classification] ?? null;
  if(payload.meetingCategoryId) parent['lm_Meetingcategory@odata.bind'] = `/lm_meetingcategories(${payload.meetingCategoryId})`;
  if(payload.templateId)        parent['lm_MeetingTemplate@odata.bind']   = `/lm_meetingtemplates(${payload.templateId})`;
  if(payload.businessUnitId)    parent['lm_BusinessUnit@odata.bind']      = `/businessunits(${payload.businessUnitId})`;
  if(payload.regionId)          parent['lm_Region@odata.bind']            = `/crd04_regionses(${payload.regionId})`;
  if(payload.departmentId)      parent['lm_Department@odata.bind']        = `/cr603_chklst_departmentses(${payload.departmentId})`;
  if(payload.chairPositionId)   parent['lm_ChairmanPosition@odata.bind']  = `/cr603_organizationstructures(${payload.chairPositionId})`;
  if(payload.facilitatorPositionId) parent['lm_FacilitatorPosition@odata.bind'] = `/cr603_organizationstructures(${payload.facilitatorPositionId})`;
  if(payload.rescheduledFromId) parent['lm_RescheduledFrom@odata.bind']   = `/lm_meetingoccurrences(${payload.rescheduledFromId})`;
  /* The Teams channel the meeting belongs to (03 Oct, a Custom Ad Hoc
     meeting's own pick). lm_TeamChannel -> and_teamschannellinks, in IT and
     DT New alike. */
  if(payload.teamChannelId)     parent['lm_TeamChannel@odata.bind']       = `/and_teamschannellinks(${payload.teamChannelId})`;

  let occId = null;
  try{
    const created = await Lm_meetingoccurrencesService.create(parent);
    occId = idOrThrow(created, 'lm_meetingoccurrenceid');
  }catch(e){
    errors.push({ table:'lm_meetingoccurrences', error:e });
    return { id:null, errors };
  }

  const bind = `/lm_meetingoccurrences(${occId})`;

  for(const [i, item] of (payload.agenda||[]).entries()){
    if(!item?.title) continue;
    try{
      const row = {
        'lm_MeetingOccurrence@odata.bind': bind,
        lm_title: item.title,
        lm_sequence: i+1,
        lm_source: item.source || 'Ad Hoc',
        lm_covered: AGENDA_COVERED_KEY['Not Yet Recorded'],
      };
      if(item.ownerPositionId) row['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${item.ownerPositionId})`;
      /* The item this one was carried forward FROM -- an earlier occurrence's
         agenda item. IT's lookup targets lm_meetingoccurrenceagenda (schema
         refresh, 28 Sep); this bound the template agenda table, which would
         400. No caller sets carriedFromId yet, so it had never run. */
      if(item.carriedFromId)   row['lm_CarriedFromAgendaItem@odata.bind'] = `/lm_meetingoccurrenceagendas(${item.carriedFromId})`;
      await Lm_meetingoccurrenceagendasService.create(row);
    }catch(e){ errors.push({ table:'lm_meetingoccurrenceagendas', error:e }); }
  }

  for(const att of (payload.attendees||[])){
    if(!att?.positionId) continue;
    try{
      await Lm_meetingoccurrenceattendeesesService.create({
        'lm_MeetingOccurrence@odata.bind': bind,
        'lm_AttendeePosition@odata.bind': `/cr603_organizationstructures(${att.positionId})`,
        lm_name: att.name || undefined,
        lm_present: ATTENDEE_PRESENT_KEY['Not Yet Recorded'],
        lm_type: ATTENDEE_TYPE_KEY[att.type] ?? ATTENDEE_TYPE_KEY.Required,
      });
    }catch(e){ errors.push({ table:'lm_meetingoccurrenceattendeeses', error:e }); }
  }

  return { id: occId, errors };
}

/** Patches ONLY the status on an existing lm_meetingoccurrences row -- the
 *  Mark as Held / Cancel actions, distinct from a full edit. */
export async function updateMeetingOccurrenceStatus(id, status){
  try{
    const result = await Lm_meetingoccurrencesService.update(id, {
      lm_meetingstatus: MEETING_OCC_STATUS_KEY[status] ?? null,
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrences', error:e }] };
  }
}

/** Patches ONLY lm_present on one lm_meetingoccurrenceattendeeses row. */
/** Adds one Attendee to an existing occurrence (01 Oct) -- the same row
 *  createMeetingOccurrence() writes per attendee: the Position, a name, the
 *  type (Required / Optional) and attendance "Not Yet Recorded". Meant for a
 *  Scheduled meeting; attendance is recorded once it is Held. */
export async function addMeetingOccurrenceAttendee(occurrenceId, { positionId, name, type }){
  if(!occurrenceId || !positionId)
    return { id:null, errors:[{ table:'lm_meetingoccurrenceattendeeses', error:new Error('a meeting and a Position are required') }] };
  try{
    const created = await Lm_meetingoccurrenceattendeesesService.create({
      'lm_MeetingOccurrence@odata.bind': `/lm_meetingoccurrences(${occurrenceId})`,
      'lm_AttendeePosition@odata.bind': `/cr603_organizationstructures(${positionId})`,
      lm_name: name || undefined,
      lm_present: ATTENDEE_PRESENT_KEY['Not Yet Recorded'],
      lm_type: ATTENDEE_TYPE_KEY[type] ?? ATTENDEE_TYPE_KEY.Required,
    });
    return { id: idOrThrow(created, 'lm_meetingoccurrenceattendeesid'), errors: [] };
  }catch(e){
    return { id:null, errors:[{ table:'lm_meetingoccurrenceattendeeses', error:e }] };
  }
}

export async function updateMeetingOccurrenceAttendance(attendeeId, present){
  try{
    const result = await Lm_meetingoccurrenceattendeesesService.update(attendeeId, {
      lm_present: ATTENDEE_PRESENT_KEY[present] ?? null,
    });
    assertSuccess(result);
    return { id: attendeeId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceattendeeses', error:e }] };
  }
}

/** Patches date/time/mode/location/link on an existing lm_meetingoccurrences
 *  row -- the controlled name, Setup, classification and scope stay
 *  Taxonomy's, so none of those are touched here.
 * @param {object} payload
 * @param {string} payload.date
 * @param {string} payload.start
 * @param {string} payload.end
 * @param {string} payload.mode one of MEETING_OCC_MODE_KEY's keys
 * @param {string} [payload.location]
 * @param {string} [payload.link]
 */
export async function updateMeetingOccurrence(id, payload){
  try{
    const result = await Lm_meetingoccurrencesService.update(id, {
      lm_date: payload.date || null,
      lm_starttime: payload.start || null,
      lm_endtime: payload.end || null,
      lm_mode: payload.mode ? (MEETING_OCC_MODE_KEY[payload.mode] ?? null) : null,
      lm_meetinglocation: payload.location || null,
      lm_meetinglink: payload.link || null,
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrences', error:e }] };
  }
}

/** Sets only the Start / End time of a Meeting Occurrence (06 Oct) -- for the
 *  top bar's notification center, where the Organizer fills in the exact time
 *  of a meeting that is due. Nothing else on the row is touched (the full
 *  updateMeetingOccurrence() also rewrites mode, location and link).
 *  Times are 'HH:MM', the same as everywhere else. */
export async function updateMeetingOccurrenceTimes(id, { start, end }){
  try{
    const result = await Lm_meetingoccurrencesService.update(id, {
      lm_starttime: start || null,
      lm_endtime: end || null,
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrences', error:e }] };
  }
}

/** Cancels a live Meeting Occurrence -- status to Cancelled plus the reason,
 *  in one patch. No governance record (Minutes, Grid) gets created for a
 *  cancelled occurrence. */
export async function cancelMeetingOccurrence(id, reason){
  try{
    const result = await Lm_meetingoccurrencesService.update(id, {
      lm_meetingstatus: MEETING_OCC_STATUS_KEY.Cancelled,
      lm_cancelreason: (reason||'').trim() || null,
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrences', error:e }] };
  }
}

/** Stamps today's date as when the Agenda was distributed -- a simple
 *  action, not tied to any one Agenda Item, matching how invite/agenda lead
 *  time (AG-03/AG-15) reads a single date off the occurrence itself. */
export async function recordAgendaDistribution(id){
  try{
    const result = await Lm_meetingoccurrencesService.update(id, {
      lm_agendasentdate: nowIso(),
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrences', error:e }] };
  }
}

/**
 * Creates one Report Occurrence. A single row -- unlike a Meeting Occurrence it
 * owns no child tables (its trail lives in lm_reportoccurrencehistories, which
 * nothing writes yet).
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} [payload.objective]
 * @param {string} [payload.templateId] lm_report_templates id -- omitted for an Ad Hoc Report,
 *        which is what lm_nosetupflag records
 * @param {string} [payload.businessUnitId]
 * @param {string} [payload.regionId]
 * @param {string} [payload.stage] a Stage label, or 'Business Unit'|'Region'|'Group'|'ExCom'
 * @param {string} [payload.departmentId]
 * @param {string} [payload.functionId]
 * @param {string} [payload.creatorPositionId]
 * @param {string} [payload.period] 'YYYY-MM-DD' -- the period the Report covers
 * @param {string} [payload.status] one of REPORT_OCC_STATUS_KEY's keys; defaults to Draft
 * @param {string} [payload.fileUrl]
 * @param {number} [payload.version] defaults to 1
 * @param {number} [payload.reviewStep]
 * @param {boolean} [payload.locked]
 * @param {boolean} [payload.noSetupFlag] true when the Report has no approved Setup behind it
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
/* Template item type -> Report Occurrence citation kind. File is absent on
   purpose: lm_reportsectioncitations has no File kind and no file column, and
   the flow plan (section 12) states it creates kinds 1, 2, 3 and 11 only. */
const TEMPLATE_ITEM_CITATION_KIND = {
  'KPI': 'KPI', 'Breakdown': 'Breakdown', 'Process': 'Process',
  'Child Template': 'Child Report',
};

/** Copies a Report Template's Content Checklist onto a freshly created
 *  Occurrence: one Section per checklist row, marked Migrated, carrying the
 *  citations that have an occurrence-side equivalent.
 *
 *  Partial success is normal and reported rather than thrown -- the
 *  Occurrence itself already exists by this point, so failing here must not
 *  read as "the report was not created".
 *
 *  -> { created, citations, skippedFiles, errors }
 */
export async function migrateTemplateSectionsToOccurrence(occurrenceId, templateId, onProgress){
  /* Called as the copy proceeds so a caller can show real progress rather
     than a spinner. Never allowed to break the copy: a throwing callback
     would otherwise abort a migration that was succeeding. */
  const report = (done, total, label) => {
    try{ if(onProgress) onProgress({ done, total, label }); }
    catch(e){ console.warn('[dataverse] migration onProgress threw:', e); }
  };
  const errors = [];
  let detail;
  try{
    detail = await fetchReportTemplateDetail(templateId);
  }catch(e){
    return { created:0, citations:0, skippedFiles:0,
             errors:[{ table:'lm_report_templates', error:e, what:'reading the Setup' }] };
  }

  /* The checklist's own step is the order the Setup defined; sequence is
     renumbered from 1 so a gap in the Template does not leave one here. */
  const rows = (detail.checklist || []).slice()
    .sort((a,b)=>(a.lm_checklistitemstep ?? 1e9) - (b.lm_checklistitemstep ?? 1e9));
  report(0, rows.length, rows.length ? 'Copying sections from the Setup…' : 'The Setup defines no sections.');

  /* Child Template citations: bind a real occurrence of the child where one
     exists, exactly as Build a report/plan's insert does, and keep the
     template id either way. An unbound citation is prose about a report
     rather than a link to it, which is what leaves the hierarchy with no
     edges. Resolved once per distinct child template, not once per citation.

     ⚠️ This is a considered DEPARTURE from REPORT-OCCURRENCE-FLOW-PLAN section
     8, which says to cite the Template only and let a person pick the
     occurrence, because a child Template may have several per period. The
     shipped UI already chose the other way; both ids are written, so nothing
     is lost and a person can still repoint it. */
  const childIds = [...new Set((detail.checklist || [])
    .flatMap(c => (c.items || []).map(it => it.childTemplateId))
    .filter(Boolean))];
  const childOcc = new Map();
  for(const tid of childIds){
    try{
      const occs = await fetchReportOccurrencesByTemplate(tid);
      /* Newest first -- the same "most recent occurrence of that template"
         the insert path settles on. */
      const best = (occs || []).slice().sort((a, b) =>
        String(b.period || b.created || '').localeCompare(String(a.period || a.created || '')))[0];
      if(best) childOcc.set(tid, best);
    }catch(e){
      console.warn('[dataverse] could not resolve occurrences of child template', tid, e);
    }
  }

  let created = 0, citations = 0, skippedFiles = 0;

  for(let i = 0; i < rows.length; i++){
    const c = rows[i];
    const seq = i + 1;
    let sectionId;
    try{
      const res = await Lm_reportoccurrencesectionsesService.create({
        lm_heading: capped(c.lm_checklistitemname || `Section ${seq}`, 850, 'Section heading'),
        /* Same option set on both sides, checked against DV_SECTION_ANGLE. */
        lm_diagnosticangle: c.lm_diagnosticangle ?? SECTION_ANGLE_KEY.Untyped,
        lm_sequence: seq,
        lm_source: SECTION_SOURCE_MIGRATED,
        'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${occurrenceId})`,
      });
      sectionId = idOrThrow(res, 'lm_reportoccurrencesectionsid');
      created++;
      report(created, rows.length,
        `Copied ${created} of ${rows.length} section${rows.length===1?'':'s'}…`);
    }catch(e){
      errors.push({ table:'lm_reportoccurrencesections', error:e, what:`section ${seq}` });
      continue;                       // its citations have nowhere to hang
    }

    for(const it of (c.items || [])){
      const kind = TEMPLATE_ITEM_CITATION_KIND[it.type];
      if(!kind){ if(it.type === 'File') skippedFiles++; continue; }
      const occ = it.childTemplateId ? childOcc.get(it.childTemplateId) : null;
      /* lm_name is the citation's only human-readable field. The Template
         usually stamps one; this is the fallback when it did not, so a
         citation never lands as an empty row. */
      const label = it.label
        || (occ && occ.name)
        || (it.dimension ? `Breakdown by ${it.dimension}` : null)
        || kind;
      try{
        const r = await Lm_reportsectioncitationsesService.create(reportCitationRow({
          kind,
          label,
          kpiId: it.kpiId || undefined,
          processId: it.processId || undefined,
          childTemplateId: it.childTemplateId || undefined,
          citedReportId: occ ? occ.id : undefined,
          breakdown: it.dimension || undefined,
        }, sectionId));
        idOrThrow(r, 'lm_reportsectioncitationsid');
        citations++;
      }catch(e){
        errors.push({ table:'lm_reportsectioncitations', error:e,
                      what:`citing "${it.label}" in section ${seq}` });
      }
    }
  }
  /* Logged on every run: "created without its checklist" was not
     diagnosable from outside, and the counts say immediately whether the
     Template had sections, whether they were written, and what failed. */
  console.info('[dataverse] migrateTemplateSectionsToOccurrence: template %s -> occurrence %s | ' +
    'checklist rows %d, sections created %d, citations %d, files skipped %d, errors %d',
    templateId, occurrenceId, rows.length, created, citations, skippedFiles, errors.length);

  return { created, citations, skippedFiles, errors, checklistRows: rows.length };
}

/* ⚠️ Must match lm_reportobjective's real width in Dataverse, and there is no
   way to read that from here -- the FetchXML `attribute` metadata entity has no
   maxlength column, modelbuilder emits none, and exporting the solution (whose
   XML does carry MaxLength) needs a prvReadSolution privilege this user does
   not have. Widened from 100 to 4000 on 27 Sep on the product owner's word,
   after they changed the column. If a save ever 400s with 0x80044331 again,
   Dataverse's own message names the real number -- believe it over this. */
export const REPORT_OBJECTIVE_MAX = 4000;

export async function createReportOccurrence(payload){
  const row = {
    lm_name: payload.name || 'Untitled Report',
    /* Was capped at 100 characters (Dataverse 400s rather than truncating,
       0x80044331); the column was widened in Dataverse 27 Sep, so the old
       hardcoded length check and its warning are gone. Not capped here on
       purpose either way -- silently shortening what someone typed is worse
       than refusing it. */
    lm_reportobjective: payload.objective || null,
    lm_period: payload.period || null,
    lm_status: REPORT_OCC_STATUS_KEY[payload.status || 'Draft'] ?? REPORT_OCC_STATUS_KEY.Draft,
    lm_fileurl: payload.fileUrl || null,
    lm_version: typeof payload.version === 'number' ? payload.version : 1,
    lm_reviewstep: typeof payload.reviewStep === 'number' ? payload.reviewStep : null,
    lm_locked: !!payload.locked,
    lm_nosetupflag: !!payload.noSetupFlag,
    lm_reportstage: payload.stage ? (MEETING_OCC_STAGE_KEY[payload.stage] ?? null) : null,
  };
  if(payload.templateId)        row['lm_ReportTemplate@odata.bind']   = `/lm_report_templates(${payload.templateId})`;
  if(payload.businessUnitId)    row['lm_BusinessUnit@odata.bind']     = `/businessunits(${payload.businessUnitId})`;
  if(payload.regionId)          row['lm_Region@odata.bind']           = `/crd04_regionses(${payload.regionId})`;
  if(payload.departmentId)      row['lm_Department@odata.bind']       = `/cr603_chklst_departmentses(${payload.departmentId})`;
  /* lm_Function was read back everywhere -- fetchReportOccurrences selects it,
     and pickAchievement() matches KPI figures on it -- but never written,
     because nothing set it on create. */
  if(payload.functionId)        row['lm_Function@odata.bind']         = `/hr_functions(${payload.functionId})`;
  if(payload.creatorPositionId) row['lm_CreatorPosition@odata.bind']  = `/cr603_organizationstructures(${payload.creatorPositionId})`;
  /* Where the report will be saved in SharePoint (28 Sep): the Teams channel
     and the destination path built from it. Written ONLY when given -- the
     columns were added for the Create Report page, and a caller that sends
     neither must not depend on them existing. */
  if(payload.channelId)         row['lm_TeamChannel@odata.bind']      = `/and_teamschannellinks(${payload.channelId})`;
  if(payload.destinationLink)   row.lm_destinationsharepointlink      = capped(payload.destinationLink, 850, 'Destination');

  try{
    const created = await Lm_reportoccurrencesService.create(row);
    const id = idOrThrow(created, 'lm_reportoccurrenceid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/** Uploads the report's working file into lm_reportoccurrences.lm_attachmentfile
 *  (a File column, added 28 Sep for the Create Report page's uploader).
 *  IT_ORG is named explicitly: this runs in the Leadership app, whose
 *  DATA_ORG is DT New, and the table is IT-hosted.
 *  @param base64Content the file body as base64 (no data: prefix) */
export async function uploadReportOccurrenceFile(occurrenceId, fileName, base64Content){
  try{
    await uploadFileColumn('lm_reportoccurrences', occurrenceId, 'lm_attachmentfile',
      fileName, base64Content, PIN_ORG);
    return { errors: [] };
  }catch(e){
    return { errors: [{ table:'lm_reportoccurrences.lm_attachmentfile', error:e }] };
  }
}

/** Patches ONLY the file URL on an existing lm_reportoccurrences row -- the
 *  working copy's location is set after the occurrence exists, from the
 *  Report Detail page's Attachments card. */
export async function updateReportOccurrenceFile(id, fileUrl){
  try{
    const result = await Lm_reportoccurrencesService.update(id, { lm_fileurl: fileUrl || null });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/* ---------------------------------------------------------------------
   WIRED: Meeting Minutes (lm_meetingminuteses), MOM Notes (lm_momnoteses),
          Audit Grid Instances (lm_auditgridinstances) and their Answers
          (lm_auditgridanswers)
   ---------------------------------------------------------------------
   The four tables behind the Committee Score. A Meeting Occurrence owns one
   Meeting Minutes row; the Minutes own one MOM Note per Agenda Item; closing
   the Minutes of a Committee occurrence creates one Audit Grid Instance,
   which owns one Answer row per manually scored question.

   Auto-scored questions are NOT stored -- they are derived from the
   occurrence, its agenda, its attendance and the Minutes every time the Grid
   is rendered, so a stored copy could only ever drift. Only the Facilitator's
   manual answers and evidence need a home, which is what lm_auditgridanswers
   is. The exception is an APPROVED Instance: lm_score / lm_coverage / lm_total
   are written once on approval and never recomputed, which is what freezes
   the published score against a later settings or Template change.
   --------------------------------------------------------------------- */

/* Dataverse spells these without spaces ('PendingFacilitatorReview'), so like
   ATTENDEE_TYPE above these map by code rather than by label -- the app's own
   wording is the one that reaches the UI. */
export const MOM_STATUS      = { 1:'Draft', 2:'Approved', 3:'Closed' };
export const MOM_STATUS_KEY  = { 'Draft':1, 'Approved':2, 'Closed':3 };
/* "Organizer" replaced "Facilitator" on screen (01 Oct); the stored option is
   unchanged and the key map accepts both labels. */
export const GRID_STATE      = { 1:'Pending Organizer Review', 2:'Submitted for Approval',
                                 3:'Approved', 4:'Returned for Revision', 5:'Void' };
export const GRID_STATE_KEY  = { 'Pending Organizer Review':1, 'Pending Facilitator Review':1, 'Submitted for Approval':2,
                                 'Approved':3, 'Returned for Revision':4, 'Void':5 };

/* Dataverse rejects an over-long value with a 400 rather than truncating, so
   every write below is checked against the column's real width first and fails
   with a message naming the column.

   The two Minutes columns have been widened to hold real prose. The three Audit
   Grid columns are still at Dataverse's default 100 characters -- long enough
   for a label, not for an evidence note or a return reason -- so those caps
   still bite and should be widened next. Keep these numbers in step with the
   schema; they are not preferences, they are what the columns actually accept. */
export const MOM_NOTE_MAX      = 4000;  // lm_momnoteses.lm_notes            (widened)
export const MOM_REASON_MAX    = 2000;  // lm_meetingminuteses.lm_returnreason (widened)
export const GRID_EVIDENCE_MAX = 4000;  // lm_auditgridanswers.lm_evidence   (widened to 4000, 01 Oct)
export const GRID_REASON_MAX   = 100;   // grid lm_returnreason / lm_correctionreason

function capped(value, max, column){
  const v = (value ?? '').toString().trim();
  if(v.length > max) throw new Error(column + ' allows at most ' + max + ' characters — this is ' + v.length + '.');
  return v || null;
}

/** Groups child rows by the GUID in `key`. The occurrence fetch above keeps its
 *  own local copy of this; kept separate rather than refactoring that working
 *  path. */
function groupBy(rows, key){
  const m = new Map();
  (rows ?? []).forEach(r => {
    const k = r[key]; if(!k) return;
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

const nowIso = () => new Date().toISOString();

const MOM_SELECT = ['lm_meetingminutesid','lm_name','lm_status','lm_submittedat','lm_approvedat',
                    'lm_closedat','lm_returnreason','lm_signeddate','lm_signedtime','lm_signedname',
                    '_lm_meetingoccurrence_value','_lm_signedbyposition_value','modifiedon','createdon'];
const NOTE_SELECT = ['lm_momnotesid','lm_name','lm_notes','lm_confidential','_lm_meetingminutes_value','_lm_agendaitem_value'];

/* Confidential agenda items (Stage 4 meetings only -- marked in the Minutes
   tab). Since 03 Oct the flag lives on the AGENDA ITEM
   (lm_meetingoccurrenceagenda.lm_confidential, DT New only), and who may read
   it is one lm_meetingminutesreviewerlists row per person, linked to the item
   through lm_MeetingOccurrenceAgenda (and to its MOM Note too, lm_MOMNotes).
   lm_ViewerUser -> systemusers. Before 03 Oct the flag was on the MOM Note
   (lm_momnotes.lm_confidential) and viewers hung off the note only; those
   still count, so nothing marked earlier becomes visible.
   ⚠️ This hides content in the app only -- the rows are still readable to
   anyone with Read on these tables; real protection needs Dataverse security
   on top. */
const Lm_meetingminutesreviewerlistsService =
  dvTable('lm_meetingminutesreviewerlists', 'lm_meetingminutesreviewerlistid', PIN_ORG);
const VIEWER_SELECT = ['lm_meetingminutesreviewerlistid','_lm_momnotes_value','_lm_vieweruser_value'];

/* Viewer rows whose `key` lookup is one of `ids`, grouped by that id. Chunked
   because an OData filter has a length limit. A failure leaves no viewers,
   which only ever hides more, never less. Selecting the agenda lookup fails
   in IT (no such column there), which lands in the same catch. */
async function fetchViewersBy(key, ids){
  const list = [...new Set((ids || []).filter(Boolean))];
  const out = new Map();
  const select = key === '_lm_momnotes_value' ? VIEWER_SELECT : [...VIEWER_SELECT, key];
  for(let i = 0; i < list.length; i += 25){
    const chunk = list.slice(i, i + 25);
    try{
      const res = await Lm_meetingminutesreviewerlistsService.getAll({
        select,
        filter: `statecode eq 0 and (${chunk.map(id => `${key} eq ${id}`).join(' or ')})`,
      });
      for(const r of (res?.data ?? [])){
        const k = r[key]; if(!k) continue;
        if(!out.has(k)) out.set(k, []);
        out.get(k).push({ rowId: r.lm_meetingminutesreviewerlistid, userId: r._lm_vieweruser_value || null });
      }
    }catch(e){ console.warn('[dataverse] confidential item viewers fetch failed:', e); }
  }
  return out;
}
const fetchNoteViewers = noteIds => fetchViewersBy('_lm_momnotes_value', noteIds);

/* One Minutes row plus the Notes belonging to it, in the shape the Minutes tab
   and the scoring engine already expect. `notes` carries the row ids an edit
   needs; `notesByAgenda` is the plain {agendaItemId: text} map the Audit Grid's
   AG-06 reads. Both are returned because they serve different callers. */
function shapeMinutes(m, noteRows, viewersByNote){
  const notes = (noteRows || []).map(n => ({
    id: n.lm_momnotesid,
    agendaItemId: n._lm_agendaitem_value || null,
    text: n.lm_notes || '',
    confidential: !!n.lm_confidential,
    viewers: viewersByNote?.get(n.lm_momnotesid) || [],
  }));
  const notesByAgenda = {};
  notes.forEach(n => { if(n.agendaItemId) notesByAgenda[n.agendaItemId] = n.text; });
  return {
    id: m.lm_meetingminutesid,
    name: m.lm_name || '(untitled minutes)',
    occurrenceId: m._lm_meetingoccurrence_value || null,
    status: MOM_STATUS[m.lm_status] || null,
    submittedAt: m.lm_submittedat || null,
    approvedAt: m.lm_approvedat || null,
    closedAt: m.lm_closedat || null,
    returnReason: m.lm_returnreason || null,
    signedByPositionId: m._lm_signedbyposition_value || null,
    signedName: m.lm_signedname || null,
    signedDate: isoDay(m.lm_signeddate),
    signedTime: m.lm_signedtime || null,
    updated: m.modifiedon || m.createdon || null,
    notes,
    notesByAgenda,
  };
}

/** Every Meeting Minutes row with its Notes attached. Two requests, grouped
 *  client-side -- the same shape as fetchMeetingOccurrences above, and for the
 *  same reason. A Notes failure leaves the Minutes usable. */
export async function fetchMeetingMinutes(){
  const [momRes, noteRes] = await Promise.all([
    Lm_meetingminutesesService.getAll({ select: MOM_SELECT }),
    Lm_momnotesesService.getAll({ select: NOTE_SELECT, filter: 'statecode eq 0' })
      .catch(e=>{ console.warn('[dataverse] MOM notes fetch failed:', e); return null; }),
  ]);
  const notesBy = groupBy(noteRes?.data, '_lm_meetingminutes_value');
  const viewers = await fetchNoteViewers((noteRes?.data ?? []).filter(n => n.lm_confidential).map(n => n.lm_momnotesid));
  return (momRes?.data ?? []).map(m => shapeMinutes(m, notesBy.get(m.lm_meetingminutesid), viewers));
}

/** The Minutes of one occurrence, or null. Server-side filtered so the Meeting
 *  detail page does not pull the whole table to find one row. */
export async function fetchMeetingMinutesByOccurrence(occurrenceId){
  const res = await Lm_meetingminutesesService.getAll({
    filter: `_lm_meetingoccurrence_value eq ${occurrenceId}`,
    select: MOM_SELECT,
  });
  const m = (res?.data ?? [])[0];
  if(!m) return null;
  const noteRes = await Lm_momnotesesService.getAll({
    filter: `_lm_meetingminutes_value eq ${m.lm_meetingminutesid} and statecode eq 0`,
    select: NOTE_SELECT,
  }).catch(e=>{ console.warn('[dataverse] MOM notes fetch failed:', e); return null; });
  const viewers = await fetchNoteViewers((noteRes?.data ?? []).filter(n => n.lm_confidential).map(n => n.lm_momnotesid));
  return shapeMinutes(m, noteRes?.data, viewers);
}

/**
 * Creates the Meeting Minutes row for one occurrence, then one MOM Note per
 * Agenda Item carrying text. A Note that fails is collected rather than
 * aborting the rest, since the Minutes themselves are already real by then.
 *
 * @param {object} payload
 * @param {string} payload.occurrenceId lm_meetingoccurrences id
 * @param {string} [payload.name]
 * @param {string} [payload.status] 'Draft'|'Approved'|'Closed', defaults to Draft
 * @param {{agendaItemId:string, text:string}[]} [payload.notes]
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function createMeetingMinutes(payload){
  const errors = [];
  let momId = null;
  try{
    const row = {
      lm_name: payload.name || 'Meeting Minutes',
      lm_status: MOM_STATUS_KEY[payload.status || 'Draft'] ?? MOM_STATUS_KEY.Draft,
    };
    if(payload.occurrenceId) row['lm_MeetingOccurrence@odata.bind'] = `/lm_meetingoccurrences(${payload.occurrenceId})`;
    const created = await Lm_meetingminutesesService.create(row);
    momId = idOrThrow(created, 'lm_meetingminutesid');
  }catch(e){
    errors.push({ table:'lm_meetingminuteses', error:e });
    return { id:null, errors };   // no parent id, so no Note can be linked
  }

  for(const n of (payload.notes || [])){
    if(!n?.text) continue;
    try{
      await createMomNoteRow(momId, n.agendaItemId, n.text);
    }catch(e){ errors.push({ table:'lm_momnoteses', error:e }); }
  }
  return { id: momId, errors };
}

/* The bare Note create, shared by createMeetingMinutes and saveMomNote. */
async function createMomNoteRow(minutesId, agendaItemId, text){
  const row = {
    lm_name: 'MOM Note',
    lm_notes: capped(text, MOM_NOTE_MAX, 'lm_notes'),
    'lm_MeetingMinutes@odata.bind': `/lm_meetingminuteses(${minutesId})`,
  };
  if(agendaItemId) row['lm_AgendaItem@odata.bind'] = `/lm_meetingoccurrenceagendas(${agendaItemId})`;
  const created = await Lm_momnotesesService.create(row);
  return idOrThrow(created, 'lm_momnotesid');
}

/**
 * Writes one Agenda Item's discussion note. Pass `noteId` to patch the existing
 * row, omit it to create one -- the Minutes tab holds the id it read back, so
 * this stays a plain upsert rather than a read-before-write.
 */
export async function saveMomNote(minutesId, agendaItemId, text, noteId){
  try{
    if(noteId){
      const result = await Lm_momnotesesService.update(noteId, {
        lm_notes: capped(text, MOM_NOTE_MAX, 'lm_notes'),
      });
      assertSuccess(result);
      return { id: noteId, errors: [] };
    }
    return { id: await createMomNoteRow(minutesId, agendaItemId, text), errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_momnoteses', error:e }] };
  }
}

/** Retires one MOM Note -- an Agenda Item whose note was cleared.
 *
 *  Deactivated rather than deleted: a Leadership Practice record is never
 *  hard-deleted, it is archived after closure and retained for audit, so the
 *  row stays readable and the trail stays intact. The prototype spec says
 *  nothing about deletion, so the BRD's retention rule governs.
 *  Read paths should filter on `statecode eq 0` once archived rows appear. */
export async function archiveMomNote(noteId){
  try{
    const result = await Lm_momnotesesService.update(noteId, { statecode: 1 });
    assertSuccess(result);
    return { id: noteId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_momnoteses', error:e }] };
  }
}

/**
 * Marks one Agenda Item confidential (or not) -- the flag on the item itself,
 * lm_meetingoccurrenceagenda.lm_confidential (03 Oct, DT New only).
 * Switching it off also clears the pre-03 Oct flag on the item's MOM Note,
 * which would otherwise keep it confidential. The viewer rows are left alone:
 * they only take effect while the flag is on, and keeping them means
 * switching back on does not lose the list.
 * @param {{noteId?:string, noteConfidential?:boolean}} [legacy]
 */
export async function setAgendaItemConfidential(agendaItemId, confidential, legacy = {}){
  try{
    assertSuccess(await Lm_meetingoccurrenceagendasService.update(agendaItemId, { lm_confidential: !!confidential }));
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceagendas', error:e }] };
  }
  if(!confidential && legacy.noteId && legacy.noteConfidential){
    try{ assertSuccess(await Lm_momnotesesService.update(legacy.noteId, { lm_confidential: false })); }
    catch(e){ return { id: null, errors: [{ table:'lm_momnoteses', error:e }] }; }
  }
  return { id: agendaItemId, errors: [] };
}

/**
 * Makes a confidential Agenda Item's reader list exactly `userIds`
 * (systemuser ids): adds a lm_meetingminutesreviewerlists row for each new
 * person, deletes the row of each one taken off. `current` is the item's
 * readers as last read, old note-linked rows included.
 *
 * Each new row links the agenda item AND its MOM Note. An item with no note
 * yet gets an empty one first, as before 03 Oct, so the row is valid whether
 * or not Dataverse requires the note link.
 * @param {{minutesId?:string, noteId?:string}} [ctx]
 */
export async function saveAgendaItemViewers(agendaItemId, userIds, current, ctx = {}){
  const errors = [];
  const want = new Set((userIds || []).filter(Boolean));
  const have = new Map((current || []).filter(v => v.userId).map(v => [v.userId, v.rowId]));
  let noteId = ctx.noteId || null;
  if([...want].some(uid => !have.has(uid)) && !noteId && ctx.minutesId){
    try{ noteId = await createMomNoteRow(ctx.minutesId, agendaItemId, ''); }
    catch(e){ return { id: null, errors: [{ table:'lm_momnoteses', error:e }] }; }
  }
  for(const uid of want){
    if(have.has(uid)) continue;
    try{
      const row = {
        lm_name: 'Confidential agenda item reader',
        'lm_MeetingOccurrenceAgenda@odata.bind': `/lm_meetingoccurrenceagendas(${agendaItemId})`,
        'lm_ViewerUser@odata.bind': `/systemusers(${uid})`,
      };
      if(noteId) row['lm_MOMNotes@odata.bind'] = `/lm_momnoteses(${noteId})`;
      await Lm_meetingminutesreviewerlistsService.create(row);
    }catch(e){ errors.push({ table:'lm_meetingminutesreviewerlists', error:e }); }
  }
  for(const [uid, rowId] of have){
    if(want.has(uid) || !rowId) continue;
    try{ await Lm_meetingminutesreviewerlistsService.delete(rowId); }
    catch(e){ errors.push({ table:'lm_meetingminutesreviewerlists', error:e }); }
  }
  return { id: errors.length ? null : agendaItemId, errors };
}

/**
 * Moves the Minutes along their lifecycle and stamps the matching clock in the
 * same PATCH. The two clocks are deliberately separate columns because the
 * Audit Grid measures them against different people: lm_submittedat starts the
 * Facilitator's write-up window (AG-16) and lm_approvedat closes the Chair's
 * approval window (AG-05).
 *
 * @param {string} id
 * @param {string} status 'Draft'|'Approved'|'Closed'
 * @param {object} [stamps] ISO strings; omit to stamp the transition's own
 *        clock with now. Pass `{submittedAt}` when submitting a Draft.
 */
export async function updateMeetingMinutesStatus(id, status, stamps = {}){
  try{
    const row = { lm_status: MOM_STATUS_KEY[status] ?? null };
    if(stamps.submittedAt !== undefined)   row.lm_submittedat = stamps.submittedAt;
    if(stamps.approvedAt !== undefined)    row.lm_approvedat  = stamps.approvedAt;
    else if(status === 'Approved')         row.lm_approvedat  = nowIso();
    if(stamps.closedAt !== undefined)      row.lm_closedat    = stamps.closedAt;
    else if(status === 'Closed')           row.lm_closedat    = nowIso();

    const result = await Lm_meetingminutesesService.update(id, row);
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingminuteses', error:e }] };
  }
}

/** Submits a Draft: stamps lm_submittedat, which is what starts AG-16's clock.
 *  Status stays Draft -- submission is not approval.
 *
 *  Clears any standing return reason at the same time. Without a distinct
 *  'Returned' status on this table, the reason is the only thing separating
 *  "the Chair sent this back and it is being revised" from "submitted and
 *  waiting on the Chair" -- both are Draft with a submitted timestamp. Once the
 *  Minutes history table exists the reason should be written there instead, so
 *  the permanent trail survives the resubmission. */
export async function submitMeetingMinutes(id){
  try{
    const result = await Lm_meetingminutesesService.update(id, {
      lm_submittedat: nowIso(),
      lm_returnreason: null,
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingminuteses', error:e }] };
  }
}

/** Returns the Minutes to the Recorder with a reason. The status goes back to
 *  Draft; lm_submittedat is deliberately left standing so the original write-up
 *  time is not rewritten by a revision. */
export async function returnMeetingMinutes(id, reason){
  try{
    const result = await Lm_meetingminutesesService.update(id, {
      lm_status: MOM_STATUS_KEY.Draft,
      lm_returnreason: capped(reason, MOM_REASON_MAX, 'lm_returnreason'),
    });
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingminuteses', error:e }] };
  }
}

/** Records the Chair's signature on the Minutes. Separate from the status patch
 *  because a Committee classification may require the signature while the
 *  approval itself is the same act. */
export async function signMeetingMinutes(id, { positionId, name, date, time } = {}){
  try{
    const row = {
      lm_signedname: capped(name, 100, 'lm_signedname'),
      lm_signeddate: date || isoDay(nowIso()),
      lm_signedtime: time || null,
    };
    if(positionId) row['lm_SignedByPosition@odata.bind'] = `/cr603_organizationstructures(${positionId})`;
    const result = await Lm_meetingminutesesService.update(id, row);
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingminuteses', error:e }] };
  }
}

/**
 * Marks one Agenda Item covered or not covered while the Minutes are written.
 *
 * Lives with the Minutes rather than with the occurrence because coverage is
 * recorded during the write-up, not during the meeting -- and because AG-04
 * reads it: fully covered scores 5, uncovered but carried forward scores 4,
 * uncovered with no carry-forward scores 0. Leaving it at 'Not Yet Recorded'
 * is therefore not neutral, so the Recorder has to set it either way.
 *
 * @param {string} agendaItemId lm_meetingoccurrenceagendas id
 * @param {string} covered 'Yes' | 'No' | 'Not Yet Recorded'
 */
export async function updateAgendaCovered(agendaItemId, covered){
  try{
    const result = await Lm_meetingoccurrenceagendasService.update(agendaItemId, {
      lm_covered: AGENDA_COVERED_KEY[covered] ?? AGENDA_COVERED_KEY['Not Yet Recorded'],
    });
    assertSuccess(result);
    return { id: agendaItemId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceagendas', error:e }] };
  }
}

/** Adds one Agenda Item to a live occurrence -- only meaningful before the
 *  Meeting is Held, since Minutes coverage (AG-04) is written against
 *  whatever the Agenda held at that point. `sequence` is the caller's job:
 *  the modal passes rec.agenda.length+1 so a new item always lands last. */
export async function createMeetingOccurrenceAgendaItem(occurrenceId, { title, sequence, ownerPositionId, source, carriedFromId }){
  try{
    const row = {
      'lm_MeetingOccurrence@odata.bind': `/lm_meetingoccurrences(${occurrenceId})`,
      lm_title: (title||'').trim(),
      lm_sequence: sequence,
      lm_source: source || 'Ad Hoc',
      lm_covered: AGENDA_COVERED_KEY['Not Yet Recorded'],
    };
    if(ownerPositionId) row['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${ownerPositionId})`;
    /* Carried forward (29 Sep): the earlier occurrence's agenda item this one
       continues -- same lookup createMeetingOccurrence() binds. */
    if(carriedFromId) row['lm_CarriedFromAgendaItem@odata.bind'] = `/lm_meetingoccurrenceagendas(${carriedFromId})`;
    const created = await Lm_meetingoccurrenceagendasService.create(row);
    const id = idOrThrow(created, 'lm_meetingoccurrenceagendaid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceagendas', error:e }] };
  }
}

/** Archives one Agenda Item rather than deleting it outright -- same
 *  statecode convention as archiveMomNote()/archiveAuditGridAnswer() below,
 *  so a removed item can still be traced later rather than vanishing. */
export async function archiveMeetingOccurrenceAgendaItem(agendaItemId){
  try{
    const result = await Lm_meetingoccurrenceagendasService.update(agendaItemId, { statecode: 1 });
    assertSuccess(result);
    return { id: agendaItemId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceagendas', error:e }] };
  }
}

/** Patches ONLY lm_sequence on one Agenda Item -- the Up/Down reorder
 *  buttons call this twice, once per row being swapped. */
export async function updateMeetingOccurrenceAgendaSequence(agendaItemId, sequence){
  try{
    const result = await Lm_meetingoccurrenceagendasService.update(agendaItemId, { lm_sequence: sequence });
    assertSuccess(result);
    return { id: agendaItemId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrenceagendas', error:e }] };
  }
}

/* ---- Departments/Functions integrated in a Meeting Occurrence ---------
   lm_meetingoccurrencedepartmentfunctions -- one row per Department/Function
   line copied onto the occurrence when it was generated (13 Sep). Describes
   who is in the room; it does not multiply the meeting (see PROJECT-CONTEXT
   §6). Registered since 13 Sep but never read by any screen until now. */
export async function fetchMeetingOccurrenceDepartments(occurrenceId){
  const res = await Lm_meetingoccurrencedepartmentfunctionsService.getAll({
    /* ⚠️ lm_departmentname / lm_functionname are NOT selected: they do not
       exist on this table in IT, and one unknown column fails the entire
       query. Nothing is lost -- both were only ever copied into the fields
       below, and the single consumer of this result
       (LeadershipApp's meetingDeptIds) reads d.departmentId alone. */
    select: ['lm_meetingoccurrencedepartmentfunctionid', 'lm_name',
             '_lm_department_value', '_lm_function_value'],
    filter: `_lm_meetingoccurrence_value eq ${occurrenceId}`,
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.lm_meetingoccurrencedepartmentfunctionid,
    name: r.lm_name || null,
    departmentId: r._lm_department_value || null,
    /* Always null now -- see the $select above. Kept so the shape of this
       object does not change under any caller. */
    departmentName: null,
    functionId: r._lm_function_value || null,
    functionName: null,
  }));
}

/* ---- Documents (Meeting <-> Report linking) ---------------------------
   lm_meetingoccurrencelinkedreports -- registered 15 Sep, never wired to any
   screen until now. One row per document linked to a Meeting Occurrence,
   pointing at a Report Occurrence, a Report Template, or both (a Template
   alone covers "no occurrence exists for this yet" -- the Meeting Detail
   Documents tab's own linking flow finds a matching occurrence by Template +
   Business Unit + Department and lets the user pick one instead of guessing). */
export async function fetchMeetingOccurrenceLinkedReports(occurrenceId){
  const base = ['lm_meetingoccurrencelinkedreportsid', 'lm_reportname',
                '_lm_reportoccurrence_value', '_lm_reporttemplate_value', 'createdon'];
  const filter = `_lm_meetingoccurrence_value eq ${occurrenceId}`;
  /* lm_fileurl (a link-only input, 01 Oct) and lm_reporttype (Output / Input,
     04 Oct) exist in DT New only; selecting a missing column fails the whole
     read, so each step falls back to fewer columns (IT: the base set). */
  let res = null;
  for(const extra of [['lm_fileurl','lm_reporttype'], ['lm_fileurl'], []]){
    try{
      res = await Lm_meetingoccurrencelinkedreportsesService.getAll({ select:[...base, ...extra], filter });
      if(res?.success === false) throw new Error('columns not readable');
      break;
    }catch{ res = null; }
  }
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.lm_meetingoccurrencelinkedreportsid,
    name: r.lm_reportname || '(untitled document)',
    reportOccurrenceId: r._lm_reportoccurrence_value || null,
    reportTemplateId: r._lm_reporttemplate_value || null,
    fileUrl: r.lm_fileurl || null,
    reportType: MEETING_DOC_TYPE[r.lm_reporttype] || null,
    created: r.createdon || null,
  }));
}

/** The meeting's current Minutes document row, or null: { id, name, fileUrl }. */
export async function getMeetingMinutesDocument(occurrenceId){
  try{
    const res = await Lm_meetingoccurrencelinkedreportsesService.getAll({
      select: ['lm_meetingoccurrencelinkedreportsid','lm_reportname','lm_fileurl'],
      filter: `_lm_meetingoccurrence_value eq ${occurrenceId} and lm_reporttype eq 1 and startswith(lm_reportname,'MOM - ')`,
    });
    const r = (res?.data ?? [])[0];
    return r ? { id: r.lm_meetingoccurrencelinkedreportsid, name: r.lm_reportname, fileUrl: r.lm_fileurl || null } : null;
  }catch(e){
    console.warn('[dataverse] getMeetingMinutesDocument() failed:', e);
    return null;
  }
}

/** The meeting's Minutes document (04 Oct): one OUTPUT row per meeting,
 *  named "MOM - …", whose lm_fileurl points at the Word file in SharePoint.
 *  Re-saving (on approval) updates the same row instead of adding another. */
export async function upsertMeetingMinutesDocument({ occurrenceId, name, fileUrl }){
  try{
    const res = await Lm_meetingoccurrencelinkedreportsesService.getAll({
      select: ['lm_meetingoccurrencelinkedreportsid'],
      filter: `_lm_meetingoccurrence_value eq ${occurrenceId} and lm_reporttype eq 1 and startswith(lm_reportname,'MOM - ')`,
    });
    const existing = (res?.data ?? [])[0]?.lm_meetingoccurrencelinkedreportsid;
    if(existing){
      assertSuccess(await Lm_meetingoccurrencelinkedreportsesService.update(existing, {
        lm_reportname: name.slice(0, 850), lm_fileurl: fileUrl }));
      return { id: existing, errors: [] };
    }
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrencelinkedreportses', error:e }] };
  }
  return linkMeetingOccurrenceReport({ meetingOccurrenceId: occurrenceId, name, fileUrl, reportType: 'Output' });
}

/** The reports a Meeting Setup names as its INPUTS (lm_meetingtemplatelinkedreports,
 *  lm_reporttype Input) -- what the Submissions tab expects to see linked and
 *  ready before the meeting. Outputs are left out; a row with no type is read
 *  as an Input, which is what the Setup wizard writes by default. */
export async function fetchMeetingTemplateInputReports(templateId){
  const res = await Lm_meetingtemplatelinkedreportsesService.getAll({
    select: ['lm_meetingtemplatelinkedreportsid', 'lm_name', 'lm_reporttype', '_lm_reporttemplate_value'],
    filter: `_lm_meetingtemplate_value eq ${templateId}`,
  });
  return (res?.data ?? [])
    .filter(r => r.lm_reporttype == null || r.lm_reporttype === LINKED_REPORT_TYPE_KEY.Input)
    .map(r => ({
      id: r.lm_meetingtemplatelinkedreportsid,
      name: r.lm_name || null,
      reportTemplateId: r._lm_reporttemplate_value || null,
    }));
}

/** Links one document to a Meeting Occurrence -- a Report Occurrence, a
 *  Report Template (when no occurrence exists for it yet), or both, per the
 *  Documents tab's own linking flow. */
/* lm_reporttype on lm_meetingoccurrencelinkedreports (DT New, 04 Oct):
   Output 1, Input 2 -- the same codes as the Setup's linked reports. */
const MEETING_DOC_TYPE_KEY = { Output: 1, Input: 2 };
const MEETING_DOC_TYPE = { 1: 'Output', 2: 'Input' };

export async function linkMeetingOccurrenceReport({ meetingOccurrenceId, name, reportOccurrenceId, reportTemplateId, fileUrl, reportType }){
  try{
    const row = {
      'lm_MeetingOccurrence@odata.bind': `/lm_meetingoccurrences(${meetingOccurrenceId})`,
      lm_reportname: (name || 'Linked document').trim().slice(0, 850),
    };
    /* A link-only input (01 Oct): a pasted SharePoint / Teams link with no
       Report Occurrence behind it. lm_fileurl is DT New only so far. */
    if(fileUrl) row.lm_fileurl = fileUrl.trim();
    if(reportType) row.lm_reporttype = MEETING_DOC_TYPE_KEY[reportType] ?? null;
    if(reportOccurrenceId) row['lm_ReportOccurrence@odata.bind'] = `/lm_reportoccurrences(${reportOccurrenceId})`;
    if(reportTemplateId)   row['lm_ReportTemplate@odata.bind']   = `/lm_report_templates(${reportTemplateId})`;
    const created = await Lm_meetingoccurrencelinkedreportsesService.create(row);
    const id = idOrThrow(created, 'lm_meetingoccurrencelinkedreportsid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrencelinkedreportses', error:e }] };
  }
}

/** Adds the Report Occurrence to a link that was made against the Template
 *  alone. The Template stays as it was -- this fills in what was not known
 *  when the link was first made, which is exactly what the Documents tab
 *  offered and could not then do.
 *
 *  The name is rewritten at the same time: a Template-only link was named
 *  after the Template, and once it points at an occurrence the occurrence's
 *  own name is the truthful one. */
/** Sets (or replaces) the file link on an existing linked-report row --
 *  lm_fileurl, DT New only so far (01 Oct). */
export async function updateLinkedReportFile(linkId, fileUrl){
  try{
    assertSuccess(await Lm_meetingoccurrencelinkedreportsesService.update(linkId, { lm_fileurl: (fileUrl || '').trim() || null }));
    return { id: linkId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrencelinkedreportses', error:e }] };
  }
}

export async function attachReportOccurrenceToLink({ linkId, reportOccurrenceId, name }){
  try{
    const row = { 'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${reportOccurrenceId})` };
    if(name) row.lm_reportname = name.trim().slice(0, 850);
    assertSuccess(await Lm_meetingoccurrencelinkedreportsesService.update(linkId, row));
    return { id: linkId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrencelinkedreportses', error:e }] };
  }
}

export async function unlinkMeetingOccurrenceReport(linkId){
  try{
    await Lm_meetingoccurrencelinkedreportsesService.delete(linkId);
    return { id: linkId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_meetingoccurrencelinkedreportses', error:e }] };
  }
}

/* ---- Audit Grid ------------------------------------------------------- */

const GRID_SELECT = ['lm_auditgridinstanceid','lm_name','lm_state','lm_score','lm_coverage','lm_total',
                     'lm_version','lm_locked','lm_frozen','lm_approvedat','lm_templateversion',
                     'lm_returnreason','lm_correctionreason','_lm_meetingoccurrence_value',
                     '_lm_facilitatorposition_value','_lm_chairposition_value','modifiedon','createdon'];
const ANSWER_SELECT = ['lm_auditgridanswerid','lm_questionid','lm_score','lm_evidence',
                       '_lm_auditgridinstance_value'];

/* `manual` and `evidence` come back as {questionId: value} maps because that is
   exactly the shape scoreGrid() already reads off a Grid -- the stored Answers
   drop straight in with no adapter. `answers` keeps the row ids an edit needs. */
function shapeGrid(g, answerRows){
  const answers = (answerRows || []).map(a => ({
    id: a.lm_auditgridanswerid,
    questionId: a.lm_questionid || null,
    score: a.lm_score ?? null,
    evidence: a.lm_evidence || null,
  }));
  const manual = {}, evidence = {};
  answers.forEach(a => {
    if(!a.questionId) return;
    if(a.score != null)  manual[a.questionId]   = a.score;
    if(a.evidence)       evidence[a.questionId] = a.evidence;
  });
  return {
    id: g.lm_auditgridinstanceid,
    name: g.lm_name || '(untitled grid)',
    occurrenceId: g._lm_meetingoccurrence_value || null,
    state: GRID_STATE[g.lm_state] || null,
    score: g.lm_score ?? null,
    coverage: g.lm_coverage ?? null,     // count of applicable questions, not a percentage
    total: g.lm_total ?? null,
    version: g.lm_version ?? 1,
    locked: !!g.lm_locked,
    frozen: !!g.lm_frozen,
    approvedAt: g.lm_approvedat || null,
    templateVersion: g.lm_templateversion || null,
    returnReason: g.lm_returnreason || null,
    correctionReason: g.lm_correctionreason || null,
    facilitatorPositionId: g._lm_facilitatorposition_value || null,
    chairPositionId: g._lm_chairposition_value || null,
    updated: g.modifiedon || g.createdon || null,
    created: g.createdon || null,              // the Grid opens when the MOM closes
    submittedAt: g.lm_submitedat || null,      // DT New only so far
    answers, manual, evidence,
  };
}

/* lm_submitedat (the Organizer's submission time, AG-17, 01 Oct) exists in
   DT New only so far. Selecting a missing column fails the whole read, so a
   read that cannot have it falls back to GRID_SELECT alone. */
async function getGrids(opts){
  try{
    const res = await Lm_auditgridinstancesService.getAll({ ...opts, select:[...GRID_SELECT, 'lm_submitedat'] });
    if(res?.success === false) throw new Error('lm_submitedat not readable');
    return res;
  }catch{
    return Lm_auditgridinstancesService.getAll({ ...opts, select: GRID_SELECT });
  }
}

/** Every Audit Grid Instance with its Answers attached. */
export async function fetchAuditGridInstances(){
  const [gridRes, ansRes] = await Promise.all([
    getGrids({}),
    Lm_auditgridanswersService.getAll({ select: ANSWER_SELECT, filter: 'statecode eq 0' })
      .catch(e=>{ console.warn('[dataverse] Audit Grid answers fetch failed:', e); return null; }),
  ]);
  const ansBy = groupBy(ansRes?.data, '_lm_auditgridinstance_value');
  return (gridRes?.data ?? []).map(g => shapeGrid(g, ansBy.get(g.lm_auditgridinstanceid)));
}

/** Every Instance for one occurrence, newest version first. More than one is
 *  normal: a correction opens a new version rather than editing the approved
 *  Instance, so the history is a list, not a row. */
export async function fetchAuditGridInstancesByOccurrence(occurrenceId){
  const res = await getGrids({ filter: `_lm_meetingoccurrence_value eq ${occurrenceId}` });
  const rows = res?.data ?? [];
  if(!rows.length) return [];
  const ansRes = await Lm_auditgridanswersService.getAll({ select: ANSWER_SELECT, filter: 'statecode eq 0' })
    .catch(e=>{ console.warn('[dataverse] Audit Grid answers fetch failed:', e); return null; });
  const ansBy = groupBy(ansRes?.data, '_lm_auditgridinstance_value');
  return rows
    .map(g => shapeGrid(g, ansBy.get(g.lm_auditgridinstanceid)))
    .sort((a,b) => (b.version||1) - (a.version||1));
}

/**
 * Creates one Audit Grid Instance. Called on closure of a Committee
 * occurrence's Minutes, and again -- with a higher `version` and a
 * `correctionReason` -- when a Chair opens a correction against an approved
 * Instance. Score and Coverage are deliberately left null: nothing is published
 * until the Chair approves.
 *
 * @param {object} payload
 * @param {string} payload.occurrenceId
 * @param {string} [payload.name]
 * @param {string} [payload.templateVersion] e.g. 'AGT v1.2'
 * @param {number} [payload.total] active question count the Template carried
 * @param {number} [payload.version] defaults to 1
 * @param {string} [payload.correctionReason] set only on a correction version
 * @param {string} [payload.facilitatorPositionId]
 * @param {string} [payload.chairPositionId]
 * @param {{questionId:string, score?:number, evidence?:string}[]} [payload.answers]
 *        carried forward when a correction version reopens an approved Grid
 */
export async function createAuditGridInstance(payload){
  const errors = [];
  let gridId = null;
  try{
    const row = {
      lm_name: payload.name || 'Audit Grid Instance',
      lm_state: GRID_STATE_KEY['Pending Organizer Review'],
      lm_templateversion: payload.templateVersion || null,
      lm_total: payload.total ?? null,
      lm_version: payload.version ?? 1,
      lm_locked: false,
      lm_frozen: false,
      lm_correctionreason: payload.correctionReason
        ? capped(payload.correctionReason, GRID_REASON_MAX, 'lm_correctionreason') : null,
    };
    if(payload.occurrenceId)          row['lm_MeetingOccurrence@odata.bind']   = `/lm_meetingoccurrences(${payload.occurrenceId})`;
    if(payload.facilitatorPositionId) row['lm_FacilitatorPosition@odata.bind'] = `/cr603_organizationstructures(${payload.facilitatorPositionId})`;
    if(payload.chairPositionId)       row['lm_ChairPosition@odata.bind']       = `/cr603_organizationstructures(${payload.chairPositionId})`;
    const created = await Lm_auditgridinstancesService.create(row);
    gridId = idOrThrow(created, 'lm_auditgridinstanceid');
  }catch(e){
    errors.push({ table:'lm_auditgridinstances', error:e });
    return { id:null, errors };
  }

  for(const a of (payload.answers || [])){
    if(!a?.questionId) continue;
    try{
      await createAuditGridAnswerRow(gridId, a.questionId, a.score, a.evidence);
    }catch(e){ errors.push({ table:'lm_auditgridanswers', error:e }); }
  }
  return { id: gridId, errors };
}

/* The bare Answer create, shared by createAuditGridInstance and
   saveAuditGridAnswer. */
async function createAuditGridAnswerRow(instanceId, questionId, score, evidence){
  const created = await Lm_auditgridanswersService.create({
    lm_name: questionId,
    lm_questionid: capped(questionId, 100, 'lm_questionid'),
    lm_score: score ?? null,
    lm_evidence: evidence ? capped(evidence, GRID_EVIDENCE_MAX, 'lm_evidence') : null,
    'lm_AuditGridInstance@odata.bind': `/lm_auditgridinstances(${instanceId})`,
  });
  return idOrThrow(created, 'lm_auditgridanswerid');
}

/**
 * Writes one question's manual score and evidence note. Pass `answerId` to
 * patch, omit it to create. Only manual questions reach this -- an auto-scored
 * value is never stored, so it can never disagree with the rule that produced
 * it, though an evidence note may be attached to one.
 */
export async function saveAuditGridAnswer(instanceId, questionId, { score, evidence } = {}, answerId){
  try{
    if(answerId){
      const row = {};
      if(score !== undefined)    row.lm_score    = score ?? null;
      if(evidence !== undefined) row.lm_evidence = evidence
        ? capped(evidence, GRID_EVIDENCE_MAX, 'lm_evidence') : null;
      const result = await Lm_auditgridanswersService.update(answerId, row);
      assertSuccess(result);
      return { id: answerId, errors: [] };
    }
    return { id: await createAuditGridAnswerRow(instanceId, questionId, score, evidence), errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_auditgridanswers', error:e }] };
  }
}

/** Retires one Answer row -- a manual score the Facilitator cleared.
 *  Deactivated, not deleted, for the same retention reason as archiveMomNote
 *  above. An Audit Grid's answers are accreditation evidence; losing one
 *  outright would break the trail behind a published score. */
export async function archiveAuditGridAnswer(answerId){
  try{
    const result = await Lm_auditgridanswersService.update(answerId, { statecode: 1 });
    assertSuccess(result);
    return { id: answerId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_auditgridanswers', error:e }] };
  }
}

/** Moves the Instance between states that publish nothing -- Submitted for
 *  Approval, Returned for Revision, Void. Approval is separate below because it
 *  is the only transition that writes a score. */
export async function updateAuditGridState(id, state, reason){
  try{
    const row = { lm_state: GRID_STATE_KEY[state] ?? null };
    if(state === 'Returned for Revision')
      row.lm_returnreason = capped(reason, GRID_REASON_MAX, 'lm_returnreason');
    const result = await Lm_auditgridinstancesService.update(id, row);
    assertSuccess(result);
    /* Stamp the submission time for AG-17 -- separately, so an environment
       without lm_submitedat (IT, so far) still submits. */
    if(state === 'Submitted for Approval'){
      try{ assertSuccess(await Lm_auditgridinstancesService.update(id, { lm_submitedat: new Date().toISOString() })); }
      catch(e){ console.warn('[dataverse] lm_submitedat not stamped (column missing here?):', e); }
    }
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_auditgridinstances', error:e }] };
  }
}

/**
 * Approves the Instance and publishes the score in one PATCH. This is the only
 * write that sets lm_score / lm_coverage, and it also sets lm_locked and
 * lm_frozen -- together they are what stops a later change to a governance
 * setting or to the Taxonomy Template from rewriting a published result. The
 * caller passes the totals it computed from the rendered Grid.
 *
 * @param {string} id
 * @param {object} totals
 * @param {number} totals.score      overall percentage, e.g. 83.1
 * @param {number} totals.coverage   COUNT of applicable questions, not a percentage
 * @param {number} [totals.total]    active question count
 */
export async function approveAuditGridInstance(id, { score, coverage, total } = {}){
  try{
    const row = {
      lm_state: GRID_STATE_KEY.Approved,
      lm_score: score ?? null,
      lm_coverage: coverage ?? null,
      lm_locked: true,
      lm_frozen: true,
      lm_approvedat: nowIso(),
    };
    if(total != null) row.lm_total = total;
    const result = await Lm_auditgridinstancesService.update(id, row);
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_auditgridinstances', error:e }] };
  }
}

/* ---------------------------------------------------------------------
   WIRED (READ-ONLY): Authority Matrix (lm_authoritymatrixrows), Approval
                      Cycles (lm_approvalcycles) and their Steps
                      (lm_approvalcyclesteps)
   ---------------------------------------------------------------------
   The Authority Matrix is owned OUTSIDE Leadership Practice. This module
   sends criteria and applies the returned result and route unmodified -- it
   never authors, edits or substitutes an authority rule. So everything below
   is deliberately read-only: there is no create/update/delete here, and there
   should not be one. A missing mapping is reported as 'No mapping found' and
   blocks submission; it never falls back to an invented route.
   --------------------------------------------------------------------- */

/* The option set spells these without spaces; the app's own wording is the
   one that reaches the UI and matches DECISION_TYPES. Mapped by code rather
   than by label, as elsewhere in this file. Note 124330002 is unused. */
export const DECISION_TYPE = {
  124330000: 'Quality Improvement Action',
  124330001: 'Clinical Protocol Change',
  124330004: 'Establishment or Staffing Change',
  124330005: 'Capital Expenditure',
  124330003: 'Technology Adoption',
};
export const DECISION_TYPE_KEY = {
  'Quality Improvement Action':124330000,
  'Clinical Protocol Change':124330001,
  'Establishment or Staffing Change':124330004,
  'Capital Expenditure':124330005,
  'Technology Adoption':124330003,
};

/** Every Approval Cycle with its ordered steps attached. Returned both as a
 *  list and as a {code: cycle} map, because the Authority Matrix references a
 *  cycle by row while the UI renders one by code. */
export async function fetchApprovalCycles(){
  const [cycleRes, stepRes] = await Promise.all([
    Lm_approvalcyclesService.getAll({
      select: ['lm_approvalcycleid','lm_name','lm_code','statecode'],
    }),
    Lm_approvalcyclestepsService.getAll({
      select: ['lm_approvalcyclestepid','lm_name','lm_steporder',
               '_lm_approvalcycle_value','_lm_positionrole_value','lm_positionrolename'],
    }).catch(e=>{ console.warn('[dataverse] approval cycle steps fetch failed:', e); return null; }),
  ]);
  const stepsBy = groupBy(stepRes?.data, '_lm_approvalcycle_value');

  const list = (cycleRes?.data ?? []).map(c => ({
    id: c.lm_approvalcycleid,
    code: c.lm_code || null,
    name: c.lm_name || '(unnamed cycle)',
    /* Ordered by lm_steporder -- a cycle is a sequence, so an unordered read
       would route a Decision to the wrong approver. */
    steps: (stepsBy.get(c.lm_approvalcycleid) || [])
      .slice().sort((a,b)=>(a.lm_steporder??0)-(b.lm_steporder??0))
      .map(s=>({ id: s.lm_approvalcyclestepid,
                 order: s.lm_steporder ?? null,
                 positionId: s._lm_positionrole_value || null,
                 position: s.lm_positionrolename || null })),
  })).sort((a,b)=>(a.code||'').localeCompare(b.code||''));

  const byCode = {};
  list.forEach(c => { if(c.code) byCode[c.code] = c; });
  return { list, byCode };
}

/**
 * Every Authority Matrix row, with its Approval Cycle resolved.
 *
 * `max` is lm_maxvalue, a currency column: null means "no ceiling on this
 * row". authorityCheckLive() below sorts on it, so the tiers order themselves
 * by value -- there is no separate sequence column to keep in step, and none
 * is needed.
 */
export async function fetchAuthorityMatrix(){
  const [rowRes, cycles] = await Promise.all([
    Lm_authoritymatrixrowsService.getAll({
      select: ['lm_authoritymatrixrowid','lm_name','lm_decisiontype','lm_maxvalue',
               'lm_requiredlevel','_lm_approvalcycle_value','statecode'],
    }),
    fetchApprovalCycles().catch(e=>{
      console.warn('[dataverse] approval cycles fetch failed:', e); return { list:[], byCode:{} }; }),
  ]);
  const cycleById = new Map(cycles.list.map(c=>[c.id, c]));

  const rows = (rowRes?.data ?? []).map(r => {
    const cycle = r._lm_approvalcycle_value ? cycleById.get(r._lm_approvalcycle_value) : null;
    return {
      id: r.lm_authoritymatrixrowid,
      name: r.lm_name || null,
      type: DECISION_TYPE[r.lm_decisiontype] || null,
      max: r.lm_maxvalue ?? null,
      reqLvl: r.lm_requiredlevel ?? null,
      cycleId: r._lm_approvalcycle_value || null,
      cycle: cycle ? cycle.code : null,
      cycleName: cycle ? cycle.name : null,
    };
  });
  return { rows, cycles };
}

/**
 * The Authority Check, run against rows read from Dataverse rather than the
 * hard-coded table in the module. A pure function so the Decision intake can
 * preview the result before anything is written, and the Audit Grid (AG-12)
 * can re-run it later against the same rows.
 *
 * Mirrors the documented algorithm exactly: filter by type, order the tiers by
 * ceiling, take the first tier the value fits, then compare the creator's
 * authority level to that tier's requirement. A type with no row returns
 * 'No mapping found' -- submission is blocked and NO substitute route is
 * invented, which is the whole point of the rule.
 *
 * @param {{type:string,max:number|null,reqLvl:number|null,cycle:string|null}[]} rows
 *        from fetchAuthorityMatrix().rows
 * @param {string} type one of DECISION_TYPE's values
 * @param {number|null} value the Decision's amount; treated as 0 when absent
 * @param {number|null} creatorLevel the creator's authority level (0-6)
 */
export function authorityCheckLive(rows, type, value, creatorLevel){
  const cands = (rows || [])
    .filter(r => r.type === type)
    .sort((a,b) => (a.max==null?Infinity:a.max) - (b.max==null?Infinity:b.max));

  if(!cands.length)
    return { result:'No mapping found', reqLvl:null, cycle:null, matched:null };

  const v = value == null ? 0 : value;
  const row = cands.find(r => r.max == null || v <= r.max) || cands[cands.length-1];
  const lvl = creatorLevel == null ? -1 : creatorLevel;

  const label = row.max != null
    ? `${row.type} up to ${row.max.toLocaleString('en-US')} SAR`
    : cands.length > 1 && cands[0].max != null
      ? `${row.type} over ${cands[0].max.toLocaleString('en-US')} SAR`
      : row.type;

  return {
    result: lvl >= row.reqLvl ? 'Authority confirmed' : 'Authority not held',
    reqLvl: row.reqLvl,
    cycle:  lvl >= row.reqLvl ? null : row.cycle,
    matched: label,
  };
}

/* ---------------------------------------------------------------------
   WIRED: the Report Submission review chain
   ---------------------------------------------------------------------
   Lifecycle is Draft -> In Review -> Approved, and nothing else. Request
   More Information is an ACTION, not a status: it returns the submission to
   Draft and resets the step to 0, so a re-submission restarts the configured
   route rather than resuming mid-chain. The lm_status option set on this
   table also carries Rejected and Returned, which this module deliberately
   never writes -- they are not part of the lifecycle.

   Every transition appends a row to lm_reportoccurrencehistories rather than
   overwriting anything, which is what keeps the prior review history intact
   across an RMI. This is the only area of the module with a real audit-trail
   table; Meetings and Minutes still have nowhere to write one.
   --------------------------------------------------------------------- */

/* lm_note on the history row is still at Dataverse's default 100 characters --
   too short for a reviewer's reason, and Dataverse rejects rather than
   truncating. Widen it and this cap can go. */
export const REPORT_NOTE_MAX = 100;

/* ⚠️ No lm_name: the IT schema refresh of 28 Sep found lm_reportoccurrencehistory
   has no such column any more -- lm_action is the row's text. Selecting it
   failed the WHOLE history read, and writing it failed every history row. */
const HISTORY_SELECT = ['lm_reportoccurrencehistoryid','lm_action','lm_note',
                        '_lm_reportoccurrence_value','_lm_actorposition_value','createdon'];

/** The full audit trail for one Report Submission, oldest first -- the order a
 *  reviewer reads it in. */
export async function fetchReportOccurrenceHistory(occurrenceId){
  const res = await Lm_reportoccurrencehistoriesService.getAll({
    filter: `_lm_reportoccurrence_value eq ${occurrenceId}`,
    select: HISTORY_SELECT,
  });
  return (res?.data ?? [])
    .map(h => ({
      id: h.lm_reportoccurrencehistoryid,
      action: h.lm_action || '',
      note: h.lm_note || null,
      actorPositionId: h._lm_actorposition_value || null,
      at: h.createdon || null,
    }))
    .sort((a,b) => (a.at||'').localeCompare(b.at||''));
}

/**
 * Appends one history row. Every transition below calls this, and a failure to
 * write history is reported but never rolls back the transition itself -- the
 * status change is already committed by then, and a missing trail entry is a
 * smaller problem than a submission stuck in a state nobody can see.
 */
export async function addReportHistory(occurrenceId, action, { actorPositionId, note } = {}){
  try{
    const row = {
      lm_action: capped(action, 850, 'lm_action'),
      lm_note: note ? capped(note, REPORT_NOTE_MAX, 'lm_note') : null,
      'lm_ReportOccurrence@odata.bind': `/lm_reportoccurrences(${occurrenceId})`,
    };
    if(actorPositionId) row['lm_ActorPosition@odata.bind'] = `/cr603_organizationstructures(${actorPositionId})`;
    const created = await Lm_reportoccurrencehistoriesService.create(row);
    return { id: idOrThrow(created, 'lm_reportoccurrencehistoryid'), errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrencehistories', error:e }] };
  }
}

/**
 * Submits a Draft into the configured review route. Always starts at step 0 --
 * a re-submission after Request More Information restarts the route rather
 * than resuming where it stopped.
 */
export async function submitReportOccurrence(id, { actorPositionId } = {}){
  try{
    const result = await Lm_reportoccurrencesService.update(id, {
      lm_status: REPORT_OCC_STATUS_KEY['In Review'],
      lm_reviewstep: 0,
    });
    assertSuccess(result);
    const h = await addReportHistory(id, 'Submitted for review', { actorPositionId });
    return { id, errors: h.errors };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/**
 * Approves the current review step.
 *
 * Advances to the next step, or -- when this was the last configured reviewer
 * -- sets the submission to Approved and locks it. Locking is what stops any
 * further edit; a change after approval has to become a new version.
 *
 * @param {string} id
 * @param {object} opts
 * @param {number} opts.currentStep zero-based index of the step being approved
 * @param {number} opts.totalSteps  number of steps in the configured chain
 * @param {string} [opts.actorPositionId]
 * @param {string} [opts.note]
 */
export async function approveReportStep(id, { currentStep, totalSteps, actorPositionId, note } = {}){
  const isFinal = (currentStep + 1) >= totalSteps;
  try{
    const result = await Lm_reportoccurrencesService.update(id, isFinal
      ? { lm_status: REPORT_OCC_STATUS_KEY.Approved, lm_locked: true, lm_reviewstep: totalSteps }
      : { lm_reviewstep: currentStep + 1 });
    assertSuccess(result);
    const h = await addReportHistory(id,
      isFinal ? 'Final review step approved — Report Submission approved and locked'
              : `Approved review step ${currentStep + 1} of ${totalSteps}`,
      { actorPositionId, note });
    return { id, isFinal, errors: h.errors };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/**
 * Request More Information. Returns the submission to Draft at step 0 with the
 * reason recorded in history.
 *
 * This is deliberately NOT a status of its own: the lifecycle has three states
 * and this is a review action within it. The prior history is untouched, so the
 * earlier approvals remain visible after the resubmission.
 */
export async function requestMoreInfoOnReport(id, { actorPositionId, reason } = {}){
  try{
    const result = await Lm_reportoccurrencesService.update(id, {
      lm_status: REPORT_OCC_STATUS_KEY.Draft,
      lm_reviewstep: 0,
    });
    assertSuccess(result);
    const h = await addReportHistory(id, 'Request More Information — returned to Draft',
      { actorPositionId, note: reason });
    return { id, errors: h.errors };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/**
 * Returns a submission to its author with status RETURNED (28 Sep, per the
 * product owner, for the Reports / Plans review buttons) -- unlike
 * requestMoreInfoOnReport() above, which sends it back to Draft. The step
 * resets to 0 so a resubmission restarts the route, and the reason is kept in
 * history. Build a report/plan already treats Returned as editable, and its
 * Submit moves it back to In Review.
 */
export async function returnReportOccurrence(id, { actorPositionId, reason } = {}){
  try{
    const result = await Lm_reportoccurrencesService.update(id, {
      lm_status: REPORT_OCC_STATUS_KEY.Returned,
      lm_reviewstep: 0,
    });
    assertSuccess(result);
    const h = await addReportHistory(id, 'Returned to the author',
      { actorPositionId, note: reason });
    return { id, errors: h.errors };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}

/* ---------------------------------------------------------------------
   WIRED (base only): Decisions (wlog_decisions)
   ---------------------------------------------------------------------
   wlog_decisions is a pre-existing corporate "Work Log Decisions" table,
   not one built for this app. It has no lookup column to
   lm_meetingoccurrences, lm_reportoccurrences, lm_meetingtemplates or
   lm_report_templates -- only to an unrelated Work Log (employee
   time-logging) table. Per the call made when this was wired: the link to
   a specific Meeting Agenda Item / Report comes later, once those lookup
   columns exist. Until then this is read + a minimal create, surfaced as
   its own list on the Decisions tab alongside -- not replacing -- the
   existing seeded Decision workflow (Direct/Authority-Check types,
   Approval Cycle, Proposals, exec owner, outputs all stay seeded-only).

   Also unlike every other table in this file: it's registered through the
   legacy "Common Data Service" connector rather than the direct CDS
   database binding every MEETING_/REPORT_ table above uses, so its choice
   columns (Decision Status, Review Status, Escalation Result) are decoded
   from their FORMATTED VALUE, not from a hand-maintained numeric map like
   MEETING_OCC_STATUS above.

   ⚠️ There is no `_xxx_label` field. This read used to ask for three of them
   and returned 400 for the whole query -- `_x_value` is a LOOKUP's id, and a
   CHOICE's display text is an annotation, never a selectable column. The
   annotation is already on every row: getAll sends PREFER_PAGED, which asks
   for odata.include-annotations, so the label arrives without being selected.
   Same rule, same mistake, as strategy_departmentname on fetchKpis.

   The numeric values behind each label were never surfaced by the CLI/schema
   without an extra live metadata call, and the label is all display needs;
   createWorkLogDecision() below leaves status unset on create for the
   same reason, so Dataverse's own option-set default applies. */
export async function fetchWorkLogDecisions(){
  const res = await Wlog_decisionsService.getAll({
    filter: 'statecode eq 0',
    /* The three choice columns are selected by their own names only; their
       display text rides along as a formatted-value annotation. */
    /* ⚠️ The lookups were added 27 Sep after counting what IT actually holds
       on its 39 rows: wlog_worklog 39/39, wlog_reviewstatus 39/39,
       wlog_reviewer 24, wlog_evidenceurl 24, wlog_expectedoutput 24,
       wlog_managernote 13, wlog_revieweruser 3, wlog_escalatedtouser 2,
       wlog_escalatedto 0. Every decision belongs to a Work Log, so that is the
       one piece of context the register cannot sensibly omit. */
    select: ['wlog_decisionid','wlog_name','wlog_decisiontaken','wlog_expectedoutput',
             'wlog_managernote','wlog_evidenceurl','wlog_decisionstatus',
             'wlog_reviewstatus','wlog_reviewedon',
             'wlog_escalatedon','wlog_escalationreason','wlog_escalationreply',
             'wlog_escalationresolvedon','wlog_escalationresult',
             '_wlog_worklog_value','_wlog_reviewer_value','_wlog_revieweruser_value',
             '_wlog_escalatedto_value','_wlog_escalatedtouser_value',
             /* Where the decision was taken (added in IT by 28 Sep, see the
                schema refresh): a report section, or a meeting agenda item. */
             '_lm_citedreportsection_value','_lm_meetingoccurrenceagenda_value',
             'createdon','modifiedon'],
  });
  return (res?.data ?? []).map(d => ({
    id: d.wlog_decisionid,
    name: d.wlog_name || '(untitled decision)',
    decisionTaken: d.wlog_decisiontaken || null,
    expectedOutput: d.wlog_expectedoutput || null,
    managerNote: d.wlog_managernote || null,
    evidenceUrl: d.wlog_evidenceurl || null,
    status: d['wlog_decisionstatus' + FV] || null,
    reviewStatus: d['wlog_reviewstatus' + FV] || null,
    reviewedOn: isoDay(d.wlog_reviewedon),
    escalatedOn: isoDay(d.wlog_escalatedon),
    escalationReason: d.wlog_escalationreason || null,
    escalationReply: d.wlog_escalationreply || null,
    escalationResolvedOn: isoDay(d.wlog_escalationresolvedon),
    escalationResult: d['wlog_escalationresult' + FV] || null,
    /* Names ride along as formatted values, so naming the reviewer or the
       parent Work Log costs no second read. */
    workLogId: d._wlog_worklog_value || null,
    workLog: d['_wlog_worklog_value' + FV] || null,
    reviewerId: d._wlog_reviewer_value || null,
    reviewer: d['_wlog_reviewer_value' + FV] || null,
    reviewerUser: d['_wlog_revieweruser_value' + FV] || null,
    escalatedTo: d['_wlog_escalatedto_value' + FV] || null,
    escalatedToUser: d['_wlog_escalatedtouser_value' + FV] || null,
    sectionId: d._lm_citedreportsection_value || null,
    sectionName: d['_lm_citedreportsection_value' + FV] || null,
    agendaItemId: d._lm_meetingoccurrenceagenda_value || null,
    agendaItemName: d['_lm_meetingoccurrenceagenda_value' + FV] || null,
    created: d.createdon || null,
    updated: d.modifiedon || d.createdon || null,
  })).sort((a,b)=> (b.created||'').localeCompare(a.created||''));
}

/* Where a decision was taken. Each is ONE lookup on the decision, so a
   decision belongs to at most one report section and one agenda item; linking
   it again moves it. Targets confirmed in IT's metadata, 28 Sep. */
const decisionLinkBinds = ({ sectionId, agendaItemId } = {}) => {
  const b = {};
  if(sectionId)    b['lm_CitedReportSection@odata.bind']     = `/lm_reportoccurrencesectionses(${sectionId})`;
  if(agendaItemId) b['lm_MeetingOccurrenceAgenda@odata.bind'] = `/lm_meetingoccurrenceagendas(${agendaItemId})`;
  return b;
};

/* wlog_decisionstatus (global choice cr18c_wlog_decision_wlog_decisionstatus),
   the same codes in IT and DT New (pac modelbuilder, 04 Oct). A new decision
   always gets one -- it used to be created with none (the option set has no
   default), which the register showed as "—" beside older rows reading
   Pending. Escalated (4) is not offered at creation: escalating has its own
   fields (escalated to, reason). */
export const DECISION_STATUS_KEY = { 'Completed':1, 'Pending':2, 'Waiting':3, 'Escalated':4 };
export const NEW_DECISION_STATUSES = ['Pending', 'Waiting', 'Completed'];

/** Logs a new Work Log Decision, optionally where it was taken -- a report
 *  section and/or a meeting agenda item, with a status (Pending when none is
 *  given). */
export async function createWorkLogDecision({ name, decisionTaken, expectedOutput, managerNote, evidenceUrl,
                                              sectionId, agendaItemId, status } = {}){
  try{
    const created = await Wlog_decisionsService.create({
      wlog_name: (name||'').trim().slice(0,100) || undefined,
      wlog_decisionstatus: DECISION_STATUS_KEY[status] ?? DECISION_STATUS_KEY.Pending,
      wlog_decisiontaken: decisionTaken ? decisionTaken.slice(0,4000) : undefined,
      wlog_expectedoutput: expectedOutput ? expectedOutput.slice(0,1000) : undefined,
      wlog_managernote: managerNote ? managerNote.slice(0,2000) : undefined,
      wlog_evidenceurl: evidenceUrl ? evidenceUrl.slice(0,500) : undefined,
      ...decisionLinkBinds({ sectionId, agendaItemId }),
    });
    const id = idOrThrow(created, 'wlog_decisionid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'wlog_decisions', error:e }] };
  }
}

/** Links an EXISTING decision to a report section and/or a meeting agenda item.
 *  Only the link(s) given are written; one already set to something else is
 *  replaced (the lookup holds one). */
export async function linkWorkLogDecision(id, { sectionId, agendaItemId } = {}){
  const patch = decisionLinkBinds({ sectionId, agendaItemId });
  if(!id || !Object.keys(patch).length)
    return { id: null, errors: [{ table:'wlog_decisions', error: new Error('a decision and a target are required') }] };
  try{
    const result = await Wlog_decisionsService.update(id, patch);
    assertSuccess(result);
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'wlog_decisions', error:e }] };
  }
}

/** Heading and report of each given Report Section, for naming where a decision
 *  was taken. Chunked by 15 ids so the OR filter stays a URL the service takes.
 *  -> Map(sectionId -> { id, heading, reportId, reportName }) */
export async function fetchReportSectionsByIds(ids = []){
  const out = new Map();
  const want = [...new Set(ids.filter(Boolean))];
  for(let i = 0; i < want.length; i += 15){
    const res = await Lm_reportoccurrencesectionsesService.getAll({
      filter: want.slice(i, i + 15).map(id => `lm_reportoccurrencesectionsid eq ${id}`).join(' or '),
      select: ['lm_reportoccurrencesectionsid','lm_heading','_lm_reportoccurrence_value'],
    });
    assertSuccess(res);
    for(const r of res.data ?? [])
      out.set(r.lm_reportoccurrencesectionsid, {
        id: r.lm_reportoccurrencesectionsid,
        heading: r.lm_heading || '(untitled section)',
        reportId: r._lm_reportoccurrence_value || null,
        reportName: r['_lm_reportoccurrence_value' + FV] || null,
      });
  }
  return out;
}

/* =========================================================================
   Setup Activity trail (lm_setupactivities)

   One row per recorded change to a Meeting or Report Template Setup. The two
   Template lookups are mutually exclusive -- exactly one is set, never both --
   the same either/or shape lm_reporttemplatereviewchains uses for its per-BU /
   per-Region pair.

   `createdon` is the timestamp; there is deliberately no lm_occurredon column
   to keep in sync with it.
   ========================================================================= */
const Lm_setupactivitiesService = dvTable('lm_setupactivities', 'lm_setupactivityid', PIN_ORG);

/* Dataverse renders option 3 as "Editopened" with no space -- the label was
   typed without one. Both directions go through these maps rather than the
   generated labels, so the app keeps saying "Edit opened". */
export const SETUP_ACTIVITY_ACTION_KEY = {
  'Created':1, 'Edited':2, 'Edit opened':3, 'Published':4, 'Approved':5, 'Expired':6,
};
export const SETUP_ACTIVITY_ACTION = {
  1:'Created', 2:'Edited', 3:'Edit opened', 4:'Published', 5:'Approved', 6:'Expired',
};

export const ACTIVITY_TEXT_MAX  = 2000; // lm_before / lm_after
export const ACTIVITY_FIELD_MAX = 100;  // lm_field
export const ACTIVITY_ACTOR_MAX = 200;  // lm_actor
export const ACTIVITY_NAME_MAX  = 850;  // lm_name (primary)

/* Unlike capped() above, this TRUNCATES instead of throwing. capped() is right
   for content a user typed -- refusing the write and telling them is better
   than silently losing half a sentence. An audit entry is different: the row
   is written on the user's behalf as a side effect, and a "Units covered"
   change across many units can run long. Losing the whole trail entry because
   one value overflowed would be worse than recording a shortened value, so
   this keeps the head and marks it. */
function trimmed(value, max){
  const v = (value ?? '').toString().trim();
  if(!v) return null;
  return v.length > max ? v.slice(0, max - 1) + '…' : v;
}

/** Writes one activity row. `kind` is the app's Setup kind string, which
 *  decides which of the two Template lookups is bound.
 *  Never throws: the trail must not be able to break the save it describes. */
export async function logSetupActivity(kind, templateId, entry){
  if(!templateId) return { id:null, errors:[{ table:'lm_setupactivities', error:new Error('no template id') }] };
  const isReport = kind === 'Report Template';
  const row = {
    lm_name: trimmed(`${entry.action} · ${entry.field}`, ACTIVITY_NAME_MAX) || 'Activity',
    lm_action: SETUP_ACTIVITY_ACTION_KEY[entry.action] ?? null,
    lm_field: trimmed(entry.field, ACTIVITY_FIELD_MAX),
    lm_before: trimmed(entry.before, ACTIVITY_TEXT_MAX),
    lm_after: trimmed(entry.after, ACTIVITY_TEXT_MAX),
    lm_actor: trimmed(entry.actor, ACTIVITY_ACTOR_MAX),
    lm_version: typeof entry.version === 'number' ? entry.version : null,
  };
  row[isReport ? 'lm_ReportTemplate@odata.bind' : 'lm_MeetingTemplate@odata.bind'] =
    isReport ? `/lm_report_templates(${templateId})` : `/lm_meetingtemplates(${templateId})`;
  if(entry.actorUserId) row['lm_ActorUser@odata.bind'] = `/systemusers(${entry.actorUserId})`;

  try{
    const created = await Lm_setupactivitiesService.create(row);
    return { id: idOrThrow(created, 'lm_setupactivityid'), errors: [] };
  }catch(e){
    return { id:null, errors:[{ table:'lm_setupactivities', error:e }] };
  }
}

/** Writes a batch in order, and never rejects -- returns whatever failed so a
 *  caller can log it without the trail affecting the save it describes. */
export async function logSetupActivityBatch(kind, templateId, entries){
  const errors = [];
  for(const e of (entries || [])){
    const r = await logSetupActivity(kind, templateId, e);
    if(r.errors.length) errors.push(...r.errors);
  }
  return { count: (entries||[]).length - errors.length, errors };
}

/** Every recorded change for one Template, newest first — the shape the
 *  Setup Detail Activity tab already renders. */
export async function fetchSetupActivity(kind, templateId){
  if(!templateId) return [];
  const valueField = kind === 'Report Template'
    ? '_lm_reporttemplate_value' : '_lm_meetingtemplate_value';
  const res = await Lm_setupactivitiesService.getAll({
    filter: `${valueField} eq ${templateId}`,
    select: ['lm_setupactivityid','lm_action','lm_field','lm_before','lm_after',
             'lm_actor','lm_version','createdon'],
  });
  return (res?.data ?? [])
    .map(r => ({
      id: r.lm_setupactivityid,
      at: (r.createdon || '').replace('T',' ').slice(0,16),
      actor: r.lm_actor || 'System',
      action: SETUP_ACTIVITY_ACTION[r.lm_action] || 'Edited',
      field: r.lm_field || '—',
      before: r.lm_before || '—',
      after: r.lm_after || '—',
      version: r.lm_version ?? null,
      live: true,
    }))
    /* createdon is an ISO string, so a plain string sort is chronological. */
    .sort((a,b) => String(b.at).localeCompare(String(a.at)));
}

/* =========================================================================
   Delete a Meeting Setup with everything that hangs off it (06 Oct, user's
   ask -- Administrator only, Governance Setup register).

   Two steps, so the Administrator confirms against real numbers:
     planMeetingSetupDelete(id)  -- reads every related row, writes nothing;
     runMeetingSetupDelete(plan) -- deletes them, deepest rows first, the
                                    Setup itself last.

   The user chose "delete the Meeting Occurrences too", so the plan covers:
     each Occurrence's agenda, attendees, departments, linked documents,
     Minutes (+ their notes and the confidential-viewer rows), Audit Grids
     (+ answers); and the Setup's own units, attendees, agenda, departments,
     supportive functions, linked reports, Stage 4 categories, activity trail.
   Tasks and Decisions that point at a deleted Occurrence are NOT deleted --
   they are work records in their own right; Dataverse clears their link.

   Core tables are read strictly (rowsOrThrow): a failed read must stop the
   delete, not be mistaken for "nothing there". Optional tables that may not
   exist in every environment (viewer list, activity trail, Stage 4
   categories) read leniently.
   ========================================================================= */
const DEL_CHUNK = 25;
async function idsWhere(service, idField, key, ids, { strict=true } = {}){
  const out = [];
  const list = [...new Set((ids||[]).filter(Boolean))];
  for(let i = 0; i < list.length; i += DEL_CHUNK){
    const chunk = list.slice(i, i + DEL_CHUNK);
    const filter = chunk.map(id => `${key} eq ${id}`).join(' or ');
    let res;
    try{ res = await service.getAll({ filter, select:[idField] }); }
    catch(e){ if(strict) throw e; continue; }
    const rows = strict ? rowsOrThrow(res) : (res?.success===false ? [] : (res?.data ?? []));
    rows.forEach(r => r?.[idField] && out.push(r[idField]));
  }
  return [...new Set(out)];
}

/** Reads everything a delete of this Meeting Setup would remove. Writes nothing.
 *  @returns {Promise<{templateId:string, occurrences:{id,name,date}[],
 *            steps:{label:string, table:string, service:object, ids:string[]}[]}>} */
export async function planMeetingSetupDelete(templateId){
  const T = [templateId];
  const step = (label, table, service, ids) => ({ label, table, service, ids });

  const occRes = await Lm_meetingoccurrencesService.getAll({
    filter: `_lm_meetingtemplate_value eq ${templateId}`,
    select: ['lm_meetingoccurrenceid','lm_name','lm_date'],
  });
  const occurrences = rowsOrThrow(occRes).map(o => ({
    id: o.lm_meetingoccurrenceid, name: o.lm_name || '(untitled meeting)', date: isoDay(o.lm_date) }));
  const O = occurrences.map(o => o.id);
  const occKey = '_lm_meetingoccurrence_value';

  const [agendaIds, attIds, deptIds, docIds, minuteIds, gridIds] = await Promise.all([
    idsWhere(Lm_meetingoccurrenceagendasService, 'lm_meetingoccurrenceagendaid', occKey, O),
    idsWhere(Lm_meetingoccurrenceattendeesesService, 'lm_meetingoccurrenceattendeesid', occKey, O),
    idsWhere(Lm_meetingoccurrencedepartmentfunctionsService, 'lm_meetingoccurrencedepartmentfunctionid', occKey, O),
    idsWhere(Lm_meetingoccurrencelinkedreportsesService, 'lm_meetingoccurrencelinkedreportsid', occKey, O),
    idsWhere(Lm_meetingminutesesService, 'lm_meetingminutesid', occKey, O),
    idsWhere(Lm_auditgridinstancesService, 'lm_auditgridinstanceid', occKey, O),
  ]);
  const [noteIds, answerIds] = await Promise.all([
    idsWhere(Lm_momnotesesService, 'lm_momnotesid', '_lm_meetingminutes_value', minuteIds),
    idsWhere(Lm_auditgridanswersService, 'lm_auditgridanswerid', '_lm_auditgridinstance_value', gridIds),
  ]);
  const viewerIds = [...new Set([
    ...await idsWhere(Lm_meetingminutesreviewerlistsService, 'lm_meetingminutesreviewerlistid', '_lm_momnotes_value', noteIds, { strict:false }),
    ...await idsWhere(Lm_meetingminutesreviewerlistsService, 'lm_meetingminutesreviewerlistid', '_lm_meetingoccurrenceagenda_value', agendaIds, { strict:false }),
  ])];

  /* the Setup's own rows */
  const tKey = '_lm_meetingtemplate_value';
  const [buIds, regionIds, tAgendaIds, linesIds, supIds, linkedIds, topCatIds, activityIds, tAttIds] = await Promise.all([
    idsWhere(Lm_meetingtemplatebusinessunitsesService, 'lm_meetingtemplatebusinessunitsid', tKey, T),
    idsWhere(Lm_meetingtemplateregionsService, 'lm_meetingtemplateregionid', tKey, T),
    idsWhere(Lm_meetingtemplateagendaitemsService, 'lm_meetingtemplateagendaitemid', tKey, T),
    idsWhere(Lm_meetingtemplatedepartmentfunctionsService, 'lm_meetingtemplatedepartmentfunctionid', tKey, T),
    idsWhere(Lm_meetingtemplatesupportivefunctionsesService, 'lm_meetingtemplatesupportivefunctionsid', tKey, T),
    idsWhere(Lm_meetingtemplatelinkedreportsesService, 'lm_meetingtemplatelinkedreportsid', tKey, T),
    idsWhere(Lm_topmanagementmeetingcategoriesService, 'lm_topmanagementmeetingcategoryid', tKey, T, { strict:false }),
    idsWhere(Lm_setupactivitiesService, 'lm_setupactivityid', tKey, T, { strict:false }),
    idsWhere(Lm_meetingattendeeslistsService, 'lm_meetingattendeeslistid', tKey, T),
  ]);
  /* per-unit Attendees, in case a row carries only its unit lookup */
  const unitAttIds = [
    ...await idsWhere(Lm_meetingattendeeslistsService, 'lm_meetingattendeeslistid', '_lm_meetingtemplateperbusinessunit_value', buIds),
    ...await idsWhere(Lm_meetingattendeeslistsService, 'lm_meetingattendeeslistid', '_lm_meetingtemplateperregion_value', regionIds),
  ];

  return {
    templateId, occurrences,
    /* deletion order: deepest first, the Setup last */
    steps: [
      step('Confidential-item viewers', 'lm_meetingminutesreviewerlists', Lm_meetingminutesreviewerlistsService, viewerIds),
      step('Minutes notes', 'lm_momnoteses', Lm_momnotesesService, noteIds),
      step('Meeting Minutes', 'lm_meetingminuteses', Lm_meetingminutesesService, minuteIds),
      step('Audit Grid answers', 'lm_auditgridanswers', Lm_auditgridanswersService, answerIds),
      step('Audit Grids', 'lm_auditgridinstances', Lm_auditgridinstancesService, gridIds),
      step('Meeting agenda items', 'lm_meetingoccurrenceagendas', Lm_meetingoccurrenceagendasService, agendaIds),
      step('Meeting attendees', 'lm_meetingoccurrenceattendeeses', Lm_meetingoccurrenceattendeesesService, attIds),
      step('Meeting departments', 'lm_meetingoccurrencedepartmentfunctions', Lm_meetingoccurrencedepartmentfunctionsService, deptIds),
      step('Meeting documents', 'lm_meetingoccurrencelinkedreportses', Lm_meetingoccurrencelinkedreportsesService, docIds),
      step('Meeting Occurrences', 'lm_meetingoccurrences', Lm_meetingoccurrencesService, O),
      step('Setup attendees', 'lm_meetingattendeeslists', Lm_meetingattendeeslistsService, [...new Set([...tAttIds, ...unitAttIds])]),
      step('Setup Business Units', 'lm_meetingtemplatebusinessunitses', Lm_meetingtemplatebusinessunitsesService, buIds),
      step('Setup Regions', 'lm_meetingtemplateregions', Lm_meetingtemplateregionsService, regionIds),
      step('Setup agenda items', 'lm_meetingtemplateagendaitems', Lm_meetingtemplateagendaitemsService, tAgendaIds),
      step('Setup departments', 'lm_meetingtemplatedepartmentfunctions', Lm_meetingtemplatedepartmentfunctionsService, linesIds),
      step('Supportive functions', 'lm_meetingtemplatesupportivefunctionses', Lm_meetingtemplatesupportivefunctionsesService, supIds),
      step('Linked reports', 'lm_meetingtemplatelinkedreportses', Lm_meetingtemplatelinkedreportsesService, linkedIds),
      step('Stage 4 categories', 'lm_topmanagementmeetingcategories', Lm_topmanagementmeetingcategoriesService, topCatIds),
      step('Activity trail', 'lm_setupactivities', Lm_setupactivitiesService, activityIds),
      step('Meeting Setup', 'lm_meetingtemplates', Lm_meetingtemplatesService, T),
    ],
  };
}

/** Deletes what planMeetingSetupDelete() found, in its order. Keeps going past
 *  a failed row, but never deletes the Setup itself if anything before it
 *  failed -- a half-deleted Setup stays visible so the delete can be re-run.
 *  @param {(label:string, done:number, total:number)=>void} [onProgress]
 *  @returns {Promise<{deleted:number, errors:{table:string,error:any}[], setupDeleted:boolean}>} */
export async function runMeetingSetupDelete(plan, onProgress){
  const errors = [];
  let deleted = 0, setupDeleted = false;
  const total = plan.steps.reduce((n, s) => n + s.ids.length, 0);
  for(const s of plan.steps){
    const isSetup = s.table === 'lm_meetingtemplates';
    if(isSetup && errors.length) break;
    for(const id of s.ids){
      onProgress?.(s.label, deleted, total);
      try{ assertSuccess(await s.service.delete(id)); deleted++; if(isSetup) setupDeleted = true; }
      catch(e){ errors.push({ table:s.table, error:e }); }
    }
  }
  onProgress?.('Done', deleted, total);
  return { deleted, errors, setupDeleted };
}
