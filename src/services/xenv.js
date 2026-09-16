/* =========================================================================
   Cross-environment Dataverse access.

   WHY THIS EXISTS
   A Code App's generated per-table services (Lm_meetingtemplatesService and
   the 41 others) always read and write the environment the app is DEPLOYED
   to. Nothing changes that -- not a different connection id, not a --org-url
   flag, not switching pac auth profiles. So an app hosted anywhere other than
   DT New cannot reach DT New's data through them.

   The Dataverse connector (shared_commondataserviceforapps, added WITHOUT a
   --table flag) generates one shared service whose operations take the target
   environment as an explicit argument. This module wraps those operations in
   the SAME five-method shape the per-table services expose, so call sites in
   dataverse.js need no changes:

       import { Lm_setupactivitiesService } from '@generated/...'   // before
       const  Lm_setupactivitiesService = dvTable('lm_setupactivities')  // after

   Source: "Writing to Dataverse Tables in a Different Environment from a
   Power Apps Code App" (Digital Transformation developer reference).
   Signatures below were read from the generated file, not from the guide --
   two of them differ from it, see the notes on delete and create.
   ========================================================================= */
import { MicrosoftDataverseService as DV } from '@generated/services/MicrosoftDataverseService';

/* -------------------------------------------------------------------------
   The environment the DATA lives in. Not necessarily the one the app runs in.

   Point this at DT New and the apps keep reading the same data whether they
   are hosted in DT New, Amr Space, or anywhere else. Set it to the app's own
   environment and behaviour is identical to the old per-table services.
   ------------------------------------------------------------------------- */
export const DATA_ORG = 'https://org319b4ea9.crm4.dynamics.com';

/* The connector wants the table's ENTITY SET (plural) name, e.g.
   `lm_setupactivities`, not the logical name `lm_setupactivity`. Both are in
   power.config.json under databaseReferences -- entitySetName is the one. */

const PREFER_REPRESENTATION = 'return=representation';
const JSON_ACCEPT = 'application/json';

/* Dataverse caps a response at 5000 rows whatever $top says. Asking for the
   cap explicitly is what makes @odata.nextLink appear; setting $top instead
   suppresses it, and the loop below then silently stops after one page. */
const PREFER_PAGED =
  'odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=5000';

/* Every operation returns IOperationResult: { success, data, error }. The
   per-table services throw nothing on a Dataverse rejection either -- see
   PROJECT-CONTEXT section 6, "Every create()/update() must be checked" -- so
   the shape is preserved rather than converted to exceptions here, and
   dataverse.js's existing idOrThrow()/assertSuccess() keep working. */
const fail = (op, table, error) => ({
  success: false,
  data: undefined,
  error: error ?? new Error(`${op} failed on ${table} in ${DATA_ORG}`),
});

/* The connector's @odata.nextLink is NOT a plain Dataverse URL: it points at
   the connector's own invoke endpoint with the real continuation query
   URL-encoded inside a `next` parameter. Reading $skiptoken off the outer
   query returns null every time, which ends the loop after page 1 with no
   error at all -- the failure looks exactly like "the table only has 5000
   rows". */
function skipTokenFrom(nextLink) {
  if (!nextLink) return undefined;
  let inner;
  try {
    inner = new URL(nextLink).searchParams.get('next');
  } catch {
    return undefined;
  }
  const q = inner ? inner.indexOf('?') : -1;
  if (q === -1) return undefined;
  return new URLSearchParams(inner.substring(q + 1)).get('$skiptoken') ?? undefined;
}

/* An options object from dataverse.js looks like { select:[...], filter, orderBy,
   top, expand } -- the same shape IGetAllOptions used. */
const selectOf = o => (Array.isArray(o?.select) ? o.select.join(',') : o?.select) || undefined;

/**
 * One table in the DATA_ORG environment, exposing the same five methods the
 * generated per-table services do.
 * @param {string} entitySet the table's plural entity set name
 */
