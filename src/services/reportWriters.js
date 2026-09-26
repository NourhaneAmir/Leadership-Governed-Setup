/* =========================================================================
   Report writers -- an export model laid out as .xlsx or .docx.

   Split from reportExport.js deliberately: these two functions touch no
   service, no Dataverse and no React, so they can be exercised on a
   hand-built model in plain Node. The module that DOES read Dataverse
   (reportExport.js) imports them.

   The workbook is written with ExcelJS and the document with docx, both
   loaded on demand. ⚠️ SheetJS (the xlsx package this repo also carries) is
   NOT an option for the workbook: its community build cannot write a fill, a
   font or a table style at all. It stays the reader for uploaded workbooks.

   ⚠️ Neither writer can embed a BI dashboard screenshot, and the reason is a
   browser security boundary rather than a missing library -- reportExport.js
   states it in full. Both take an optional biImages map, so the day a PNG
   exists (Power BI exportToFile via a flow, stored against the BI report row)
   it is embedded with no other change.
   ========================================================================= */

/* Both writers show "not recorded" differently -- Excel leaves the cell EMPTY
   so a column of actuals still sums, Word prints an em dash because nothing
   in a document adds up. Neither may print 0 for a missing figure. */
const DASH = '—';

const txt = v => (v === null || v === undefined || v === '') ? '' : String(v);
const dsh = v => (v === null || v === undefined || v === '') ? DASH : String(v);

/* ============================================================ .xlsx ==== */

/* ⚠️ WRITTEN WITH ExcelJS, NOT SheetJS, AND THAT IS NOT INTERCHANGEABLE.
   SheetJS's community build cannot write a fill, a font or a table style at
   all -- cell styling is a Pro feature -- so a styled workbook is not a
   matter of passing more options to it. ExcelJS also gives real Excel TABLE
   objects, which is what puts filter dropdowns and banded rows in the file
   rather than a hand-coloured imitation of them.

   `xlsx` is still the right tool for READING an uploaded workbook (FilePreview
   and the checklist proof of concept), so both live here, each loaded on
   demand and never in the same flow. */

/* The app's own palette (src/theme.css), as ARGB. Deliberately not Excel's
   default blue: this file leaves the app and should still look like it came
   from it. `--teal` in the stylesheet is a warm gold despite the name. */
const XL = {
  titleBg: 'FF452F1B',  // --teal-dd
  bandBg:  'FF6B4E30',  // --teal-d
  onDark:  'FFFFFFFF',
  subBg:   'FFF1E6D4',  // --teal-l
  noteBg:  'FFFBF7F0',  // --teal-ll
  ink:     'FF211C1E',  // --ink
  muted:   'FF8A8079',  // --muted
  rule:    'FFD8CBB4',  // --border-d
  link:    'FF6B4E30',
};

/* ⚠️ Excel REFUSES TO OPEN a workbook containing a cell longer than 32,767
   characters. The file downloads and then fails with "the file format or file
   extension is not valid" -- it looks like a corrupt download, but it is this.
   SheetJS tolerated over-long strings when reading one back, so a round-trip
   test does NOT catch it; only Excel does. Every string reaching a cell goes
   through cellText(). */
const XL_CELL_MAX = 32767;
const TRUNCATED = '… [truncated to fit Excel]';
const cellText = v => {
  const t = txt(v);
  return t.length > XL_CELL_MAX
    ? t.slice(0, XL_CELL_MAX - TRUNCATED.length) + TRUNCATED
    : t;
};
/* Table rows carry numbers as well as text; only the text needs clamping, and
   a number must stay a number or the column stops summing. */
const cellRow = row => row.map(v => (typeof v === 'string' ? cellText(v) : v));

/* Up to two decimals, trailing zeros hidden -- 95 stays "95", 84.25 stays
   "84.25". A fixed 0.00 would print every integer target as "95.00". */
const NUMFMT = '#,##0.##';

/* Excel forbids \ / ? * [ ] : in a sheet name, caps it at 31 characters, will
   not take a leading or trailing apostrophe, and reserves "History". A
   collision is resolved with a numeric suffix rather than silently dropping a
   sheet -- two sections may legitimately share a heading. */
function sheetName(raw, used){
  let base = String(raw || 'Section')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31)
    /* trim AGAIN: slicing a long heading can leave a trailing space, which
       Excel accepts but silently renames. */
    .trim() || 'Section';
  if(base.toLowerCase() === 'history') base = 'History (section)';
  let out = base, n = 1;
  while(used.has(out.toLowerCase())){
    const suf = ` (${++n})`;
    out = base.slice(0, 31 - suf.length).trim() + suf;
  }
  used.add(out.toLowerCase());
  return out;
}

