/* =========================================================================
   Meeting Setups -> one Excel workbook (06 Oct, Governance Setup).

   A pure writer, like reportWriters.js: it takes ready-made rows and touches
   no Dataverse and no React. GovernanceApp.jsx builds the rows (it holds the
   Position, unit, Region and Channel lookups) and calls exportMeetingSetups().

   Layout, as agreed with the user:
     - an "About" sheet (when, by whom, counts, anything not exported);
     - ONE SHEET PER STAGE (Stage 1 … Stage 4), each with one row per
       Business Unit / Region of a Setup (one row for a group-wide Setup);
     - agenda items and attendees as numbered lists inside one cell.
   Written with ExcelJS (SheetJS cannot style cells), loaded on demand.
   ========================================================================= */

/* The app's palette (theme.css), as ARGB -- same as reportWriters.js. */
const XL = { head:'FF452F1B', onDark:'FFFFFFFF', band:'FFF1E6D4', rule:'FFD8CBB4', ink:'FF211C1E', muted:'FF8A8079' };

/* Excel refuses to open a workbook holding a cell longer than 32,767 characters. */
const CELL_MAX = 32767;
const cellText = v => {
  const t = v === null || v === undefined ? '' : String(v);
  return t.length > CELL_MAX ? t.slice(0, CELL_MAX - 30) + '… [truncated to fit Excel]' : t;
};

/** The Committee Meeting Name, as the user's Excel rule builds it (06 Oct):
 *    =IF(COUNTA([@[New Classification]]:[@Frequency])=0,"",
 *       IF([@BU]<>"", [@BU]&"_"&[@Region]&"_"&[@Frequency],
 *          [@Department]&IF([@Region]<>"","_"&[@Region],"")&"_"&[@Frequency])
 *       &" | "&[@[New Classification]]&"_"&[@[New Category]])
 *  Blank when every input is blank. */
export function committeeMeetingName({ bu='', region='', department='', frequency='', classification='', category='' }){
  const t = v => String(v ?? '').trim();
  const [b, r, d, f, cl, ca] = [bu, region, department, frequency, classification, category].map(t);
  if(![b, r, d, f, cl, ca].some(Boolean)) return '';
  const head = b ? `${b}_${r}_${f}` : `${d}${r ? '_'+r : ''}_${f}`;
  return `${head} | ${cl}_${ca}`;
}

/** The columns of every stage sheet, in order. `key` is the row field. */
export const MEETING_SETUP_COLUMNS = [
  { key:'committeeName', header:'Committee Meeting Name',  width:48 },
  { key:'setupType',   header:'Setup Type',               width:22 },
  { key:'classification', header:'Type / Classification', width:26 },
  { key:'category',    header:'Category',                 width:30 },
  { key:'frequency',   header:'Frequency',                width:15 },
  { key:'schedule',    header:'Schedule',                 width:24 },
  { key:'mode',        header:'Default Mode',             width:13 },
  { key:'unit',        header:'Business Unit / Region',   width:28 },
  { key:'unitRegion',  header:'Region of the Unit',       width:18 },
  { key:'chairman',    header:'Chairman',                 width:34 },
  { key:'coChairman',  header:'Co-Chairman',              width:34 },
  { key:'facilitator', header:'Facilitator',              width:34 },
  { key:'channel',     header:'Team › Channel',           width:30 },
  { key:'attendeeCount', header:'Attendees (count)',      width:11 },
  { key:'attendees',   header:'Attendees',                width:52 },
  { key:'departments', header:'Departments & Functions',  width:38 },
  { key:'agendaCount', header:'Agenda Items (count)',     width:11 },
  { key:'agenda',      header:'Meeting Agenda',           width:60 },
  { key:'supportive',  header:'Supportive Functions',     width:30 },
  { key:'linkedReports', header:'Linked Reports',         width:36 },
  { key:'tor',         header:'TOR / Policy Link',        width:36 },
];

/**
 * @param {{name:string, rows:object[]}[]} sheets  one per stage, in order
 * @param {{exportedAt:string, exportedBy?:string, skipped?:string[]}} meta
 * @returns {Promise<Blob>}
 */
export async function meetingSetupsToXlsx(sheets, meta){
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Andalusia Pulse · Governance Setup';
  wb.created = new Date();

  /* ---- About ----------------------------------------------------------- */
  const about = wb.addWorksheet('About');
  about.columns = [{ width:34 }, { width:70 }];
  const t = about.addRow(['Meeting Setups export']);
  t.font = { bold:true, size:16, color:{ argb:XL.ink } };
  about.addRow([]);
  const kv = (k, v) => {
    const r = about.addRow([k, cellText(v)]);
    r.getCell(1).font = { bold:true, color:{ argb:XL.muted } };
    r.getCell(2).alignment = { wrapText:true, vertical:'top' };
  };
  kv('Exported', meta.exportedAt);
  if(meta.exportedBy) kv('Exported by', meta.exportedBy);
  kv('Layout', 'One sheet per Stage. One row per Business Unit or Region of a Setup '
    + '(one row for a group-wide Setup). Agenda and attendees are numbered lists in one cell.');
  const total = new Set(sheets.flatMap(s => s.rows.map(r => r._setupId))).size;
  kv('Meeting Setups', String(total));
  for(const s of sheets) kv(s.name, `${new Set(s.rows.map(r => r._setupId)).size} Setup(s), ${s.rows.length} row(s)`);
  if(meta.skipped?.length){
    about.addRow([]);
    kv('Not exported', meta.skipped.join('\n'));
  }

  /* ---- one sheet per stage --------------------------------------------- */
  for(const s of sheets){
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views:[{ state:'frozen', xSplit:1, ySplit:1 }] });
    ws.columns = MEETING_SETUP_COLUMNS.map(c => ({ key:c.key, width:c.width }));
    const head = ws.addRow(MEETING_SETUP_COLUMNS.map(c => c.header));
    head.height = 30;
    head.eachCell(c => {
      c.font = { bold:true, color:{ argb:XL.onDark } };
      c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:XL.head } };
      c.alignment = { vertical:'middle', wrapText:true };
      c.border = { bottom:{ style:'thin', color:{ argb:XL.rule } } };
    });
    if(!s.rows.length){
      ws.addRow(['No Meeting Setup at this stage.']).getCell(1).font = { italic:true, color:{ argb:XL.muted } };
      continue;
    }
    let prevSetup = null, band = false;
    for(const r of s.rows){
      if(r._setupId !== prevSetup){ band = !band; prevSetup = r._setupId; }   // band per Setup, not per row
      const row = ws.addRow(MEETING_SETUP_COLUMNS.map(c => {
        const v = r[c.key];
        return typeof v === 'number' ? v : cellText(v);
      }));
      row.eachCell({ includeEmpty:true }, c => {
        c.alignment = { vertical:'top', wrapText:true };
        c.border = { bottom:{ style:'hair', color:{ argb:XL.rule } } };
        if(band) c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:XL.band } };
      });
    }
    ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:1, column:MEETING_SETUP_COLUMNS.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Writes the workbook and hands it to the browser as a download. A blob: URL
 *  and a synthetic click -- nothing navigates the Power Apps frame -- revoked
 *  on a timer, since revoking at once can cancel the download. */
export async function exportMeetingSetups(sheets, meta){
  const blob = await meetingSetupsToXlsx(sheets, meta);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const filename = `Meeting Setups ${stamp}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { filename };
}
