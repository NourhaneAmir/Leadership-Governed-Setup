/* =========================================================================
   Report export — one Report Occurrence as a workbook (.xlsx) or a Word
   document (.docx).

   Three parts, deliberately separated so the shape of the data is decided
   once and the two writers only lay it out:

     buildReportExportModel()  reads what the citations reference and returns
                               one plain object -- no XLSX, no docx
     reportToXlsx()            that model as a workbook, a sheet per section
     reportToDocx()            that model as a Word document, a sub-heading
                               per section

   ⚠️ BI DASHBOARD SCREENSHOTS CANNOT BE PRODUCED HERE, AND THE REASON IS NOT
   A MISSING LIBRARY.

   A dashboard is a cross-origin <iframe> pointing at app.powerbi.com (see
   BiFrame / toEmbedUrl in BusinessIntelligence.jsx). Two independent walls
   stand in front of a screenshot:

     1. No browser API returns the pixels of a cross-origin frame. html2canvas
        and every library like it re-paint the DOM they can *read*; they cannot
        enter another origin's document. This is the same rule that stops any
        page reading your signed-in bank dashboard, so it is not a bug to work
        around -- there is no flag, no library and no permission that lifts it.

     2. In this host the frame often does not render at all. BuildReport's own
        CSP_BLOCKS_POWERBI path exists because the Power Apps host refuses
        frames to powerbi.com; when that fires, BiFrame deliberately draws
        nothing. There are then no pixels on screen to capture even in theory.

   So every BI citation is exported as its NAME, the KPI it sits behind and a
   live hyperlink, with a clearly labelled reserved block where the image
   would go -- rather than a blank space that looks like a bug, or a fake.

   The one supported route to a real dashboard image is Power BI's
   exportToFile: a Power Automate flow using the Power BI connector's
   "Export To File for Power BI Reports" action, storing the PNG against the
   lm_bireportdashboard row, which this export would then embed. That needs a
   Power BI Pro/PPU licence and the workspace on Premium/Fabric capacity, so
   it is a licensing and flow decision, not code that belongs here.

   The hook for it is already in place: pass `biImages` to either writer as
   { [biReportId]: { base64, width, height } } and the image is embedded
   instead of the placeholder. Nothing else has to change.
   ========================================================================= */

import { fetchKpiAchievements, matchAchievement, fetchKpiBreakdowns,
         KPI_GAP_SECTION_HEADING,
         fetchProcesses, fetchProjects, fetchTasks, fetchStrategyPocs,
         fetchBiReportDashboards } from './dataverse.js';
/* The layout lives in its own module so it can be tested without the service
   layer; see its header. */
import { reportToXlsx, reportToDocx } from './reportWriters.js';

/* ------------------------------------------------------------------ utils */


/* A figure is a number or it is absent. Dataverse hands decimals back as
   numbers already, but a string would silently become text in Excel and stop
   summing, so it is coerced once here. */