/* An Excel table name is an identifier, not a label: no spaces, must start
   with a letter, and unique across the WORKBOOK. Generated rather than
   derived from a heading, because a heading guarantees none of that. */
function tableNamer(){
  let n = 0;
  return () => `Pulse_T${++n}`;
}

/* ---- the row vocabulary ------------------------------------------------
   Five kinds of row, so every sheet is laid out from the same parts and a
   reader learns the pattern once: a title band, a section band, a key/value
   pair, a wrapped note, and a real table. */

function xlTitle(ws, text, span, sub){
  const r = ws.addRow([cellText(text)]);
  ws.mergeCells(r.number, 1, r.number, span);
  const c = r.getCell(1);
  c.font = { bold: true, size: 14, color: { argb: XL.onDark }, name: 'Calibri' };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.titleBg } };
  c.alignment = { vertical: 'middle' };
  r.height = 24;
  if(sub){
    const s = ws.addRow([cellText(sub)]);
    ws.mergeCells(s.number, 1, s.number, span);
    const sc = s.getCell(1);
    sc.font = { italic: true, size: 10, color: { argb: XL.muted }, name: 'Calibri' };
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.noteBg } };
    sc.alignment = { vertical: 'middle' };
  }
}

function xlBand(ws, text, span){
  const r = ws.addRow([cellText(text)]);
  ws.mergeCells(r.number, 1, r.number, span);
  const c = r.getCell(1);
  c.font = { bold: true, size: 11, color: { argb: XL.onDark }, name: 'Calibri' };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.bandBg } };
  c.alignment = { vertical: 'middle' };
  r.height = 19;
  return r.number;
}

function xlKv(ws, key, value, span){
  const r = ws.addRow([cellText(key), cellText(value)]);
  const k = r.getCell(1);
  k.font = { bold: true, size: 10, color: { argb: XL.ink }, name: 'Calibri' };
  k.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.subBg } };
  k.border = { right: { style: 'thin', color: { argb: XL.rule } } };
  if(span > 2) ws.mergeCells(r.number, 2, r.number, span);
  const v = r.getCell(2);
  v.font = { size: 10, color: { argb: XL.ink }, name: 'Calibri' };
  v.alignment = { vertical: 'top', wrapText: true };
  return r;
}

/* A wrapped paragraph. Merged cells do NOT auto-fit in Excel, so the height is
   estimated from the text -- a long objective that is invisible because the row
   stayed 15px tall is worse than one that is slightly over-tall. */
function xlNote(ws, text, span, opt = {}){
  const r = ws.addRow([cellText(text)]);
  ws.mergeCells(r.number, 1, r.number, span);
  const c = r.getCell(1);
  c.font = { size: 10, italic: !!opt.italic,
             color: { argb: opt.italic ? XL.muted : XL.ink }, name: 'Calibri' };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.noteBg } };
  c.alignment = { wrapText: true, vertical: 'top' };
  const perLine = Math.max(40, (Number(span) || 1) * 26);
  const lines = String(cellText(text)).split(/\r?\n/)
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  /* Never let this reach NaN: ExcelJS writes the row height straight into
     the XML, and ht="NaN" is an invalid attribute Excel rejects. */
  const h = Math.min(320, Math.max(15, lines * 13));
  r.height = Number.isFinite(h) ? h : 15;
  return r;
}

function xlBlank(ws){ ws.addRow([]); }

/** A real Excel table: banded rows, filter dropdowns, a named style.
 *
 *  ⚠️ A table with no data rows is not written as a table. Excel tolerates an
 *  empty one poorly and a reader gains nothing from a header with a filter
 *  over no rows, so an explanatory note takes its place -- which is also the
 *  only way to say WHY it is empty.
 *
 *  `numeric` lists 0-based column indexes to right-align and number-format, so
 *  a column of figures reads as a column and a null stays visibly blank.
 *  `links` maps a row index to { col, url } for a hyperlink inside the table.
 */
function xlTable(ws, { name, columns, rows, empty, numeric = [], links = [],
                       theme = 'TableStyleMedium1', span }){
  if(!rows.length){
    xlNote(ws, empty || 'Nothing to show here.', span || columns.length, { italic: true });
    return;
  }
  const at = ws.rowCount + 1;
  ws.addTable({
    name,
    ref: `A${at}`,
    headerRow: true,
    totalsRow: false,
    style: { theme, showRowStripes: true },
    columns: columns.map(c => ({ name: cellText(c), filterButton: true })),
    rows: rows.map(cellRow),
  });
  /* Styling inside a table is applied cell-wise after the fact: the table
     style owns banding and the header, not alignment or number format. */
  for(let i = 0; i < rows.length; i++){
    const row = ws.getRow(at + 1 + i);
    for(const ci of numeric){
      const cell = row.getCell(ci + 1);
      cell.numFmt = NUMFMT;
      /* ⚠️ Per CELL, never row.alignment -- assigning to a row's alignment in
         ExcelJS applies it to every cell in that row, which silently undoes
         the right-alignment set here. */
      cell.alignment = { horizontal: 'right' };
    }
  }
  for(const { row, col, url } of links){
    if(!url) continue;
    const cell = ws.getRow(at + 1 + row).getCell(col + 1);
    cell.value = { text: cellText(cell.value ?? url), hyperlink: url };
    cell.font = { size: 10, color: { argb: XL.link }, underline: true, name: 'Calibri' };
  }
  return at;
}

