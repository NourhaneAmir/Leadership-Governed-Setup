/* =========================================================================
   Presentational primitives.

   Extracted from LeadershipApp.jsx alongside src/shared/format.js so a screen
   can be moved between modules — or into an app of its own — without carrying
   the execution module with it. Everything here is stateless and takes what it
   needs through props; nothing reads app context or seed data.

   Deliberately NOT here: `Hist`, which resolves a person id through the seeded
   PEOPLE table, and `Ctx`/`use`, which are the execution module's store. Both
   stay in LeadershipApp.jsx until the store itself is extracted.
   ========================================================================= */
import React, { useEffect } from 'react';
import { pctColour } from './format.js';

export const Tag  = ({c='grey',children,...r}) => <span className={'tag '+c} {...r}>{children}</span>;
export const Btn  = ({k='',children,...r}) => <button className={'btn '+k} {...r}>{children}</button>;
export const Note = ({k='info',ic,children}) =>
  <div className={'note '+k}><span className="ic">{ic|| (k==='warn'?'▲':k==='err'?'✕':k==='ok'?'✓':k==='lock'?'🔒':'i')}</span><div>{children}</div></div>;
export const OD   = ({id,closed}) => <span className={'od'+(closed?' closed':'')}>{closed?'✓ ':'⚠ '}{id}</span>;
export const Bar  = ({v,c}) => <div className={'bar '+(c||'')}><i style={{width:Math.max(0,Math.min(100,v))+'%'}}/></div>;

export const Field = ({label,req,hint,err,children}) =>
  <div className="f">
    {label && <label>{label}{req && <span className="req">*</span>}</label>}
    {children}
    {hint && !err && <div className="hint">{hint}</div>}
    {err && <div className="err">{err}</div>}
  </div>;

export const Empty = ({ic='—',children}) => <div className="empty"><div className="ic">{ic}</div>{children}</div>;

export const Stat = ({label,v,d,c,on,onClick}) =>
  <div className={'stat'+(onClick?' click':'')+(on?' on':'')} onClick={onClick}>
    <label>{label}</label>
    <div className="v" style={c?{color:`var(--${c})`}:null}>{v}</div>
    {d && <div className="d">{d}</div>}
  </div>;

export const KVBlock = ({items}) =>
  <div className="kv-block">{items.filter(Boolean).map(([k,v],i)=>
    <div className="kv-i" key={i}><label>{k}</label><div>{v}</div></div>)}</div>;

export const Rail = ({steps,now,done,voidAt}) =>
  <div className="rail">{steps.map((s,i)=>{
    const cls = voidAt===s ? 'void' : done.includes(s) ? 'done' : now===s ? 'now' : '';
    return <div className={'rail-s '+cls} key={s}>
      <label>Step {i+1}</label><div className="n">{s}</div></div>;
  })}</div>;

export function Modal({title,sub,onClose,footer,wide,children}){
  useEffect(()=>{
    const k=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k);
  },[onClose]);
  return <div className="ovl" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className={'modal'+(wide?' wide':'')} onMouseDown={e=>e.stopPropagation()}>
      <div className="m-hd"><div><h3>{title}</h3>{sub&&<div className="msub">{sub}</div>}</div>
        <button className="m-x" onClick={onClose}>×</button></div>
      <div className="m-bd">{children}</div>
      {footer && <div className="m-ft">{footer}</div>}
    </div></div>;
}

export const Pills = ({opts,val,onChange,multi}) =>
  <div className="pill-set">{opts.map(o=>{
    const v = typeof o==='string'?o:o.v, lbl = typeof o==='string'?o:o.label||o.v;
    const on = multi ? (val||[]).includes(v) : val===v;
    return <button type="button" key={v} className={'pill'+(on?' on':'')}
      onClick={()=>multi
        ? onChange(on ? val.filter(x=>x!==v) : [...(val||[]), v])
        : onChange(on?null:v)}>{lbl}</button>;
  })}</div>;

/* score display used in three places */
export const ScoreHero = ({score,coverage,applicable,total,threshold,state}) => {
  const pub = state==='Approved';
  return <div className="score-hero">
    <div>
      <div className="score-lbl">Overall Score</div>
      {pub
        ? <div className="score-big" style={{color:`var(--${pctColour(score)})`}}>{score}%</div>
        : <div className="score-big" style={{color:'var(--faint)',fontSize:'26px'}}>Pending Review</div>}
      {pub && threshold!=null &&
        <Tag c={score>=threshold?'green':'red'}>{score>=threshold?'Pass':'Below threshold'} · {threshold}%</Tag>}
      {pub && threshold==null && <div style={{fontSize:11.5,color:'var(--muted)',marginTop:4}}>
        No pass threshold set <OD id="OD-22"/></div>}
    </div>
    <div style={{minWidth:210}}>
      <div className="score-lbl">Coverage</div>
      <div style={{fontSize:19,fontWeight:680,marginBottom:5}}>
        {applicable} of {total} questions <span style={{color:'var(--muted)',fontWeight:500,fontSize:13}}>· {coverage}%</span>
      </div>
      <Bar v={coverage} c={pctColour(coverage)}/>
      <div style={{fontSize:11.5,color:'var(--muted)',marginTop:5}}>
        Published beside every score so a result drawn from few applicable questions is not misread.
      </div>
    </div>
  </div>;
};
