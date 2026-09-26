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
import React, { useState } from 'react';
import { use } from '../store.jsx';
import { Btn } from '../../../shared/ui.jsx';
import { exportReport } from '../../../services/reportExport.js';

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
  /* { format, label } while one is running -- also what disables both buttons,
     so a second click cannot start a parallel export of the same report. */
  const [busy, setBusy] = useState(null);

  const run = async format => {
    if(busy) return;
    setBusy({ format, label: 'Reading what this report cites…' });
    try{
      const { filename, warnings } = await exportReport({
        report, sections, citations, lookups: dvLookup, format, extraWarnings,
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
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
    <span className="tset-lbl">Export</span>
    <Btn k="sm" disabled={off} onClick={() => run('xlsx')}>
      {busy?.format === 'xlsx' ? 'Excel…' : 'Excel'}</Btn>
    <Btn k="sm" disabled={off} onClick={() => run('docx')}>
      {busy?.format === 'docx' ? 'Word…' : 'Word'}</Btn>
    {/* The build is several round trips on a report citing many KPIs, so it
        says where it has got to rather than only that it is busy. */}
    {busy ? <span className="holder" style={{ fontSize: 11.5 }}>{busy.label}</span> : null}
  </div>;
}
