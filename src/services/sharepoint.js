/* =========================================================================
   SharePoint file upload (04 Oct) -- the Minutes Word document.

   The Leadership app's SharePoint connection is registered as the "documents"
   data source: the Documents library of
     https://andalusiagroupegypt.sharepoint.com/sites/DigitalTransformation-UnifiedTransformationAlignment
   A tabular data source only generates list CRUD, which cannot upload a
   file's contents. The connector's own file actions can, so they are
   registered here on top of the generated registry (the generated files stay
   untouched) and called through the same client the generated services use.

   The Power Apps client fills the connection and the site (dataset) in from
   power.config.json, URL-encodes path parameters (as a flow does for a file
   Id), and sends a base64 value of a `format: binary` body parameter as raw
   bytes (connectorDataOperationExecutor.js).

   Every save DELETES the previous file first (04 Oct, user's rule: a
   resubmission after the Chair returned the Minutes replaces the old
   version), then creates the new one.
   ========================================================================= */
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '@generated/../../.power/schemas/appschemas/dataSourcesInfo';

export const SP_SITE = 'https://andalusiagroupegypt.sharepoint.com/sites/DigitalTransformation-UnifiedTransformationAlignment';
/* Library-relative folder, as the connector's folderPath expects. */
export const MOM_FOLDER = '/Shared Documents/Cross Functional Projects/DT/Design Documents/Leadership Practice';

const DS = 'documents';
const p = (name, where, required = true, type = 'string') => ({ name, in: where, required, type });
const ACTIONS = {
  CreateFile: {
    path: '/{connectionId}/datasets/{dataset}/files',
    method: 'POST',
    parameters: [
      p('connectionId', 'path'), p('dataset', 'path'),
      p('folderPath', 'query'), p('name', 'query'),
      p('queryParametersSingleEncoded', 'query', false, 'boolean'),
      { name: 'body', in: 'body', required: true, type: 'string', format: 'binary' },
    ],
    responseInfo: { 200: { type: 'object' } },
  },
  GetFileMetadataByPath: {
    path: '/{connectionId}/datasets/{dataset}/GetFileByPath',
    method: 'GET',
    parameters: [
      p('connectionId', 'path'), p('dataset', 'path'),
      p('path', 'query'),
      p('queryIncludeStatus', 'query', false, 'boolean'),
    ],
    responseInfo: { 200: { type: 'object' } },
  },
  DeleteFile: {
    path: '/{connectionId}/datasets/{dataset}/files/{id}',
    method: 'DELETE',
    parameters: [p('connectionId', 'path'), p('dataset', 'path'), p('id', 'path')],
    responseInfo: { 200: { type: 'object' } },
  },
};

/* ⚠️ The Power Apps runtime is a singleton: it keeps the FIRST registry any
   getClient() call hands it (the generated services' dataSourcesInfo) and
   ignores later ones, so a copy with extra actions is never seen ("Cannot
   read properties of undefined (reading 'path')", 04 Oct). The actions are
   therefore added INTO the shared registry object, which the runtime holds
   by reference -- before or after it starts, it finds them. */
let client = null;
function spClient(){
  if(client) return client;
  const base = dataSourcesInfo[DS];
  if(!base) throw new Error('The SharePoint "documents" data source is not registered in this app.');
  base.apis = base.apis || {};
  Object.assign(base.apis, ACTIONS);
  client = getClient(dataSourcesInfo);
  return client;
}
const call = (operationName, parameters) =>
  spClient().executeAsync({ connectorOperation: { tableName: DS, operationName, parameters } });
const errorOf = res => res?.error?.message || (typeof res?.error === 'string' ? res.error : '') || 'SharePoint refused the request';

/** The library-relative path of a file link this module produced, or null. */
export function pathFromUrl(url){
  if(!url || !url.startsWith(SP_SITE)) return null;
  try{ return decodeURI(url.slice(SP_SITE.length).split('?')[0]) || null; }catch{ return null; }
}

/** Deletes the file at a library-relative path. A missing file is not an
 *  error (it may have been removed by hand). Returns true when one was deleted. */
export async function deleteFileByPath(path){
  if(!path) return false;
  const meta = await call('GetFileMetadataByPath', { path, queryIncludeStatus: false });
  if(meta?.success === false || !meta?.data?.Id) return false;     // not there
  const del = await call('DeleteFile', { id: meta.data.Id });
  if(del?.success === false) throw new Error('The previous version could not be deleted: ' + errorOf(del));
  return true;
}

/** Saves a file in MOM_FOLDER, deleting the previous version(s) first.
 *  @param {string}   name          file name, e.g. "MOM - Quality Committee - 4 Oct 2026.docx"
 *  @param {string}   base64        the file body, base64 without a data: prefix
 *  @param {string[]} [replacePaths] earlier versions to delete (e.g. from the saved link)
 *  @returns {Promise<{url:string, path:string, replaced:boolean}>} a browser link to the file */
export async function uploadMinutesFile(name, base64, replacePaths = []){
  const target = `${MOM_FOLDER}/${name}`;
  let replaced = false;
  for(const old of [...new Set([...replacePaths.filter(Boolean), target])])
    replaced = (await deleteFileByPath(old)) || replaced;
  const res = await call('CreateFile', { folderPath: MOM_FOLDER, name, queryParametersSingleEncoded: true, body: base64 });
  if(res?.success === false) throw new Error(errorOf(res));
  const path = res?.data?.Path || target;
  return { path, url: `${SP_SITE}${encodeURI(path)}?web=1`, replaced };
}
