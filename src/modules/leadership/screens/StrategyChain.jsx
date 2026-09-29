/* =========================================================================
   Strategy chain -- objective to actuals, and what was said about it
   (Leadership Practice Extension, Produce > Work > "Strategy chain", EXT-03,
   29 Sep).

   The Extension draws objective -> tactic -> execution -> actuals. IT holds a
   different shape, checked 29 Sep, and this follows what IT actually links
   (the product owner's choice):

     Strategy (strategy_strategy)
       ├─ Process                  strategy_strategy.cr18c_process
       ├─ KPI                      strategy_strategy.strategy_kpi
       │    ├─ execution           cr18c_planningmonitoring.cr18c_kpi  (P&M entries)
       │    └─ actuals             pm_kpiachievments.pm_kpi            (this year)
       └─ Projects                 cr603_projects.project_strategyname
            └─ POCs                stf_strategypoc.stf_project

   "What was said about it" is every report section whose citation names the
   Strategy, its KPI, its Process, one of its Projects or one of their POCs
   (lm_reportsectioncitations).

   Left out on purpose: Tactics (stf_strategytactic refuses read to ordinary
   roles) and the Strategy-KPI junction (3 rows). Objectives
   (strategy_objectives) link to Projects and Tasks but not to KPIs, so they
   are not a root here.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { use } from '../store.jsx';
import { Note } from '../../../shared/ui.jsx';
import { fmtP, TODAY } from '../../../shared/format.js';
import { matchesQuery, DiagChip } from '../domain.jsx';
import { OpenRecord } from '../recordLinks.jsx';
import { fetchStrategies, fetchProjects, fetchStrategyPocs, fetchReportOccurrenceContent,
         fetchPlanningMonitoringByKpis, fetchKpiAchievementsForKpis,
         PROJECT_STATUS } from '../../../services/dataverse.js';

const YEAR = Number(String(TODAY).slice(0, 4));
const PAGE = 50;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* A section's Diagnostic Angle label -> the id DiagChip styles (as Reports / Plans maps it). */
const DIAG_ID = { Descriptive:'d1', Diagnostic:'d2', Predictive:'d3', Prescriptive:'d4' };

/* Each source is read on its own, so one refused table (a role without read
   on P&M, say) leaves the rest of the chain working and says what is missing. */
const settle = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, e }));

