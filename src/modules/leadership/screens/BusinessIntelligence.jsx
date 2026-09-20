/* =========================================================================
   ARTIFACT · ScreenBI

   One of the three read-side screens ported from Leadership Practice
   Extension.html's "Read" group. Everything it needs comes from
   ../domain.jsx, ../store.jsx and ../../../shared — never from
   LeadershipApp.jsx, so this file can move to another module (or another
   app) without dragging the execution module behind it.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty, Bar, Combo } from '../../../shared/ui.jsx';
import { PERIOD, fmtP } from '../../../shared/format.js';
import { achFor, achPct, achCls, bdDims,
         matchesQuery } from '../domain.jsx';
import { fetchKpis, fetchProcesses, fetchBiReportDashboards } from '../../../services/dataverse.js';

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

/* Exported: Build a report/plan and Reports / Plans show the same frame under
   a cited KPI. `bi` is one row of lm_bireportdashboard -- {n, link}. */
export function BiFrame({bi}){
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
  return <div style={{marginTop:10}}>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
      <b style={{fontSize:12.5}}>{bi.n}</b>
      <a href={bi.link} target="_blank" rel="noopener noreferrer"
         style={{fontSize:11.5,color:'var(--teal-d)'}}>Open in Power BI ↗</a>
      <div style={{flex:1}}/>
      <Btn k="sm pri" onClick={()=>openViewer(embed)}>Open full report ↗</Btn>
      {violation
        ? null
        : <Btn k="sm" onClick={()=>setAttempt(a=>a+1)}>
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
            allowFullScreen/>
        </div>}
    {violation
      ? <Note k="err" ic="✕">
          <b>The host blocks this frame — <code>{violation}</code>.</b> The Power Apps player's
          content-security policy refuses <code>app.powerbi.com</code>, so no in-page embed can
          work here: not this iframe, not the Power BI JavaScript SDK, which uses one too.
          <b> Open full report ↗</b> is the way in — a top-level window is not subject to the
          policy. Signing in inside the frame is not an option either: the browser refuses the
          navigation before anything from Power BI loads, including its sign-in page, so there
          is no document there to sign into. Lifting this would mean getting
          <code> frame-src app.powerbi.com</code> added to the player's CSP, which is
          Microsoft's to set, not ours. The figures above are drawn from this app's own data
          and are unaffected.
        </Note>
      : null}
  </div>;
}

/* One period ('YYYY-MM') shifted by n months -- the same shape Calendar's
   own month stepper uses for `ym`, just over a period string instead of a
   month-anchored date. */
