import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import { ClipboardList, ListChecks, ArrowUpRight, FileText, CalendarDays, Check, MoreHorizontal } from 'lucide-react';
import { fetchRegions, fetchBusinessUnits, fetchDepartments, fetchFunctions, fetchProcesses, fetchKpis, fetchSections, fetchPositions, departmentBuIndex, fetchTeamsChannels, fetchCurrentUser, saveReportTemplateToDataverse, saveMeetingTemplateToDataverse, updateReportTemplateToDataverse, updateMeetingTemplateToDataverse, updateReportTemplateStatus, updateMeetingTemplateStatus, fetchReportTemplatesList, fetchMeetingTemplatesList, fetchReportTemplateDetail, fetchMeetingTemplateDetail, fetchMeetingOccurrencesByTemplate, fetchReportOccurrencesByTemplate, TEMPLATE_STATUS_LABEL } from '../../services/dataverse.js';
import './governance-modern.css';


/* =========================================================================
   ANDALUSIA PULSE · LEADERSHIP PRACTICE · GOVERNANCE SETUP
   Governed option sets and Taxonomy-owned fixtures. In-memory only.
   ========================================================================= */
const TODAY='2026-07-29';

/* ---- governed option sets (section 2) ----------------------------------- */
const SETUP_TYPES=['Business Meeting','Accreditation Committee'];
/* internal key stays `category`; on screen this list is "Type / Classification". */
const TOT='Cross-Functional Team of Teams';
const CATEGORIES=['Planning Meeting','Performance Monitoring Meeting','Clinical Meeting',
                  'Operational Meeting','Technology Meeting','Cross-Functional Meeting', TOT];
/* The Team of Teams is the standing cross-functional forum OF ONE DEPARTMENT. It is where that
   department monitors its own service strategy, which is why it takes exactly one Department while
   every other classification may span several. This is the seam the Strategy module reads from:
   the department's service-strategy objectives and KPIs are monitored here. */
const TOT_NOTE='A Team of Teams belongs to a single Department. It is where that Department monitors '+
  'its own service strategy, and it is the point where the Strategy module and the Leadership Practice '+
  'meet — the objectives and KPIs monitored here are that Department’s service strategy.';
const STAGES=['Stage 1 BU Operational','Stage 2 Regional Functional',
              'Stage 3 Group Functional','Stage 4 Top Management, COO & CEO'];
/* Stage 1 multiplies by Business Unit, Stage 2 by Region — see stageLevel() below. */
/* Nature is NOT held here. Every Setup is frequency-scheduled; a one-off meeting is raised by the
   organiser on the meeting screen and never needs a Setup. */
const FREQUENCIES=['Daily','Twice Weekly','Weekly','Twice Monthly','Monthly',
                   'Quarterly','Semesterly','Annually','Custom'];
const DOW_FREQ=['Daily','Twice Weekly','Weekly'];
const DOM_FREQ=['Twice Monthly','Monthly','Quarterly','Semesterly','Annually'];
const MIQ_FREQ=['Quarterly','Semesterly','Annually'];
const DAYS_OF_WEEK=['Sunday','Monday','Tuesday','Wednesday','Thursday'];
const MONTHS_IN_QUARTER=['1st month','2nd month','3rd month'];
const MODES=['Physical','Virtual','Hybrid'];
/* Clock time and duration are not Setup data — they are fixed on each occurrence. */
const CONFIDENTIALITY=['Public','Internal','Confidential','High Confidential','Restricted'];
/* Draft -> Under Review (Publish) -> Active / Approved (Approve) -> Expired.
   Nothing skips Under Review: Publish always lands there, never straight at
   Active / Approved -- only the dedicated Approve action moves it further. */
const LIFECYCLE=['Draft','Under Review','Active / Approved','Expired'];
const ATTENDEE_TYPES=['Core','Supportive'];
const SUPPORTIVE_FUNCTIONS=['Business Analysis','HR Performance','L&D','Business Transformation',
                            'HR Reward','Recruitment','HR Assessment','Strategy Management (SMO)'];
const AGENDA_SOURCES=['Migrated - Initial','Added'];
const REPORT_TYPES=['Plan','Report','Conclusion'];
const REPORT_TYPE_HELP={
  'Plan':'Submitted the month before the month it covers.',
  'Report':'Content and submission fall in the same month.',
  'Conclusion':'Submitted the month after its content month.'};
/* register-table tag colour, one per Report Type -- same idea as the
   purple/blue split the register already uses for Meeting Setup Type. */
const REPORT_TYPE_TAG_COLOR={'Plan':'blue','Report':'teal','Conclusion':'purple'};
const REPORT_CATEGORIES=['Outcome Executive','Process Executive','Core Process','Custom Content'];
const REPORT_ROLES=['Input','Output'];
const REPORT_DELIVERY=['File destination','Source link'];

/* ---- roles (section 5) --------------------------------------------------- */
/* Both roles author Setups -- the difference is only who may APPROVE one.
   An Author sends a Setup to Under Review; only an Administrator can move
   it on to Active / Approved (or expire an approved one). Driven by the
   Administrator toggle in the top bar. */
const ROLES={
  admin :{label:'Setup Administrator', write:true, approve:true,
          note:'Creates, edits and publishes Setups, and approves or expires them.'},
  author:{label:'Setup Author',        write:true, approve:false,
          note:'Creates, edits and publishes Setups. Approval is an Administrator action.'},
};

/* ---- organisational cascade (section 3) ---------------------------------- */
/* Organization is not part of a Setup. Everything authored here belongs to the group, so the
   cascade starts at Region. */
let REGIONS=[
  {id:'rg-ksa', name:'Kingdom of Saudi Arabia', tz:'(UTC+03:00) Riyadh'},
  {id:'rg-egy', name:'Egypt',                   tz:'(UTC+02:00) Cairo'}];
let BUSINESS_UNITS=[
  {id:'bu-ahj', region:'rg-ksa', name:'Andalusia Jeddah'},
  {id:'bu-adc', region:'rg-ksa', name:'Andalusia Dental Clinics'},
  {id:'bu-ahm', region:'rg-egy', name:'Andalusia Al Moasah'},
  {id:'bu-ahs', region:'rg-egy', name:'Andalusia Shallalat'}];
let DEPARTMENTS=[
  {id:'dp-ahj-q',  bu:'bu-ahj', name:'Quality'},
  {id:'dp-ahj-n',  bu:'bu-ahj', name:'Nursing'},
  {id:'dp-ahj-m',  bu:'bu-ahj', name:'Medical Affairs'},
  {id:'dp-adc-c',  bu:'bu-adc', name:'Clinical Operations'},
  {id:'dp-adc-q',  bu:'bu-adc', name:'Quality'},
  {id:'dp-adc-p',  bu:'bu-adc', name:'Patient Experience'},
  {id:'dp-ahm-q',  bu:'bu-ahm', name:'Quality'},
  {id:'dp-ahm-n',  bu:'bu-ahm', name:'Nursing'},
  {id:'dp-ahm-t',  bu:'bu-ahm', name:'Information Technology'},
  {id:'dp-ahs-q',  bu:'bu-ahs', name:'Quality'},
  {id:'dp-ahs-o',  bu:'bu-ahs', name:'Operations'},
  {id:'dp-ahs-f',  bu:'bu-ahs', name:'Facilities'}];
/* Section / Specialty exists on SOME Business Units only — the optional branch.
   (Real schema: cr301_specialtyksa_service_hubs links directly to Business Unit,
   not via Department, so this cascades BU -> Specialty, not BU -> Department -> Specialty.) */
let SECTIONS=[
  {id:'sc-1', bu:'bu-ahj', name:'Cardiology'},
  {id:'sc-2', bu:'bu-ahj', name:'Orthopaedics'},
  {id:'sc-3', bu:'bu-ahj', name:'Paediatrics'},
  {id:'sc-4', bu:'bu-ahj', name:'Critical Care Nursing'},
  {id:'sc-5', bu:'bu-ahj', name:'Theatre Nursing'},
  {id:'sc-6', bu:'bu-adc', name:'Orthodontics'},
  {id:'sc-7', bu:'bu-adc', name:'Prosthodontics'},
  {id:'sc-8', bu:'bu-ahm', name:'Maternity Nursing'}];
let FUNCTIONS=[
  {id:'fn-1',  dept:'dp-ahj-q', name:'Quality Assurance'},
  {id:'fn-2',  dept:'dp-ahj-q', name:'Accreditation'},
  {id:'fn-3',  dept:'dp-ahj-q', name:'Patient Safety'},
  {id:'fn-4',  dept:'dp-ahj-n', name:'Nursing Education'},
  {id:'fn-5',  dept:'dp-ahj-n', name:'Nursing Operations'},
  {id:'fn-6',  dept:'dp-ahj-m', name:'Clinical Governance'},
  {id:'fn-7',  dept:'dp-ahj-m', name:'Medical Staff Affairs'},
  {id:'fn-8',  dept:'dp-adc-c', name:'Clinical Delivery'},
  {id:'fn-9',  dept:'dp-adc-c', name:'Clinical Audit'},
  {id:'fn-10', dept:'dp-adc-q', name:'Quality Assurance'},
  {id:'fn-11', dept:'dp-adc-p', name:'Patient Relations'},
  {id:'fn-12', dept:'dp-adc-p', name:'Service Recovery'},
  {id:'fn-13', dept:'dp-ahm-q', name:'Quality Assurance'},
  {id:'fn-14', dept:'dp-ahm-q', name:'Infection Control'},
  {id:'fn-15', dept:'dp-ahm-n', name:'Nursing Operations'},
  {id:'fn-16', dept:'dp-ahm-t', name:'Applications'},
  {id:'fn-17', dept:'dp-ahm-t', name:'Infrastructure'},
  {id:'fn-18', dept:'dp-ahs-q', name:'Quality Assurance'},
  {id:'fn-19', dept:'dp-ahs-o', name:'Operations Planning'},
  {id:'fn-20', dept:'dp-ahs-o', name:'Capacity Management'},
  {id:'fn-21', dept:'dp-ahs-f', name:'Biomedical Engineering'},
  {id:'fn-22', dept:'dp-ahs-f', name:'Facilities Maintenance'}];
/* A Setup covers several units at once, so Department and Function are chosen once, by name,
   above the units — the same Department and the same Function exist inside more than one unit. */
const departmentNames=()=>Array.from(new Set(DEPARTMENTS.map(d=>d.name))).sort();
const functionNames=()=>Array.from(new Set(FUNCTIONS.map(f=>f.name))).sort();
/* the Functions that sit under one Department — the second dropdown of a scope line.
   Leaving it empty is a real answer: the whole Department is in the committee. */
function functionsIn(depName){
  const ids=DEPARTMENTS.filter(d=>d.name===depName).map(d=>d.id);
  return Array.from(new Set(FUNCTIONS.filter(f=>ids.includes(f.dept)).map(f=>f.name))).sort();
}
/* Sections/Specialties now cascade directly from Business Unit (their real
   Dataverse relationship), not via Department. */
function sectionsFor(bu){
  return SECTIONS.filter(x=>!bu||x.bu===bu);
}

/* ---- positions, each with a seeded current holder (G-01) ----------------- */
let POSITIONS=[
  {id:'p01', name:'Medical Director',                     holder:'Dr. Ahmed Farouk'},
  {id:'p02', name:'Head of Quality',                      holder:'Sara Khalil'},
  {id:'p03', name:'Quality Section Head',                 holder:'Hussain Ahmed'},
  {id:'p04', name:'Governance Facilitator',               holder:'Reem Al-Otaibi'},
  {id:'p05', name:'Quality Coordinator',                  holder:'Omar Nasser'},
  {id:'p06', name:'Business Unit Director',               holder:'Dr. Mai Adel'},
  {id:'p07', name:'Nursing Director',                     holder:'Layla Ibrahim'},
  {id:'p08', name:'Pharmacy Director',                    holder:'Mona Adel'},
  {id:'p09', name:'Finance Business Partner',             holder:'Yasser Kamal'},
  {id:'p10', name:'Biomedical Engineering Section Head',  holder:'Khalid Sultan'},
  {id:'p11', name:'Infection Control Officer',            holder:'Dina Farid'},
  {id:'p12', name:'IT Applications Manager',              holder:'Rami Habib'},
  {id:'p13', name:'Internal Audit Manager',               holder:'Tarek Mansour'},
  {id:'p14', name:'Chief Operating Officer',              holder:'Nabil Aziz'},
  {id:'p15', name:'Group Chief Financial Officer',        holder:'Dina Shawky'},
  {id:'p16', name:'Group Chief Executive Officer',        holder:'Ehab Zaki'}];

/* ---- the name is DERIVED, never chosen (see derivedName) ------------------ */
/* A Setup is not named by hand and not picked off a list. The name is what the Setup
   already says about itself: its Stage, the Department or Function it covers, and its
   classification. Change the scope and the name follows. */
const CLASS_NOUN={
  'Planning Meeting':'Planning Meeting',
  'Performance Monitoring Meeting':'Performance Monitoring Meeting',
  'Clinical Meeting':'Clinical Meeting',
  'Operational Meeting':'Operational Meeting',
  'Technology Meeting':'Technology Meeting',
  'Cross-Functional Meeting':'Cross-Functional Meeting'};
const STAGE_PREFIX=['','Regional','Group','Executive'];

/* the single pseudo-unit a Stage 3 / Stage 4 Setup runs as */
const GROUP_KEY='__group';

/* ---- where it is discussed: Team, then Channel inside that Team ----------- */
/* Read live from and_teamschannels: one row per CHANNEL, carrying the name of
   the Team it sits in as plain text (lm_team). There is no Teams table -- a
   Team exists only as that name repeated across its channels' rows -- so TEAMS
   below is DERIVED from the channel rows, and a Team's id IS its name.

   That also means a Team carries no Business Unit or Region relationship, so
   Teams can no longer be narrowed to the unit a Setup runs in the way the
   seeded data allowed: every unit is offered every Team. */
let TEAMS=[];
let CHANNELS=[];
/* Rebuilds both lists from a single fetchTeamsChannels() result. */
function setTeamsChannels(rows){
  CHANNELS=rows.map(r=>({id:r.id, name:r.name, team:r.team, link:r.link,
                         sitePath:r.sitePath, library:r.library, folder:r.folder}));
  TEAMS=Array.from(new Set(rows.map(r=>r.team).filter(Boolean)))
    .sort((a,b)=>a.localeCompare(b))
    .map(name=>({id:name, name}));

  /* Same rows, read a second way: the SharePoint destination cascade. A row
     that names a Site but no Library contributes only a Site, and so on down,
     so a half-filled channel still surfaces the part it does have. */
  const siteMap=new Map(), libMap=new Map(), folderMap=new Map();
  rows.forEach(r=>{
    const site=(r.sitePath||'').trim();
    if(!site) return;
    if(!siteMap.has(site)) siteMap.set(site,{id:site, name:site});
    const library=(r.library||'').trim();
    if(!library) return;
    const libId=site+' / '+library;
    if(!libMap.has(libId)) libMap.set(libId,{id:libId, site, name:library});
    const folder=(r.folder||'').trim();
    if(!folder) return;
    const folderId=libId+' / '+folder;
    if(!folderMap.has(folderId)) folderMap.set(folderId,{id:folderId, library:libId, name:folder});
  });
  const byName=(x,y)=>x.name.localeCompare(y.name);
  SITES=[...siteMap.values()].sort(byName);
  LIBRARIES=[...libMap.values()].sort(byName);
  FOLDERS=[...folderMap.values()].sort(byName);
}
const teamsIn = () => TEAMS;
/* The Team a Channel sits in -- needed on read-back, where Dataverse stores
   only the Channel lookup and the Team has to be recovered from it. */
const teamOfChannel = channelId => { const c=byId(CHANNELS,channelId); return c?c.team:null; };
const channelsIn = teamId => CHANNELS.filter(c=>c.team===teamId);
/* A Channel's document location as one path -- SharePoint Site Path, Document
   Library and Folder joined, skipping whichever parts are empty. This is what
   auto-fills a Report Template's Source link when a Channel is chosen. */
function channelPath(channelId){
  const c=byId(CHANNELS,channelId);
  if(!c) return '';
  return [c.sitePath,c.library,c.folder]
    .map(x=>(x==null?'':String(x).trim()))
    .filter(Boolean)
    .map(x=>x.replace(/^\/+|\/+$/g,''))
    .join('/');
}

/* ---- destination cascade (FR-SET-13) ------------------------------------- */
/* Site, Library and Folder are not tables of their own either -- they are the
   SharePoint Site Path, Document Library and Folder columns carried on each
   and_teamschannels row. So all three are DERIVED from the same channel rows
   in setTeamsChannels() below: a Site is a distinct Site Path, a Library a
   distinct Site Path + Library, a Folder a distinct Site Path + Library +
   Folder. Ids are the joined path, since there is no key to use. */
let SITES=[];
let LIBRARIES=[];
let FOLDERS=[];

/* populated alongside PROCESSES/KPIS whenever a live fetch succeeds --
   name -> id, used only at Report Template save time to resolve the
   flat display-name selections back to real Dataverse ids. */
/* Department -> the Business Units it actually appears in, derived from the
   Organization Structure (each position assignment names both). The Departments
   table itself has no Business Unit column -- its "owning business unit" is
   Dataverse's security owner and is the root org for nearly every row, so it
   cannot be used to narrow anything. Rebuilt whenever Positions load. */
let DEPT_BUS={};
const deptInBu = (deptId, buId) => !buId || !!(DEPT_BUS[deptId] && DEPT_BUS[deptId].has(buId));
const deptBuNames = deptId => {
  const set=DEPT_BUS[deptId];
  if(!set || !set.size) return '—';
  return Array.from(set).map(id=>nameOf(BUSINESS_UNITS,id)).filter(Boolean).sort().join(', ')||'—';
};

let PROCESS_ID_BY_NAME={};
let KPI_ID_BY_NAME={};
let PROCESS_DEPT_BY_NAME={};
let KPI_DEPT_BY_NAME={};

let PROCESSES=['PRC-QLT-01 Quality indicator management','PRC-QLT-02 Corrective action management',  'PRC-NUR-01 Nursing establishment planning','PRC-MED-01 Medication reconciliation',
  'PRC-IPC-01 Infection surveillance','PRC-OPS-01 Patient flow management',
  'PRC-BME-01 Preventive maintenance','PRC-FIN-01 Budget preparation',
  'PRC-ITX-01 Change management','PRC-HRM-01 Workforce planning'];
let KPIS=['KPI-QLT-001 Sepsis bundle compliance','KPI-QLT-007 Hand hygiene compliance',
  'KPI-NUR-003 Nursing vacancy rate','KPI-MED-002 Medication error rate',
  'KPI-IPC-004 Healthcare associated infection rate','KPI-OPS-004 Theatre utilisation',
  'KPI-BME-002 Preventive maintenance completion','KPI-FIN-001 Operating margin',
  'KPI-ITX-003 Change success rate','KPI-EXE-001 Composite performance index'];
const OBJECTIVES=['OBJ-01 Improve patient safety and clinical outcomes',
  'OBJ-02 Achieve and sustain accreditation','OBJ-03 Improve patient experience',
  'OBJ-04 Digitalise core operations','OBJ-05 Strengthen workforce capability',
  'OBJ-06 Improve operating margin','OBJ-07 Expand regional service coverage',
  'OBJ-08 Grow outpatient market share'];

/* ---- lookups -------------------------------------------------------------- */
const byId=(list,id)=>list.find(x=>x.id===id)||null;
const nameOf=(list,id)=>{const x=byId(list,id); return x?x.name:null;};
const posName=id=>{const p=byId(POSITIONS,id); return p?p.name:'—';};
const posHolder=id=>{const p=byId(POSITIONS,id); return p?p.holder:null;};
/* Start well past the hard-coded fixture ids (su-1 … su-8) so a generated id can never
   collide with a seeded one — a collision makes "New Setup" silently open an existing record. */
