/* =========================================================================
   ARTIFACT · ScreenOrgReports

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx and ../../../shared — never from
   LeadershipApp.jsx, so this file can move to another module (or another
   app) without dragging the execution module behind it.
   ========================================================================= */
import React, { useState } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty } from '../../../shared/ui.jsx';
import { PERIOD, fmtP, fmtDT } from '../../../shared/format.js';
import { P, PR, DiagChip, CiteCard, canSeeReport, rptCfg, rptTagC,
         matchesQuery } from '../domain.jsx';

/* ---- 2. Reports / Plans ------------------------------------------------
   Laid out as the prototype has it, because the layout IS the argument: a
   rail of reports on the left, one report open on the right, and that report
   shown as a stack of PARAGRAPHS rather than pages. Each paragraph carries
   its author, its process, its diagnostic angle and the citations it rests
   on — which is what makes it contestable, and what a BI visual can never be.

   Direction is inferred from authorship: a report this user created is
   issued, anything else visible to them was received. That is the only
   direction the data actually records. */
export function ScreenOrgReports(){
  const {db,me,go,setSel} = use();
  const [dir,setDir]   = useState('in');
  const [openId,setOpenId] = useState(null);
  const [openPara,setOpenPara] = useState(null);
  const [q,setQ] = useState('');

  const visible = db.reports.filter(r=>canSeeReport(r,me));
  const inDir   = visible.filter(r=> dir==='out' ? r.creator===me : r.creator!==me);
  const list    = inDir.filter(r=>matchesQuery(q,[rptCfg(r)?.name, r.dept, r.period, P(r.creator).name]));

  const parasOf = r => (r.blocks||[])
    .map(id=>(db.paragraphs||[]).find(x=>x.id===id)).filter(Boolean);
  const procsOf = r => [...new Set(parasOf(r).map(x=>x.proc).filter(Boolean))];

  /* Selection follows the list rather than being stored independently, so
     switching tab or filtering can never leave a stale report open. */
  const rec = list.find(r=>r.id===openId) || list[0] || null;
  const cfg = rec ? rptCfg(rec) : null;
  const paras = rec ? parasOf(rec) : [];
  const scope = {bu:rec?.bu||'ALL', period:rec?.period||PERIOD};

  /* The default audience is real: it is the review chain the Setup names.
     Anything beyond that is the Sharing feature, which has a registered table
     and no columns wired yet (§9) — so it is described, not faked. */
  const audience = (cfg?.reviewers||[]).map(u=>P(u).name);

  return <>
    <div className="ph"><h1>Reports / Plans</h1>
      <div className="sub">Organizational reports and plans, in and out. The same class of thing you
        produce: paragraphs with an author, a process and citations.</div></div>

    <div className="tabs">
      {[['in','Received'],['out','Issued by you']].map(([k,l])=>
        <button key={k} className={dir===k?'on':''}
          onClick={()=>{setDir(k);setOpenId(null);setOpenPara(null);}}>
          {l}<span className="c">{visible.filter(r=>k==='out'?r.creator===me:r.creator!==me).length}</span>
        </button>)}
    </div>

    {inDir.length===0
      ? <div className="card"><Empty ic={dir==='out'?'📤':'📥'}>
          <b>{dir==='out'?'Nothing issued yet':'Nothing received yet'}</b>
          <div style={{marginTop:5}}>{dir==='out'
            ? 'Build one in Reports & Plans — pick a template or start blank, add whatever it needs to say, and issue it. It will appear here, and in every reviewer’s inbox exactly like the ones you receive.'
            : 'Reports and plans other roles issue will appear here.'}</div>
          {dir==='out'
            ? <div className="btn-row" style={{justifyContent:'center',marginTop:12}}>
                <Btn k="sm pri" onClick={()=>go('rpt')}>Build a report / plan</Btn></div>
            : null}
        </Empty></div>

      : <div className="org-split">
          {/* ---- the rail ---- */}
          <div className="card flush org-rail">
            <div className="card-hd" style={{display:'flex',alignItems:'center',gap:10}}>
              <h2 style={{flex:1,fontSize:13.5}}>
                {dir==='out'?'Issued by you':'Received'}</h2>
              <Tag c="teal">{list.length}</Tag>
            </div>
            <div style={{padding:'8px 10px 0'}}>
              <input type="search" value={q} placeholder="Search…"
                onChange={e=>setQ(e.target.value)}
                style={{width:'100%',border:'1px solid var(--border-d)',borderRadius:8,
                        padding:'6px 9px',fontSize:12.5}}/>
            </div>
            <div className="org-nodes">
              {list.length===0
                ? <div className="holder" style={{padding:'10px 12px'}}>Nothing matches “{q.trim()}”.</div>
                : list.map(r=>{
                    const c2=rptCfg(r), ps=parasOf(r);
                    return <button key={r.id} type="button"
                      className={'org-node'+(rec&&rec.id===r.id?' on':'')}
                      onClick={()=>{setOpenId(r.id);setOpenPara(null);}}>
                      <span className="n">{c2?.name||'(untitled)'}</span>
                      <span className="s">{P(r.creator).name} · {fmtP(r.period)}</span>
                      <span className="s">{ps.length} conclusion{ps.length===1?'':'s'}
                        {procsOf(r).length?' · '+procsOf(r).map(x=>(PR(x)||{}).n||x).join(', '):''}</span>
                    </button>;
                  })}
            </div>
            <div className="holder" style={{padding:'10px 12px',borderTop:'1px solid var(--border)'}}>
              A report/plan is paragraphs, not pages. Each one carries its author, its process and
              what it rests on.
            </div>
          </div>

          {/* ---- the open report ---- */}
          <div className="card">
            {!rec ? <Empty>Nothing selected.</Empty> : <>
              <div className="ph-row" style={{gap:9,alignItems:'baseline',flexWrap:'wrap'}}>
                <h2 style={{flex:1,minWidth:0}}>{cfg?.name||'(untitled)'}</h2>
                <Tag c={rptTagC(rec.status)}>{rec.status}</Tag>
              </div>
              <div className="csub">
                {[rec.dept, P(rec.creator).name, fmtP(rec.period),
                  procsOf(rec).length?'covers '+procsOf(rec).map(x=>(PR(x)||{}).n||x).join(', '):null
                 ].filter(Boolean).join(' · ')}
              </div>

              {/* shared with */}
              <div className="card" style={{padding:'11px 13px',marginBottom:12}}>
                <div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
                  <span className="tset-lbl">Shared with{audience.length?` (${audience.length})`:''}</span>
                  {audience.length
                    ? audience.map(n=><Tag key={n} c="grey">{n}</Tag>)
                    : <span className="holder">Only the default audience so far.</span>}
                </div>
                <div className="holder" style={{marginTop:6}}>
                  This is the review chain the Setup names. Sharing beyond it needs
                  <code> lm_reportoccurrenceshare</code>, which is registered but not yet wired.
                </div>
              </div>

              {paras.length===0
                ? <Empty>This report has no paragraphs yet.</Empty>
                : paras.map(pp=>{
                    const isOpen = openPara===pp.id;
                    const citedBy = (db.paragraphs||[]).filter(x=>(x.cites||[]).includes(pp.id)).length;
                    return <div key={pp.id} className={'orp'+(isOpen?' on':'')}>
                      <button type="button" className="orp-h"
                        onClick={()=>setOpenPara(isOpen?null:pp.id)}>
                        <span className="orp-t">{pp.h}</span>
                        <DiagChip d={pp.diag}/>
                        {pp.proc?<Tag c="grey">{(PR(pp.proc)||{}).n||pp.proc}</Tag>:null}
                        <Tag c="teal">conclusion</Tag>
                        {citedBy?<span className="holder" style={{marginLeft:'auto'}}>
                          cited by {citedBy}</span>:null}
                      </button>
                      {isOpen
                        ? <div style={{padding:12}}>
                            <div style={{fontSize:12.5,lineHeight:1.8,color:'var(--ink-2)'}}>{pp.text}</div>
                            <div className="holder" style={{marginTop:8}}>
                              {P(pp.author).name} · {fmtDT(pp.at)}</div>
                            {(pp.cites||[]).length
                              ? <div style={{marginTop:8}}>
                                  {pp.cites.map((c,i)=><CiteCard key={i} cite={c} scope={scope}/>)}
                                </div>
                              : <div className="holder" style={{marginTop:8}}>
                                  Rests on nothing citable — a conclusion with no source under it.</div>}
                          </div>
                        : null}
                    </div>;
                  })}

              <Note k="info" ic="i"><b>You can argue with a report/plan.</b> Every paragraph in it is a
                conclusion someone drew — citable, drillable to what it rests on, and contestable.
                None of that applies to a visual.</Note>
            </>}
          </div>
        </div>}
  </>;
}
