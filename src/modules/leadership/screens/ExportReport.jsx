/* =========================================================================
   Export this report — the button pair, shared by the author's and the
   reader's screen.

   One component rather than one per screen, so a report exported from Build a
   report/plan and the same report exported from Reports / Plans produce
   byte-identical files. The two screens hold their content in different
   shapes (nested citations from fetchReportOccurrenceForEdit, a flat list from
   fetchReportOccurrenceContent); buildReportExportModel() accepts either, so
   both pass what they already have and neither re-reads.

   ⚠️ BI dashboards export as a name, the KPI behind them and a live link, not
   as a screenshot. The reason is a browser security boundary rather than a
   missing library -- reportExport.js's header sets it out in full, and the
   files themselves say so where the image would be, so a reader is never left
   guessing whether something failed.
   ========================================================================= */
import React, { useState, useMemo } from 'react';
import { use } from '../store.jsx';
import { Btn, Note } from '../../../shared/ui.jsx';
import { exportReport } from '../../../services/reportExport.js';

/* A picture big enough to matter and small enough to send. Word and Excel both
   carry the bytes inline, so four 8MB screenshots make a 32MB file that mail
   will refuse. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Reads a chosen image to base64 and its natural size.
 *
 *  The size matters: the writers keep a picture's own aspect ratio and only
 *  fall back to 16:9 when they are told nothing, so a dashboard that is not
 *  widescreen would otherwise be stretched.
 */
