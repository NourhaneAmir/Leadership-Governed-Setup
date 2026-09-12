/* =========================================================================
   Report-composition domain.

   Moved out of LeadershipApp.jsx so the Artifact screens can live in their
   own files without importing a 10k-line sibling. Nothing here is copied —
   LeadershipApp imports these back, so every existing call site is unchanged.

   What belongs here: the catalogues a report cites (KPIs, Processes, BI
   reports), the arithmetic that reads them, the citation vocabulary, and the
   handful of report helpers built on top. People sits here too, because `P`
   is what resolves an author on a paragraph and a reviewer on a Setup.

   What does NOT: anything that reads app state. `CiteCard` is the one
   component, and it takes everything it needs through props plus `use()`.
   ========================================================================= */
import React from 'react';
import { use } from './store.jsx';
import { Btn, Tag } from '../../shared/ui.jsx';
import { fmtD, pct } from '../../shared/format.js';

export const PEOPLE = [
  /* The demo signs in as one person holding every role, so the whole cycle can be walked in one sitting.
     Records still carry their real accountable owner — the Chair, Reviewer and Facilitator are named on
     every action — but this user is permitted to act for any of them. */
  {id:'u0', name:'Demo User',       position:'Full access — every role',        dept:'Business Transformation', bu:'AHJ', mgr:'u7', lvl:6, scope:'all', fam:'admin'},
  {id:'u1', name:'Hussain Ahmed',   position:'Quality Section Head',            dept:'Quality',   bu:'AHJ', mgr:'u5', lvl:1, scope:'bu',  fam:'employee'},
  {id:'u2', name:'Dr. Ahmed Farouk', position:'Medical Director',               dept:'Medical Affairs', bu:'AHJ', mgr:'u7', lvl:3, scope:'bu',  fam:'approver'},
  {id:'u3', name:'Reem Al-Otaibi',  position:'Governance Facilitator',          dept:'Quality',   bu:'AHJ', mgr:'u2', lvl:1, scope:'bu',  fam:'organizer'},
  {id:'u4', name:'Omar Nasser',     position:'Quality Coordinator',             dept:'Quality',   bu:'AHJ', mgr:'u1', lvl:0, scope:'own', fam:'organizer'},
  {id:'u5', name:'Sara Khalil',     position:'Head of Quality',                 dept:'Quality',   bu:'AHJ', mgr:'u7', lvl:2, scope:'bu',  fam:'approver'},
  {id:'u6', name:'Khalid Sultan',   position:'Biomedical Engineering Section Head', dept:'Facilities', bu:'AHJ', mgr:'u7', lvl:1, scope:'own', fam:'employee'},
  {id:'u7', name:'Dr. Mai Adel',    position:'Business Unit Director',          dept:'Executive', bu:'AHJ', mgr:null, lvl:4, scope:'all', fam:'approver'},
  {id:'u8', name:'Nadia Hassan',    position:'Governance and Audit Reviewer',   dept:'Internal Audit', bu:'AHJ', mgr:null, lvl:0, scope:'all', fam:'observer'},
  {id:'u9', name:'Tarek Mansour',   position:'Internal Audit Manager',          dept:'Internal Audit', bu:'AHJ', mgr:null, lvl:0, scope:'all', fam:'observer'},
  {id:'u10',name:'Layla Ibrahim',   position:'Nursing Director',                dept:'Nursing',   bu:'AHJ', mgr:'u7', lvl:2, scope:'bu',  fam:'employee'},
  {id:'u11',name:'Yasser Kamal',    position:'Finance Business Partner',        dept:'Finance',   bu:'AHJ', mgr:'u7', lvl:2, scope:'bu',  fam:'approver'},
  {id:'u12',name:'Dina Shawky',     position:'Group Chief Financial Officer',   dept:'Group Finance', bu:'AHJ', mgr:null, lvl:5, scope:'all', fam:'approver'},
  {id:'u13',name:'Ehab Zaki',       position:'Group Chief Executive Officer',   dept:'Group Executive', bu:'AHJ', mgr:null, lvl:6, scope:'all', fam:'approver'},
  {id:'u14',name:'Mona Adel',       position:'Pharmacy Director',               dept:'Pharmacy',  bu:'AHJ', mgr:'u7', lvl:2, scope:'bu',  fam:'organizer'},
  {id:'u15',name:'Rami Habib',      position:'IT Applications Manager',         dept:'Information Technology', bu:'AHJ', mgr:'u7', lvl:1, scope:'own', fam:'employee'},
];

