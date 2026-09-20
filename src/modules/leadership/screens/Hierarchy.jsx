/* =========================================================================
   ARTIFACT · ScreenHierarchy

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../store.jsx and ../../../shared — never from LeadershipApp.jsx, so this
   file can move to another module (or another app) without dragging the
   execution module behind it.

   Laid out as the prototype has it, because the shape carries the argument:
   a top-down org chart, not an indented list. A report/plan sits ABOVE the
   ones it rests on, so the depth of a claim is something you see rather than
   something you count — and a report with three levels under it is visibly a
   different kind of statement from one with none.

   LIVE (20 Sep). It used to read the seeded db.reports / db.paragraphs model
   and derive its edges from `RPT:` citation strings. It now reads the real
   tables: lm_reportoccurrences for the nodes, and lm_reportsectioncitations
   for the edges — a citation of kind "Child Report" IS an edge, which is the
   same rule the seeded version used, against records instead of strings.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Modal, Empty, Note, Combo } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { DiagChip } from '../domain.jsx';
import { fetchReportOccurrenceContent } from '../../../services/dataverse.js';

/* DiagChip is keyed by the class, not the label, and a Section's angle comes
   back from Dataverse as the label. Same map Build a report/plan keeps. */
const ANGLE_CLS = { Descriptive:'d1', Diagnostic:'d2', Predictive:'d3', Prescriptive:'d4' };