function readImage(file){
  return new Promise((resolve, reject) => {
    if(file.size > MAX_IMAGE_BYTES)
      return reject(new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)}MB \u2014 `
        + `${MAX_IMAGE_BYTES / 1048576}MB is the limit`));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('could not read ' + file.name));
    fr.onload = () => {
      const url = String(fr.result);
      const comma = url.indexOf(',');
      const base64 = comma >= 0 ? url.slice(comma + 1) : url;
      /* From the data URL's own media type -- a file named .png that is really
         a JPEG would otherwise be stored under the wrong extension. */
      const m = /^data:image\/([a-z0-9+.-]+)/i.exec(url);
      const extension = m ? m[1].toLowerCase() : 'png';
      const im = new Image();
      /* A picture that will not decode still exports -- the writers just fall
         back to a default size rather than refusing the whole file. */
      im.onerror = () => resolve({ base64, extension, width: 0, height: 0, name: file.name });
      im.onload = () => resolve({ base64, extension, name: file.name,
                                  width: im.naturalWidth, height: im.naturalHeight });
      im.src = url;
    };
    fr.readAsDataURL(file);
  });
}

/** Excel / Word for one Report Occurrence.
 *
 *  @param {object}   p.report      one row from fetchReportOccurrences()
 *  @param {object[]} p.sections    its sections, either screen's shape
 *  @param {object[]} [p.citations] flat citations, when not nested
 *  @param {boolean}  [p.disabled]  while the screen is still reading content
 *  @param {string[]} [p.extraWarnings] notes only the screen knows -- the
 *                    editor declares unsaved changes this way
 */
export function ExportReportButtons({ report, sections, citations, disabled,
                                      extraWarnings }){
  const { toast, dvLookup } = use();
  /* { [biReportId]: { base64, extension, width, height, name } } */
  const [images, setImages] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  /* { format, label } while one is running -- also what disables both buttons,
     so a second click cannot start a parallel export of the same report. */
  const [busy, setBusy] = useState(null);

  /* Every distinct dashboard this report cites, from whichever shape the
     calling screen holds its content in. */
  const biReports = useMemo(() => {
    const flat = Array.isArray(citations) ? citations : [];
    const all = (sections || []).flatMap(s2 =>
      (Array.isArray(s2.citations) && s2.citations.length)
        ? s2.citations
        : flat.filter(c => c.sectionId === s2.id));
    const seen = new Map();
    for(const c of all)
      if(c.biId && !seen.has(c.biId)) seen.set(c.biId, { id: c.biId, name: c.biName || 'BI report' });
    return [...seen.values()];
  }, [sections, citations]);

  const pick = async (biId, file) => {
    if(!file) return;
    try{
      const img = await readImage(file);
      setImages(m => ({ ...m, [biId]: img }));
    }catch(e){
      toast('Image not attached', e?.message || 'unknown error', 'err');
    }
  };

  const run = async format => {
    if(busy) return;
    setBusy({ format, label: 'Reading what this report cites…' });
    try{
      const { filename, warnings } = await exportReport({
        report, sections, citations, lookups: dvLookup, format, extraWarnings,
        biImages: images,
        onProgress: p => setBusy(b => (b ? { ...b, label: p.label } : b)),
      });
      /* A warning means the file was written but something in it is thinner
         than it looks -- worth saying once, not worth failing over. The notes
         travel INSIDE the file too, so this only has to point at them. */
      toast(
        warnings.length ? 'Exported, with notes' : 'Exported',
        warnings.length
          ? `${filename} — ${warnings.length} note${warnings.length === 1 ? '' : 's'} on the first sheet/page.`
          : `${filename} has downloaded.`,
        warnings.length ? 'warn' : 'ok');
      if(warnings.length) console.warn('[reportExport] notes:', warnings);
    }catch(e){
      console.warn('[reportExport] failed:', e);
      toast('Export failed',
        'This report could not be exported: ' + (e?.message || 'unknown error'), 'err');
    }finally{
      setBusy(null);
    }
  };

  const off = disabled || !report || !!busy;
  const nAttached = Object.keys(images).length;

  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
    <span className="tset-lbl">Export</span>
    {/* ⚠️ A dashboard cannot be captured by this app -- it is a frame on
        another origin. Until Power BI's own export can write a PNG into
        Dataverse, attaching one by hand is the only way to get a real
        dashboard into the files, and it uses the same biImages hook. */}
    {biReports.length
      ? <Btn k="sm" disabled={!!busy} onClick={() => setPickerOpen(o => !o)}>
          {nAttached ? `${nAttached}/${biReports.length} image${biReports.length === 1 ? '' : 's'}`
                     : 'Dashboard images'}</Btn>
      : null}
    <Btn k="sm" disabled={off} onClick={() => run('xlsx')}>
      {busy?.format === 'xlsx' ? 'Excel…' : 'Excel'}</Btn>
    <Btn k="sm" disabled={off} onClick={() => run('docx')}>
      {busy?.format === 'docx' ? 'Word…' : 'Word'}</Btn>
    {/* The build is several round trips on a report citing many KPIs, so it
        says where it has got to rather than only that it is busy. */}
    {busy ? <span className="holder" style={{ fontSize: 11.5 }}>{busy.label}</span> : null}

    {pickerOpen && biReports.length
      ? <div style={{ flexBasis: '100%', marginTop: 6, border: '1px solid var(--border)',
                      borderRadius: 8, padding: '9px 11px' }}>
          <Note k="info">
            A Power BI dashboard sits in a frame on another origin, so nothing in this
            app can capture it. Open the dashboard, take a screenshot, and attach it
            here &mdash; it is embedded in the Word document beside its citation and on
            the workbook&rsquo;s BI reports sheet. Attachments are not saved: they apply
            to this export only.
          </Note>
          <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
            {biReports.map(b => {
              const img = images[b.id];
              return <div key={b.id} style={{ display: 'flex', alignItems: 'center',
                                              gap: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 12.5 }}>{b.name}</span>
                {img
                  ? <>
                      <span className="holder" style={{ fontSize: 11.5 }}>
                        {img.name}{img.width ? ` \u00b7 ${img.width}\u00d7${img.height}` : ''}</span>
                      <Btn k="sm" onClick={() => setImages(m => {
                        const next = { ...m }; delete next[b.id]; return next; })}>Remove</Btn>
                    </>
                  : <input type="file" accept="image/png,image/jpeg"
                      style={{ fontSize: 11.5 }}
                      onChange={e => { pick(b.id, e.target.files?.[0]); e.target.value = ''; }}/>}
              </div>;
            })}
          </div>
        </div>
      : null}
  </div>;
}