let SEQ=100; const uid=p=>`${p}-${++SEQ}`;
const stamp=()=>{const d=new Date(2026,6,29,9+Math.min(SEQ,12),(SEQ*7)%60);
  return `${TODAY} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
const fmtD=d=>{ if(!d) return '—'; const [y,m,dd]=d.split('-');
  return `${+dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`;};

/* =========================================================================
   SCOPE THAT MULTIPLIES
   One Setup is authored once and runs in several places at once. Stage decides
   what it multiplies by:
     Stage 1 — one section per Business Unit
     Stage 2 — one section per Region
     Stage 3 / 4 — group-wide, a single section
   Everything that is the same everywhere (name, objective, template, cadence,
   agenda) is captured once. Everything that differs per place — the Department,
   the Chairman, the Organizer, who attends, who submits — lives on the units.
   ========================================================================= */
const stageLevel = s => s.stage===STAGES[0] ? 'bu'
                      : s.stage===STAGES[1] ? 'region'
                      : s.stage ? 'group' : null;
const LEVEL_WORD={bu:'Business Unit', region:'Region', group:'Group'};
/* Stage 4 is Top Management and the Executive Committee. It sits above the department
   structure, so it carries no Department at all. */
const isExec = s => s.stage===STAGES[3];

/* the keys this Setup multiplies over, in the order they were selected */
function scopeKeys(s){
  const lv=stageLevel(s);
  if(lv==='bu')     return (s.businessUnits||[]).slice();
  if(lv==='region') return (s.regions||[]).slice();
  if(lv==='group')  return [GROUP_KEY];
  return [];
}
/* Region is chosen at Stage 2 and derived from the Business Units at Stage 1. */
function regionsOf(s){
  const lv=stageLevel(s);
  if(lv==='region') return (s.regions||[]).slice();
  if(lv==='bu') return Array.from(new Set((s.businessUnits||[])
    .map(b=>{const x=byId(BUSINESS_UNITS,b); return x?x.region:null;}).filter(Boolean)));
  return [];
}
function unitLabel(s,key){
  if(key===GROUP_KEY) return 'Group-wide';
  return nameOf(BUSINESS_UNITS,key) || nameOf(REGIONS,key) || key;
}
function unitSub(s,key){
  if(key===GROUP_KEY) return s.stage||'';
  const b=byId(BUSINESS_UNITS,key);
  if(b) return nameOf(REGIONS,b.region)||'';
  return byId(REGIONS,key) ? 'Region' : '';
}
const buOf=(s,key)=> stageLevel(s)==='bu' ? key : null;

/* Positions filtered to the Business Units/Regions actually in scope for
   this Setup (Organisational scope step). Falls back to every Position
   once nothing is selected yet, so pickers aren't empty before scope is
   chosen, and never hides a Position that has no `bu` at all (built-in
   mock data predates the Dataverse wiring and isn't tagged to a unit). */
/* key, when given, scopes to that ONE unit card's own Business Unit --
   not the whole Setup's multi-unit selection. Without a key, falls back to
   every Business Unit the Setup as a whole runs in. */
function positionsInScope(s,key){
  const lv=stageLevel(s);
  let buIds;
  if(lv==='bu'){
    buIds = key ? [key] : (s.businessUnits||[]).slice();
  }else if(lv==='region'){
    const regionIds = key ? [key] : (s.regions||[]);
    buIds = BUSINESS_UNITS.filter(b=>regionIds.includes(b.region)).map(b=>b.id);
  }else if(lv==='group'){
    buIds = BUSINESS_UNITS.map(b=>b.id);
  }else{
    buIds = [];
  }
  if(!buIds.length) return POSITIONS;
  return POSITIONS.filter(p=>!p.bu || buIds.includes(p.bu));
}

/* A Standing Agenda Item's Owner is one of the roles actually named on the Setup's
   units — the Chairman, Co-Chairman, Facilitator or an Attendee (Core or Supportive) —
   not just anyone in scope. Pooled across every unit since the agenda is shared. */
function agendaOwnerOptions(s){
  const ids=new Set();
  (s.units||[]).forEach(u=>{
    if(u.chairman) ids.add(u.chairman);
    if(u.coChairman) ids.add(u.coChairman);
    if(u.facilitator) ids.add(u.facilitator);
    (u.coreMembers||[]).forEach(m=>{ if(m.position) ids.add(m.position); });
  });
  return POSITIONS.filter(p=>ids.has(p.id));
}

/* ---- scope lines: one Department, and optionally one Function inside it --- */
/* A line with no Function means the whole Department sits on this Setup. */
const linesOf=s=>(s.lines||[]).filter(l=>l&&l.department);
const depsOf=s=>Array.from(new Set(linesOf(s).map(l=>l.department)));
const lineLabel=l=>l.function ? `${l.department} › ${l.function}` : `${l.department} (whole department)`;

/* =========================================================================
   THE NAME IS THE RESULT OF THE SETUP
   Nothing is typed and nothing is picked from a list. The parts are:
     [Stage prefix] [Subject] [Classification noun]
   Subject is the Function when one Function is named, the Department when the
   whole Department is in scope, and is dropped once three or more are covered —
   at that point the Setup is not about any one of them.
   A word already present is never repeated: "Clinical Governance" + "Clinical
   Meeting" reads "Clinical Governance Meeting", not "Clinical Governance Clinical".
   ========================================================================= */
function subjectOf(s){
  const ls=linesOf(s);
  if(!ls.length) return '';
  const parts=ls.map(l=>l.function||l.department);
  if(parts.length===1) return parts[0];
  if(parts.length===2) return parts[0]+' and '+parts[1];
  return '';                       /* three or more — the name stays general */
}
const stem=w=>w.toLowerCase().replace(/[^a-z]/g,'').slice(0,5);
function dropRepeats(subject,noun){
  const have=subject.split(/\s+/).map(stem).filter(Boolean);
  const kept=noun.split(/\s+/).filter(w=>!have.includes(stem(w)));
  return kept.join(' ') || noun.split(/\s+/).slice(-1)[0];
}
function derivedName(s){
  const pre=STAGE_PREFIX[STAGES.indexOf(s.stage)]||'';
  const subj=subjectOf(s);
  let base;
  if(s.kind==='Report Template'){
    base=[s.frequency, pre, subj, s.reportType].filter(Boolean).join(' ');
  } else if(s.category===TOT){
    /* the Team of Teams is named after the Department it serves */
    const dep=(linesOf(s)[0]||{}).department;
    base='Team of Teams'+(dep?' — '+[pre,dep].filter(Boolean).join(' '):'');
  } else {
    const noun = s.setupType==='Accreditation Committee'
      ? 'Committee' : (CLASS_NOUN[s.category]||'Meeting');
    base=[pre, subj, subj?dropRepeats(subj,noun):noun].filter(Boolean).join(' ');
  }
  if(!base.trim()) return '';
  return s.qualifier && s.qualifier.trim() ? `${base} (${s.qualifier.trim()})` : base;
}
/* what the register, the header and the audit trail all show */
const displayName=s=>derivedName(s)||'(not enough set up to name it yet)';

/* Resolved scope string used on the register and in the wizards (FR-SET-05). */
function scopeString(s){
  const lv=stageLevel(s), keys=scopeKeys(s);
  if(!lv) return '—';
  let mid;
  if(lv==='bu')          mid = keys.length===0 ? 'no Business Unit yet'
                             : keys.length===1 ? nameOf(BUSINESS_UNITS,keys[0])
                             : `${keys.length} business units`;
  else if(lv==='region') mid = keys.length===0 ? 'no Region yet'
                             : keys.length===1 ? nameOf(REGIONS,keys[0])
                             : `${keys.length} regions`;
  else                   mid = 'Group-wide';
  const ls=linesOf(s);
  const dep = ls.length===0 ? null
            : ls.length<=2 ? ls.map(lineLabel).join(' + ')
            : `${ls.length} departments`;
  return [mid, dep].filter(Boolean).join(' › ');
}
/* every place spelled out — used where there is room for it */
const scopeNames=s=>scopeKeys(s).map(k=>unitLabel(s,k));

/* ---- unit rows keep step by step with the scope selection ---------------- */
function blankUnit(kind,key){
  const base={id:uid('un'), key, section:null, team:null, channel:null};
  return kind==='Report Template'
    ? {...base, submitter:null, owner:null, reviewChain:[]}
    : {...base, chairman:null, coChairman:null, facilitator:null, coreMembers:[]};
}
/* Adds a row for anything newly selected, drops rows for anything deselected, and
   keeps whatever was already typed into the rows that survive. */
function syncUnits(s){
  const cur=s.units||[];
  return scopeKeys(s).map(k=> cur.find(u=>u.key===k) || blankUnit(s.kind,k));
}
const unitOf=(s,key)=>(s.units||[]).find(u=>u.key===key)||null;
/* the fields that are safe to copy from one unit to another — never the Department,
   which belongs to the unit it was chosen in */
function copyUnitBody(kind,from){
  return kind==='Report Template'
    ? {submitter:from.submitter, owner:from.owner, reviewChain:(from.reviewChain||[]).slice()}
    : {chairman:from.chairman, coChairman:from.coChairman, facilitator:from.facilitator,
       coreMembers:(from.coreMembers||[]).map(m=>({...m,id:uid('cm')}))};
}

/* =========================================================================
   SEED — eight Setups covering every branch the acceptance checks exercise.
   Seeded on first visit only; after that, the working copy lives in
   sessionStorage (see loadDb/saveDb below) so edits survive reloads and
   in-tab navigation for the rest of the browser session, same as a real
   backed app would feel without wiring an actual database.
   ========================================================================= */
const GOV_DB_KEY='andalusiaPulse.governanceSetup.db.v1';
function loadDb(){
  try{
    const raw=sessionStorage.getItem(GOV_DB_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* corrupt or inaccessible storage — fall through to seed */ }
  return seed();
}
function saveDb(db){
  try{ sessionStorage.setItem(GOV_DB_KEY, JSON.stringify(db)); }
  catch(e){ /* storage full/unavailable — edits still work for this render, just won't persist */ }
}

/* Maps a local Report Template Setup's session id (su-xxx) to the real
   Dataverse id it was assigned the last time it was successfully saved.
   Lets a Meeting Template's Linked Reports write a genuine
   lm_ReportTemplate@odata.bind instead of only a free-text name -- see
   buildMeetingTemplatePayload and saveMeetingTemplateToDataverse. Same
   sessionStorage persistence model as the rest of Governance Setup: if
   the browser session ends before a report is (re-)published, the
   mapping is gone and Linked Reports quietly falls back to name-only,
   same as before this existed. */
const REPORT_DV_ID_KEY='andalusiaPulse.governanceSetup.reportDataverseIds.v1';
function loadReportDvIds(){
  try{
    const raw=sessionStorage.getItem(REPORT_DV_ID_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* corrupt or inaccessible storage */ }
  return {};
}
function saveReportDvIds(map){
  try{ sessionStorage.setItem(REPORT_DV_ID_KEY, JSON.stringify(map)); }
  catch(e){ /* storage full/unavailable */ }
}
let REPORT_DATAVERSE_ID=loadReportDvIds(); // { [local Setup id]: real lm_report_templates id }

const BLANK_MEETING={
  kind:'Committee / Meeting', setupType:'Business Meeting', category:null,
  qualifier:'',
  stage:null, regions:[], businessUnits:[], lines:[], units:[],
  frequency:null, dayOfWeek:null, dayOfMonth:null, monthInQuarter:null,
  mode:null,
  supportive:[], quorum:null,
  torLink:'', agenda:[], linkedTemplates:[], confidentiality:null,
  status:'Draft', version:0, updated:TODAY};

const BLANK_REPORT={
  kind:'Report Template', objective:'', reportType:null, reportCategory:null,
  qualifier:'',
  stage:null, regions:[], businessUnits:[], lines:[], units:[],
  delivery:'Source link', site:null, library:null, folder:null, sourceLink:'', sourceLinkAuto:false,
  checklist:[], processes:[], kpis:[],
  frequency:null, dayOfWeek:null, dayOfMonth:null, monthInQuarter:null,
  confidentiality:null, status:'Draft', version:0, updated:TODAY};

function seed(){
  const S=[];
  const mk=(o)=>{ const base=o.kind==='Report Template'?BLANK_REPORT:BLANK_MEETING;
                  S.push({...base,...o,_seed:true}); return S[S.length-1]; };

  const um=(key,o)=>({id:'un-'+key.slice(3), key, section:null, team:null, channel:null,
    chairman:null, coChairman:null, facilitator:null, coreMembers:[], ...o});
  const ur=(key,o)=>({id:'un-'+key.slice(3), key, section:null, team:null, channel:null,
    submitter:null, owner:null, reviewChain:[], ...o});

  /* 1 — published Accreditation Committee running in TWO Business Units at once.
         Same name, TOR, agenda and cadence; different Chairman, Organizer and
         attendees in each unit. Version 2. */
  mk({id:'su-1', kind:'Committee / Meeting', setupType:'Accreditation Committee', category:null,
    stage:STAGES[0], regions:['rg-ksa'],
    businessUnits:['bu-ahj','bu-adc'],
    lines:[{id:'ln1', department:'Quality', function:'Accreditation'}],
    units:[
      um('bu-ahj',{team:'tm-ahj-q', channel:'ch-ahj-q-1', chairman:'p01', coChairman:'p02', facilitator:'p04',
        coreMembers:[{id:'cm1',position:'p02',type:'Core'},{id:'cm2',position:'p07',type:'Core'},
                     {id:'cm3',position:'p08',type:'Core'},{id:'cm4',position:'p05',type:'Supportive'}]}),
      um('bu-adc',{team:'tm-adc-q', channel:'ch-adc-q-1', chairman:'p06', coChairman:null, facilitator:'p05',
        coreMembers:[{id:'cm5',position:'p02',type:'Core'},{id:'cm6',position:'p11',type:'Core'},
                     {id:'cm7',position:'p13',type:'Supportive'}]})],
    frequency:'Monthly', dayOfMonth:18,
    mode:'Hybrid',
    supportive:['Business Analysis','Strategy Management (SMO)'], quorum:75,
    torLink:'https://taxonomy.andalusia.local/tor/TOR-QLT-003-v3',
    agenda:[{id:'a1',text:'Carried-forward items from the last meeting',owner:'p04',source:'Migrated - Initial'},
            {id:'a2',text:'Quality indicator performance',owner:'p02',source:'Migrated - Initial'},
            {id:'a3',text:'Open corrective actions review',owner:'p04',source:'Migrated - Initial'},
            {id:'a4',text:'Accreditation readiness update',owner:'p01',source:'Added'}],
    linkedTemplates:[{template:'su-7',role:'Input'}],
    confidentiality:'Confidential', status:'Active / Approved', version:2, updated:'2026-06-14'});

  /* 2 — the Cross-Functional Team of Teams of ONE Department. This is where that Department
         monitors its own service strategy — the seam with the Strategy module. */
  mk({id:'su-2', kind:'Committee / Meeting', setupType:'Business Meeting', category:TOT,
    stage:STAGES[0], regions:['rg-ksa'], businessUnits:['bu-ahj'],
    lines:[{id:'ln2', department:'Quality', function:null}],
    units:[um('bu-ahj',{team:'tm-ahj-q', channel:'ch-ahj-q-3', chairman:'p02', facilitator:'p03',
      coreMembers:[{id:'cm8',position:'p03',type:'Core'},{id:'cm9',position:'p05',type:'Core'},
                   {id:'cm10',position:'p11',type:'Supportive'}]})],
    frequency:'Weekly', dayOfWeek:'Sunday',
    mode:'Hybrid',
    supportive:['Business Analysis','HR Performance','L&D','Business Transformation',
                'HR Reward','Recruitment','HR Assessment','Strategy Management (SMO)'],
    quorum:null, torLink:'',
    agenda:[{id:'a1',text:'Function updates',owner:'p03',source:'Migrated - Initial'},
            {id:'a2',text:'Blockers and dependencies',owner:'p05',source:'Added'}],
    linkedTemplates:[], confidentiality:'Internal',
    status:'Active / Approved', version:1, updated:'2026-05-02'});

  /* 3 — published Monitoring Meeting at Stage 3 — group-wide, a single section */
  mk({id:'su-3', kind:'Committee / Meeting', setupType:'Business Meeting',
    category:'Performance Monitoring Meeting',
    stage:STAGES[2], regions:[], businessUnits:[],
    lines:[{id:'ln3a', department:'Quality', function:null},
           {id:'ln3b', department:'Medical Affairs', function:null},
           {id:'ln3c', department:'Operations', function:null}],
    units:[um(GROUP_KEY,{id:'un-grp3', team:'tm-grp-e', channel:'ch-grp-e-3', chairman:'p14', facilitator:'p09',
      coreMembers:[{id:'cm11',position:'p06',type:'Core'},{id:'cm12',position:'p15',type:'Core'}]})],
    frequency:'Quarterly', dayOfMonth:12, monthInQuarter:'1st month',
    mode:'Virtual',
    supportive:['Strategy Management (SMO)'], quorum:null, torLink:'',
    agenda:[{id:'a1',text:'Group scorecard review',owner:'p15',source:'Migrated - Initial'}],
    linkedTemplates:[{template:'su-8',role:'Input'}], confidentiality:'High Confidential',
    status:'Active / Approved', version:1, updated:'2026-04-21'});

  /* 4 — Draft across THREE Business Units with only the first one filled in.
         Shows the per-unit rules failing unit by unit. */
  mk({id:'su-4', kind:'Committee / Meeting', setupType:'Business Meeting', category:'Clinical Meeting',
    stage:STAGES[0], regions:['rg-ksa','rg-egy'],
    businessUnits:['bu-ahj','bu-ahm','bu-ahs'],
    lines:[{id:'ln4a', department:'Medical Affairs', function:'Clinical Governance'},
           {id:'ln4b', department:'Nursing', function:null}],
    units:[
      um('bu-ahj',{section:'sc-1', team:'tm-ahj-c', channel:'ch-ahj-c-1', chairman:'p01', facilitator:null,
        coreMembers:[]}),
      um('bu-ahm',{}), um('bu-ahs',{})],
    frequency:'Monthly', dayOfMonth:20,
    mode:'Physical',
    supportive:[], quorum:null, torLink:'',
    agenda:[], linkedTemplates:[], confidentiality:'Confidential',
    status:'Draft', version:0, updated:'2026-07-18'});

  /* 5 — Under Review, Stage 2: the same Committee run once per REGION —
         Saudi Arabia and Egypt, each with its own Chairman and Organizer. */
  mk({id:'su-5', kind:'Committee / Meeting', setupType:'Accreditation Committee', category:null,
    stage:STAGES[1], regions:['rg-ksa','rg-egy'], businessUnits:[],
    lines:[{id:'ln5', department:'Quality', function:'Infection Control'}],
    units:[
      um('rg-ksa',{id:'un-ksa5', team:'tm-ksa-g', channel:'ch-ksa-g-1', chairman:'p11', facilitator:'p05',
        coreMembers:[{id:'cm13',position:'p01',type:'Core'},{id:'cm14',position:'p07',type:'Core'},
                     {id:'cm15',position:'p02',type:'Core'}]}),
      um('rg-egy',{id:'un-egy5', team:'tm-egy-g', channel:'ch-egy-g-1', chairman:'p02', coChairman:'p11',
        facilitator:'p04',
        coreMembers:[{id:'cm16',position:'p07',type:'Core'},{id:'cm17',position:'p05',type:'Core'}]})],
    frequency:'Monthly', dayOfMonth:23,
    mode:'Physical',
    supportive:['HR Performance'], quorum:60,
    torLink:'https://taxonomy.andalusia.local/tor/TOR-IPC-001-v2',
    agenda:[{id:'a1',text:'Carried-forward items from the last meeting',owner:'p05',source:'Migrated - Initial'},
            {id:'a2',text:'Surveillance data review',owner:'p11',source:'Migrated - Initial'},
            {id:'a3',text:'Hand hygiene compliance',owner:'p05',source:'Added'}],
    linkedTemplates:[], confidentiality:'Confidential',
    status:'Under Review', version:1, updated:'2026-07-25'});

  /* 6 — Expired */
  mk({id:'su-6', kind:'Committee / Meeting', setupType:'Business Meeting', category:'Operational Meeting',
    stage:STAGES[0], regions:['rg-egy'], businessUnits:['bu-ahs'],
    lines:[{id:'ln6', department:'Operations', function:null}],
    units:[um('bu-ahs',{team:'tm-ahs-o', channel:'ch-ahs-o-0', chairman:'p14', facilitator:'p05',
      coreMembers:[{id:'cm18',position:'p07',type:'Core'}]})],
    frequency:'Daily', dayOfWeek:'Sunday',
    mode:'Physical',
    supportive:[], quorum:null, torLink:'',
    agenda:[{id:'a1',text:'Overnight escalations',owner:'p05',source:'Migrated - Initial'}],
    linkedTemplates:[], confidentiality:'Internal',
    status:'Expired', version:2, updated:'2026-03-30'});

  /* 7 — published Report Template written once and submitted from TWO Business Units
         in two different regions — a different submitter and chain in each. */
  mk({id:'su-7', kind:'Report Template',
    objective:'Conclude the month’s quality indicator performance and the actions taken.',
    reportType:'Conclusion', reportCategory:'Outcome Executive',
    stage:STAGES[0], regions:['rg-ksa','rg-egy'],
    businessUnits:['bu-ahj','bu-ahm'],
    lines:[{id:'ln7', department:'Quality', function:null}],
    units:[
      ur('bu-ahj',{team:'tm-ahj-q', channel:'ch-ahj-q-2', submitter:'p05', owner:'p03',
        reviewChain:['p02','p01','p06']}),
      ur('bu-ahm',{team:'tm-ahm-q', channel:'ch-ahm-q-2', submitter:'p11', owner:'p02',
        reviewChain:['p07','p06']})],
    delivery:'File destination', site:'st-qly', library:'lb-qly-0', folder:'fd-qly-0-2', sourceLink:'',
    checklist:[{id:'c1',text:'Indicator performance table'},{id:'c2',text:'Variance narrative'},
               {id:'c3',text:'Corrective action status'},
               {id:'c4',text:'Status of the actions carried from last month'}],
    processes:[PROCESSES[0],PROCESSES[1]], kpis:[KPIS[0],KPIS[1]],
    frequency:'Monthly', dayOfMonth:10,
    confidentiality:'Internal', status:'Active / Approved', version:2, updated:'2026-06-03'});

  /* 8 — published Report Template using a source link instead of a destination */
  mk({id:'su-8', kind:'Report Template',
    objective:'Consolidate business unit performance for the executive review cycle.',
    reportType:'Report', reportCategory:'Process Executive',
    stage:STAGES[2], regions:[], businessUnits:[],
    lines:[{id:'ln8a', department:'Quality', function:null},
           {id:'ln8b', department:'Operations', function:null}],
    units:[ur(GROUP_KEY,{id:'un-grp8', team:'tm-grp-e', channel:'ch-grp-e-2', submitter:'p09',
      owner:'p06', reviewChain:['p15','p16']})],
    delivery:'Source link', site:null, library:null, folder:null,
    sourceLink:'https://bi.andalusia.local/reports/executive-performance-pack',
    checklist:[{id:'c1',text:'Scorecard extract'},{id:'c2',text:'Commentary'}],
    processes:[PROCESSES[7]], kpis:[KPIS[9],KPIS[7]],
    frequency:'Monthly', dayOfMonth:7,
    confidentiality:'High Confidential', status:'Active / Approved', version:1, updated:'2026-05-19'});

  /* Usage — records stamped with the Setup version current at creation (FR-SET-19) */
  /* One Setup, many units — so an occurrence names the unit it was held in. */
  const usage=[
    {id:'u1', setup:'su-1', unit:'bu-ahj', record:'Operational Quality Committee — 18 Jun 2026',
     type:'Meeting Occurrence', created:'2026-06-18', setupVersion:2},
    {id:'u2', setup:'su-1', unit:'bu-adc', record:'Operational Quality Committee — 18 Jun 2026',
     type:'Meeting Occurrence', created:'2026-06-18', setupVersion:2},
    {id:'u3', setup:'su-1', unit:'bu-ahj', record:'Operational Quality Committee — 16 Jul 2026',
     type:'Meeting Occurrence', created:'2026-07-16', setupVersion:2},
    {id:'u4', setup:'su-1', unit:'bu-adc', record:'Operational Quality Committee — 16 Jul 2026',
     type:'Meeting Occurrence', created:'2026-07-16', setupVersion:2},
    {id:'u5', setup:'su-7', unit:'bu-ahj', record:'Monthly Quality Conclusion — Jul 2026',
     type:'Report Submission', created:'2026-07-28', setupVersion:2},
    {id:'u6', setup:'su-7', unit:'bu-ahm', record:'Monthly Quality Conclusion — Jul 2026',
     type:'Report Submission', created:'2026-07-28', setupVersion:2},
    {id:'u7', setup:'su-2', unit:'bu-ahj', record:'Team of Teams — Quality — 19 Jul 2026',
     type:'Meeting Occurrence', created:'2026-07-19', setupVersion:1},
    {id:'u8', setup:'su-3', unit:GROUP_KEY, record:'Group Performance Review — Q2 2026',
     type:'Meeting Occurrence', created:'2026-04-21', setupVersion:1},
    {id:'u9', setup:'su-5', unit:'rg-ksa', record:'Regional Infection Control Committee — 23 Jun 2026',
     type:'Meeting Occurrence', created:'2026-06-23', setupVersion:1},
    {id:'u10', setup:'su-5', unit:'rg-egy', record:'Regional Infection Control Committee — 23 Jun 2026',
     type:'Meeting Occurrence', created:'2026-06-23', setupVersion:1},
  ];

  const audit=[
    {id:'g1', setup:'su-1', at:'2026-01-12 09:20', actor:'Setup Administrator', action:'Published',
     field:'Lifecycle Status', before:'Draft', after:'Active / Approved · version 1'},
    {id:'g2', setup:'su-1', at:'2026-06-14 11:05', actor:'Setup Administrator', action:'Edited',
     field:'Quorum Threshold %', before:'60', after:'75'},
    {id:'g3', setup:'su-1', at:'2026-06-14 11:12', actor:'Setup Administrator', action:'Published',
     field:'Version', before:'1', after:'2'},
    {id:'g4', setup:'su-5', at:'2026-07-25 08:40', actor:'Setup Administrator', action:'Edit opened',
     field:'Lifecycle Status', before:'Active / Approved', after:'Under Review'},
    {id:'g5', setup:'su-6', at:'2026-03-30 16:00', actor:'Setup Administrator', action:'Expired',
     field:'Lifecycle Status', before:'Active / Approved', after:'Expired'},
    {id:'g6', setup:'su-7', at:'2026-06-03 10:15', actor:'Setup Administrator', action:'Published',
     field:'Version', before:'1', after:'2'},
  ];
  return {setups:S, usage, audit};
}

/* =========================================================================
   VALIDATION (FR-SET-17, G-07)
   Every rule returns {field, step, msg}. All unmet rules are shown together,
   never just the first, and each one focuses its field when clicked.
   ========================================================================= */
function scopeRules(s, stepNo){
  const r=[];
  const lv=stageLevel(s);
  if(lv==='bu' && !(s.businessUnits||[]).length)
    r.push({field:'f-businessUnits', step:stepNo,
      msg:'Select at least one Business Unit — a Stage 1 Setup runs once in each one selected.'});
  if(lv==='region' && !(s.regions||[]).length)
    r.push({field:'f-regions', step:stepNo,
      msg:'Select at least one Region — a Stage 2 Setup runs once in each one selected.'});
  /* Top Management and the Executive Committee sit above the departments */
  if(isExec(s)) return r;
  const raw=s.lines||[], ls=linesOf(s);
  if(!ls.length)
    r.push({field:'f-lines', step:stepNo,
      msg:'Add at least one Department. Leave its Function empty and the whole Department is covered.'});
  if(raw.length!==ls.length)
    r.push({field:'f-lines', step:stepNo, msg:'Every line needs a Department.'});
  const seen=[];
  ls.forEach(l=>{ if(seen.includes(l.department))
      r.push({field:'f-lines', step:stepNo,
        msg:`${l.department} is listed twice — one line per Department.`});
    seen.push(l.department); });
  /* a Team of Teams is the forum OF one Department, so it can never carry several */
  if(s.category===TOT && ls.length>1)
    r.push({field:'f-lines', step:stepNo,
      msg:'A Team of Teams belongs to exactly one Department — it monitors that Department’s service '+
          'strategy. Keep one line.'});
  return r;
}

/* The name is produced by the Setup, so it can only fail in two ways: there is not enough
   scope yet to produce one, or two Setups have produced the same one. */
function nameRules(s, stepNo){
  const r=[]; const all=(ALL_SETUPS.current||[]);
  const nm=derivedName(s);
  if(!nm) r.push({field:'f-name', step:stepNo,
    msg:'The name has nothing to build on yet — set the Classification, the Stage and at least one '+
        'Department and it writes itself.'});
  else if(all.some(x=>x.id!==s.id && derivedName(x).toLowerCase()===nm.toLowerCase()))
    r.push({field:'f-qualifier', step:stepNo,
      msg:`Another Setup already resolves to “${nm}”. Change something in its scope, or add a short `+
          `qualifier to tell the two apart.`});
  return r;
}
/* the register is the only place that knows every Setup; the rules read it from here */
const ALL_SETUPS={current:[]};

/* Per-unit rules — everything that differs from one Business Unit or Region to the next.
   Each message names its unit, and clicking it opens that unit's section. */
function unitRules(s, stepNo){
  const r=[];
  const lv=stageLevel(s);
  const keys=scopeKeys(s);
  keys.forEach(k=>{
    const u=unitOf(s,k), at=unitLabel(s,k), f='u-'+k;
    if(!u){ r.push({field:f, step:stepNo, msg:`${at}: nothing has been set up yet.`}); return; }
    // Picking a Team at all stays optional -- not every Setup is discussed in
    // one. But having picked a Team without a Channel is incomplete, since the
    // Channel is the part that actually carries a location.
    const uTeam=u.team||teamOfChannel(u.channel);
    if(uTeam && !u.channel)
      r.push({field:f, step:stepNo, msg:`${at}: choose the Channel inside ${uTeam}.`});
    if(s.kind==='Report Template'){
      if(!u.submitter) r.push({field:f, step:stepNo, msg:`${at}: the Position that submits is required.`});
      if(!u.owner)     r.push({field:f, step:stepNo, msg:`${at}: Owner Position is required.`});
      const chain=(u.reviewChain||[]).filter(Boolean);
      if(!chain.length) r.push({field:f, step:stepNo, msg:`${at}: at least one review step is required.`});
      if(u.submitter && chain.includes(u.submitter))
        r.push({field:f, step:stepNo, msg:`${at}: the Submitting Position cannot be part of the review chain.`});
    } else {
      if(!u.chairman)    r.push({field:f, step:stepNo, msg:`${at}: Chairman is required.`});
      if(!u.facilitator) r.push({field:f, step:stepNo, msg:`${at}: Organizer / Facilitator is required.`});
      if(!(u.coreMembers||[]).filter(m=>m.position).length)
        r.push({field:f, step:stepNo, msg:`${at}: at least one attendee is required.`});
    }
  });
  return r;
}
/* how many rules a single unit is failing — drives the tag on its section header */
const unitIssueCount=(s,key,issues)=>issues.filter(i=>i.field==='u-'+key).length;
function cadenceRules(s, stepNo){
  const r=[];
  if(!s.frequency){ r.push({field:'f-frequency', step:stepNo,
      msg:'Frequency is required — every Setup repeats on a cadence.'}); return r; }
  if(DOW_FREQ.includes(s.frequency) && !s.dayOfWeek)
    r.push({field:'f-dayOfWeek', step:stepNo, msg:`Day of week is required when Frequency is ${s.frequency}.`});
  if(DOM_FREQ.includes(s.frequency) && !s.dayOfMonth)
    r.push({field:'f-dayOfMonth', step:stepNo, msg:`Day of month is required when Frequency is ${s.frequency}.`});
  if(MIQ_FREQ.includes(s.frequency) && !s.monthInQuarter)
    r.push({field:'f-monthInQuarter', step:stepNo,
      msg:`Month within quarter is required when Frequency is ${s.frequency}.`});
  return r;
}

function validateMeeting(s){
  const r=[];
  /* 1 — type and identity */
  if(!s.setupType) r.push({field:'f-setupType', step:1, msg:'Setup Type is required.'});
  if(s.setupType==='Business Meeting' && !s.category)
    r.push({field:'f-category', step:1,
      msg:'Type / Classification is required when Setup Type is Business Meeting.'});
  /* the name is derived, so what can fail is that it does not resolve, or that it collides */
  r.push(...nameRules(s,1));
  /* 2 — scope */
  if(!s.stage) r.push({field:'f-stage', step:2, msg:'Stage is required.'});
  r.push(...scopeRules(s,2));
  /* 3 — cadence. Location and the meeting link are not held here — they are set on
     each occurrence, because one Setup runs in several units with a different venue in each. */
  r.push(...cadenceRules(s,3));
  if(!s.mode)      r.push({field:'f-mode', step:3, msg:'Default Meeting Mode is required.'});
  /* 4 — setup per unit */
  r.push(...unitRules(s,4));
  /* 5 — mandate and agenda */
  if(s.setupType==='Accreditation Committee' && (s.quorum===null||s.quorum===undefined||s.quorum===''))
    r.push({field:'f-quorum', step:5,
      msg:'Quorum Threshold % is required for an Accreditation Committee.'});
  if(s.setupType==='Accreditation Committee' && !(s.torLink||'').trim())
    r.push({field:'f-torLink', step:5, msg:'TOR / Policy link is required for an Accreditation Committee.'});
  const ag=s.agenda||[];
  if(!ag.filter(a=>(a.text||'').trim()).length)
    r.push({field:'f-agenda', step:5, msg:'At least one standing Agenda Item is required.'});
  if(ag.some(a=>(a.text||'').trim() && !a.owner))
    r.push({field:'f-agenda', step:5, msg:'Every standing Agenda Item needs an owner.'});
  /* 6 — review */
  if(!s.confidentiality) r.push({field:'f-confidentiality', step:6, msg:'Confidentiality is required.'});
  return r;
}

function validateReport(s, all){
  const r=[];
  /* 1 — identity */
  r.push(...nameRules(s,1));
  if(!(s.objective||'').trim()) r.push({field:'f-objective', step:1, msg:'Report Objective is required.'});
  if(!s.reportType)     r.push({field:'f-reportType', step:1, msg:'Report Type is required.'});
  if(!s.reportCategory) r.push({field:'f-reportCategory', step:1, msg:'Report Category is required.'});
  /* 2 — scope */
  if(!s.stage) r.push({field:'f-stage', step:2, msg:'Stage is required.'});
  r.push(...scopeRules(s,2));
  /* 3 — destination and content */
  if(!s.delivery) r.push({field:'f-delivery', step:3, msg:'Report Delivery is required.'});
  if(s.delivery==='File destination'){
    if(!s.site)    r.push({field:'f-site',    step:3, msg:'Site is required for a file destination.'});
    if(!s.library) r.push({field:'f-library', step:3, msg:'Library is required for a file destination.'});
    if(!s.folder)  r.push({field:'f-folder',  step:3, msg:'Folder is required for a file destination.'});
  }
  if(s.delivery==='Source link' && !(s.sourceLink||'').trim())
    r.push({field:'f-sourceLink', step:3, msg:'A source link is required.'});
  /* 4 — who submits and who reviews, unit by unit */
  r.push(...unitRules(s,4));
  /* 5 — cadence and review */
  r.push(...cadenceRules(s,5));
  if(!s.confidentiality) r.push({field:'f-confidentiality', step:5, msg:'Confidentiality is required.'});
  return r;
}

const validate=(s,all)=> s.kind==='Report Template' ? validateReport(s,all) : validateMeeting(s);

/* =========================================================================
   SHARED COMPONENTS
   ========================================================================= */
const Ctx=createContext(null); const use=()=>useContext(Ctx);
const Tag=({c='grey',children,style})=><span className={'tag '+c} style={style}>{children}</span>;

/* Overflow "..." menu for row actions that shouldn't crowd every row as
   separate buttons -- click opens a small dropdown, click-outside or Esc
   closes it. */
function RowMenu({items}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const onDoc=e=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc=e=>{ if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown',onDoc);
    document.addEventListener('keydown',onEsc);
    return ()=>{ document.removeEventListener('mousedown',onDoc); document.removeEventListener('keydown',onEsc); };
  },[open]);
  const visible=items.filter(Boolean);
  if(!visible.length) return null;
  return <div className="row-menu" ref={ref}>
    <button type="button" className="row-menu-btn" aria-label="More actions" aria-haspopup="true"
      aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
      <MoreHorizontal size={16}/></button>
    {open ? <div className="row-menu-list" role="menu">
      {visible.map((it,i)=>
        <button type="button" key={i} role="menuitem" className={'row-menu-item'+(it.danger?' danger':'')}
          onClick={()=>{setOpen(false); it.onClick();}}>{it.label}</button>)}
    </div> : null}
  </div>;
}
const Btn=({k='',children,...r})=><button type="button" className={'btn '+k} {...r}>{children}</button>;
const Note=({k='info',ic,children})=>
  <div className={'note '+k}>{ic?<span className="ic">{ic}</span>:null}<div>{children}</div></div>;
const Empty=({ic,children})=><div className="empty">{ic?<div className="ic">{ic}</div>:null}{children}</div>;
const Stat=({label,v,d,c})=>
  <div className="stat"><label>{label}</label>
    <div className="v" style={c?{color:'var(--'+c+')'}:null}>{v}</div>{d?<div className="d">{d}</div>:null}</div>;

const STATUS_C={'Draft':'grey','Active / Approved':'green','Under Review':'amber','Expired':'muted'};
const StatusPill=({s})=> s==='Expired'
  ? <span className="tag grey" style={{opacity:.55}}>Expired</span>
  : <Tag c={STATUS_C[s]||'grey'}>{s}</Tag>;

/* G-02 — a governed list is selected from, never edited */
const LockNote=()=><span className="tx-lock" title="Taxonomy-owned. Read-only in Leadership Practice.">
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  Taxonomy-owned</span>;

function Field({id,label,req,hint,children,when=true,govern}){
  if(when===false) return null;
  return <div className="f" id={id?id+'-wrap':undefined}>
    <label htmlFor={id}>{label}{req?<span className="req">*</span>:null}
      {govern?<LockNote/>:null}</label>
    {children}
    {hint?<div className="hint">{hint}</div>:null}
  </div>;
}

/* A Position in a summary table: the Position itself, and under it the
   employee currently holding it — the same pair the pickers show. */
const PosCell=({id})=> !id ? <>—</> : <>
  {posName(id)}
  {posHolder(id)?<div className="t-sub">{posHolder(id)}</div>:null}</>;

const Sel=({id,val,onChange,opts,placeholder='Select…',disabled})=>
  <select id={id} value={val||''} disabled={disabled}
    onChange={e=>onChange(e.target.value||null)}>
    <option value="">{placeholder}</option>
    {opts.map(o=>{const v=typeof o==='object'?o.v:o, l=typeof o==='object'?o.label:o;
      return <option key={v} value={v}>{l}</option>;})}
  </select>;

/* Position picker — reads the Organization Structure (cr603_organizationstructures
   via fetchPositions) and shows, under each Position, the employee who currently
   holds it, resolved from hr_employees. Same source and same treatment as the
   execution module's Ad Hoc form.

   Searchable because the Organization Structure runs to hundreds of assignments:
   the filter matches the Position name AND the holder's name, so typing a
   person finds their Position. `opts` is already narrowed to the unit's scope by
   the caller (positionsInScope). */
function PosSel({id,val,onChange,opts,placeholder='Select…',disabled}){
  const [q,setQ]=useState('');
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const onDoc=e=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc=e=>{ if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown',onDoc); document.addEventListener('keydown',onEsc);
    return ()=>{ document.removeEventListener('mousedown',onDoc); document.removeEventListener('keydown',onEsc); };
  },[open]);

  const sel=opts.find(o=>o.id===val);
  const needle=q.trim().toLowerCase();
  const shown=needle
    ? opts.filter(o=>(o.name||'').toLowerCase().includes(needle)
                  || (o.holder||'').toLowerCase().includes(needle))
    : opts;

  return <div className="pos-sel" ref={ref}>
    <button type="button" id={id} className="pos-sel-btn" disabled={disabled}
      onClick={()=>{ if(!disabled){ setOpen(o=>!o); setQ(''); } }}>
      {sel
        ? <span className="pos-sel-v"><b>{sel.name}</b>{sel.holder?<i>{sel.holder}</i>:null}</span>
        : <span className="pos-sel-ph">{placeholder}</span>}
      <span className="pos-sel-cv">▾</span>
    </button>
    {open && !disabled && <div className="combo-list pos-sel-list">
      <input autoFocus type="search" className="pos-sel-q" value={q}
        onChange={e=>setQ(e.target.value)}
        placeholder="Search a Position or the person holding it…"/>
      {shown.length===0
        ? <div className="combo-empty">
            {opts.length===0 ? 'No Position in this unit’s scope' : 'Nothing matches that search.'}</div>
        : <>
            {val ? <button type="button" className="combo-opt pos-sel-clear"
                     onClick={()=>{ onChange(null); setOpen(false); setQ(''); }}>Clear</button> : null}
            {shown.map(o=>
              <button type="button" key={o.id}
                className={'combo-opt pos-sel-opt'+(o.id===val?' on':'')}
                onClick={()=>{ onChange(o.id); setOpen(false); setQ(''); }}>
                <b>{o.name}</b>{o.holder?<i>{o.holder}</i>:null}
              </button>)}
          </>}
    </div>}
  </div>;
}

/* segmented control — used for Setup Type, Stage, Nature, Mode, Delivery */
const Seg=({id,opts,val,onChange,disabled})=>
  <div className="seg-ctl" id={id} role="group">
    {opts.map(o=>{const v=typeof o==='object'?o.v:o, l=typeof o==='object'?o.label:o;
      const locked=typeof o==='object'&&o.locked;
      const optDisabled=disabled||locked;
      return <button type="button" key={v} disabled={optDisabled}
        className={(val===v?'on':'')+(locked?' locked':'')} aria-pressed={val===v}
        title={locked&&o.lockedHint?o.lockedHint:undefined}
        onClick={()=>{ if(!optDisabled) onChange(v); }}>
        {l}{locked?<span className="seg-lock" aria-hidden="true">🔒</span>:null}</button>;})}
  </div>;

const Checks=({id,opts,val,onChange})=>
  <div className="chk-grid" id={id}>{opts.map(o=>
    <label className="chk" key={o}>
      <input type="checkbox" checked={(val||[]).includes(o)}
        onChange={()=>onChange((val||[]).includes(o)?val.filter(x=>x!==o):[...(val||[]),o])}/>
      <span>{o}</span></label>)}
  </div>;

/* Searchable multi-select: type to filter, click a result to add it, chosen
   items render as removable chips. Used for Related Processes/KPIs, which
   can run into long governed lists once Dataverse is fully populated. */
function ComboMulti({id,opts,val,onChange,placeholder}){
  const [q,setQ]=useState('');
  const [open,setOpen]=useState(false);
  const wrapRef=useRef(null);
  const selected=val||[];
  const filtered=opts.filter(o=>!selected.includes(o) && o.toLowerCase().includes(q.toLowerCase()));

  useEffect(()=>{
    const onDoc=e=>{ if(wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',onDoc);
    return ()=>document.removeEventListener('mousedown',onDoc);
  },[]);

  const add=o=>{ onChange([...selected,o]); setQ(''); };
  const remove=o=>onChange(selected.filter(x=>x!==o));

  return <div className="combo-multi" ref={wrapRef} id={id}>
    <div className="combo-chips" onClick={()=>setOpen(true)}>
      {selected.map(o=><span className="combo-chip" key={o}>{o}
        <button type="button" aria-label={`Remove ${o}`}
          onClick={e=>{e.stopPropagation();remove(o);}}>×</button></span>)}
      <input type="text" value={q} placeholder={selected.length?'Add more…':(placeholder||'Search…')}
        onFocus={()=>setOpen(true)}
        onChange={e=>{setQ(e.target.value); setOpen(true);}}
        onKeyDown={e=>{
          if(e.key==='Backspace' && !q && selected.length) remove(selected[selected.length-1]);
          else if(e.key==='Enter' && filtered.length){ e.preventDefault(); add(filtered[0]); }
          else if(e.key==='Escape') setOpen(false);
        }}/>
    </div>
    {open ? <div className="combo-list" role="listbox">
      {filtered.length
        ? filtered.map(o=><button type="button" key={o} className="combo-opt" role="option"
            onClick={()=>add(o)}>{o}</button>)
        : <div className="combo-empty">{q?'No matches':'All options selected'}</div>}
    </div> : null}
  </div>;
}

/* ---- stepper (matches the Leadership Execution wizard's visual style) --- */
function Stepper({steps,current,onGo,invalidSteps}){
  const idx=current-1;
  return <div className="wiz-steps gov-wiz-steps">
    {steps.map((s,i)=>{
      const n=i+1, bad=invalidSteps.has(n);
      return <React.Fragment key={s.label}>
        {i>0 && <div className="wiz-line"/>}
        <div className={'wiz-step gov-wiz-step'+(bad?' bad':'')} style={{cursor:'pointer'}}
          role="tab" aria-selected={current===n} onClick={()=>onGo(n)}>
          <div className={'wiz-num '+(i<idx?'done':i===idx?'now':'')}>
            {i<idx&&!bad?<Check size={13} strokeWidth={3}/>:n}
            {bad?<span className="gov-step-dot" aria-label="has unmet rules"/>:null}
          </div>
          <div className="t"><b>{s.label}</b><span>{s.hint}</span></div>
        </div>
      </React.Fragment>;})}
  </div>;
}

/* ---- live validation panel (G-07) --------------------------------------- */
function ValidationPanel({issues,onGo}){
  const focus=iss=>{
    onGo(iss.step);
    /* a per-unit rule points at a section that may be collapsed — ask it to open */
    window.dispatchEvent(new CustomEvent('pulse-focus',{detail:iss}));
    setTimeout(()=>{
      const el=document.getElementById(iss.field)||document.getElementById(iss.field+'-wrap');
      if(!el) return;
      el.scrollIntoView({block:'center'});
      const t=el.matches('input,select,textarea')?el:el.querySelector('input,select,textarea,button');
      if(t&&t.focus) t.focus();
      const wrap=document.getElementById(iss.field+'-wrap')||el;
      wrap.classList.add('flash'); setTimeout(()=>wrap.classList.remove('flash'),1200);
    },60);
  };
  return <aside className="vpanel">
    <div className="vpanel-hd">
      <h3>Before publishing</h3>
      {issues.length===0
        ? <Tag c="green">All rules met</Tag>
        : <Tag c="amber">{issues.length} unmet</Tag>}
    </div>
    {issues.length===0
      ? <div className="vpanel-ok">Every rule is satisfied. Publishing will set this Setup to
          Active / Approved.</div>
      : <ul className="vlist">{issues.map((iss,i)=>
          <li key={i}><button type="button" onClick={()=>focus(iss)}>
            <span className="vstep">Step {iss.step}</span>{iss.msg}</button></li>)}
        </ul>}
  </aside>;
}

/* ---- repeatable row editor ---------------------------------------------- */
function RowEditor({id,rows,onChange,render,onAdd,addLabel,empty,reorder}){
  const move=(i,d)=>{const n=[...rows], j=i+d; if(j<0||j>=n.length) return;
    const t=n[i]; n[i]=n[j]; n[j]=t; onChange(n);};
  return <div className="rows" id={id}>
    {rows.length===0
      ? <div className="rows-empty">{empty}</div>
      : rows.map((r,i)=>
        <div className="row-item" key={r.id||i}>
          <span className="row-n">{i+1}</span>
          <div className="row-body">{render(r,i)}</div>
          {reorder?<div className="row-move">
            <Btn k="sm" aria-label="Move up" disabled={i===0} onClick={()=>move(i,-1)}>↑</Btn>
            <Btn k="sm" aria-label="Move down" disabled={i===rows.length-1} onClick={()=>move(i,1)}>↓</Btn>
          </div>:null}
          <Btn k="sm" aria-label="Remove" onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>Remove</Btn>
        </div>)}
    <Btn k="sm" onClick={onAdd}>+ {addLabel}</Btn>
  </div>;
}

/* ---- the name needs no field ---------------------------------------------
   It is produced by the Setup and shown in the page header and the register, so
   there is nothing to fill in. The only time it needs the screen is when two
   Setups resolve to the same name and one of them has to be told apart. */
function DerivedName({s,set}){
  const {db}=use();
  const nm=derivedName(s);
  const clash=!!nm && db.setups.some(x=>x.id!==s.id &&
    derivedName(x).toLowerCase()===nm.toLowerCase());
  if(!clash && !s.qualifier) return null;
  return <Field id="f-qualifier" label="Qualifier"
    hint={clash
      ? null
      : 'Clear it and the name goes back to what the Setup produces on its own.'}>
    {clash
      ? <Note k="warn" ic="⚠">Another Setup already resolves to <b>{nm}</b>. Either change its scope —
          a different Department or Function makes it distinct — or add a short qualifier here.</Note>
      : null}
    <input id="f-qualifier" type="text" value={s.qualifier||''}
      onChange={e=>set({qualifier:e.target.value})} placeholder="e.g. Inpatient"/>
  </Field>;
}

/* ---- a multi-select the scope multiplies over --------------------------- */
const Pick=({on,label,sub,onToggle})=>
  <button type="button" className={'pick'+(on?' on':'')} aria-pressed={on} onClick={onToggle}>
    <span className="bx">{on?'✓':''}</span>
    <span>{label}{sub?<span className="sm"> · {sub}</span>:null}</span>
  </button>;

function MultiPick({id,groups,val,onChange}){
  const v=val||[];
  const toggle=x=>onChange(v.includes(x)?v.filter(y=>y!==x):v.concat([x]));
  const setMany=(ids,on)=>onChange(on ? Array.from(new Set(v.concat(ids))) : v.filter(x=>!ids.includes(x)));
  return <div id={id}>
    {groups.map(g=>{
      const ids=g.items.map(i=>i.id), all=ids.every(i=>v.includes(i));
      return <div className="mgrp" key={g.title||'_'}>
        {g.title
          ? <div className="mgrp-h"><span>{g.title}</span>
              <button type="button" className="all" onClick={()=>setMany(ids,!all)}>
                {all?'clear these':'select all'}</button></div>
          : null}
        <div className="pill-set">
          {g.items.map(i=><Pick key={i.id} on={v.includes(i.id)} label={i.name} sub={i.sub}
            onToggle={()=>toggle(i.id)}/>)}
        </div>
      </div>;})}
  </div>;
}

/* ---- organisational scope (FR-SET-05, now multi-unit) ------------------- */
function ScopeFields({s,set,stepNo}){
  const lv=stageLevel(s);
  const regions=REGIONS;
  const keys=scopeKeys(s);
  const tot=s.category===TOT;
  const exec=isExec(s);
  /* every scope change re-syncs the per-unit rows so nothing is orphaned */
  const apply=patch=>{const ns={...s,...patch}; set({...patch, units:syncUnits(ns)});};

  const buGroups=regions.map(r=>({title:r.name,
    items:BUSINESS_UNITS.filter(b=>b.region===r.id).map(b=>({id:b.id,name:b.name}))}))
    .filter(g=>g.items.length);
  const rgGroups=[{title:null, items:regions.map(r=>({id:r.id,name:r.name,sub:r.tz.replace(/^\(|\)$/g,'')}))}];

  return <>
    {lv==='bu'
      ? <Field id="f-businessUnits" label="Business Units" req govern
          hint="Tick every Business Unit this Setup runs in. It is authored once here, and a section is
                created for each one on the next step.">
          <MultiPick id="f-businessUnits" groups={buGroups} val={s.businessUnits}
            onChange={v=>{
              const rs=Array.from(new Set(v.map(b=>{const x=byId(BUSINESS_UNITS,b);return x?x.region:null;})
                        .filter(Boolean)));
              apply({businessUnits:v, regions:rs});}}/>
        </Field>
      : null}

    {lv==='region'
      ? <Field id="f-regions" label="Regions" req govern
          hint="A Stage 2 Setup multiplies by Region — tick Saudi Arabia and Egypt and it runs once in each,
                with its own Chairman and Organizer per region.">
          <MultiPick id="f-regions" groups={rgGroups} val={s.regions}
            onChange={v=>apply({regions:v, businessUnits:[]})}/>
        </Field>
      : null}

    {lv==='group'
      ? <Note k="info" ic="i">A Stage 3 or Stage 4 Setup covers the whole group. It does not multiply —
          there is one section, held once for the group.</Note>
      : null}
    {!s.stage ? <Note k="warn" ic="⚠">Choose the Stage first. Stage decides what this Setup multiplies
        by — Business Unit at Stage 1, Region at Stage 2, nothing at Stage 3 and 4.</Note> : null}

    {exec
      ? <Note k="info" ic="i"><b>No Department at Stage 4.</b> Top Management and the Executive Committee
          sit above the department structure, so nothing is chosen here — the Setup covers the group.</Note>
      : <Field id="f-lines" label={tot?'Department':'Departments and Functions'} req govern
          hint={tot
            ? 'A Team of Teams belongs to one Department. Leave the Function empty and it covers the '+
              'whole Department.'
            : 'Choose a Department, then a Function inside it. Leave the Function empty and the whole '+
              'Department is on this committee. Add a line for every Department it covers.'}>
          <RowEditor id="f-lines" rows={s.lines||[]} onChange={v=>set({lines:v})}
            addLabel={tot?'Set the Department':'Add a Department'}
            empty="No Department yet."
            onAdd={tot && (s.lines||[]).length>=1
              ? undefined
              : ()=>set({lines:(s.lines||[]).concat([{id:uid('ln'),department:null,function:null}])})}
            render={(r,i)=>{
              const taken=(s.lines||[]).filter((_,j)=>j!==i).map(x=>x.department).filter(Boolean);
              const fns=r.department?functionsIn(r.department):[];
              return <div className="f-row">
                <Field id={'f-line-dep-'+i} label="Department" req>
                  <Sel id={'f-line-dep-'+i} val={r.department}
                    opts={departmentNames().filter(d=>!taken.includes(d)).map(d=>({v:d,label:d}))}
                    onChange={v=>set({lines:s.lines.map((x,j)=>j===i?{...x,department:v,function:null}:x)})}/>
                </Field>
                <Field id={'f-line-fn-'+i} label="Function"
                  hint={r.department && !r.function
                    ? `No Function chosen — the whole ${r.department} department is covered.`
                    : null}>
                  <Sel id={'f-line-fn-'+i} val={r.function} disabled={!r.department}
                    placeholder={!r.department?'Choose a Department first'
                      :'All Functions — the whole department'}
                    opts={fns.map(f=>({v:f,label:f}))}
                    onChange={v=>set({lines:s.lines.map((x,j)=>j===i?{...x,function:v}:x)})}/>
                </Field>
              </div>;}}/>
          {tot?<Note k="teal" ic="◆">{TOT_NOTE}</Note>:null}
        </Field>}

    <div className="scope-out"><span>Resolved scope</span><b>{scopeString(s)}</b></div>
    {keys.length
      ? <div className="mcount">This Setup creates <b>{keys.length} section{keys.length===1?'':'s'}</b> on
          the next step{lv!=='group'?<> — {scopeNames(s).join(', ')}</>:null}. Everything captured before
          this point is shared by all of them.</div>
      : null}
  </>;
}

/* ---- cadence block, shared by both wizards (FR-SET-06) ------------------ */
function CadenceFields({s,set}){
  return <>
    <Field id="f-frequency" label="Frequency" req govern>
      <Sel id="f-frequency" val={s.frequency} opts={FREQUENCIES}
        onChange={v=>set({frequency:v,dayOfWeek:null,dayOfMonth:null,monthInQuarter:null})}/></Field>
    <div className="f-row3">
      <Field id="f-dayOfWeek" label="Day of week" req when={DOW_FREQ.includes(s.frequency)} govern>
        <Sel id="f-dayOfWeek" val={s.dayOfWeek} opts={DAYS_OF_WEEK}
          onChange={v=>set({dayOfWeek:v})}/></Field>
      <Field id="f-dayOfMonth" label="Day of month" req when={DOM_FREQ.includes(s.frequency)}
        hint="1 to 30.">
        <input id="f-dayOfMonth" type="number" min="1" max="30" value={s.dayOfMonth??''}
          onChange={e=>set({dayOfMonth:e.target.value===''?null:+e.target.value})}/></Field>
      <Field id="f-monthInQuarter" label="Month within quarter" req
        when={MIQ_FREQ.includes(s.frequency)} govern>
        <Sel id="f-monthInQuarter" val={s.monthInQuarter} opts={MONTHS_IN_QUARTER}
          onChange={v=>set({monthInQuarter:v})}/></Field>
    </div>
  </>;
}

/* =========================================================================
   SETUP PER UNIT — one section per Business Unit, per Region, or one for the group.
   Everything on this page is the part that differs from place to place: the
   Department it sits in, who chairs it, who organises it, who attends, who submits.
   ========================================================================= */
function UnitSetup({s,set,issues,shared,intro}){
  const {toast}=use();
  const report=s.kind==='Report Template';
  const lv=stageLevel(s);
  const keys=scopeKeys(s);
  const [shut,setShut]=useState(()=>new Set());
  const [src,setSrc]=useState(null);

  /* clicking an unmet rule in the side panel opens the section it belongs to */
  useEffect(()=>{const h=e=>{const f=(e.detail&&e.detail.field)||'';
      if(f.indexOf('u-')===0) setShut(p=>{const n=new Set(p); n.delete(f.slice(2)); return n;});};
    window.addEventListener('pulse-focus',h);
    return ()=>window.removeEventListener('pulse-focus',h);},[]);

  const units=s.units||[];
  const setUnit=(key,patch)=>set({units:units.map(u=>u.key===key?{...u,...patch}:u)});
  const copyToAll=key=>{
    const from=unitOf(s,key); if(!from) return;
    set({units:units.map(u=>u.key===key?u:{...u,...copyUnitBody(s.kind,from)})});
    const n=keys.length-1;
    toast('Copied to every section',
      `${unitLabel(s,key)} — ${report?'submitter, owner and review chain':'roles and attendees'} `+
      `applied to the other ${n} section${n===1?'':'s'}. Each unit keeps its own Section, Team and `+
      `Channel.`,'ok');};

  if(!keys.length) return <>
    {intro}
    <div className="card"><Empty ic="⊘">
      No unit has been selected yet. Go back to <b>Organisational scope</b> and choose the
      {lv==='region'?' Regions':' Business Units'} this Setup runs in — a section appears here for each one.
    </Empty></div></>;

  return <>
    {intro}
    {shared}
    {keys.length>1
      ? <div className="unit-bar">
          <label htmlFor="u-copy">Set one up, then reuse it</label>
          <select id="u-copy" value={src||''} onChange={e=>setSrc(e.target.value||null)}>
            <option value="">Copy from…</option>
            {keys.map(k=><option key={k} value={k}>{unitLabel(s,k)}</option>)}
          </select>
          <Btn k="sm" disabled={!src} onClick={()=>copyToAll(src)}>
            Apply to the other {keys.length-1} section{keys.length-1===1?'':'s'}</Btn>
          <div style={{flex:1}}/>
          <Btn k="sm" onClick={()=>setShut(new Set(shut.size?[]:keys))}>
            {shut.size?'Expand all':'Collapse all'}</Btn>
        </div>
      : null}

    {keys.map((k,i)=>{
      const u=unitOf(s,k)||blankUnit(s.kind,k);
      const bad=unitIssueCount(s,k,issues);
      const closed=shut.has(k);
      const bu=buOf(s,k);
      const secs=sectionsFor(bu);
      const teams=teamsIn();
      /* A record read back from Dataverse stores only the Channel lookup, so
         its Team is recovered from that Channel. Deriving it here rather than
         trusting the stored value means a template opened before the Channels
         list finished loading still resolves its Team once it arrives. */
      const uTeam=u.team||teamOfChannel(u.channel);
      return <div className={'unit-card'+(bad?' bad':'')+(closed?' shut':'')} key={k} id={'u-'+k}>
        <button type="button" className="unit-hd"
          onClick={()=>setShut(p=>{const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n;})}>
          <span className="unit-ix">{i+1}</span>
          <span className="unit-nm">
            <span className="n">{unitLabel(s,k)}</span>
            <span className="m">{[LEVEL_WORD[lv], unitSub(s,k),
              u.section?nameOf(SECTIONS,u.section):null].filter(Boolean).join(' · ')}</span>
          </span>
          {bad?<Tag c="amber">{bad} unmet</Tag>:<Tag c="green">complete</Tag>}
          <span className="unit-cv">▾</span>
        </button>
        {closed?null:<>
          <div className="unit-bd">
            <Field id={'u-sec-'+k} label="Section / Specialty" govern when={lv==='bu' && secs.length>0}
              hint="Optional. Offered only where a chosen Department has Sections inside this unit.">
              <Sel id={'u-sec-'+k} val={u.section} placeholder="None — the whole Department"
                opts={secs.map(x=>({v:x.id,label:`${x.name} · ${nameOf(DEPARTMENTS,x.dept)}`}))}
                onChange={v=>setUnit(k,{section:v})}/></Field>

            <div className="f-row">
              <Field id={'u-team-'+k} label="Team" govern
                hint="The Team this unit discusses it in. Every Team is offered — the Teams table carries no Business Unit or Region, so it can't be narrowed to this unit.">
                <Sel id={'u-team-'+k} val={uTeam} opts={teams.map(t=>({v:t.id,label:t.name}))}
                  placeholder={teams.length?'Select…':'No Teams found'}
                  onChange={v=>setUnit(k,{team:v,channel:null})}/></Field>
              <Field id={'u-chan-'+k} label="Channel" req={!!uTeam} govern
                hint={uTeam
                  ? (report
                      ? 'Narrowed to the Channels inside that Team. Choosing one fills in the Source link from its SharePoint path.'
                      : 'Narrowed to the Channels inside that Team.')
                  : null}>
                <Sel id={'u-chan-'+k} val={u.channel} disabled={!uTeam}
                  placeholder={uTeam?'Select…':'Choose a Team first'}
                  opts={channelsIn(uTeam).map(c=>({v:c.id,label:c.name}))}
                  onChange={v=>{
                    setUnit(k,{channel:v});
                    /* A Report's Source link is one template-level field while
                       Channels are per-unit, so the first Channel that resolves
                       to a path fills it in. Only ever overwrites a link this
                       same auto-fill wrote (or an empty one) -- anything typed
                       by hand is left alone, see f-sourceLink below. */
                    if(report && v){
                      const path=channelPath(v);
                      if(path && (!(s.sourceLink||'').trim() || s.sourceLinkAuto))
                        set({sourceLink:path, sourceLinkAuto:true});
                    }
                  }}/>
                {report && u.channel && channelPath(u.channel)
                  ? <div className="holder">SharePoint path: {channelPath(u.channel)}</div>
                  : null}
              </Field>
            </div>

            {report
              ? <>
                  <div className="f-row">
                    <Field id={'u-sub-'+k} label="Submitting Position" req govern
                      hint="Who prepares and submits this report in this unit.">
                      <PosSel id={'u-sub-'+k} val={u.submitter} opts={positionsInScope(s,k)}
                        onChange={v=>setUnit(k,{submitter:v})}/>
                    </Field>
                    <Field id={'u-own-'+k} label="Owner Position" req govern
                      hint="Accountable for the content.">
                      <PosSel id={'u-own-'+k} val={u.owner} opts={positionsInScope(s,k)}
                        onChange={v=>setUnit(k,{owner:v})}/>
                    </Field>
                  </div>
                  <UnitChain u={u} k={k} s={s} setUnit={setUnit}/>
                </>
              : <>
                  <div className="f-row3">
                    {[['Chairman','chairman',true],['Co-Chairman','coChairman',false],
                      ['Organizer / Facilitator','facilitator',true]].map(([label,key,req])=>
                      <Field key={key} id={'u-'+key+'-'+k} label={label} req={req} govern>
                        <PosSel id={'u-'+key+'-'+k} val={u[key]} placeholder={req?'Select…':'None'}
                          opts={positionsInScope(s,k)}
                          onChange={v=>setUnit(k,{[key]:v})}/>
                      </Field>)}
                  </div>
                  <Field id={'u-cm-'+k} label="Attendees" req
                    hint="Core attendees count towards the quorum. Supportive attendees do not.">
                    <RowEditor id={'u-cm-'+k} rows={u.coreMembers||[]}
                      onChange={v=>setUnit(k,{coreMembers:v})}
                      addLabel="Add attendee" empty="No attendee recorded for this unit yet."
                      onAdd={()=>setUnit(k,{coreMembers:(u.coreMembers||[])
                        .concat([{id:uid('cm'),position:null,type:'Core'}])})}
                      render={(r,i2)=><div className="f-row">
                        <PosSel val={r.position} placeholder="Position…"
                          opts={positionsInScope(s,k)}
                          onChange={v=>setUnit(k,{coreMembers:u.coreMembers
                            .map((x,j)=>j===i2?{...x,position:v}:x)})}/>
                        <Sel val={r.type} opts={ATTENDEE_TYPES}
                          onChange={v=>setUnit(k,{coreMembers:u.coreMembers
                            .map((x,j)=>j===i2?{...x,type:v}:x)})}/>
                      </div>}/>
                  </Field>
                </>}
          </div>
          <div className="unit-ft">
            <span style={{fontSize:11.5,color:'var(--muted)'}}>
              Venue, room and joining link are set on each occurrence, not here.</span>
            <div className="sp"/>
            {keys.length>1
              ? <Btn k="sm" onClick={()=>copyToAll(k)}>Copy these to the other sections</Btn>
              : null}
          </div>
        </>}
      </div>;})}
  </>;
}

/* per-unit review chain — the Submitting Position cannot review its own submission,
   but the Owner Position (accountable for the content) may sit in the chain. */
function UnitChain({u,k,s,setUnit}){
  const [rejected,setRejected]=useState(false);
  const chain=u.reviewChain||[];
  const clash=chain.includes(u.submitter) && !!u.submitter;
  return <Field id={'u-chain-'+k} label="Review Chain" req hint="Ordered. The last step approves.">
    <RowEditor id={'u-chain-'+k} rows={chain.map((p,i)=>({id:k+'-rc'+i,pos:p}))} reorder
      onChange={v=>setUnit(k,{reviewChain:v.map(x=>x.pos)})}
      addLabel="Add review step" empty="No review step for this unit yet."
      onAdd={()=>{setRejected(false);setUnit(k,{reviewChain:chain.concat([null])});}}
      render={(r,i)=><div className="chain-row">
        <PosSel val={r.pos} placeholder="Position…"
          opts={positionsInScope(s,k).filter(p=>!chain.includes(p.id)||p.id===r.pos)}
          onChange={v=>{ if(v && v===u.submitter){setRejected(true);return;} setRejected(false);
            setUnit(k,{reviewChain:chain.map((x,j)=>j===i?v:x)});}}/>
        {i===chain.length-1?<Tag c="green">approves</Tag>:<Tag c="teal">reviews</Tag>}
        {r.pos===u.submitter?<Tag c="red">self-review</Tag>:null}
      </div>}/>
    {rejected||clash
      ? <div className="err" role="alert">The Submitting Position cannot be part of the review chain.</div>
      : null}
  </Field>;
}

/* ---- read-only summary rows --------------------------------------------- */
const SumRow=({k,v})=><div className="sum-row"><span>{k}</span><b>{v||'—'}</b></div>;
function SumBlock({title,items}){
  /* an item is [label, value]; a suppressed row arrives as [false, …] and must not render */
  const rows=items.filter(it=>Array.isArray(it)&&it[0]);
  return <div className="sum-block"><h4>{title}</h4>
    {rows.map(([k,v],i)=><SumRow key={i} k={k} v={v}/>)}</div>;
}

/* =========================================================================
   WIZARD SHELL — stepper + live validation panel + save / publish
   ========================================================================= */
function Wizard({rec,steps,renderStep,onClose}){
  const {A,role,db}=use();
  const [s,setS]=useState(rec);
  const [step,setStep]=useState(1);
  const [confirmPublish,setConfirmPublish]=useState(false);
  const set=patch=>setS(x=>({...x,...patch}));
  const issues=useMemo(()=>validate(s,db.setups),[s,db.setups]);
  const invalidSteps=useMemo(()=>new Set(issues.map(i=>i.step)),[issues]);
  const canWrite=ROLES[role].write;
  const published=s.version>0;
  const isLast=step===steps.length;

  return <>
    <div className="crumb"><a onClick={onClose}>Setup Register</a> › <b>{derivedName(s)||'New Setup'}</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}>
        <h1>{derivedName(s)||(s.kind==='Report Template'?'New Report Template Setup':'New Committee / Meeting Setup')}</h1>
        <div className="sub">{s.kind}{published?` · version ${s.version}`:''} ·
          <StatusPill s={s.status}/></div>
      </div>
      <Btn onClick={onClose}>Close</Btn>
    </div>

    <Stepper steps={steps} current={step} onGo={setStep} invalidSteps={invalidSteps}/>

    <div className="wiz">
      <div className="wiz-main">
        {renderStep(step,s,set,issues)}
        <div className="wiz-nav">
          <Btn disabled={step===1} onClick={()=>setStep(step-1)}>← Back</Btn>
          <Btn disabled={isLast} onClick={()=>setStep(step+1)}>Next →</Btn>
          <div style={{flex:1}}/>
          {canWrite?<Btn onClick={()=>{A.saveDraft(s);onClose();}}>Save draft</Btn>:null}
          {canWrite?<Btn k="pri" disabled={issues.length>0} onClick={()=>setConfirmPublish(true)}>
            {published?'Publish new version':'Publish'}</Btn>:null}
        </div>
      </div>
      <ValidationPanel issues={issues} onGo={setStep}/>
    </div>

    {confirmPublish?<PublishConfirmModal original={rec} edited={s}
      onCancel={()=>setConfirmPublish(false)}
      onConfirm={()=>{setConfirmPublish(false);A.publish(s);onClose();}}/>:null}
  </>;
}

/* =========================================================================
   S2 — COMMITTEE / MEETING SETUP WIZARD
   ========================================================================= */
const MEETING_STEPS=[
  {label:'Type and identity',        hint:'Kind, setup type, category'},
  {label:'Organisational scope',     hint:'Regions, business units'},
  {label:'Cadence',                  hint:'Frequency and rhythm'},
  {label:'Setup per unit',           hint:'Members and chairs'},
  {label:'Mandate and agenda',       hint:'Purpose and topics'},
  {label:'Linked Templates and review', hint:'Reports and sign-off'},
];

function MeetingWizard({rec,onClose}){
  const {db,dvReports}=use();
  return <Wizard rec={rec} steps={MEETING_STEPS} onClose={onClose}
    renderStep={(step,s,set,issues)=>{
      const locked=s.version>0;                       /* G-05 */
      const accred=s.setupType==='Accreditation Committee';
      const tot=s.category===TOT;

      if(step===1){
        return <div className="card">
          <h2>Type and identity</h2>
          <div className="csub">Setup Type decides everything downstream. It locks once published.</div>
          <Note k="lock" ic="—">Every Setup here repeats on a cadence. A one-off meeting is raised by the
            organiser on the meeting screen when it is needed — it is not set up in advance and does not
            appear in this register.</Note>
          <Field id="f-setupType" label="Setup Type" req
            hint={accred?'An Accreditation Committee is governance-scored, and needs a TOR link and a quorum threshold.'
                        :'A Business Meeting covers everything else, including the Team of Teams.'}>
            <Seg id="f-setupType" opts={SETUP_TYPES} val={s.setupType} disabled={locked}
              onChange={v=>set({setupType:v, category:v==='Accreditation Committee'?null:s.category})}/>
            {locked?<div className="hint"><LockNote/> Locked after first publish.</div>:null}
          </Field>
          <Field id="f-category" label="Type / Classification" req when={!accred} govern
            hint={tot?null:'It becomes the last words of the name.'}>
            <Sel id="f-category" val={s.category} opts={CATEGORIES} disabled={locked}
              onChange={v=>set({category:v,
                /* a Team of Teams carries one Department — keep the first line if several were added */
                ...(v===TOT?{lines:(s.lines||[]).slice(0,1)}:{})})}/>
            {tot?<Note k="teal" ic="◆">{TOT_NOTE}</Note>:null}
          </Field>
          <DerivedName s={s} set={set}/>
          {locked?<Note k="lock" ic="—">Setup Type is locked. Everything else may be changed, and
            publishing will create version {s.version+1}.</Note>:null}
        </div>;
      }

      if(step===2) return <div className="card">
        <h2>Organisational scope</h2>
        <div className="csub">Stage decides what this Setup multiplies by — Business Unit at Stage 1,
          Region at Stage 2, nothing at Stage 3 and 4.</div>
        <Field id="f-stage" label="Stage" req
          hint="Changing the Stage changes the multiplier, so the units chosen below start again.">
          <Seg id="f-stage" opts={STAGES.map(x=>({v:x,label:x.replace(/^Stage (\d) /,'$1 · ')}))}
            val={s.stage}
            onChange={v=>{const ns={...s,stage:v,regions:[],businessUnits:[],units:[]};
              set({stage:v, regions:[], businessUnits:[],
                   ...(v===STAGES[3]?{lines:[]}:{}), units:syncUnits(ns)});}}/></Field>
        <ScopeFields s={s} set={set} stepNo={2}/>
      </div>;

      if(step===3) return <div className="card">
        <h2>Cadence</h2>
        <div className="csub">Which day it falls on — nothing more. The same rhythm applies in every unit.</div>
        <CadenceFields s={s} set={set}/>
        <Field id="f-mode" label="Default Meeting Mode" req
          hint="A default only. Each occurrence may be held differently.">
          <Seg id="f-mode" opts={MODES} val={s.mode} onChange={v=>set({mode:v})}/></Field>
        <Note k="info" ic="i"><b>No clock time, no venue here.</b> The Setup fixes the rhythm — the day of
          the week or the day of the month. The start time, the duration, the room and the joining link
          belong to the occurrence: one Setup runs in {scopeKeys(s).length>1
            ? <>{scopeKeys(s).length} units</> : 'more than one unit'} across two time zones, each of which
          meets at its own hour and in its own room. The organiser fills those in when the invitation goes
          out.</Note>
      </div>;

      if(step===4) return <UnitSetup s={s} set={set} issues={issues}
        intro={<div className="ph" style={{marginBottom:14}}>
          <h1 style={{fontSize:16}}>Setup per unit</h1>
          <div className="sub">Everything up to here is shared. This page holds only what changes from one
            place to the next — where it is discussed, who chairs it, who organises it, and who attends.
            Set one section up and copy it across the rest.</div>
        </div>}
/>;

      if(step===5) return <div className="card">
        <h2>Mandate and agenda</h2>
        <div className="csub">The standing agenda, the quorum and the supporting functions are the same
          wherever this Setup runs.</div>
        <Field id="f-quorum" label="Quorum Threshold %" req={accred}
          hint="A percentage of the Core attendees in that unit, not a headcount.">
          <div className="unit-in">
            <input id="f-quorum" type="number" min="0" max="100" value={s.quorum??''}
              onChange={e=>set({quorum:e.target.value===''?null:+e.target.value})}/>
            <span>%</span></div></Field>
        <Field id="f-supportive" label="Supportive Function Representation" govern>
          <ComboMulti id="f-supportive" opts={functionNames()} val={s.supportive}
            placeholder="Search functions…" onChange={v=>set({supportive:v})}/></Field>
        <Field id="f-torLink" label="TOR / Policy link" req={accred}
          hint={accred?'Required for an Accreditation Committee. A link only.'
                      :'Optional for a Business Meeting. A link only.'}>
          <input id="f-torLink" type="text" value={s.torLink||''}
            onChange={e=>set({torLink:e.target.value})}
            placeholder="https://taxonomy.andalusia.local/tor/…"/></Field>
        <Field id="f-agenda" label="Standing Agenda Items" req
          hint="Owner is picked from the Chairman, Co-Chairman, Facilitator and Attendees named on this Setup's units.">
          <RowEditor id="f-agenda" rows={s.agenda||[]} onChange={v=>set({agenda:v})} reorder
            addLabel="Add agenda item" empty="No standing agenda items yet."
            onAdd={()=>set({agenda:[...(s.agenda||[]),
              {id:uid('ag'),text:'',owner:null,source:'Migrated - Initial'}]})}
            render={(r,i)=><div className="f-row3">
              <input type="text" value={r.text} placeholder="Item"
                onChange={e=>set({agenda:s.agenda.map((x,j)=>j===i?{...x,text:e.target.value}:x)})}/>
              <PosSel val={r.owner} placeholder="Owner…" opts={agendaOwnerOptions(s)}
                onChange={v=>set({agenda:s.agenda.map((x,j)=>j===i?{...x,owner:v}:x)})}/>
              <span className="agenda-src" title="Set automatically; not editable">
                <Tag c={r.source==='Added'?'teal':'grey'}>{r.source}</Tag></span>
            </div>}/>
        </Field>

      </div>;

      /* step 6 */
      const templates=dvReports||[];
      return <>
        <div className="card">
          <h2>Linked Report Templates</h2>
          <div className="csub">The Template is referenced. Its file is never copied.</div>
          <RowEditor id="f-linkedTemplates" rows={s.linkedTemplates||[]}
            onChange={v=>set({linkedTemplates:v})} addLabel="Link a Template"
            empty="No Templates linked. This is optional."
            onAdd={()=>set({linkedTemplates:[...(s.linkedTemplates||[]),
              {id:uid('lt'),template:null,role:'Input'}]})}
            render={(r,i)=><div className="f-row">
              <Sel val={r.template} placeholder={templates.length?'Report Template…':'No Report Templates in Dataverse yet'}
                opts={templates.map(t=>({v:t.id,label:t.name}))}
                onChange={v=>{ const chosen=templates.find(t=>t.id===v);
                  set({linkedTemplates:s.linkedTemplates.map((x,j)=>j===i?{...x,template:v,templateName:chosen?chosen.name:null}:x)}); }}/>
              <Sel val={r.role} opts={REPORT_ROLES}
                onChange={v=>set({linkedTemplates:s.linkedTemplates.map((x,j)=>j===i?{...x,role:v}:x)})}/>
            </div>}/>
          <Field id="f-confidentiality" label="Confidentiality" req govern
            hint="Inherited by every occurrence created from this Setup.">
            <Seg id="f-confidentiality" opts={CONFIDENTIALITY} val={s.confidentiality}
              onChange={v=>set({confidentiality:v})}/></Field>
        </div>
        <MeetingSummary s={s}/>
      </>;
    }}/>;
}

/* one row per Business Unit / Region — the part that differs */
function UnitsTable({s}){
  const keys=scopeKeys(s);
  const report=s.kind==='Report Template';
  const lv=stageLevel(s);
  if(!keys.length) return <div className="card"><Empty>No unit selected yet.</Empty></div>;
  return <div className="card flush">
    <div className="card-hd">
      <h2>{keys.length} section{keys.length===1?'':'s'} — one per {LEVEL_WORD[lv]||'unit'}</h2>
      <div className="csub">Authored once. These are the values that differ from one place to the next;
        everything else on this Setup is shared by all of them.</div>
    </div>
    <div className="t-wrap"><table className="usum">
      <thead><tr>
        <th>{LEVEL_WORD[lv]||'Unit'}</th>
        {lv==='bu'?<th>Section / Specialty</th>:null}
        {report
          ? <><th>Submits</th><th>Owner</th><th>Review chain</th></>
          : <><th>Chairman</th><th>Organizer / Facilitator</th><th>Attendees</th></>}
        <th>Discussed in</th>
      </tr></thead>
      <tbody>{keys.map(k=>{
        const u=unitOf(s,k)||{};
        const core=(u.coreMembers||[]).filter(m=>m.position);
        return <tr key={k}>
          <td className="k">{unitLabel(s,k)}
            <div className="t-sub">{unitSub(s,k)}</div></td>
          {lv==='bu'?<td className="d">{u.section?nameOf(SECTIONS,u.section):'Whole Business Unit'}</td>:null}
          {report
            ? <><td><PosCell id={u.submitter}/></td><td><PosCell id={u.owner}/></td>
                <td className="d">{(u.reviewChain||[]).filter(Boolean).map(posName).join(' → ')||'—'}</td></>
            : <><td><PosCell id={u.chairman}/>
                  {u.coChairman?<div className="t-sub">co-chair {posName(u.coChairman)}</div>:null}</td>
                <td><PosCell id={u.facilitator}/></td>
                <td className="d">{core.length
                  ? `${core.filter(m=>m.type==='Core').length} core · ${core.filter(m=>m.type!=='Core').length} supportive`
                  : '—'}</td></>}
          <td className="d">{(u.team||teamOfChannel(u.channel))||'—'}
            {u.channel?<div className="t-sub">{nameOf(CHANNELS,u.channel)}</div>:null}</td>
        </tr>;})}
      </tbody></table></div>
  </div>;
}

function MeetingSummary({s}){
  const {db}=use();
  const accred=s.setupType==='Accreditation Committee';
  const cad=[s.frequency, s.dayOfWeek, s.dayOfMonth?('day '+s.dayOfMonth):null, s.monthInQuarter]
        .filter(Boolean).join(' · ');
  const keys=scopeKeys(s);
  return <>
    <div className="card">
      <h2>Review</h2>
      <div className="csub">Everything captured, read-only.</div>
      <div className="sum-grid">
        <SumBlock title="Type and identity" items={[
          ['Setup Type',s.setupType],[!accred&&'Classification',s.category],['Name',displayName(s)],
          [s.category===TOT&&'Monitors','The service strategy of '+(depsOf(s)[0]||'its Department')]]}/>
        <SumBlock title="Scope" items={[['Stage',s.stage],['Resolved',scopeString(s)],
          ['Runs in',keys.length?scopeNames(s).join(', '):'—'],
          ['Departments and Functions',
            linesOf(s).length?linesOf(s).map(lineLabel).join(' · '):'None — Stage 4 sits above them']]}/>
        <SumBlock title="Cadence" items={[
          ['Cadence',cad],['Default mode',s.mode],
          ['Time and venue','Set on each occurrence']]}/>
        <SumBlock title="Shared by every unit" items={[
          ['Supportive functions',(s.supportive||[]).length?s.supportive.join(', '):'None'],
          ['Quorum',s.quorum!=null?s.quorum+'%':'Not set'],
          ['Sections',keys.length+' — one per '+(LEVEL_WORD[stageLevel(s)]||'unit')]]}/>
        <SumBlock title="Mandate" items={[
          ['TOR / Policy',s.torLink||'None'],
          ['Agenda Items',(s.agenda||[]).length+' standing']]}/>
        <SumBlock title="Governance" items={[
          ['Linked Templates',(s.linkedTemplates||[]).length
            ? s.linkedTemplates.map(t=>`${t.templateName||'—'} (${t.role})`).join(', ')
            : 'None'],
          ['Confidentiality',s.confidentiality],
          ['Audit Grid',accred?'Produced for every occurrence':'Not produced']]}/>
      </div>
    </div>
    <UnitsTable s={s}/>
  </>;
}

/* =========================================================================
   S3 — REPORT TEMPLATE SETUP WIZARD
   ========================================================================= */
const REPORT_STEPS=[
  {label:'Identity',                 hint:'Name and classification'},
  {label:'Organisational scope',     hint:'Regions, business units'},
  {label:'Destination and content',  hint:'Delivery and structure'},
  {label:'Submission per unit',      hint:'Who submits, and when'},
  {label:'Cadence and review',       hint:'Frequency and review chain'},
];

function ReportWizard({rec,onClose}){
  return <Wizard rec={rec} steps={REPORT_STEPS} onClose={onClose}
    renderStep={(step,s,set,issues)=>{

      if(step===1) return <div className="card">
        <h2>Identity</h2>
        <div className="csub">The Report Type, the cadence and the Department produce the name.</div>
        <DerivedName s={s} set={set}/>
        <Field id="f-objective" label="Report Objective" req>
          <textarea id="f-objective" value={s.objective||''}
            onChange={e=>set({objective:e.target.value})}/></Field>
        <div className="f-row">
          <Field id="f-reportType" label="Report Type" req govern
            hint={s.reportType?REPORT_TYPE_HELP[s.reportType]:'Plan, Report and Conclusion differ by which month the content covers.'}>
            <Seg id="f-reportType" opts={REPORT_TYPES} val={s.reportType}
              onChange={v=>set({reportType:v})}/></Field>
          <Field id="f-reportCategory" label="Report Category" req govern>
            <Sel id="f-reportCategory" val={s.reportCategory} opts={REPORT_CATEGORIES}
              onChange={v=>set({reportCategory:v})}/></Field>
        </div>
      </div>;

      if(step===2) return <div className="card">
        <h2>Organisational scope</h2>
        <Field id="f-stage" label="Stage" req>
          <Seg id="f-stage" opts={STAGES.map(x=>({v:x,label:x.replace(/^Stage (\d) /,'$1 · ')}))}
            val={s.stage}
            onChange={v=>{const ns={...s,stage:v,regions:[],businessUnits:[],units:[]};
              set({stage:v, regions:[], businessUnits:[], units:syncUnits(ns)});}}/></Field>
        <ScopeFields s={s} set={set} stepNo={2}/>
      </div>;

      if(step===3){
        const file=s.delivery==='File destination';
        const libs=LIBRARIES.filter(l=>l.site===s.site);
        const folders=FOLDERS.filter(f=>f.library===s.library);
        return <div className="card">
          <h2>Destination and content</h2>
          <Field id="f-delivery" label="Report Delivery" req>
            <Seg id="f-delivery" opts={[
                {v:'File destination', label:'File destination', locked:true,
                 lockedHint:'Coming soon — SharePoint destinations are not wired to live data yet. Use Source link for now.'},
                {v:'Source link', label:'Source link'}]} val={s.delivery}
              onChange={v=>set({delivery:v,
                ...(v==='Source link'?{site:null,library:null,folder:null}:{sourceLink:''})})}/></Field>
          {file ? <div className="f-row3">
              <Field id="f-site" label="Site" req govern>
                <Sel id="f-site" val={s.site} opts={SITES.map(x=>({v:x.id,label:x.name}))}
                  onChange={v=>set({site:v,library:null,folder:null})}/></Field>
              <Field id="f-library" label="Library" req govern>
                <Sel id="f-library" val={s.library} disabled={!s.site}
                  placeholder={s.site?'Select…':'Choose a Site first'}
                  opts={libs.map(x=>({v:x.id,label:x.name}))}
                  onChange={v=>set({library:v,folder:null})}/></Field>
              <Field id="f-folder" label="Folder" req govern>
                <Sel id="f-folder" val={s.folder} disabled={!s.site||!s.library}
                  placeholder={!s.site||!s.library?'Choose a Site and Library first':'Select…'}
                  opts={folders.map(x=>({v:x.id,label:x.name}))}
                  onChange={v=>set({folder:v})}/></Field>
            </div>
            : <Field id="f-sourceLink" label="Source link" req
                hint={s.sourceLinkAuto
                  ? 'Filled in from the SharePoint path of the Channel chosen in Setup per unit. Typing here replaces it and it stops updating.'
                  : 'Choosing a Channel in Setup per unit fills this in from that Channel’s SharePoint path.'}>
                <input id="f-sourceLink" type="text" value={s.sourceLink||''}
                  onChange={e=>set({sourceLink:e.target.value, sourceLinkAuto:false})}
                  placeholder="https://bi.andalusia.local/reports/…"/>
                {s.sourceLinkAuto
                  ? <div className="holder">auto-filled from the Channel’s SharePoint path</div>
                  : null}</Field>}
          <Field id="f-checklist" label="Expected Content Checklist"
            hint="The components a submission must contain each period.">
            <RowEditor id="f-checklist" rows={s.checklist||[]} onChange={v=>set({checklist:v})} reorder
              addLabel="Add component" empty="No components listed yet."
              onAdd={()=>set({checklist:[...(s.checklist||[]),{id:uid('ck'),text:''}]})}
              render={(r,i)=><input type="text" value={r.text} placeholder="Component"
                onChange={e=>set({checklist:s.checklist.map((x,j)=>j===i?{...x,text:e.target.value}:x)})}/>}/>
          </Field>
          <div className="f-row">
            <Field id="f-processes" label="Related Processes" govern
              hint="Referenced by identifier only, never copied.">
              <ComboMulti id="f-processes" opts={PROCESSES} val={s.processes}
                placeholder="Search processes…" onChange={v=>set({processes:v})}/></Field>
            <Field id="f-kpis" label="Related KPIs" govern
              hint="Referenced by identifier only, never copied.">
              <ComboMulti id="f-kpis" opts={KPIS} val={s.kpis}
                placeholder="Search KPIs…" onChange={v=>set({kpis:v})}/></Field>
          </div>
        </div>;
      }

      if(step===4) return <UnitSetup s={s} set={set} issues={issues}
        intro={<div className="ph" style={{marginBottom:14}}>
          <h1 style={{fontSize:16}}>Submission per unit</h1>
          <div className="sub">The report is defined once — same objective, same content checklist, same
            destination. What differs is who prepares and submits it in each place, who owns it, and who
            signs it off. Set one section up and copy it across the rest.</div>
        </div>}/>;

      /* step 5 */
      return <>
        <div className="card">
          <h2>Cadence and review</h2>
          <CadenceFields s={s} set={set}/>
          <Field id="f-confidentiality" label="Confidentiality" req govern
            hint="Inherited by every submission created from this Setup.">
            <Seg id="f-confidentiality" opts={CONFIDENTIALITY} val={s.confidentiality}
              onChange={v=>set({confidentiality:v})}/></Field>
        </div>
        <ReportSummary s={s}/>
      </>;
    }}/>;
}

function ReportSummary({s}){
  const dest=s.delivery==='File destination'
    ? [nameOf(SITES,s.site),nameOf(LIBRARIES,s.library),nameOf(FOLDERS,s.folder)].filter(Boolean).join(' / ')
    : s.sourceLink;
  const cad=[s.frequency,s.dayOfWeek,s.dayOfMonth?('day '+s.dayOfMonth):null,s.monthInQuarter]
    .filter(Boolean).join(' · ');
  const keys=scopeKeys(s);
  return <>
    <div className="card">
      <h2>Review</h2>
      <div className="sum-grid">
        <SumBlock title="Identity" items={[['Name',displayName(s)],['Objective',s.objective],
          ['Report Type',s.reportType?`${s.reportType} — ${REPORT_TYPE_HELP[s.reportType]}`:null],
          ['Report Category',s.reportCategory]]}/>
        <SumBlock title="Scope" items={[['Stage',s.stage],['Resolved',scopeString(s)],
          ['Submitted from',keys.length?scopeNames(s).join(', '):'—'],
          ['Departments and Functions',
            linesOf(s).length?linesOf(s).map(lineLabel).join(' · '):'None — Stage 4 sits above them']]}/>
        <SumBlock title="Destination" items={[['Delivery',s.delivery],['Destination',dest],
          ['Checklist',(s.checklist||[]).length+' components']]}/>
        <SumBlock title="Submission" items={[
          ['Sections',keys.length+' — one per '+(LEVEL_WORD[stageLevel(s)]||'unit')]]}/>
        <SumBlock title="Cadence" items={[['Cadence',cad],['Confidentiality',s.confidentiality]]}/>
        <SumBlock title="References" items={[
          ['Processes',(s.processes||[]).length+' linked'],['KPIs',(s.kpis||[]).length+' linked']]}/>
      </div>
    </div>
    <UnitsTable s={s}/>
  </>;
}

/* Resolves a Report Template Setup (as edited/published in ReportWizard)
   into the plain-id payload saveReportTemplateToDataverse() expects.
   Kept separate from that function since it needs the app's live
   reference data and cascade helpers (DEPARTMENTS, FUNCTIONS, POSITIONS,
   KPI_ID_BY_NAME/PROCESS_ID_BY_NAME, scopeKeys/unitOf/buOf/nameOf), none
   of which the plain data-service module knows about. */
function buildReportTemplatePayload(f){
  const lv=stageLevel(f);
  const keys=scopeKeys(f);

  return {
    name: f.name,
    status: f.status,
    version: f.version,
    objective: f.objective,
    reportType: f.reportType,
    reportCategory: f.reportCategory,
    frequency: f.frequency,
    dayOfWeek: f.dayOfWeek,
    dayOfMonth: f.dayOfMonth,
    monthInQuarter: f.monthInQuarter,
    confidentiality: f.confidentiality,
    destinationLink: f.delivery==='Source link' ? (f.sourceLink||undefined) : undefined,
    // Business Unit/Speciality/Team-Channel/Owner/Submitter no longer live
    // on the parent record -- they're per-unit now. Review Chain is now
    // per-unit too (each unit carries its own `reviewChain`), since
    // Lm_reporttemplatereviewchains got real lookups back to a specific
    // Business-Unit or Region row, not just the parent template.
    stageLevel: lv,
    units: keys.map(k=>{
      const u=unitOf(f,k)||{};
      return {
        key: k,
        name: unitLabel(f,k),
        businessUnitId: lv==='bu' ? k : undefined,
        regionId: lv==='region' ? k : undefined,
        specialityId: u.section || undefined,
        ownerPositionId: u.owner || undefined,
        submittingPositionId: u.submitter || undefined,
        channelId: u.channel || undefined,
        reviewChain: (u.reviewChain||[]).map((posId,i)=>({
          step: i+1,
          positionId: posId || undefined,
          positionName: nameOf(POSITIONS,posId) || posId || '',
        })),
      };
    }),
    checklist: (f.checklist||[]).filter(c=>c.text).map(c=>({text:c.text})),
    lines: linesOf(f).map(l=>({
      departmentId: DEPARTMENTS.find(d=>d.name===l.department)?.id,
      functionId: l.function ? FUNCTIONS.find(fn=>fn.name===l.function)?.id : undefined,
    })).filter(l=>l.departmentId),
    kpiIds: (f.kpis||[]).map(name=>KPI_ID_BY_NAME[name]).filter(Boolean),
    processIds: (f.processes||[]).map(name=>PROCESS_ID_BY_NAME[name]).filter(Boolean),
  };
}

/* Same idea as buildReportTemplatePayload above, for the Committee/Meeting
   side: normalizes a Meeting Setup into the plain-id shape
   saveMeetingTemplateToDataverse() expects. Uses the FIRST scope key's
   unit for Chairman/Co-Chairman/Facilitator and the meeting's Business
   Unit, for the same single-BU-table reason as the Report side.

   Linked Reports: s.linkedTemplates[].template is a real Dataverse
   lm_report_templateid, picked directly from the live Dataverse list
   (dvReports) rather than a local Setup id -- see the picker in
   MeetingWizard's step 6. That makes this a genuine, always-real
   lm_ReportTemplate@odata.bind link, not a name-only fallback. */
function buildMeetingTemplatePayload(f){
  const lv=stageLevel(f);
  const keys=scopeKeys(f);

  return {
    name: f.name,
    status: f.status,
    version: f.version,
    setupType: f.setupType,
    category: f.category,
    stage: f.stage,
    frequency: f.frequency,
    dayOfWeek: f.dayOfWeek,
    dayOfMonth: f.dayOfMonth,
    monthInQuarter: f.monthInQuarter,
    mode: f.mode,
    confidentiality: f.confidentiality,
    quorum: f.quorum,
    torLink: f.torLink || undefined,
    // Business Unit/Chairman/Co-Chairman/Facilitator/Team-Channel no
    // longer live on the parent record -- they're per-unit now. Attendees
    // is now per-unit too (each unit carries its own `attendeePositionIds`),
    // since Lm_meetingattendeeslists got real lookups back to a specific
    // Business-Unit or Region row, not just the parent template.
    stageLevel: lv,
    units: keys.map(k=>{
      const u=unitOf(f,k)||{};
      return {
        key: k,
        name: unitLabel(f,k),
        businessUnitId: lv==='bu' ? k : undefined,
        regionId: lv==='region' ? k : undefined,
        chairmanId: u.chairman || undefined,
        coChairmanId: u.coChairman || undefined,
        facilitatorId: u.facilitator || undefined,
        channelId: u.channel || undefined,
        attendeePositionIds: (u.coreMembers||[]).filter(m=>m.position).map(m=>m.position),
      };
    }),
    agenda: (f.agenda||[]).filter(a=>a.text).map((a,i)=>({
      step: i+1,
      text: a.text,
      ownerId: a.owner || undefined,
      source: a.source==='Added' ? 'Added' : 'Migrated - Initial',
    })),
    lines: linesOf(f).map(l=>({
      departmentId: DEPARTMENTS.find(d=>d.name===l.department)?.id,
      functionId: l.function ? FUNCTIONS.find(fn=>fn.name===l.function)?.id : undefined,
    })).filter(l=>l.departmentId),
    // Supportive Function Representation now picks directly from FUNCTIONS
    // (the real hr_functions table), so this resolves to a real functionId
    // by construction -- not a coincidental name match.
    supportive: (f.supportive||[]).map(name=>({
      name,
      functionId: FUNCTIONS.find(fn=>fn.name===name)?.id || undefined,
    })),
    // f.linkedTemplates[].template is now the real Dataverse
    // lm_report_templateid directly (the picker sources from dvReports,
    // the live Dataverse list), not a local Setup id -- so this is a
    // direct, always-real link now, no id-tracking lookup needed.
    linkedReports: (f.linkedTemplates||[]).map(lt=>({
      name: lt.templateName || lt.template || '',
      role: lt.role==='Output' ? 'Output' : 'Input',
      reportTemplateId: lt.template || undefined,
    })),
  };
}

/* =========================================================================
   PUBLISH CONFIRMATION -- what will actually change in Dataverse
   Compares the Setup as it was when the wizard opened against the edited
   form state, and turns that into the plain-language list the confirm
   modal shows before anything is written. Editing and republishing a
   Dataverse-backed Setup deletes the child rows (Business Unit/Region rows
   and everything nested under them, checklist/agenda/lines/etc.) that no
   longer apply and recreates the ones that do -- see
   updateReportTemplateToDataverse/updateMeetingTemplateToDataverse in
   dataverse.js -- so this diff is not cosmetic: "removed" here really does
   mean "its Dataverse row(s) will be deleted."
   ========================================================================= */

/* Plain set-difference between two label lists, order-preserving. Used for
   every "which of these will be added/removed" section in the modal. */
function diffList(before, after){
  const beforeSet=new Set(before), afterSet=new Set(after);
  return {
    added: after.filter(x=>!beforeSet.has(x)),
    removed: before.filter(x=>!afterSet.has(x)),
  };
}

function buildPublishSummary(original, edited){
  const isExisting = !!original?._dataverseId;
  const isReport = edited.kind==='Report Template';

  const fields=[];
  const addField=(label,before,after,fmt=v=>(v==null||v===''?'—':String(v)))=>{
    if(before!==after) fields.push({label, before:fmt(before), after:fmt(after)});
  };

  // What Publish will actually do to the lifecycle: always lands on Under
  // Review, and only bumps the version if this is a re-publish of
  // something that had already been Active / Approved -- mirrors A.publish
  // exactly, so the modal previews the real outcome, not a guess.
  const wasApproved = edited.status==='Active / Approved';
  const nextVersion = wasApproved ? (edited.version||0)+1 : (edited.version||1);
  addField('Lifecycle Status', edited.status, 'Under Review');
  addField('Version', edited.version, nextVersion);

  addField('Stage', original.stage, edited.stage);
  addField('Frequency', original.frequency, edited.frequency);
  addField('Day of week', original.dayOfWeek, edited.dayOfWeek);
  addField('Day of month', original.dayOfMonth, edited.dayOfMonth);
  addField('Month within quarter', original.monthInQuarter, edited.monthInQuarter);
  addField('Confidentiality', original.confidentiality, edited.confidentiality);
  if(isReport){
    addField('Objective', original.objective, edited.objective);
    addField('Report Type', original.reportType, edited.reportType);
    addField('Report Category', original.reportCategory, edited.reportCategory);
    addField('Report Delivery', original.delivery, edited.delivery);
    addField('Source link', original.sourceLink, edited.sourceLink);
  }else{
    addField('Setup Type', original.setupType, edited.setupType);
    addField('Type / Classification', original.category, edited.category);
    addField('Default Meeting Mode', original.mode, edited.mode);
    addField('Quorum Threshold %', original.quorum, edited.quorum, v=>(v==null||v===''?'—':`${v}%`));
    addField('TOR / Policy link', original.torLink, edited.torLink);
  }

  const unitLevel = stageLevel(edited);
  const levelChanged = stageLevel(original)!==unitLevel;
  const units = diffList(scopeKeys(original).map(k=>unitLabel(original,k)||k),
                          scopeKeys(edited).map(k=>unitLabel(edited,k)||k));

  const lines = diffList(
    linesOf(original).map(l=>l.function?`${l.department} · ${l.function}`:l.department),
    linesOf(edited).map(l=>l.function?`${l.department} · ${l.function}`:l.department));

  const extra={};
  if(isReport){
    extra.checklist = diffList((original.checklist||[]).map(c=>c.text).filter(Boolean),
      (edited.checklist||[]).map(c=>c.text).filter(Boolean));
    extra.kpis = diffList(original.kpis||[], edited.kpis||[]);
    extra.processes = diffList(original.processes||[], edited.processes||[]);
  }else{
    extra.supportive = diffList(original.supportive||[], edited.supportive||[]);
    extra.agenda = diffList((original.agenda||[]).map(a=>a.text).filter(Boolean),
      (edited.agenda||[]).map(a=>a.text).filter(Boolean));
    extra.linkedReports = diffList(
      (original.linkedTemplates||[]).map(l=>l.templateName||l.template).filter(Boolean),
      (edited.linkedTemplates||[]).map(l=>l.templateName||l.template).filter(Boolean));
  }

  const hasAnyChange = fields.length>0 || units.added.length>0 || units.removed.length>0 ||
    lines.added.length>0 || lines.removed.length>0 ||
    Object.values(extra).some(d=>d.added.length>0 || d.removed.length>0);

  return {isExisting, isReport, fields, unitLevel, levelChanged, units, lines, extra, hasAnyChange};
}

function DiffSection({title, diff, addLabel, removeLabel}){
  if(!diff || (diff.added.length===0 && diff.removed.length===0)) return null;
  return <div className="pub-diff-grp">
    <div className="pub-diff-title">{title}</div>
    {diff.removed.length ? <div className="pub-diff-line pub-diff-rm">
      <span className="pub-diff-tag rm">−</span>
      <span>{removeLabel}: <b>{diff.removed.join(', ')}</b></span></div> : null}
    {diff.added.length ? <div className="pub-diff-line pub-diff-add">
      <span className="pub-diff-tag add">+</span>
      <span>{addLabel}: <b>{diff.added.join(', ')}</b></span></div> : null}
  </div>;
}

function PublishConfirmModal({original, edited, onConfirm, onCancel}){
  const summary=useMemo(()=>buildPublishSummary(original,edited),[original,edited]);
  return <Modal wide onClose={onCancel}
    title={summary.isExisting ? 'Confirm changes before sending for review' : 'Confirm before sending for review'}
    sub={summary.isExisting
      ? 'Review every change below. Publishing sends it to Under Review, not straight to Active / Approved — an admin still needs to Approve it. Confirming updates the Dataverse record in place — removed rows are deleted, new rows are created. Nothing changes until you confirm.'
      : 'Publishing sends this Setup to Under Review, not straight to Active / Approved — an admin still needs to Approve it. Review the Setup below before it is created in Dataverse. Nothing is written until you confirm.'}
    footer={<><Btn onClick={onCancel}>Cancel</Btn>
      <Btn k="pri" onClick={onConfirm}>Confirm & send for review</Btn></>}>
    <div className="readonly" style={{marginBottom:12}}>
      <b>{displayName(edited)}</b>
      <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{edited.kind} · {scopeString(edited)}</div>
    </div>

    {!summary.hasAnyChange
      ? <Note k="info" ic="i">{summary.isExisting
          ? 'No governed fields changed since this Setup was opened for edit.'
          : 'This Setup will be created in Dataverse exactly as shown above.'}</Note>
      : null}

    {summary.fields.length ? <div className="pub-diff-grp">
      <div className="pub-diff-title">Fields</div>
      <table className="data" style={{marginTop:6}}>
        <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
        <tbody>{summary.fields.map(f=><tr key={f.label}>
          <td className="t-main">{f.label}</td><td className="dim">{f.before}</td><td>{f.after}</td></tr>)}
        </tbody>
      </table>
    </div> : null}

    <DiffSection title={`${LEVEL_WORD[summary.unitLevel]||'Unit'} scope${summary.levelChanged?' — Stage level changed':''}`}
      diff={summary.units}
      addLabel="New Dataverse rows will be created for"
      removeLabel="Existing rows — and everything under them (chairs, reviewers, attendees) — will be deleted for"/>

    <DiffSection title="Departments & Functions" diff={summary.lines}
      addLabel="Added" removeLabel="Removed"/>

    {summary.isReport ? <>
      <DiffSection title="Content Checklist" diff={summary.extra.checklist} addLabel="Added" removeLabel="Removed"/>
      <DiffSection title="Related KPIs" diff={summary.extra.kpis} addLabel="Added" removeLabel="Removed"/>
      <DiffSection title="Related Processes" diff={summary.extra.processes} addLabel="Added" removeLabel="Removed"/>
    </> : <>
      <DiffSection title="Supportive Function Representation" diff={summary.extra.supportive} addLabel="Added" removeLabel="Removed"/>
      <DiffSection title="Standing Agenda" diff={summary.extra.agenda} addLabel="Added" removeLabel="Removed"/>
      <DiffSection title="Linked Reports" diff={summary.extra.linkedReports} addLabel="Added" removeLabel="Removed"/>
    </>}
  </Modal>;
}

/* =========================================================================
   Reading Report/Meeting Templates back OUT of Dataverse -- converts the
   raw fetchReportTemplateDetail()/fetchMeetingTemplateDetail() shape into
   a real app Setup object, so it can be opened in the exact same detail
   view and wizard every local Setup already uses. No separate "Dataverse
   view" UI was built -- once converted, it's just a Setup.

   Known, deliberate gaps (documented, not silently hidden):
   - Editing and republishing one of these creates NEW Dataverse rows,
     it does not update the original rows in place -- there's no
     id-tracking for a round-trip update, only for create (see
     REPORT_DATAVERSE_ID above).
   - Linked Reports come back as a name only (no working link back to a
     local Setup id), since the original local id isn't stored anywhere
     in Dataverse.
   - Group-level Setups never had a per-unit child table to begin with,
     so nothing comes back for their org placement -- the Setup still
     converts, just with an empty `units` list.
   ========================================================================= */

const DV_REPORT_TYPE=['Plan','Report','Conclusion'];
const DV_REPORT_CATEGORY=['Outcome Executive','Process Executive','Core Process','Custom Content'];
const DV_FREQUENCY=['Daily','Twice Weekly','Weekly','Twice Monthly','Monthly','Quarterly','Semesterly','Annually','Custom'];
const DV_DAY_OF_WEEK=['Sunday','Monday','Tuesday','Wednesday','Thursday'];
const DV_MONTH_IN_QUARTER=['1st month','2nd month','3rd month'];
const DV_CONFIDENTIALITY=['Public','Internal','Confidential','High Confidential','Restricted'];
const byCode1=(arr,code)=> (code>=1 && code<=arr.length) ? arr[code-1] : null;

// Meeting-side choice codes aren't sequential from 1, so these mirror the
// forward MEETING_*_KEY maps in dataverse.js explicitly instead.
const DV_MEETING_DAY_OF_WEEK={124330000:'Sunday',124330001:'Monday',124330002:'Tuesday',124330003:'Wednesday',124330004:'Thursday'};
const DV_MEETING_MONTH_IN_QUARTER={124330000:'1st month',124330001:'2nd month',124330002:'3rd month'};
const DV_MEETING_CONFIDENTIALITY={124330000:'Public',124330001:'Internal',124330002:'Confidential',124330003:'High Confidential',124330004:'Restricted'};
const DV_MEETING_CATEGORY={124330000:'Planning Meeting',124330001:'Performance Monitoring Meeting',124330002:'Clinical Meeting',124330003:'Operational Meeting',124330004:'Technology Meeting',124330005:'Cross-Functional Meeting',124330006:TOT};
const DV_MEETING_MODE={1:'Physical',2:'Virtual',3:'Hybrid'};
const DV_MEETING_SETUP_TYPE={1:'Business Meeting',2:'Accreditation Committee'};
const DV_MEETING_STAGE={1:STAGES[0],2:STAGES[1],3:STAGES[2],4:STAGES[3]};

/* id -> name lookups the save side didn't need (it only went name -> id) */
const idToName=(map,id)=>{ const hit=Object.entries(map).find(([,v])=>v===id); return hit?hit[0]:null; };

function dataverseReportToSetup(detail){
  const p=detail.parent;
  const buUnits=(detail.businessUnits||[]).map(bu=>({
    id:'dvu-'+bu.lm_reporttemplatebusinessunitsid, key:bu._lm_businessunit_value,
    section:bu._lm_speciality_value||null,
    channel:bu._lm_teamchannel_value||null, team:teamOfChannel(bu._lm_teamchannel_value),
    submitter:bu._lm_submittingposition_value||null, owner:bu._lm_ownerposition_value||null,
    reviewChain:(bu.reviewChain||[]).slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0))
      .map(r=>r._lm_reviewerposition_value||null),
  }));
  const regionUnits=(detail.regions||[]).map(rg=>({
    id:'dvu-'+rg.lm_reporttemplateregionid, key:rg._lm_region_value,
    section:rg._lm_reportspeciality_value||null,
    channel:rg._lm_teamchannel_value||null, team:teamOfChannel(rg._lm_teamchannel_value),
    submitter:rg._lm_submittingposition_value||null, owner:rg._lm_ownerposition_value||null,
    reviewChain:(rg.reviewChain||[]).slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0))
      .map(r=>r._lm_reviewerposition_value||null),
  }));
  const isRegionLevel=regionUnits.length>0 && buUnits.length===0;

  return {...BLANK_REPORT,
    id:'dv-rpt-'+p.lm_report_templateid,
    kind:'Report Template',
    name:p.lm_newcolumn||'(untitled)',
    objective:p.lm_objective||'',
    reportType:byCode1(DV_REPORT_TYPE,p.lm_reporttype),
    reportCategory:byCode1(DV_REPORT_CATEGORY,p.lm_reportcategory),
    frequency:byCode1(DV_FREQUENCY,p.lm_frequency),
    dayOfWeek:byCode1(DV_DAY_OF_WEEK,p.lm_dayoftheweek),
    dayOfMonth:p.lm_dayofthemonth ?? null,
    monthInQuarter:byCode1(DV_MONTH_IN_QUARTER,p.lm_monthofthequarter),
    confidentiality:byCode1(DV_CONFIDENTIALITY,p.lm_confidentiality),
    delivery:'Source link', sourceLink:p.lm_destinationsharepointlink||'',
    checklist:(detail.checklist||[]).slice().sort((a,b)=>(a.lm_checklistitemstep||0)-(b.lm_checklistitemstep||0))
      .map(c=>({id:uid('ck'), text:c.lm_checklistitemname||''})),
    lines:(detail.lines||[]).map(l=>({
      id:uid('ln'),
      department:nameOf(DEPARTMENTS,l._lm_department_value)||'',
      function:l._lm_function_value ? (nameOf(FUNCTIONS,l._lm_function_value)||'') : '',
    })),
    kpis:(detail.kpiIds||[]).map(id=>idToName(KPI_ID_BY_NAME,id)).filter(Boolean),
    processes:(detail.processIds||[]).map(id=>idToName(PROCESS_ID_BY_NAME,id)).filter(Boolean),
    stage:isRegionLevel?STAGES[1]:STAGES[0],
    regions:isRegionLevel ? regionUnits.map(u=>u.key)
      : Array.from(new Set(buUnits.map(u=>{const b=byId(BUSINESS_UNITS,u.key);return b?b.region:null;}).filter(Boolean))),
    businessUnits:isRegionLevel ? [] : buUnits.map(u=>u.key),
    units:[...buUnits,...regionUnits],
    // Rows written before lm_reportstatus/lm_version existed have neither --
    // treated as Active / Approved / version 1 so they still register as
    // "available for use" rather than looking unreviewed.
    status:TEMPLATE_STATUS_LABEL[p.lm_reportstatus]||'Active / Approved',
    version:typeof p.lm_version==='number'?p.lm_version:1,
    updated:(p.modifiedon||p.createdon||TODAY).slice(0,10),
    _dataverseId:p.lm_report_templateid,
  };
}

function dataverseMeetingToSetup(detail){
  const p=detail.parent;
  const buUnits=(detail.businessUnits||[]).map(bu=>({
    id:'dvu-'+bu.lm_meetingtemplatebusinessunitsid, key:bu._lm_businessunit_value,
    section:null,
    channel:bu._lm_teamchannel_value||null, team:teamOfChannel(bu._lm_teamchannel_value),
    chairman:bu._lm_meetingchairman_value||null, coChairman:bu._lm_meetingcochairman_value||null,
    facilitator:bu._lm_meetingorganizerfacilitator_value||null,
    coreMembers:(bu.attendees||[]).map(a=>({position:a._lm_attendeeposition_value||null})),
  }));
  const regionUnits=(detail.regions||[]).map(rg=>({
    id:'dvu-'+rg.lm_meetingtemplateregionid, key:rg._lm_region_value,
    section:null,
    channel:rg._lm_teamchannel_value||null, team:teamOfChannel(rg._lm_teamchannel_value),
    chairman:rg._lm_meetingchairman_value||null, coChairman:rg._lm_meetingcochairman_value||null,
    facilitator:rg._lm_meetingorganizerfacilitator_value||null,
    coreMembers:(rg.attendees||[]).map(a=>({position:a._lm_attendeeposition_value||null})),
  }));
  const isRegionLevel=regionUnits.length>0 && buUnits.length===0;

  return {...BLANK_MEETING,
    id:'dv-mtg-'+p.lm_meetingtemplateid,
    kind:'Committee / Meeting',
    name:p.lm_meetingtemplatename||'(untitled)',
    setupType:DV_MEETING_SETUP_TYPE[p.lm_setuptype]||'Business Meeting',
    category:DV_MEETING_CATEGORY[p.lm_typeclassification]||null,
    stage:isRegionLevel?STAGES[1]:(DV_MEETING_STAGE[p.lm_stages]||STAGES[0]),
    frequency:byCode1(DV_FREQUENCY,p.lm_frequency),
    dayOfWeek:DV_MEETING_DAY_OF_WEEK[p.lm_daysoftheweek]||null,
    dayOfMonth:p.lm_dayofthemonth ?? null,
    monthInQuarter:DV_MEETING_MONTH_IN_QUARTER[p.lm_monthofthequarter]||null,
    mode:DV_MEETING_MODE[p.lm_defaultmeetingmode]||null,
    confidentiality:DV_MEETING_CONFIDENTIALITY[p.lm_meetingconfidentiality]||null,
    quorum:p.lm_quorumthreshold ?? null,
    torLink:p.lm_torpolicylink||'',
    agenda:(detail.agenda||[]).slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0)).map(a=>({
      id:uid('ag'), text:a.lm_agendaitemname||'', owner:a._lm_agendaitemowner_value||null,
      source:a.lm_agendaitemtype===2?'Added':'Migrated - Initial',
    })),
    lines:(detail.lines||[]).map(l=>({
      id:uid('ln'),
      department:nameOf(DEPARTMENTS,l._lm_department_value)||'',
      function:l._lm_function_value ? (nameOf(FUNCTIONS,l._lm_function_value)||'') : '',
    })),
    supportive:(detail.supportive||[])
      .map(s=>s._lm_function_value ? (nameOf(FUNCTIONS,s._lm_function_value)||s.lm_newcolumn) : s.lm_newcolumn)
      .filter(Boolean),
    // Name-only -- see the header note on why there's no working link back yet.
    linkedTemplates:(detail.linkedReports||[]).map(lr=>({
      template:lr._lm_reporttemplate_value||null, templateName:lr.lm_name||null,
      role:lr.lm_reporttype===1?'Output':'Input',
    })),
    regions:isRegionLevel ? regionUnits.map(u=>u.key)
      : Array.from(new Set(buUnits.map(u=>{const b=byId(BUSINESS_UNITS,u.key);return b?b.region:null;}).filter(Boolean))),
    businessUnits:isRegionLevel ? [] : buUnits.map(u=>u.key),
    units:[...buUnits,...regionUnits],
    // Same fallback as dataverseReportToSetup above, for rows written before
    // lm_meetingstatus/lm_version existed.
    status:TEMPLATE_STATUS_LABEL[p.lm_meetingstatus]||'Active / Approved',
    version:typeof p.lm_version==='number'?p.lm_version:1,
    updated:(p.modifiedon||p.createdon||TODAY).slice(0,10),
    _dataverseId:p.lm_meetingtemplateid,
  };
}

/* =========================================================================
   S1 — SETUP REGISTER
   ========================================================================= */
function ScreenRegister(){
  const {db,A,role,open,dvReports,dvMeetings,dvOpening}=use();
  const w=ROLES[role].write, canApprove=ROLES[role].approve;
  const [fKind,setFKind]=useState('All'), [fType,setFType]=useState('All');
  const [fCat,setFCat]=useState('All'), [fStage,setFStage]=useState('All');
  const [fStatus,setFStatus]=useState('All'), [q,setQ]=useState('');
  /* Both confirm modals below work off one flat shape, so a row that has
     been loaded into this session and a Dataverse row that hasn't both
     describe themselves the same way -- the latter has no full Setup to
     run scopeString()/displayName() against. */
  const [confirm,setConfirm]=useState(null);
  const confirmFor=(s,action)=>({_action:action, _dv:false, id:s.id,
    name:displayName(s), kind:s.kind, version:s.version, scope:scopeString(s)});

  // Only real data: Setups opened from Dataverse, or created fresh this
  // session. The built-in demo/seed Setups never existed in Dataverse, so
  // they're excluded everywhere on this screen -- rows, stats, and the
  // opened-id dedup used to decide which Dataverse shadow rows to show.
  const realSetups=db.setups.filter(s=>!s._seed);

  /* Every row in this table -- one already loaded into this session's `db`,
     or one still listed straight from Dataverse -- is reduced to the same few
     fields the filter bar works on, and those same values are what the row
     renders. That keeps the two in step: a row can never display "2 · Regional"
     and then fail a Stage 2 filter.

     Two of the columns hold a different field depending on the kind (a
     Meeting's Setup Type vs a Report's Report Type; a Meeting's Type /
     Classification vs a Report's Report Category), so each row is filtered on
     whichever one applies to it, and those two dropdowns offer both sets. */
  const filterFace=s=>({
    kind:s.kind,
    type:s.kind==='Report Template'?s.reportType:s.setupType,
    category:s.kind==='Report Template'?s.reportCategory:s.category,
    stage:s.stage, status:s.status, name:displayName(s),
  });
  const matches=f=>
    (fKind==='All'  ||f.kind===fKind) &&
    (fType==='All'  ||f.type===fType) &&
    (fCat==='All'   ||f.category===fCat) &&
    (fStage==='All' ||f.stage===fStage) &&
    (fStatus==='All'||f.status===fStatus) &&
    (!q||(f.name||'').toLowerCase().includes(q.toLowerCase()));

  const rows=realSetups.filter(s=>matches(filterFace(s)));

  /* Dataverse-sourced rows the register hasn't loaded into this session's
     `db` yet -- shown as a lightweight "shadow" row until opened (at which
     point they become a real Setup and drop out of here, since they then show
     up via `rows` above).

     Everything the filter bar and the cells need is derived once, here, the
     same way opening the record would derive it: Stage from which per-unit
     table carries rows, and a row saved before the status column existed
     reading as Active / Approved. So filtering by Stage or Status now includes
     these rows instead of hiding every one of them. */
  const openedDvIds=new Set(realSetups.filter(s=>s._dataverseId).map(s=>s._dataverseId));
  const dvFace=(r,kind)=>{
    const isReport=kind==='Report Template';
    const buNames=(r.businessUnitIds||[]).map(id=>nameOf(BUSINESS_UNITS,id)).filter(Boolean);
    const rgNames=(r.regionIds||[]).map(id=>nameOf(REGIONS,id)).filter(Boolean);
    const unitCount=(r.businessUnitIds||[]).length || (r.regionIds||[]).length;
    const isRegionLevel=(r.regionIds||[]).length>0 && (r.businessUnitIds||[]).length===0;
    return {
      _dv:true, dvKind:kind, dvId:r.id, kind, name:r.name,
      type: isReport ? byCode1(DV_REPORT_TYPE,r.reportTypeCode)
                     : (DV_MEETING_SETUP_TYPE[r.setupTypeCode]||null),
      category: isReport ? byCode1(DV_REPORT_CATEGORY,r.reportCategoryCode)
                         : (DV_MEETING_CATEGORY[r.categoryCode]||null),
      stage: isReport ? (unitCount?(isRegionLevel?STAGES[1]:STAGES[0]):null)
                      : (isRegionLevel?STAGES[1]:(DV_MEETING_STAGE[r.stageCode]||null)),
      status: TEMPLATE_STATUS_LABEL[r.statusCode]||'Active / Approved',
      statusAssumed: !TEMPLATE_STATUS_LABEL[r.statusCode],
      frequency: byCode1(DV_FREQUENCY,r.frequencyCode),
      version:r.version, updated:r.updated,
      buNames, rgNames, unitCount, isRegionLevel,
      scopeLabel: buNames.length ? buNames.join(', ')
        : rgNames.length ? rgNames.join(', ') : '—',
    };
  };
  const dvAll=[
    ...dvReports.filter(r=>!openedDvIds.has(r.id)).map(r=>dvFace(r,'Report Template')),
    ...dvMeetings.filter(r=>!openedDvIds.has(r.id)).map(r=>dvFace(r,'Committee / Meeting')),
  ];
  const dvRows=dvAll.filter(matches);

  // The stat cards read from the tables, not just this session's loaded-in
  // Setups: every real Setup plus every Dataverse row not yet opened into this
  // session. Deliberately built from the UNFILTERED lists -- they are totals
  // for the register, not counts of what the current filters leave showing.
  const allKnown=[...realSetups.map(s=>({kind:s.kind,status:s.status})),
                  ...dvAll.map(r=>({kind:r.kind,status:r.status}))];
  const countAll=pred=>allKnown.filter(pred).length;
  const available=countAll(x=>x.status==='Active / Approved');
  const clearAll=()=>{setFKind('All');setFType('All');setFCat('All');setFStage('All');
                      setFStatus('All');setQ('');};
  const filtered=fKind!=='All'||fType!=='All'||fCat!=='All'||fStage!=='All'||fStatus!=='All'||q;

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Setup Register</h1>
        <div className="sub">Every governed Setup that execution records are created from. A Setup is
          authored, validated, published and versioned here — and expired, never deleted.</div></div>
      {w?<Btn onClick={()=>A.create('Committee / Meeting')}>New Committee / Meeting Setup</Btn>:null}
      {w?<Btn k="pri" onClick={()=>A.create('Report Template')}>New Report Template Setup</Btn>:null}
    </div>

    <div className="stats">
      <Stat label="Available for use" v={available} d="Active / Approved" c="green"/>
      <Stat label="Draft" v={countAll(x=>x.status==='Draft')} d="not yet published" c="amber"/>
      <Stat label="Under Review" v={countAll(x=>x.status==='Under Review')}
            d="pending approval" c="amber"/>
      <Stat label="Expired" v={countAll(x=>x.status==='Expired')} d="create no occurrences"/>
      <Stat label="Report Templates" v={countAll(x=>x.kind==='Report Template')} d="published and draft"/>
    </div>

    <div className="fltr">
      <label htmlFor="q-search">Search</label>
      <input id="q-search" type="search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Setup name…" style={{minWidth:190}}/>
      <label htmlFor="q-kind">Kind</label>
      <select id="q-kind" value={fKind} onChange={e=>setFKind(e.target.value)}>
        <option>All</option><option>Committee / Meeting</option><option>Report Template</option></select>
      {/* Both of these columns show a Meeting's field or a Report's, depending
          on the row, so both dropdowns carry both sets — grouped, since a
          value only ever applies to one kind. */}
      <label htmlFor="q-type">Type</label>
      <select id="q-type" value={fType} onChange={e=>setFType(e.target.value)}>
        <option>All</option>
        <optgroup label="Committee / Meeting">
          {SETUP_TYPES.map(t=><option key={t}>{t}</option>)}</optgroup>
        <optgroup label="Report Template">
          {REPORT_TYPES.map(t=><option key={t}>{t}</option>)}</optgroup>
      </select>
      <label htmlFor="q-cat">Category</label>
      <select id="q-cat" value={fCat} onChange={e=>setFCat(e.target.value)}>
        <option>All</option>
        <optgroup label="Committee / Meeting">
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}</optgroup>
        <optgroup label="Report Template">
          {REPORT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</optgroup>
      </select>
      <label htmlFor="q-stage">Stage</label>
      <select id="q-stage" value={fStage} onChange={e=>setFStage(e.target.value)}>
        <option>All</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
      <label htmlFor="q-status">Status</label>
      <select id="q-status" value={fStatus} onChange={e=>setFStatus(e.target.value)}>
        <option>All</option>{LIFECYCLE.map(s=><option key={s}>{s}</option>)}</select>
      {filtered?<Btn k="sm" onClick={clearAll}>Clear</Btn>:null}
    </div>

    <div className="card flush">
      <div className="t-wrap"><table className="data reg-table">
        <thead><tr><th>Setup name</th><th>Kind</th><th>Type</th><th>Category</th><th>Stage</th>
          <th>Scope and units</th><th>Frequency</th><th>Status</th><th className="reg-th-num">Ver</th><th>Updated</th>
          <th className="reg-th-actions"></th></tr></thead>
        <tbody>{rows.length===0 && dvRows.length===0
          ? <tr><td colSpan={11}><Empty>No Setup matches these filters.</Empty></td></tr>
          : <>{rows.map(s=>{
          const keys=scopeKeys(s), lv=stageLevel(s);
          const KindIcon=s.kind==='Report Template'?ClipboardList:CalendarDays;
          return <tr key={s.id} className="click" onClick={()=>open(s.id)}>
            <td><div className="t-main reg-name">
                <span className="reg-kind-ic" title={s.kind}><KindIcon size={13} strokeWidth={2.25}/></span>
                {displayName(s)}
              </div>
              {s.kind==='Report Template'?<div className="t-sub">{s.reportType} · {s.reportCategory}</div>:null}</td>
            <td className="dim">{s.kind}</td>
            <td>{s.kind==='Report Template'
              ?(s.reportType?<Tag c={REPORT_TYPE_TAG_COLOR[s.reportType]||'grey'}>{s.reportType}</Tag>:<span className="dim">—</span>)
              :<Tag c={s.setupType==='Accreditation Committee'?'purple':'blue'}>{s.setupType}</Tag>}</td>
            <td className="dim">{(s.kind==='Report Template'?s.reportCategory:s.category)||'—'}</td>
            <td className="dim">{(s.stage||'—').replace(/^Stage (\d) /,'$1 · ')}</td>
            <td className="dim" style={{fontSize:11.5,maxWidth:230}}
              title={keys.length?scopeNames(s).join(', '):''}>
              {scopeString(s)}
              {keys.length>1
                ? <div style={{marginTop:3}}><Tag c="teal">runs in {keys.length}{' '}
                    {LEVEL_WORD[lv]==='Region'?'regions':'units'}</Tag></div>
                : null}</td>
            <td className="dim">{s.frequency||'—'}</td>
            <td><StatusPill s={s.status}/></td>
            <td className="num">{s.version||'—'}</td>
            <td className="dim">{fmtD(s.updated)}</td>
            <td className="reg-actions" onClick={e=>e.stopPropagation()}>
              <Btn k="reg-open" onClick={()=>open(s.id)}>Open</Btn>
              {w?<Btn k="reg-act" onClick={()=>A.duplicate(s.id)}
                title="Copy this Setup, and everything in it, to a new Draft">Duplicate</Btn>:null}
              {canApprove&&s.status!=='Expired'
                ? <Btn k="reg-act dgr" onClick={()=>setConfirm(confirmFor(s,'expire'))}
                    title="Expire this Setup — it stays readable but creates no new occurrences">Expire</Btn>
                : null}
              <RowMenu items={[
                canApprove&&s.status==='Under Review'?{label:'Approve', onClick:()=>setConfirm(confirmFor(s,'approve'))}:null,
              ]}/>
            </td>
          </tr>;})}
          {dvRows.map(r=>{
            const isOpening=dvOpening===r.dvId;
            const isReport=r.dvKind==='Report Template';
            const KindIcon=isReport?ClipboardList:CalendarDays;
            // Every value below was derived once in dvFace() above — the same
            // ones the filter ran on, so a row can't display one thing and
            // filter as another.
            const {buNames,rgNames,unitCount,isRegionLevel,scopeLabel}=r;
            return <tr key={'dv-'+r.dvId} className={'click reg-shadow'+(isOpening?' opening':'')}
              onClick={()=>{ if(!isOpening) A.openDataverse(r.dvKind,r.dvId); }}>
              <td><div className="t-main reg-name">
                  <span className="reg-kind-ic" title={r.dvKind}><KindIcon size={13} strokeWidth={2.25}/></span>
                  {r.name}
                </div>
                <div className="t-sub">{isOpening?'Loading…':'Not loaded into this session yet — open to view/edit.'}</div></td>
              <td className="dim">{r.dvKind}</td>
              <td>{!r.type ? <span className="dim">—</span>
                : isReport
                  ? <Tag c={REPORT_TYPE_TAG_COLOR[r.type]||'grey'}>{r.type}</Tag>
                  : <Tag c={r.type==='Accreditation Committee'?'purple':'blue'}>{r.type}</Tag>}</td>
              <td className="dim">{r.category||'—'}</td>
              <td className="dim">{(r.stage||'—').replace(/^Stage (\d) /,'$1 · ')}</td>
              <td className="dim" style={{fontSize:11.5,maxWidth:230}}
                title={[...buNames,...rgNames].join(', ')}>
                {scopeLabel}
                {unitCount>1
                  ? <div style={{marginTop:3}}><Tag c="teal">runs in {unitCount}{' '}
                      {isRegionLevel?'regions':'units'}</Tag></div>
                  : null}</td>
              <td className="dim">{r.frequency||'—'}</td>
              <td title={r.statusAssumed
                ? 'Saved before this environment tracked lifecycle status — read as Active / Approved, which is what opening it would show.'
                : undefined}>
                <StatusPill s={r.status}/></td>
              <td className="num">{r.version??'—'}</td>
              <td className="dim">{r.updated?fmtD(r.updated.slice(0,10)):'—'}</td>
              <td className="reg-actions" onClick={e=>e.stopPropagation()}>
                <Btn k="reg-open" disabled={isOpening} onClick={()=>A.openDataverse(r.dvKind,r.dvId)}>
                  {isOpening?'Working…':'Open'}</Btn>
                {w?<Btn k="reg-act" disabled={isOpening} onClick={()=>A.duplicateDataverse(r.dvKind,r.dvId)}
                  title="Read this record in full and copy it, and everything in it, to a new Draft">Duplicate</Btn>:null}
                {canApprove&&r.status!=='Expired'
                  ? <Btn k="reg-act dgr" disabled={isOpening}
                      onClick={()=>setConfirm({_action:'expire', _dv:true, dvKind:r.dvKind, dvId:r.dvId,
                        name:r.name, kind:r.dvKind, version:r.version, scope:r.scopeLabel})}
                      title="Expire this Setup — it stays readable but creates no new occurrences">Expire</Btn>
                  : null}
              </td>
            </tr>;})}
          </>}
        </tbody></table></div>
    </div>

    {confirm?<Modal
      title={confirm._action==='approve'?'Approve this Setup?':'Expire this Setup?'}
      onClose={()=>setConfirm(null)}
      sub={confirm._action==='approve'
        ? 'It moves to Active / Approved and becomes available for records to be created from it.'
        : 'Nothing is deleted. An expired Setup creates no new occurrences and stays readable.'}
      footer={confirm._action==='approve'
        ? <><Btn onClick={()=>setConfirm(null)}>Cancel</Btn>
            <Btn k="pri" onClick={()=>{A.approve(confirm.id);setConfirm(null);}}>Approve</Btn></>
        : <><Btn onClick={()=>setConfirm(null)}>Keep it as it is</Btn>
            <Btn k="dgr" onClick={()=>{
              if(confirm._dv) A.expireDataverse(confirm.dvKind,confirm.dvId,confirm.name);
              else A.expire(confirm.id);
              setConfirm(null);
            }}>Expire the Setup</Btn></>}>
      <div className="readonly"><b>{confirm.name}</b>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
          {confirm.kind}{confirm.version?` · version ${confirm.version}`:''}
          {confirm.scope&&confirm.scope!=='—'?` · ${confirm.scope}`:''}</div></div>
    </Modal>:null}
  </>;
}

function Modal({title,sub,onClose,footer,children,wide}){
  useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);},[onClose]);
  return <div className="ovl" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className={'modal'+(wide?' wide':'')} role="dialog" aria-modal="true">
      <div className="m-hd"><div><h3>{title}</h3>{sub?<div className="msub">{sub}</div>:null}</div>
        <button type="button" className="m-x" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="m-bd">{children}</div>
      {footer?<div className="m-ft">{footer}</div>:null}
    </div></div>;
}

/* =========================================================================
   S5 — SETUP DETAIL AND ACTIVITY
   ========================================================================= */
function ScreenDetail({rec,onClose}){
  const {db,A,role}=use();
  const [tab,setTab]=useState('summary');
  const [confirmApprove,setConfirmApprove]=useState(false);
  const [confirmExpire,setConfirmExpire]=useState(false);
  const w=ROLES[role].write, canApprove=ROLES[role].approve;
  const usage=db.usage.filter(u=>u.setup===rec.id);
  const audit=db.audit.filter(a=>a.setup===rec.id).slice().reverse();
  const issues=validate(rec,db.setups);

  /* Real usage, read live from lm_meetingoccurrences / lm_reportoccurrences,
     filtered to this Setup's Dataverse Template id -- the seeded `usage` rows
     above only ever exist for the local demo Setups and never reflect a
     record actually created through the live app (an Ad Hoc from Setup, or a
     live Report Submission). Only runs once this Setup actually has a
     Dataverse id -- a Draft/local-only Setup has no Template row to match
     occurrences against yet. */
  const [dvUsage,setDvUsage]=useState([]);
  const [dvUsageLoading,setDvUsageLoading]=useState(false);
  const [dvUsageError,setDvUsageError]=useState(null);
  useEffect(()=>{
    const templateId=rec._dataverseId;
    if(!templateId){ setDvUsage([]); setDvUsageError(null); return; }
    let cancelled=false;
    setDvUsageLoading(true); setDvUsageError(null);
    const fetchFn = rec.kind==='Report Template' ? fetchReportOccurrencesByTemplate : fetchMeetingOccurrencesByTemplate;
    fetchFn(templateId)
      .then(rows=>{ if(!cancelled) setDvUsage(rows||[]); })
      .catch(e=>{
        console.warn('[dataverse] fetching live usage failed:', e);
        if(!cancelled) setDvUsageError('Live usage could not be read from Dataverse.');
      })
      .finally(()=>{ if(!cancelled) setDvUsageLoading(false); });
    return ()=>{cancelled=true;};
  },[rec._dataverseId, rec.kind]);

  return <>
    <div className="crumb"><a onClick={onClose}>Setup Register</a> › <b>{displayName(rec)}</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{displayName(rec)}</h1>
        <div className="sub">{rec.kind} · version {rec.version||'—'} · <StatusPill s={rec.status}/>
          {rec.confidentiality?<> · <Tag c="grey">{rec.confidentiality}</Tag></>:null}</div>
        <div className="sub" style={{marginTop:4}}>{scopeString(rec)}</div></div>
      {canApprove&&rec.status==='Under Review'?<Btn k="pri" onClick={()=>setConfirmApprove(true)}>Approve</Btn>:null}
      {w&&rec.status!=='Expired'?<Btn onClick={()=>A.edit(rec.id)}>Edit</Btn>:null}
      {w?<Btn onClick={()=>A.duplicate(rec.id)}
        title="Copy this Setup, and everything in it, to a new Draft">Duplicate</Btn>:null}
      {canApprove&&rec.status!=='Expired'
        ? <Btn k="dgr" onClick={()=>setConfirmExpire(true)}
            title="Expire this Setup — it stays readable but creates no new occurrences">Expire</Btn>
        : null}
      <Btn onClick={onClose}>Close</Btn>
    </div>

    {rec.status==='Expired'
      ? <Note k="lock" ic="—">This Setup is Expired. It creates no new occurrences and cannot be
          edited. It stays readable so its history and prior records remain traceable.</Note>
      : null}
    {rec.status==='Under Review'
      ? <Note k="info" ic="i">This Setup is Under Review. It needs to be Approved before records are
          created from it. {canApprove
            ? 'Use Edit to change it further, or Approve it as-is.'
            : 'Approval is an Administrator action — turn on the Administrator toggle in the top bar to approve it.'}</Note>
      : null}
    {issues.length>0 && rec.status!=='Expired'
      ? <Note k="warn" ic="⚠"><b>{issues.length} rule{issues.length>1?'s are':' is'} unmet.</b> This Setup
          cannot be published until they are resolved. Open Edit to see them field by field.</Note>
      : null}

    {confirmApprove?<Modal title="Approve this Setup?" onClose={()=>setConfirmApprove(false)}
      sub="It moves to Active / Approved and becomes available for records to be created from it."
      footer={<><Btn onClick={()=>setConfirmApprove(false)}>Cancel</Btn>
        <Btn k="pri" onClick={()=>{A.approve(rec.id);setConfirmApprove(false);}}>Approve</Btn></>}>
      <div className="readonly"><b>{displayName(rec)}</b>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
          {rec.kind} · version {rec.version||'—'} · {scopeString(rec)}</div></div>
    </Modal>:null}

    {confirmExpire?<Modal title="Expire this Setup?" onClose={()=>setConfirmExpire(false)}
      sub="Nothing is deleted. An expired Setup creates no new occurrences and stays readable."
      footer={<><Btn onClick={()=>setConfirmExpire(false)}>Keep it as it is</Btn>
        <Btn k="dgr" onClick={()=>{A.expire(rec.id);setConfirmExpire(false);}}>Expire the Setup</Btn></>}>
      <div className="readonly"><b>{displayName(rec)}</b>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
          {rec.kind} · version {rec.version||'—'} · {scopeString(rec)}</div></div>
    </Modal>:null}

    <div className="tabs">
      <button type="button" className={tab==='summary'?'on':''}
        onClick={()=>setTab('summary')}>Summary</button>
      <button type="button" className={tab==='usage'?'on':''}
        onClick={()=>setTab('usage')}>Usage<span className="c">{usage.length+dvUsage.length}</span></button>
      <button type="button" className={tab==='activity'?'on':''}
        onClick={()=>setTab('activity')}>Activity<span className="c">{audit.length}</span></button>
    </div>

    {tab==='summary'
      ? (rec.kind==='Report Template' ? <ReportSummary s={rec}/> : <MeetingSummary s={rec}/>)
      : null}

    {tab==='usage'? <div className="card flush">
      <div className="card-hd"><h2>Records created from this Setup</h2>
        <div className="csub">{rec._dataverseId
          ? `Read live from ${rec.kind==='Report Template'?'lm_reportoccurrences':'lm_meetingoccurrences'}, filtered to this Setup's Template.`
          : 'This Setup has no Dataverse Template yet, so live usage cannot be checked.'}
          {' '}Each carries the unit it was held in.</div></div>
      {dvUsageError && <div style={{padding:'8px 17px 0'}}><Note k="warn" ic="⚠">{dvUsageError}</Note></div>}
      {dvUsageLoading
        ? <div style={{padding:'8px 17px 17px'}}><Empty>Reading live usage from Dataverse…</Empty></div>
        : (usage.length===0 && dvUsage.length===0) ? <div style={{padding:'8px 17px 17px'}}>
            <Empty>No records yet.</Empty></div> :
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Record</th><th>Held in</th><th>Type</th><th>Created</th>
          <th>Status / Setup version</th></tr></thead>
        <tbody>
          {dvUsage.map(o=>
            <tr key={'dv-'+o.id}>
              <td className="t-main">{o.name}
                <div className="t-sub">{o.date?fmtD(o.date):o.period?fmtD(o.period):null}</div></td>
              <td className="dim">{unitLabel(rec,o.businessUnitId||o.regionId)||'—'}</td>
              <td className="dim">{rec.kind==='Report Template'?'Report Submission':'Meeting Occurrence'}</td>
              <td className="dim">{o.created?fmtD(o.created.slice(0,10)):'—'}</td>
              <td><Tag c="teal">{o.status||'—'}</Tag></td>
            </tr>)}
          {usage.map(u=>
            <tr key={u.id}><td className="t-main">{u.record}</td>
              <td className="dim">{u.unit?unitLabel(rec,u.unit):'—'}</td>
              <td className="dim">{u.type}</td><td className="dim">{fmtD(u.created)}</td>
              <td><Tag c={u.setupVersion===rec.version?'green':'grey'}>version {u.setupVersion}</Tag></td>
            </tr>)}
        </tbody></table></div>}
    </div>:null}

    {tab==='activity'? <div className="card flush">
      <div className="card-hd"><h2>Activity</h2>
        <div className="csub">Every state change, newest first, with the value before and after.</div></div>
      {audit.length===0?<Empty>Nothing recorded yet.</Empty>:
      <table className="data">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Field</th><th>Before</th><th>After</th></tr></thead>
        <tbody>{audit.map(a=>
          <tr key={a.id}><td className="dim" style={{whiteSpace:'nowrap'}}>{a.at}</td>
            <td className="dim">{a.actor}</td>
            <td><Tag c={a.action==='Published'?'green':a.action==='Expired'?'grey':'teal'}>{a.action}</Tag></td>
            <td className="dim">{a.field}</td>
            <td className="dim">{a.before||'—'}</td>
            <td className="t-main">{a.after||'—'}</td></tr>)}
        </tbody></table>}
    </div>:null}
  </>;
}