export function ScreenStrategyChain(){
  const { dvReportOccs = [], go } = use();
  const [data, setData] = useState(null);           // null while reading
  const [q, setQ] = useState('');
  const [view, setView] = useState('all');
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    (async () => {
      const [st, pr, po, ct] = await Promise.all([
        settle(fetchStrategies()), settle(fetchProjects()), settle(fetchStrategyPocs()),
        settle(fetchReportOccurrenceContent()),
      ]);
      const strategies = st.ok ? st.v : [];
      const kpiIds = strategies.map(s => s.kpiId).filter(Boolean);
      const [pm, ac] = await Promise.all([
        settle(fetchPlanningMonitoringByKpis(kpiIds)),
        settle(fetchKpiAchievementsForKpis(YEAR, kpiIds)),
      ]);
      const failed = [[st,'Strategies'],[pr,'Projects'],[po,'POCs'],[ct,'report citations'],
                      [pm,'Planning & Monitoring entries'],[ac,'KPI actuals']]
        .filter(([r]) => !r.ok).map(([r, n]) => { console.warn(`[dataverse] Strategy chain: reading ${n} failed:`, r.e); return n; });
      if (live) setData({
        strategies, projects: pr.ok ? pr.v : [], pocs: po.ok ? po.v : [],
        content: ct.ok ? ct.v : { sections: [], citations: [] },
        pm: pm.ok ? pm.v : [], actuals: ac.ok ? ac.v : [], failed,
      });
    })();
    return () => { live = false; };
  }, []);

  /* One row per Strategy, everything under it resolved once. */
  const rows = useMemo(() => {
    if (!data) return [];
    const reportName = new Map(dvReportOccs.map(r => [r.id, r]));
    const sectionById = new Map(data.content.sections.map(x => [x.id, x]));
    const by = (list, key) => { const m = new Map();
      for (const x of list) { const k = x[key]; if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
      return m; };
    const projByStrategy = by(data.projects, 'strategyId');
    const pocByProject = by(data.pocs, 'projectId');
    const pmByKpi = by(data.pm, 'kpiId');
    const acByKpi = by(data.actuals, 'kpiId');
    /* citation -> the section and report it sits in */
    const cites = data.content.citations.map(c => {
      const sec = sectionById.get(c.sectionId);
      const rep = sec ? reportName.get(sec.reportId) : null;
      return { ...c, section: sec || null, report: rep || null };
    }).filter(c => c.section);

    return data.strategies.map(s => {
      const projects = projByStrategy.get(s.id) || [];
      const projIds = new Set(projects.map(p => p.id));
      const pocs = projects.flatMap(p => pocByProject.get(p.id) || []);
      const pocIds = new Set(pocs.map(p => p.id));
      const written = cites.filter(c =>
           (c.strategyId && c.strategyId === s.id)
        || (s.kpiId && c.kpiId === s.kpiId)
        || (s.processId && c.processId === s.processId)
        || (c.projectId && projIds.has(c.projectId))
        || (c.pocId && pocIds.has(c.pocId)))
        .map(c => ({ ...c, via: c.strategyId === s.id ? 'Strategy'
                     : c.kpiId && c.kpiId === s.kpiId ? 'KPI'
                     : c.processId && c.processId === s.processId ? 'Process'
                     : c.pocId && pocIds.has(c.pocId) ? 'POC' : 'Project' }));
      const pm = (s.kpiId && pmByKpi.get(s.kpiId)) || [];
      const actuals = (s.kpiId && acByKpi.get(s.kpiId)) || [];
      const latestMonth = actuals.reduce((m, a) => Math.max(m, a.month || 0), 0);
      return { s, projects, pocs, written, pm, actuals,
               latest: latestMonth ? actuals.filter(a => a.month === latestMonth) : [], latestMonth };
    });
  }, [data, dvReportOccs]);

  const gaps = {
    withKpi: rows.filter(r => r.s.kpiId),
    noExec:  rows.filter(r => r.s.kpiId && !r.pm.length),
    unsaid:  rows.filter(r => !r.written.length),
    withProj: rows.filter(r => r.projects.length),
  };
  const VIEWS = [['all','All strategies', rows], ['kpi','With a KPI', gaps.withKpi],
    ['noexec','Intent without execution', gaps.noExec], ['unsaid','Nothing written', gaps.unsaid],
    ['proj','With projects', gaps.withProj]];
  const base = (VIEWS.find(v => v[0] === view) || VIEWS[0])[2];
  const list = base.filter(r => matchesQuery(q, [r.s.name, r.s.kpiName, r.s.processName, r.s.status,
    r.s.regionName, ...r.projects.map(p => p.name), ...r.pocs.map(p => p.name)]));

  return <div className="cs-root">
    <div className="cs-head">
      <div className="cs-head-top">
        <div><h1 className="cs-title">Strategy chain</h1>
          <p className="cs-sub">Each Strategy, from its KPI to the Planning &amp; Monitoring entries delivering it
            and this year’s actuals, the Projects and POCs under it, and every report section that says
            something about any of them.</p></div>
      </div>
      <div className="cs-tabs" role="tablist" aria-label="Strategy views">
        {VIEWS.map(([k, l, rs]) =>
          <button key={k} type="button" role="tab" aria-selected={view === k}
            className={'cs-tab' + (view === k ? ' on' : '')}
            onClick={() => { setView(k); setShown(PAGE); setOpen(null); }}>
            {l}<span className="cs-tab-badge">{data ? rs.length : '…'}</span></button>)}
      </div>
    </div>

    {data && data.failed.length > 0 &&
      <Note k="warn">Could not read {data.failed.join(', ')} — the chain shows everything else. You may not
        have read access to {data.failed.length === 1 ? 'that table' : 'those tables'}.</Note>}

    <div className="cs-stats">
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">Strategies with a KPI</div>
        <div className="cs-stat-val">{data ? gaps.withKpi.length : '…'}</div>
        <div className="cs-stat-meta">of {data ? rows.length : '…'} active</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">Intent without execution</div>
        <div className="cs-stat-val">{data ? gaps.noExec.length : '…'}</div>
        <div className="cs-stat-meta">a KPI, but no P&amp;M entry delivering it</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Nothing written</div>
        <div className="cs-stat-val">{data ? gaps.unsaid.length : '…'}</div>
        <div className="cs-stat-meta">no report section cites any part of it</div></div>
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">With projects</div>
        <div className="cs-stat-val">{data ? gaps.withProj.length : '…'}</div>
        <div className="cs-stat-meta">{data ? `${rows.reduce((n, r) => n + r.projects.length, 0)} projects · ${rows.reduce((n, r) => n + r.pocs.length, 0)} POCs` : '…'}</div></div>
    </div>

    <section className="cs-card flush" aria-labelledby="chain-list">
      <div className="cs-card-top" style={{ flexWrap: 'wrap' }}>
        <h2 className="cs-card-title" id="chain-list">{(VIEWS.find(v => v[0] === view) || VIEWS[0])[1]}</h2>
        <div className="cs-search">
          <input type="search" value={q} placeholder="Search strategies, KPIs, projects…" aria-label="Search the chain"
            onChange={e => { setQ(e.target.value); setShown(PAGE); }}/>
          <span className="cs-search-n">{data ? `${list.length} shown` : ''}</span>
        </div>
      </div>
      {!data
        ? <div className="cs-empty">Reading Strategies, KPIs, execution, actuals and projects from Dataverse…</div>
        : list.length === 0
          ? <div className="cs-empty">{q.trim() ? `Nothing matches “${q.trim()}”.` : 'No Strategy in this view.'}</div>
          : <div className="cs-tbl-wrap"><table className="cs-tbl" style={{ minWidth: 960 }}>
              <thead><tr><th>Strategy</th><th>KPI &amp; actuals ({YEAR})</th><th>Execution</th>
                <th>Projects &amp; POCs</th><th>Written about</th><th><span className="sr-only">Details</span></th></tr></thead>
              <tbody>{list.slice(0, shown).map(r => {
                const isOpen = open === r.s.id;
                return <React.Fragment key={r.s.id}>
                  <tr className="cs-row" tabIndex={0} onClick={() => setOpen(isOpen ? null : r.s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') setOpen(isOpen ? null : r.s.id); }}>
                    <td><div className="cs-name">{r.s.name}</div>
                      <div className="cs-name-sub">{[r.s.status, r.s.level, r.s.regionName].filter(Boolean).join(' · ') || '—'}</div>
                      {r.s.processName ? <div className="cs-name-sub">Process: {r.s.processName}</div> : null}</td>
                    <td>{r.s.kpiId
                      ? <><div className="cs-name" style={{ fontWeight: 500 }}>{r.s.kpiName || 'KPI'}</div>
                          <div className="cs-name-sub">{r.latestMonth
                            ? `${MONTHS[r.latestMonth - 1]} · ${r.latest.length} figure${r.latest.length === 1 ? '' : 's'}`
                            : 'No actual this year'}</div></>
                      : <span className="cs-count bad"><i/>No KPI</span>}</td>
                    <td>{!r.s.kpiId ? <span className="cs-name-sub">—</span>
                      : r.pm.length
                        ? <span className="cs-count ok"><i/>{r.pm.length} entr{r.pm.length === 1 ? 'y' : 'ies'}</span>
                        : <span className="cs-count warn"><i/>No execution entry</span>}</td>
                    <td>{r.projects.length
                      ? <><span className="cs-count">{r.projects.length} project{r.projects.length === 1 ? '' : 's'}</span>
                          {r.pocs.length ? <div className="cs-name-sub">{r.pocs.length} POC{r.pocs.length === 1 ? '' : 's'}</div> : null}</>
                      : <span className="cs-name-sub">—</span>}</td>
                    <td>{r.written.length
                      ? <span className="cs-count ok"><i/>{r.written.length} section{r.written.length === 1 ? '' : 's'}</span>
                      : <span className="cs-count bad"><i/>Nothing written</span>}</td>
                    <td><button type="button" className="cs-btn" aria-expanded={isOpen}
                      onClick={e => { e.stopPropagation(); setOpen(isOpen ? null : r.s.id); }}>
                      {isOpen ? 'Hide' : 'Open'}</button></td>
                  </tr>
                  {isOpen && <tr><td colSpan={6} style={{ background: 'var(--cs-hover)' }}>
                    <ChainDetail r={r} go={go}/></td></tr>}
                </React.Fragment>;
              })}</tbody></table>
              {list.length > shown
                ? <div style={{ padding: 12, textAlign: 'center' }}>
                    <button type="button" className="cs-btn" onClick={() => setShown(n => n + PAGE)}>
                      Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}</button></div>
                : null}
            </div>}
    </section>

    <p className="cs-card-note" style={{ marginTop: 10 }}><b>Intent without execution</b> is a Strategy whose KPI has no
      Planning &amp; Monitoring entry — a commitment with nothing delivering it. <b>Nothing written</b> is one no report
      section cites, through the Strategy, its KPI, its Process, or its Projects and POCs — analysis with nothing behind it,
      the other way round. Tactics are not shown: the Tactic table is not readable with ordinary roles.</p>
  </div>;
}

/* Everything under one Strategy. */
function ChainDetail({ r, go }){
  const sortedPm = [...r.pm].sort((a, b) => (b.year || 0) - (a.year || 0) || String(b.start || '').localeCompare(String(a.start || '')));
  return <div className="cs-chain">
    <div className="cs-chain-col">
      <div className="cs-lbl">Strategy</div>
      {r.s.description ? <p className="cs-card-note" style={{ margin: '4px 0 6px' }}>{r.s.description}</p> : null}
      <OpenRecord kind="Strategy" id={r.s.id}/>
      {r.s.kpiId && <>
        <div className="cs-lbl" style={{ marginTop: 12 }}>KPI · actuals {r.latestMonth ? `${MONTHS[r.latestMonth - 1]} ${YEAR}` : YEAR}</div>
        <div className="cs-name" style={{ margin: '4px 0' }}>{r.s.kpiName}</div>
        {r.latest.length
          ? r.latest.slice(0, 6).map(a => <div key={a.id} className="cs-name-sub">
              {[a.businessUnitName, a.department].filter(Boolean).join(' · ') || 'All'}: actual {a.actual ?? '—'} · target {a.target ?? '—'}</div>)
          : <div className="cs-name-sub">No actual recorded this year.</div>}
        {r.latest.length > 6 ? <div className="cs-name-sub">+{r.latest.length - 6} more</div> : null}
        <div style={{ marginTop: 6 }}><OpenRecord kind="KPI" id={r.s.kpiId}/></div>
      </>}
    </div>

    <div className="cs-chain-col">
      <div className="cs-lbl">Execution · Planning &amp; Monitoring</div>
      {!r.s.kpiId ? <div className="cs-name-sub">No KPI, so nothing to execute against.</div>
        : sortedPm.length
          ? <>{sortedPm.slice(0, 6).map(e => <div key={e.id} className="cs-chain-item">
                <div>{e.text || 'Entry'}</div>
                <div className="cs-name-sub">{[e.month, e.year, e.businessUnit, e.department].filter(Boolean).join(' · ')}
                  {e.actual != null || e.target != null ? ` — actual ${e.actual ?? '—'} / target ${e.target ?? '—'}` : ''}</div>
              </div>)}
              {sortedPm.length > 6 ? <div className="cs-name-sub">+{sortedPm.length - 6} more entries</div> : null}</>
          : <div className="cs-count warn" style={{ marginTop: 4 }}><i/>No entry delivers this KPI</div>}

      <div className="cs-lbl" style={{ marginTop: 12 }}>Projects &amp; POCs</div>
      {r.projects.length
        ? r.projects.map(p => <div key={p.id} className="cs-chain-item">
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span className="cs-name-sub">{[PROJECT_STATUS[p.statusCode], p.progress != null ? `${p.progress}%` : null].filter(Boolean).join(' · ')}</span>
              <OpenRecord kind="Project" id={p.id} label="Open ↗" asLink/>
            </div>
            {r.pocs.filter(x => x.projectId === p.id).map(x =>
              <div key={x.id} className="cs-name-sub" style={{ paddingLeft: 12 }}>POC: {x.name}
                {' '}<OpenRecord kind="POC" id={x.id} label="↗" asLink/></div>)}
          </div>)
        : <div className="cs-name-sub">No Project names this Strategy.</div>}
    </div>

    <div className="cs-chain-col">
      <div className="cs-lbl">Written about it</div>
      {r.written.length
        ? r.written.map(c => <div key={c.id} className="cs-chain-item">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <DiagChip d={DIAG_ID[c.section.angle] || null}/>
              <span style={{ flex: 1, minWidth: 0 }}>{c.section.heading || 'Untitled section'}</span>
            </div>
            <div className="cs-name-sub">
              {c.report ? `${c.report.name}${c.report.period ? ' · ' + fmtP(c.report.period) : ''}` : 'A report not in the loaded set'}
              {' '}· via its {c.via}</div>
            {c.report ? <button type="button" className="cs-btn" style={{ marginTop: 4 }}
              onClick={() => go('orpt', c.report.id)}>Open report</button> : null}
          </div>)
        : <div className="cs-count bad" style={{ marginTop: 4 }}><i/>No report section cites any part of it</div>}
    </div>
  </div>;
}
