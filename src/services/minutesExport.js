/* =========================================================================
   Meeting Minutes -> Word (.docx)

   Same approach as reportWriters.js: the writer takes a plain model and
   touches no service, no Dataverse and no React. The Minutes tab
   (DvMinutesBody) builds the model from what it already holds, including
   which agenda items the signed-in user may read -- a confidential item the
   user cannot read is exported with its title and a "withheld" line, never
   its note or its decisions. docx is loaded on demand, as for reports.
   ========================================================================= */
import { downloadBlob } from './reportExport.js';

const DASH = '—';
const txt = v => (v === null || v === undefined || v === '') ? '' : String(v);
const dsh = v => (v === null || v === undefined || v === '') ? DASH : String(v);

/* A filename Windows, macOS and Dataverse file columns all accept. */
const safeFileName = s => String(s || 'minutes')
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120) || 'minutes';

/**
 * @param {object} model
 * @param {object} model.meeting   name, date, time, mode, location, link, stage,
 *                                 status, chair, facilitator
 * @param {object} model.minutes   status, submitted, approved, closed, signedBy, signedOn
 * @param {object[]} model.attendees name, position, type, present
 * @param {object[]} model.agenda  seq, title, owner, covered, confidential,
 *                                 withheld, viewers, note,
 *                                 decisions[{name, taken, status}]
 * @param {string} model.generatedAt
 * @param {string} [model.exportedBy]
 * @returns {Promise<Blob>}
 */