/* =========================================================================
   S4 — GOVERNED LISTS VIEWER
   ========================================================================= */
const LIST_DEFS=[
  {id:'region',       name:'Region',
   rows:()=>REGIONS.map(x=>[x.name,x.tz]),
   note:'The cascade starts here. Organization is not part of a Setup.'},
  {id:'bu',           name:'Business Unit',  parent:'Region',
   parentOpts:()=>REGIONS.map(x=>({v:x.id,label:x.name})),
   rows:p=>BUSINESS_UNITS.filter(b=>!p||b.region===p).map(x=>[x.name,nameOf(REGIONS,x.region)])},
  {id:'dept',         name:'Department',     parent:'Business Unit',
   parentOpts:()=>BUSINESS_UNITS.map(x=>({v:x.id,label:x.name})),
   rows:p=>DEPARTMENTS.filter(d=>deptInBu(d.id,p)).map(x=>[x.name,deptBuNames(x.id)]),
   note:'A Setup selects Departments by name, so the same Department covers every unit it runs in.'},
  {id:'section',      name:'Section / Specialty', parent:'Business Unit',
   parentOpts:()=>BUSINESS_UNITS.map(x=>({v:x.id,label:x.name})),
   rows:p=>SECTIONS.filter(s=>!p||s.bu===p).map(x=>[x.name,nameOf(BUSINESS_UNITS,x.bu)]),
   note:'Only some Business Units have Specialties. Choosing one without any shows an empty list.'},
  {id:'function',     name:'Function',       parent:'Department',
   parentOpts:()=>DEPARTMENTS.map(x=>({v:x.id,label:`${x.name} · ${deptBuNames(x.id)}`})),
   rows:p=>FUNCTIONS.filter(f=>!p||f.dept===p).map(x=>[x.name,nameOf(DEPARTMENTS,x.dept)])},
  {id:'naming',       name:'How a name is built',
   rows:()=>STAGES.map((st,i)=>[st, STAGE_PREFIX[i]||'(no prefix)'])
     .concat(Object.keys(CLASS_NOUN).map(c=>[c, CLASS_NOUN[c]]))
     .concat([[TOT,'Team of Teams — <Department>'],
              ['Accreditation Committee (Setup Type)','Committee']]),
   note:'A Setup is never named by hand. The name is [Stage prefix] [Function or Department] '+
        '[Classification], with any repeated word dropped.'},
  {id:'positions',    name:'Positions',      filterPositions:true,
   rows:()=>POSITIONS.map(p=>[p.name, nameOf(BUSINESS_UNITS,p.bu)||'—',
     nameOf(DEPARTMENTS,p.dept)||'—', nameOf(FUNCTIONS,p.fn)||'—', p.holder||'—']),
   note:'One row per assignment (Position + Business Unit + current employee), not one per Position title.'},
  {id:'teams',        name:'Teams',
   rows:()=>TEAMS.map(t=>{ const n=channelsIn(t.id).length;
     return [t.name, `${n} channel${n===1?'':'s'}`]; }),
   note:'Read from the Teams Channels table. A Team is not a record of its own — it is the name '+
     'its Channels carry, which is why it has no Business Unit or Region of its own.'},
  {id:'channels',     name:'Channels',       parent:'Team',
   parentOpts:()=>TEAMS.map(t=>({v:t.id,label:t.name})),
   rows:p=>CHANNELS.filter(c=>!p||c.team===p)
     .map(x=>[x.name, x.team||'—', channelPath(x.id)||'—', x.link||'—']),
   note:'Channel, Team, SharePoint path, then the Teams channel link. The SharePoint path is the '+
     'Site Path, Document Library and Folder joined — it is what auto-fills a Report '+
     'Template’s Source link when that Channel is chosen.'},
  {id:'sites',        name:'Sites',
   rows:()=>SITES.map(x=>{ const n=LIBRARIES.filter(l=>l.site===x.id).length;
     return [x.name, `${n} librar${n===1?'y':'ies'}`]; }),
   note:'Read from the SharePoint Site Path on the Teams Channels table — one row per distinct path.'},
  {id:'libraries',    name:'Libraries',      parent:'Site',
   parentOpts:()=>SITES.map(x=>({v:x.id,label:x.name})),
   rows:p=>LIBRARIES.filter(l=>!p||l.site===p).map(x=>[x.name,nameOf(SITES,x.site)]),
   note:'Read from the Document Library on the Teams Channels table, under the Site Path it sits in.'},
  {id:'folders',      name:'Folders',        cascade2:true,
   note:'A Folder belongs to a Library, which belongs to a Site. Choose both. All three are read '+
     'from the Teams Channels table.'},
  {id:'processes',    name:'Processes',      filterByBuDept:true,
   rows:()=>PROCESSES.map(p=>[p])},
  {id:'kpis',         name:'KPIs',           filterByBuDept:true,
   rows:()=>KPIS.map(k=>[k])},
];