/* ---- 3. Reporting hierarchy -------------------------------------------- */
export function ScreenHierarchy(){
  const {dvReportOccs, dvLookup, openDvRec} = use();
  /* Both are memoised because everything below -- the template index, the edge
     map, the filter walk -- depends on them. Left as plain fallbacks they are
     new objects on every render, so the whole citation set would be rewalked
     on each keystroke in the search box. */
  const L  = useMemo(()=>dvLookup || {}, [dvLookup]);
  const nm = (fn, id) => (id && typeof fn === 'function' ? fn(id) : null);

  const [q,setQ]           = useState('');
  const [type,setType]     = useState('');
  const [dept,setDept]     = useState('');
  const [focus,setFocus]   = useState(null);
  const [detail,setDetail] = useState(null);
  const [content,setContent] = useState(null);   // { sections, citations } once read
  const [err,setErr]       = useState(null);

  /* Sections and citations are read when this tab opens rather than at app
     start: nothing else needs them and the bodies are long. Same shape and
     same reasoning as Reports / Plans. */
  useEffect(()=>{
    let live = true;
    setErr(null);
    fetchReportOccurrenceContent()
      .then(c=>{ if(live) setContent(c); })
      .catch(e=>{
        console.warn('[dataverse] Report sections/citations read failed:', e);
        if(live){ setErr(e); setContent({sections:[], citations:[]}); }
      });
    return ()=>{ live = false; };
  },[]);

  const reports = useMemo(()=>dvReportOccs || [], [dvReportOccs]);
  const rep     = id => reports.find(r=>r.id===id) || null;
  const nameOf  = r => r?.name || '(untitled)';
  const typeOf  = r => nm(L.rptTpl, r?.templateId) || 'Report / Plan';
  const deptOf  = r => nm(L.dept, r?.departmentId) || null;

  /* Sections per report, and the citations inside each section. The edge the
     tree is built from lives across the two: a citation names the child, and
     the section it sits in belongs to the parent. */
  /* A citation's label for a Child Report is written "Child: <name>" by the
     generator and "Report: <name>" by the picker. Either way the name is what
     follows the colon. */
  const bareName = t => String(t||'').replace(/^\s*(child|report)\s*:\s*/i,'').trim();
  const norm = t => bareName(t).toLowerCase().replace(/\s+/g,' ');

  /* Seeded Child Report citations name a TEMPLATE, with the Report Type
     appended -- "…Relations Report Conclusion" for the template "…Relations
     Report". They do not name an occurrence, and occurrence names are not
     unique anyway, so the label is resolved template-first.

     Longest name first, so "… Report (copy)" is not beaten by "… Report"
     being a prefix of it. Only templates that actually have an occurrence are
     listed, which is the only set an edge can point into. */
  const templatesByName = useMemo(()=>{
    const seen = new Map();
    for(const r of reports){
      if(!r.templateId) continue;
      const n = nm(L.rptTpl, r.templateId);
      if(n) seen.set(norm(n), r.templateId);
    }
    return [...seen].sort((a,b)=>b[0].length - a[0].length);
  },[reports, L]);

  const templateForLabel = label => {
    const t = norm(label);
    if(!t) return null;
    for(const [n,id] of templatesByName) if(t === n || t.startsWith(n)) return id;
    return null;
  };

  /* One occurrence of that template to hang the edge on. A report rests on one
     that already exists, so the newest at or before the parent's period wins;
     scope narrows first, because the same template runs in many units. */
  const pickOccurrence = (templateId, parent) => {
    const all = reports.filter(r=>r.templateId===templateId && r.id!==parent?.id);
    if(!all.length) return null;
    const inScope = all.filter(r=>
         (parent?.businessUnitId ? r.businessUnitId===parent.businessUnitId
          : parent?.regionId ? r.regionId===parent.regionId : true)
      && (!parent?.departmentId || !r.departmentId || r.departmentId===parent.departmentId));
    const pool = inScope.length ? inScope : all;
    const byPeriod = [...pool].sort((a,b)=>String(b.period||'').localeCompare(String(a.period||'')));
    const earlier = parent?.period
      ? byPeriod.filter(r=>String(r.period||'') <= String(parent.period)) : [];
    return (earlier[0] || byPeriod[0] || null)?.id || null;
  };

  const byId = useMemo(()=>new Map(reports.map(r=>[r.id,r])),[reports]);

  const {sectionsByReport, citesBySection, childIds, parentIds, citedNames, edgeStats} = useMemo(()=>{
    const secs = {}, cites = {}, kids = {}, parents = {};
    const ownerOfSection = {};
    const citedNames = {};
    let byLookup = 0, byName = 0, unresolved = 0;
    for(const s of content?.sections || []){
      if(!s.reportId) continue;
      (secs[s.reportId] = secs[s.reportId] || []).push(s);
      ownerOfSection[s.id] = s.reportId;
    }
    for(const k in secs){
      secs[k].sort((a,b)=>
        (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || String(a.created).localeCompare(String(b.created)));
    }
    for(const c of content?.citations || []){
      if(!c.sectionId) continue;
      (cites[c.sectionId] = cites[c.sectionId] || []).push(c);
      /* The edge. A Child Report citation means "this report rests on that
         one" — the same claim the seeded model made with an RPT: string.

         The lookup wins where it is set. Where it is not -- which is every
         seeded citation today -- the label's name is matched against the
         register, so the edges that exist are drawn instead of being lost to
         a column nobody filled in. */
      if(c.kind !== 'Child Report' && !c.citedReportId) continue;
      const parent = ownerOfSection[c.sectionId];
      let child = c.citedReportId;
      if(child) byLookup++;
      else {
        const tpl = templateForLabel(c.label);
        child = tpl ? pickOccurrence(tpl, byId.get(parent)) : null;
        if(child) byName++;
        else {
          /* Nothing to point at -- most often because the cited report has no
             occurrence yet. The citation still says this report rests on that
             one, so the claim is drawn rather than dropped, as a cited node
             carrying the name the author wrote. */
          const nice = bareName(c.label);
          if(!nice) continue;
          child = 'cite:' + norm(c.label);
          citedNames[child] = nice;
          unresolved++;
        }
      }
      if(!parent || !child || parent === child) continue;
      (kids[parent]    = kids[parent]    || new Set()).add(child);
      (parents[child]  = parents[child]  || new Set()).add(parent);
    }
    return {
      sectionsByReport: secs, citesBySection: cites,
      childIds:  id => [...(kids[id] || [])],
      parentIds: id => [...(parents[id] || [])],
      citedNames,
      edgeStats: { byLookup, byName, unresolved },
    };
  },[content, templatesByName, byId]);

  const sectionsOf = r => sectionsByReport[r.id] || [];
  const citesOf    = s => citesBySection[s.id] || [];

  /* A node key is either an occurrence id or "cite:<name>". nodeOf() turns
     either into something the tree can draw; `cited` marks the ones with no
     record behind them. */
  const nodeOf = key => key.startsWith('cite:')
    ? { id: key, name: citedNames[key] || '(cited report)', cited: true }
    : rep(key);
  const childrenOf = n => childIds(n.id).map(nodeOf).filter(Boolean);

  /* A report nothing else cites is a top of the tree. Reports with no content
     read at all are still roots — they simply have nothing under them. */
  const roots = reports.filter(r=>parentIds(r.id).length===0);

  /* Everything above and below the focused report stays lit; the rest dims,
     so a branch reads without the tree being torn apart to show it. */
  const relatedTo = id => {
    const seen = new Set();
    const up   = x => { if(seen.has(x)) return; seen.add(x); parentIds(x).forEach(up); };
    const down = x => { if(seen.has(x)) return; seen.add(x); childIds(x).forEach(down); };
    up(id); down(id);
    return seen;
  };
  const related = focus ? relatedTo(focus) : null;

  const filtersOn = !!(q.trim() || type || dept);
  /* A cited node has a name and nothing else, so only the text search applies
     to it -- it has no template or department to match on. */
  const matches = r => r?.cited
    ? (!q.trim() || nameOf(r).toLowerCase().includes(q.trim().toLowerCase()))
    : (!q.trim() || nameOf(r).toLowerCase().includes(q.trim().toLowerCase())) &&
      (!type || typeOf(r)===type) &&
      (!dept || deptOf(r)===dept);

  /* A branch survives a filter when anything in it matches, so a match deep
     down still pulls its ancestors into view -- otherwise filtering would hide
     the very structure this screen exists to show. Memoised because it walks
     the whole tree per node otherwise. */
  const branchHasMatch = useMemo(()=>{
    const memo = new Map();
    const walk = (id, trail) => {
      if(memo.has(id)) return memo.get(id);
      if(trail.has(id)) return false;          // a cycle contributes nothing
      trail.add(id);
      const r = id.startsWith('cite:')
        ? { name: citedNames[id] || '', cited: true }
        : rep(id);
      let hit = !!r && matches(r);
      if(!hit) for(const k of childIds(id)) if(walk(k, trail)){ hit = true; break; }
      trail.delete(id);
      memo.set(id, hit);
      return hit;
    };
    return id => walk(id, new Set());
  },[content, q, type, dept, reports]);

  const visible = r => !filtersOn || branchHasMatch(r.id);
  const matchCount = filtersOn ? reports.filter(matches).length : reports.length;

  const types = [...new Set(reports.map(typeOf))].sort();
  const depts = [...new Set(reports.map(deptOf).filter(Boolean))].sort();

  /* The BI reports a report/plan rests on. Read straight off its citations
     now that lm_BIReport is a real lookup — it used to be inferred by walking
     each cited KPI to the dashboard behind it. */
  const biOf = r => [...new Set(
    sectionsOf(r).flatMap(s=>citesOf(s)
      .filter(c=>c.kind==='BI Report')
      .map(c=>c.biName || c.label).filter(Boolean)))];

  /* A citation cycle would otherwise recurse until the stack gives out. A
     repeated node is kept as a marker rather than dropped, because "it also
     hangs here" is a real edge and hiding it would make the tree read as
     smaller than it is. */
  const Node = ({r,seen}) => {
    const kids  = childrenOf(r).filter(visible);
    /* Dim means "context, not result": a node kept only because something
       under it matched, or one outside the focused branch. */
    const dim   = (related && !related.has(r.id)) || (filtersOn && !matches(r));

    if(seen.includes(r.id))
      return <li><div className="tnodebox dim repeat">
        <span className="tn-t">↺ {nameOf(r)}</span>
        <span className="tn-m">already shown higher up</span></div></li>;

    /* A cited report: named by a section, with no occurrence behind it. Drawn
       as a box so the branch is visible, but not clickable -- there is no
       record to open. */
    if(r.cited)
      return <li><div className={'tnodebox cited'+(dim?' dim':'')}>
        <span className="tn-t">{r.name}</span>
        <span className="tn-m">Cited report</span>
        <span className="tn-m">not generated yet</span>
      </div></li>;

    const secs = sectionsOf(r);
    return <li>
      <button type="button"
        className={'tnodebox'+(dim?' dim':'')+(focus===r.id?' focused':'')}
        onClick={()=>{ setFocus(r.id); setDetail(r.id); }}>
        <span className="tn-t">{nameOf(r)}</span>
        <span className="tn-m">{typeOf(r)}{r.period?' · '+fmtP(r.period):''}</span>
        <span className="tn-m">{secs.length} section{secs.length===1?'':'s'}
          {kids.length?` · ${kids.length} child${kids.length===1?'':'ren'}`:''}</span>
      </button>
      {kids.length
        ? <ul>{kids.map(k=><Node key={k.id} r={k} seen={[...seen,r.id]}/>)}</ul>
        : null}
    </li>;
  };

  const shownRoots = roots.filter(visible);
  const linkedCount = reports.filter(r=>childIds(r.id).length || parentIds(r.id).length).length;
  const det = detail ? rep(detail) : null;
  const loading = content === null;

  return <>
    <div className="ph"><h1>Reporting hierarchy</h1>
      <div className="sub">Every report/plan and every child it references, as one tree. Click a
        report to focus its branch; click again to see what’s inside it.</div></div>

    {err
      ? <Note k="warn" ic="⚠">The sections and citations could not be read, so the tree shows every
          report/plan as a top-level one. Nothing is missing from the register — only the links
          between them.</Note>
      : null}

    <div className="card" style={{padding:14}}>
      <div className="flbl">Filter the hierarchy</div>
      <div className="hier-f">
        <input type="search" value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Search report/plan name…"/>
        <Combo value={type} onChange={setType} all="Any template"
          placeholder="Search templates…" opts={types.map(t=>({id:t, name:t}))}/>
        <Combo value={dept} onChange={setDept} all="Any department"
          placeholder="Search departments…" opts={depts.map(d=>({id:d, name:d}))}/>
      </div>
      {focus
        ? <div className="csub" style={{marginTop:8,marginBottom:0}}>
            Focused on <b>{rep(focus)?nameOf(rep(focus)):focus}</b> —{' '}
            <a style={{cursor:'pointer',textDecoration:'underline'}}
              onClick={()=>{setFocus(null);setDetail(null);}}>clear focus</a>
          </div>
        : null}
    </div>

    <div className="card hier-canvas">
      {loading
        ? <Empty ic="…">Reading report sections and citations…</Empty>
        : roots.length===0
        ? <Empty>{reports.length
            ? 'Every report/plan cites another one, so the tree has no top. Clear a citation cycle to see it.'
            : 'No report/plan exists yet.'}</Empty>
        : shownRoots.length===0
        ? <Empty>No report/plan matches those filters.</Empty>
        : <div className="org-tree">
            <ul>{shownRoots.map(r=><Node key={r.id} r={r} seen={[]}/>)}</ul>
          </div>}
    </div>

    {!loading && !err
      ? <div className="cnote" style={{marginTop:0}}>
          <b>{linkedCount}</b> of {reports.length} report{reports.length===1?'':'s'} sit in a tree
          with another{filtersOn ? <> · <b>{matchCount}</b> match the filters</> : null}.
          {edgeStats.byName>0
            ? <> {edgeStats.byName} link{edgeStats.byName===1?'':'s'} {edgeStats.byName===1?'was':'were'} resolved
                from the citation's text, which names a <b>Report Template</b> rather than one
                occurrence — <code>lm_citedreportoccurrence</code> is empty on those rows. The
                occurrence shown is the closest match in this report's own scope and period. Citing
                through the picker records the exact one instead.</>
            : null}
          {edgeStats.unresolved>0
            ? <> {edgeStats.unresolved} cited report{edgeStats.unresolved===1?' is':'s are'} shown as
                a dashed box: a section names {edgeStats.unresolved===1?'it':'them'}, but no
                occurrence of that report exists yet, so there is nothing to open. The branch is
                drawn because the citation is real.</>
            : null}
        </div>
      : null}

    <div className="cnote">Top-level reports/plans are the ones nothing else references. Every
      branch below one is a report/plan it cites, through a <b>Child Report</b> citation in one of
      its sections. Click any box to focus its branch and see what’s inside it.</div>

    {det
      ? <Modal onClose={()=>setDetail(null)}
          title={nameOf(det)}
          sub={[typeOf(det), deptOf(det), det.status, fmtP(det.period)].filter(Boolean).join(' · ')}
          footer={<>
            <Btn onClick={()=>setDetail(null)}>Close</Btn>
            <Btn k="pri" onClick={()=>{ setDetail(null); openDvRec('Report', det); }}>
              Open full report/plan</Btn>
          </>}>
          <div className="flbl" style={{marginBottom:6}}>Sections</div>
          {sectionsOf(det).length===0
            ? <div className="holder">This report/plan has no sections yet.</div>
            : sectionsOf(det).map(s=>
                <div key={s.id} className="hier-sec">
                  <div className="h"><b>{s.heading}</b><DiagChip d={ANGLE_CLS[s.angle]}/></div>
                  <div className="csub" style={{marginBottom:0}}>
                    {String(s.body||'').slice(0,140)}{String(s.body||'').length>140?'…':''}</div>
                </div>)}
          {biOf(det).length
            ? <>
                <div className="flbl" style={{margin:'14px 0 6px'}}>BI reports referenced</div>
                <div className="pill-set">
                  {biOf(det).map(n=><Tag key={n} c="teal">{n}</Tag>)}
                </div>
              </>
            : null}
        </Modal>
      : null}
  </>;
}
