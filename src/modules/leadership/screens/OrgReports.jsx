/* =========================================================================
   ARTIFACT · ScreenOrgReports

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx, ../../../shared and the service layer --
   never from LeadershipApp.jsx, so this file can move to another module (or
   another app) without dragging the execution module behind it.

   LIVE DATA (17 Sep). This screen used to read the seeded db.reports and
   db.paragraphs. It now reads the real Report Occurrence tables:

     lm_reportoccurrences         the reports       (dvReportOccs, from context)
     lm_reportoccurrencesections  their Sections    (fetchReportOccurrenceContent)
     lm_reportsectioncitations    each Section's Citations (same call)

   Name lookups (Department, Business Unit, Position, Template) and the
   signed-in user's Position ids arrive through context as `dvLookup`.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty } from '../../../shared/ui.jsx';
import { fmtD, fmtP, MONTHS } from '../../../shared/format.js';
import { DiagChip, rptTagC, matchesQuery } from '../domain.jsx';
import { fetchReportOccurrenceContent, fetchKpiAchievements, reportAchievementScope,
         fetchBiReportsByKpi, fetchTasks, citeTaskOnSection } from '../../../services/dataverse.js';
import { BiFrame } from './BusinessIntelligence.jsx';
/* Reused rather than copied: the same form Build a report/plan raises a task
   with, so a task raised from either side carries identical fields. */
import { NewTaskForm } from './BuildReport.jsx';
import { ExportReportButtons } from './ExportReport.jsx';
import { KpiCoverage } from './KpiCoverage.jsx';
import { AchievementFigures } from './AchievementFigures.jsx';

/* The dashboards behind a cited KPI. Collapsed by default -- a report citing
   eight KPIs would otherwise mount eight Power BI frames at once, each
   authenticating separately. */
function KpiDashboards({ bis }){
  const [open, setOpen] = useState(false);
  if (!bis.length) return null;
  return <div style={{ marginTop: 6 }}>
    <Btn k="sm" onClick={() => setOpen(o => !o)}>
      {open ? 'Hide' : 'Show'} {bis.length === 1 ? 'the BI report' : `${bis.length} BI reports`}</Btn>
    {open ? bis.map(b => <BiFrame key={b.id} bi={{ n: b.name, link: b.link }}/>) : null}
  </div>;
}

/* Dataverse's angle labels, mapped onto the ids DiagChip already styles. */
const DIAG_ID = { Descriptive:'d1', Diagnostic:'d2', Predictive:'d3', Prescriptive:'d4' };

/* Which chip colour a citation kind borrows -- the .cref classes that exist. */
const crefCls = kind =>
  kind === 'KPI' || kind === 'Breakdown' ? 'kpi'
  : kind === 'Process' ? 'pm'
  : kind === 'POC' || kind === 'Project' || kind === 'Strategy' ? 'str'
  : kind === 'Issue' ? 'iss'
  : '';

/* Dataverse timestamps are ISO (`2026-09-17T10:20:00Z`); fmtDT expects a space. */
const fmtStamp = iso => (iso ? fmtD(String(iso).slice(0, 10)) : '—');

/* ---- 2. Reports / Plans ------------------------------------------------
   Laid out as the prototype has it, because the layout IS the argument: a
   rail of reports on the left, one report open on the right, and that report
   shown as a stack of SECTIONS rather than pages. Each Section carries its
   diagnostic angle, who wrote it and the citations it rests on -- which is
   what makes it contestable, and what a BI visual can never be.

   Direction comes from the report's Creator Position: a report created from
   a Position the signed-in user holds is "Issued by you"; anything else is
   "Received". That is the only authorship the table records. */
/* Raise a Task, or cite one that exists, against a Section.

   ⚠️ A Task has no report-side lookup of its own -- `hx_tasks` in IT points
   at BusinessUnit, SystemUser, hr_Employee, KPI and Process, and nothing
   else. `lm_reportsectioncitations.lm_Task` is the only link there is, and
   it hangs off a SECTION, so this is where a task on a report has to live. */
