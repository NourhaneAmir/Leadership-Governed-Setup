/* =========================================================================
   Dataverse service wrapper — Governance Setup
   ========================================================================= *
   Target environment : https://org319b4ea9.crm4.dynamics.com/
   Target solution     : LeadershipPractice  (publisher prefix: lp)

   STATUS: connection not yet wired to any table. Governance Setup still
   runs entirely on its sessionStorage-backed mock data (loadDb/saveDb in
   GovernanceApp.jsx) -- nothing in this file is imported or called yet.

   HOW TO ACTIVATE, once a table is chosen:

   1) Add the data source (repeat per table):
        pac connection list
        pac code add-data-source -a shared_commondataserviceforapps \
          -c "<connection-id>" -e <environment-id-for-org319b4ea9> \
          -t lp_<tablename>

      This writes typed CRUD functions under ./generated/ -- the exact
      function/file names depend on your PAC CLI version and the table's
      logical/display names, so check that folder after running the
      command rather than guessing them here.

   2) Import the generated functions at the top of this file, e.g.:
        import { retrieveMultipleLp_positions } from '../../generated/services/Lp_positionService';

   3) Fill in the matching export below (replace the mock array with a
      real call) and remove that field from GovernanceApp.jsx's seed()/
      mock data so there's a single source of truth.

   Each export here intentionally mirrors a piece of Governance Setup's
   current mock reference data (POSITIONS, TEAMS, REGIONS, ...) so wiring
   one in is a like-for-like swap, not a redesign of GovernanceApp.jsx.
   ========================================================================= */

export const DATAVERSE_CONFIG = {
  environmentUrl: 'https://org319b4ea9.crm4.dynamics.com/',
  solutionName: 'LeadershipPractice',
  publisherPrefix: 'lp',
};

/* ---------------------------------------------------------------------
   WIRED: Regions (crd04_regions) and Business Units (businessunit)
   ---------------------------------------------------------------------
   Run these once locally (see README) to generate the service files:
     pac code add-data-source -a dataverse -t businessunit
     pac code add-data-source -a dataverse -t crd04_regions

   The two imports below use Dataverse's standard pluralization pattern
   for the generated file names. If either import fails to resolve after
   you run the commands above, check the actual file names created under
   src/generated/services/ (Dataverse's auto-pluralization is not always
   predictable for custom tables) and update the two import lines to match
   -- everything else in this file is already correct once they resolve. */
import { BusinessunitsService } from '../generated/services/BusinessunitsService';
import { Crd04regionsService } from '../generated/services/Crd04regionsService';

/** Regions -- table crd04_regions. Primary key is the Dataverse-standard
 *  crd04_regionsid; crd04_id holds the display name per your schema. */
export async function fetchRegions(){
  const res = await Crd04regionsService.getAll({
    select: ['crd04_regionsid', 'crd04_id'],
  });
  const rows = res?.data?.value ?? [];
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
  const rows = res?.data?.value ?? [];
  return rows.map(r => ({
    id: r.businessunitid,
    name: r.name,
    region: r._cr603_region_value ?? null, // matches a Region's id above
  }));
}

/* ---- reference data reads (not wired yet) --------------------------------
   Add one function per Dataverse table as it's connected. Until then each
   throws clearly if called by mistake, instead of failing silently. */

function notWiredYet(name){
  throw new Error(
    `[dataverse] ${name}() is not wired to a real table yet. `+
    `Run "pac code add-data-source" for the relevant lp_ table, then `+
    `fill in this function in src/services/dataverse.js.`
  );
}

export async function fetchPositions(){ return notWiredYet('fetchPositions'); }
export async function fetchTeams(){ return notWiredYet('fetchTeams'); }
export async function fetchChannels(){ return notWiredYet('fetchChannels'); }
export async function fetchDepartments(){ return notWiredYet('fetchDepartments'); }
export async function fetchFunctions(){ return notWiredYet('fetchFunctions'); }
export async function fetchProcesses(){ return notWiredYet('fetchProcesses'); }
export async function fetchKpis(){ return notWiredYet('fetchKpis'); }
export async function fetchSetups(){ return notWiredYet('fetchSetups'); }