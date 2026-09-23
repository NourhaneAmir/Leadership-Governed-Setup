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
/* Set per app at build time by vite.config.js's `define`. The fallback is DT
   New, so a build without the define behaves exactly as before -- and so that
   `npm run dev` and any tooling that imports this file outside Vite still
   resolve to something real.

   This exists because the two apps are expected to diverge: open decision 9
   moves Governance Setup to the IT environment and leaves Leadership on DT
   New. While this was a single shared constant, that move was impossible
   without taking both apps with it. */
export const DATA_ORG =
  (typeof __DATA_ORG__ === 'string' && __DATA_ORG__)
    ? __DATA_ORG__
    : 'https://org319b4ea9.crm4.dynamics.com';

/* The IT environment -- the same one Governance Setup's own DATA_ORG has
   pointed at since Open Decision 9 (22 Sep, see PROJECT-CONTEXT.md). A table
   family that dataverse.js wants pinned to IT regardless of which app is
   built (or what DATA_ORG above resolves to) passes this as dvTable()'s
   third argument. Two families use it so far, both per an explicit ask, both
   because the real rows only meaningfully exist in IT now that Governance
   Setup writes there:
     - the Report Occurrence family (lm_reportoccurrences and its own child
       tables -- sections, citations, history, shares) -- Leadership's
       Reports/Plans, Work Queue, Calendar, Home stats, Communication and
       Build a report/plan all read this through fetchReportOccurrences();
     - the Report Template family (lm_report_templates,
       lm_reporttemplatecontentchecklists, lm_reporttemplatesectionitemses)
       -- Leadership's Reporting hierarchy "Report Templates" view
       (fetchReportTemplateHierarchyContent()) and its app-wide Template
       name lookup (fetchReportTemplatesList(), feeding BuildReport's
       approved-Template picker and every screen that names a linked
       Template) both read this through the same three tables.
   Governance Setup's own DATA_ORG already equals this org, so pinning any
   of the above is a no-op there -- the divergence is Leadership-only, which
   stays on DT New for every table not listed above (Meeting Occurrences
   included, and any Report Template scope/review-chain child table
   Governance alone reads -- those were never given this override, since
   nothing outside Governance touches them). */