function SectionTaskPanel({ mode, list, q, setQ, busy, onPick, onNew, onCancel, subject, toast }){
  if (mode === 'new')
    return <div style={{ marginTop: 8 }}>
      <NewTaskForm subject={subject} toast={toast} onCancel={onCancel} onDone={onNew}/>
    </div>;

  const needle = q.trim().toLowerCase();
  const shown = (list || []).filter(t => !needle || (t.name || '').toLowerCase().includes(needle));
  return <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
    <input type="search" value={q} onChange={e => setQ(e.target.value)}
      placeholder="Search tasks…" style={{ width: '100%', marginBottom: 8 }}
      aria-label="Search tasks"/>
    {list === null
      ? <div className="holder">Reading tasks…</div>
      : shown.length === 0
        ? <div className="holder">{needle ? 'No task matches.' : 'No tasks to attach yet.'}</div>
        : <div style={{ maxHeight: 190, overflowY: 'auto' }}>
            {shown.slice(0, 60).map(t =>
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                                       borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{t.name}</span>
                {t.status ? <Tag c="grey">{t.status}</Tag> : null}
                <Btn k="sm" disabled={busy} onClick={() => onPick(t)}>Attach</Btn>
              </div>)}
          </div>}
  </div>;
}

export function ScreenOrgReports(){
  const { dvReportOccs, dvLoading, dvError, dvLookup, go, openNewReport, toast } = use();
  /* Which section's Task panel is open, and in which mode:
     { id, mode: 'pick' | 'new' }. */
  const [taskFor, setTaskFor] = useState(null);
  const [taskList, setTaskList] = useState(null);   // null while reading
  const [taskQ, setTaskQ] = useState('');
  const [citing, setCiting] = useState(false);
  const L = dvLookup || {};
  const nm = (fn, id) => (id && typeof fn === 'function' ? fn(id) : null);

  const [dir, setDir]           = useState('all');
  const [openId, setOpenId]     = useState(null);
  const [openSec, setOpenSec]   = useState(null);
  const [q, setQ]               = useState('');
  const [content, setContent]   = useState(null);    // { sections, citations } once read
  const [contentErr, setContentErr] = useState(null);
  const [tick, setTick]         = useState(0);       // bump to re-read
  const [biByKpi, setBiByKpi]   = useState(new Map()); // KPI id -> its dashboards

  /* Which dashboards sit behind each cited KPI -- lm_bireportdashboard.lm_kpi. */
  useEffect(() => {
    let live = true;
    fetchBiReportsByKpi()
      .then(m => { if (live) setBiByKpi(m); })
      .catch(e => { console.warn('[dataverse] fetchBiReportsByKpi() failed:', e); });
    return () => { live = false; };
  }, []);

  /* Sections and citations are read here, when the tab opens, rather than at
     app start -- nothing else in the app needs them, and the bodies are long. */
  useEffect(() => {
    let live = true;
    setContentErr(null);
    fetchReportOccurrenceContent()
      .then(c => { if (live) setContent(c); })
      .catch(e => {
        console.warn('[dataverse] Report sections/citations read failed:', e);
        if (live) { setContentErr(e); setContent({ sections: [], citations: [] }); }
      });
    return () => { live = false; };
  }, [tick]);

  const { sectionsByReport, citesBySection } = useMemo(() => {
    const s = {}, c = {};
    for (const x of content?.sections || []) {
      if (!x.reportId) continue;
      (s[x.reportId] = s[x.reportId] || []).push(x);
    }
    for (const k in s) {
      s[k].sort((a, b) =>
        (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || String(a.created).localeCompare(String(b.created)));
    }
    for (const x of content?.citations || []) {
      if (!x.sectionId) continue;
      (c[x.sectionId] = c[x.sectionId] || []).push(x);
    }
    return { sectionsByReport: s, citesBySection: c };
  }, [content]);

  const mine = new Set(L.myPositionIds || []);
  const reports = dvReportOccs || [];
  const isMine = r => !!r.creatorPositionId && mine.has(r.creatorPositionId);
  const inTab = (r, k) => (k === 'all' ? true : k === 'out' ? isMine(r) : !isMine(r));

  const sectionsOf = r => sectionsByReport[r.id] || [];
  const processesOf = r => [...new Set(
    sectionsOf(r).flatMap(s => (citesBySection[s.id] || [])
      .filter(c => c.kind === 'Process' && c.processName).map(c => c.processName)))];
  const scopeOf = r => nm(L.dept, r.departmentId) || nm(L.bu, r.businessUnitId) || nm(L.region, r.regionId);

  const list = reports
    .filter(r => inTab(r, dir))
    .filter(r => matchesQuery(q, [r.name, r.status, r.period, fmtP(r.period), scopeOf(r),
                                   nm(L.pos, r.creatorPositionId), nm(L.rptTpl, r.templateId)]))
    .slice()
    .sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))
                 || String(a.name).localeCompare(String(b.name)));

  /* Selection follows the list rather than being stored independently, so
     switching tab or filtering can never leave a stale report open. */
  const rec = list.find(r => r.id === openId) || list[0] || null;
  const secs = rec ? sectionsOf(rec) : [];

  /* pm_kpiachievments, read once per Report Occurrence period's year and
     cached -- a report has one Period, so every KPI citation in it is looked
     up against the same year's rows. null while that year is loading. */
  const [achByYear, setAchByYear] = useState({});
  useEffect(() => {
    const year = rec?.period ? String(rec.period).slice(0, 4) : null;
    if (!year || achByYear[year] !== undefined) return;
    let live = true;
    setAchByYear(prev => ({ ...prev, [year]: null }));
    fetchKpiAchievements(year)
      .then(rows => { if (live) setAchByYear(prev => ({ ...prev, [year]: rows })); })
      .catch(e => {
        console.warn('[dataverse] fetchKpiAchievements() failed:', e);
        if (live) setAchByYear(prev => ({ ...prev, [year]: [] }));
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.period]);

  /* Actual/Target/Baseline for one KPI citation, scoped to the open report's
     own Business Unit, Department, Function and Period. Returns:
       undefined  -- this year hasn't been read yet
       null       -- read, but nothing matches
       the row    -- a match

     ⚠️ The row is chosen by pickAchievement(), the SAME function Build a
     report/plan uses. It used to be a hand-rolled `rows.find` here, and the
     two disagreed in three ways for the same report and KPI:

       - a row with a BLANK department was rejected here whenever the report
         had one, while pickAchievement treats blank as "applies to any"
       - Business Unit was ignored here entirely, so a row belonging to a
         different BU could win
       - the first match won rather than the most specific one

     Month is still narrowed here, because this screen fetches a whole year
     and caches it; Build report gets the same narrowing from its fetch,
     which passes `month`. pickAchievement itself does NOT consider month --
     whoever calls it has to have done that already. */
  const achForCitation = c => {
    if (!rec?.period || c.kind !== 'KPI' || !c.kpiId) return undefined;
    const year = String(rec.period).slice(0, 4);
    const rows = achByYear[year];
    if (rows === undefined || rows === null) return null;   // still reading
    const monAbbr = MONTHS[+String(rec.period).slice(5, 7) - 1];
    /* Narrowed to this KPI and this MONTH only. Scope is applied by
       AchievementFigures through matchAchievement(), which deliberately does
       not look at period -- whoever calls it must have narrowed that already,
       and this is where that happens on this screen. */
    return rows.filter(r => r.kpiId === c.kpiId
      && r.monthLabel && String(r.monthLabel).toLowerCase().startsWith(monAbbr.toLowerCase()));
  };

  /* One scope for the open report, shared by every citation and by the
     Related-to-Setup panel, so they cannot disagree. Releases Department and
     Function when the report covers All Departments. */
  const achScope = reportAchievementScope({
    businessUnitId: rec?.businessUnitId || null,
    departmentName: nm(L.dept, rec?.departmentId) || null,
    functionName:   nm(L.func, rec?.functionId) || null,
  });

  const openReport = id => { setOpenId(id); setOpenSec(null); };

  /* Open the Task panel for a section. The task list is read once, lazily --
     it is only needed if someone actually opens the panel. */
  const openTaskPanel = (sectionId, mode) => {
    setTaskFor({ id: sectionId, mode });
    if (mode === 'pick' && taskList === null)
      fetchTasks()
        .then(rows => setTaskList(rows || []))
        .catch(e => { console.warn('[dataverse] fetchTasks() failed:', e); setTaskList([]); });
  };

  /* Cite the task on the section, then re-read so it appears where every
     other citation does rather than in a separate list of its own. */
  const attachTask = async (sectionId, task) => {
    setCiting(true);
    try {
      const { id, errors } = await citeTaskOnSection(sectionId, task);
      if (!id) {
        console.warn('[dataverse] citeTaskOnSection() failed:', errors);
        toast('Not attached', 'Citing the task on this section failed. Check the console for details.', 'err');
        return;
      }
      toast('Task attached', `"${task.name}" now hangs off this section as a citation.`, 'ok');
      setTaskFor(null); setTaskQ('');
      setTick(t => t + 1);
    } finally { setCiting(false); }
  };

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Reports / Plans</h1>
        <div className="sub">Organizational reports and plans, in and out. The same class of thing you
          produce: sections with an author, a diagnostic angle and citations.</div></div>
      {/* Opens the app-level New Report modal: pick an approved Report
          Template to work from, or create an Ad Hoc report with no Setup
          behind it. The opener comes from the context, never from
          LeadershipApp directly -- see this file's header. */}
      {openNewReport
        ? <Btn k="pri" onClick={openNewReport}>+ New Report</Btn>
        : null}
    </div>

    {dvError
      ? <Note k="err">Reading reports from Dataverse failed, so this list may be incomplete.
          Check the console for details.</Note>
      : null}

    <div className="pill-set" style={{ marginBottom: 15 }}>
      {[['all', 'All'], ['in', 'Received'], ['out', 'Issued by you']].map(([k, l]) =>
        <button type="button" key={k} className={'pill' + (dir === k ? ' on' : '')}
          onClick={() => { setDir(k); setOpenId(null); setOpenSec(null); }}>
          {l}<span className="c">{reports.filter(r => inTab(r, k)).length}</span>
        </button>)}
    </div>

    {reports.length === 0
      ? <div className="card"><Empty ic={dvLoading ? '…' : '📄'}>
          <b>{dvLoading ? 'Reading reports…' : 'No report occurrences yet'}</b>
          <div style={{ marginTop: 5 }}>{dvLoading
            ? 'Reading reports from Dataverse.'
            : 'Report occurrences appear here once they are created — by the weekly generator, or from a Report Setup.'}</div>
        </Empty></div>

      : <div className="org-split">
          {/* ---- the rail ---- */}
          <div className="card flush org-rail">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ flex: 1, fontSize: 13.5 }}>
                {dir === 'out' ? 'Issued by you' : dir === 'in' ? 'Received' : 'All reports'}</h2>
              <Tag c="teal">{list.length}</Tag>
            </div>
            <div style={{ padding: '8px 10px 0' }}>
              <input type="search" value={q} placeholder="Search…"
                onChange={e => setQ(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border-d)', borderRadius: 8,
                         padding: '6px 9px', fontSize: 12.5 }}/>
            </div>
            <div className="org-nodes">
              {list.length === 0
                ? <div className="holder" style={{ padding: '10px 12px' }}>
                    {q.trim() ? `Nothing matches “${q.trim()}”.`
                      : dir === 'out'
                        ? 'No report here was created from a Position you hold.'
                        : 'Nothing in this view.'}</div>
                : list.map(r => {
                    const ps = processesOf(r);
                    const n = content ? sectionsOf(r).length : null;
                    return <button key={r.id} type="button"
                      className={'org-node' + (rec && rec.id === r.id ? ' on' : '')}
                      onClick={() => openReport(r.id)}>
                      <span className="n" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={13} strokeWidth={2.25} style={{ flex: '0 0 auto', color: 'var(--teal)' }}/>
                        {r.name}</span>
                      <span className="s">{[nm(L.pos, r.creatorPositionId), fmtP(r.period)]
                        .filter(Boolean).join(' · ')}</span>
                      <span className="s">
                        {n === null ? 'Reading sections…' : `${n} section${n === 1 ? '' : 's'}`}
                        {ps.length ? ' · ' + ps.join(', ') : ''}</span>
                    </button>;
                  })}
            </div>
            <div className="holder" style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
              A report/plan is sections, not pages. Each one carries its angle, its author and
              what it rests on.
            </div>
          </div>

          {/* ---- the open report ---- */}
          <div className="card">
            {!rec ? <Empty>Nothing selected.</Empty> : <>
              <div className="ph-row" style={{ gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <h2 style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} strokeWidth={2.25} style={{ flex: '0 0 auto', color: 'var(--teal)' }}/>
                  {rec.name}</h2>
                <Tag c={rptTagC(rec.status)}>{rec.status}</Tag>
                {/* the same rule Build a report/plan applies */}
                {!rec.locked && (rec.status === 'Draft' || rec.status === 'Returned')
                  ? <Btn k="sm pri" onClick={() => go('build', rec.id)}>Edit this report</Btn>
                  : null}
                {/* Disabled until the content is read: exporting the shell of a
                    report would produce a file with a cover and no sections. */}
                <ExportReportButtons report={rec} sections={secs}
                  citations={content?.citations} disabled={content === null}/>
              </div>
              <div className="csub">
                {[scopeOf(rec), nm(L.pos, rec.creatorPositionId), fmtP(rec.period),
                  processesOf(rec).length ? 'covers ' + processesOf(rec).join(', ') : null
                 ].filter(Boolean).join(' · ')}
              </div>

              <div className="card" style={{ padding: '11px 13px', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="tset-lbl">Template</span>
                  <span>{rec.templateId ? (nm(L.rptTpl, rec.templateId) || 'A Report Template not in the loaded list')
                                        : 'Custom report — no Template'}</span>
                  {rec.version != null ? <Tag c="grey">v{rec.version}</Tag> : null}
                </div>
                {rec.objective
                  ? <div className="holder" style={{ marginTop: 6 }}>{rec.objective}</div>
                  : null}
              </div>

              {/* The Setup's own KPIs and Processes, which are not the same
                  thing as the citations on its sections. Scoped with exactly
                  what achForCitation() uses, so one report cannot show two
                  different figures for the same KPI. */}
              <KpiCoverage templateId={rec.templateId} period={rec.period}
                scope={achScope} unitLabel={nm(L.bu, rec.businessUnitId) || null}
                reportId={rec.id}
                canEdit={!rec.locked && (rec.status === 'Draft' || rec.status === 'Returned')}
                onSynced={() => setTick(t => t + 1)}
                citedKpis={secs.flatMap(s2 => (citesBySection[s2.id] || [])
                  .filter(c => (c.kind === 'KPI' || c.kind === 'Breakdown') && c.kpiId)
                  .map(c => ({ id: c.kpiId, name: c.kpiName || null,
                               section: s2.heading || '(untitled section)' })))}/>

              {contentErr
                ? <Note k="err">Reading this report's sections from Dataverse failed.{' '}
                    <Btn k="sm" onClick={() => setTick(t => t + 1)}>Try again</Btn></Note>
                : content === null
                  ? <Empty ic="…">Reading sections…</Empty>
                  : secs.length === 0
                    ? <Empty>This report has no sections yet.</Empty>
                    : secs.map(s => {
                        const isOpen = openSec === s.id;
                        const cites = citesBySection[s.id] || [];
                        return <div key={s.id} className={'orp' + (isOpen ? ' on' : '')}>
                          <button type="button" className="orp-h"
                            onClick={() => setOpenSec(isOpen ? null : s.id)}>
                            <span className="orp-t">{s.heading}</span>
                            <DiagChip d={DIAG_ID[s.angle] || null}/>
                            {s.source ? <Tag c="grey">{s.source}</Tag> : null}
                            <span className="holder" style={{ marginLeft: 'auto' }}>
                              {cites.length} citation{cites.length === 1 ? '' : 's'}</span>
                          </button>
                          {isOpen
                            ? <div style={{ padding: 12 }}>
                                {s.body
                                  ? <div style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--ink-2)',
                                                  whiteSpace: 'pre-wrap' }}>{s.body}</div>
                                  : <div className="holder">No text written yet.</div>}
                                <div className="holder" style={{ marginTop: 8 }}>
                                  {[s.author, fmtStamp(s.created)].filter(Boolean).join(' · ')}</div>
                                {cites.length
                                  ? <div style={{ marginTop: 8 }}>
                                      {cites.map(c => {
                                        const target = c.kpiName || c.processName || c.citedReportName
                                                    || c.label || '(no target recorded)';
                                        return <div key={c.id} className="cite">
                                          <div className="cite-hd">
                                            <span className={'cref ' + crefCls(c.kind)}>{c.kind}</span>
                                            <span className="cite-t">{target}</span>
                                            {c.breakdown ? <span className="dg none">by {c.breakdown}</span> : null}
                                          </div>
                                          {c.label && c.label !== target
                                            ? <div className="cite-m">{c.label}</div> : null}
                                          {c.kind === 'KPI' ? (() => {
                                            const rows = achForCitation(c);
                                            if (rows === undefined) return null;
                                            return <AchievementFigures rows={rows} scope={achScope}
                                              periodLabel={fmtP(rec.period)}
                                              unitLabel={nm(L.bu, rec.businessUnitId) || null}/>;
                                          })() : null}
                                          {c.kind === 'KPI' || c.kind === 'Breakdown'
                                            ? <KpiDashboards bis={biByKpi.get(c.kpiId) || []}/>
                                            : null}
                                          {c.citedReportId && reports.some(r => r.id === c.citedReportId)
                                            ? <div style={{ marginTop: 6 }}>
                                                <Btn k="sm" onClick={() => { setDir('all'); setQ('');
                                                  openReport(c.citedReportId); }}>Open cited report</Btn></div>
                                            : null}
                                        </div>;
                                      })}
                                    </div>
                                  : <div className="holder" style={{ marginTop: 8 }}>
                                      Rests on nothing citable — a conclusion with no source under it.</div>}

                                {/* The reader's own actions on someone else's
                                    section. A Task is the only one of the
                                    prototype's row that is storable today:
                                    lm_reportsectioncitations.lm_Task is the
                                    single link between a report and a task.
                                    Decision needs lm_citedreportsection on
                                    wlog_decision in IT, which does not exist. */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                  <Btn k="sm" disabled={citing}
                                    title="Raise a new task against this section"
                                    onClick={() => openTaskPanel(s.id,
                                      taskFor?.id === s.id && taskFor.mode === 'new' ? null : 'new')}>
                                    {taskFor?.id === s.id && taskFor.mode === 'new' ? 'Cancel' : '+ Raise a task'}</Btn>
                                  <Btn k="sm" disabled={citing}
                                    title="Attach a task that already exists"
                                    onClick={() => openTaskPanel(s.id,
                                      taskFor?.id === s.id && taskFor.mode === 'pick' ? null : 'pick')}>
                                    {taskFor?.id === s.id && taskFor.mode === 'pick' ? 'Cancel' : 'Attach a task'}</Btn>
                                </div>
                                {taskFor?.id === s.id && taskFor.mode
                                  ? <SectionTaskPanel mode={taskFor.mode} list={taskList}
                                      q={taskQ} setQ={setTaskQ} busy={citing} toast={toast}
                                      subject={rec?.name || null}
                                      onCancel={() => { setTaskFor(null); setTaskQ(''); }}
                                      onPick={t => attachTask(s.id, t)}
                                      onNew={t => attachTask(s.id, t)}/>
                                  : null}
                              </div>
                            : null}
                        </div>;
                      })}

              <Note k="info" ic="i"><b>You can argue with a report/plan.</b> Every section in it is a
                conclusion someone drew — citable, drillable to what it rests on, and contestable.
                None of that applies to a visual.</Note>
            </>}
          </div>
        </div>}
  </>;
}