export function dvTable(entitySet) {
  return {
    /** Every matching row, following pagination to the end. */
    async getAll(options) {
      const rows = [];
      let skiptoken;
      /* A cap on iterations rather than `while (true)`: a malformed nextLink
         that never changes would otherwise spin forever against Dataverse. */
      for (let page = 0; page < 200; page++) {
        const res = await DV.ListRecordsWithOrganization(
          DATA_ORG,                    // organization -- FIRST here, unlike create/update
          entitySet,                   // entityName
          PREFER_PAGED,                // prefer
          JSON_ACCEPT,                 // accept
          undefined,                   // x_ms_odata_metadata_full
          undefined,                   // MSCRM_IncludeMipSensitivityLabel
          selectOf(options),           // $select
          options?.filter,             // $filter
          options?.orderBy,            // $orderby
          options?.expand,             // $expand
          undefined,                   // fetchXml
          undefined,                   // $top -- deliberately unset, see PREFER_PAGED
          skiptoken,                   // $skiptoken
          undefined                    // partitionId
        );
        if (!res?.success) return fail('getAll', entitySet, res?.error);

        const body = res.data || {};
        if (Array.isArray(body.value)) rows.push(...body.value);

        skiptoken = skipTokenFrom(body['@odata.nextLink']);
        if (!skiptoken) break;
      }
      return { success: true, data: rows, error: undefined };
    },

    /** One row by id. */
    async get(id, options) {
      const res = await DV.GetItemWithOrganization(
        PREFER_REPRESENTATION, JSON_ACCEPT, DATA_ORG, entitySet, id,
        undefined, undefined, selectOf(options), options?.expand, undefined
      );
      return res?.success
        ? { success: true, data: res.data, error: undefined }
        : fail('get', entitySet, res?.error);
    },

    /**
     * Create a row.
     *
     * NOTE the generated signature types this `IOperationResult<void>` -- it
     * declares no response body -- while the developer guide's own example
     * reads result.data for the created record. `return=representation` is
     * sent, so the connector should return the row; the TypeScript type is
     * most likely just incomplete. Until a live call settles it, this is the
     * single riskiest call in this module: dataverse.js binds child rows to
     * the id a create returns. Run smokeTestCreate() below before trusting it.
     */
    async create(record) {
      const res = await DV.CreateRecordWithOrganization(
        PREFER_REPRESENTATION, JSON_ACCEPT, DATA_ORG, entitySet, record, undefined
      );
      return res?.success
        ? { success: true, data: res.data, error: undefined }
        : fail('create', entitySet, res?.error);
    },

    /** Patch a row. */
    async update(id, changedFields) {
      const res = await DV.UpdateRecordWithOrganization(
        PREFER_REPRESENTATION, JSON_ACCEPT, DATA_ORG, entitySet, id, changedFields, undefined
      );
      return res?.success
        ? { success: true, data: res.data, error: undefined }
        : fail('update', entitySet, res?.error);
    },

    /* The per-table delete() returns a bare Promise<void> and throws on
       failure, so this one throws too rather than returning a result object.
       Parameter order here puts organization FIRST -- the guide flagged this
       signature as unverified; it groups with ListRecords, not with the write
       methods. Passing the write-method order would send 'return=representation'
       as the org URL. */
    async delete(id) {
      const res = await DV.DeleteRecordWithOrganization(DATA_ORG, entitySet, id, undefined);
      if (!res?.success) {
        throw new Error(
          `delete failed on ${entitySet} in ${DATA_ORG}: ${JSON.stringify(res?.error ?? {})}`
        );
      }
    },
  };
}

/* =========================================================================
   Smoke test -- answers the one open question before any conversion.

   Creates a throwaway row, reports whether the new record's GUID came back
   on the create result, then deletes it again. Run it from the browser
   console of the running app:

       await window.__xenvSmokeTest()

   lm_setupactivity is the table used because its only required column is
   lm_name -- every lookup on it is optional, so a row can be created with no
   parent at all. Nothing references the row, and it is deleted at the end
   whatever the outcome.
   ========================================================================= */
export async function smokeTestCreate() {
  const table = dvTable('lm_setupactivities');
  const stamp = new Date().toISOString();
  const out = { org: DATA_ORG, table: 'lm_setupactivities', createdId: null };

  const created = await table.create({
    lm_name: `xenv smoke test ${stamp}`,
    lm_field: 'cross-environment connectivity check',
  });

  out.createSucceeded = !!created.success;
  if (!created.success) {
    out.verdict = 'CREATE FAILED -- read out.error';
    out.error = created.error;
    return out;
  }

  /* The question this whole test exists for. */
  const data = created.data;
  out.returnedBody = data ?? null;
  const id = data && (data.lm_setupactivityid || data.lm_setupactivityId);
  out.createdId = id ?? null;
  out.verdict = id
    ? 'ID RETURNED -- safe to convert dataverse.js'
    : 'NO ID RETURNED -- parent/child saves will break; do not convert yet';

  /* Tidy up. If no id came back, find the row by name so the test leaves
     nothing behind either way. */
  let deleteId = id;
  if (!deleteId) {
    const found = await table.getAll({
      select: ['lm_setupactivityid', 'lm_name'],
      filter: `lm_name eq 'xenv smoke test ${stamp}'`,
    });
    deleteId = found.success && found.data[0] ? found.data[0].lm_setupactivityid : null;
    out.foundByQuery = !!deleteId;
  }
  if (deleteId) {
    try { await table.delete(deleteId); out.cleanedUp = true; }
    catch (e) { out.cleanedUp = false; out.cleanupError = String(e); }
  }
  return out;
}