const num = v => {
  if(v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const MONTH_NAMES = ['January','February','March','April','May','June','July',
                     'August','September','October','November','December'];

/** 'YYYY-MM' -> 'March 2026'. Same output as shared/format.js fmtP, repeated
 *  rather than imported so this module stays free of UI imports. */
export function periodLabel(p){
  if(!p) return '';
  const [y, m] = String(p).split('-');
  const name = MONTH_NAMES[Number(m) - 1];
  return name ? `${name} ${y}` : String(p);
}

/* A filename Windows, macOS and Dataverse's own file columns all accept. */
const safeFileName = s => String(s || 'report')
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120) || 'report';

/** Hands a Blob to the browser as a download.
 *
 *  ⚠️ A Code App runs inside the Power Apps host, so this uses a blob: URL and
 *  a synthetic click rather than anything that navigates the frame -- a
 *  top-level navigation would tear the app down. The object URL is revoked on
 *  a timer because revoking it immediately cancels the download in Safari. */
export function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ------------------------------------------------------- model assembly */

/* Which citation kinds are present, so a table is only read when something
   actually points into it. cr603_projects and hx_tasks are large shared
   tables (see their fetchers) and reading either for a report that cites
   neither would be the most expensive part of the export. */
const kindsPresent = cites => {
  const k = new Set();
  for(const c of cites){
    if(c.kpiId)          k.add('kpi');
    if(c.processId)      k.add('process');
    if(c.projectId)      k.add('project');
    if(c.taskId)         k.add('task');
    if(c.pocId)          k.add('poc');
    if(c.biId)           k.add('bi');
    if(c.breakdown)      k.add('breakdown');
  }
  return k;
};

/** Everything one Report Occurrence needs to be written out, resolved.
 *
 *  Takes the report and its content as the screens already hold them, and
 *  reads only the referenced rows itself. Both call sites are supported:
 *  sections may carry their own `citations` (fetchReportOccurrenceForEdit) or
 *  a flat citation list may be passed alongside (fetchReportOccurrenceContent).
 *
 *  @param {object}   a.report    one row from fetchReportOccurrences()
 *  @param {object[]} a.sections  its sections, either shape
 *  @param {object[]} [a.citations] flat citations, when not nested
 *  @param {object}   [a.lookups] dvLookup -- { bu, region, dept, func, pos, rptTpl }
 *  @param {Function} [a.onProgress] ({done,total,label}) as the reads proceed
 *  @returns {Promise<object>} the export model
 */
export async function buildReportExportModel({ report, sections, citations,
                                               lookups = {}, onProgress }){
  if(!report) throw new Error('buildReportExportModel: a report is required');

  /* Never allowed to break the export -- a throwing progress callback would
     otherwise abort a build that was succeeding. Same rule as the section
     migration's own onProgress. */
  const step = (done, total, label) => {
    try{ if(onProgress) onProgress({ done, total, label }); }
    catch(e){ console.warn('[reportExport] onProgress threw:', e); }
  };

  const nm = (fn, id) => (id && typeof fn === 'function' ? fn(id) : null);

  /* Sections in the order the report presents them, each with its citations
     however they arrived. */
  const flat = Array.isArray(citations) ? citations : [];
  const secs = (sections || [])
    .filter(s => !s.reportId || s.reportId === report.id)
    .map(s => ({
      ...s,
      citations: Array.isArray(s.citations) && s.citations.length
        ? s.citations
        : flat.filter(c => c.sectionId === s.id),
    }))
    .sort((a, b) => (a.sequence ?? 1e9) - (b.sequence ?? 1e9));

  const allCites = secs.flatMap(s => s.citations);
  const kinds = kindsPresent(allCites);
  const warnings = [];

  /* ---- the reads, only the ones this report needs -------------------- */
  const total = 1 + kinds.size;
  let done = 0;
  const tick = label => step(++done, total, label);
  step(0, total, 'Reading what this report cites…');

  /* KPI achievement for the period this report covers -- one read for every
     cited KPI, matched per citation below with the same pickAchievement() the
     screens use, so an exported figure is the figure on screen. */
  let ach = [];
  if(kinds.has('kpi') && report.period){
    const [y, m] = String(report.period).split('-');
    const kpiIds = [...new Set(allCites.map(c => c.kpiId).filter(Boolean))];
    try{
      ach = await fetchKpiAchievements(+y, { kpiIds, month: +m });
    }catch(e){
      console.warn('[reportExport] fetchKpiAchievements() failed:', e);
      warnings.push('KPI figures could not be read; the report exported without them.');
    }
    tick('KPI figures…');
  }else if(kinds.has('kpi')){
    warnings.push('This report has no period, so no KPI achievement could be matched to it.');
  }

  const byId = rows => new Map((rows || []).map(r => [r.id, r]));
  const readSet = async (want, fn, label, name) => {
    if(!kinds.has(want)) return new Map();
    try{
      const rows = await fn();
      tick(label);
      return byId(rows);
    }catch(e){
      console.warn(`[reportExport] ${name}() failed:`, e);
      warnings.push(`${label.replace(/…$/, '')} could not be read; those citations exported by name only.`);
      tick(label);
      return new Map();
    }
  };

  const [procs, projs, tasks, pocs, bis] = await Promise.all([
    readSet('process', fetchProcesses,          'Process metadata…', 'fetchProcesses'),
    readSet('project', fetchProjects,           'Project metadata…', 'fetchProjects'),
    readSet('task',    fetchTasks,              'Task metadata…',    'fetchTasks'),
    readSet('poc',     fetchStrategyPocs,       'POC metadata…',     'fetchStrategyPocs'),
    readSet('bi',      fetchBiReportDashboards, 'BI reports…',       'fetchBiReportDashboards'),
  ]);

  /* ---- per-citation resolution --------------------------------------- */

  const scope = {
    businessUnitId: report.businessUnitId || null,
    departmentName: nm(lookups.dept, report.departmentId) || null,
    functionName:   nm(lookups.func, report.functionId) || null,
  };

  const resolveKpi = cite => {
    if(!cite.kpiId) return null;
    const { row: hit, candidates, ambiguousOn } =
      matchAchievement(ach.filter(r => r.kpiId === cite.kpiId), scope);
    return {
      /* When the report leaves a dimension blank more than one row fits, and
         the figures below are one of them. Carried through so the workbook and
         the document can say so instead of presenting a guess as the answer. */
      ambiguousOn,
      candidateCount: candidates.length,
      id: cite.kpiId,
      name: cite.kpiName || '(unnamed KPI)',
      /* What the row was matched ON, not what was asked for -- a figure
         recorded against a blank Department applies to this report but was
         not recorded for it, and the two must stay distinguishable. */
      matchedOn: hit ? [hit.businessUnitName, hit.department, hit.function]
                        .filter(Boolean).join(' · ') || 'not scoped' : null,
      period: hit ? periodLabel(`${hit.year}-${String(hit.month).padStart(2, '0')}`) : null,
      actual:     hit ? num(hit.actual)     : null,
      target:     hit ? num(hit.target)     : null,
      baseline:   hit ? num(hit.baseline)   : null,
      historical: hit ? num(hit.historical) : null,
      recorded: !!hit,
      achievementId: hit ? hit.id : null,
    };
  };

  const out = [];
  for(const s of secs){
    const cites = [];
    for(const c of s.citations){
      const kpi = resolveKpi(c);

      /* Breakdown members hang off the achievement row that pickAchievement
         settled on, which is what fixes Department / Function / Month / Year /
         Business Unit -- so the scope is already decided and nothing is
         re-filtered here. No achievement means no members to read. */
      let members = [];
      if(c.breakdown && kpi?.achievementId){
        try{
          const rows = await fetchKpiBreakdowns(kpi.achievementId, c.breakdown);
          members = rows.map(r => ({
            member: r.member,
            actual: num(r.actual), target: num(r.target),
            baseline: num(r.baseline), historical: num(r.historical),
          }));
        }catch(e){
          console.warn('[reportExport] fetchKpiBreakdowns() failed:', e);
          warnings.push(`Breakdown members for "${c.kpiName || c.label}" could not be read.`);
        }
      }

      const proc = c.processId ? procs.get(c.processId) : null;
      const proj = c.projectId ? projs.get(c.projectId) : null;
      const task = c.taskId    ? tasks.get(c.taskId)    : null;
      const poc  = c.pocId     ? pocs.get(c.pocId)      : null;
      const bi   = c.biId      ? bis.get(c.biId)        : null;

      cites.push({
        id: c.id,
        kind: c.kind || 'Citation',
        label: c.label || '',
        dimension: c.breakdown || null,
        kpi,
        members,
        /* Where a lookup row could not be read the citation still carries the
           name Dataverse formatted, so a citation is never exported blank. */
        process: c.processId
          ? { id: c.processId, name: proc?.name || c.processName || '(unnamed process)',
              departmentName: proc?.deptName || null, functionName: proc?.functionName || null,
              processType: proc?.processType || null, scope: proc?.scope || null,
              sectionName: proc?.sectionName || null, mainProcessName: proc?.mainProcessName || null }
          : null,
        project: c.projectId
          ? { id: c.projectId, name: proj?.name || c.projectName || '(unnamed project)',
              status: proj?.status || null, category: proj?.category || null,
              regionName: proj?.regionName || null, buName: proj?.buName || null,
              deptName: proj?.deptName || null, subCategory: proj?.subCategory || null,
              strategicType: proj?.strategicType || null, priority: proj?.priority || null,
              approvalStatus: proj?.approvalStatus || null, period: proj?.period || null,
              progress: proj?.progress ?? null, sponsorName: proj?.sponsorName || null }
          : null,
        task: c.taskId
          ? { id: c.taskId, name: task?.name || c.taskName || '(untitled task)',
              status: task?.status || null, priority: task?.priority || null,
              start: task?.start || null, due: task?.due || null,
              assigneeName: task?.assigneeName || null,
              description: task?.description || null }
          : null,
        poc: c.pocId
          ? { id: c.pocId, name: poc?.name || c.pocName || '(unnamed POC)',
              status: poc?.status || null, target: num(poc?.target) }
          : null,
        strategy: c.strategyId
          ? { id: c.strategyId, name: c.strategyName || '(unnamed strategy)' }
          : null,
        childReport: c.citedReportId
          ? { id: c.citedReportId, name: c.citedReportName || '(report)' }
          : null,
        bi: c.biId
          ? { id: c.biId, name: bi?.name || c.biName || '(unnamed BI report)',
              link: bi?.link || null, kpiName: bi?.kpiName || null }
          : null,
      });
    }

    out.push({
      id: s.id,
      heading: s.heading || '(untitled section)',
      /* The KPI-gap section is written by the app, not by an author. Marked so
         both writers can say so -- a reader who cannot tell them apart would
         read a generated list as someone's analysis. */
      isGapSection: String(s.heading || '').trim().toLowerCase()
                    === KPI_GAP_SECTION_HEADING.toLowerCase(),
      angle: s.angle || 'Untyped',
      source: s.source || null,
      sequence: s.sequence ?? null,
      author: s.author || null,
      created: s.created || null,
      body: s.body || '',
      citations: cites,
    });
  }

  /* Every distinct BI report cited anywhere in this report, with the sections
     that cite it -- so the workbook's BI sheet lists each dashboard once even
     when four sections point at the same one. */
  const biSeen = new Map();
  for(const s of out){
    for(const c of s.citations){
      if(!c.bi) continue;
      if(!biSeen.has(c.bi.id)) biSeen.set(c.bi.id, { ...c.bi, sections: [] });
      biSeen.get(c.bi.id).sections.push(s.heading);
    }
  }

  const ambiguous = out => out.reduce((n, s2) =>
    n + s2.citations.filter(c => c.kpi?.ambiguousOn?.length).length, 0);

  const gapSection = out.find(s2 => s2.isGapSection);
  if(gapSection)
    warnings.push(`"${gapSection.heading}" is generated by the app, not written by an author: `
      + `it lists the ${gapSection.citations.length} KPI`
      + `${gapSection.citations.length === 1 ? '' : 's'} with no Actual or no Target recorded `
      + 'at the time it was last refreshed.');

  if(kinds.has('kpi') && ach.length && !ach.some(r => num(r.target) !== null))
    warnings.push('No cited KPI has a target recorded in Dataverse for this period, '
                + 'so every Target reads as empty. This is missing data, not a failed read.');

  const nAmbiguous = ambiguous(out);
  if(nAmbiguous)
    warnings.push(`${nAmbiguous} KPI citation${nAmbiguous === 1 ? '' : 's'} matched more than one `
      + 'achievement row, because this report does not name every dimension the figures are '
      + 'recorded against. One row was used for each. Setting the Department and Function on '
      + 'the report narrows it.');

  step(total, total, 'Ready');

  return {
    report: {
      id: report.id,
      name: report.name || '(untitled report)',
      period: report.period || null,
      periodLabel: periodLabel(report.period),
      status: report.status || null,
      version: report.version ?? null,
      stage: report.stage || null,
      reviewStep: report.reviewStep ?? null,
      objective: report.objective || null,
      locked: !!report.locked,
      noSetup: !!report.noSetup,
      fileUrl: report.fileUrl || null,
      created: report.created || null,
      modified: report.modified || null,
      templateName:        nm(lookups.rptTpl, report.templateId) || null,
      businessUnitName:    nm(lookups.bu,     report.businessUnitId) || null,
      regionName:          nm(lookups.region, report.regionId) || null,
      departmentName:      nm(lookups.dept,   report.departmentId) || null,
      functionName:        nm(lookups.func,   report.functionId) || null,
      creatorPositionName: nm(lookups.pos,    report.creatorPositionId) || null,
    },
    sections: out,
    biReports: [...biSeen.values()],
    warnings,
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

/* ========================================================== the façade == */

/** Builds and downloads one Report Occurrence in the chosen format.
 *
 *  @param {object}   a.report      one row from fetchReportOccurrences()
 *  @param {object[]} a.sections    its sections, either call site's shape
 *  @param {object[]} [a.citations] flat citations, when not nested
 *  @param {object}   [a.lookups]   dvLookup
 *  @param {'xlsx'|'docx'} a.format
 *  @param {Function} [a.onProgress] ({done,total,label})
 *  @param {object}   [a.biImages]  reserved; see the header
 *  @param {string[]} [a.extraWarnings] notes the CALLER knows and the model
 *                    cannot -- the author's screen exports the draft on screen,
 *                    so unsaved edits have to be declared in the file itself
 *                    rather than only in a toast the file does not carry.
 *  @returns {Promise<{filename:string, warnings:string[]}>}
 */
export async function exportReport({ report, sections, citations, lookups,
                                     format, onProgress, biImages,
                                     extraWarnings }){
  if(format !== 'xlsx' && format !== 'docx')
    throw new Error(`exportReport: unknown format "${format}"`);

  const model = await buildReportExportModel({ report, sections, citations,
                                               lookups, onProgress });
  /* First, not appended: a reader who stops after one note should see the one
     that changes how the whole file is read. */
  if(extraWarnings?.length) model.warnings = [...extraWarnings, ...model.warnings];

  /* The writers are the slow part on a large report -- the build above is
     round trips, this is CPU -- so the caller is told before it starts. */
  try{ if(onProgress) onProgress({ done: 0, total: 0,
    label: format === 'xlsx' ? 'Writing the workbook…' : 'Writing the document…' }); }
  catch{ /* a throwing callback must not lose a finished model */ }

  const blob = format === 'xlsx'
    ? await reportToXlsx(model, biImages)
    : await reportToDocx(model, biImages);

  const filename = `${safeFileName(
    [model.report.name, model.report.periodLabel].filter(Boolean).join(' — ')
  )}.${format}`;
  downloadBlob(blob, filename);
  return { filename, warnings: model.warnings };
}