export const P = id => PEOPLE.find(p=>p.id===id) || {id,name:'—',position:'—',lvl:0,scope:'own',fam:'employee'};

export const RPT_SETUPS = [
  {id:'rs1', name:'Monthly Quality Report', cat:'Core',
   objective:'Report quality indicator performance and improvement actions for the reporting period.',
   template:'QLT-TMPL-004.docx', tpl:'TPL-QLT', site:'Quality', folder:'2026 / Monthly Reports',
   creator:'u1', reviewers:['u5','u2'], freq:'Monthly', dueDay:10,
   kpis:['KPI-QLT-011','KPI-QLT-014'], processes:['PRC-QLT-02']},
  {id:'rs2', name:'Nursing Manpower Plan', cat:'Core',
   objective:'Present nursing establishment, vacancy and coverage against the approved manpower plan.',
   template:null, tpl:'TPL-NUR', site:'Nursing', folder:'2026 / Plans',
   creator:'u10', reviewers:['u5','u7'], freq:'Monthly', dueDay:12,
   kpis:['KPI-NUR-003'], processes:['PRC-NUR-01']},
  {id:'rs4', name:'Medical Equipment Maintenance Report', cat:'Core',
   objective:'Report preventive maintenance completion and open equipment faults for the period.',
   template:'BME-TMPL-002.xlsx', tpl:'TPL-BME', site:'Facilities', folder:'2026 / Monthly Reports',
   creator:'u6', reviewers:['u11','u7'], freq:'Monthly', dueDay:14,
   kpis:['KPI-BME-002'], processes:['PRC-BME-01']},
  {id:'rs3', name:'Executive Performance Pack', cat:'Executive',
   objective:'Consolidate business unit performance for the executive review cycle.',
   template:'EXE-TMPL-001.pptx', tpl:'TPL-EXE', site:'Executive', folder:'2026 / Monthly Reports',
   creator:'u1', reviewers:['u7'], freq:'Monthly', dueDay:8,
   kpis:['KPI-FIN-001','KPI-OPS-004'], processes:[]},
];

export const RS = id => RPT_SETUPS.find(r=>r.id===id);

export const DIAG = {
  d1:{n:'Descriptive',  q:'What happened',     need:'a certified figure'},
  d2:{n:'Diagnostic',   q:'Why it happened',   need:'a cause with evidence'},
  d3:{n:'Predictive',   q:'What happens next', need:'an assumption and a horizon'},
  d4:{n:'Prescriptive', q:'What to do',        need:'an owner and a date'},
};

export const DiagChip = ({d}) => d
  ? <span className={'dg '+d} title={DIAG[d].q+' — needs '+DIAG[d].need}>{DIAG[d].n}</span>
  : <span className="dg none">Untyped</span>;

export const PROC_REG = [
  {id:'PRC-QLT-02', n:'Corrective action management',  own:'Quality'},
  {id:'PRC-QLT-01', n:'Quality indicator management',  own:'Quality'},
  {id:'PRC-NUR-01', n:'Nursing establishment planning', own:'Nursing'},
  {id:'PRC-BME-01', n:'Preventive maintenance',        own:'Facilities'},
  {id:'PRC-OPS-01', n:'Patient flow management',       own:'Operations'},
  {id:'PRC-IPC-01', n:'Infection surveillance',        own:'Infection Prevention'},
  {id:'PRC-FIN-01', n:'Budget preparation',            own:'Finance'},
];

export const PR = id => PROC_REG.find(p=>p.id===id);