function ScreenLists(){
  const [cur,setCur]=useState('region');
  const [parent,setParent]=useState(null);
  const [site,setSite]=useState(null); const [lib,setLib]=useState(null);
  const [buF,setBuF]=useState(null); const [deptF,setDeptF]=useState(null); const [fnF,setFnF]=useState(null);
  const def=LIST_DEFS.find(l=>l.id===cur);
  const libs=LIBRARIES.filter(l=>l.site===site);
  const deptOptsForBu=DEPARTMENTS.filter(d=>deptInBu(d.id,buF));
  const fnOptsForDept=FUNCTIONS.filter(fn=>!deptF||fn.dept===deptF);
  const deptByName=cur==='kpis'?KPI_DEPT_BY_NAME:PROCESS_DEPT_BY_NAME;
  const reset=()=>{setParent(null);setSite(null);setLib(null);setBuF(null);setDeptF(null);setFnF(null);};
  const rows=def.cascade2
    ? (site&&lib ? FOLDERS.filter(f=>f.library===lib).map(f=>[f.name,nameOf(LIBRARIES,f.library),nameOf(SITES,site)]) : null)
    : def.filterByBuDept
      ? def.rows().filter(r=>{
          const dId=deptByName[r[0]];
          if(deptF) return dId===deptF;
          if(buF){ return dId && deptInBu(dId,buF); }
          return true;
        }).map(r=>{
          const dId=deptByName[r[0]], d=byId(DEPARTMENTS,dId);
          return [r[0], d?d.name:'—', d?deptBuNames(d.id):'—'];
        })
      : def.filterPositions
        ? POSITIONS.filter(p=>
            (!buF||p.bu===buF) && (!deptF||p.dept===deptF) && (!fnF||p.fn===fnF)
          ).map(p=>[p.name, nameOf(BUSINESS_UNITS,p.bu)||'—',
            nameOf(DEPARTMENTS,p.dept)||'—', nameOf(FUNCTIONS,p.fn)||'—', p.holder||'—'])
        : def.rows(parent);

  return <>
    <div className="ph"><h1>Governed Lists</h1>
      <div className="sub">The controlled value lists every Setup selects from. Selecting a parent narrows
        the child list — the same cascade the wizards use.</div></div>

    <Note k="lock" ic="—"><b>Taxonomy-owned. Read-only in Leadership Practice.</b>
      {' '}Values are selected from these lists and can never be added, edited or deleted here —
      they are maintained in the Taxonomy application.</Note>

    <div className="lists">
      <nav className="lists-rail" aria-label="Governed lists">
        {LIST_DEFS.map(l=>
          <button type="button" key={l.id} className={(cur===l.id?'on':'')+(l.locked?' locked':'')}
            disabled={l.locked} title={l.locked?l.lockedHint:undefined}
            onClick={()=>{ if(l.locked) return; setCur(l.id); reset(); }}>
            {l.name}{l.locked?<span className="seg-lock" aria-hidden="true"> 🔒</span>:null}</button>)}
      </nav>
      <div className="card" style={{flex:1,minWidth:0,marginBottom:0}}>
        <h2>{def.name}</h2>
        <div className="csub">{def.note||'Read-only reference data.'}</div>

        {def.parent? <div className="fltr" style={{marginBottom:12}}>
          <label htmlFor="lp">{def.parent}</label>
          <select id="lp" value={parent||''} onChange={e=>setParent(e.target.value||null)}>
            <option value="">All</option>
            {def.parentOpts().map(o=><option key={o.v} value={o.v}>{o.label}</option>)}</select>
          {parent?<Btn k="sm" onClick={()=>setParent(null)}>Clear</Btn>:null}
        </div>:null}

        {def.cascade2? <div className="fltr" style={{marginBottom:12}}>
          <label htmlFor="ls">Site</label>
          <select id="ls" value={site||''} onChange={e=>{setSite(e.target.value||null);setLib(null);}}>
            <option value="">Select…</option>
            {SITES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <label htmlFor="ll">Library</label>
          <select id="ll" value={lib||''} disabled={!site} onChange={e=>setLib(e.target.value||null)}>
            <option value="">{site?'Select…':'Choose a Site first'}</option>
            {libs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>:null}

        {def.filterByBuDept||def.filterPositions? <div className="fltr" style={{marginBottom:12}}>
          <label htmlFor="pf-bu">Business Unit</label>
          <select id="pf-bu" value={buF||''} onChange={e=>{setBuF(e.target.value||null);setDeptF(null);setFnF(null);}}>
            <option value="">All</option>
            {BUSINESS_UNITS.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <label htmlFor="pf-dept">Department</label>
          <select id="pf-dept" value={deptF||''} onChange={e=>{setDeptF(e.target.value||null);setFnF(null);}}>
            <option value="">All</option>
            {deptOptsForBu.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          {def.filterPositions? <>
            <label htmlFor="pf-fn">Function</label>
            <select id="pf-fn" value={fnF||''} onChange={e=>setFnF(e.target.value||null)}>
              <option value="">All</option>
              {fnOptsForDept.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </>:null}
          {(buF||deptF||fnF)?<Btn k="sm" onClick={()=>{setBuF(null);setDeptF(null);setFnF(null);}}>Clear</Btn>:null}
        </div>:null}

        {rows===null
          ? <Empty>Choose a Site and a Library to list its Folders.</Empty>
          : rows.length===0
            ? <Empty>No values for this parent.</Empty>
            : <div className="t-wrap"><table className="data">
                <tbody>{rows.map((r,i)=>
                  <tr key={i}>{r.map((c,j)=>
                    <td key={j} className={j?'dim':'t-main'}>{c}</td>)}</tr>)}
                </tbody></table></div>}
        <div className="list-count">{rows===null?'—':rows.length+' value'+(rows.length===1?'':'s')}</div>
      </div>
    </div>
  </>;
}

/* =========================================================================
   APP — in-memory state only. No storage, no network.
   ========================================================================= */
function App({onSwitch}){
  const [db,setDb]=useState(loadDb);
  /* the name rules need to see every other Setup to spot a collision */
  ALL_SETUPS.current=db.setups;
  useEffect(()=>{ saveDb(db); },[db]);

  /* Regions, Business Units, Departments, Functions, Processes and KPIs,
     read live from Dataverse. Falls back silently to the built-in lists
     above if a data source isn't wired yet or isn't reachable (e.g.
     running with plain `npm run dev` instead of `pac code run`) --
     everything that reads these mutable module-level lists keeps working
     either way, one table at a time so a failure on one doesn't block
     the others. */
  const [refDataTick,setRefDataTick]=useState(0);
  const [dvReports,setDvReports]=useState([]);
  const [dvMeetings,setDvMeetings]=useState([]);
  const [dvOpening,setDvOpening]=useState(null); // id currently being fetched+opened/duplicated, for a loading state
  /* Re-reads both register listings from Dataverse. Run on mount, and again
     after any action that changes what's in those tables (duplicate creates
     a row, expire changes a row's status) so the register reflects the
     tables rather than a snapshot taken when the app loaded. */
  const refreshDvLists=async()=>{
    try{
      const list=await fetchReportTemplatesList();
      console.log(`[dataverse] fetchReportTemplatesList() returned ${list?list.length:0} row(s)`, list);
      setDvReports(list||[]);
    }catch(e){ console.warn('[dataverse] fetchReportTemplatesList() failed:', e); }
    try{
      const list=await fetchMeetingTemplatesList();
      console.log(`[dataverse] fetchMeetingTemplatesList() returned ${list?list.length:0} row(s)`, list);
      setDvMeetings(list||[]);
    }catch(e){ console.warn('[dataverse] fetchMeetingTemplatesList() failed:', e); }
  };
  useEffect(()=>{ refreshDvLists(); },[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      let changed=false;
      try{
        const regions=await fetchRegions();
        if(cancelled) return;
        console.log(`[dataverse] fetchRegions() returned ${regions?regions.length:0} row(s)`, regions);
        if(regions&&regions.length){ REGIONS=regions; changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchRegions() failed, using built-in list:', e);
      }
      try{
        const units=await fetchBusinessUnits();
        if(cancelled) return;
        console.log(`[dataverse] fetchBusinessUnits() returned ${units?units.length:0} row(s)`, units);
        if(units&&units.length){ BUSINESS_UNITS=units; changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchBusinessUnits() failed, using built-in list:', e);
      }
      try{
        const depts=await fetchDepartments();
        if(cancelled) return;
        console.log(`[dataverse] fetchDepartments() returned ${depts?depts.length:0} row(s)`, depts);
        if(depts&&depts.length){ DEPARTMENTS=depts; changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchDepartments() failed, using built-in list:', e);
      }
      try{
        const fns=await fetchFunctions();
        if(cancelled) return;
        console.log(`[dataverse] fetchFunctions() returned ${fns?fns.length:0} row(s)`, fns);
        if(fns&&fns.length){ FUNCTIONS=fns; changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchFunctions() failed, using built-in list:', e);
      }
      try{
        const procs=await fetchProcesses();
        if(cancelled) return;
        console.log(`[dataverse] fetchProcesses() returned ${procs?procs.length:0} row(s)`, procs);
        if(procs&&procs.length){
          PROCESS_ID_BY_NAME={}; PROCESS_DEPT_BY_NAME={};
          procs.forEach(p=>{ PROCESS_ID_BY_NAME[p.name]=p.id; PROCESS_DEPT_BY_NAME[p.name]=p.dept??null; });
          PROCESSES=procs.map(p=>p.name); changed=true;
        }
      }catch(e){
        console.warn('[dataverse] fetchProcesses() failed, using built-in list:', e);
      }
      try{
        const kpis=await fetchKpis();
        if(cancelled) return;
        console.log(`[dataverse] fetchKpis() returned ${kpis?kpis.length:0} row(s)`, kpis);
        if(kpis&&kpis.length){
          KPI_ID_BY_NAME={}; KPI_DEPT_BY_NAME={};
          kpis.forEach(k=>{ KPI_ID_BY_NAME[k.name]=k.id; KPI_DEPT_BY_NAME[k.name]=k.dept??null; });
          KPIS=kpis.map(k=>k.name); changed=true;
        }
      }catch(e){
        console.warn('[dataverse] fetchKpis() failed, using built-in list:', e);
      }
      try{
        const secs=await fetchSections();
        if(cancelled) return;
        console.log(`[dataverse] fetchSections() returned ${secs?secs.length:0} row(s)`, secs);
        if(secs&&secs.length){ SECTIONS=secs; changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchSections() failed, using built-in list:', e);
      }
      try{
        const positions=await fetchPositions();
        if(cancelled) return;
        console.log(`[dataverse] fetchPositions() returned ${positions?positions.length:0} row(s)`, positions);
        if(positions&&positions.length){
          POSITIONS=positions;
          // Same rows give the Department <-> Business Unit relationship.
          const {buIdsByDept}=departmentBuIndex(positions);
          DEPT_BUS={}; buIdsByDept.forEach((set,deptId)=>{ DEPT_BUS[deptId]=set; });
          changed=true;
        }
      }catch(e){
        console.warn('[dataverse] fetchPositions() failed, using built-in list:', e);
      }
      try{
        const tc=await fetchTeamsChannels();
        if(cancelled) return;
        console.log(`[dataverse] fetchTeamsChannels() returned ${tc?tc.length:0} channel row(s)`, tc);
        // Set even when empty: unlike the lists above there is no built-in
        // fallback to preserve -- Teams/Channels are whatever the table says,
        // and an empty table should show as empty, not as stale mock data.
        if(tc){ setTeamsChannels(tc); changed=true; }
      }catch(e){
        console.warn('[dataverse] fetchTeamsChannels() failed -- Team/Channel pickers will be empty:', e);
      }
      if(changed&&!cancelled) setRefDataTick(t=>t+1);
    })();
    return ()=>{cancelled=true;};
  },[]);
  /* Who is signed in, linked to their Dataverse systemusers row. Null while
     still loading, and stays null when there's no Power Apps host to ask
     (e.g. plain `npm run dev`) -- the top bar just falls back to the role
     label in that case. */
  const [currentUser,setCurrentUser]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const u=await fetchCurrentUser();
        if(cancelled) return;
        console.log('[dataverse] fetchCurrentUser() returned', u);
        setCurrentUser(u);
      }catch(e){ console.warn('[dataverse] fetchCurrentUser() failed:', e); }
    })();
    return ()=>{cancelled=true;};
  },[]);

  /* Administrator toggle. Off = Setup Author: authors and publishes, but
     cannot approve. On = Setup Administrator: can also approve and expire. */
  const [isAdmin,setIsAdmin]=useState(false);
  const role=isAdmin?'admin':'author';
  const [screen,setScreen]=useState('register');
  const [openId,setOpenId]=useState(null);
  const [editing,setEditing]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [navOpen,setNavOpen]=useState(true);

  const toast=(title,body,k)=>{const id=uid('t');
    setToasts(t=>t.concat({id,title,body,k}));
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),5200);};
  const mut=fn=>setDb(p=>{const n={setups:p.setups.map(s=>({...s})),
    usage:p.usage.slice(), audit:p.audit.slice()}; fn(n); return n;});

  /* The audit trail names the real signed-in person when we know who they
     are, with the role they acted in -- falling back to the role alone when
     there's no host identity to read. */
  const actorName=()=>currentUser?.fullName
    ? `${currentUser.fullName} (${ROLES[role].label})`
    : ROLES[role].label;
  const logIt=(n,setupId,action,field,before,after)=>
    n.audit.push({id:uid('g'),setup:setupId,at:stamp(),actor:actorName(),
                  action,field,before:before==null?'—':String(before),
                  after:after==null?'—':String(after)});

  /* fields worth naming individually in the audit trail */
  const TRACKED=[['name','Name'],['setupType','Setup Type'],['category','Type / Classification'],
    ['stage','Stage'],['function','Function'],['frequency','Frequency'],
    ['quorum','Quorum Threshold %'],['torLink','TOR / Policy link'],
    ['confidentiality','Confidentiality'],['delivery','Report Delivery'],
    ['reportType','Report Type'],['mode','Default Meeting Mode']];
  const showVal=(k,v)=>{
    if(v==null||v==='') return '—';
    return String(v);
  };
  /* the scope multiplies, so a change of units is a governance change worth naming */
  const unitsVal=f=>{const k=scopeKeys(f);
    return k.length ? `${k.length} × ${LEVEL_WORD[stageLevel(f)]||'unit'} — ${scopeNames(f).join(', ')}`
                    : '—';};
  const depVal=f=>(f.departments||[]).join(', ')||'—';
  const logDerived=(n,prev,f)=>{
    if(unitsVal(prev)!==unitsVal(f)) logIt(n,f.id,'Edited','Units covered',unitsVal(prev),unitsVal(f));
    if(depVal(prev)!==depVal(f)) logIt(n,f.id,'Edited','Departments',depVal(prev),depVal(f));
  };

  /* Fire-and-forget Dataverse write shared by saveDraft and publish -- both
     now persist to Dataverse, the only difference being what status/version
     the caller already baked into `f` before calling this. Never blocks or
     reverses the local save that already succeeded; a failed/partial
     Dataverse write just surfaces as a follow-up toast.

     A Setup that already has a _dataverseId (opened from Dataverse, or a
     prior save that created one) is UPDATED in place -- its old child rows
     are deleted and rows matching the edited Setup are recreated. A
     brand-new Setup is created fresh. */
  const writeTemplateToDataverse=(f, actionLabel)=>{
    const isUpdate = !!f._dataverseId;
    if(f.kind==='Report Template'){
      const writer = isUpdate
        ? updateReportTemplateToDataverse(f._dataverseId, buildReportTemplatePayload(f))
        : saveReportTemplateToDataverse(buildReportTemplatePayload(f));
      writer
        .then(({id,errors})=>{
          if(!id){
            console.warn(`[dataverse] Report Template ${isUpdate?'update':'save'} failed entirely:`, errors);
            toast('Dataverse save failed',
              `${displayName(f)} was ${actionLabel} locally, but the Dataverse ${isUpdate?'update':'write'} failed. Check the console for details.`,'err');
            return;
          }
          if(!isUpdate){
            REPORT_DATAVERSE_ID={...REPORT_DATAVERSE_ID, [f.id]:id}; saveReportDvIds(REPORT_DATAVERSE_ID);
            mut(n=>{ const i=n.setups.findIndex(x=>x.id===f.id);
              if(i>=0) n.setups[i]={...n.setups[i], _dataverseId:id}; });
          }
          if(errors.length){
            console.warn(`[dataverse] Report Template ${isUpdate?'updated':'saved'} with some child rows failing:`, errors);
            toast(`Report Template ${isUpdate?'updated':'saved'}, with gaps`,
              `${errors.length} related row(s) (${errors.map(e=>e.table).join(', ')}) failed to save. Check the console for details.`,'warn');
          }else{
            console.log(`[dataverse] Report Template ${isUpdate?'updated':'saved'}:`, id);
          }
          // Refresh so the register and the Linked Report Templates picker
          // pick up the new/updated row instead of the snapshot from mount.
          refreshDvLists();
        })
        .catch(e=>{
          console.warn(`[dataverse] Report Template ${isUpdate?'update':'save'} threw unexpectedly:`, e);
          toast('Dataverse save failed',
            `${displayName(f)} was ${actionLabel} locally, but the Dataverse ${isUpdate?'update':'write'} failed. Check the console for details.`,'err');
        });
    }
    if(f.kind==='Committee / Meeting'){
      const writer = isUpdate
        ? updateMeetingTemplateToDataverse(f._dataverseId, buildMeetingTemplatePayload(f))
        : saveMeetingTemplateToDataverse(buildMeetingTemplatePayload(f));
      writer
        .then(({id,errors})=>{
          if(!id){
            console.warn(`[dataverse] Meeting Template ${isUpdate?'update':'save'} failed entirely:`, errors);
            toast('Dataverse save failed',
              `${displayName(f)} was ${actionLabel} locally, but the Dataverse ${isUpdate?'update':'write'} failed. Check the console for details.`,'err');
            return;
          }
          if(!isUpdate){
            mut(n=>{ const i=n.setups.findIndex(x=>x.id===f.id);
              if(i>=0) n.setups[i]={...n.setups[i], _dataverseId:id}; });
          }
          if(errors.length){
            console.warn(`[dataverse] Meeting Template ${isUpdate?'updated':'saved'} with some child rows failing:`, errors);
            toast(`Meeting Template ${isUpdate?'updated':'saved'}, with gaps`,
              `${errors.length} related row(s) (${errors.map(e=>e.table).join(', ')}) failed to save. Check the console for details.`,'warn');
          }else{
            console.log(`[dataverse] Meeting Template ${isUpdate?'updated':'saved'}:`, id);
          }
          // Refresh so the register and the Linked Report Templates picker
          // pick up the new/updated row instead of the snapshot from mount.
          refreshDvLists();
        })
        .catch(e=>{
          console.warn(`[dataverse] Meeting Template ${isUpdate?'update':'save'} threw unexpectedly:`, e);
          toast('Dataverse save failed',
            `${displayName(f)} was ${actionLabel} locally, but the Dataverse ${isUpdate?'update':'write'} failed. Check the console for details.`,'err');
        });
    }
  };

  /* Reads a Report/Meeting Template that lives in Dataverse into a real
     Setup object. Shared by opening one, and by duplicating/expiring one
     straight from its register row without opening it first. */
  const loadDvSetup=async(kind,dvId)=> kind==='Report Template'
    ? dataverseReportToSetup(await fetchReportTemplateDetail(dvId))
    : dataverseMeetingToSetup(await fetchMeetingTemplateDetail(dvId));

  /* Duplicates a Setup, carrying every piece of its content across, and
     creates the copy in Dataverse straight away as a Draft -- parent row
     plus every child row (per-unit Business Unit/Region rows and their
     chairs/reviewers/attendees, agenda, checklist, lines, KPIs, processes,
     supportive functions, linked reports), via the same create path a
     brand-new Setup uses.

     The copy is always a NEW Dataverse record: _dataverseId is dropped
     before the write and set from whatever the create returns, so editing
     or publishing the copy can never reach back and overwrite the original.
     Every nested row gets a fresh local id for the same reason. */
  const duplicateFrom=async src=>{
    const nid=uid('su');
    const copy={...src, id:nid, status:'Draft', version:0, updated:TODAY,
      _dataverseId:undefined,
      qualifier:((src.qualifier||'')+' copy').trim(),
      regions:(src.regions||[]).slice(),
      businessUnits:(src.businessUnits||[]).slice(),
      lines:(src.lines||[]).map(l=>({...l,id:uid('ln')})),
      checklist:(src.checklist||[]).map(c=>({...c,id:uid('ck')})),
      agenda:(src.agenda||[]).map(a=>({...a,id:uid('ag')})),
      supportive:(src.supportive||[]).slice(),
      kpis:(src.kpis||[]).slice(),
      processes:(src.processes||[]).slice(),
      linkedTemplates:(src.linkedTemplates||[]).map(t=>({...t})),
      units:(src.units||[]).map(u=>({...u, id:uid('un'),
        coreMembers:(u.coreMembers||[]).map(m=>({...m,id:uid('cm')})),
        reviewChain:(u.reviewChain||[]).slice()}))};
    copy.name=derivedName(copy);

    mut(n=>{ n.setups.push(copy);
      logIt(n,nid,'Created','Lifecycle Status','—','Draft — duplicated from '+displayName(src)); });

    const saver = copy.kind==='Report Template'
      ? saveReportTemplateToDataverse : saveMeetingTemplateToDataverse;
    const payload = copy.kind==='Report Template'
      ? buildReportTemplatePayload(copy) : buildMeetingTemplatePayload(copy);
    try{
      const {id:newDvId, errors} = await saver(payload);
      if(!newDvId){
        console.warn('[dataverse] Duplicate failed entirely:', errors);
        toast('Duplicate not saved',
          `"${displayName(src)}" was copied in this session, but creating the copy in Dataverse failed. Check the console for details.`,'err');
        return copy;
      }
      // Link the local copy to the row that was just created, so a later
      // edit updates that row instead of creating yet another one.
      mut(n=>{ const i=n.setups.findIndex(x=>x.id===nid);
        if(i>=0) n.setups[i]={...n.setups[i], _dataverseId:newDvId}; });
      if(copy.kind==='Report Template'){
        REPORT_DATAVERSE_ID={...REPORT_DATAVERSE_ID, [nid]:newDvId}; saveReportDvIds(REPORT_DATAVERSE_ID);
      }
      if(errors.length){
        console.warn('[dataverse] Duplicate created with some child rows failing:', errors);
        toast('Duplicated, with gaps',
          `The copy was created as a Draft, but ${errors.length} related row(s) (${errors.map(e=>e.table).join(', ')}) failed. Check the console for details.`,'warn');
      }else{
        console.log('[dataverse] Duplicated as', newDvId);
        toast('Setup duplicated',
          `"${displayName(src)}" was copied to Dataverse as a Draft, with all of its related rows. It carries the qualifier "copy" so the two names differ.`,'ok');
      }
      refreshDvLists();
    }catch(e){
      console.warn('[dataverse] Duplicate threw unexpectedly:', e);
      toast('Duplicate not saved',
        `"${displayName(src)}" was copied in this session, but creating the copy in Dataverse failed. Check the console for details.`,'err');
    }
    return copy;
  };

  const A={
    create:kind=>{const id=uid('su');
      mut(n=>{const base=kind==='Report Template'?BLANK_REPORT:BLANK_MEETING;
        n.setups.push({...base,id,kind,updated:TODAY});
        logIt(n,id,'Created','Lifecycle Status','—','Draft');});
      setOpenId(id); setEditing(true); setScreen('register'); window.scrollTo({top:0});},

    open:id=>{setOpenId(id); setEditing(false); setScreen('register'); window.scrollTo({top:0});},

    /* Opens a Report/Meeting Template that lives in Dataverse but not in
       this session's local `db` yet: fetches the full record, converts it
       into a real Setup object (dataverseReportToSetup/
       dataverseMeetingToSetup), adds it to db.setups (so it behaves like
       any other Setup from here on -- same detail view, same wizard), then
       opens it. Re-opening the same Dataverse record replaces the earlier
       local copy rather than duplicating it, so edits don't pile up stale
       versions in the register. */
    openDataverse: async(kind,dvId)=>{
      const localId='dv-'+(kind==='Report Template'?'rpt':'mtg')+'-'+dvId;
      setDvOpening(dvId);
      try{
        const setup = await loadDvSetup(kind,dvId);
        mut(n=>{
          const i=n.setups.findIndex(x=>x.id===localId);
          if(i>=0) n.setups[i]=setup; else n.setups.push(setup);
        });
        setOpenId(localId); setEditing(false); setScreen('register'); window.scrollTo({top:0});
      }catch(e){
        console.warn(`[dataverse] Failed to open ${kind} ${dvId}:`, e);
        toast('Could not open record', 'Reading this record from Dataverse failed. Check the console for details.', 'err');
      }finally{
        setDvOpening(null);
      }
    },

    edit:id=>{ mut(n=>{const s=n.setups.find(x=>x.id===id);
        if(s.status==='Active / Approved'){
          logIt(n,id,'Edit opened','Lifecycle Status',s.status,'Under Review');
          s.status='Under Review';
        }});
      setOpenId(id); setEditing(true); window.scrollTo({top:0});},

    /* Persists the current edit as-is -- it never advances or reverts the
       lifecycle status itself (a brand-new Setup keeps the Draft BLANK_*
       seeded it with; a Setup being re-edited keeps whatever A.edit() put
       it in, e.g. Under Review). Version is untouched. Now also writes
       through to Dataverse (create if this Setup has never been saved
       there, update-in-place otherwise) -- previously Save Draft was
       local-only and a draft never reached Dataverse at all. */
    saveDraft:f0=>{ const f={...f0,name:derivedName(f0)};
      mut(n=>{const i=n.setups.findIndex(x=>x.id===f.id); const prev=n.setups[i];
        TRACKED.forEach(([k,label])=>{ if(prev[k]!==f[k])
          logIt(n,f.id,'Edited',label,showVal(k,prev[k]),showVal(k,f[k])); });
        logDerived(n,prev,f);
        n.setups[i]={...f,updated:TODAY};});
      setEditing(false);
      toast('Draft saved','Saved to Dataverse as a Draft. Nothing downstream changes until it is published.','ok');
      writeTemplateToDataverse(f,'saved as a draft');},

    /* Publish always lands on Under Review -- nothing skips review, even a
       re-publish of something that was already Active / Approved. Version
       only increases when this IS a re-publish of something that had been
       Approved; the very first publish, or a re-publish while still
       Draft/Under Review and never yet approved, keeps/starts at 1. Only
       the Approve action (below) can move a Setup to Active / Approved. */
    publish:f0=>{ const named={...f0,name:derivedName(f0)};
      const wasApproved = named.status==='Active / Approved';
      const next = wasApproved ? (named.version||0)+1 : (named.version||1);
      const f={...named, status:'Under Review', version:next};
      mut(n=>{const i=n.setups.findIndex(x=>x.id===f.id); const prev=n.setups[i];
        TRACKED.forEach(([k,label])=>{ if(prev[k]!==f[k])
          logIt(n,f.id,'Edited',label,showVal(k,prev[k]),showVal(k,f[k])); });
        logDerived(n,prev,f);
        if(prev.version!==next) logIt(n,f.id,'Published','Version',prev.version||'—',String(next));
        if(prev.status!=='Under Review')
          logIt(n,f.id,'Published','Lifecycle Status',prev.status,'Under Review');
        n.setups[i]={...f,updated:TODAY};});
      setEditing(false);
      toast('Sent for review',
        `${displayName(f)} is Under Review at version ${next}. An admin needs to Approve it before it's Active / Approved.`,'ok');
      writeTemplateToDataverse(f, wasApproved?'sent back for review':'sent for review');},

    /* Moves a Setup that is Under Review to Active / Approved -- the only
       action that does. A pure status flip: unlike Publish/Save Draft it
       never touches any child row, so the Dataverse write is the light
       status-only update, not the full delete-and-recreate reconcile. */
    approve:id=>{
      let rec=null;
      mut(n=>{const s=n.setups.find(x=>x.id===id);
        logIt(n,id,'Approved','Lifecycle Status',s.status,'Active / Approved');
        s.status='Active / Approved'; s.updated=TODAY;
        rec={...s};});
      toast('Setup approved',
        `${displayName(rec)} is now Active / Approved at version ${rec.version||1}.`,'ok');
      if(rec._dataverseId){
        const writer = rec.kind==='Report Template'
          ? updateReportTemplateStatus(rec._dataverseId,'Active / Approved')
          : updateMeetingTemplateStatus(rec._dataverseId,'Active / Approved');
        writer
          .then(({id:wid,errors})=>{
            if(!wid||errors.length){
              console.warn(`[dataverse] Approve status update failed for ${rec._dataverseId}:`, errors);
              toast('Dataverse status update failed',
                `${displayName(rec)} is Approved locally, but updating its status in Dataverse failed. Check the console for details.`,'err');
            }else{
              console.log(`[dataverse] Approved ${rec.kind} ${rec._dataverseId}`);
            }
          })
          .catch(e=>{
            console.warn(`[dataverse] Approve status update threw unexpectedly for ${rec._dataverseId}:`, e);
            toast('Dataverse status update failed',
              `${displayName(rec)} is Approved locally, but updating its status in Dataverse failed. Check the console for details.`,'err');
          });
      }},

    duplicate: async id=>{
      const src=db.setups.find(s=>s.id===id);
      if(src) await duplicateFrom(src);
    },

    /* Duplicating a Dataverse row the register lists but hasn't loaded into
       this session yet: read it in full first, then duplicate exactly as
       above -- so the copy carries every child row, not just the handful of
       columns the lightweight register listing holds. */
    duplicateDataverse: async(kind,dvId)=>{
      setDvOpening(dvId);
      try{
        await duplicateFrom(await loadDvSetup(kind,dvId));
      }catch(e){
        console.warn(`[dataverse] Failed to duplicate ${kind} ${dvId}:`, e);
        toast('Could not duplicate', 'Reading this record from Dataverse failed, so nothing was copied. Check the console for details.', 'err');
      }finally{ setDvOpening(null); }
    },

    /* Expiring a Dataverse row without loading it in: a status-only patch,
       no child rows touched. */
    expireDataverse: async(kind,dvId,name)=>{
      setDvOpening(dvId);
      try{
        const {id,errors} = kind==='Report Template'
          ? await updateReportTemplateStatus(dvId,'Expired')
          : await updateMeetingTemplateStatus(dvId,'Expired');
        if(!id||errors.length){
          console.warn(`[dataverse] Expire failed for ${dvId}:`, errors);
          toast('Could not expire', `Updating "${name}" in Dataverse failed. Check the console for details.`,'err');
        }else{
          toast('Setup expired','It creates no new occurrences and stays readable.','warn');
          await refreshDvLists();
        }
      }catch(e){
        console.warn(`[dataverse] Expire threw unexpectedly for ${dvId}:`, e);
        toast('Could not expire', `Updating "${name}" in Dataverse failed. Check the console for details.`,'err');
      }finally{ setDvOpening(null); }
    },

    expire:id=>{
      let rec=null;
      mut(n=>{const s=n.setups.find(x=>x.id===id);
        logIt(n,id,'Expired','Lifecycle Status',s.status,'Expired');
        s.status='Expired'; s.updated=TODAY;
        rec={...s};});
      toast('Setup expired','It creates no new occurrences and stays readable.','warn');
      if(rec._dataverseId){
        const writer = rec.kind==='Report Template'
          ? updateReportTemplateStatus(rec._dataverseId,'Expired')
          : updateMeetingTemplateStatus(rec._dataverseId,'Expired');
        writer
          .then(()=>refreshDvLists())
          .catch(e=>console.warn(`[dataverse] Expire status update threw unexpectedly for ${rec._dataverseId}:`, e));
      }},
  };

  const rec=openId?db.setups.find(s=>s.id===openId):null;
  const close=()=>{setOpenId(null);setEditing(false);};
  const ctx={db,setDb,mut,role,A,open:A.open,toast,dvReports,dvMeetings,dvOpening,currentUser};

  let body;
  if(rec && editing)
    body = rec.kind==='Report Template'
      ? <ReportWizard key={rec.id} rec={rec} onClose={close}/>
      : <MeetingWizard key={rec.id} rec={rec} onClose={close}/>;
  else if(rec) body = <ScreenDetail rec={rec} onClose={close}/>;
  else if(screen==='lists') body = <ScreenLists/>;
  else body = <ScreenRegister/>;

  const NAV=[{id:'register',n:1,label:'Setup Register',Icon:ClipboardList},
             {id:'lists',n:2,label:'Governed Lists',Icon:ListChecks}];
  /* Initials from the real person once we know them, from the role label
     otherwise (nothing to personalise with before that resolves). */
  const initialsFrom=t=>t.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const initials=initialsFrom(currentUser?.fullName || ROLES[role].label);
  const userLabel=currentUser?.fullName || ROLES[role].label;
  const userTitle=currentUser
    ? `${currentUser.fullName||'Signed in'}${currentUser.email?` · ${currentUser.email}`:''}\n`+
      (currentUser.linked
        ? `Linked to Dataverse user ${currentUser.systemUserId}`
        : 'No matching Dataverse user record found for this account.')+
      `\n${ROLES[role].note}`
    : ROLES[role].note;
  const canWrite=ROLES[role].write;

  return <Ctx.Provider value={ctx}>
    <div className="gov-root">
      <div className="topbar gov-topbar">
        <button type="button" className="gov-burger" aria-label={navOpen?'Close side navigation':'Open side navigation'}
          aria-expanded={navOpen} aria-controls="gov-side-nav" onClick={()=>setNavOpen(o=>!o)}>
          <span/><span/><span/>
        </button>
        <div className="tb-brand gov-brand"><b>ANDALUSIA PULSE</b><span>Leadership Practice · Governance Setup</span></div>
        <div className="tb-sp"/>
        <label className={'gov-admin-tgl'+(isAdmin?' on':'')} title={ROLES[role].note}>
          <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)}/>
          <span className="gov-admin-track" aria-hidden="true"><span className="gov-admin-knob"/></span>
          <span className="gov-admin-label">Administrator</span>
        </label>
        <span className={'tb-scope gov-scope'+(ROLES[role].approve?' gov-scope-rw':' gov-scope-ro')}>
          <i className="gov-dot" aria-hidden="true"/>{ROLES[role].approve?'Can approve':'Author only'}</span>
        <span className="tb-scope gov-date">{fmtD(TODAY)}</span>
        <button type="button" className="gov-user" title={userTitle}>
          <span className="gov-user-av">{initials}</span>
          <span className="gov-user-name">
            {userLabel}
            <span className="gov-user-sub">{currentUser
              ? (currentUser.linked?ROLES[role].label:'Not linked to Dataverse')
              : ROLES[role].label}</span>
          </span>
        </button>
      </div>
      <div className={'shell gov-shell'+(navOpen?'':' gov-nav-closed')}>
        <nav id="gov-side-nav" className="side gov-side" aria-label="Sections" aria-hidden={!navOpen}>
          <div className="side-grp gov-side-grp">Governance Setup</div>
          {NAV.map(i=><React.Fragment key={i.id}>
            <button type="button" aria-current={screen===i.id&&!rec?'page':undefined}
              className={'nav-i gov-nav-i'+(screen===i.id&&!rec?' on':'')}
              title={navOpen?undefined:i.label}
              onClick={()=>{setScreen(i.id);close();window.scrollTo({top:0});}}>
              <span className="nav-n gov-nav-n"><i.Icon size={16} strokeWidth={2.25}/></span>
              <span className="gov-nav-label">{i.label}</span></button>
            {i.id==='register'&&canWrite
              ? <div className="gov-subnav">
                  <button type="button"
                    className={'nav-i gov-nav-i gov-subnav-i'+(editing&&rec&&rec.kind==='Report Template'?' on':'')}
                    aria-current={editing&&rec&&rec.kind==='Report Template'?'page':undefined}
                    title={navOpen?undefined:'New Report Template Setup'}
                    onClick={()=>A.create('Report Template')}>
                    <span className="nav-n gov-nav-n gov-subnav-n"><FileText size={13} strokeWidth={2.25}/></span>
                    <span className="gov-nav-label">New Report</span></button>
                  <button type="button"
                    className={'nav-i gov-nav-i gov-subnav-i'+(editing&&rec&&rec.kind!=='Report Template'?' on':'')}
                    aria-current={editing&&rec&&rec.kind!=='Report Template'?'page':undefined}
                    title={navOpen?undefined:'New Committee / Meeting Setup'}
                    onClick={()=>A.create('Committee / Meeting')}>
                    <span className="nav-n gov-nav-n gov-subnav-n"><CalendarDays size={13} strokeWidth={2.25}/></span>
                    <span className="gov-nav-label">New Meeting</span></button>
                </div>
              : null}
          </React.Fragment>)}
          <div className="gov-side-sp"/>
          <div className="gov-side-grp">Modules</div>
          <button type="button" className="nav-i gov-nav-i gov-switch-nav" title={navOpen?undefined:'Leadership Execution'}
            onClick={onSwitch}>
            <span className="nav-n gov-nav-n gov-switch-ic"><ArrowUpRight size={16} strokeWidth={2.25}/></span>
            <span className="gov-nav-label">Leadership Execution</span></button>
        </nav>
        <main className="main full gov-main">{body}</main>
      </div>
      <div className="toasts" role="status" aria-live="polite">{toasts.map(t=>
        <div className={'toast '+(t.k||'')} key={t.id}><b>{t.title}</b><span>{t.body}</span></div>)}</div>
    </div>
  </Ctx.Provider>;
}

export default App;