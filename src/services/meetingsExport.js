/* =========================================================================
   Meetings & Committees -> one Excel workbook (06 Oct, Leadership Execution).

   A pure writer, like meetingSetupExport.js (Governance): it takes ready-made
   rows and touches no Dataverse and no React. LeadershipApp.jsx builds the
   rows from what the Meetings screen shows (tab, chips, Stage, My role and
   search applied) and calls exportMeetings().

   Layout, as agreed with the user:
     - "About"         when, by whom, the filters used, counts;
     - "Meetings"      one row per meeting (the columns the old CSV had);
     - "Agenda Items"  one row per agenda item;
     - "Attendees"     one row per attendee;
     - "Decisions"     one row per decision raised on an agenda item;
     - "Tasks"         one row per Task linked to the meeting or an item.
   Every detail row starts with the meeting's name and date, and rows are
   banded per meeting so one meeting's lines read as a block.
   Written with ExcelJS (SheetJS cannot style cells), loaded on demand.
   ========================================================================= */

/* The app's palette (theme.css), as ARGB -- same as meetingSetupExport.js. */
const XL = { head:'FF452F1B', onDark:'FFFFFFFF', band:'FFF1E6D4', rule:'FFD8CBB4', ink:'FF211C1E', muted:'FF8A8079' };

/* Excel refuses to open a workbook holding a cell longer than 32,767 characters. */
const CELL_MAX = 32767;
const cellText = v => {
  const t = v === null || v === undefined ? '' : String(v);
  return t.length > CELL_MAX ? t.slice(0, CELL_MAX - 30) + '… [truncated to fit Excel]' : t;
};
/* 'YYYY-MM-DD' (or an ISO stamp) -> a real Excel date, so the column sorts
   and filters as dates. Anything else stays as text. */
const asDate = v => {
  const m = typeof v === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};

/* Column sets. `date:true` writes a real date; `num:true` keeps a number. */
const MEETING = { key:'meeting', header:'Meeting', width:42 };
const MDATE   = { key:'meetingDate', header:'Meeting Date', width:13, date:true };

export const MEETINGS_SHEETS = {
  Meetings: [
    MEETING,
    { key:'setup',      header:'Setup',             width:36 },
    { key:'setupType',  header:'Setup Type',        width:20 },
    { key:'department', header:'Department',        width:26 },
    { key:'scope',      header:'Scope',             width:22 },
    { key:'stage',      header:'Stage',             width:26 },
    { key:'date',       header:'Date',              width:13, date:true },
    { key:'start',      header:'Start',             width:8  },
    { key:'end',        header:'End',               width:8  },
    { key:'mode',       header:'Mode',              width:11 },
    { key:'agendaCount',   header:'Agenda Items',   width:10, num:true },
    { key:'agendaCovered', header:'Agenda Covered', width:10, num:true },
    { key:'attendeeCount', header:'Attendees',      width:10, num:true },
    { key:'presentCount',  header:'Present',        width:10, num:true },
    { key:'chair',      header:'Chair',             width:34 },
    { key:'organizer',  header:'Organizer',         width:34 },
    { key:'status',     header:'Status',            width:12 },
  ],
  'Agenda Items': [
    MEETING, MDATE,
    { key:'seq',     header:'#',           width:5, num:true },
    { key:'title',   header:'Agenda Item', width:52 },
    { key:'owner',   header:'Owner',       width:34 },
    { key:'source',  header:'Source',      width:18 },
    { key:'covered', header:'Covered',     width:16 },
  ],
  Attendees: [
    MEETING, MDATE,
    { key:'position', header:'Position',           width:40 },
    { key:'holder',   header:'Current Employee',   width:28 },
    { key:'type',     header:'Required / Optional', width:13 },
    { key:'delegate', header:'Delegate',           width:34 },
    { key:'present',  header:'Attendance',         width:16 },
  ],
  Decisions: [
    MEETING, MDATE,
    { key:'agendaItem', header:'Agenda Item',     width:40 },
    { key:'name',       header:'Decision',        width:40 },
    { key:'taken',      header:'Decision Taken',  width:52 },
    { key:'output',     header:'Expected Output', width:40 },
    { key:'status',     header:'Status',          width:16 },
    { key:'created',    header:'Raised On',       width:13, date:true },
  ],
  Tasks: [
    MEETING, MDATE,
    { key:'agendaItem', header:'Agenda Item', width:40 },
    { key:'code',       header:'Task Code',   width:14 },
    { key:'name',       header:'Task',        width:44 },
    { key:'assignee',   header:'Assignee',    width:28 },
    { key:'status',     header:'Status',      width:16 },
    { key:'priority',   header:'Priority',    width:11 },
    { key:'start',      header:'Start',       width:13, date:true },
    { key:'due',        header:'Due',         width:13, date:true },
    { key:'delayed',    header:'Delayed',     width:16 },
  ],
};

