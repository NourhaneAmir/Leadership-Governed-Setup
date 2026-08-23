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

/* ---------------------------------------------------------------------
   WIRED: Regions (crd04_regions) and Business Units (businessunit)
   ---------------------------------------------------------------------
   NOTE on getAll(): the generated service's getAll() resolves with the
   record array directly on .data (IOperationResult<T[]> -- .data IS the
   T[]), not nested under .data.value like a raw Dataverse Web API/OData
   response. Every fetch* function below reads res.data accordingly. */
import { BusinessunitsService } from '../generated/services/BusinessunitsService';
import { Crd04_regionsesService } from '../generated/services/Crd04_regionsesService';
import { Cr603_chklst_departmentsesService } from '../generated/services/Cr603_chklst_departmentsesService';
import { Hr_functionsService } from '../generated/services/Hr_functionsService';
import { Strategy_kpisesService } from '../generated/services/Strategy_kpisesService';
import { Strategy_processesService } from '../generated/services/Strategy_processesService';
import { Cr301_specialtyksa_service_hubsService } from '../generated/services/Cr301_specialtyksa_service_hubsService';
import { Cr603_organizationstructuresService } from '../generated/services/Cr603_organizationstructuresService';
import { SystemusersService } from '../generated/services/SystemusersService';
import { Hr_employeesService } from '../generated/services/Hr_employeesService';
import { And_teamschannelsService } from '../generated/services/And_teamschannelsService';

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
    select: ['strategy_kpisid', 'strategy_newcolumn', '_strategy_department_value'],
  });
  const rows = res?.data ?? [];
  // {id, name, dept} -- id is needed to write lm_RelatedKPI@odata.bind when
  // saving a Report Template; dept feeds the Governed List's BU/Department
  // filter. GovernanceApp derives the flat name list the existing
  // Checks/ComboMulti UI expects from this same fetch.
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({
    id: r.strategy_kpisid,
    name: r.strategy_newcolumn,
    dept: r._strategy_department_value ?? null,
  }));
}

