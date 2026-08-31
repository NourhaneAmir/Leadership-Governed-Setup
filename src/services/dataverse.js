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
    lm_frequency: payload.frequency ? FREQUENCY_KEY[payload.frequency] : null,
    lm_dayoftheweek: payload.dayOfWeek ? DAY_OF_WEEK_KEY[payload.dayOfWeek] : null,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : null,
    lm_monthofthequarter: payload.monthInQuarter ? MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : null,
    lm_confidentiality: payload.confidentiality ? CONFIDENTIALITY_KEY[payload.confidentiality] : null,
    lm_destinationsharepointlink: payload.destinationLink || null,
    lm_reportstatus: payload.status ? TEMPLATE_STATUS_KEY[payload.status] : null,
    lm_version: typeof payload.version === 'number' ? payload.version : null,
  };
  if(groupUnit?.ownerPositionId)      row['lm_OwnerPosition@odata.bind']      = `/cr603_organizationstructures(${groupUnit.ownerPositionId})`;
  if(groupUnit?.submittingPositionId) row['lm_SubmittingPosition@odata.bind'] = `/cr603_organizationstructures(${groupUnit.submittingPositionId})`;
  if(groupUnit?.channelId)            row['lm_TeamChannel@odata.bind']        = `/and_teamschannels(${groupUnit.channelId})`;
  if(groupUnit?.specialityId)         row['lm_ReportSpecialty@odata.bind']    = `/cr301_specialtyksa_service_hubs(${groupUnit.specialityId})`;
  return row;
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
  if(groupUnit?.chairmanId)    row['lm_MeetingChairman@odata.bind']            = `/cr603_organizationstructures(${groupUnit.chairmanId})`;
  if(groupUnit?.coChairmanId)  row['lm_MeetingCoChairman@odata.bind']          = `/cr603_organizationstructures(${groupUnit.coChairmanId})`;
  if(groupUnit?.facilitatorId) row['lm_MeetingOrganizerFacilitator@odata.bind'] = `/cr603_organizationstructures(${groupUnit.facilitatorId})`;
  return row;
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
      'lm_destinationsharepointlink','lm_reportstatus','lm_version','modifiedon','createdon',
      // Group-wide (Stage 3/4) Owner/Submitting Position, Team Channel and
      // Speciality -- see reportTemplateParentPayload()'s comment for why
      // these live here instead of on a per-unit child row.
      '_lm_ownerposition_value','_lm_submittingposition_value','_lm_teamchannel_value','_lm_reportspecialty_value'],
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
      'lm_meetingconfidentiality','lm_quorumthreshold','lm_torpolicylink','lm_meetingstatus','lm_version','modifiedon','createdon',
      // Group-wide (Stage 3/4) Chairman/Co-Chairman/Facilitator -- see
      // meetingTemplateParentPayload()'s comment for why these live here
      // instead of on a per-unit child row.
      '_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value'],
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
import { Lm_meetingminutesesService } from '../generated/services/Lm_meetingminutesesService';
import { Lm_momnotesesService } from '../generated/services/Lm_momnotesesService';
import { Lm_auditgridinstancesService } from '../generated/services/Lm_auditgridinstancesService';
import { Lm_auditgridanswersService } from '../generated/services/Lm_auditgridanswersService';
import { Lm_approvalcyclesService } from '../generated/services/Lm_approvalcyclesService';
import { Lm_approvalcyclestepsService } from '../generated/services/Lm_approvalcyclestepsService';
import { Lm_authoritymatrixrowsService } from '../generated/services/Lm_authoritymatrixrowsService';
import { Lm_reportoccurrencehistoriesService } from '../generated/services/Lm_reportoccurrencehistoriesService';
import { Wlog_decisionsService } from '../generated/services/Wlog_decisionsService';

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
      filter: 'statecode eq 0',
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
    const id = idOrThrow(created, 'lm_reportoccurrenceid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'lm_reportoccurrences', error:e }] };
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
export const GRID_STATE      = { 1:'Pending Facilitator Review', 2:'Submitted for Approval',
                                 3:'Approved', 4:'Returned for Revision', 5:'Void' };
export const GRID_STATE_KEY  = { 'Pending Facilitator Review':1, 'Submitted for Approval':2,
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
export const GRID_EVIDENCE_MAX = 100;   // lm_auditgridanswers.lm_evidence   (still narrow)
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
const NOTE_SELECT = ['lm_momnotesid','lm_name','lm_notes','_lm_meetingminutes_value','_lm_agendaitem_value'];

/* One Minutes row plus the Notes belonging to it, in the shape the Minutes tab
   and the scoring engine already expect. `notes` carries the row ids an edit
   needs; `notesByAgenda` is the plain {agendaItemId: text} map the Audit Grid's
   AG-06 reads. Both are returned because they serve different callers. */
function shapeMinutes(m, noteRows){
  const notes = (noteRows || []).map(n => ({
    id: n.lm_momnotesid,
    agendaItemId: n._lm_agendaitem_value || null,
    text: n.lm_notes || '',
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
  return (momRes?.data ?? []).map(m => shapeMinutes(m, notesBy.get(m.lm_meetingminutesid)));
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
  return shapeMinutes(m, noteRes?.data);
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
export async function createMeetingOccurrenceAgendaItem(occurrenceId, { title, sequence, ownerPositionId }){
  try{
    const row = {
      'lm_MeetingOccurrence@odata.bind': `/lm_meetingoccurrences(${occurrenceId})`,
      lm_title: (title||'').trim(),
      lm_sequence: sequence,
      lm_source: 'Ad Hoc',
      lm_covered: AGENDA_COVERED_KEY['Not Yet Recorded'],
    };
    if(ownerPositionId) row['lm_OwnerPosition@odata.bind'] = `/cr603_organizationstructures(${ownerPositionId})`;
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
    answers, manual, evidence,
  };
}

/** Every Audit Grid Instance with its Answers attached. */
export async function fetchAuditGridInstances(){
  const [gridRes, ansRes] = await Promise.all([
    Lm_auditgridinstancesService.getAll({ select: GRID_SELECT }),
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
  const res = await Lm_auditgridinstancesService.getAll({
    filter: `_lm_meetingoccurrence_value eq ${occurrenceId}`,
    select: GRID_SELECT,
  });
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
      lm_state: GRID_STATE_KEY['Pending Facilitator Review'],
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

const HISTORY_SELECT = ['lm_reportoccurrencehistoryid','lm_name','lm_action','lm_note',
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
      lm_name: action.slice(0,100),
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
   from the `_xxx_label` sibling fields the connector returns -- not a
   hand-maintained numeric map like MEETING_OCC_STATUS above. The numeric
   values behind each label were never surfaced by the CLI/schema without
   an extra live metadata call, and the label is all display needs;
   createWorkLogDecision() below leaves status unset on create for the
   same reason, so Dataverse's own option-set default applies. */
export async function fetchWorkLogDecisions(){
  const res = await Wlog_decisionsService.getAll({
    filter: 'statecode eq 0',
    select: ['wlog_decisionid','wlog_name','wlog_decisiontaken','wlog_expectedoutput',
             'wlog_managernote','wlog_evidenceurl','wlog_decisionstatus','_wlog_decisionstatus_label',
             'wlog_reviewstatus','_wlog_reviewstatus_label','wlog_reviewedon',
             'wlog_escalatedon','wlog_escalationreason','wlog_escalationreply',
             'wlog_escalationresolvedon','wlog_escalationresult','_wlog_escalationresult_label',
             'createdon','modifiedon'],
  });
  return (res?.data ?? []).map(d => ({
    id: d.wlog_decisionid,
    name: d.wlog_name || '(untitled decision)',
    decisionTaken: d.wlog_decisiontaken || null,
    expectedOutput: d.wlog_expectedoutput || null,
    managerNote: d.wlog_managernote || null,
    evidenceUrl: d.wlog_evidenceurl || null,
    status: d._wlog_decisionstatus_label || null,
    reviewStatus: d._wlog_reviewstatus_label || null,
    reviewedOn: isoDay(d.wlog_reviewedon),
    escalatedOn: isoDay(d.wlog_escalatedon),
    escalationReason: d.wlog_escalationreason || null,
    escalationReply: d.wlog_escalationreply || null,
    escalationResolvedOn: isoDay(d.wlog_escalationresolvedon),
    escalationResult: d._wlog_escalationresult_label || null,
    created: d.createdon || null,
    updated: d.modifiedon || d.createdon || null,
  })).sort((a,b)=> (b.created||'').localeCompare(a.created||''));
}

/** Logs a new Work Log Decision. See the section note above for why there's
 *  no Meeting/Report link and no status on create yet. */
export async function createWorkLogDecision({ name, decisionTaken, expectedOutput, managerNote, evidenceUrl } = {}){
  try{
    const created = await Wlog_decisionsService.create({
      wlog_name: (name||'').trim().slice(0,100) || undefined,
      wlog_decisiontaken: decisionTaken ? decisionTaken.slice(0,4000) : undefined,
      wlog_expectedoutput: expectedOutput ? expectedOutput.slice(0,1000) : undefined,
      wlog_managernote: managerNote ? managerNote.slice(0,2000) : undefined,
      wlog_evidenceurl: evidenceUrl ? evidenceUrl.slice(0,500) : undefined,
    });
    const id = idOrThrow(created, 'wlog_decisionid');
    return { id, errors: [] };
  }catch(e){
    return { id: null, errors: [{ table:'wlog_decisions', error:e }] };
  }
}