const EMPTY_TEXT = {
  Meetings: 'No meetings in this view.',
  'Agenda Items': 'These meetings have no agenda items.',
  Attendees: 'These meetings have no attendees.',
  Decisions: 'No decisions were raised on these meetings’ agenda items.',
  Tasks: 'No Tasks are linked to these meetings.',
};

/**
 * @param {{[sheet:string]: object[]}} data  rows per sheet name (MEETINGS_SHEETS keys);
 *        detail rows carry `_meetingId` so they band per meeting
 * @param {{exportedAt:string, exportedBy?:string, view?:[string,string][], notes?:string[]}} meta
 * @returns {Promise<Blob>}
 */
export async function meetingsToXlsx(data, meta){
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Andalusia Pulse · Leadership Execution';
  wb.created = new Date();

  /* ---- About ----------------------------------------------------------- */
  const about = wb.addWorksheet('About');
  about.columns = [{ width:26 }, { width:80 }];
  const t = about.addRow(['Meetings & Committees export']);
  t.font = { bold:true, size:16, color:{ argb:XL.ink } };
  about.addRow([]);
  const kv = (k, v) => {
    const r = about.addRow([k, cellText(v)]);
    r.getCell(1).font = { bold:true, color:{ argb:XL.muted } };
    r.getCell(2).alignment = { wrapText:true, vertical:'top' };
  };
  kv('Exported', meta.exportedAt);
  if(meta.exportedBy) kv('Exported by', meta.exportedBy);
  for(const [k, v] of (meta.view || [])) kv(k, v);
  about.addRow([]);
  for(const name of Object.keys(MEETINGS_SHEETS)) kv(name, `${(data[name] || []).length} row(s)`);
  if(meta.notes?.length){
    about.addRow([]);
    kv('Notes', meta.notes.join('\n'));
  }

  /* ---- data sheets ----------------------------------------------------- */
  for(const [name, cols] of Object.entries(MEETINGS_SHEETS)){
    const rows = data[name] || [];
    const ws = wb.addWorksheet(name, { views:[{ state:'frozen', xSplit:1, ySplit:1 }] });
    ws.columns = cols.map(c => ({ key:c.key, width:c.width }));
    const head = ws.addRow(cols.map(c => c.header));
    head.height = 30;
    head.eachCell(c => {
      c.font = { bold:true, color:{ argb:XL.onDark } };
      c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:XL.head } };
      c.alignment = { vertical:'middle', wrapText:true };
      c.border = { bottom:{ style:'thin', color:{ argb:XL.rule } } };
    });
    if(!rows.length){
      ws.addRow([EMPTY_TEXT[name]]).getCell(1).font = { italic:true, color:{ argb:XL.muted } };
      continue;
    }
    let prev = null, band = false;
    rows.forEach((r, i) => {
      /* The Meetings sheet bands every other row; the detail sheets band per meeting. */
      const group = name === 'Meetings' ? i : r._meetingId;
      if(group !== prev){ band = !band; prev = group; }
      const row = ws.addRow(cols.map(c => {
        const v = r[c.key];
        if(c.date) return asDate(v) || cellText(v);
        if(c.num) return typeof v === 'number' ? v : (v === null || v === undefined || v === '' ? '' : cellText(v));
        return cellText(v);
      }));
      row.eachCell({ includeEmpty:true }, (c, n) => {
        c.alignment = { vertical:'top', wrapText:true };
        c.border = { bottom:{ style:'hair', color:{ argb:XL.rule } } };
        if(band) c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:XL.band } };
        if(cols[n - 1]?.date && c.value instanceof Date) c.numFmt = 'dd mmm yyyy';
      });
    });
    ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:1, column:cols.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Writes the workbook and hands it to the browser as a download. A blob: URL
 *  and a synthetic click -- nothing navigates the Power Apps frame -- revoked
 *  on a timer, since revoking at once can cancel the download. */
export async function exportMeetings(data, meta, label = 'Meetings'){
  const blob = await meetingsToXlsx(data, meta);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const filename = `${label} ${stamp}.xlsx`.replace(/[\\/:*?"<>|]+/g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { filename };
}