export async function fetchProcesses(){
  const res = await Strategy_processesService.getAll({
    // same strategy_newcolumn caveat as fetchKpis above.
    select: ['strategy_processid', 'strategy_newcolumn', '_strategy_department_value'],
  });
  const rows = res?.data ?? [];
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({
    id: r.strategy_processid,
    name: r.strategy_newcolumn,
    dept: r._strategy_department_value ?? null,
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
 *  whoever currently holds it. That is resolved from this table:
 *
 *   - byEmployeeId   -- the forward path. The Organization Structure row names
 *                       its Current Employee (hr_CurrentEmployee), and that id
 *                       is looked up here. This is the intended route.
 *   - byPositionId   -- the reverse path, kept as a backstop. Every Employee
 *                       carries a required lookup back to the Position it holds
 *                       (cr603_OrganizationStructure), so a Position whose
 *                       Current Employee is blank can still be resolved.
 *
 *  hr_fullname is a read-only calculated column and Dataverse rejects some such
 *  fields in a plain $select, so the name is composed from the writable parts. */
async function fetchEmployeeIndex(){
  try{
    const res = await Hr_employeesService.getAll({
      select: ['hr_employeeid', '_cr603_organizationstructure_value',
               'hr_firstname', 'hr_secondname', 'hr_lastname'],
    });
    const rows = res?.data ?? [];
    const byEmployeeId = {}, byPositionId = {};
    rows.forEach(e => {
      const name = [e.hr_firstname, e.hr_secondname, e.hr_lastname].filter(Boolean).join(' ').trim();
      if(!name) return;
      if(e.hr_employeeid) byEmployeeId[e.hr_employeeid] = name;
      const posId = e._cr603_organizationstructure_value;
      if(posId && !byPositionId[posId]) byPositionId[posId] = name;
    });
    return { byEmployeeId, byPositionId };
  }catch(e){
    console.warn('[dataverse] fetchEmployeeIndex() failed -- Position holders will be unresolved:', e);
    return { byEmployeeId:{}, byPositionId:{} };
  }
}

export async function fetchPositions(){
  const [posRes, employees, userMap] = await Promise.all([
    Cr603_organizationstructuresService.getAll({
      select: [
        'cr603_organizationstructureid', 'cr603_name', '_cr603_businessunit_value',
        '_cr18c_departments_lkp_value', '_hr_funtion_value', '_hr_currentemployee_value',
      ],
    }),
    fetchEmployeeIndex(),
    fetchUserNameMap(),
  ]);
  const rows = posRes?.data ?? [];
  return rows.map(r => {
    const posId = r.cr603_organizationstructureid;
    const currentEmployeeId = r._hr_currentemployee_value;
    /* Read the Position from the Organization Structure, then go back to
       hr_employees for the name of the employee currently holding it.

       Three routes, in order of how directly they answer that:
        1. the Position's own Current Employee lookup, resolved in hr_employees
        2. the same lookup resolved in systemusers -- covers an environment where
           hr_CurrentEmployee points at a User rather than an Employee record
        3. the reverse link, an Employee pointing back at this Position, for rows
           where Current Employee was never filled in */
    const holder =
         (currentEmployeeId && employees.byEmployeeId[currentEmployeeId])
      || (currentEmployeeId && userMap[currentEmployeeId])
      || employees.byPositionId[posId]
      || null;
    return {
      id: posId,
      name: r.cr603_name,
      bu: r._cr603_businessunit_value ?? null,
      dept: r._cr18c_departments_lkp_value ?? null,
      fn: r._hr_funtion_value ?? null,
      holder,
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

/** Teams and Channels -- table and_teamschannels. One row per CHANNEL; the
 *  Team it belongs to is lm_team, a plain text column rather than a lookup
 *  to a Teams table (there is no Teams table -- a "Team" exists only as the
 *  name repeated across its channels' rows). So the app derives its Team
 *  list from the distinct lm_team values, and a Team's channels are the rows
 *  carrying that exact name.
 *
 *  Consequence worth knowing: a Team here has no Business Unit or Region
 *  relationship, so Teams can't be narrowed to the unit a Setup runs in the
 *  way the old mock data allowed -- every unit is offered every Team.
 *
 *  lm_sharepointsitepath / lm_documentlibrary / lm_folder are the channel's
 *  document location, joined into one path by the caller and used to
 *  auto-fill a Report Template's Source link. */
export async function fetchTeamsChannels(){
  const res = await And_teamschannelsService.getAll({
    select: ['and_teamschannelid','and_channelname','and_channellink','lm_team',
             'lm_sharepointsitepath','lm_documentlibrary','lm_folder'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.and_teamschannelid,
    name: r.and_channelname || '(unnamed channel)',
    link: r.and_channellink ?? null,
    team: (r.lm_team || '').trim() || null,
    sitePath: r.lm_sharepointsitepath ?? null,
    library: r.lm_documentlibrary ?? null,
    folder: r.lm_folder ?? null,
  }));
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

import { Lm_report_templatesService } from '../generated/services/Lm_report_templatesService';
import { Lm_reporttemplatebusinessunitsesService } from '../generated/services/Lm_reporttemplatebusinessunitsesService';
import { Lm_reporttemplateregionsService } from '../generated/services/Lm_reporttemplateregionsService';
import { Lm_reporttemplatecontentchecklistsService } from '../generated/services/Lm_reporttemplatecontentchecklistsService';
import { Lm_reporttemplatedepartmentfunctionsService } from '../generated/services/Lm_reporttemplatedepartmentfunctionsService';
import { Lm_reporttemplaterelatedkpisesService } from '../generated/services/Lm_reporttemplaterelatedkpisesService';
import { Lm_reporttemplaterelatedprocessesesService } from '../generated/services/Lm_reporttemplaterelatedprocessesesService';
import { Lm_reporttemplatereviewchainsService } from '../generated/services/Lm_reporttemplatereviewchainsService';

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
const CONFIDENTIALITY_KEY = { 'Public':1, 'Internal':2, 'Confidential':3, 'High Confidential':4, 'Restricted':5 };
const REPORT_TYPE_KEY = { 'Plan':1, 'Report':2, 'Conclusion':3 };
// Dataverse's lm_reportcategory choice list was expanded to match the
// app's REPORT_CATEGORIES exactly (same 4 labels, same order), so this is
// now a clean 1:1 map.
const REPORT_CATEGORY_KEY = {
  'Outcome Executive':1, 'Process Executive':2, 'Core Process':3, 'Custom Content':4,
};

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
function reportTemplateParentPayload(payload){
  return {
    lm_newcolumn: payload.name || payload.objective || 'Untitled Report Template',
    lm_objective: payload.objective || null,
    lm_reporttype: payload.reportType ? REPORT_TYPE_KEY[payload.reportType] : null,
    lm_reportcategory: payload.reportCategory ? REPORT_CATEGORY_KEY[payload.reportCategory] : null,
    lm_frequency: payload.frequency ? FREQUENCY_KEY[payload.frequency] : null,
    lm_dayoftheweek: payload.dayOfWeek ? DAY_OF_WEEK_KEY[payload.dayOfWeek] : null,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : null,
    lm_monthofthequarter: payload.monthInQuarter ? MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : null,
    lm_confidentiality: payload.confidentiality ? CONFIDENTIALITY_KEY[payload.confidentiality] : null,
    lm_destinationsharepointlink: payload.destinationLink || null,
    lm_reportstatus: payload.status ? TEMPLATE_STATUS_KEY[payload.status] : null,
    lm_version: typeof payload.version === 'number' ? payload.version : null,
  };
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

/** Creates every child row (per-unit Business Unit/Region rows, each with
 *  its own Review Chain, plus the template-level checklist/lines/KPI/
 *  Process rows) for an already-existing lm_report_templates row. Shared by
 *  create (fresh parent) and update (existing parent, after its old
 *  children were deleted) -- same fan-out either way, just a different
 *  `templateId` source. Mutates `errors` in place; nothing is returned. */
async function createReportTemplateChildren(templateId, payload, errors){
  const bind = `/lm_report_templates(${templateId})`;

  // One lm_reporttemplatebusinessunitses / lm_reporttemplateregions row per
  // configured unit, each with its own Speciality/Owner/Submitter, and its
  // own Review Chain bound back to that specific unit row (not just the
  // parent template) via lm_MeetingTemplatePerBusinessUnit /
  // lm_MeetingTemplatePerRegion on lm_reporttemplatereviewchains -- yes,
  // those lookup names say "MeetingTemplate" even on the Report Template's
  // review chain table; that's the real field name Dataverse generated,
  // kept as-is rather than "corrected" to avoid guessing wrong.
  // Group-level Setups have no dedicated child table yet, so their units
  // (if any) are skipped with a console note rather than guessed at.
  for(const unit of (payload.units||[])){
    let unitBind = null, unitLookupField = null;

    if(payload.stageLevel==='bu' && unit?.businessUnitId){
      try{
        const rowPayload = {
          'lm_ReportTemplate@odata.bind': bind,
          'lm_BusinessUnit@odata.bind': `/businessunits(${unit.businessUnitId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.specialityId) rowPayload['lm_Speciality@odata.bind'] = `/cr301_specialtyksa_service_hubs(${unit.specialityId})`;
        if(unit.ownerPositionId) rowPayload['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${unit.ownerPositionId})`;
        if(unit.submittingPositionId) rowPayload['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${unit.submittingPositionId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannels(${unit.channelId})`;
        const created = await Lm_reporttemplatebusinessunitsesService.create(rowPayload);
        const rowId = created?.data?.lm_reporttemplatebusinessunitsid;
        if(rowId){ unitBind = `/lm_reporttemplatebusinessunitses(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerBusinessUnit@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_reporttemplatebusinessunitses', error:e }); }
    }else if(payload.stageLevel==='region' && unit?.regionId){
      try{
        const rowPayload = {
          'lm_ReportTemplate@odata.bind': bind,
          'lm_Region@odata.bind': `/crd04_regionses(${unit.regionId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.specialityId) rowPayload['lm_ReportSpeciality@odata.bind'] = `/cr301_specialtyksa_service_hubs(${unit.specialityId})`;
        if(unit.ownerPositionId) rowPayload['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${unit.ownerPositionId})`;
        if(unit.submittingPositionId) rowPayload['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${unit.submittingPositionId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannels(${unit.channelId})`;
        const created = await Lm_reporttemplateregionsService.create(rowPayload);
        const rowId = created?.data?.lm_reporttemplateregionid;
        if(rowId){ unitBind = `/lm_reporttemplateregions(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerRegion@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_reporttemplateregions', error:e }); }
    }else{
      console.warn(`[dataverse] Report Template unit "${unit?.name||unit?.key}" at "${payload.stageLevel}" level has no per-unit child table yet -- its Review Chain, if any, was not saved.`);
      continue;
    }

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
      await Lm_reporttemplatecontentchecklistsService.create({
        lm_checklistitemname: item.text,
        lm_checklistitemstep: (payload.checklist.indexOf(item)+1),
        'lm_ReportTemplate@odata.bind': bind,
      });
    }catch(e){ errors.push({ table:'lm_reporttemplatecontentchecklists', error:e }); }
  }

  for(const line of (payload.lines||[])){
    if(!line?.departmentId) continue;
    try{
      const rowPayload = { 'lm_ReportTemplate@odata.bind': bind, 'lm_Department@odata.bind': `/cr603_chklst_departmentses(${line.departmentId})` };
      if(line.functionId) rowPayload['lm_Function@odata.bind'] = `/hr_functions(${line.functionId})`;
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
    Lm_reporttemplatebusinessunitsesService.getAll({ filter, select:['lm_reporttemplatebusinessunitsid'] }),
    Lm_reporttemplateregionsService.getAll({ filter, select:['lm_reporttemplateregionid'] }),
  ]);
  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];
  const [buChains, regionChains] = await Promise.all([
    Promise.all(businessUnits.map(bu => Lm_reporttemplatereviewchainsService.getAll({
      filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_reporttemplatebusinessunitsid}`,
      select: ['lm_reporttemplatereviewchainid'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
    Promise.all(regions.map(rg => Lm_reporttemplatereviewchainsService.getAll({
      filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_reporttemplateregionid}`,
      select: ['lm_reporttemplatereviewchainid'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
  ]);
  return {
    checklist: checklistRes?.data ?? [],
    lines: linesRes?.data ?? [],
    kpis: kpisRes?.data ?? [],
    processes: procsRes?.data ?? [],
    businessUnits, regions,
    reviewChains: [...buChains.flat(), ...regionChains.flat()],
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
 * @param {string} [payload.reportCategory] one of REPORT_CATEGORY_KEY's keys
 * @param {string} [payload.frequency] one of FREQUENCY_KEY's keys
 * @param {string} [payload.dayOfWeek] one of DAY_OF_WEEK_KEY's keys
 * @param {number} [payload.dayOfMonth]
 * @param {string} [payload.monthInQuarter] one of MONTH_IN_QUARTER_KEY's keys
 * @param {string} [payload.confidentiality] one of CONFIDENTIALITY_KEY's keys
 * @param {string} [payload.destinationLink]
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' currently create per-unit child rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,specialityId?:string,ownerPositionId?:string,submittingPositionId?:string,reviewChain?:{step:number,positionId?:string,positionName:string}[]}[]} [payload.units] one entry per configured unit, each with its own Review Chain
 * @param {{text:string}[]} [payload.checklist]
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
    templateId = created?.data?.lm_report_templateid ?? null;
    if(!templateId) throw new Error('Create succeeded but no id was returned');
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
    await Lm_report_templatesService.update(dvId, reportTemplateParentPayload(payload));
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
    // Deepest first: a Review Chain row points at its Business Unit/Region
    // row, so it must go before that row does.
    await deleteRows(Lm_reporttemplatereviewchainsService, existing.reviewChains, 'lm_reporttemplatereviewchainid', 'lm_reporttemplatereviewchains', errors);
    await deleteRows(Lm_reporttemplatebusinessunitsesService, existing.businessUnits, 'lm_reporttemplatebusinessunitsid', 'lm_reporttemplatebusinessunitses', errors);
    await deleteRows(Lm_reporttemplateregionsService, existing.regions, 'lm_reporttemplateregionid', 'lm_reporttemplateregions', errors);
    await deleteRows(Lm_reporttemplatecontentchecklistsService, existing.checklist, 'lm_reporttemplatecontentchecklistid', 'lm_reporttemplatecontentchecklists', errors);
    await deleteRows(Lm_reporttemplatedepartmentfunctionsService, existing.lines, 'lm_reporttemplatedepartmentfunctionid', 'lm_reporttemplatedepartmentfunctions', errors);
    await deleteRows(Lm_reporttemplaterelatedkpisesService, existing.kpis, 'lm_reporttemplaterelatedkpisid', 'lm_reporttemplaterelatedkpises', errors);
    await deleteRows(Lm_reporttemplaterelatedprocessesesService, existing.processes, 'lm_reporttemplaterelatedprocessesid', 'lm_reporttemplaterelatedprocesseses', errors);
  }

  await createReportTemplateChildren(dvId, payload, errors);
  return { id: dvId, errors };
}

/* =========================================================================
   Meeting Template save (Committee/Meeting Setups)
   Mirrors the Report Template save above -- parent row, then children
   (agenda items, supportive functions, department/function lines, linked
   reports, attendees).
   ========================================================================= */

import { Lm_meetingtemplatesService } from '../generated/services/Lm_meetingtemplatesService';
import { Lm_meetingtemplatebusinessunitsesService } from '../generated/services/Lm_meetingtemplatebusinessunitsesService';
import { Lm_meetingtemplateregionsService } from '../generated/services/Lm_meetingtemplateregionsService';
import { Lm_meetingtemplateagendaitemsService } from '../generated/services/Lm_meetingtemplateagendaitemsService';
import { Lm_meetingtemplatesupportivefunctionsesService } from '../generated/services/Lm_meetingtemplatesupportivefunctionsesService';
import { Lm_meetingtemplatedepartmentfunctionsService } from '../generated/services/Lm_meetingtemplatedepartmentfunctionsService';
import { Lm_meetingtemplatelinkedreportsesService } from '../generated/services/Lm_meetingtemplatelinkedreportsesService';
import { Lm_meetingattendeeslistsService } from '../generated/services/Lm_meetingattendeeslistsService';

// Same reasoning as the Report Template maps above: explicit, not
// auto-matched, since Dataverse's labels differ slightly (trailing
// spaces, "Online" vs "Virtual", non-sequential option codes, etc.).
const MEETING_FREQUENCY_KEY = {
  'Daily':1, 'Twice Weekly':2, 'Weekly':3, 'Twice Monthly':4, 'Monthly':5,
  'Quarterly':6, 'Semesterly':7, 'Annually':8, 'Custom':9,
};
const MEETING_DAY_OF_WEEK_KEY = { 'Sunday':124330000, 'Monday':124330001, 'Tuesday':124330002, 'Wednesday':124330003, 'Thursday':124330004 };
const MEETING_MONTH_IN_QUARTER_KEY = { '1st month':124330000, '2nd month':124330001, '3rd month':124330002 };
const MEETING_CONFIDENTIALITY_KEY = { 'Public':124330000, 'Internal':124330001, 'Confidential':124330002, 'High Confidential':124330003, 'Restricted':124330004 };
const MEETING_MODE_KEY = { 'Physical':1, 'Virtual':2, 'Hybrid':3 };
const MEETING_SETUP_TYPE_KEY = { 'Business Meeting':1, 'Accreditation Committee':2 };
const MEETING_STAGE_KEY = {
  'Stage 1 BU Operational':1, 'Stage 2 Regional Functional':2,
  'Stage 3 Group Functional':3, 'Stage 4 Top Management, COO & CEO':4,
};
const MEETING_CATEGORY_KEY = {
  'Planning Meeting':124330000, 'Performance Monitoring Meeting':124330001,
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
  124330000:'Planning Meeting', 124330001:'Performance Monitoring Meeting',
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
 * @param {string} [payload.mode] one of MEETING_MODE_KEY's keys
 * @param {string} [payload.confidentiality] one of MEETING_CONFIDENTIALITY_KEY's keys
 * @param {number} [payload.quorum]
 * @param {string} [payload.torLink]
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' currently create per-unit child rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,chairmanId?:string,coChairmanId?:string,facilitatorId?:string,attendeePositionIds?:string[]}[]} [payload.units] one entry per configured unit, each with its own Attendees list
 * @param {{step:number, text:string, ownerId?:string, source:string}[]} [payload.agenda]
 * @param {{departmentId:string, functionId?:string}[]} [payload.lines]
 * @param {{name:string, functionId?:string}[]} [payload.supportive]
 * @param {{name:string, role:string, reportTemplateId?:string}[]} [payload.linkedReports] role is 'Input'|'Output'; reportTemplateId links a real lm_report_templates row when known (see REPORT_DATAVERSE_ID in GovernanceApp.jsx), otherwise the name is still written as free text
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
// Same reasoning as reportTemplateParentPayload above: shared by create and
// update, every field explicit (null, never omitted) so update() can
// actually clear a field the user emptied out.
function meetingTemplateParentPayload(payload){
  return {
    lm_meetingtemplatename: payload.name || 'Untitled Meeting Setup',
    lm_setuptype: payload.setupType ? MEETING_SETUP_TYPE_KEY[payload.setupType] : null,
    lm_typeclassification: payload.category ? MEETING_CATEGORY_KEY[payload.category] : null,
    lm_stages: payload.stage ? MEETING_STAGE_KEY[payload.stage] : null,
    lm_frequency: payload.frequency ? MEETING_FREQUENCY_KEY[payload.frequency] : null,
    lm_daysoftheweek: payload.dayOfWeek ? MEETING_DAY_OF_WEEK_KEY[payload.dayOfWeek] : null,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : null,
    lm_monthofthequarter: payload.monthInQuarter ? MEETING_MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : null,
    lm_defaultmeetingmode: payload.mode ? MEETING_MODE_KEY[payload.mode] : null,
    lm_meetingconfidentiality: payload.confidentiality ? MEETING_CONFIDENTIALITY_KEY[payload.confidentiality] : null,
    lm_quorumthreshold: typeof payload.quorum === 'number' ? payload.quorum : null,
    lm_torpolicylink: payload.torLink || null,
    lm_meetingstatus: payload.status ? TEMPLATE_STATUS_KEY[payload.status] : null,
    lm_version: typeof payload.version === 'number' ? payload.version : null,
  };
}

/** Same role as createReportTemplateChildren above, for the Meeting side:
 *  creates every child row (per-unit Business Unit/Region rows with their
 *  own Attendees, plus template-level agenda/lines/supportive/linked-report
 *  rows) for an already-existing lm_meetingtemplates row. Mutates `errors`
 *  in place. */
async function createMeetingTemplateChildren(templateId, payload, errors){
  const bind = `/lm_meetingtemplates(${templateId})`;

  // One lm_meetingtemplatebusinessunitses / lm_meetingtemplateregions row
  // per configured unit, each with its own Chairman/Co-Chairman/
  // Facilitator, and its own Attendees list bound back to that specific
  // unit row via lm_MeetingTemplatePerBusinessUnit /
  // lm_MeetingTemplatePerRegion on lm_meetingattendeeslists. Group-level
  // Setups have no dedicated child table yet, skipped with a console note.
  for(const unit of (payload.units||[])){
    let unitBind = null, unitLookupField = null;

    if(payload.stageLevel==='bu' && unit?.businessUnitId){
      try{
        const rowPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_BusinessUnit@odata.bind': `/businessunits(${unit.businessUnitId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.chairmanId)    rowPayload['lm_MeetingChairman@odata.bind'] = `/cr603_organizationstructures(${unit.chairmanId})`;
        if(unit.coChairmanId)  rowPayload['lm_MeetingCoChairman@odata.bind'] = `/cr603_organizationstructures(${unit.coChairmanId})`;
        if(unit.facilitatorId) rowPayload['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${unit.facilitatorId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannels(${unit.channelId})`;
        const created = await Lm_meetingtemplatebusinessunitsesService.create(rowPayload);
        const rowId = created?.data?.lm_meetingtemplatebusinessunitsid;
        if(rowId){ unitBind = `/lm_meetingtemplatebusinessunitses(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerBusinessUnit@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_meetingtemplatebusinessunitses', error:e }); }
    }else if(payload.stageLevel==='region' && unit?.regionId){
      try{
        const rowPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_Region@odata.bind': `/crd04_regionses(${unit.regionId})`,
          lm_name: unit.name || undefined,
        };
        if(unit.chairmanId)    rowPayload['lm_MeetingChairman@odata.bind'] = `/cr603_organizationstructures(${unit.chairmanId})`;
        if(unit.coChairmanId)  rowPayload['lm_MeetingCoChairman@odata.bind'] = `/cr603_organizationstructures(${unit.coChairmanId})`;
        if(unit.facilitatorId) rowPayload['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${unit.facilitatorId})`;
        if(unit.channelId) rowPayload['lm_TeamChannel@odata.bind'] = `/and_teamschannels(${unit.channelId})`;
        const created = await Lm_meetingtemplateregionsService.create(rowPayload);
        const rowId = created?.data?.lm_meetingtemplateregionid;
        if(rowId){ unitBind = `/lm_meetingtemplateregions(${rowId})`; unitLookupField = 'lm_MeetingTemplatePerRegion@odata.bind'; }
      }catch(e){ errors.push({ table:'lm_meetingtemplateregions', error:e }); }
    }else{
      console.warn(`[dataverse] Meeting Template unit "${unit?.name||unit?.key}" at "${payload.stageLevel}" level has no per-unit child table yet -- its Attendees, if any, were not saved.`);
      continue;
    }

    for(const posId of (unit.attendeePositionIds||[])){
      if(!posId) continue;
      try{
        const attPayload = {
          'lm_MeetingTemplate@odata.bind': bind,
          'lm_AttendeePosition@odata.bind': `/cr603_organizationstructures(${posId})`,
          lm_attendeetype: 1, // Core -- these come from each unit's coreMembers list
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
  const [agendaRes, linesRes, supportiveRes, linkedRes, busRes, regionsRes] = await Promise.all([
    Lm_meetingtemplateagendaitemsService.getAll({ filter, select:['lm_meetingtemplateagendaitemid'] }),
    Lm_meetingtemplatedepartmentfunctionsService.getAll({ filter, select:['lm_meetingtemplatedepartmentfunctionid'] }),
    Lm_meetingtemplatesupportivefunctionsesService.getAll({ filter, select:['lm_meetingtemplatesupportivefunctionsid'] }),
    Lm_meetingtemplatelinkedreportsesService.getAll({ filter, select:['lm_meetingtemplatelinkedreportsid'] }),
    Lm_meetingtemplatebusinessunitsesService.getAll({ filter, select:['lm_meetingtemplatebusinessunitsid'] }),
    Lm_meetingtemplateregionsService.getAll({ filter, select:['lm_meetingtemplateregionid'] }),
  ]);
  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];
  const [buAttendees, regionAttendees] = await Promise.all([
    Promise.all(businessUnits.map(bu => Lm_meetingattendeeslistsService.getAll({
      filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_meetingtemplatebusinessunitsid}`,
      select: ['lm_meetingattendeeslistid'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
    Promise.all(regions.map(rg => Lm_meetingattendeeslistsService.getAll({
      filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_meetingtemplateregionid}`,
      select: ['lm_meetingattendeeslistid'],
    }).then(r=>r?.data??[]).catch(()=>[]))),
  ]);
  return {
    agenda: agendaRes?.data ?? [],
    lines: linesRes?.data ?? [],
    supportive: supportiveRes?.data ?? [],
    linkedReports: linkedRes?.data ?? [],
    businessUnits, regions,
    attendees: [...buAttendees.flat(), ...regionAttendees.flat()],
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
 * @param {string} [payload.mode] one of MEETING_MODE_KEY's keys
 * @param {string} [payload.confidentiality] one of MEETING_CONFIDENTIALITY_KEY's keys
 * @param {number} [payload.quorum]
 * @param {string} [payload.torLink]
 * @param {string} [payload.stageLevel] 'bu'|'region'|'group' -- only 'bu' and 'region' currently create per-unit child rows
 * @param {{key:string,name:string,businessUnitId?:string,regionId?:string,chairmanId?:string,coChairmanId?:string,facilitatorId?:string,attendeePositionIds?:string[]}[]} [payload.units] one entry per configured unit, each with its own Attendees list
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
    templateId = created?.data?.lm_meetingtemplateid ?? null;
    if(!templateId) throw new Error('Create succeeded but no id was returned');
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
    await Lm_meetingtemplatesService.update(dvId, meetingTemplateParentPayload(payload));
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
    // Deepest first: an Attendee row points at its Business Unit/Region row.
    await deleteRows(Lm_meetingattendeeslistsService, existing.attendees, 'lm_meetingattendeeslistid', 'lm_meetingattendeeslists', errors);
    await deleteRows(Lm_meetingtemplatebusinessunitsesService, existing.businessUnits, 'lm_meetingtemplatebusinessunitsid', 'lm_meetingtemplatebusinessunitses', errors);
    await deleteRows(Lm_meetingtemplateregionsService, existing.regions, 'lm_meetingtemplateregionid', 'lm_meetingtemplateregions', errors);
    await deleteRows(Lm_meetingtemplateagendaitemsService, existing.agenda, 'lm_meetingtemplateagendaitemid', 'lm_meetingtemplateagendaitems', errors);
    await deleteRows(Lm_meetingtemplatedepartmentfunctionsService, existing.lines, 'lm_meetingtemplatedepartmentfunctionid', 'lm_meetingtemplatedepartmentfunctions', errors);
    await deleteRows(Lm_meetingtemplatesupportivefunctionsesService, existing.supportive, 'lm_meetingtemplatesupportivefunctionsid', 'lm_meetingtemplatesupportivefunctionses', errors);
    await deleteRows(Lm_meetingtemplatelinkedreportsesService, existing.linkedReports, 'lm_meetingtemplatelinkedreportsid', 'lm_meetingtemplatelinkedreportses', errors);
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
    await Lm_report_templatesService.update(dvId, { lm_reportstatus: TEMPLATE_STATUS_KEY[status] ?? null });
    return { id: dvId, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_report_templates', error:e }] };
  }
}

/** Same as updateReportTemplateStatus above, for the Meeting side. */
export async function updateMeetingTemplateStatus(dvId, status){
  try{
    await Lm_meetingtemplatesService.update(dvId, { lm_meetingstatus: TEMPLATE_STATUS_KEY[status] ?? null });
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
    select: ['lm_report_templateid','lm_newcolumn','lm_reporttype','lm_reportcategory','lm_frequency','lm_reportstatus','lm_version','modifiedon','createdon'],
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
    select: ['lm_meetingtemplateid','lm_meetingtemplatename','lm_setuptype','lm_typeclassification','lm_stages','lm_frequency','lm_daysoftheweek','lm_quorumthreshold','lm_torpolicylink','lm_meetingstatus','lm_version','modifiedon','createdon'],
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
      statusCode: r.lm_meetingstatus ?? null,
      version: r.lm_version ?? null,
      businessUnitIds: (buRes?.data ?? []).map(x=>x._lm_businessunit_value).filter(Boolean),
      regionIds: (rgRes?.data ?? []).map(x=>x._lm_region_value).filter(Boolean),
      updated: r.modifiedon || r.createdon || null,
    };
  }));
}

export async function fetchReportTemplateDetail(id){
  const parentRes = await Lm_report_templatesService.get(id, {
    select: ['lm_report_templateid','lm_newcolumn','lm_objective','lm_reporttype','lm_reportcategory',
      'lm_frequency','lm_dayoftheweek','lm_dayofthemonth','lm_monthofthequarter','lm_confidentiality',
      'lm_destinationsharepointlink','lm_reportstatus','lm_version','modifiedon','createdon'],
  });
  const parent = parentRes?.data;
  if(!parent) throw new Error(`Report Template ${id} not found`);

  const filter = `_lm_reporttemplate_value eq ${id}`;
  const [checklistRes, linesRes, kpisRes, procsRes, busRes, regionsRes] = await Promise.all([
    Lm_reporttemplatecontentchecklistsService.getAll({ filter, select:['lm_checklistitemname','lm_checklistitemstep'] }),
    Lm_reporttemplatedepartmentfunctionsService.getAll({ filter, select:['_lm_department_value','_lm_function_value'] }),
    Lm_reporttemplaterelatedkpisesService.getAll({ filter, select:['_lm_relatedkpi_value'] }),
    Lm_reporttemplaterelatedprocessesesService.getAll({ filter, select:['_lm_relatedprocess_value'] }),
    Lm_reporttemplatebusinessunitsesService.getAll({ filter, select:['lm_reporttemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_speciality_value','_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value'] }),
    Lm_reporttemplateregionsService.getAll({ filter, select:['lm_reporttemplateregionid','lm_name','_lm_region_value','_lm_reportspeciality_value','_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value'] }),
  ]);

  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];

  const [buChains, regionChains] = await Promise.all([
    Promise.all(businessUnits.map(bu =>
      Lm_reporttemplatereviewchainsService.getAll({
        filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_reporttemplatebusinessunitsid}`,
        select: ['lm_step','_lm_reviewerposition_value','lm_newcolumn'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
    Promise.all(regions.map(rg =>
      Lm_reporttemplatereviewchainsService.getAll({
        filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_reporttemplateregionid}`,
        select: ['lm_step','_lm_reviewerposition_value','lm_newcolumn'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
  ]);

  return {
    parent,
    checklist: checklistRes?.data ?? [],
    lines: linesRes?.data ?? [],
    kpiIds: (kpisRes?.data ?? []).map(r => r._lm_relatedkpi_value).filter(Boolean),
    processIds: (procsRes?.data ?? []).map(r => r._lm_relatedprocess_value).filter(Boolean),
    businessUnits: businessUnits.map((bu,i) => ({ ...bu, reviewChain: buChains[i] })),
    regions: regions.map((rg,i) => ({ ...rg, reviewChain: regionChains[i] })),
  };
}

export async function fetchMeetingTemplateDetail(id){
  const parentRes = await Lm_meetingtemplatesService.get(id, {
    select: ['lm_meetingtemplateid','lm_meetingtemplatename','lm_setuptype','lm_typeclassification','lm_stages',
      'lm_frequency','lm_daysoftheweek','lm_dayofthemonth','lm_monthofthequarter','lm_defaultmeetingmode',
      'lm_meetingconfidentiality','lm_quorumthreshold','lm_torpolicylink','lm_meetingstatus','lm_version','modifiedon','createdon'],
  });
  const parent = parentRes?.data;
  if(!parent) throw new Error(`Meeting Template ${id} not found`);

  const filter = `_lm_meetingtemplate_value eq ${id}`;
  const [agendaRes, linesRes, supportiveRes, linkedRes, busRes, regionsRes] = await Promise.all([
    Lm_meetingtemplateagendaitemsService.getAll({ filter, select:['lm_agendaitemname','lm_step','lm_agendaitemtype','_lm_agendaitemowner_value'] }),
    Lm_meetingtemplatedepartmentfunctionsService.getAll({ filter, select:['_lm_department_value','_lm_function_value'] }),
    Lm_meetingtemplatesupportivefunctionsesService.getAll({ filter, select:['lm_newcolumn','_lm_function_value'] }),
    Lm_meetingtemplatelinkedreportsesService.getAll({ filter, select:['lm_name','lm_reporttype','_lm_reporttemplate_value'] }),
    Lm_meetingtemplatebusinessunitsesService.getAll({ filter, select:['lm_meetingtemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
    Lm_meetingtemplateregionsService.getAll({ filter, select:['lm_meetingtemplateregionid','lm_name','_lm_region_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value','_lm_teamchannel_value'] }),
  ]);

  const businessUnits = busRes?.data ?? [];
  const regions = regionsRes?.data ?? [];

  const [buAttendees, regionAttendees] = await Promise.all([
    Promise.all(businessUnits.map(bu =>
      Lm_meetingattendeeslistsService.getAll({
        filter: `_lm_meetingtemplateperbusinessunit_value eq ${bu.lm_meetingtemplatebusinessunitsid}`,
        select: ['_lm_attendeeposition_value','lm_attendeetype'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
    Promise.all(regions.map(rg =>
      Lm_meetingattendeeslistsService.getAll({
        filter: `_lm_meetingtemplateperregion_value eq ${rg.lm_meetingtemplateregionid}`,
        select: ['_lm_attendeeposition_value','lm_attendeetype'],
      }).then(r => r?.data ?? []).catch(()=>[])
    )),
  ]);

  return {
    parent,
    agenda: agendaRes?.data ?? [],
    lines: linesRes?.data ?? [],
    supportive: supportiveRes?.data ?? [],
    linkedReports: linkedRes?.data ?? [],
    businessUnits: businessUnits.map((bu,i) => ({ ...bu, attendees: buAttendees[i] })),
    regions: regions.map((rg,i) => ({ ...rg, attendees: regionAttendees[i] })),
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

import { Lm_meetingoccurrencesService } from '../generated/services/Lm_meetingoccurrencesService';
import { Lm_meetingoccurrenceagendasService } from '../generated/services/Lm_meetingoccurrenceagendasService';
import { Lm_meetingoccurrenceattendeesesService } from '../generated/services/Lm_meetingoccurrenceattendeesesService';
import { Lm_reportoccurrencesService } from '../generated/services/Lm_reportoccurrencesService';

export const MEETING_OCC_STATUS = { 1:'Scheduled', 2:'Held', 3:'Cancelled' };
export const MEETING_OCC_STATUS_KEY = { 'Scheduled':1, 'Held':2, 'Cancelled':3 };
// The app says "In person / Online / Hybrid"; Dataverse says "Physical / Online / Hybrid".
export const MEETING_OCC_MODE = { 1:'In person', 2:'Online', 3:'Hybrid' };
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
export const REPORT_TYPE = { 1:'Plan', 2:'Report', 3:'Conclusion' };
export const REPORT_CATEGORY = {
  1:'Outcome Executive', 2:'Process Executive', 3:'Core Process', 4:'Custom Content',
};
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

/** A Dataverse DateTime comes back as a full ISO string; the app works in
 *  plain 'YYYY-MM-DD' dates throughout, so trim rather than re-parse (which
 *  would shift the day across time zones). */
const isoDay = v => (typeof v === 'string' && v.length >= 10) ? v.slice(0,10) : null;

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
               'lm_meetingstage',
               '_lm_meetingtemplate_value','_lm_businessunit_value','_lm_chairmanposition_value',
               '_lm_region_value','_lm_department_value','_lm_facilitatorposition_value',
               '_lm_rescheduledfrom_value','modifiedon','createdon'],
    }),
    Lm_meetingoccurrenceagendasService.getAll({
      select: ['lm_meetingoccurrenceagendaid','lm_title','lm_sequence','lm_source','lm_covered',
               '_lm_meetingoccurrence_value','_lm_ownerposition_value','_lm_carriedfromagendaitem_value'],
    }).catch(e=>{ console.warn('[dataverse] occurrence agenda fetch failed:', e); return null; }),
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
      status: MEETING_OCC_STATUS[o.lm_meetingstatus] || null,
      location: o.lm_meetinglocation || null,
      link: o.lm_meetinglink || null,
      adhocType: o.lm_adhoctype || null,
      restricted: !!o.lm_restricted,
      agendaSent: isoDay(o.lm_agendasentdate),
      inviteSent: isoDay(o.lm_invitesentdate),
      cancelReason: o.lm_cancelreason || null,
      sync: MEETING_OCC_SYNC[o.lm_syncstatus] || null,
      stage: MEETING_OCC_STAGE[o.lm_meetingstage] || null,
      templateId: o._lm_meetingtemplate_value || null,
      businessUnitId: o._lm_businessunit_value || null,
      regionId: o._lm_region_value || null,
      departmentId: o._lm_department_value || null,
      chairPositionId: o._lm_chairmanposition_value || null,
      facilitatorPositionId: o._lm_facilitatorposition_value || null,
      rescheduledFromId: o._lm_rescheduledfrom_value || null,
      updated: o.modifiedon || o.createdon || null,
      agenda: (agendaBy.get(id) || [])
        .slice().sort((a,b)=>(a.lm_sequence||0)-(b.lm_sequence||0))
        .map(a=>({ id:a.lm_meetingoccurrenceagendaid, title:a.lm_title||'', seq:a.lm_sequence??null,
                   source:a.lm_source||null, covered:AGENDA_COVERED[a.lm_covered]||null,
                   ownerPositionId:a._lm_ownerposition_value||null,
                   carriedFromId:a._lm_carriedfromagendaitem_value||null })),
      attendees: (attBy.get(id) || [])
        .map(a=>({ id:a.lm_meetingoccurrenceattendeesid, name:a.lm_name||null,
                   present:ATTENDEE_PRESENT[a.lm_present]||null,
                   type:ATTENDEE_TYPE[a.lm_type]||null,
                   positionId:a._lm_attendeeposition_value||null,
                   delegatePositionId:a._lm_delegateposition_value||null })),
    };
  });
}

/** Every Report Occurrence. One request -- this table has no child tables the
 *  calendar needs (its history lives in lm_reportoccurrencehistories). */
export async function fetchReportOccurrences(){
  const res = await Lm_reportoccurrencesService.getAll({
    select: ['lm_reportoccurrenceid','lm_name','lm_period','lm_status','lm_version','lm_reviewstep',
             'lm_fileurl','lm_reportobjective','lm_locked','lm_nosetupflag','lm_reportstage',
             '_lm_reporttemplate_value','_lm_businessunit_value','_lm_department_value','_lm_region_value',
             '_lm_creatorposition_value','modifiedon','createdon'],
  });
  return (res?.data ?? []).map(r => ({
    id: r.lm_reportoccurrenceid,
    name: r.lm_name || '(untitled report)',
    period: isoDay(r.lm_period),
    status: REPORT_OCC_STATUS[r.lm_status] || null,
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
    creatorPositionId: r._lm_creatorposition_value || null,
    updated: r.modifiedon || r.createdon || null,
  }));
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
    status: MEETING_OCC_STATUS[o.lm_meetingstatus] || null,
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
    status: REPORT_OCC_STATUS[r.lm_status] || null,
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
 * @param {string} [payload.mode] 'In person'|'Online'|'Hybrid'
 * @param {string} [payload.status] defaults to 'Scheduled'
 * @param {string} [payload.location]
 * @param {string} [payload.link]
 * @param {string} [payload.adhocType]
 * @param {boolean} [payload.restricted]
 * @param {string} [payload.inviteSent] 'YYYY-MM-DD'
 * @param {string} [payload.rescheduledFromId]
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
  if(payload.templateId)        parent['lm_MeetingTemplate@odata.bind']   = `/lm_meetingtemplates(${payload.templateId})`;
  if(payload.businessUnitId)    parent['lm_BusinessUnit@odata.bind']      = `/businessunits(${payload.businessUnitId})`;
  if(payload.regionId)          parent['lm_Region@odata.bind']            = `/crd04_regionses(${payload.regionId})`;
  if(payload.departmentId)      parent['lm_Department@odata.bind']        = `/cr603_chklst_departmentses(${payload.departmentId})`;
  if(payload.chairPositionId)   parent['lm_ChairmanPosition@odata.bind']  = `/cr603_organizationstructures(${payload.chairPositionId})`;
  if(payload.facilitatorPositionId) parent['lm_FacilitatorPosition@odata.bind'] = `/cr603_organizationstructures(${payload.facilitatorPositionId})`;
  if(payload.rescheduledFromId) parent['lm_RescheduledFrom@odata.bind']   = `/lm_meetingoccurrences(${payload.rescheduledFromId})`;

  let occId = null;
  try{
    const created = await Lm_meetingoccurrencesService.create(parent);
    occId = created?.data?.lm_meetingoccurrenceid ?? null;
    if(!occId) throw new Error('Create succeeded but no id was returned');
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
      if(item.carriedFromId)   row['lm_CarriedFromAgendaItem@odata.bind'] = `/lm_meetingtemplateagendaitems(${item.carriedFromId})`;
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
export async function createReportOccurrence(payload){
  const row = {
    lm_name: payload.name || 'Untitled Report',
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
  if(payload.creatorPositionId) row['lm_CreatorPosition@odata.bind']  = `/cr603_organizationstructures(${payload.creatorPositionId})`;

  try{
    const created = await Lm_reportoccurrencesService.create(row);
    const id = created?.data?.lm_reportoccurrenceid ?? null;
    if(!id) throw new Error('Create succeeded but no id was returned');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
  }
}
