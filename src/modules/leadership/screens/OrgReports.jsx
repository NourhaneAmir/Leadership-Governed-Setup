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
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty } from '../../../shared/ui.jsx';
import { fmtD, fmtP } from '../../../shared/format.js';
import { DiagChip, rptTagC, matchesQuery } from '../domain.jsx';
import { fetchReportOccurrenceContent } from '../../../services/dataverse.js';

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
export function ScreenOrgReports(){
  const { dvReportOccs, dvLoading, dvError, dvLookup, go } = use();
  const L = dvLookup || {};
  const nm = (fn, id) => (id && typeof fn === 'function' ? fn(id) : null);

  const [dir, setDir]           = useState('all');
  const [openId, setOpenId]     = useState(null);
  const [openSec, setOpenSec]   = useState(null);
  const [q, setQ]               = useState('');
  const [content, setContent]   = useState(null);    // { sections, citations } once read
  const [contentErr, setContentErr] = useState(null);
  const [tick, setTick]         = useState(0);       // bump to re-read

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

  const openReport = id => { setOpenId(id); setOpenSec(null); };

  return <>
    <div className="ph"><h1>Reports / Plans</h1>
      <div className="sub">Organizational reports and plans, in and out. The same class of thing you
        produce: sections with an author, a diagnostic angle and citations.</div></div>

    {dvError
      ? <Note k="err">Reading reports from Dataverse failed, so this list may be incomplete.
          Check the console for details.</Note>
      : null}

    <div className="tabs">
      {[['all', 'All'], ['in', 'Received'], ['out', 'Issued by you']].map(([k, l]) =>
        <button key={k} className={dir === k ? 'on' : ''}
          onClick={() => { setDir(k); setOpenId(null); setOpenSec(null); }}>
          {l}<span className="c">{reports.filter(r => inTab(r, k)).length}</span>
        </button>)}
    </div>

    {reports.length === 0
      ? <div className="card"><Empty ic={dvLoading ? '…' : '📄'}>
          <b>{dvLoading ? 'Reading reports…' : 'No report occurrences yet'}</b>
          <div style={{ marginTop: 5 }}>{dvLoading
            ? 'Reading lm_reportoccurrences from Dataverse.'
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
                      <span className="n">{r.name}</span>
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
                <h2 style={{ flex: 1, minWidth: 0 }}>{rec.name}</h2>
                <Tag c={rptTagC(rec.status)}>{rec.status}</Tag>
                {/* the same rule Build a report/plan applies */}
                {!rec.locked && (rec.status === 'Draft' || rec.status === 'Returned')
                  ? <Btn k="sm pri" onClick={() => go('build', rec.id)}>Edit this report</Btn>
                  : null}
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
