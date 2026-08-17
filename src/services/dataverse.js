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
   Departments: no direct Business Unit lookup column exists on
   cr603_chklst_departmentses, but every Dataverse row carries the
   standard ownership field "owningbusinessunit" -- and since the
   Business Units above already come from Dataverse's own standard
   `businessunit` table (not a custom one), _owningbusinessunit_value
   here resolves to the exact same ids fetchBusinessUnits() returns.
   That's what's used below as the `bu` relationship the app's cascade
   (sectionsFor, the Department list's parent filter) already expects.
   If Departments in this environment aren't actually organized by their
   owning business unit, tell me the real relationship column and this
   is a one-line fix.

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
    bu: r._owningbusinessunit_value ?? null,
  }));
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

/** Primary source for Position holder names -- table hr_employees.
 *  Each Employee row has a REQUIRED lookup back to the Position it
 *  currently holds (cr603_OrganizationStructure), so this is a direct,
 *  reliable reverse-join: fetch every Employee once, key the result by
 *  the Position id they point back to. Uses hr_firstname + hr_lastname
 *  (both required, guaranteed-real columns) rather than hr_fullname,
 *  which -- like the lookup-display fields that broke fetchPositions()
 *  before -- may be a synthetic/calculated field Dataverse won't accept
 *  in a plain $select. */
async function fetchEmployeeNameByPosition(){
  try{
    const res = await Hr_employeesService.getAll({
      select: ['_cr603_organizationstructure_value', 'hr_firstname', 'hr_lastname'],
    });
    const rows = res?.data ?? [];
    const map = {};
    rows.forEach(e => {
      const posId = e._cr603_organizationstructure_value;
      if(!posId) return;
      const name = [e.hr_firstname, e.hr_lastname].filter(Boolean).join(' ');
      if(name) map[posId] = name;
    });
    return map;
  }catch(e){
    console.warn('[dataverse] fetchEmployeeNameByPosition() failed -- falling back to systemusers:', e);
    return {};
  }
}

export async function fetchPositions(){
  const [posRes, employeeMap, userMap] = await Promise.all([
    Cr603_organizationstructuresService.getAll({
      select: [
        'cr603_organizationstructureid', 'cr603_name', '_cr603_businessunit_value',
        '_cr18c_departments_lkp_value', '_hr_funtion_value', '_hr_currentemployee_value',
      ],
    }),
    fetchEmployeeNameByPosition(),
    fetchUserNameMap(),
  ]);
  const rows = posRes?.data ?? [];
  return rows.map(r => {
    const posId = r.cr603_organizationstructureid;
    const holder = employeeMap[posId]
      || (r._hr_currentemployee_value && userMap[r._hr_currentemployee_value])
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

/* ---- reference data reads (not wired yet) --------------------------------
   No generated service for these yet. Channels (and_teamschannels) is
   connected but held off per your call -- it has no Team lookup column,
   only the generic Dataverse "owning team" field, which isn't necessarily
   the same relationship. Wire it once the real Team link is available. */

function notWiredYet(name){
  throw new Error(
    `[dataverse] ${name}() is not wired to a real table yet. `+
    `Run "pac code add-data-source" for the relevant table, then `+
    `fill in this function in src/services/dataverse.js.`
  );
}

export async function fetchTeams(){ return notWiredYet('fetchTeams'); }
export async function fetchChannels(){ return notWiredYet('fetchChannels'); }
export async function fetchSetups(){ return notWiredYet('fetchSetups'); }

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
        // lm_TeamChannel intentionally omitted -- Channels isn't wired (no Team relationship yet).
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
        // lm_TeamChannel intentionally omitted -- Channels isn't wired (no Team relationship yet).
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
    select: ['lm_meetingtemplateid','lm_meetingtemplatename','lm_setuptype','lm_typeclassification','lm_stages','lm_frequency','lm_meetingstatus','lm_version','modifiedon','createdon'],
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
    Lm_reporttemplatebusinessunitsesService.getAll({ filter, select:['lm_reporttemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_speciality_value','_lm_ownerposition_value','_lm_submittingposition_value'] }),
    Lm_reporttemplateregionsService.getAll({ filter, select:['lm_reporttemplateregionid','lm_name','_lm_region_value','_lm_reportspeciality_value','_lm_ownerposition_value','_lm_submittingposition_value'] }),
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
    Lm_meetingtemplatebusinessunitsesService.getAll({ filter, select:['lm_meetingtemplatebusinessunitsid','lm_name','_lm_businessunit_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value'] }),
    Lm_meetingtemplateregionsService.getAll({ filter, select:['lm_meetingtemplateregionid','lm_name','_lm_region_value','_lm_meetingchairman_value','_lm_meetingcochairman_value','_lm_meetingorganizerfacilitator_value'] }),
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