/* Freezes everything written so far, so the title bands stay put while the
   data scrolls. Called once per sheet, after the headings exist. */
const xlFreeze = (ws, rows) => { ws.views = [{ state: 'frozen', ySplit: rows }]; };

/** One Report Occurrence as a styled workbook.
 *
 *  A sheet per section, as asked, plus five cross-cutting sheets -- a
 *  per-section sheet is right for reading one section and useless for totalling
 *  a figure across the report, so both shapes are present.
 *
 *  @param {object} model from buildReportExportModel()
 *  @param {object} [biImages] { [biId]: {base64} } -- reserved; see the header
 *  @returns {Promise<Blob>}
 */
export async function reportToXlsx(model, biImages){
  /* ⚠️ Dynamic, and it has to stay dynamic. ExcelJS is ~930kB; a static import
     would put it in the MAIN chunk, which every page load would then pay for.
     The same rule the xlsx readers already follow. */
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Andalusia Pulse · Leadership Practice';
  wb.created = new Date();

  const used = new Set();
  const tname = tableNamer();
  const r = model.report;

  /* ---- cover ---------------------------------------------------------- */
  {
    const ws = wb.addWorksheet(sheetName('Report', used), {
      properties: { tabColor: { argb: XL.titleBg } },
    });
    ws.columns = [{ width: 26 }, { width: 30 }, { width: 22 }, { width: 22 }];
    xlTitle(ws, r.name,
      [r.periodLabel, r.status, r.version != null ? 'v' + r.version : null]
        .filter(Boolean).join('   ·   '), 4);
    xlFreeze(ws, 2);
    xlBlank(ws);

    xlBand(ws, 'The report', 4);
    xlKv(ws, 'Period', txt(r.periodLabel), 4);
    xlKv(ws, 'Status', txt(r.status), 4);
    xlKv(ws, 'Version', r.version ?? '', 4);
    xlKv(ws, 'Stage', txt(r.stage), 4);
    xlKv(ws, 'Review step', r.reviewStep ?? '', 4);
    xlKv(ws, 'Locked', r.locked ? 'Yes' : 'No', 4);
    xlKv(ws, 'From a Setup', r.noSetup ? 'No — Ad Hoc' : 'Yes', 4);
    xlKv(ws, 'Report Setup', txt(r.templateName), 4);
    xlBlank(ws);

    xlBand(ws, 'Organizational placement', 4);
    xlKv(ws, 'Business Unit', txt(r.businessUnitName), 4);
    xlKv(ws, 'Region', txt(r.regionName), 4);
    xlKv(ws, 'Department', txt(r.departmentName), 4);
    xlKv(ws, 'Function', txt(r.functionName), 4);
    xlKv(ws, 'Created by (Position)', txt(r.creatorPositionName), 4);
    xlBlank(ws);

    xlBand(ws, 'Objective', 4);
    xlNote(ws, r.objective || 'No objective recorded.', 4, { italic: !r.objective });
    xlBlank(ws);

    xlBand(ws, 'What is inside', 4);
    xlTable(ws, {
      name: tname(), span: 4,
      columns: ['Sheet', 'Count', 'What it holds'],
      numeric: [1],
      rows: [
        ['One per section', model.sections.length,
         'Its body, citations, KPI figures, breakdown members and dashboards'],
        ['KPI figures', model.sections.reduce((n, s) => n + s.citations.filter(c => c.kpi).length, 0),
         'Every cited KPI across the report, for filtering and totalling'],
        ['Breakdowns', model.sections.reduce((n, s) => n + s.citations.reduce((m, c) => m + c.members.length, 0), 0),
         'One row per breakdown member'],
        ['Citations', model.sections.reduce((n, s) => n + s.citations.length, 0),
         'Every citation of every kind, with all of its metadata'],
        ['BI reports', model.biReports.length,
         'Each dashboard cited, with a link that opens it'],
      ],
    });
    xlBlank(ws);

    xlBand(ws, 'Dates', 4);
    xlKv(ws, 'Created', txt(r.created), 4);
    xlKv(ws, 'Last modified', txt(r.modified), 4);
    xlKv(ws, 'Exported', model.generatedAt, 4);
    if(r.fileUrl){
      const row = xlKv(ws, 'Attached file', r.fileUrl, 4);
      const c = row.getCell(2);
      c.value = { text: r.fileUrl, hyperlink: r.fileUrl };
      c.font = { size: 10, color: { argb: XL.link }, underline: true, name: 'Calibri' };
    }

    if(model.warnings.length){
      xlBlank(ws);
      xlBand(ws, `Notes on this export (${model.warnings.length})`, 4);
      for(const w of model.warnings) xlNote(ws, '•  ' + w, 4);
    }

    xlBlank(ws);
    xlBand(ws, 'How to read a blank figure', 4);
    xlNote(ws, 'A blank cell means nothing is recorded in Dataverse for it. Blank is used '
             + 'rather than a dash so that a column of figures still sums — a dash would '
             + 'turn the whole column into text. A blank is never a zero.', 4, { italic: true });
  }

  /* ---- a sheet per section -------------------------------------------- */
  model.sections.forEach((s, i) => {
    const ws = wb.addWorksheet(sheetName(`${i + 1}. ${s.heading}`, used));
    ws.columns = [{ width: 34 }, { width: 26 }, { width: 30 }, { width: 18 },
                  { width: 16 }, { width: 16 }, { width: 28 }];
    xlTitle(ws, `${i + 1}. ${s.heading}`,
      [s.angle, s.source, s.author, s.sequence != null ? 'order ' + s.sequence : null]
        .filter(Boolean).join('   ·   '), 7);
    xlFreeze(ws, 2);
    xlBlank(ws);

    xlBand(ws, 'Body', 7);
    xlNote(ws, s.body || 'This section has no body text.', 7, { italic: !s.body });
    xlBlank(ws);

    if(!s.citations.length){
      xlBand(ws, 'Citations', 7);
      xlNote(ws, 'No citations on this section.', 7, { italic: true });
    }else{
      xlBand(ws, `Citations (${s.citations.length})`, 7);
      const links = [];
      const rows = s.citations.map((c, ri) => {
        const ref = c.kpi?.name || c.process?.name || c.project?.name
                 || c.task?.name || c.poc?.name || c.strategy?.name
                 || c.childReport?.name || c.bi?.name || '';
        if(c.bi?.link) links.push({ row: ri, col: 2, url: c.bi.link });
        const detail = [
          c.project && [c.project.status, c.project.category, c.project.buName,
                        c.project.deptName].filter(Boolean).join(' · '),
          c.task && [c.task.status, c.task.priority,
                     c.task.assigneeName && 'to ' + c.task.assigneeName,
                     c.task.due && 'due ' + c.task.due].filter(Boolean).join(' · '),
          c.process && c.process.departmentName,
          c.poc && [c.poc.status, c.poc.target != null && 'target ' + c.poc.target]
                     .filter(Boolean).join(' · '),
          c.kpi && (c.kpi.recorded ? `matched on ${c.kpi.matchedOn}` : 'no achievement recorded'),
        ].filter(Boolean).join(' | ');
        return [c.kind, c.label, ref, c.dimension || '', detail];
      });
      xlTable(ws, { name: tname(), span: 7, links,
        columns: ['Kind', 'Label', 'Reference', 'Dimension', 'Detail'], rows });

      const kpis = s.citations.filter(c => c.kpi);
      if(kpis.length){
        xlBlank(ws);
        xlBand(ws, 'KPI figures', 7);
        xlTable(ws, { name: tname(), span: 7, numeric: [2, 3, 4, 5],
          columns: ['KPI', 'Dimension', 'Baseline', 'Actual', 'Target', 'Historical', 'Matched on'],
          rows: kpis.map(c => [c.kpi.name, c.dimension || '', c.kpi.baseline, c.kpi.actual,
                               c.kpi.target, c.kpi.historical,
                               c.kpi.recorded ? c.kpi.matchedOn : 'no achievement recorded']) });
      }

      for(const c of s.citations.filter(c => c.dimension)){
        xlBlank(ws);
        xlBand(ws, `Breakdown — ${c.kpi?.name || c.label} by ${c.dimension}`, 7);
        xlTable(ws, { name: tname(), span: 7, numeric: [1, 2, 3, 4],
          columns: ['Member', 'Actual', 'Target', 'Baseline', 'Historical'],
          rows: c.members.map(m => [m.member, m.actual, m.target, m.baseline, m.historical]),
          empty: c.kpi?.recorded
            ? 'No breakdown rows are recorded for this dimension.'
            : 'No achievement matched this report, so no members could be read.' });
      }

      const secBis = s.citations.filter(c => c.bi);
      if(secBis.length){
        xlBlank(ws);
        xlBand(ws, 'BI dashboards', 7);
        xlTable(ws, { name: tname(), span: 7,
          links: secBis.map((c, ri) => ({ row: ri, col: 2, url: c.bi.link })),
          columns: ['Report', 'Behind KPI', 'Link', 'Screenshot'],
          rows: secBis.map(c => [c.bi.name, c.bi.kpiName || '', c.bi.link || '',
            biImages?.[c.bi.id] ? 'embedded' : 'not embedded — see the BI reports sheet']) });
      }
    }
  });

  /* ---- cross-cutting: every KPI figure in the report ------------------ */
  {
    const ws = wb.addWorksheet(sheetName('KPI figures', used));
    ws.columns = [{ width: 30 }, { width: 14 }, { width: 34 }, { width: 16 },
                  { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
                  { width: 30 }, { width: 16 }, { width: 11 }];
    xlTitle(ws, 'Every KPI cited in this report',
      'A blank figure means nothing is recorded in Dataverse — never a zero.', 11);
    xlFreeze(ws, 3);
    const rows = [];
    for(const s of model.sections)
      for(const c of s.citations.filter(c => c.kpi))
        rows.push([s.heading, c.kind, c.kpi.name, c.dimension || '',
                   c.kpi.baseline, c.kpi.actual, c.kpi.target, c.kpi.historical,
                   c.kpi.recorded ? c.kpi.matchedOn : '', c.kpi.period || '',
                   c.kpi.recorded ? 'Yes' : 'No']);
    xlTable(ws, { name: tname(), span: 11, numeric: [4, 5, 6, 7],
      theme: 'TableStyleMedium2',
      columns: ['Section', 'Kind', 'KPI', 'Dimension', 'Baseline', 'Actual', 'Target',
                'Historical', 'Matched on', 'Period', 'Recorded'],
      rows, empty: 'This report cites no KPI.' });
  }

  /* ---- cross-cutting: every breakdown member ------------------------- */
  {
    const ws = wb.addWorksheet(sheetName('Breakdowns', used));
    ws.columns = [{ width: 30 }, { width: 34 }, { width: 16 }, { width: 34 },
                  { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];
    xlTitle(ws, 'Breakdown members',
      'One row per member of every Breakdown citation in this report.', 8);
    xlFreeze(ws, 3);
    const rows = [];
    for(const s of model.sections)
      for(const c of s.citations.filter(c => c.dimension))
        for(const m of c.members)
          rows.push([s.heading, c.kpi?.name || c.label, c.dimension, m.member,
                     m.actual, m.target, m.baseline, m.historical]);
    xlTable(ws, { name: tname(), span: 8, numeric: [4, 5, 6, 7],
      theme: 'TableStyleMedium2',
      columns: ['Section', 'KPI', 'Dimension', 'Member', 'Actual', 'Target',
                'Baseline', 'Historical'],
      rows, empty: 'No breakdown members were read for this report.' });
  }

  /* ---- cross-cutting: every citation, all metadata ------------------- */
  {
    const ws = wb.addWorksheet(sheetName('Citations', used));
    const widths = [26, 14, 30, 14, 30, 26, 22, 28, 16, 18, 20, 20, 28, 14, 13,
                    22, 12, 12, 26, 14, 12, 26, 26, 28, 40];
    ws.columns = widths.map(width => ({ width }));
    xlTitle(ws, 'Every citation in this report, with its metadata',
      'Filter on Kind to see one sort at a time.', 25);
    xlFreeze(ws, 3);
    const rows = [];
    const links = [];
    for(const s of model.sections)
      for(const c of s.citations){
        if(c.bi?.link) links.push({ row: rows.length, col: 24, url: c.bi.link });
        rows.push([
          s.heading, c.kind, c.label, c.dimension || '',
          c.kpi?.name || '',
          c.process?.name || '', c.process?.departmentName || '',
          c.project?.name || '', c.project?.status || '', c.project?.category || '',
          c.project?.buName || '', c.project?.deptName || '',
          c.task?.name || '', c.task?.status || '', c.task?.priority || '',
          c.task?.assigneeName || '', c.task?.start || '', c.task?.due || '',
          c.poc?.name || '', c.poc?.status || '', c.poc?.target,
          c.strategy?.name || '', c.childReport?.name || '',
          c.bi?.name || '', c.bi?.link || '']);
      }
    xlTable(ws, { name: tname(), span: 25, numeric: [20], links,
      theme: 'TableStyleMedium2',
      columns: ['Section', 'Kind', 'Label', 'Dimension', 'KPI', 'Process',
                'Process department', 'Project', 'Project status', 'Project category',
                'Project BU', 'Project department', 'Task', 'Task status',
                'Task priority', 'Task assignee', 'Task start', 'Task due',
                'POC', 'POC status', 'POC target', 'Strategy', 'Child report',
                'BI report', 'BI link'],
      rows, empty: 'This report has no citations.' });
  }

  /* ---- cross-cutting: the dashboards ---------------------------------- */
  {
    const ws = wb.addWorksheet(sheetName('BI reports', used));
    ws.columns = [{ width: 34 }, { width: 30 }, { width: 40 }, { width: 60 }];
    xlTitle(ws, 'BI dashboards cited by this report',
      'The link opens the dashboard in Power BI.', 4);
    xlFreeze(ws, 2);
    xlBlank(ws);
    xlTable(ws, { name: tname(), span: 4,
      links: model.biReports.map((bi, ri) => ({ row: ri, col: 3, url: bi.link })),
      columns: ['Report', 'Behind KPI', 'Cited by sections', 'Link'],
      rows: model.biReports.map(bi => [bi.name, bi.kpiName || '',
        [...new Set(bi.sections)].join(', '), bi.link || '']),
      empty: 'This report cites no BI dashboard.' });

    xlBlank(ws);
    xlBand(ws, 'Why there is no screenshot', 4);
    xlNote(ws, 'A dashboard is a frame belonging to app.powerbi.com. No browser API can '
             + 'read the pixels of a frame from another origin — the same rule that stops '
             + 'a page reading your signed-in bank dashboard — so no library can capture '
             + 'it. In this host the frame is often refused by the page’s security policy '
             + 'and never renders at all, so there is nothing on screen to capture either.', 4);
    xlNote(ws, 'A real image needs Power BI’s own export: a Power Automate flow using the '
             + 'Power BI connector’s “Export To File for Power BI Reports” action, '
             + 'saving the PNG against the BI report row in Dataverse. This workbook would then '
             + 'embed it with no further change. That route needs a Power BI Pro or PPU licence '
             + 'and the workspace on Premium or Fabric capacity.', 4);
  }

  const buf = await wb.xlsx.writeBuffer();
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);

  /* ⚠️ Never hand an incomplete workbook to the browser. Excel reports any
     malformed .xlsx as "the file format or file extension is not valid",
     which reads to a user as a corrupt download rather than a bug in here --
     so a file that fails this check is refused with a real message instead of
     being downloaded. A valid .xlsx is a zip: it starts with PK and
     ends with an end-of-central-directory record (PK). */
  const ok = bytes.length > 1000
    && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  let eocd = false;
  for(let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000 && !eocd; i--)
    if(bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x05 && bytes[i+3] === 0x06)
      eocd = true;
  if(!ok || !eocd)
    throw new Error(`the workbook was written incomplete (${bytes.length} bytes, `
      + `zip header ${ok ? 'ok' : 'bad'}, directory ${eocd ? 'ok' : 'missing'}) `
      + '— nothing was downloaded');

  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ============================================================ .docx ==== */

/** One Report Occurrence as a Word document.
 *
 *  Sections become sub-headings, as asked, each followed by its body and one
 *  block per citation carrying that citation's metadata. A BI citation gets
 *  its name, the KPI behind it, a live link and a labelled reserved block
 *  where the image would sit -- see the header for why the image cannot be
 *  produced here.
 *
 *  @param {object} model from buildReportExportModel()
 *  @param {object} [biImages] { [biId]: {base64, width, height} }
 *  @returns {Promise<Blob>}
 */
export async function reportToDocx(model, biImages){
  /* Dynamic for the same reason as xlsx above -- docx is a large dependency
     and an export is rare, so no page load should pay for it. */
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow,
          TableCell, WidthType, ExternalHyperlink, BorderStyle, ShadingType,
          AlignmentType, ImageRun } = D;

  const INK = '1F2A29', MUTED = '6B7877', RULE = 'BCC7C6', HEAD = 'EDF1F1';

  const p = (text, opt = {}) => new Paragraph({
    spacing: { before: opt.before ?? 0, after: opt.after ?? 80 },
    children: [new TextRun({
      text: txt(text), bold: opt.bold, italics: opt.italics,
      size: opt.size ?? 21, color: opt.color ?? INK, font: 'Calibri',
    })],
  });

  const meta = text => p(text, { size: 17, color: MUTED, italics: true });

  const cell = (v, opt = {}) => new TableCell({
    width: { size: opt.w ?? 0, type: opt.w ? WidthType.PERCENTAGE : WidthType.AUTO },
    shading: opt.head ? { type: ShadingType.CLEAR, color: 'auto', fill: HEAD } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opt.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({
        text: txt(v), bold: !!opt.head, size: 17, color: opt.head ? MUTED : INK,
        font: opt.mono ? 'Consolas' : 'Calibri',
      })],
    })],
  });

  /* A table with a header row. `widths` are percentages and must total 100. */
  const table = (header, rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left:   { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right:  { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) => cell(h, { head: true, w: widths?.[i] })),
      }),
      ...rows.map(cells => new TableRow({
        children: cells.map((v, i) => cell(v, {
          w: widths?.[i],
          /* Figures right-align and set in a mono face so a column of them
             reads as a column, the same reason the screens use --mono. */
          right: typeof v === 'number', mono: typeof v === 'number',
        })),
      })),
    ],
  });

  const spacer = () => new Paragraph({ text: '', spacing: { after: 120 } });

  const kids = [];
  const r = model.report;

  /* ---- title block ---------------------------------------------------- */
  kids.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: r.name, bold: true, size: 40, color: INK, font: 'Calibri' })],
  }));
  kids.push(meta([r.periodLabel, r.status, r.version != null && 'v' + r.version,
                  r.templateName || (r.noSetup ? 'Ad Hoc — no Setup' : null)]
                 .filter(Boolean).join('  ·  ')));
  kids.push(spacer());

  kids.push(table(['Field', 'Value'], [
    ['Period', dsh(r.periodLabel)],
    ['Status', dsh(r.status)],
    ['Version', dsh(r.version)],
    ['Stage', dsh(r.stage)],
    ['Review step', dsh(r.reviewStep)],
    ['Report Setup', dsh(r.templateName)],
    ['Business Unit', dsh(r.businessUnitName)],
    ['Region', dsh(r.regionName)],
    ['Department', dsh(r.departmentName)],
    ['Function', dsh(r.functionName)],
    ['Created by (Position)', dsh(r.creatorPositionName)],
    ['Created', dsh(r.created)],
    ['Last modified', dsh(r.modified)],
    ['Exported', model.generatedAt],
  ], [32, 68]));

  if(r.objective){
    kids.push(spacer());
    kids.push(p('Objective', { bold: true, size: 22, before: 120 }));
    kids.push(p(r.objective));
  }

  if(model.warnings.length){
    kids.push(spacer());
    kids.push(p('Notes on this export', { bold: true, size: 20 }));
    for(const w of model.warnings) kids.push(meta('•  ' + w));
  }

  /* ---- a sub-heading per section -------------------------------------- */
  model.sections.forEach((s, i) => {
    kids.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 60 },
      children: [new TextRun({ text: `${i + 1}. ${s.heading}`, bold: true,
                               size: 26, color: INK, font: 'Calibri' })],
    }));
    kids.push(meta([s.angle, s.source, s.author,
                    s.sequence != null && 'order ' + s.sequence]
                   .filter(Boolean).join('  ·  ')));

    if(s.body){
      /* A body is free text that may hold its own line breaks; each becomes a
         real paragraph so Word does not run them together. */
      for(const line of String(s.body).split(/\r?\n/))
        kids.push(line.trim() ? p(line) : spacer());
    }else{
      kids.push(meta('This section has no body text.'));
    }

    if(!s.citations.length){
      kids.push(meta('No citations on this section.'));
      return;
    }

    for(const c of s.citations){
      kids.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 40 },
        children: [new TextRun({
          text: `${c.kind}${c.dimension ? ' by ' + c.dimension : ''} ${c.label || ''}`.trim(),
          bold: true, size: 22, color: INK, font: 'Calibri',
        })],
      }));

      /* One metadata table per citation, built from whatever that kind
         actually carries -- an empty row for a field this kind does not have
         would read as missing data rather than as inapplicable. */
      const rows = [];
      const add = (k, v) => { if(v !== null && v !== undefined && v !== '') rows.push([k, String(v)]); };
      if(c.kpi)         add('KPI', c.kpi.name);
      if(c.process){    add('Process', c.process.name);
                        add('Process department', c.process.departmentName); }
      if(c.project){    add('Project', c.project.name);
                        add('Project status', c.project.status);
                        add('Project category', c.project.category);
                        add('Project Business Unit', c.project.buName);
                        add('Project region', c.project.regionName);
                        add('Project department', c.project.deptName); }
      if(c.task){       add('Task', c.task.name);
                        add('Task status', c.task.status);
                        add('Task priority', c.task.priority);
                        add('Assignee', c.task.assigneeName);
                        add('Starts', c.task.start);
                        add('Due', c.task.due);
                        add('Description', c.task.description); }
      if(c.poc){        add('POC', c.poc.name);
                        add('POC status', c.poc.status);
                        add('POC target', c.poc.target); }
      if(c.strategy)    add('Strategy', c.strategy.name);
      if(c.childReport) add('Child report', c.childReport.name);
      if(c.bi){         add('BI report', c.bi.name);
                        add('Behind KPI', c.bi.kpiName); }
      if(rows.length) kids.push(table(['Field', 'Value'], rows, [32, 68]));

      /* KPI figures. Printed even when nothing is recorded, because "no target
         recorded" is itself the finding a reader needs. */
      if(c.kpi){
        if(c.kpi.recorded){
          kids.push(spacer());
          kids.push(table(['Baseline', 'Actual', 'Target', 'Historical'], [[
            c.kpi.baseline ?? DASH, c.kpi.actual ?? DASH,
            c.kpi.target ?? DASH, c.kpi.historical ?? DASH,
          ]], [25, 25, 25, 25]));
          kids.push(meta(`Matched on ${c.kpi.matchedOn}`
                       + (c.kpi.period ? `  ·  ${c.kpi.period}` : '')));
        }else{
          kids.push(meta(`No achievement recorded for ${r.periodLabel || 'this period'}`
                       + `${r.businessUnitName ? '  ·  ' + r.businessUnitName : ''}.`));
        }
      }

      /* Breakdown members. */
      if(c.dimension){
        if(c.members.length){
          kids.push(spacer());
          kids.push(p(`Members by ${c.dimension}`, { bold: true, size: 19 }));
          kids.push(table(['Member', 'Actual', 'Target', 'Baseline', 'Historical'],
            c.members.map(m => [m.member, m.actual ?? DASH, m.target ?? DASH,
                                m.baseline ?? DASH, m.historical ?? DASH]),
            [40, 15, 15, 15, 15]));
        }else{
          kids.push(meta(c.kpi?.recorded
            ? `No breakdown rows recorded by ${c.dimension}.`
            : 'No achievement matched this report, so no members could be read.'));
        }
      }

      /* The dashboard: a real image when one has been supplied, otherwise a
         labelled reserved block and the link. Never a blank space. */
      if(c.bi){
        kids.push(spacer());
        kids.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Dashboard:  ', bold: true, size: 19, color: INK, font: 'Calibri' }),
            c.bi.link
              ? new ExternalHyperlink({
                  link: c.bi.link,
                  children: [new TextRun({ text: c.bi.name, size: 19, style: 'Hyperlink' })],
                })
              : new TextRun({ text: c.bi.name, size: 19, color: INK, font: 'Calibri' }),
          ],
        }));

        const img = biImages?.[c.bi.id];
        if(img?.base64){
          kids.push(new Paragraph({
            children: [new ImageRun({
              data: img.base64,
              transformation: { width: img.width || 600, height: img.height || 338 },
            })],
          }));
        }else{
          kids.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            border: {
              top:    { style: BorderStyle.DASHED, size: 6, color: RULE, space: 8 },
              bottom: { style: BorderStyle.DASHED, size: 6, color: RULE, space: 8 },
              left:   { style: BorderStyle.DASHED, size: 6, color: RULE, space: 8 },
              right:  { style: BorderStyle.DASHED, size: 6, color: RULE, space: 8 },
            },
            children: [new TextRun({
              text: 'Dashboard image not embedded — a Power BI frame is on another '
                  + 'origin, so no browser API can capture it. Open the link above, or see '
                  + 'the note at the end of this document.',
              italics: true, size: 17, color: MUTED, font: 'Calibri',
            })],
          }));
        }
      }
    }
  });

  /* ---- the closing note ----------------------------------------------- */
  kids.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 60 },
    children: [new TextRun({ text: 'About the dashboard images', bold: true,
                             size: 24, color: INK, font: 'Calibri' })],
  }));
  kids.push(p('A Power BI dashboard is displayed in a frame belonging to app.powerbi.com. '
            + 'No browser API returns the pixels of a frame from another origin — the '
            + 'same rule that stops any page reading your signed-in bank dashboard — so '
            + 'no library can screenshot one, and in this host the frame is frequently '
            + 'refused by the page’s security policy and never renders at all.',
            { size: 19 }));
  kids.push(p('A real image needs Power BI’s own export: a Power Automate flow using the '
            + 'Power BI connector’s “Export To File for Power BI Reports” action, '
            + 'saving the PNG against the BI report row in Dataverse. This document would then '
            + 'embed it with no further change. That route needs a Power BI Pro or PPU licence '
            + 'and the workspace on Premium or Fabric capacity.', { size: 19 }));
  if(model.biReports.length){
    kids.push(spacer());
    kids.push(table(['Dashboard', 'Behind KPI', 'Cited by'],
      model.biReports.map(bi => [bi.name, bi.kpiName || DASH,
                                 [...new Set(bi.sections)].join(', ')]),
      [34, 30, 36]));
  }

  const doc = new Document({
    creator: 'Andalusia Pulse · Leadership Practice',
    title: r.name,
    description: `Report export — ${r.periodLabel}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: INK } } } },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: kids,
    }],
  });

  return Packer.toBlob(doc);
}
