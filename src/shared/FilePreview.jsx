import React, { useState, useEffect, useRef } from 'react';
import { downloadFileColumn } from '../services/xenv.js';

/* =========================================================================
   FilePreview -- read a file out of a Dataverse File column and SHOW it,
   without offering any way to change it.

   Every file in this app is uploaded into a native Dataverse File column
   (lm_report_templates.lm_attachementfile, the Section item's own
   lm_attachementfile, lm_reportoccurrence.lm_attachementfile). Until now a
   file could be replaced but never read back, so the only way to find out
   what a Template actually asks for was to have been the person who
   uploaded it.

   Read-only is the whole point: no picker, no save, no drop target. The
   file is fetched, rendered, and optionally downloaded.
   ========================================================================= */

/* Dataverse stores a file's NAME but not its type, so the type is taken
   from the extension. It matters for exactly two things: whether the
   browser renders a PDF inline rather than offering to save it, and
   whether a download keeps the file's identity. */
const MIME = {
  pdf:'application/pdf',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
  webp:'image/webp', bmp:'image/bmp', svg:'image/svg+xml',
  txt:'text/plain', md:'text/plain', log:'text/plain', csv:'text/csv',
  json:'application/json', xml:'application/xml',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:'application/vnd.ms-excel',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const SHEET_EXT = ['xlsx','xlsm','xlsb','xls','csv'];
const IMG_EXT   = ['png','jpg','jpeg','gif','webp','bmp','svg'];
const TEXT_EXT  = ['txt','md','log','json','xml','yml','yaml'];

const extOf = name => String(name||'').split('.').pop().toLowerCase();

/* How a file of this name will be shown. Exported so a call site can label
   its button honestly BEFORE fetching anything -- promising a preview and
   then failing to deliver one is worse than saying up front that this type
   cannot be shown. */
export function previewKind(name){
  const e = extOf(name);
  if(SHEET_EXT.includes(e)) return 'sheet';
  if(IMG_EXT.includes(e))   return 'image';
  if(e === 'pdf')           return 'pdf';
  if(TEXT_EXT.includes(e))  return 'text';
  return 'none';
}
export const canPreview = name => previewKind(name) !== 'none';

/* base64 -> bytes. atob gives one char per byte; charCodeAt recovers it. */
function b64ToBytes(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Trailing empty rows and columns are an artefact of how Excel stores a
   used range, not content, and they make a small sheet render as a field
   of blank cells. */
function trimGrid(rows){
  const nonEmpty = c => c !== '' && c !== null && c !== undefined;
  let last = -1;
  rows.forEach((r,i)=>{ if((r||[]).some(nonEmpty)) last = i; });
  const kept = rows.slice(0, last+1);
  let width = 0;
  kept.forEach(r=>{ (r||[]).forEach((c,j)=>{ if(nonEmpty(c)) width = Math.max(width, j+1); }); });
  return kept.map(r=>Array.from({length:width}, (_,j)=>(r||[])[j] ?? ''));
}

/* A spreadsheet is capped rather than streamed: this is a preview of a
   report template, not a data grid, and 500 rows is already far more than
   a checklist needs. */
const MAX_ROWS = 500;

export function FilePreview({entitySet, recordId, field, name}){
  const [st, setSt] = useState({phase:'loading'});
  const [sheet, setSheet] = useState(0);
  /* Object URLs are a leak if they outlive the component, and a preview is
     opened and closed repeatedly. */
  const urlRef = useRef(null);

  useEffect(()=>{
    let alive = true;
    setSt({phase:'loading'});
    setSheet(0);

    if(!recordId){
      setSt({phase:'error',
        msg:'This has not been saved to Dataverse yet, so there is no stored file to show.'});
      return;
    }

    (async ()=>{
      const b64 = await downloadFileColumn(entitySet, recordId, field);
      if(!alive) return;
      const kind = previewKind(name);
      const ext  = extOf(name);

      if(kind === 'sheet'){
        /* Loaded on demand. SheetJS is a large dependency and a preview is
           rare, so bundling it into the app's main chunk would make every
           page load pay for a screen most people never open. */
        const XLSX = await import('xlsx');
        const wb = XLSX.read(b64ToBytes(b64), {type:'array'});
        const sheets = wb.SheetNames.map(n=>({
          name: n,
          rows: trimGrid(XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:''})),
        }));
        if(alive) setSt({phase:'ready', kind, b64, sheets});
        return;
      }

      if(kind === 'text'){
        if(alive) setSt({phase:'ready', kind, b64,
          text:new TextDecoder().decode(b64ToBytes(b64))});
        return;
      }

      /* pdf, image, and anything unrecognised all need a URL -- the first
         two to render, the last only so it can be downloaded. */
      const url = URL.createObjectURL(
        new Blob([b64ToBytes(b64)], {type: MIME[ext] || 'application/octet-stream'}));
      if(!alive){ URL.revokeObjectURL(url); return; }
      urlRef.current = url;
      setSt({phase:'ready', kind, b64, url});
    })().catch(e=>{
      if(!alive) return;
      console.warn('[FilePreview]', entitySet, recordId, field, e);
      setSt({phase:'error', msg: e?.message || String(e)});
    });

    return ()=>{
      alive = false;
      if(urlRef.current){ URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [entitySet, recordId, field, name]);

  /* Download is built on demand rather than held open, so the URL exists
     only for the moment the click needs it. */
  const download = ()=>{
    if(st.phase !== 'ready') return;
    const url = st.url || URL.createObjectURL(
      new Blob([b64ToBytes(st.b64)], {type: MIME[extOf(name)] || 'application/octet-stream'}));
    const a = document.createElement('a');
    a.href = url; a.download = name || 'download';
    document.body.appendChild(a); a.click(); a.remove();
    if(!st.url) setTimeout(()=>URL.revokeObjectURL(url), 0);
  };

  if(st.phase === 'loading')
    return <div className="fv-msg">Loading <b>{name||'the file'}</b>…</div>;

  if(st.phase === 'error')
    return <div className="fv-msg fv-err">
      <b>The file could not be read.</b>
      <div className="fv-detail">{st.msg}</div>
    </div>;

  const body =
    st.kind === 'sheet'  ? <SheetView sheets={st.sheets} at={sheet} onSheet={setSheet}/> :
    st.kind === 'pdf'    ? <iframe className="fv-frame" src={st.url} title={name||'File'}/> :
    st.kind === 'image'  ? <div className="fv-imgwrap"><img src={st.url} alt={name||'Attached file'}/></div> :
    st.kind === 'text'   ? <pre className="fv-text">{st.text}</pre> :
    <div className="fv-msg">
      <b>This file type cannot be shown here.</b>
      <div className="fv-detail">
        {extOf(name) ? '.'+extOf(name) : 'This file'} has no viewer that runs in the
        browser. Download it to open it in its own application.
      </div>
    </div>;

  return <div className="fv-root">
    <div className="fv-bar">
      <span className="fv-name">{name||'Attached file'}</span>
      <span className="fv-ro">Read-only</span>
      <button type="button" className="btn" onClick={download}>Download</button>
    </div>
    {body}
  </div>;
}

/* One sheet at a time, with a tab per sheet when there is more than one.
   Rendered as React elements from sheet_to_json rather than through
   SheetJS's sheet_to_html: that would mean injecting markup built from an
   uploaded file into the governance app with dangerouslySetInnerHTML, and
   there is no reason to take that on for a grid of values. React escapes
   every cell for free. */
function SheetView({sheets, at, onSheet}){
  const s = sheets[at] || {rows:[]};
  const rows = s.rows.slice(0, MAX_ROWS);
  const clipped = s.rows.length - rows.length;

  return <>
    {sheets.length > 1
      ? <div className="fv-tabs">
          {sheets.map((sh,i)=>
            <button type="button" key={sh.name+i}
              className={'fv-tab'+(i===at?' on':'')} onClick={()=>onSheet(i)}>
              {sh.name}</button>)}
        </div>
      : null}
    {rows.length === 0
      ? <div className="fv-msg">This sheet is empty.</div>
      : <div className="fv-scroll">
          <table className="fv-grid">
            <tbody>
              {rows.map((r,i)=>
                <tr key={i}>
                  <th className="fv-rn">{i+1}</th>
                  {r.map((c,j)=><td key={j}>{c === '' ? '' : String(c)}</td>)}
                </tr>)}
            </tbody>
          </table>
        </div>}
    {clipped > 0
      ? <div className="fv-msg fv-clip">
          Showing the first {MAX_ROWS} rows — {clipped} more are in the file.
          Download it to see all of them.</div>
      : null}
  </>;
}
