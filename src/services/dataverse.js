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
    select: ['strategy_kpisid', 'strategy_newcolumn'],
  });
  const rows = res?.data ?? [];
  // {id, name} -- the id is needed to write lm_RelatedKPI@odata.bind when
  // saving a Report Template; GovernanceApp derives the flat name list the
  // existing Checks/LIST_DEFS UI expects from this same fetch.
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({ id: r.strategy_kpisid, name: r.strategy_newcolumn }));
}

export async function fetchProcesses(){
  const res = await Strategy_processesService.getAll({
    // same strategy_newcolumn caveat as fetchKpis above.
    select: ['strategy_processid', 'strategy_newcolumn'],
  });
  const rows = res?.data ?? [];
  return rows.filter(r=>r.strategy_newcolumn).map(r => ({ id: r.strategy_processid, name: r.strategy_newcolumn }));
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
 *  assignment. cr603_positionname is the underlying Position's title;
 *  falls back to this row's own name if that's not populated for some
 *  reason. hr_fullnameofcurrentemployee is who currently holds it -- the
 *  same role POSITIONS' mock `holder` field played. */
/** Positions -- table cr603_organizationstructures ("Organization Structure").
 *  Each row is a concrete Position assignment (Position + Business Unit +
 *  Department + Function + the employee currently holding it), not a bare
 *  Position record, so this is used as-is: one selectable row per real
 *  assignment.
 *
 *  cr603_positionname / hr_fullnameofcurrentemployee were dropped from the
 *  select -- both are synthetic lookup-display fields, not real columns,
 *  and Dataverse rejects selecting them directly (that 400 was almost
 *  certainly why this silently fell back to mock data before: the whole
 *  getAll() call was throwing, caught, and swallowed as "use built-in
 *  list"). cr603_name is the table's real, required primary-name column,
 *  used as the display name instead. _cr603_businessunit_value is real
 *  and selectable, and is what the Region/Business Unit filtering below
 *  depends on -- holder is left null for now since there's no safe way to
 *  get a readable employee name without an extra Users/Contacts fetch. */
export async function fetchPositions(){
  const res = await Cr603_organizationstructuresService.getAll({
    select: ['cr603_organizationstructureid', 'cr603_name', '_cr603_businessunit_value'],
  });
  const rows = res?.data ?? [];
  return rows.map(r => ({
    id: r.cr603_organizationstructureid,
    name: r.cr603_name,
    bu: r._cr603_businessunit_value ?? null,
    holder: null,
  }));
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
// NOTE: the app's REPORT_CATEGORIES ('Outcome Executive', 'Process
// Executive', 'Core Process', 'Custom Content') don't correspond to
// Dataverse's lm_reportcategory options ('Execution ', 'Core', 'ADHOC') --
// four labels against three, with no obvious pairing. Left unmapped
// (lm_reportcategory won't be set) until you confirm which app category
// maps to which Dataverse option.

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
 * @param {string} [payload.frequency] one of FREQUENCY_KEY's keys
 * @param {string} [payload.dayOfWeek] one of DAY_OF_WEEK_KEY's keys
 * @param {number} [payload.dayOfMonth]
 * @param {string} [payload.monthInQuarter] one of MONTH_IN_QUARTER_KEY's keys
 * @param {string} [payload.confidentiality] one of CONFIDENTIALITY_KEY's keys
 * @param {string} [payload.destinationLink]
 * @param {string} [payload.businessUnitId] real businessunit id, from the first configured unit
 * @param {string} [payload.specialityId] real cr301_specialtyksa_service_hubs id, from the first unit
 * @param {{text:string}[]} [payload.checklist]
 * @param {{departmentId:string, functionId?:string}[]} [payload.lines]
 * @param {string[]} [payload.kpiIds]
 * @param {string[]} [payload.processIds]
 * @param {{step:number, positionName:string}[]} [payload.reviewChain] from the first unit only
 * @returns {Promise<{id:string|null, errors:{table:string,error:any}[]}>}
 */
export async function saveReportTemplateToDataverse(payload){
  const errors = [];

  const parentPayload = {
    lm_newcolumn: payload.name || payload.objective || 'Untitled Report Template',
    lm_objective: payload.objective || undefined,
    lm_reporttype: payload.reportType ? REPORT_TYPE_KEY[payload.reportType] : undefined,
    lm_frequency: payload.frequency ? FREQUENCY_KEY[payload.frequency] : undefined,
    lm_dayoftheweek: payload.dayOfWeek ? DAY_OF_WEEK_KEY[payload.dayOfWeek] : undefined,
    lm_dayofthemonth: typeof payload.dayOfMonth === 'number' ? payload.dayOfMonth : undefined,
    lm_monthofthequarter: payload.monthInQuarter ? MONTH_IN_QUARTER_KEY[payload.monthInQuarter] : undefined,
    lm_confidentiality: payload.confidentiality ? CONFIDENTIALITY_KEY[payload.confidentiality] : undefined,
    lm_destinationsharepointlink: payload.destinationLink || undefined,
  };
  if(payload.businessUnitId){
    parentPayload['lm_BusinessUnit@odata.bind'] = `/businessunits(${payload.businessUnitId})`;
  }
  if(payload.specialityId){
    parentPayload['lm_Speciality@odata.bind'] = `/cr301_specialtyksa_service_hubs(${payload.specialityId})`;
  }
  // lm_OwnerUser / lm_SubmittingUser / lm_TeamChannel intentionally omitted -- see header note.

  let templateId = null;
  try{
    const created = await Lm_report_templatesService.create(parentPayload);
    templateId = created?.data?.lm_report_templateid ?? null;
    if(!templateId) throw new Error('Create succeeded but no id was returned');
  }catch(e){
    errors.push({ table:'lm_report_templates', error:e });
    return { id:null, errors }; // nothing else can be linked without a parent id
  }

  const bind = `/lm_report_templates(${templateId})`;

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

  for(const step of (payload.reviewChain||[])){
    try{
      await Lm_reporttemplatereviewchainsService.create({
        'lm_ReportTemplate@odata.bind': bind,
        lm_step: step.step,
        lm_newcolumn: step.positionName || '',
      });
    }catch(e){ errors.push({ table:'lm_reporttemplatereviewchains', error:e }); }
  }

  return { id: templateId, errors };
}