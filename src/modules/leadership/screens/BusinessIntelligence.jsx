/* =========================================================================
   ARTIFACT · ScreenBI

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx and ../../../shared — never from
   LeadershipApp.jsx, so this file can move to another module (or another
   app) without dragging the execution module behind it.
   ========================================================================= */
import React, { useState, useEffect } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty, Field, Bar } from '../../../shared/ui.jsx';
import { PERIOD, fmtP } from '../../../shared/format.js';
import { PROC_REG, PR, BI_REPORTS, BIR, KPI_CAT, achFor, achPct, achCls, bdDims,
         matchesQuery } from '../domain.jsx';

/* The Power BI embed.

   An earlier version of this screen refused to render the frame at all,
   claiming the host CSP blocked it. That was wrong: what is actually on
   record (§7.6) is that a `fetch` to an external URL shortener was blocked —
   `connect-src`. Framing is `frame-src`, a different directive, and no CSP is
   declared anywhere in this repo, so the policy comes from the Power Apps
   host at runtime and can only be settled by trying it.

   So it tries. Three things can happen and only one is detectable from here:

     · the report renders
     · Power BI renders its own sign-in or permission error INSIDE the frame
     · the host refuses the frame outright and it stays blank

   The second and third are invisible to us — a cross-origin frame cannot be
   inspected, and `onLoad` fires for an error page just as it does for a
   report. So there is no clever detection: the frame gets a fixed height, a
   "nothing appeared?" line sits under it, and the URL stays visible as the
   citable reference either way. */

/* A Power BI link comes in two shapes and only one of them frames.

   What you copy out of the browser is the PORTAL url:
     https://app.powerbi.com/groups/me/reports/<reportId>/ReportSection?ctid=<tenant>
   Power BI refuses to let that be framed — it is the full application, and
   allowing it inside someone else's page is a clickjacking risk, so it ships
   X-Frame-Options/frame-ancestors that deny it. Framing it always fails, and
   the failure looks identical to a host CSP block, which is what makes this
   worth converting rather than debugging later.

   The one that frames is the EMBED endpoint:
     https://app.powerbi.com/reportEmbed?reportId=<reportId>&ctid=<tenant>
   with &groupId=<workspaceId> when the report lives in a real workspace.
   `groups/me` is "My workspace", which has no group id, so it is dropped.

   Anything already pointing at /reportEmbed is passed through untouched. */
export function toEmbedUrl(raw){
  if(!raw) return raw;
  try{
    const u = new URL(raw);
    if(/\/reportEmbed/i.test(u.pathname)) return raw;      // already an embed url
    const m = u.pathname.match(/\/reports\/([0-9a-f-]{36})/i);
    if(!m) return raw;                                     // not a shape we know
    const g = u.pathname.match(/\/groups\/([0-9a-f-]{36})/i);   // 'me' won't match
    const out = new URL('https://app.powerbi.com/reportEmbed');
    out.searchParams.set('reportId', m[1]);
    if(g) out.searchParams.set('groupId', g[1]);
    const ctid = u.searchParams.get('ctid');
    if(ctid) out.searchParams.set('ctid', ctid);
    /* autoAuth is what makes the embed endpoint authenticate the viewer at
       all. Without it the frame loads and immediately fails — which is what
       the grey broken-document box was. This is the same url Power BI's own
       "Embed → Website or portal" dialog produces. */
    out.searchParams.set('autoAuth', 'true');
    return out.toString();
  }catch{ return raw; }
}

/* Opens a real browser window rather than a frame.

   This is the path that actually works when framing is refused: a top-level
   window is not subject to frame-ancestors, X-Frame-Options, or third-party
   cookie partitioning, so Power BI authenticates exactly as it does when you
   open it yourself. Sized like a report viewer rather than a tab so it reads
   as part of the app. */
/* Confirmed 11 Sep, from a real securitypolicyviolation in the hosted player:
   the Power Apps CSP refuses frame-src app.powerbi.com. Once seen, it is true
   for every report in the session, so it is remembered here rather than
   re-discovered per KPI — otherwise each card flashes a broken frame before
   the violation fires. */
let CSP_BLOCKS_POWERBI = false;