export async function minutesToDocx(model){
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow,
          TableCell, WidthType, BorderStyle, ShadingType, AlignmentType } = D;

  /* The app's palette (theme.css): ink, muted, rule, and the warm gold. */
  const INK = '211C1E', MUTED = '8A8079', RULE = 'D8CBB4', HEAD = 'F1E6D4', GOLD = '6B4E30',
        RED = 'B23A3A';

  const run = (text, opt = {}) => new TextRun({
    text: txt(text), bold: opt.bold, italics: opt.italics,
    size: opt.size ?? 21, color: opt.color ?? INK, font: 'Calibri',
  });
  const p = (text, opt = {}) => new Paragraph({
    spacing: { before: opt.before ?? 0, after: opt.after ?? 80 },
    children: [run(text, opt)],
  });
  const meta = text => p(text, { size: 17, color: MUTED, italics: true });
  const spacer = () => new Paragraph({ text: '', spacing: { after: 120 } });

  const cell = (v, opt = {}) => new TableCell({
    width: { size: opt.w ?? 0, type: opt.w ? WidthType.PERCENTAGE : WidthType.AUTO },
    shading: opt.head ? { type: ShadingType.CLEAR, color: 'auto', fill: HEAD } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [run(v, { bold: !!opt.head, size: 17, color: opt.head ? GOLD : INK })],
    })],
  });
  const line = { style: BorderStyle.SINGLE, size: 2, color: RULE };
  const table = (header, rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: line, bottom: line, left: line, right: line,
               insideHorizontal: line, insideVertical: line },
    rows: [
      ...(header ? [new TableRow({ tableHeader: true,
        children: header.map((h, i) => cell(h, { head: true, w: widths?.[i] })) })] : []),
      ...rows.map(cells => new TableRow({
        children: cells.map((v, i) => cell(v, { w: widths?.[i], head: !header && i === 0 })),
      })),
    ],
  });
  const heading = (text, level = 1) => new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 360 : 240, after: 60 },
    children: [run(text, { bold: true, size: level === 1 ? 26 : 22 })],
  });

  const m = model.meeting, mn = model.minutes;
  const kids = [];

  /* ---- title block ---------------------------------------------------- */
  kids.push(p('MINUTES OF MEETING', { bold: true, size: 17, color: GOLD, after: 40 }));
  kids.push(new Paragraph({ spacing: { after: 60 },
    children: [run(m.name, { bold: true, size: 40 })] }));
  kids.push(meta([m.date, m.time, m.stage].filter(Boolean).join('  ·  ')));
  kids.push(spacer());

  kids.push(table(null, [
    ['Date', dsh(m.date)],
    ['Time', dsh(m.time)],
    ['Mode', dsh(m.mode)],
    ['Location', dsh(m.location)],
    ['Joining link', dsh(m.link)],
    ['Stage', dsh(m.stage)],
    ['Meeting status', dsh(m.status)],
    ['Chair', dsh(m.chair)],
    ['Facilitator', dsh(m.facilitator)],
  ], [30, 70]));

  kids.push(heading('Minutes status', 2));
  kids.push(table(null, [
    ['Status', dsh(mn.status)],
    ['Submitted', dsh(mn.submitted)],
    ['Approved', dsh(mn.approved)],
    ['Closed', dsh(mn.closed)],
    ['Signed by', dsh(mn.signedBy)],
    ['Signed on', dsh(mn.signedOn)],
  ], [30, 70]));

  /* ---- attendance ----------------------------------------------------- */
  kids.push(heading('Attendance'));
  if(model.attendees.length){
    const present = model.attendees.filter(a => a.present === 'Present').length;
    kids.push(meta(`${model.attendees.length} attendee${model.attendees.length === 1 ? '' : 's'}`
      + (present ? `  ·  ${present} present` : '')));
    kids.push(table(['Name', 'Position', 'Type', 'Attendance'],
      model.attendees.map(a => [dsh(a.name), dsh(a.position), dsh(a.type), dsh(a.present || 'Not Yet Recorded')]),
      [30, 34, 14, 22]));
  }else{
    kids.push(meta('No attendees on this occurrence.'));
  }

  /* ---- one sub-heading per agenda item -------------------------------- */
  kids.push(heading('Agenda and discussion'));
  if(!model.agenda.length) kids.push(meta('No agenda item on this occurrence.'));
  model.agenda.forEach((a, i) => {
    kids.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 260, after: 40 },
      children: [
        run(`${a.seq ?? i + 1}. ${a.title || DASH}`, { bold: true, size: 22 }),
        ...(a.confidential ? [run('   CONFIDENTIAL', { bold: true, size: 16, color: RED })] : []),
      ],
    }));
    kids.push(meta([a.owner && 'Owner: ' + a.owner, 'Covered: ' + (a.covered || 'Not Yet Recorded')]
      .filter(Boolean).join('  ·  ')));

    if(a.withheld){
      kids.push(p('This item is confidential. Its discussion notes and decisions are withheld '
        + 'from this export, because the person exporting it is not among those allowed to read it.',
        { italics: true, size: 19, color: MUTED }));
      return;
    }
    if(a.confidential)
      kids.push(meta('Restricted to: ' + (a.viewers?.length ? a.viewers.join(', ') : 'the Facilitator and the Chair')
        + '. Handle this document accordingly.'));

    kids.push(p('Discussion', { bold: true, size: 19, before: 80, after: 40 }));
    if(a.note){
      for(const ln of String(a.note).split(/\r?\n/))
        kids.push(ln.trim() ? p(ln) : spacer());
    }else{
      kids.push(meta('No note recorded.'));
    }

    if(a.decisions?.length){
      kids.push(p('Decisions', { bold: true, size: 19, before: 80, after: 40 }));
      kids.push(table(['Decision', 'Decision taken', 'Status'],
        a.decisions.map(d => [dsh(d.name), dsh(d.taken), dsh(d.status)]), [34, 46, 20]));
    }
  });

  /* ---- footer note ---------------------------------------------------- */
  kids.push(spacer());
  kids.push(meta(`Exported ${model.generatedAt}${model.exportedBy ? ' by ' + model.exportedBy : ''} `
    + 'from Andalusia Pulse · Leadership Practice.'));

  const doc = new Document({
    creator: 'Andalusia Pulse · Leadership Practice',
    title: `${m.name} — Minutes`,
    description: `Minutes of meeting — ${m.date || ''}`,
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: kids,
    }],
  });
  return Packer.toBlob(doc);
}

/** Writes the document and hands it to the browser. */
export async function exportMinutesDocx(model){
  const blob = await minutesToDocx(model);
  const filename = safeFileName(`${model.meeting.name} - Minutes${model.meeting.date ? ' - ' + model.meeting.date : ''}`) + '.docx';
  downloadBlob(blob, filename);
  return { filename };
}