export const BI_REPORTS = [
  /* A REAL report, supplied 10 Sep. Stored as the portal link exactly as it
     is copied out of the browser; toEmbedUrl() in screens/BusinessIntelligence.jsx
     converts it to the embed endpoint before framing. The other three below are
     still demo placeholders and will not resolve. */
  {id:'BI-01', n:'Quality — Indicator Surveillance',
   link:'https://app.powerbi.com/groups/me/reports/a8e2d084-f9d0-4acb-b43a-bac3d2c418be/ReportSection?ctid=c515f6b1-812f-4d6c-9542-d914e95b3df1&experience=power-bi'},
  {id:'BI-02', n:'Finance — Contribution and Margin',
   link:'https://app.powerbi.com/reportEmbed?reportId=demo-fin-margin'},
  {id:'BI-03', n:'Operations — Theatre and Asset Utilisation',
   link:'https://app.powerbi.com/reportEmbed?reportId=demo-ops-utilisation'},
  {id:'BI-04', n:'Workforce — Establishment and Vacancy',
   link:'https://app.powerbi.com/reportEmbed?reportId=demo-hr-establishment'},
];

export const BIR = id => BI_REPORTS.find(b=>b.id===id);

export const KPI_CAT = [
  {id:'KPI-QLT-011', n:'Sepsis bundle compliance', unit:'%', dir:'up',
   proc:'PRC-QLT-02', bi:'BI-01',
   ach:{'AHJ:2026-06':{target:90,actual:81},'AHJ:2026-07':{target:90,actual:78},
        'AHJ:2026-08':{target:90,actual:84},'AHM:2026-07':{target:88,actual:85}},
   breakdowns:[
     {id:'BD-Q11-ed',  dim:'Unit', n:'Emergency Department', ach:{'AHJ:2026-07':{target:90,actual:64}}},
     {id:'BD-Q11-icu', dim:'Unit', n:'Intensive Care',       ach:{'AHJ:2026-07':{target:90,actual:91}}},
     {id:'BD-Q11-war', dim:'Unit', n:'Inpatient Wards',      ach:{'AHJ:2026-07':{target:90,actual:83}}},
     {id:'BD-Q11-ns',  dim:'Shift',n:'Night shift',          ach:{'AHJ:2026-07':{target:90,actual:69}}}]},

  {id:'KPI-QLT-014', n:'Corrective action closure within due date', unit:'%', dir:'up',
   proc:'PRC-QLT-02', bi:'BI-01',
   ach:{'AHJ:2026-06':{target:85,actual:72},'AHJ:2026-07':{target:85,actual:69},
        'AHJ:2026-08':{target:85,actual:74}},
   breakdowns:[
     {id:'BD-Q14-cli', dim:'Source', n:'Clinical audit',     ach:{'AHJ:2026-07':{target:85,actual:77}}},
     {id:'BD-Q14-inc', dim:'Source', n:'Incident review',    ach:{'AHJ:2026-07':{target:85,actual:58}}}]},

  {id:'KPI-NUR-003', n:'Nursing vacancy rate', unit:'%', dir:'down',
   proc:'PRC-NUR-01', bi:'BI-04',
   ach:{'AHJ:2026-07':{target:8,actual:13.4},'AHJ:2026-06':{target:8,actual:12.1},
        'AHJ:2026-08':{target:8,actual:13.9}},
   breakdowns:[
     {id:'BD-N03-icu', dim:'Unit', n:'Intensive Care',       ach:{'AHJ:2026-07':{target:8,actual:19.2}}},
     {id:'BD-N03-opd', dim:'Unit', n:'Outpatient Clinics',   ach:{'AHJ:2026-07':{target:8,actual:6.4}}},
     {id:'BD-N03-thr', dim:'Unit', n:'Theatres',             ach:{'AHJ:2026-07':{target:8,actual:15.8}}}]},

  {id:'KPI-BME-002', n:'Preventive maintenance completion', unit:'%', dir:'up',
   proc:'PRC-BME-01', bi:'BI-03',
   ach:{'AHJ:2026-06':{target:95,actual:88},'AHJ:2026-07':{target:95,actual:91},
        'AHJ:2026-08':{target:95,actual:93}},
   breakdowns:[
     {id:'BD-B02-life', dim:'Asset class', n:'Life support',   ach:{'AHJ:2026-07':{target:95,actual:99}}},
     {id:'BD-B02-img',  dim:'Asset class', n:'Imaging',        ach:{'AHJ:2026-07':{target:95,actual:76}}},
     {id:'BD-B02-lab',  dim:'Asset class', n:'Laboratory',     ach:{'AHJ:2026-07':{target:95,actual:94}}}]},

  {id:'KPI-OPS-004', n:'Theatre utilisation', unit:'%', dir:'up',
   proc:'PRC-OPS-01', bi:'BI-03',
   ach:{'AHJ:2026-06':{target:85,actual:79},'AHJ:2026-07':{target:85,actual:82},
        'AHJ:2026-08':{target:85,actual:80}},
   breakdowns:[
     {id:'BD-O04-am',  dim:'Session', n:'Morning lists',  ach:{'AHJ:2026-07':{target:85,actual:93}}},
     {id:'BD-O04-pm',  dim:'Session', n:'Evening lists',  ach:{'AHJ:2026-07':{target:85,actual:61}}},
     {id:'BD-O04-ort', dim:'Specialty', n:'Orthopaedics', ach:{'AHJ:2026-07':{target:85,actual:88}}},
     {id:'BD-O04-ent', dim:'Specialty', n:'ENT',          ach:{'AHJ:2026-07':{target:85,actual:74}}}]},

  {id:'KPI-FIN-001', n:'Operating margin', unit:'%', dir:'up',
   proc:'PRC-FIN-01', bi:'BI-02',
   ach:{'AHJ:2026-06':{target:14,actual:11.8},'AHJ:2026-07':{target:14,actual:12.6},
        'AHJ:2026-08':{target:14,actual:12.2},'AHM:2026-07':{target:11,actual:9.4}},
   breakdowns:[
     {id:'BD-F01-ip', dim:'Stream', n:'Inpatient',  ach:{'AHJ:2026-07':{target:14,actual:15.1}}},
     {id:'BD-F01-op', dim:'Stream', n:'Outpatient', ach:{'AHJ:2026-07':{target:14,actual:9.2}}}]},

  {id:'KPI-IPC-004', n:'Healthcare associated infection rate', unit:' per 1,000 pt-days', dir:'down',
   proc:'PRC-IPC-01', bi:'BI-01',
   ach:{'AHJ:2026-07':{target:2.1,actual:2.8},'AHJ:2026-06':{target:2.1,actual:2.4}},
   breakdowns:[]},
];

