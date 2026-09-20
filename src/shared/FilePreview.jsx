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

/* Leading bytes that identify a file. xlsx/xlsm/docx/pptx are ZIP
   containers; .xls is an OLE2 compound file. */
const MAGIC = {
  zip :[0x50,0x4B,0x03,0x04], ole2:[0xD0,0xCF,0x11,0xE0],
  pdf :[0x25,0x50,0x44,0x46], png :[0x89,0x50,0x4E,0x47],
  gif :[0x47,0x49,0x46,0x38], jpg :[0xFF,0xD8,0xFF], bmp:[0x42,0x4D],
};
/* What each extension's bytes must start with. An extension absent here --
   txt, csv, json -- has no signature to check, and is never second-guessed. */
const EXPECTED = {
  xlsx:['zip'], xlsm:['zip'], docx:['zip'], pptx:['zip'], xlsb:['zip','ole2'],
  xls:['ole2','zip'], pdf:['pdf'], png:['png'], gif:['gif'],
  jpg:['jpg'], jpeg:['jpg'], bmp:['bmp'],
};
const matchesAny = (bytes, names) =>
  (names||[]).some(n=>MAGIC[n].every((b,i)=>bytes[i]===b));

/* ⚠️ The connector can return content that is ITSELF base64 -- i.e.
   base64(base64(file)) -- so a single decode yields ASCII base64 TEXT, not
   the file.

   This is nastier than it sounds, because nothing throws. SheetJS accepts
   the text and falls back to parsing it as CSV, producing one cell
   containing the whole base64 string; on screen that reads as a broken
   renderer rather than a broken decode. A downloaded copy is likewise a
   text file wearing an .xlsx name, which Excel rejects as corrupt.

   The extra layer is peeled ONLY when all three hold: the extension tells
   us what the leading bytes should be, they do not match, and after
   decoding again they do. So a file that is merely unrecognised is passed
   through untouched, and a text file is never mangled. */
/* What actually arrived, in a form that can be read straight off the
   screen. This exists because two separate theories about the payload were
   INFERRED rather than observed, and both were wrong. Showing the bytes
   costs one line and settles the question. */
function describeBytes(bytes){
  const hex = Array.from(bytes.slice(0,12))
    .map(b=>b.toString(16).padStart(2,'0')).join(' ');
  let text = '';
  try{ text = new TextDecoder('latin1').decode(bytes.slice(0,96)); }catch{ /* ignore */ }
  return {length:bytes.length, hex, printable:text.replace(/[^ -~]/g,'.')};
}

/* Strips the wrappers a base64 payload is commonly delivered inside, any of
   which makes atob() throw and so would defeat the peel below. */
function cleanBase64Text(text){
  let t = text.trim();
  if(t.charCodeAt(0) === 0xFEFF) t = t.slice(1);                    // BOM
  if(t.length > 1 && t[0] === '"' && t[t.length-1] === '"') t = t.slice(1,-1);
  if(t.startsWith('data:')){                                        // data: URI
    const c = t.indexOf(',');
    if(c !== -1) t = t.slice(c+1);
  }
  return t.replace(/\s+/g,'')
          .replace(/-/g,'+').replace(/_/g,'/');                     // base64url
}

