import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';

/* =========================================================================
   REFERENCE DATA + SEED
   Demo clock fixed at 29 Jul 2026. Working week Sun–Thu.
   ========================================================================= */
const TODAY = '2026-07-29';
const PERIOD = '2026-07';

const REGIONS = ['KSA','Egypt'];
const BUS = [
  {id:'AHJ', name:'Andalusia Jeddah',            region:'KSA'},
  {id:'ADC', name:'Andalusia Dental Clinics',    region:'KSA'},
  {id:'AHM', name:'Andalusia Al Moasah',         region:'Egypt'},
];

/* ---- people (Employee Data Management is the source of truth) ---------- */
const AUTH_LEVELS = {
  0:'No decision authority', 1:'Section Head', 2:'Department Head',
  3:'Medical Director', 4:'Business Unit Director', 5:'Group Chief Financial Officer',
  6:'Group Chief Executive Officer',
};
/* Three acting role families, plus a read-only observer. The twenty roles named in the
   requirements collapse into these — who does what on a given record is resolved from the
   record itself (who chairs this Meeting, who reviews this Report), not from a job title. */
const FAMILIES = {
  employee : {label:'Employee',
              does:'Prepares and submits Reports, attends Meetings, raises Decisions.'},
  approver : {label:'Reviewer / Approver / Meeting Chair',
              does:'Reviews and approves Reports, chairs Meetings, approves Minutes, the Audit Grid and Decisions.'},
  organizer: {label:'Organizer / Facilitator',
              does:'Schedules Meetings, manages the Agenda and inputs, records Minutes, completes the Audit Grid.'},
  observer : {label:'Observer — read only',
              does:'Reads execution records, audit history and approved Audit Grids. Never approves.'},
  admin    : {label:'Full access — every role',
              does:'Acts for any accountable owner so the whole governance cycle can be walked end to end.'},
};
const FAM_ORDER = ['employee','approver','organizer','observer'];

const PEOPLE = [
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
const P = id => PEOPLE.find(p=>p.id===id) || {id,name:'—',position:'—',lvl:0,scope:'own',fam:'employee'};
const FAM = id => FAMILIES[P(id).fam];

/* personas offered in the topbar switcher, grouped by family */
const PERSONAS = ['u1','u6','u5','u2','u7','u4','u3','u8'];

/* ---- Taxonomy: Meeting Setups (read-only in Leadership Practice) -------- */
const SETUP_TYPES = ['Business Meeting','Committee'];
const BM_CLASSES = ['Planning Meeting','Performance Monitoring Meeting','Clinical Meeting',
  'Operational Meeting','Technology Meeting','Cross-functional Meeting'];
const CM_CLASSES = ['Accreditation-required Committee','Governed Committee'];
const ADHOC_TYPES = ['Leadership','Alignment','Governance'];

const MTG_SETUPS = [
  {id:'ms1', name:'Operational Quality Committee', type:'Committee',
   cls:'Accreditation-required Committee', bu:'AHJ', cadence:'Monthly — third Thursday',
   quorumPct:60, tor:'TOR-QLT-003 v3', torReview:'2027-03-31',
   chair:'u2', facilitator:'u3', recorder:'u4',
   required:['u2','u3','u5','u10','u14'], optional:['u4','u11'],
   consumes:['rs1','rs2']},
  {id:'ms2', name:'Infection Prevention and Control Committee', type:'Committee',
   cls:'Accreditation-required Committee', bu:'AHJ', cadence:'Monthly — fourth Thursday',
   quorumPct:60, tor:'TOR-IPC-001 v2', torReview:'2026-05-31',
   chair:'u2', facilitator:'u14', recorder:'u4',
   required:['u2','u5','u10','u14'], optional:['u4'],
   consumes:[]},
  {id:'ms3', name:'Medication Safety Committee', type:'Committee',
   cls:'Governed Committee', bu:'AHJ', cadence:'Quarterly',
   quorumPct:null, tor:'POL-MED-007 v4', torReview:'2027-01-31',
   chair:'u7', facilitator:'u14', recorder:'u4',
   required:['u7','u14','u5'], optional:['u2'],
   consumes:[]},
  {id:'ms4', name:'Monthly Performance Review', type:'Business Meeting',
   cls:'Performance Monitoring Meeting', bu:'AHJ', cadence:'Monthly — first Tuesday',
   quorumPct:null, tor:null, torReview:null,
   chair:'u7', facilitator:'u1', recorder:'u4',
   required:['u7','u5','u10','u11'], optional:['u1'],
   consumes:['rs3']},
  {id:'ms5', name:'Digital Transformation Forum', type:'Business Meeting',
   cls:'Cross-functional Meeting', subCls:'Team of Teams', bu:'AHJ', cadence:'Monthly — second Tuesday',
   quorumPct:null, tor:null, torReview:null,
   chair:'u7', facilitator:'u15', recorder:'u4',
   required:['u7','u15','u5'], optional:['u1','u11'],
   consumes:[]},
  {id:'ms6', name:'Nursing Clinical Review', type:'Business Meeting',
   cls:'Clinical Meeting', bu:'AHJ', cadence:'Monthly — third Tuesday',
   quorumPct:null, tor:null, torReview:null,
   chair:'u10', facilitator:'u4', recorder:'u4',
   required:['u10','u2','u14'], optional:[],
   consumes:['rs2']},
];
const MS = id => MTG_SETUPS.find(m=>m.id===id);

/* ---- Taxonomy: Report Setups ------------------------------------------- */
const RPT_CATEGORIES = ['Executive','Core','Custom'];
const RPT_SETUPS = [
  {id:'rs1', name:'Monthly Quality Report', cat:'Core',
   objective:'Report quality indicator performance and improvement actions for the reporting period.',
   template:'QLT-TMPL-004.docx', site:'Quality', folder:'2026 / Monthly Reports',
   creator:'u1', reviewers:['u5','u2'], freq:'Monthly', dueDay:10,
   kpis:['KPI-QLT-011','KPI-QLT-014'], processes:['PRC-QLT-02']},
  {id:'rs2', name:'Nursing Manpower Plan', cat:'Core',
   objective:'Present nursing establishment, vacancy and coverage against the approved manpower plan.',
   template:null, site:'Nursing', folder:'2026 / Plans',
   creator:'u10', reviewers:['u5','u7'], freq:'Monthly', dueDay:12,
   kpis:['KPI-NUR-003'], processes:['PRC-NUR-01']},
  {id:'rs4', name:'Medical Equipment Maintenance Report', cat:'Core',
   objective:'Report preventive maintenance completion and open equipment faults for the period.',
   template:'BME-TMPL-002.xlsx', site:'Facilities', folder:'2026 / Monthly Reports',
   creator:'u6', reviewers:['u11','u7'], freq:'Monthly', dueDay:14,
   kpis:['KPI-BME-002'], processes:['PRC-BME-01']},
  {id:'rs3', name:'Executive Performance Pack', cat:'Executive',
   objective:'Consolidate business unit performance for the executive review cycle.',
   template:'EXE-TMPL-001.pptx', site:'Executive', folder:'2026 / Monthly Reports',
   creator:'u1', reviewers:['u7'], freq:'Monthly', dueDay:8,
   kpis:['KPI-FIN-001','KPI-OPS-004'], processes:[]},
];
const RS = id => RPT_SETUPS.find(r=>r.id===id);

/* ---- Taxonomy: Topic option sets (v0.6) -------------------------------- */
const TOPIC_NATURES = ['Issue','Opportunity','Escalation'];
const TOPIC_CATEGORIES = [
  {v:'Event or Incident', subs:['Staff-related','Patient Satisfaction','Quality','Financial or Commercial','SLA']},
  {v:'Complaint', subs:[]},
  {v:'OVR', subs:[]},
  {v:'Diagnostic and Prescriptive Conclusion', subs:[]},
  {v:'Project or POC Progress', subs:[]},
  {v:'FPTTRRR', subs:[], note:'Definition open'},
  {v:'Other', subs:[], freeText:true},
];

/* ---- Authority Matrix (owned outside Leadership Practice) --------------- */
const DECISION_TYPES = ['Quality Improvement Action','Clinical Protocol Change',
  'Establishment or Staffing Change','Capital Expenditure','Technology Adoption'];
const IMPACT_AREAS = ['Clinical','Financial','Operational','Patient Experience',
  'Compliance','People','Strategic','Technology'];
const APPROVAL_CYCLES = {
  'AC-01':{name:'Departmental', steps:[{pos:'Department Head', who:'u5'}]},
  'AC-02':{name:'Clinical Governance', steps:[{pos:'Department Head', who:'u5'},{pos:'Medical Director', who:'u2'}]},
  'AC-03':{name:'Business Unit Capital', steps:[{pos:'Finance Business Partner', who:'u11'},{pos:'Business Unit Director', who:'u7'}]},
  'AC-04':{name:'Group Capital', steps:[{pos:'Finance Business Partner', who:'u11'},{pos:'Business Unit Director', who:'u7'},
           {pos:'Group Chief Financial Officer', who:'u12'},{pos:'Group Chief Executive Officer', who:'u13'}]},
};
/* rows are evaluated top-down; first match wins. A type with no row returns no-match. */
const AUTHORITY_MATRIX = [
  {type:'Quality Improvement Action',      max:null,    reqLvl:2, cycle:'AC-01'},
  {type:'Clinical Protocol Change',        max:null,    reqLvl:3, cycle:'AC-02'},
  {type:'Establishment or Staffing Change',max:null,    reqLvl:4, cycle:'AC-03'},
  {type:'Capital Expenditure',             max:100000,  reqLvl:4, cycle:'AC-03'},
  {type:'Capital Expenditure',             max:Infinity,reqLvl:6, cycle:'AC-04'},
  /* 'Technology Adoption' deliberately absent — demonstrates the blocked-submission path */
];

/* ---- Audit Grid Template (Taxonomy-owned) ------------------------------ */
const AG_TEMPLATE_VERSION = 'AGT v1.2';
const AG_CATEGORIES = ['Governance Framework','MOM Quality','Attendance and Quorum',
  'Decision and Follow-Up Integrity'];
const AG_QUESTIONS = [
  {id:'AG-01', cat:'Governance Framework', src:'Auto', w:1,
   q:'The Committee operates under a current TOR or Policy reference at the Meeting date.',
   rule:'Reference present and current scores 5; present but past its review date scores 3; absent scores 0.'},
  {id:'AG-02', cat:'Governance Framework', src:'Manual', w:1,
   q:'Attending membership matches the TOR-defined composition.',
   rule:'TOR composition is descriptive text, so equivalence requires judgement. Becomes automatic once TOR composition is structured against positions.'},
  {id:'AG-03', cat:'Governance Framework', src:'Auto', w:1,
   q:'Agenda Items were present and distributed ahead of the Meeting.',
   rule:'Two parts, averaged: at least one Agenda Item exists, and the Agenda was distributed at or before the required lead time.'},
  {id:'AG-04', cat:'Governance Framework', src:'Auto', w:1,
   q:'The Agenda was fully covered, or uncovered Agenda Items were carried forward.',
   rule:'Fully covered scores 5; not covered but every uncovered item carries forward scores 4; not covered with no carry-forward scores 0.'},
  {id:'AG-05', cat:'MOM Quality', src:'Auto', w:1, owner:'Meeting Chair',
   q:'The MOM was approved within the approval period.',
   rule:'Measured from MOM submission to Chair approval, so a late write-up never counts against the Chair. On time scores 5; late scores 2; missed scores 0.'},
  {id:'AG-06', cat:'MOM Quality', src:'Auto', w:1,
   q:'Every Agenda Item records an outcome — a Discussion Note, a Task or a Decision.',
   rule:'Percentage of Agenda Items with a recorded outcome, banded from 0 to 5.'},
  {id:'AG-07', cat:'MOM Quality', src:'Auto', w:1, retired:true,
   q:'The MOM is signed where the Committee classification requires a signature.',
   rule:'Retired. The Meeting Chair’s approval is itself the signature, and the Audit Grid is only created after the MOM is Closed — which cannot happen without approval. The question could therefore only ever return 5, inflating the Overall Score without measuring anything.'},
  {id:'AG-08', cat:'Attendance and Quorum', src:'Auto', w:1,
   q:'Quorum was achieved.',
   rule:'Quorum achieved scores 5; not achieved scores 0.'},
  {id:'AG-09', cat:'Attendance and Quorum', src:'Auto', w:1,
   q:'Required Attendee attendance rate.',
   rule:'Percentage of Required Attendees present, banded: 90 or above scores 5; 80 scores 4; 70 scores 3; 60 scores 2; 50 scores 1; below 50 scores 0.'},
  {id:'AG-10', cat:'Decision and Follow-Up Integrity', src:'Auto', w:1,
   q:'Every MOM Output traces to an Agenda Item.',
   rule:'Percentage of MOM Outputs resolving to a parent Agenda Item, banded from 0 to 5.'},
  {id:'AG-11', cat:'Decision and Follow-Up Integrity', src:'Auto', w:1,
   q:'Every Direct Decision recorded from this Meeting carries a confirmed Authority Check Result.',
   rule:'Percentage of Direct Decisions with a confirmed Authority Check Result.'},
  {id:'AG-12', cat:'Decision and Follow-Up Integrity', src:'Auto', w:1,
   q:'Every Decision Request raised from this Meeting follows the Authority Matrix Approval Cycle.',
   rule:'Percentage of Decision Requests whose route matches the Authority Matrix response.'},
  {id:'AG-13', cat:'Decision and Follow-Up Integrity', src:'Auto', w:1,
   q:'Every TMS Task created from this MOM has an Execution Owner and a due date.',
   rule:'Percentage of Tasks with both values present, banded from 0 to 5.'},
  {id:'AG-14', cat:'Decision and Follow-Up Integrity', src:'Auto', w:1,
   q:'Prior Tasks from this Committee due before this Meeting were closed on time.',
   rule:'Percentage of Tasks from earlier occurrences of this Committee, due before this Meeting date, closed on or before the due date, banded from 0 to 5.'},
  /* Added after stakeholder review. Identifiers are appended, never renumbered. */
  {id:'AG-15', cat:'Governance Framework', src:'Auto', w:1, owner:'Meeting Organizer',
   q:'The Meeting invitation was sent at or before the required lead time.',
   rule:'Sent at or before the lead time scores 5; sent late scores 2; not recorded scores 0. Separate from AG-03, which measures the Agenda rather than the invitation.'},
  {id:'AG-16', cat:'MOM Quality', src:'Auto', w:1, owner:'Facilitator',
   q:'The MOM was written up and submitted within the write-up period.',
   rule:'Measured from the end of the Meeting to MOM submission. On time scores 5; late scores 2; never submitted scores 0. Held separately from AG-05 because a different person is accountable.'},
];
const AG_ACTIVE = AG_QUESTIONS.filter(q=>!q.retired);
const AGQ = id => AG_QUESTIONS.find(q=>q.id===id);

/* ---- Governance settings: the values the BRD refuses to approve -------- */
const DEFAULT_SETTINGS = {
  momWriteupHours  : null,      // OD-09a  Meeting end → MOM submitted   (Facilitator)
  momApprovalHours : null,      // OD-09b  MOM submitted → Chair approval (Meeting Chair)
  agendaLeadDays   : null,      // OD-08
  inviteLeadDays   : 2,         // OD-07 — confirmed at two days
  passThreshold    : null,      // OD-22
  delegatedAttend  : 'exclude', // OD-20  exclude | half | present
  momClosure       : 'auto',    // OD-38  auto | manual
  inputReadiness   : 'submitted', // OD-39  submitted | approved
  reviewTimeoutDays: null,      // OD-35
};
const OD_NOTES = {
  momWriteupHours:{od:'OD-09a', label:'MOM write-up period',
    q:'How long the Facilitator has to write up the Minutes and submit them, measured from the end of the Meeting.',
    owner:'SMO', accountable:'Facilitator · PMO or SMO',
    effect:'AG-16 cannot be scored while this is unset, so it is excluded from the Overall Score and reduces Coverage.'},
  momApprovalHours:{od:'OD-09b', label:'MOM approval period',
    q:'How long the Meeting Chair has to approve the Minutes, measured from submission — not from the Meeting.',
    owner:'SMO', accountable:'Meeting Chair',
    effect:'AG-05 cannot be scored while this is unset. Measuring from submission means a late write-up never counts against the Chair.'},
  agendaLeadDays:{od:'OD-08', label:'Agenda distribution lead time',
    q:'Whether Agenda Items must be distributed two days before the Meeting.', owner:'SMO',
    accountable:'Meeting Organizer',
    effect:'AG-03 scores Agenda Item presence only while this is unset. Setting it adds the distribution half of the question.'},
  inviteLeadDays:{od:'OD-07', label:'Meeting invitation lead time', closed:true,
    q:'How many days before the Meeting the invitation must be sent.', owner:'SMO',
    accountable:'Meeting Organizer',
    effect:'Confirmed at two days. Drives AG-15. Held separately from the Agenda lead time because the invitation and the Agenda are sent by different acts.'},
  passThreshold:{od:'OD-22', label:'Audit Grid pass threshold',
    q:'The score at or above which a Committee occurrence passes.', owner:'SMO',
    effect:'No score is judged pass or fail while this is unset. The 90 per cent figure in earlier drafts has no confirmed source.'},
  delegatedAttend:{od:'OD-20', label:'Delegated attendance',
    q:'Whether a delegated attendance counts as present for the Required Attendee attendance rate.', owner:'SMO',
    effect:'Changes AG-09 materially. Half weight and exclusion give different scores for the same Meeting.'},
  momClosure:{od:'OD-38', label:'MOM closure',
    q:'Is MOM closure automatic on approval and Output activation, or an explicit act?', owner:'SMO',
    effect:'Automatic closure releases the Audit Grid the moment the Chair approves. Manual closure adds a second step.'},
  inputReadiness:{od:'OD-39', label:'Meeting input readiness minimum',
    q:'Does a Report Submission linked as a Meeting input need to be Approved, or is Submitted sufficient?', owner:'SMO',
    effect:'Sets the bar an input must clear before the Meeting. Inputs below the bar are flagged on the Agenda.'},
  reviewTimeoutDays:{od:'OD-35', label:'Report review period',
    q:'The review period per Report Category and the action applied on timeout.', owner:'SMO',
    effect:'A timeout escalates and must never approve the review step.'},
};

/* ---- non-working days (OD-30) ------------------------------------------ */
const WEEKEND = [5,6];              // Fri, Sat — working week is Sun–Thu
const HOLIDAYS = ['2026-07-05','2026-08-24'];
const isNonWorking = d => WEEKEND.includes(new Date(d+'T00:00:00').getDay()) || HOLIDAYS.includes(d);
/* An occurrence landing on a non-working day moves — that occurrence only, never the series. */
const nextWorkingDay = d => { let x=new Date(d+'T00:00:00');
  do { x.setDate(x.getDate()+1); } while(isNonWorking(x.toISOString().slice(0,10)));
  return x.toISOString().slice(0,10); };
/* =========================================================================
   SEED — one Committee carried through four cycles so history is real
   ========================================================================= */
function seed(){
return {
/* ---------------- Report Submissions ---------------------------------- */
reports:[
  {id:'sub1', setup:'rs1', custom:null, period:'2026-06', bu:'AHJ', dept:'Quality',
   status:'Approved', creator:'u1', step:2, file:'Monthly_Quality_Report_2026-06.docx',
   url:'/Quality/2026/Monthly Reports/Monthly_Quality_Report_2026-06.docx', ver:3, locked:true,
   history:[
     {at:'2026-07-04 09:12', who:'u1', act:'Submitted for review'},
     {at:'2026-07-05 14:40', who:'u5', act:'Approved review step 1', note:'Indicator narrative is complete.'},
     {at:'2026-07-06 10:05', who:'u2', act:'Approved review step 2 — final', note:'Approved.'},
   ]},
  {id:'sub2', setup:'rs1', custom:null, period:'2026-07', bu:'AHJ', dept:'Quality',
   status:'In Review', creator:'u1', step:0, file:'Monthly_Quality_Report_2026-07.docx',
   url:'/Quality/2026/Monthly Reports/Monthly_Quality_Report_2026-07.docx', ver:2, locked:false,
   history:[
     {at:'2026-07-08 11:20', who:'u1', act:'Submitted for review'},
     {at:'2026-07-09 16:02', who:'u5', act:'Requested more information',
      note:'Sepsis bundle indicator is missing its denominator. Please restate.'},
     {at:'2026-07-12 08:47', who:'u1', act:'Resubmitted after revision'},
   ]},
  {id:'sub3', setup:'rs2', custom:null, period:'2026-07', bu:'AHJ', dept:'Nursing',
   status:'Draft', creator:'u10', step:0, file:null, url:null, ver:0, locked:false,
   history:[{at:'2026-07-12 07:30', who:null, act:'Report Submission created from the approved Setup'}]},
  {id:'sub4', setup:'rs3', custom:null, period:'2026-07', bu:'AHJ', dept:'Executive',
   status:'Approved', creator:'u1', step:1, file:'Executive_Performance_Pack_2026-07.pptx',
   url:'/Executive/2026/Monthly Reports/Executive_Performance_Pack_2026-07.pptx', ver:1, locked:true,
   history:[
     {at:'2026-07-06 13:15', who:'u1', act:'Submitted for review'},
     {at:'2026-07-07 09:00', who:'u7', act:'Approved review step 1 — final'},
   ]},
  {id:'sub7', setup:'rs4', custom:null, period:'2026-07', bu:'AHJ', dept:'Facilities',
   status:'Draft', creator:'u6', step:0, file:null, url:null, ver:0, locked:false,
   history:[{at:'2026-07-14 07:15', who:null, act:'Report Submission created from the approved Setup'}]},
  {id:'sub8', setup:'rs4', custom:null, period:'2026-06', bu:'AHJ', dept:'Facilities',
   status:'In Review', creator:'u6', step:0, file:'Medical_Equipment_Maintenance_2026-06.xlsx',
   url:'/Facilities/2026/Monthly Reports/Medical_Equipment_Maintenance_2026-06.xlsx', ver:1, locked:false,
   history:[{at:'2026-07-02 08:30', who:'u6', act:'Submitted for review'}]},
  {id:'sub6', setup:'rs3', custom:null, period:'2026-08', bu:'AHJ', dept:'Executive',
   status:'Draft', creator:'u1', step:0, file:null, url:null, ver:0, locked:false,
   history:[{at:'2026-07-27 06:00', who:null,
             act:'Report Submission created from the approved Setup ahead of the due date'}]},
  {id:'sub5', setup:null, period:'2026-07', bu:'AHJ', dept:'Ophthalmology',
   status:'In Review', creator:'u1', step:0, file:'Laser_Utilisation_Review_Q2.xlsx',
   url:'/Ophthalmology/2026/Ad Hoc/Laser_Utilisation_Review_Q2.xlsx', ver:1, locked:false,
   custom:{name:'Ophthalmology Laser Utilisation Review', cat:'Custom',
     objective:'Assess laser suite utilisation ahead of the capital replacement decision.',
     site:'Ophthalmology', folder:'2026 / Ad Hoc', reviewers:['u5','u7'],
     kpis:['KPI-OPS-004'], processes:[], noSetupFlag:true, taxonomyState:'Delivered'},
   history:[
     {at:'2026-07-20 10:40', who:'u1', act:'Custom Report created — no approved Setup exists'},
     {at:'2026-07-20 10:41', who:null, act:'Metadata sent to Taxonomy with a No-Setup flag'},
     {at:'2026-07-20 10:42', who:'u1', act:'Submitted for review'},
   ]},
],

/* ---------------- Meeting Occurrences ---------------------------------- */
occs:[
  /* --- Operational Quality Committee ---------------------------------- */
  ...['2026-04-16','2026-05-21','2026-06-18'].map((d,i)=>({
    id:'occ-oqc-'+['apr','may','jun'][i], setup:'ms1', custom:null, bu:'AHJ',
    date:d, start:'09:00', end:'11:00', tz:'Arabia Standard Time', mode:'Hybrid',
    location:'Board Room 2', link:'https://teams.microsoft.com/l/meetup-join/oqc'+i,
    adhoc:null, restricted:false, status:'Held', agendaSent:d.slice(0,8)+String(+d.slice(8)-3).padStart(2,'0'),
    inviteSent:d.slice(0,8)+String(+d.slice(8)-6).padStart(2,'0'),
    sync:'Synchronized', cancelReason:null, rescheduledFrom:null,
    chair:'ms1', inputs:[],
    attend:[['u2',1],['u3',1],['u5',1],['u10',1],['u14',i===0?0:1],['u4',1],['u11',i===2?1:0]]
      .map(([w,p])=>({who:w,present:!!p,delegate:null})),
    agenda:[
      {id:'ag-'+i+'-1', seq:1, title:'Quality indicator performance', owner:'u5', source:'Standing item', covered:true},
      {id:'ag-'+i+'-2', seq:2, title:'Open corrective actions review', owner:'u3', source:'Carried forward', covered:true},
      {id:'ag-'+i+'-3', seq:3, title:'Accreditation readiness update', owner:'u2', source:'Standing item', covered:true},
    ],
  })),
  {id:'occ-oqc-jul', setup:'ms1', custom:null, bu:'AHJ',
   date:'2026-07-16', start:'09:00', end:'11:00', tz:'Arabia Standard Time', mode:'Hybrid',
   location:'Board Room 2', link:'https://teams.microsoft.com/l/meetup-join/oqc-jul',
   adhoc:null, restricted:false, status:'Held', agendaSent:'2026-07-15', inviteSent:'2026-07-12',
   sync:'Synchronized', cancelReason:null, rescheduledFrom:null,
   inputs:['sub2','sub3','mom-oqc-jun'],
   attend:[{who:'u2',present:true,delegate:null},{who:'u3',present:true,delegate:null},
           {who:'u5',present:true,delegate:null},{who:'u10',present:false,delegate:'u4'},
           {who:'u14',present:false,delegate:null},{who:'u4',present:true,delegate:null},
           {who:'u11',present:true,delegate:null}],
   agenda:[
     {id:'ag-j-1', seq:1, title:'Quality indicator performance — June', owner:'u5', source:'Report input — Monthly Quality Report', covered:true},
     {id:'ag-j-2', seq:2, title:'Hand hygiene compliance below threshold', owner:'u3', source:'Escalation', covered:true,
      topicNature:'Issue', topicCats:[{v:'Event or Incident', sub:'Quality'}]},
     {id:'ag-j-3', seq:3, title:'Medication reconciliation audit results', owner:'u14', source:'Standing item', covered:true},
     {id:'ag-j-4', seq:4, title:'Patient complaint trend review', owner:'u5', source:'Standing item', covered:false},
   ]},
  {id:'occ-oqc-aug', setup:'ms1', custom:null, bu:'AHJ',
   date:'2026-08-20', start:'09:00', end:'11:00', tz:'Arabia Standard Time', mode:'Hybrid',
   location:'Board Room 2', link:'https://teams.microsoft.com/l/meetup-join/oqc-aug',
   adhoc:null, restricted:false, status:'Scheduled', agendaSent:null, inviteSent:'2026-08-16',
   sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:MS('ms1').required.concat(MS('ms1').optional).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-a-1', seq:1, title:'Patient complaint trend review', owner:'u5',
            source:'Carried forward from 16 Jul 2026', covered:null, carriedFrom:'ag-j-4'}]},
  {id:'occ-oqc-adhoc', setup:'ms1', custom:null, bu:'AHJ',
   date:'2026-07-30', start:'14:00', end:'15:00', tz:'Arabia Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/oqc-adhoc',
   adhoc:'Governance', restricted:false, status:'Scheduled', agendaSent:'2026-07-28', inviteSent:'2026-07-26',
   sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:['sub2'],
   attend:['u2','u3','u5','u6','u14'].map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-ah-1', seq:1, title:'Unplanned review — sterilisation incident', owner:'u3', source:'Ad Hoc', covered:null}]},

  /* --- Infection Prevention and Control Committee ---------------------- */
  {id:'occ-ipc-jun', setup:'ms2', custom:null, bu:'AHJ',
   date:'2026-06-25', start:'11:00', end:'12:30', tz:'Arabia Standard Time', mode:'In person',
   location:'Meeting Room 4', link:null, adhoc:null, restricted:false, status:'Held',
   agendaSent:'2026-06-22', inviteSent:'2026-06-21', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:[{who:'u2',present:true,delegate:null},{who:'u5',present:true,delegate:null},
           {who:'u10',present:true,delegate:null},{who:'u14',present:true,delegate:null},
           {who:'u4',present:true,delegate:null}],
   agenda:[
     {id:'ag-i1-1', seq:1, title:'Surgical site infection rate', owner:'u14', source:'Standing item', covered:true},
     {id:'ag-i1-2', seq:2, title:'Isolation compliance audit', owner:'u10', source:'Standing item', covered:true},
   ]},
  {id:'occ-ipc-jul', setup:'ms2', custom:null, bu:'AHJ',
   date:'2026-07-23', start:'11:00', end:'12:30', tz:'Arabia Standard Time', mode:'In person',
   location:'Meeting Room 4', link:null, adhoc:null, restricted:false, status:'Held',
   agendaSent:'2026-07-21', inviteSent:'2026-07-22', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:[{who:'u2',present:true,delegate:null},{who:'u5',present:true,delegate:null},
           {who:'u10',present:true,delegate:null},{who:'u14',present:false,delegate:null},
           {who:'u4',present:true,delegate:null}],
   agenda:[
     {id:'ag-i2-1', seq:1, title:'Central line infection cluster', owner:'u14', source:'Escalation', covered:true},
     {id:'ag-i2-2', seq:2, title:'Antimicrobial stewardship report', owner:'u2', source:'Standing item', covered:true},
   ]},
  {id:'occ-ipc-aug', setup:'ms2', custom:null, bu:'AHJ',
   date:'2026-08-27', start:'11:00', end:'12:30', tz:'Arabia Standard Time', mode:'In person',
   location:'Meeting Room 4', link:null, adhoc:null, restricted:false, status:'Scheduled',
   agendaSent:null, inviteSent:'2026-08-23', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:MS('ms2').required.concat(MS('ms2').optional).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-i3-1', seq:1, title:'Central line bundle re-audit', owner:'u14', source:'Carried forward', covered:null}]},

  /* --- Medication Safety Committee ------------------------------------- */
  {id:'occ-msc-jul', setup:'ms3', custom:null, bu:'AHJ',
   date:'2026-07-09', start:'13:00', end:'14:30', tz:'Arabia Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/msc', adhoc:null, restricted:false,
   status:'Held', agendaSent:'2026-07-07', inviteSent:'2026-07-05', sync:'Synchronized', cancelReason:null, rescheduledFrom:null,
   inputs:[],
   attend:[{who:'u7',present:true,delegate:null},{who:'u14',present:true,delegate:null},
           {who:'u5',present:true,delegate:null},{who:'u2',present:false,delegate:null}],
   agenda:[
     {id:'ag-m-1', seq:1, title:'High-alert medication double-check compliance', owner:'u14', source:'Standing item', covered:true},
     {id:'ag-m-2', seq:2, title:'Look-alike sound-alike list refresh', owner:'u14', source:'Standing item', covered:true},
   ]},
  {id:'occ-msc-aug', setup:'ms3', custom:null, bu:'AHJ',
   date:'2026-08-13', start:'13:00', end:'14:30', tz:'Arabia Standard Time', mode:'Online',
   location:null, link:null, adhoc:null, restricted:false, status:'Cancelled', agendaSent:null, inviteSent:'2026-08-09',
   sync:'Cancellation synchronized', cancelReason:'Quarterly cycle moved to September at the Chair’s request.',
   rescheduledFrom:null, inputs:[],
   attend:[], agenda:[{id:'ag-m2-1', seq:1, title:'Quarterly medication safety review', owner:'u14', source:'Standing item', covered:null}]},

  /* --- Business Meetings ------------------------------------------------ */
  {id:'occ-mpr-jul', setup:'ms4', custom:null, bu:'AHJ',
   date:'2026-07-07', start:'08:00', end:'10:00', tz:'Arabia Standard Time', mode:'Hybrid',
   location:'Executive Suite', link:'https://teams.microsoft.com/l/meetup-join/mpr', adhoc:null,
   restricted:false, status:'Held', agendaSent:'2026-07-05', inviteSent:'2026-07-03', sync:'Synchronized',
   cancelReason:null, rescheduledFrom:null, inputs:['sub4'],
   attend:[{who:'u7',present:true,delegate:null},{who:'u5',present:true,delegate:null},
           {who:'u10',present:true,delegate:null},{who:'u11',present:true,delegate:null},
           {who:'u1',present:true,delegate:null}],
   agenda:[
     {id:'ag-p-1', seq:1, title:'June performance against plan', owner:'u11', source:'Report input', covered:true},
     {id:'ag-p-2', seq:2, title:'Occupancy recovery actions', owner:'u7', source:'Standing item', covered:true},
   ]},
  {id:'occ-mpr-aug', setup:'ms4', custom:null, bu:'AHJ',
   date:'2026-08-04', start:'08:00', end:'10:00', tz:'Arabia Standard Time', mode:'Hybrid',
   location:'Executive Suite', link:'https://teams.microsoft.com/l/meetup-join/mpr-aug', adhoc:null,
   restricted:false, status:'Scheduled', agendaSent:null, inviteSent:'2026-07-31', sync:'Synchronized',
   cancelReason:null, rescheduledFrom:null, inputs:['sub6'],
   attend:MS('ms4').required.concat(MS('ms4').optional,['u6']).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-p2-1', seq:1, title:'July performance against plan', owner:'u11', source:'Report input — Executive Performance Pack', covered:null},
           {id:'ag-p2-2', seq:2, title:'Occupancy recovery — progress', owner:'u7', source:'Carried forward', covered:null}]},
  {id:'occ-dtf-jul', setup:'ms5', custom:null, bu:'AHJ',
   date:'2026-07-14', start:'15:00', end:'16:30', tz:'Arabia Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/dtf', adhoc:null, restricted:false,
   status:'Held', agendaSent:'2026-07-12', inviteSent:'2026-07-10', sync:'Synchronized', cancelReason:null, rescheduledFrom:null,
   inputs:[],
   attend:[{who:'u7',present:true,delegate:null},{who:'u15',present:true,delegate:null},
           {who:'u5',present:true,delegate:null},{who:'u1',present:true,delegate:null},
           {who:'u11',present:false,delegate:null}],
   agenda:[{id:'ag-d-1', seq:1, title:'Leadership Practice rollout readiness', owner:'u15', source:'Standing item', covered:true}]},
  {id:'occ-ncr-jul', setup:'ms6', custom:null, bu:'AHJ',
   date:'2026-07-21', start:'12:00', end:'13:00', tz:'Arabia Standard Time', mode:'In person',
   location:'Nursing Education Room', link:null, adhoc:null, restricted:false, status:'Held',
   agendaSent:'2026-07-19', inviteSent:'2026-07-17', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:['sub3'],
   attend:[{who:'u10',present:true,delegate:null},{who:'u2',present:true,delegate:null},
           {who:'u14',present:true,delegate:null}],
   agenda:[{id:'ag-n-1', seq:1, title:'Specialty nursing competency gaps', owner:'u10', source:'Standing item', covered:true}]},
  {id:'occ-ncr-aug', setup:'ms6', custom:null, bu:'AHJ',
   date:'2026-08-23', start:'12:00', end:'13:00', tz:'Arabia Standard Time', mode:'In person',
   location:'Nursing Education Room', link:null, adhoc:null, restricted:false, status:'Scheduled',
   agendaSent:null, inviteSent:'2026-08-19', sync:'Synchronized', cancelReason:null, rescheduledFrom:'2026-08-21', inputs:[],
   attend:MS('ms6').required.map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-n2-1', seq:1, title:'Competency gap closure plan', owner:'u10', source:'Carried forward', covered:null}]},

  /* --- Manager-to-subordinate Ad Hoc (restricted visibility) ------------ */
  {id:'occ-121-jul', setup:null, bu:'AHJ',
   custom:{name:'One-to-one — Hussain Ahmed and Sara Khalil', purpose:'Monthly one-to-one review.',
           noSetupFlag:true, taxonomyState:'Delivered', dept:'Quality', stage:'Business Unit'},
   date:'2026-07-27', start:'10:00', end:'10:45', tz:'Arabia Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/121', adhoc:'Leadership',
   restricted:true, status:'Held', agendaSent:'2026-07-26', inviteSent:'2026-07-23', sync:'Synchronized',
   cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:[{who:'u1',present:true,delegate:null},{who:'u5',present:true,delegate:null}],
   chairOverride:'u5', facilitatorOverride:'u5', recorderOverride:'u5',
   agenda:[
     {id:'ag-121-1', seq:1, title:'Objectives progress and workload', owner:'u5', source:'Ad Hoc', covered:true},
     {id:'ag-121-2', seq:2, title:'Development plan', owner:'u5', source:'Ad Hoc', covered:true},
   ]},
],

/* ---------------- Meeting Minutes -------------------------------------- */
moms:[
  ...['apr','may','jun'].map((m,i)=>({
    id:'mom-oqc-'+m, occ:'occ-oqc-'+m, status:'Closed',
    submittedAt:['2026-04-17 15:00','2026-05-22 12:00','2026-06-19 10:30'][i],
    approvedAt:['2026-04-18 09:00','2026-05-23 08:30','2026-06-19 16:45'][i],
    closedAt:['2026-04-18 09:00','2026-05-23 08:30','2026-06-19 16:45'][i],
    sig:{who:'u2', name:'Dr. Ahmed Farouk',
         date:['2026-04-18','2026-05-23','2026-06-19'][i],
         time:['09:00','08:30','16:45'][i]},
    returnReason:null,
    notes:{['ag-'+i+'-1']:'Indicator pack reviewed; two indicators below target.',
           ['ag-'+i+'-2']:'Corrective actions tracked in TMS; no overdue items escalated.',
           ['ag-'+i+'-3']:'Readiness on track for the survey window.'},
    history:[{at:['2026-04-18 09:00','2026-05-23 08:30','2026-06-19 16:45'][i], who:'u2',
              act:'Approved — signature captured'},
             {at:['2026-04-18 09:00','2026-05-23 08:30','2026-06-19 16:45'][i], who:null,
              act:'Outputs activated and MOM set to Closed'}],
  })),
  {id:'mom-oqc-jul', occ:'occ-oqc-jul', status:'Draft',
   submittedAt:null, approvedAt:null, closedAt:null, sig:null, returnReason:null,
   notes:{
     'ag-j-1':'Sepsis bundle compliance at 71 per cent against a 90 per cent target. Dashboard change agreed.',
     'ag-j-2':'Hand hygiene compliance at 64 per cent in two units. Refresher training to be mandated.',
     'ag-j-3':'Reconciliation audit passed at 94 per cent. No further action required this cycle.',
     'ag-j-4':'Deferred — insufficient time. Carried forward to the August occurrence.'},
   history:[{at:'2026-07-16 11:05', who:'u4', act:'Meeting Minutes created from the Meeting Occurrence'}]},
  {id:'mom-ipc-jun', occ:'occ-ipc-jun', status:'Closed',
   submittedAt:'2026-06-26 09:00', approvedAt:'2026-06-26 15:20', closedAt:'2026-06-26 15:20',
   sig:{who:'u2', name:'Dr. Ahmed Farouk', date:'2026-06-26', time:'15:20'}, returnReason:null,
   notes:{'ag-i1-1':'Rate stable within control limits.','ag-i1-2':'Two units below the isolation compliance threshold.'},
   history:[{at:'2026-06-26 15:20', who:'u2', act:'Approved — signature captured'},
            {at:'2026-06-26 15:20', who:null, act:'Outputs activated and MOM set to Closed'}]},
  {id:'mom-ipc-jul', occ:'occ-ipc-jul', status:'Approved',
   submittedAt:'2026-07-24 08:40', approvedAt:'2026-07-26 11:15', closedAt:null,
   sig:{who:'u2', name:'Dr. Ahmed Farouk', date:'2026-07-26', time:'11:15'}, returnReason:null,
   notes:{'ag-i2-1':'Four cases in one unit over three weeks. Bundle re-audit commissioned.',
          'ag-i2-2':'Stewardship report accepted.'},
   history:[{at:'2026-07-24 08:40', who:'u4', act:'Submitted for Chair approval'},
            {at:'2026-07-26 11:15', who:'u2', act:'Approved — signature captured'},
            {at:'2026-07-26 11:16', who:null, act:'Task activation to TMS failed — queued for retry'}]},
  {id:'mom-msc-jul', occ:'occ-msc-jul', status:'Closed',
   submittedAt:'2026-07-10 09:20', approvedAt:'2026-07-12 14:00', closedAt:'2026-07-12 14:00',
   sig:{who:'u7', name:'Dr. Mai Adel', date:'2026-07-12', time:'14:00'}, returnReason:null,
   notes:{'ag-m-1':'Compliance at 88 per cent. Two units to be re-audited.',
          'ag-m-2':'List refreshed and republished to all clinical areas.'},
   history:[{at:'2026-07-10 09:20', who:'u4', act:'Submitted for Chair approval'},
            {at:'2026-07-11 08:15', who:'u7', act:'Returned for revision', note:'Attendance list incomplete.'},
            {at:'2026-07-11 16:40', who:'u4', act:'Resubmitted for Chair approval'},
            {at:'2026-07-12 14:00', who:'u7', act:'Approved — signature captured'},
            {at:'2026-07-12 14:00', who:null, act:'Outputs activated and MOM set to Closed'}]},
  {id:'mom-mpr-jul', occ:'occ-mpr-jul', status:'Closed',
   submittedAt:'2026-07-08 09:00', approvedAt:'2026-07-08 17:30', closedAt:'2026-07-08 17:30',
   sig:{who:'u7', name:'Dr. Mai Adel', date:'2026-07-08', time:'17:30'}, returnReason:null,
   notes:{'ag-p-1':'Revenue 3 per cent behind plan; occupancy the main driver.',
          'ag-p-2':'Recovery actions agreed with the commercial team.'},
   history:[{at:'2026-07-08 17:30', who:'u7', act:'Approved — signature captured'},
            {at:'2026-07-08 17:30', who:null, act:'Outputs activated and MOM set to Closed'}]},
  {id:'mom-dtf-jul', occ:'occ-dtf-jul', status:'Approved',
   submittedAt:'2026-07-15 10:00', approvedAt:'2026-07-15 18:00', closedAt:null,
   sig:{who:'u7', name:'Dr. Mai Adel', date:'2026-07-15', time:'18:00'}, returnReason:null,
   notes:{'ag-d-1':'Rollout readiness confirmed for the pilot business unit.'},
   history:[{at:'2026-07-15 18:00', who:'u7', act:'Approved — signature captured'}]},
  {id:'mom-ncr-jul', occ:'occ-ncr-jul', status:'Closed',
   submittedAt:'2026-07-22 08:00', approvedAt:'2026-07-22 12:00', closedAt:'2026-07-22 12:00',
   sig:{who:'u10', name:'Layla Ibrahim', date:'2026-07-22', time:'12:00'}, returnReason:null,
   notes:{'ag-n-1':'Three specialty competency gaps identified; closure plan due in August.'},
   history:[{at:'2026-07-22 12:00', who:'u10', act:'Approved — signature captured'},
            {at:'2026-07-22 12:00', who:null, act:'Outputs activated and MOM set to Closed'}]},
  {id:'mom-121-jul', occ:'occ-121-jul', status:'Draft',
   submittedAt:null, approvedAt:null, closedAt:null, sig:null, returnReason:null,
   notes:{'ag-121-1':'Objectives on track. Workload manageable through August.',
          'ag-121-2':'Governance facilitation training agreed for Q4.'},
   history:[{at:'2026-07-27 10:50', who:'u5', act:'Meeting Minutes created from the Meeting Occurrence'}]},
],

/* ---------------- TMS Tasks -------------------------------------------- */
tasks:[
  {id:'tk-may-1', title:'Re-audit isolation compliance in Units 3 and 5', owner:'u14',
   due:'2026-06-20', closed:'2026-06-18', status:'Closed', src:{k:'mom', id:'mom-oqc-may', ag:'ag-1-2'}, draft:false},
  {id:'tk-jun-1', title:'Publish revised corrective action tracker', owner:'u3',
   due:'2026-07-05', closed:'2026-07-03', status:'Closed', src:{k:'mom', id:'mom-oqc-jun', ag:'ag-2-2'}, draft:false},
  {id:'tk-jun-2', title:'Close two indicators below target with a documented action', owner:'u5',
   due:'2026-07-10', closed:'2026-07-14', status:'Closed', src:{k:'mom', id:'mom-oqc-jun', ag:'ag-2-1'}, draft:false},
  {id:'tk-jun-3', title:'Confirm accreditation evidence folder structure', owner:'u1',
   due:'2026-07-12', closed:'2026-07-12', status:'Closed', src:{k:'mom', id:'mom-oqc-jun', ag:'ag-2-3'}, draft:false},
  {id:'tk-msc-1', title:'Re-audit high-alert double-check in two units', owner:'u14',
   due:'2026-08-10', closed:null, status:'In Progress', src:{k:'mom', id:'mom-msc-jul', ag:'ag-m-1'}, draft:false},
  {id:'tk-msc-2', title:'Republish look-alike sound-alike list to clinical areas', owner:'u14',
   due:'2026-07-31', closed:'2026-07-24', status:'Closed', src:{k:'mom', id:'mom-msc-jul', ag:'ag-m-2'}, draft:false},
  {id:'tk-ipc-1', title:'Commission central line bundle re-audit', owner:'u14',
   due:'2026-08-20', closed:null, status:'Queued for TMS', src:{k:'mom', id:'mom-ipc-jul', ag:'ag-i2-1'}, draft:false,
   syncFailed:true},
  {id:'tk-ipc-jun-1', title:'Escalate isolation compliance to unit managers', owner:'u10',
   due:'2026-07-15', closed:'2026-07-13', status:'Closed', src:{k:'mom', id:'mom-ipc-jun', ag:'ag-i1-2'}, draft:false},
  {id:'tk-mpr-1', title:'Deliver occupancy recovery plan', owner:'u11',
   due:'2026-08-05', closed:null, status:'In Progress', src:{k:'mom', id:'mom-mpr-jul', ag:'ag-p-2'}, draft:false},
  {id:'tk-ncr-1', title:'Draft specialty competency closure plan', owner:'u10',
   due:'2026-08-18', closed:null, status:'Open', src:{k:'mom', id:'mom-ncr-jul', ag:'ag-n-1'}, draft:false},
  {id:'tk-j-1', title:'Publish the revised quality dashboard with the sepsis bundle indicator', owner:'u1',
   due:'2026-08-13', closed:null, status:'Draft', src:{k:'mom', id:'mom-oqc-jul', ag:'ag-j-1'}, draft:true},
  {id:'tk-a1-1', title:'Update the hand hygiene audit schedule to weekly', owner:'u3',
   due:'2026-07-20', closed:'2026-07-19', status:'Closed', src:{k:'dec', id:'dec-a1'}, draft:false},
],

/* ---------------- Decisions -------------------------------------------- */
decisions:[
  {id:'dec-a1', title:'Standardise the hand hygiene audit frequency to weekly',
   type:'Quality Improvement Action', value:null, path:'Direct', status:'Closed',
   creator:'u5', bu:'AHJ', dept:'Quality', created:'2026-06-22',
   topicNature:'Issue', topicCats:[{v:'Event or Incident', sub:'Quality'}], topicOther:null,
   impact:['Clinical','Compliance'], confidentiality:'Internal',
   rationale:'Monthly auditing was too slow to detect unit-level drift. Weekly auditing aligns with the accreditation evidence cycle and costs no additional headcount.',
   auth:{result:'Authority confirmed', reqLvl:2, cycle:null, matched:'Quality Improvement Action'},
   observers:[{who:'u7', kind:'Manager Observer'},{who:'u9', kind:'Internal Audit Observer'}],
   execOwner:'u3', outputs:[{k:'TMS Task', ref:'tk-a1-1', label:'Update the hand hygiene audit schedule to weekly', status:'Closed'}],
   proposals:[], evidence:[{name:'Hand_Hygiene_Trend_Q2.xlsx', exception:false}],
   steps:[], src:null, outcome:'Compliance recovered to 88 per cent within four weeks.',
   history:[{at:'2026-06-22 10:00', who:'u5', act:'Decision intake created'},
            {at:'2026-06-22 10:01', who:null, act:'Authority Matrix confirmed the Creator’s authority — Direct Decision'},
            {at:'2026-06-22 10:14', who:'u5', act:'Direct Decision recorded with rationale'},
            {at:'2026-06-22 10:14', who:null, act:'Manager Observer and Internal Audit Observer added'},
            {at:'2026-07-26 09:00', who:'u3', act:'Decision closed — outcome recorded'}]},

  {id:'dec-a2', title:'Replace two anaesthesia machines in Theatres 3 and 4',
   type:'Capital Expenditure', value:180000, path:'Request', status:'In Approval',
   creator:'u6', bu:'AHJ', dept:'Facilities', created:'2026-07-13',
   topicNature:'Opportunity', topicCats:[{v:'Project or POC Progress', sub:null}], topicOther:null,
   impact:['Clinical','Financial','Operational'], confidentiality:'Internal',
   rationale:null,
   auth:{result:'Authority not held', reqLvl:6, cycle:'AC-04', matched:'Capital Expenditure over 100,000'},
   observers:[{who:'u9', kind:'Internal Audit Observer'}],
   execOwner:null,
   outputs:[],
   need:'Both machines are beyond their supported service life and have failed two consecutive preventive maintenance checks. Continued use carries an intraoperative failure risk.',
   context:'Biomedical Engineering assessment dated 2 July 2026. Vendor support for the current model ends in December 2026.',
   proposals:[
     {id:'pr1', owner:'u6', text:'Replace both machines with the current group-standard model.',
      effect:'Removes the failure risk in one procurement cycle. Capital 180,000 SAR.', status:'Recommended'},
     {id:'pr2', owner:'u11', text:'Replace one machine now and the second in the next capital cycle.',
      effect:'Halves the immediate capital call but leaves one theatre exposed for six months.', status:'Considered'},
   ],
   evidence:[{name:'Biomedical_Assessment_2026-07-02.pdf', exception:false},
             {name:'Vendor_End_of_Support_Notice.pdf', exception:false}],
   steps:[
     {pos:'Finance Business Partner', who:'u11', state:'Approved', at:'2026-07-15 11:30',
      note:'Capital available within the approved envelope.'},
     {pos:'Business Unit Director', who:'u7', state:'Pending', at:null, note:null},
     {pos:'Group Chief Financial Officer', who:'u12', state:'Not started', at:null, note:null},
     {pos:'Group Chief Executive Officer', who:'u13', state:'Not started', at:null, note:null},
   ],
   src:null, outcome:null,
   history:[{at:'2026-07-13 09:15', who:'u6', act:'Decision intake created'},
            {at:'2026-07-13 09:16', who:null, act:'Authority Matrix returned Authority not held — Decision Request created'},
            {at:'2026-07-13 09:16', who:null, act:'Approval Cycle AC-04 Group Capital retrieved from the Authority Matrix'},
            {at:'2026-07-14 08:00', who:'u6', act:'Submitted for approval'},
            {at:'2026-07-15 11:30', who:'u11', act:'Approved step 1 — Finance Business Partner'}]},

  {id:'dec-a3', title:'Extend pharmacy operating hours to 22:00 on weekdays',
   type:'Establishment or Staffing Change', value:null, path:'Request', status:'Returned',
   creator:'u14', bu:'AHJ', dept:'Pharmacy', created:'2026-07-06',
   topicNature:'Opportunity', topicCats:[{v:'Project or POC Progress', sub:null}], topicOther:null,
   impact:['Operational','People','Patient Experience'], confidentiality:'Internal',
   rationale:null,
   auth:{result:'Authority not held', reqLvl:4, cycle:'AC-03', matched:'Establishment or Staffing Change'},
   observers:[{who:'u9', kind:'Internal Audit Observer'}],
   execOwner:null, outputs:[],
   need:'Evening discharge prescriptions are delayed by an average of 70 minutes after 18:00.',
   context:'Discharge delay analysis for Q2 2026.',
   proposals:[{id:'pr3', owner:'u14', text:'Add one evening pharmacist post and one technician post.',
     effect:'Reduces the evening discharge delay to under 20 minutes.', status:'Recommended'}],
   evidence:[{name:'Discharge_Delay_Analysis_Q2.xlsx', exception:false}],
   steps:[
     {pos:'Finance Business Partner', who:'u11', state:'Returned', at:'2026-07-09 14:20',
      note:'The staffing cost model is missing. Please add the full-year cost including benefits before resubmission.'},
     {pos:'Business Unit Director', who:'u7', state:'Not started', at:null, note:null},
   ],
   src:null, outcome:null,
   history:[{at:'2026-07-06 12:00', who:'u14', act:'Decision intake created'},
            {at:'2026-07-06 12:01', who:null, act:'Authority Matrix returned Authority not held — Decision Request created'},
            {at:'2026-07-07 09:00', who:'u14', act:'Submitted for approval'},
            {at:'2026-07-09 14:20', who:'u11', act:'Requested more information — returned to the Decision Requester'}]},

  {id:'dec-a4', title:'Adopt an assisted triage tool in the Emergency Department',
   type:'Technology Adoption', value:null, path:null, status:'Draft', blocked:true,
   creator:'u15', bu:'AHJ', dept:'Information Technology', created:'2026-07-24',
   topicNature:'Opportunity', topicCats:[{v:'Project or POC Progress', sub:null}], topicOther:null,
   impact:['Clinical','Technology','Patient Experience'], confidentiality:'Internal',
   rationale:null,
   auth:{result:'No mapping found', reqLvl:null, cycle:null, matched:null},
   observers:[], execOwner:null, outputs:[],
   need:'Emergency Department triage times exceed the target at peak hours.',
   context:'Pilot proposal from the Information Technology function.',
   proposals:[], evidence:[], steps:[], src:null, outcome:null,
   history:[{at:'2026-07-24 15:30', who:'u15', act:'Decision intake created'},
            {at:'2026-07-24 15:31', who:null, act:'Authority Matrix returned no matching configuration — submission blocked'}]},

  {id:'dec-j1', title:'Add sepsis bundle compliance to the monthly quality dashboard',
   type:'Quality Improvement Action', value:null, path:'Direct', status:'Draft', draft:true,
   creator:'u5', bu:'AHJ', dept:'Quality', created:'2026-07-16',
   topicNature:'Issue', topicCats:[{v:'Event or Incident', sub:'Quality'}], topicOther:null,
   impact:['Clinical','Compliance'], confidentiality:'Internal',
   rationale:'Compliance is not visible at Committee level today, so drift is only detected at audit.',
   auth:{result:'Authority confirmed', reqLvl:2, cycle:null, matched:'Quality Improvement Action'},
   observers:[{who:'u7', kind:'Manager Observer'},{who:'u9', kind:'Internal Audit Observer'}],
   execOwner:'u1', outputs:[], proposals:[], evidence:[], steps:[],
   src:{k:'mom', id:'mom-oqc-jul', ag:'ag-j-1'}, outcome:null,
   history:[{at:'2026-07-16 10:20', who:'u4', act:'Created as a Draft Output of the Meeting Minutes'}]},

  {id:'dec-j2', title:'Mandate a hand hygiene refresher for all clinical staff in the affected units',
   type:'Clinical Protocol Change', value:null, path:'Request', status:'Draft', draft:true,
   creator:'u5', bu:'AHJ', dept:'Quality', created:'2026-07-16',
   topicNature:'Issue', topicCats:[{v:'Event or Incident', sub:'Quality'}], topicOther:null,
   impact:['Clinical','Compliance','People'], confidentiality:'Internal',
   rationale:null,
   auth:{result:'Authority not held', reqLvl:3, cycle:'AC-02', matched:'Clinical Protocol Change'},
   observers:[{who:'u9', kind:'Internal Audit Observer'}],
   execOwner:null, outputs:[],
   need:'Hand hygiene compliance is at 64 per cent in two units against a 90 per cent target.',
   context:'Raised at the Operational Quality Committee on 16 July 2026.',
   proposals:[{id:'pr4', owner:'u3', text:'Mandatory refresher within 14 days, with re-audit at 30 days.',
     effect:'Expected recovery to above 85 per cent within one cycle.', status:'Recommended'}],
   evidence:[{name:'Hand_Hygiene_Unit_Breakdown_July.xlsx', exception:false}],
   steps:[{pos:'Department Head', who:'u5', state:'Not started', at:null, note:null},
          {pos:'Medical Director', who:'u2', state:'Not started', at:null, note:null}],
   src:{k:'mom', id:'mom-oqc-jul', ag:'ag-j-2'}, outcome:null,
   history:[{at:'2026-07-16 10:35', who:'u4', act:'Created as a Draft Output of the Meeting Minutes'}]},
],

/* ---------------- Audit Grid Instances ---------------------------------- */
/* Approved instances keep the score frozen at approval — they are never recomputed. */
grids:[
  {id:'agi-oqc-apr', occ:'occ-oqc-apr', state:'Approved', tv:'AGT v1.1', locked:true,
   score:78.5, coverage:11, total:13, facilitator:'u3', chair:'u2',
   approvedAt:'2026-04-20 10:00', returnReason:null, frozen:true, version:1,
   history:[{at:'2026-04-18 09:05', who:null, act:'Instance created on MOM closure — auto-scoring complete'},
            {at:'2026-04-19 14:00', who:'u3', act:'Submitted for approval'},
            {at:'2026-04-20 10:00', who:'u2', act:'Approved — Overall Score and Coverage published'}]},
  {id:'agi-oqc-may', occ:'occ-oqc-may', state:'Approved', tv:'AGT v1.2', locked:true,
   score:83.1, coverage:12, total:13, facilitator:'u3', chair:'u2',
   approvedAt:'2026-05-25 09:30', returnReason:null, frozen:true, version:1,
   history:[{at:'2026-05-23 08:35', who:null, act:'Instance created on MOM closure — auto-scoring complete'},
            {at:'2026-05-24 11:00', who:'u3', act:'Submitted for approval'},
            {at:'2026-05-25 09:30', who:'u2', act:'Approved — Overall Score and Coverage published'}]},
  {id:'agi-oqc-jun', occ:'occ-oqc-jun', state:'Approved', tv:'AGT v1.2', locked:true,
   score:90.8, coverage:12, total:13, facilitator:'u3', chair:'u2',
   approvedAt:'2026-06-22 08:45', returnReason:null, frozen:true, version:1,
   history:[{at:'2026-06-19 16:50', who:null, act:'Instance created on MOM closure — auto-scoring complete'},
            {at:'2026-06-21 10:20', who:'u3', act:'Submitted for approval'},
            {at:'2026-06-22 08:45', who:'u2', act:'Approved — Overall Score and Coverage published'}]},
  {id:'agi-ipc-jun', occ:'occ-ipc-jun', state:'Approved', tv:'AGT v1.2', locked:true,
   score:71.7, coverage:11, total:13, facilitator:'u14', chair:'u2',
   approvedAt:'2026-06-29 13:00', returnReason:null, frozen:true, version:1,
   history:[{at:'2026-06-26 15:25', who:null, act:'Instance created on MOM closure — auto-scoring complete'},
            {at:'2026-06-28 09:00', who:'u14', act:'Submitted for approval'},
            {at:'2026-06-29 13:00', who:'u2', act:'Approved — Overall Score and Coverage published'}]},
  {id:'agi-msc-jul', occ:'occ-msc-jul', state:'Pending Facilitator Review', tv:'AGT v1.2', locked:false,
   score:null, coverage:null, total:13, facilitator:'u14', chair:'u7',
   approvedAt:null, returnReason:null, frozen:false, version:1,
   manual:{}, evidence:{},
   history:[{at:'2026-07-12 14:05', who:null, act:'Instance created on MOM closure — auto-scoring complete'},
            {at:'2026-07-12 14:05', who:null, act:'Pending Facilitator Review — 1 question awaiting a manual score'}]},
],

/* ---------------- misc -------------------------------------------------- */
settings:{...DEFAULT_SETTINGS},
matrixPatched:false,
comments:[
  {id:'c1', rec:'sub2', who:'u5', at:'2026-07-09 16:02',
   text:'Sepsis bundle indicator is missing its denominator. Please restate.'},
  {id:'c2', rec:'dec-a2', who:'u9', at:'2026-07-15 12:10',
   text:'Observer note — please retain the vendor end-of-support notice with the approved Decision.'},
],
log:[],
};
}
/* =========================================================================
   ENGINE
   ========================================================================= */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD = d => { if(!d) return '—'; const [y,m,dd]=d.split('-'); return `${+dd} ${MONTHS[+m-1]} ${y}`; };
const fmtDS = d => { if(!d) return '—'; const [y,m,dd]=d.split('-'); return `${+dd} ${MONTHS[+m-1]}`; };
const fmtDT = s => { if(!s) return '—'; const [d,t]=s.split(' '); return `${fmtD(d)}${t?' · '+t:''}`; };
const fmtP  = p => { if(!p) return '—'; const [y,m]=p.split('-'); return `${MONTHS[+m-1]} ${y}`; };
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
const hoursBetween=(a,b)=>{
  const p=s=>new Date(s.replace(' ','T')+(s.length<=10?'T00:00:00':'')).getTime();
  return Math.round((p(b)-p(a))/36e5);
};
const addDays=(d,n)=>{const t=new Date(d+'T00:00:00');t.setDate(t.getDate()+n);return t.toISOString().slice(0,10);};
const addHours=(dt,h)=>{ const t=new Date(dt.replace(' ','T')); t.setTime(t.getTime()+h*36e5);
  return t.toISOString().slice(0,16).replace('T',' '); };
const nowStamp=()=>TODAY+' '+new Date().toTimeString().slice(0,5);
const money=n=>n==null?'—':n.toLocaleString('en-US')+' SAR';
const pct=n=>(Math.round(n*10)/10)+'%';
const uid=p=>p+'-'+Math.random().toString(36).slice(2,8);

/* score band shared by every percentage question */
const band = p => p>=90?5 : p>=80?4 : p>=70?3 : p>=60?2 : p>=50?1 : 0;
const scoreColour = s => s==null?'grey' : s>=4.5?'green' : s>=3.5?'teal' : s>=2.5?'amber' : 'red';
const pctColour   = p => p==null?'grey' : p>=90?'green' : p>=80?'teal' : p>=70?'amber' : 'red';

/* ---------- Authority Matrix -------------------------------------------- */
function authorityCheck(type, value, creatorId, patched){
  let rows = AUTHORITY_MATRIX.slice();
  if(patched) rows.push({type:'Technology Adoption', max:null, reqLvl:4, cycle:'AC-03'});
  const cands = rows.filter(r=>r.type===type)
                    .sort((a,b)=>(a.max==null?Infinity:a.max)-(b.max==null?Infinity:b.max));
  if(!cands.length) return {result:'No mapping found', reqLvl:null, cycle:null, matched:null};
  const v = value==null ? 0 : value;
  const row = cands.find(r=>r.max==null || v<=r.max) || cands[cands.length-1];
  const lvl = P(creatorId).lvl;
  const label = row.max!=null && row.max!==Infinity ? `${row.type} up to ${row.max.toLocaleString('en-US')} SAR`
              : cands.length>1 ? `${row.type} over ${cands[0].max.toLocaleString('en-US')} SAR` : row.type;
  return {
    result: lvl>=row.reqLvl ? 'Authority confirmed' : 'Authority not held',
    reqLvl: row.reqLvl, cycle: lvl>=row.reqLvl ? null : row.cycle, matched: label,
  };
}

/* ---------- attendance --------------------------------------------------- */
function attendance(occ, setup, mode){
  const req = (setup ? setup.required : occ.attend.map(a=>a.who));
  const rows = occ.attend.filter(a=>req.includes(a.who));
  let num=0, den=0, delegated=0;
  rows.forEach(a=>{
    if(a.delegate){
      delegated++;
      if(mode==='exclude') return;
      den++; num += mode==='half' ? .5 : 1;
    } else { den++; if(a.present) num++; }
  });
  return {num, den, delegated, pct: den? (num/den)*100 : 0,
          present: rows.filter(a=>a.present||a.delegate).length, total: rows.length};
}

/* ---------- Audit Grid --------------------------------------------------- */
/* Returns one row per question. state: auto | manual | blank | na | retired  */
function scoreGrid(grid, db, S){
  const occ   = db.occs.find(o=>o.id===grid.occ);
  const setup = occ.setup ? MS(occ.setup) : null;
  const mom   = db.moms.find(m=>m.occ===occ.id);
  const outs  = momOutputs(db, mom);
  const tasks = outs.filter(o=>o.kind==='TMS Task');
  const decs  = outs.filter(o=>o.kind!=='TMS Task').map(o=>o.rec);
  const manual = grid.manual||{}, evid = grid.evidence||{};
  const R=[];
  const push=(id,state,score,ev,na)=>R.push({id,q:AGQ(id),state,score,ev,na});

  /* AG-01 */
  const accred = setup && setup.cls==='Accreditation-required Committee';
  if(!accred) push('AG-01','na',null,null,'A TOR or Policy reference is not mandatory for this Committee classification.');
  else if(!setup.tor) push('AG-01','auto',0,'No TOR or Policy reference is held on the approved Setup.');
  else {
    const past = setup.torReview && setup.torReview < occ.date;
    push('AG-01','auto', past?3:5,
      `${setup.tor} · review date ${fmtD(setup.torReview)} · Meeting date ${fmtD(occ.date)} → ${past?'past its review date':'current'}`);
  }

  /* AG-02 — the only manual question */
  if(!setup || !setup.tor) push('AG-02','na',null,null,'No TOR or Policy reference exists for this Committee.');
  else if(manual['AG-02']!=null) push('AG-02','manual', manual['AG-02'], evid['AG-02']||null);
  else push('AG-02','blank',null,null);

  /* AG-03 — two parts averaged */
  const hasItems = occ.agenda.length>0;
  if(S.agendaLeadDays==null){
    push('AG-03','auto', hasItems?5:0,
      `${occ.agenda.length} Agenda Item(s) recorded. Distribution half not scored — the required lead time is not configured.`);
  } else {
    const need = addDays(occ.date, -S.agendaLeadDays);
    const onTime = occ.agendaSent && occ.agendaSent <= need;
    push('AG-03','auto', ((hasItems?5:0)+(onTime?5:0))/2,
      `${occ.agenda.length} Agenda Item(s) recorded → ${hasItems?5:0}. Distributed ${occ.agendaSent?fmtD(occ.agendaSent):'not recorded'}, required on or before ${fmtD(need)} → ${onTime?5:0}. Averaged.`);
  }

  /* AG-04 */
  const unc = occ.agenda.filter(a=>a.covered===false);
  const carried = unc.length ? unc.every(a=>db.occs.some(o=>o.agenda.some(x=>x.carriedFrom===a.id))) : true;
  push('AG-04','auto', unc.length===0?5 : carried?4:0,
    unc.length===0 ? `All ${occ.agenda.length} Agenda Items covered.`
    : `${unc.length} of ${occ.agenda.length} Agenda Items not covered; ${carried?'every uncovered item carries forward to a target occurrence':'no carry-forward recorded'}.`);

  /* AG-05 — the Chair's clock: submission → approval. A late write-up never lands on the Chair. */
  if(S.momApprovalHours==null)
    push('AG-05','na',null,null,'The MOM approval period is not configured, so approval timeliness cannot be measured.');
  else if(!mom.submittedAt)
    push('AG-05','na',null,null,'The MOM was never submitted, so the Chair’s approval clock never started. Measured by AG-16 instead.');
  else {
    const h = hoursBetween(mom.submittedAt, mom.approvedAt);
    const s = h<=S.momApprovalHours ? 5 : h<=S.momApprovalHours*2 ? 2 : 0;
    push('AG-05','auto', s,
      `Submitted ${fmtDT(mom.submittedAt)}; approved ${fmtDT(mom.approvedAt)} → ${h} hours against a ${S.momApprovalHours}-hour approval period → ${s===5?'on time':s===2?'late':'missed'}.`);
  }

  /* AG-06 */
  const withOutcome = occ.agenda.filter(a=>
    outs.some(o=>o.ag===a.id) || (mom.notes&&mom.notes[a.id]&&mom.notes[a.id].trim()));
  const p6 = occ.agenda.length ? withOutcome.length/occ.agenda.length*100 : 100;
  push('AG-06','auto', band(p6),
    `${withOutcome.length} of ${occ.agenda.length} Agenda Items record an Output or a Discussion Note → ${pct(p6)}.`);

  /* AG-07 — retired */
  push('AG-07','retired',null,null);

  /* AG-08 */
  if(!setup || setup.quorumPct==null)
    push('AG-08','na',null,null,'No quorum threshold is configured for this Committee.');
  else {
    const a = attendance(occ, setup, S.delegatedAttend);
    const ok = a.pct >= setup.quorumPct;
    push('AG-08','auto', ok?5:0,
      `${a.num} of ${a.den} Required Attendees counted present → ${pct(a.pct)} against a ${setup.quorumPct}% threshold → ${ok?'achieved':'not achieved'}.`);
  }

  /* AG-09 */
  const a9 = attendance(occ, setup, S.delegatedAttend);
  push('AG-09','auto', band(a9.pct),
    `${a9.num} of ${a9.den} Required Attendees counted present → ${pct(a9.pct)}.` +
    (a9.delegated ? ` ${a9.delegated} delegated attendance treated as “${S.delegatedAttend==='exclude'?'excluded':S.delegatedAttend==='half'?'half weight':'present'}”.` : ''));

  /* AG-10 */
  if(!outs.length) push('AG-10','na',null,null,'The MOM produced no Outputs.');
  else {
    const ok = outs.filter(o=>o.ag && occ.agenda.some(a=>a.id===o.ag));
    const p = ok.length/outs.length*100;
    push('AG-10','auto', band(p), `${ok.length} of ${outs.length} MOM Outputs resolve to a parent Agenda Item → ${pct(p)}.`);
  }

  /* AG-11 */
  const dir = decs.filter(d=>d.path==='Direct');
  if(!dir.length) push('AG-11','na',null,null,'No Direct Decision was recorded from this Meeting.');
  else {
    const ok = dir.filter(d=>d.auth && d.auth.result==='Authority confirmed');
    const p = ok.length/dir.length*100;
    push('AG-11','auto', band(p), `${ok.length} of ${dir.length} Direct Decisions carry a confirmed Authority Check Result → ${pct(p)}.`);
  }

  /* AG-12 */
  const reqs = decs.filter(d=>d.path==='Request');
  if(!reqs.length) push('AG-12','na',null,null,'No Decision Request was raised from this Meeting.');
  else {
    const ok = reqs.filter(d=>{
      const chk = authorityCheck(d.type, d.value, d.creator, db.matrixPatched);
      return chk.cycle && d.auth && chk.cycle===d.auth.cycle;
    });
    const p = ok.length/reqs.length*100;
    push('AG-12','auto', band(p), `${ok.length} of ${reqs.length} Decision Requests follow the Approval Cycle returned by the Authority Matrix → ${pct(p)}.`);
  }

  /* AG-13 */
  if(!tasks.length) push('AG-13','na',null,null,'The MOM produced no Tasks.');
  else {
    const ok = tasks.filter(t=>t.rec.owner && t.rec.due);
    const p = ok.length/tasks.length*100;
    push('AG-13','auto', band(p), `${ok.length} of ${tasks.length} Tasks carry both an Execution Owner and a due date → ${pct(p)}.`);
  }

  /* AG-14 */
  const prior = setup ? db.occs.filter(o=>o.setup===setup.id && o.date<occ.date) : [];
  const priorMoms = prior.map(o=>db.moms.find(m=>m.occ===o.id)).filter(Boolean).map(m=>m.id);
  const priorTasks = db.tasks.filter(t=>t.src.k==='mom' && priorMoms.includes(t.src.id) && t.due < occ.date);
  if(!prior.length) push('AG-14','na',null,null,'This is the first occurrence of this Committee.');
  else if(!priorTasks.length) push('AG-14','na',null,null,'No Task from an earlier occurrence was due before this Meeting.');
  else {
    const ok = priorTasks.filter(t=>t.closed && t.closed<=t.due);
    const p = ok.length/priorTasks.length*100;
    push('AG-14','auto', band(p), `${ok.length} of ${priorTasks.length} prior Tasks due before ${fmtD(occ.date)} were closed on or before their due date → ${pct(p)}.`);
  }

  /* AG-15 — the invitation, not the Agenda. Different act, different clock. */
  if(S.inviteLeadDays==null)
    push('AG-15','na',null,null,'The Meeting invitation lead time is not configured.');
  else {
    const need = addDays(occ.date, -S.inviteLeadDays);
    const s = !occ.inviteSent ? 0 : occ.inviteSent <= need ? 5 : 2;
    push('AG-15','auto', s,
      occ.inviteSent
        ? `Invitation sent ${fmtD(occ.inviteSent)}, required on or before ${fmtD(need)} (${S.inviteLeadDays} days ahead) → ${s===5?'on time':'late'}.`
        : `No invitation date recorded; required on or before ${fmtD(need)} → 0.`);
  }

  /* AG-16 — the Facilitator's clock: Meeting end → submission. */
  if(S.momWriteupHours==null)
    push('AG-16','na',null,null,'The MOM write-up period is not configured, so write-up timeliness cannot be measured.');
  else if(!mom.submittedAt)
    push('AG-16','auto',0,`Meeting ended ${fmtD(occ.date)} ${occ.end}; the MOM was never submitted → 0.`);
  else {
    const h = hoursBetween(occ.date+' '+occ.end, mom.submittedAt);
    const s = h<=S.momWriteupHours ? 5 : h<=S.momWriteupHours*2 ? 2 : 0;
    push('AG-16','auto', s,
      `Meeting ended ${fmtD(occ.date)} ${occ.end}; MOM submitted ${fmtDT(mom.submittedAt)} → ${h} hours against a ${S.momWriteupHours}-hour write-up period → ${s===5?'on time':s===2?'late':'missed'}.`);
  }

  return R.sort((x,y)=>x.id.localeCompare(y.id));
}

function gridTotals(rows){
  const app = rows.filter(r=>r.state==='auto'||r.state==='manual');
  const blanks = rows.filter(r=>r.state==='blank');
  const scored = app.reduce((s,r)=>s+r.score*r.q.w, 0);
  const max    = app.reduce((s,r)=>s+5*r.q.w, 0);
  const total  = AG_ACTIVE.length;
  const applicable = app.length + blanks.length;
  return {
    score: max? Math.round(scored/max*1000)/10 : null,
    coverage: Math.round(applicable/total*1000)/10,
    applicable, total, blanks: blanks.length,
    na: rows.filter(r=>r.state==='na').length,
  };
}

/* Outputs of one MOM, resolved to their target records */
function momOutputs(db, mom){
  if(!mom) return [];
  const out=[];
  db.tasks.filter(t=>t.src.k==='mom' && t.src.id===mom.id)
    .forEach(t=>out.push({kind:'TMS Task', id:t.id, ag:t.src.ag, label:t.title, rec:t, draft:t.draft}));
  db.decisions.filter(d=>d.src && d.src.k==='mom' && d.src.id===mom.id)
    .forEach(d=>out.push({kind: d.path==='Direct'?'Direct Decision':'Decision Request',
                          id:d.id, ag:d.src.ag, label:d.title, rec:d, draft:!!d.draft}));
  return out;
}

/* What this occurrence inherits from the one before it.
   Nothing is copied. These are the earlier occurrence's own records, still open, shown
   here so the meeting starts from where the last one stopped. They are closed where they
   were raised — never here. */
function carriedForward(db, occ){
  const empty={prev:null, tasks:[], decisions:[], agenda:[]};
  if(!occ.setup) return empty;
  const prior=db.occs
    .filter(o=>o.setup===occ.setup && o.id!==occ.id && o.date<occ.date && o.status==='Held')
    .sort((a,b)=>b.date.localeCompare(a.date));
  const prev=prior[0]||null;
  if(!prev) return empty;
  const mom=db.moms.find(m=>m.occ===prev.id);
  const openTasks = mom
    ? db.tasks.filter(t=>!t.draft && t.src.k==='mom' && t.src.id===mom.id && t.status!=='Closed')
    : [];
  const openDecs = mom
    ? db.decisions.filter(d=>!d.draft && d.src && d.src.k==='mom' && d.src.id===mom.id
                             && d.status!=='Closed')
    : [];
  const carriedAgenda=(occ.agenda||[]).filter(a=>a.carriedFrom);
  return {prev, tasks:openTasks, decisions:openDecs, agenda:carriedAgenda};
}

/* Meeting input readiness (v0.6) */
const RPT_RANK = {'Draft':0,'In Review':1,'Approved':2};
function inputReadiness(db, occ, S){
  const need = S.inputReadiness==='approved' ? 2 : 1;
  return occ.inputs.map(id=>{
    if(id.startsWith('mom-')){
      const m = db.moms.find(x=>x.id===id);
      const o = m && db.occs.find(x=>x.id===m.occ);
      return {id, kind:'Approved MOM', label:o?(o.setup?MS(o.setup).name:o.custom.name)+' · '+fmtD(o.date):id,
              status:m?m.status:'—', ready:m && (m.status==='Approved'||m.status==='Closed'), rank:2, need};
    }
    const r = db.reports.find(x=>x.id===id);
    if(!r) return {id, kind:'Report Submission', label:id, status:'—', ready:false, rank:0, need};
    const nm = r.setup? RS(r.setup).name : r.custom.name;
    return {id, kind:'Report Submission', label:nm+' · '+fmtP(r.period), status:r.status,
            rank:RPT_RANK[r.status], ready:RPT_RANK[r.status]>=need, need};
  });
}
/* =========================================================================
   SHARED UI
   ========================================================================= */
const Ctx = createContext(null);
const use = () => useContext(Ctx);

const Tag  = ({c='grey',children,...r}) => <span className={'tag '+c} {...r}>{children}</span>;
const Btn  = ({k='',children,...r}) => <button className={'btn '+k} {...r}>{children}</button>;
const Note = ({k='info',ic,children}) =>
  <div className={'note '+k}><span className="ic">{ic|| (k==='warn'?'▲':k==='err'?'✕':k==='ok'?'✓':k==='lock'?'🔒':'i')}</span><div>{children}</div></div>;
const OD   = ({id,closed}) => <span className={'od'+(closed?' closed':'')}>{closed?'✓ ':'⚠ '}{id}</span>;
const Bar  = ({v,c}) => <div className={'bar '+(c||'')}><i style={{width:Math.max(0,Math.min(100,v))+'%'}}/></div>;

const Field = ({label,req,hint,err,children}) =>
  <div className="f">
    {label && <label>{label}{req && <span className="req">*</span>}</label>}
    {children}
    {hint && !err && <div className="hint">{hint}</div>}
    {err && <div className="err">{err}</div>}
  </div>;

const Empty = ({ic='—',children}) => <div className="empty"><div className="ic">{ic}</div>{children}</div>;

const Stat = ({label,v,d,c,on,onClick}) =>
  <div className={'stat'+(onClick?' click':'')+(on?' on':'')} onClick={onClick}>
    <label>{label}</label>
    <div className="v" style={c?{color:`var(--${c})`}:null}>{v}</div>
    {d && <div className="d">{d}</div>}
  </div>;

const KVBlock = ({items}) =>
  <div className="kv-block">{items.filter(Boolean).map(([k,v],i)=>
    <div className="kv-i" key={i}><label>{k}</label><div>{v}</div></div>)}</div>;

const Rail = ({steps,now,done,voidAt}) =>
  <div className="rail">{steps.map((s,i)=>{
    const cls = voidAt===s ? 'void' : done.includes(s) ? 'done' : now===s ? 'now' : '';
    return <div className={'rail-s '+cls} key={s}>
      <label>Step {i+1}</label><div className="n">{s}</div></div>;
  })}</div>;

const Hist = ({items}) =>
  <div className="hist">{items.map((h,i)=>
    <div className="hist-i" key={i}>
      <b>{h.who?P(h.who).name:'System'}</b> — {h.act}
      <div className="w">{fmtDT(h.at)}{h.note?' · “'+h.note+'”':''}</div>
    </div>)}</div>;

function Modal({title,sub,onClose,footer,wide,children}){
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

const Pills = ({opts,val,onChange,multi}) =>
  <div className="pill-set">{opts.map(o=>{
    const v = typeof o==='string'?o:o.v, lbl = typeof o==='string'?o:o.label||o.v;
    const on = multi ? (val||[]).includes(v) : val===v;
    return <button type="button" key={v} className={'pill'+(on?' on':'')}
      onClick={()=>multi
        ? onChange(on ? val.filter(x=>x!==v) : [...(val||[]), v])
        : onChange(on?null:v)}>{lbl}</button>;
  })}</div>;

/* score display used in three places */
const ScoreHero = ({score,coverage,applicable,total,threshold,state}) => {
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

/* =========================================================================
   NAVIGATION
   ========================================================================= */
const NAV = [
  {g:'Start here',    items:[
    {id:'work',  n:1, label:'My Workspace'},
    {id:'cal',   n:2, label:'Calendar'}]},
  {g:'Execution',     items:[
    {id:'rpt',   n:3, label:'Reports & Plans'},
    {id:'mtg',   n:4, label:'Meetings & Committees'},
    {id:'mom',   n:5, label:'Meeting Minutes'}]},
  {g:'Governance',    items:[
    {id:'dec',   n:6, label:'Decisions'},
    {id:'grid',  n:7, label:'Committee Scores'}]},
  {g:'Configuration', items:[
    {id:'set',   n:8, label:'Governance Settings'}]},
];
/* one-line answer to "what lives here?", shown under each nav group on the workspace */
const NAV_HINT = {
  work:'Everything open right now — due, in review, and finished-but-unclosed.',
  cal :'Every Meeting, Committee and Report due date, in one full calendar.',
  rpt :'Every Report and Plan: due to submit, in review, approved.',
  mtg :'Every Meeting and Committee — and inside each one its Agenda, Attendance and follow-up.',
  mom :'Every set of Meeting Minutes: Draft, Pending Approval, Approved, Closed.',
  dec :'The Decision register: every Decision and Decision Request whatever raised it.',
  grid:'Committee governance scores across occurrences.',
  set :'The values that are not yet approved, and what each one switches on.',
};

function Side(){
  const {screen,go,counts} = use();
  return <nav className="side">
    {NAV.map(g=><div key={g.g}>
      <div className="side-grp">{g.g}</div>
      {g.items.map(i=>
        <button key={i.id} type="button" aria-current={screen===i.id?'page':undefined}
          aria-label={i.label+(counts[i.id]>0?' — '+counts[i.id]+' open activities':'')}
          className={'nav-i'+(screen===i.id?' on':'')} onClick={()=>go(i.id)}>
          <span className="nav-n">{i.n}</span><span>{i.label}</span>
          {counts[i.id]>0 && <span className="nav-b" aria-label={counts[i.id]+' open activities'}>
            {counts[i.id]}</span>}
        </button>)}
    </div>)}
  </nav>;
}

function TopBar(){
  const {bu,setBu,reset,onSwitch} = use();
  return <div className="topbar">
    <div className="tb-brand"><b>ANDALUSIA PULSE</b><span>Leadership Practice</span></div>
    <span className="tb-scope" title="This demo signs in as one user holding every role, so the whole
      governance cycle can be walked in one sitting. Each record still names its accountable owner.">
      Signed in · full access, every role</span>
    <div className="tb-f">
      <label>Business unit</label>
      <select value={bu} onChange={e=>setBu(e.target.value)}>
        <option value="ALL">All business units</option>
        {BUS.map(b=><option key={b.id} value={b.id}>{b.id} — {b.name}</option>)}
      </select>
    </div>
    <div className="tb-sp"/>
    <span className="tb-scope">{fmtD(TODAY)}</span>
    <Btn k="tb-btn sm" title="Reset the demo to its seeded state" onClick={reset}>↺</Btn>
    <Btn k="tb-btn" onClick={onSwitch}>Governance Setup →</Btn>
  </div>;
}

/* =========================================================================
   CALENDAR — a webpart that sits inside a screen, plus a full month on demand
   ========================================================================= */
const RANGES = [
  {id:'today', label:'Today'},
  {id:'tmrw',  label:'Tomorrow'},
  {id:'week',  label:'This Week'},
  {id:'next',  label:'Next Week'},
];
function rangeBounds(id){
  const dow = new Date(TODAY+'T00:00:00').getDay();          /* working week Sun–Thu */
  if(id==='today') return [TODAY,TODAY];
  if(id==='tmrw')  return [addDays(TODAY,1),addDays(TODAY,1)];
  const sun = addDays(TODAY,-dow);
  if(id==='week')  return [sun,addDays(sun,6)];
  return [addDays(sun,7),addDays(sun,13)];
}

function CalendarWebpart({items,title,kinds,emptyText}){
  const {go,openMeeting} = use();
  const [rng,setRng]=useState('week');
  const [lo,hi]=rangeBounds(rng);
  const pool=items.filter(i=>!kinds || kinds.includes(i.kind));
  const rows=pool.filter(i=>i.date>=lo && i.date<=hi)
                 .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const open=i=> i.screen==='mtg' ? openMeeting(i.id,i.tab||'detail') : go(i.screen,i.id);

  return <div className="card">
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:4}}>
      <h2 style={{flex:1,minWidth:150}}>{title||'Upcoming Schedule'}</h2>
      <div className="seg">{RANGES.map(r=>
        <button key={r.id} className={rng===r.id?'on':''} onClick={()=>setRng(r.id)}>{r.label}</button>)}
      </div>
      <Btn onClick={()=>go('cal')}>🗓 Open Calendar</Btn>
    </div>
    <div className="csub" style={{marginBottom:6}}>
      {fmtD(lo)}{lo!==hi && ' — '+fmtD(hi)} · {rows.length} item{rows.length===1?'':'s'}</div>
    {rows.length===0
      ? <Empty ic="🗓">{emptyText||'Nothing scheduled in this range.'}</Empty>
      : rows.map((i,n)=>
        <div className="sched-r" key={i.kind+i.id+n} onClick={()=>open(i)}>
          <div className={'sched-ic '+KIND_SLOT[i.kind]}>{KIND_ICON[i.kind]}</div>
          <div className="sched-t">
            <div className="n">{i.restricted&&'🔒 '}{i.title}
              {i.date===TODAY && <Tag c="amber">Today</Tag>}
              {i.date<TODAY && i.kind==='Report' && i.status!=='Approved' && <Tag c="red">Overdue</Tag>}
            </div>
            <div className="m">{fmtD(i.date)}{i.time?' · '+i.time:''} · {i.sub}</div>
          </div>
          <Tag c={i.kind==='Report'?'blue':i.kind==='Decision'?'amber':'teal'}>{i.kind}</Tag>
        </div>)}
    {pool.length>rows.length &&
      <div className="sched-more" onClick={()=>go('cal')}>
        View all {pool.length} items on the calendar</div>}
  </div>;
}

/* =========================================================================
   CALENDAR — full-page version, reachable directly from the sidebar
   ========================================================================= */
const CAL_KINDS = [
  {id:'All',     label:'All',      colour:null},
  {id:'Meeting', label:'Meetings', colour:'blue'},
  {id:'Report',  label:'Reports',  colour:'ink'},
  {id:'MOM',     label:'MOM Due',  colour:'purple'},
];
/* Icon/colour treatment for a calendar item's kind — MOM Due borrows the Minutes styling,
   since a MOM write-up deadline is, functionally, a Minutes item. */
const calIconKind = k => k==='MOM' ? 'Minutes' : k;
const calTagColour = k => k==='Report'?'ink' : k==='MOM'?'purple' : 'blue';
const calGridCls = i => i.status==='Cancelled' ? 'k-canc'
  : i.kind==='Report' ? 'k-rpt' : i.kind==='MOM' ? 'k-mom' : 'k-mtg';
const CAL_DOT = {blue:'var(--blue)', ink:'var(--ink)', purple:'var(--purple)'};

function ScreenCalendar(){
  const {db,cal,go,openMeeting} = use();
  const [view,setView] = useState('month');   /* month | week | list */
  const [kind,setKind] = useState('All');
  const [ym,setYm]     = useState(TODAY.slice(0,7));

  const vis = kind==='All' ? cal : cal.filter(i=>i.kind===kind);
  const open = i => i.screen==='mtg' ? openMeeting(i.id,i.tab||'detail') : go(i.screen,i.id);

  const [y,m]=ym.split('-').map(Number);
  const first=new Date(y,m-1,1), start=new Date(first); start.setDate(1-first.getDay());
  const cells=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);
    return d.toISOString().slice(0,10);});
  const shift=n=>{const d=new Date(y,m-1+n,1);setYm(d.toISOString().slice(0,7));};

  const EventRow = ({i}) =>
    <div className="sched-r" onClick={()=>open(i)}>
      <div className={'sched-ic '+KIND_SLOT[calIconKind(i.kind)]}>{KIND_ICON[calIconKind(i.kind)]}</div>
      <div className="sched-t"><div className="n">{i.restricted&&'🔒 '}{i.title}</div>
        <div className="m">{fmtD(i.date)}{i.time?' · '+i.time:''} · {i.sub}</div></div>
      <Tag c={calTagColour(i.kind)}>{i.kind==='MOM'?'MOM':i.kind}</Tag>
    </div>;

  /* -------- This Week's Meetings -------- */
  const wk = rangeBounds('week'), nextWk = [addDays(wk[1],1),addDays(wk[1],7)];
  const byDateTime = (a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''));
  const thisWeekMtgs = cal.filter(i=>i.kind==='Meeting' && i.date>=wk[0] && i.date<=wk[1]
    && i.status!=='Cancelled').sort(byDateTime);
  const nextWeekMtgs = cal.filter(i=>i.kind==='Meeting' && i.date>=nextWk[0] && i.date<=nextWk[1]
    && i.status!=='Cancelled').sort(byDateTime);
  const MtgRow = ({i}) => {
    const o=db.occs.find(x=>x.id===i.id);
    return <div className="wa-up-r" onClick={()=>open(i)}>
      <div className="wa-date"><span className="dd">{i.date.slice(8)}</span>
        <span className="mo">{MONTHS[+i.date.slice(5,7)-1]}</span></div>
      <div className="wa-up-t"><div className="n">{i.title}
          {i.date===TODAY && <Tag c="amber">Today</Tag>}</div>
        <div className="m">{i.time}{o?' · '+(o.location||o.mode)+' · '+o.attend.length+' attendees':''}</div></div>
    </div>;
  };

  /* -------- Upcoming Deadlines -------- */
  const deadlines = cal.filter(i=>(i.kind==='Report'||i.kind==='MOM') && i.date>=TODAY)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  const relDay = d => { const n=daysBetween(TODAY,d);
    return n<=0?'Today':n===1?'Tomorrow':n+' days'; };

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Calendar</h1>
        <div className="sub">View all Meetings, Report due dates and MOM write-up deadlines.</div></div>
      <div className="seg">
        {['month','week','list'].map(v=>
          <button key={v} className={view===v?'on':''} onClick={()=>setView(v)}>
            {v[0].toUpperCase()+v.slice(1)}</button>)}
      </div>
    </div>

    <div className="fltr" style={{justifyContent:'space-between'}}>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <Btn k="sm" onClick={()=>shift(-1)}>←</Btn>
        <b style={{fontSize:14,minWidth:132,textAlign:'center'}}>{MONTHS[m-1]} {y}</b>
        <Btn k="sm" onClick={()=>shift(1)}>→</Btn>
        <Btn k="sm" onClick={()=>setYm(TODAY.slice(0,7))}>Today</Btn>
      </div>
      <div className="chip-row" style={{margin:0}}>
        {CAL_KINDS.map(k=>{
          const on = kind===k.id;
          const style = k.colour ? {borderColor:CAL_DOT[k.colour],
            background:on?`var(--${k.colour==='ink'?'grey':k.colour}-bg)`:'#fff',
            color:k.colour==='ink'?'var(--ink)':`var(--${k.colour})`} : {borderColor:'var(--border-d)',color:'var(--ink-2)'};
          return <button key={k.id} className={'cal-fchip'+(on?' on':'')} style={style} onClick={()=>setKind(k.id)}>
            {k.colour && <span className="dot" style={{background:CAL_DOT[k.colour]}}/>}
            {k.label}</button>;})}
      </div>
    </div>

    {view==='month' && <div className="card">
      <div className="cal">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div className="cal-h" key={d}>{d}</div>)}
        {cells.map(d=>{
          const out=d.slice(0,7)!==ym, evs=vis.filter(i=>i.date===d);
          return <div key={d} className={'cal-d'+(out?' out':'')+(d===TODAY?' today':'')+
                        (isNonWorking(d)&&!out?' nonwork':'')}>
            <div className="cal-n"><span>{+d.slice(8)}</span>
              {isNonWorking(d)&&!out && <span className="nw">NON-WORKING</span>}</div>
            {evs.map((i,n)=><div key={i.kind+i.id+n} className={'cal-e '+calGridCls(i)} onClick={()=>open(i)}
                title={i.title+' · '+i.sub}>
              {i.restricted?'🔒 ':''}{i.time?i.time+' ':''}{i.title}</div>)}
          </div>;})}
      </div>
      <div style={{display:'flex',gap:15,flexWrap:'wrap',marginTop:11,fontSize:11.5,color:'var(--muted)'}}>
        <span><span className="tag blue" style={{padding:'1px 7px'}}>&nbsp;</span> Meetings</span>
        <span><span className="tag ink" style={{padding:'1px 7px'}}>&nbsp;</span> Reports</span>
        <span><span className="tag purple" style={{padding:'1px 7px'}}>&nbsp;</span> MOM Due</span>
        <span><span className="tag grey" style={{padding:'1px 7px'}}>&nbsp;</span> Cancelled</span>
      </div>
    </div>}

    {view==='week' && <div className="card">
      <h2>Week of {fmtDS(wk[0])} – {fmtDS(wk[1])}</h2>
      <div className="csub" style={{marginBottom:2}}>Every item in the selected range, whatever kind.</div>
      {vis.filter(i=>i.date>=wk[0]&&i.date<=wk[1]).length===0 ? <Empty ic="🗓">Nothing this week.</Empty>
      : vis.filter(i=>i.date>=wk[0]&&i.date<=wk[1]).sort(byDateTime)
          .map((i,n)=><EventRow key={i.kind+i.id+n} i={i}/>)}
    </div>}

    {view==='list' && <div className="card">
      <h2>Upcoming</h2>
      <div className="csub" style={{marginBottom:2}}>Everything from today onward, in order.</div>
      {vis.filter(i=>i.date>=TODAY).length===0 ? <Empty ic="🗓">Nothing upcoming.</Empty>
      : vis.filter(i=>i.date>=TODAY).sort(byDateTime).map((i,n)=><EventRow key={i.kind+i.id+n} i={i}/>)}
    </div>}

    <div className="wa-grid" style={{marginTop:16,gridTemplateColumns:'1fr 1fr'}}>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
          <div className="wa-icon gold">🗓</div><h2 style={{flex:1}}>This Week's Meetings</h2>
        </div>
        {thisWeekMtgs.length===0 ? <Empty ic="🗓">No Meetings this week.</Empty>
        : thisWeekMtgs.map((i,n)=><MtgRow key={'tw'+i.id+n} i={i}/>)}
        {nextWeekMtgs.length>0 && <>
          <div style={{fontSize:10,letterSpacing:'.07em',textTransform:'uppercase',color:'var(--faint)',
            fontWeight:700,margin:'10px 0 2px'}}>Next Week</div>
          {nextWeekMtgs.map((i,n)=><MtgRow key={'nw'+i.id+n} i={i}/>)}
        </>}
      </div>

      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
          <div className="wa-icon amber">⏰</div><h2 style={{flex:1}}>Upcoming Deadlines</h2>
        </div>
        {deadlines.length===0 ? <Empty ic="✓">Nothing due.</Empty>
        : deadlines.map((i,n)=>
          <div key={'dl'+i.id+i.kind+n} className="wa-up-r" onClick={()=>open(i)}>
            <div className="wa-date"><span className="dd">{i.date.slice(8)}</span>
              <span className="mo">{MONTHS[+i.date.slice(5,7)-1]}</span></div>
            <div className="wa-up-t"><div className="n">{i.title}</div>
              <div className="m">{i.sub}</div></div>
            <Tag c="grey">{relDay(i.date)}</Tag>
          </div>)}
      </div>
    </div>
  </>;
}

function Toasts(){
  const {toasts} = use();
  return <div className="toasts">{toasts.map(t=>
    <div className={'toast '+(t.k||'')} key={t.id}><b>{t.title}</b><span>{t.body}</span></div>)}</div>;
}
/* =========================================================================
   ACCESS + WORK QUEUE
   ========================================================================= */
/* An Ad Hoc Meeting names no MOM Recorder. Where none is held, the Facilitator writes up
   the Minutes — the same person the write-up period (AG-16) is measured against. */
const occRoles = occ => {
  const facilitator = occ.facilitatorOverride || (occ.setup ? MS(occ.setup).facilitator : null);
  return {
    chair:       occ.chairOverride    || (occ.setup ? MS(occ.setup).chair    : null),
    facilitator,
    recorder:    occ.recorderOverride || (occ.setup ? MS(occ.setup).recorder : null) || facilitator,
  };
};
const occName = occ => occ.setup ? MS(occ.setup).name : occ.custom.name;
const occCode = occ => 'MTG-'+occ.date.slice(0,4)+'-'+occ.id.slice(-4).toUpperCase();
const momCode = m => m ? 'MOM-'+m.id.slice(-4).toUpperCase() : '—';
const occType = occ => occ.setup ? MS(occ.setup).type : 'Business Meeting';
const occCls  = occ => occ.setup ? (MS(occ.setup).subCls || MS(occ.setup).cls) : 'Ad Hoc';
const isCommittee = occ => occType(occ)==='Committee';

/* One signed-in user holding every role. Records keep their real accountable owner — every action
   still names the Chair, Reviewer or Facilitator it belongs to — but this user may act for them. */
const ME = 'u0';
const acting = () => true;

function canSeeOcc(occ, me){
  const p = P(me), r = occRoles(occ);
  const governance = p.fam==='observer' || p.fam==='admin';
  if(occ.restricted){
    return governance || occ.attend.some(a=>a.who===me) ||
           [r.chair,r.facilitator,r.recorder].includes(me);
  }
  if(p.scope==='all') return true;
  if(p.scope==='bu')  return occ.bu===p.bu;
  return occ.attend.some(a=>a.who===me) || [r.chair,r.facilitator,r.recorder].includes(me);
}
function canSeeReport(rpt, me){
  const p = P(me);
  if(p.scope==='all') return true;
  const revs = rpt.setup ? RS(rpt.setup).reviewers : rpt.custom.reviewers;
  if(rpt.creator===me || revs.includes(me)) return true;
  return p.scope==='bu' && rpt.bu===p.bu;
}
function canSeeDec(d, me){
  const p = P(me);
  if(p.scope==='all') return true;
  if(d.creator===me || d.execOwner===me) return true;
  if(d.steps && d.steps.some(s=>s.who===me)) return true;
  if(d.observers && d.observers.some(o=>o.who===me)) return true;
  return p.scope==='bu' && d.bu===p.bu;
}

/* -------------------------------------------------------------------------
   OPEN ITEMS
   Everything the module is holding, grouped by the state it is in rather than
   by who owns it. Three buckets answer three different questions:
     due    — not started, or waiting on its first action
     review — submitted and sitting with someone else
     finish — the event happened, the governance record is not finished
   ------------------------------------------------------------------------- */
const KIND_ICON = {Report:'\u{1F4C4}', Meeting:'\u{1F5D3}', Minutes:'\u{1F4DD}',
                   'Audit Grid':'✓', Decision:'⚖', Task:'☑'};
const KIND_SLOT = {Report:'rpt', Meeting:'mtg', Minutes:'gov', 'Audit Grid':'gov',
                   Decision:'dec', Task:'gov'};

function openItems(db, S){
  const due=[], review=[], finish=[];
  const mk=(bucket,area,rid,title,sub,action,owner,date,urgent,tab,screen)=>
    bucket.push({area,rid,title,sub,action,owner,date:date||null,
                 urgent:!!urgent,tab,screen:screen||'mtg'});

  /* ---- Reports ---- */
  db.reports.forEach(r=>{
    const nm   = r.setup? RS(r.setup).name : r.custom.name;
    const revs = r.setup? RS(r.setup).reviewers : r.custom.reviewers;
    const dd   = reportDue(r);
    if(r.status==='Draft')
      mk(due,'Report',r.id,nm,fmtP(r.period)+' · '+(r.setup?RS(r.setup).cat:'Custom'),
         r.file?'Prepare the working copy and submit':'Generate the working copy, then submit',
         r.creator,dd,dd&&dd<TODAY,null,'rpt');
    if(r.status==='In Review')
      mk(review,'Report',r.id,nm,fmtP(r.period)+' · review step '+(r.step+1)+' of '+revs.length,
         'Review — approve, comment or request more information',revs[r.step],dd,false,null,'rpt');
  });

  /* ---- Meetings not yet held ---- */
  db.occs.filter(o=>o.status==='Scheduled').forEach(o=>{
    const r=occRoles(o), nm=occName(o);
    const late=inputReadiness(db,o,S).filter(x=>!x.ready);
    if(!o.agenda.length)
      mk(due,'Meeting',o.id,nm,fmtD(o.date)+' · '+o.start,
         'Add at least one Agenda Item — the Meeting cannot proceed without one',
         r.facilitator||r.chair,o.date,true,'agenda');
    else if(!o.agendaSent)
      mk(due,'Meeting',o.id,nm,fmtD(o.date)+' · '+o.start,
         'Distribute the Agenda ahead of the Meeting',r.facilitator||r.chair,o.date,false,'agenda');
    if(late.length)
      mk(due,'Meeting',o.id,nm,fmtD(o.date)+' · '+o.start,
         late.length+' linked input not yet '+(S.inputReadiness==='approved'?'approved':'submitted'),
         r.facilitator||r.chair,o.date,true,'inputs');
  });

  /* ---- Meetings held, governance record unfinished ---- */
  db.occs.filter(o=>o.status==='Held').forEach(o=>{
    const r=occRoles(o), nm=occName(o), m=db.moms.find(x=>x.occ===o.id);
    if(!m){
      mk(finish,'Minutes',o.id,nm,fmtD(o.date)+' · held, no Minutes yet',
         'Record the Minutes — every completed Meeting must have them',r.recorder,o.date,true,'minutes');
      return;
    }
    if(m.status==='Draft' && !m.submittedAt)
      mk(finish,'Minutes',o.id,nm,fmtD(o.date)+' · Minutes in Draft',
         'Record the outcomes and submit for approval',r.recorder,o.date,true,'minutes');
    if(m.status==='Draft' && m.submittedAt)
      mk(review,'Minutes',o.id,nm,fmtD(o.date)+' · submitted',
         'Approve or return the Minutes — approval is the signature',r.chair,o.date,true,'minutes');
    if(m.status==='Approved' && !m.closedAt)
      mk(finish,'Minutes',o.id,nm,fmtD(o.date)+' · approved, not closed',
         'Close the Minutes to release the governance score',r.chair,o.date,false,'minutes');
    const g=db.grids.find(x=>x.occ===o.id);
    if(g){
      if(g.state==='Pending Facilitator Review')
        mk(finish,'Audit Grid',o.id,nm,fmtD(o.date)+' · awaiting scoring',
           'Score the remaining questions and submit',g.facilitator,o.date,true,'grid');
      if(g.state==='Returned for Revision')
        mk(finish,'Audit Grid',o.id,nm,fmtD(o.date)+' · returned by the Chair',
           'Revise and resubmit',g.facilitator,o.date,true,'grid');
      if(g.state==='Submitted for Approval')
        mk(review,'Audit Grid',o.id,nm,fmtD(o.date)+' · submitted',
           'Approve or return the Audit Grid',g.chair,o.date,true,'grid');
    }
  });

  /* ---- Decisions ---- */
  db.decisions.filter(d=>!d.draft).forEach(d=>{
    if(d.blocked)
      mk(due,'Decision',d.id,d.title,d.type+' · blocked',
         'No Authority Matrix mapping — submission is blocked',d.creator,null,true,null,'dec');
    else if(d.status==='Draft' && d.path==='Direct')
      mk(due,'Decision',d.id,d.title,d.type+' · authority confirmed',
         'Record the Direct Decision with a rationale',d.creator,null,false,null,'dec');
    else if(d.status==='Draft')
      mk(due,'Decision',d.id,d.title,d.type+' · Decision Request',
         'Add Proposals and evidence, then submit',d.creator,null,false,null,'dec');
    else if(d.status==='In Approval'){
      const s=d.steps.find(x=>x.state==='Pending');
      mk(review,'Decision',d.id,d.title,d.type+(s?' · '+s.pos:''),
         'Approve, reject or request more information',s?s.who:null,null,false,null,'dec');
    }
    else if(d.status==='Returned')
      mk(due,'Decision',d.id,d.title,d.type+' · returned',
         'Add the information requested and resubmit',d.creator,null,true,null,'dec');
    else if(d.status==='Approved')
      mk(finish,'Decision',d.id,d.title,d.type+' · approved',
         'Execute the Outputs and monitor the outcome',d.execOwner,null,false,null,'dec');
  });

  /* ---- Tasks ---- */
  db.tasks.filter(t=>!t.draft && t.status!=='Closed').forEach(t=>{
    if(t.src.k==='mom'){
      const m=db.moms.find(x=>x.id===t.src.id), o=m&&db.occs.find(x=>x.id===m.occ);
      mk(finish,'Task',o?o.id:null,t.title,o?'From '+occName(o)+' · '+fmtD(o.date):'Task in TMS',
         'Execute and close in TMS',t.owner,t.due,t.due<TODAY,'outputs');
    } else {
      const d=db.decisions.find(x=>x.id===t.src.id);
      mk(finish,'Task',t.src.id,t.title,d?'From the Decision “'+d.title+'”':'Task in TMS',
         'Execute and close in TMS',t.owner,t.due,t.due<TODAY,null,'dec');
    }
  });

  return {due,review,finish,all:[...due,...review,...finish]};
}

/* Due date of a Report Submission, from the reporting period and the approved Setup. */
function reportDue(r){
  if(!r.setup) return null;
  const s=RS(r.setup); if(!s.dueDay) return null;
  return r.period+'-'+String(s.dueDay).padStart(2,'0');
}

/* Calendar entries: Meetings and Report due dates on one timeline, colour-coded by kind. */
function calendarItems(db, S){
  const out=[];
  db.occs.forEach(o=>out.push({
    id:o.id, kind:'Meeting', date:o.date, time:o.start, title:occName(o),
    cls:o.status==='Cancelled'?'canc':o.restricted?'restr':o.status==='Held'?'held':'due',
    status:o.status, sub:(o.adhoc?'Ad Hoc '+o.adhoc:occCls(o))+' · '+o.mode,
    bu:o.bu, type:o.adhoc?'Ad Hoc':occType(o), screen:'mtg', tab:'detail', restricted:o.restricted}));
  db.reports.forEach(r=>{
    const d=reportDue(r); if(!d) return;
    out.push({id:r.id, kind:'Report', date:d, time:null,
      title:(r.setup?RS(r.setup).name:r.custom.name),
      cls:'rpt', status:r.status, sub:fmtP(r.period)+' · '+r.status,
      bu:r.bu, type:'Report', screen:'rpt', tab:null});
  });
  /* MOM write-up deadline — only meaningful once OD-09a (momWriteupHours) is approved,
     and only while the MOM is still an unsubmitted Draft. */
  if(S.momWriteupHours!=null) db.occs.filter(o=>o.status==='Held').forEach(o=>{
    const m=db.moms.find(x=>x.occ===o.id);
    if(!m || m.status!=='Draft' || m.submittedAt) return;
    const due=addHours(o.date+' '+o.end, S.momWriteupHours);
    out.push({id:o.id, kind:'MOM', date:due.slice(0,10), time:due.slice(11,16),
      title:'MOM Due: '+occName(o), cls:'mom', status:m.status, sub:'Write-up deadline',
      bu:o.bu, type:'MOM', screen:'mtg', tab:'minutes'});
  });
  return out;
}

/* =========================================================================
   APP
   ========================================================================= */
const KEY='andalusia_lp_v06';

function App({onSwitch}){
  const [db,setDb]     = useState(()=>{ try{ const s=localStorage.getItem(KEY);
                                          return s?JSON.parse(s):seed(); }catch(e){ return seed(); } });
  const me            = ME;      /* one signed-in user, full access */
  const [bu,setBu]     = useState('ALL');
  const [screen,setScreen] = useState('work');
  const [sel,setSel]   = useState({});
  const [toasts,setToasts] = useState([]);

  useEffect(()=>{ try{ localStorage.setItem(KEY,JSON.stringify(db)); }catch(e){} },[db]);

  const S = db.settings;
  const toast=(title,body,k)=>{ const id=uid('t');
    setToasts(t=>[...t,{id,title,body,k}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),5200); };
  /* Navigating to a screen with no id always lands on its list — otherwise clicking the sidebar
     while a record is open silently keeps you on that record. */
  const go=(s,id)=>{ setScreen(s);
    setSel(v=>({...v,[s]: id!==undefined?id:null, ...(s==='mtg'&&id===undefined?{mtgTab:null}:{})}));
    window.scrollTo({top:0}); };
  /* Minutes, the Audit Grid and follow-up all live inside their Meeting Occurrence. */
  const openMeeting=(occId,tab)=>{ setScreen('mtg');
    setSel(v=>({...v,mtg:occId,mtgTab:tab||'detail'})); window.scrollTo({top:0}); };
  const openWork=w=> w.tab ? openMeeting(w.rid,w.tab) : go(w.screen,w.rid);
  const reset=()=>{ if(!window.confirm('Reset the demo to its seeded state? All changes in this browser are discarded.')) return;
                    localStorage.removeItem(KEY); setDb(seed()); setSel({}); setScreen('work');
                    toast('Demo reset','Every record is back to its seeded state.','ok'); };

  const mut = fn => setDb(d=>{ const n=JSON.parse(JSON.stringify(d)); fn(n); return n; });
  const logIt=(n,rec,act,note)=>{ n.log.unshift({at:nowStamp(),who:me,rec,act,note:note||null}); };

  /* ---------------- report actions ------------------------------------- */
  const A = {
  submitReport:(id)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id);
    r.status='In Review'; r.step=0;
    r.history.push({at:nowStamp(),who:me,act:'Submitted for review'});
    logIt(n,id,'Report Submission submitted');
    toast('Submitted for review',`Routed to ${P((r.setup?RS(r.setup):r.custom).reviewers[0]).name} as review step 1.`,'ok');
  }),
  uploadReport:(id,name)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id); const st=r.setup?RS(r.setup):r.custom;
    r.file=name; r.ver=(r.ver||0)+1;
    r.url='/'+st.site+'/'+st.folder.replace(/ \/ /g,'/')+'/'+name;
    r.history.push({at:nowStamp(),who:me,act:'File uploaded to the Taxonomy-managed file location — version '+r.ver});
    toast('File stored','The file is held in the Taxonomy-managed location. Dataverse stores the URL and metadata.','ok');
  }),
  reviewApprove:(id,note)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id);
    const revs = r.setup?RS(r.setup).reviewers:r.custom.reviewers;
    const last = r.step>=revs.length-1;
    r.history.push({at:nowStamp(),who:me,act:'Approved review step '+(r.step+1)+(last?' — final':''),note:note||null});
    if(last){ r.status='Approved'; r.locked=true;
      r.history.push({at:nowStamp(),who:null,act:'Report Submission locked — status and audit history retained'});
      toast('Report approved','The final Reviewer approved. The Report Submission is Approved and locked.','ok');
    } else { r.step++;
      toast('Review step approved',`Routed to ${P(revs[r.step]).name} as review step ${r.step+1} of ${revs.length}.`,'ok'); }
    logIt(n,id,'Review step approved');
  }),
  reviewRMI:(id,note)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id);
    r.history.push({at:nowStamp(),who:me,act:'Requested more information',note});
    r.status='Draft'; r.step=0;
    n.comments.push({id:uid('c'),rec:id,who:me,at:nowStamp(),text:note});
    logIt(n,id,'Request More Information');
    toast('Returned to Draft','The prior review history is retained. Review resumes from the configured route on resubmission.','warn');
  }),
  createCustomReport:(f)=>mut(n=>{
    const id=uid('sub');
    n.reports.push({id,setup:null,period:PERIOD,bu:f.bu,dept:f.dept,status:'In Review',creator:me,step:0,
      file:f.file,url:'/'+f.site+'/'+f.folder+'/'+f.file,ver:1,locked:false,
      custom:{name:f.name,cat:'Custom',objective:f.objective,site:f.site,folder:f.folder,
              reviewers:f.reviewers,kpis:f.kpis||[],processes:[],noSetupFlag:true,taxonomyState:'Queued'},
      history:[{at:nowStamp(),who:me,act:'Custom Report created — no approved Setup exists'},
               {at:nowStamp(),who:null,act:'Metadata queued for Taxonomy with a No-Setup flag'},
               {at:nowStamp(),who:me,act:'Submitted for review'}]});
    logIt(n,id,'Custom Report created');
    toast('Custom Report submitted','Review started immediately. The metadata is queued for Taxonomy with a No-Setup flag and did not block submission.','ok');
  }),
  /* Multi-step Create Report wizard — either from an approved Setup (f.setupId) or Custom
     (f.setupId==='custom'). f.files is an array of {name,size} picked via the browser's real
     File API. f.submit decides whether this lands as a Draft or goes straight to In Review. */
  createReportFromWizard:(f)=>mut(n=>{
    const id=uid('sub');
    const isCustom = f.setupId==='custom';
    const setup = isCustom?null:RPT_SETUPS.find(s=>s.id===f.setupId);
    const site = isCustom?f.site:setup.site, folder = isCustom?f.folder:setup.folder;
    const files = f.files||[];
    n.reports.push({id, setup:isCustom?null:f.setupId, period:f.period, bu:f.bu||'ALL', dept:f.dept,
      status:f.submit?'In Review':'Draft', creator:me, step:0,
      file: files[0]?files[0].name:null, files,
      url: files[0] ? '/'+site+'/'+folder.replace(/ \/ /g,'/')+'/'+files[0].name : null,
      ver: files.length?1:0, locked:false,
      custom: isCustom ? {name:f.title, cat:'Custom', objective:f.summary||f.title, site:f.site,
        folder:f.folder, reviewers:f.reviewers, kpis:[], processes:[], noSetupFlag:true,
        taxonomyState:'Queued'} : null,
      summary:f.summary||null, actions:f.actions||null,
      history:[
        {at:nowStamp(),who:me,act:isCustom?'Custom Report created — no approved Setup exists'
                                          :'Report created from approved Setup'},
        ...(isCustom?[{at:nowStamp(),who:null,act:'Metadata queued for Taxonomy with a No-Setup flag'}]:[]),
        ...(files.length?[{at:nowStamp(),who:me,
            act:files.length+' attachment'+(files.length===1?'':'s')+' uploaded'}]:[]),
        ...(f.submit?[{at:nowStamp(),who:me,act:'Submitted for review'}]:[]),
      ]});
    logIt(n,id,f.submit?'Report submitted for review':'Report saved as Draft');
    toast(f.submit?'Report submitted for review':'Draft saved',
      f.submit?`Routed to ${P((isCustom?f.reviewers:setup.reviewers)[0]).name} as review step 1.`
              :'Find it any time under Due to Submit in My Reports.','ok');
  }),

  /* ---------------- meeting actions ------------------------------------ */
  createOcc:(f)=>mut(n=>{
    const id=uid('occ'); let date=f.date, resched=null;
    if(isNonWorking(date)){ resched=date;
      while(isNonWorking(date)) date=addDays(date,1); }
    n.occs.push({id,setup:f.setup||null,bu:f.bu,
      custom:f.setup?null:{name:f.name,purpose:f.purpose,noSetupFlag:true,taxonomyState:'Queued',
                           dept:f.dept,stage:f.stage},
      date,start:f.start,end:f.end,tz:'Arabia Standard Time',mode:f.mode,
      location:f.location||null,link:f.mode==='In person'?null:'https://teams.microsoft.com/l/meetup-join/'+id,
      adhoc:f.adhoc,restricted:!!f.restricted,status:'Scheduled',agendaSent:null,
      inviteSent:f.inviteSent||TODAY, sync:'Synchronized',
      cancelReason:null,rescheduledFrom:resched,inputs:f.inputs||[],
      chairOverride:f.setup?null:f.chair, facilitatorOverride:f.setup?null:f.facilitator,
      recorderOverride:null,   /* an Ad Hoc Meeting names no Recorder — the Facilitator writes it up */
      attend:f.attend.map(a=>({who:a.who,present:null,delegate:null,
                               extraRequired:a.type==='Required'})),
      agenda:f.agenda.map((t,i)=>({id:uid('ag'),seq:i+1,title:t,
        owner:f.setup?null:f.facilitator,source:'Ad Hoc',covered:null}))});
    logIt(n,id,'Meeting Occurrence created');
    n.moms.push({id:'mom-'+id,occ:id,status:'Draft',submittedAt:null,approvedAt:null,closedAt:null,
      sig:null,returnReason:null,notes:{},
      history:[{at:nowStamp(),who:me,act:'Meeting Minutes created from the Meeting Occurrence'}]});
    if(resched) toast('Occurrence rescheduled',
      `${fmtD(resched)} is a configured non-working day. This occurrence moved to ${fmtD(date)}. The series is unchanged.`,'warn');
    else if(!f.setup) toast('Custom Ad Hoc Meeting scheduled',
      'Scheduled immediately. The metadata is queued for Taxonomy with a No-Setup flag.','ok');
    else toast('Ad Hoc occurrence created',
      'Created from the approved Setup. The Setup and its classification are unchanged.','ok');
  }),
  setAgendaSent:(id,d)=>mut(n=>{ const o=n.occs.find(x=>x.id===id); o.agendaSent=d;
    toast('Agenda distributed','Distribution date recorded on the Meeting Occurrence.','ok'); }),
  setAttend:(occId,who,v)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    const a=o.attend.find(x=>x.who===who);
    if(v==='delegate'){ a.present=false; a.delegate=a.delegate?null:'u4'; }
    else { a.present=v; a.delegate=null; } }),
  holdMeeting:(id)=>mut(n=>{ const o=n.occs.find(x=>x.id===id); o.status='Held';
    logIt(n,id,'Meeting held'); toast('Meeting held','Attendance can now be recorded and the Minutes prepared.','ok'); }),
  cancelOcc:(id,reason)=>mut(n=>{ const o=n.occs.find(x=>x.id===id);
    o.status='Cancelled'; o.cancelReason=reason; o.sync='Cancellation synchronized';
    const g=n.grids.find(x=>x.occ===id); if(g){ g.state='Void'; g.score=null; }
    logIt(n,id,'Meeting Occurrence cancelled');
    toast('Occurrence cancelled','Cancellation synchronized with Outlook and Teams. No governance score is produced.','warn'); }),
  linkInput:(occId,recId)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    if(!o.inputs.includes(recId)) o.inputs.push(recId); }),
  unlinkInput:(occId,recId)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    o.inputs=o.inputs.filter(i=>i!==recId); }),
  /* Execution-level edits only. The approved Setup, its controlled name and its classification
     are owned by Taxonomy and are never editable here. */
  editOcc:(occId,f)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    const moved = o.date!==f.date || o.start!==f.start || o.end!==f.end;
    Object.assign(o,{date:f.date,start:f.start,end:f.end,mode:f.mode,
      location:f.mode==='Online'?null:f.location, link:f.mode==='In person'?null:f.link});
    if(isNonWorking(f.date)){
      const moveTo = nextWorkingDay(f.date);
      o.rescheduledFrom = f.date; o.date = moveTo;
      toast('Moved to the next working day',
        fmtD(f.date)+' is a configured non-working day, so this occurrence moved to '+fmtD(moveTo)+
        '. Only this occurrence moved — the series is unchanged.','warn');
    } else o.rescheduledFrom = null;
    o.sync = 'Synchronized';
    o.history = o.history||[];
    toast('Occurrence updated', moved
      ? 'Date and time changed, and the update was synchronized with Outlook and Teams.'
      : 'Synchronized with Outlook and Teams.','ok'); }),
  addAttendee:(occId,who,req)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    if(o.attend.some(a=>a.who===who)) return;
    o.attend.push({who,present:null,delegate:null,extraRequired:!!req});
    o.sync='Synchronized';
    toast('Attendee added',P(who).name+' was added as '+(req?'a Required':'an Optional')+
      ' Attendee and the invitation was synchronized.','ok'); }),
  removeAttendee:(occId,who)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    o.attend = o.attend.filter(a=>a.who!==who); o.sync='Synchronized';
    toast('Attendee removed',P(who).name+' was removed from this occurrence only. The governed '+
      'participant position on the Setup is unchanged.','ok'); }),
  editAgenda:(occId,agId,title,owner)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    const a=o.agenda.find(x=>x.id===agId); a.title=title; if(owner) a.owner=owner; }),
  removeAgenda:(occId,agId)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    o.agenda = o.agenda.filter(a=>a.id!==agId);
    o.agenda.forEach((a,i)=>a.seq=i+1);
    if(!o.agenda.length) toast('No Agenda Item left','Every Meeting must have at least one Agenda Item. '+
      'The Meeting cannot be marked as Held until one is added.','warn'); }),
  moveAgenda:(occId,agId,dir)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    const i=o.agenda.findIndex(a=>a.id===agId), j=i+dir;
    if(i<0||j<0||j>=o.agenda.length) return;
    const t=o.agenda[i]; o.agenda[i]=o.agenda[j]; o.agenda[j]=t;
    o.agenda.forEach((a,k)=>a.seq=k+1); }),
  addAgenda:(occId,title)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId); const r=occRoles(o);
    o.agenda.push({id:uid('ag'),seq:o.agenda.length+1,title,
      owner:r.facilitator||r.chair||me,source:'Added by the Meeting Organizer',covered:null}); }),

  /* ---------------- MOM actions ---------------------------------------- */
  momNote:(momId,agId,txt)=>mut(n=>{ const m=n.moms.find(x=>x.id===momId); m.notes[agId]=txt; }),
  momCovered:(occId,agId,v)=>mut(n=>{ const o=n.occs.find(x=>x.id===occId);
    o.agenda.find(a=>a.id===agId).covered=v; }),
  /* src: null (raised directly) · {k:'mom',id,ag} · {k:'rpt',id} */
  addTask:(f,src)=>mut(n=>{ const id=uid('tk'); const fromMom = src && src.k==='mom';
    n.tasks.push({id,title:f.title,owner:f.owner,due:f.due,closed:null,
      status:fromMom?'Draft':'Open', src:src||{k:'rpt',id:null}, draft:!!fromMom});
    toast('Task created', fromMom
      ? 'The Task stays Draft until the Meeting Chair approves the Minutes.'
      : 'Created in TMS with a back-link to this record, and recorded separately from the review step.','ok'); }),
  momSubmit:(momId)=>mut(n=>{ const m=n.moms.find(x=>x.id===momId);
    m.submittedAt=nowStamp();
    m.history.push({at:nowStamp(),who:me,act:'Submitted for Chair approval'});
    logIt(n,momId,'MOM submitted');
    toast('Submitted for approval','The Meeting Chair can now approve or return the Minutes.','ok'); }),
  momApprove:(momId,comment)=>mut(n=>{
    const m=n.moms.find(x=>x.id===momId); const occ=n.occs.find(o=>o.id===m.occ);
    const t=nowStamp().split(' ');
    m.status='Approved'; m.approvedAt=nowStamp();
    m.sig={who:me,name:P(me).name,date:t[0],time:t[1]};
    m.history.push({at:nowStamp(),who:me,act:'Approved — signature captured',note:comment&&comment.trim()?comment.trim():null});
    n.tasks.filter(x=>x.src.k==='mom'&&x.src.id===momId).forEach(x=>{x.draft=false;x.status='Open';});
    n.decisions.filter(x=>x.src&&x.src.k==='mom'&&x.src.id===momId).forEach(x=>{
      x.draft=false;
      if(x.blocked) x.status='Draft';
      else if(x.path==='Direct'){ x.status='Approved'; x.execOwner=x.execOwner||x.creator;
        x.history.push({at:nowStamp(),who:null,act:'Activated on MOM approval — recorded as an approved Direct Decision'}); }
      else { x.status='In Approval'; if(x.steps[0]) x.steps[0].state='Pending';
        x.history.push({at:nowStamp(),who:null,act:'Activated on MOM approval — routed to the Approval Cycle'}); }
    });
    m.history.push({at:nowStamp(),who:null,act:'All TMS and DMS Outputs activated'});
    logIt(n,momId,'MOM approved — signature captured');
    if(n.settings.momClosure==='auto'){ closeMom(n,m,occ);
      toast('Approved, signed and closed',
        'The signature was captured from your approval, the Outputs are active, and the Minutes are Closed.'+
        (isCommittee(occ)?' The Audit Grid has been created and auto-scored.':''),'ok');
    } else {
      toast('Approved and signed','Signature captured and Outputs activated. The Minutes still need to be closed.','ok');
    }
  }),
  momReturn:(momId,reason)=>mut(n=>{ const m=n.moms.find(x=>x.id===momId);
    m.status='Draft'; m.submittedAt=null; m.returnReason=reason;
    m.history.push({at:nowStamp(),who:me,act:'Returned for revision',note:reason});
    logIt(n,momId,'MOM returned');
    toast('Returned to the MOM Recorder','The reason is recorded and the previous review history is retained. Every Output stays Draft.','warn'); }),
  momClose:(momId)=>mut(n=>{ const m=n.moms.find(x=>x.id===momId);
    const occ=n.occs.find(o=>o.id===m.occ); closeMom(n,m,occ);
    toast('Meeting Minutes closed',
      isCommittee(occ)?'The Audit Grid has been created and auto-scored for this Committee occurrence.'
                      :'This is a Business Meeting, so no Audit Grid is created.','ok'); }),
  retryTaskSync:(taskId)=>mut(n=>{ const t=n.tasks.find(x=>x.id===taskId);
    t.syncFailed=false; t.status='Open';
    const m=n.moms.find(x=>x.id===t.src.id);
    m.history.push({at:nowStamp(),who:null,act:'Task activation retried and succeeded in TMS'});
    toast('Task activated in TMS','The queued Output reached TMS. The Minutes can now be closed.','ok'); }),

  /* ---------------- audit grid ------------------------------------------ */
  gridManual:(gid,qid,v)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    g.manual=g.manual||{}; g.manual[qid]=v; }),
  gridEvidence:(gid,qid,v)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    g.evidence=g.evidence||{}; g.evidence[qid]=v; }),
  gridSubmit:(gid)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    g.state='Submitted for Approval';
    g.history.push({at:nowStamp(),who:me,act:'Submitted for approval'});
    logIt(n,gid,'Audit Grid submitted');
    toast('Submitted for approval','The score is computed but stays unpublished until the Meeting Chair approves.','ok'); }),
  gridApprove:(gid)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    const rows=scoreGrid(g,n,n.settings), t=gridTotals(rows);
    g.state='Approved'; g.locked=true; g.frozen=true;
    g.score=t.score; g.coverage=t.applicable; g.total=t.total; g.approvedAt=nowStamp();
    g.history.push({at:nowStamp(),who:me,act:'Approved — Overall Score and Coverage published'});
    logIt(n,gid,'Audit Grid approved');
    toast('Score published',`Overall Score ${t.score}% with Coverage ${t.applicable} of ${t.total}. The Instance is locked.`,'ok'); }),
  gridReturn:(gid,reason)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    g.state='Returned for Revision'; g.returnReason=reason;
    g.history.push({at:nowStamp(),who:me,act:'Returned for revision',note:reason});
    logIt(n,gid,'Audit Grid returned');
    toast('Returned to the Facilitator','The reason is recorded and all prior history is retained.','warn'); }),
  gridNewVersion:(gid,reason)=>mut(n=>{ const g=n.grids.find(x=>x.id===gid);
    const nw={...JSON.parse(JSON.stringify(g)),id:uid('agi'),state:'Pending Facilitator Review',
      locked:false,frozen:false,score:null,approvedAt:null,returnReason:null,
      version:(g.version||1)+1,correctionReason:reason,
      history:[...g.history,{at:nowStamp(),who:me,act:'New Grid version '+((g.version||1)+1)+' opened for correction',note:reason}]};
    n.grids.push(nw);
    toast('New Grid version opened','The approved Instance is untouched. Corrections are recorded on a new version.','ok'); }),

  /* ---------------- decisions -------------------------------------------- */
  createDecision:(f,src)=>{ let newId=null; const fromMom = src && src.k==='mom';
    mut(n=>{ const chk=authorityCheck(f.type,f.value,me,n.matrixPatched); const id=uid('dec'); newId=id;
      n.decisions.push({id,title:f.title,type:f.type,value:f.value,
        path: chk.result==='No mapping found'?null:chk.result==='Authority confirmed'?'Direct':'Request',
        status:'Draft',blocked:chk.result==='No mapping found',draft:!!fromMom,
        creator:me,bu:P(me).bu,dept:P(me).dept,created:TODAY,
        topicNature:f.topicNature,topicCats:f.topicCats,topicOther:f.topicOther||null,
        impact:f.impact,confidentiality:'Internal',rationale:null,auth:chk,
        observers: chk.result==='Authority confirmed'
          ? [{who:P(me).mgr,kind:'Manager Observer'},{who:'u9',kind:'Internal Audit Observer'}].filter(o=>o.who)
          : [{who:'u9',kind:'Internal Audit Observer'}],
        execOwner:null,outputs:[],need:f.need||null,context:f.context||null,proposals:[],evidence:[],
        steps: chk.cycle?APPROVAL_CYCLES[chk.cycle].steps.map(s=>({...s,state:'Not started',at:null,note:null})):[],
        src:src||null,outcome:null,
        history:[{at:nowStamp(),who:me,
                  act:fromMom?'Created as a Draft Output of the Meeting Minutes'
                     :src&&src.k==='rpt'?'Raised from a Report Submission review'
                     :'Decision intake created'},
                 {at:nowStamp(),who:null,act:'Authority Matrix returned: '+chk.result+
                   (chk.cycle?' — Approval Cycle '+chk.cycle+' '+APPROVAL_CYCLES[chk.cycle].name+' retrieved':'')}]});
      logIt(n,id,'Decision intake created');
      toast(chk.result==='No mapping found'?'Logged, but submission is blocked'
            :fromMom?'Draft Decision added to the Minutes':'Decision logged',
        chk.result==='No mapping found'
          ? 'The Authority Matrix holds no mapping for these criteria. The record stays in Draft and no substitute route is created. Contact the Authority Matrix Owner.'
          : fromMom
          ? (chk.result==='Authority confirmed'
             ? 'Your authority is confirmed — it becomes a Direct Decision once the Chair approves the Minutes.'
             : `It becomes a Decision Request on Approval Cycle ${chk.cycle} once the Chair approves the Minutes.`)
          : chk.result==='Authority confirmed'
          ? 'Your authority is confirmed. Open it from the Decisions register to record the rationale — no approval cycle applies.'
          : `Authority is not held. It will follow Approval Cycle ${chk.cycle} — ${APPROVAL_CYCLES[chk.cycle].name}. Open it from the Decisions register to add Proposals and submit.`,
        chk.result==='No mapping found'?'err':'ok');
    }); return newId; },
  recordDirect:(id,rationale,owner)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.status='Approved'; d.rationale=rationale; d.execOwner=owner;
    d.history.push({at:nowStamp(),who:me,act:'Direct Decision recorded with rationale'});
    d.history.push({at:nowStamp(),who:null,act:'Manager Observer and Internal Audit Observer added — Observers do not approve'});
    logIt(n,id,'Direct Decision recorded');
    toast('Direct Decision recorded','No further approval cycle applies. The Decision is locked and an Execution Owner is assigned.','ok'); }),
  addProposal:(id,f)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.proposals.push({id:uid('pr'),owner:me,text:f.text,effect:f.effect,status:'Proposed'}); }),
  addEvidence:(id,name,exception)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.evidence.push({name,exception:!!exception}); }),
  submitDecision:(id)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.status='In Approval'; if(d.steps[0]) d.steps[0].state='Pending';
    d.history.push({at:nowStamp(),who:me,act:'Submitted for approval'});
    logIt(n,id,'Decision Request submitted');
    toast('Submitted',`Routed to ${d.steps[0].pos} — ${P(d.steps[0].who).name}.`,'ok'); }),
  stepAction:(id,act,note)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    const i=d.steps.findIndex(s=>s.state==='Pending'); const s=d.steps[i];
    if(act==='approve'){ s.state='Approved'; s.at=nowStamp(); s.note=note||null;
      d.history.push({at:nowStamp(),who:me,act:'Approved step '+(i+1)+' — '+s.pos,note:note||null});
      if(i===d.steps.length-1){ d.status='Approved';
        d.history.push({at:nowStamp(),who:null,act:'Final approval reached — approved Decision created and locked'});
        toast('Decision approved','The approval history is complete. Assign an Execution Owner and create the Decision Outputs.','ok');
      } else { d.steps[i+1].state='Pending';
        toast('Step approved',`Routed to ${d.steps[i+1].pos} — ${P(d.steps[i+1].who).name}.`,'ok'); }
    } else if(act==='reject'){ s.state='Rejected'; s.at=nowStamp(); s.note=note; d.status='Rejected';
      d.history.push({at:nowStamp(),who:me,act:'Rejected at step '+(i+1),note});
      toast('Decision Request rejected','Closed with a recorded reason.','warn');
    } else { s.state='Returned'; s.at=nowStamp(); s.note=note; d.status='Returned';
      d.history.push({at:nowStamp(),who:me,act:'Requested more information',note});
      toast('Returned to the Decision Requester','The previous review history is retained.','warn'); }
    logIt(n,id,'Decision step '+act); }),
  resubmitDecision:(id)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.status='In Approval';
    const i=d.steps.findIndex(s=>s.state==='Returned');
    d.steps[i].state='Pending'; d.steps[i].at=null;
    d.history.push({at:nowStamp(),who:me,act:'Resubmitted after providing the requested information'});
    toast('Resubmitted','Routing resumes on the Approval Cycle returned by the Authority Matrix.','ok'); }),
  setExecOwner:(id,who)=>mut(n=>{ n.decisions.find(x=>x.id===id).execOwner=who; }),
  addDecOutput:(id,kind,label)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    let ref=null;
    if(kind==='TMS Task'){ ref=uid('tk');
      n.tasks.push({id:ref,title:label,owner:d.execOwner,due:addDays(TODAY,21),closed:null,
        status:'Open',src:{k:'dec',id},draft:false}); }
    d.outputs.push({k:kind,ref,label,status:'Open'});
    toast('Decision Output created',kind==='TMS Task'?'A Task was created in TMS with a back-link to this Decision.':kind+' recorded and linked.','ok'); }),
  closeDecision:(id,outcome)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.status='Closed'; d.outcome=outcome;
    d.history.push({at:nowStamp(),who:me,act:'Decision closed — outcome recorded',note:outcome});
    toast('Decision closed','The outcome is recorded. Any later change must go through a follow-up Decision Request.','ok'); }),
  followUp:(id)=>mut(n=>{ const d=n.decisions.find(x=>x.id===id);
    d.history.push({at:nowStamp(),who:me,act:'Follow-up Decision Request raised — the approved Decision is unchanged'});
    toast('Follow-up raised','The approved Decision is never edited. A linked follow-up Decision Request carries the change.','ok'); }),
  patchMatrix:()=>mut(n=>{ n.matrixPatched=true;
    n.decisions.filter(d=>d.blocked).forEach(d=>{
      const chk=authorityCheck(d.type,d.value,d.creator,true);
      d.auth=chk; d.blocked=false;
      d.path=chk.result==='Authority confirmed'?'Direct':'Request';
      d.steps=chk.cycle?APPROVAL_CYCLES[chk.cycle].steps.map(s=>({...s,state:'Not started',at:null,note:null})):[];
      if(chk.result!=='Authority confirmed') d.observers=[{who:'u9',kind:'Internal Audit Observer'}];
      d.history.push({at:nowStamp(),who:null,act:'Authority Matrix mapping created — rechecked automatically and submission released'});
    });
    toast('Mapping created','The Authority Matrix Owner added the missing mapping. Blocked Decisions were rechecked and released.','ok'); }),

  /* ---------------- settings --------------------------------------------- */
  setSetting:(k,v)=>mut(n=>{ n.settings[k]=v;
    const note=OD_NOTES[k];
    toast(note.label+' updated',
      v==null?'Cleared. '+note.effect
             :'Set to '+v+'. Grids that are not yet approved will re-score. Approved Grids are never recomputed.','ok'); }),
  addComment:(rec,text)=>mut(n=>{ n.comments.push({id:uid('c'),rec,who:me,at:nowStamp(),text}); }),
  };

  /* helper used by two actions */
  function closeMom(n,m,occ){
    m.status='Closed'; m.closedAt=nowStamp();
    m.history.push({at:nowStamp(),who:null,act:'Outputs activated and MOM set to Closed'});
    if(isCommittee(occ) && !n.grids.some(g=>g.occ===occ.id)){
      const r=occRoles(occ);
      n.grids.push({id:uid('agi'),occ:occ.id,state:'Pending Facilitator Review',tv:AG_TEMPLATE_VERSION,
        locked:false,score:null,coverage:null,total:AG_ACTIVE.length,
        facilitator:r.facilitator,chair:r.chair,approvedAt:null,returnReason:null,frozen:false,
        version:1,manual:{},evidence:{},
        history:[{at:nowStamp(),who:null,act:'Instance created on MOM closure — Template version '+AG_TEMPLATE_VERSION+' applied'},
                 {at:nowStamp(),who:null,act:'Auto-scoring complete — questions the system cannot measure left blank'}]});
    }
  }

  const work = useMemo(()=>openItems(db,S),[db,S]);
  const cal  = useMemo(()=>calendarItems(db,S),[db,S]);
  const counts = useMemo(()=>{
    const c={work:work.due.length+work.finish.length};
    work.all.forEach(w=>{ c[w.screen]=(c[w.screen]||0)+1; });
    return c;
  },[work]);

  const ctx = {db,setDb,mut,me,bu,setBu,screen,go,openMeeting,openWork,sel,setSel,
               toast,toasts,reset,S,A,work,cal,counts,onSwitch};
  const Screen = {work:ScreenWorkspace, cal:ScreenCalendar, rpt:ScreenReports, mtg:ScreenMeetings,
                  mom:ScreenMinutes,
                  grid:ScreenGrid, dec:ScreenDecisions, set:ScreenSettings}[screen] || ScreenWorkspace;

  return <Ctx.Provider value={ctx}>
    <TopBar/>
    <div className="shell">
      <Side/>
      <main className={'main'+(screen==='work'||screen==='cal'||screen==='rpt'||screen==='mtg'||screen==='mom'?' full':'')}><Screen/></main>
    </div>
    <Toasts/>
  </Ctx.Provider>;
}
/* =========================================================================
   1 · MY WORKSPACE
   ========================================================================= */
const AREA_C = {'Report':'blue','Meeting':'teal','Minutes':'teal',
                'Audit Grid':'purple','Decision':'amber','Task':'grey'};

function ItemTable({rows,dateLabel}){
  const {go,openMeeting} = use();
  const open=w=> w.screen==='mtg' ? openMeeting(w.rid,w.tab||'detail') : go(w.screen,w.rid);
  return <div className="t-wrap"><table className="data">
    <thead><tr><th>Area</th><th>Record</th><th>What it needs</th><th>Accountable</th>
      <th>{dateLabel||'Date'}</th><th></th></tr></thead>
    <tbody>{rows.map((w,i)=>
      <tr key={i} className="click" onClick={()=>open(w)}>
        <td><Tag c={AREA_C[w.area]}>{w.area}</Tag></td>
        <td><div className="t-main">{w.title}</div><div className="t-sub">{w.sub}</div></td>
        <td>{w.urgent && <span style={{color:'var(--amber)',fontWeight:700,marginRight:5}}>●</span>}
            {w.action}</td>
        <td className="dim">{w.owner?P(w.owner).name:'—'}
            {w.owner && <div className="t-sub">{P(w.owner).position}</div>}</td>
        <td className="dim">{w.date?fmtD(w.date):'—'}
            {w.date && w.date<TODAY && <div><Tag c="red">Overdue</Tag></div>}</td>
        <td style={{textAlign:'right'}}><Btn k="sm">Open →</Btn></td>
      </tr>)}
    </tbody></table></div>;
}

function Bucket({dot,title,sub,rows,dateLabel,empty}){
  return <div className="bkt">
    <div className="bkt-hd">
      <span className="dot" style={{background:dot}}/>
      <div><h2>{title}</h2><div className="csub">{sub}</div></div>
      <span className="c">{rows.length}</span>
    </div>
    {rows.length===0 ? <Empty ic="✓">{empty}</Empty> : <ItemTable rows={rows} dateLabel={dateLabel}/>}
  </div>;
}

function ScreenWorkspace(){
  const {db,work,cal,go,openMeeting,S} = use();
  const [tab,setTab]     = useState('All');
  const [quick,setQuick] = useState('all');
  const overdue = work.all.filter(w=>w.date && w.date<TODAY);

  /* every open item, tagged with which of the three states it's in — used only to
     choose a status label/colour and to power "Awaiting My Action" below. */
  const tagged = [
    ...work.due.map(w=>({...w,bucket:'due'})),
    ...work.review.map(w=>({...w,bucket:'review'})),
    ...work.finish.map(w=>({...w,bucket:'finish'})),
  ];

  const TABS = [
    {id:'All',      label:'All Items'},
    {id:'Meeting',  label:'Meetings'},
    {id:'Report',   label:'Reports'},
    {id:'Minutes',  label:'MOM'},
    {id:'Decision', label:'Decisions'},
  ];
  const QUICK = [
    {id:'all',    label:'All'},
    {id:'urgent', label:'Urgent'},
    {id:'today',  label:'Due Today'},
    {id:'mine',   label:'Awaiting My Action'},
  ];

  let rows = tab==='All' ? tagged : tagged.filter(w=>w.area===tab);
  if(quick==='urgent') rows = rows.filter(w=>w.urgent);
  else if(quick==='today') rows = rows.filter(w=>w.date===TODAY);
  else if(quick==='mine') rows = rows.filter(w=>w.bucket!=='review');
  rows = [...rows].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));

  const statusOf = w =>
    w.bucket==='review' ? (w.area==='Report'?'Under Review':w.area==='Decision'?'Pending':'In Review')
    : w.bucket==='finish' ? 'Needs Completion'
    : w.area==='Meeting' ? 'Scheduled' : 'Pending';
  const statusColour = s => ({Scheduled:'blue','In Review':'amber','Under Review':'amber',
    Pending:'grey','Needs Completion':'red'}[s]||'grey');
  const actionVerb = w => w.urgent ? 'Follow Up'
    : w.area==='Meeting' ? 'Prepare' : w.area==='Report' ? 'Track' : w.area==='Decision' ? 'View'
    : w.area==='Minutes' ? 'Follow Up' : w.area==='Audit Grid' ? 'Score' : w.area==='Task' ? 'Execute'
    : 'Open';

  const upcoming = cal.filter(i=>i.date>=TODAY && i.status!=='Cancelled')
    .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,4);

  const weekBounds = rangeBounds('week');
  const meetingsThisWeek = cal.filter(i=>i.kind==='Meeting' && i.date>=weekBounds[0] && i.date<=weekBounds[1]);
  const overdueReports = overdue.filter(w=>w.area==='Report').length;

  const meetingsHeld = db.occs.filter(o=>o.status==='Held').length;
  const meetingsTotal = db.occs.filter(o=>o.status!=='Cancelled').length;
  const momApproved = db.moms.filter(m=>m.status==='Approved'||m.status==='Closed').length;
  const reportsSubmitted = db.reports.filter(r=>r.status!=='Draft').length;
  const decisionsClosed = db.decisions.filter(d=>d.status==='Closed').length;
  const decisionsTotal = db.decisions.filter(d=>!d.draft).length;
  const scoredGrids = db.grids.filter(g=>g.score!=null);
  const gridRate = scoredGrids.length
    ? (S.passThreshold
        ? Math.round(scoredGrids.filter(g=>g.score>=S.passThreshold).length/scoredGrids.length*100)
        : Math.round(scoredGrids.reduce((a,g)=>a+g.score,0)/scoredGrids.length))
    : null;

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>My Workspace</h1>
        <div className="sub">Your pending tasks, upcoming meetings, and action items across all modules.</div></div>
      <Btn k="pri" onClick={()=>go('mtg')}>+ New Meeting</Btn>
    </div>

    <div className="tabs">
      {TABS.map(t=>{
        const n = t.id==='All' ? tagged.length : tagged.filter(w=>w.area===t.id).length;
        return <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
          {t.label}<span className="c">{n}</span></button>;})}
    </div>

    <div className="stats">
      <Stat label="Pending Actions" v={work.due.length+work.finish.length}
        d="requiring your attention" c={(work.due.length+work.finish.length)?'teal':'muted'}/>
      <Stat label="Meetings This Week" v={meetingsThisWeek.length}
        d={meetingsThisWeek.filter(m=>m.status==='Held').length+' held'}/>
      <Stat label="Overdue Items" v={overdue.length}
        d={overdue.length? overdueReports+' report'+(overdueReports===1?'':'s')+' + '+
           (overdue.length-overdueReports)+' other' : 'none outstanding'}
        c={overdue.length?'red':'muted'}/>
      <Stat label="Pending Approvals" v={work.review.length} d="with a reviewer or approver"
        c={work.review.length?'amber':'muted'}/>
    </div>

    <div className="chip-row" style={{alignItems:'center'}}>
      {QUICK.map(q=>
        <button key={q.id} className={'pill'+(quick===q.id?' on':'')} onClick={()=>setQuick(q.id)}>
          {q.label}</button>)}
      <div style={{flex:1}}/>
      <Btn k="sm" onClick={()=>{setTab('All');setQuick('all');}}>▾ More Filters</Btn>
    </div>

    <div className="wa-grid">
      <div className="card flush">
        <div className="card-hd" style={{display:'flex',alignItems:'flex-start',gap:12}}>
          <div className="wa-icon gold">📋</div>
          <div style={{flex:1}}><h2>Work Queue</h2>
            <div className="csub">Everything open right now — open a record to act on it.</div></div>
          <Btn k="sm" onClick={()=>{setTab('All');setQuick('all');}}>View All</Btn>
        </div>
        {rows.length===0 ? <div style={{padding:'8px 17px 17px'}}>
            <Empty ic="✓">Nothing matches these filters.</Empty></div>
        : <div className="t-wrap"><table className="data">
            <thead><tr><th>Area</th><th>Item</th><th>Accountable</th><th>Status</th>
              <th>Due</th><th>Action</th></tr></thead>
            <tbody>{rows.map((w,i)=>{
              const st = statusOf(w);
              const openRow = ()=> w.screen==='mtg' ? openMeeting(w.rid,w.tab||'detail') : go(w.screen,w.rid);
              return <tr key={w.bucket+w.area+w.rid+i} className="click" onClick={openRow}>
                <td><Tag c={AREA_C[w.area]}>{w.area}</Tag></td>
                <td><div className="t-main">{w.title}</div><div className="t-sub">{w.sub}</div></td>
                <td className="dim">{w.owner?P(w.owner).name:'—'}
                  {w.owner && <div className="t-sub">{P(w.owner).position}</div>}</td>
                <td><Tag c={statusColour(st)}>{st}</Tag></td>
                <td className="dim">{w.date && w.date<TODAY
                    ? <span style={{color:'var(--red)',fontWeight:650}}>Overdue</span>
                    : (w.date?fmtDS(w.date):'—')}</td>
                <td style={{textAlign:'right'}}>
                  <Btn k={i===0?'pri sm':'sm'} style={{borderRadius:20}}>{actionVerb(w)}</Btn></td>
              </tr>;})}
            </tbody></table></div>}
      </div>

      <div className="wa-side">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon green">🗓</div>
            <h2 style={{flex:1}}>Upcoming</h2>
            <Btn k="sm" onClick={()=>go('cal')}>Full Calendar</Btn>
          </div>
          <div className="csub" style={{marginBottom:2}}>Next Meetings, Committees and Report due dates.</div>
          {upcoming.length===0 ? <Empty ic="🗓">Nothing scheduled yet.</Empty>
          : upcoming.map((i,n)=>{
              return <div key={i.kind+i.id+n} className="wa-up-r"
                  onClick={()=> i.screen==='mtg' ? openMeeting(i.id,i.tab||'detail') : go(i.screen,i.id)}>
                <div className="wa-date"><span className="dd">{i.date.slice(8)}</span>
                  <span className="mo">{MONTHS[+i.date.slice(5,7)-1]}</span></div>
                <div className="wa-up-t">
                  <div className="n">{i.restricted&&'🔒 '}{i.title}</div>
                  <div className="m">{i.sub}</div>
                </div>
                {i.time && <div className="wa-up-time">{i.time}</div>}
              </div>;})}
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon amber">📈</div>
            <h2 style={{flex:1}}>This Month</h2>
          </div>
          <div className="csub" style={{marginBottom:2}}>Governance activity across the module.</div>
          <div className="wa-mo-r"><label>Meetings Held</label>
            <span className="v">{meetingsHeld} / {meetingsTotal}</span></div>
          <div className="wa-mo-r"><label>MOM Approved</label>
            <span className="v">{momApproved} / {db.moms.length}</span></div>
          <div className="wa-mo-r"><label>Reports Submitted</label>
            <span className="v">{reportsSubmitted} / {db.reports.length}</span></div>
          <div className="wa-mo-r"><label>Decisions Closed</label>
            <span className="v">{decisionsClosed} / {decisionsTotal}</span></div>
          <div className="wa-mo-r">
            <label>Audit Grid {S.passThreshold?'Pass Rate':'Avg Score'}</label>
            <span className="v">{gridRate==null?'—':gridRate+'%'}</span></div>
        </div>
      </div>
    </div>

    <div className="card" style={{marginTop:16}}>
      <h2>Where things live</h2>
      <div className="csub">Six places, and nothing is hidden behind a seventh.</div>
      <div className="t-wrap"><table className="data">
        <thead><tr><th>I want to…</th><th>Go to</th></tr></thead>
        <tbody>
          {[['See what needs doing across everything','My Workspace','work'],
            ['Submit a Report, or review one','Reports & Plans','rpt'],
            ['Schedule a Meeting, edit its Agenda, or add attendees','Meetings & Committees','mtg'],
            ['Write or approve Meeting Minutes','Open the Meeting → Minutes tab','mtg'],
            ['Score or approve an Audit Grid','Open the Meeting → Audit Grid tab','mtg'],
            ['See Tasks and Decisions a Meeting produced','Open the Meeting → Follow-up tab','mtg'],
            ['Log a Decision, or see every Decision raised','Decisions','dec'],
            ['Compare Committee scores over time','Committee Scores','grid'],
            ['Change an unapproved value and see what it switches on','Governance Settings','set'],
          ].map(([q,where,sc])=>
            <tr key={q} className="click" onClick={()=>go(sc)}>
              <td>{q}</td><td className="t-main">{where} →</td></tr>)}
        </tbody></table></div>
    </div>
  </>;
}
/* =========================================================================
   3 · REPORTS & PLANS
   ========================================================================= */
const rptName = r => r.setup ? RS(r.setup).name : r.custom.name;
const rptCfg  = r => r.setup ? RS(r.setup) : r.custom;
const rptTagC = s => s==='Approved'?'green':s==='In Review'?'teal':'grey';

/* due date derived from the approved Setup's due day and the reporting period */
const rptDue = r => { const c=rptCfg(r); return c.dueDay
  ? r.period+'-'+String(c.dueDay).padStart(2,'0') : null; };

function RptTable({rows,showDue,emptyText}){
  const {go,me}=use();
  if(!rows.length) return <Empty ic="✓">{emptyText}</Empty>;
  return <div className="t-wrap"><table className="data">
    <thead><tr><th>Report</th><th>Period</th><th>Working copy</th>
      <th>{showDue?'Due':'Where it stands'}</th><th>Status</th></tr></thead>
    <tbody>{rows.map(r=>{
      const c=rptCfg(r), revs=c.reviewers, due=rptDue(r), late=due&&due<TODAY&&r.status==='Draft';
      return <tr key={r.id} className="click" onClick={()=>go('rpt',r.id)}>
        <td><div className="t-main">{rptName(r)}</div>
          <div className="t-sub">{r.dept}{r.creator!==me?' · '+P(r.creator).name:''}
            {!r.setup && <> · <span className="src">No approved Setup</span></>}</div></td>
        <td className="dim">{fmtP(r.period)}</td>
        <td>{r.file?<span className="mono" style={{fontSize:11.5}}>{r.file}</span>
                   :<Tag c="red">Not generated</Tag>}</td>
        <td className="dim">{showDue
          ? <>{due?fmtD(due):'—'}{late&&<div><Tag c="red">Overdue</Tag></div>}</>
          : r.status==='Approved' ? 'All '+revs.length+' review steps approved'
          : r.status==='In Review' ? <>Step {r.step+1} of {revs.length} · <b>{P(revs[r.step]).name}</b></>
          : 'Not submitted'}</td>
        <td><Tag c={rptTagC(r.status)}>{r.status}</Tag>{r.locked&&<> 🔒</>}</td>
      </tr>;})}
    </tbody></table></div>;
}

/* short, cosmetic reference code derived from real fields — not a fabricated business ID */
const rptCode = r => 'RPT-'+r.period.slice(0,4)+'-'+r.id.slice(-4).toUpperCase();
const rptSubmittedAt = r => { const h=r.history.find(x=>x.act==='Submitted for review'); return h?h.at.split(' ')[0]:null; };

function ScreenReports(){
  const {db,me,sel,setSel,go,S,cal} = use();
  const [creating,setCreating]=useState(false);
  const [tab,setTab]=useState('due');
  const id = sel.rpt;
  const list = db.reports.filter(r=>canSeeReport(r,me));
  const rec  = list.find(r=>r.id===id);
  if(rec) return <ReportDetail rec={rec} back={()=>setSel(v=>({...v,rpt:null}))}/>;
  if(creating) return <ReportWizard onClose={()=>setCreating(false)}/>;

  const due      = list.filter(r=>r.status==='Draft'     && r.period<=PERIOD);
  const upcoming = list.filter(r=>r.status==='Draft'     && r.period> PERIOD);
  const inReview = list.filter(r=>r.status==='In Review');
  const done     = list.filter(r=>r.status==='Approved');
  const overdue  = due.filter(r=>{const d=rptDue(r); return d && d<TODAY;});

  const TABS = [
    {id:'due',    label:'Due to Submit', rows:due},
    {id:'review', label:'In Review',     rows:inReview},
    {id:'approved',label:'Approved',     rows:done},
    {id:'all',    label:'All Reports',   rows:list},
  ];
  const rows = (TABS.find(t=>t.id===tab)||TABS[0]).rows;

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Reports & Plans</h1>
        <div className="sub">Create, track, and review every Report linked to an approved Setup.</div></div>
      <Btn k="pri" onClick={()=>setCreating(true)}>+ New Report</Btn>
    </div>

    <div className="tabs">
      {TABS.map(t=>
        <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
          {t.label}{t.id!=='all' && <span className="c">{t.rows.length}</span>}</button>)}
    </div>

    <div className="stats">
      <Stat label="Due to Submit" v={due.length} d="this period or earlier" c={due.length?'amber':'muted'}/>
      <Stat label="Overdue" v={overdue.length} d="past the due date" c={overdue.length?'red':'muted'}/>
      <Stat label="In Review" v={inReview.length} d="with a Reviewer" c={inReview.length?'teal':'muted'}/>
      <Stat label="Approved" v={done.length} d="locked" c="green"/>
    </div>

    <CalendarWebpart items={cal} kinds={['Report']} title="Report due dates"
      emptyText="No Report is due in this range."/>

    <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon gold">📄</div>
        <h2 style={{flex:1}}>My Reports</h2>
        <Btn k="sm" onClick={()=>setTab('all')}>▾ Filter</Btn>
      </div>
      {rows.length===0 ? <div style={{padding:'8px 17px 17px'}}>
          <Empty ic="✓">Nothing here right now.</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>Report</th><th>Period</th><th>Working Copy</th><th>Status</th>
            <th>Submitted</th><th>Reviewer</th></tr></thead>
          <tbody>{rows.map(r=>{
            const c=rptCfg(r), revs=c.reviewers, due2=rptDue(r);
            const late = due2 && due2<TODAY && r.status==='Draft';
            const statusLabel = late?'Overdue':r.status;
            const statusC = late?'red':rptTagC(r.status);
            const sub = rptSubmittedAt(r);
            return <tr key={r.id} className="click" onClick={()=>go('rpt',r.id)}>
              <td><div className="t-main">{rptName(r)}</div>
                <div className="t-sub">{c.cat||'Custom'} · {P(r.creator).name} · {rptCode(r)}</div>
                {!r.setup && <div style={{marginTop:3}}><Tag c="amber">No approved Setup</Tag></div>}</td>
              <td className="dim">{fmtP(r.period)}</td>
              <td>{r.file?<span className="mono" style={{fontSize:11.5}}>{r.file}</span>
                         :<span className="dim">Not generated</span>}</td>
              <td><Tag c={statusC}>{statusLabel}</Tag></td>
              <td className="dim">{sub?fmtDS(sub):'—'}</td>
              <td className="dim">
                {r.status==='Approved' ? 'All '+revs.length+' approved'
                : r.status==='In Review' ? <>Step {r.step+1} of {revs.length} · {P(revs[r.step]).name}</>
                : late ? <span style={{color:'var(--red)'}}>Escalated to {P(revs[0]).name}</span>
                : 'Not submitted'}</td>
            </tr>;})}
          </tbody></table></div>}
    </div>

  </>;
}

function ReportDetail({rec,back}){
  const {db,me,A,go,S} = use();
  const c   = rptCfg(rec);
  const revs= c.reviewers;
  const isCreator = acting(rec.creator);
  const isCurrentReviewer = rec.status==='In Review' && acting(revs[rec.step]);
  const [modal,setModal]=useState(null);
  const [note,setNote]=useState('');
  const linked = db.occs.filter(o=>o.inputs.includes(rec.id) && canSeeOcc(o,me));
  const comments = db.comments.filter(x=>x.rec===rec.id);
  const missing = !rec.file;
  const submittedAt = rptSubmittedAt(rec);

  /* the date a given review step (0-indexed) started — submission for step 0,
     otherwise the previous step's approval */
  const stepStartedAt = i => i===0 ? submittedAt
    : (rec.history.find(h=>h.act.startsWith('Approved review step '+i))||{}).at;
  const stepDeadline = i => { const start=stepStartedAt(i);
    return (start && S.reviewTimeoutDays!=null) ? addDays(start.split(' ')[0],S.reviewTimeoutDays) : null; };

  return <>
    <div className="crumb"><a onClick={back}>Reports & Plans</a> › <b>Review Report</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{rptName(rec)} — {fmtP(rec.period)}</h1>
        <div className="sub" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Tag c={rptTagC(rec.status)}>{rec.status}</Tag>
          <span className="mono" style={{fontSize:11.5}}>{rptCode(rec)}</span>
          {submittedAt && <>· Submitted by {P(rec.creator).name} on {fmtDS(submittedAt.split(' ')[0])}</>}
          {rec.locked && <Tag c="grey">🔒 Locked</Tag>}
        </div></div>
      <Btn onClick={back}>Back to List</Btn>
    </div>

    {isCurrentReviewer && <Note k="info">
      You are Reviewer {rec.step+1} of {revs.length}.
      {rec.step>0 && stepStartedAt(rec.step) && <> Reviewer {rec.step} ({P(revs[rec.step-1]).name})
        approved on {fmtDS(stepStartedAt(rec.step).split(' ')[0])}.</>}
      {stepDeadline(rec.step) && <> You have until {fmtDS(stepDeadline(rec.step))}.</>}
    </Note>}

    {rec.locked && <Note k="lock"><b>This Report Submission is Approved and locked.</b> The file URL,
      version and complete approval history are retained. A correction is made through a new version.</Note>}

    <div className="grid2" style={{gridTemplateColumns:'1fr 340px',alignItems:'start'}}>
      <div>
        <div className="card">
          <h2>Report Information</h2>
          <KVBlock items={[
            ['Period', fmtP(rec.period)],
            ['Setup', c.name||'Custom Report'],
            ['Department', rec.dept],
            ['Creator', P(rec.creator).name],
          ]}/>
        </div>

        <div className="card">
          <h2>Attachments</h2>
          {rec.files && rec.files.length>0
            ? rec.files.map((file,i)=><div className="att-row" key={i}>
                <div className="att-ic">📄</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="t-main" style={{fontSize:12.5}}>{file.name}</div>
                  {i===0 && rec.url && <div className="t-sub mono" style={{fontSize:10.5}}>{rec.url}</div>}
                </div>
                {file.size!=null && <span className="dim" style={{fontSize:11}}>{fmtFileSize(file.size)}</span>}
                <Btn k="sm">Download</Btn>
              </div>)
          : rec.file
            ? <div className="att-row">
                <div className="att-ic">📄</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="t-main" style={{fontSize:12.5}}>{rec.file}</div>
                  {rec.url && <div className="t-sub mono" style={{fontSize:10.5}}>{rec.url}</div>}
                </div>
                <Btn k="sm">Download</Btn>
              </div>
            : <Empty ic="📄">No file attached yet — submission is blocked until one is.</Empty>}

          {isCreator && rec.status==='Draft' &&
            <div className="btn-row" style={{marginTop:4}}>
              <Btn onClick={()=>A.uploadReport(rec.id,
                rptName(rec).replace(/[^A-Za-z0-9]+/g,'_')+'_'+rec.period+(c.template?
                  c.template.slice(c.template.lastIndexOf('.')) : '.xlsx'))}>
                {c.template?'Generate the working copy from the Template':'Upload a file'}</Btn>
              <Btn k="pri" disabled={missing} onClick={()=>A.submitReport(rec.id)}>Submit for review</Btn>
              {missing && <span style={{fontSize:11.5,color:'var(--red)'}}>
                A required attachment is missing, so submission is blocked.</span>}
            </div>}
        </div>

        <FollowUp src={{k:'rpt',id:rec.id}}
          intro="Tasks and Decisions raised from this Report. Each is recorded separately from the review step."
          onTask={()=>setModal('task')} onDec={()=>setModal('dec')}/>

        <div className="card">
          <h2>Linked Meeting Occurrences</h2>
          <div className="csub">A Report Submission may be an input to more than one Meeting.</div>
          {linked.length===0 ? <Empty>Not linked to any Meeting.</Empty> :
          <table className="data"><tbody>{linked.map(o=>
            <tr key={o.id} className="click" onClick={()=>go('mtg',o.id)}>
              <td><div className="t-main">{occName(o)}</div><div className="t-sub">{fmtD(o.date)}</div></td>
              <td style={{textAlign:'right'}}><Tag c={o.status==='Held'?'green':'teal'}>{o.status}</Tag></td>
            </tr>)}</tbody></table>}
        </div>

        {comments.length>0 && <div className="card">
          <h2>Comments</h2>
          {comments.map(c2=><div key={c2.id} style={{marginBottom:10}}>
            <div style={{fontSize:12.5}}>{c2.text}</div>
            <div style={{fontSize:11.5,color:'var(--muted)'}}>{P(c2.who).name} · {fmtDT(c2.at)}</div>
          </div>)}
        </div>}
      </div>

      <div>
        {isCurrentReviewer && <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon gold">📝</div><h2 style={{flex:1}}>Your Review</h2>
          </div>
          <Field label="Review Comment">
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Add comments (optional for approval, required for return)…"/></Field>
          <div className="btn-row" style={{flexDirection:'column',alignItems:'stretch',gap:8,marginTop:4}}>
            <Btn k="grn" onClick={()=>{A.reviewApprove(rec.id,note);setNote('');}}>✓ Approve</Btn>
            <Btn k="wrn" disabled={!note.trim()}
              onClick={()=>{A.reviewRMI(rec.id,note);setNote('');}}>Request Additional Info</Btn>
            <div style={{display:'flex',gap:8}}>
              <Btn k="sm" style={{flex:1}} onClick={()=>setModal('task')}>☑ Create Task</Btn>
              <Btn k="sm" style={{flex:1}} onClick={()=>setModal('dec')}>⚖ Create Decision</Btn>
            </div>
          </div>
        </div>}

        <div className="card">
          <h2>Review Progress</h2>
          {revs.map((r,i)=>{
            const st = rec.status==='Approved'||i<rec.step ? 'Approved'
                     : rec.status==='In Review'&&i===rec.step ? 'Current' : 'Pending';
            const at = st==='Approved' ? stepStartedAt(i+1) || stepStartedAt(i) : null;
            return <div className="rev-row" key={i}>
              <div className={'rev-num '+(st==='Approved'?'done':st==='Current'?'now':'pending')}>
                {st==='Approved'?'✓':i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="t-main" style={{fontSize:12.5}}>{P(r).name}</div>
                <div className="t-sub">{P(r).position}
                  {st==='Approved' && stepStartedAt(i+1) && ' · '+fmtDS(stepStartedAt(i+1).split(' ')[0])}
                  {st==='Current' && stepDeadline(i) && ' · Due '+fmtDS(stepDeadline(i))}</div>
              </div>
              <Tag c={st==='Approved'?'green':st==='Current'?'amber':'grey'}>{st}</Tag>
            </div>;})}
        </div>

        <div className="card">
          <h2>Report Details</h2>
          <div className="wa-mo-r"><label>ID</label><span className="v mono">{rptCode(rec)}</span></div>
          <div className="wa-mo-r"><label>Template</label>
            <span className="v" style={{fontFamily:'inherit'}}>{c.template||'—'}</span></div>
          <div className="wa-mo-r"><label>Submitted</label>
            <span className="v" style={{fontFamily:'inherit'}}>
              {submittedAt?fmtD(submittedAt.split(' ')[0]):'—'}</span></div>
          <div className="wa-mo-r"><label>Version</label><span className="v">v{(rec.ver||0).toFixed(1)}</span></div>
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <h2 style={{flex:1,marginBottom:0}}>Version History</h2>
            <span className="csub" style={{marginBottom:0}}>{rec.history.length} entries</span>
          </div>
          <div style={{marginTop:8}}>
            <Hist items={rec.history}/>
          </div>
        </div>
      </div>
    </div>

    {modal==='task' && <TaskModal onClose={()=>setModal(null)} recordedSeparately
      onSave={f=>{A.addTask(f,{k:'rpt',id:rec.id}); setModal(null);}}/>}
    {modal==='dec' && <DecisionIntakeModal src={{k:'rpt',id:rec.id}}
      onClose={()=>setModal(null)}/>}
  </>;
}

/* Tasks and Decisions produced by any record — a Report, a Meeting, or an Agenda Item. */
function FollowUp({src,intro,onTask,onDec,agenda}){
  const {db,go,openMeeting} = use();
  const tasks = db.tasks.filter(t=>t.src.k===src.k && t.src.id===src.id);
  const decs  = db.decisions.filter(d=>d.src && d.src.k===src.k && d.src.id===src.id);
  return <div className="card">
    <h2>Follow-up — Tasks and Decisions</h2>
    <div className="csub">{intro}</div>
    {tasks.length===0 && decs.length===0
      ? <Empty>Nothing has been raised from this record yet.</Empty>
      : <table className="data">
          <thead><tr><th>Type</th><th>Item</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            {decs.map(d=><tr key={d.id} className="click" onClick={()=>go('dec',d.id)}>
              <td><Tag c="amber">Decision</Tag></td>
              <td><div className="t-main">{d.title}</div>
                <div className="t-sub">{d.path==='Direct'?'Direct Decision':'Decision Request'}
                  {agenda && d.src.ag ? ' · from item '+(agenda.find(a=>a.id===d.src.ag)||{}).seq : ''}</div></td>
              <td className="dim">{d.execOwner?P(d.execOwner).name:P(d.creator).name}</td>
              <td>{d.draft?<Tag c="amber">Draft</Tag>
                  :<Tag c={d.status==='Closed'?'green':d.status==='Approved'?'green':
                            d.blocked?'red':'teal'}>{d.blocked?'Blocked':d.status}</Tag>}</td></tr>)}
            {tasks.map(t=><tr key={t.id}>
              <td><Tag c="grey">Task</Tag></td>
              <td><div className="t-main">{t.title}</div>
                <div className="t-sub">Due {fmtD(t.due)}
                  {agenda && t.src.ag ? ' · from item '+(agenda.find(a=>a.id===t.src.ag)||{}).seq : ''}</div></td>
              <td className="dim">{P(t.owner).name}</td>
              <td>{t.draft?<Tag c="amber">Draft</Tag>
                  :t.syncFailed?<Tag c="red">Queued for TMS</Tag>
                  :<Tag c={t.status==='Closed'?'green':'teal'}>{t.status}</Tag>}</td></tr>)}
          </tbody></table>}
    {(onTask||onDec) && <div className="btn-row" style={{marginTop:12}}>
      {onTask && <Btn k="sm" onClick={onTask}>+ Task</Btn>}
      {onDec  && <Btn k="sm" onClick={onDec}>+ Decision</Btn>}</div>}
  </div>;
}

/* =========================================================================
   CREATE REPORT — multi-step wizard (Template → Details → Attachments → Submit)
   ========================================================================= */
const shiftPeriod = (p,n) => { const [y,m]=p.split('-').map(Number);
  const d=new Date(y,m-1+n,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const WIZ_STEPS = [
  {id:'template', n:1, label:'Template',    hint:'Select template'},
  {id:'details',  n:2, label:'Details',     hint:'Fill fields'},
  {id:'files',    n:3, label:'Attachments', hint:'Upload files'},
  {id:'submit',   n:4, label:'Submit',      hint:'Review & submit'},
];
const WIZ_DEPTS = ['Hospital-Wide','Quality','Nursing','Pharmacy','Facilities','Emergency','Executive'];
const TPL_STYLE = {
  rs1:{ic:'📊', bg:'var(--teal-l)',  fg:'var(--teal-d)'},
  rs2:{ic:'👥', bg:'var(--blue-bg)', fg:'var(--blue)'},
  rs3:{ic:'📈', bg:'var(--green-bg)',fg:'var(--green)'},
  rs4:{ic:'🛠', bg:'var(--amber-bg)',fg:'var(--amber)'},
};
const fmtFileSize = b => b<1024?b+' B' : b<1048576?(b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';

function WizSteps({step,onJump}){
  const idx = WIZ_STEPS.findIndex(s=>s.id===step);
  return <div className="wiz-steps">
    {WIZ_STEPS.map((s,i)=><React.Fragment key={s.id}>
      {i>0 && <div className="wiz-line"/>}
      <div className="wiz-step" style={{cursor:'pointer'}} onClick={()=>onJump(s.id)}>
        <div className={'wiz-num '+(i<idx?'done':i===idx?'now':'')}>{i<idx?'✓':s.n}</div>
        <div className="t"><b>{s.label}</b><span>{s.hint}</span></div>
      </div>
    </React.Fragment>)}
  </div>;
}

function ReportWizard({onClose}){
  const {A,S} = use();
  const [step,setStep]=useState('template');
  const [setupId,setSetupId]=useState(null);
  const [f,setF]=useState({title:'',period:PERIOD,dept:'Hospital-Wide',bu:'ALL',
    summary:'',actions:'',reviewers:['u5'],site:'Quality',folder:'2026 / Ad Hoc',files:[]});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const fileInputRef = useRef(null);
  const [dragOver,setDragOver]=useState(false);

  const isCustom = setupId==='custom';
  const setup = (setupId && !isCustom) ? RPT_SETUPS.find(s=>s.id===setupId) : null;
  const chain = isCustom ? f.reviewers : (setup?setup.reviewers:[]);
  const setupLabel = isCustom ? 'Custom — no approved Setup' : setup ? setup.name : 'No template selected yet';

  const chooseTpl = id => { setSetupId(id);
    const s = id!=='custom' ? RPT_SETUPS.find(x=>x.id===id) : null;
    setF(x=>({...x, title: s ? s.name+' — '+fmtP(x.period) : x.title})); };

  const required = [!!f.dept.trim(), !!f.period, !!f.summary.trim(),
    isCustom?!!f.title.trim():true, isCustom?f.reviewers.length>0:true];
  const filledCount = required.filter(Boolean).length, totalCount = required.length;
  const detailsOk = filledCount===totalCount;
  const filesOk = f.files.length>0;

  const next = () => {
    if(step==='template') setStep('details');
    else if(step==='details') setStep('files');
    else if(step==='files') setStep('submit');
  };
  const nextDisabled = false; // TEMP: validation bypassed for UI review
  const cancel = () => {
    if(step!=='template' && !window.confirm('Discard this new Report? Nothing entered will be saved.')) return;
    onClose();
  };
  const saveDraft = () => { if(!setupId) return; A.createReportFromWizard({...f,setupId,submit:false}); onClose(); };
  const submit    = () => { if(!setupId) return; A.createReportFromWizard({...f,setupId,submit:true});  onClose(); };

  const addFiles = fileList => setF(x=>({...x,
    files:[...x.files, ...Array.from(fileList).map(file=>({name:file.name,size:file.size}))]}));
  const removeFile = i => setF(x=>({...x, files:x.files.filter((_,j)=>j!==i)}));

  return <>
    <div className="crumb"><a onClick={cancel}>Reports</a> › <b>New Report</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Create Report</h1>
        <div className="sub">Select a template, fill in the details, and submit for review.</div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn onClick={cancel}>Cancel</Btn>
        {step!=='submit' && <Btn disabled={!setupId} onClick={saveDraft}>Save Draft</Btn>}
        {step!=='submit' && <Btn k="pri" disabled={nextDisabled} onClick={next}>Next Step</Btn>}
      </div>
    </div>

    <WizSteps step={step} onJump={setStep}/>

    {step==='template' && <div>
      <h2 style={{marginBottom:2}}>Choose a Report Template</h2>
      <div className="csub">Templates are published through Governance Setup. Only active, approved
        templates appear here.</div>
      <Note k="info">Showing {RPT_SETUPS.length} templates from Setup Register. Templates inherit
        fields, review chain, and cadence from their Setup definition.</Note>
      <div className="wiz-tpl">
        {RPT_SETUPS.map(s=>{ const st=TPL_STYLE[s.id]||{ic:'📄',bg:'var(--grey-bg)',fg:'var(--muted)'};
          return <div key={s.id} className={'wiz-tpl-c'+(setupId===s.id?' on':'')} onClick={()=>chooseTpl(s.id)}>
            <div className="wiz-tpl-ic" style={{background:st.bg,color:st.fg}}>{st.ic}</div>
            <h3>{s.name}</h3>
            <p>{s.objective}</p>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              <Tag c="grey">{s.cat}</Tag><Tag c="grey">{s.freq}</Tag>
            </div>
          </div>;})}
        <div className={'wiz-tpl-c dashed'+(isCustom?' on':'')} onClick={()=>chooseTpl('custom')}>
          <div className="wiz-tpl-ic" style={{background:'var(--ink)',color:'#fff'}}>🖥</div>
          <h3>Custom Report</h3>
          <p>Build a custom report from scratch with flexible fields and layout.</p>
          <Tag c="amber">Custom</Tag>
        </div>
      </div>
    </div>}

    {step==='details' && <div className="grid2" style={{gridTemplateColumns:'1fr 300px',alignItems:'start'}}>
      <div>
        <Note k="info">Template: <b>{setupLabel}</b> — fill all required (*) fields.</Note>
        <div className="card">
          <h2>Report Information</h2>
          <div className="f-row">
            <Field label="Report Title" req>
              <input type="text" value={f.title} disabled={!isCustom}
                onChange={e=>set('title',e.target.value)} placeholder="e.g. Laser Utilisation Review"/></Field>
            <Field label="Reporting Period" req>
              <select value={f.period} onChange={e=>set('period',e.target.value)}>
                {[-2,-1,0,1,2,3].map(n=>{const p=shiftPeriod(PERIOD,n);
                  return <option key={p} value={p}>{fmtP(p)}</option>;})}
              </select></Field>
          </div>
          <div className="f-row">
            <Field label="Setup / Committee" req hint={!isCustom?'Auto-filled from template':null}>
              <input type="text" value={setupLabel} disabled/></Field>
            <Field label="Department" req>
              <select value={f.dept} onChange={e=>set('dept',e.target.value)}>
                {WIZ_DEPTS.map(d=><option key={d}>{d}</option>)}</select></Field>
          </div>
        </div>

        <div className="card">
          <h2>Summary & Actions</h2>
          <Field label="Executive Summary" req>
            <textarea value={f.summary} onChange={e=>set('summary',e.target.value)}
              placeholder="Overall summary for this reporting period."/></Field>
          <Field label="Improvement Actions" hint="One per line — optional">
            <textarea value={f.actions} onChange={e=>set('actions',e.target.value)}
              placeholder={'1. ...\n2. ...'}/></Field>
          {isCustom && <Field label="Sequential Reviewers" req hint="Reviewed in the order selected.">
            <Pills multi val={f.reviewers} onChange={v=>set('reviewers',v)}
              opts={['u5','u2','u7','u10'].map(id=>({v:id,label:P(id).name}))}/></Field>}
        </div>
      </div>

      <div>
        <div className="card">
          <h2>Report Details</h2>
          <div className="wa-mo-r"><label>Template</label>
            <span className="v" style={{fontFamily:'inherit'}}>{isCustom?'Custom':setupLabel}</span></div>
          <div className="wa-mo-r"><label>Setup</label>
            <span className="v" style={{fontFamily:'inherit'}}>{isCustom?'—':setupLabel}</span></div>
          <div className="wa-mo-r"><label>Created</label>
            <span className="v" style={{fontFamily:'inherit'}}>{fmtD(TODAY)}</span></div>
          <div className="wa-mo-r"><label>Status</label><Tag c="grey">Draft</Tag></div>
        </div>

        <div className="card">
          <h2>Review Chain</h2>
          <div className="csub">Sequential review — each must approve before next.</div>
          {chain.length===0 ? <Empty>Choose at least one Reviewer.</Empty> : chain.map((rv,i)=>
            <div className="rev-row" key={i}>
              <div className={'rev-num '+(i===0?'now':'pending')}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="t-main" style={{fontSize:12.5}}>{P(rv).name}</div>
                <div className="t-sub">{P(rv).position}</div>
              </div>
            </div>)}
          {S.reviewTimeoutDays!=null && <div className="csub" style={{marginTop:8,marginBottom:0}}>
            {S.reviewTimeoutDays}-day timeout per reviewer. Auto-escalates.</div>}
        </div>

        <div className="card">
          <h2>Completion</h2>
          <Bar v={Math.round(filledCount/totalCount*100)} c={detailsOk?'green':'teal'}/>
          <div className="csub" style={{marginTop:6,marginBottom:0}}>
            {filledCount} of {totalCount} required fields filled</div>
        </div>
      </div>
    </div>}

    {step==='files' && <div className="card" style={{maxWidth:560}}>
      <h2>Attachments</h2>
      <div className="csub">Upload supporting documents, data files, or evidence.</div>
      <div className={'dropzone'+(dragOver?' over':'')}
        onClick={()=>fileInputRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files);}}>
        <div className="up-ic">⇧</div>
        <div style={{fontWeight:650,fontSize:12.5}}>Drop files here or click to browse</div>
        <div className="csub" style={{marginBottom:0,marginTop:2}}>PDF, Word, Excel, images up to 25MB each</div>
      </div>
      <input ref={fileInputRef} type="file" multiple style={{display:'none'}}
        onChange={e=>{addFiles(e.target.files); e.target.value='';}}/>
      {f.files.length>0 && <div style={{marginTop:12}}>
        {f.files.map((file,i)=><div className="att-row" key={i}>
          <div className="att-ic">📄</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="t-main" style={{fontSize:12.5}}>{file.name}</div>
            <div className="t-sub">Uploaded just now</div>
          </div>
          <span className="dim" style={{fontSize:11}}>{fmtFileSize(file.size)}</span>
          <button type="button" onClick={()=>removeFile(i)} style={{border:'none',background:'transparent',
            color:'var(--muted)',fontSize:15,cursor:'pointer',padding:'0 4px'}}>✕</button>
        </div>)}
      </div>}
    </div>}

    {step==='submit' && <div style={{maxWidth:530}}>
      <h2 style={{marginBottom:2}}>Review & Submit</h2>
      <div className="csub">Review before submitting. Once submitted, it enters the sequential review chain.</div>
      <Note k="warn">Once submitted, you cannot edit.
        {S.reviewTimeoutDays!=null && ` Each reviewer has a ${S.reviewTimeoutDays}-day window.`}</Note>

      <div className="card">
        <h2>Report Summary</h2>
        <div className="rs-grid">
          <div className="rs-cell"><label>Title</label><div>{f.title||'—'}</div></div>
          <div className="rs-cell"><label>Period</label><div>{fmtP(f.period)}</div></div>
          <div className="rs-cell full"><label>Executive Summary</label><div style={{fontWeight:500}}>{f.summary||'—'}</div></div>
          <div className="rs-cell full"><label>Attachments</label>
            <div>{f.files.length} file{f.files.length===1?'':'s'}</div></div>
        </div>
      </div>

      <div className="card">
        <h2>Review Chain</h2>
        {chain.map((rv,i)=>
          <div className="rev-row" key={i}>
            <div className={'rev-num '+(i===0?'now':'pending')}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="t-main" style={{fontSize:12.5}}>{P(rv).name}</div>
              <div className="t-sub">{P(rv).position}
                {S.reviewTimeoutDays!=null && ' · '+S.reviewTimeoutDays+'-day window'}</div>
            </div>
            <Tag c={i===0?'amber':'grey'}>{i===0?'First':'Waiting'}</Tag>
          </div>)}
      </div>

      <div className="btn-row" style={{marginTop:2}}>
        <Btn style={{flex:1}} onClick={()=>setStep('files')}>Back to Edit</Btn>
        <Btn k="grn" style={{flex:1}} onClick={submit}>➤ Submit for Review</Btn>
      </div>
    </div>}
  </>;
}

function CustomReportModal({onClose}){
  const {A} = use();
  const [f,setF]=useState({name:'',objective:'',dept:'',site:'Quality',folder:'2026 / Ad Hoc',
                           file:'',reviewers:['u5'],bu:'AHJ',kpis:[]});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const ok = f.name.trim() && f.objective.trim() && f.dept.trim() && f.file.trim() && f.reviewers.length;
  return <Modal title="Create a Custom Report" wide
    sub="Use this only where no approved Setup exists. The submission proceeds immediately; the metadata is sent to Taxonomy with a No-Setup flag."
    onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!ok} onClick={()=>{A.createCustomReport(f);onClose();}}>
        Create and submit for review</Btn></>}>
    <Note k="warn">Taxonomy decides whether to create a permanent Setup. Until then this Report carries a
      No-Setup flag, and later occurrences should use the approved Setup once it exists.</Note>
    <Field label="Report name" req><input type="text" value={f.name}
      onChange={e=>set('name',e.target.value)} placeholder="e.g. Ophthalmology Laser Utilisation Review"/></Field>
    <Field label="Report objective" req><textarea value={f.objective}
      onChange={e=>set('objective',e.target.value)} placeholder="What this Report is for."/></Field>
    <div className="f-row">
      <Field label="Department" req><input type="text" value={f.dept}
        onChange={e=>set('dept',e.target.value)}/></Field>
      <Field label="Business unit"><select value={f.bu} onChange={e=>set('bu',e.target.value)}>
        {BUS.map(b=><option key={b.id} value={b.id}>{b.id} — {b.name}</option>)}</select></Field>
    </div>
    <div className="f-row">
      <Field label="Site" hint="Controlled list from Taxonomy"><select value={f.site}
        onChange={e=>set('site',e.target.value)}>
        {['Quality','Nursing','Executive','Ophthalmology','Pharmacy','Facilities'].map(s=><option key={s}>{s}</option>)}
      </select></Field>
      <Field label="Folder" hint="Controlled list from Taxonomy"><select value={f.folder}
        onChange={e=>set('folder',e.target.value)}>
        {['2026 / Ad Hoc','2026 / Monthly Reports','2026 / Plans'].map(s=><option key={s}>{s}</option>)}
      </select></Field>
    </div>
    <Field label="Upload file" req hint="Stored in the Taxonomy-managed location; Dataverse keeps the URL.">
      <input type="text" value={f.file} onChange={e=>set('file',e.target.value)}
        placeholder="e.g. Laser_Utilisation_Review_Q3.xlsx"/></Field>
    <Field label="Sequential Reviewers" req hint="Reviewed in the order selected.">
      <Pills multi val={f.reviewers} onChange={v=>set('reviewers',v)}
        opts={['u5','u2','u7','u10'].map(id=>({v:id,label:P(id).name}))}/></Field>
  </Modal>;
}

function TaskModal({onClose,onSave,recordedSeparately}){
  const [f,setF]=useState({title:'',owner:'u1',due:addDays(TODAY,14)});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  return <Modal title="Create a TMS Task" onClose={onClose}
    sub={recordedSeparately?'Recorded separately from the approval of the review step.':
        'The Task stays Draft until the Meeting Chair approves the Minutes.'}
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!f.title.trim()} onClick={()=>onSave(f)}>Create Task</Btn></>}>
    <Field label="Task" req><input type="text" value={f.title}
      onChange={e=>set('title',e.target.value)} placeholder="What must be done."/></Field>
    <div className="f-row">
      <Field label="Execution Owner" req><select value={f.owner} onChange={e=>set('owner',e.target.value)}>
        {PEOPLE.map(p=><option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
      <Field label="Due date" req><input type="date" value={f.due}
        onChange={e=>set('due',e.target.value)}/></Field>
    </div>
    <Note k="info">TMS owns Task assignment, execution and closure. Leadership Practice creates the Task
      with a back-link and reads its status.</Note>
  </Modal>;
}
/* =========================================================================
   4 · MEETINGS & COMMITTEES
   ========================================================================= */
const Avatars = ({ids,max=3}) => {
  const shown = ids.slice(0,max), extra = ids.length-shown.length;
  const palette=['teal','blue','green','purple','amber'];
  return <div style={{display:'flex',alignItems:'center'}}>
    {shown.map((id,i)=>{ const nm=P(id).name;
      const initials=nm.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
      return <div key={id} title={nm} className={'avatar '+palette[i%palette.length]}
        style={{marginLeft:i?-8:0,zIndex:max-i}}>{initials}</div>;})}
    {extra>0 && <div className="avatar grey" style={{marginLeft:-8}}>+{extra}</div>}
  </div>;
};

const occStatusTag = (o,mom,grid) => {
  if(o.status==='Cancelled') return {t:'Cancelled',c:'grey'};
  if(o.status==='Scheduled') return {t:'Scheduled',c:'blue'};
  if(mom && mom.status!=='Closed') return {t:'MOM Pending',c:'amber'};
  if(isCommittee(o) && grid && grid.state!=='Approved') return {t:'Audit Pending',c:'purple'};
  return {t:'Closed',c:'green'};
};

function ScreenMeetings(){
  const {db,me,sel,setSel,go,cal,S} = use();
  const [mk,setMk]=useState(null);
  const [tab,setTab]=useState('due');
  const [typeFilter,setTypeFilter]=useState('all');
  const id=sel.mtg;
  const list=db.occs.filter(o=>canSeeOcc(o,me));
  const rec=list.find(o=>o.id===id);
  if(rec) return <MeetingDetail rec={rec} back={()=>setSel(v=>({...v,mtg:null,mtgTab:null}))}/>;

  const upcoming=list.filter(o=>o.status==='Scheduled').sort((a,b)=>a.date.localeCompare(b.date));
  const held=list.filter(o=>o.status==='Held').sort((a,b)=>b.date.localeCompare(a.date));
  const openAfter = held.filter(o=>{
    const m=db.moms.find(x=>x.occ===o.id), g=db.grids.find(x=>x.occ===o.id);
    return !m || m.status!=='Closed' || (g && g.state!=='Approved');
  });
  const settled = held.filter(o=>!openAfter.includes(o));
  const cancelled=list.filter(o=>o.status==='Cancelled');

  const TABS=[
    {id:'due',    label:'Not yet held',        rows:upcoming},
    {id:'open',   label:'Held, record open',   rows:openAfter},
    {id:'closed', label:'Held and closed',     rows:settled},
    {id:'all',    label:'All Meetings',        rows:[...upcoming,...held,...cancelled]},
  ];
  const wk = rangeBounds('week');
  const applyType = rows => typeFilter==='accred'
      ? rows.filter(o=>o.setup && (MS(o.setup).cls||'').includes('Accreditation'))
    : typeFilter==='business' ? rows.filter(o=>occType(o)==='Business Meeting')
    : typeFilter==='week' ? rows.filter(o=>o.date>=wk[0] && o.date<=wk[1])
    : rows;
  const rows = applyType((TABS.find(t=>t.id===tab)||TABS[0]).rows)
    .sort((a,b)=> tab==='due' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

  const committeesHeld = held.filter(o=>o.setup && isCommittee(o) && MS(o.setup).quorumPct!=null);
  const quorumMissed = committeesHeld.filter(o=>{
    const setup=MS(o.setup); const a=attendance(o,setup,S.delegatedAttend);
    return a.pct < setup.quorumPct; });

  const actionFor = o => {
    if(o.status==='Cancelled') return 'View';
    if(o.status==='Scheduled'){
      const rd=inputReadiness(db,o,S);
      return (o.agenda.length===0 || rd.some(r=>!r.ready)) ? 'Prepare' : 'View';
    }
    const mom=db.moms.find(x=>x.occ===o.id), grid=db.grids.find(x=>x.occ===o.id);
    if(mom && mom.status!=='Closed') return 'Write MOM';
    if(isCommittee(o) && grid && grid.state!=='Approved') return 'Review';
    return 'View';
  };

  /* -------- This Week -------- */
  const thisWeek = upcoming.filter(o=>o.date>=wk[0] && o.date<=wk[1]).slice(0,4);

  /* -------- Meeting Health -------- */
  const heldThisPeriod = held.filter(o=>o.date.slice(0,7)===PERIOD.slice(0,7));
  const scheduledThisPeriod = list.filter(o=>o.status!=='Cancelled' && o.date.slice(0,7)===PERIOD.slice(0,7)).length;
  const avgQuorum = committeesHeld.length
    ? Math.round(committeesHeld.reduce((sum,o)=>{const s=MS(o.setup);
        return sum+attendance(o,s,S.delegatedAttend).pct;},0)/committeesHeld.length) : null;
  const pendingMomCt = openAfter.filter(o=>{const m=db.moms.find(x=>x.occ===o.id); return !m||m.status!=='Closed';}).length;
  const rescheduledCt = list.filter(o=>o.rescheduledFrom).length;
  const cancelledCt = cancelled.length;

  /* -------- Attention -------- */
  const overdueMom = held.filter(o=>{
    const m=db.moms.find(x=>x.occ===o.id);
    if(!m || m.status!=='Draft' || m.submittedAt || S.momWriteupHours==null) return false;
    return addHours(o.date+' '+o.end, S.momWriteupHours) < nowStamp();
  });
  const inputAlerts = upcoming.map(o=>({o, n:inputReadiness(db,o,S).filter(r=>r.kind==='Report Submission'&&!r.ready).length}))
    .filter(x=>x.n>0);

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Meetings</h1>
        <div className="sub">Schedule, manage, and track meetings from your setups.</div></div>
      <div style={{display:'flex',gap:8}}>
        <Btn onClick={()=>setMk('adhoc')}>🗓 Ad Hoc from Setup</Btn>
        <Btn k="pri" onClick={()=>setMk('custom')}>+ New Meeting</Btn>
      </div>
    </div>

    <div className="tabs">
      {TABS.map(t=>
        <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
          {t.label}{t.id!=='all' && <span className="c">{t.rows.length}</span>}</button>)}
    </div>

    <div className="stats">
      <Stat label="Not Yet Held" v={upcoming.length} d="scheduled this period" c={upcoming.length?'teal':'muted'}/>
      <Stat label="Held, Record Open" v={openAfter.length} d="MOM or audit pending"
        c={openAfter.length?'amber':'muted'}/>
      <Stat label="Held and Closed" v={settled.length} d="fully documented" c="green"/>
      <Stat label="Quorum Missed" v={quorumMissed.length}
        d={quorumMissed.length?occName(quorumMissed[0])+' — '+fmtDS(quorumMissed[0].date):'none'}
        c={quorumMissed.length?'red':'muted'}/>
    </div>

    <div className="chip-row" style={{alignItems:'center'}}>
      {[['all','All Types'],['accred','Accreditation'],['business','Business'],['week','This Week']].map(([k,l])=>
        <button key={k} className={'pill'+(typeFilter===k?' on':'')} onClick={()=>setTypeFilter(k)}>{l}</button>)}
      <div style={{flex:1}}/>
      <Btn k="sm" onClick={()=>{setTab('due');setTypeFilter('all');}}>▾ More Filters</Btn>
    </div>

    <div className="wa-grid">
      <div className="card flush">
        <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="wa-icon gold">👥</div>
          <h2 style={{flex:1}}>{tab==='due'?'Upcoming Meetings':TABS.find(t=>t.id===tab).label}</h2>
          <Btn k="sm">Export</Btn>
        </div>
        {rows.length===0 ? <div style={{padding:'8px 17px 17px'}}><Empty>Nothing here.</Empty></div>
        : <div className="t-wrap"><table className="data">
            <thead><tr><th>Meeting</th><th>Setup / Type</th><th>Date & Time</th><th>Agenda</th>
              <th>Inputs Ready</th><th>Calendar</th><th>Minutes</th><th>Gov. Score</th>
              <th>Attendees</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map(o=>{
              const rd=inputReadiness(db,o,S), notReady=rd.filter(r=>!r.ready).length;
              const mom=db.moms.find(x=>x.occ===o.id), grid=db.grids.find(x=>x.occ===o.id);
              const st=occStatusTag(o,mom,grid), chair=occRoles(o).chair;
              const attendIds=(o.attend||[]).map(a=>typeof a==='string'?a:a.who);
              const cls = o.setup ? (MS(o.setup).cls||'') : (o.adhoc||'Ad Hoc');
              return <tr key={o.id} className="click" onClick={()=>go('mtg',o.id)}>
                <td><div className="t-main">{o.restricted&&'🔒 '}{occName(o)}</div>
                  {chair && <div className="t-sub">Chair: {P(chair).name}</div>}</td>
                <td><Tag c={occType(o)==='Committee'?'purple':'blue'}>
                    {cls.includes('Accreditation')?'Accreditation':occType(o)==='Committee'?'Committee':'Business'}</Tag>
                  <div className="t-sub">{o.setup?MS(o.setup).name:cls}</div></td>
                <td className="dim" style={{whiteSpace:'nowrap'}}>{fmtDS(o.date)}
                  <div className="t-sub">{o.start} – {o.end}</div>
                  {o.rescheduledFrom && <Tag c="amber">Rescheduled</Tag>}</td>
                <td>{o.agenda.length?<Tag c="green">{o.agenda.length} item{o.agenda.length>1?'s':''}</Tag>
                                    :<Tag c="red">None</Tag>}</td>
                <td>{rd.length===0?<span className="dim">—</span>
                  : notReady?<Tag c="amber">{rd.length-notReady}/{rd.length}</Tag>:<Tag c="green">{rd.length}/{rd.length}</Tag>}</td>
                <td>{o.status==='Cancelled'?<span className="dim">—</span>:<Tag c="green">✓ Synced</Tag>}</td>
                <td>{o.status==='Scheduled'?<span className="dim">—</span>
                  : mom?<Tag c={mom.status==='Closed'?'green':mom.status==='Approved'?'teal':'red'}>
                        {mom.status==='Draft'?'Overdue Draft':mom.status}</Tag>
                     :<span className="dim">Not yet created</span>}</td>
                <td>{o.status!=='Held' || !isCommittee(o) ? <span className="dim">{o.status!=='Held'?'—':'N/A'}</span>
                  : !grid ? <span className="dim">Pending</span>
                  : grid.state==='Approved' ? <b style={{color:`var(--${pctColour(grid.score)})`}}>{grid.score}%</b>
                  : <Tag c="amber">{grid.state}</Tag>}</td>
                <td><Avatars ids={attendIds}/></td>
                <td><Tag c={st.c}>{st.t}</Tag></td>
                <td style={{textAlign:'right'}}>
                  <Btn k={actionFor(o)==='Prepare'||actionFor(o)==='Write MOM'?'pri sm':'sm'}
                    style={{borderRadius:20}}>{actionFor(o)}</Btn></td>
              </tr>;})}
            </tbody></table></div>}
      </div>

      <div className="wa-side">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon green">🗓</div><h2 style={{flex:1}}>This Week</h2>
          </div>
          {thisWeek.length===0 ? <Empty ic="🗓">Nothing scheduled this week.</Empty>
          : thisWeek.map((o,i)=><div key={o.id} className="sched-r" onClick={()=>go('mtg',o.id)}>
              <div className={'sched-ic mtg'}>🗓</div>
              <div className="sched-t"><div className="n">{occName(o)}</div>
                <div className="m">{fmtDS(o.date)} · {o.start}</div></div>
              <Tag c={i===0?'amber':'grey'}>{i===0?'Next':o.mode}</Tag>
            </div>)}
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon amber">📈</div><h2 style={{flex:1}}>Meeting Health</h2>
          </div>
          <div className="wa-mo-r"><label>Meetings Held ({MONTHS[+PERIOD.slice(5,7)-1]})</label>
            <span className="v">{heldThisPeriod.length} / {scheduledThisPeriod}</span></div>
          <div className="wa-mo-r"><label>Avg Quorum Met</label>
            <span className="v">{avgQuorum==null?'—':avgQuorum+'%'}</span></div>
          <div className="wa-mo-r"><label>Pending MOM</label><span className="v">{pendingMomCt}</span></div>
          <div className="wa-mo-r"><label>Rescheduled</label><span className="v">{rescheduledCt}</span></div>
          <div className="wa-mo-r"><label>Cancelled</label><span className="v">{cancelledCt}</span></div>
        </div>

        {(overdueMom.length>0 || inputAlerts.length>0) && <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon amber">⚠</div><h2 style={{flex:1}}>Attention</h2>
          </div>
          {overdueMom.map(o=><div className="att-alert" key={'m'+o.id} onClick={()=>go('mtg',o.id)}
              style={{cursor:'pointer'}}>
            <span style={{color:'var(--red)'}}>⏱</span>
            <span>MOM overdue for <b>{occName(o)}</b> — {fmtDS(o.date)}</span></div>)}
          {inputAlerts.map(({o,n})=><div className="att-alert" key={'i'+o.id} onClick={()=>go('mtg',o.id)}
              style={{cursor:'pointer'}}>
            <span style={{color:'var(--amber)'}}>▲</span>
            <span>{n} report{n===1?'':'s'} pending as input{n===1?'':'s'} for <b>{occName(o)}</b></span></div>)}
        </div>}
      </div>
    </div>

    {mk && <NewMeetingModal kind={mk} onClose={()=>setMk(null)}/>}
  </>;
}

/* Carried from the previous occurrence — read-only.
   The Meeting opens with whatever the last one left open, so nothing has to be re-typed
   and nothing is lost between periods. Each item is closed in the record that raised it. */
function CarriedCard({rec}){
  const {db,go}=use();
  const c=carriedForward(db,rec);
  const total=c.tasks.length+c.decisions.length+c.agenda.length;
  if(!c.prev) return null;
  return <div className="card">
    <div className="ph-row" style={{alignItems:'baseline',gap:10}}>
      <div style={{flex:1}}>
        <h2>Carried from the previous occurrence</h2>
        <div className="csub">Still open when <a onClick={()=>go('mtg',c.prev.id)}>
          {occName(c.prev)} — {fmtD(c.prev.date)}</a> closed. Shown here to be picked up, not re-entered:
          each one is owned and closed in the record that raised it.</div>
      </div>
      <Tag c={total?'amber':'green'}>{total?total+' still open':'nothing outstanding'}</Tag>
    </div>

    {total===0
      ? <div style={{marginTop:12}}>
          <Note k="ok">Nothing was left open by the previous occurrence.</Note></div>
      : <table className="data" style={{marginTop:12}}>
          <thead><tr><th>Item</th><th>Kind</th><th>Owner</th><th>Due</th><th>State</th></tr></thead>
          <tbody>
            {c.tasks.map(t=>
              <tr key={t.id}>
                <td><div className="t-main">{t.title}</div>
                  <div className="t-sub">Raised in {occName(c.prev)} — {fmtD(c.prev.date)}</div></td>
                <td><Tag c="amber">Task</Tag></td>
                <td className="dim">{P(t.owner).name}</td>
                <td className="dim">{fmtD(t.due)}</td>
                <td><OD id={t.status}/></td>
              </tr>)}
            {c.decisions.map(d=>
              <tr key={d.id}>
                <td><div className="t-main">{d.title}</div>
                  <div className="t-sub">{d.path==='Direct'?'Direct Decision':'Decision Request'} ·
                    raised in {occName(c.prev)} — {fmtD(c.prev.date)}</div></td>
                <td><Tag c="purple">Decision</Tag></td>
                <td className="dim">{d.execOwner?P(d.execOwner).name:'—'}</td>
                <td className="dim">—</td>
                <td><OD id={d.status}/></td>
              </tr>)}
            {c.agenda.map(a=>
              <tr key={a.id}>
                <td><div className="t-main">{a.title}</div>
                  <div className="t-sub">Deferred and re-listed on this Agenda</div></td>
                <td><Tag c="teal">Agenda Item</Tag></td>
                <td className="dim">{a.owner?P(a.owner).name:'—'}</td>
                <td className="dim">—</td>
                <td><OD id="Carried"/></td>
              </tr>)}
          </tbody>
        </table>}

    <div style={{marginTop:12}}>
      <Note k="lock">Read-only here. A carried Task or Decision is closed in its own record, and it will
        keep appearing on this Meeting until it is.</Note></div>
  </div>;
}

function OccRow({o,past}){
  const {db,go,me,S}=use();
  const mom=db.moms.find(m=>m.occ===o.id);
  const grid=db.grids.find(g=>g.occ===o.id);
  const rd=inputReadiness(db,o,S);
  const notReady=rd.filter(r=>!r.ready).length;
  const setup=o.setup?MS(o.setup):null;
  const a=setup?attendance(o,setup,S.delegatedAttend):null;
  return <tr className="click" onClick={()=>go('mtg',o.id)}>
    <td className="dim" style={{whiteSpace:'nowrap'}}>{fmtD(o.date)}
      <div className="t-sub">{o.start}–{o.end}</div>
      {o.rescheduledFrom && <Tag c="amber">Rescheduled</Tag>}</td>
    <td><div className="t-main">{o.restricted&&'🔒 '}{occName(o)}</div>
      <div className="t-sub">{o.mode}{o.location?' · '+o.location:''}
        {o.adhoc?' · Ad Hoc — '+o.adhoc:''}</div></td>
    <td><Tag c={occType(o)==='Committee'?'purple':'blue'}>{occType(o)}</Tag>
      <div className="t-sub">{occCls(o)}</div></td>
    {!past && <>
      <td>{o.agenda.length?<Tag c="green">{o.agenda.length} item{o.agenda.length>1?'s':''}</Tag>
                          :<Tag c="red">None — required</Tag>}</td>
      <td>{rd.length===0?<span className="dim">No inputs</span>
        : notReady?<Tag c="amber">{notReady} not ready</Tag>:<Tag c="green">All ready</Tag>}</td>
      <td><Tag c={o.status==='Cancelled'?'grey':'green'}>{o.sync}</Tag></td>
    </>}
    {past && <>
      <td>{a?<>{a.num} of {a.den}<div className="t-sub">{pct(a.pct)} of Required Attendees</div></>
             :<span className="dim">—</span>}</td>
      <td>{mom?<Tag c={mom.status==='Closed'?'green':mom.status==='Approved'?'teal':'amber'}>
              {mom.status}</Tag>:<span className="dim">—</span>}</td>
      <td>{!isCommittee(o)?<span className="dim">Not scored — Business Meeting</span>
          : !grid?<Tag c="grey">Not yet created</Tag>
          : grid.state==='Approved'?<b style={{color:`var(--${pctColour(grid.score)})`}}>{grid.score}%</b>
          : <Tag c="amber">{grid.state}</Tag>}</td>
    </>}
  </tr>;
}

/* =========================================================================
   MEETING MINUTES — all MOMs across every Meeting, reachable from the sidebar
   ========================================================================= */
function ScreenMinutes(){
  const {db,me,go,sel,setSel,S} = use();
  const [tab,setTab]=useState('draft');

  const list = db.moms
    .map(m=>({...m, occ_:db.occs.find(o=>o.id===m.occ)}))
    .filter(m=>m.occ_ && canSeeOcc(m.occ_,me));

  const selRec = sel.mom ? list.find(m=>m.id===sel.mom) : null;
  if(selRec) return <MomDetail rec={selRec} occ={selRec.occ_} back={()=>setSel(v=>({...v,mom:null}))}/>;

  const draft    = list.filter(m=>m.status==='Draft' && !m.submittedAt);
  const pending  = list.filter(m=>m.status==='Draft' && m.submittedAt);
  const approved = list.filter(m=>m.status==='Approved');
  const closed   = list.filter(m=>m.status==='Closed');

  const overdue = draft.filter(m=>S.momWriteupHours!=null &&
    addHours(m.occ_.date+' '+m.occ_.end, S.momWriteupHours) < nowStamp());

  const TABS=[
    {id:'draft',    label:'Draft',            rows:draft},
    {id:'pending',  label:'Pending Approval',  rows:pending},
    {id:'approved', label:'Approved',          rows:approved},
    {id:'closed',   label:'Closed',            rows:closed},
    {id:'all',      label:'All Minutes',       rows:list},
  ];
  const rows = [...(TABS.find(t=>t.id===tab)||TABS[0]).rows].sort((a,b)=>b.occ_.date.localeCompare(a.occ_.date));

  const approvalRate = list.length ? Math.round((approved.length+closed.length)/list.length*100) : null;
  const waits = list.filter(m=>m.submittedAt && m.approvedAt).map(m=>hoursBetween(m.submittedAt,m.approvedAt));
  const avgWaitDays = waits.length ? (waits.reduce((a,b)=>a+b,0)/waits.length/24) : null;
  const createdThisMonth = list.filter(m=>m.history[0] && m.history[0].at.slice(0,7)===PERIOD.slice(0,7)).length;
  const approvedThisMonth = list.filter(m=>m.approvedAt && m.approvedAt.slice(0,7)===PERIOD.slice(0,7)).length;

  const allOutputs = list.flatMap(m=>momOutputs(db,m));
  const openOutputs = allOutputs.filter(o=>o.rec.status!=='Closed').length;
  const allDoneMoms = list.filter(m=>{const o=momOutputs(db,m); return o.length>0 && o.every(x=>x.rec.status==='Closed');}).length;
  const tasksFromMom = db.tasks.filter(t=>t.src.k==='mom');
  const decsFromMom  = db.decisions.filter(d=>d.src && d.src.k==='mom');

  const needsAction = [
    ...overdue.map(m=>({m, label:'Draft overdue — '+daysBetween(m.occ_.date,TODAY)+' days'})),
    ...pending.map(m=>({m, label:'Awaiting Chair signature'})),
  ];

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Meeting Minutes</h1>
        <div className="sub">Record, approve, and track meeting outcomes and action items.</div></div>
      <Btn k="pri" onClick={()=>go('mtg')}>✎ New MOM</Btn>
    </div>

    <div className="tabs">
      {TABS.map(t=>
        <button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>
          {t.label}{t.id!=='all' && <span className="c">{t.rows.length}</span>}</button>)}
    </div>

    <div className="stats">
      <Stat label="Total MOMs" v={list.length} d={'+'+createdThisMonth+' this month'}/>
      <Stat label="Approved" v={approved.length+closed.length}
        d={approvalRate==null?'—':approvalRate+'% approval rate'} c="green"/>
      <Stat label="Pending Signature" v={pending.length}
        d={avgWaitDays==null?'awaiting approval':'Avg wait '+avgWaitDays.toFixed(1)+'d'}
        c={pending.length?'amber':'muted'}/>
      <Stat label="Overdue" v={overdue.length} d={overdue.length?occName(overdue[0].occ_):'none'}
        c={overdue.length?'red':'muted'}/>
    </div>

    <div className="wa-grid">
      <div className="card flush">
        <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="wa-icon gold">💬</div><h2 style={{flex:1}}>Meeting Minutes</h2>
          <Btn k="sm">▾ Filter</Btn>
        </div>
        {rows.length===0 ? <div style={{padding:'8px 17px 17px'}}><Empty ic="💬">Nothing here.</Empty></div>
        : <div className="t-wrap"><table className="data">
            <thead><tr><th>MOM</th><th>Meeting</th><th>Status</th><th>Outputs</th><th>Date</th><th></th></tr></thead>
            <tbody>{rows.map(m=>{
              const r=occRoles(m.occ_), outs=momOutputs(db,m);
              const isOverdue = overdue.includes(m);
              return <tr key={m.id} className="click" onClick={()=>setSel(v=>({...v,mom:m.id}))}>
                <td><div className="t-main">{occName(m.occ_)} — {fmtDS(m.occ_.date)}</div>
                  <div className="t-sub">{momCode(m)} · Recorder: {P(r.recorder).name}</div></td>
                <td className="dim">{occCls(m.occ_)}</td>
                <td><Tag c={isOverdue?'red':momTagC(m.status)}>
                  {isOverdue?'Overdue Draft':m.status==='Draft'&&m.submittedAt?'Pending Approval':m.status}</Tag></td>
                <td className="dim">{outs.length?outs.length+' item'+(outs.length===1?'':'s'):'Not yet added'}</td>
                <td className="dim">{fmtDS(m.occ_.date)}</td>
                <td style={{textAlign:'right'}}>
                  <Btn k="pri sm" style={{borderRadius:20}}>Edit</Btn></td>
              </tr>;})}
            </tbody></table></div>}
      </div>

      <div className="wa-side">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon green">📈</div><h2 style={{flex:1}}>MOM Health</h2>
          </div>
          <div className="wa-mo-r"><label>Approved This Month</label><span className="v">{approvedThisMonth}</span></div>
          <div className="wa-mo-r"><label>Avg Approval Time</label>
            <span className="v">{avgWaitDays==null?'—':avgWaitDays.toFixed(1)+'d'}</span></div>
          <div className="wa-mo-r"><label>Open Outputs</label><span className="v">{openOutputs}</span></div>
          <div className="wa-mo-r"><label>Closed (All Outputs Done)</label><span className="v">{allDoneMoms}</span></div>
        </div>

        {needsAction.length>0 && <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon amber">⚠</div><h2 style={{flex:1}}>Needs Action</h2>
          </div>
          {needsAction.map(({m,label},i)=>
            <div key={m.id+i} className="att-alert" style={{cursor:'pointer'}}
              onClick={()=>setSel(v=>({...v,mom:m.id}))}>
              <span style={{color: overdue.includes(m)?'var(--red)':'var(--amber)'}}>
                {overdue.includes(m)?'⏱':'✎'}</span>
              <span><b>{occName(m.occ_)} — {fmtDS(m.occ_.date)}</b><br/>
                <span className="dim" style={{fontSize:11}}>{label}</span></span>
            </div>)}
        </div>}

        <div className="card">
          <h2>Output Tracker</h2>
          <div className="csub">MOM auto-closes when all outputs are activated.</div>
          <div className="wa-mo-r"><label>Tasks Created</label><span className="v">{tasksFromMom.length}</span></div>
          <div className="wa-mo-r"><label>Tasks Activated</label>
            <span className="v">{tasksFromMom.filter(t=>!t.draft).length}</span></div>
          <div className="wa-mo-r"><label>Decisions Created</label><span className="v">{decsFromMom.length}</span></div>
          <div className="wa-mo-r"><label>Decisions Activated</label>
            <span className="v">{decsFromMom.filter(d=>!d.draft).length}</span></div>
        </div>
      </div>
    </div>
  </>;
}

function MeetingDetail({rec,back}){
  const {db,me,A,go,S,sel,setSel}=use();
  const tab = sel.mtgTab || 'detail';
  const setTab = t=>setSel(v=>({...v,mtgTab:t}));
  const [cancel,setCancel]=useState(false);
  const [addAg,setAddAg]=useState('');
  const [linkOpen,setLinkOpen]=useState(false);
  const [edit,setEdit]=useState(false);
  const [people,setPeople]=useState(false);
  const [editAg,setEditAg]=useState(null);
  const setup=rec.setup?MS(rec.setup):null;
  const r=occRoles(rec);
  const mom=db.moms.find(m=>m.occ===rec.id);
  const grid=db.grids.find(g=>g.occ===rec.id);
  const rd=inputReadiness(db,rec,S);
  const a=attendance(rec,setup,S.delegatedAttend);
  const isOrg = acting(r.facilitator);
  const live = rec.status==='Scheduled';
  const outs = mom?momOutputs(db,mom):[];
  const durMin = (()=>{ const [sh,sm]=rec.start.split(':').map(Number), [eh,em]=rec.end.split(':').map(Number);
    return (eh*60+em)-(sh*60+sm); })();
  const carried = carriedForward(db, rec);
  const docs = rd.filter(x=>x.kind==='Report Submission')
    .map(x=>({...x, rpt:db.reports.find(rr=>rr.id===x.id)}))
    .filter(x=>x.rpt && x.rpt.file);
  const actionsAll = [...carried.tasks, ...carried.decisions, ...outs];
  const actionsFlat = [...carried.tasks, ...carried.decisions, ...outs.map(o=>o.rec)];
  const attHistory = rec.setup ? db.occs
    .filter(o=>o.setup===rec.setup && o.status==='Held' && o.id!==rec.id)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
    .map(o=>({o, a:attendance(o, setup, S.delegatedAttend)})) : [];

  return <>
    <div className="crumb"><a onClick={back}>Meetings</a> › <b>Meeting Detail</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{rec.restricted&&'🔒 '}{occName(rec)}</h1>
        <div className="sub" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Tag c={rec.status==='Held'?'green':rec.status==='Cancelled'?'grey':'blue'}>{rec.status}</Tag>
          <span className="mono" style={{fontSize:11.5}}>{occCode(rec)}</span>
          <span>· {(setup&&(setup.cls||'').includes('Accreditation'))?'Accreditation':occType(rec)} · {occCls(rec)}</span>
          {rec.restricted && <Tag c="purple">Restricted</Tag>}
        </div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn onClick={back}>Back to List</Btn>
        {live && <Btn onClick={()=>setEdit(true)}>✎ Edit</Btn>}
        {live && <Btn k="grn" disabled={!rec.agenda.length} onClick={()=>A.holdMeeting(rec.id)}>✓ Mark as Held</Btn>}
      </div>
    </div>

    {rec.restricted && <Note k="lock"><b>This is a manager-to-subordinate Meeting.</b> It runs through the
      Ad Hoc path with Ad Hoc Type {rec.adhoc} — no separate Setup Type exists for it. The occurrence and
      its Minutes are visible only to its participants and to permitted governance roles.</Note>}
    {rec.rescheduledFrom && <Note k="warn"><b>Rescheduled from {fmtD(rec.rescheduledFrom)}.</b> That date is
      a configured non-working day. Only this occurrence moved — the series is unchanged.</Note>}
    {rec.status==='Cancelled' && <Note k="err"><b>Cancelled.</b> {rec.cancelReason} No governance score is
      produced for a cancelled occurrence.</Note>}

    <div className="tabs">
      <button className={tab==='detail'?'on':''} onClick={()=>setTab('detail')}>Overview</button>
      <button className={tab==='agenda'?'on':''} onClick={()=>setTab('agenda')}>Agenda
        <span className="c">{rec.agenda.length}</span></button>
      <button className={tab==='att'?'on':''} onClick={()=>setTab('att')}>Attendance
        <span className="c">{rec.attend.length}</span></button>
      <button className={tab==='docs'?'on':''} onClick={()=>setTab('docs')}>Documents
        <span className="c">{docs.length}</span></button>
      <button className={tab==='inputs'?'on':''} onClick={()=>setTab('inputs')}>Submissions
        <span className="c">{rd.length}</span></button>
      <button className={tab==='disc'?'on':''} onClick={()=>setTab('disc')}>Discussions</button>
      <button className={tab==='outputs'?'on':''} onClick={()=>setTab('outputs')}>Actions
        {actionsAll.length>0 && <span className="c">{actionsAll.length}</span>}</button>
      <button className={tab==='minutes'?'on':''} onClick={()=>setTab('minutes')}>Minutes
        {mom && <span className="c">{mom.status==='Closed'?'✓':mom.status==='Approved'?'●':'…'}</span>}</button>
      {isCommittee(rec) && <button className={tab==='grid'?'on':''} onClick={()=>setTab('grid')}>
        Audit Grid{grid && <span className="c">{grid.state==='Approved'?grid.score+'%':'…'}</span>}</button>}
    </div>

    {tab==='detail' && <div className="wa-grid">
      <div>
        <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:16}}>
          <div className="stat" style={{textAlign:'center'}}>
            <div style={{fontSize:18}}>📅</div>
            <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{fmtDS(rec.date)}</div>
            <label style={{display:'block',marginTop:2}}>
              {new Date(rec.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()}</label>
          </div>
          <div className="stat" style={{textAlign:'center'}}>
            <div style={{fontSize:18}}>🕐</div>
            <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{rec.start}</div>
            <label style={{display:'block',marginTop:2}}>{durMin} MINUTES</label>
          </div>
          <div className="stat" style={{textAlign:'center'}}>
            <div style={{fontSize:18}}>📍</div>
            <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{rec.location||rec.mode}</div>
            <label style={{display:'block',marginTop:2}}>{rec.mode.toUpperCase()}</label>
          </div>
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon gold">📋</div><h2 style={{flex:1}}>Agenda Preview</h2>
            <span className="csub" style={{marginBottom:0}}>{rec.agenda.length} items · {durMin} min</span>
          </div>
          {rec.agenda.length===0 ? <Empty ic="📋">No Agenda Items yet.</Empty> : <>
            {rec.agenda.slice(0,5).map((a,i)=>
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',
                borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--teal-d)',fontWeight:700,fontSize:12,width:16}}>{i+1}.</span>
                <span style={{flex:1,fontSize:12.5}}>{a.title}</span>
                <span className="dim" style={{fontSize:11}}>{P(a.owner).name}</span>
              </div>)}
            <div style={{textAlign:'center',marginTop:10}}>
              <a onClick={()=>setTab('agenda')} style={{fontSize:12,color:'var(--teal-d)',fontWeight:650,
                cursor:'pointer'}}>View full agenda →</a></div>
          </>}
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <div className="wa-icon green">👥</div><h2 style={{flex:1,marginBottom:0}}>Attendance Summary</h2>
            <Bar v={a.den?a.num/a.den*100:0} c="green"/>
            <span style={{fontWeight:700,fontSize:13,minWidth:32,textAlign:'right'}}>{a.num}/{a.den}</span>
          </div>
          {setup && setup.quorumPct!=null &&
            <Note k="info">Attendance is recorded after the meeting is held. Quorum requires
              {' '}{Math.ceil(setup.quorumPct/100*a.den)} of {a.den} required members.</Note>}
          <div style={{textAlign:'center',marginTop:10}}>
            <a onClick={()=>setTab('att')} style={{fontSize:12,color:'var(--teal-d)',fontWeight:650,
              cursor:'pointer'}}>View full attendance →</a></div>
        </div>
      </div>

      <div className="wa-side">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon green">✓</div><h2 style={{flex:1}}>Actions</h2>
          </div>
          {live ? <>
            <Btn k="grn" style={{width:'100%',marginBottom:8}} disabled={!rec.agenda.length}
              onClick={()=>A.holdMeeting(rec.id)}>✓ Mark as Held</Btn>
            <Btn style={{width:'100%',marginBottom:8}} onClick={()=>setEdit(true)}>📅 Reschedule</Btn>
            <Btn k="dgr" style={{width:'100%'}} onClick={()=>setCancel(true)}>⊘ Cancel Meeting</Btn>
          </> : <div className="csub" style={{marginBottom:0}}>No further actions — this occurrence is
            {rec.status==='Held'?' Held.':' Cancelled.'}</div>}
        </div>

        <div className="card">
          <h2>Meeting Details</h2>
          <div className="wa-mo-r"><label>ID</label><span className="v mono">{occCode(rec)}</span></div>
          <div className="wa-mo-r"><label>Setup</label>
            <span className="v" style={{fontFamily:'inherit'}}>{setup?setup.name:'Custom Ad Hoc'}</span></div>
          <div className="wa-mo-r"><label>Type</label>
            <span className="v" style={{fontFamily:'inherit'}}>
              {(setup&&(setup.cls||'').includes('Accreditation'))?'Accreditation':occType(rec)}</span></div>
          <div className="wa-mo-r"><label>Chair</label>
            <span className="v" style={{fontFamily:'inherit'}}>{P(r.chair).name}</span></div>
          <div className="wa-mo-r"><label>Facilitator</label>
            <span className="v" style={{fontFamily:'inherit'}}>{P(r.facilitator).name}</span></div>
          <div className="wa-mo-r"><label>Recorder</label>
            <span className="v" style={{fontFamily:'inherit'}}>{P(r.recorder).name}</span></div>
          <div className="wa-mo-r"><label>Location</label>
            <span className="v" style={{fontFamily:'inherit'}}>{rec.location||rec.mode}</span></div>
          <div className="wa-mo-r"><label>Created</label>
            <span className="v" style={{fontFamily:'inherit'}}>{fmtD(rec.inviteSent)}</span></div>
        </div>

        {setup && setup.quorumPct!=null && <div className="card">
          <h2>Quorum Rules</h2>
          <div style={{border:'1px solid var(--green-bd)',background:'var(--green-bg)',borderRadius:8,
            padding:'7px 10px',fontSize:12,color:'var(--green)',fontWeight:600}}>
            ✓ Min {Math.ceil(setup.quorumPct/100*a.den)} of {a.den} required</div>
        </div>}

        {rd.length>0 && <div className="card">
          <h2>Linked Items</h2>
          {rd.map(item=>
            <div key={item.id} className="att-row" style={{cursor:item.kind==='Approved MOM'?'default':'pointer'}}
              onClick={()=>{ if(item.kind==='Report Submission') go('rpt', item.id); }}>
              <div className="att-ic">{item.kind==='Approved MOM'?'📝':'📄'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="t-main" style={{fontSize:12}}>{item.label}</div>
                <div className="t-sub">{item.status}</div>
              </div>
            </div>)}
        </div>}
      </div>
    </div>}

    {tab==='minutes' && (mom
      ? <MomBody rec={mom} occ={rec}/>
      : <div className="card"><Empty ic="📝">Minutes are created once the Meeting is marked as Held.
          {live && isOrg && <div className="btn-row" style={{justifyContent:'center',marginTop:12}}>
            <Btn k="pri" disabled={!rec.agenda.length}
                 onClick={()=>A.holdMeeting(rec.id)}>Mark as Held</Btn></div>}</Empty></div>)}

    {tab==='grid' && (grid
      ? <GridBody rec={grid} occ={rec}/>
      : <div className="card"><Empty ic="✓">
          {mom && mom.status==='Closed'
            ? 'The Audit Grid Template could not be retrieved. The failure is logged for retry.'
            : 'The Audit Grid is created when the Meeting Minutes reach Closed — never before, and it never blocks approval.'}
        </Empty></div>)}

    {tab==='outputs' && <div className="wa-grid">
      <div>
        <div className="card flush">
          <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="wa-icon gold">☑</div><h2 style={{flex:1}}>Action Items</h2>
            <span className="csub" style={{marginBottom:0}}>{actionsAll.length} item{actionsAll.length===1?'':'s'}
              {carried.tasks.length+carried.decisions.length>0 && ' · '+(carried.tasks.length+carried.decisions.length)+' from previous MOM'}</span>
          </div>
          {actionsAll.length===0 ? <div style={{padding:'8px 17px 17px'}}>
              <Empty ic="☑">Nothing carried forward, and no Outputs recorded yet.</Empty></div>
          : <div className="t-wrap"><table className="data">
              <thead><tr><th>Action</th><th>Owner</th><th>Source</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {carried.tasks.map(t=><tr key={'ct'+t.id}>
                  <td><div className="t-main">{t.title}</div>
                    <div className="t-sub">Carried from {occName(carried.prev)} — {fmtD(carried.prev.date)}</div></td>
                  <td className="dim">{P(t.owner).name}</td>
                  <td className="dim mono" style={{fontSize:11}}>
                    {momCode(db.moms.find(m=>m.occ===carried.prev.id))}</td>
                  <td className="dim">{fmtDS(t.due)}</td>
                  <td><OD id={t.status}/></td></tr>)}
                {carried.decisions.map(d=><tr key={'cd'+d.id}>
                  <td><div className="t-main">{d.title}</div>
                    <div className="t-sub">Carried from {occName(carried.prev)} — {fmtD(carried.prev.date)}</div></td>
                  <td className="dim">{d.execOwner?P(d.execOwner).name:'—'}</td>
                  <td className="dim mono" style={{fontSize:11}}>
                    {momCode(db.moms.find(m=>m.occ===carried.prev.id))}</td>
                  <td className="dim">—</td>
                  <td><OD id={d.status}/></td></tr>)}
                {outs.map(o=><tr key={'o'+o.id}>
                  <td><div className="t-main">{o.label}</div>
                    <div className="t-sub">{o.kind} · this Meeting{o.draft?' · Draft':''}</div></td>
                  <td className="dim">{o.rec.owner?P(o.rec.owner).name:o.rec.execOwner?P(o.rec.execOwner).name:'—'}</td>
                  <td className="dim mono" style={{fontSize:11}}>{mom?momCode(mom):'—'}</td>
                  <td className="dim">{o.rec.due?fmtDS(o.rec.due):'—'}</td>
                  <td>{o.draft?<Tag c="grey">Draft</Tag>:<OD id={o.rec.status}/>}</td></tr>)}
              </tbody></table></div>}
        </div>
        {mom && mom.status==='Draft' &&
          <Note k="warn"><b>This Meeting's own Outputs are still Draft.</b> They activate only when the
            Meeting Chair approves the Minutes. Use the Minutes tab to record outcomes and submit.</Note>}
        {!mom && <Note k="info">This occurrence's own Outputs are recorded in the Minutes, created once
          the Meeting is held.</Note>}
      </div>
      <div className="wa-side">
        <div className="card">
          <h2>Action Summary</h2>
          <div className="wa-mo-r"><label>Total Actions</label><span className="v">{actionsAll.length}</span></div>
          <div className="wa-mo-r"><label>In Progress</label>
            <span className="v">{actionsFlat.filter(x=>(x.status||'')==='In Progress').length}</span></div>
          <div className="wa-mo-r"><label>Not Started</label>
            <span className="v">{actionsFlat.filter(x=>(x.status||'')==='Not started'||(x.status||'')==='Open').length}</span></div>
          <div className="wa-mo-r"><label>Overdue</label>
            <span className="v" style={{color:'var(--red)'}}>
              {actionsFlat.filter(x=>x.due && x.due<TODAY && x.status!=='Closed').length}</span></div>
        </div>
      </div>
    </div>}

    {tab==='agenda' && <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon gold">📋</div><h2 style={{flex:1}}>Meeting Agenda</h2>
        <span className="csub" style={{marginBottom:0}}>{rec.agenda.length} items · {durMin} min total</span>
      </div>
      {rec.agendaSent
        ? <div style={{padding:'0 17px'}}><Note k="info">Agenda distributed {fmtD(rec.agendaSent)}
            {daysBetween(rec.agendaSent,rec.date)>=0 && ` — ${daysBetween(rec.agendaSent,rec.date)} day${daysBetween(rec.agendaSent,rec.date)===1?'':'s'} before the meeting`}.</Note></div>
        : live && <div style={{padding:'0 17px'}}><Note k="warn">Agenda not yet distributed.
            {live && <a style={{marginLeft:6,cursor:'pointer',fontWeight:650}}
              onClick={()=>A.setAgendaSent(rec.id,TODAY)}>Record distribution now</a>}</Note></div>}
      {rec.agenda.length===0 ? <div style={{padding:'8px 17px 17px'}}>
          <Empty ic="📋">No Agenda Item recorded. The Meeting cannot proceed.</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>#</th><th>Topic</th><th>Presenter</th><th>Source</th><th>Status</th>
            {live && <th></th>}</tr></thead>
          <tbody>{rec.agenda.map(ag=>{
            const bad = rd.filter(x=>!x.ready);
            return <tr key={ag.id}><td className="dim">{ag.seq}</td>
              <td><div className="t-main">{ag.title}</div>
                {ag.carriedFrom && <div className="t-sub">Carried forward from an earlier occurrence</div>}
                {ag.topicNature && <div style={{marginTop:4}}>
                  <Tag c="amber">{ag.topicNature}</Tag>{' '}
                  {ag.topicCats.map((c,i)=><Tag key={i}>{c.v}{c.sub?' · '+c.sub:''}</Tag>)}</div>}
                {ag.source.startsWith('Report input') && bad.length>0 &&
                  <div style={{marginTop:4}}><Tag c="amber">⚠ Input not yet reviewed</Tag></div>}</td>
              <td className="dim">{P(ag.owner).name}</td>
              <td className="dim">{ag.source}</td>
              <td>{ag.covered===true?<Tag c="green">Covered</Tag>
                  :ag.covered===false?<Tag c="amber">Not covered</Tag>:<Tag c="grey">Ready</Tag>}</td>
              {live && <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                <Btn k="sm" title="Move up" disabled={ag.seq===1}
                     onClick={()=>A.moveAgenda(rec.id,ag.id,-1)}>↑</Btn>{' '}
                <Btn k="sm" title="Move down" disabled={ag.seq===rec.agenda.length}
                     onClick={()=>A.moveAgenda(rec.id,ag.id,1)}>↓</Btn>{' '}
                <Btn k="sm" onClick={()=>setEditAg(ag)}>Edit</Btn>{' '}
                <Btn k="sm" onClick={()=>A.removeAgenda(rec.id,ag.id)}>Remove</Btn></td>}
            </tr>;})}
          </tbody></table></div>}
      {live && <div className="btn-row" style={{padding:'0 17px 17px'}}>
        <input type="text" value={addAg} onChange={e=>setAddAg(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&addAg.trim()){A.addAgenda(rec.id,addAg.trim());setAddAg('');}}}
          placeholder="Add an Agenda Item…" style={{flex:1,minWidth:220,border:'1px solid var(--border-d)',
          borderRadius:7,padding:'6px 10px',fontSize:12.5}}/>
        <Btn disabled={!addAg.trim()} onClick={()=>{A.addAgenda(rec.id,addAg.trim());setAddAg('');}}>Add</Btn>
      </div>}
      {!live && <div style={{padding:'0 17px 17px'}}><Note k="lock">The Agenda is fixed once the Meeting is
        held. Coverage is recorded in the Minutes, and an uncovered item can be carried forward.</Note></div>}
    </div>}

    {tab==='att' && <div className="wa-grid">
      <div className="card flush">
        <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="wa-icon green">👤</div><h2 style={{flex:1}}>Member Attendance</h2>
          <span className="csub" style={{marginBottom:0}}>{rec.attend.length} members</span>
        </div>
        <div className="t-wrap"><table className="data">
          <thead><tr><th>Member</th><th>Role</th><th>Type</th><th>Attendance</th>{live && <th></th>}</tr></thead>
          <tbody>{rec.attend.map(x=>{
            const req = x.extraRequired!=null ? x.extraRequired
                      : setup ? setup.required.includes(x.who) : true;
            const held = rec.status!=='Scheduled';
            return <tr key={x.who}><td><div className="t-main">{P(x.who).name}</div>
                <div className="t-sub">{P(x.who).dept}</div></td>
              <td className="dim">{P(x.who).position}</td>
              <td><Tag c={req?'teal':'grey'}>{req?'Required':'Optional'}</Tag></td>
              <td>{!held ? <Tag c="grey">Pending</Tag>
                : x.delegate ? <Tag c="amber">Delegated to {P(x.delegate).name}</Tag>
                : x.present ? <Tag c="green">Present</Tag> : <Tag c="red">Absent</Tag>}</td>
              {live && <td style={{textAlign:'right'}}>
                <Btn k="sm" onClick={()=>A.removeAttendee(rec.id,x.who)}>Remove</Btn></td>}
              {!live && held && <td style={{textAlign:'right'}}>
                <Btn k="sm" onClick={()=>A.setAttend(rec.id,x.who,!x.present)}>Toggle</Btn>{' '}
                <Btn k="sm" onClick={()=>A.setAttend(rec.id,x.who,'delegate')}>Delegate</Btn></td>}
            </tr>;})}
          </tbody></table></div>
        {live && <div className="btn-row" style={{padding:'0 17px 17px'}}>
          <Btn onClick={()=>setPeople(true)}>+ Add an Attendee</Btn></div>}
        {a.delegated>0 && <div style={{padding:'0 17px 17px'}}><Note k="warn">
          <b>{a.delegated} delegated attendance recorded.</b> How a delegated attendance counts is unresolved
          {' '}<OD id="OD-20"/> — change the treatment in Governance Settings.</Note></div>}
      </div>

      <div className="wa-side">
        <div className="card">
          <h2>Quorum Calculation</h2>
          {setup && setup.quorumPct!=null ? <>
            <div style={{border:'1px solid var(--green-bd)',background:'var(--green-bg)',borderRadius:8,
              padding:'7px 10px',fontSize:12,color:'var(--green)',fontWeight:600,marginBottom:10}}>
              ✓ Min {Math.ceil(setup.quorumPct/100*a.den)} of {a.den} required members</div>
            <Bar v={a.den?a.num/a.den*100:0} c={rec.status==='Scheduled'?'teal':pctColour(a.pct)}/>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>
              {rec.status==='Scheduled'?'Attendance not yet taken':pct(a.pct)+' of required members present'}</div>
            <div style={{display:'flex',gap:14,marginTop:12}}>
              <div><div style={{fontSize:18,fontWeight:700}}>{a.den}</div>
                <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase'}}>Required</div></div>
              <div><div style={{fontSize:18,fontWeight:700}}>
                {rec.attend.length-a.den}</div>
                <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase'}}>Optional</div></div>
              <div><div style={{fontSize:18,fontWeight:700}}>{rec.status==='Scheduled'?0:a.num}</div>
                <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase'}}>Present</div></div>
            </div>
          </> : <div className="csub" style={{marginBottom:0}}>No quorum threshold is configured for this
            Committee <OD id="AG-08"/>.</div>}
        </div>

        {attHistory.length>0 && <div className="card">
          <h2>Attendance History</h2>
          {attHistory.map(({o,a:ha},i)=>
            <div key={o.id} className="wa-mo-r"><label>{MONTHS[+o.date.slice(5,7)-1]} {o.date.slice(0,4)}</label>
              <span className="v" style={{color:`var(--${pctColour(ha.pct)})`}}>
                {ha.num}/{ha.den} ({pct(ha.pct)})</span></div>)}
        </div>}
      </div>
    </div>}

    {tab==='docs' && <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon gold">📄</div><h2 style={{flex:1}}>Meeting Documents</h2>
        <Btn k="sm">+ Upload</Btn>
      </div>
      {docs.length===0 ? <div style={{padding:'8px 17px 17px'}}>
          <Empty ic="📄">No documents attached to this Meeting's inputs yet.</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>Document</th><th>Uploaded By</th><th>Date</th><th>Size</th></tr></thead>
          <tbody>{docs.map(d=>
            <tr key={d.id} className="click" onClick={()=>go('rpt',d.rpt.id)}>
              <td><div className="t-main">{d.rpt.file}</div>
                <div className="t-sub">{d.label}</div></td>
              <td className="dim">{P(d.rpt.creator).name}</td>
              <td className="dim">{rptSubmittedAt(d.rpt)?fmtDS(rptSubmittedAt(d.rpt).split(' ')[0]):'—'}</td>
              <td className="dim">{d.rpt.files && d.rpt.files[0] && d.rpt.files[0].size!=null
                ? fmtFileSize(d.rpt.files[0].size) : '—'}</td>
            </tr>)}
          </tbody></table></div>}
    </div>}

    {tab==='inputs' && <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="wa-icon amber">⇧</div><h2 style={{flex:1}}>Pre-Meeting Submissions</h2>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Bar v={rd.length?rd.filter(x=>x.ready).length/rd.length*100:0} c="green"/>
          <span className="dim" style={{fontSize:11}}>{rd.filter(x=>x.ready).length}/{rd.length}</span>
        </div>
      </div>
      <div style={{padding:'0 17px'}}><Note k="info">Meeting input readiness minimum <OD id="OD-39"/>: all
        required submissions must reach at least <b>{S.inputReadiness==='approved'?'Approved':'Submitted'}</b>
        {' '}before the meeting can proceed.</Note></div>
      {rd.length===0 ? <div style={{padding:'8px 17px 17px'}}><Empty>No inputs linked.</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>Submission</th><th>Kind</th><th>Due Date</th><th>Status</th></tr></thead>
          <tbody>{rd.map(x=>{
            const r=db.reports.find(rr=>rr.id===x.id); const due=r?rptDue(r):null;
            return <tr key={x.id}><td className="t-main">{x.label}</td>
              <td className="dim">{x.kind}</td>
              <td className="dim">{due?fmtDS(due):'—'}</td>
              <td>{x.ready?<Tag c="green">{x.status}</Tag>
                : due && due<TODAY ? <Tag c="red">Overdue</Tag> : <Tag c="amber">{x.status}</Tag>}</td>
            </tr>;})}
          </tbody></table></div>}
      {live && <div className="btn-row" style={{padding:'0 17px 17px'}}>
        <Btn onClick={()=>setLinkOpen(true)}>Link a Report Submission or an approved MOM</Btn>
        {rd.map(x=><Btn k="sm" key={x.id} onClick={()=>A.unlinkInput(rec.id,x.id)}>
          Unlink {x.label.slice(0,28)}{x.label.length>28?'…':''}</Btn>)}</div>}
    </div>}

    {tab==='disc' && <div className="card">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
        <div className="wa-icon green">💬</div><h2 style={{flex:1}}>Discussion Topics</h2>
      </div>
      <Note k="info">Discussion notes are captured during the meeting and become part of the MOM record.
        Meeting status: <b>{rec.status}</b>{live && ' — notes will be available after the meeting is held.'}</Note>
      {rec.agenda.map(ag=>
        <div key={ag.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
          <div className="t-main" style={{fontSize:12.5}}>#{ag.seq} {ag.title}</div>
          <div className="t-sub" style={{fontStyle:mom&&mom.notes[ag.id]?'normal':'italic'}}>
            {mom && mom.notes[ag.id] ? mom.notes[ag.id] : 'Notes will be recorded during the meeting'}</div>
        </div>)}
    </div>}

    {cancel && <CancelModal onClose={()=>setCancel(false)}
      onSave={r2=>{A.cancelOcc(rec.id,r2);setCancel(false);}}/>}
    {linkOpen && <LinkInputModal occ={rec} onClose={()=>setLinkOpen(false)}/>}
    {edit && <EditOccModal occ={rec} onClose={()=>setEdit(false)}/>}
    {people && <AddAttendeeModal occ={rec} onClose={()=>setPeople(false)}/>}
    {editAg && <EditAgendaModal occ={rec} ag={editAg} onClose={()=>setEditAg(null)}/>}
  </>;
}

function EditOccModal({occ,onClose}){
  const {A}=use();
  const [f,setF]=useState({date:occ.date,start:occ.start,end:occ.end,mode:occ.mode,
                           location:occ.location||'',link:occ.link||''});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const nw = isNonWorking(f.date);
  const badTime = f.end<=f.start;
  const needLoc = f.mode!=='Online' && !f.location.trim();
  const needLink= f.mode!=='In person' && !f.link.trim();
  const ok = f.date && !badTime && !needLoc && !needLink;
  return <Modal title="Edit this occurrence" wide onClose={onClose}
    sub="Execution-level information only. The approved Setup, its controlled name and its classification are owned by Taxonomy."
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!ok} onClick={()=>{A.editOcc(occ.id,f);onClose();}}>
        Save and resynchronize</Btn></>}>
    <div className="f-row3">
      <Field label="Date" req err={nw?'This is a configured non-working day — the occurrence will move to the next working day.':null}>
        <input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
      <Field label="Start" req><input type="time" value={f.start} onChange={e=>set('start',e.target.value)}/></Field>
      <Field label="End" req err={badTime?'The end time must be after the start time.':null}>
        <input type="time" value={f.end} onChange={e=>set('end',e.target.value)}/></Field>
    </div>
    <Field label="Mode" req hint="Online meets in Teams, In person needs a location, Hybrid needs both.">
      <Pills opts={['Online','In person','Hybrid']} val={f.mode} onChange={v=>set('mode',v)}/></Field>
    {f.mode!=='Online' &&
      <Field label="Location" req err={needLoc?'A location is required for an in-person or hybrid Meeting.':null}>
        <input type="text" value={f.location} onChange={e=>set('location',e.target.value)}
          placeholder="e.g. Board Room, Level 3"/></Field>}
    {f.mode!=='In person' &&
      <Field label="Online link" req err={needLink?'An online link is required for an online or hybrid Meeting.':null}>
        <input type="text" value={f.link} onChange={e=>set('link',e.target.value)}
          placeholder="https://teams.microsoft.com/l/meetup-join/…"/></Field>}
    <Note k="info" ic="i">Saving resynchronizes the invitation with Outlook and Teams. Where the new date
      falls on a non-working day, only this occurrence moves — the series is unchanged.</Note>
  </Modal>;
}

function AddAttendeeModal({occ,onClose}){
  const {A}=use();
  const [who,setWho]=useState(''); const [req,setReq]=useState(false);
  const cands=PEOPLE.filter(p=>p.id!=='u0' && !occ.attend.some(a=>a.who===p.id));
  return <Modal title="Add an Attendee" onClose={onClose}
    sub="Resolved from Employee Data Management. Every Attendee is recorded as Required or Optional."
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!who} onClick={()=>{A.addAttendee(occ.id,who,req);onClose();}}>Add</Btn></>}>
    <Field label="Employee" req>
      <select value={who} onChange={e=>setWho(e.target.value)}>
        <option value="">Select…</option>
        {cands.map(p=><option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
    <Field label="Attendee type" req
      hint="Only Required Attendee attendance is measured by the Audit Grid (AG-09).">
      <Pills opts={['Optional','Required']} val={req?'Required':'Optional'}
             onChange={v=>setReq(v==='Required')}/></Field>
  </Modal>;
}

function EditAgendaModal({occ,ag,onClose}){
  const {A}=use();
  const [t,setT]=useState(ag.title); const [o,setO]=useState(ag.owner);
  return <Modal title={'Edit Agenda Item '+ag.seq} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!t.trim()} onClick={()=>{A.editAgenda(occ.id,ag.id,t.trim(),o);onClose();}}>
        Save</Btn></>}>
    <Field label="Item" req><textarea value={t} onChange={e=>setT(e.target.value)}/></Field>
    <Field label="Owner"><select value={o} onChange={e=>setO(e.target.value)}>
      {PEOPLE.filter(p=>p.id!=='u0').map(p=>
        <option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
    {ag.carriedFrom && <Note k="info" ic="i">This item was carried forward from an earlier occurrence.</Note>}
  </Modal>;
}

function CancelModal({onClose,onSave}){
  const [r,setR]=useState('');
  return <Modal title="Cancel this Meeting Occurrence" onClose={onClose}
    sub="The cancellation is synchronized with Outlook and Teams. No governance score is produced."
    footer={<><Btn onClick={onClose}>Keep the occurrence</Btn>
      <Btn k="dgr" disabled={!r.trim()} onClick={()=>onSave(r)}>Cancel the occurrence</Btn></>}>
    <Field label="Reason" req><textarea value={r} onChange={e=>setR(e.target.value)}/></Field>
  </Modal>;
}

function LinkInputModal({occ,onClose}){
  const {db,me,A,S}=use();
  const cands=[...db.reports.filter(r=>canSeeReport(r,me)&&!occ.inputs.includes(r.id))
      .map(r=>({id:r.id,label:rptName(r)+' · '+fmtP(r.period),status:r.status,kind:'Report Submission'})),
    ...db.moms.filter(m=>(m.status==='Approved'||m.status==='Closed')&&!occ.inputs.includes(m.id))
      .map(m=>{const o=db.occs.find(x=>x.id===m.occ);
        return {id:m.id,label:occName(o)+' · '+fmtD(o.date),status:m.status,kind:'Approved MOM'};})];
  return <Modal title="Link a Meeting input" wide onClose={onClose}
    sub="A Report Submission may be linked to more than one Meeting. Only an Approved or Closed MOM may be used as an input."
    footer={<Btn onClick={onClose}>Done</Btn>}>
    <table className="data"><thead><tr><th>Record</th><th>Kind</th><th>Status</th><th></th></tr></thead>
      <tbody>{cands.map(c=>{
        const blocked = c.kind==='Approved MOM' ? false
          : RPT_RANK[c.status] < (S.inputReadiness==='approved'?2:1);
        return <tr key={c.id}><td className="t-main">{c.label}</td><td className="dim">{c.kind}</td>
          <td><Tag c={c.status==='Approved'||c.status==='Closed'?'green':c.status==='In Review'?'teal':'grey'}>
            {c.status}</Tag></td>
          <td style={{textAlign:'right'}}>
            <Btn k="sm" onClick={()=>{A.linkInput(occ.id,c.id);onClose();}}>Link</Btn>
            {blocked && <div style={{fontSize:11,color:'var(--amber)',marginTop:3}}>Will be flagged as not ready</div>}
          </td></tr>;})}
      </tbody></table>
  </Modal>;
}

/* Attendees are picked one at a time from Employee Data Management, each recorded
   as Required or Optional — only Required attendance is measured by AG-09. */
function AttendeePicker({value,onChange}){
  const [who,setWho]=useState(''); const [type,setType]=useState('Required');
  const free=PEOPLE.filter(p=>p.id!=='u0' && !value.some(a=>a.who===p.id));
  const add=()=>{ if(!who) return; onChange([...value,{who,type}]); setWho(''); };
  return <Field label="Attendees" req
    hint="Resolved from Employee Data Management. Only Required Attendee attendance is scored (AG-09).">
    <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:value.length?9:0}}>
      <select value={who} onChange={e=>setWho(e.target.value)} style={{flex:'1 1 240px'}}>
        <option value="">Select an employee…</option>
        {free.map(p=><option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}
      </select>
      <select value={type} onChange={e=>setType(e.target.value)} style={{flex:'0 0 130px'}}>
        <option>Required</option><option>Optional</option>
      </select>
      <Btn disabled={!who} onClick={add}>Add</Btn>
    </div>
    {value.length===0
      ? <div style={{fontSize:12,color:'var(--red)'}}>At least one Attendee is required.</div>
      : <table className="data"><tbody>{value.map(a=>
          <tr key={a.who}>
            <td><div className="t-main">{P(a.who).name}</div>
                <div className="t-sub">{P(a.who).position}</div></td>
            <td style={{width:110}}><Tag c={a.type==='Required'?'teal':'grey'}>{a.type}</Tag></td>
            <td style={{width:80,textAlign:'right'}}>
              <Btn k="sm" onClick={()=>onChange(value.filter(x=>x.who!==a.who))}>Remove</Btn></td>
          </tr>)}
        </tbody></table>}
  </Field>;
}

function NewMeetingModal({kind,onClose}){
  const {A,me}=use();
  const custom = kind==='custom';
  const [f,setF]=useState({setup: custom?null:'ms1', name:'', purpose:'', bu:'AHJ',
    date:addDays(TODAY,5), start:'09:00', end:'10:00', mode:'Online', location:'',
    adhoc:'Governance', restricted:false, dept:P(me).dept, stage:'Business Unit',
    chair:'u2', facilitator:'u3', recorder:null,
    attend:[{who:'u2',type:'Required'},{who:'u5',type:'Required'}], agenda:[''], inputs:[],
    inviteSent:TODAY});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const agenda=f.agenda.filter(a=>a.trim());
  const ok = agenda.length>0 && (custom ? f.name.trim() && f.purpose.trim() && f.attend.length : true);
  const nw = isNonWorking(f.date);

  return <Modal wide onClose={onClose}
    title={custom?'Create a Custom Ad Hoc Meeting':'Create an Ad Hoc occurrence from an approved Setup'}
    sub={custom?'Use this only where no approved Setup exists. The Meeting is scheduled immediately and the metadata is sent to Taxonomy with a No-Setup flag.'
               :'The approved Setup and its classification are preserved. Only execution-level information can be changed.'}
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!ok} onClick={()=>{A.createOcc({...f,agenda});onClose();}}>
        {custom?'Schedule the Meeting':'Create the occurrence'}</Btn></>}>

    {!custom && <>
      <Field label="Approved Setup" req>
        <select value={f.setup} onChange={e=>set('setup',e.target.value)}>
          {MTG_SETUPS.map(s=><option key={s.id} value={s.id}>{s.name} — {s.type}</option>)}</select></Field>
      <Note k="lock">Locked by Taxonomy for this occurrence: controlled name, Setup Type, classification,
        TOR reference and quorum threshold. Editable here: date, time, mode, location, attendees, agenda
        and linked inputs.</Note>
    </>}

    {custom && <>
      <Field label="Meeting name" req><input type="text" value={f.name}
        onChange={e=>set('name',e.target.value)} placeholder="e.g. Sterilisation incident review"/></Field>
      <Field label="Purpose" req><textarea value={f.purpose}
        onChange={e=>set('purpose',e.target.value)}/></Field>
      <div className="f-row">
        <Field label="Meeting Chair" req><select value={f.chair} onChange={e=>set('chair',e.target.value)}>
          {PEOPLE.filter(p=>p.id!=='u0').map(p=>
            <option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
        <Field label="Facilitator" req
          hint="The Facilitator writes up the Minutes for an Ad Hoc Meeting. No separate MOM Recorder is named.">
          <select value={f.facilitator} onChange={e=>set('facilitator',e.target.value)}>
          {PEOPLE.filter(p=>p.id!=='u0').map(p=>
            <option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
      </div>
      <AttendeePicker value={f.attend} onChange={v=>set('attend',v)}/>
      <div className="f-row">
        <Field label="Department"><input type="text" value={f.dept}
          onChange={e=>set('dept',e.target.value)}/></Field>
        <Field label="Organizational Stage"><select value={f.stage} onChange={e=>set('stage',e.target.value)}>
          {['Business Unit','Region','Group','ExCom'].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
    </>}

    <Field label="Ad Hoc Type" req hint="A one-to-one or skip-level Meeting uses Leadership or Governance.">
      <Pills val={f.adhoc} onChange={v=>set('adhoc',v||'Governance')} opts={ADHOC_TYPES}/></Field>

    <div className="f-row3">
      <Field label="Date" req err={nw?'This is a configured non-working day — the occurrence will move to the next working day.':null}>
        <input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
      <Field label="Start" req><input type="time" value={f.start}
        onChange={e=>set('start',e.target.value)}/></Field>
      <Field label="End" req><input type="time" value={f.end}
        onChange={e=>set('end',e.target.value)}/></Field>
    </div>
    <div className="f-row">
      <Field label="Mode"><select value={f.mode} onChange={e=>set('mode',e.target.value)}>
        {['Online','In person','Hybrid'].map(m=><option key={m}>{m}</option>)}</select></Field>
      <Field label="Location" hint="Required for an in-person or hybrid Meeting.">
        <input type="text" value={f.location} onChange={e=>set('location',e.target.value)}
          disabled={f.mode==='Online'}/></Field>
    </div>

    {custom && <Field label="">
      <label className="chk"><input type="checkbox" checked={f.restricted}
        onChange={e=>set('restricted',e.target.checked)}/>
        <span>Restrict visibility to participants — use for a one-to-one or skip-level Meeting.
          The occurrence and its Minutes will be hidden from everyone else except permitted governance
          roles.</span></label></Field>}

    <Field label="Agenda Items" req hint="At least one Agenda Item is required for every Meeting.">
      {f.agenda.map((a,i)=>
        <div key={i} style={{display:'flex',gap:7,marginBottom:6}}>
          <input type="text" value={a} placeholder={'Agenda Item '+(i+1)}
            onChange={e=>set('agenda',f.agenda.map((x,j)=>j===i?e.target.value:x))}
            style={{flex:1,border:'1px solid var(--border-d)',borderRadius:7,padding:'7px 9px',fontSize:13}}/>
          {f.agenda.length>1 && <Btn k="sm" onClick={()=>set('agenda',f.agenda.filter((_,j)=>j!==i))}>×</Btn>}
        </div>)}
      <Btn k="sm" onClick={()=>set('agenda',[...f.agenda,''])}>+ Add another</Btn>
    </Field>
  </Modal>;
}
/* =========================================================================
   5 · MEETING MINUTES
   ========================================================================= */
const momTagC = s => s==='Closed'?'green':s==='Approved'?'teal':s==='Returned'?'red':'amber';

/* Rendered as a tab inside the Meeting Occurrence — Minutes are never a place of their own. */
/* =========================================================================
   MOM DETAIL — standalone "Review & Sign" page, reached from Meeting Minutes
   ========================================================================= */
function MomDetail({rec,occ,back}){
  const {db,me,A,go,S} = use();
  const r = occRoles(occ);
  const outs = momOutputs(db,rec);
  const [comment,setComment] = useState('');
  const [ret,setRet] = useState(false);
  const [xport,setXport] = useState(false);

  const isChair = r.chair===me;
  const isRecorder = r.recorder===me;
  const editable = rec.status==='Draft' && isRecorder;
  const pendingApproval = rec.status==='Draft' && !!rec.submittedAt;
  const a = attendance(occ, occ.setup?MS(occ.setup):null, S.delegatedAttend);
  const durMin = (()=>{ const [sh,sm]=occ.start.split(':').map(Number), [eh,em]=occ.end.split(':').map(Number);
    return (eh*60+em)-(sh*60+sm); })();

  /* AG-05 / OD-09b — the Chair's signing window, measured from submission. Only shown once configured. */
  const deadline = (pendingApproval && S.momApprovalHours!=null)
    ? addHours(rec.submittedAt, S.momApprovalHours) : null;
  const hoursLeft = deadline!=null ? S.momApprovalHours - hoursBetween(rec.submittedAt, nowStamp()) : null;

  const noteText = occ.agenda.map(ag=>rec.notes[ag.id]).filter(n=>n&&n.trim()).join('\n\n');
  const decisions = outs.filter(o=>o.kind!=='TMS Task');

  const steps = [
    {label:'Recorder submitted', done:!!rec.submittedAt,
      sub: rec.submittedAt ? P(r.recorder).name+' · '+fmtDS(rec.submittedAt.split(' ')[0]) : 'Not yet submitted'},
    {label:'Chair review & signature', done: rec.status==='Approved'||rec.status==='Closed',
      current: pendingApproval,
      sub: rec.sig ? rec.sig.name+' · '+fmtDS(rec.sig.date) : P(r.chair).name},
    ...(S.momClosure==='manual' ? [{label:'Closed', done: rec.status==='Closed',
      current: rec.status==='Approved', sub: rec.closedAt ? fmtDS(rec.closedAt.split(' ')[0]) : 'Releases the Audit Grid'}] : []),
  ];

  return <>
    <div className="crumb"><a onClick={back}>Meeting Minutes</a> ›
      <b>{pendingApproval?'Review & Sign':rec.status}</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{occName(occ)} — {fmtP(occ.date.slice(0,7))}</h1>
        <div className="sub" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Tag c={pendingApproval?'amber':momTagC(rec.status)}>
            {pendingApproval?'Pending Signature':rec.status}</Tag>
          <span className="mono" style={{fontSize:11.5}}>{momCode(rec)}</span>
          {rec.submittedAt && <>· Submitted by {P(r.recorder).name} on {fmtD(rec.submittedAt.split(' ')[0])}</>}
        </div></div>
      <Btn onClick={back}>Back to List</Btn>
    </div>

    {pendingApproval && isChair && <Note k="info">You are the Meeting Chair. Review the minutes and sign
      digitally to approve. You can also return with comments.</Note>}
    {rec.returnReason && rec.status==='Draft' && <Note k="err"><b>Returned by the Meeting Chair.</b>
      {' '}{rec.returnReason} The previous review history is retained.</Note>}
    {rec.status==='Closed' && <Note k="lock"><b>These Minutes are Closed and locked.</b> A correction is
      made through a new version or an addendum, never by editing this record.</Note>}

    {deadline && <div className="card" style={{display:'flex',alignItems:'center',gap:14,
        borderColor:'var(--amber-bd)',background:'var(--amber-bg)'}}>
      <span style={{fontSize:18}}>⏱</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:13}}>MOM Approval Period Active</div>
        <div style={{fontSize:11.5,color:'var(--muted)'}}><OD id="AG-05"/> / <OD id="OD-09b"/>: Chair must
          sign within {S.momApprovalHours}h of submission. Submitted {fmtDS(rec.submittedAt.split(' ')[0])}
          {' '}— deadline {fmtD(deadline.split(' ')[0])}. Escalation triggers on expiry.</div>
      </div>
      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:14,
        color:hoursLeft<0?'var(--red)':'var(--amber)'}}>
        {hoursLeft<0?'Overdue':Math.max(1,Math.ceil(hoursLeft/24))+' day'+(Math.ceil(hoursLeft/24)===1?'':'s')+' left'}</div>
    </div>}

    <div className="wa-grid">
      <div>
        {editable ? <MomEditBody rec={rec} occ={occ}/> : <>
          <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:16}}>
            <div className="stat" style={{textAlign:'center'}}><div style={{fontSize:18}}>📅</div>
              <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{fmtDS(occ.date)}</div>
              <label style={{display:'block',marginTop:2}}>DATE HELD</label></div>
            <div className="stat" style={{textAlign:'center'}}><div style={{fontSize:18}}>🕐</div>
              <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{occ.start}</div>
              <label style={{display:'block',marginTop:2}}>{durMin} MINUTES</label></div>
            <div className="stat" style={{textAlign:'center'}}><div style={{fontSize:18}}>👥</div>
              <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{a.num}/{a.den}</div>
              <label style={{display:'block',marginTop:2}}>QUORUM MET</label></div>
          </div>

          <div className="card">
            <h2>Discussion Summary</h2>
            {noteText
              ? noteText.split('\n\n').map((p,i)=><p key={i} style={{fontSize:12.5,marginBottom:8}}>{p}</p>)
              : <div className="csub" style={{marginBottom:0}}>No Discussion Notes recorded.</div>}
          </div>

          <div className="card">
            <h2>Key Decisions Made</h2>
            {decisions.length===0 ? <div className="csub" style={{marginBottom:0}}>No Decisions raised.</div>
            : decisions.map((o,i)=><div key={o.id} style={{display:'flex',gap:10,padding:'6px 0'}}>
                <div className="wa-icon gold" style={{width:22,height:22,flex:'0 0 22px',fontSize:11}}>{i+1}</div>
                <div style={{fontSize:12.5,paddingTop:2}}>{o.label}</div></div>)}
          </div>

          <div className="card flush">
            <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
              <div className="wa-icon gold">☑</div><h2 style={{flex:1}}>Outputs</h2>
              <span className="csub" style={{marginBottom:0}}>{outs.length} item{outs.length===1?'':'s'}</span>
            </div>
            {outs.length===0 ? <div style={{padding:'8px 17px 17px'}}><Empty>No Outputs recorded.</Empty></div>
            : outs.map(o=>{
                const isTask = o.kind==='TMS Task';
                const blocked = !isTask && o.rec.blocked;
                return <div key={o.id} className="att-row" style={{borderColor:blocked?'var(--amber-bd)':'var(--border)',
                    background:blocked?'#fffdf8':'#fff', cursor:isTask?'default':'pointer'}}
                    onClick={!isTask?()=>go('dec',o.id):undefined}>
                  <div className="att-ic">{isTask?'☑':'⚖'}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="t-main" style={{fontSize:12.5}}>{isTask?'Task':o.kind}: {o.label}</div>
                    <div className="t-sub">{isTask && o.rec.owner
                      ? 'Assigned to '+P(o.rec.owner).name+' · Due '+fmtDS(o.rec.due)
                      : blocked ? 'Pending Authority Matrix check' : o.kind}</div>
                  </div>
                  <Tag c={o.draft?'amber':'green'}>{o.draft?'Pending':'Active'}</Tag>
                </div>;})}
          </div>
        </>}
      </div>

      <div className="wa-side">
        {pendingApproval && isChair && <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon gold">✎</div><h2 style={{flex:1}}>Digital Signature</h2>
          </div>
          <div className="csub">By signing, you confirm that the minutes accurately reflect the meeting
            proceedings and decisions.</div>
          <Field label="Chair Comments (optional)">
            <textarea value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="Add comments before signing…"/></Field>
          <div style={{border:'1px dashed var(--border-d)',borderRadius:9,padding:'14px 12px',textAlign:'center',
            margin:'4px 0 12px'}}>
            <div style={{fontSize:16}}>✎</div>
            <div style={{fontWeight:650,fontSize:12.5,marginTop:4}}>{P(r.chair).name}</div>
            <div className="t-sub">{P(r.chair).position} — Chair</div>
            <div style={{fontSize:11.5,color:'var(--teal-d)',fontStyle:'italic',marginTop:6}}>
              Click to sign digitally</div>
          </div>
          <Btn k="grn" style={{width:'100%',marginBottom:8}}
            onClick={()=>{A.momApprove(rec.id,comment);}}>✎ Sign & Approve</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setRet(true)}>↺ Return with Comments</Btn>
        </div>}

        {rec.status==='Approved' && isChair && S.momClosure==='manual' && db.tasks
          .filter(t=>t.src.k==='mom'&&t.src.id===rec.id&&t.syncFailed).length===0 &&
          <div className="card">
            <h2>Close the Minutes</h2>
            <div className="csub">Closure finalises the record and releases the governance score.</div>
            <Btn k="grn" style={{width:'100%'}} onClick={()=>A.momClose(rec.id)}>Close the Meeting Minutes</Btn>
          </div>}

        {!pendingApproval && rec.sig && <div className="card">
          <h2>Signature</h2>
          <div className="sig"><span className="sl">Approved and signed by</span>
            {rec.sig.name}<br/>{P(rec.sig.who).position}<br/>
            {fmtD(rec.sig.date)} · {rec.sig.time} · {occ.tz}</div>
        </div>}

        <div className="card">
          <h2>MOM Details</h2>
          <div className="wa-mo-r"><label>ID</label><span className="v mono">{momCode(rec)}</span></div>
          <div className="wa-mo-r"><label>Meeting</label>
            <span className="v" style={{fontFamily:'inherit'}}>{occCls(occ)}</span></div>
          <div className="wa-mo-r"><label>Date Held</label><span className="v">{fmtD(occ.date)}</span></div>
          <div className="wa-mo-r"><label>Recorder</label>
            <span className="v" style={{fontFamily:'inherit'}}>{P(r.recorder).name}</span></div>
          <div className="wa-mo-r"><label>Submitted</label>
            <span className="v">{rec.submittedAt?fmtD(rec.submittedAt.split(' ')[0]):'—'}</span></div>
          <div className="wa-mo-r"><label>Type</label>
            <span className="v" style={{fontFamily:'inherit'}}>
              {(occ.setup&&(MS(occ.setup).cls||'').includes('Accreditation'))?'Accreditation':occType(occ)}</span></div>
        </div>

        <div className="card">
          <h2>Approval Progress</h2>
          {steps.map((s,i)=>
            <div className="rev-row" key={i}>
              <div className={'rev-num '+(s.done?'done':s.current?'now':'pending')}>{s.done?'✓':i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="t-main" style={{fontSize:12.5}}>{s.label}</div>
                <div className="t-sub">{s.sub}</div>
              </div>
              <Tag c={s.done?'green':s.current?'amber':'grey'}>{s.done?'Done':s.current?'Current':'Pending'}</Tag>
            </div>)}
        </div>

        <Btn k="sm" style={{width:'100%'}} onClick={()=>setXport(true)}>Export / print</Btn>
      </div>
    </div>

    {ret && <ReturnModal title="Return the Meeting Minutes" onClose={()=>setRet(false)}
      onSave={r2=>{A.momReturn(rec.id,r2);setRet(false);}}/>}
    {xport && <ExportModal mom={rec} occ={occ} outs={outs} onClose={()=>setXport(false)}/>}
  </>;
}

/* Draft, editable-by-Recorder view — the per-Agenda-Item outcome workflow, identical in substance
   to the original Minutes tab so the Recorder's editing flow still works from the standalone page. */
function MomEditBody({rec,occ}){
  const {db,A}=use();
  const outs = momOutputs(db,rec);
  const [modal,setModal]=useState(null);
  const [agFor,setAgFor]=useState(null);
  const noOutcome = occ.agenda.filter(a=>!outs.some(x=>x.ag===a.id) && !(rec.notes[a.id]||'').trim());

  return <div className="card">
    <h2>Agenda Item outcomes</h2>
    <div className="csub">An Agenda Item may produce no Output, one Output or many. Where it produces
      no Output, a Discussion Note is required.</div>
    {occ.agenda.map(ag=>{
      const mine=outs.filter(o=>o.ag===ag.id);
      const note=rec.notes[ag.id]||'';
      const bad = !mine.length && !note.trim();
      return <div key={ag.id} className="card" style={{margin:'0 0 11px',
        borderColor:bad?'var(--amber-bd)':'var(--border)',background:bad?'#fffdf8':'#fff'}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <span className="nav-n" style={{marginTop:2}}>{ag.seq}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:650,fontSize:13.5}}>{ag.title}</div>
            <div style={{fontSize:11.5,color:'var(--muted)'}}>Owner {P(ag.owner).name} · {ag.source}</div>
          </div>
          {ag.covered===false?<Tag c="amber">Not covered</Tag>
           :ag.covered===true?<Tag c="green">Covered</Tag>:null}
          <select value={ag.covered===null?'':String(ag.covered)}
            onChange={e=>A.momCovered(occ.id,ag.id,e.target.value===''?null:e.target.value==='true')}
            style={{border:'1px solid var(--border-d)',borderRadius:6,padding:'3px 6px',fontSize:11.5}}>
            <option value="">Coverage…</option><option value="true">Covered</option>
            <option value="false">Not covered</option></select>
        </div>
        <div style={{marginTop:10}}>
          <Field label="Discussion Note">
            <textarea value={note} onChange={e=>A.momNote(rec.id,ag.id,e.target.value)}
              placeholder="Required when the Agenda Item produces no Output."/>
          </Field>
          {mine.length>0 && <table className="data" style={{marginBottom:8}}>
            <tbody>{mine.map(o=>
              <tr key={o.id}><td style={{width:120}}>
                <Tag c={o.kind==='TMS Task'?'grey':o.kind==='Direct Decision'?'green':'amber'}>
                  {o.kind}</Tag></td>
                <td className="t-main">{o.label}
                  {o.kind==='TMS Task'&&o.rec.owner&&
                    <div className="t-sub">{P(o.rec.owner).name} · due {fmtD(o.rec.due)}</div>}</td>
                <td style={{textAlign:'right'}}>
                  {o.draft?<Tag c="amber">Draft</Tag>:<Tag c="green">Active</Tag>}</td></tr>)}
            </tbody></table>}
          {bad && <div style={{fontSize:11.5,color:'var(--amber)',fontWeight:600,marginBottom:8}}>
            ▲ No Output and no Discussion Note — submission is blocked until one is recorded.</div>}
          <div className="btn-row">
            <Btn k="sm" onClick={()=>{setAgFor(ag.id);setModal('task');}}>+ TMS Task</Btn>
            <Btn k="sm" onClick={()=>{setAgFor(ag.id);setModal('dec');}}>+ Decision</Btn>
          </div>
        </div>
      </div>;})}

    <div className="card-ft" style={{margin:'0 -17px -16px',borderRadius:'0 0 9px 9px'}}>
      {noOutcome.length>0
        ? <span style={{fontSize:12.5,color:'var(--amber)',fontWeight:600}}>
            ▲ {noOutcome.length} Agenda Item{noOutcome.length>1?'s have':' has'} neither an Output nor
            a Discussion Note.</span>
        : <span style={{fontSize:12.5,color:'var(--green)',fontWeight:600}}>
            ✓ Every Agenda Item records an outcome.</span>}
      <div style={{flex:1}}/>
      <Btn k="pri" disabled={noOutcome.length>0} onClick={()=>A.momSubmit(rec.id)}>
        Submit for Chair approval</Btn>
    </div>

    {modal==='task' && <TaskModal onClose={()=>setModal(null)}
      onSave={f=>{A.addTask(f,{k:'mom',id:rec.id,ag:agFor});setModal(null);}}/>}
    {modal==='dec' && <DecisionIntakeModal src={{k:'mom',id:rec.id,ag:agFor}}
      onClose={()=>setModal(null)}/>}
  </div>;
}

function MomBody({rec,occ}){
  const {db,me,A,openMeeting,go,S}=use();
  const r=occRoles(occ);
  const outs=momOutputs(db,rec);
  const grid=db.grids.find(g=>g.occ===occ.id);
  const [modal,setModal]=useState(null);
  const [agFor,setAgFor]=useState(null);
  const [ret,setRet]=useState(false);
  const [xport,setXport]=useState(false);

  const isRecorder = r.recorder===me, isChair = r.chair===me;
  const editable = rec.status==='Draft' && isRecorder;
  const noOutcome = occ.agenda.filter(a=>!outs.some(x=>x.ag===a.id) && !(rec.notes[a.id]||'').trim());
  const pendingSync = db.tasks.filter(t=>t.src.k==='mom'&&t.src.id===rec.id&&t.syncFailed);
  const canClose = rec.status==='Approved' && pendingSync.length===0;

  return <>
    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12,flexWrap:'wrap'}}>
      <Tag c={momTagC(rec.status)}>{rec.status}</Tag>
      {rec.submittedAt && rec.status==='Draft' && <Tag c="amber">Awaiting Chair approval</Tag>}
      {rec.status==='Closed' && <Tag c="grey">🔒 Locked</Tag>}
      <div style={{flex:1}}/>
      <Btn k="sm" onClick={()=>setXport(true)}>Export / print</Btn>
    </div>

    <Rail steps={['Draft','Approved','Closed']} now={rec.status==='Returned'?'Draft':rec.status}
          done={rec.status==='Closed'?['Draft','Approved']:rec.status==='Approved'?['Draft']:[]}/>

    {rec.returnReason && rec.status==='Draft' &&
      <Note k="err"><b>Returned by the Meeting Chair.</b> {rec.returnReason} The previous review history is
        retained and every Output stays Draft.</Note>}
    {rec.status==='Closed' && <Note k="lock"><b>These Minutes are Closed and locked.</b> A correction is
      made through a new version or an addendum, never by editing this record.</Note>}
    {rec.status==='Approved' && pendingSync.length>0 &&
      <Note k="err"><b>Approved, but not yet Closed.</b> {pendingSync.length} Output could not be activated
        in TMS and is queued for retry. The Minutes cannot be Closed until every Output is active, so the
        Audit Grid has not been created.
        {isChair && <div className="btn-row" style={{marginTop:9}}>
          {pendingSync.map(t=><Btn key={t.id} k="sm" onClick={()=>A.retryTaskSync(t.id)}>
            Retry activation — {t.title}</Btn>)}</div>}</Note>}
    {rec.status==='Approved' && canClose && S.momClosure==='manual' &&
      <Note k="warn"><b>Approved and signed, waiting to be closed.</b> Closure is configured as an explicit
        act <OD id="OD-38"/>. The Audit Grid is released on closure, not on approval.</Note>}

    <div className="grid2">
      <div>
        <div className="card">
          <h2>Agenda Item outcomes</h2>
          <div className="csub">An Agenda Item may produce no Output, one Output or many. Where it produces
            no Output, a Discussion Note is required.</div>
          {occ.agenda.map(ag=>{
            const mine=outs.filter(o=>o.ag===ag.id);
            const note=rec.notes[ag.id]||'';
            const bad = !mine.length && !note.trim();
            return <div key={ag.id} className="card" style={{margin:'0 0 11px',
              borderColor:bad?'var(--amber-bd)':'var(--border)',background:bad?'#fffdf8':'#fff'}}>
              <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <span className="nav-n" style={{marginTop:2}}>{ag.seq}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:650,fontSize:13.5}}>{ag.title}</div>
                  <div style={{fontSize:11.5,color:'var(--muted)'}}>Owner {P(ag.owner).name} · {ag.source}</div>
                </div>
                {ag.covered===false?<Tag c="amber">Not covered</Tag>
                 :ag.covered===true?<Tag c="green">Covered</Tag>:null}
                {editable && <select value={ag.covered===null?'':String(ag.covered)}
                  onChange={e=>A.momCovered(occ.id,ag.id,e.target.value===''?null:e.target.value==='true')}
                  style={{border:'1px solid var(--border-d)',borderRadius:6,padding:'3px 6px',fontSize:11.5}}>
                  <option value="">Coverage…</option><option value="true">Covered</option>
                  <option value="false">Not covered</option></select>}
              </div>
              <div style={{marginTop:10}}>
                <Field label="Discussion Note">
                  {editable
                    ? <textarea value={note} onChange={e=>A.momNote(rec.id,ag.id,e.target.value)}
                        placeholder="Required when the Agenda Item produces no Output."/>
                    : <div className="readonly" style={{minHeight:34}}>{note||'—'}</div>}
                </Field>
                {mine.length>0 && <table className="data" style={{marginBottom:8}}>
                  <tbody>{mine.map(o=>
                    <tr key={o.id}><td style={{width:120}}>
                      <Tag c={o.kind==='TMS Task'?'grey':o.kind==='Direct Decision'?'green':'amber'}>
                        {o.kind}</Tag></td>
                      <td className="t-main">{o.label}
                        {o.kind==='TMS Task'&&o.rec.owner&&
                          <div className="t-sub">{P(o.rec.owner).name} · due {fmtD(o.rec.due)}</div>}</td>
                      <td style={{textAlign:'right'}}>
                        {o.draft?<Tag c="amber">Draft</Tag>:<Tag c="green">Active</Tag>}</td></tr>)}
                  </tbody></table>}
                {bad && <div style={{fontSize:11.5,color:'var(--amber)',fontWeight:600,marginBottom:8}}>
                  ▲ No Output and no Discussion Note — submission is blocked until one is recorded.</div>}
                {editable && <div className="btn-row">
                  <Btn k="sm" onClick={()=>{setAgFor(ag.id);setModal('task');}}>+ TMS Task</Btn>
                  <Btn k="sm" onClick={()=>{setAgFor(ag.id);setModal('dec');}}>+ Decision</Btn>
                </div>}
              </div>
            </div>;})}

          {editable && <div className="card-ft" style={{margin:'0 -17px -16px',borderRadius:'0 0 9px 9px'}}>
            {noOutcome.length>0
              ? <span style={{fontSize:12.5,color:'var(--amber)',fontWeight:600}}>
                  ▲ {noOutcome.length} Agenda Item{noOutcome.length>1?'s have':' has'} neither an Output nor
                  a Discussion Note.</span>
              : <span style={{fontSize:12.5,color:'var(--green)',fontWeight:600}}>
                  ✓ Every Agenda Item records an outcome.</span>}
            <div style={{flex:1}}/>
            <Btn k="pri" disabled={noOutcome.length>0} onClick={()=>A.momSubmit(rec.id)}>
              Submit for Chair approval</Btn>
          </div>}
        </div>
      </div>

      <div>
        {rec.status==='Draft' && rec.submittedAt && isChair &&
          <div className="card" style={{borderColor:'var(--teal)',boxShadow:'0 0 0 3px rgba(14,124,123,.08)'}}>
            <h2>Chair review</h2>
            <div className="csub">Your approval <b>is</b> the signature. Approving captures your name, the
              date and the time on the record, and activates every Output.</div>
            <div className="btn-row">
              <Btn k="pri" onClick={()=>A.momApprove(rec.id)}>Approve and sign</Btn>
              <Btn k="wrn" onClick={()=>setRet(true)}>Return for changes</Btn>
            </div>
          </div>}

        {rec.status==='Approved' && isChair && canClose && S.momClosure==='manual' &&
          <div className="card" style={{borderColor:'var(--teal)'}}>
            <h2>Close the Minutes</h2>
            <div className="csub">Closure finalises the record and releases the governance score.</div>
            <Btn k="pri" onClick={()=>A.momClose(rec.id)}>Close the Meeting Minutes</Btn>
          </div>}

        <div className="card">
          <h2>Signature</h2>
          <div className="csub">Captured from the Meeting Chair’s approval — there is no separate signing
            step, and a captured signature is never edited or re-attributed.</div>
          {rec.sig
            ? <div className="sig"><span className="sl">Approved and signed by</span>
                {rec.sig.name}<br/>{P(rec.sig.who).position}<br/>
                {fmtD(rec.sig.date)} · {rec.sig.time} · {occ.tz}</div>
            : <div className="readonly">Not yet approved.</div>}
        </div>

        <div className="card">
          <h2>Outputs</h2>
          <div className="csub">Every Output references the Agenda Item that produced it and stays Draft
            until the Minutes are approved.</div>
          {outs.length===0?<Empty>No Outputs recorded.</Empty>:
          <table className="data"><tbody>{outs.map(o=>{
            const ag=occ.agenda.find(a=>a.id===o.ag);
            return <tr key={o.id} className={o.kind!=='TMS Task'?'click':''}
              onClick={o.kind!=='TMS Task'?()=>go('dec',o.id):undefined}>
              <td><div className="t-main">{o.label}</div>
                <div className="t-sub">{o.kind} · from item {ag?ag.seq:'?'}</div></td>
              <td style={{textAlign:'right'}}>{o.draft?<Tag c="amber">Draft</Tag>
                :o.rec.syncFailed?<Tag c="red">Queued for TMS</Tag>:<Tag c="green">Active</Tag>}</td>
            </tr>;})}
          </tbody></table>}
        </div>

        {isCommittee(occ) && <div className="card">
          <h2>Governance Audit Grid</h2>
          <div className="csub">Created when these Minutes are Closed — never before, and it never blocks
            approval.</div>
          {grid
            ? <><Tag c={grid.state==='Approved'?'green':'amber'}>{grid.state}</Tag>
                {grid.state==='Approved' && <div style={{marginTop:7,fontSize:19,fontWeight:700,
                  color:`var(--${pctColour(grid.score)})`}}>{grid.score}%</div>}
                <div className="btn-row" style={{marginTop:10}}>
                  <Btn onClick={()=>openMeeting(occ.id,'grid')}>Open the Audit Grid tab →</Btn></div></>
            : <Note k="info">Not created yet. It is released once the Minutes reach Closed.</Note>}
        </div>}

        <div className="card">
          <h2>Review history</h2>
          <Hist items={rec.history}/>
        </div>
      </div>
    </div>

    {modal==='task' && <TaskModal onClose={()=>setModal(null)}
      onSave={f=>{A.addTask(f,{k:'mom',id:rec.id,ag:agFor});setModal(null);}}/>}
    {modal==='dec' && <DecisionIntakeModal src={{k:'mom',id:rec.id,ag:agFor}}
      onClose={()=>setModal(null)}/>}
    {ret && <ReturnModal title="Return the Meeting Minutes" onClose={()=>setRet(false)}
      onSave={r2=>{A.momReturn(rec.id,r2);setRet(false);}}/>}
    {xport && <ExportModal mom={rec} occ={occ} outs={outs} onClose={()=>setXport(false)}/>}
  </>;
}

function ReturnModal({title,onClose,onSave}){
  const [r,setR]=useState('');
  return <Modal title={title} onClose={onClose}
    sub="A reason is mandatory. All previous review history is retained."
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="wrn" disabled={!r.trim()} onClick={()=>onSave(r)}>Return with this reason</Btn></>}>
    <Field label="Reason for return" req><textarea value={r} onChange={e=>setR(e.target.value)}
      placeholder="What must be corrected before resubmission."/></Field>
  </Modal>;
}

function ExportModal({mom,occ,outs,onClose}){
  const setup=occ.setup?MS(occ.setup):null;
  return <Modal wide title="Meeting Minutes — export preview" onClose={onClose}
    sub="Every extract, export and printed report renders the captured signature block."
    footer={<><Btn onClick={onClose}>Close</Btn>
      <Btn k="pri" onClick={()=>window.print()}>Print</Btn></>}>
    <div style={{border:'1px solid var(--border)',borderRadius:8,padding:'20px 22px',background:'#fff'}}>
      <div style={{borderBottom:'2px solid var(--teal-d)',paddingBottom:10,marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:'.1em',color:'var(--muted)',fontWeight:700}}>ANDALUSIA</div>
        <h2 style={{fontSize:17,marginTop:3}}>{occName(occ)}</h2>
        <div style={{fontSize:12,color:'var(--muted)'}}>Minutes of Meeting · {fmtD(occ.date)} ·
          {' '}{occ.start}–{occ.end} · {occ.mode}{occ.location?' · '+occ.location:''}</div>
      </div>
      <KVBlock items={[
        ['Setup Type', occType(occ)], ['Classification', occCls(occ)],
        ['Meeting Chair', P(occRoles(occ).chair).name],
        ['Business unit', occ.bu],
        setup&&setup.tor?['TOR or Policy reference', setup.tor]:null,
        ['Status', mom.status],
      ]}/>
      <div className="sep"/>
      <h3 style={{fontSize:13,marginBottom:8}}>Attendance</h3>
      <div style={{fontSize:12,marginBottom:14}}>
        {occ.attend.map(x=>P(x.who).name+' — '+(x.delegate?'delegated to '+P(x.delegate).name:
          x.present?'present':'absent')).join(' · ')}</div>
      <h3 style={{fontSize:13,marginBottom:8}}>Agenda Items and outcomes</h3>
      {occ.agenda.map(ag=><div key={ag.id} style={{marginBottom:11}}>
        <div style={{fontWeight:650,fontSize:12.5}}>{ag.seq}. {ag.title}</div>
        <div style={{fontSize:12,color:'var(--ink-2)',marginTop:2}}>{mom.notes[ag.id]||'—'}</div>
        {outs.filter(o=>o.ag===ag.id).map(o=>
          <div key={o.id} style={{fontSize:11.5,color:'var(--muted)',marginTop:2}}>
            → {o.kind}: {o.label}</div>)}
      </div>)}
      <div className="sep"/>
      {mom.sig
        ? <div className="sig"><span className="sl">Signature</span>
            Approved and signed by {mom.sig.name}, {P(mom.sig.who).position}<br/>
            {fmtD(mom.sig.date)} at {mom.sig.time} · {occ.tz}<br/>
            <span style={{fontSize:10.5,color:'var(--muted)'}}>Captured on approval of these Minutes in
              Andalusia Pulse. This signature cannot be edited or re-attributed.</span></div>
        : <Note k="warn">These Minutes are not yet approved, so no signature block exists.</Note>}
    </div>
  </Modal>;
}
/* =========================================================================
   6 · GOVERNANCE AUDIT GRID
   ========================================================================= */
const GRID_STATES=['Auto-Scored','Pending Facilitator Review','Submitted for Approval','Approved'];

function ScreenGrid(){
  const {db,me,openMeeting,S}=use();
  const list=db.grids.filter(g=>{const o=db.occs.find(x=>x.id===g.occ); return o&&canSeeOcc(o,me);});
  const committees=MTG_SETUPS.filter(s=>s.type==='Committee');
  const approved=list.filter(g=>g.state==='Approved');
  const avg=approved.length?Math.round(approved.reduce((s,g)=>s+g.score,0)/approved.length*10)/10:null;

  return <>
    <div className="ph"><h1>Committee Scores</h1>
      <div className="sub">Governance scores across every Committee occurrence you can see. Each occurrence
        keeps its own score, so the same Committee may score differently in different periods. A Business
        Meeting — including a Cross-functional Meeting classified as Team of Teams — is never scored. To
        work on a Grid, open its Meeting and use the Audit Grid tab.</div></div>

    <div className="stats">
      <Stat label="Approved scores" v={approved.length} d="published" c="green"/>
      <Stat label="Average score" v={avg!=null?avg+'%':'—'} d="approved Grids only"
            c={avg!=null?pctColour(avg):'muted'}/>
      <Stat label="Awaiting Facilitator" v={list.filter(g=>g.state==='Pending Facilitator Review'||
            g.state==='Returned for Revision').length} d="questions to score" c="amber"/>
      <Stat label="Awaiting Chair" v={list.filter(g=>g.state==='Submitted for Approval').length}
            d="score unpublished" c="amber"/>
      <Stat label="Questions" v={AG_ACTIVE.length} d={AG_ACTIVE.filter(q=>q.src==='Auto').length+
            ' automatic · '+AG_ACTIVE.filter(q=>q.src==='Manual').length+' manual'}/>
    </div>

    <div className="card flush">
      <div className="card-hd"><h2>Audit Grid Instances</h2>
        <div className="csub">One Instance per Committee occurrence, created on closure of its Minutes.</div></div>
      {list.length===0?<Empty>No Instances in your view.</Empty>:
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Committee</th><th>Occurrence</th><th>Template</th><th>State</th>
          <th>Coverage</th><th>Overall Score</th></tr></thead>
        <tbody>{list.slice().sort((a,b)=>{
            const oa=db.occs.find(x=>x.id===a.occ), ob=db.occs.find(x=>x.id===b.occ);
            return ob.date.localeCompare(oa.date);}).map(g=>{
          const o=db.occs.find(x=>x.id===g.occ);
          const live = !g.frozen ? gridTotals(scoreGrid(g,db,S)) : null;
          const cov = g.frozen ? Math.round(g.coverage/g.total*1000)/10 : live.coverage;
          return <tr key={g.id} className="click" onClick={()=>openMeeting(o.id,'grid')}>
            <td><div className="t-main">{occName(o)}</div><div className="t-sub">{occCls(o)}</div></td>
            <td className="dim">{fmtD(o.date)}</td>
            <td className="dim">{g.tv}{g.version>1&&<div className="t-sub">version {g.version}</div>}</td>
            <td><Tag c={g.state==='Approved'?'green':g.state==='Void'?'grey':'amber'}>{g.state}</Tag></td>
            <td><div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontVariantNumeric:'tabular-nums',minWidth:38}}>{cov}%</span>
                <Bar v={cov} c={pctColour(cov)}/></div>
              <div className="t-sub">{g.frozen?g.coverage:live.applicable} of {g.total} questions</div></td>
            <td>{g.state==='Approved'
                  ? <b style={{fontSize:15,color:`var(--${pctColour(g.score)})`}}>{g.score}%</b>
                  : <span className="dim">Pending Review</span>}</td>
          </tr>;})}
        </tbody></table></div>}
    </div>

    <div className="card">
      <h2>Score history by Committee</h2>
      <div className="csub">Approved Grids only. An approved Grid is never recomputed, so a later change to
        a setting or to the Template cannot rewrite history.</div>
      {committees.map(c=>{
        const gs=list.filter(g=>{const o=db.occs.find(x=>x.id===g.occ); return o.setup===c.id;})
          .sort((a,b)=>{const oa=db.occs.find(x=>x.id===a.occ),ob=db.occs.find(x=>x.id===b.occ);
            return oa.date.localeCompare(ob.date);});
        if(!gs.length) return null;
        return <div key={c.id} style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'baseline',gap:9,marginBottom:2}}>
            <b style={{fontSize:13}}>{c.name}</b>
            <Tag c={c.cls==='Accreditation-required Committee'?'amber':'grey'}>{c.cls}</Tag></div>
          <div className="spark">{gs.map(g=>{
            const o=db.occs.find(x=>x.id===g.occ);
            const pub=g.state==='Approved';
            return <div className="spark-b" key={g.id} title={occName(o)+' · '+fmtD(o.date)}>
              <span className="vl" style={{color:pub?`var(--${pctColour(g.score)})`:'var(--faint)'}}>
                {pub?g.score+'%':'—'}</span>
              <div className={'bx '+(pub?pctColour(g.score):'pend')}
                   style={{height:Math.max(6,(pub?g.score:12)*0.62)+'px'}}/>
              <span className="lb">{fmtDS(o.date)}</span></div>;})}
          </div>
        </div>;})}
    </div>

    <div className="card">
      <h2>The question catalogue</h2>
      <div className="csub">Owned by Taxonomy — {AG_TEMPLATE_VERSION}. Leadership Practice retrieves the
        Template and its questions and never creates or modifies them. Every question is scored zero to
        five, and all weights are one, so question count is the effective weighting.</div>
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Category</th><th>Questions</th><th>Share</th><th>Automatic</th><th>Manual</th></tr></thead>
        <tbody>{AG_CATEGORIES.map(c=>{
          const qs=AG_ACTIVE.filter(q=>q.cat===c);
          return <tr key={c}><td className="t-main">{c}</td>
            <td className="dim">{qs.map(q=>q.id).join(', ')}</td>
            <td className="num">{Math.round(qs.length/AG_ACTIVE.length*100)}%</td>
            <td className="num">{qs.filter(q=>q.src==='Auto').length}</td>
            <td className="num">{qs.filter(q=>q.src==='Manual').length}</td></tr>;})}
          <tr style={{fontWeight:700}}><td>Total</td><td className="dim">{AG_ACTIVE.length} active questions</td>
            <td className="num">100%</td>
            <td className="num">{AG_ACTIVE.filter(q=>q.src==='Auto').length}</td>
            <td className="num">{AG_ACTIVE.filter(q=>q.src==='Manual').length}</td></tr>
        </tbody></table></div>
      <Note k="lock"><b>AG-07 is retired.</b> {AGQ('AG-07').rule} The identifier is kept and not reused, so
        history stays traceable.</Note>
    </div>
  </>;
}

/* Rendered as a tab inside the Meeting Occurrence. */
function GridBody({rec,occ}){
  const {db,me,A,openMeeting,S}=use();
  const mom=db.moms.find(m=>m.occ===occ.id);
  const rows=useMemo(()=>scoreGrid(rec,db,S),[rec,db,S]);
  const t=gridTotals(rows);
  const [ret,setRet]=useState(false);
  const [ver,setVer]=useState(false);
  const isFac = acting(rec.facilitator), isChair = acting(rec.chair);
  const editable = isFac && (rec.state==='Pending Facilitator Review'||rec.state==='Returned for Revision');
  const manualRows = rows.filter(r=>r.q.src==='Manual' && r.state!=='na');
  const blanks = rows.filter(r=>r.state==='blank');
  const missingEv = manualRows.filter(r=>r.state==='manual' && !(rec.evidence||{})[r.id]);
  const canSubmit = blanks.length===0 && missingEv.length===0;

  const display = rec.frozen
    ? {score:rec.score, coverage:Math.round(rec.coverage/rec.total*1000)/10,
       applicable:rec.coverage, total:rec.total}
    : {score:t.score, coverage:t.coverage, applicable:t.applicable, total:t.total};

  return <>
    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12,flexWrap:'wrap'}}>
      <Tag c={rec.state==='Approved'?'green':rec.state==='Void'?'grey':'amber'}>{rec.state}</Tag>
      <Tag>Template {rec.tv}{rec.version>1?' · version '+rec.version:''}</Tag>
      <Tag>Facilitator {P(rec.facilitator).name}</Tag>
      <Tag>Meeting Chair {P(rec.chair).name}</Tag>
      {rec.locked && <Tag c="grey">🔒 Locked</Tag>}
      <div style={{flex:1}}/>
      <Btn k="sm" onClick={()=>openMeeting(occ.id,'minutes')}>Open the Minutes tab</Btn>
    </div>

    <Rail steps={GRID_STATES}
      now={rec.state==='Returned for Revision'?'Pending Facilitator Review':rec.state}
      done={GRID_STATES.slice(0,Math.max(0,GRID_STATES.indexOf(
        rec.state==='Returned for Revision'?'Pending Facilitator Review':rec.state)))}/>

    {rec.state==='Returned for Revision' && <Note k="err"><b>Returned by the Meeting Chair.</b>
      {' '}{rec.returnReason} All prior history is retained.</Note>}
    {rec.locked && <Note k="lock"><b>This Grid is Approved and locked.</b> The score is frozen at the value
      published on approval and is never recomputed — a later change to a governance setting or to the
      Taxonomy Template cannot rewrite it. A correction is recorded as a new Grid version.
      {isChair && <div className="btn-row" style={{marginTop:9}}>
        <Btn k="sm" onClick={()=>setVer(true)}>Open a correction version</Btn></div>}</Note>}

    <div className="card"><ScoreHero {...display} state={rec.state} threshold={S.passThreshold}/></div>

    {t.na>0 && !rec.frozen && <Note k="info"><b>{t.na} of {t.total} questions are Not Applicable</b> and are
      excluded from both the numerator and the denominator. Not Applicable is set only by a system
      applicability rule — no user can set or clear it. This is why Coverage is published beside every
      score.</Note>}

    {editable && blanks.length>0 && <Note k="warn"><b>{blanks.length} question
      {blanks.length>1?'s need':' needs'} a manual score.</b> The system leaves a question blank rather
      than defaulting it. Every manual score also needs an evidence note before the Grid can be submitted.</Note>}

    {AG_CATEGORIES.map(cat=>{
      const qs=rows.filter(r=>r.q.cat===cat);
      const app=qs.filter(r=>r.state==='auto'||r.state==='manual');
      const sub=app.length?Math.round(app.reduce((s,r)=>s+r.score,0)/(app.length*5)*1000)/10:null;
      return <div className="card" key={cat}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:11}}>
          <h2 style={{flex:1}}>{cat}</h2>
          <span style={{fontSize:11.5,color:'var(--muted)'}}>
            {app.length} of {qs.filter(r=>r.state!=='retired').length} applicable</span>
          {sub!=null && <Tag c={pctColour(sub)}>{sub}%</Tag>}
        </div>
        {qs.map(r=><Question key={r.id} r={r} grid={rec} editable={editable}/>)}
      </div>;})}

    <div className="grid2">
      <div className="card">
        <h2>Actions</h2>
        {editable && <>
          <div className="csub">You are the Facilitator. Auto-scored values cannot be changed by anyone —
            you may attach an evidence note to one, but not alter it.</div>
          {!canSubmit && <Note k="warn">
            {blanks.length>0 && <div>{blanks.length} question{blanks.length>1?'s remain':' remains'} blank.</div>}
            {missingEv.length>0 && <div>{missingEv.length} manual score
              {missingEv.length>1?'s have':' has'} no evidence note.</div>}
            Submission is blocked until both are resolved.</Note>}
          <Btn k="pri" disabled={!canSubmit} onClick={()=>A.gridSubmit(rec.id)}>Submit for Chair approval</Btn>
        </>}
        {rec.state==='Submitted for Approval' && isChair && <>
          <div className="csub">You are the Meeting Chair. The score is computed but stays unpublished
            until you approve.</div>
          <div className="btn-row">
            <Btn k="pri" onClick={()=>A.gridApprove(rec.id)}>Approve and publish the score</Btn>
            <Btn k="wrn" onClick={()=>setRet(true)}>Return for revision</Btn></div>
        </>}
        {rec.state==='Submitted for Approval' && !isChair &&
          <Note k="info">Waiting on <b>{P(rec.chair).name}</b> as Meeting Chair. Switch persona in the top
            bar to approve.</Note>}
        {(rec.state==='Pending Facilitator Review'||rec.state==='Returned for Revision') && !isFac &&
          <Note k="info">Waiting on <b>{P(rec.facilitator).name}</b> as Facilitator. Switch persona in the
            top bar to score the remaining questions.</Note>}
        {rec.state==='Approved' && <Note k="ok">Approved on {fmtDT(rec.approvedAt)}. The Overall Score and
          Coverage are published and the Instance is locked.</Note>}

        <div className="sep"/>
        <Note k="warn" ic="▲"><b>No independent line reviews this score.</b> The Facilitator and the
          Meeting Chair both sit inside the Committee being scored. A Governance or Audit Reviewer has read
          access to every approved Grid and the right to re-audit a sample, but the principle is unresolved
          and remains an exposure for Accreditation Committees. <OD id="OD-23"/></Note>
      </div>

      <div className="card">
        <h2>Instance history</h2>
        <Hist items={rec.history}/>
        <div className="sep"/>
        <KVBlock items={[
          ['Template version applied', rec.tv],
          ['Grid version', 'Version '+(rec.version||1)],
          ['Minutes closed', mom&&mom.closedAt?fmtDT(mom.closedAt):'—'],
          ['Facilitator', P(rec.facilitator).name],
          ['Meeting Chair', P(rec.chair).name],
        ]}/>
      </div>
    </div>

    {ret && <ReturnModal title="Return the Audit Grid" onClose={()=>setRet(false)}
      onSave={r2=>{A.gridReturn(rec.id,r2);setRet(false);}}/>}
    {ver && <ReturnModal title="Open a correction version" onClose={()=>setVer(false)}
      onSave={r2=>{A.gridNewVersion(rec.id,r2);setVer(false);}}/>}
  </>;
}

function Question({r,grid,editable}){
  const {A}=use();
  const ev=(grid.evidence||{})[r.id]||'';
  const [open,setOpen]=useState(false);
  const retired=r.state==='retired';
  const na=r.state==='na';
  const blank=r.state==='blank';

  return <div className={'q'+(na?' na':'')+(retired?' retired':'')+(blank?' blank':'')}>
    <div className="q-hd" style={{cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
      <div className="q-id">{r.id}</div>
      <div className="q-txt">
        <div className="t" style={retired?{textDecoration:'line-through',color:'var(--muted)'}:null}>{r.q.q}</div>
        <div className="m">
          {retired?<Tag c="grey">Retired</Tag>
           :na?<Tag c="grey">Not Applicable</Tag>
           :r.state==='auto'?<Tag c="teal">Automatic</Tag>
           :r.state==='manual'?<Tag c="purple">Manually scored</Tag>
           :<Tag c="amber">Awaiting a manual score</Tag>}
          {' '}<span style={{color:'var(--faint)'}}>{open?'▴ hide detail':'▾ show detail'}</span>
        </div>
      </div>
      <div className="q-sc">
        {retired?<div className="o">—</div>
         :na?<div className="o">N/A</div>
         :blank?<div className="v" style={{color:'var(--amber)'}}>—</div>
         :<><div className="v" style={{color:`var(--${scoreColour(r.score)})`}}>{r.score}</div>
            <div className="o">of 5</div></>}
      </div>
    </div>

    {open && <div className="q-bd">
      {retired && <Note k="lock">{r.q.rule}</Note>}
      {na && <><div style={{fontSize:11,letterSpacing:'.07em',textTransform:'uppercase',
        color:'var(--faint)',fontWeight:700,marginBottom:4}}>Why this is Not Applicable</div>
        <div className="ev">{r.na}</div>
        <div style={{fontSize:11.5,color:'var(--muted)',marginTop:6}}>Set by a system applicability rule.
          No user can set or clear a Not Applicable state, and the question is excluded from both the
          numerator and the denominator.</div></>}
      {!na && !retired && <>
        <div style={{fontSize:11,letterSpacing:'.07em',textTransform:'uppercase',color:'var(--faint)',
          fontWeight:700,marginBottom:4}}>Scoring rule</div>
        <div style={{fontSize:12,color:'var(--ink-2)',marginBottom:9}}>{r.q.rule}</div>
        {r.ev && <><div style={{fontSize:11,letterSpacing:'.07em',textTransform:'uppercase',
          color:'var(--faint)',fontWeight:700,marginBottom:4}}>Computed from</div>
          <div className="ev">{r.ev}</div></>}
        {r.q.src==='Auto' && <div style={{fontSize:11.5,color:'var(--muted)',marginTop:7}}>
          🔒 An auto-scored value cannot be changed by any user. An evidence note may still be attached.</div>}

        {r.q.src==='Manual' && <div style={{marginTop:11}}>
          <Field label="Score" req>
            {editable
              ? <div className="sc-pick">{[0,1,2,3,4,5].map(n=>
                  <button key={n} className={r.score===n?'on':''}
                    onClick={()=>A.gridManual(grid.id,r.id,n)}>{n}</button>)}</div>
              : <div className="readonly">{r.score==null?'Not scored':r.score+' of 5'}</div>}
          </Field>
          <Field label="Evidence note" req
            err={editable && r.state==='manual' && !ev.trim() ? 'A manually scored question must carry an evidence note before the Grid can be submitted.' : null}>
            {editable
              ? <textarea value={ev} onChange={e=>A.gridEvidence(grid.id,r.id,e.target.value)}
                  placeholder="What you compared, and what you concluded."/>
              : <div className="readonly" style={{minHeight:34}}>{ev||'—'}</div>}
          </Field>
        </div>}

        {r.q.src==='Auto' && editable && <div style={{marginTop:9}}>
          <Field label="Evidence note (optional)">
            <textarea value={ev} onChange={e=>A.gridEvidence(grid.id,r.id,e.target.value)}
              placeholder="Optional context. The computed score is unaffected."/></Field>
        </div>}
        {r.q.src==='Auto' && !editable && ev && <div style={{marginTop:9}}>
          <div style={{fontSize:11,letterSpacing:'.07em',textTransform:'uppercase',color:'var(--faint)',
            fontWeight:700,marginBottom:4}}>Facilitator note</div>
          <div style={{fontSize:12}}>{ev}</div></div>}
      </>}
    </div>}
  </div>;
}
/* =========================================================================
   7 · DECISIONS
   ========================================================================= */
const decTagC = s => s==='Closed'?'grey':s==='Approved'?'green':s==='In Approval'?'teal':
                     s==='Returned'||s==='Rejected'?'red':'amber';

/* A Decision is "taken" once it exists as an approved Decision by either pathway. */
const isTaken = d => !d.draft && !d.blocked && (d.status==='Approved'||d.status==='Closed');
function srcLabel(db,d){
  if(!d.src) return 'Logged directly';
  if(d.src.k==='rpt'){ const r=db.reports.find(x=>x.id===d.src.id);
    return r ? (r.setup?RS(r.setup).name:r.custom.name) : 'A Report'; }
  const m=db.moms.find(x=>x.id===d.src.id), o=m&&db.occs.find(x=>x.id===m.occ);
  return o ? occName(o) : 'A Meeting';
}

function ScreenDecisions(){
  const {db,me,sel,setSel,go,A}=use();
  const [intake,setIntake]=useState(false);
  const [fSt,setFSt]=useState('All'), [fPa,setFPa]=useState('All');
  const [fSr,setFSr]=useState('All'), [fNa,setFNa]=useState('All'), [q,setQ]=useState('');
  const id=sel.dec;
  const list=db.decisions.filter(d=>canSeeDec(d,me));
  const rec=list.find(d=>d.id===id);
  if(rec) return <DecisionDetail rec={rec} back={()=>setSel(v=>({...v,dec:null}))}/>;

  const blocked=list.filter(d=>d.blocked);
  const taken=list.filter(isTaken);
  const pending=list.filter(d=>!isTaken(d) && !d.blocked &&
                              d.status!=='Rejected' && d.status!=='Closed');
  const rows=list.filter(d=>{
    if(fSt==='Taken'         && !isTaken(d)) return false;
    if(fSt==='Not yet taken' && !pending.includes(d)) return false;
    if(fSt==='Blocked'       && !d.blocked) return false;
    if(fSt==='Rejected'      && d.status!=='Rejected') return false;
    if(fSt==='Closed'        && d.status!=='Closed') return false;
    if(fPa==='Direct Decision'  && d.path!=='Direct') return false;
    if(fPa==='Decision Request' && d.path!=='Request') return false;
    if(fSr==='Logged directly' && d.src) return false;
    if(fSr==='A Meeting' && !(d.src&&d.src.k==='mom')) return false;
    if(fSr==='A Report'  && !(d.src&&d.src.k==='rpt')) return false;
    if(fNa!=='All' && d.topicNature!==fNa) return false;
    if(q && !(d.title+d.type+srcLabel(db,d)).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Decisions</h1>
        <div className="sub">The register of every Decision and Decision Request, whatever raised it —
          a Report review, a Meeting Agenda Item, or logged directly here. You log the matter once; the
          Authority Matrix decides the pathway and you never choose it.</div></div>
      <Btn k="pri" onClick={()=>setIntake(true)}>+ Log a Decision</Btn>
    </div>

    <div className="stats">
      <Stat label="Taken" v={taken.length} d="Direct or approved" c={taken.length?'green':'muted'}/>
      <Stat label="Not yet taken" v={pending.length} d="in Draft or approval"
            c={pending.length?'amber':'muted'}/>
      <Stat label="Blocked" v={blocked.length} d="no Authority Matrix mapping"
            c={blocked.length?'red':'muted'}/>
      <Stat label="Rejected" v={list.filter(d=>d.status==='Rejected').length} d="decided against"/>
      <Stat label="Closed" v={list.filter(d=>d.status==='Closed').length} d="outcome recorded"/>
    </div>

    {blocked.length>0 && <Note k="err"><b>{blocked.length} Decision
      {blocked.length>1?'s are':' is'} held in Draft because the Authority Matrix holds no matching
      mapping.</b> No temporary or substitute route is created and no override is offered. The Authority
      Matrix Owner must create the mapping, after which the system rechecks automatically.
      <div className="btn-row" style={{marginTop:9}}>
        <Btn k="sm" onClick={A.patchMatrix}>Simulate: the Authority Matrix Owner creates the mapping</Btn>
      </div></Note>}

    <div className="fltr">
      <label>Status</label>
      <select value={fSt} onChange={e=>setFSt(e.target.value)}>
        <option>All</option><option>Taken</option><option>Not yet taken</option>
        <option>Blocked</option><option>Rejected</option><option>Closed</option></select>
      <label>Pathway</label>
      <select value={fPa} onChange={e=>setFPa(e.target.value)}>
        <option>All</option><option>Direct Decision</option><option>Decision Request</option></select>
      <label>Raised from</label>
      <select value={fSr} onChange={e=>setFSr(e.target.value)}>
        <option>All</option><option>Logged directly</option><option>A Meeting</option><option>A Report</option></select>
      <label>Nature</label>
      <select value={fNa} onChange={e=>setFNa(e.target.value)}>
        <option>All</option>{TOPIC_NATURES.map(t=><option key={t}>{t}</option>)}</select>
      <input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:170}}/>
      {(fSt!=='All'||fPa!=='All'||fSr!=='All'||fNa!=='All'||q) &&
        <Btn k="sm" onClick={()=>{setFSt('All');setFPa('All');setFSr('All');setFNa('All');setQ('');}}>
          Clear</Btn>}
    </div>

    <div className="card flush">
      <div className="card-hd"><h2>Decision register</h2>
        <div className="csub">{rows.length} of {list.length} record{list.length===1?'':'s'}. Both pathways
          merge at the approved Decision.</div></div>
      {rows.length===0 ? <Empty>No Decision matches these filters.</Empty> :
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Decision</th><th>Type</th><th>Topic</th><th>Raised from</th><th>Pathway</th>
          <th>Where it stands</th><th>Taken?</th></tr></thead>
        <tbody>{rows.map(d=>{
          const step=d.steps&&d.steps.find(s=>s.state==='Pending');
          return <tr key={d.id} className="click" onClick={()=>go('dec',d.id)}>
            <td><div className="t-main">{d.title}</div>
              <div className="t-sub">{P(d.creator).name} · {fmtD(d.created)}</div></td>
            <td className="dim">{d.type}{d.value?<div className="t-sub">{money(d.value)}</div>:null}</td>
            <td>{d.topicNature && <Tag c="amber">{d.topicNature}</Tag>}
              <div className="t-sub">{(d.topicCats||[]).map(c=>c.v).join(', ')}</div></td>
            <td className="dim">{srcLabel(db,d)}</td>
            <td>{d.blocked?<Tag c="red">Blocked</Tag>
                :d.path==='Direct'?<Tag c="green">Direct Decision</Tag>
                :<Tag c="teal">Decision Request</Tag>}</td>
            <td className="dim">{d.draft?'Draft Output of Minutes — activates on approval'
              :step?step.pos+' — '+P(step.who).name
              :d.status==='Approved'?'Execution Owner '+(d.execOwner?P(d.execOwner).name:'not assigned')
              :d.status==='Closed'?'Closed':'—'}</td>
            <td>{isTaken(d)
                  ? <Tag c="green">✓ Taken</Tag>
                  : d.status==='Rejected' ? <Tag c="red">Decided against</Tag>
                  : d.blocked ? <Tag c="red">Blocked</Tag>
                  : <Tag c="amber">Not yet</Tag>}
              <div className="t-sub">{d.status}</div></td>
          </tr>;})}
        </tbody></table></div>}
    </div>

    {intake && <DecisionIntakeModal onClose={()=>setIntake(false)}/>}
  </>;
}

function DecisionIntakeModal({src,onClose}){
  const {A,me,db,go}=use();
  const [f,setF]=useState({title:'',type:'Quality Improvement Action',value:null,
    topicNature:'Issue',topicCats:[],topicOther:'',impact:[],need:'',context:'',rationale:''});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const chk=useMemo(()=>authorityCheck(f.type,f.value,me,db.matrixPatched),[f.type,f.value,me,db.matrixPatched]);
  const needsValue = f.type==='Capital Expenditure';
  const otherPicked = f.topicCats.some(c=>c.v==='Other');
  const dupes = db.decisions.filter(d=>d.type===f.type && f.title.length>6 &&
    d.title.toLowerCase().split(' ').some(w=>w.length>5 && f.title.toLowerCase().includes(w)));
  const ok = f.title.trim() && f.topicNature && f.topicCats.length && f.impact.length &&
             (!otherPicked || f.topicOther.trim()) && (!needsValue || f.value>0);

  const toggleCat=(v)=>set('topicCats', f.topicCats.some(c=>c.v===v)
    ? f.topicCats.filter(c=>c.v!==v) : [...f.topicCats,{v,sub:null}]);

  return <Modal wide title={src?(src.k==='mom'?'Log a Decision from this Agenda Item':'Log a Decision from this Report'):'Log a Decision'}
    sub="One common intake. The Authority Matrix decides whether this becomes a Direct Decision or a Decision Request."
    onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!ok} onClick={()=>{
        A.createDecision(f,src);
        onClose();}}>
        {chk.result==='No mapping found'?'Create — submission will be blocked':'Create the Decision intake'}</Btn></>}>

    <Field label="Decision" req><input type="text" value={f.title}
      onChange={e=>set('title',e.target.value)} placeholder="What is being decided."/></Field>

    <div className="f-row">
      <Field label="Decision Type" req><select value={f.type} onChange={e=>set('type',e.target.value)}>
        {DECISION_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Value" hint={needsValue?'The threshold changes the required authority.':'Not applicable to this Decision Type.'}>
        <input type="number" value={f.value||''} disabled={!needsValue}
          onChange={e=>set('value',e.target.value?+e.target.value:null)} placeholder="SAR"/></Field>
    </div>

    <div className={'note '+(chk.result==='No mapping found'?'err':
      chk.result==='Authority confirmed'?'ok':'info')}>
      <span className="ic">{chk.result==='No mapping found'?'✕':chk.result==='Authority confirmed'?'✓':'i'}</span>
      <div>
        <b>Authority Matrix — {chk.result}</b>
        {chk.result==='No mapping found'
          ? <div>No configuration matches these criteria. The record will be held in Draft and submission
              blocked. No temporary or substitute route is created and no override is offered — the
              Authority Matrix Owner must create the mapping.</div>
          : <div>Matched on <b>{chk.matched}</b>, which requires <b>{AUTH_LEVELS[chk.reqLvl]}</b>.
              You are <b>{AUTH_LEVELS[P(me).lvl]}</b>.{' '}
              {chk.result==='Authority confirmed'
                ? 'This will be recorded as a Direct Decision with a mandatory rationale and no further approval cycle. Your manager and Internal Audit are added as Observers.'
                : <>This becomes a Decision Request following Approval Cycle <b>{chk.cycle} — {APPROVAL_CYCLES[chk.cycle].name}</b>:{' '}
                    {APPROVAL_CYCLES[chk.cycle].steps.map(s=>s.pos).join(' → ')}.</>}</div>}
      </div>
    </div>

    <div className="f-row">
      <Field label="Topic Nature" req hint="A classification on this Decision — not a separate record.">
        <Pills val={f.topicNature} onChange={v=>set('topicNature',v||'Issue')} opts={TOPIC_NATURES}/></Field>
      <Field label="Impact Areas" req hint="Records where the Decision has an effect. Never used to determine authority, priority or threshold.">
        <Pills multi val={f.impact} onChange={v=>set('impact',v)} opts={IMPACT_AREAS}/></Field>
    </div>

    <Field label="Topic Category" req hint="At least one is required.">
      <div className="pill-set">{TOPIC_CATEGORIES.map(c=>
        <button type="button" key={c.v} onClick={()=>toggleCat(c.v)}
          className={'pill'+(f.topicCats.some(x=>x.v===c.v)?' on':'')}>
          {c.v}{c.note?' ⚠':''}</button>)}</div>
    </Field>
    {f.topicCats.filter(c=>{const d=TOPIC_CATEGORIES.find(x=>x.v===c.v); return d&&d.subs.length;}).map(c=>
      <Field key={c.v} label={c.v+' — sub-category'}>
        <Pills val={c.sub} opts={TOPIC_CATEGORIES.find(x=>x.v===c.v).subs}
          onChange={v=>set('topicCats',f.topicCats.map(x=>x.v===c.v?{...x,sub:v}:x))}/></Field>)}
    {otherPicked && <Field label="Other — free text" req>
      <input type="text" value={f.topicOther} onChange={e=>set('topicOther',e.target.value)}
        placeholder="Describe the category."/></Field>}

    {chk.result==='Authority not held' && <>
      <Field label="Issue or Decision Need" hint="Held inside the Decision Request — never created as a separate record.">
        <textarea value={f.need} onChange={e=>set('need',e.target.value)}/></Field>
      <Field label="Context"><textarea value={f.context}
        onChange={e=>set('context',e.target.value)}/></Field>
    </>}
    {chk.result==='Authority confirmed' && <Field label="Rationale" req={!src}
      hint="Mandatory on a Direct Decision.">
      <textarea value={f.rationale} onChange={e=>set('rationale',e.target.value)}/></Field>}

    {dupes.length>0 && <Note k="warn"><b>{dupes.length} possibly related Decision
      {dupes.length>1?'s':''}.</b> {dupes.map(d=>d.title).join(' · ')}. Surfaced as a warning, never as a
      block.</Note>}
  </Modal>;
}

function DecisionDetail({rec,back}){
  const {db,me,A,go}=use();
  const [act,setAct]=useState(null);
  const [note,setNote]=useState('');
  const [rationale,setRationale]=useState(rec.rationale||'');
  const [owner,setOwner]=useState(rec.execOwner||me);
  const [outKind,setOutKind]=useState('TMS Task');
  const [outLabel,setOutLabel]=useState('');
  const [outcome,setOutcome]=useState('');
  const step=rec.steps&&rec.steps.find(s=>s.state==='Pending');
  const isStepOwner = !!step && acting(step.who);
  const isCreator = acting(rec.creator);
  const isObserver = (rec.observers||[]).some(o=>o.who===me);
  const isExec = acting(rec.execOwner);
  const srcMom = rec.src && db.moms.find(m=>m.id===rec.src.id);
  const srcOcc = srcMom && db.occs.find(o=>o.id===srcMom.occ);

  return <>
    <div className="crumb"><a onClick={back}>Decisions</a> › <b>{rec.title}</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{rec.title}</h1>
        <div className="sub">{rec.type}{rec.value?' · '+money(rec.value):''} · raised by
          {' '}{P(rec.creator).name} on {fmtD(rec.created)}</div>
        <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
          <Tag c={decTagC(rec.status)}>{rec.status}</Tag>
          {rec.blocked?<Tag c="red">Submission blocked</Tag>
            :rec.path==='Direct'?<Tag c="green">Direct Decision</Tag>:<Tag c="teal">Decision Request</Tag>}
          {rec.topicNature && <Tag c="amber">{rec.topicNature}</Tag>}
          {(rec.topicCats||[]).map((c,i)=><Tag key={i}>{c.v}{c.sub?' · '+c.sub:''}</Tag>)}
          {rec.draft && <Tag c="amber">Draft Output of Minutes</Tag>}
          {rec.status==='Approved'||rec.status==='Closed' ? <Tag c="grey">🔒 Locked</Tag> : null}
        </div></div>
      <Btn onClick={back}>← Back</Btn>
    </div>

    {rec.blocked && <Note k="err"><b>Submission is blocked — the Authority Matrix holds no mapping for these
      criteria.</b> The record stays in Draft. No temporary or substitute route is created and no override
      is available. Contact the Authority Matrix Owner. The system rechecks automatically once the mapping
      exists.
      {(P(me).fam==='approver'||P(me).scope==='all') &&
        <div className="btn-row" style={{marginTop:9}}>
          <Btn k="sm" onClick={A.patchMatrix}>Simulate: the Authority Matrix Owner creates the mapping</Btn>
        </div>}</Note>}
    {rec.draft && <Note k="warn"><b>This is a Draft Output of Meeting Minutes.</b> It activates only when
      the Meeting Chair approves the Minutes — no follow-up runs on unapproved minutes.
      {srcOcc && <> <a onClick={()=>go('mom',srcMom.id)}>Open the Minutes for {occName(srcOcc)}</a>.</>}</Note>}
    {isObserver && <Note k="lock"><b>You are an Observer on this Decision.</b> An Observer is Informed and
      never Accountable, and can never approve.</Note>}

    {rec.path==='Request' && rec.steps.length>0 &&
      <Rail steps={rec.steps.map(s=>s.pos)}
        now={step?step.pos:null}
        done={rec.steps.filter(s=>s.state==='Approved').map(s=>s.pos)}/>}

    <div className="grid2">
      <div>
        <div className="card">
          <h2>Decision record</h2>
          <KVBlock items={[
            ['Decision Type', rec.type],
            rec.value?['Value', money(rec.value)]:null,
            ['Topic Nature', rec.topicNature||'—'],
            ['Topic Category', (rec.topicCats||[]).map(c=>c.v+(c.sub?' · '+c.sub:'')).join(', ')||'—'],
            rec.topicOther?['Other — free text', rec.topicOther]:null,
            ['Impact Areas', (rec.impact||[]).join(', ')||'—'],
            ['Confidentiality', rec.confidentiality+' — applied from the Taxonomy classification'],
            ['Business unit / Department', rec.bu+' · '+rec.dept],
            rec.src?['Source','Meeting Minutes'+(srcOcc?' — '+occName(srcOcc):'')]:null,
          ]}/>
          {rec.need && <><div className="sep"/>
            <div className="kv-i"><label>Issue or Decision Need</label><div>{rec.need}</div></div>
            <div style={{fontSize:11.5,color:'var(--muted)',marginTop:5}}>Held inside the Decision Request.
              There is no separate Issue record and no separate Issue lifecycle.</div></>}
          {rec.context && <div className="kv-i" style={{marginTop:11}}>
            <label>Context</label><div>{rec.context}</div></div>}
          {rec.rationale && <div className="kv-i" style={{marginTop:11}}>
            <label>Rationale</label><div>{rec.rationale}</div></div>}
        </div>

        <div className="card">
          <h2>Authority check</h2>
          <div className="csub">Sent to the Authority Matrix at submission and whenever authority-related
            information changes. The result is retained on the record.</div>
          <KVBlock items={[
            ['Result', rec.auth.result],
            ['Matched criteria', rec.auth.matched||'No match'],
            ['Required authority', rec.auth.reqLvl!=null?AUTH_LEVELS[rec.auth.reqLvl]:'—'],
            ['Creator authority', AUTH_LEVELS[P(rec.creator).lvl]],
            ['Approval Cycle', rec.auth.cycle?rec.auth.cycle+' — '+APPROVAL_CYCLES[rec.auth.cycle].name
              :'None — the Creator holds the required authority'],
          ]}/>
        </div>

        {rec.path==='Request' && <div className="card">
          <h2>Approval Cycle</h2>
          <div className="csub">Returned by the Authority Matrix and followed without modification. No user
            can create or edit an Approval Cycle, and a Requester can never approve their own Request.</div>
          <table className="data">
            <thead><tr><th>#</th><th>Step</th><th>State</th><th>Recorded</th></tr></thead>
            <tbody>{rec.steps.map((s,i)=>
              <tr key={i} className={s.state==='Pending'?'on':''}>
                <td className="dim">{i+1}</td>
                <td><div className="t-main">{s.pos}</div><div className="t-sub">{P(s.who).name}</div></td>
                <td><Tag c={s.state==='Approved'?'green':s.state==='Pending'?'amber':
                  s.state==='Returned'||s.state==='Rejected'?'red':'grey'}>{s.state}</Tag></td>
                <td className="dim">{s.at?fmtDT(s.at):'—'}{s.note&&<div className="t-sub">“{s.note}”</div>}</td>
              </tr>)}
            </tbody></table>

          {isStepOwner && !rec.draft && <>
            <div className="sep"/>
            {acting(rec.creator)
              ? <Note k="err">You raised this Decision Request, so you cannot approve it.</Note>
              : <>
                <Field label="Note" hint="Mandatory when rejecting or requesting more information.">
                  <textarea value={note} onChange={e=>setNote(e.target.value)}/></Field>
                <div className="btn-row">
                  <Btn k="pri" onClick={()=>{A.stepAction(rec.id,'approve',note);setNote('');}}>
                    Approve this step</Btn>
                  <Btn k="wrn" disabled={!note.trim()}
                    onClick={()=>{A.stepAction(rec.id,'rmi',note);setNote('');}}>Request more information</Btn>
                  <Btn k="dgr" disabled={!note.trim()}
                    onClick={()=>{A.stepAction(rec.id,'reject',note);setNote('');}}>Reject</Btn>
                </div></>}
          </>}
          {rec.status==='Returned' && isCreator &&
            <div className="btn-row" style={{marginTop:12}}>
              <Btn k="pri" onClick={()=>A.resubmitDecision(rec.id)}>Resubmit with the requested information</Btn>
            </div>}
          {rec.status==='Draft' && !rec.blocked && !rec.draft && isCreator &&
            <div className="btn-row" style={{marginTop:12}}>
              <Btn k="pri" onClick={()=>A.submitDecision(rec.id)}>Submit for approval</Btn></div>}
        </div>}

        {rec.path==='Direct' && rec.status==='Draft' && !rec.draft && isCreator && <div className="card">
          <h2>Record the Direct Decision</h2>
          <div className="csub">The Authority Matrix confirms your authority, so no further approval cycle
            applies. A rationale is mandatory.</div>
          <Field label="Rationale" req><textarea value={rationale}
            onChange={e=>setRationale(e.target.value)}/></Field>
          <Field label="Decision Execution Owner" req><select value={owner}
            onChange={e=>setOwner(e.target.value)}>
            {PEOPLE.map(p=><option key={p.id} value={p.id}>{p.name} — {p.position}</option>)}</select></Field>
          <Btn k="pri" disabled={!rationale.trim()}
            onClick={()=>A.recordDirect(rec.id,rationale,owner)}>Record the Direct Decision</Btn>
        </div>}

        {(rec.status==='Approved'||rec.status==='Closed') && <div className="card">
          <h2>Execution and monitoring</h2>
          <div className="csub">An approved Decision is locked. It produces Outputs, is monitored, and is
            then closed or continued through a follow-up Decision Request.</div>
          <KVBlock items={[
            ['Decision Execution Owner', rec.execOwner?P(rec.execOwner).name:'Not assigned'],
            ['Outcome', rec.outcome||'Not yet recorded'],
          ]}/>
          {rec.outputs.length>0 && <table className="data" style={{marginTop:11}}>
            <thead><tr><th>Output</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>{rec.outputs.map((o,i)=>
              <tr key={i}><td className="t-main">{o.label}</td><td className="dim">{o.k}</td>
                <td><Tag c={o.status==='Closed'?'green':'teal'}>{o.status}</Tag></td></tr>)}
            </tbody></table>}
          {rec.status==='Approved' && isExec && <>
            <div className="sep"/>
            <div className="f-row">
              <Field label="Add a Decision Output"><select value={outKind}
                onChange={e=>setOutKind(e.target.value)}>
                {['TMS Task','Strategy Change','Project Change'].map(k=><option key={k}>{k}</option>)}</select></Field>
              <Field label="Description"><input type="text" value={outLabel}
                onChange={e=>setOutLabel(e.target.value)}/></Field>
            </div>
            <div className="btn-row">
              <Btn disabled={!outLabel.trim()} onClick={()=>{A.addDecOutput(rec.id,outKind,outLabel);
                setOutLabel('');}}>Create the Output</Btn></div>
            <div className="sep"/>
            <Field label="Outcome" hint="Required to close the Decision.">
              <textarea value={outcome} onChange={e=>setOutcome(e.target.value)}/></Field>
            <div className="btn-row">
              <Btn k="pri" disabled={!outcome.trim()||!rec.outputs.length}
                onClick={()=>A.closeDecision(rec.id,outcome)}>Close the Decision</Btn>
              <Btn onClick={()=>A.followUp(rec.id)}>Raise a follow-up Decision Request</Btn></div>
          </>}
          {rec.status==='Approved' && !isExec && rec.execOwner &&
            <Note k="info">Execution sits with <b>{P(rec.execOwner).name}</b>. Switch persona in the top bar
              to execute and close.</Note>}
        </div>}
      </div>

      <div>
        {rec.proposals && rec.proposals.length>0 && <div className="card">
          <h2>Proposals</h2>
          <div className="csub">A Proposal is not an approved Decision.</div>
          {rec.proposals.map(p=><div key={p.id} style={{borderLeft:'2.5px solid var(--teal-l)',
            paddingLeft:12,marginBottom:12}}>
            <div style={{fontWeight:600,fontSize:12.5}}>{p.text}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>{p.effect}</div>
            <div style={{marginTop:5}}><Tag c={p.status==='Recommended'?'green':'grey'}>{p.status}</Tag>
              {' '}<span style={{fontSize:11.5,color:'var(--muted)'}}>{P(p.owner).name}</span></div>
          </div>)}
        </div>}

        {rec.evidence && rec.evidence.length>0 && <div className="card">
          <h2>Evidence</h2>
          {rec.evidence.map((e,i)=><div key={i} style={{fontSize:12.5,marginBottom:6}}>
            <span className="mono" style={{fontSize:11.5}}>{e.name}</span>
            {e.exception && <> <Tag c="amber">Approved Evidence Exception</Tag></>}</div>)}
        </div>}

        <div className="card">
          <h2>Observers</h2>
          <div className="csub">A Manager Observer is required on every Direct Decision, and Internal Audit
            observes all Decisions. An Observer never approves.</div>
          {(rec.observers||[]).length===0?<Empty>None recorded.</Empty>:
          <table className="data"><tbody>{rec.observers.map((o,i)=>
            <tr key={i}><td><div className="t-main">{P(o.who).name}</div>
              <div className="t-sub">{P(o.who).position}</div></td>
              <td style={{textAlign:'right'}}><Tag c="grey">{o.kind}</Tag>
                <div className="t-sub">Informed — cannot approve</div></td></tr>)}
          </tbody></table>}
        </div>

        <div className="card">
          <h2>Audit history</h2>
          <Hist items={rec.history}/>
        </div>
      </div>
    </div>
  </>;
}
/* =========================================================================
   8 · GOVERNANCE SETTINGS
   ========================================================================= */
function ScreenSettings(){
  const {db,S,A,go,me}=use();
  const live=db.grids.filter(g=>!g.frozen);
  const frozen=db.grids.filter(g=>g.frozen);

  const NUM=[
    {k:'momWriteupHours',  unit:'hours', opts:[24,48,72], scores:'AG-16',
     help:'Hours from the end of the Meeting until the Minutes are submitted. Accountable: the Facilitator.'},
    {k:'momApprovalHours', unit:'hours', opts:[24,48,72], scores:'AG-05',
     help:'Hours from submission until the Meeting Chair approves. Accountable: the Meeting Chair.'},
    {k:'agendaLeadDays',   unit:'days',  opts:[1,2,3],    scores:'AG-03',
     help:'Days before the Meeting by which the Agenda must be distributed.'},
    {k:'inviteLeadDays',   unit:'days',  opts:[1,2,3],    scores:'AG-15',
     help:'Days before the Meeting by which the invitation must be sent.'},
    {k:'passThreshold',    unit:'%',     opts:[80,85,90],
     help:'Score at or above which an occurrence passes.'},
  ];
  const CHOICE=[
    {k:'delegatedAttend', opts:[['exclude','Exclude from the rate'],['half','Count at half weight'],
                               ['present','Count as present']]},
    {k:'momClosure',      opts:[['auto','Automatic on approval and Output activation'],
                                ['manual','An explicit act by the Meeting Chair']]},
    {k:'inputReadiness',  opts:[['submitted','Submitted is sufficient'],['approved','Must be Approved']]},
  ];

  return <>
    <div className="ph"><h1>Governance Settings</h1>
      <div className="sub">Five values the business requirements deliberately refuse to approve, plus three
        behaviours still under decision. Each is switched off or set to its stated default rather than
        guessed. Change one and the effect on every Grid that is not yet approved is immediate — an
        approved Grid is never recomputed.</div></div>

    <Note k="warn"><b>Nothing on this screen is an approved value.</b> Each carries the open item that owns
      it. Setting a value here shows the sponsor what the behaviour would look like; it does not close the
      decision.</Note>

    <div className="card flush">
      <div className="card-hd"><h2>Values awaiting a business decision</h2>
        <div className="csub">Unset means the behaviour that depends on the value is switched off, not
          approximated.</div></div>
      <div className="t-wrap"><table className="data">
        <thead><tr><th style={{width:'22%'}}>Setting</th><th style={{width:'30%'}}>Open question</th>
          <th style={{width:'26%'}}>Effect</th><th>Value</th></tr></thead>
        <tbody>
        {NUM.map(({k,unit,opts,help,scores})=>{const n=OD_NOTES[k];return (
          <tr key={k}>
            <td><div className="t-main">{n.label}{scores && <> <Tag c="purple">{scores}</Tag></>}</div>
              <div className="t-sub">{help}</div>
              <div style={{marginTop:4}}><OD id={n.od} closed={n.closed}/>{' '}
                <span className="t-sub">Owner {n.owner}</span></div></td>
            <td className="dim">{n.q}</td>
            <td className="dim">{n.effect}</td>
            <td>
              <div className="btn-row">
                <Btn k={'sm'+(S[k]==null?' pri':'')} onClick={()=>A.setSetting(k,null)}>Not set</Btn>
                {opts.map(o=><Btn key={o} k={'sm'+(S[k]===o?' pri':'')}
                  onClick={()=>A.setSetting(k,o)}>{o}{unit==='%'?'%':''}</Btn>)}
              </div>
              <div style={{marginTop:5}}>{S[k]==null
                ? <Tag c="tbd">Not set — behaviour switched off</Tag>
                : <Tag c="green">{S[k]} {unit}</Tag>}</div>
            </td>
          </tr>);})}
        {CHOICE.map(({k,opts})=>{const n=OD_NOTES[k];return (
          <tr key={k}>
            <td><div className="t-main">{n.label}</div>
              <div style={{marginTop:4}}><OD id={n.od}/> <span className="t-sub">Owner {n.owner}</span></div></td>
            <td className="dim">{n.q}</td>
            <td className="dim">{n.effect}</td>
            <td>
              <div className="btn-row">{opts.map(([v,l])=>
                <Btn key={v} k={'sm'+(S[k]===v?' pri':'')} onClick={()=>A.setSetting(k,v)}>{l}</Btn>)}</div>
              <div style={{marginTop:5}}><Tag c="teal">
                {opts.find(o=>o[0]===S[k])[1]}</Tag> <span style={{fontSize:11,color:'var(--muted)'}}>
                recommendation, not a decision</span></div>
            </td>
          </tr>);})}
        </tbody></table></div>
    </div>

    <div className="card">
      <h2>Effect on Grids that are not yet approved</h2>
      <div className="csub">Recomputed live from the settings above.</div>
      {live.length===0?<Empty>No open Grids.</Empty>:
      <table className="data">
        <thead><tr><th>Committee occurrence</th><th>State</th><th>Applicable</th><th>Not Applicable</th>
          <th>Coverage</th><th>Score if approved now</th></tr></thead>
        <tbody>{live.map(g=>{
          const o=db.occs.find(x=>x.id===g.occ);
          const rows=scoreGrid(g,db,S), t=gridTotals(rows);
          return <tr key={g.id} className="click" onClick={()=>go('grid',g.id)}>
            <td><div className="t-main">{occName(o)}</div><div className="t-sub">{fmtD(o.date)}</div></td>
            <td><Tag c="amber">{g.state}</Tag></td>
            <td className="num">{t.applicable} of {t.total}</td>
            <td className="num">{t.na}</td>
            <td><div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{minWidth:38}}>{t.coverage}%</span><Bar v={t.coverage} c={pctColour(t.coverage)}/></div></td>
            <td>{t.blanks>0?<Tag c="amber">{t.blanks} still blank</Tag>
              :<b style={{color:`var(--${pctColour(t.score)})`}}>{t.score}%</b>}</td>
          </tr>;})}
        </tbody></table>}
      {frozen.length>0 && <Note k="lock"><b>{frozen.length} approved Grid
        {frozen.length>1?'s are':' is'} unaffected.</b> An approved Grid keeps the score published at
        approval and the Template version applied at creation. Changing a setting here can never rewrite
        history.</Note>}
    </div>

    <div className="grid2">
      <div className="card">
        <h2>Owned by Taxonomy — read-only here</h2>
        <div className="csub">Leadership Practice retrieves this configuration and never creates or
          modifies it.</div>
        <table className="data"><tbody>
          {[['Audit Grid Template', AG_TEMPLATE_VERSION+' · Active · applies to Setup Type Committee'],
            ['Audit Grid questions', AG_ACTIVE.length+' active, '+
              AG_ACTIVE.filter(q=>q.src==='Auto').length+' automatic and '+
              AG_ACTIVE.filter(q=>q.src==='Manual').length+' manual · AG-07 retired'],
            ['Question weights', 'All weights are 1, so question count is the effective weighting'],
            ['Topic Nature option set', TOPIC_NATURES.join(' · ')],
            ['Topic Category option set', TOPIC_CATEGORIES.length+' values including a mandatory free text on Other'],
            ['Confidentiality classifications', 'Applied to the execution record from the Taxonomy policy reference'],
            ['Controlled Meeting and Committee names', MTG_SETUPS.length+' Setups retrieved at runtime'],
          ].map(([k,v],i)=><tr key={i}><td className="t-main" style={{width:'42%'}}>{k}</td>
            <td className="dim">{v}</td></tr>)}
        </tbody></table>
        <Note k="warn">Audit Grid weight calibration is unresolved <OD id="OD-21"/>. Until weights are
          deliberately calibrated or flat weighting is formally accepted, question count is the weighting
          by default rather than by decision.</Note>
      </div>

      <div className="card">
        <h2>Working calendar</h2>
        <div className="csub">A Meeting Occurrence falling on a non-working day is rescheduled for that
          occurrence only — the series never moves.</div>
        <KVBlock items={[
          ['Working week','Sunday to Thursday'],
          ['Weekend','Friday and Saturday'],
          ['Configured holidays', HOLIDAYS.map(fmtD).join(' · ')],
          ['Time zone','Arabia Standard Time'],
        ]}/>
        <Note k="warn">One reference calendar per Region and business unit is still to be published
          <OD id="OD-30"/>. The values above stand in for it.</Note>
      </div>
    </div>

    <div className="card">
      <h2>Decisions already closed by the latest stakeholder review</h2>
      <div className="csub">Recorded so the questions stay closed in writing.</div>
      <table className="data">
        <thead><tr><th>Item</th><th>How it was closed</th><th>What changed here</th></tr></thead>
        <tbody>
          <tr><td><OD id="OD-06" closed/> <span className="t-main">MOM signature method</span></td>
            <td>The Meeting Chair’s approval of the Minutes <b>is</b> the signature. Name, date and time
              are captured on approval, and the block renders on every extract, export and printed report.</td>
            <td>No signature setting exists. AG-07 was retired, because a question that can only ever
              return five measures nothing and inflates the score.</td></tr>
          <tr><td><OD id="OD-34" closed/> <span className="t-main">Pre-Meeting Submission</span></td>
            <td>Satisfied by the Report Submissions linked as Meeting inputs, which must be submitted and
              reviewed before the Meeting.</td>
            <td>No separate pre-meeting artefact. The Meeting record carries input readiness instead.</td></tr>
          <tr><td><OD id="OD-02" closed/> <span className="t-main">Position of FPTTRRR</span></td>
            <td>FPTTRRR is a Topic Category, not a Decision Criterion in the Authority Matrix.</td>
            <td>It appears in the Topic Category list on the Decision intake. Its definition is still
              open <OD id="OD-01"/>.</td></tr>
        </tbody></table>
    </div>

    <div className="card">
      <h2>Reference — the boundary this module holds</h2>
      <div className="csub">What Leadership Practice does, and what it deliberately does not.</div>
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Area</th><th>Leadership Practice</th><th>Owned elsewhere</th></tr></thead>
        <tbody>{[
          ['Approved Setup','Retrieves and executes against approved Report and Meeting Setups.',
           'Taxonomy owns Setups, controlled names, Templates and classifications. A review proposal to move Setup ownership here was considered and not accepted — two sources of approved configuration would be worse than one.'],
          ['Decision authority','Sends the criteria, applies the returned result and route without modification.',
           'The Authority Matrix owns authority rules, Decision Criteria and Approval Cycles, including creating missing mappings.'],
          ['Files','Stores the file URL and metadata in Dataverse.',
           'The actual file stays in the Taxonomy-managed file location.'],
          ['Task execution','Creates Tasks with a source reference and back-links, and reads their status.',
           'TMS owns assignment, progress and closure.'],
          ['People','Resolves employees, positions, managers and Microsoft 365 Groups at the point of use.',
           'Employee Data Management owns the master data.'],
          ['Enterprise reporting structure','None.',
           'The connection between business intelligence and the Report Setup held in Taxonomy is a Taxonomy-to-reporting exchange. Leadership Practice is not a party to it.'],
          ['Calendar','Creates and synchronizes governed occurrences.',
           'Outlook and Teams own calendar services, invitations and online sessions.'],
        ].map(([a,b,c],i)=><tr key={i}><td className="t-main">{a}</td><td>{b}</td>
          <td className="dim">{c}</td></tr>)}
        </tbody></table></div>
    </div>
  </>;
}

export default App;