const openViewer = url => {
  const w = Math.min(1400, Math.floor(window.screen.availWidth * 0.9));
  const h = Math.min(900,  Math.floor(window.screen.availHeight * 0.9));
  const x = Math.max(0, Math.floor((window.screen.availWidth  - w) / 2));
  const y = Math.max(0, Math.floor((window.screen.availHeight - h) / 2));
  const win = window.open(url, 'pbi-viewer',
    `noopener,noreferrer,width=${w},height=${h},left=${x},top=${y},resizable=yes,scrollbars=yes`);
  /* A blocked popup returns null — fall back to a normal tab so the click
     always does something. */
  if(!win) window.open(url, '_blank', 'noopener,noreferrer');
};

/* The figures, drawn here, from the app's own data.

   This is the one route no policy can refuse: it embeds nothing. The KPI
   catalogue already holds target and actual per Business Unit and period, and
   a breakdown set beneath that — the same numbers the BI report is built from.
   Framing the report is still the richer view; this makes the tab useful when
   the frame is refused, and instant when it is not. */
function KpiPanel({k,scope}){
  /* Every period this KPI has a figure for, in order — 'BU:period' keys. */
  const series = Object.entries(k.ach||{})
    .map(([key,v])=>{ const [bu,period]=key.split(':'); return {bu,period,...v}; })
    .filter(x=>scope.bu==='ALL' || x.bu===scope.bu)
    .sort((a,b)=>a.period.localeCompare(b.period));

  const bds = (k.breakdowns||[]).map(b=>{
    const rec = achFor(b, scope.bu, scope.period);
    return {...b, rec, pct:rec?achPct(rec,k.dir):null};
  }).filter(b=>b.rec);

  if(!series.length && !bds.length) return null;

  return <div className="card" style={{marginTop:10}}>
    <h2 style={{fontSize:13.5}}>The figures behind it</h2>
    <div className="csub">From this app's own KPI catalogue — no embed, so nothing can block it.</div>

    {series.length
      ? <>
          <div className="tset-lbl">Target vs actual by period</div>
          <div className="spark" style={{marginBottom:10}}>
            {series.map((x,i)=>{
              const p = achPct(x,k.dir);
              return <div className="spark-b" key={i} title={`${x.bu} · ${fmtP(x.period)} — target ${x.target}${k.unit}, actual ${x.actual}${k.unit}`}>
                <span className="vl" style={{color:`var(--${achCls(p)==='hit'?'green':achCls(p)==='near'?'amber':'red'})`}}>
                  {x.actual}{k.unit}</span>
                <div className={'bx '+(achCls(p)==='hit'?'green':achCls(p)==='near'?'amber':'red')}
                     style={{height:Math.max(6,Math.min(100,p||0)*0.62)+'px'}}/>
                <span className="lb">{fmtP(x.period)}</span></div>;
            })}
          </div>
        </>
      : null}

    {bds.length
      ? <>
          <div className="tset-lbl">Breakdown · {bdDims(k).join(', ')}</div>
          <div style={{marginTop:6}}>
            {bds.map(b=>
              <div key={b.id} style={{display:'flex',alignItems:'center',gap:9,margin:'5px 0'}}>
                <span style={{flex:'0 0 34%',minWidth:0,fontSize:12}}>{b.n}
                  <span className="holder"> · {b.dim}</span></span>
                <span style={{flex:'0 0 62px',fontSize:11.5,fontFamily:'var(--mono)'}}>
                  {b.rec.actual}{k.unit}</span>
                <Bar v={Math.min(100,b.pct||0)}
                     c={achCls(b.pct)==='hit'?'green':achCls(b.pct)==='near'?'amber':'red'}/>
              </div>)}
          </div>
        </>
      : null}
  </div>;
}

