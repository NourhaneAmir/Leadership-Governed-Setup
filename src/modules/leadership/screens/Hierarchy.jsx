/* =========================================================================
   ARTIFACT · ScreenHierarchy

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx and ../../../shared — never from
   LeadershipApp.jsx, so this file can move to another module (or another
   app) without dragging the execution module behind it.
   ========================================================================= */
import React, { useState } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Empty } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { citeKind, citeId, rptCfg, rptTagC } from '../domain.jsx';

/* ---- 3. Reporting hierarchy -------------------------------------------- */
export function ScreenHierarchy(){
  const {db,go,setSel} = use();
  const [focus,setFocus] = useState(null);

  /* A parent cites a child through a paragraph reference of kind RPT. The
     tree is therefore derived, not stored — which also means a report can
     legitimately appear under more than one parent. */
  const childrenOf = r => {
    const ids = (r.blocks||[])
      .map(id=>(db.paragraphs||[]).find(p=>p.id===id)).filter(Boolean)
      .flatMap(p=>p.cites||[])
      .filter(c=>citeKind(c)==='RPT')
      .map(citeId);
    return [...new Set(ids)].map(id=>db.reports.find(x=>x.id===id)).filter(Boolean);
  };
  const childIds = new Set(db.reports.flatMap(r=>childrenOf(r).map(c=>c.id)));
  const roots = db.reports.filter(r=>!childIds.has(r.id));
  const shown = focus ? db.reports.filter(r=>r.id===focus) : roots;

  const Node = ({r,depth,seen}) => {
    /* A cycle would otherwise recurse until the stack gives out. */
    if(seen.includes(r.id))
      return <div className="hier-node" style={{marginLeft:depth*20}}>
        <span className="holder">↺ {rptCfg(r)?.name} — already shown higher up</span></div>;
    const kids = childrenOf(r);
    return <div style={{marginLeft:depth*20}}>
      <div className="hier-node">
        <span className={'hier-dot'+(kids.length?'':' leaf')}/>
        <button type="button" className="hier-name"
          onClick={()=>{ setSel(v=>({...v,rpt:r.id})); go('rpt'); }}>
          {rptCfg(r)?.name||'(untitled)'}</button>
        <Tag c="grey">{fmtP(r.period)}</Tag>
        <Tag c={rptTagC(r.status)}>{r.status}</Tag>
        {kids.length
          ? <span className="holder">{kids.length} child{kids.length>1?'ren':''}</span>
          : null}
      </div>
      {kids.map(k=><Node key={k.id} r={k} depth={depth+1} seen={[...seen,r.id]}/>)}
    </div>;
  };

  return <>
    <div className="ph"><h1>Reporting hierarchy</h1>
      <div className="sub">Every report/plan and every child it references, as one tree. A child is a
        report cited from one of the parent's paragraphs, so the tree is derived from real citations
        rather than declared separately.</div></div>

    {focus
      ? <div className="btn-row" style={{marginBottom:12}}>
          <Btn k="sm" onClick={()=>setFocus(null)}>← All roots</Btn>
          <span className="holder">Focused on one branch.</span>
        </div>
      : null}

    <div className="card">
      <h2>{focus?'Focused branch':'Roots'}</h2>
      <div className="csub">
        {roots.length} report{roots.length===1?'':'s'} cited by nothing else
        {childIds.size?` · ${childIds.size} appear as a child somewhere`:''}.
      </div>
      {shown.length===0
        ? <Empty>No report/plan exists yet.</Empty>
        : shown.map(r=><Node key={r.id} r={r} depth={0} seen={[]}/>)}
    </div>

    {!focus && childIds.size>0
      ? <div className="card">
          <h2>Focus one branch</h2>
          <div className="csub">Open a single report and everything beneath it.</div>
          <div className="pill-set">
            {db.reports.map(r=>
              <button key={r.id} className="pill" onClick={()=>setFocus(r.id)}>
                {rptCfg(r)?.name||'(untitled)'}</button>)}
          </div>
        </div>
      : null}
  </>;
}