export const KPIC = id => KPI_CAT.find(k=>k.id===id);

export const findKpi = id => {
  const k = KPIC(id); if(k) return {k, bd:null};
  for(const kk of KPI_CAT){ const bd=(kk.breakdowns||[]).find(b=>b.id===id); if(bd) return {k:kk, bd}; }
  return null;
};

export const bdDims = k => [...new Set((k.breakdowns||[]).map(b=>b.dim))];

export function achFor(obj,bu,period){
  const a = obj.ach||{};
  if(a[bu+':'+period]) return a[bu+':'+period];
  if(bu==='ALL'){
    const hits = Object.keys(a).filter(k=>k.endsWith(':'+period)).map(k=>a[k]);
    if(!hits.length) return null;
    const avg = arr => Math.round(arr.reduce((s,x)=>s+x,0)/arr.length*10)/10;
    return {target:avg(hits.map(h=>h.target)), actual:avg(hits.map(h=>h.actual)), blended:hits.length};
  }
  return null;
}

export const achPct = (rec,dir) => !rec||!rec.target ? null
  : Math.round((dir==='down' ? rec.target/rec.actual : rec.actual/rec.target)*1000)/10;

export const achCls = p => p==null?'':p>=98?'hit':p>=85?'near':'miss';

export const CITE_KINDS = [
  {k:'KPI',  label:'KPI',                 cls:'k-kpi'},
  {k:'BD',   label:'KPI breakdown',       cls:'k-kpi', ref:'KPI'},
  {k:'STR',  label:'Tactic / POC / Project', cls:'k-str'},
  {k:'PM',   label:'Planning & Monitoring', cls:'k-pm'},
  {k:'TASK', label:'Task',                cls:'k-task'},
  {k:'ISS',  label:'Issue (other system)', cls:'k-iss'},
  {k:'PAR',  label:'Paragraph',           cls:'k-par'},
  {k:'RPT',  label:'Child Report',        cls:'k-rpt'},
];