function BiFrame({bi}){
  const [loaded,setLoaded] = useState(false);
  /* Remounting the iframe is the only way to retry: changing nothing but the
     key forces a fresh navigation, which is what you want after signing in to
     Power BI in another tab. */
  const [attempt,setAttempt] = useState(0);

  /* THE DIAGNOSIS.

     Guessing between "the host blocks frames" and "Power BI would not
     authenticate" is what made the last two attempts inconclusive — both look
     identical from outside: a grey box with a broken-document glyph.

     They are distinguishable. When a CSP refuses a frame WE created, the
     browser fires securitypolicyviolation on OUR document, naming the
     directive and the blocked URI. If that fires, the host is the blocker and
     no in-page embed of any kind can work. If it never fires, the frame was
     allowed and Power BI itself declined — an auth or permission problem. */
  const [violation,setViolation] = useState(CSP_BLOCKS_POWERBI || null);
  useEffect(()=>{
    const onViolation = e => {
      if(String(e.blockedURI||'').includes('powerbi.com')){
        const d = e.violatedDirective || e.effectiveDirective || 'frame-src';
        CSP_BLOCKS_POWERBI = d;
        setViolation(d);
      }
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    return ()=>document.removeEventListener('securitypolicyviolation', onViolation);
  },[]);

  const embed = toEmbedUrl(bi.link);
  const converted = embed !== bi.link;
  return <div style={{marginTop:10}}>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
      <b style={{fontSize:12.5}}>{bi.n}</b>
      <a href={bi.link} target="_blank" rel="noopener noreferrer"
         style={{fontSize:11.5,color:'var(--teal-d)'}}>Open in Power BI ↗</a>
      <div style={{flex:1}}/>
      <Btn k="sm pri" onClick={()=>openViewer(embed)}>Open report viewer</Btn>
      {violation
        ? null
        : <Btn k="sm" onClick={()=>{ setLoaded(false); setAttempt(a=>a+1); }}>
            Retry in page</Btn>}
    </div>
    {/* Once the CSP has refused this origin the frame can never render, so it
        is not drawn at all — an empty grey box that will always stay empty is
        worse than saying why. */}
    {violation
      ? null
      : <div className="bi-frame">
          {/* The embed endpoint, not the portal url — see toEmbedUrl above. */}
          <iframe key={attempt} title={bi.n} src={embed} loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-write"
            allowFullScreen onLoad={()=>setLoaded(true)}/>
        </div>}
    {violation
      ? <Note k="err" ic="✕">
          <b>The host blocks this frame — <code>{violation}</code>.</b> The Power Apps player's
          content-security policy refuses <code>app.powerbi.com</code>, so no in-page embed can
          work here: not this iframe, not the Power BI JavaScript SDK, which uses one too.
          <b> Open report viewer</b> is the way in — a top-level window is not subject to the
          policy. Signing in inside the frame is not an option either: the browser refuses the
          navigation before anything from Power BI loads, including its sign-in page, so there
          is no document there to sign into. Lifting this would mean getting
          <code> frame-src app.powerbi.com</code> added to the player's CSP, which is
          Microsoft's to set, not ours. The figures above are drawn from this app's own data
          and are unaffected.
        </Note>
      : <div className="holder" style={{marginTop:6}}>
          <b>Blank or a broken-document icon above?</b> No CSP violation was reported, so the
          frame itself was allowed and Power BI declined it — the viewer is not signed in, the
          report is not shared with them, or the browser is partitioning third-party cookies
          (the default in Safari and in Chrome incognito), which stops silent auth inside a
          frame. Use <b>Open report viewer</b>: it authenticates normally, and once a session
          exists <b>Retry in page</b> may then work.
        </div>}
    {converted
      ? <div className="holder" style={{marginTop:4}}>
          Framed from the embed endpoint, converted from the portal link the catalogue holds —
          Power BI refuses to frame <code>app.powerbi.com/groups/…</code> itself.</div>
      : null}
    <div style={{marginTop:4,wordBreak:'break-all',fontSize:11,color:'var(--faint)'}}>{bi.link}</div>
  </div>;
}

/* ---- 1. Business intelligence ------------------------------------------ */
export function ScreenBI(){
  const {bu} = use();
  const [fProc,setFProc]   = useState('');
  const [fOwner,setFOwner] = useState('');
  const [fBi,setFBi]       = useState('');
  const [q,setQ]           = useState('');
  const [open,setOpen]     = useState(null);

  const ownerOf = k => (PR(k.proc)||{}).own || null;
  const owners  = [...new Set(PROC_REG.map(p=>p.own))].sort();

  const matches = KPI_CAT.filter(k=>
       (!fProc  || k.proc===fProc)
    && (!fOwner || ownerOf(k)===fOwner)
    && (!fBi    || k.bi===fBi)
    && matchesQuery(q,[k.n, k.id, (PR(k.proc)||{}).n, ownerOf(k), (BIR(k.bi)||{}).n]));

  const anyFilter = fProc||fOwner||fBi||q.trim();

  return <>
    <div className="ph"><h1>Business intelligence</h1>
      <div className="sub">Sections of a BI report are measurements. You cite one; there is nothing
        in it to argue with. Find the report behind a KPI, then open it or cite it.</div></div>

    <div className="card">
      <h2>Find the report behind a measure</h2>
      <div className="csub">Filters combine. A KPI carries no Department of its own, so the
        department shown is the one that owns its Process.</div>
      <div className="f-row3">
        <Field label="Process">
          <select value={fProc} onChange={e=>{setFProc(e.target.value);}}>
            <option value="">Any Process</option>
            {PROC_REG.map(p=><option key={p.id} value={p.id}>{p.n}</option>)}
          </select></Field>
        <Field label="Owning department">
          <select value={fOwner} onChange={e=>setFOwner(e.target.value)}>
            <option value="">Any department</option>
            {owners.map(o=><option key={o} value={o}>{o}</option>)}
          </select></Field>
        <Field label="BI report">
          <select value={fBi} onChange={e=>setFBi(e.target.value)}>
            <option value="">Any BI report</option>
            {BI_REPORTS.map(b=><option key={b.id} value={b.id}>{b.n}</option>)}
          </select></Field>
      </div>
      <div className="btn-row" style={{marginTop:4}}>
        <input type="search" value={q} placeholder="Search KPIs…"
          onChange={e=>setQ(e.target.value)}
          style={{flex:'1 1 220px',minWidth:0,border:'1px solid var(--border-d)',
                  borderRadius:8,padding:'6px 10px',fontSize:12.5}}/>
        {anyFilter
          ? <Btn k="sm" onClick={()=>{setFProc('');setFOwner('');setFBi('');setQ('');}}>Clear</Btn>
          : null}
      </div>
    </div>

    <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon gold">📊</div>
        <h2 style={{flex:1}}>{matches.length} of {KPI_CAT.length} measures</h2>
      </div>
      {matches.length===0
        ? <div style={{padding:'8px 17px 17px'}}><Empty>No KPI matches this combination.</Empty></div>
        : <div style={{padding:'4px 17px 17px'}}>
            {matches.map(k=>{
              const bi = BIR(k.bi), proc = PR(k.proc);
              const a  = achFor(k, bu, PERIOD);
              const pct2 = a ? achPct(k,a) : null;
              const isOpen = open===k.id;
              return <div key={k.id} className="card" style={{marginBottom:10}}>
                <div className="ph-row" style={{gap:10,alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="t-main">{k.n}</div>
                    <div className="t-sub">
                      {[proc?proc.n:null, ownerOf(k), k.id].filter(Boolean).join(' · ')}</div>
                  </div>
                  {pct2!=null
                    ? <Tag c={achCls(pct2)}>{pct2}% of target</Tag>
                    : <Tag c="grey">No figure for this period</Tag>}
                  {bi ? <Tag c="teal">{bi.n}</Tag> : <Tag c="red">No BI report linked</Tag>}
                </div>
                {a ? <div className="t-sub" style={{marginTop:4}}>
                  Target {a.target}{k.unit} · Actual {a.actual}{k.unit}
                  {k.dir==='down' ? ' · lower is better' : ''}</div> : null}
                <div className="btn-row" style={{marginTop:8}}>
                  {bi
                    ? <Btn k="sm" onClick={()=>setOpen(isOpen?null:k.id)}>
                        {isOpen?'Hide the report':'Open the BI report'}</Btn>
                    : <span className="holder">Link a BI report to this KPI in the catalogue first.</span>}
                  {(k.breakdowns||[]).length
                    ? <Tag c="grey">{k.breakdowns.length} breakdown{k.breakdowns.length>1?'s':''} ·
                        {' '}{bdDims(k).join(', ')}</Tag>
                    : null}
                </div>
                {isOpen ? <>
                    <KpiPanel k={k} scope={{bu, period:PERIOD}}/>
                    {bi ? <BiFrame bi={bi}/> : null}
                  </> : null}
              </div>;
            })}
          </div>}
    </div>
  </>;
}