function decodeFile(b64, name){
  const first = b64ToBytes(b64);
  const want = EXPECTED[extOf(name)];
  if(!want || matchesAny(first, want)) return first;

  try{
    /* latin1: every byte maps to one char, so nothing is lost the way a
       UTF-8 decode would lose a malformed sequence. */
    const text = new TextDecoder('latin1').decode(first);
    const peeled = b64ToBytes(cleanBase64Text(text));  // atob throws if not base64
    if(matchesAny(peeled, want)){
      console.info('[FilePreview] content arrived double base64-encoded; peeled one layer',
        {name, received:first.length, actual:peeled.length});
      return peeled;
    }
    console.warn('[FilePreview] a second base64 layer decoded, but it is still not a '
      + want.join('/'), describeBytes(peeled));
  }catch{ /* not base64 after all -- fall through with what we had */ }
  console.warn('[FilePreview] content does not match its extension',
    {name, expected:want.join('/'), ...describeBytes(first)});
  return first;
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
  /* Kept separate from urlRef because the two have OPPOSITE lifetimes: a
     preview URL is dead the moment its <iframe>/<img> unmounts, but a
     download URL has to survive past it -- see download() below. */
  const dlRef = useRef(null);

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
      /* Decoded ONCE, here, and carried as bytes -- the preview, the
         download and the type check all have to agree on the content. */
      const bytes = decodeFile(b64, name);

      /* ⚠️ One signature check for every type that has one, before anything
         tries to render. SheetJS in particular treats whatever it cannot
         identify as CSV, so handing it a non-workbook yields a grid holding
         the raw text rather than an error -- which is exactly how the
         decoding bug stayed hidden for two rounds.

         The message carries the real leading bytes deliberately: it is the
         evidence needed to identify the payload, and it belongs on screen
         rather than in a console the person reporting it will not open. */
      if(EXPECTED[ext] && !matchesAny(bytes, EXPECTED[ext])){
        const d = describeBytes(bytes);
        throw new Error(
          `This is not a readable ${ext.toUpperCase()} file. ` +
          `${d.length} bytes arrived, starting ${d.hex} \— as text: "${d.printable}"`);
      }

      if(kind === 'sheet'){
        /* Loaded on demand. SheetJS is a large dependency and a preview is
           rare, so bundling it into the app's main chunk would make every
           page load pay for a screen most people never open. */
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bytes, {type:'array'});
        const sheets = wb.SheetNames.map(n=>({
          name: n,
          rows: trimGrid(XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:''})),
        }));
        if(alive) setSt({phase:'ready', kind, bytes, sheets});
        return;
      }

      if(kind === 'text'){
        if(alive) setSt({phase:'ready', kind, bytes,
          text:new TextDecoder().decode(bytes)});
        return;
      }

      /* pdf, image, and anything unrecognised all need a URL -- the first
         two to render, the last only so it can be downloaded. */
      const url = URL.createObjectURL(
        new Blob([bytes], {type: MIME[ext] || 'application/octet-stream'}));
      if(!alive){ URL.revokeObjectURL(url); return; }
      urlRef.current = url;
      setSt({phase:'ready', kind, bytes, url});
    })().catch(e=>{
      if(!alive) return;
      console.warn('[FilePreview]', entitySet, recordId, field, e);
      setSt({phase:'error', msg: e?.message || String(e)});
    });

    return ()=>{
      alive = false;
      /* The preview URL is only read by an element that is going away with
         this component, so it can go immediately. */
      if(urlRef.current){ URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      /* A download URL cannot. If the panel is closed right after clicking
         Download, an immediate revoke can still cut the transfer off, so
         this one is released on a delay -- long after any browser has
         finished reading the blob, and still bounded so it is not a leak. */
      if(dlRef.current){
        const dying = dlRef.current;
        dlRef.current = null;
        setTimeout(()=>URL.revokeObjectURL(dying), 30000);
      }
    };
  }, [entitySet, recordId, field, name]);

  /* ⚠️ The object URL MUST outlive the click.

     `a.click()` only STARTS the download -- the browser then reads the blob
     asynchronously. This used to revoke on the next tick
     (`setTimeout(..., 0)`), which races that read and lands a truncated or
     empty file on disk; Excel reports it as "the file format or file
     extension is not valid", which reads like a corrupt upload and is not
     one. The URL is cached for repeat clicks and released by the effect
     cleanup above, on a delay. Do not revoke here. */
  const download = ()=>{
    if(st.phase !== 'ready') return;
    if(!dlRef.current){
      dlRef.current = st.url || URL.createObjectURL(
        new Blob([st.bytes], {type: MIME[extOf(name)] || 'application/octet-stream'}));
    }
    const a = document.createElement('a');
    a.href = dlRef.current;
    /* Falls back to a safe name: a download with no name at all is saved
       as the opaque blob id. */
    a.download = name || 'download';
    document.body.appendChild(a); a.click(); a.remove();
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
/* Whether the first row names the columns. Detected, not assumed: a sheet
   that starts straight into data keeps its first row AS data rather than
   losing it into a header. Labels are non-numeric strings, which is what
   separates "Status, Region, Stage" from "1, 2, 3". */
function looksLikeHeader(rows){
  if(rows.length < 2) return false;
  const first = rows[0].filter(c=>c !== '' && c != null);
  if(first.length < 2) return false;
  return first.every(c=>typeof c === 'string' && !/^-?[\d.]/.test(c.trim()));
}

/* Numbers are right-aligned so their digits line up down a column. A string
   of digits counts -- Excel stores plenty of numbers as text. */
const isNum = c => typeof c === 'number'
  || (typeof c === 'string' && c.trim() !== '' && !Number.isNaN(Number(c)));

function SheetView({sheets, at, onSheet}){
  const s = sheets[at] || {rows:[]};
  const all = s.rows;
  const header = looksLikeHeader(all) ? all[0] : null;
  const body = (header ? all.slice(1) : all).slice(0, MAX_ROWS);
  const total = header ? all.length - 1 : all.length;
  const clipped = total - body.length;
  /* Every row padded to the widest, so a short row does not pull the grid
     out of alignment with its own header. */
  const cols = all.reduce((m,r)=>Math.max(m, r.length), 0);

  return <>
    <div className="fv-sheetbar">
      {sheets.length > 1
        ? <div className="fv-tabs">
            {sheets.map((sh,i)=>
              <button type="button" key={sh.name+i}
                className={'fv-tab'+(i===at?' on':'')} onClick={()=>onSheet(i)}>
                {sh.name}</button>)}
          </div>
        : <span className="fv-sheetname">{s.name}</span>}
      <span className="fv-count">
        {total.toLocaleString()} row{total===1?'':'s'} · {cols} column{cols===1?'':'s'}</span>
    </div>
    {body.length === 0
      ? <div className="fv-msg">This sheet is empty.</div>
      : <div className="fv-scroll">
          <table className="fv-grid">
            {header
              ? <thead><tr>
                  <th className="fv-rn" aria-label="Row"/>
                  {Array.from({length:cols},(_,j)=>{
                    const c = header[j] ?? '';
                    /* title= carries the full text: cells are clipped with
                       an ellipsis rather than wrapped, so a long heading
                       has to stay reachable on hover. */
                    return <th key={j} title={c===''?undefined:String(c)}>
                      {c===''?'':String(c)}</th>;
                  })}
                </tr></thead>
              : null}
            <tbody>
              {body.map((r,i)=>
                <tr key={i}>
                  {/* The sheet's own row number, so it still matches the
                      file after a header row is lifted out. */}
                  <th className="fv-rn">{header ? i+2 : i+1}</th>
                  {Array.from({length:cols},(_,j)=>{
                    const c = r[j] ?? '';
                    return <td key={j} className={isNum(c)?'fv-num':undefined}
                      title={c===''?undefined:String(c)}>{c===''?'':String(c)}</td>;
                  })}
                </tr>)}
            </tbody>
          </table>
        </div>}
    {clipped > 0
      ? <div className="fv-msg fv-clip">
          Showing the first {MAX_ROWS.toLocaleString()} rows — {clipped.toLocaleString()} more
          are in the file. Download it to see all of them.</div>
      : null}
  </>;
}