export const citeKind = ref => String(ref||'').split(':')[0];

export const citeId   = ref => String(ref||'').slice(String(ref||'').indexOf(':')+1);

export const citeCls  = ref => (CITE_KINDS.find(c=>c.k===citeKind(ref))||{}).cls || '';

export function canSeeReport(rpt, me){
  const p = P(me);
  if(p.scope==='all') return true;
  const revs = rpt.setup ? RS(rpt.setup).reviewers : rpt.custom.reviewers;
  if(rpt.creator===me || revs.includes(me)) return true;
  return p.scope==='bu' && rpt.bu===p.bu;
}

export const rptCfg  = r => r.setup ? RS(r.setup) : r.custom;

export const rptTagC = s => s==='Approved'?'green':s==='In Review'?'teal':'grey';

export const matchesQuery = (q, fields) => {
  const needle = q.trim().toLowerCase();
  if(!needle) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return needle.split(/\s+/).every(term => hay.includes(term));
};

export function CiteCard({cite,scope,onRemove}){
  const {db,go} = use();
  const kind = citeKind(cite), id = citeId(cite);
  const body = (()=>{
    if(kind==='KPI'){
      const f = findKpi(id);
      if(!f) return <div className="cite-m">{id} — no KPI found for this reference.</div>;
      const rec = achFor(f.bd||f.k, scope.bu, scope.period);
      const pct = achPct(rec,f.k.dir);
      return <>
        <div className="cite-hd">
          <span className="cref kpi">KPI</span>
          <span className="cite-t">{f.k.n}{f.bd?' — '+f.bd.dim+': '+f.bd.n:''}</span>
          {f.k.dir==='down' && <span className="dg none" title="A lower actual is the better result">Lower is better</span>}
        </div>
        {rec
          ? <div className="cite-hd" style={{marginTop:5}}>
              <span className="mono" style={{fontSize:11.5}}>
                Target <b>{rec.target}{f.k.unit}</b> · Actual <b>{rec.actual}{f.k.unit}</b></span>
              <span className={'ach '+achCls(pct)}><i/>{pct!=null?pct+'% achievement':'—'}</span>
              {rec.blended && <span className="dg none">Mean of {rec.blended} units</span>}
            </div>
          : <div className="cite-m">No achievement recorded for {scope.bu} · {fmtP(scope.period)}.</div>}
        {f.k.bi && <BIEmbed k={f.k} rec={rec}/>}
      </>;
    }
    if(kind==='STR'){
      const s = ST(id);
      if(!s) return <div className="cite-m">{id} — no Strategy record found.</div>;
      const par = s.par?ST(s.par):null;
      return <>
        <div className="cite-hd">
          <span className="cref str">{s.k}</span>
          <span className="cite-t">{s.n}</span>
          {par && <span className="dg none">under {par.n}</span>}
        </div>
        <div className="cite-m">{s.st}{s.own?' · owner '+P(s.own).name:''}
          {s.pct!=null?' · '+s.pct+'% complete':''}
          {s.k==='Project'&&s.budget?' · budget '+s.budget.toLocaleString():''}
          {s.k==='Project'&&s.start?' · '+fmtDS(s.start)+' → '+fmtDS(s.end):''}</div>
        {s.pct!=null && <div style={{marginTop:6,maxWidth:220}}><Bar v={s.pct}/></div>}
      </>;
    }
    if(kind==='PM'){
      const e = PME(id);
      if(!e) return <div className="cite-m">{id} — no Planning & Monitoring entry found.</div>;
      return <>
        <div className="cite-hd"><span className="cref pm">{e.k}</span>
          <span className="cite-t">{e.n}</span></div>
        <div className="cite-m">
          {e.k==='Target' ? <>Target <b>{e.tg}{e.u}</b> · actual <b>{e.ac!=null?e.ac+e.u:'—'}</b></>
          : e.k==='Conflict' ? <>Gap <b>{e.gap}</b> · {e.st}</>
          : <>Volume <b>{e.vol}</b> · window {e.win} · {e.st}</>}
          {e.own?' · owner '+P(e.own).name:''}</div>
      </>;
    }
    if(kind==='TASK'){
      const t = db.tasks.find(x=>x.id===id);
      if(!t) return <div className="cite-m">{id} — no Task found.</div>;
      return <>
        <div className="cite-hd"><span className="cref">Task</span>
          <span className="cite-t">{t.title}</span>
          <Tag c={t.status==='Closed'?'green':t.due&&t.due<TODAY?'red':'amber'}>{t.status}</Tag></div>
        <div className="cite-m">{t.owner?P(t.owner).name:'Unassigned'} · due {fmtD(t.due)}</div>
      </>;
    }
    if(kind==='ISS'){
      const i = ISS(id);
      if(!i) return <div className="cite-m">{id} — no Issue found.</div>;
      return <>
        <div className="cite-hd"><span className="cref iss">{i.sys}</span>
          <span className="cite-t">{i.n}</span>
          <Tag c={i.sev==='High'?'red':'amber'}>{i.sev}</Tag></div>
        <div className="cite-m">{i.id} · {i.st} · owner {i.own} · opened {fmtD(i.when)}</div>
      </>;
    }
    if(kind==='PAR'){
      const p = db.paragraphs.find(x=>x.id===id);
      if(!p) return <div className="cite-m">{id} — no paragraph found.</div>;
      const used = db.reports.filter(r=>(r.blocks||[]).includes(p.id));
      return <>
        <div className="cite-hd"><span className="cref">Paragraph</span>
          <span className="cite-t">{p.h||'Untitled section'}</span>
          <DiagChip d={p.diag}/></div>
        <div className="cite-q">{p.text||'Not written yet.'}</div>
        <div className="cite-m">{P(p.author).name}
          {used.length>0 && ' · appears in '+used.length+' Report'+(used.length===1?'':'s')}</div>
      </>;
    }
    if(kind==='RPT'){
      const r = db.reports.find(x=>x.id===id);
      if(!r) return <div className="cite-m">{id} — no Report found.</div>;
      const paras = (r.blocks||[]).map(b=>db.paragraphs.find(p=>p.id===b)).filter(Boolean);
      return <>
        <div className="cite-hd"><span className="cref">Child Report</span>
          <span className="cite-t">{rptName(r)}</span>
          <Tag c={rptTagC(r.status)}>{r.status}</Tag></div>
        <div className="cite-m">{fmtP(r.period)} · {r.dept} · {P(r.creator).name} · {paras.length} section{paras.length===1?'':'s'}</div>
        {paras.slice(0,3).map(p=><div className="cite-m" key={p.id}>• {p.h||'Untitled section'}</div>)}
        {paras.length>3 && <div className="cite-m">+ {paras.length-3} more</div>}
        <div style={{marginTop:7}}><Btn k="sm" onClick={()=>go('rpt',r.id)}>Open this Report</Btn></div>
      </>;
    }
    return <div className="cite-m">{cite} — unrecognised reference.</div>;
  })();
  return <div className={'cite '+citeCls(cite)}>
    {onRemove && <button className="cite-x" title="Remove this citation" onClick={onRemove}>×</button>}
    {body}
  </div>;
}
