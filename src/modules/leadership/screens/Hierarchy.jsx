/* =========================================================================
   ARTIFACT · ScreenHierarchy

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx and ../../../shared — never from
   LeadershipApp.jsx, so this file can move to another module (or another
   app) without dragging the execution module behind it.

   Laid out as the prototype has it, because the shape carries the argument:
   a top-down org chart, not an indented list. A report/plan sits ABOVE the
   ones it rests on, so the depth of a claim is something you see rather than
   something you count — and a report with three levels under it is visibly a
   different kind of statement from one with none.
   ========================================================================= */
import React, { useState } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Modal, Empty } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { P, BIR, DiagChip, findKpi, citeKind, citeId, rptCfg } from '../domain.jsx';

/* ---- 3. Reporting hierarchy -------------------------------------------- */
export function ScreenHierarchy(){
  const {db,go,setSel} = use();
  const [q,setQ]         = useState('');
  const [type,setType]   = useState('');
  const [dept,setDept]   = useState('');
  const [focus,setFocus] = useState(null);
  const [detail,setDetail] = useState(null);

  const reports = db.reports || [];
  const rep     = id => reports.find(r=>r.id===id) || null;
  const parasOf = r => (r.blocks||[])
    .map(id=>(db.paragraphs||[]).find(p=>p.id===id)).filter(Boolean);
  const typeOf  = r => rptCfg(r)?.cat || 'Report / Plan';
  const nameOf  = r => rptCfg(r)?.name || '(untitled)';

  /* A report is the parent of anything its paragraphs cite — whether cited
     whole (a Child Report reference) or through one of that report's own
     paragraphs. Both routes mean the same thing: this conclusion rests on
     that one. So the tree is derived from real citations, never declared. */
  const childIdsOf = r => {
    const out = [];
    parasOf(r).forEach(p=>(p.cites||[]).forEach(c=>{
      const k = citeKind(c), id = citeId(c);
      let target = null;
      if(k==='RPT') target = rep(id);
      if(k==='PAR'){
        const owner = reports.find(x=>(x.blocks||[]).includes(id));
        if(owner) target = owner;
      }
      if(target && target.id!==r.id && !out.includes(target.id)) out.push(target.id);
    }));
    return out;
  };
  const parentIdsOf = id => reports.filter(r=>childIdsOf(r).includes(id)).map(r=>r.id);
  const roots = reports.filter(r=>parentIdsOf(r.id).length===0);

  /* Everything above and below the focused report stays lit; the rest dims,
     so a branch reads without the tree being torn apart to show it. */
  const relatedTo = id => {
    const seen = new Set();
    const up   = x => { if(seen.has(x)) return; seen.add(x); parentIdsOf(x).forEach(up); };
    const down = x => { if(seen.has(x)) return; seen.add(x); childIdsOf(rep(x)||{}).forEach(down); };
    up(id); down(id);
    return seen;
  };
  const related = focus ? relatedTo(focus) : null;

  const filtersOn = !!(q.trim() || type || dept);
  const matches = r =>
    (!q.trim() || nameOf(r).toLowerCase().includes(q.trim().toLowerCase())) &&
    (!type || typeOf(r)===type) &&
    (!dept || r.dept===dept);

  const types = [...new Set(reports.map(typeOf))].sort();
  const depts = [...new Set(reports.map(r=>r.dept).filter(Boolean))].sort();

  /* The BI reports a report/plan ultimately rests on, reached through the
     KPIs its paragraphs cite. */
  const biOf = r => {
    const ids = [];
    parasOf(r).forEach(p=>(p.cites||[]).forEach(c=>{
      if(citeKind(c)!=='KPI' && citeKind(c)!=='BD') return;
      const f = findKpi(citeId(c));
      if(f && f.k.bi && !ids.includes(f.k.bi)) ids.push(f.k.bi);
    }));
    return ids.map(BIR).filter(Boolean);
  };

  /* A citation cycle would otherwise recurse until the stack gives out. The
     prototype drops a repeated node silently; this keeps it as a marker,
     because "it also hangs here" is a real edge and hiding it would make the
     tree read as smaller than it is. */
  const Node = ({r,seen}) => {
    const kids = childIdsOf(r).map(rep).filter(Boolean);
    const dim  = (related && !related.has(r.id)) || (filtersOn && !matches(r));
    const paras = parasOf(r);
    const box =
      <button type="button"
        className={'tnodebox'+(dim?' dim':'')+(focus===r.id?' focused':'')}
        onClick={()=>{ setFocus(r.id); setDetail(r.id); }}>
        <span className="tn-t">{nameOf(r)}</span>
        <span className="tn-m">{typeOf(r)} · {P(r.creator).name}</span>
        <span className="tn-m">{paras.length} section{paras.length===1?'':'s'}
          {kids.length?` · ${kids.length} child${kids.length===1?'':'ren'}`:''}</span>
      </button>;

    if(seen.includes(r.id))
      return <li><div className="tnodebox dim repeat">
        <span className="tn-t">↺ {nameOf(r)}</span>
        <span className="tn-m">already shown higher up</span></div></li>;

    return <li>
      {box}
      {kids.length
        ? <ul>{kids.map(k=><Node key={k.id} r={k} seen={[...seen,r.id]}/>)}</ul>
        : null}
    </li>;
  };

  const det = detail ? rep(detail) : null;

  return <>
    <div className="ph"><h1>Reporting hierarchy</h1>
      <div className="sub">Every report/plan and every child it references, as one tree. Click a
        report to focus its branch; click again to see what’s inside it.</div></div>

    <div className="card" style={{padding:14}}>
      <div className="flbl">Filter the hierarchy</div>
      <div className="hier-f">
        <input type="search" value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Search report/plan name…"/>
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="">Any type</option>
          {types.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={dept} onChange={e=>setDept(e.target.value)}>
          <option value="">Any department</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
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
      {roots.length===0
        ? <Empty>{reports.length
            ? 'Every report/plan cites another one, so the tree has no top. Clear a citation cycle to see it.'
            : 'No report/plan exists yet.'}</Empty>
        : <div className="org-tree">
            <ul>{roots.map(r=><Node key={r.id} r={r} seen={[]}/>)}</ul>
          </div>}
    </div>

    <div className="cnote">Top-level reports/plans are the ones nothing else references. Every
      branch below one is a report/plan it cites — whole, or through one of its own paragraphs.
      Click any box to focus its branch and see what’s inside it.</div>

    {det
      ? <Modal onClose={()=>setDetail(null)}
          title={nameOf(det)}
          sub={[typeOf(det), P(det.creator).name, fmtP(det.period)].filter(Boolean).join(' · ')}
          footer={<>
            <Btn onClick={()=>setDetail(null)}>Close</Btn>
            <Btn k="pri" onClick={()=>{ setSel(v=>({...v,rpt:det.id})); go('rpt'); }}>
              Open full report/plan</Btn>
          </>}>
          <div className="flbl" style={{marginBottom:6}}>Sections</div>
          {parasOf(det).length===0
            ? <div className="holder">This report/plan has no sections yet.</div>
            : parasOf(det).map(p=>
                <div key={p.id} className="hier-sec">
                  <div className="h"><b>{p.h}</b><DiagChip d={p.diag}/></div>
                  <div className="csub" style={{marginBottom:0}}>
                    {String(p.text||'').slice(0,140)}{String(p.text||'').length>140?'…':''}</div>
                </div>)}
          {biOf(det).length
            ? <>
                <div className="flbl" style={{margin:'14px 0 6px'}}>BI reports referenced</div>
                <div className="pill-set">
                  {biOf(det).map(b=><Tag key={b.id} c="teal">{b.n}</Tag>)}
                </div>
              </>
            : null}
        </Modal>
      : null}
  </>;
}