const shiftPeriod = (p,n) => {
  const [y,m] = p.split('-').map(Number);
  const d = new Date(y, m-1+n, 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
};

/* ---- 1. Business intelligence ------------------------------------------ */
/* LIVE, restructured 21 Sep. Used to list every KPI (strategy_kpises) and
   show whichever BI report sat behind each -- so a report with no KPI
   linked to it was invisible, and the list's length was "how many KPIs
   exist," not "how many reports exist." It now reads lm_bireportdashboards
   directly as the primary list: every report is findable, linked to a
   measure or not, and a month stepper controls which period's figures show
   underneath the ones that do have one -- the same "how did this look as of
   a previous month" question a KPI's own achievement history can actually
   answer, since lm_bireportdashboards itself carries no date of its own. */
export function ScreenBI(){
  /* The dashboards, and which KPI each sits behind. Read here rather than at
     app start: only this screen and the two report screens need them. */
  const [biRows,setBiRows] = useState(null);
  useEffect(()=>{
    let live = true;
    fetchBiReportDashboards()
      .then(r=>{ if(live) setBiRows(r); })
      .catch(e=>{ console.warn('[dataverse] fetchBiReportDashboards() failed:', e);
                  if(live) setBiRows([]); });
    return ()=>{ live = false; };
  },[]);
  const biList = biRows || [];
  const {bu, dvLookup} = use();
  const deptList = dvLookup?.deptList || [];
  const [fProc,setFProc]   = useState('');
  const [fOwner,setFOwner] = useState('');
  const [q,setQ]           = useState('');
  const [open,setOpen]     = useState(null);
  /* The month a report's figures are shown as of -- defaults to the current
     one, stepped like Calendar's own month nav. lm_bireportdashboards has no
     date column of its own to filter BY; this is the one real,
     period-shaped thing available, off the KPI a report happens to cite. */
  const [period,setPeriod] = useState(PERIOD);

  /* KPIs and Processes, read live from strategy_kpises / strategy_processes --
     each carries its own Department AND its own Process directly (see
     dataverse.js), so no seeded catalogue or derived "owner of its Process"
     step is needed any more. Still read here even though a KPI is no longer
     what's being LISTED: a report's own figures panel, and the Process/
     Department filters, both hang off whichever KPI (if any) it cites. */
  const [procs,setProcs] = useState(null);   // null while reading
  const [kpis,setKpis]   = useState(null);
  useEffect(()=>{
    let live = true;
    Promise.all([fetchProcesses(), fetchKpis()])
      .then(([p,k])=>{ if(live){ setProcs(p); setKpis(k); } })
      .catch(e=>{ console.warn('[dataverse] Reading KPIs/Processes for Business intelligence failed:', e);
        if(live){ setProcs([]); setKpis([]); } });
    return ()=>{ live = false; };
  },[]);
  const loading = procs===null || kpis===null || biRows===null;

  const kpiById = useMemo(()=>new Map((kpis||[]).map(k=>[k.id,k])), [kpis]);
  /* Every BI report, each carrying its linked KPI object (or null) rather
     than just an id -- everything below reads off this once instead of
     re-resolving the lookup per filter/render. */
  const reports = useMemo(()=>
    biList.map(r=>({...r, kpi: r.kpiId ? (kpiById.get(r.kpiId)||null) : null})),
    [biList, kpiById]);

  const matches = loading ? [] : reports.filter(r=>
       (!fProc  || r.kpi?.processId===fProc)
    && (!fOwner || r.kpi?.dept===fOwner)
    && matchesQuery(q,[r.name, r.kpi?.name, r.kpi?.processName, r.kpi?.deptName]));

  const anyFilter = fProc||fOwner||q.trim();

  return <>
    <div className="ph"><h1>Business intelligence</h1>
      <div className="sub">Every BI report and dashboard this app knows about. Sections of one are
        measurements — you cite one; there is nothing in it to argue with.</div></div>

    <div className="card">
      <h2>Find a report</h2>
      <div className="csub">Filters combine. Process and Department come from the report's linked
        KPI where one exists — a report with no KPI linked is still listed, just not filterable by
        either.</div>
      <div className="f-row3">
        <Combo label="Process" value={fProc} onChange={setFProc}
          opts={loading ? [] : procs} all="Any Process" placeholder="Search processes…"/>
        <Combo label="Owning department" value={fOwner} onChange={setFOwner}
          opts={deptList} all="Any department" placeholder="Search departments…"/>
        <div>
          <label style={{display:'block',fontSize:11.5,fontWeight:600,color:'var(--ink-2)',marginBottom:4}}>
            Figures as of</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <Btn k="sm" onClick={()=>setPeriod(p=>shiftPeriod(p,-1))}>←</Btn>
            <b style={{flex:1,fontSize:12.5,textAlign:'center'}}>{fmtP(period)}</b>
            <Btn k="sm" onClick={()=>setPeriod(p=>shiftPeriod(p,1))}>→</Btn>
            {period!==PERIOD && <Btn k="sm" onClick={()=>setPeriod(PERIOD)}>Now</Btn>}
          </div>
        </div>
      </div>
      <div className="btn-row" style={{marginTop:4}}>
        <input type="search" value={q} placeholder="Search reports…"
          onChange={e=>setQ(e.target.value)}
          style={{flex:'1 1 220px',minWidth:0,border:'1px solid var(--border-d)',
                  borderRadius:8,padding:'6px 10px',fontSize:12.5}}/>
        {anyFilter
          ? <Btn k="sm" onClick={()=>{setFProc('');setFOwner('');setQ('');}}>Clear</Btn>
          : null}
      </div>
      {/* lm_bireportdashboard.lm_kpi is what links the two, added 20 Sep. A
          report with no KPI recorded against it still opens and frames --
          the figures panel is simply the one part that has nothing to show. */}
    </div>

    <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon gold">📊</div>
        <h2 style={{flex:1}}>{loading ? 'Reading BI reports…' : `${matches.length} of ${reports.length} reports`}</h2>
      </div>
      {loading
        ? <div style={{padding:'8px 17px 17px'}}><Empty ic="…">Reading lm_bireportdashboards from Dataverse.</Empty></div>
        : matches.length===0
        ? <div style={{padding:'8px 17px 17px'}}>
            <Empty>{reports.length ? 'No report matches this combination.' : 'No BI report is registered yet.'}</Empty>
          </div>
        : <div style={{padding:'4px 17px 17px'}}>
            {matches.map(r=>{
              const k = r.kpi;
              const a = k ? achFor(k, bu, period) : null;
              const pct2 = a ? achPct(k,a) : null;
              const isOpen = open===r.id;
              return <div key={r.id} className="card" style={{marginBottom:10}}>
                <div className="ph-row" style={{gap:10,alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="t-main">{r.name}</div>
                    <div className="t-sub">
                      {k ? [k.processName, k.deptName].filter(Boolean).join(' · ') : 'No KPI linked'}</div>
                  </div>
                  {k
                    ? (pct2!=null ? <Tag c={achCls(pct2)}>{pct2}% of target</Tag>
                                  : <Tag c="grey">No figure for {fmtP(period)}</Tag>)
                    : null}
                  {k && <Tag c="teal">{k.name}</Tag>}
                </div>
                {a ? <div className="t-sub" style={{marginTop:4}}>
                  Target {a.target}{k.unit} · Actual {a.actual}{k.unit}
                  {k.dir==='down' ? ' · lower is better' : ''}</div> : null}
                <div className="btn-row" style={{marginTop:8}}>
                  <Btn k="sm" onClick={()=>setOpen(isOpen?null:r.id)}>
                    {isOpen?'Hide the report':'Open the BI report'}</Btn>
                  {(k?.breakdowns||[]).length
                    ? <Tag c="grey">{k.breakdowns.length} breakdown{k.breakdowns.length>1?'s':''} ·
                        {' '}{bdDims(k).join(', ')}</Tag>
                    : null}
                </div>
                {isOpen ? <>
                    {k ? <KpiPanel k={k} scope={{bu, period}}/> : null}
                    <BiFrame bi={{n:r.name, link:r.link}}/>
                  </> : null}
              </div>;
            })}
          </div>}
    </div>
  </>;
}