export const IT_ORG = 'https://org2f45e702.crm4.dynamics.com';

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
const fail = (op, table, error, org = DATA_ORG) => ({
  success: false,
  data: undefined,
  error: error ?? new Error(`${op} failed on ${table} in ${org}`),
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

/* A GUID for a new row's primary key. crypto.randomUUID needs a secure
   context, which the Power Apps player always is; the fallback only exists so
   a plain http dev server does not crash. */
const newGuid = () =>
  (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/**
 * One table in the DATA_ORG environment (or `org`, when given), exposing the
 * same five methods the generated per-table services do.
 * @param {string} entitySet the table's plural entity set name
 * @param {string} [pkField] the primary key column, e.g. `lm_report_templateid`.
 *   When given, create() supplies the new row's GUID itself -- see create().
 * @param {string} [org] override for DATA_ORG -- this ONE table always reads
 *   and writes this org instead, whatever DATA_ORG resolves to for the rest
 *   of the app. See REPORT_OCCURRENCE_ORG above for why this exists.
 */
/* Every entity set dvTable() has been asked for, in call order.
   preflight() sweeps this rather than a hand-kept list: a hand-kept list
   drifts the first time someone adds a table and forgets. Value is just
   pkField, not the org override (if any) -- preflight()'s own `org` param
   is a deliberate manual override for probing "would ALL these tables work
   in org X", so it isn't meant to reflect each table's real target either. */
const REGISTERED = new Map();

export function dvTable(entitySet, pkField, org = DATA_ORG) {
  if (!REGISTERED.has(entitySet)) REGISTERED.set(entitySet, pkField || null);
  return {
    /** Every matching row, following pagination to the end. */
    async getAll(options) {
      const rows = [];
      let skiptoken;
      /* A cap on iterations rather than `while (true)`: a malformed nextLink
         that never changes would otherwise spin forever against Dataverse. */
      for (let page = 0; page < 200; page++) {
        const res = await DV.ListRecordsWithOrganization(
          org,                          // organization -- FIRST here, unlike create/update
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
        if (!res?.success) return fail('getAll', entitySet, res?.error, org);

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
        PREFER_REPRESENTATION, JSON_ACCEPT, org, entitySet, id,
        undefined, undefined, selectOf(options), options?.expand, undefined
      );
      return res?.success
        ? { success: true, data: res.data, error: undefined }
        : fail('get', entitySet, res?.error, org);
    },

    /**
     * Create a row.
     *
     * The generated signature types this `IOperationResult<void>` -- no
     * response body declared -- so the new row's id is not taken on trust
     * from the response. For any table given a pkField, the id is generated
     * here and sent with the row; see the note inside. smokeTestCreate()
     * below reads the row back under that id to prove it landed.
     */
    async create(record) {
      /* The id is chosen HERE, not read back from the response. The connector
         types this operation's result as void, and dataverse.js cannot work
         without the new row's id: every child row -- units, attendees, review
         chain steps, agenda items, the activity trail -- binds to it, and
         Approve/Expire only write to a Setup that has one. Dataverse accepts a
         client-supplied primary key on create, so supplying it makes the id
         certain whatever the response body carries. */
      const id = pkField ? (record?.[pkField] || newGuid()) : undefined;
      const body = pkField ? { ...record, [pkField]: id } : record;

      const res = await DV.CreateRecordWithOrganization(
        PREFER_REPRESENTATION, JSON_ACCEPT, org, entitySet, body, undefined
      );
      if (!res?.success) return fail('create', entitySet, res?.error, org);

      const returned = res.data && typeof res.data === 'object' ? res.data : null;
      if (!pkField) return { success: true, data: returned ?? undefined, error: undefined };

      /* Prefer what Dataverse sent back; fill the id in only if it did not.
         _idSource records which happened, for the smoke test. */
      const fromServer = returned && returned[pkField];
      return {
        success: true,
        data: { ...body, ...(returned || {}), [pkField]: fromServer || id,
                _idSource: fromServer ? 'response' : 'client' },
        error: undefined,
      };
    },

    /** Patch a row. */
    async update(id, changedFields) {
      const res = await DV.UpdateRecordWithOrganization(
        PREFER_REPRESENTATION, JSON_ACCEPT, org, entitySet, id, changedFields, undefined
      );
      return res?.success
        ? { success: true, data: res.data, error: undefined }
        : fail('update', entitySet, res?.error, org);
    },

    /* The per-table delete() returns a bare Promise<void> and throws on
       failure, so this one throws too rather than returning a result object.
       Parameter order here puts organization FIRST -- the guide flagged this
       signature as unverified; it groups with ListRecords, not with the write
       methods. Passing the write-method order would send 'return=representation'
       as the org URL. */
    async delete(id) {
      const res = await DV.DeleteRecordWithOrganization(org, entitySet, id, undefined);
      if (!res?.success) {
        throw new Error(
          `delete failed on ${entitySet} in ${org}: ${JSON.stringify(res?.error ?? {})}`
        );
      }
    },
  };
}

/* =========================================================================
   File/Image column upload -- a native Dataverse File column (added to
   lm_report_templates as lm_attachementfile), NOT the SharePoint dead end
   documented in PROJECT-CONTEXT.md's §6 ("SharePoint file upload"). This
   goes through the same generic commondataserviceforapps connector as
   dvTable() above, via its dedicated 'Upload a file or image to selected
   environment' action -- so it works cross-environment the same way every
   other read/write in this file does.

   The connector's own schema declares the body as `{format:"binary",
   type:"string"}` under `consumes: application/octet-stream` -- the
   standard Power Platform connector convention for a binary body carried
   over this JSON-based invoke transport is a base64 string, so callers
   here pass base64 (see dataverse.js's uploadReportTemplateFile(), which
   does the FileReader -> base64 step). CONFIRMED against live Dataverse
   (20 Sep): the base64 body was correct on the first try -- the only real
   bug was the content-type header (see below).

   ⚠️ The `content-type` header MUST be exactly "application/octet-stream",
   never the file's own real MIME type. The connector's `consumes` list
   names only that one value, and the gateway rejects anything else with
   "The request entity's media type '...' is not supported for this
   resource" -- confirmed live for both .xlsx and .xls. This is a transport
   requirement only: the file's real name and extension still travel
   correctly via the separate `fileName` parameter below (Dataverse and
   anything downloading the file later go by that, not by this header), so
   forcing it loses nothing. Do not resurrect a per-file content-type here. */
export async function uploadFileColumn(entitySet, recordId, fieldName, fileName, base64Content) {
  const res = await DV.UpdateEntityFileImageFieldContentWithOrganization(
    'application/octet-stream',
    DATA_ORG,
    entitySet,
    recordId,
    fieldName,
    base64Content,
    fileName
  );
  if (!res?.success) {
    throw new Error(
      res?.error?.message || String(res?.error) || `Upload failed on ${entitySet}.${fieldName}`
    );
  }
  return true;
}

/* =========================================================================
   File/Image column DOWNLOAD -- the read side of uploadFileColumn() above,
   and the same connector, so a preview reads whatever environment DATA_ORG
   points at just like every other call in this file.

   Returns base64, matching what the upload takes.

   ⚠️ `Range` is the FIRST positional argument and the generated signature
   types it as a required string, but it is an HTTP Range header: omitting it
   is what asks for the whole file. A gateway that insists on one does NOT
   fail -- it answers 200 with an empty body. So the fallback has to trigger
   on an empty result as well as on a failed one. The first version retried
   only on failure, which meant the retry written for this exact case could
   never run; the live symptom was "came back empty" on a call that reported
   success.
   ========================================================================= */

/* Bytes -> base64, in chunks. String.fromCharCode.apply with a whole file
   as arguments overflows the call stack somewhere around a hundred kB. */
function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* Whatever the connector hands back, reduced to base64.

   The transport is JSON, but the SDK has been observed to surface binary as
   a bare base64 string, a data: URI, the Power Platform
   `{$content-type, $content}` envelope, and a plain `{value}` wrapper --
   and a fetch-based client can surface it as a Blob or ArrayBuffer. An
   unrecognised shape returns '' and the CALLER reports what it actually
   got; it must never be swallowed silently, which is what hid the original
   bug. */
async function toBase64(data) {
  if (data == null) return '';

  if (typeof data === 'string') {
    /* data:<mime>;base64,<payload> -- keep only the payload. */
    const comma = data.startsWith('data:') ? data.indexOf(',') : -1;
    return comma === -1 ? data : data.substring(comma + 1);
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return bytesToBase64(new Uint8Array(await data.arrayBuffer()));
  }
  if (data instanceof ArrayBuffer) return bytesToBase64(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) {
    return bytesToBase64(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  if (typeof data === 'object') {
    for (const k of ['$content', 'content', 'value', 'body', 'fileContent', 'documentBody']) {
      if (data[k] != null) return toBase64(data[k]);
    }
  }
  return '';
}

/* What came back, in a form safe to put in an error message. Without this
   an unhandled envelope is indistinguishable from an empty file. */
function describePayload(data) {
  if (data === undefined) return 'undefined';
  if (data === null) return 'null';
  if (typeof data === 'string') return `string(length ${data.length})`;
  if (typeof data !== 'object') return typeof data;
  const ctor = (data.constructor && data.constructor.name) || 'Object';
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return `${ctor}(${data.byteLength} bytes)`;
  }
  return `${ctor}{${Object.keys(data).slice(0, 12).join(', ')}}`;
}

export async function downloadFileColumn(entitySet, recordId, fieldName, org = DATA_ORG) {
  const call = range => DV.GetEntityFileImageFieldContentWithOrganization(
    range, org, entitySet, recordId, fieldName, undefined
  );

  /* Omitting Range first, because that is the documented "whole file".
     `bytes=0-` says the same thing explicitly, for a gateway that requires
     the header to be present. */
  const RANGES = [undefined, 'bytes=0-'];
  const tried = [];
  let lastData;

  for (const range of RANGES) {
    let res;
    try {
      res = await call(range);
    } catch (e) {
      tried.push(`Range=${range ?? '(omitted)'}: threw ${e?.message || e}`);
      continue;
    }
    if (!res?.success) {
      const e = res?.error;
      tried.push(`Range=${range ?? '(omitted)'}: ${e?.message || JSON.stringify(e ?? {})}`);
      continue;
    }
    lastData = res.data;
    const b64 = await toBase64(res.data);
    if (b64) return b64;
    tried.push(`Range=${range ?? '(omitted)'}: succeeded but yielded no content ` +
               `(payload was ${describePayload(res.data)})`);
  }

  console.warn('[xenv] downloadFileColumn failed', {
    entitySet, recordId, fieldName, org, lastData, tried,
  });
  throw new Error(
    `Could not read ${entitySet}.${fieldName} for ${recordId}. ` + tried.join(' | ')
  );
}

/* =========================================================================
   Preflight -- "will this app work against this environment?"

   Reads one row from every table the app has registered and classifies the
   result. Run it from the browser console of the running app:

       await window.__xenvPreflight()

   and read the printed table. `out.blocked` is the list to hand whoever
   administers the target environment.

   Why this exists: establishing the same thing for the IT environment by hand
   took 45 separate CLI calls and produced two wrong conclusions before the
   right one (see PROJECT-CONTEXT open decision 9). Doing it from inside the
   app also tests the thing that actually matters -- the app's own connection
   and user, not whoever is signed in to the CLI.

   DENIED vs ABSENT matters and is easy to confuse: a table you cannot read
   and a table that is not there both return nothing useful, but only one of
   them is fixed by a security role. Dataverse names the missing privilege in
   the first case, which is what this keys on.
   ========================================================================= */
export async function preflight({ verbose = true, org = DATA_ORG } = {}) {
  /* `org` defaults to this build's own environment, but any org the signed-in
     user can reach may be passed. That is the point: the IT environment can be
     checked from the app running today, without rebuilding or deploying
     anything, because the adapter takes the organization per call --
         await window.__xenvPreflight({ org: 'https://org2f45e702.crm4.dynamics.com' })
     answers "would this app work there yet?" in one line. */
  const out = { org, checked: 0, ok: [], empty: [], denied: [], absent: [], failed: [] };
  const rows = [];

  for (const [entitySet, pkField] of REGISTERED) {
    out.checked++;
    let status, detail = '';
    try {
      const res = await DV.ListRecordsWithOrganization(
        org, entitySet, PREFER_PAGED, JSON_ACCEPT,
        undefined, undefined,
        pkField ? pkField : undefined,      // $select -- one column is enough
        undefined, undefined, undefined, undefined,
        1,                                  // $top -- one row, this is a probe
        undefined, undefined
      );
      if (res?.success) {
        const n = Array.isArray(res.data?.value) ? res.data.value.length : 0;
        status = n > 0 ? 'ok' : 'empty';
      } else {
        const msg = String(res?.error?.message || res?.error || '');
        detail = msg.slice(0, 200);
        status = /missing prv|PrivilegeDenied|is missing .*privilege/i.test(msg) ? 'denied'
               : /does not exist|not found in the MetadataCache|Could not find entity/i.test(msg) ? 'absent'
               : 'failed';
      }
    } catch (e) {
      detail = String(e?.message || e).slice(0, 200);
      status = 'failed';
    }
    out[status].push(entitySet);
    rows.push({ table: entitySet, status, detail });
  }

  /* The one list worth acting on: what an administrator has to grant or
     create before this app can run here. */
  out.blocked = [...out.denied, ...out.absent];
  out.verdict = out.blocked.length === 0
    ? `READY -- all ${out.checked} tables reachable in ${org}`
    : `NOT READY -- ${out.blocked.length} of ${out.checked} tables blocked in ${org}`;

  if (verbose && typeof console !== 'undefined') {
    console.log(out.verdict);
    if (console.table) console.table(rows);
    if (out.denied.length) console.warn('Denied (needs a security role):', out.denied);
    if (out.absent.length) console.warn('Absent (table does not exist here):', out.absent);
    if (out.failed.length) console.warn('Failed for another reason:', out.failed);
  }
  return out;
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
  const table = dvTable('lm_setupactivities', 'lm_setupactivityid');
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

  /* create() now always yields an id -- supplied by the app if the
     response lacked one -- so "an id came back" proves nothing by itself.
     The real test is reading the row back under that id. */
  const data = created.data;
  const id = data && data.lm_setupactivityid;
  out.createdId = id ?? null;
  out.idSource = data && data._idSource;   // 'response' or 'client'

  const readBack = id
    ? await table.get(id, { select: ['lm_setupactivityid', 'lm_name'] })
    : { success: false };
  out.rowFoundUnderThatId = !!(readBack.success && readBack.data);
  out.verdict = out.rowFoundUnderThatId
    ? `OK -- row exists in ${DATA_ORG} under id ${id} (id came from the ${out.idSource})`
    : 'FAILED -- no row found under the id; creates cannot be trusted';

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

/* Both helpers are documented as `window.__xenv*` and, until 20 Sep, neither
   was ever attached -- so the smoke test had never actually been runnable the
   way its own comment describes. Attached here, guarded so importing this
   module outside a browser (a test runner, a build step) stays harmless. */
if (typeof window !== 'undefined') {
  window.__xenvPreflight = preflight;
  window.__xenvSmokeTest = smokeTestCreate;
  window.__xenvOrg = () => DATA_ORG;
}
