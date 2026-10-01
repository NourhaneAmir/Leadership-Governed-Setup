import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, CheckSquare, ClipboardCheck, ClipboardList, CircleAlert,
         Download, FileText, Gauge, Layers, LineChart, Lock, Menu, MessageSquare, MessagesSquare, Network, PenLine, Plus, RotateCcw, Shield, Eye,
         Users, UsersRound, X, Briefcase, Target, Clock, MapPin, Check, CircleX, ListOrdered, UserCheck,
         Upload, Paperclip, ListChecks }
  from 'lucide-react';
import './leadership-design.css';
/* Dates, the working calendar and number formatting now live in src/shared so
   a screen lifted out of this file keeps working without it. */
import { ymd, TODAY, PERIOD, HOLIDAYS, isNonWorking, isWeekend,
         dayName, nextWorkingDay, shiftWorkingDays,
         MONTHS, fmtD, fmtDS, fmtDT, fmtP, daysBetween, hoursBetween,
         addDays, addHours, nowStamp, money, pct, uid,
         band, scoreColour, pctColour } from '../../shared/format.js';
import { Ctx, use } from './store.jsx';
import { exportMinutesDocx } from '../../services/minutesExport.js';
/* The Artifact screens live in their own files — see screens/README-less
   note in domain.jsx for why the domain had to move first. */
import { ScreenBI } from './screens/BusinessIntelligence.jsx';
import { ScreenStrategyChain } from './screens/StrategyChain.jsx';
import { ScreenOrgReports } from './screens/OrgReports.jsx';
import { DecisionPanel } from './screens/DecisionLink.jsx';
import { OpenRecord } from './recordLinks.jsx';
import { ScreenHierarchy } from './screens/Hierarchy.jsx';
import { ScreenComms } from './screens/Communication.jsx';
import { ScreenBuildReport, NewTaskForm } from './screens/BuildReport.jsx';
import { PEOPLE, P, RPT_SETUPS, RS, DIAG, DiagChip, PROC_REG, PR, BI_REPORTS, BIR, KPI_CAT, KPIC, findKpi, bdDims, achFor, achPct, achCls, CITE_KINDS, citeKind, citeId, citeCls, canSeeReport, rptCfg, rptTagC, matchesQuery, CiteCard,
  STRAT, ST, PM_ENTRIES, PME, ISSUES, ISS, rptName } from './domain.jsx';
import { Tag, Btn, Note, OD, Bar, Field, Empty, Stat, KVBlock, Rail,
         Modal, Pills, ScoreHero } from '../../shared/ui.jsx';
import { fetchMeetingOccurrences, fetchReportOccurrences, createMeetingOccurrence,
         createReportOccurrence, updateReportOccurrenceFile, uploadReportOccurrenceFile,
         fetchTeamsChannels, channelDestinationPath,
         updateMeetingOccurrenceStatus, updateMeetingOccurrenceAttendance, updateMeetingOccurrence,
         cancelMeetingOccurrence, recordAgendaDistribution, createMeetingOccurrenceAgendaItem,
         archiveMeetingOccurrenceAgendaItem, updateMeetingOccurrenceAgendaSequence,
         fetchMeetingOccurrenceDepartments, fetchMeetingOccurrenceLinkedReports, fetchMeetingTemplateInputReports,
         fetchTasksForMeeting,
         linkMeetingOccurrenceReport, unlinkMeetingOccurrenceReport,
         attachReportOccurrenceToLink,
         fetchBusinessUnits, fetchPositions, fetchDepartments, fetchFunctions, fetchRegions,
         fetchMeetingTemplatesList, fetchMeetingTemplateDetail,
         fetchReportTemplatesList, fetchReportTemplateDetail, fetchCurrentUser,
         migrateTemplateSectionsToOccurrence,
         TEMPLATE_STATUS_LABEL,
         fetchMeetingMinutes, fetchMeetingMinutesByOccurrence, fetchAuditGridInstancesByOccurrence,
         fetchAuditGridInstances,
         fetchWorkLogDecisions, createWorkLogDecision, linkWorkLogDecision, fetchReportSectionsByIds,
         fetchReportOccurrenceForEdit,
         fetchAuthorityMatrix, createMeetingMinutes, saveMomNote, updateAgendaCovered,
         setMomNoteConfidential, saveMomNoteViewers,
         submitMeetingMinutes, updateMeetingMinutesStatus, returnMeetingMinutes,
         signMeetingMinutes, createAuditGridInstance, MOM_NOTE_MAX,
         saveAuditGridAnswer, archiveAuditGridAnswer, updateAuditGridState, approveAuditGridInstance,
         GRID_EVIDENCE_MAX, GRID_REASON_MAX,
         fetchReportOccurrenceHistory, submitReportOccurrence, approveReportStep,
         requestMoreInfoOnReport,
         MEETING_SETUP_TYPE, MEETING_CATEGORY, MEETING_FREQUENCY, MEETING_DAY_OF_WEEK,
         MEETING_MONTH_IN_QUARTER,
         ATTENDEE_TYPE, REPORT_TYPE, REPORT_CATEGORY, REPORT_FREQUENCY,
         fetchMeetingUnitRoles, fetchReportUnitRoles,
         REPORT_OBJECTIVE_MAX } from '../../services/dataverse.js';

/* =========================================================================
   REFERENCE DATA + SEED
   Working week Sun–Thu.
   ========================================================================= */

/* lm_fileurl on lm_reportoccurrences is a Dataverse text column, widened to
   300 characters to hold a real SharePoint link directly -- Dataverse
   rejects the whole create/update with a 400 rather than truncating, so
   this is enforced client-side before either request. */
const FILE_URL_MAX = 300;

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

const FAM = id => FAMILIES[P(id).fam];

/* personas offered in the topbar switcher, grouped by family */
const PERSONAS = ['u1','u6','u5','u2','u7','u4','u3','u8'];

/* ---- Taxonomy: Meeting Setups (read-only in Leadership Practice) -------- */
const SETUP_TYPES = ['Business Meeting','Committee'];
const BM_CLASSES = ['Planning Meeting','Monitoring Meeting','Clinical Meeting',
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
   cls:'Monitoring Meeting', bu:'AHJ', cadence:'Monthly — first Tuesday',
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

/* =========================================================================
   REPORT COMPOSITION — the sources a Report section can cite
   A Report is not a file. It is an ordered set of sections, and any section
   may cite a live record. The citation carries that period's real figures,
   so nothing in a Report is a number somebody typed in and forgot to update.
   Every citation resolves through the process registry below, which is the
   same spine the Setups, KPIs and Strategy chain already hang off.
   ========================================================================= */

/* ---- the four diagnostic angles a section can be typed against --------- */

/* ---- process registry -------------------------------------------------- */

/* ---- Power BI catalogue: a KPI links to the report it actually lives in - */

/* ---- KPI catalogue: target and actual by Business Unit and period ------
   dir:'down' marks a KPI where a lower actual is the better result, so
   achievement is not read the wrong way round on vacancy or infection rate. */
/* a citation may point at a whole KPI or at one breakdown of it */
/* Achievement for a Business Unit and period. A Report scoped to ALL reads
   the mean of the units that hold a figure, rather than showing nothing. */


/* ---- Section templates ------------------------------------------------
   This is what a Report Setup now points at instead of a .docx or .xlsx.
   A template is a named list of sections, each already pre-linked to the
   KPIs it always needs, so a new Report opens with that period's real
   achievement already in place. Nothing it produces is locked — every
   section can still be rewritten, reordered or removed.

   This is only the seed. Templates live in the store and are built and
   edited in the Section templates tab, so a new Report type does not need
   anybody to change code. */
const SECTION_TPL_SEED = [
  {id:'TPL-QLT', n:'Monthly Quality Report', cat:'Core',
   desc:'Indicator performance, the cause behind any miss, and the corrective actions carrying forward.',
   sections:[
     {h:'Indicator performance for the period', diag:'d1',
      cites:['KPI:KPI-QLT-011','KPI:KPI-QLT-014']},
     {h:'Where the shortfall is concentrated', diag:'d1',
      cites:['KPI:BD-Q11-ed','KPI:BD-Q11-ns']},
     {h:'Why it happened', diag:'d2', cites:[]},
     {h:'Corrective actions and their status', diag:'d4', cites:['STR:TAC-11']},
   ]},
  {id:'TPL-NUR', n:'Nursing Manpower Plan', cat:'Core',
   desc:'Establishment against plan, where the gap sits, and the supply committed against it.',
   sections:[
     {h:'Vacancy against the approved establishment', diag:'d1', cites:['KPI:KPI-NUR-003']},
     {h:'Where the gap is concentrated', diag:'d1', cites:['KPI:BD-N03-icu','KPI:BD-N03-thr']},
     {h:'Coverage committed for the period', diag:'d4', cites:['PM:SEP-24']},
     {h:'Outlook to the end of the quarter', diag:'d3', cites:['STR:PRJ-14']},
   ]},
  {id:'TPL-BME', n:'Medical Equipment Maintenance Report', cat:'Core',
   desc:'Preventive maintenance completion, open faults, and the asset classes behind any miss.',
   sections:[
     {h:'Preventive maintenance completion', diag:'d1', cites:['KPI:KPI-BME-002']},
     {h:'Completion by asset class', diag:'d1', cites:['KPI:BD-B02-img']},
     {h:'Open equipment faults', diag:'d2', cites:['ISS:ISS-2201','ISS:ISS-4102']},
     {h:'What is being done', diag:'d4', cites:['STR:POC-12']},
   ]},
  {id:'TPL-EXE', n:'Executive Performance Pack', cat:'Executive',
   desc:'Consolidated business unit performance, drawing each service line review in as a child report.',
   sections:[
     {h:'Financial and operational headline', diag:'d1',
      cites:['KPI:KPI-FIN-001','KPI:KPI-OPS-004']},
     {h:'What the service lines reported', diag:'d2', cites:[]},
     {h:'Outlook for the next period', diag:'d3', cites:[]},
     {h:'Decisions sought from the Executive', diag:'d4', cites:[]},
   ]},
  {id:'TPL-TOT', n:'Team of Teams alignment record', cat:'Custom',
   desc:'One shared constraint, what the team settled, and what is referred upward.',
   sections:[
     {h:'The constraint', diag:'d2', cites:['PM:CNF-03']},
     {h:'What the team decided, or could not settle', diag:'d4', cites:[]},
   ]},
  {id:'TPL-ADH', n:'Ad hoc review', cat:'Custom',
   desc:'A blank two-section frame for a one-off review. Add whatever the question needs.',
   sections:[
     {h:'What we found', diag:'d1', cites:[]},
     {h:'What we recommend', diag:'d4', cites:[]},
   ]},
];
/* templates are read from the live store, never from the seed above */
const tplOf = (db,id) => (db.templates||[]).find(t=>t.id===id);

/* ---- Citation identity -------------------------------------------------
   Every citation is stored as KIND:ID so it resolves to exactly one record
   and never has to be guessed at from the shape of the id. */

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
  /* Added with the timing cards. Unlike the two above it has no OD of its own —
     no open item covers the Grid submission window — but it behaves the same
     way: null means no deadline is enforced on an open Grid. Nothing reads it
     yet; the Audit Grid lifecycle has no submission timer wired to it. */
  gridSubmitHours  : null,
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
  gridSubmitHours:{od:null, label:'Audit Grid completion / submission period',
    q:'How long the Facilitator has to complete the required Grid questions and submit the Grid for Chair approval, measured from the moment the Grid is created.',
    owner:'SMO', accountable:'Facilitator',
    effect:'No submission deadline is enforced on an open Grid while this is unset.'},
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

/* =========================================================================
   SEED — one Committee carried through four cycles so history is real
   ========================================================================= */
function seed(){
return {
/* ---------------- Report Submissions ---------------------------------- */
reports:[
  {id:'sub1', setup:'rs1', custom:null, period:'2026-06', bu:'AHJ', dept:'Quality',
   status:'Approved', creator:'u1', step:2, blocks:['par-q6a','par-q6b'], ver:3, locked:true,
   history:[
     {at:'2026-07-04 09:12', who:'u1', act:'Submitted for review'},
     {at:'2026-07-05 14:40', who:'u5', act:'Approved review step 1', note:'Indicator narrative is complete.'},
     {at:'2026-07-06 10:05', who:'u2', act:'Approved review step 2 — final', note:'Approved.'},
   ]},
  {id:'sub2', setup:'rs1', custom:null, period:'2026-07', bu:'AHJ', dept:'Quality',
   status:'In Review', creator:'u1', step:0,
   blocks:['par-q7a','par-q7b','par-q7c','par-q7d'], ver:2, locked:false,
   history:[
     {at:'2026-07-08 11:20', who:'u1', act:'Submitted for review'},
     {at:'2026-07-09 16:02', who:'u5', act:'Requested more information',
      note:'Sepsis bundle indicator is missing its denominator. Please restate.'},
     {at:'2026-07-12 08:47', who:'u1', act:'Resubmitted after revision'},
   ]},
  {id:'sub3', setup:'rs2', custom:null, period:'2026-07', bu:'AHJ', dept:'Nursing',
   status:'Draft', creator:'u10', step:0, blocks:[], ver:0, locked:false,
   history:[{at:'2026-07-12 07:30', who:null, act:'Report Submission created from the approved Setup'}]},
  {id:'sub4', setup:'rs3', custom:null, period:'2026-07', bu:'AHJ', dept:'Executive',
   status:'Approved', creator:'u1', step:1,
   blocks:['par-e7a','par-e7b','par-e7c'], ver:1, locked:true,
   history:[
     {at:'2026-07-06 13:15', who:'u1', act:'Submitted for review'},
     {at:'2026-07-07 09:00', who:'u7', act:'Approved review step 1 — final'},
   ]},
  {id:'sub7', setup:'rs4', custom:null, period:'2026-07', bu:'AHJ', dept:'Facilities',
   status:'Draft', creator:'u6', step:0, blocks:[], ver:0, locked:false,
   history:[{at:'2026-07-14 07:15', who:null, act:'Report Submission created from the approved Setup'}]},
  {id:'sub8', setup:'rs4', custom:null, period:'2026-06', bu:'AHJ', dept:'Facilities',
   status:'In Review', creator:'u6', step:0, blocks:['par-b6a','par-b6b'], ver:1, locked:false,
   history:[{at:'2026-07-02 08:30', who:'u6', act:'Submitted for review'}]},
  {id:'sub6', setup:'rs3', custom:null, period:'2026-08', bu:'AHJ', dept:'Executive',
   status:'Draft', creator:'u1', step:0, blocks:[], ver:0, locked:false,
   history:[{at:'2026-07-27 06:00', who:null,
             act:'Report Submission created from the approved Setup ahead of the due date'}]},
  {id:'sub5', setup:null, period:'2026-07', bu:'AHJ', dept:'Ophthalmology',
   status:'In Review', creator:'u1', step:0, blocks:['par-o7a'], ver:1, locked:false,
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

/* ---------------- Report sections — the paragraph pool ------------------
   A Report's content is not a file. Each entry here is one section, cited
   into a Report by id from that Report's `blocks` array — the same
   paragraph can be cited into more than one Report at once. */
paragraphs:[
  {id:'par-q6a', author:'u1', at:'2026-07-03 16:20', diag:'d1', proc:'PRC-QLT-02',
   h:'Indicator performance for the period',
   text:'Sepsis bundle compliance closed June at 81% against a 90% target. Corrective action '+
     'closure within the due date held at 72%, nine points short of the 85% standard.',
   cites:['KPI:KPI-QLT-011','KPI:KPI-QLT-014']},
  {id:'par-q6b', author:'u1', at:'2026-07-03 16:34', diag:'d4', proc:'PRC-QLT-02',
   h:'Corrective actions carried into July',
   text:'The screening tactic remains the primary route to the target. Two actions from the '+
     'May incident review carry forward unclosed.',
   cites:['STR:TAC-11']},

  {id:'par-q7a', author:'u1', at:'2026-07-08 10:40', diag:'d1', proc:'PRC-QLT-02',
   h:'Indicator performance for the period',
   text:'Sepsis bundle compliance fell to 78% in July against a 90% target, a third consecutive '+
     'month below standard. Corrective action closure also slipped, to 69%.',
   cites:['KPI:KPI-QLT-011','KPI:KPI-QLT-014']},
  {id:'par-q7b', author:'u1', at:'2026-07-08 11:02', diag:'d1', proc:'PRC-QLT-02',
   h:'Where the shortfall is concentrated',
   text:'The group figure hides the shape of the problem. The Emergency Department sits at 64% '+
     'and the night shift at 69%, while Intensive Care is at 91%. This is a screening '+
     'coverage gap at two entry points, not a hospital-wide practice gap.',
   cites:['KPI:BD-Q11-ed','KPI:BD-Q11-ns','KPI:BD-Q11-icu']},
  {id:'par-q7c', author:'u1', at:'2026-07-08 11:25', diag:'d2', proc:'PRC-QLT-02',
   h:'Why it happened',
   text:'The electronic alert does not fire on patients admitted by transfer, which is the '+
     'route most night-shift ED admissions take. The defect has been open with IT since 18 July.',
   cites:['ISS:ISS-3390']},
  {id:'par-q7d', author:'u1', at:'2026-07-12 08:50', diag:'d4', proc:'PRC-QLT-02',
   h:'Corrective actions and their status',
   text:'Phase 1 of the sepsis alert rollout covers the ED and is at 45%. It does not resolve '+
     'the transfer-admission defect, which needs to be scoped separately before Phase 2.',
   cites:['STR:PRJ-07','STR:TAC-11']},

  {id:'par-b6a', author:'u6', at:'2026-07-02 08:10', diag:'d1', proc:'PRC-BME-01',
   h:'Preventive maintenance completion',
   text:'Completion closed June at 88% against the 95% standard. Imaging is the whole of the '+
     'variance at 76%; life support and laboratory both met standard.',
   cites:['KPI:KPI-BME-002','KPI:BD-B02-img']},
  {id:'par-b6b', author:'u6', at:'2026-07-02 08:26', diag:'d2', proc:'PRC-BME-01',
   h:'Open equipment faults',
   text:'Two faults account for the imaging shortfall: an anaesthesia machine out of service '+
     'since 22 July and a CT scanner now past its contractual maintenance window.',
   cites:['ISS:ISS-2201','ISS:ISS-4102']},

  {id:'par-e7a', author:'u1', at:'2026-07-06 12:40', diag:'d1', proc:'PRC-FIN-01',
   h:'Financial and operational headline',
   text:'Operating margin reached 12.6% against a 14% plan. Theatre utilisation improved to 82% '+
     'but remains three points below target.',
   cites:['KPI:KPI-FIN-001','KPI:KPI-OPS-004']},
  {id:'par-e7b', author:'u1', at:'2026-07-06 12:58', diag:'d2', proc:'PRC-OPS-01',
   h:'What the service lines reported',
   text:'Quality reports a screening coverage gap at two entry points. Facilities reports the '+
     'maintenance variance sitting entirely in imaging. Both are read directly from the '+
     'service line reports rather than restated here.',
   cites:['RPT:sub2','RPT:sub8']},
  {id:'par-e7c', author:'u1', at:'2026-07-06 13:05', diag:'d3', proc:'PRC-OPS-01',
   h:'Outlook for the next period',
   text:'Evening list utilisation is the single largest recoverable gap at 61%. The pooling '+
     'option is still in design and will not contribute this quarter.',
   cites:['KPI:BD-O04-pm','STR:POC-09','PM:CNF-03']},

  {id:'par-o7a', author:'u1', at:'2026-07-14 09:15', diag:'d1', proc:'PRC-OPS-01',
   h:'Laser suite utilisation',
   text:'The laser suite ran at 61% of available evening capacity across the quarter, in line '+
     'with the wider evening list pattern rather than specific to ophthalmology.',
   cites:['KPI:BD-O04-pm']},
],

/* ---------------- Section templates -------------------------------------
   Deep-cloned so editing a template in the Section templates tab never
   mutates the SECTION_TPL_SEED const. */
templates: JSON.parse(JSON.stringify(SECTION_TPL_SEED)),

/* ---------------- Meeting Occurrences ---------------------------------- */
occs:[
  /* --- Operational Quality Committee ---------------------------------- */
  ...['2026-04-16','2026-05-21','2026-06-18'].map((d,i)=>({
    id:'occ-oqc-'+['apr','may','jun'][i], setup:'ms1', custom:null, bu:'AHJ',
    date:d, start:'09:00', end:'11:00', tz:'Arab Standard Time', mode:'Hybrid',
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
   date:'2026-07-16', start:'09:00', end:'11:00', tz:'Arab Standard Time', mode:'Hybrid',
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
   date:'2026-08-20', start:'09:00', end:'11:00', tz:'Arab Standard Time', mode:'Hybrid',
   location:'Board Room 2', link:'https://teams.microsoft.com/l/meetup-join/oqc-aug',
   adhoc:null, restricted:false, status:'Scheduled', agendaSent:null, inviteSent:'2026-08-16',
   sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:MS('ms1').required.concat(MS('ms1').optional).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-a-1', seq:1, title:'Patient complaint trend review', owner:'u5',
            source:'Carried forward from 16 Jul 2026', covered:null, carriedFrom:'ag-j-4'}]},
  {id:'occ-oqc-adhoc', setup:'ms1', custom:null, bu:'AHJ',
   date:'2026-07-30', start:'14:00', end:'15:00', tz:'Arab Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/oqc-adhoc',
   adhoc:'Governance', restricted:false, status:'Scheduled', agendaSent:'2026-07-28', inviteSent:'2026-07-26',
   sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:['sub2'],
   attend:['u2','u3','u5','u6','u14'].map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-ah-1', seq:1, title:'Unplanned review — sterilisation incident', owner:'u3', source:'Ad Hoc', covered:null}]},

  /* --- Infection Prevention and Control Committee ---------------------- */
  {id:'occ-ipc-jun', setup:'ms2', custom:null, bu:'AHJ',
   date:'2026-06-25', start:'11:00', end:'12:30', tz:'Arab Standard Time', mode:'In person',
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
   date:'2026-07-23', start:'11:00', end:'12:30', tz:'Arab Standard Time', mode:'In person',
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
   date:'2026-08-27', start:'11:00', end:'12:30', tz:'Arab Standard Time', mode:'In person',
   location:'Meeting Room 4', link:null, adhoc:null, restricted:false, status:'Scheduled',
   agendaSent:null, inviteSent:'2026-08-23', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:[],
   attend:MS('ms2').required.concat(MS('ms2').optional).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-i3-1', seq:1, title:'Central line bundle re-audit', owner:'u14', source:'Carried forward', covered:null}]},

  /* --- Medication Safety Committee ------------------------------------- */
  {id:'occ-msc-jul', setup:'ms3', custom:null, bu:'AHJ',
   date:'2026-07-09', start:'13:00', end:'14:30', tz:'Arab Standard Time', mode:'Online',
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
   date:'2026-08-13', start:'13:00', end:'14:30', tz:'Arab Standard Time', mode:'Online',
   location:null, link:null, adhoc:null, restricted:false, status:'Cancelled', agendaSent:null, inviteSent:'2026-08-09',
   sync:'Cancellation synchronized', cancelReason:'Quarterly cycle moved to September at the Chair’s request.',
   rescheduledFrom:null, inputs:[],
   attend:[], agenda:[{id:'ag-m2-1', seq:1, title:'Quarterly medication safety review', owner:'u14', source:'Standing item', covered:null}]},

  /* --- Business Meetings ------------------------------------------------ */
  {id:'occ-mpr-jul', setup:'ms4', custom:null, bu:'AHJ',
   date:'2026-07-07', start:'08:00', end:'10:00', tz:'Arab Standard Time', mode:'Hybrid',
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
   date:'2026-08-04', start:'08:00', end:'10:00', tz:'Arab Standard Time', mode:'Hybrid',
   location:'Executive Suite', link:'https://teams.microsoft.com/l/meetup-join/mpr-aug', adhoc:null,
   restricted:false, status:'Scheduled', agendaSent:null, inviteSent:'2026-07-31', sync:'Synchronized',
   cancelReason:null, rescheduledFrom:null, inputs:['sub6'],
   attend:MS('ms4').required.concat(MS('ms4').optional,['u6']).map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-p2-1', seq:1, title:'July performance against plan', owner:'u11', source:'Report input — Executive Performance Pack', covered:null},
           {id:'ag-p2-2', seq:2, title:'Occupancy recovery — progress', owner:'u7', source:'Carried forward', covered:null}]},
  {id:'occ-dtf-jul', setup:'ms5', custom:null, bu:'AHJ',
   date:'2026-07-14', start:'15:00', end:'16:30', tz:'Arab Standard Time', mode:'Online',
   location:null, link:'https://teams.microsoft.com/l/meetup-join/dtf', adhoc:null, restricted:false,
   status:'Held', agendaSent:'2026-07-12', inviteSent:'2026-07-10', sync:'Synchronized', cancelReason:null, rescheduledFrom:null,
   inputs:[],
   attend:[{who:'u7',present:true,delegate:null},{who:'u15',present:true,delegate:null},
           {who:'u5',present:true,delegate:null},{who:'u1',present:true,delegate:null},
           {who:'u11',present:false,delegate:null}],
   agenda:[{id:'ag-d-1', seq:1, title:'Leadership Practice rollout readiness', owner:'u15', source:'Standing item', covered:true}]},
  {id:'occ-ncr-jul', setup:'ms6', custom:null, bu:'AHJ',
   date:'2026-07-21', start:'12:00', end:'13:00', tz:'Arab Standard Time', mode:'In person',
   location:'Nursing Education Room', link:null, adhoc:null, restricted:false, status:'Held',
   agendaSent:'2026-07-19', inviteSent:'2026-07-17', sync:'Synchronized', cancelReason:null, rescheduledFrom:null, inputs:['sub3'],
   attend:[{who:'u10',present:true,delegate:null},{who:'u2',present:true,delegate:null},
           {who:'u14',present:true,delegate:null}],
   agenda:[{id:'ag-n-1', seq:1, title:'Specialty nursing competency gaps', owner:'u10', source:'Standing item', covered:true}]},
  {id:'occ-ncr-aug', setup:'ms6', custom:null, bu:'AHJ',
   date:'2026-08-23', start:'12:00', end:'13:00', tz:'Arab Standard Time', mode:'In person',
   location:'Nursing Education Room', link:null, adhoc:null, restricted:false, status:'Scheduled',
   agendaSent:null, inviteSent:'2026-08-19', sync:'Synchronized', cancelReason:null, rescheduledFrom:'2026-08-21', inputs:[],
   attend:MS('ms6').required.map(w=>({who:w,present:null,delegate:null})),
   agenda:[{id:'ag-n2-1', seq:1, title:'Competency gap closure plan', owner:'u10', source:'Carried forward', covered:null}]},

  /* --- Manager-to-subordinate Ad Hoc (restricted visibility) ------------ */
  {id:'occ-121-jul', setup:null, bu:'AHJ',
   custom:{name:'One-to-one — Hussain Ahmed and Sara Khalil', purpose:'Monthly one-to-one review.',
           noSetupFlag:true, taxonomyState:'Delivered', dept:'Quality', stage:'Business Unit'},
   date:'2026-07-27', start:'10:00', end:'10:45', tz:'Arab Standard Time', mode:'Online',
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
/* ⚠️ A saved manual answer outranks "could not compute".
   Every rule above decides its own state, and the ones that cannot reach a
   value push 'na' (not applicable / no data) or 'blank' (a Manual question
   nobody has answered). Those score nothing AND count nothing toward
   coverage, which is why a Business Meeting, or any meeting whose Decisions
   are not yet linked, sat at a low coverage with no way for a person to say
   what they knew.

   Applied here, once, rather than inside sixteen separate rules -- so a rule
   stays a statement about the DATA and this stays a statement about who may
   override it. A question the system DID compute ('auto') is never touched:
   an auto-scored value still cannot be overridden by anyone. */
const applyManualOverrides = (rows, manual, evid) => rows.map(r =>
  (r.state === 'na' || r.state === 'blank') && manual[r.id] != null
    ? { ...r, state: 'manual', score: manual[r.id], ev: evid[r.id] || null,
        /* the original reason is kept, so the grid can still say what the
           system thought before a person overrode it */
        na: r.na, overrode: r.state }
    : r);

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
    const need = shiftWorkingDays(occ.date, -S.agendaLeadDays);
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
    const need = shiftWorkingDays(occ.date, -S.inviteLeadDays);
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

  return applyManualOverrides(R, manual, evid).sort((x,y)=>x.id.localeCompare(y.id));
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

/* Live equivalent of attendance() above, for a Dataverse occurrence's own
   attendees[] shape (present is a string, delegate is a position id) rather
   than the seeded occ.attend. Same three-mode semantics as S.delegatedAttend. */
function liveAttendance(attendees, mode){
  const rows = (attendees||[]).filter(a=>(a.type||'Required')==='Required');
  let num=0, den=0;
  rows.forEach(a=>{
    if(a.delegatePositionId){
      if(mode==='exclude') return;
      den++; num += mode==='half' ? .5 : 1;
    } else { den++; if(a.present==='Present') num++; }
  });
  return { pct: den ? (num/den)*100 : 0,
    present: rows.filter(a=>a.present==='Present'||a.delegatePositionId).length, total: rows.length };
}

/* Quorum for one live occurrence, against its Setup's lm_quorumthreshold (a
   percentage of Required Attendees -- the Setup stores a %, so the head count
   is derived: ceil(threshold% x Required)). Measured with liveAttendance(), the
   same count AG-08 scores, so the meeting page and the Audit Grid never
   disagree. States:
     none        -- no Setup, or the Setup has no threshold
     noRequired  -- a threshold, but no Required Attendee to measure it on
     pending     -- not held yet (shows what will be needed)
     incomplete  -- held, not met on what is recorded, some Required attendance
                    still unrecorded (recording it could still meet it)
     met / missed
   An unrecorded attendee counts as not present, so a quorum already met with
   some unrecorded stays met. */
/* Carried forward from the previous meeting (prototype's carriedForward(),
   PRO-03, 29 Sep). The previous meeting is the latest HELD occurrence of the
   same Setup in the same place (same Business Unit / Region, or both empty for
   a group-wide Setup) dated before this one. What it carries is every agenda
   item it did not cover (anything but Yes) that no occurrence has carried yet
   -- lm_CarriedFromAgendaItem on the new item points back at it, the same link
   AG-04 reads. A Custom meeting has no Setup, so nothing carries into it. */
function previousOccurrence(occ, all){
  if(!occ?.templateId) return null;
  return (all||[]).filter(o=>o.id!==occ.id && o.templateId===occ.templateId && o.status==='Held'
      && (o.businessUnitId||null)===(occ.businessUnitId||null)
      && (o.regionId||null)===(occ.regionId||null)
      && (!occ.date || (o.date||'') < occ.date))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0] || null;
}
function carryCandidates(prev, all){
  if(!prev) return [];
  const carried = new Set((all||[]).flatMap(o=>(o.agenda||[]).map(a=>a.carriedFromId).filter(Boolean)));
  return (prev.agenda||[]).filter(a=>a.title && a.covered!=='Yes' && !carried.has(a.id));
}
const DECISION_DONE = new Set(['Completed','Closed','Cancelled']);

function liveQuorum(occ, tpl, mode){
  const threshold = tpl?.quorumPct;
  if(threshold==null) return { state:'none' };
  const req = (occ.attendees||[]).filter(a=>(a.type||'Required')==='Required');
  const need = Math.ceil(threshold/100*req.length);
  const base = { threshold, need, total:req.length };
  if(!req.length) return { ...base, state:'noRequired' };
  if(occ.status!=='Held') return { ...base, state:'pending' };
  const a = liveAttendance(occ.attendees, mode);
  const unrecorded = req.filter(x=>!x.delegatePositionId && (!x.present || x.present==='Not Yet Recorded')).length;
  const met = a.pct >= threshold;
  return { ...base, pct:a.pct, present:a.present, unrecorded,
    state: met ? 'met' : unrecorded ? 'incomplete' : 'missed' };
}
const QUORUM_TAG = {
  met:['green','Quorum met'], missed:['red','Quorum missed'], incomplete:['amber','Quorum not yet met'],
  pending:['grey','Quorum pending'], noRequired:['grey','No Required Attendee'],
};
function quorumLine(qr){
  if(qr.state==='none') return 'No quorum threshold is configured on the Setup.';
  if(qr.state==='noRequired') return `The Setup sets a ${qr.threshold}% quorum, but this occurrence has no Required Attendee.`;
  if(qr.state==='pending') return `Needs ${qr.need} of ${qr.total} Required Attendees present (${qr.threshold}%).`;
  const got = `${qr.present} of ${qr.total} Required present (${Math.round(qr.pct)}%) against ${qr.threshold}% — ${qr.need} needed.`;
  return qr.state==='incomplete'
    ? `${got} ${qr.unrecorded} Required attendance${qr.unrecorded===1?' is':'s are'} not yet recorded.` : got;
}

/* Live equivalent of scoreGrid() above: same 16-question catalogue, same
   thresholds and bands, reading a live Meeting Occurrence/Minutes/Template
   instead of the seeded db. Two deliberate simplifications, both because the
   data they'd need doesn't exist live yet -- documented in each row's trace
   text rather than hidden:
     - AG-01 checks only whether a TOR/Policy link is held, not whether it's
       past a review date -- there is no live "TOR review date" column.
     - AG-06 counts Discussion Notes and Decisions as an outcome, not Tasks:
       hx_tasks has no link to a meeting or agenda item yet (PRO-02).
   AG-10 to AG-14 (29 Sep, PRO-13). The live MOM Outputs are the Decisions
   raised on this occurrence's agenda items (wlog_decision.lm_MeetingOccurrenceAgenda,
   `decisions` = the app's dvDecisions register):
     - AG-10 scores from them. Because the link IS the agenda item, every one
       traces by construction; the question still reads Not Applicable when
       the Minutes produced none, as scoreGrid() does.
     - AG-11 / AG-12 stay Not Applicable: IT's wlog_decision carries no
       Direct-vs-Request path and no Authority Check result (§7 decision 2),
       so there is nothing to score them from.
     - AG-13 / AG-14 stay Not Applicable until PRO-02 links Tasks to meetings.
   Each Not Applicable reason says exactly that, and a person can still
   answer them manually (applyManualOverrides). */
function liveScoreGrid(occ, minutes, quorumPct, torLink, accred, S, grid, allOccs, decisions){
  const agendaIds = new Set(occ.agenda.map(a=>a.id));
  const meetingDecisions = (decisions||[]).filter(d=>d.agendaItemId && agendaIds.has(d.agendaItemId));
  const R = [];
  const manual = grid?.manual||{}, evid = grid?.evidence||{};
  const push = (id,state,score,ev,na) => R.push({id, q:AG_QUESTIONS.find(x=>x.id===id), state, score, ev, na});

  if(!accred) push('AG-01','na',null,null,'A TOR or Policy reference is not mandatory for this Committee classification.');
  else if(!torLink) push('AG-01','auto',0,'No TOR or Policy reference is held on the approved Setup.');
  else push('AG-01','auto',5,'A TOR or Policy reference is held on the approved Setup.');

  if(!torLink) push('AG-02','na',null,null,'No TOR or Policy reference exists for this Committee.');
  else if(manual['AG-02']!=null) push('AG-02','manual', manual['AG-02'], evid['AG-02']||null);
  else push('AG-02','blank',null,null);

  const hasItems = occ.agenda.length>0;
  if(S.agendaLeadDays==null){
    push('AG-03','auto', hasItems?5:0, hasItems?'At least one Agenda item exists.':'No Agenda item exists.');
  }else{
    const need = shiftWorkingDays(occ.date, -S.agendaLeadDays);
    const onTime = occ.agendaSent && occ.agendaSent<=need;
    push('AG-03','auto', ((hasItems?5:0)+(onTime?5:0))/2,
      `Agenda ${hasItems?'present':'absent'}; distributed ${occ.agendaSent?(onTime?'on time':'late'):'never'} `+
      `(needed by ${need}).`);
  }

  const unc = occ.agenda.filter(a=>a.covered!=='Yes');
  const carried = unc.length>0 && unc.every(a=>
    (allOccs||[]).some(o=>o.id!==occ.id && (o.agenda||[]).some(x=>x.carriedFromId===a.id)));
  push('AG-04','auto', unc.length===0?5:carried?4:0,
    unc.length===0 ? 'Every Agenda item is covered.'
      : carried ? `${unc.length} uncovered item(s), all carried forward to a later occurrence.`
      : `${unc.length} uncovered item(s); not all are carried forward.`);

  if(S.momApprovalHours==null) push('AG-05','na',null,null,'The MOM approval period is not configured, so approval timeliness cannot be measured.');
  else if(!minutes?.submittedAt) push('AG-05','na',null,null,'The MOM was never submitted, so the Chair’s approval clock never started. Measured by AG-16 instead.');
  else if(!minutes?.approvedAt) push('AG-05','na',null,null,'The MOM has not been approved yet.');
  else{
    const h = hoursBetween(minutes.submittedAt, minutes.approvedAt);
    push('AG-05','auto', h<=S.momApprovalHours?5 : h<=S.momApprovalHours*2?2:0,
      `Approved ${h} hour${h===1?'':'s'} after submission (limit ${S.momApprovalHours}h).`);
  }

  const withOutcome = occ.agenda.filter(a=>(minutes?.notesByAgenda?.[a.id]||'').trim()
    || meetingDecisions.some(d=>d.agendaItemId===a.id));
  const p6 = occ.agenda.length ? withOutcome.length/occ.agenda.length*100 : 100;
  push('AG-06','auto', band(p6),
    `${withOutcome.length} of ${occ.agenda.length} Agenda item(s) record a Discussion Note or a Decision → ${pct(p6)}. `+
    `Tasks are not counted yet: they have no link to a meeting (PRO-02).`);

  push('AG-07','retired',null,null);

  if(quorumPct==null) push('AG-08','na',null,null,'No quorum threshold is configured for this Committee.');
  else{
    const a8 = liveAttendance(occ.attendees, S.delegatedAttend);
    push('AG-08','auto', a8.pct>=quorumPct?5:0,
      `${Math.round(a8.pct)}% Required attendance against a ${quorumPct}% quorum threshold.`);
  }

  const a9 = liveAttendance(occ.attendees, S.delegatedAttend);
  push('AG-09','auto', band(a9.pct), `${a9.present} of ${a9.total} Required Attendees present → ${pct(a9.pct)}.`);

  /* AG-10 -- Decisions only; see the header. */
  if(!meetingDecisions.length)
    push('AG-10','na',null,null,'The Minutes produced no Decision. Tasks are not counted yet: they have no link to a meeting (PRO-02).');
  else{
    const ok = meetingDecisions.filter(d=>agendaIds.has(d.agendaItemId));
    const p = ok.length/meetingDecisions.length*100;
    push('AG-10','auto', band(p),
      `${ok.length} of ${meetingDecisions.length} Decision${meetingDecisions.length===1?'':'s'} raised in these Minutes `+
      `resolve to a parent Agenda Item → ${pct(p)}. Tasks are not counted yet: they have no link to a meeting (PRO-02).`);
  }
  push('AG-11','na',null,null,
    meetingDecisions.length
      ? `${meetingDecisions.length} Decision${meetingDecisions.length===1?' was':'s were'} recorded, but a Decision in IT carries no Direct / Request path and no Authority Check result, so this cannot be scored.`
      : 'No Decision was recorded from this Meeting.');
  push('AG-12','na',null,null,
    meetingDecisions.length
      ? 'A Decision in IT carries no Direct / Request path and no Approval Cycle, so the Authority Matrix route cannot be checked.'
      : 'No Decision was recorded from this Meeting.');
  push('AG-13','na',null,null,'Tasks have no link to a meeting yet (PRO-02), so the Tasks created from these Minutes cannot be found.');
  push('AG-14','na',null,null,'Tasks have no link to a meeting yet (PRO-02), so the earlier meetings’ Tasks cannot be found.');

  if(S.inviteLeadDays==null) push('AG-15','na',null,null,'No invitation lead time is configured.');
  else{
    const need = shiftWorkingDays(occ.date, -S.inviteLeadDays);
    const score = !occ.inviteSent?0 : occ.inviteSent<=need?5:2;
    push('AG-15','auto', score, occ.inviteSent?`Invitation sent ${occ.inviteSent}, needed by ${need}.`:'No invitation date recorded.');
  }

  if(S.momWriteupHours==null) push('AG-16','na',null,null,'No MOM write-up period is configured.');
  else if(!occ.end) push('AG-16','na',null,null,'No end time is recorded on this occurrence, so the write-up clock cannot start.');
  else if(!minutes?.submittedAt) push('AG-16','auto',0,'The MOM was never submitted.');
  else{
    const h = hoursBetween(occ.date+' '+occ.end, minutes.submittedAt);
    push('AG-16','auto', h<=S.momWriteupHours?5 : h<=S.momWriteupHours*2?2:0,
      `Submitted ${h} hour${h===1?'':'s'} after the Meeting ended (limit ${S.momWriteupHours}h).`);
  }

  return applyManualOverrides(R, manual, evid).sort((a,b)=>a.id.localeCompare(b.id));
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

/* The presentational primitives now live in src/shared/ui.jsx — imported at
   the top of this file. `Hist` stays here: it resolves a person id through the
   seeded PEOPLE table, so it is not portable until the store moves too. */
const Hist = ({items}) =>
  <div className="hist">{items.map((h,i)=>
    <div className="hist-i" key={i}>
      <b>{h.who?P(h.who).name:'System'}</b> — {h.act}
      <div className="w">{fmtDT(h.at)}{h.note?' · “'+h.note+'”':''}</div>
    </div>)}</div>;

/* =========================================================================
   NAVIGATION
   ========================================================================= */
/* ---- the screen registry ------------------------------------------------
   One descriptor per tab. The side nav, the router and the full-width rule are
   all DERIVED from this list, so a tab is defined in exactly one place instead
   of the four it used to be spread across — and adding, reordering, renaming,
   hiding or moving one is a single edit here.

   `Screen` references a function declaration further down this file; those are
   hoisted, so the list can sit above them. When a screen moves into its own
   file under screens/, only that reference changes — and moving a tab into the
   Governance module becomes: delete its line here, add the equivalent there.

   `hint` is a one-line answer to "what lives here?". Nothing reads it today
   (the workspace panel that showed these was rebuilt), but it is the natural
   place for it, so it travels with the tab rather than being re-derived. */
const SCREENS = [
  {id:'work', group:'Start here',    label:'My Workspace',           Icon:Gauge,          wide:true,
   Screen:ScreenWorkspace,
   hint:'Everything open right now — due, in review, and finished-but-unclosed.'},
  {id:'cal',  group:'Start here',    label:'Calendar',               Icon:CalendarDays,   wide:true,
   Screen:ScreenCalendar,
   hint:'Every Meeting, Committee and Report due date, in one full calendar.'},
  {id:'mtg',  group:'Meetings',      label:'Meetings & Committees',  Icon:UsersRound,     wide:true,
   Screen:ScreenMeetings,
   hint:'Every Meeting and Committee — and inside each one its Agenda, Attendance and follow-up.'},
  {id:'mom',  group:'Meetings',      label:'Meeting Minutes',        Icon:ClipboardList,  wide:true,
   Screen:ScreenMinutes,
   hint:'Every set of Meeting Minutes: Draft, Pending Approval, Approved, Closed.'},
  {id:'grid', group:'Meetings',      label:'Committee Scores',       Icon:BarChart3,  wide:true,
   Screen:ScreenGrid,
   hint:'Committee governance scores across occurrences.'},
  {id:'dec',  group:'Governance',    label:'Decisions',              Icon:CheckSquare,  wide:true,
   Screen:ScreenDecisions,
   hint:'The Decision register: every Decision and Decision Request whatever raised it.'},
  {id:'build', group:'Artifact',     label:'Build a report/plan',    Icon:PenLine,        wide:true,
   Screen:ScreenBuildReport,
   hint:'Write a Draft or Returned report — sections, angles, citations — and submit it for review.'},
  {id:'orpt', group:'Artifact',      label:'Reports / Plans',        Icon:Layers,         wide:true,
   Screen:ScreenOrgReports,
   hint:'Organizational reports and plans, in and out, with their authors and citations.'},
  {id:'bi',   group:'Artifact',      label:'Business intelligence',  Icon:LineChart,      wide:true,
   Screen:ScreenBI,
   hint:'The BI report behind each measure — find it by Process, owning department or report.'},
  {id:'chain', group:'Artifact',     label:'Strategy chain',         Icon:Target,         wide:true,
   Screen:ScreenStrategyChain,
   hint:'Each Strategy from its KPI to execution and actuals, its Projects and POCs, and what reports say about them.'},
  {id:'comms', group:'Exchange',     label:'Communication & execution', Icon:MessagesSquare, wide:true,
   Screen:ScreenComms,
   hint:'Reports sent to you and by you, and the tasks you are accountable for.'},
  {id:'hier', group:'Artifact',      label:'Reporting hierarchy',    Icon:Network,        wide:true,
   Screen:ScreenHierarchy,
   hint:'Every report/plan and every child it references, as one tree.'},
  /* Hidden from the sidebar on purpose -- NOT dead code. `go('rpt', id)` is
     still called from over a dozen places (My Workspace's "+ New Report",
     Decision/Task/Follow-up links back to their source Report, report rows
     elsewhere), and ScreenOrgReports ('orpt', above) has no mechanism to
     receive an externally-selected report the way every other screen reads
     sel[screenId] -- it manages its own internal openId state instead.
     Redirecting those call sites to 'orpt' would need that screen retrofitted
     first. Until then, this stays reachable by id, just not listed as a tab. */
  {id:'rpt',  group:'Execution',     label:'Reports & Plans',        Icon:null,           wide:true,
   Screen:ScreenReports,           hidden:true,
   hint:'Every Report and Plan: due to submit, in review, approved.'},
  /* Create Report. Hidden from the sidebar: reached from every "+ New Report"
     through openNewReport(), never as a place of its own. */
  {id:'newrpt', group:'Artifact',    label:'New Report',             Icon:null,           wide:true,
   Screen:ScreenNewReport,         hidden:true,
   hint:'Create a Report from an approved template, or a Custom one.'},
  /* Schedule Meeting (29 Sep, was NewMeetingModal). Hidden from the sidebar:
     reached from Meetings' "Ad Hoc from Setup" / "New Meeting" through
     go('newmtg', 'adhoc' | 'custom'). */
  {id:'newmtg', group:'Meetings',    label:'Schedule Meeting',       Icon:null,           wide:true,
   Screen:ScreenNewMeeting,        hidden:true,
   hint:'Schedule a Meeting from an approved Setup, or a Custom Ad Hoc one.'},
];

/* everything below is derived — nothing else in the file lists screens */
const VISIBLE_SCREENS = SCREENS.filter(s=>!s.hidden);
const NAV = [...new Set(VISIBLE_SCREENS.map(s=>s.group))].map(g=>({
  g, items: VISIBLE_SCREENS.filter(s=>s.group===g),
}));
const SCREEN_BY_ID = Object.fromEntries(SCREENS.map(s=>[s.id,s.Screen]));
const WIDE_SCREENS = new Set(SCREENS.filter(s=>s.wide).map(s=>s.id));

function Side(){
  const {screen,go,counts,onSwitch,navOpen,setNavOpen} = use();
  return <nav className="side lp-side" id="lp-side-nav" aria-label="Sections" aria-hidden={!navOpen}>
    {NAV.map(g=><div key={g.g}>
      <div className="side-grp">{g.g}</div>
      {g.items.map(i=>
        <button key={i.id} type="button" aria-current={screen===i.id?'page':undefined}
          aria-label={i.label+(counts[i.id]>0?' — '+counts[i.id]+' open activities':'')}
          title={navOpen?undefined:i.label}
          className={'nav-i'+(screen===i.id?' on':'')} onClick={()=>go(i.id)}>
          <span className="nav-n"><i.Icon size={16} strokeWidth={2.25}/></span><span className="lp-nav-label">{i.label}</span>
          {counts[i.id]>0 && <span className="nav-b" aria-label={counts[i.id]+' open activities'}>
            {counts[i.id]}</span>}
        </button>)}
    </div>)}
    <div className="lp-side-sp"/>
    {/* Only when a handler is given -- see the note in GovernanceApp.jsx. */}
    {onSwitch ? <>
      <div className="side-grp">Modules</div>
      <button type="button" className="nav-i lp-switch-nav" onClick={onSwitch}>
        <span className="nav-n lp-switch-ic"><ArrowUpRight size={16} strokeWidth={2.25}/></span>
        <span className="lp-nav-label">Governance Setup</span></button>
    </> : null}
  </nav>;
}

function TopBar(){
  const {bu,setBu,businessUnits,navOpen,setNavOpen,currentUser} = use();
  const position=DV_POS_LIST.find(p=>currentUser?.fullName && p.holder &&
    p.holder.toLowerCase()===currentUser.fullName.toLowerCase());
  const userLabel=currentUser?.fullName || P('u0').name;
  const userTitle=position?.name || P('u0').position;
  const userInitials=userLabel.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return <div className="topbar lp-topbar">
    <button type="button" className="lp-burger" aria-label={navOpen?'Close side navigation':'Open side navigation'}
      aria-expanded={navOpen} aria-controls="lp-side-nav" onClick={()=>setNavOpen(o=>!o)}>
      {navOpen?<X size={18}/>:<Menu size={18}/>}</button>
    <div className="tb-brand"><b>ANDALUSIA PULSE</b><span>Leadership Practice</span></div>
    <span className="tb-scope" title="This demo signs in as one user holding every role, so the whole
      governance cycle can be walked in one sitting. Each record still names its accountable owner.">
      Signed in · full access, every role</span>
    <div className="tb-f">
      <label>Business unit</label>
      <select value={bu} onChange={e=>setBu(e.target.value)}>
        <option value="ALL">All business units</option>
        {businessUnits.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </div>
    <div className="tb-sp"/>
    <span className="tb-scope">{fmtD(TODAY)}</span>
    <button type="button" className="lp-user" title={`${userLabel} · ${userTitle}`}>
      <span className="lp-user-av">{userInitials}</span>
      <span className="lp-user-name">{userLabel}<span className="lp-user-sub">{userTitle}</span></span>
    </button>
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
  const {go,openMeeting,openDvRec} = use();
  const [rng,setRng]=useState('week');
  const [lo,hi]=rangeBounds(rng);
  const pool=items.filter(i=>!kinds || kinds.includes(i.kind));
  const rows=pool.filter(i=>i.date>=lo && i.date<=hi)
                 .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  /* A live Dataverse row carries no screen -- it opens the read-only panel. */
  const open=i=> i._dv ? openDvRec(i.kind==='Report'?'Report':'Meeting', i._rec)
    : i.screen==='mtg' ? openMeeting(i.id,i.tab||'detail') : go(i.screen,i.id);

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
/* MOM Due is gone: those deadlines were derived from seeded Minutes, and the
   calendar now shows only what the occurrence tables hold. */
const CAL_KINDS = [
  {id:'All',     label:'All',      colour:null},
  {id:'Meeting', label:'Meetings', colour:'green'},
  {id:'Report',  label:'Reports',  colour:'teal'},
  {id:'MOM',     label:'MOM Due',  colour:'purple'},
  {id:'Decision',label:'Decisions',colour:'red'},
];
/* Icon/colour treatment for a calendar item's kind — MOM Due borrows the Minutes styling,
   since a MOM write-up deadline is, functionally, a Minutes item. Decision already has its
   own entry in KIND_ICON/KIND_SLOT (used by Work Queue), so it needs no special-casing here. */
const calIconKind = k => k==='MOM' ? 'Minutes' : k;
const calTagColour = k => k==='Report'?'teal' : k==='MOM'?'purple' : k==='Decision'?'red' : 'green';
const calGridCls = i => i.status==='Cancelled' ? 'k-canc'
  : i.kind==='Report' ? 'k-rpt' : i.kind==='MOM' ? 'k-mom' : i.kind==='Decision' ? 'k-dec' : 'k-mtg';
const CAL_DOT = {green:'var(--green)', teal:'var(--teal)', purple:'var(--purple)', red:'var(--red)'};
const CAL_CHIP_STYLE = {
  green: {border:'var(--green)', bg:'var(--green-bg)', text:'var(--green)'},
  teal:  {border:'var(--teal)',  bg:'var(--teal-l)',    text:'var(--teal-d)'},
  purple:{border:'var(--purple)',bg:'var(--purple-bg)', text:'var(--purple)'},
  red:   {border:'var(--red)',   bg:'var(--red-bg)',    text:'var(--red)'},
};

/* A live Dataverse occurrence, shown read-only. The seeded Meeting screen is
   built around demo records and their synthetic ids, so it cannot render one
   of these — this panel shows the row as it actually stands in the table. */
function DvOccurrenceModal({item,onClose}){
  const r=item._rec, isMeeting=item.kind==='Meeting';
  const Row=({label,value})=> value==null||value===''||value==='—' ? null :
    <div style={{display:'flex',gap:12,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:'0 0 190px',fontSize:12,color:'var(--muted)'}}>{label}</div>
      <div style={{flex:1,fontSize:13,overflowWrap:'anywhere'}}>{value}</div></div>;
  const pos=id=>{ const n=dvPos(id); if(!n) return null;
    const h=id&&DV_POS_HOLDER[id]; return h?`${n} — ${h}`:n; };

  return <Modal wide onClose={onClose} title={r.name}
    sub="Read live from Dataverse. Read-only here — the execution screens run on the seeded demo records."
    footer={<Btn onClick={onClose}>Close</Btn>}>
    {isMeeting ? <>
      <Row label="Date" value={r.date?fmtD(r.date):null}/>
      <Row label="Time" value={[r.start,r.end].filter(Boolean).join(' – ')||null}/>
      <Row label="Time zone" value={r.timezone}/>
      <Row label="Status" value={r.status}/>
      <Row label="Mode" value={r.mode}/>
      <Row label="Location" value={r.location}/>
      <Row label="Meeting link" value={r.link}/>
      <Row label="Meeting Template" value={dvTpl(r.templateId)||(r.templateId?'(template not in this list)':null)}/>
      <Row label="Ad Hoc Type" value={r.adhocType}/>
      <Row label="Stage" value={r.stage}/>
      <Row label="Business Unit" value={dvBu(r.businessUnitId)}/>
      <Row label="Region" value={dvRegion(r.regionId)}/>
      <Row label="Department" value={dvDept(r.departmentId)}/>
      <Row label="Chair" value={pos(r.chairPositionId)}/>
      <Row label="Facilitator" value={pos(r.facilitatorPositionId)}/>
      <Row label="Restricted" value={r.restricted?'Yes':null}/>
      <Row label="Invite sent" value={r.inviteSent?fmtD(r.inviteSent):null}/>
      <Row label="Agenda sent" value={r.agendaSent?fmtD(r.agendaSent):null}/>
      <Row label="Cancellation reason" value={r.cancelReason}/>
      <Row label="Outlook / Teams sync" value={r.sync}/>
      <h3 style={{fontSize:13,margin:'16px 0 6px'}}>Agenda</h3>
      {r.agenda.length===0
        ? <div style={{fontSize:12.5,color:'var(--muted)'}}>No agenda items on this occurrence.</div>
        : <table className="data"><tbody>{r.agenda.map(a=>
            <tr key={a.id}><td style={{width:38}} className="dim">{a.seq??'—'}</td>
              <td><div className="t-main">{a.title}</div>
                <div className="t-sub">{[a.source,pos(a.ownerPositionId)].filter(Boolean).join(' · ')||'—'}</div></td>
              <td style={{width:150,textAlign:'right'}}>
                <Tag c={a.covered==='Yes'?'green':a.covered==='No'?'red':'grey'}>{a.covered||'Not Yet Recorded'}</Tag></td>
            </tr>)}</tbody></table>}
      <h3 style={{fontSize:13,margin:'16px 0 6px'}}>Attendees</h3>
      {r.attendees.length===0
        ? <div style={{fontSize:12.5,color:'var(--muted)'}}>No attendees on this occurrence.</div>
        : <table className="data"><tbody>{r.attendees.map(a=>
            <tr key={a.id}><td><div className="t-main">{pos(a.positionId)||a.name||'—'}</div>
              {a.delegatePositionId?<div className="t-sub">delegate: {pos(a.delegatePositionId)}</div>:null}</td>
              <td style={{width:110}}>
                <Tag c={a.type==='Optional'?'grey':'teal'}>{a.type||'Required'}</Tag></td>
              <td style={{width:150,textAlign:'right'}}>
                <Tag c={a.present==='Present'?'green':a.present==='Absent'?'red':'grey'}>{a.present||'Not Yet Recorded'}</Tag></td>
            </tr>)}</tbody></table>}
    </> : <>
      <Row label="Period" value={r.period?fmtD(r.period):null}/>
      <Row label="Status" value={r.status}/>
      <Row label="Version" value={r.version!=null?String(r.version):null}/>
      <Row label="Review step" value={r.reviewStep!=null?String(r.reviewStep):null}/>
      <Row label="Report Template" value={dvRptTpl(r.templateId)||(r.templateId?'(template not in this list)':null)}/>
      <Row label="Business Unit" value={dvBu(r.businessUnitId)}/>
      <Row label="Department" value={dvDept(r.departmentId)}/>
      <Row label="Created by" value={pos(r.creatorPositionId)}/>
      <Row label="Objective" value={r.objective}/>
      <Row label="File" value={r.fileUrl}/>
      <Row label="Locked" value={r.locked?'Yes':null}/>
      <Row label="No-Setup flag" value={r.noSetupFlag?'Yes':null}/>
    </>}
  </Modal>;
}

/* Scoped to this screen only, per an explicit ask -- Workspace's own
   calendar-derived widgets (CalendarWebpart, the counts on My Workspace)
   keep reading the unfiltered `cal` from context unchanged. */
function ScreenCalendar(){
  const {cal:calAll,go,openMeeting,dvError,openDvRec,dvLookup,currentUser} = use();
  const [view,setView] = useState('month');   /* month | week | list */
  const [kind,setKind] = useState('All');
  const [ym,setYm]     = useState(TODAY.slice(0,7));

  /* ⚠️ TEMPORARY -- testing only, per explicit ask 22 Sep. Bypasses the
     21 Sep role filter below entirely so every occurrence can be checked
     against what used to show, without needing a second Dataverse user to
     sign in as. Remove this state, the toggle button in the header, and
     the `showAll ? calAll :` branch once testing is done -- the role
     filter itself is not what's being questioned here. */
  const [showAll,setShowAll] = useState(false);

  /* Co-Chairman (Meetings) and Owner Position / Review Chain (Reports) both
     live on the SETUP, not the occurrence -- see fetchMeetingUnitRoles()/
     fetchReportUnitRoles()'s own comments for why. Read once, here, rather
     than at app start: only this screen needs them. */
  const [meetingRoles,setMeetingRoles] = useState(null);
  const [reportRoles,setReportRoles]   = useState(null);
  useEffect(()=>{
    let live = true;
    Promise.all([fetchMeetingUnitRoles(), fetchReportUnitRoles()])
      .then(([m,r])=>{ if(live){ setMeetingRoles(m); setReportRoles(r); } })
      .catch(e=>{
        console.warn('[dataverse] Calendar role lookups failed:', e);
        if(live){
          setMeetingRoles({forOccurrence:()=>null});
          setReportRoles({forOccurrence:()=>({ownerId:null,reviewerIds:new Set()})});
        }
      });
    return ()=>{ live = false; };
  },[]);
  const rolesLoading = meetingRoles===null || reportRoles===null;

  /* Which Positions the signed-in user holds -- same match the sidebar's
     user card and every other "is this mine" screen already use. */
  const mine = useMemo(()=>new Set(dvLookup?.myPositionIds || []), [dvLookup]);

  /* A Meeting shows only when the user is its Chairman, Co-Chairman,
     Organizer/Facilitator, or a named Attendee -- an occurrence with none
     of those matching this user's Positions is left out entirely, per an
     explicit ask, rather than shown dimmed or unfiltered. Attendee match is
     against a Position directly on the row; a Microsoft-Group Attendee
     (19-20 Sep) is not expanded to its members here. */
  const meetingVisible = o => {
    if(o.chairPositionId && mine.has(o.chairPositionId)) return true;
    if(o.facilitatorPositionId && mine.has(o.facilitatorPositionId)) return true;
    const coChair = meetingRoles?.forOccurrence(o);
    if(coChair && mine.has(coChair)) return true;
    return (o.attendees||[]).some(a=>a.positionId && mine.has(a.positionId));
  };
  /* A Report shows only when the user created it (Submitter), holds the
     Setup's Owner Position for its scope, or sits in its Review Chain --
     and a reviewer only counts once the report has actually been
     submitted, not while it is still Draft (nothing to review yet). */
  const reportVisible = r => {
    if(r.creatorPositionId && mine.has(r.creatorPositionId)) return true;
    const roles = reportRoles?.forOccurrence(r);
    if(roles?.ownerId && mine.has(roles.ownerId)) return true;
    if(r.status!=='Draft' && roles?.reviewerIds?.size){
      for(const id of roles.reviewerIds) if(mine.has(id)) return true;
    }
    return false;
  };

  const cal = useMemo(()=>{
    if(showAll) return calAll;   // ⚠️ TEMPORARY testing bypass, see above
    if(rolesLoading || !mine.size) return [];
    return calAll.filter(i=>{
      /* MOM Due is meeting-shaped (its _rec is the Meeting Occurrence, see
         dvMomDueCalItem) -- gated the same way, since a write-up deadline
         for a meeting you hold no role in isn't yours to track either. */
      if(i.kind==='Meeting' || i.kind==='MOM') return meetingVisible(i._rec);
      if(i.kind==='Report') return reportVisible(i._rec);
      return true;
    });
  },[calAll, meetingRoles, reportRoles, mine, rolesLoading, showAll]);

  const vis = kind==='All' ? cal : cal.filter(i=>i.kind===kind);
  /* A live Dataverse row has no seeded record behind it, so it opens the
     read-only panel rather than an execution screen that could not render it. */
  const open = i => i._dv ? openDvRec(i.kind, i._rec)
    : i.screen==='mtg' ? openMeeting(i.id,i.tab||'detail') : go(i.screen,i.id);

  const [y,m]=ym.split('-').map(Number);
  const first=new Date(y,m-1,1), start=new Date(first); start.setDate(1-first.getDay());
  const cells=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);
    return ymd(d);});
  const shift=n=>{const d=new Date(y,m-1+n,1);setYm(ymd(d).slice(0,7));};

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
  /* From today onward, not from Sunday -- a day already past this week
     shouldn't still show up under "This Week's Meetings". */
  const thisWeekMtgs = cal.filter(i=>i.kind==='Meeting' && i.date>=TODAY && i.date<=wk[1]
    && i.status!=='Cancelled').sort(byDateTime);
  const nextWeekMtgs = cal.filter(i=>i.kind==='Meeting' && i.date>=nextWk[0] && i.date<=nextWk[1]
    && i.status!=='Cancelled').sort(byDateTime);
  const MtgRow = ({i}) => {
    /* Every row here is a Dataverse row now, so its detail comes off the
       record the calendar item carries. */
    const meta = [i._rec.location||i._rec.mode,
      i._rec.attendees?.length ? i._rec.attendees.length+' attendees' : null].filter(Boolean);
    return <div className="wa-up-r" onClick={()=>open(i)}>
      <div className="wa-date plain" style={{color:i.date===TODAY?'var(--green)':'var(--ink)'}}>
        <span className="dd">{i.date.slice(8)}</span>
        <span className="mo">{MONTHS[+i.date.slice(5,7)-1]}</span></div>
      <div className="wa-up-t"><div className="n">{i.title}
          {i.date===TODAY && <Tag c="amber">Today</Tag>}
          {i._dv && <Tag c="teal">Live</Tag>}</div>
        <div className="m">{[i.time,...meta].filter(Boolean).join(' · ')}</div></div>
    </div>;
  };

  /* -------- Upcoming Deadlines -------- */
  const deadlines = cal.filter(i=>(i.kind==='Report'||i.kind==='MOM'||i.kind==='Decision') && i.date>=TODAY)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  const relDay = d => { const n=daysBetween(TODAY,d);
    return n<=0?'Today':n===1?'Tomorrow':n+' days'; };

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Calendar</h1>
        <div className="sub">Meetings and reports you hold a role on — Chairman, Co-Chairman,
          Organizer/Facilitator or Attendee for a Meeting; Submitter, Owner, or a Reviewer once it's
          been submitted, for a Report.</div></div>
      <div className="seg seg-gold">
        {['month','week','list'].map(v=>
          <button key={v} className={view===v?'on':''} onClick={()=>setView(v)}>
            {v[0].toUpperCase()+v.slice(1)}</button>)}
      </div>
    </div>

    {dvError && <Note k="warn" ic="⚠">{dvError}</Note>}

    {/* ⚠️ TEMPORARY -- testing only, see the showAll state declaration above.
        Remove this whole Note once testing is done. */}
    <Note k="warn" ic="🧪">
      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
        <input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>
        <span><b>Testing:</b> show all users' occurrences, ignoring the role filter below.
          {showAll ? ' — ON, everyone’s Meetings and Reports are showing.' : ''}</span>
      </label>
    </Note>

    {!showAll && (rolesLoading
      ? <Note k="info" ic="…">Reading which Meetings and Reports you hold a role on…</Note>
      : !mine.size
      ? <Note k="warn" ic="⚠">{currentUser?.fullName
          ? <>You ({currentUser.fullName}) are not linked to any Position in Dataverse, so nothing
              can be matched to a role you hold — the calendar below will stay empty.</>
          : <>You are not linked to a Dataverse user in this session, so nothing can be matched to a
              role you hold — the calendar below will stay empty.</>}</Note>
      : null)}

    <div className="fltr" style={{justifyContent:'space-between'}}>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <Btn k="sm" onClick={()=>shift(-1)}>←</Btn>
        <b style={{fontSize:14,minWidth:132,textAlign:'center'}}>{MONTHS[m-1]} {y}</b>
        <Btn k="sm" onClick={()=>shift(1)}>→</Btn>
        <Btn k="sm" onClick={()=>setYm(TODAY.slice(0,7))}>Today</Btn>
      </div>
      <div className="chip-row" style={{margin:0}}>
        {CAL_KINDS.map(k=>{
          const on = kind===k.id, cs = k.colour && CAL_CHIP_STYLE[k.colour];
          const style = cs ? {borderColor:cs.border, background:on?cs.bg:'#fff', color:cs.text}
            : {borderColor:'var(--border-d)',color:'var(--ink-2)'};
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
            <div className="cal-n"><span className={d===TODAY?'cal-today-num':''}>{+d.slice(8)}</span>
              {isNonWorking(d)&&!out && <span className="nw">NON-WORKING</span>}</div>
            {evs.map((i,n)=><div key={i.kind+i.id+n} className={'cal-e '+calGridCls(i)} onClick={()=>open(i)}
                title={i.title+' · '+i.sub}>
              {i.restricted?'🔒 ':''}{i.time?i.time+' ':''}{i.title}</div>)}
          </div>;})}
      </div>
      <div style={{display:'flex',gap:15,flexWrap:'wrap',marginTop:11,fontSize:11.5,color:'var(--muted)'}}>
        <span><span className="tag green" style={{padding:'1px 7px'}}>&nbsp;</span> Meetings</span>
        <span><span className="tag teal" style={{padding:'1px 7px'}}>&nbsp;</span> Reports</span>
        <span><span className="tag purple" style={{padding:'1px 7px'}}>&nbsp;</span> MOM Due</span>
        <span><span className="tag red" style={{padding:'1px 7px'}}>&nbsp;</span> Decisions</span>
        <span><span className="tag grey" style={{padding:'1px 7px'}}>&nbsp;</span> Cancelled</span>
      </div>
    </div>}

    {/* From today through Saturday, not from Sunday -- same "don't show a day
        already past this week" rule "This Week's Meetings" below already
        applies, now also on the Week tab itself, which used to show the
        whole Sun-Sat range including days that had already passed. */}
    {view==='week' && <div className="card">
      <h2>{fmtDS(TODAY)} – {fmtDS(wk[1])}</h2>
      <div className="csub" style={{marginBottom:2}}>Every item from today through the end of the week, whatever kind.</div>
      {vis.filter(i=>i.date>=TODAY&&i.date<=wk[1]).length===0 ? <Empty ic="🗓">Nothing left this week.</Empty>
      : vis.filter(i=>i.date>=TODAY&&i.date<=wk[1]).sort(byDateTime)
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
          <div className="wa-icon green">🗓</div><h2 style={{flex:1}}>This Week's Meetings</h2>
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
            <div className="wa-date plain"
              style={{color:i.kind==='MOM'?'var(--purple)':i.kind==='Decision'?'var(--red)':'var(--teal-d)'}}>
              <span className="dd">{i.date.slice(8)}</span>
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

/* Due date of a Report Submission, from the reporting period and the approved Setup. */
function reportDue(r){
  if(!r.setup) return null;
  const s=RS(r.setup); if(!s.dueDay) return null;
  return r.period+'-'+String(s.dueDay).padStart(2,'0');
}

/* =========================================================================
   LIVE DATAVERSE LAYER — occurrences and the reference data they point at
   =========================================================================
   The rest of this module runs on seeded demo records keyed by synthetic ids
   ('u2', 'AHJ', 'ms1'), and its permission model hangs off fields that only
   exist on those seeds (mgr / lvl / scope / fam). Real occurrence rows key
   off Dataverse GUIDs instead, and there is no mapping between the two.

   So live rows are kept as their OWN records rather than being folded into
   the seeded ones: the Calendar merges both, and a live row opens a read-only
   detail panel instead of the seeded Meeting screen, which could not render
   it. Nothing here mutates the demo state.
   ========================================================================= */

/* GUID -> display name, filled from Dataverse on mount. Plain objects rather
   than state because they are read from render paths all over this file. */
let DV_BU_NAME={}, DV_POS_NAME={}, DV_POS_HOLDER={}, DV_DEPT_NAME={}, DV_FUNC_NAME={}, DV_TPL_NAME={}, DV_TPL_DETAIL={};
/* Same shape, for Report Templates -- kept separate from DV_TPL_NAME above,
   which only ever holds Meeting Templates. */
let DV_RPT_TPL_NAME={}, DV_RPT_TPL_DETAIL={}, DV_RPT_TPL_LIST=[];
/* The same reference data as lists, for the pickers on the Custom Ad Hoc form
   -- a Dataverse lookup only accepts a real row id, so that form cannot offer
   the seeded PEOPLE/BUS ids the rest of this module uses. */
let DV_BU_LIST=[], DV_POS_LIST=[], DV_TPL_LIST=[], DV_REGION_LIST=[], DV_DEPT_LIST=[], DV_FUNC_LIST=[];
let DV_REGION_NAME={};
const dvRegion = id => (id && DV_REGION_NAME[id]) || null;
/* The two time zones the group operates in. lm_timezone is a plain text column,
   so the Windows time-zone id is what gets written. */
const TIME_ZONES=[
  /* The id is saved to lm_timezone and read by flows as a WINDOWS time zone
     name, so it must be a real one: Riyadh is "Arab Standard Time". It was
     "Arabia Standard Time" until 30 Sep, which convertFromUtc() rejects --
     meetings saved before then still carry it; the invite flow maps it. */
  {id:'Arab Standard Time', label:'KSA — (UTC+03:00) Riyadh', match:/saudi|ksa/i},
  {id:'Egypt Standard Time',  label:'Egypt — (UTC+02:00) Cairo', match:/egypt|egy/i},
];
/* Best time zone for a Region name, so choosing scope pre-selects it. */
const tzForRegionName = name => (TIME_ZONES.find(t=>name&&t.match.test(name))||TIME_ZONES[0]).id;

/* The Business Units a Meeting's scope covers. Both Departments and Positions
   hang off a Business Unit, and a Business Unit belongs to a Region -- so Stage
   1 covers the one chosen Business Unit, Stage 2 covers every Business Unit
   inside the chosen Region, and Group / ExCom cover everything.

   Returns null for "no narrowing at all", which is deliberately different from
   an empty set: an empty set means a scope was expected but not chosen yet, and
   nothing should be offered until it is. */
function scopeBuIds(stage, buId, regionId){
  if(stage==='Business Unit') return buId ? new Set([buId]) : new Set();
  if(stage==='Region'){
    if(!regionId) return new Set();
    return new Set(DV_BU_LIST.filter(b=>b.region===regionId).map(b=>b.id));
  }
  return null;
}
/* The Departments a Meeting may pick from, narrowed to its scope.

   A Department row carries no Business Unit of its own -- the relationship
   lives in the Organization Structure, where every position assignment names
   both. So the Departments inside a Business Unit are the ones its positions
   actually sit in, which is also why this and the Chair list stay consistent:
   both come from the same rows. */
function departmentsForScope(stage, buId, regionId){
  const ids=scopeBuIds(stage, buId, regionId);
  if(ids===null) return DV_DEPT_LIST;
  if(!ids.size) return [];
  const inScope=new Set();
  DV_POS_LIST.forEach(p=>{ if(p.dept && p.bu && ids.has(p.bu)) inScope.add(p.dept); });
  return DV_DEPT_LIST.filter(d=>inScope.has(d.id));
}
/* The Positions a Meeting may name as Chair, narrowed the same way -- a
   Position assignment carries the Business Unit it sits in. */
function positionsForScope(stage, buId, regionId){
  const ids=scopeBuIds(stage, buId, regionId);
  if(ids===null) return DV_POS_LIST;
  return DV_POS_LIST.filter(p=>p.bu && ids.has(p.bu));
}
const dvBu    = id => (id && DV_BU_NAME[id])   || null;
const dvPos   = id => (id && DV_POS_NAME[id])  || null;
const dvDept  = id => (id && DV_DEPT_NAME[id]) || null;
const dvFunc  = id => (id && DV_FUNC_NAME[id]) || null;
const dvTpl   = id => (id && DV_TPL_NAME[id])  || null;
const dvTplDetail = id => (id && DV_TPL_DETAIL[id]) || null;
const dvRptTpl = id => (id && DV_RPT_TPL_NAME[id]) || null;
const dvRptTplDetail = id => (id && DV_RPT_TPL_DETAIL[id]) || null;
const dvRptCfg = r => {
  const tpl = r.templateId ? dvRptTplDetail(r.templateId) : null;
  return tpl ? { cat: tpl.category || 'Custom', reviewers: tpl.reviewers || [] } : { cat: 'Custom', reviewers: [] };
};

/* One Dataverse Meeting Occurrence as a Calendar entry, in the same shape
   calendarItems() produces for seeded records so both render identically. */
function dvMeetingCalItem(o){
  const kindBits=[o.adhocType ? 'Ad Hoc '+o.adhocType : (dvTpl(o.templateId)||'Meeting')];
  if(o.mode) kindBits.push(o.mode);
  // Scope reads as whichever the Stage put on the row.
  const buName=dvBu(o.businessUnitId)||dvRegion(o.regionId);
  return {
    id:o.id, kind:'Meeting', date:o.date, time:o.start, title:o.name,
    cls:o.status==='Cancelled'?'canc':o.restricted?'restr':o.status==='Held'?'held':'due',
    status:o.status, sub:kindBits.join(' · ')+(buName?' · '+buName:''),
    bu:o.businessUnitId, type:o.adhocType?'Ad Hoc':'Meeting',
    restricted:o.restricted, _dv:true, _rec:o,
  };
}

/* One Dataverse Report Occurrence as a Calendar entry. Its period is the date
   the calendar places it on -- there is no separate due-date column. */
function dvReportCalItem(r){
  const buName=dvBu(r.businessUnitId);
  return {
    id:r.id, kind:'Report', date:r.period, time:null,
    title:r.name, cls:'rpt', status:r.status,
    sub:[r.status, dvTpl(r.templateId), buName].filter(Boolean).join(' · '),
    bu:r.businessUnitId, type:'Report', _dv:true, _rec:r,
  };
}

/* A Held Meeting's MOM write-up deadline, as a Calendar entry -- only while
   the write-up is genuinely still outstanding. Uses the exact same clock
   AG-16 scoring already reads (`S.momWriteupHours`, the global default --
   the per-Setup Completion Period isn't consumed by scoring, or here,
   either, see PROJECT-CONTEXT.md §9) and the same "no Minutes row yet, or
   one that exists but was never submitted" test the Meetings screen's own
   `momOverdue` exception list already uses, so this can't disagree with
   either of those about which meetings still owe a write-up. */
function dvMomDueCalItem(o, hours){
  const due = addHours(o.date+' '+o.end, hours);
  const [date,time] = due.split(' ');
  const buName=dvBu(o.businessUnitId)||dvRegion(o.regionId);
  return {
    id:o.id, kind:'MOM', date, time, title:'MOM Due: '+o.name,
    cls: due<nowStamp() ? 'canc' : 'due', status:null,
    sub:'Write-up for '+o.name+(buName?' · '+buName:''),
    bu:o.businessUnitId, type:'MOM', _dv:true, _rec:o,
  };
}

/* What the live tables say still needs doing, in the same shape openItems()
   produces for seeded records so the Workspace renders both side by side.

   Only what the occurrence rows themselves can prove is listed. A live Meeting
   has no Minutes or Audit Grid record behind it — those live in seeded state —
   so a Held Meeting is reported as needing its Minutes, and nothing further is
   inferred about a governance record that does not exist yet. */
function dvWorkItems(meetingOccs, reportOccs){
  const due=[], review=[], finish=[];
  const mk=(bucket,area,rec,title,sub,action,date,urgent)=>
    bucket.push({area, rid:rec.id, title, sub, action,
                 owner:null, date:date||null, urgent:!!urgent,
                 tab:null, screen:'mtg', _dv:true, _rec:rec});

  meetingOccs.forEach(o=>{
    const when=[o.date?fmtD(o.date):null, o.start].filter(Boolean).join(' · ');
    const scope=dvBu(o.businessUnitId)||dvRegion(o.regionId);
    const sub=[when, scope].filter(Boolean).join(' · ');
    if(o.status==='Scheduled'){
      if(!o.agenda.length)
        mk(due,'Meeting',o,o.name,sub,
           'Add at least one Agenda Item — the Meeting cannot proceed without one',o.date,true);
      else if(!o.agendaSent)
        mk(due,'Meeting',o,o.name,sub,'Distribute the Agenda ahead of the Meeting',o.date,false);
      if(!o.attendees.length)
        mk(due,'Meeting',o,o.name,sub,'No Attendees on this Meeting yet',o.date,true);
      /* Independent of attendee recording -- a Meeting stuck in Scheduled
         past its date needs this regardless of whether none, some, or all
         of its Attendees already have a presence recorded. Was previously
         gated on EVERY Attendee being unrecorded, which meant a Meeting
         with even one Attendee already marked silently vanished from the
         Work Queue despite still needing to be closed out. */
      if(o.date && o.date<TODAY)
        mk(finish,'Meeting',o,o.name,sub+' · past its date, still Scheduled',
           'Mark the Meeting as Held, or cancel it',o.date,true);
    }
    if(o.status==='Held'){
      const notCovered=o.agenda.filter(a=>!a.covered||a.covered==='Not Yet Recorded').length;
      if(notCovered)
        mk(finish,'Minutes',o,o.name,sub+' · held',
           `Record the outcome of ${notCovered} Agenda Item${notCovered===1?'':'s'}`,o.date,true);
      const noAttendance=o.attendees.filter(a=>!a.present||a.present==='Not Yet Recorded').length;
      if(noAttendance)
        mk(finish,'Meeting',o,o.name,sub+' · held',
           `Record attendance for ${noAttendance} Attendee${noAttendance===1?'':'s'}`,o.date,true);
    }
  });

  reportOccs.forEach(r=>{
    const scope=dvBu(r.businessUnitId)||dvRegion(r.regionId);
    const sub=[r.period?fmtD(r.period):null, dvDept(r.departmentId), scope].filter(Boolean).join(' · ');
    if(r.status==='Draft')
      mk(due,'Report',r,r.name,sub,
         r.fileUrl?'Prepare the working copy and submit':'Generate the working copy, then submit',
         r.period,false);
    if(r.status==='In Review')
      mk(review,'Report',r,r.name,
         sub+(r.reviewStep!=null?' · review step '+r.reviewStep:''),
         'Review — approve, comment or request more information',r.period,false);
    if(r.status==='Returned')
      mk(due,'Report',r,r.name,sub+' · returned',
         'Address the reviewer’s comments and resubmit',r.period,true);
  });

  return {due,review,finish};
}

/* =========================================================================
   APP
   ========================================================================= */
const KEY='andalusia_lp_v07';

function App({onSwitch}){
  const [db,setDb]     = useState(()=>{ try{ const s=localStorage.getItem(KEY);
                                          return s?JSON.parse(s):seed(); }catch(e){ return seed(); } });
  const me            = ME;      /* one signed-in user, full access */
  const [bu,setBu]     = useState('ALL');
  const [businessUnits,setBusinessUnits] = useState(BUS);
  const [navOpen,setNavOpen] = useState(true);
  const [currentUser,setCurrentUser] = useState(null);
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
  /* A live Dataverse row has no seeded record behind it, so wherever one is
     clicked -- Workspace, Calendar or Meetings -- it opens the read-only panel
     rather than an execution screen that could not render it. */
  const [dvOpen,setDvOpen]=useState(null);
  /* Create Report is a page (28 Sep); this is the screen it was opened from,
     so its Cancel can go back there. */
  const [newReportReturn,setNewReportReturn]=useState('orpt');
  /* A live Meeting Occurrence has a full detail page of its own, so it navigates
     there -- straight to the Minutes tab for a MOM Due calendar item, since
     that is the one thing there is to do about it. A live Report Occurrence
     has no page yet, so it opens the read-only panel instead. */
  const openDvRec=(kind,rec)=> kind==='Report'
    ? setDvOpen({kind:'Report',_rec:rec})
    : openMeeting(rec.id, kind==='MOM' ? 'minutes' : 'detail');
  const openWork=w=> w._dv ? openDvRec(w.area==='Report'?'Report':'Meeting', w._rec)
    : w.tab ? openMeeting(w.rid,w.tab) : go(w.screen,w.rid);
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
  /* ---------------- section templates ----------------------------------
     Templates are data, not code. Adding a Report type is configuration
     done here; nothing about it requires a change to the system. */
  addTemplate:(then)=>{ const id=uid('tpl');
    mut(n=>{ n.templates=[...(n.templates||[]),
      {id,n:'New template',cat:'Custom',desc:'',sections:[]}]; });
    toast('Template created','Name it, then add the sections a Report of this type always needs.','ok');
    if(then) then(id); },
  editTemplate:(id,patch)=>mut(n=>{
    const t=n.templates.find(x=>x.id===id); if(t) Object.assign(t,patch); }),
  deleteTemplate:(id)=>mut(n=>{
    n.templates=n.templates.filter(x=>x.id!==id);
    toast('Template deleted','Reports already built from it keep their sections.','ok'); }),
  addTplSection:(id)=>mut(n=>{
    const t=n.templates.find(x=>x.id===id);
    t.sections=[...t.sections,{h:'',diag:'',cites:[]}]; }),
  editTplSection:(id,i,patch)=>mut(n=>{
    const t=n.templates.find(x=>x.id===id); Object.assign(t.sections[i],patch); }),
  moveTplSection:(id,i,dir)=>mut(n=>{
    const t=n.templates.find(x=>x.id===id), s=[...t.sections], j=i+dir;
    if(j<0||j>=s.length) return; [s[i],s[j]]=[s[j],s[i]]; t.sections=s; }),
  removeTplSection:(id,i)=>mut(n=>{
    const t=n.templates.find(x=>x.id===id); t.sections=t.sections.filter((_,j)=>j!==i); }),
  addTplItem:(id,i,ref)=>mut(n=>{
    const s=n.templates.find(x=>x.id===id).sections[i];
    if(!s.cites.includes(ref)) s.cites=[...s.cites,ref]; }),
  removeTplItem:(id,i,ci)=>mut(n=>{
    const s=n.templates.find(x=>x.id===id).sections[i];
    s.cites=s.cites.filter((_,j)=>j!==ci); }),
  /* ---------------- report composition ---------------------------------
     A Report is its sections, and a section is a paragraph in the shared
     pool. These actions move paragraph ids on and off a Report; the text
     itself exists in exactly one place, which is what makes a paragraph
     cited into two Reports the same paragraph rather than a copy. */
  applyTemplate:(id,tplId)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id), t=tplOf(n,tplId); if(!t) return;
    const proc=(rptCfg(r).processes||[])[0]||'';
    t.sections.forEach(s=>{
      const pid=uid('par');
      n.paragraphs.push({id:pid,h:s.h,text:'',diag:s.diag||'',proc,
        cites:[...s.cites],author:me,at:nowStamp()});
      r.blocks=[...(r.blocks||[]),pid];
    });
    r.history.push({at:nowStamp(),who:me,
      act:'Sections inserted from the “'+t.n+'” template — '+t.sections.length+' sections'});
    logIt(n,id,'Sections inserted from template');
    toast('Template inserted',
      t.sections.length+' sections added, already carrying this period’s figures. Every one stays editable.','ok');
  }),
  addSection:(id)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id), pid=uid('par');
    n.paragraphs.push({id:pid,h:'',text:'',diag:'',proc:(rptCfg(r).processes||[])[0]||'',
      cites:[],author:me,at:nowStamp()});
    r.blocks=[...(r.blocks||[]),pid];
  }),
  reuseSection:(id,pid)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id);
    if((r.blocks||[]).includes(pid)) return;
    r.blocks=[...(r.blocks||[]),pid];
    const used=n.reports.filter(x=>(x.blocks||[]).includes(pid)).length;
    r.history.push({at:nowStamp(),who:me,act:'Existing paragraph inserted as a section — now shared across '+used+' Reports'});
    toast('Paragraph reused','It is the same paragraph, not a copy. Editing it here changes it in all '+used+' Reports it appears in.','ok');
  }),
  removeSection:(id,pid)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id);
    r.blocks=(r.blocks||[]).filter(b=>b!==pid);
    /* the paragraph itself stays in the pool — it may be cited elsewhere */
    const still=n.reports.some(x=>(x.blocks||[]).includes(pid));
    toast('Section removed', still
      ? 'Removed from this Report. The paragraph stays in the pool — it is still used elsewhere.'
      : 'Removed from this Report. The paragraph stays in the pool and can be cited again.','ok');
  }),
  moveSection:(id,pid,dir)=>mut(n=>{
    const r=n.reports.find(x=>x.id===id), b=[...(r.blocks||[])];
    const i=b.indexOf(pid), j=i+dir;
    if(i<0||j<0||j>=b.length) return;
    [b[i],b[j]]=[b[j],b[i]]; r.blocks=b;
  }),
  editPara:(pid,patch)=>mut(n=>{
    const p=n.paragraphs.find(x=>x.id===pid); if(!p) return;
    Object.assign(p,patch);
  }),
  citePara:(pid,ref)=>mut(n=>{
    const p=n.paragraphs.find(x=>x.id===pid); if(!p) return;
    if(!p.cites.includes(ref)) p.cites=[...p.cites,ref];
  }),
  uncitePara:(pid,ref)=>mut(n=>{
    const p=n.paragraphs.find(x=>x.id===pid); if(!p) return;
    p.cites=p.cites.filter(c=>c!==ref);
  }),
  /* Multi-step Create Report wizard — either from an approved Setup (f.setupId) or Custom
     (f.setupId==='custom'). f.tpl names the section template the Report starts from; its
     sections are created in the shared pool here. f.submit decides whether this lands as a
     Draft or goes straight to In Review. */
  createReportFromWizard:(f)=>mut(n=>{
    const id=uid('sub');
    const isCustom = f.setupId==='custom';
    const setup = isCustom?null:RPT_SETUPS.find(s=>s.id===f.setupId);
    const t = f.tpl?tplOf(n,f.tpl):null;
    const proc = isCustom?'':((setup.processes||[])[0]||'');
    const blocks = [];
    if(t) t.sections.forEach(s=>{
      const pid=uid('par');
      n.paragraphs.push({id:pid,h:s.h,text:'',diag:s.diag||'',proc,
        cites:[...s.cites],author:me,at:nowStamp()});
      blocks.push(pid);
    });
    n.reports.push({id, setup:isCustom?null:f.setupId, period:f.period, bu:f.bu||'ALL', dept:f.dept,
      status:f.submit?'In Review':'Draft', creator:me, step:0,
      blocks, ver: blocks.length?1:0, locked:false,
      custom: isCustom ? {name:f.title, cat:'Custom', objective:f.summary||f.title, site:f.site,
        folder:f.folder, reviewers:f.reviewers, kpis:[], processes:[], tpl:f.tpl||null,
        noSetupFlag:true, taxonomyState:'Queued'} : null,
      summary:f.summary||null, actions:f.actions||null,
      history:[
        {at:nowStamp(),who:me,act:isCustom?'Custom Report created — no approved Setup exists'
                                          :'Report created from approved Setup'},
        ...(isCustom?[{at:nowStamp(),who:null,act:'Metadata queued for Taxonomy with a No-Setup flag'}]:[]),
        ...(t?[{at:nowStamp(),who:me,
            act:t.sections.length+' sections created from the “'+t.n+'” template'}]:[]),
        ...(f.submit?[{at:nowStamp(),who:me,act:'Submitted for review'}]:[]),
      ]});
    logIt(n,id,f.submit?'Report submitted for review':'Report saved as Draft');
    toast(f.submit?'Report submitted for review':'Draft saved',
      f.submit?`Routed to ${P((isCustom?f.reviewers:setup.reviewers)[0]).name} as review step 1.`
              :'Find it any time under Due to Submit in My Reports.','ok');
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

  /* ---------------- meeting actions ------------------------------------ */
  createOcc:(f)=>mut(n=>{
    const id=uid('occ'); let date=f.date, resched=null;
    if(isNonWorking(date)){ resched=date;
      while(isNonWorking(date)) date=addDays(date,1); }
    n.occs.push({id,setup:f.setup||null,bu:f.bu,
      custom:f.setup?null:{name:f.name,purpose:f.purpose,noSetupFlag:true,taxonomyState:'Queued',
                           dept:f.dept,stage:f.stage},
      date,start:f.start,end:f.end,tz:'Arab Standard Time',mode:f.mode,
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
      'The Audit Grid has been created and auto-scored.','ok'); }),
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

  /* Live rows from lm_meetingoccurrences / lm_reportoccurrences, plus the
     reference data their lookups point at. Reference data is loaded first so
     the calendar never renders a bare GUID; a failure on any one of these
     leaves the seeded calendar working on its own. */
  const [dvMeetingOccs,setDvMeetingOccs]=useState([]);
  const [dvReportOccs,setDvReportOccs]=useState([]);
  const [dvMinutes,setDvMinutes]=useState([]);
  const [dvGridInstances,setDvGridInstances]=useState([]);
  const [dvDecisions,setDvDecisions]=useState([]);
  const [dvTick,setDvTick]=useState(0);        // bumped when the name maps change
  const [dvLoading,setDvLoading]=useState(true);
  const [dvError,setDvError]=useState(null);

  const refreshOccurrences=async()=>{
    let failed=null;
    try{
      const list=await fetchMeetingOccurrences();
      setDvMeetingOccs(list||[]);
    }catch(e){ console.warn('[dataverse] fetchMeetingOccurrences() failed:', e); failed=e; }
    try{
      const list=await fetchReportOccurrences();
      setDvReportOccs(list||[]);
    }catch(e){ console.warn('[dataverse] fetchReportOccurrences() failed:', e); failed=failed||e; }
    try{
      const list=await fetchMeetingMinutes();
      setDvMinutes(list||[]);
    }catch(e){ console.warn('[dataverse] fetchMeetingMinutes() failed:', e); failed=failed||e; }
    try{
      const list=await fetchAuditGridInstances();
      setDvGridInstances(list||[]);
    }catch(e){ console.warn('[dataverse] fetchAuditGridInstances() failed:', e); failed=failed||e; }
    try{
      const list=await fetchWorkLogDecisions();
      setDvDecisions(list||[]);
    }catch(e){ console.warn('[dataverse] fetchWorkLogDecisions() failed:', e); failed=failed||e; }
    setDvError(failed?'Live occurrences could not be read from Dataverse. The seeded demo calendar is shown on its own.':null);
  };

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      // Names first, so a live row never renders as a raw GUID.
      const load=async(fn,label,apply)=>{
        try{ const rows=await fn(); if(!cancelled&&rows) apply(rows); }
        catch(e){ console.warn(`[dataverse] ${label} failed:`, e); }
      };
      await Promise.all([
        load(fetchBusinessUnits,'fetchBusinessUnits',rows=>{
          DV_BU_NAME={}; rows.forEach(r=>{ DV_BU_NAME[r.id]=r.name; });
          DV_BU_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||''));
          setBusinessUnits(rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||''))); }),
        load(fetchPositions,'fetchPositions',rows=>{
          DV_POS_NAME={}; DV_POS_HOLDER={};
          rows.forEach(r=>{ DV_POS_NAME[r.id]=r.name; DV_POS_HOLDER[r.id]=r.holder||null; });
          DV_POS_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchDepartments,'fetchDepartments',rows=>{
          DV_DEPT_NAME={}; rows.forEach(r=>{ DV_DEPT_NAME[r.id]=r.name; });
          DV_DEPT_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchFunctions,'fetchFunctions',rows=>{
          DV_FUNC_NAME={}; rows.forEach(r=>{ DV_FUNC_NAME[r.id]=r.name; });
          DV_FUNC_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchRegions,'fetchRegions',rows=>{
          DV_REGION_NAME={}; rows.forEach(r=>{ DV_REGION_NAME[r.id]=r.name; });
          DV_REGION_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchMeetingTemplatesList,'fetchMeetingTemplatesList',rows=>{
          DV_TPL_NAME={}; DV_TPL_DETAIL={};
          rows.forEach(r=>{ DV_TPL_NAME[r.id]=r.name; DV_TPL_DETAIL[r.id]=r; });
          DV_TPL_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchReportTemplatesList,'fetchReportTemplatesList',rows=>{
          DV_RPT_TPL_NAME={}; DV_RPT_TPL_DETAIL={};
          rows.forEach(r=>{ DV_RPT_TPL_NAME[r.id]=r.name; DV_RPT_TPL_DETAIL[r.id]=r; });
          DV_RPT_TPL_LIST=rows.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'')); }),
        load(fetchCurrentUser,'fetchCurrentUser',user=>setCurrentUser(user)),
      ]);
      if(cancelled) return;
      setDvTick(t=>t+1);
      await refreshOccurrences();
      if(!cancelled) setDvLoading(false);
    })();
    return ()=>{cancelled=true;};
  },[]);

  /* Open work, derived only from what the occurrence tables hold. The seeded
     demo records no longer feed this screen. The Reports, Minutes, Audit Grid
     and Decisions screens still read seeded state directly and are unchanged.
     dvTick is a dependency because the GUID->name maps the live items read from
     are plain objects, not state. */
  const work = useMemo(()=>{
    const {due,review,finish}=dvWorkItems(dvMeetingOccs,dvReportOccs);
    return {due,review,finish,all:[...due,...review,...finish]};
  },[dvMeetingOccs,dvReportOccs,dvTick]);
  /* The calendar reads the occurrence tables, plus one derived kind: a MOM
     Due deadline for every Held Meeting whose write-up genuinely still owes
     (no Minutes row, or one that was never submitted) -- the same test
     dvMomDueCalItem's own comment traces back to the Meetings screen's
     `momOverdue` list, so the two can't disagree about which meetings
     still owe a write-up. Re-derived, not read from anywhere seeded: this
     used to come from seeded Minutes and was removed along with them; this
     is the live equivalent, added back on request.
     dvTick is a dependency because the GUID->name maps the live items read from
     are plain objects, not state -- without it the first render after they load
     would keep the earlier, name-less labels. */
  const cal  = useMemo(()=>{
    const momDue = S.momWriteupHours==null ? [] : dvMeetingOccs
      .filter(o=>o.status==='Held' && o.end)
      .filter(o=>{
        const m = dvMinutes.find(x=>x.occurrenceId===o.id);
        return !(m && m.submittedAt);
      })
      .map(o=>dvMomDueCalItem(o, S.momWriteupHours));
    return [
      ...dvMeetingOccs.filter(o=>o.date).map(dvMeetingCalItem),
      ...dvReportOccs.filter(r=>r.period).map(dvReportCalItem),
      ...momDue,
    ];
  },[dvMeetingOccs,dvReportOccs,dvMinutes,S.momWriteupHours,dvTick]);
  const counts = useMemo(()=>{
    const c={work:work.due.length+work.finish.length};
    work.all.forEach(w=>{ c[w.screen]=(c[w.screen]||0)+1; });
    return c;
  },[work]);

  /* Name lookups, and which Positions the signed-in user holds, for screens
     that live in their own files and so cannot reach the module-level DV_*
     tables above.

     A Position is "mine" by ID, not by matching text: fetchPositions()
     resolves each Position's current holder back through the Organization
     Structure's own Current Employee lookup to a real systemuserid
     (holderUserId), the same identity fetchCurrentUser() resolves the
     signed-in user to -- see dataverse.js's fetchEmployeeIndex() comment
     for the exact chain. Matching by id rather than by name avoids the
     usual traps (case, a shortened or differently-ordered name, two people
     sharing one) that a text comparison can't tell apart.

     The old name match is kept as a fallback, not removed: it only runs
     when the id match finds nothing, covering a Position whose holder
     chain doesn't resolve to a systemuser for some reason (hr_User blank,
     or an Organization Structure row Current Employee never filled in). */
  const myPositionIdsById = currentUser?.systemUserId
    ? DV_POS_LIST.filter(p => p.holderUserId && p.holderUserId === currentUser.systemUserId).map(p => p.id)
    : [];
  const myPositionIdsByName = (!myPositionIdsById.length && currentUser?.fullName)
    ? DV_POS_LIST.filter(p => p.holder && p.holder.toLowerCase() === currentUser.fullName.toLowerCase()).map(p => p.id)
    : [];
  const myPositionIds = myPositionIdsById.length ? myPositionIdsById : myPositionIdsByName;
  const dvLookup = { bu:dvBu, region:dvRegion, pos:dvPos, dept:dvDept, func:dvFunc, rptTpl:dvRptTpl, myPositionIds,
                     deptList:DV_DEPT_LIST, funcList:DV_FUNC_LIST };
  const ctx = {db,setDb,mut,me,bu,setBu,businessUnits,navOpen,setNavOpen,currentUser,screen,go,openMeeting,openWork,sel,setSel,
               toast,toasts,reset,S,A,work,cal,counts,onSwitch,
               dvMeetingOccs,dvReportOccs,dvMinutes,dvGridInstances,dvDecisions,dvLoading,dvError,refreshOccurrences,
               /* bumped when the module-level name/Setup maps (DV_TPL_DETAIL…) load --
                  a screen memoising anything read through dvTplDetail() depends on it */
               dvTick,
               dvOpen,setDvOpen,openDvRec,dvLookup,
               /* Opens the Create Report page. On the context on purpose:
                  OrgReports.jsx's header rule forbids it importing anything
                  from this file, so only this opener travels. */
               newReportReturn,
               openNewReport:()=>{ setNewReportReturn(screen==='newrpt'?newReportReturn:screen); go('newrpt'); }};
  const Screen = SCREEN_BY_ID[screen] || SCREEN_BY_ID.work;

  return <Ctx.Provider value={ctx}>
    <TopBar/>
    <div className={'shell'+(navOpen?'':' lp-nav-closed')}>
      <Side/>
      {/* `wide` on the registry entry drops the 1380px reading cap — for dense
          tables, the calendar, and the Governance Settings card grid. */}
      <main className={'main'+(WIDE_SCREENS.has(screen)?' full':'')}><Screen/></main>
    </div>
    <Toasts/>
    {dvOpen ? <DvOccurrenceModal item={dvOpen} onClose={()=>setDvOpen(null)}/> : null}
    {/* Built 02 Sep, rendered nowhere since it was cut from the nav. It reads
        the approved Report Templates live and creates a real Report
        Occurrence, so it is connected rather than rebuilt. */}
  </Ctx.Provider>;
}
/* =========================================================================
   1 · MY WORKSPACE
   ========================================================================= */
/* Each Area gets its own colour so the type reads at a glance, without having
   to read the label -- Report/Meeting match the same gold/green split the
   Calendar screen already uses for those two kinds. */
const AREA_C = {'Report':'teal','Meeting':'green','Minutes':'blue',
                'Audit Grid':'purple','Decision':'amber','Task':'grey'};

function ItemTable({rows,dateLabel}){
  const {go,openMeeting,openDvRec} = use();
  const open=w=> w._dv ? openDvRec(w.area==='Report'?'Report':'Meeting', w._rec)
    : w.screen==='mtg' ? openMeeting(w.rid,w.tab||'detail') : go(w.screen,w.rid);
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
  const {work,cal,go,openMeeting,openDvRec,dvMeetingOccs,dvReportOccs,openNewReport} = use();
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
  const actionVerb = w => w.urgent ? 'Follow Up'
    : w.area==='Meeting' ? 'Prepare' : w.area==='Report' ? 'Track' : w.area==='Decision' ? 'View'
    : w.area==='Minutes' ? 'Follow Up' : w.area==='Audit Grid' ? 'Score' : w.area==='Task' ? 'Execute'
    : 'Open';

  const upcoming = cal.filter(i=>i.date>=TODAY && i.status!=='Cancelled')
    .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,4);

  const weekBounds = rangeBounds('week');
  const meetingsThisWeek = cal.filter(i=>i.kind==='Meeting' && i.date>=weekBounds[0] && i.date<=weekBounds[1]);
  const overdueReports = overdue.filter(w=>w.area==='Report').length;

  /* Activity, read from the occurrence tables. Minutes, Decisions and Audit
     Grid figures are gone from here -- those records do not exist in Dataverse,
     so there is nothing real to count. */
  const meetingsHeld  = dvMeetingOccs.filter(o=>o.status==='Held').length;
  const meetingsTotal = dvMeetingOccs.filter(o=>o.status!=='Cancelled').length;
  const reportsSubmitted = dvReportOccs.filter(r=>r.status && r.status!=='Draft').length;
  const reportsApproved  = dvReportOccs.filter(r=>r.status==='Approved').length;
  const agendaRecorded = dvMeetingOccs.filter(o=>o.status==='Held'
    && o.agenda.length && o.agenda.every(a=>a.covered && a.covered!=='Not Yet Recorded')).length;


  /* Restyled 28 Sep to the approved design (`leadership-practice (2).html`,
     #v-workarea), styled by leadership-design.css under .cs-root. Same data,
     tabs and quick filters. The old "More Filters" button only ever reset the
     filters, so it is labelled Reset filters now. */
  const AREA_PILL = {'Report':'', 'Meeting':'green', 'Minutes':'blue',
                     'Audit Grid':'purple', 'Decision':'amber', 'Task':'adhoc'};
  const STATUS_BADGE = {'Scheduled':'scheduled', 'In Review':'pending', 'Under Review':'pending',
                        'Pending':'draft', 'Needs Completion':'returned'};
  const openItem = w => w._dv
    ? openDvRec(w.area==='Report'?'Report':'Meeting', w._rec)
    : w.screen==='mtg' ? openMeeting(w.rid,w.tab||'detail') : go(w.screen,w.rid);
  const pendingCt = work.due.length+work.finish.length;

  return <div className="cs-root">
    <div className="cs-head">
      <div className="cs-head-top">
        <div><h1 className="cs-title">My Workspace</h1>
          <p className="cs-sub">Your pending tasks, upcoming meetings, and action items across all modules.</p></div>
        <div className="cs-actions">
          {/* Opens the Create Report page, the same as Reports / Plans' own button. */}
          <button type="button" className="cs-btn ghost lg" onClick={openNewReport}>
            <Plus size={13}/>New Report</button>
          <button type="button" className="cs-btn primary lg" onClick={()=>go('mtg')}>
            <Plus size={13}/>New Meeting</button>
        </div>
      </div>
      <div className="cs-tabs" role="tablist" aria-label="Filter the work queue by area">
        {TABS.map(t=>{
          const n = t.id==='All' ? tagged.length : tagged.filter(w=>w.area===t.id).length;
          return <button key={t.id} type="button" role="tab" aria-selected={tab===t.id}
            className={'cs-tab'+(tab===t.id?' on':'')} onClick={()=>setTab(t.id)}>
            {t.label}<span className="cs-tab-badge">{n}</span></button>;})}
      </div>
    </div>

    <div className="cs-stats">
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">Pending actions</div>
        <div className="cs-stat-val">{pendingCt}</div><div className="cs-stat-meta">requiring your attention</div></div>
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">Meetings this week</div>
        <div className="cs-stat-val">{meetingsThisWeek.length}</div>
        <div className="cs-stat-meta">{meetingsThisWeek.filter(m=>m.status==='Held').length} held</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">Overdue items</div>
        <div className="cs-stat-val">{overdue.length}</div>
        <div className="cs-stat-meta">{overdue.length
          ? <><span className="c-amber">{overdueReports} report{overdueReports===1?'':'s'}</span>
              {' + '}{overdue.length-overdueReports} other</>
          : 'none outstanding'}</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Pending approvals</div>
        <div className="cs-stat-val">{work.review.length}</div>
        <div className="cs-stat-meta">with a reviewer or approver</div></div>
    </div>

    <div className="cs-chips" role="group" aria-label="Quick filters">
      {QUICK.map(q=>
        <button key={q.id} type="button" aria-pressed={quick===q.id}
          className={'cs-chip'+(quick===q.id?' on':'')} onClick={()=>setQuick(q.id)}>{q.label}</button>)}
      {(tab!=='All'||quick!=='all') && <button type="button" className="cs-btn cs-chips-end"
        onClick={()=>{setTab('All');setQuick('all');}}><RotateCcw size={11}/>Reset filters</button>}
    </div>

    <div className="cs-two-col">
      <section className="cs-card flush" aria-labelledby="wa-queue">
        <div className="cs-card-top">
          <div className="cs-card-title-grp">
            <span className="cs-icon gold" aria-hidden="true"><ClipboardCheck size={16}/></span>
            <div><h2 className="cs-card-title" id="wa-queue">Work Queue</h2>
              <div className="cs-card-note">Everything open right now — open a record to act on it.</div></div>
          </div>
          <span className="cs-search-n">{rows.length} of {tagged.length}</span>
        </div>
        {rows.length===0 ? <div className="cs-empty">Nothing matches these filters.</div>
        : <div className="cs-tbl-wrap"><table className="cs-tbl dense" style={{minWidth:760}}>
            <thead><tr><th style={{width:4}}><span className="sr-only">Priority</span></th><th>Area</th>
              <th>Item</th><th>Accountable</th><th>Status</th><th>Due</th>
              <th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{rows.map((w,i)=>{
              const st = statusOf(w);
              const late = w.date && w.date<TODAY;
              const open = ()=>openItem(w);
              return <tr key={w.bucket+w.area+w.rid+i} className="cs-row" tabIndex={0} onClick={open}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); open(); } }}>
                <td><span className={'cs-prio'+(w.urgent?' hi':w.bucket==='review'?' md':'')}
                  title={w.urgent?'Urgent':w.bucket==='review'?'With a reviewer':'Open'}/></td>
                <td><span className={'cs-type '+(AREA_PILL[w.area]??'adhoc')}>{w.area}</span></td>
                <td><div className="cs-name">{w.title}</div><div className="cs-name-sub">{w.sub}</div></td>
                <td>{w.owner ? <><div className="cs-name">{P(w.owner).name}</div>
                    <div className="cs-name-sub">{P(w.owner).position}</div></> : '—'}</td>
                <td><span className={'cs-badge '+(STATUS_BADGE[st]||'draft')}><i/>{st}</span></td>
                <td>{late ? <span className="cs-mono c-red">Overdue</span>
                  : <span className="cs-mono">{w.date?fmtDS(w.date):'—'}</span>}</td>
                <td><button type="button" className={'cs-btn'+(i===0?' primary':'')}
                    onClick={e=>{ e.stopPropagation(); open(); }}>{actionVerb(w)}</button></td>
              </tr>;})}
            </tbody></table></div>}
      </section>

      <div className="cs-side">
        <section className="cs-card" aria-labelledby="wa-up">
          <div className="cs-card-top">
            <div className="cs-card-title-grp">
              <span className="cs-icon green" aria-hidden="true"><CalendarDays size={16}/></span>
              <h2 className="cs-card-title" id="wa-up">Upcoming</h2></div>
            <button type="button" className="cs-btn" onClick={()=>go('cal')}>Full Calendar</button>
          </div>
          {upcoming.length===0 ? <div className="cs-card-note">Nothing scheduled yet.</div>
          : <div className="cs-up">{upcoming.map((it,n)=>
              <button key={it.kind+it.id+n} type="button" className="cs-up-item"
                  onClick={()=> it._dv
                    ? openDvRec(it.kind==='Report'?'Report':'Meeting', it._rec)
                    : it.screen==='mtg' ? openMeeting(it.id,it.tab||'detail') : go(it.screen,it.id)}>
                <span className="cs-up-d"><span className="cs-up-dd">{it.date.slice(8)}</span>
                  <span className="cs-up-mo">{MONTHS[+it.date.slice(5,7)-1]}</span></span>
                <span style={{minWidth:0}}>
                  <div className="cs-name">{it.restricted && <Lock size={10} className="cs-lock" aria-label="Restricted"/>}{it.title}</div>
                  <div className="cs-name-sub">{it.sub}</div></span>
                {it.time && <span className="cs-up-time">{it.time}</span>}
              </button>)}</div>}
        </section>

        <section className="cs-card" aria-labelledby="wa-month">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon amber" aria-hidden="true"><Activity size={16}/></span>
            <h2 className="cs-card-title" id="wa-month">This Month</h2></div></div>
          <p className="cs-card-note">Read from the Meeting and Report Occurrence tables.</p>
          <div>
            <div className="cs-qs"><span>Meetings Held</span>
              <span className="cs-qs-v">{meetingsHeld} / {meetingsTotal}</span></div>
            <div className="cs-qs"><span>Agenda Fully Recorded</span>
              <span className="cs-qs-v">{agendaRecorded} / {meetingsHeld}</span></div>
            <div className="cs-qs"><span>Reports Submitted</span>
              <span className="cs-qs-v">{reportsSubmitted} / {dvReportOccs.length}</span></div>
            <div className="cs-qs"><span>Reports Approved</span>
              <span className="cs-qs-v">{reportsApproved} / {dvReportOccs.length}</span></div>
          </div>
        </section>
      </div>
    </div>

    <section className="cs-card flush" aria-labelledby="wa-where">
      <div className="cs-card-top"><div className="cs-card-title-grp">
        <span className="cs-icon gold" aria-hidden="true"><Layers size={16}/></span>
        <div><h2 className="cs-card-title" id="wa-where">Where things live</h2>
          <div className="cs-card-note">Five places, and nothing is hidden behind a sixth.</div></div>
      </div></div>
      <div className="cs-tbl-wrap"><table className="cs-tbl" style={{minWidth:480}}>
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
          ].map(([q,where,sc])=>
            <tr key={q} className="cs-row cs-link-row" tabIndex={0} onClick={()=>go(sc)}
                onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); go(sc); } }}>
              <td>{q}</td><td>{where} →</td></tr>)}
        </tbody></table></div>
    </section>
  </div>;
}

/* =========================================================================
   3 · REPORTS & PLANS
   ========================================================================= */

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
        <td>{secCount(r)
              ? <span className="t-main">{secCount(r)} section{secCount(r)===1?'':'s'}</span>
              : <Tag c="red">Nothing written</Tag>}</td>
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
const secCount  = r => (r.blocks||[]).length;
const citeCount = (db,r) => (r.blocks||[])
  .reduce((n,b)=>{ const p=db.paragraphs.find(x=>x.id===b); return n+(p?(p.cites||[]).length:0); },0);
const rptSubmittedAt = r => { const h=r.history.find(x=>x.act==='Submitted for review'); return h?h.at.split(' ')[0]:null; };

/* A search box for a register table.

   `fields` is whatever the row shows on screen — the search has to match what
   the reader can see, or a hit that scrolls into view looks arbitrary. Terms
   are matched with AND rather than as one phrase, so "quality sep" finds a
   September Quality meeting whatever order the columns put them in. */

const TableSearch = ({value,onChange,placeholder,shown,total}) =>
  <div className="tbl-search">
    <input type="search" value={value} placeholder={placeholder} aria-label={placeholder}
      onChange={e=>onChange(e.target.value)}/>
    {value.trim()
      ? <span className="holder" style={{marginTop:0}}>{shown} of {total}</span>
      : null}
  </div>;

function ScreenReports(){
  const {db,me,sel,setSel,go,S,cal} = use();
  const [creating,setCreating]=useState(false);
  const [tab,setTab]=useState('due');
  const [view,setView]=useState('register');
  /* Declared with the other state, ABOVE the early returns below. A hook after
     a conditional return runs on some renders and not others, which is React
     error #310 ("rendered more hooks than during the previous render") — it
     fired the moment a report or the wizard was opened. */
  const [q,setQ] = useState('');
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
  const tabRows = (TABS.find(t=>t.id===tab)||TABS[0]).rows;
  /* A plain filter, not useMemo: this sits below the early returns above, and
     a hook here would reintroduce the same #310. The lists are small enough
     that memoising bought nothing anyway.
     Matched against what the row actually shows: name, period, status and the
     Setup it came from. */
  const rows = tabRows.filter(r=>matchesQuery(q,[r.name, r.period, r.status, rptCfg(r)?.name]));

  const VIEWS = [
    {id:'register',  label:'Register',            c:list.length},
    {id:'templates', label:'Section templates',   c:(db.templates||[]).length},
    {id:'pool',      label:'Paragraph pool',      c:db.paragraphs.length},
    {id:'hier',      label:'Reporting hierarchy', c:null},
  ];

  return <>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Reports & Plans</h1>
        <div className="sub">Every Report is written here as sections that cite live records —
          there is no working copy to generate, attach or keep in step.</div></div>
      {view==='register' && <Btn k="pri" onClick={()=>setCreating(true)}>+ New Report</Btn>}
    </div>

    <div className="rc-tabs">
      {VIEWS.map(v=>
        <button key={v.id} className={view===v.id?'on':''} onClick={()=>setView(v.id)}>
          {v.label}{v.c!=null && <span className="c">{v.c}</span>}</button>)}
    </div>

    {view==='templates' && <TemplatesTab/>}
    {view==='pool'      && <PoolTab/>}
    {view==='hier'      && <HierarchyTab/>}

    {view==='register' && <>
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
        <TableSearch value={q} onChange={setQ} placeholder="Search reports…"
          shown={rows.length} total={tabRows.length}/>
        <Btn k="sm" onClick={()=>setTab('all')}>▾ Filter</Btn>
      </div>
      {rows.length===0 ? <div style={{padding:'8px 17px 17px'}}>
          <Empty ic="✓">{tabRows.length
            ? `No Report matches “${q.trim()}”.`
            : 'Nothing here right now.'}</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>Report</th><th>Period</th><th>Content</th><th>Status</th>
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
              <td>{secCount(r)
                    ? <><span className="t-main">{secCount(r)} section{secCount(r)===1?'':'s'}</span>
                        <div className="t-sub">{citeCount(db,r)} live citation{citeCount(db,r)===1?'':'s'}</div></>
                    : <span className="dim">Nothing written yet</span>}</td>
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
    </>}
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
  const missing = (rec.blocks||[]).length===0;
  const submittedAt = rptSubmittedAt(rec);

  /* the date a given review step (0-indexed) started — submission for step 0,
     otherwise the previous step's approval */
  const stepStartedAt = i => i===0 ? submittedAt
    : (rec.history.find(h=>h.act.startsWith('Approved review step '+i))||{}).at;
  const stepDeadline = i => { const start=stepStartedAt(i);
    return (start && S.reviewTimeoutDays!=null)
      ? shiftWorkingDays(start.split(' ')[0],S.reviewTimeoutDays) : null; };

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

    {rec.locked && <Note k="lock"><b>This Report Submission is Approved and locked.</b> Its sections,
      citations, version and complete approval history are retained. A correction is made through a
      new version.</Note>}

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

        <ReportComposer rec={rec}/>

        {isCreator && rec.status==='Draft' &&
          <div className="card">
            <h2>Submit</h2>
            <div className="csub">Submitting sends the Report to the first Reviewer. The figures
              it cites stay live — they are read from source each time it is opened, so nothing
              here goes out of date between now and approval.</div>
            <div className="btn-row" style={{marginTop:4}}>
              <Btn k="pri" disabled={missing} onClick={()=>A.submitReport(rec.id)}>Submit for review</Btn>
              {missing && <span style={{fontSize:11.5,color:'var(--red)'}}>
                Nothing has been written yet, so submission is blocked.</span>}
            </div>
          </div>}

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
          <div className="wa-mo-r txt"><label>Template</label>
            <span className="v">
              {c.tpl && tplOf(db,c.tpl) ? tplOf(db,c.tpl).n : 'None — built free'}</span></div>
          <div className="wa-mo-r"><label>Sections</label>
            <span className="v">{secCount(rec)}</span></div>
          <div className="wa-mo-r"><label>Live citations</label>
            <span className="v">{citeCount(db,rec)}</span></div>
          <div className="wa-mo-r txt"><label>Submitted</label>
            <span className="v">
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

/* =========================================================================
   REPORT COMPOSITION — components
   The authoring surface that replaces the working-copy file. A section is a
   paragraph from the shared pool; citing one into a Report does not copy it,
   so editing it anywhere updates it everywhere it appears.
   ========================================================================= */


/* one citation, rendered with the figures it actually carries for this
   Report's Business Unit and period — never a pasted number. */

/* pick something real to cite. The list is filtered to the Report's own
   Setup by default — its KPIs and processes — with everything else one
   click away, so the common case is short without being a cage. */
function CitePicker({rec,para,onClose}){
  const {db,A} = use();
  const cfg = rptCfg(rec);
  const [kind,setKind] = useState('KPI');
  const [scoped,setScoped] = useState(true);
  const [q,setQ] = useState('');
  const setupKpis = cfg.kpis||[], setupProcs = cfg.processes||[];
  const has = ref => (para.cites||[]).includes(ref);

  const rows = (()=>{
    const m = s => !q.trim() || (s||'').toLowerCase().includes(q.trim().toLowerCase());
    if(kind==='KPI'){
      let ks = KPI_CAT.filter(k=>!scoped || setupKpis.includes(k.id) || setupProcs.includes(k.proc));
      if(!ks.length) ks = KPI_CAT;
      return ks.filter(k=>m(k.n)).map(k=>({ref:'KPI:'+k.id, t:k.n,
        s:'Whole KPI · '+(PR(k.proc)?PR(k.proc).n:k.proc)
          +((k.breakdowns||[]).length?' · '+k.breakdowns.length+' breakdowns':'')}));
    }
    if(kind==='STR') return STRAT
      .filter(s=>!scoped || !setupProcs.length || setupProcs.includes(s.proc) || s.k==='Objective')
      .filter(s=>m(s.n))
      .map(s=>({ref:'STR:'+s.id, t:s.n, s:s.k+' · '+s.st}));
    if(kind==='PM') return PM_ENTRIES
      .filter(e=>!scoped || !setupProcs.length || setupProcs.includes(e.proc))
      .filter(e=>m(e.n)).map(e=>({ref:'PM:'+e.id, t:e.n, s:e.k+' entry · '+(e.st||'')}));
    if(kind==='TASK') return db.tasks.filter(t=>m(t.title))
      .map(t=>({ref:'TASK:'+t.id, t:t.title, s:t.status+' · due '+fmtD(t.due)}));
    if(kind==='ISS') return ISSUES
      .filter(i=>!scoped || !setupProcs.length || setupProcs.includes(i.proc))
      .filter(i=>m(i.n)).map(i=>({ref:'ISS:'+i.id, t:i.n, s:i.sys+' · '+i.sev+' · '+i.st}));
    if(kind==='PAR') return db.paragraphs.filter(p=>p.id!==para.id && (m(p.h)||m(p.text)))
      .map(p=>({ref:'PAR:'+p.id, t:p.h||'Untitled section',
        s:P(p.author).name+' · used in '+db.reports.filter(r=>(r.blocks||[]).includes(p.id)).length+' Report(s)'}));
    if(kind==='RPT') return db.reports.filter(r=>r.id!==rec.id && (r.blocks||[]).length && m(rptName(r)))
      .map(r=>({ref:'RPT:'+r.id, t:rptName(r), s:fmtP(r.period)+' · '+r.dept+' · '+r.status}));
    return [];
  })();

  return <div className="cpick">
    <div className="cpick-k">
      {CITE_KINDS.map(c=>
        <Btn key={c.k} k={'sm'+(kind===c.k?' pri':'')} onClick={()=>setKind(c.k)}>{c.label}</Btn>)}
    </div>
    {kind==='BD' && <>
      <KpiCascade mode="bd" taken={para.cites||[]} onPick={ref=>A.citePara(para.id,ref)}/>
      <div style={{marginTop:9}}><Btn k="sm" onClick={onClose}>Done</Btn></div>
    </>}
    {kind!=='BD' && <>
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:9,flexWrap:'wrap'}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter…"
        style={{flex:1,minWidth:140,border:'1px solid var(--border)',borderRadius:6,padding:'5px 9px',fontSize:12.5}}/>
      {['KPI','STR','PM','ISS'].includes(kind) &&
        <label style={{fontSize:11.5,color:'var(--muted)',display:'flex',alignItems:'center',gap:5}}>
          <input type="checkbox" checked={scoped} onChange={e=>setScoped(e.target.checked)}/>
          Only this Setup’s scope</label>}
      <Btn k="sm" onClick={onClose}>Done</Btn>
    </div>
    <div className="cpick-l">
      {rows.length===0
        ? <div style={{padding:'14px',fontSize:12.5,color:'var(--muted)'}}>Nothing matches.</div>
        : rows.slice(0,60).map(r=>
          <button key={r.ref} className={'cpick-i'+(has(r.ref)?' taken':'')}
            disabled={has(r.ref)} onClick={()=>A.citePara(para.id,r.ref)}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:560}}>{r.t}</div>
              <div className="m">{r.s}</div></div>
            {has(r.ref) ? <Tag c="green">Cited</Tag> : <span className="dim" style={{fontSize:16}}>+</span>}
          </button>)}
    </div>
    </>}
  </div>;
}

/* one section of a Report. It is a pool paragraph, so the shared badge is
   not decoration — editing here changes it in every Report that cites it. */
function SectionRow({rec,para,i,total,locked}){
  const {db,A} = use();
  const [picking,setPicking] = useState(false);
  /* held locally while typing and written to the pool on blur — the store is
     cloned on every write, so committing per keystroke would make it crawl */
  const [d,setD] = useState({h:para.h,text:para.text});
  useEffect(()=>{ setD({h:para.h,text:para.text}); },[para.id]);
  const commit = () => { if(d.h!==para.h || d.text!==para.text) A.editPara(para.id,d); };
  const shared = db.reports.filter(r=>(r.blocks||[]).includes(para.id));
  return <div className="sec">
    <div className="sec-h">
      <span className="sec-n">{i+1}</span>
      <input className="sec-t" value={d.h} disabled={locked} placeholder="Section heading"
        onChange={e=>setD(x=>({...x,h:e.target.value}))} onBlur={commit}/>
      <div className="dg-seg">
        {['none','d1','d2','d3','d4'].map(d=>
          <button key={d} disabled={locked}
            className={((para.diag||'none')===d?'on ':'')+d}
            title={d==='none'?'No diagnostic angle set':DIAG[d].q+' — needs '+DIAG[d].need}
            onClick={()=>A.editPara(para.id,{diag:d==='none'?'':d})}>
            {d==='none'?'Untyped':DIAG[d].n}</button>)}
      </div>
      {shared.length>1 && <span className="reuse" title={'Also appears in: '+
        shared.filter(r=>r.id!==rec.id).map(r=>rptName(r)).join(', ')}>
        ↻ shared with {shared.length-1} other</span>}
      {!locked && <span style={{display:'flex',gap:4,marginLeft:'auto'}}>
        {i>0 && <Btn k="sm" title="Move up" onClick={()=>A.moveSection(rec.id,para.id,-1)}>↑</Btn>}
        {i<total-1 && <Btn k="sm" title="Move down" onClick={()=>A.moveSection(rec.id,para.id,1)}>↓</Btn>}
        <Btn k="sm" title="Remove this section from this Report"
          onClick={()=>A.removeSection(rec.id,para.id)}>✕</Btn>
      </span>}
    </div>
    <div className="sec-b">
      <textarea value={d.text} disabled={locked}
        placeholder="Write the section — the finding, the conclusion, whatever this row is for. Cite what it rests on below."
        onChange={e=>setD(x=>({...x,text:e.target.value}))} onBlur={commit}/>
      {(para.cites||[]).map(c=>
        <CiteCard key={c} cite={c} scope={{bu:rec.bu,period:rec.period}}
          onRemove={locked?null:()=>A.uncitePara(para.id,c)}/>)}
      {(para.cites||[]).length===0 &&
        <div className="dg none" style={{marginTop:8,display:'inline-block'}}>
          No source cited — free text only</div>}
      {!locked && <div className="sec-f">
        <Btn k="sm" onClick={()=>setPicking(p=>!p)}>
          {picking?'Close the picker':'+ Cite a KPI, tactic, entry, task, issue or Report'}</Btn>
        {para.proc && <span className="dim" style={{fontSize:11.5}}>
          Resolves through {PR(para.proc)?PR(para.proc).n:para.proc}</span>}
      </div>}
      {picking && !locked && <CitePicker rec={rec} para={para} onClose={()=>setPicking(false)}/>}
    </div>
  </div>;
}

/* the authoring surface. This is what replaced generating or uploading a
   working copy: pick a template, or start blank and add sections. */
function ReportComposer({rec}){
  const {db,A,me} = use();
  const cfg = rptCfg(rec);
  const paras = (rec.blocks||[]).map(b=>db.paragraphs.find(p=>p.id===b)).filter(Boolean);
  const locked = rec.locked || rec.status==='Approved';
  /* the same rule the working-copy step used: content is authored in Draft
     only. Once submitted it is what the Reviewer is reviewing, and a change
     goes through Request Additional Info, which returns it to Draft. */
  const editable = !locked && rec.status==='Draft' && acting(rec.creator);
  const [tplPick,setTplPick] = useState(cfg.tpl||'');
  const [reuse,setReuse] = useState(false);
  const cited = paras.reduce((n,p)=>n+(p.cites||[]).length,0);
  const untyped = paras.filter(p=>!p.diag).length;
  const empty = paras.filter(p=>!p.text.trim()).length;

  return <div className="card flush">
    <div className="card-hd" style={{display:'flex',alignItems:'center',gap:12}}>
      <div className="wa-icon gold">✎</div>
      <div style={{flex:1}}>
        <h2 style={{marginBottom:0}}>Report Content</h2>
        <div className="csub" style={{marginBottom:0}}>
          {paras.length} section{paras.length===1?'':'s'} · {cited} live citation{cited===1?'':'s'}
          {' '}· figures resolve for {rec.bu} · {fmtP(rec.period)}</div>
      </div>
      {locked && <Tag c="grey">🔒 Locked</Tag>}
    </div>

    <div style={{padding:'0 17px 17px'}}>
      {paras.length===0 && editable && <>
        <Note k="info">This Report has no sections yet. Choose a template to start with the sections
          this Report type always needs — already carrying this period’s real figures — or add
          sections one at a time. Either way, nothing is locked afterwards.</Note>
        <div style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap',marginTop:12}}>
          <Field label="Section template">
            <select value={tplPick} onChange={e=>setTplPick(e.target.value)} style={{minWidth:250}}>
              <option value="">Blank — no template</option>
              {(db.templates||[]).map(t=><option key={t.id} value={t.id}>{t.n}</option>)}
            </select>
          </Field>
          <Btn k="pri" disabled={!tplPick} onClick={()=>A.applyTemplate(rec.id,tplPick)}>
            Insert these sections</Btn>
          <Btn onClick={()=>A.addSection(rec.id)}>Start blank — add one section</Btn>
        </div>
        {tplPick && tplOf(db,tplPick) && <div style={{marginTop:12}}>
          <div className="csub">{tplOf(db,tplPick).desc}</div>
          <table className="data"><thead><tr><th>Section</th><th>Angle</th><th>Pre-linked</th></tr></thead>
            <tbody>{tplOf(db,tplPick).sections.map((s,i)=>
              <tr key={i}><td><div className="t-main">{s.h}</div></td>
                <td><DiagChip d={s.diag}/></td>
                <td className="dim">{s.cites.length?s.cites.length+' citation'+(s.cites.length===1?'':'s'):'—'}</td>
              </tr>)}</tbody></table>
        </div>}
      </>}

      {paras.length===0 && !editable &&
        <Empty ic="✎">No sections have been written yet.</Empty>}

      {paras.length>0 && !editable && !locked && rec.status==='In Review' &&
        <Note k="info">This Report is with a Reviewer, so its sections are read-only. A Reviewer
          who needs it changed uses Request Additional Info, which returns it to Draft.</Note>}

      {paras.map((p,i)=>
        <SectionRow key={p.id} rec={rec} para={p} i={i} total={paras.length} locked={!editable}/>)}

      {paras.length>0 && editable && <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
        <Btn onClick={()=>A.addSection(rec.id)}>+ Add a section</Btn>
        <Btn onClick={()=>setReuse(r=>!r)}>{reuse?'Close the pool':'↻ Reuse a paragraph'}</Btn>
        <select value="" onChange={e=>{ if(e.target.value) A.applyTemplate(rec.id,e.target.value); }}
          style={{maxWidth:250}}>
          <option value="">Append a template’s sections…</option>
          {(db.templates||[]).map(t=><option key={t.id} value={t.id}>{t.n}</option>)}
        </select>
      </div>}

      {reuse && editable && <div className="cpick">
        <div className="csub">Insert a paragraph that already exists somewhere else. It is not
          copied — the same paragraph appears in both Reports, and editing it in either one
          changes it in both.</div>
        <div className="cpick-l">
          {db.paragraphs.filter(p=>!(rec.blocks||[]).includes(p.id)).length===0
            ? <div style={{padding:14,fontSize:12.5,color:'var(--muted)'}}>
                Every paragraph in the pool is already in this Report.</div>
            : db.paragraphs.filter(p=>!(rec.blocks||[]).includes(p.id)).map(p=>{
                const used = db.reports.filter(r=>(r.blocks||[]).includes(p.id));
                return <button key={p.id} className="cpick-i"
                  onClick={()=>{A.reuseSection(rec.id,p.id); setReuse(false);}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:560}}>{p.h||'Untitled section'}</div>
                    <div className="m">{P(p.author).name}
                      {used.length?' · currently in '+used.map(r=>rptName(r)).join(', '):' · in no Report'}</div>
                  </div>
                  <DiagChip d={p.diag}/>
                </button>;})}
        </div>
      </div>}

      {paras.length>0 && (untyped>0||empty>0) && <div style={{marginTop:12}}>
        <Note k="warn">{empty>0 && <>{empty} section{empty===1?'':'s'} still {empty===1?'has':'have'} no text written. </>}
          {untyped>0 && <>{untyped} section{untyped===1?'':'s'} {untyped===1?'has':'have'} no diagnostic angle set,
            so the Report does not yet say whether it is describing, explaining, forecasting or prescribing.</>}</Note>
      </div>}
    </div>
  </div>;
}

/* =========================================================================
   KPI SELECTOR — shared by the template editor and the Report citation
   picker. A flat list of every KPI and every breakdown together is
   unusable once the catalogue is real, so a breakdown is chosen the way
   it is actually structured: KPI first, then the dimension, then the
   member within it.
   ========================================================================= */
function KpiCascade({onPick,taken,mode}){
  const [kpiId,setKpiId] = useState('');
  const [dim,setDim] = useState('');
  const k = kpiId?KPIC(kpiId):null;
  if(mode==='kpi') return <div className="cpick-l">
    {KPI_CAT.map(x=>{
      const t = taken.includes('KPI:'+x.id);
      return <button key={x.id} className={'cpick-i'+(t?' taken':'')} disabled={t}
        onClick={()=>onPick('KPI:'+x.id)}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12.5,fontWeight:560}}>{x.n}</div>
          <div className="m">{PR(x.proc)?PR(x.proc).n:'No process'} · unit {x.unit.trim()}
            {(x.breakdowns||[]).length?' · '+x.breakdowns.length+' breakdowns':''}</div>
        </div>
        {t?<Tag c="green">Added</Tag>:<span className="dim" style={{fontSize:16}}>+</span>}
      </button>;})}
  </div>;

  const withBd = KPI_CAT.filter(x=>(x.breakdowns||[]).length);
  return <>
    <Field label="Which KPI">
      <select value={kpiId} onChange={e=>{setKpiId(e.target.value);setDim('');}}>
        <option value="">Choose a KPI…</option>
        {withBd.map(x=><option key={x.id} value={x.id}>{x.n}</option>)}
      </select>
    </Field>
    {k && <Field label="Broken down by">
      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
        {bdDims(k).map(d=>
          <Btn key={d} k={'sm'+(dim===d?' pri':'')} onClick={()=>setDim(d)}>{d}</Btn>)}
      </div>
    </Field>}
    {k && dim && <div className="cpick-l">
      {k.breakdowns.filter(b=>b.dim===dim).map(b=>{
        const t = taken.includes('KPI:'+b.id);
        return <button key={b.id} className={'cpick-i'+(t?' taken':'')} disabled={t}
          onClick={()=>onPick('KPI:'+b.id)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:560}}>{b.n}</div>
            <div className="m">{k.n} · by {b.dim}</div>
          </div>
          {t?<Tag c="green">Added</Tag>:<span className="dim" style={{fontSize:16}}>+</span>}
        </button>;})}
    </div>}
    {!k && <div className="dim" style={{fontSize:12.5,padding:'4px 2px'}}>
      Only KPIs that carry breakdowns are listed.</div>}
  </>;
}

/* label any pre-linked reference for display in the template editor */
function citeLabel(db,ref){
  const kind=citeKind(ref), id=citeId(ref);
  if(kind==='KPI'){ const f=findKpi(id);
    return f ? (f.bd ? f.k.n+' — '+f.bd.dim+': '+f.bd.n : f.k.n) : id; }
  if(kind==='STR') return ST(id)?ST(id).n:id;
  if(kind==='PM')  return PME(id)?PME(id).n:id;
  if(kind==='ISS') return ISS(id)?ISS(id).n:id;
  if(kind==='RPT'){ const r=db.reports.find(x=>x.id===id); return r?rptName(r):id; }
  return id;
}

/* =========================================================================
   SECTION TEMPLATES — built here, not in code
   A template is a named list of sections, each carrying the KPIs,
   breakdowns or child Reports that always belong to it. Using it seeds
   those sections with that period's real achievement already in place.
   ========================================================================= */
function TemplateSectionEditor({tpl,sec,i,total}){
  const {db,A} = use();
  const [pick,setPick] = useState(null);   /* 'kpi' | 'bd' | 'rpt' */
  const [h,setH] = useState(sec.h);
  useEffect(()=>{setH(sec.h);},[tpl.id,i]);
  return <div className="sec">
    <div className="sec-h">
      <span className="sec-n">{i+1}</span>
      <input className="sec-t" value={h} placeholder="Section heading"
        onChange={e=>setH(e.target.value)}
        onBlur={()=>{ if(h!==sec.h) A.editTplSection(tpl.id,i,{h}); }}/>
      <div className="dg-seg">
        {['none','d1','d2','d3','d4'].map(d=>
          <button key={d} className={((sec.diag||'none')===d?'on ':'')+d}
            title={d==='none'?'No diagnostic angle set':DIAG[d].q+' — needs '+DIAG[d].need}
            onClick={()=>A.editTplSection(tpl.id,i,{diag:d==='none'?'':d})}>
            {d==='none'?'Untyped':DIAG[d].n}</button>)}
      </div>
      <span style={{display:'flex',gap:4,marginLeft:'auto'}}>
        {i>0 && <Btn k="sm" title="Move up" onClick={()=>A.moveTplSection(tpl.id,i,-1)}>↑</Btn>}
        {i<total-1 && <Btn k="sm" title="Move down" onClick={()=>A.moveTplSection(tpl.id,i,1)}>↓</Btn>}
        <Btn k="sm" title="Remove this section" onClick={()=>A.removeTplSection(tpl.id,i)}>✕</Btn>
      </span>
    </div>
    <div className="sec-b">
      {sec.cites.length===0
        ? <div className="dim" style={{fontSize:12.5}}>
            Nothing pre-linked — this section starts blank and is written free when the
            template is used.</div>
        : <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {sec.cites.map((c,ci)=>{
              const kind=citeKind(c), f=kind==='KPI'?findKpi(citeId(c)):null;
              return <span key={c} className={'cref '+(kind==='KPI'?'kpi':kind==='RPT'?'str':'')}>
                {f&&f.bd?'Breakdown':kind==='KPI'?'KPI':kind==='RPT'?'Child Report':kind}
                {': '}{citeLabel(db,c)}
                <button onClick={()=>A.removeTplItem(tpl.id,i,ci)}
                  style={{border:'none',background:'none',cursor:'pointer',marginLeft:4,color:'inherit'}}>×</button>
              </span>;})}
          </div>}
      <div className="sec-f">
        <Btn k="sm" onClick={()=>setPick(p=>p?null:'kpi')}>
          {pick?'Close':'+ Pre-link a KPI, breakdown or child Report'}</Btn>
      </div>
      {pick && <div className="cpick">
        <div className="cpick-k">
          {[['kpi','KPI'],['bd','KPI breakdown'],['rpt','Child Report']].map(([k,l])=>
            <Btn key={k} k={'sm'+(pick===k?' pri':'')} onClick={()=>setPick(k)}>{l}</Btn>)}
        </div>
        {(pick==='kpi'||pick==='bd') &&
          <KpiCascade mode={pick} taken={sec.cites}
            onPick={ref=>A.addTplItem(tpl.id,i,ref)}/>}
        {pick==='rpt' && <div className="cpick-l">
          {db.reports.filter(r=>(r.blocks||[]).length).map(r=>{
            const t=sec.cites.includes('RPT:'+r.id);
            return <button key={r.id} className={'cpick-i'+(t?' taken':'')} disabled={t}
              onClick={()=>A.addTplItem(tpl.id,i,'RPT:'+r.id)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:560}}>{rptName(r)}</div>
                <div className="m">{fmtP(r.period)} · {r.dept} · {r.status}</div></div>
              {t?<Tag c="green">Added</Tag>:<span className="dim" style={{fontSize:16}}>+</span>}
            </button>;})}
        </div>}
      </div>}
    </div>
  </div>;
}

function TemplatesTab(){
  const {db,A} = use();
  const tpls = db.templates||[];
  const [open,setOpen] = useState(tpls[0]?tpls[0].id:null);
  const t = tplOf(db,open);
  const [f,setF] = useState({n:'',desc:''});
  useEffect(()=>{ if(t) setF({n:t.n,desc:t.desc}); },[open]);

  const setups = t?RPT_SETUPS.filter(s=>s.tpl===t.id):[];
  const live   = t?db.reports.filter(r=>r.setup && RS(r.setup) && RS(r.setup).tpl===t.id):[];

  return <>
    <Note k="info">A template is a named list of sections with its KPIs already linked, so a new
      Report opens with that period’s real achievement in place. Templates are built here — adding
      a Report type does not need anybody to change the system. A template seeds a Report; it does
      not constrain one, and every section stays editable afterwards.</Note>

    <div className="grid2" style={{gridTemplateColumns:'310px 1fr',alignItems:'start',marginTop:14}}>
      <div className="card flush">
        <div className="card-hd" style={{display:'flex',alignItems:'center',gap:8}}>
          <h2 style={{flex:1,marginBottom:0}}>Templates</h2>
          <Btn k="sm pri" onClick={()=>A.addTemplate(id=>setOpen(id))}>+ New</Btn>
        </div>
        {tpls.length===0
          ? <div style={{padding:'8px 17px 17px'}}><Empty>No templates yet.</Empty></div>
          : <table className="data"><tbody>{tpls.map(x=>{
              const used = RPT_SETUPS.filter(s=>s.tpl===x.id);
              return <tr key={x.id} className="click" onClick={()=>setOpen(x.id)}
                style={open===x.id?{background:'var(--teal-ll)'}:null}>
                <td><div className="t-main">{x.n}</div>
                  <div className="t-sub">{x.sections.length} section{x.sections.length===1?'':'s'} · {x.cat}
                    {used.length>0 && ' · used by '+used.length+' Setup'+(used.length===1?'':'s')}</div></td>
              </tr>;})}</tbody></table>}
      </div>

      <div>{!t ? <div className="card"><Empty>Select or create a template.</Empty></div> : <>
        <div className="card">
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <h2 style={{flex:1,marginBottom:0}}>Template details</h2>
            <span className="dim mono" style={{fontSize:11}}>{t.id}</span>
          </div>
          <div className="f-row" style={{marginTop:10}}>
            <Field label="Name" req>
              <input type="text" value={f.n} onChange={e=>setF(x=>({...x,n:e.target.value}))}
                onBlur={()=>{ if(f.n!==t.n) A.editTemplate(t.id,{n:f.n}); }}/></Field>
            <Field label="Category">
              <select value={t.cat} onChange={e=>A.editTemplate(t.id,{cat:e.target.value})}>
                {RPT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select></Field>
          </div>
          <Field label="Description" hint="Shown wherever this template is offered.">
            <input type="text" value={f.desc} onChange={e=>setF(x=>({...x,desc:e.target.value}))}
              onBlur={()=>{ if(f.desc!==t.desc) A.editTemplate(t.id,{desc:f.desc}); }}/></Field>
          <KVBlock items={[
            ['Used by Setups', setups.length?setups.map(s=>s.name).join(', '):'None yet'],
            ['Reports created from it', live.length],
            ['Sections', t.sections.length],
            ['Pre-linked sources', t.sections.reduce((n,s)=>n+s.cites.length,0)],
          ]}/>
          {setups.length>0 && <Note k="warn">This template is attached to {setups.length} approved
            Setup{setups.length===1?'':'s'}. Changing its sections changes what the next Report of
            that type starts with — Reports already created keep the sections they were built with.</Note>}
          <div className="btn-row" style={{marginTop:4}}>
            <Btn k="wrn" onClick={()=>{
              if(setups.length){ alert('This template is attached to an approved Setup and cannot be deleted while that Setup uses it.'); return; }
              if(window.confirm('Delete the “'+t.n+'” template? Reports already built from it are unaffected.')){
                A.deleteTemplate(t.id); setOpen(null); }
            }}>Delete template</Btn>
          </div>
        </div>

        <div className="card flush">
          <div className="card-hd" style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1}}>
              <h2 style={{marginBottom:0}}>Sections</h2>
              <div className="csub" style={{marginBottom:0}}>In the order a Report built from this
                template will open with. Anything pre-linked here arrives carrying live figures.</div>
            </div>
          </div>
          <div style={{padding:'0 17px 17px'}}>
            {t.sections.length===0
              ? <Empty ic="✎">No sections yet. Add the first one below.</Empty>
              : t.sections.map((s,i)=>
                  <TemplateSectionEditor key={t.id+':'+i} tpl={t} sec={s} i={i} total={t.sections.length}/>)}
            <Btn onClick={()=>A.addTplSection(t.id)}>+ Add a section</Btn>
          </div>
        </div>
      </>}</div>
    </div>
  </>;
}
/* =========================================================================
   PARAGRAPH POOL — every section written anywhere is one object
   ========================================================================= */
function PoolTab(){
  const {db,go,A} = use();
  const [q,setQ] = useState('');
  const [only,setOnly] = useState('all');
  const rows = db.paragraphs
    .map(p=>({p, used:db.reports.filter(r=>(r.blocks||[]).includes(p.id))}))
    .filter(x=> only==='all' ? true : only==='shared' ? x.used.length>1 : x.used.length===0)
    .filter(x=> !q.trim() || (x.p.h+' '+x.p.text).toLowerCase().includes(q.trim().toLowerCase()));
  const shared = db.paragraphs.filter(p=>db.reports.filter(r=>(r.blocks||[]).includes(p.id)).length>1);

  return <>
    <Note k="info">A section is written once and cited wherever it is relevant. These are objects,
      not copies — editing one here changes it in every Report it appears in, which is why the
      reuse count matters before you edit.</Note>
    <div className="stats" style={{marginTop:14}}>
      <Stat label="Paragraphs" v={db.paragraphs.length} d="written across every Report"/>
      <Stat label="Reused" v={shared.length} d="appear in more than one Report"
        c={shared.length?'teal':'muted'}/>
      <Stat label="Orphaned" v={db.paragraphs.filter(p=>!db.reports.some(r=>(r.blocks||[]).includes(p.id))).length}
        d="in no Report right now" c="muted"/>
    </div>
    <div className="card flush">
      <div className="card-hd" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <h2 style={{flex:1}}>Paragraph pool</h2>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search text…"
          style={{border:'1px solid var(--border)',borderRadius:6,padding:'5px 9px',fontSize:12.5,minWidth:180}}/>
        <select value={only} onChange={e=>setOnly(e.target.value)}>
          <option value="all">All paragraphs</option>
          <option value="shared">Reused only</option>
          <option value="orphan">Orphaned only</option>
        </select>
      </div>
      <div style={{padding:'0 17px 17px'}}>
        {rows.length===0 ? <Empty>Nothing matches.</Empty> : rows.map(({p,used})=>
          <div className="pool-i" key={p.id}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <b style={{fontSize:13}}>{p.h||'Untitled section'}</b>
              <DiagChip d={p.diag}/>
              {used.length>1 && <span className="reuse">↻ in {used.length} Reports</span>}
              {used.length===0 && <Tag c="grey">Not in any Report</Tag>}
              <span className="dim mono" style={{fontSize:11,marginLeft:'auto'}}>{p.id}</span>
            </div>
            <div style={{fontSize:12.5,lineHeight:1.66,marginTop:6,color:'var(--ink-2)'}}>
              {p.text || <span className="dim">Not written yet.</span>}</div>
            {(p.cites||[]).length>0 && <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:7}}>
              {p.cites.map(c=><span key={c} className="cref">{citeKind(c)} · {citeId(c)}</span>)}</div>}
            <div className="u">Written by {P(p.author).name}
              {used.length>0 && <> · appears in {used.map((r,i)=>
                <React.Fragment key={r.id}>{i>0&&', '}
                  <a onClick={()=>go('rpt',r.id)}>{rptName(r)} — {fmtP(r.period)}</a>
                </React.Fragment>)}</>}</div>
          </div>)}
      </div>
    </div>
  </>;
}

/* =========================================================================
   REPORTING HIERARCHY — every Report and every child Report it references
   This falls out of composition for free: a Report is a parent of another
   whenever one of its sections cites that Report, or a section of it.
   ========================================================================= */
function reportChildIds(db,rid){
  const r = db.reports.find(x=>x.id===rid); if(!r) return [];
  const out = [];
  (r.blocks||[]).forEach(bid=>{
    const p = db.paragraphs.find(x=>x.id===bid); if(!p) return;
    (p.cites||[]).forEach(c=>{
      const kind=citeKind(c), id=citeId(c);
      if(kind==='RPT' && id!==rid && !out.includes(id)) out.push(id);
      if(kind==='PAR'){
        const owner = db.reports.find(x=>x.id!==rid && (x.blocks||[]).includes(id));
        if(owner && !out.includes(owner.id)) out.push(owner.id);
      }
    });
  });
  return out;
}
const reportParentIds = (db,rid) => db.reports
  .filter(r=>reportChildIds(db,r.id).includes(rid)).map(r=>r.id);

function HierarchyTab(){
  const {db,go} = use();
  const [f,setF] = useState({name:'',type:'',dept:''});
  const [focus,setFocus] = useState(null);
  const list = db.reports;
  const cats  = [...new Set(list.map(r=>rptCfg(r).cat||'Custom'))];
  const depts = [...new Set(list.map(r=>r.dept))];

  const matches = r => (!f.name || rptName(r).toLowerCase().includes(f.name.toLowerCase()))
    && (!f.type || (rptCfg(r).cat||'Custom')===f.type)
    && (!f.dept || r.dept===f.dept);

  /* a branch stays visible if it, or anything under it, matches the filters */
  const branchMatches = (rid,seen={}) => {
    if(seen[rid]) return false; seen[rid]=1;
    if(matches(db.reports.find(r=>r.id===rid)||{})) return true;
    return reportChildIds(db,rid).some(c=>branchMatches(c,seen));
  };
  const roots = list.filter(r=>reportParentIds(db,r.id).length===0);

  const Node = ({rid,seen}) => {
    const r = db.reports.find(x=>x.id===rid); if(!r||seen[rid]) return null;
    const kids = reportChildIds(db,rid);
    const paras = (r.blocks||[]).map(b=>db.paragraphs.find(p=>p.id===b)).filter(Boolean);
    const dim = !branchMatches(rid,{});
    return <div className="tnode">
      <button className={'tbox'+(focus===rid?' on':'')+(dim?' dim':'')}
        onClick={()=>setFocus(focus===rid?null:rid)}>
        <span className="tw">{kids.length||'—'}</span>
        <span style={{flex:1,minWidth:0}}>
          <span className="n">{rptName(r)}</span>
          <span className="m">{fmtP(r.period)} · {r.dept} · {rptCfg(r).cat||'Custom'} ·
            {' '}{paras.length} section{paras.length===1?'':'s'}
            {kids.length>0 && ' · '+kids.length+' child Report'+(kids.length===1?'':'s')}</span>
        </span>
        <Tag c={rptTagC(r.status)}>{r.status}</Tag>
      </button>
      {kids.map(k=><Node key={k} rid={k} seen={{...seen,[rid]:1}}/>)}
    </div>;
  };

  const fr = focus ? db.reports.find(r=>r.id===focus) : null;
  const frParas = fr ? (fr.blocks||[]).map(b=>db.paragraphs.find(p=>p.id===b)).filter(Boolean) : [];
  const frBI = fr ? [...new Set(frParas.flatMap(p=>(p.cites||[])
    .filter(c=>citeKind(c)==='KPI')
    .map(c=>{const x=findKpi(citeId(c)); return x?x.k.bi:null;}).filter(Boolean)))] : [];

  return <>
    <Note k="info">Every Report and every child Report it references, as one tree. This is not a
      folder structure someone maintains — it is read straight off the citations, so it cannot
      drift from what the Reports actually contain.</Note>
    <div className="card" style={{marginTop:14}}>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
        <Field label="Name"><input type="text" value={f.name} onChange={e=>setF({...f,name:e.target.value})}
          placeholder="Filter by Report name" style={{minWidth:200}}/></Field>
        <Field label="Type"><select value={f.type} onChange={e=>setF({...f,type:e.target.value})}>
          <option value="">All types</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select></Field>
        <Field label="Department"><select value={f.dept} onChange={e=>setF({...f,dept:e.target.value})}>
          <option value="">All departments</option>{depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select></Field>
        {(f.name||f.type||f.dept) && <Btn onClick={()=>setF({name:'',type:'',dept:''})}>Clear</Btn>}
      </div>
    </div>

    <div className="grid2" style={{gridTemplateColumns:'1fr 340px',alignItems:'start'}}>
      <div className="card flush">
        <div className="card-hd"><h2>Report tree</h2>
          <div className="csub">{roots.length} top-level Report{roots.length===1?'':'s'} ·
            {' '}{list.length} in total. Click any Report to focus it.</div></div>
        <div style={{padding:'4px 17px 17px'}}>
          <div className="tree">{roots.map(r=><Node key={r.id} rid={r.id} seen={{}}/>)}</div>
        </div>
      </div>

      <div>
        {!fr ? <div className="card"><Empty ic="⌷">Select a Report in the tree to see what is
          inside it — its sections, its sources and the dashboards behind it.</Empty></div>
        : <>
          <div className="card">
            <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <h2 style={{flex:1,marginBottom:0}}>{rptName(fr)}</h2>
              <Tag c={rptTagC(fr.status)}>{fr.status}</Tag>
            </div>
            <div className="csub" style={{marginTop:6}}>{fmtP(fr.period)} · {fr.dept} · {fr.bu}</div>
            <KVBlock items={[
              ['Type', rptCfg(fr).cat||'Custom'],
              ['Owner', P(fr.creator).name],
              ['Parents', reportParentIds(db,fr.id).length
                ? reportParentIds(db,fr.id).map(p=>rptName(db.reports.find(r=>r.id===p))).join(', ')
                : 'None — this is a top-level Report'],
              ['Child Reports', reportChildIds(db,fr.id).length||'None'],
            ]}/>
            <div className="btn-row" style={{marginTop:4}}>
              <Btn k="pri" onClick={()=>go('rpt',fr.id)}>Open this Report</Btn></div>
          </div>
          <div className="card flush">
            <div className="card-hd"><h2>What is inside it</h2></div>
            {frParas.length===0 ? <div style={{padding:'8px 17px 17px'}}>
                <Empty>No sections written yet.</Empty></div>
            : <table className="data"><tbody>{frParas.map((p,i)=>
                <tr key={p.id}><td>
                  <div className="t-main">{i+1}. {p.h||'Untitled section'}</div>
                  <div className="t-sub">{(p.cites||[]).length} citation
                    {(p.cites||[]).length===1?'':'s'}</div></td>
                  <td style={{textAlign:'right'}}><DiagChip d={p.diag}/></td>
                </tr>)}</tbody></table>}
          </div>
          {frBI.length>0 && <div className="card">
            <h2>Dashboards behind it</h2>
            <div className="csub">Reached through the KPIs its sections cite.</div>
            {frBI.map(b=><div className="att-row" key={b}>
              <div className="att-ic">▦</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="t-main" style={{fontSize:12.5}}>{BIR(b).n}</div>
                <div className="t-sub mono" style={{fontSize:10.5}}>{b}</div></div>
              <a href={BIR(b).link} target="_blank" rel="noopener">Open ↗</a>
            </div>)}
          </div>}
        </>}
      </div>
    </div>
  </>;
}

/* =========================================================================
   CREATE REPORT — multi-step wizard (Template → Details → Sections → Submit)
   ========================================================================= */
const shiftPeriod = (p,n) => { const [y,m]=p.split('-').map(Number);
  const d=new Date(y,m-1+n,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const WIZ_STEPS = [
  {id:'template', n:1, label:'Template',    hint:'Select template'},
  {id:'details',  n:2, label:'Details',     hint:'Fill fields'},
  {id:'sections', n:3, label:'Sections',    hint:'Choose the structure'},
  {id:'submit',   n:4, label:'Submit',      hint:'Review & submit'},
];
const WIZ_DEPTS = ['Hospital-Wide','Quality','Nursing','Pharmacy','Facilities','Emergency','Executive'];
const TPL_STYLE = {
  rs1:{ic:'📊', bg:'var(--teal-l)',  fg:'var(--teal-d)'},
  rs2:{ic:'👥', bg:'var(--blue-bg)', fg:'var(--blue)'},
  rs3:{ic:'📈', bg:'var(--green-bg)',fg:'var(--green)'},
  rs4:{ic:'🛠', bg:'var(--amber-bg)',fg:'var(--amber)'},
};

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
  const {A,S,db} = use();
  const [step,setStep]=useState('template');
  const [setupId,setSetupId]=useState(null);
  const [f,setF]=useState({title:'',period:PERIOD,dept:'Hospital-Wide',bu:'ALL',
    summary:'',actions:'',reviewers:['u5'],site:'Quality',folder:'2026 / Ad Hoc',tpl:''});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));

  const isCustom = setupId==='custom';
  const setup = (setupId && !isCustom) ? RPT_SETUPS.find(s=>s.id===setupId) : null;
  const chain = isCustom ? f.reviewers : (setup?setup.reviewers:[]);
  const setupLabel = isCustom ? 'Custom — no approved Setup' : setup ? setup.name : 'No template selected yet';

  const chooseTpl = id => { setSetupId(id);
    const s = id!=='custom' ? RPT_SETUPS.find(x=>x.id===id) : null;
    setF(x=>({...x, title: s ? s.name+' — '+fmtP(x.period) : x.title,
                    tpl: s ? (s.tpl||'') : x.tpl })); };

  const required = [!!f.dept.trim(), !!f.period, !!f.summary.trim(),
    isCustom?!!f.title.trim():true, isCustom?f.reviewers.length>0:true];
  const filledCount = required.filter(Boolean).length, totalCount = required.length;
  const detailsOk = filledCount===totalCount;

  const next = () => {
    if(step==='template') setStep('details');
    else if(step==='details') setStep('sections');
    else if(step==='sections') setStep('submit');
  };
  const cancel = () => {
    if(step!=='template' && !window.confirm('Discard this new Report? Nothing entered will be saved.')) return;
    onClose();
  };
  const saveDraft = () => { if(!setupId) return; A.createReportFromWizard({...f,setupId,submit:false}); onClose(); };
  const submit    = () => { if(!setupId) return; A.createReportFromWizard({...f,setupId,submit:true});  onClose(); };

  return <>
    <div className="crumb"><a onClick={cancel}>Reports</a> › <b>New Report</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>Create Report</h1>
        <div className="sub">Select a template, fill in the details, and submit for review.</div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn onClick={cancel}>Cancel</Btn>
        {step!=='submit' && <Btn disabled={!setupId} onClick={saveDraft}>Save Draft</Btn>}
        {step!=='submit' && <Btn k="pri" onClick={next}>Next Step</Btn>}
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
          <div className="wa-mo-r txt"><label>Template</label>
            <span className="v">{isCustom?'Custom':setupLabel}</span></div>
          <div className="wa-mo-r txt"><label>Setup</label>
            <span className="v">{isCustom?'—':setupLabel}</span></div>
          <div className="wa-mo-r txt"><label>Created</label>
            <span className="v">{fmtD(TODAY)}</span></div>
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

    {step==='sections' && <div style={{maxWidth:620}}>
      <h2 style={{marginBottom:2}}>Choose the sections</h2>
      <div className="csub">A Report is written as sections that cite live records. Pick the
        structure it starts with — every section stays editable, removable and reorderable once
        the Report is open.</div>

      <div className="card">
        <Field label="Section template" hint="Its KPIs are pre-linked, so the Report opens with this period's real achievement already in place.">
          <select value={f.tpl} onChange={e=>set('tpl',e.target.value)}>
            <option value="">Blank — start with no sections</option>
            {(db.templates||[]).map(t=><option key={t.id} value={t.id}>{t.n}</option>)}
          </select>
        </Field>
        {f.tpl && tplOf(db,f.tpl) && <div className="csub" style={{marginTop:2}}>{tplOf(db,f.tpl).desc}</div>}
      </div>

      {f.tpl && tplOf(db,f.tpl)
        ? <div className="card flush">
            <div className="card-hd"><h2>Sections it will create</h2></div>
            <table className="data">
              <thead><tr><th style={{width:34}}>#</th><th>Section</th><th>Angle</th><th>Pre-linked</th></tr></thead>
              <tbody>{tplOf(db,f.tpl).sections.map((s,i)=>
                <tr key={i}><td className="dim mono">{i+1}</td>
                  <td><div className="t-main">{s.h}</div></td>
                  <td><DiagChip d={s.diag}/></td>
                  <td className="dim">{s.cites.length
                    ? s.cites.length+' citation'+(s.cites.length===1?'':'s') : '—'}</td>
                </tr>)}</tbody></table>
          </div>
        : <Note k="info">Starting blank is fine — you add sections one at a time inside the Report,
            and can insert a template's sections at any point afterwards.</Note>}
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
          <div className="rs-cell full"><label>Sections</label>
            <div>{f.tpl && tplOf(db,f.tpl)
              ? tplOf(db,f.tpl).n+' — '+tplOf(db,f.tpl).sections.length+' sections'
              : 'Blank — sections added inside the Report'}</div></div>
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
        <Btn style={{flex:1}} onClick={()=>setStep('sections')}>Back to Edit</Btn>
        <Btn k="grn" style={{flex:1}} onClick={submit}>➤ Submit for Review</Btn>
      </div>
    </div>}
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

const fmtFileSize = b => b<1024?b+' B' : b<1048576?(b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';

/* Create a Report Occurrence — writes straight to lm_reportoccurrences, either
   from an approved Report Template or as a fully Ad Hoc / Custom Report with
   no Setup behind it. Mirrors NewMeetingModal's shape: pick a real Setup (or
   Custom), the form pre-fills from the Template's per-unit placement and
   review chain, and everything is still real Dataverse row ids -- the seeded
   demo people used elsewhere in this module are not real rows and the
   lookups would reject them.

   A Report Occurrence carries no reviewer list of its own -- the review chain
   lives on the Template, resolved per Business Unit/Region (same as a
   Meeting's per-unit Chair/Facilitator), so this form only ever *previews*
   it. A Custom/No-Setup Report has no Template and therefore no configured
   review chain at all, matching what DvReportDetail already shows. */
/* Proof of concept: read an uploaded workbook entirely in the browser and log
   what it finds as "components" -- one per sheet, plus any named range the
   template author defined -- so we can see whether Excel's own structure is
   enough to locate a checklist's required content before wiring this to
   Dataverse. Nothing here is uploaded or saved. */
async function readExcelComponents(file){
  /* Loaded on demand, same reasoning FilePreview.jsx already documents for
     its own copy of this import: xlsx is a large dependency and this proof
     of concept is rare, so a static import would make every page load pay
     for it. A static import here also defeated FilePreview's own dynamic
     one -- Rollup cannot split a module into its own lazy chunk while
     something else in the same bundle imports it statically, so the two
     copies collapsed into one ~500kB addition to the MAIN chunk instead of
     a chunk loaded only when a file preview actually opens. */
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type:'array'});
  const names = wb.Workbook?.Names || [];
  console.log(`[Excel] "${file.name}" — ${wb.SheetNames.length} sheet(s), ${names.length} named range(s)`);

  wb.SheetNames.forEach(sheetName=>{
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, defval:''});
    console.log(`[Excel] Sheet "${sheetName}" — ${rows.length} row(s)`);
    console.table(rows);
  });

  names.forEach(n=>{
    try{
      const [rangeSheet, rangeRef] = n.Ref.split('!');
      const sheetName = rangeSheet.replace(/^'|'$/g,'');
      const sheet = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(rangeRef.replace(/\$/g,''));
      const rows = XLSX.utils.sheet_to_json(sheet, {header:1, defval:'', range});
      console.log(`[Excel] Named range "${n.Name}" → ${n.Ref} — ${rows.length} row(s)`);
      console.table(rows);
    }catch(e){ console.warn(`[Excel] Could not read named range "${n.Name}":`, e); }
  });

  console.log(`[Excel] Done — "${file.name}".`);
}

/* The Ad Hoc pickers list APPROVED Setups only.

   Both modals used to offer every Setup the register held — Draft, Under
   Review and Expired included — while their own labels said "Approved Setup".
   Creating an occurrence from an unapproved Setup produces a governed record
   whose rules nobody has signed off.

   "Approved" is decided the same way the rest of the app decides it: an
   unrecognised or blank status reads as Active / Approved, because rows
   written before the status column existed have none and are genuinely in use.
   Anything explicitly Draft, Under Review or Expired is excluded. */
const APPROVED_STATUS = 'Active / Approved';
const setupIsApproved = s =>
  (TEMPLATE_STATUS_LABEL[s?.statusCode] || APPROVED_STATUS) === APPROVED_STATUS;

/* The report's working file is uploaded into a Dataverse File column, whose
   default ceiling is 32 MB -- refused here rather than by a failed upload after
   the report already exists. */
const REPORT_FILE_MAX = 32 * 1024 * 1024;
/* FileReader -> base64 without the data: prefix, the body the File-column
   upload takes (same convention as Governance's template upload). */
const fileToBase64 = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => { const t = String(r.result || ''); const i = t.indexOf(',');
                     resolve(i >= 0 ? t.slice(i + 1) : t); };
  r.onerror = () => reject(r.error || new Error('Could not read the file.'));
  r.readAsDataURL(file);
});
const fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(0) + ' KB'
  : (n/1048576).toFixed(1) + ' MB';

/* Create Report -- a full page since 28 Sep (was NewReportModal). Reached from
   every "+ New Report" through openNewReport(), which remembers the screen it
   was opened from so Cancel returns there. */
function ScreenNewReport(){
  const {toast,refreshOccurrences,dvLookup,go,newReportReturn}=use();
  const onClose = ()=>go(newReportReturn||'orpt');
  const [step,setStep]=useState(1);
  const [tplQ,setTplQ]=useState('');
  /* What the Create button is doing right now: {label, done, total}. `total`
     0 means "no count available", which renders as an indeterminate bar. */
  const [progress,setProgress]=useState(null);
  /* The signed-in user's own Position, resolved by dvLookup.myPositionIds
     (systemuser id first, holder name second -- see myPositionIds where the
     context is built). This is the Position "Created by" means. */
  const myPos = useMemo(()=>{
    const ids = dvLookup?.myPositionIds || [];
    return DV_POS_LIST.find(p=>ids.includes(p.id)) || null;
  },[dvLookup]);
  const [f,setF]=useState({
    setup:'', tplUnitKey:'',
    name:'', objective:'', fileUrl:'',
    period: TODAY.slice(0,7),          // month the Report covers
    stage:'Business Unit',
    dvBusinessUnitId:'', dvRegionId:'', dvDepartmentId:'', dvFunctionId:'', dvCreatorPositionId:'',
    teamName:'', channelId:'',
  });
  /* The file to upload once the report exists (Attachments step). */
  const [file,setFile]=useState(null);
  /* Teams and channels (and_teamschannellinks, IT), read once. A Custom report
     must pick one; a template's own channel is resolved from the same rows. */
  const [channels,setChannels]=useState(null);
  const [channelsErr,setChannelsErr]=useState(false);
  useEffect(()=>{
    let live=true;
    fetchTeamsChannels()
      .then(rows=>{ if(live) setChannels(rows); })
      .catch(e=>{ console.warn('[dataverse] fetchTeamsChannels() failed:', e);
                  if(live){ setChannels([]); setChannelsErr(true); } });
    return ()=>{ live=false; };
  },[]);
  const [saving,setSaving]=useState(false);
  const [tplDetail,setTplDetail]=useState(null);
  const [tplLoading,setTplLoading]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const custom = f.setup==='custom';

  /* Stage decides what the Report is scoped to, exactly as it does for a
     Meeting: Stage 1 runs in a Business Unit, Stage 2 in a Region, Group and
     ExCom once group-wide. Department and Creator narrow to whichever applies. */
  const stageBU     = f.stage==='Business Unit';
  const stageRegion = f.stage==='Region';
  const scopeChosen = !(stageBU && !f.dvBusinessUnitId) && !(stageRegion && !f.dvRegionId);
  /* The Departments this Setup actually names --
     lm_reporttemplatedepartmentfunctions, already on the detail as `lines`. */
  const tplDeptIds = useMemo(()=>new Set(
    (tplDetail?.lines || []).map(l=>l._lm_department_value).filter(Boolean)),
  [tplDetail]);

  /* ⚠️ A Setup's own Departments beat the scope inference.
     departmentsForScope() works backwards from Positions -- "every Department
     some Position in this Business Unit belongs to" -- which can offer a
     Department the Setup never named and miss one it did. The Setup names them
     outright, so when there is one, it wins.

     Falls back to the inference for a Custom report, while the Setup is still
     loading, or when the Setup names no Department at all. */
  const tplDepts = DV_DEPT_LIST.filter(d=>tplDeptIds.has(d.id));

  /* ⚠️ The Setup's lines are Department/Function PAIRS, so the Functions on
     offer are the ones paired with the Department chosen -- not every
     Function that Department happens to own. A line with no Function means
     "the whole Department", and contributes nothing here. */
  const tplFuncIds = useMemo(()=>new Set(
    (tplDetail?.lines || [])
      .filter(l=>!f.dvDepartmentId || l._lm_department_value === f.dvDepartmentId)
      .map(l=>l._lm_function_value).filter(Boolean)),
  [tplDetail, f.dvDepartmentId]);
  const fromSetup = !custom && tplDepts.length > 0;
  const deptOpts = fromSetup
    ? tplDepts
    : departmentsForScope(f.stage, f.dvBusinessUnitId, f.dvRegionId);
  /* Same precedence as the Department: what the Setup pairs wins, and the
     fallback is every Function belonging to the chosen Department. Without a
     Department there is nothing to narrow by, so nothing is offered. */
  const tplFuncs = DV_FUNC_LIST.filter(fn=>tplFuncIds.has(fn.id));
  const funcFromSetup = !custom && tplFuncs.length > 0;
  const funcOpts = funcFromSetup
    ? tplFuncs
    : (f.dvDepartmentId ? DV_FUNC_LIST.filter(fn=>fn.dept === f.dvDepartmentId) : []);

  const scopedPos = positionsForScope(f.stage, f.dvBusinessUnitId, f.dvRegionId);
  /* Your own Position is always offered, even when it sits outside the
     chosen scope. "Created by" is who is preparing the report, which is not
     a fact about the scope it covers -- and a scope with no Positions in it
     is exactly when this field was impossible to fill. */
  const posOpts = useMemo(()=>
    myPos && !scopedPos.some(p=>p.id===myPos.id) ? [myPos, ...scopedPos] : scopedPos,
  [myPos, scopedPos]);

  /* Keep the Department consistent with the Setup's own list. Two rules, one
     effect, because both turn on the same inputs:

       - a Department picked before that list arrived may not be on it, so it
         is cleared rather than submitted against a Setup that never named it
       - when the Setup names exactly ONE there is no decision to make, so it
         is chosen. The same rule already applies to the Business Unit /
         Region placement above ("Auto-apply the single placement").

     Only ever fills a BLANK field, so an explicit choice survives.

     ⚠️ Deliberately restricted to `fromSetup`. The fallback list is inferred
     from Positions, and auto-selecting an inferred Department would put a
     value the Setup never governed onto a governed record. */
  useEffect(()=>{
    if(!fromSetup) return;
    if(f.dvDepartmentId && !deptOpts.some(d=>d.id===f.dvDepartmentId)){
      set('dvDepartmentId','');
      return;                      // the next run picks the lone one, if any
    }
    if(!f.dvDepartmentId && deptOpts.length===1) set('dvDepartmentId', deptOpts[0].id);
  },[fromSetup, deptOpts, f.dvDepartmentId]);

  /* The Function follows the Department, by the same two rules: drop one that
     is no longer on offer (the Department changed under it), and take a lone
     option rather than asking for a choice that does not exist. */
  useEffect(()=>{
    if(f.dvFunctionId && !funcOpts.some(fn=>fn.id===f.dvFunctionId)){
      set('dvFunctionId','');
      return;
    }
    if(!f.dvFunctionId && funcOpts.length===1) set('dvFunctionId', funcOpts[0].id);
  },[funcOpts, f.dvFunctionId]);

  /* Default to it once a scope exists. Not an initial state value: choosing a
     Stage, Business Unit or Region deliberately clears this field, so the
     default has to be re-applied after each of those. Only ever fills a BLANK
     field, so an explicit choice is never overwritten. */
  useEffect(()=>{
    if(myPos && scopeChosen && !f.dvCreatorPositionId) set('dvCreatorPositionId', myPos.id);
  },[myPos, scopeChosen, f.dvCreatorPositionId]);
  const scopeHint = stageBU ? 'Narrowed to the chosen Business Unit.'
    : stageRegion ? 'Narrowed to every Business Unit in the chosen Region.'
    : 'Group and ExCom Reports are not narrowed — everything is offered.';

  /* Every Business Unit / Region the selected Report Template is actually
     approved to run in, each carrying that unit's own review chain -- read
     straight from lm_reporttemplatebusinessunitses / lm_reporttemplateregions
     via fetchReportTemplateDetail(). */
  const tplUnits = tplDetail ? [
    ...(tplDetail.businessUnits||[]).map(b=>({
      key:b._lm_businessunit_value, kind:'bu',
      label: dvBu(b._lm_businessunit_value) || '(Business Unit not in the loaded list)',
      channelId: b._lm_teamchannel_value || null,
      reviewChain: (b.reviewChain||[]).slice().sort((a,b2)=>(a.lm_step||0)-(b2.lm_step||0)),
    })),
    ...(tplDetail.regions||[]).map(r=>({
      key:r._lm_region_value, kind:'region',
      label: dvRegion(r._lm_region_value) || '(Region not in the loaded list)',
      channelId: r._lm_teamchannel_value || null,
      reviewChain: (r.reviewChain||[]).slice().sort((a,b2)=>(a.lm_step||0)-(b2.lm_step||0)),
    })),
  ].filter(u=>u.key) : [];

  /* The chosen unit's chain, named once -- the review chain panel below used
     to re-run this find() three times in one expression. */
  const reviewChain = (tplUnits.find(u=>u.key===f.tplUnitKey)?.reviewChain) || [];

  const applyUnit = unit => {
    setF(x=>({...x,
      tplUnitKey: unit ? unit.key : '',
      // A Setup with no approved Business Unit or Region runs once, group-wide
      // -- unlike a Meeting Template, a Report Template carries no lm_stages
      // field to say Group vs ExCom, so this always resolves to 'Group'.
      // Leaving the initial 'Business Unit' default in place here previously
      // left scopeChosen permanently false for a group-wide Setup, which
      // stuck Department and Created By disabled with no way to enable them.
      stage: unit ? (unit.kind==='bu'?'Business Unit':'Region') : 'Group',
      dvBusinessUnitId: unit&&unit.kind==='bu' ? unit.key : '',
      dvRegionId: unit&&unit.kind==='region' ? unit.key : '',
      dvDepartmentId:'',
    }));
  };

  /* Reading a Template's own per-unit placement and review chain is a
     separate, heavier call than the lightweight list the picker is built
     from, so it only runs once a real Template is actually chosen. */
  useEffect(()=>{
    if(custom || !f.setup){ setTplDetail(null); setTplLoading(false); return; }
    let cancelled=false;
    setTplLoading(true); setTplDetail(null);
    setF(x=>({...x, tplUnitKey:'', dvBusinessUnitId:'', dvRegionId:'', dvDepartmentId:''}));
    fetchReportTemplateDetail(f.setup)
      .then(d=>{
        if(cancelled) return;
        setTplDetail(d);
        /* The Template's own objective is a reasonable starting point for
           this occurrence's -- still freely editable below. No longer
           capped on the way in: lm_reportoccurrence.lm_reportobjective was
           widened in Dataverse, so copying the Template's lm_objective
           whole no longer risks a save the column can't hold. */
        if(d?.parent?.lm_objective) setF(x=>({...x,
          objective: x.objective || d.parent.lm_objective}));
        if(d?.parent?.lm_newcolumn) setF(x=>({...x, name: x.name||d.parent.lm_newcolumn}));
      })
      .catch(e=>console.warn('[dataverse] fetchReportTemplateDetail() failed:', e))
      .finally(()=>{ if(!cancelled) setTplLoading(false); });
    return ()=>{cancelled=true;};
  },[custom, f.setup]);

  /* Auto-apply the single placement a Template is approved for -- a
     Template approved for more than one Business Unit or Region waits on
     the picker below instead. */
  useEffect(()=>{
    if(custom || !tplDetail) return;
    if(tplUnits.length<=1) applyUnit(tplUnits[0]||null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tplDetail]);

  /* Where this report will be saved in SharePoint. A Custom report names its
     Team and Channel here; a template report takes its channel from the unit
     it runs in, else the template's own (group-wide). The path is BUILT from
     the channel rather than copied from the template's stored text: 50 of the
     53 stored template destinations carry the doubled-folder bug fixed 28 Sep.
     The stored text is used only when the template names no channel. */
  const CH = channels || [];
  const teamNames = [...new Set(CH.map(c=>c.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const teamChannels = CH.filter(c=>c.team===f.teamName).sort((a,b)=>a.name.localeCompare(b.name));
  const tplChannelId = custom ? null
    : (tplUnits.find(u=>u.key===f.tplUnitKey)?.channelId || tplDetail?.parent?._lm_teamchannel_value || null);
  const channelId = custom ? f.channelId : tplChannelId;
  const channelRow = CH.find(c=>c.id===channelId) || null;
  const destination = channelRow ? channelDestinationPath(channelRow)
    : (!custom ? (tplDetail?.parent?.lm_destinationsharepointlink || '') : '');
  const fileTooBig = !!file && file.size > REPORT_FILE_MAX;

  const ok = !!f.setup && f.name.trim() && f.objective.trim() && scopeChosen
    && f.dvCreatorPositionId && f.period && !fileTooBig
    && (!custom || !!f.channelId)
    && (custom || (!tplLoading && (tplUnits.length<=1 || !!f.tplUnitKey)));

  const save=async()=>{
    setSaving(true);
    try{
      const {id,errors}=await createReportOccurrence({
        name:f.name.trim(),
        objective:f.objective.trim(),
        templateId: custom ? undefined : f.setup,
        stage:f.stage,
        businessUnitId:(stageBU && f.dvBusinessUnitId) ? f.dvBusinessUnitId : undefined,
        regionId:(stageRegion && f.dvRegionId) ? f.dvRegionId : undefined,
        departmentId:f.dvDepartmentId||undefined,
        functionId:f.dvFunctionId||undefined,
        creatorPositionId:f.dvCreatorPositionId||undefined,
        // A month is stored as its first day -- the column is a date, and the
        // Report covers the period, not a particular day in it.
        period:f.period ? f.period+'-01' : undefined,
        channelId: channelId || undefined,
        destinationLink: destination || undefined,
        status:'Draft',
        version:1,
        reviewStep:0,
        noSetupFlag: custom,
      });
      if(!id){
        console.warn('[dataverse] Report Occurrence create failed:', errors);
        toast('Not saved','Creating the Report Occurrence in Dataverse failed. Check the console for details.','err');
        return;
      }
      /* The working file, into lm_attachmentfile. The report already exists,
         so a failed upload is reported as its own thing, not as "not created". */
      let fileErr = null;
      if(file){
        setProgress({ label: `Uploading ${file.name}…`, done: 0, total: 0 });
        try{
          const { errors: fe } = await uploadReportOccurrenceFile(id, file.name, await fileToBase64(file));
          if(fe.length){ fileErr = fe; console.warn('[dataverse] Report file upload failed:', fe); }
        }catch(e){ fileErr = [e]; console.warn('[dataverse] Report file upload threw:', e); }
      }

      /* Copy the Setup's Content Checklist down as this occurrence's Sections.
         A Custom report has no Setup to copy from. The occurrence already
         exists, so a failure here is reported as its own thing rather than
         as "the report was not created". */
      let migrated = null;
      if(!custom){
        try{
          migrated = await migrateTemplateSectionsToOccurrence(id, f.setup,
            p => setProgress({ label: p.label, done: p.done, total: p.total }));
          if(migrated.errors.length)
            console.warn('[dataverse] section migration had errors:', migrated.errors);
        }catch(e){
          console.warn('[dataverse] migrateTemplateSectionsToOccurrence() threw:', e);
        }
      }

      const sectionNote = !migrated ? ''
        : migrated.created
          ? ` ${migrated.created} section${migrated.created===1?'':'s'} and ${migrated.citations} citation${migrated.citations===1?'':'s'} copied from the Setup.`
            + (migrated.skippedFiles
                ? ` ${migrated.skippedFiles} file citation${migrated.skippedFiles===1?'':'s'} could not be copied — attach them here.`
                : '')
          : ' The Setup defines no sections, so this report starts empty.';

      toast(custom?'Ad Hoc Report created':'Report created from the approved Setup',
        (custom
          ? 'Saved as a Draft, flagged as having no Setup. Opened for editing.'
          : 'Saved as a Draft, linked to its approved Report Template. Opened for editing.') + sectionNote
          + (fileErr ? ` The file “${file.name}” did not upload — attach it from the report.` : ''),
        (migrated && migrated.errors.length) || fileErr ? 'warn' : 'ok');
      setProgress({ label: 'Refreshing your reports…', done: 0, total: 0 });
      await refreshOccurrences();
      /* Open the new report in Build a report/plan. AFTER the refresh, not
         before: that screen picks its record out of `reports`, so navigating
         first would land on a list the new row is not in yet and fall back to
         whatever was top of it. */
      go('build', id);
    }catch(e){
      console.warn('[dataverse] Report Occurrence create threw unexpectedly:', e);
      toast('Not saved','Creating the Report Occurrence in Dataverse failed. Check the console for details.','err');
    }finally{ setSaving(false); setProgress(null); }
  };

  /* ---- the page (28 Sep, from the approved design's Create Report view) ----
     Was a modal; now a full page in four steps. What each step needs before
     Next is allowed is exactly what `ok` above already demanded, split up:
     the logic, the Dataverse writes and the rules are unchanged. The Excel
     "read components" proof of concept is no longer offered here (it only
     logged to the console); readExcelComponents() itself is kept. */
  const approvedTpls = (DV_RPT_TPL_LIST||[]).filter(setupIsApproved);
  const hiddenTpls = (DV_RPT_TPL_LIST||[]).length - approvedTpls.length;
  const needle = tplQ.trim().toLowerCase();
  const shownTpls = needle
    ? approvedTpls.filter(t => [t.name, t.objective, REPORT_CATEGORY[t.reportCategoryCode],
        REPORT_FREQUENCY[t.frequencyCode], REPORT_TYPE[t.reportTypeCode]]
        .some(v => v && String(v).toLowerCase().includes(needle)))
    : approvedTpls;
  const chosenTpl = custom ? null : approvedTpls.find(t => t.id === f.setup) || null;

  const step1ok = !!f.setup && (custom || !tplLoading);
  const step2ok = step1ok && !!f.name.trim() && !!f.objective.trim() && scopeChosen
    && !!f.dvCreatorPositionId && !!f.period
    && (!custom || !!f.channelId)
    && (custom || tplUnits.length<=1 || !!f.tplUnitKey);
  const step3ok = step2ok && !fileTooBig;
  const canReach = n => n===1 || (n===2 && step1ok) || (n===3 && step2ok) || (n===4 && step3ok);
  const stepOk = [null, step1ok, step2ok, step3ok, !!ok];
  const STEPS = [
    {n:1, t:'Template',    s:'Select template'},
    {n:2, t:'Details',     s:'Fill fields'},
    {n:3, t:'Attachments', s:'Upload the file'},
    {n:4, t:'Review',      s:'Create the Draft'},
  ];
  /* Icon and colour by Report Category, so a type reads at a glance. */
  const tplLook = t => t.reportCategoryCode===1 ? {Ic:Activity,  c:'green'}
    : t.reportCategoryCode===3 ? {Ic:CircleAlert, c:'amber'}
    : {Ic:FileText, c:'gold'};

  const pickTpl = id => { if(id!==f.setup) set('setup', id); };

  return <div className="cs-root">
    <div className="cs-head" style={{paddingBottom:16}}>
      <div className="cs-crumb"><button type="button" onClick={onClose}>Reports</button> › <b>New Report</b></div>
      <div className="cs-head-top">
        <div><h1 className="cs-title">Create Report</h1>
          <p className="cs-sub">Select a template, fill in the details, and create a Draft. It opens in
            Build a report/plan, where it is written and later submitted for review.</p></div>
        <div className="cs-actions">
          <button type="button" className="cs-btn ghost lg" onClick={onClose} disabled={saving}>Cancel</button>
          {step<4
            ? <>
                <button type="button" className="cs-btn ghost lg" onClick={save} disabled={!ok||saving}
                  title={ok?'Create the Draft now':'Fill the required details first'}>
                  {saving?'Saving…':'Save Draft'}</button>
                <button type="button" className="cs-btn primary lg" disabled={!stepOk[step]||saving}
                  onClick={()=>setStep(step+1)}>Next Step</button>
              </>
            : <button type="button" className="cs-btn primary lg" onClick={save} disabled={!ok||saving}>
                {saving?'Saving…':'Save Draft'}</button>}
        </div>
      </div>
    </div>

    <nav className="cs-stepper" aria-label="Create Report steps">
      {STEPS.map((x,i)=><React.Fragment key={x.n}>
        {i>0 && <span className={'cs-step-line'+(step>x.n-1 && stepOk[x.n-1]?' done':'')} aria-hidden="true"/>}
        <button type="button" disabled={!canReach(x.n) || saving}
          className={'cs-step'+(step===x.n?' on':step>x.n?' done':'')+(canReach(x.n)?' reach':'')}
          aria-current={step===x.n?'step':undefined} onClick={()=>setStep(x.n)}>
          <span className="cs-step-n">{step>x.n ? '✓' : x.n}</span>
          <span><span className="cs-step-t">{x.t}</span><span className="cs-step-s">{x.s}</span></span>
        </button>
      </React.Fragment>)}
    </nav>

    {/* The create itself -- see the progress note in save(). */}
    {saving && progress &&
      <Note k="info" ic="i">
        {progress.label}
        <div className={'bar' + (progress.total ? '' : ' indet')} style={{marginTop:8}}>
          <i style={progress.total
            ? {width: Math.round((progress.done / progress.total) * 100) + '%'}
            : undefined}/>
        </div>
      </Note>}

    {step===1 && <>
      <div>
        <h2 className="cs-h2">Choose a Report Template</h2>
        <p className="cs-sub" style={{margin:0}}>Templates are published through <b>Governance Setup</b>. Only
          active, approved templates appear here.</p>
      </div>
      <div className="cs-info">
        <FileText size={13} aria-hidden="true"/>
        <span>Showing <b>{approvedTpls.length}</b> approved template{approvedTpls.length===1?'':'s'} from the
          Setup Register{hiddenTpls>0?<> ({hiddenTpls} not approved and hidden)</>:null}. A template brings its
          review chain, sections and placement with it.</span>
        <span className="cs-search cs-chips-end">
          <input type="search" value={tplQ} placeholder="Search templates…" aria-label="Search templates"
            onChange={e=>setTplQ(e.target.value)}/>
          {needle ? <span className="cs-search-n">{shownTpls.length} of {approvedTpls.length}</span> : null}
        </span>
      </div>

      {(DV_RPT_TPL_LIST||[]).length>0 && approvedTpls.length===0
        ? <Note k="warn">None of the {(DV_RPT_TPL_LIST||[]).length} Setups read from Dataverse is Active /
            Approved, so there is nothing to create from. Approve one in Governance Setup first — or use a
            Custom Report.</Note>
        : null}

      <div className="cs-tpl-grid" role="radiogroup" aria-label="Report templates">
        {shownTpls.map(t=>{
          const {Ic,c}=tplLook(t);
          return <button key={t.id} type="button" role="radio" aria-checked={f.setup===t.id}
              className={'cs-tpl'+(f.setup===t.id?' on':'')} onClick={()=>pickTpl(t.id)}>
            <span className={'cs-icon '+c} aria-hidden="true"><Ic size={16}/></span>
            <span className="cs-tpl-t">{t.name}</span>
            <span className="cs-tpl-d">{t.objective || 'No objective recorded on this template.'}</span>
            <span className="cs-tpl-tags">
              {REPORT_CATEGORY[t.reportCategoryCode] && <span className="cs-type">{REPORT_CATEGORY[t.reportCategoryCode]}</span>}
              {REPORT_TYPE[t.reportTypeCode] && <span className="cs-type green">{REPORT_TYPE[t.reportTypeCode]}</span>}
              {REPORT_FREQUENCY[t.frequencyCode] && <span className="cs-type adhoc">{REPORT_FREQUENCY[t.frequencyCode]}</span>}
              <span className="cs-type adhoc">Setup v{t.version||1}</span>
            </span>
          </button>;})}
        <button type="button" role="radio" aria-checked={custom}
            className={'cs-tpl'+(custom?' on':'')} onClick={()=>pickTpl('custom')}>
          <span className="cs-icon dark" aria-hidden="true"><PenLine size={16}/></span>
          <span className="cs-tpl-t">Custom Report</span>
          <span className="cs-tpl-d">No approved Setup behind it — you set the stage, scope and department
            yourself. It carries no configured review chain.</span>
          <span className="cs-tpl-tags"><span className="cs-type amber">Custom</span></span>
        </button>
      </div>
      {needle && shownTpls.length===0
        ? <div className="cs-card-note">No approved template matches “{tplQ.trim()}”. Custom Report is always
            available.</div> : null}

      {f.setup && !custom && tplLoading &&
        <Note k="info" ic="i">
          Reading this Setup's organizational placement and review chain from Dataverse…
          <div className="bar indet" style={{marginTop:8}}><i/></div>
        </Note>}
    </>}

    {step===2 && <section className="cs-card cs-form" aria-labelledby="nr-details">
      <h2 className="cs-card-title" id="nr-details">
        Details — {custom ? 'Custom Report' : (chosenTpl?.name || 'the chosen template')}</h2>

      {!custom && tplUnits.length>1 &&
        <Field label="Business Unit / Region" req
          hint="This Setup is approved for more than one place — choose which one this Report belongs to.">
          <select value={f.tplUnitKey} onChange={e=>applyUnit(tplUnits.find(u=>u.key===e.target.value)||null)}>
            <option value="">Select…</option>
            {tplUnits.map(u=><option key={u.key} value={u.key}>{u.label}</option>)}
          </select></Field>}
      {!custom && tplUnits.length===1 &&
        <Note k="info" ic="i">Business Unit / Region: <b>{tplUnits[0].label}</b> — the only place this
          Setup is approved to run.</Note>}
      {!custom && tplUnits.length===0 &&
        <Note k="info" ic="i">This Setup runs once, group-wide — no Business Unit or Region scope applies.</Note>}
      {custom && <Note k="info" ic="i">Business Unit, Department and the Creator are read from Dataverse —
        the seeded demo people used elsewhere in this module are not real rows and the lookups would
        reject them. A Custom Report has no Template, so it carries no configured review chain.</Note>}

      <Field label="Report name" req><input type="text" value={f.name}
        onChange={e=>set('name',e.target.value)}
        placeholder="e.g. Ophthalmology Laser Utilisation Review"/></Field>
      <Field label="Report objective" req>
        <textarea value={f.objective} onChange={e=>set('objective',e.target.value)}
          placeholder="What this Report is for."/></Field>

      <div className="f-row">
        {custom
          ? <Field label="Stage" req
              hint="Stage 1 runs in one Business Unit, Stage 2 in one Region. Group and ExCom run once, group-wide.">
              <select value={f.stage} onChange={e=>{
                const v=e.target.value;
                setF(x=>({...x, stage:v, dvBusinessUnitId:'', dvRegionId:'',
                                dvDepartmentId:'', dvFunctionId:'', dvCreatorPositionId:''}));
              }}>
              {['Business Unit','Region','Group','ExCom'].map(o=><option key={o}>{o}</option>)}</select></Field>
          : null}

        {custom && stageBU
          ? <Field label="Business Unit" req>
              <select value={f.dvBusinessUnitId} onChange={e=>setF(x=>({...x,
                dvBusinessUnitId:e.target.value, dvDepartmentId:'', dvFunctionId:'', dvCreatorPositionId:''}))}>
                <option value="">{DV_BU_LIST.length?'Select…':'No Business Units loaded'}</option>
                {DV_BU_LIST.map(b=>{ const rn=dvRegion(b.region);
                  return <option key={b.id} value={b.id}>{rn?`${b.name} — ${rn}`:b.name}</option>; })}
              </select></Field>
          : custom && stageRegion
            ? <Field label="Region" req>
                <select value={f.dvRegionId} onChange={e=>setF(x=>({...x,
                  dvRegionId:e.target.value, dvDepartmentId:'', dvFunctionId:'', dvCreatorPositionId:''}))}>
                  <option value="">{DV_REGION_LIST.length?'Select…':'No Regions loaded'}</option>
                  {DV_REGION_LIST.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select></Field>
            : custom
              ? <Field label="Scope" hint="Group and ExCom Reports run once, group-wide.">
                  <input type="text" value="Group-wide" disabled/></Field>
              : null}

        <Field label="Period" req hint="The month this Report covers. Stored as the first of that month.">
          <input type="month" value={f.period} onChange={e=>set('period',e.target.value)}/></Field>
      </div>

      {custom
        ? <div className="f-row">
            <Field label="Team" req hint="The Microsoft Team this report belongs to.">
              <select value={f.teamName} disabled={!channels}
                onChange={e=>setF(x=>({...x, teamName:e.target.value, channelId:''}))}>
                <option value="">{!channels ? 'Reading teams…' : teamNames.length ? 'Select…' : 'No teams loaded'}</option>
                {teamNames.map(t=><option key={t} value={t}>{t}</option>)}
              </select></Field>
            <Field label="Channel" req
              hint={destination ? <>Saved to <span className="mono">{destination}</span></>
                : 'Its document location becomes this report’s SharePoint destination.'}>
              <select value={f.channelId} disabled={!f.teamName} onChange={e=>set('channelId',e.target.value)}>
                <option value="">{!f.teamName ? 'Choose a Team first' : teamChannels.length ? 'Select…' : 'No channels in this team'}</option>
                {teamChannels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select></Field>
          </div>
        : destination
          ? <Note k="info" ic="i">SharePoint destination: <span className="mono">{destination}</span>
              {channelRow ? <> — from the {channelRow.team} › {channelRow.name} channel on the Setup.</>
                : <> — the template’s stored destination (it names no channel).</>}</Note>
          : tplDetail
            ? <Note k="warn">This Setup names no Team Channel, so this report has no SharePoint destination
                yet. Set one on the Setup in Governance.</Note>
            : null}
      {channelsErr && <Note k="warn">Teams and channels could not be read from Dataverse.</Note>}

      {!custom && f.dvBusinessUnitId && <Note k="info" ic="i">Business Unit: <b>{dvBu(f.dvBusinessUnitId)}</b>
        {' '}— set by the Setup's approved placement above.</Note>}
      {!custom && f.dvRegionId && <Note k="info" ic="i">Region: <b>{dvRegion(f.dvRegionId)}</b> — set by
        the Setup's approved placement above.</Note>}

      <div className="f-row3">
        <Field label="Department"
          hint={fromSetup
            ? `The ${deptOpts.length} Department${deptOpts.length===1?'':'s'} this Setup is for.`
            : scopeHint}>
          <select value={f.dvDepartmentId} onChange={e=>set('dvDepartmentId',e.target.value)}
            disabled={!scopeChosen}>
            <option value="">{
              stageBU&&!f.dvBusinessUnitId ? 'Choose a Business Unit first'
              : stageRegion&&!f.dvRegionId ? 'Choose a Region first'
              : deptOpts.length ? 'Select…'
              : custom ? 'No Departments in this scope'
              : 'This Setup names no Department'}</option>
            {deptOpts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select></Field>
        <Field label="Function"
          hint={funcFromSetup
            ? `Paired with this Department in the Setup.`
            : f.dvDepartmentId ? 'Every Function in the chosen Department.'
            : 'Choose a Department first.'}>
          <select value={f.dvFunctionId} onChange={e=>set('dvFunctionId',e.target.value)}
            disabled={!scopeChosen || !f.dvDepartmentId}>
            <option value="">{
              !f.dvDepartmentId ? 'Choose a Department first'
              : funcOpts.length ? 'Select…'
              : funcFromSetup ? 'The Setup pairs no Function with it'
              : 'No Functions in this Department'}</option>
            {funcOpts.map(fn=><option key={fn.id} value={fn.id}>{fn.name}</option>)}
          </select></Field>
        <Field label="Created by" req
          hint={myPos
            ? `Defaults to your own Position (${myPos.name}).`
            : 'The Position accountable for preparing it.'}>
          <PositionSelect value={f.dvCreatorPositionId} onChange={v=>set('dvCreatorPositionId',v)}
            opts={posOpts} disabled={!scopeChosen}
            placeholder={scopeChosen?'Search a Position…':'Choose the scope first'}
            emptyText="No Positions in this scope"/></Field>
      </div>

      {!custom && f.tplUnitKey && reviewChain.length>0 &&
        <Field label="Review chain" hint="Resolved from the Setup for this unit — read-only, not stored on the occurrence.">
          <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
            {reviewChain.map((r,i)=>{
              const pid = r._lm_reviewerposition_value;
              /* The Setup names a POSITION; who currently holds it comes from
                 cr603_organizationstructures / hr_employees, both in IT. The
                 person leads, because a reviewer is chased by name rather than
                 by Position code -- with the Position kept underneath, since
                 that is what the Setup actually governs. */
              const who = pid && DV_POS_HOLDER[pid];
              const title = pid && dvPos(pid);
              return <div key={i} style={{display:'flex',alignItems:'baseline',gap:8,padding:'7px 10px',
                borderBottom:i<reviewChain.length-1?'1px solid var(--border)':'none'}}>
                <span style={{color:'var(--teal-d)',fontWeight:700,fontSize:12,flex:'0 0 16px'}}>{i+1}.</span>
                <span style={{minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:who?600:400}}>{who || title || '—'}</div>
                  {/* Vacant and not-yet-loaded look identical otherwise, and most
                      IT Positions genuinely have no current employee recorded. */}
                  {who
                    ? <div className="holder" style={{fontSize:11.5}}>{title}</div>
                    : title
                      ? <div className="holder" style={{fontSize:11.5}}>No current employee recorded</div>
                      : null}
                </span>
              </div>;
            })}
          </div></Field>}
    </section>}

    {step===3 && <section className="cs-card cs-form" aria-labelledby="nr-files">
      <h2 className="cs-card-title" id="nr-files">Attachments</h2>
      <p className="cs-card-note">Upload the working file for this report. Optional — it is saved to the
        report once the Draft is created.</p>
      <Field label="File" hint={`Any file type, up to ${fmtBytes(REPORT_FILE_MAX)}.`}
        err={fileTooBig ? `${fmtBytes(file.size)} — the limit is ${fmtBytes(REPORT_FILE_MAX)}.` : null}>
        <label className="cs-drop">
          <input type="file" onChange={e=>{ const fl=e.target.files && e.target.files[0]; if(fl) setFile(fl); e.target.value=''; }}/>
          <FileText size={18} aria-hidden="true"/>
          <span><b>{file ? 'Choose a different file' : 'Choose a file to upload'}</b>
            <span className="cs-name-sub">It is uploaded when you Save Draft.</span></span>
        </label>
        {file
          ? <div className="cs-file">
              <FileText size={13} aria-hidden="true"/>
              <span className="cs-name" style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}}>{file.name}</span>
              <span className="cs-mono muted">{fmtBytes(file.size)}</span>
              <button type="button" className="cs-btn" onClick={()=>setFile(null)}>Remove</button>
            </div>
          : null}
      </Field>
    </section>}

    {step===4 && <section className="cs-card" aria-labelledby="nr-review">
      <h2 className="cs-card-title" id="nr-review">Review</h2>
      <p className="cs-card-note">Saving creates this Report as a <b>Draft</b>
        {custom ? ', flagged as having no Setup' : ' linked to its approved Report Template, with the Setup’s sections copied in'}.
        It then opens in Build a report/plan.</p>
      <div>{[
          ['Template', custom ? 'Custom Report — no approved Setup' : (chosenTpl?.name || '—')],
          ['Report name', f.name.trim() || '—'],
          ['Objective', f.objective.trim() || '—'],
          ['Stage', f.stage],
          ['Business Unit / Region', dvBu(f.dvBusinessUnitId) || dvRegion(f.dvRegionId) || 'Group-wide'],
          ['Department', dvDept(f.dvDepartmentId) || '—'],
          ['Function', DV_FUNC_LIST.find(x=>x.id===f.dvFunctionId)?.name || '—'],
          ['Created by', dvPos(f.dvCreatorPositionId) || '—'],
          ['Period', f.period || '—'],
          ['Team / Channel', channelRow ? `${channelRow.team} › ${channelRow.name}` : '—'],
          ['SharePoint destination', destination || '—'],
          ['File', file ? `${file.name} (${fmtBytes(file.size)})` : '—'],
          ...(!custom && reviewChain.length
            ? [['Review chain', reviewChain.map(r=>DV_POS_HOLDER[r._lm_reviewerposition_value]
                || dvPos(r._lm_reviewerposition_value) || '—').join(' → ')]]
            : []),
        ].map(([k,v])=>
          <div key={k} className="cs-qs" style={{alignItems:'flex-start',gap:16}}>
            <span style={{flexShrink:0}}>{k}</span>
            <span className="cs-name" style={{fontWeight:500,textAlign:'right',whiteSpace:'pre-wrap'}}>{v}</span>
          </div>)}
      </div>
      {!ok && <Note k="warn">Something required is still missing — go back to Details.</Note>}
    </section>}

    {/* Back / next at the foot too, so a long Details step does not mean
        scrolling back up to move on. */}
    <div className="cs-actions" style={{justifyContent:'space-between'}}>
      <button type="button" className="cs-btn lg" disabled={step===1||saving}
        onClick={()=>setStep(step-1)}>← Back</button>
      {step<4
        ? <button type="button" className="cs-btn primary lg" disabled={!stepOk[step]||saving}
            onClick={()=>setStep(step+1)}>Next Step →</button>
        : <button type="button" className="cs-btn primary lg" onClick={save} disabled={!ok||saving}>
            {saving?'Saving…':'Save Draft'}</button>}
    </div>
  </div>;
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

/* Meetings — read entirely from lm_meetingoccurrences. The seeded demo
   occurrences, and the Minutes / Audit Grid records that hung off them, are no
   longer shown here: what this screen reports is what the table holds.

   Two consequences worth naming. "Held and closed" can no longer mean a closed
   Minutes record, because no such record exists in Dataverse yet — a held
   Meeting counts as settled once every Agenda Item has an outcome and every
   Attendee has attendance recorded. Quorum is measured against the Meeting
   Template's threshold by liveQuorum() (29 Sep); quorum does not decide
   whether a Meeting is settled. */
function ScreenMeetings(){
  const {sel,setSel,dvMeetingOccs,dvMinutes,S,dvLoading,dvError,openMeeting,go} = use();
  const [tab,setTab]=useState('due');
  const [typeFilter,setTypeFilter]=useState('all');
  /* Declared with the other state, ABOVE the early return below — a hook after
     a conditional return is React error #310. */
  const [q,setQ]=useState('');

  const list=dvMeetingOccs;
  const rec=list.find(o=>o.id===sel.mtg);
  if(rec) return <DvMeetingDetail rec={rec} back={()=>setSel(v=>({...v,mtg:null,mtgTab:null}))}/>;

  /* A live Meeting's governance record is its own agenda outcomes and
     attendance — there is nothing else behind it to close. */
  const fullyRecorded = o =>
    o.agenda.length>0 && o.attendees.length>0
    && o.agenda.every(a=>a.covered && a.covered!=='Not Yet Recorded')
    && o.attendees.every(a=>a.present && a.present!=='Not Yet Recorded');

  /* The Setup's real Setup Type, as Committee Scores shows it; null for an
     ad hoc occurrence, which has no Setup. */
  const setupTypeOf = o => {
    const tpl = dvTplDetail(o.templateId);
    return tpl ? (MEETING_SETUP_TYPE[tpl.setupTypeCode] || 'Setup') : null;
  };

  const byDateAsc  = (a,b)=>(a.date||'').localeCompare(b.date||'');
  const byDateDesc = (a,b)=>(b.date||'').localeCompare(a.date||'');
  const upcoming  = list.filter(o=>o.status==='Scheduled').sort(byDateAsc);
  const held      = list.filter(o=>o.status==='Held').sort(byDateDesc);
  const cancelled = list.filter(o=>o.status==='Cancelled').sort(byDateDesc);
  const openAfter = held.filter(o=>!fullyRecorded(o));
  const settled   = held.filter(o=>fullyRecorded(o));
  /* Quorum per occurrence, against its Setup's threshold -- see liveQuorum(). */
  const quorumOf = o => liveQuorum(o, dvTplDetail(o.templateId), S.delegatedAttend);
  const quorumMissed = held.filter(o=>quorumOf(o).state==='missed');

  const TABS=[
    {id:'due',    label:'Not yet held',      rows:upcoming},
    {id:'open',   label:'Held, record open', rows:openAfter},
    {id:'closed', label:'Held and closed',   rows:settled},
    {id:'all',    label:'All Meetings',      rows:[...upcoming,...held,...cancelled]},
  ];
  const wk = rangeBounds('week');
  const applyType = rows =>
      typeFilter==='setup' ? rows.filter(o=>o.templateId)
    : typeFilter==='adhoc' ? rows.filter(o=>!o.templateId)
    : typeFilter==='week'  ? rows.filter(o=>o.date>=wk[0] && o.date<=wk[1])
    : rows;
  const typedRows = applyType((TABS.find(t=>t.id===tab)||TABS[0]).rows);
  /* A plain filter, not useMemo: this sits below the early return above, and a
     hook here would reintroduce the same #310.
     Every column the table shows, so a search matches what the reader sees:
     name, the Setup it came from, scope, department, chair, facilitator,
     status and the date in both raw and displayed form. */
  const rows = typedRows.filter(o=>matchesQuery(q,[
    o.name, dvTpl(o.templateId), o.adhocType, setupTypeOf(o),
    dvBu(o.businessUnitId), dvRegion(o.regionId), dvDept(o.departmentId),
    dvPos(o.chairPositionId), dvPos(o.facilitatorPositionId),
    o.stage, o.mode, o.status, o.date, o.date?fmtDS(o.date):'',
  ]));

  const thisWeek = upcoming.filter(o=>o.date>=wk[0] && o.date<=wk[1]).slice(0,5);

  /* -------- Meeting Health, from what the rows themselves prove -------- */
  const inPeriod = d => d && d.slice(0,7)===PERIOD.slice(0,7);
  const scheduledThisPeriod = list.filter(o=>o.status!=='Cancelled' && inPeriod(o.date)).length;
  const heldThisPeriod      = held.filter(o=>inPeriod(o.date)).length;
  const rescheduledCt = list.filter(o=>o.rescheduledFromId).length;
  const noAgendaCt    = upcoming.filter(o=>!o.agenda.length).length;
  const noAttendeeCt  = upcoming.filter(o=>!o.attendees.length).length;
  const agendaNotSent = upcoming.filter(o=>o.agenda.length && !o.agendaSent);
  const notSentCt     = agendaNotSent.length;

  /* -------- Attention: named exceptions, not just counts -------- */
  /* A held meeting whose Minutes are still Draft-and-unsubmitted past the
     write-up window Governance Settings still defines (S.momWriteupHours --
     the per-Setup Completion Period isn't consumed by scoring yet either,
     see PROJECT-CONTEXT §9, so this reads the same global default the Audit
     Grid does). A held meeting with no Minutes row at all counts too. */
  const momOverdue = openAfter.filter(o=>{
    if(S.momWriteupHours==null || !o.end) return false;
    const m = dvMinutes.find(x=>x.occurrenceId===o.id);
    if(m && m.status!=='Draft') return false;
    if(m && m.submittedAt) return false;
    return addHours(o.date+' '+o.end, S.momWriteupHours) < nowStamp();
  });
  const attention = [
    ...momOverdue.map(o=>({id:o.id,k:'red',t:<>MOM overdue for <b>{o.name}</b></>,
      open:()=>openMeeting(o.id,'minutes')})),
    ...agendaNotSent.map(o=>({id:o.id,k:'amber',t:<>Agenda not yet distributed for <b>{o.name}</b></>,
      open:()=>openMeeting(o.id,'agenda')})),
  ].slice(0,5);

  const tabDef = TABS.find(t=>t.id===tab)||TABS[0];
  const exportCsv = () => {
    const out = [['Meeting','Setup','Setup type','Department','Scope','Stage','Date','Start','End','Mode',
      'Agenda items','Agenda covered','Attendees','Present','Chair','Facilitator','Status']];
    rows.forEach(o=>out.push([o.name, dvTpl(o.templateId)||(o.adhocType?'Ad Hoc — '+o.adhocType:'Ad Hoc'),
      setupTypeOf(o)||'', dvDept(o.departmentId)||'', dvBu(o.businessUnitId)||dvRegion(o.regionId)||'Group-wide',
      o.stage||'', o.date||'', o.start||'', o.end||'', o.mode||'',
      o.agenda.length, o.agenda.filter(a=>a.covered==='Yes').length,
      o.attendees.length, o.attendees.filter(a=>a.present==='Present').length,
      dvPos(o.chairPositionId)||'', dvPos(o.facilitatorPositionId)||'', o.status||'']));
    csDownloadCsv(`meetings-${tabDef.id}-${ymd(new Date())}.csv`, out);
  };
  const statusBadge = o => o.status==='Held' ? 'approved' : o.status==='Cancelled' ? 'returned' : 'scheduled';

  /* Restyled 28 Sep to the approved design (`leadership-practice (2).html`,
     #v-meetings), styled by leadership-design.css under .cs-root. Same data,
     filters and search as before, plus Export (CSV of the rows shown). The
     design's Inputs Ready, Calendar, Minutes and Gov. Score columns and its
     "Quorum missed" card were left out at first; the Quorum missed card and a
     quorum marker under Attendees were added 29 Sep (liveQuorum()). The rest
     would be new features, not styling. */
  return <div className="cs-root">
    <div className="cs-head">
      <div className="cs-head-top">
        <div><h1 className="cs-title">Meetings</h1>
          <p className="cs-sub">Every Meeting Occurrence in Dataverse — scheduled, held and cancelled.</p></div>
        <div className="cs-actions">
          <button type="button" className="cs-btn ghost lg" onClick={()=>go('newmtg','adhoc')}>
            <CalendarDays size={13}/>Ad Hoc from Setup</button>
          <button type="button" className="cs-btn primary lg" onClick={()=>go('newmtg','custom')}>
            <Plus size={13}/>New Meeting</button>
        </div>
      </div>
      <div className="cs-tabs" role="tablist" aria-label="Filter Meetings by stage">
        {TABS.map(t=>
          <button key={t.id} type="button" role="tab" aria-selected={tab===t.id}
            className={'cs-tab'+(tab===t.id?' on':'')} onClick={()=>setTab(t.id)}>
            {t.label}{t.id!=='all' && <span className="cs-tab-badge">{t.rows.length}</span>}
          </button>)}
      </div>
    </div>

    <div className="cs-stats five">
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">Not yet held</div>
        <div className="cs-stat-val">{upcoming.length}</div><div className="cs-stat-meta">scheduled</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">Held, record open</div>
        <div className="cs-stat-val">{openAfter.length}</div>
        <div className="cs-stat-meta">agenda or attendance unrecorded</div></div>
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">Held and closed</div>
        <div className="cs-stat-val">{settled.length}</div><div className="cs-stat-meta">fully recorded</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Cancelled</div>
        <div className="cs-stat-val">{cancelled.length}</div>
        <div className="cs-stat-meta">create no governance record</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Quorum missed</div>
        <div className="cs-stat-val">{quorumMissed.length}</div>
        <div className="cs-stat-meta">held below the Setup's threshold</div></div>
    </div>

    <div className="cs-chips" role="group" aria-label="Filter by type">
      {[['all','All Types',Layers],['setup','From a Setup',ClipboardCheck],['adhoc','Ad Hoc',PenLine],
        ['week','This Week',CalendarDays]].map(([k,l,Ic])=>
        <button key={k} type="button" aria-pressed={typeFilter===k}
          className={'cs-chip'+(typeFilter===k?' on':'')} onClick={()=>setTypeFilter(k)}>
          <Ic size={11} aria-hidden="true"/>{l}</button>)}
      <button type="button" className="cs-btn cs-chips-end"
        onClick={()=>{setTab('due');setTypeFilter('all');setQ('');}}>
        <RotateCcw size={11}/>Reset filters</button>
    </div>

    <div className="cs-two-col">
      <section className="cs-card flush" aria-labelledby="mtg-list">
        <div className="cs-card-top" style={{flexWrap:'wrap'}}>
          <div className="cs-card-title-grp">
            <span className="cs-icon green" aria-hidden="true"><Users size={16}/></span>
            <h2 className="cs-card-title" id="mtg-list">{tab==='due'?'Upcoming Meetings':tabDef.label}</h2>
          </div>
          <div className="cs-search">
            <input type="search" value={q} placeholder="Search meetings…" aria-label="Search meetings"
              onChange={e=>setQ(e.target.value)}/>
            <span className="cs-search-n">{q.trim() ? `${rows.length} of ${typedRows.length}` : `${rows.length} shown`}</span>
            <button type="button" className="cs-btn" onClick={exportCsv} disabled={!rows.length}>
              <Download size={12}/>Export</button>
          </div>
        </div>
        {dvError
          ? <div style={{padding:'12px 16px'}}><Note k="warn" ic="⚠">{dvError}</Note></div>
          : dvLoading
            ? <div className="cs-empty">Reading from Dataverse…</div>
            : rows.length===0
              ? <div className="cs-empty">
                  {list.length===0
                    ? 'No Meeting Occurrence exists yet. Use New Meeting to create one.'
                    : q.trim()
                      ? `No Meeting Occurrence matches “${q.trim()}” in this tab.`
                      : 'No Meeting Occurrence matches this tab and filter.'}</div>
              : <div className="cs-tbl-wrap"><table className="cs-tbl" style={{minWidth:1000}}>
                  <thead><tr><th>Meeting</th><th>Setup / Type</th><th>Scope</th><th>Date &amp; Time</th><th>Mode</th>
                    <th>Agenda</th><th>Attendees</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>{rows.map(o=>{
                    const scope=dvBu(o.businessUnitId)||dvRegion(o.regionId)||'Group-wide';
                    const covered=o.agenda.filter(a=>a.covered==='Yes').length;
                    const present=o.attendees.filter(a=>a.present==='Present').length;
                    const recd=o.attendees.filter(a=>a.present&&a.present!=='Not Yet Recorded').length;
                    const type=setupTypeOf(o);
                    const open=()=>openMeeting(o.id,'detail');
                    return <tr key={o.id} className="cs-row" tabIndex={0} onClick={open}
                        onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); open(); } }}>
                      <td><div className="cs-name">{o.restricted&&<Lock size={11} className="cs-lock" aria-label="Restricted"/>}{o.name}</div>
                        <div className="cs-name-sub">Chair: {dvPos(o.chairPositionId)||'—'}</div>
                        {o.facilitatorPositionId
                          ? <div className="cs-name-sub">Facilitator: {dvPos(o.facilitatorPositionId)}</div> : null}</td>
                      <td><span className={'cs-type'+(type?'':' adhoc')}>{type||'Ad Hoc'}</span>
                        <div className="cs-name-sub">{[dvTpl(o.templateId)||o.adhocType, dvDept(o.departmentId)]
                          .filter(Boolean).join(' · ')||'—'}</div></td>
                      <td><div className="cs-name" style={{fontWeight:500}}>{scope}</div>
                        {o.stage?<div className="cs-name-sub">{o.stage.replace(/^Stage (\d) /,'$1 · ')}</div>:null}</td>
                      <td><span className="cs-mono">{o.date?fmtDS(o.date):'—'}</span>
                        {o.start||o.end?<div className="cs-cov-sub cs-mono muted">{[o.start,o.end].filter(Boolean).join(' – ')}</div>:null}
                        {o.rescheduledFromId && <span className="cs-badge today" style={{marginTop:3}}>Rescheduled</span>}</td>
                      <td><span className="cs-mono muted">{o.mode||'—'}</span></td>
                      <td>{o.agenda.length
                        ? <span className={'cs-count '+(o.status==='Held'&&covered<o.agenda.length?'warn':'ok')}><i/>
                            {o.status==='Held'?`${covered}/${o.agenda.length} covered`
                              :`${o.agenda.length} item${o.agenda.length>1?'s':''}`}</span>
                        : <span className="cs-count bad"><i/>None</span>}</td>
                      <td>{o.attendees.length
                        ? <span className={'cs-count'+(o.status==='Held'&&recd<o.attendees.length?' warn':'')}>
                            {o.status==='Held'?`${present}/${o.attendees.length} present`
                              :`${o.attendees.length}`}</span>
                        : <span className="cs-count bad"><i/>None</span>}
                        {(()=>{ const qr=quorumOf(o);
                          return qr.state==='met'||qr.state==='missed'||qr.state==='incomplete'
                            ? <div className="cs-cov-sub" style={{marginTop:3,
                                color:qr.state==='met'?'var(--cs-green)':qr.state==='missed'?'var(--cs-danger)':'var(--cs-warning)'}}>
                                {QUORUM_TAG[qr.state][1]}</div>
                            : null; })()}</td>
                      <td><span className={'cs-badge '+statusBadge(o)}><i/>{o.status||'—'}</span></td>
                      <td><button type="button" className="cs-btn"
                          onClick={e=>{ e.stopPropagation(); open(); }}>View</button></td>
                    </tr>;})}
                  </tbody></table></div>}
      </section>

      <div className="cs-side">
        <section className="cs-card" aria-labelledby="mtg-week">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon green" aria-hidden="true"><CalendarDays size={16}/></span>
            <h2 className="cs-card-title" id="mtg-week">This Week</h2></div></div>
          {thisWeek.length===0 ? <div className="cs-card-note">Nothing scheduled this week.</div>
          : <div className="cs-week">{thisWeek.map((o,i)=>
            <button key={o.id} type="button" className={'cs-week-item'+(i===0?' next':'')}
                onClick={()=>openMeeting(o.id,'detail')}>
              <span><div className="cs-week-t">{o.name}</div>
                <div className="cs-week-s">{[fmtDS(o.date), o.start, o.location||o.mode,
                  dvBu(o.businessUnitId)||dvRegion(o.regionId)].filter(Boolean).join(' · ')}</div></span>
              <span className="cs-week-tag">{o.date===TODAY
                ? <span className="cs-badge today">Today</span>
                : i===0 ? <span className="cs-badge approved" style={{fontSize:8,padding:'1px 6px'}}><i/>Next</span>
                : null}</span>
            </button>)}</div>}
        </section>

        <section className="cs-card" aria-labelledby="mtg-health">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon gold" aria-hidden="true"><Activity size={16}/></span>
            <h2 className="cs-card-title" id="mtg-health">Meeting Health</h2></div></div>
          <p className="cs-card-note">What the occurrence rows themselves show.</p>
          <div>{[['Scheduled this period', scheduledThisPeriod, null],
            ['Held this period',      heldThisPeriod,      null],
            ['Rescheduled',           rescheduledCt,       rescheduledCt?'amber':null],
            ['Cancelled',             cancelled.length,    cancelled.length?'red':null],
            ['Upcoming with no Agenda',    noAgendaCt,   noAgendaCt?'red':null],
            ['Upcoming with no Attendees', noAttendeeCt, noAttendeeCt?'red':null],
            ['Agenda not yet distributed', notSentCt,    notSentCt?'amber':null],
          ].map(([label,val,colour])=>
            <div key={label} className="cs-qs"><span>{label}</span>
              <span className={'cs-qs-v'+(colour?' c-'+colour:'')}>{val}</span></div>)}
          </div>
        </section>

        {attention.length>0 && <section className="cs-card" aria-labelledby="mtg-attn">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon amber" aria-hidden="true"><CircleAlert size={16}/></span>
            <h2 className="cs-card-title" id="mtg-attn">Attention</h2></div></div>
          <div className="cs-alerts">{attention.map(a=>
            <button key={a.k+a.id} type="button" className={'cs-alert '+(a.k==='red'?'danger':'warn')} onClick={a.open}>
              {a.k==='red' ? <CircleAlert size={13} aria-hidden="true"/> : <ClipboardList size={13} aria-hidden="true"/>}
              <span className="cs-alert-t" style={{fontWeight:400}}>{a.t}</span>
            </button>)}
          </div>
        </section>}
      </div>
    </div>

  </div>;
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
   MEETING MINUTES — every lm_meetingminuteses row, reachable from the sidebar.
   Minutes have no page of their own -- clicking one opens its Meeting
   Occurrence with the Minutes tab selected (openMeeting), the same live
   DvMinutesBody the Meeting's own detail page already uses. Task/Decision
   "Outputs" tracking from the old seeded version is dropped here rather than
   faked: lm_tasks/lm_decisions don't exist yet, so there is nothing live to
   count. */
function ScreenMinutes(){
  const {go,openMeeting,dvMeetingOccs,dvMinutes,S} = use();
  const [tab,setTab]=useState('draft');

  const list = dvMinutes
    .map(m=>({...m, occ_:dvMeetingOccs.find(o=>o.id===m.occurrenceId)}))
    .filter(m=>m.occ_);

  const draft    = list.filter(m=>m.status==='Draft' && !m.submittedAt);
  const pending  = list.filter(m=>m.status==='Draft' && m.submittedAt);
  const approved = list.filter(m=>m.status==='Approved');
  const closed   = list.filter(m=>m.status==='Closed');

  const overdue = draft.filter(m=>S.momWriteupHours!=null && m.occ_.end &&
    addHours(m.occ_.date+' '+m.occ_.end, S.momWriteupHours) < nowStamp());

  const TABS=[
    {id:'draft',    label:'Draft',            rows:draft},
    {id:'pending',  label:'Pending Approval',  rows:pending},
    {id:'approved', label:'Approved',          rows:approved},
    {id:'closed',   label:'Closed',            rows:closed},
    {id:'all',      label:'All Minutes',       rows:list},
  ];
  const rows = [...(TABS.find(t=>t.id===tab)||TABS[0]).rows]
    .sort((a,b)=>(b.occ_.date||'').localeCompare(a.occ_.date||''));

  const approvalRate = list.length ? Math.round((approved.length+closed.length)/list.length*100) : null;
  const waits = list.filter(m=>m.submittedAt && m.approvedAt).map(m=>hoursBetween(m.submittedAt,m.approvedAt));
  const avgWaitDays = waits.length ? (waits.reduce((a,b)=>a+b,0)/waits.length/24) : null;
  const approvedThisMonth = list.filter(m=>m.approvedAt && m.approvedAt.slice(0,7)===PERIOD.slice(0,7)).length;

  const needsAction = [
    ...overdue.map(m=>({m, label:'Draft overdue — '+daysBetween(m.occ_.date,TODAY)+' days'})),
    ...pending.map(m=>({m, label:'Awaiting Chair signature'})),
  ];

  /* Restyled 28 Sep to the approved design (`leadership-practice (2).html`,
     #v-mom), styled by leadership-design.css under .cs-root. Same data as
     before. The design's Outputs column and Output Tracker card are left out
     for the reason in the header comment: there are no live Tasks or
     Decisions to count, and a zero would read as "none were raised". */
  const badgeOf = m => overdue.includes(m) ? ['returned','Overdue Draft']
    : m.status==='Draft' ? (m.submittedAt ? ['chair','Pending Signature'] : ['draft','Draft'])
    : m.status==='Approved' ? ['approved','Approved']
    : m.status==='Closed' ? ['approved','Closed']
    : ['void', m.status||'—'];

  return <div className="cs-root">
    <div className="cs-head">
      <div className="cs-head-top">
        <div><h1 className="cs-title">Meeting Minutes</h1>
          <p className="cs-sub">Record and approve meeting outcomes. Every Minutes row in Dataverse — open one to
            work on it in its Meeting.</p></div>
        <button type="button" className="cs-btn primary lg" onClick={()=>go('mtg')}>
          <PenLine size={13}/>Go to Meetings</button>
      </div>
      <div className="cs-tabs" role="tablist" aria-label="Filter Minutes by status">
        {TABS.map(t=>
          <button key={t.id} type="button" role="tab" aria-selected={tab===t.id}
            className={'cs-tab'+(tab===t.id?' on':'')} onClick={()=>setTab(t.id)}>
            {t.label}{t.id!=='all' && <span className="cs-tab-badge">{t.rows.length}</span>}
          </button>)}
      </div>
    </div>

    <div className="cs-stats">
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">Total MOMs</div>
        <div className="cs-stat-val">{list.length}</div><div className="cs-stat-meta">all time</div></div>
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">Approved</div>
        <div className="cs-stat-val">{approved.length+closed.length}</div>
        <div className="cs-stat-meta">{approvalRate==null?'—':approvalRate+'% approval rate'}</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">Pending Signature</div>
        <div className="cs-stat-val">{pending.length}</div>
        <div className="cs-stat-meta">{avgWaitDays==null?'awaiting approval'
          :<>Avg wait <span className="c-amber">{avgWaitDays.toFixed(1)}d</span></>}</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Overdue</div>
        <div className="cs-stat-val">{overdue.length}</div>
        <div className="cs-stat-meta">{overdue.length
          ? <span className="c-red">{overdue[0].occ_.name||'(untitled meeting)'}</span> : 'none'}</div></div>
    </div>

    <div className="cs-two-col">
      <section className="cs-card flush" aria-labelledby="mom-list">
        <div className="cs-card-top">
          <div className="cs-card-title-grp">
            <span className="cs-icon gold" aria-hidden="true"><MessageSquare size={16}/></span>
            <h2 className="cs-card-title" id="mom-list">Meeting Minutes</h2>
          </div>
        </div>
        {rows.length===0
          ? <div className="cs-empty">{list.length===0 ? 'No Minutes yet.' : 'Nothing here.'}</div>
          : <div className="cs-tbl-wrap"><table className="cs-tbl" style={{minWidth:640}}>
            <thead><tr><th>MOM</th><th>Meeting</th><th>Status</th><th>Date</th>
              <th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{rows.map(m=>{
              const [bc,bl]=badgeOf(m);
              const isDraft = m.status==='Draft' && !m.submittedAt;
              const open = ()=>openMeeting(m.occurrenceId,'minutes');
              return <tr key={m.id} className="cs-row" tabIndex={0} onClick={open}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); open(); } }}>
                <td><div className="cs-name">{m.occ_.name||'(untitled meeting)'} — {fmtDS(m.occ_.date)}</div>
                  <div className="cs-name-sub">{momCode(m)} · Facilitator: {dvPos(m.occ_.facilitatorPositionId)||'—'}</div></td>
                <td>{dvTpl(m.occ_.templateId)||(m.occ_.adhocType?'Ad Hoc — '+m.occ_.adhocType:'Ad Hoc')}</td>
                <td><span className={'cs-badge '+bc}><i/>{bl}</span></td>
                <td><span className={'cs-mono'+(overdue.includes(m)?' c-red':'')}>{fmtDS(m.occ_.date)}</span></td>
                <td><button type="button" className={'cs-btn'+(isDraft?' primary':'')}
                    onClick={e=>{ e.stopPropagation(); open(); }}>{isDraft?'Edit':'View'}</button></td>
              </tr>;})}
            </tbody></table></div>}
      </section>

      <div className="cs-side">
        <section className="cs-card" aria-labelledby="mom-health">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon green" aria-hidden="true"><Activity size={16}/></span>
            <h2 className="cs-card-title" id="mom-health">MOM Health</h2></div></div>
          <div>
            <div className="cs-qs"><span>Approved This Month</span>
              <span className="cs-qs-v c-green">{approvedThisMonth}</span></div>
            <div className="cs-qs"><span>Avg Approval Time</span>
              <span className="cs-qs-v">{avgWaitDays==null?'—':avgWaitDays.toFixed(1)+'d'}</span></div>
            <div className="cs-qs"><span>Closed</span><span className="cs-qs-v">{closed.length}</span></div>
          </div>
        </section>

        {needsAction.length>0 && <section className="cs-card" aria-labelledby="mom-action">
          <div className="cs-card-top"><div className="cs-card-title-grp">
            <span className="cs-icon amber" aria-hidden="true"><CircleAlert size={16}/></span>
            <h2 className="cs-card-title" id="mom-action">Needs Action</h2></div></div>
          <div className="cs-alerts">{needsAction.map(({m,label},i)=>{
            const late = overdue.includes(m);
            return <button key={m.id+i} type="button" className={'cs-alert '+(late?'danger':'warn')}
                onClick={()=>openMeeting(m.occurrenceId,'minutes')}>
              {late ? <CircleAlert size={13} aria-hidden="true"/> : <PenLine size={13} aria-hidden="true"/>}
              <span><div className="cs-alert-t">{m.occ_.name||'(untitled meeting)'} — {fmtDS(m.occ_.date)}</div>
                <div className="cs-alert-s">{label}</div></span>
            </button>;})}
          </div>
        </section>}
      </div>
    </div>
  </div>;
}

/* Edits date/time/mode/location/link on a live Meeting Occurrence -- the
   controlled name, Setup, classification and scope stay Taxonomy's, so this
   only ever touches the fields lm_meetingoccurrences itself owns. Modelled
   on the dead-code EditOccModal above, rebuilt against updateMeetingOccurrence(). */
function DvEditOccModal({rec,onClose}){
  const {toast,refreshOccurrences}=use();
  /* The date is the occurrence's own and cannot be edited here (01 Oct, per
     the product owner): moving a meeting to another day is a Reschedule, which
     creates the new occurrence and keeps the link back to this one. Edit
     changes the time, mode and place on the same day, and saves the date
     exactly as it was read. */
  const [f,setF]=useState({start:rec.start||'', end:rec.end||'',
    mode:rec.mode||'In person', location:rec.location||'', link:rec.link||''});
  const [saving,setSaving]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const badTime = f.start && f.end && f.end<=f.start;
  const needsLink     = f.mode==='Online' || f.mode==='Hybrid';
  const needsLocation = f.mode==='In person' || f.mode==='Hybrid';
  const modeOk = (!needsLink || f.link.trim()) && (!needsLocation || f.location.trim());
  const ok = !badTime && !!f.start && !!f.end && modeOk;

  const save = async () => {
    setSaving(true);
    try{
      const {id,errors} = await updateMeetingOccurrence(rec.id, {
        date:rec.date, start:f.start, end:f.end, mode:f.mode,
        location:needsLocation ? f.location.trim() : '',
        link:needsLink ? f.link.trim() : '',
      });
      if(!id){
        console.warn('[dataverse] updateMeetingOccurrence() failed:', errors);
        toast('Not saved','Saving this occurrence failed. Check the console for details.','err');
        return;
      }
      toast('Occurrence updated','Your changes are saved.','ok');
      await refreshOccurrences();
      onClose();
    }catch(e){
      console.warn('[dataverse] updateMeetingOccurrence() threw unexpectedly:', e);
      toast('Not saved','Saving this occurrence failed. Check the console for details.','err');
    }finally{ setSaving(false); }
  };

  return <Modal title="Edit this occurrence" wide onClose={onClose}
    sub="Execution-level information only. The controlled name, Setup and classification stay Taxonomy's."
    footer={<><Btn onClick={onClose} disabled={saving}>Cancel</Btn>
      <Btn k="pri" disabled={!ok||saving} onClick={save}>{saving?'Saving…':'Save'}</Btn></>}>
    <div className="f-row3">
      <Field label="Date"
        hint={rec.status==='Scheduled' ? 'To move this meeting to another day, use Reschedule.' : null}>
        <input type="text" value={rec.date ? `${dayName(rec.date)}, ${fmtD(rec.date)}` : '—'}
          readOnly disabled aria-readonly="true" title="The date can only be changed with Reschedule"/></Field>
      <Field label="Start" req><input type="time" value={f.start} onChange={e=>set('start',e.target.value)}/></Field>
      <Field label="End" req err={badTime?'The end time must be after the start time.':null}>
        <input type="time" value={f.end} onChange={e=>set('end',e.target.value)}/></Field>
    </div>
    <Field label="Mode" req hint="Online meets in Teams, In person needs a location, Hybrid needs both.">
      <Pills opts={['In person','Online','Hybrid']} val={f.mode} onChange={v=>set('mode',v)}/></Field>
    {needsLocation &&
      <Field label="Location" req err={!f.location.trim()?'A location is required for an in-person or hybrid Meeting.':null}>
        <input type="text" value={f.location} onChange={e=>set('location',e.target.value)}
          placeholder="e.g. Board Room, Level 3"/></Field>}
    {needsLink &&
      <Field label="Online link" req err={!f.link.trim()?'An online link is required for an online or hybrid Meeting.':null}>
        <input type="text" value={f.link} onChange={e=>set('link',e.target.value)}
          placeholder="https://teams.microsoft.com/l/meetup-join/…"/></Field>}
  </Modal>;
}

/* Reschedules a live Meeting Occurrence to a new date/time. Unlike Edit
   (which patches the same row), this is deliberately a new row: it creates
   a fresh lm_meetingoccurrences record carrying the same Setup, scope,
   Chair/Facilitator, Agenda and Attendees across, with lm_RescheduledFrom
   pointing back at the original -- then cancels the original, so there is
   never a stale Scheduled row left sitting on the wrong date. The Agenda's
   coverage and any Attendance already recorded stay behind on the original;
   only the content itself (titles, owners, positions) carries forward. */
function DvRescheduleOccModal({rec,onClose}){
  const {toast,refreshOccurrences,openMeeting}=use();
  const [f,setF]=useState({date:'', start:rec.start||'', end:rec.end||'',
    mode:rec.mode||'In person', location:rec.location||'', link:rec.link||''});
  const [saving,setSaving]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));

  const weekend = isWeekend(f.date);
  const nw = isNonWorking(f.date) && !weekend;
  const badTime = f.start && f.end && f.end<=f.start;
  const sameDate = f.date && f.date===rec.date;
  const needsLink     = f.mode==='Online' || f.mode==='Hybrid';
  const needsLocation = f.mode==='In person' || f.mode==='Hybrid';
  const modeOk = (!needsLink || f.link.trim()) && (!needsLocation || f.location.trim());
  const ok = !!f.date && !weekend && !sameDate && !badTime && !!f.start && !!f.end && modeOk;

  const save = async () => {
    setSaving(true);
    try{
      const { id:newId, errors } = await createMeetingOccurrence({
        name: rec.name,
        templateId: rec.templateId||undefined,
        stage: rec.stage||undefined,
        businessUnitId: rec.businessUnitId||undefined,
        regionId: rec.regionId||undefined,
        departmentId: rec.departmentId||undefined,
        chairPositionId: rec.chairPositionId||undefined,
        facilitatorPositionId: rec.facilitatorPositionId||undefined,
        date:f.date, start:f.start, end:f.end,
        timezone: rec.timezone||undefined,
        mode:f.mode, status:'Scheduled',
        location:needsLocation ? (f.location.trim()||null) : null,
        link:needsLink ? (f.link.trim()||null) : null,
        adhocType: rec.adhocType||undefined,
        restricted: !!rec.restricted,
        inviteSent: TODAY,
        rescheduledFromId: rec.id,
        agenda: rec.agenda.map(a=>({title:a.title, source:'Rescheduled', ownerPositionId:a.ownerPositionId||undefined})),
        attendees: rec.attendees.filter(a=>a.positionId)
          .map(a=>({positionId:a.positionId, name:a.name||undefined, type:a.type||'Required'})),
      });
      if(!newId){
        console.warn('[dataverse] createMeetingOccurrence() (reschedule) failed:', errors);
        toast('Not saved','Creating the rescheduled occurrence failed. Check the console for details.','err');
        return;
      }
      const cancelled = await cancelMeetingOccurrence(rec.id, `Rescheduled to ${fmtD(f.date)}.`);
      if(!cancelled.id){
        console.warn('[dataverse] cancelMeetingOccurrence() (reschedule) failed:', cancelled.errors);
        toast('Partially saved','The new occurrence was created, but the original could not be marked '+
          'Cancelled. Check the console for details.','err');
      }else{
        toast('Occurrence rescheduled', `Moved to ${fmtD(f.date)}. The original is now Cancelled.`,'ok');
      }
      await refreshOccurrences();
      onClose();
      openMeeting(newId,'detail');
    }catch(e){
      console.warn('[dataverse] reschedule threw unexpectedly:', e);
      toast('Not saved','Rescheduling this occurrence failed. Check the console for details.','err');
    }finally{ setSaving(false); }
  };

  return <Modal title="Reschedule this occurrence" wide onClose={onClose}
    sub="Creates a new occurrence at the new date, carrying the Agenda and Attendees across, and cancels this one."
    footer={<><Btn onClick={onClose} disabled={saving}>Cancel</Btn>
      <Btn k="pri" disabled={!ok||saving} onClick={save}>{saving?'Rescheduling…':'Reschedule'}</Btn></>}>
    <div className="f-row3">
      <Field label="New date" req
        err={weekend
          ? `${dayName(f.date)} is a weekend — the working week is Sunday to Thursday. Choose another day.`
          : sameDate ? 'Choose a date different from the current one.'
          : nw ? 'This is a configured public holiday.' : null}>
        <input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
      <Field label="Start" req><input type="time" value={f.start} onChange={e=>set('start',e.target.value)}/></Field>
      <Field label="End" req err={badTime?'The end time must be after the start time.':null}>
        <input type="time" value={f.end} onChange={e=>set('end',e.target.value)}/></Field>
    </div>
    <Field label="Mode" req hint="Online meets in Teams, In person needs a location, Hybrid needs both.">
      <Pills opts={['In person','Online','Hybrid']} val={f.mode} onChange={v=>set('mode',v)}/></Field>
    {needsLocation &&
      <Field label="Location" req err={!f.location.trim()?'A location is required for an in-person or hybrid Meeting.':null}>
        <input type="text" value={f.location} onChange={e=>set('location',e.target.value)}
          placeholder="e.g. Board Room, Level 3"/></Field>}
    {needsLink &&
      <Field label="Online link" req err={!f.link.trim()?'An online link is required for an online or hybrid Meeting.':null}>
        <input type="text" value={f.link} onChange={e=>set('link',e.target.value)}
          placeholder="https://teams.microsoft.com/l/meetup-join/…"/></Field>}
    <Note k="info" ic="i">The {rec.agenda.length} Agenda item{rec.agenda.length===1?'':'s'} and{' '}
      {rec.attendees.length} Attendee{rec.attendees.length===1?'':'s'} on this occurrence carry across to
      the new one. Coverage and attendance already recorded here do not — they stay on the original,
      cancelled occurrence.</Note>
  </Modal>;
}

/* Meeting Occurrence detail — the full page, read from lm_meetingoccurrences
   and its two child tables.

   Modelled on the seeded MeetingDetail below it, minus the tabs that have no
   Dataverse table behind them: Submissions, Documents, Discussions, Actions,
   Minutes and the Audit Grid all live in seeded state only. What is here is
   what the occurrence row and its agenda and attendee rows actually hold. */
/* Dataverse returns a full ISO timestamp ('2026-08-26T14:39:18Z'); fmtDT above
   expects the app's own 'YYYY-MM-DD HH:mm' stamps and splits on the space, so
   an ISO value needs its own formatter rather than being pushed through that
   one. Trimmed rather than re-parsed, so the day never shifts a time zone. */
const fmtISODT = s => { if(!s) return '—';
  const day = s.slice(0,10), time = s.length>=16 ? s.slice(11,16) : null;
  return `${fmtD(day)}${time?' · '+time:''}`; };

/* The Minutes tab, writing to lm_meetingminuteses and lm_momnoteses.
 *
 * Lifecycle, per the specification: Draft → (submit) → still Draft but with a
 * submitted timestamp, which is what puts it in front of the Chair → (approve)
 * Approved, and the approval IS the signature → Closed.
 *
 * There is no 'Returned' value on lm_status, so a returned MOM is Draft with a
 * return reason standing. That reason is therefore what distinguishes the two
 * Draft states from each other, and submitting clears it. */
/* Tasks per agenda item in the Minutes (01 Oct). Lists the tasks linked to
   the item and raises new ones with the shared NewTaskForm, linked to the
   meeting AND the item (createTask's meetingOccurrenceId / agendaItemId).
   `tasks` comes from the meeting page (fetchTasksForMeeting): undefined while
   reading, null where tasks cannot be linked to a meeting (IT until its
   column exists) -- then the panel says so instead of offering a button that
   would fail. */
const TASK_DONE = new Set(['Closed','Completed','Cancelled','Rejected']);
function AgendaTaskPanel({rec,item,tasks,canAdd,onRaised}){
  const {toast}=use();
  const [open,setOpen]=useState(false);
  if(tasks===undefined) return null;
  const mine=(tasks||[]).filter(t=>t.agendaItemId===item.id);
  if(tasks===null) return canAdd
    ? <div className="t-sub" style={{marginTop:8}}>Tasks can’t be raised per agenda item in this environment yet:
        a task has no link to a meeting here.</div>
    : null;
  return <div className="agt">
    <div className="agt-hd">
      <span className="agt-k">Tasks</span>
      <span className="t-sub">{mine.length ? `${mine.length} on this item` : 'None yet'}</span>
      {canAdd ? <Btn k="sm" onClick={()=>setOpen(v=>!v)}>{open?'Cancel':'+ Raise a task'}</Btn> : null}
    </div>
    {mine.map(t=>{
      const late = t.due && !TASK_DONE.has(t.status) && t.due < TODAY;
      return <div key={t.id} className="agt-row">
        <span className="agt-t">{t.name}{t.code?<span className="t-sub"> · {t.code}</span>:null}</span>
        <span className="t-sub">{t.assigneeName||'Unassigned'}</span>
        <span className={'t-sub'+(late?' agt-late':'')}>{t.due?'Due '+fmtDS(t.due):'No due date'}</span>
        <Tag c={TASK_DONE.has(t.status)?'green':late?'red':'grey'}>{late?'Overdue':(t.status||'New')}</Tag>
        <OpenRecord kind="Task" id={t.id} label="Open ↗" asLink/>
      </div>;})}
    {open && <div className="agt-form">
      <NewTaskForm subject={`${rec.name} — ${item.title||'agenda item'}`}
        link={{meetingOccurrenceId:rec.id, agendaItemId:item.id}}
        doneText="Task raised on this agenda item."
        toast={msg=>{ const bad=/could not/i.test(msg); toast(bad?'Not saved':'Task raised', msg, bad?'err':'ok'); }}
        onCancel={()=>setOpen(false)}
        onDone={()=>{ setOpen(false); if(onRaised) onRaised(); }}/>
    </div>}
  </div>;
}

function DvMinutesBody({rec,minutes,accred,grids,posName,onReload,tasks,onTasksChanged}){
  const {toast,dvLookup,currentUser}=use();
  const [drafts,setDrafts]=useState({});        // agendaItemId -> unsaved text
  const [savingNote,setSavingNote]=useState(null);
  const [busy,setBusy]=useState(null);
  const [returning,setReturning]=useState(false);

  const noteIdFor = {}, noteFor = {};
  minutes.notes.forEach(n=>{ if(n.agendaItemId){ noteIdFor[n.agendaItemId]=n.id; noteFor[n.agendaItemId]=n; } });

  /* Confidential agenda items -- Stage 4 meetings only. The Facilitator marks
     an item confidential and picks, from this meeting's attendees, who may read
     its note (lm_momnotes.lm_confidential + lm_meetingminutesreviewerlists).
     Everyone else sees the item's title but not its note or its decisions.
     The Facilitator and the Chair always read every item: one writes the
     Minutes, the other approves them. ⚠️ App-side only -- see dataverse.js. */
  const stage4 = /^Stage 4/.test(rec.stage||'');
  const mine = new Set(dvLookup?.myPositionIds||[]);
  const myUserId = currentUser?.systemUserId || null;
  const isFacilitator = !!rec.facilitatorPositionId && mine.has(rec.facilitatorPositionId);
  const isChair = !!rec.chairPositionId && mine.has(rec.chairPositionId);
  const isConf = a => stage4 && !!noteFor[a.id]?.confidential;
  const canRead = a => !isConf(a) || isFacilitator || isChair
    || (!!myUserId && (noteFor[a.id].viewers||[]).some(v=>v.userId===myUserId));
  /* The people who can be chosen: this occurrence's attendees, each resolved
     through their Position to the user who holds it. One entry per person. */
  const attendeeUsers = (()=>{
    const seen = new Set(), out = [];
    rec.attendees.filter(a=>a.positionId).forEach(a=>{
      const p = DV_POS_LIST.find(x=>x.id===a.positionId);
      const userId = p?.holderUserId || null;
      if(userId && seen.has(userId)) return;
      if(userId) seen.add(userId);
      out.push({ key:a.id, userId,
        name: p?.holder || DV_POS_HOLDER[a.positionId] || a.name || 'Unnamed attendee',
        position: posName(a.positionId) || '' });
    });
    return out;
  })();

  const setConfidential = async (a, on) => {
    setSavingNote(a.id);
    try{
      const {id,errors} = await setMomNoteConfidential(minutes.id, a.id, noteIdFor[a.id], on);
      if(!id){ console.warn('[dataverse] setMomNoteConfidential() failed:', errors);
               toast('Not saved','The confidentiality flag could not be saved.','err'); return; }
      await onReload();
    }finally{ setSavingNote(null); }
  };
  const toggleViewer = async (a, userId) => {
    const n = noteFor[a.id]; if(!n) return;
    const cur = (n.viewers||[]).map(v=>v.userId).filter(Boolean);
    const next = cur.includes(userId) ? cur.filter(x=>x!==userId) : [...cur, userId];
    setSavingNote(a.id);
    try{
      const {id,errors} = await saveMomNoteViewers(n.id, next, n.viewers);
      if(!id){ console.warn('[dataverse] saveMomNoteViewers() failed:', errors);
               toast('Not saved','Who can see this item could not be saved.','err'); }
      await onReload();
    }finally{ setSavingNote(null); }
  };

  const closed       = minutes.status==='Closed';
  const approved     = minutes.status==='Approved';
  const returned     = minutes.status==='Draft' && !!minutes.returnReason;
  const awaitingChair= minutes.status==='Draft' && !!minutes.submittedAt && !returned;
  const drafting     = minutes.status==='Draft' && !awaitingChair;
  const editable     = drafting;

  const textFor = a => drafts[a.id] !== undefined ? drafts[a.id] : (minutes.notesByAgenda[a.id]||'');
  /* RULE-MOM-02: an Agenda Item with no Output needs a Discussion Note. No
     Outputs exist yet (no Task or Decision table), so today that means every
     item needs a note before the Minutes can be submitted. */
  const missingNotes = rec.agenda.filter(a=>!textFor(a).trim());
  const tooLong      = rec.agenda.filter(a=>textFor(a).trim().length>MOM_NOTE_MAX);
  const canSubmit    = rec.agenda.length>0 && !missingNotes.length && !tooLong.length;

  const saveNote = async a => {
    const text = textFor(a).trim();
    if(text === (minutes.notesByAgenda[a.id]||'')) return;   // nothing changed
    setSavingNote(a.id);
    try{
      const {id,errors} = await saveMomNote(minutes.id, a.id, text, noteIdFor[a.id]);
      if(!id){ console.warn('[dataverse] saveMomNote() failed:', errors);
               toast('Not saved','The Discussion Note could not be saved.','err'); return; }
      await onReload();
      setDrafts(d=>{ const n={...d}; delete n[a.id]; return n; });
    }catch(e){
      console.warn('[dataverse] saveMomNote() threw:', e);
      toast('Not saved','The Discussion Note could not be saved.','err');
    }finally{ setSavingNote(null); }
  };

  const setCovered = async (a,v) => {
    setSavingNote(a.id);
    try{
      const {id,errors} = await updateAgendaCovered(a.id, v);
      if(!id){ console.warn('[dataverse] updateAgendaCovered() failed:', errors);
               toast('Not saved','The coverage flag could not be saved.','err'); return; }
      await onReload();
    }finally{ setSavingNote(null); }
  };

  const run = async (key, fn, okTitle, okMsg) => {
    setBusy(key);
    try{
      const {id,errors} = await fn();
      if(!id){ console.warn('[dataverse] '+key+' failed:', errors);
               toast('Not saved','That step could not be saved. Check the console.','err'); return false; }
      toast(okTitle, okMsg, 'ok');
      await onReload();
      return true;
    }catch(e){
      console.warn('[dataverse] '+key+' threw:', e);
      toast('Not saved','That step could not be saved. Check the console.','err');
      return false;
    }finally{ setBusy(null); }
  };

  const submit = () => run('submit', ()=>submitMeetingMinutes(minutes.id),
    'Submitted to the Chair','The write-up clock is stamped. The Minutes now sit with the Meeting Chair.');

  /* Approval and signature are one act, not two: the Chair's approval IS the
     signature, which is why AG-07 was retired. */
  const approve = async () => {
    const ok = await run('approve', ()=>updateMeetingMinutesStatus(minutes.id,'Approved'),
      'Minutes approved','The signature has been captured. Outputs would activate here once Tasks and Decisions exist.');
    if(!ok) return;
    const now = new Date();
    await signMeetingMinutes(minutes.id, {
      positionId: rec.chairPositionId || undefined,
      name: (rec.chairPositionId && DV_POS_HOLDER[rec.chairPositionId]) || posName(rec.chairPositionId) || 'Meeting Chair',
      date: ymd(now),
      time: now.toTimeString().slice(0,5),
    });
    await onReload();
  };

  /* Closure releases the Audit Grid for a Committee occurrence -- and only for
     a Committee. Exactly one Instance per occurrence, so an existing Grid is
     left alone. The Grid never blocks closure: a failure here is reported and
     the MOM stays Closed. */
  const close = async () => {
    const ok = await run('close', ()=>updateMeetingMinutesStatus(minutes.id,'Closed'),
      'Minutes closed','The record is final.');
    if(!ok) return;
    /* ⚠️ No longer gated on the Setup Type. This used to read
       `accred && grids.length===0`, which meant a Business Meeting's Minutes
       could close and silently produce nothing -- the behaviour that made an
       IT environment holding one Business Meeting look as though the Grid
       feature was broken. */
    if(grids.length===0){
      const g = await createAuditGridInstance({
        occurrenceId: rec.id,
        name: `Audit Grid — ${rec.name}`,
        templateVersion: AG_TEMPLATE_VERSION,
        total: AG_ACTIVE.length,
        version: 1,
        facilitatorPositionId: rec.facilitatorPositionId || undefined,
        chairPositionId: rec.chairPositionId || undefined,
      });
      if(g.id) toast('Audit Grid released','An Instance was created for this meeting.','ok');
      else { console.warn('[dataverse] createAuditGridInstance() failed:', g.errors);
             toast('Grid not created','The Minutes are Closed, but the Audit Grid Instance failed. Check the console.','warn'); }
    }
    await onReload();
  };

  const stateTag = closed ? <Tag c="green">Closed</Tag>
    : approved ? <Tag c="teal">Approved</Tag>
    : awaitingChair ? <Tag c="amber">Submitted — with the Chair</Tag>
    : returned ? <Tag c="red">Returned for revision</Tag>
    : <Tag c="grey">Draft</Tag>;
  const stateLabel = closed ? 'Closed' : approved ? 'Approved' : awaitingChair ? 'Submitted — with the Chair'
    : returned ? 'Returned for revision' : 'Draft';

  /* Word export of these Minutes (minutesExport.js). Built from what this tab
     already shows, so the file matches the screen -- including confidential
     Stage 4 items, which export as title + "withheld" for anyone who cannot
     read them here. Decisions are read fresh so the file carries the latest. */
  const [exporting,setExporting]=useState(false);
  const holderOr = id => (id && DV_POS_HOLDER[id]) || posName(id) || null;
  const exportWord = async () => {
    if(exporting) return;
    setExporting(true);
    try{
      let decisions = [];
      try{ decisions = await fetchWorkLogDecisions(); }
      catch(e){ console.warn('[minutesExport] decisions could not be read; exporting without them:', e); }
      const userName = id => attendeeUsers.find(u=>u.userId===id)?.name || null;
      const model = {
        meeting: {
          name: rec.name, date: rec.date ? fmtD(rec.date) : null,
          time: [rec.start, rec.end].filter(Boolean).join(' – ') || null,
          mode: rec.mode, location: rec.location, link: rec.link, stage: rec.stage, status: rec.status,
          chair: holderOr(rec.chairPositionId), facilitator: holderOr(rec.facilitatorPositionId),
        },
        minutes: {
          status: stateLabel,
          submitted: minutes.submittedAt ? fmtISODT(minutes.submittedAt) : null,
          approved: minutes.approvedAt ? fmtISODT(minutes.approvedAt) : null,
          closed: minutes.closedAt ? fmtISODT(minutes.closedAt) : null,
          signedBy: posName(minutes.signedByPositionId) || minutes.signedName || null,
          signedOn: minutes.signedDate
            ? fmtD(minutes.signedDate) + (minutes.signedTime ? ' · ' + minutes.signedTime : '') : null,
        },
        attendees: rec.attendees.map(a=>({
          name: (a.positionId && DV_POS_HOLDER[a.positionId]) || a.name || null,
          position: posName(a.positionId) || null, type: a.type, present: a.present })),
        agenda: rec.agenda.map((a,i)=>{
          const readable = canRead(a), conf = isConf(a);
          return {
            seq: a.seq ?? i+1, title: a.title, owner: posName(a.ownerPositionId) || null,
            covered: a.covered, confidential: conf, withheld: !readable,
            viewers: conf && readable ? (noteFor[a.id]?.viewers||[]).map(v=>userName(v.userId)).filter(Boolean) : [],
            note: readable ? textFor(a).trim() : null,
            decisions: readable
              ? decisions.filter(d=>d.agendaItemId===a.id).map(d=>({ name:d.name, taken:d.decisionTaken, status:d.status }))
              : [],
          };
        }),
        generatedAt: fmtISODT(new Date().toISOString()),
        exportedBy: currentUser?.fullName || null,
      };
      const { filename } = await exportMinutesDocx(model);
      toast('Exported', `${filename} has downloaded.`, 'ok');
    }catch(e){
      console.warn('[minutesExport] failed:', e);
      toast('Export failed', 'The Minutes could not be exported: ' + (e?.message || 'unknown error'), 'err');
    }finally{ setExporting(false); }
  };

  return <>
    <div className="card">
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12,flexWrap:'wrap'}}>
        {stateTag}
        {minutes.signedName && <Tag c="grey">🖊 Signed</Tag>}
        {closed && <Tag c="grey">🔒 Locked</Tag>}
        <div style={{flex:1}}/>
        <Btn k="sm" disabled={exporting} onClick={exportWord}>
          {exporting ? 'Exporting…' : 'Export to Word'}</Btn>
      </div>
      <KVBlock items={[
        ['Submitted', fmtISODT(minutes.submittedAt)],
        ['Approved',  fmtISODT(minutes.approvedAt)],
        ['Closed',    fmtISODT(minutes.closedAt)],
        ['Signed by', posName(minutes.signedByPositionId)||minutes.signedName||'—'],
        ['Signed on', minutes.signedDate
          ? fmtD(minutes.signedDate)+(minutes.signedTime?' · '+minutes.signedTime:'') : '—'],
      ]}/>
      {returned && <Note k="err"><b>Returned by the Meeting Chair.</b> {minutes.returnReason}</Note>}
      {closed && <Note k="lock"><b>Closed and locked.</b> A correction must be made as a new version
        or an addendum, never by editing this record.</Note>}
    </div>

    <div className="card flush">
      <div className="card-hd"><h2>Discussion Notes</h2>
        <div className="csub">One note per Agenda Item, and a coverage flag.
          {editable ? ' Notes save when you click away from the box.'
                    : ' Read-only in this state.'}</div></div>
      {rec.agenda.length===0
        ? <div style={{padding:'8px 17px 17px'}}><Empty>No Agenda Item on this occurrence.</Empty></div>
        : <div style={{padding:'4px 17px 17px',display:'flex',flexDirection:'column',gap:14}}>
            {rec.agenda.map((a,i)=>{
              const val = textFor(a);
              const over = val.trim().length>MOM_NOTE_MAX;
              const conf = isConf(a);
              const note = noteFor[a.id];
              const viewerIds = new Set((note?.viewers||[]).map(v=>v.userId));
              if(!canRead(a)) return <div key={a.id} style={{borderTop:i?'1px solid var(--border)':'none',paddingTop:i?13:4}}>
                <div style={{display:'flex',alignItems:'baseline',gap:9,flexWrap:'wrap',marginBottom:6}}>
                  <span className="dim" style={{fontSize:12}}>{a.seq??i+1}</span>
                  <b style={{fontSize:13.5,flex:'1 1 220px'}}>{a.title||'—'}</b>
                  <Tag c="red">🔒 Confidential</Tag>
                </div>
                <div style={{fontSize:12.5,color:'var(--muted)'}}>
                  This item is confidential. Only the people the Facilitator chose can read its notes and decisions.</div>
              </div>;
              return <div key={a.id} style={{borderTop:i?'1px solid var(--border)':'none',paddingTop:i?13:4}}>
                <div style={{display:'flex',alignItems:'baseline',gap:9,flexWrap:'wrap',marginBottom:6}}>
                  <span className="dim" style={{fontSize:12}}>{a.seq??i+1}</span>
                  <b style={{fontSize:13.5,flex:'1 1 220px'}}>{a.title||'—'}</b>
                  {conf && <Tag c="red">🔒 Confidential</Tag>}
                  {editable
                    ? <Pills opts={['Yes','No']} val={a.covered==='Yes'?'Yes':a.covered==='No'?'No':null}
                        onChange={v=>setCovered(a, v||'Not Yet Recorded')}/>
                    : <Tag c={a.covered==='Yes'?'green':a.covered==='No'?'red':'grey'}>
                        {a.covered||'Not Yet Recorded'}</Tag>}
                </div>
                {stage4 && isFacilitator && editable
                  ? <div style={{margin:'2px 0 8px',padding:'8px 10px',border:'1px solid var(--border)',
                                 borderRadius:8,background:'var(--surface)'}}>
                      <label style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,cursor:'pointer'}}>
                        <input type="checkbox" id={'conf-'+a.id} checked={conf} disabled={savingNote===a.id}
                          onChange={e=>setConfidential(a, e.target.checked)}/>
                        <b>Confidential</b>
                        <span className="dim">Only the people ticked below, the Facilitator and the Chair can read this item.</span>
                      </label>
                      {conf && <div style={{marginTop:8}}>
                        <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:5}}>
                          Who can see it · {viewerIds.size} chosen</div>
                        {attendeeUsers.length===0
                          ? <div className="dim" style={{fontSize:12}}>This meeting has no attendees to choose from.</div>
                          : <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px'}}>
                              {attendeeUsers.map(u=>
                                <label key={u.key} title={u.userId?u.position:'No user account is linked to this Position'}
                                  style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,
                                          opacity:u.userId?1:.55,cursor:u.userId?'pointer':'not-allowed'}}>
                                  <input type="checkbox" checked={!!u.userId && viewerIds.has(u.userId)}
                                    disabled={!u.userId || savingNote===a.id}
                                    onChange={()=>toggleViewer(a, u.userId)}/>
                                  {u.name}{u.position?<span className="dim">· {u.position}</span>:null}
                                </label>)}
                            </div>}
                      </div>}
                    </div>
                  : conf && isFacilitator
                    ? <div className="dim" style={{fontSize:11.5,margin:'0 0 6px'}}>
                        Visible to {attendeeUsers.filter(u=>u.userId && viewerIds.has(u.userId)).map(u=>u.name).join(', ')
                          || 'nobody besides the Facilitator and the Chair'}.</div>
                    : null}
                {editable
                  ? <>
                      <textarea rows={3} value={val} disabled={savingNote===a.id}
                        placeholder="What was discussed, decided or carried forward…"
                        onChange={e=>setDrafts(d=>({...d,[a.id]:e.target.value}))}
                        onBlur={()=>saveNote(a)}
                        style={{width:'100%',resize:'vertical',fontFamily:'inherit',fontSize:13,
                                padding:'8px 10px',borderRadius:3,
                                border:'1px solid var(--'+(over?'red':'border-d')+')',
                                background:'var(--panel)',color:'var(--ink)'}}/>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:3}}>
                        <span style={{color:over?'var(--red)':'var(--muted)'}}>
                          {over ? `${val.trim().length} characters — ${MOM_NOTE_MAX} max.`
                                : savingNote===a.id ? 'Saving…' : ''}</span>
                        <span className="dim">{val.trim().length} / {MOM_NOTE_MAX}</span>
                      </div>
                    </>
                  : <div style={{fontSize:12.5,color:val?'var(--ink-2)':'var(--muted)',whiteSpace:'pre-wrap'}}>
                      {val||'No note recorded'}</div>}
                {/* Decisions taken on this agenda item -- wlog_decision's
                    lm_MeetingOccurrenceAgenda (DecisionLink.jsx). New ones only
                    while the Minutes can still be edited. */}
                <DecisionPanel target={{kind:'agenda', id:a.id, label:a.title}} canAdd={editable}/>
                {/* Tasks raised on this agenda item -- hx_tasks.lm_MeetingOccurrenceAgendaItem
                    (01 Oct, DT New only so far). */}
                <AgendaTaskPanel rec={rec} item={a} tasks={tasks} canAdd={editable}
                  onRaised={onTasksChanged}/>
              </div>;})}
          </div>}
    </div>

    <div className="card">
      <h2>Actions</h2>
      {drafting && <>
        <div className="csub">The MOM Recorder writes the Minutes. Every Agenda Item needs a
          Discussion Note before they can be submitted, because none of them carries an Output yet.</div>
        {!!missingNotes.length &&
          <Note k="warn">{missingNotes.length} Agenda Item{missingNotes.length>1?'s have':' has'} no
            Discussion Note. Submission is blocked until every item records an outcome.</Note>}
        <Btn k="pri" disabled={!canSubmit||busy==='submit'} onClick={submit}>
          {busy==='submit'?'Submitting…':'Submit to the Meeting Chair'}</Btn>
      </>}

      {awaitingChair && <>
        <div className="csub">Waiting on <b>{posName(rec.chairPositionId)||'the Meeting Chair'}</b>.
          Approving captures the signature — there is no separate signing step.</div>
        <div className="btn-row">
          <Btn k="pri" disabled={busy==='approve'} onClick={approve}>
            {busy==='approve'?'Approving…':'✓ Approve and sign'}</Btn>
          <Btn k="wrn" disabled={!!busy} onClick={()=>setReturning(true)}>Return for revision</Btn>
        </div>
      </>}

      {approved && <>
        <div className="csub">Approved and signed. Closing finalises the record
          and releases the Meeting Governance Audit Grid.</div>
        <Btn k="pri" disabled={busy==='close'} onClick={close}>
          {busy==='close'?'Closing…':'Close the Minutes'}</Btn>
      </>}

      {closed && <Note k="ok">Closed on {fmtISODT(minutes.closedAt)}. These Minutes can now be used
        as an input to a later Meeting.</Note>}

      <div className="sep"/>
      <Note k="info" ic="—">Approving would also activate any draft TMS Tasks and Decision Requests
        raised from this Meeting. Neither table exists yet, so there is nothing to activate — this
        becomes correct on its own once they are built.</Note>
    </div>

    {returning && <ReturnModal title="Return the Minutes to the Recorder"
      onClose={()=>setReturning(false)}
      onSave={async reason=>{
        setReturning(false);
        await run('return', ()=>returnMeetingMinutes(minutes.id, reason),
          'Returned to the Recorder','The reason is recorded and every Output stays Draft.');
      }}/>}
  </>;
}

/* Cancels a live Meeting Occurrence -- same wording/danger styling as the
   dead-code CancelModal below, rebuilt against cancelMeetingOccurrence(). */
function DvCancelOccModal({rec,onClose}){
  const {toast,refreshOccurrences}=use();
  const [reason,setReason]=useState('');
  const [saving,setSaving]=useState(false);

  const save = async () => {
    setSaving(true);
    try{
      const {id,errors} = await cancelMeetingOccurrence(rec.id, reason);
      if(!id){
        console.warn('[dataverse] cancelMeetingOccurrence() failed:', errors);
        toast('Not saved','Cancelling this occurrence failed. Check the console for details.','err');
        return;
      }
      toast('Occurrence cancelled','No governance record is produced for a cancelled occurrence.','ok');
      await refreshOccurrences();
      onClose();
    }catch(e){
      console.warn('[dataverse] cancelMeetingOccurrence() threw unexpectedly:', e);
      toast('Not saved','Cancelling this occurrence failed. Check the console for details.','err');
    }finally{ setSaving(false); }
  };

  return <Modal title="Cancel this Meeting Occurrence" onClose={onClose}
    sub="No governance score is produced for a cancelled occurrence. This cannot be undone from here."
    footer={<><Btn onClick={onClose} disabled={saving}>Keep the occurrence</Btn>
      <Btn k="dgr" disabled={!reason.trim()||saving} onClick={save}>
        {saving?'Cancelling…':'Cancel the occurrence'}</Btn></>}>
    <Field label="Reason" req><textarea value={reason} onChange={e=>setReason(e.target.value)}/></Field>
  </Modal>;
}

/* Opens a fresh Audit Grid Instance for correction -- the approved one is
   never edited in place, matching the seeded gridNewVersion()'s reasoning:
   an approval is a fact about what was known at the time. */
function DvGridCorrectionModal({onClose,onSave}){
  const [reason,setReason]=useState('');
  const tooLong = reason.trim().length>GRID_REASON_MAX;
  return <Modal title="Open a correction version" onClose={onClose}
    sub="Creates a new Grid Instance in Pending Facilitator Review. The approved Instance and its published score are left untouched."
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!reason.trim()||tooLong} onClick={()=>onSave(reason.trim())}>Open correction version</Btn></>}>
    <Field label="Reason" req hint={`Max ${GRID_REASON_MAX} characters.`}
      err={tooLong?`${reason.trim().length} characters — ${GRID_REASON_MAX} max.`:null}>
      <textarea value={reason} onChange={e=>setReason(e.target.value)}/></Field>
  </Modal>;
}

/* One row of the Audit Grid, live version -- same expand/collapse and manual-
   score-picker-vs-evidence-note shape as the seeded Question component, just
   driven by a liveScoreGrid() row instead of scoreGrid()'s. */
function DvGridQuestion({r,editable,savingId,onScore,onEvidence,onClear}){
  const [open,setOpen]=useState(false);
  const evVal = r.ev ?? '';
  const [draft,setDraft]=useState(evVal);
  useEffect(()=>{ setDraft(evVal); },[evVal]);
  const busy = savingId===r.id;
  const evTooLong = draft.trim().length>GRID_EVIDENCE_MAX;

  const statusTag = r.state==='retired' ? <Tag c="grey">Retired</Tag>
    : r.state==='na' ? <Tag c="grey">Not Applicable</Tag>
    : r.state==='blank' ? <Tag c="amber">Awaiting a manual score</Tag>
    : r.state==='manual' ? <Tag c="purple">Manually scored</Tag>
    : <Tag c="teal">Automatic</Tag>;
  const scoreDisp = r.state==='retired' ? '—'
    : r.state==='na' ? 'N/A'
    : r.state==='blank' ? <span style={{color:'var(--amber)'}}>—</span>
    : <span style={{color:`var(--${scoreColour(r.score)})`}}>{r.score}/5</span>;

  return <div style={{borderBottom:'1px solid var(--border)'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',cursor:'pointer'}}
      onClick={()=>setOpen(v=>!v)}>
      <span style={{fontWeight:700,fontSize:12,width:48,flex:'none'}}>{r.id}</span>
      <span style={{flex:1,fontSize:13,textDecoration:r.state==='retired'?'line-through':'none'}}>{r.q.q}</span>
      {statusTag}
      <span style={{width:40,textAlign:'right',fontSize:13,fontWeight:700}}>{scoreDisp}</span>
    </div>
    {open && <div style={{padding:'0 0 14px 58px'}}>
      {r.state==='retired' && <Note k="lock" ic="—">{r.q.rule}</Note>}
      {/* The reason is still shown once a person has overridden it, so the
          grid says what the system thought as well as what they decided. */}
      {(r.state==='na' || r.overrode==='na') && r.na
        && <Note k="info" ic="i">{r.na}{r.state==='na'
          ? ' You can record a score below if you know the answer.' : ''}</Note>}
      {r.state!=='retired' && <>
        <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>{r.q.rule}</div>
        {r.ev && <div style={{fontSize:12,marginBottom:8}}><b>Computed from:</b> {r.ev}</div>}
        {r.state==='auto' && <>
          <Note k="lock" ic="🔒">An auto-scored value cannot be changed by any user. An evidence note may
            still be attached.</Note>
          {editable
            ? <Field label="Evidence note (optional)" hint={`Max ${GRID_EVIDENCE_MAX} characters.`}
                err={evTooLong?`${draft.trim().length} characters — ${GRID_EVIDENCE_MAX} max.`:null}>
                <textarea value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}
                  onBlur={()=>{ if(draft!==evVal && !evTooLong) onEvidence(r.id,draft); }}/></Field>
            : evVal ? <div style={{fontSize:12,marginTop:6}}><b>Facilitator note:</b> {evVal}</div> : null}
        </>}
        {/* ⚠️ Keyed on the STATE, not on q.src: an Auto question the system
            could not compute is answerable too, which is the whole point. */}
        {r.state!=='auto' && <>
          <Field label="Score">
            {editable
              ? <div className="btn-row">{[0,1,2,3,4,5].map(n=>
                  <Btn key={n} k={'sm'+(r.score===n?' pri':'')} disabled={busy} onClick={()=>onScore(r.id,n)}>{n}</Btn>)}
                  {r.state==='manual' &&
                    <Btn k="sm" disabled={busy} onClick={()=>onClear(r.id)}>Clear</Btn>}</div>
              : <span>{r.score!=null?`${r.score} of 5`:'Not scored'}</span>}
          </Field>
          <Field label="Evidence note" req hint={`Max ${GRID_EVIDENCE_MAX} characters.`}
            err={editable && r.state==='manual' && !draft.trim()
              ? 'An evidence note is required for a manual score.'
              : evTooLong ? `${draft.trim().length} characters — ${GRID_EVIDENCE_MAX} max.` : null}>
            {editable
              ? <textarea value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}
                  onBlur={()=>{ if(draft!==evVal && !evTooLong) onEvidence(r.id,draft); }}/>
              : <span>{evVal||'—'}</span>}
          </Field>
        </>}
      </>}
    </div>}
  </div>;
}

/* The interactive Audit Grid tab, live version -- reads via
   fetchAuditGridInstancesByOccurrence() (already wired in DvMeetingDetail),
   scores every question live via liveScoreGrid(), and writes through
   saveAuditGridAnswer / updateAuditGridState / approveAuditGridInstance /
   createAuditGridInstance (all already in dataverse.js, previously unused).
   `grid` is the newest version (fetchAuditGridInstancesByOccurrence sorts
   newest-first); `olderVersions` is whatever is left, shown read-only below --
   normally empty, populated only once a correction version has been opened. */
function DvGridBody({rec,grid,olderVersions,minutes,quorumPct,torLink,accred,S,posName,dvMeetingOccs,onReload}){
  const {toast,dvDecisions=[]}=use();
  const [savingId,setSavingId]=useState(null);
  const [submitting,setSubmitting]=useState(false);
  const [approving,setApproving]=useState(false);
  const [returning,setReturning]=useState(false);
  const [openingVersion,setOpeningVersion]=useState(false);

  const rows = liveScoreGrid(rec, minutes, quorumPct, torLink, accred, S, grid, dvMeetingOccs, dvDecisions);
  const live = gridTotals(rows);
  const frozen = !!grid.frozen;
  const display = frozen
    ? { score:grid.score, coverage: grid.total?Math.round((grid.coverage||0)/grid.total*1000)/10:0,
        applicable:grid.coverage, total:grid.total }
    : { score:live.score, coverage:live.coverage, applicable:live.applicable, total:live.total };

  const editable = grid.state==='Pending Facilitator Review' || grid.state==='Returned for Revision';
  const blanks = rows.filter(r=>r.state==='blank');
  /* ⚠️ Was hard-coded to AG-02, the only Manual question at the time. Any
     question can now carry a manual score, so every one of them needs its
     evidence note -- otherwise a score a person typed has nothing behind it. */
  const needEvidence = rows.filter(r=>r.state==='manual' && !(r.ev||'').trim());
  const canSubmit = blanks.length===0 && needEvidence.length===0;

  const answerIdFor = qid => grid.answers.find(a=>a.questionId===qid)?.id;

  const saveScore = async (qid, score) => {
    setSavingId(qid);
    try{
      const {id,errors} = await saveAuditGridAnswer(grid.id, qid, {score, evidence:grid.evidence?.[qid]}, answerIdFor(qid));
      if(!id){ console.warn('[dataverse] saveAuditGridAnswer() failed:', errors);
        toast('Not saved','Saving the score failed. Check the console for details.','err'); return; }
      await onReload();
    }catch(e){ console.warn('[dataverse] saveAuditGridAnswer() threw unexpectedly:', e);
      toast('Not saved','Saving the score failed. Check the console for details.','err');
    }finally{ setSavingId(null); }
  };

  const saveEvidence = async (qid, text) => {
    setSavingId(qid);
    try{
      const {id,errors} = await saveAuditGridAnswer(grid.id, qid, {score:grid.manual?.[qid], evidence:text}, answerIdFor(qid));
      if(!id){ console.warn('[dataverse] saveAuditGridAnswer() failed:', errors);
        toast('Not saved','Saving the evidence note failed. Check the console for details.','err'); return; }
      await onReload();
    }catch(e){ console.warn('[dataverse] saveAuditGridAnswer() threw unexpectedly:', e);
      toast('Not saved','Saving the evidence note failed. Check the console for details.','err');
    }finally{ setSavingId(null); }
  };

  /* Clears a manual score back to blank -- archives the Answer row rather
     than deleting it, same statecode convention as MOM Notes. */
  const clearScore = async (qid) => {
    const answerId = answerIdFor(qid);
    if(!answerId) return;
    setSavingId(qid);
    try{
      const {id,errors} = await archiveAuditGridAnswer(answerId);
      if(!id){ console.warn('[dataverse] archiveAuditGridAnswer() failed:', errors);
        toast('Not saved','Clearing the score failed. Check the console for details.','err'); return; }
      await onReload();
    }catch(e){ console.warn('[dataverse] archiveAuditGridAnswer() threw unexpectedly:', e);
      toast('Not saved','Clearing the score failed. Check the console for details.','err');
    }finally{ setSavingId(null); }
  };

  const submit = async () => {
    setSubmitting(true);
    try{
      const {id,errors} = await updateAuditGridState(grid.id, 'Submitted for Approval');
      if(!id){ console.warn('[dataverse] updateAuditGridState() failed:', errors);
        toast('Not saved','Submitting the Grid failed. Check the console for details.','err'); return; }
      toast('Submitted for approval','The Grid now sits with the Meeting Chair.','ok');
      await onReload();
    }catch(e){ console.warn('[dataverse] updateAuditGridState() threw unexpectedly:', e);
      toast('Not saved','Submitting the Grid failed. Check the console for details.','err');
    }finally{ setSubmitting(false); }
  };

  const approvePublish = async () => {
    setApproving(true);
    try{
      const {id,errors} = await approveAuditGridInstance(grid.id,
        {score:live.score, coverage:live.applicable, total:live.total});
      if(!id){ console.warn('[dataverse] approveAuditGridInstance() failed:', errors);
        toast('Not saved','Approving the Grid failed. Check the console for details.','err'); return; }
      toast('Score published',
        `Overall Score ${live.score}% with Coverage ${live.applicable} of ${live.total}. The Instance is locked.`,'ok');
      await onReload();
    }catch(e){ console.warn('[dataverse] approveAuditGridInstance() threw unexpectedly:', e);
      toast('Not saved','Approving the Grid failed. Check the console for details.','err');
    }finally{ setApproving(false); }
  };

  const returnForRevision = async reason => {
    setReturning(false);
    try{
      const {id,errors} = await updateAuditGridState(grid.id, 'Returned for Revision', reason);
      if(!id){ console.warn('[dataverse] updateAuditGridState() failed:', errors);
        toast('Not saved','Returning the Grid failed. Check the console for details.','err'); return; }
      toast('Returned to the Facilitator','The reason is recorded.','warn');
      await onReload();
    }catch(e){ console.warn('[dataverse] updateAuditGridState() threw unexpectedly:', e);
      toast('Not saved','Returning the Grid failed. Check the console for details.','err'); }
  };

  const openCorrectionVersion = async reason => {
    setOpeningVersion(false);
    try{
      const {id,errors} = await createAuditGridInstance({
        occurrenceId: rec.id, name: grid.name, templateVersion: grid.templateVersion,
        total: grid.total, version: (grid.version||1)+1, correctionReason: reason,
        facilitatorPositionId: grid.facilitatorPositionId, chairPositionId: grid.chairPositionId,
      });
      if(!id){ console.warn('[dataverse] createAuditGridInstance() (correction) failed:', errors);
        toast('Not saved','Opening a correction version failed. Check the console for details.','err'); return; }
      toast('New Grid version opened','Pending Facilitator Review. The approved Instance is unchanged.','ok');
      await onReload();
    }catch(e){ console.warn('[dataverse] createAuditGridInstance() (correction) threw unexpectedly:', e);
      toast('Not saved','Opening a correction version failed. Check the console for details.','err'); }
  };

  return <>
    <div className="card">
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12,flexWrap:'wrap'}}>
        <Tag c={grid.state==='Approved'?'green':grid.state==='Void'?'grey':'amber'}>{grid.state||'—'}</Tag>
        {grid.templateVersion && <Tag>Template {grid.templateVersion}</Tag>}
        <Tag>Version {grid.version}</Tag>
        {grid.locked && <Tag c="grey">🔒 Locked</Tag>}
      </div>

      <ScoreHero score={display.score} coverage={display.coverage} applicable={display.applicable}
        total={display.total} threshold={S.passThreshold} state={grid.state}/>

      <div className="sep"/>
      <KVBlock items={[
        ['Facilitator', posName(grid.facilitatorPositionId)||'—'],
        ['Meeting Chair', posName(grid.chairPositionId)||'—'],
        ['Approved at', fmtISODT(grid.approvedAt)],
      ]}/>

      {grid.returnReason && <Note k="err"><b>Returned for revision.</b> {grid.returnReason}</Note>}
      {grid.correctionReason && <Note k="warn"><b>Correction version.</b> {grid.correctionReason}</Note>}
      {!frozen && live.na>0 && <Note k="info" ic="i">{live.na} question{live.na===1?'':'s'} Not Applicable —
        set by the system from what this occurrence and its Setup hold, never by a user.</Note>}
      {editable && blanks.length>0 && <Note k="warn">AG-02 still needs a manual score and an evidence note
        before this Grid can be submitted.</Note>}
    </div>

    {AG_CATEGORIES.map(cat=>{
      const catRows = rows.filter(r=>r.q.cat===cat);
      const applicable = catRows.filter(r=>r.state!=='na' && r.state!=='retired');
      const notRetired = catRows.filter(r=>r.state!=='retired');
      return <div className="card" key={cat}>
        <div className="card-hd" style={{display:'flex',alignItems:'center',gap:10}}>
          <h2 style={{flex:1,fontSize:14}}>{cat}</h2>
          <span className="dim" style={{fontSize:12}}>{applicable.length} of {notRetired.length} applicable</span>
        </div>
        {catRows.map(r=><DvGridQuestion key={r.id} r={r} editable={editable} savingId={savingId}
          onScore={saveScore} onEvidence={saveEvidence} onClear={clearScore}/>)}
      </div>;
    })}

    <div className="card">
      <h2>Actions</h2>
      {editable && <>
        {!canSubmit && <Note k="warn">
          {blanks.length>0 && `${blanks.length} question${blanks.length===1?'':'s'} still blank. `}
          {needEvidence.length>0 && `${needEvidence.length} manual score${
            needEvidence.length===1?'':'s'} still need${
            needEvidence.length===1?'s':''} an evidence note: ${
            needEvidence.map(r=>r.id).join(', ')}.`}</Note>}
        <Btn k="pri" disabled={!canSubmit||submitting} onClick={submit}>
          {submitting?'Submitting…':'Submit for Chair approval'}</Btn>
      </>}
      {grid.state==='Submitted for Approval' && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn k="grn" disabled={approving} onClick={approvePublish}>
          {approving?'Approving…':'Approve and publish the score'}</Btn>
        <Btn k="wrn" onClick={()=>setReturning(true)}>Return for revision</Btn>
      </div>}
      {grid.state==='Approved' && <>
        <Note k="ok">Approved {fmtISODT(grid.approvedAt)}. The score is locked and will not be recomputed.</Note>
        <Btn onClick={()=>setOpeningVersion(true)}>Open a correction version</Btn>
      </>}
      <Note k="warn" style={{marginTop:10}}>No independent line review exists for this score yet <OD id="OD-23"/>.</Note>
    </div>

    {returning && <ReturnModal title="Return the Grid to the Facilitator" onClose={()=>setReturning(false)}
      onSave={returnForRevision}/>}
    {openingVersion && <DvGridCorrectionModal onClose={()=>setOpeningVersion(false)} onSave={openCorrectionVersion}/>}

    {olderVersions.length>0 && <div className="card">
      <h2>Earlier versions</h2>
      <div className="t-wrap"><table className="data">
        <thead><tr><th>Version</th><th>State</th><th>Score</th><th>Coverage</th></tr></thead>
        <tbody>{olderVersions.map(g=>
          <tr key={g.id}>
            <td>{g.version}</td>
            <td><Tag c={g.state==='Approved'?'green':'grey'}>{g.state||'—'}</Tag></td>
            <td>{g.score!=null?g.score+'%':'—'}</td>
            <td>{g.coverage!=null && g.total?g.coverage+' of '+g.total:'—'}</td>
          </tr>)}
        </tbody></table></div>
    </div>}
  </>;
}

/* Link a Report Occurrence to a meeting DIRECTLY (29 Sep) -- any status,
   Draft included, and Custom reports too (they have no Template, so the
   Documents tab's Template-first flow could never reach them). The ones in
   the meeting's own place (Business Unit / Region / Department) are listed
   first. `taken` is the ids already linked or chosen. */
const RPT_STATUS_WORD = s => s==='In Review' ? 'Submitted — in review'
  : s==='Draft' ? 'Draft — not submitted yet' : s || '—';
function ReportLinkPicker({reports, taken, place, onPick, busy, pickLabel='Link'}){
  const [q,setQ]=useState('');
  const [all,setAll]=useState(false);
  const inPlace = r => (!place.businessUnitId || r.businessUnitId===place.businessUnitId)
    && (!place.regionId || r.regionId===place.regionId)
    && (!place.departmentId || r.departmentId===place.departmentId);
  const hasPlace = !!(place.businessUnitId || place.regionId || place.departmentId);
  const pool = (reports||[]).filter(r=>!taken.has(r.id) && r.status!=='Rejected');
  const needle = q.trim();
  const shown = pool
    .filter(r=>all || !hasPlace || needle || inPlace(r))
    .filter(r=>matchesQuery(needle,[r.name, r.status, fmtP(r.period), dvRptTpl(r.templateId)||'Custom',
                                    dvBu(r.businessUnitId), dvDept(r.departmentId)]))
    .sort((a,b)=>(inPlace(b)-inPlace(a)) || String(b.period||'').localeCompare(String(a.period||''))
                 || String(a.name).localeCompare(String(b.name)));
  const outside = hasPlace && !all && !needle ? pool.filter(r=>!inPlace(r)).length : 0;
  return <div>
    <input type="search" value={q} onChange={e=>setQ(e.target.value)}
      placeholder="Search reports by name, template, period, status…" aria-label="Search reports"
      style={{width:'100%',marginBottom:8}}/>
    {shown.length===0
      ? <Note k="info" ic="i">{pool.length ? 'No report matches.' : 'Every report is already linked.'}</Note>
      : <div style={{maxHeight:280,overflowY:'auto'}}>
          {shown.slice(0,40).map(r=>
            <div key={r.id} className="sched-r" style={{cursor:'default'}}>
              <div className="sched-t"><div className="n">{r.name}</div>
                <div className="m">{[fmtP(r.period), dvRptTpl(r.templateId)||'Custom report',
                  dvBu(r.businessUnitId)||dvRegion(r.regionId), dvDept(r.departmentId)].filter(Boolean).join(' · ')}</div></div>
              <Tag c={rptTagC(r.status)}>{r.status}</Tag>
              <Btn k="sm pri" disabled={busy} onClick={()=>onPick(r)}>{pickLabel}</Btn>
            </div>)}
          {shown.length>40 ? <div className="t-sub" style={{padding:6}}>Showing 40 of {shown.length} — search to narrow.</div> : null}
        </div>}
    {outside>0
      ? <Btn k="sm" style={{marginTop:8}} onClick={()=>setAll(true)}>
          Show {outside} more from other places</Btn>
      : null}
  </div>;
}

function DvMeetingDetail({rec,back}){
  const {sel,setSel,toast,refreshOccurrences,openMeeting,S,dvMeetingOccs,dvReportOccs,openDvRec,dvDecisions=[]}=use();
  const tab = sel.mtgTab || 'detail';
  const setTab = t=>setSel(v=>({...v,mtgTab:t}));
  const [markingHeld,setMarkingHeld]=useState(false);
  const [attSavingId,setAttSavingId]=useState(null);
  const [editing,setEditing]=useState(false);
  const [cancelling,setCancelling]=useState(false);
  const [rescheduling,setRescheduling]=useState(false);
  const [addingAgenda,setAddingAgenda]=useState(false);
  const [newAgendaTitle,setNewAgendaTitle]=useState('');
  const [savingAgenda,setSavingAgenda]=useState(false);
  const [agendaBusyId,setAgendaBusyId]=useState(null);
  const [sendingAgenda,setSendingAgenda]=useState(false);

  /* The Minutes row and the Audit Grid Instances belonging to this occurrence,
     read from lm_meetingminuteses / lm_momnoteses / lm_auditgridinstances /
     lm_auditgridanswers. Read-only for now: the two tabs below show what
     Dataverse actually holds and write nothing back. A failure on either leaves
     the rest of the page working, the same way the occurrence's own child
     tables do. */
  const [minutes,setMinutes]=useState(null);
  const [grids,setGrids]=useState([]);
  const [govLoading,setGovLoading]=useState(true);

  /* Re-read both after any write, so the tab reflects what Dataverse now holds
     rather than what the UI hoped it wrote. */
  const reloadGovernance = useCallback(async ()=>{
    const [m,g] = await Promise.all([
      fetchMeetingMinutesByOccurrence(rec.id).catch(e=>{
        console.warn('[dataverse] fetchMeetingMinutesByOccurrence() failed:', e); return null; }),
      fetchAuditGridInstancesByOccurrence(rec.id).catch(e=>{
        console.warn('[dataverse] fetchAuditGridInstancesByOccurrence() failed:', e); return []; }),
    ]);
    setMinutes(m); setGrids(g||[]);
  },[rec.id]);

  useEffect(()=>{
    let cancelled=false;
    setGovLoading(true);
    Promise.all([
      fetchMeetingMinutesByOccurrence(rec.id).catch(e=>{
        console.warn('[dataverse] fetchMeetingMinutesByOccurrence() failed:', e); return null; }),
      fetchAuditGridInstancesByOccurrence(rec.id).catch(e=>{
        console.warn('[dataverse] fetchAuditGridInstancesByOccurrence() failed:', e); return []; }),
    ]).then(([m,g])=>{ if(cancelled) return; setMinutes(m); setGrids(g||[]); })
      .finally(()=>{ if(!cancelled) setGovLoading(false); });
    return ()=>{cancelled=true;};
  },[rec.id]);

  /* Documents (lm_meetingoccurrencelinkedreports) and the Department/Function
     rows this occurrence actually carries (lm_meetingoccurrencedepartmentfunctions)
     -- both registered earlier but never read by any screen until now. Loaded
     together since the linking flow below needs the department rows to scope
     its Report Occurrence match. */
  const [docs,setDocs]=useState(null);
  const [deptRows,setDeptRows]=useState([]);
  const [docsLoading,setDocsLoading]=useState(true);
  const reloadDocs = useCallback(async ()=>{
    const [d,dept] = await Promise.all([
      fetchMeetingOccurrenceLinkedReports(rec.id).catch(e=>{
        console.warn('[dataverse] fetchMeetingOccurrenceLinkedReports() failed:', e); return []; }),
      fetchMeetingOccurrenceDepartments(rec.id).catch(e=>{
        console.warn('[dataverse] fetchMeetingOccurrenceDepartments() failed:', e); return []; }),
    ]);
    setDocs(d); setDeptRows(dept);
  },[rec.id]);
  useEffect(()=>{
    let cancelled=false;
    setDocsLoading(true);
    reloadDocs().finally(()=>{ if(!cancelled) setDocsLoading(false); });
    return ()=>{cancelled=true;};
  },[rec.id, reloadDocs]);

  const [linkTplId,setLinkTplId]=useState('');
  const [linking,setLinking]=useState(false);
  const [unlinkingId,setUnlinkingId]=useState(null);

  /* Every Department this occurrence is actually scoped to -- its own
     lm_Department (a Department-scoped occurrence) plus whatever the child
     rows above carry (a group-wide occurrence, or one the generator copied
     several lines onto). Empty means "no Department constraint known", not
     "no Department", so the match below falls back to Template + BU alone. */
  const meetingDeptIds = new Set([rec.departmentId, ...deptRows.map(d=>d.departmentId)].filter(Boolean));
  /* Occurrences of one Template. `scoped` applies this Meeting's own Business
     Unit or Region and its Departments; unscoped is every occurrence of that
     Template, which is what the tab falls back to offering when the scoped
     match is empty -- a Template with occurrences somewhere should not read as
     a Template with none. */
  const occsForTemplate = (tplId, scoped) => !tplId ? [] : dvReportOccs.filter(r=>
       r.templateId===tplId
    && (!scoped || (
         (rec.businessUnitId ? r.businessUnitId===rec.businessUnitId
          : rec.regionId ? r.regionId===rec.regionId : true)
      && (meetingDeptIds.size===0 || meetingDeptIds.has(r.departmentId))))
  );
  const [showAll,setShowAll]=useState(false);
  const matchingOccs = occsForTemplate(linkTplId, !showAll);
  const outsideScope = linkTplId ? occsForTemplate(linkTplId,false).length - occsForTemplate(linkTplId,true).length : 0;

  /* Submissions -- pre-meeting input readiness (prototype's Submissions tab,
     OD-39). The inputs are every document linked above plus every Input report
     the Setup names that is not linked yet. An input is ready once its Report
     Occurrence has reached the readiness minimum: In Review (submitted) by
     default, or Approved when Governance Settings say so. Returned and
     Rejected count as not submitted. An Ad Hoc meeting has no Setup, so only
     its linked documents count. */
  const [setupInputs,setSetupInputs]=useState([]);
  useEffect(()=>{
    let cancelled=false;
    if(!rec.templateId){ setSetupInputs([]); return undefined; }
    fetchMeetingTemplateInputReports(rec.templateId)
      .then(r=>{ if(!cancelled) setSetupInputs(r); })
      .catch(e=>{ console.warn('[dataverse] fetchMeetingTemplateInputReports() failed:', e);
        if(!cancelled) setSetupInputs([]); });
    return ()=>{cancelled=true;};
  },[rec.templateId]);
  const needApproved = S.inputReadiness==='approved';
  const INPUT_RANK = {'In Review':1,'Approved':2};
  const requiredTplIds = new Set(setupInputs.map(s=>s.reportTemplateId).filter(Boolean));
  const linkedTplIds = new Set((docs||[]).map(d=>d.reportTemplateId).filter(Boolean));
  const submissions = [
    ...(docs||[]).map(d=>{
      const occ = d.reportOccurrenceId ? dvReportOccs.find(r=>r.id===d.reportOccurrenceId) : null;
      return { key:d.id, link:d, occ, tplId:d.reportTemplateId,
        name: occ ? occ.name : d.name,
        status: occ ? occ.status : d.reportOccurrenceId ? 'Not loaded' : 'No occurrence yet',
        ready: !!occ && (INPUT_RANK[occ.status]||0) >= (needApproved?2:1),
        required: !!d.reportTemplateId && requiredTplIds.has(d.reportTemplateId) };
    }),
    ...setupInputs.filter(s=>!s.reportTemplateId || !linkedTplIds.has(s.reportTemplateId)).map(s=>({
      key:'setup-'+s.id, link:null, occ:null, tplId:s.reportTemplateId,
      name: dvRptTpl(s.reportTemplateId) || s.name || 'Input named by the Setup',
      status:'Not linked', ready:false, required:true })),
  ];
  const readyCount = submissions.filter(x=>x.ready).length;
  const notReady = submissions.length - readyCount;

  /* Attaching an occurrence to a link that was made against the Template
     alone -- which link is open, and whether its list is scoped. */
  const [attachFor,setAttachFor]=useState(null);
  const [attachAll,setAttachAll]=useState(false);
  const [attaching,setAttaching]=useState(false);
  const onAttachOcc = async (link, occ) => {
    setAttaching(true);
    try{
      const {id,errors} = await attachReportOccurrenceToLink({
        linkId: link.id, reportOccurrenceId: occ.id, name: occ.name });
      if(!id){
        console.warn('[dataverse] attachReportOccurrenceToLink() failed:', errors);
        toast('Not attached','Attaching this occurrence failed. Check the console for details.','err');
        return;
      }
      toast('Occurrence attached',`${occ.name} is now linked to this Meeting.`,'ok');
      setAttachFor(null); setAttachAll(false);
      await reloadDocs();
    }finally{ setAttaching(false); }
  };

  const onLinkDoc = async (occ) => {
    setLinking(true);
    try{
      const tplName = dvRptTpl(linkTplId) || 'Report Template';
      const {id,errors} = await linkMeetingOccurrenceReport({
        meetingOccurrenceId: rec.id,
        reportTemplateId: linkTplId,
        reportOccurrenceId: occ ? occ.id : null,
        name: occ ? occ.name : tplName,
      });
      if(!id){
        console.warn('[dataverse] linkMeetingOccurrenceReport() failed:', errors);
        toast('Not linked','Linking this document failed. Check the console for details.','err');
        return;
      }
      toast('Document linked', occ ? `${occ.name} is now linked to this Meeting.`
        : `${tplName} is linked — no occurrence yet.`, 'ok');
      setLinkTplId('');
      await reloadDocs();
    }finally{ setLinking(false); }
  };
  const onUnlinkDoc = async (id) => {
    setUnlinkingId(id);
    try{
      const {errors} = await unlinkMeetingOccurrenceReport(id);
      if(errors.length){
        console.warn('[dataverse] unlinkMeetingOccurrenceReport() failed:', errors);
        toast('Not removed','Removing this document failed. Check the console for details.','err');
        return;
      }
      await reloadDocs();
    }finally{ setUnlinkingId(null); }
  };

  const markHeld = async () => {
    setMarkingHeld(true);
    try{
      const {id,errors} = await updateMeetingOccurrenceStatus(rec.id, 'Held');
      if(!id){
        console.warn('[dataverse] updateMeetingOccurrenceStatus() failed:', errors);
        toast('Not saved','Marking the meeting as Held failed. Check the console for details.','err');
        return;
      }
      /* Every completed Meeting produces Minutes, so the shell is created the
         moment the occurrence is Held rather than waiting for someone to open
         the tab -- otherwise the Minutes only exist if a Recorder happens to
         visit, and a Meeting with no Minutes row is invisible to the work
         queue. Created empty and Draft; the notes come later.
         A failure here is reported but does not undo the Held status, which is
         already committed by this point. */
      let minutesNote = 'Attendance can now be recorded.';
      if(!minutes){
        const created = await createMeetingMinutes({
          occurrenceId: rec.id,
          name: `Minutes — ${rec.name}`,
          status: 'Draft',
        });
        if(created.id){
          minutesNote = 'Attendance can now be recorded, and the Minutes have been opened in Draft.';
          setMinutes(await fetchMeetingMinutesByOccurrence(rec.id).catch(()=>null));
        }else{
          console.warn('[dataverse] createMeetingMinutes() failed:', created.errors);
          minutesNote = 'Attendance can now be recorded. The Minutes row could not be created — check the console.';
        }
      }
      toast('Meeting held', minutesNote, 'ok');
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] updateMeetingOccurrenceStatus() threw unexpectedly:', e);
      toast('Not saved','Marking the meeting as Held failed. Check the console for details.','err');
    }finally{ setMarkingHeld(false); }
  };

  const setAttendance = async (attendeeId, present) => {
    setAttSavingId(attendeeId);
    try{
      const {id,errors} = await updateMeetingOccurrenceAttendance(attendeeId, present);
      if(!id){
        console.warn('[dataverse] updateMeetingOccurrenceAttendance() failed:', errors);
        toast('Not saved','Recording attendance failed. Check the console for details.','err');
        return;
      }
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] updateMeetingOccurrenceAttendance() threw unexpectedly:', e);
      toast('Not saved','Recording attendance failed. Check the console for details.','err');
    }finally{ setAttSavingId(null); }
  };

  const addAgendaItem = async () => {
    const title = newAgendaTitle.trim();
    if(!title) return;
    setSavingAgenda(true);
    try{
      const {id,errors} = await createMeetingOccurrenceAgendaItem(rec.id,
        { title, sequence: rec.agenda.length+1 });
      if(!id){
        console.warn('[dataverse] createMeetingOccurrenceAgendaItem() failed:', errors);
        toast('Not saved','Adding the Agenda item failed. Check the console for details.','err');
        return;
      }
      setNewAgendaTitle(''); setAddingAgenda(false);
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] createMeetingOccurrenceAgendaItem() threw unexpectedly:', e);
      toast('Not saved','Adding the Agenda item failed. Check the console for details.','err');
    }finally{ setSavingAgenda(false); }
  };

  const removeAgendaItem = async agendaId => {
    setAgendaBusyId(agendaId);
    try{
      const {id,errors} = await archiveMeetingOccurrenceAgendaItem(agendaId);
      if(!id){
        console.warn('[dataverse] archiveMeetingOccurrenceAgendaItem() failed:', errors);
        toast('Not saved','Removing the Agenda item failed. Check the console for details.','err');
        return;
      }
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] archiveMeetingOccurrenceAgendaItem() threw unexpectedly:', e);
      toast('Not saved','Removing the Agenda item failed. Check the console for details.','err');
    }finally{ setAgendaBusyId(null); }
  };

  const moveAgendaItem = async (a, dir) => {
    const sorted = rec.agenda.slice().sort((x,y)=>(x.seq||0)-(y.seq||0));
    const idx = sorted.findIndex(x=>x.id===a.id);
    const other = sorted[idx+dir];
    if(idx<0 || !other) return;
    setAgendaBusyId(a.id);
    try{
      const [r1,r2] = await Promise.all([
        updateMeetingOccurrenceAgendaSequence(a.id, other.seq),
        updateMeetingOccurrenceAgendaSequence(other.id, a.seq),
      ]);
      if(!r1.id || !r2.id){
        console.warn('[dataverse] updateMeetingOccurrenceAgendaSequence() failed:', r1.errors, r2.errors);
        toast('Not saved','Reordering the Agenda failed. Check the console for details.','err');
        return;
      }
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] updateMeetingOccurrenceAgendaSequence() threw unexpectedly:', e);
      toast('Not saved','Reordering the Agenda failed. Check the console for details.','err');
    }finally{ setAgendaBusyId(null); }
  };

  const sendAgenda = async () => {
    setSendingAgenda(true);
    try{
      const {id,errors} = await recordAgendaDistribution(rec.id);
      if(!id){
        console.warn('[dataverse] recordAgendaDistribution() failed:', errors);
        toast('Not saved','Recording agenda distribution failed. Check the console for details.','err');
        return;
      }
      toast('Agenda distribution recorded','Saved to lm_AgendaSentDate.','ok');
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] recordAgendaDistribution() threw unexpectedly:', e);
      toast('Not saved','Recording agenda distribution failed. Check the console for details.','err');
    }finally{ setSendingAgenda(false); }
  };

  const posName = id => { const n=dvPos(id); if(!n) return null;
    const h=id&&DV_POS_HOLDER[id]; return h?`${n} — ${h}`:n; };
  const scope = dvBu(rec.businessUnitId)||dvRegion(rec.regionId)||'Group-wide';
  const tpl = dvTplDetail(rec.templateId);
  const tplSetupType = tpl ? MEETING_SETUP_TYPE[tpl.setupTypeCode]||null : null;
  const tplCategory  = tpl ? MEETING_CATEGORY[tpl.categoryCode]||null : null;
  const tplFrequency = tpl ? MEETING_FREQUENCY[tpl.frequencyCode]||null : null;
  const tplDayOfWeek = tpl ? MEETING_DAY_OF_WEEK[tpl.dayOfWeekCode]||null : null;
  const cadence = [tplFrequency,tplDayOfWeek].filter(Boolean).join(' — ') || null;
  const accred = tplSetupType==='Accreditation Committee';
  const covered = rec.agenda.filter(a=>a.covered==='Yes').length;
  const present = rec.attendees.filter(a=>a.present==='Present').length;
  const required = rec.attendees.filter(a=>(a.type||'Required')==='Required');
  const requiredPresent = required.filter(a=>a.present==='Present').length;
  const quorum = liveQuorum(rec, tpl, S.delegatedAttend);
  /* Carried forward -- previousOccurrence()/carryCandidates(). */
  const prevOcc = previousOccurrence(rec, dvMeetingOccs);
  const carriedIn = rec.agenda.filter(a=>a.carriedFromId);
  const carryWaiting = rec.status==='Scheduled' ? carryCandidates(prevOcc, dvMeetingOccs) : [];
  const prevAgendaIds = new Set((prevOcc?.agenda||[]).map(a=>a.id));
  const prevOpenDecisions = dvDecisions.filter(d=>d.agendaItemId && prevAgendaIds.has(d.agendaItemId)
                                               && !DECISION_DONE.has(d.status));
  const [carrying,setCarrying]=useState(false);

  /* Actions tab (01 Oct): the Decisions and Tasks this meeting produced, and
     what is still open from the previous one. Decisions link through their
     agenda item (wlog_decision.lm_MeetingOccurrenceAgenda). Tasks link through
     hx_tasks.lm_MeetingOccurrence / lm_MeetingOccurrenceAgendaItem, which exist
     in DT New only -- fetchTasksForMeeting returns null where they don't. */
  const [mtgTasks,setMtgTasks]=useState(undefined);      // undefined = reading, null = unavailable
  const [prevTasks,setPrevTasks]=useState([]);
  const [tasksTick,setTasksTick]=useState(0);             // bumped after a task is raised in the Minutes
  const agendaKey = rec.agenda.map(a=>a.id).join(',');
  const prevKey = prevOcc ? prevOcc.id+':'+(prevOcc.agenda||[]).map(a=>a.id).join(',') : '';
  useEffect(()=>{
    let live=true;
    setMtgTasks(undefined);
    fetchTasksForMeeting(rec.id, rec.agenda.map(a=>a.id))
      .then(t=>{ if(live) setMtgTasks(t); })
      .catch(()=>{ if(live) setMtgTasks(null); });
    if(prevOcc) fetchTasksForMeeting(prevOcc.id, (prevOcc.agenda||[]).map(a=>a.id))
      .then(t=>{ if(live) setPrevTasks(t||[]); }).catch(()=>{});
    else setPrevTasks([]);
    return ()=>{ live=false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rec.id, agendaKey, prevKey, tasksTick]);
  const DONE_ACTION = new Set(['Completed','Closed','Cancelled','Rejected','Done']);
  const agendaById = new Map(rec.agenda.map((a,i)=>[a.id,{...a, n:a.seq??i+1}]));
  const agendaLabel = id => { const a=agendaById.get(id); return a ? `#${a.n} ${a.title||''}`.trim() : null; };
  const actionState = x => DONE_ACTION.has(x.status) ? 'done'
    : (x.due && x.due < TODAY) ? 'overdue'
    : /progress|review|submitted|escalated/i.test(x.status||'') ? 'progress' : 'open';
  const actions = [
    ...dvDecisions.filter(d=>d.agendaItemId && agendaById.has(d.agendaItemId)).map(d=>({
      key:'d'+d.id, kind:'Decision', title:d.name, sub:d.decisionTaken, owner:null,
      source:agendaLabel(d.agendaItemId), due:null, status:d.status||'Recorded', from:'this'})),
    ...(mtgTasks||[]).map(t=>({
      key:'t'+t.id, kind:'Task', id:t.id, title:t.name, sub:[t.code, t.action].filter(Boolean).join(' · '),
      owner:t.assigneeName, source:agendaLabel(t.agendaItemId)||'This meeting', due:t.due, status:t.status||'New', from:'this'})),
    ...prevOpenDecisions.map(d=>({
      key:'pd'+d.id, kind:'Decision', title:d.name, sub:d.decisionTaken, owner:null,
      source:`Previous meeting · ${fmtD(prevOcc.date)}`, due:null, status:d.status||'Recorded', from:'prev'})),
    ...prevTasks.filter(t=>!DONE_ACTION.has(t.status)).map(t=>({
      key:'pt'+t.id, kind:'Task', id:t.id, title:t.name, sub:[t.code, t.action].filter(Boolean).join(' · '),
      owner:t.assigneeName, source:`Previous meeting · ${fmtD(prevOcc.date)}`, due:t.due, status:t.status||'New', from:'prev'})),
  ].map(x=>({...x, state:actionState(x)}));
  const actionCount = k => actions.filter(x=>x.state===k).length;

  /* Attendance tab (01 Oct): the last three held meetings of the same Setup in
     the same place, measured the same way as quorum (liveAttendance). */
  const attHistory = rec.templateId ? dvMeetingOccs
    .filter(o=>o.id!==rec.id && o.templateId===rec.templateId && o.status==='Held'
      && (o.businessUnitId||null)===(rec.businessUnitId||null) && (o.regionId||null)===(rec.regionId||null)
      && (o.date||'') < (rec.date||'9999'))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3)
    .map(o=>({o, a:liveAttendance(o.attendees, S.delegatedAttend)})) : [];
  const carryIn = async items => {
    setCarrying(true);
    try{
      let seq = rec.agenda.length, failed = 0;
      for(const a of items){
        const {id,errors} = await createMeetingOccurrenceAgendaItem(rec.id, {
          title:a.title, sequence:++seq, ownerPositionId:a.ownerPositionId||rec.facilitatorPositionId||undefined,
          source:'Carried forward', carriedFromId:a.id });
        if(!id){ failed++; console.warn('[dataverse] carrying an agenda item failed:', errors); }
      }
      toast(failed ? 'Not all carried' : 'Carried forward',
        failed ? `${items.length-failed} of ${items.length} added. Check the console for the rest.`
               : `${items.length} item${items.length===1?'':'s'} added to this meeting's agenda.`,
        failed ? 'warn' : 'ok');
      await refreshOccurrences();
    }finally{ setCarrying(false); }
  };
  const durMin = (()=>{
    if(!rec.start||!rec.end) return null;
    const [sh,sm]=rec.start.split(':').map(Number), [eh,em]=rec.end.split(':').map(Number);
    if([sh,sm,eh,em].some(n=>Number.isNaN(n))) return null;
    return (eh*60+em)-(sh*60+sm);
  })();
  const dow = rec.date
    ? new Date(rec.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long'}).toUpperCase() : '';

  /* Label above value, not beside it. This rail is 300px wide, so a label
     column left the value about 66px and every name wrapped a word per line. */
  const Row=({label,value})=> value==null||value===''||value==='—' ? null :
    <div className="kvr"><label>{label}</label><div className="v">{value}</div></div>;

  /* Restyled 01 Oct to the approved design (the Meeting Detail screenshot):
     cs-head, cs-tabs and a new Overview. The page is wrapped in .cs-build as
     well, which re-skins the shared .card / Btn / Note / Tag / table classes
     every other tab still uses (same scoping Build a report/plan uses), plus
     .cs-mtgd for this page's own pieces. Same data and actions as before. */
  const typeLabel = tplSetupType==='Accreditation Committee' ? 'Accreditation'
    : tplSetupType || (rec.templateId ? null : (rec.adhocType ? 'Ad Hoc — '+rec.adhocType : 'Ad Hoc'));
  const badge = rec.status==='Held' ? 'approved' : rec.status==='Cancelled' ? 'returned' : 'scheduled';
  return <div className="cs-root cs-build cs-mtgd">
    <div className="cs-head" style={{paddingBottom:0}}>
      <div className="cs-crumb"><button type="button" onClick={back}>Meetings</button> › <b>Meeting Detail</b></div>
      <div className="cs-head-top">
        <div style={{minWidth:0}}>
          <h1 className="cs-title">{rec.restricted && <Lock size={16} className="cs-lock" aria-label="Restricted"/>}{rec.name}</h1>
          <div className="mtgd-meta">
            <span className={'cs-badge '+badge}><i/>{rec.status||'—'}</span>
            {rec.stage ? <span className="cs-mono muted">{rec.stage.replace(/^Stage (\d) /,'Stage $1 · ')}</span> : null}
            <span>{[typeLabel, tplCategory || dvTpl(rec.templateId)].filter(Boolean).join(' · ') || '—'}</span>
            <span className="muted">· {scope}</span>
            {rec.restricted && <span className="cs-type purple">Restricted</span>}
          </div>
        </div>
        <div className="cs-actions">
          <button type="button" className="cs-btn ghost lg" onClick={back}>Back to List</button>
          {rec.status==='Scheduled' &&
            <button type="button" className="cs-btn ghost lg" onClick={()=>setEditing(true)}><PenLine size={13}/>Edit</button>}
          {rec.status==='Scheduled' &&
            <button type="button" className="cs-btn green lg" disabled={markingHeld||!rec.agenda.length} onClick={markHeld}
              title={rec.agenda.length?'Mark this meeting as held':'Add at least one Agenda item first'}>
              <Check size={13}/>{markingHeld?'Marking…':'Mark as Held'}</button>}
        </div>
      </div>
      <nav className="cs-tabs" role="tablist" aria-label="Meeting sections">
        {[['detail','Overview',null],['agenda','Agenda',rec.agenda.length],['att','Attendance',rec.attendees.length],
          ['minutes','Minutes',minutes?minutes.notes.length:null],['docs','Documents',docs&&docs.length?docs.length:null],
          ['inputs','Submissions',submissions.length?`${readyCount}/${submissions.length}`:null],
          /* Every meeting is scored (product owner, 28 Sep) -- the Grid tab is
             not gated on the Setup Type; `accred` only decides AG-01. */
          ['grid','Audit Grid',grids.length||null],
          ['actions','Actions',mtgTasks===undefined?null:(actions.length||null)]].map(([k,l,c])=>
          <button key={k} type="button" role="tab" aria-selected={tab===k}
            className={'cs-tab'+(tab===k?' on':'')} onClick={()=>setTab(k)}>
            {l}{c!=null ? <span className="cs-tab-badge">{c}</span> : null}</button>)}
      </nav>
    </div>

    {editing && <DvEditOccModal rec={rec} onClose={()=>setEditing(false)}/>}
    {rescheduling && <DvRescheduleOccModal rec={rec} onClose={()=>setRescheduling(false)}/>}
    {cancelling && <DvCancelOccModal rec={rec} onClose={()=>setCancelling(false)}/>}

    {rec.status==='Scheduled' && !rec.agenda.length &&
      <Note k="warn">An occurrence needs at least one Agenda item before it can be marked Held.</Note>}
    {rec.restricted && <Note k="lock"><b>Restricted.</b> This occurrence is marked visible only to its
      participants and to permitted governance roles.</Note>}
    {rec.rescheduledFromId && <Note k="warn"><b>Rescheduled.</b> This occurrence carries a link to the
      one it was moved from. Only this occurrence moved — the series is unchanged.</Note>}
    {rec.status==='Cancelled' && <Note k="err"><b>Cancelled.</b> {rec.cancelReason||'No reason recorded.'}</Note>}
    {quorum.state==='missed' && <Note k="err"><b>Quorum missed.</b> {quorumLine(quorum)}</Note>}
    {rec.status==='Scheduled' && !docsLoading && notReady>0 &&
      <Note k="warn"><b>{notReady} input{notReady===1?' is':'s are'} not yet {needApproved?'approved':'submitted'}.</b>
        {' '}Every input should reach at least {needApproved?'Approved':'In Review'} before the meeting.
        {' '}<a onClick={()=>setTab('inputs')} style={{fontWeight:650}}>See Submissions</a></Note>}

    {tab==='detail' && <div className="cs-two-col mtgd-cols">
      <div className="mtgd-main">
        <section className="card mtgd-tiles" aria-label="When and where">
          <div className="mtgd-tile">
            <CalendarDays size={18} aria-hidden="true"/>
            <b className="cs-mono">{rec.date?fmtDS(rec.date):'—'}</b>
            <span>{dow||'Date'}</span>
          </div>
          <div className="mtgd-tile">
            <Clock size={18} aria-hidden="true"/>
            <b className="cs-mono">{[rec.start,rec.end].filter(Boolean).join(' – ')||'—'}</b>
            <span>{durMin!=null?durMin+' minutes':(rec.timezone||'Time')}</span>
          </div>
          <div className="mtgd-tile">
            <MapPin size={18} aria-hidden="true"/>
            <b>{rec.location || (rec.link ? 'Online' : rec.mode) || '—'}</b>
            <span>{rec.location ? (rec.mode||'In person') : (rec.link ? 'Joining link' : 'Mode')}</span>
          </div>
        </section>

        <section className="card" aria-labelledby="mtgd-agenda">
          <div className="mtgd-card-top">
            <span className="cs-icon gold" aria-hidden="true"><ListOrdered size={15}/></span>
            <h2 id="mtgd-agenda">Agenda Preview</h2>
            <span className="cs-mono muted mtgd-count">{rec.agenda.length} item{rec.agenda.length===1?'':'s'}
              {durMin!=null?' · '+durMin+' min':''}</span>
          </div>
          {rec.agenda.length===0 ? <Empty ic="📋">No Agenda Items yet.</Empty> : <>
            <ol className="mtgd-agenda">
              {rec.agenda.slice(0,5).map((a,i)=>
                <li key={a.id}>
                  <span className="cs-mono mtgd-n">{i+1}.</span>
                  <span className="mtgd-t">{a.title||'—'}
                    {a.carriedFromId ? <span className="cs-type adhoc">Carried forward</span> : null}</span>
                  <span className="mtgd-o">{posName(a.ownerPositionId)||'—'}</span>
                </li>)}
            </ol>
            <button type="button" className="mtgd-more" onClick={()=>setTab('agenda')}>
              {rec.agenda.length>5 ? `View full agenda (${rec.agenda.length}) →` : 'View full agenda →'}</button>
          </>}
        </section>

        <section className="card" aria-labelledby="mtgd-att">
          <div className="mtgd-card-top">
            <span className="cs-icon green" aria-hidden="true"><UserCheck size={15}/></span>
            <h2 id="mtgd-att">Attendance Summary</h2>
            <span className="mtgd-bar" aria-hidden="true"><i style={{width:(required.length?requiredPresent/required.length*100:0)+'%'}}/></span>
            <span className="cs-mono muted mtgd-count">{requiredPresent}/{required.length}</span>
          </div>
          {quorum.state!=='none'
            ? <Note k={quorum.state==='met'?'ok':quorum.state==='missed'?'err':quorum.state==='incomplete'?'warn':'info'}>
                {quorum.state==='pending' ? 'Attendance is recorded after the meeting is held. ' : ''}
                {quorumLine(quorum)}</Note>
            : <Note k="info">{rec.status==='Held'
                ? `${requiredPresent} of ${required.length} Required Attendees present.`
                : 'Attendance is recorded after the meeting is held.'}</Note>}
          <button type="button" className="mtgd-more" onClick={()=>setTab('att')}>View full attendance →</button>
        </section>
      </div>

      <div className="cs-side mtgd-side">
        {rec.status==='Scheduled' && <section className="card mtgd-actions" aria-labelledby="mtgd-act">
          <div className="mtgd-card-top">
            <span className="cs-icon green" aria-hidden="true"><Check size={15}/></span>
            <h2 id="mtgd-act">Actions</h2>
          </div>
          <button type="button" className="cs-btn green lg" disabled={markingHeld||!rec.agenda.length} onClick={markHeld}>
            <Check size={13}/>{markingHeld?'Marking…':'Mark as Held'}</button>
          <button type="button" className="cs-btn ghost lg" onClick={()=>setRescheduling(true)}>
            <CalendarDays size={13}/>Reschedule</button>
          <button type="button" className="cs-btn danger lg" onClick={()=>setCancelling(true)}>
            <CircleX size={13}/>Cancel Meeting</button>
        </section>}

        <section className="card" aria-labelledby="mtgd-det">
          <h2 id="mtgd-det" className="mtgd-h">Meeting Details</h2>
          <div className="mtgd-kv">
            {[['Setup', dvTpl(rec.templateId)||(rec.templateId?'(not in the loaded list)':'Custom Ad Hoc')],
              ['Type', typeLabel],
              ['Category', tplCategory],
              ['Chair', posName(rec.chairPositionId)],
              ['Facilitator', posName(rec.facilitatorPositionId)],
              ['Location', rec.location || rec.link || null],
              ['Scope', scope],
              ['Cadence', cadence],
             ].filter(([,v])=>v).map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}
          </div>
        </section>

        <details className="card mtgd-all">
          <summary className="mtgd-h">All details</summary>
          <Row label="Meeting name" value={rec.name}/>
          <Row label="Status" value={rec.status}/>
          <Row label="Stage" value={rec.stage}/>
          <Row label="Business Unit" value={dvBu(rec.businessUnitId)}/>
          <Row label="Region" value={dvRegion(rec.regionId)}/>
          <Row label="Department" value={dvDept(rec.departmentId)}/>
          <Row label="Setup" value={dvTpl(rec.templateId)
            ||(rec.templateId?'(not in the loaded list)':(rec.adhocType?'Ad Hoc — '+rec.adhocType:'Custom Ad Hoc'))}/>
          <Row label="Setup Type" value={tplSetupType||(rec.templateId?null:'Ad Hoc')}/>
          <Row label="Classification" value={tplCategory}/>
          <Row label="Cadence" value={cadence}/>
          <Row label="TOR or Policy Reference" value={tpl&&tpl.torLink
            ? tpl.torLink
            : rec.templateId ? (accred?'Required — none held':'Optional — none held') : null}/>
          <Row label="Quorum Threshold" value={tpl
            ? (tpl.quorumPct!=null?tpl.quorumPct+'%':'Not configured')
            : null}/>
          <Row label="Ad Hoc Type" value={rec.adhocType}/>
          <Row label="Date" value={rec.date?fmtD(rec.date):null}/>
          <Row label="Time" value={[rec.start,rec.end].filter(Boolean).join(' – ')||null}/>
          <Row label="Time zone" value={rec.timezone}/>
          <Row label="Mode" value={rec.mode}/>
          <Row label="Location" value={rec.location}/>
          <Row label="Online link" value={rec.link}/>
          <Row label="Invite sent" value={rec.inviteSent?fmtD(rec.inviteSent):null}/>
          <Row label="Agenda Distributed" value={rec.agendaSent?fmtD(rec.agendaSent):'Not recorded'}/>
          <Row label="Outlook and Teams" value={rec.sync}/>
          <Row label="Cancellation reason" value={rec.cancelReason}/>
        </details>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon gold">👤</div><h2 style={{flex:1}}>Who runs it</h2>
          </div>
          <Row label="Meeting Chair" value={posName(rec.chairPositionId)}/>
          <Row label="Facilitator" value={posName(rec.facilitatorPositionId)}/>
          <Row label="MoM Recorder" value="Not tracked at the occurrence level"/>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:8}}>
            The Facilitator owns the agenda items and writes up the Minutes.</div>
        </div>

        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2}}>
            <div className="wa-icon green">✓</div><h2 style={{flex:1}}>Where it stands</h2>
          </div>
          {[['Agenda Items', rec.agenda.length, null],
            ['Agenda covered', rec.status==='Held'?`${covered} / ${rec.agenda.length}`:'—',
              rec.status==='Held'&&covered<rec.agenda.length?'amber':null],
            ['Attendees', rec.attendees.length, rec.attendees.length?null:'red'],
            ['Required Attendees', required.length, null],
            ['Required present', rec.status==='Held'?`${requiredPresent} / ${required.length}`:'—',
              rec.status==='Held'&&requiredPresent<required.length?'amber':null],
            ['Present in total', rec.status==='Held'?`${present} / ${rec.attendees.length}`:'—', null],
          ].map(([label,val,colour])=>
            <div key={label} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',
                                     borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,fontSize:12.5,color:'var(--ink-2)'}}>{label}</div>
              <b style={colour?{color:`var(--${colour})`}:null}>{val}</b>
            </div>)}
        </div>

        {quorum.state!=='none' && <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            <h2 style={{flex:1,margin:0}} className="mtgd-h">Quorum Rules</h2>
            <Tag c={QUORUM_TAG[quorum.state][0]}>{QUORUM_TAG[quorum.state][1]}</Tag>
          </div>
          <div className="cs-rule">✓ Min {quorum.need} of {quorum.total} required ({quorum.threshold}%)</div>
          <div style={{fontSize:12,color:'var(--ink-2)',marginTop:8}}>{quorumLine(quorum)}</div>
          <div className="csub" style={{marginTop:6,marginBottom:0}}>
            Threshold {quorum.threshold}% of Required Attendees, from the Setup. The same count scores AG-08.
            {S.delegatedAttend==='exclude' ? ' Attendance by a delegate is not counted.'
              : S.delegatedAttend==='half' ? ' Attendance by a delegate counts as half.'
              : ' Attendance by a delegate counts in full.'}</div>
        </div>}

        {(prevOcc || carriedIn.length>0) && <div className="card">
          <h2>Carried forward</h2>
          <div className="csub">{prevOcc
            ? <>From the previous meeting of this Setup: <b>{prevOcc.name}</b>, {fmtD(prevOcc.date)}.</>
            : 'From an earlier occurrence.'}</div>
          {carriedIn.length>0 && <>
            <div className="t-sub" style={{fontWeight:600,marginTop:6}}>Already on this agenda</div>
            {carriedIn.map(a=><div key={a.id} style={{fontSize:12.5,padding:'3px 0'}}>↪ {a.title}</div>)}
          </>}
          {carryWaiting.length>0 && <>
            <div className="t-sub" style={{fontWeight:600,marginTop:8}}>Not covered last time, not carried yet</div>
            {carryWaiting.map(a=><div key={a.id} style={{display:'flex',gap:8,alignItems:'center',padding:'3px 0'}}>
              <span style={{flex:1,fontSize:12.5}}>{a.title}</span>
              <Btn k="sm" disabled={carrying} onClick={()=>carryIn([a])}>Carry in</Btn></div>)}
            {carryWaiting.length>1 &&
              <Btn k="sm pri" disabled={carrying} style={{marginTop:6}} onClick={()=>carryIn(carryWaiting)}>
                {carrying?'Carrying…':`Carry all ${carryWaiting.length}`}</Btn>}
          </>}
          {prevOcc && <>
            <div className="t-sub" style={{fontWeight:600,marginTop:8}}>Open decisions from that meeting</div>
            {prevOpenDecisions.length
              ? prevOpenDecisions.map(d=><div key={d.id} style={{display:'flex',gap:8,alignItems:'baseline',padding:'3px 0'}}>
                  <span style={{flex:1,fontSize:12.5}}>{d.name}</span>
                  {d.status?<Tag c={d.status==='Escalated'?'amber':'grey'}>{d.status}</Tag>:null}</div>)
              : <div className="t-sub">None open.</div>}
            <div className="t-sub" style={{marginTop:6}}>Open tasks can't be carried yet: a task has no link to a
              meeting in IT.</div>
          </>}
        </div>}

        <div className="card">
          <h2>Terms of Reference or Policy</h2>
          <div className="csub">Mandatory for an Accreditation Committee, optional for a Business Meeting.
            Retrieved from the approved Setup and read-only here.</div>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,
                       background:'var(--grey-bg)',border:'1px solid var(--border)'}}>
            <span aria-hidden="true">🔒</span>
            <span>{tpl&&tpl.torLink
              ? tpl.torLink
              : rec.templateId
                ? (accred ? 'Required for this Setup Type, and none is held.' : 'Optional for this Setup Type, and none is held.')
                : 'No Terms of Reference or Policy is linked to this occurrence.'}</span>
          </div>
        </div>

        <div className="card">
          <h2>What this occurrence produces</h2>
          <div className="csub">Outputs generated from the occurrence and its recorded child rows.</div>
          <div className="lp-produced">
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>MEETING MINUTES</label>
                <div>{rec.status==='Held' ? 'Created when the Meeting is held.' : 'Created when the Meeting is held.'}</div></div>
            </div>
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>AGENDA ITEMS</label>
                <div>{rec.agenda.length ? `${rec.agenda.length} recorded Agenda Item${rec.agenda.length===1?'':'s'}.` : 'No Agenda Item recorded.'}</div></div>
            </div>
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>GOVERNANCE AUDIT GRID</label>
                <div>Not created for live Dataverse occurrences in this view.</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>}

    {tab==='agenda' && <Note k="info">{rec.agendaSent
      ? <>Agenda distributed on <b>{fmtD(rec.agendaSent)}</b>{rec.date?<> for the meeting on {fmtD(rec.date)}</>:null}.</>
      : rec.status==='Scheduled'
        ? <>The agenda has not been distributed yet. Record it once it is sent, so the agenda lead time (AG-03) can be measured.</>
        : <>No distribution was recorded for this agenda.</>}</Note>}
    {tab==='agenda' && <div className="card flush">
      <div className="card-hd mtgd-hd">
        <span className="cs-icon gold" aria-hidden="true"><ListOrdered size={15}/></span>
        <h2>Meeting Agenda</h2>
        <span className="cs-mono mtgd-count">{rec.agenda.length} item{rec.agenda.length===1?'':'s'}{durMin!=null?' · '+durMin+' min total':''}</span>
        {rec.status==='Held' && <Tag c={covered<rec.agenda.length?'amber':'green'}>
          {covered} of {rec.agenda.length} covered</Tag>}
        {rec.status==='Scheduled' && (rec.agendaSent
          ? <Tag c="green">Distributed {fmtDS(rec.agendaSent)}</Tag>
          : <Btn k="sm" disabled={sendingAgenda||!rec.agenda.length} onClick={sendAgenda}>
              {sendingAgenda?'Recording…':'Record distribution'}</Btn>)}
        {rec.status==='Scheduled' &&
          <Btn k="sm" onClick={()=>setAddingAgenda(v=>!v)}>{addingAgenda?'Close':'+ Add item'}</Btn>}
      </div>

      {addingAgenda && <div style={{display:'flex',gap:8,padding:'0 17px 14px'}}>
        <input type="text" value={newAgendaTitle} onChange={e=>setNewAgendaTitle(e.target.value)}
          placeholder="New Agenda item" style={{flex:1}}
          onKeyDown={e=>{ if(e.key==='Enter') addAgendaItem(); }}/>
        <Btn k="pri" disabled={!newAgendaTitle.trim()||savingAgenda} onClick={addAgendaItem}>
          {savingAgenda?'Adding…':'Add'}</Btn>
      </div>}

      {rec.agenda.length===0
        ? <div style={{padding:'8px 17px 17px'}}><Empty>
            No Agenda Item on this occurrence. A Meeting cannot proceed without one.</Empty></div>
        : <div className="t-wrap"><table className="data">
            <thead><tr><th style={{width:50}}>#</th><th>Topic</th><th>Presenter</th>
              <th>Status</th>{rec.status==='Scheduled' && <th></th>}</tr></thead>
            <tbody>{rec.agenda.slice().sort((a,b)=>(a.seq||0)-(b.seq||0)).map((a,i,arr)=>
              <tr key={a.id}>
                <td className="cs-mono dim">{a.seq??i+1}</td>
                <td><div className="t-main">{a.title||'—'}</div>
                  <div className="t-sub">{a.carriedFromId ? 'Carried forward from the last meeting' : (a.source||'Standing item')}</div></td>
                <td className="dim">{posName(a.ownerPositionId)||'—'}</td>
                <td>{rec.status==='Held'
                  ? <Tag c={a.covered==='Yes'?'green':a.covered==='No'?'red':'grey'}>
                      {a.covered==='Yes'?'Covered':a.covered==='No'?'Not covered':'Not recorded'}</Tag>
                  : a.ownerPositionId ? <Tag c="green">Ready</Tag> : <Tag c="amber">Awaiting owner</Tag>}</td>
                {rec.status==='Scheduled' && <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <Btn k="sm" disabled={agendaBusyId||i===0} onClick={()=>moveAgendaItem(a,-1)}>↑</Btn>
                  <Btn k="sm" disabled={agendaBusyId||i===arr.length-1} onClick={()=>moveAgendaItem(a,1)}>↓</Btn>
                  <Btn k="sm" disabled={agendaBusyId} onClick={()=>removeAgendaItem(a.id)}>
                    {agendaBusyId===a.id?'…':'Remove'}</Btn>
                </td>}
              </tr>)}
            </tbody></table></div>}
    </div>}

    {tab==='att' && <div className="cs-two-col mtgd-cols">
    <div className="card flush">
      <div className="card-hd mtgd-hd">
        <span className="cs-icon green" aria-hidden="true"><Users size={15}/></span>
        <h2>Member Attendance</h2>
        <span className="cs-mono mtgd-count">{rec.attendees.length} member{rec.attendees.length===1?'':'s'}</span>
        {rec.status==='Held' && <Tag c={requiredPresent<required.length?'amber':'green'}>
          {requiredPresent} of {required.length} Required present</Tag>}
        {quorum.state!=='none' && quorum.state!=='pending' &&
          <Tag c={QUORUM_TAG[quorum.state][0]}>{QUORUM_TAG[quorum.state][1]}</Tag>}
      </div>
      {quorum.state!=='none' &&
        <div style={{padding:'0 17px 10px',fontSize:12,color:'var(--muted)'}}>{quorumLine(quorum)}</div>}
      {rec.status!=='Held' &&
        <div style={{padding:'0 17px 12px',fontSize:12,color:'var(--muted)'}}>
          Attendance is recorded after the meeting is held — mark it Held above to enable this.</div>}
      {rec.attendees.length===0
        ? <div style={{padding:'8px 17px 17px'}}><Empty>No Attendee on this occurrence.</Empty></div>
        : <div className="t-wrap"><table className="data">
            <thead><tr><th>Member</th><th>Role</th><th>Type</th><th>Delegate</th><th>Attendance</th></tr></thead>
            <tbody>{rec.attendees.map((a,i)=>{
              const who = (a.positionId && DV_POS_HOLDER[a.positionId]) || a.name || dvPos(a.positionId) || '—';
              const role = a.positionId===rec.chairPositionId ? 'Chair'
                : a.positionId===rec.facilitatorPositionId ? 'Facilitator' : (a.type||'Required');
              return <tr key={a.id}>
                <td><div className="mtgd-member">
                  <span className={'mtgd-av'+(i%2?' g':'')} aria-hidden="true">
                    {String(who).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</span>
                  <span className="t-main">{who}</span></div></td>
                <td className="dim">{dvPos(a.positionId)||'—'}</td>
                <td><Tag c={role==='Chair'?'amber':role==='Facilitator'?'teal':role==='Optional'?'grey':'blue'}>{role}</Tag></td>
                <td className="dim" style={{fontSize:12}}>{posName(a.delegatePositionId)||'—'}</td>
                <td>{rec.status==='Held'
                  ? <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <Tag c={a.present==='Present'?'green':a.present==='Absent'?'red':'grey'}>
                        {a.present||'Not Yet Recorded'}</Tag>
                      <Btn k="sm" disabled={attSavingId===a.id||a.present==='Present'}
                        onClick={()=>setAttendance(a.id,'Present')}>Present</Btn>
                      <Btn k="sm" disabled={attSavingId===a.id||a.present==='Absent'}
                        onClick={()=>setAttendance(a.id,'Absent')}>Absent</Btn>
                    </div>
                  : <Tag c={a.present==='Present'?'green':a.present==='Absent'?'red':'grey'}>
                      {a.present&&a.present!=='Not Yet Recorded'?a.present:'Pending'}</Tag>}</td>
              </tr>;})}
            </tbody></table></div>}
      <div style={{padding:'10px 17px 15px',fontSize:12,color:'var(--muted)'}}>
        Only Required Attendee attendance is measured. Optional attendance is recorded but not counted.</div>
    </div>
    <div className="cs-side mtgd-side">
      <section className="card mtgd-quorum" aria-labelledby="mtgd-qc">
        <h2 id="mtgd-qc" className="mtgd-h">Quorum Calculation</h2>
        {quorum.state==='none'
          ? <p className="t-sub" style={{margin:0}}>This meeting’s Setup sets no quorum threshold.</p>
          : <div className="cs-rule">✓ Min {quorum.need} of {quorum.total} required members ({quorum.threshold}%)</div>}
        <div className="mtgd-qbar">
          <span className="mtgd-bar" aria-hidden="true"><i style={{width:(required.length?requiredPresent/required.length*100:0)+'%'}}/></span>
          <span className="cs-mono mtgd-count">{requiredPresent}/{required.length}</span>
        </div>
        <p className="t-sub" style={{margin:'4px 0 0'}}>{rec.status==='Held'
          ? (quorum.state!=='none' ? quorumLine(quorum) : `${requiredPresent} of ${required.length} Required present.`)
          : 'Attendance not yet taken.'}</p>
        <div className="mtgd-qnums">
          <div><b>{required.length}</b><span>Required</span></div>
          <div><b>{rec.attendees.length-required.length}</b><span>Optional</span></div>
          <div><b className={rec.status==='Held'?'':'muted'}>{present}</b><span>Present</span></div>
        </div>
      </section>
      <section className="card" aria-labelledby="mtgd-hist">
        <h2 id="mtgd-hist" className="mtgd-h">Attendance History</h2>
        {attHistory.length===0
          ? <p className="t-sub" style={{margin:0}}>{rec.templateId ? 'No earlier held meeting of this Setup.' : 'An ad hoc meeting has no history.'}</p>
          : <div className="mtgd-kv">{attHistory.map(({o,a})=>
              <div key={o.id}><span>{fmtP((o.date||'').slice(0,7))}</span>
                <b className={'cs-mono '+(a.pct>=80?'':'mtgd-warn')}>{a.present}/{a.total} ({Math.round(a.pct)}%)</b></div>)}</div>}
      </section>
    </div>
    </div>}

    {tab==='minutes' && <>
      {govLoading && <div className="card"><Empty>Reading minutes…</Empty></div>}
      {!govLoading && !minutes &&
        <div className="card"><Empty ic="📝">No Minutes row exists for this occurrence.</Empty>
          <div style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'0 17px 14px'}}>
            Minutes are opened automatically when the Meeting is marked Held.</div></div>}
      {!govLoading && minutes &&
        <DvMinutesBody rec={rec} minutes={minutes} accred={accred} grids={grids}
          posName={posName} onReload={reloadGovernance}
          tasks={mtgTasks} onTasksChanged={()=>setTasksTick(t=>t+1)}/>}
    </>}

    {tab==='grid' && <>
      {govLoading && <div className="card"><Empty>Reading the Audit Grid…</Empty></div>}
      {!govLoading && grids.length===0 &&
        <div className="card"><Empty ic="▦">No Audit Grid Instance exists for this occurrence.</Empty>
          <div style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'0 17px 14px'}}>
            An Instance is created on closure of a Committee occurrence's Minutes.</div></div>}
      {!govLoading && grids.length>0 &&
        <DvGridBody rec={rec} grid={grids[0]} olderVersions={grids.slice(1)} minutes={minutes}
          quorumPct={tpl?.quorumPct} torLink={tpl?.torLink} accred={accred} S={S} posName={posName}
          dvMeetingOccs={dvMeetingOccs} onReload={reloadGovernance}/>}
    </>}

    {tab==='actions' && <div className="cs-two-col mtgd-cols">
      <div className="card flush">
        <div className="card-hd mtgd-hd">
          <span className="cs-icon green" aria-hidden="true"><ListChecks size={15}/></span>
          <h2>Action Items</h2>
          <span className="cs-mono mtgd-count">{actions.length} item{actions.length===1?'':'s'}
            {actions.some(x=>x.from==='prev') ? ` · ${actions.filter(x=>x.from==='prev').length} from the previous meeting` : ''}</span>
        </div>
        {mtgTasks===null &&
          <div style={{padding:'0 17px'}}><Note k="warn">Tasks can’t be shown in this environment yet: a task has no
            link to a meeting here (IT is adding <code>lm_MeetingOccurrenceAgenda</code> on tasks). Decisions are shown.</Note></div>}
        {mtgTasks===undefined
          ? <div style={{padding:'8px 17px 17px'}}><Empty ic="…">Reading this meeting’s actions…</Empty></div>
          : actions.length===0
          ? <div style={{padding:'8px 17px 17px'}}><Empty>No decision or task is linked to this meeting yet. Raise
              them from the Minutes, per agenda item.</Empty></div>
          : <div className="t-wrap"><table className="data">
              <thead><tr><th>Action</th><th>Owner</th><th>Source</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>{actions.map(x=><tr key={x.key}>
                <td><div className="t-main">{x.title}</div>
                  <div className="t-sub">{x.kind}{x.sub?' · '+(x.sub.length>90?x.sub.slice(0,90)+'…':x.sub):''}</div></td>
                <td className="dim">{x.owner||'—'}</td>
                <td className="dim">{x.source||'—'}</td>
                <td className={'cs-mono '+(x.state==='overdue'?'mtgd-bad':'dim')}>{x.due?fmtDS(x.due):'—'}</td>
                <td><Tag c={x.state==='done'?'green':x.state==='overdue'?'red':x.state==='progress'?'teal':'grey'}>
                  {x.state==='overdue'?'Overdue':x.status}</Tag></td>
                <td style={{textAlign:'right'}}>{x.kind==='Task'
                  ? <OpenRecord kind="Task" id={x.id} label="Open ↗" asLink/>
                  : <a role="button" tabIndex={0} className="mtgd-more" style={{margin:0,display:'inline'}}
                      onClick={()=>setTab('minutes')} onKeyDown={e=>{ if(e.key==='Enter') setTab('minutes'); }}>Minutes</a>}</td>
              </tr>)}
              </tbody></table></div>}
      </div>
      <div className="cs-side mtgd-side">
        <section className="card" aria-labelledby="mtgd-as">
          <h2 id="mtgd-as" className="mtgd-h">Action Summary</h2>
          <div className="mtgd-kv">
            {[['Total actions', actions.length, ''],
              ['Decisions', actions.filter(x=>x.kind==='Decision').length, ''],
              ['Tasks', mtgTasks===null ? '—' : actions.filter(x=>x.kind==='Task').length, ''],
              ['In progress', actionCount('progress'), ''],
              ['Not started', actionCount('open'), ''],
              ['Overdue', actionCount('overdue'), actionCount('overdue')?'mtgd-bad':''],
              ['Done', actionCount('done'), ''],
             ].map(([k,v,c])=><div key={k}><span>{k}</span><b className={'cs-mono '+c}>{v}</b></div>)}
          </div>
        </section>
      </div>
    </div>}

    {tab==='inputs' && <Note k="info">Meeting input readiness minimum (OD-39): every input must reach at
      least <b>{needApproved?'Approved':'In Review (submitted)'}</b> before the meeting.
      {' '}Inputs are the reports linked on the Documents tab{rec.templateId
        ? ', plus the Input reports this meeting\'s Setup names' : ''}.</Note>}
    {tab==='inputs' && <div className="card flush">
      <div className="card-hd mtgd-hd">
        <span className="cs-icon gold" aria-hidden="true"><Upload size={15}/></span>
        <h2>Pre-Meeting Submissions</h2>
        <span className="mtgd-bar" aria-hidden="true"><i style={{width:(submissions.length?readyCount/submissions.length*100:0)+'%'}}/></span>
        <span className="cs-mono mtgd-count">{readyCount}/{submissions.length}</span>
      </div>
      {docsLoading ? <div style={{padding:'8px 17px 17px'}}><Empty ic="…">Reading inputs…</Empty></div>
      : submissions.length===0
        ? <div style={{padding:'8px 17px 17px'}}><Empty>No input is linked, and the Setup names none.</Empty></div>
      : <div className="t-wrap"><table className="data">
          <thead><tr><th>Submission</th><th>Owner</th><th>Report Template</th><th>Period</th><th>Status</th><th></th></tr></thead>
          <tbody>{submissions.map(x=><tr key={x.key}>
            <td><div className="t-main">{x.name}</div>
              <div className="t-sub">{x.required?'Required by the Setup':'Linked to this meeting'}</div></td>
            <td className="dim">{x.occ?.creatorPositionId ? posName(x.occ.creatorPositionId) : '—'}</td>
            <td className="dim">{dvRptTpl(x.tplId)||'—'}</td>
            <td className="dim">{x.occ?fmtP(x.occ.period):'—'}</td>
            <td>{x.ready ? <Tag c="green">{RPT_STATUS_WORD(x.status)}</Tag>
              : x.occ ? <Tag c={x.occ.status==='Returned'||x.occ.status==='Rejected'?'red':'amber'}>{RPT_STATUS_WORD(x.status)}</Tag>
              : <Tag c="red">{x.status}</Tag>}</td>
            <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
              {x.occ
                ? <Btn k="sm" onClick={()=>openDvRec('Report',x.occ)}>Open</Btn>
                : x.link
                ? (x.link.reportTemplateId && !x.link.reportOccurrenceId
                    ? <Btn k="sm" onClick={()=>{ setAttachFor(x.link.id); setAttachAll(false); setTab('docs'); }}>
                        Attach an occurrence</Btn> : null)
                : x.tplId
                ? <Btn k="sm" onClick={()=>{ setLinkTplId(x.tplId); setShowAll(false); setTab('docs'); }}>Link it</Btn>
                : null}</td>
          </tr>)}
          </tbody></table></div>}
    </div>}

    {tab==='docs' && <div className="card flush">
      <div className="card-hd mtgd-hd">
        <span className="cs-icon gold" aria-hidden="true"><Paperclip size={15}/></span>
        <h2>Meeting Documents</h2>
        <span className="cs-mono mtgd-count">{docs?docs.length:0} linked</span>
      </div>
      <div style={{padding:'8px 17px 17px'}}>
        {docsLoading ? <Empty ic="…">Reading linked documents…</Empty> : <>
          {!docs || docs.length===0
            ? <Empty>No document is linked to this occurrence yet.</Empty>
            : <table className="data" style={{marginBottom:16}}>
                <thead><tr><th>Document</th><th>Report Occurrence</th><th>Report Template</th>
                  <th>Linked</th><th></th></tr></thead>
                <tbody>{docs.map(d=>{
                  const occ = d.reportOccurrenceId ? dvReportOccs.find(r=>r.id===d.reportOccurrenceId) : null;
                  /* Three states, not two: an occurrence that loaded, one that
                     is linked but not in the loaded set, and none at all. The
                     middle one used to read as the last, which denied a link
                     that exists. */
                  const attachable = !d.reportOccurrenceId && d.reportTemplateId;
                  const open = attachFor===d.id;
                  const opts = attachable ? occsForTemplate(d.reportTemplateId, !attachAll) : [];
                  const outside = attachable
                    ? occsForTemplate(d.reportTemplateId,false).length
                      - occsForTemplate(d.reportTemplateId,true).length : 0;
                  return <React.Fragment key={d.id}>
                    <tr>
                    <td><div className="t-main">{d.name}</div></td>
                    <td>{occ
                      ? <a onClick={()=>openDvRec('Report',occ)}>{occ.name} · {fmtP(occ.period)}</a>
                      : d.reportOccurrenceId
                      ? <><div className="t-main">{d.name}</div>
                          <div className="t-sub">Linked, but this occurrence is not in the loaded set.</div></>
                      : <span className="dim">— no occurrence linked —</span>}</td>
                    <td className="dim">{dvRptTpl(d.reportTemplateId)||'—'}</td>
                    <td className="dim">{d.created?fmtD(d.created.slice(0,10)):'—'}</td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      {attachable
                        ? <Btn k="sm" onClick={()=>{ setAttachFor(open?null:d.id); setAttachAll(false); }}>
                            {open?'Cancel':'Attach an occurrence'}</Btn>
                        : null}{' '}
                      <Btn k="sm" disabled={unlinkingId===d.id} onClick={()=>onUnlinkDoc(d.id)}>
                        {unlinkingId===d.id?'Removing…':'Remove'}</Btn></td>
                    </tr>
                    {open ? <tr><td colSpan={5} style={{background:'var(--surface)'}}>
                      <div className="csub" style={{marginBottom:8}}>
                        Occurrences of <b>{dvRptTpl(d.reportTemplateId)||'this Template'}</b>
                        {attachAll ? ' — every one, whatever its scope.'
                          : ` in this Meeting's own scope.`}
                      </div>
                      {opts.length===0
                        ? <Note k="info" ic="i">
                            {attachAll
                              ? 'This Template has no Report Occurrence at all yet.'
                              : outside>0
                              ? <>None in this Meeting's scope. {outside} exist{outside===1?'s':''} elsewhere
                                  — show them below to attach one anyway.</>
                              : 'This Template has no Report Occurrence yet.'}
                          </Note>
                        : opts.map(o=>
                            <div key={o.id} className="sched-r" style={{cursor:'default'}}>
                              <div className="sched-t"><div className="n">{o.name}</div>
                                <div className="m">{fmtP(o.period)} · {o.status}</div></div>
                              <Btn k="sm pri" disabled={attaching} onClick={()=>onAttachOcc(d,o)}>
                                {attaching?'Attaching…':'Attach'}</Btn>
                            </div>)}
                      {!attachAll && outside>0
                        ? <Btn k="sm" style={{marginTop:8}} onClick={()=>setAttachAll(true)}>
                            Show all {outside+opts.length} occurrences of this Template</Btn>
                        : null}
                    </td></tr> : null}
                  </React.Fragment>;})}
                </tbody></table>}

          <div className="card">
            <h3 style={{fontSize:13,marginBottom:2}}>Link a document by Report Template</h3>
            <div className="csub" style={{marginBottom:10}}>
              Choose a Report Template. A live Report Occurrence for the same Template,
              this Meeting's own {rec.businessUnitId?'Business Unit':rec.regionId?'Region':'scope'}
              {meetingDeptIds.size>0 ? ' and Department' : ''} is offered if one exists —
              otherwise the Template alone can be linked, and the occurrence added later.
            </div>
            <select value={linkTplId} onChange={e=>{setLinkTplId(e.target.value); setShowAll(false);}}>
              <option value="">Choose a Report Template…</option>
              {DV_RPT_TPL_LIST.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {linkTplId ? (matchingOccs.length>0
              ? <div style={{marginTop:10}}>
                  <div className="t-sub" style={{marginBottom:6}}>
                    {matchingOccs.length} matching occurrence{matchingOccs.length===1?'':'s'} found.</div>
                  {matchingOccs.map(o=>
                    <div key={o.id} className="sched-r" style={{cursor:'default'}}>
                      <div className="sched-t"><div className="n">{o.name}</div>
                        <div className="m">{fmtP(o.period)} · {o.status}</div></div>
                      <Btn k="sm pri" disabled={linking} onClick={()=>onLinkDoc(o)}>
                        {linking?'Linking…':'Link'}</Btn>
                    </div>)}
                </div>
              : <div style={{marginTop:10}}>
                  <Note k="info" ic="i">{outsideScope>0
                    ? <>No Report Occurrence of this Template is in this Meeting's own scope.
                        {' '}{outsideScope} exist{outsideScope===1?'s':''} elsewhere.</>
                    : <>This Template has no Report Occurrence yet.</>}</Note>
                  {outsideScope>0
                    ? <Btn k="sm" style={{marginTop:8,marginRight:6}} onClick={()=>setShowAll(true)}>
                        Show all {outsideScope} — attach one anyway</Btn>
                    : null}
                  <Btn k="sm" style={{marginTop:8}} disabled={linking} onClick={()=>onLinkDoc(null)}>
                    {linking?'Linking…':'Link the Template only — add the occurrence later'}</Btn>
                </div>
            ) : null}
          </div>

          {/* Ad hoc meetings: link any Report Occurrence straight away -- a Draft
              or a Custom report included. It counts on the Submissions tab, and
              becomes submitted there the moment its author submits it. */}
          {(rec.adhocType || !rec.templateId) && <div className="card">
            <h3 style={{fontSize:13,marginBottom:2}}>Link a report directly</h3>
            <div className="csub" style={{marginBottom:10}}>
              For an ad hoc meeting: any report or plan, whatever its status — a Draft included, and Custom
              reports that have no Template. It shows on the <b>Submissions</b> tab, and counts as submitted there
              once its author submits it for review.
            </div>
            <ReportLinkPicker reports={dvReportOccs} busy={linking}
              taken={new Set((docs||[]).map(d=>d.reportOccurrenceId).filter(Boolean))}
              place={{businessUnitId:rec.businessUnitId, regionId:rec.regionId, departmentId:rec.departmentId}}
              onPick={async r=>{
                setLinking(true);
                try{
                  const {id,errors} = await linkMeetingOccurrenceReport({
                    meetingOccurrenceId: rec.id, reportOccurrenceId: r.id,
                    reportTemplateId: r.templateId || undefined, name: r.name });
                  if(!id){
                    console.warn('[dataverse] linkMeetingOccurrenceReport() failed:', errors);
                    toast('Not linked','Linking this report failed. Check the console for details.','err');
                    return;
                  }
                  toast('Report linked', `${r.name} is linked${r.status==='Draft'?' — still a Draft, not submitted yet':''}.`,'ok');
                  await reloadDocs();
                }finally{ setLinking(false); }
              }}/>
          </div>}
        </>}
      </div>
    </div>}
  </div>;
}

/* Report Submission detail — the full page, read from lm_reportoccurrences.
   Modelled on DvMeetingDetail above: read-only, and the review chain (which
   step approves next) is read from the linked Report Template's per-unit
   row, the same way a Meeting Template's Chairman/Facilitator are. */
function DvReportDetail({rec,back}){
  const {toast,refreshOccurrences}=use();
  const pos = id => { const n=dvPos(id); if(!n) return null;
    const h=id&&DV_POS_HOLDER[id]; return h?`${n} — ${h}`:n; };
  const [tplDetail,setTplDetail]=useState(null);
  const [tplLoading,setTplLoading]=useState(false);
  const [fileUrlInput,setFileUrlInput]=useState('');
  const [savingFile,setSavingFile]=useState(false);
  const [history,setHistory]=useState([]);
  const [histLoading,setHistLoading]=useState(true);
  const [busy,setBusy]=useState(null);
  const [rmi,setRmi]=useState(false);

  const reloadHistory = useCallback(async ()=>{
    const h = await fetchReportOccurrenceHistory(rec.id).catch(e=>{
      console.warn('[dataverse] fetchReportOccurrenceHistory() failed:', e); return []; });
    setHistory(h||[]);
  },[rec.id]);

  useEffect(()=>{
    let cancelled=false;
    setHistLoading(true);
    fetchReportOccurrenceHistory(rec.id)
      .then(h=>{ if(!cancelled) setHistory(h||[]); })
      .catch(e=>console.warn('[dataverse] fetchReportOccurrenceHistory() failed:', e))
      .finally(()=>{ if(!cancelled) setHistLoading(false); });
    return ()=>{cancelled=true;};
  },[rec.id]);

  /* Shared shape for the three review transitions: run it, report honestly,
     then re-read both the occurrence and its history so the panel reflects
     Dataverse rather than what the UI hoped it wrote. */
  const runReview = async (key, fn, okTitle, okMsg) => {
    setBusy(key);
    try{
      const {id,errors} = await fn();
      if(!id){
        console.warn('[dataverse] '+key+' failed:', errors);
        toast('Not saved','That review step could not be saved. Check the console.','err');
        return;
      }
      if(errors && errors.length)
        console.warn('[dataverse] '+key+' succeeded but history was not written:', errors);
      toast(okTitle, okMsg, 'ok');
      await Promise.all([refreshOccurrences(), reloadHistory()]);
    }catch(e){
      console.warn('[dataverse] '+key+' threw:', e);
      toast('Not saved','That review step could not be saved. Check the console.','err');
    }finally{ setBusy(null); }
  };

  const submitReport = () => runReview('submit',
    ()=>submitReportOccurrence(rec.id, { actorPositionId: rec.creatorPositionId || undefined }),
    'Submitted for review','It now sits with the first configured reviewer.');

  const approveStep = () => {
    const step = rec.reviewStep ?? 0;
    const total = reviewChain.length;
    const final = step + 1 >= total;
    return runReview('approve',
      ()=>approveReportStep(rec.id, { currentStep: step, totalSteps: total,
        actorPositionId: reviewChain[step]?._lm_reviewerposition_value || undefined }),
      final ? 'Report approved' : 'Step approved',
      final ? 'The final reviewer has approved. The Report Submission is locked.'
            : `Routed to reviewer ${step + 2} of ${total}.`);
  };

  useEffect(()=>{
    if(!rec.templateId){ setTplDetail(null); return; }
    let cancelled=false;
    setTplLoading(true);
    fetchReportTemplateDetail(rec.templateId)
      .then(d=>{ if(!cancelled) setTplDetail(d); })
      .catch(e=>console.warn('[dataverse] fetchReportTemplateDetail() failed:', e))
      .finally(()=>{ if(!cancelled) setTplLoading(false); });
    return ()=>{cancelled=true;};
  },[rec.templateId]);

  // The review chain is scoped to whichever Business Unit or Region this
  // occurrence actually belongs to -- a Report Template approved for
  // several units can name a different reviewer chain in each one.
  const unit = tplDetail
    ? (tplDetail.businessUnits||[]).find(b=>b._lm_businessunit_value===rec.businessUnitId)
      || (tplDetail.regions||[]).find(r=>r._lm_region_value===rec.regionId)
    : null;
  const reviewChain = unit
    ? (unit.reviewChain||[]).slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0)) : [];

  const saveFileUrl = async url => {
    if(url.length>FILE_URL_MAX){
      toast('Too long',`This field allows at most ${FILE_URL_MAX} characters — this is ${url.length}.`,'err');
      return;
    }
    setSavingFile(true);
    try{
      const {id,errors} = await updateReportOccurrenceFile(rec.id, url);
      if(!id){
        console.warn('[dataverse] updateReportOccurrenceFile() failed:', errors);
        toast('Not saved','Setting the file URL failed. Check the console for details.','err');
        return;
      }
      toast('File recorded','Saved to lm_FileURL on this Report Submission.','ok');
      setFileUrlInput('');
      await refreshOccurrences();
    }catch(e){
      console.warn('[dataverse] updateReportOccurrenceFile() threw unexpectedly:', e);
      toast('Not saved','Setting the file URL failed. Check the console for details.','err');
    }finally{ setSavingFile(false); }
  };

  // Reads the workbook client-side (same proof-of-concept as the create
  // form) and, since picking a file here means attaching it, records its
  // name to lm_FileURL the same way a typed URL would be.
  const onPickExcel = async file => {
    try{ await readExcelComponents(file); }
    catch(e){ console.warn('[Excel] read failed:', e); }
    await saveFileUrl(file.name);
  };

  const tplRow = dvRptTplDetail(rec.templateId);
  const statusColour = rec.status==='Approved' ? 'green' : rec.status==='Rejected' ? 'red'
    : rec.status==='Returned' ? 'amber' : rec.status==='In Review' ? 'teal' : 'grey';

  return <>
    <div className="crumb"><a onClick={back}>Reports</a> › <b>Report Detail</b></div>
    <div className="ph ph-row">
      <div style={{flex:1}}><h1>{rec.name}{rec.period?` — ${fmtP(rec.period)}`:''}</h1>
        <div className="sub" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Tag c={statusColour}>{rec.status||'—'}</Tag>
          <span>· {dvRptTpl(rec.templateId)||(rec.noSetupFlag?'Ad Hoc — no approved Setup':'Ad Hoc')}</span>
          <span>· {dvBu(rec.businessUnitId)||dvRegion(rec.regionId)||'Group-wide'}</span>
          {rec.locked && <Tag c="grey">🔒 Locked</Tag>}
        </div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn onClick={back}>Back to List</Btn>
      </div>
    </div>

    <Note k="lock" ic="—">Read-only, except the file below — this is the Dataverse record as it stands.
      Reviewing and approving are not wired to this table yet.</Note>
    {rec.noSetupFlag && <Note k="warn"><b>No approved Setup.</b> This Report's metadata is queued for
      Taxonomy with a No-Setup flag — review proceeds on this record regardless.</Note>}
    {rec.locked && <Note k="lock"><b>Approved and locked.</b> The file URL, version and complete
      approval history are retained. A correction is made through a new version, never an in-place
      edit.</Note>}

    <div className="wa-grid">
      <div>
        <div className="card">
          <h2>Report Information</h2>
          <KVBlock items={[
            ['Period', rec.period?fmtP(rec.period):'—'],
            ['Setup', dvRptTpl(rec.templateId)
              ||(rec.templateId?'(not in the loaded list)':(rec.noSetupFlag?'Ad Hoc — no approved Setup':'Ad Hoc'))],
            ['Department', dvDept(rec.departmentId)||'—'],
            ['Creator', pos(rec.creatorPositionId)||'—'],
          ]}/>
        </div>

        {rec.objective && <div className="card">
          <h2>Objective</h2>
          <p style={{fontSize:12.5,lineHeight:1.55,margin:0}}>{rec.objective}</p>
        </div>}

        <div className="card">
          <h2>Attachments</h2>
          {rec.fileUrl
            ? <div className="att-row">
                <div className="att-ic">📄</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="t-main" style={{fontSize:12.5}}>{rec.name}</div>
                  {/^https?:\/\//i.test(rec.fileUrl)
                    ? <a className="t-sub mono" style={{fontSize:10.5}} href={rec.fileUrl}
                        target="_blank" rel="noreferrer">{rec.fileUrl}</a>
                    : <div className="t-sub mono" style={{fontSize:10.5}}>{rec.fileUrl}</div>}
                </div>
              </div>
            : <Empty ic="📄">No file URL recorded on this Report Submission.</Empty>}

          <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
            <Field label={rec.fileUrl?'Replace the working copy':'Attach a working copy'}
              hint="Reads the workbook in your browser and logs its sheets and named ranges to the
                console (proof of concept) — then records the file name to lm_FileURL. No file
                storage is wired yet, so only the name is saved, not the file's contents.">
              <input type="file" accept=".xlsx,.xls" disabled={savingFile}
                onChange={e=>{ const file=e.target.files?.[0]; e.target.value='';
                  if(file) onPickExcel(file); }}/>
            </Field>
            <Field label="Or set the file URL directly"
              hint={`If the working copy already lives somewhere — SharePoint, Teams, etc. Max ${FILE_URL_MAX} characters.`}
              err={fileUrlInput.trim().length>FILE_URL_MAX
                ? `${fileUrlInput.trim().length} characters — ${FILE_URL_MAX} max.` : null}>
              <div style={{display:'flex',gap:8}}>
                <input type="text" value={fileUrlInput} onChange={e=>setFileUrlInput(e.target.value)}
                  placeholder="https://…" disabled={savingFile}/>
                <Btn k="pri"
                  disabled={savingFile||!fileUrlInput.trim()||fileUrlInput.trim().length>FILE_URL_MAX}
                  onClick={()=>saveFileUrl(fileUrlInput.trim())}>{savingFile?'Saving…':'Save'}</Btn>
              </div>
            </Field>
          </div>
        </div>
      </div>

      <div className="wa-side">
        <div className="card">
          <h2>Review Progress</h2>
          {!rec.templateId
            ? <div className="csub" style={{marginBottom:0}}>No Report Template is linked, so there is
                no configured review chain to show.</div>
            : tplLoading
              ? <div className="csub" style={{marginBottom:0}}>Reading the review chain from Dataverse…</div>
              : reviewChain.length===0
                ? <Empty>No review chain configured for this Report's Business Unit or Region.</Empty>
                : reviewChain.map((r,i)=>{
                    const st = rec.status==='Approved' || (rec.reviewStep!=null && i<rec.reviewStep) ? 'Approved'
                      : rec.status==='In Review' && rec.reviewStep===i ? 'Current' : 'Pending';
                    return <div className="rev-row" key={i}>
                      <div className={'rev-num '+(st==='Approved'?'done':st==='Current'?'now':'pending')}>
                        {st==='Approved'?'✓':i+1}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="t-main" style={{fontSize:12.5}}>
                          {pos(r._lm_reviewerposition_value)||'—'}</div>
                        {r.lm_newcolumn && <div className="t-sub">{r.lm_newcolumn}</div>}
                      </div>
                      <Tag c={st==='Approved'?'green':st==='Current'?'amber':'grey'}>{st}</Tag>
                    </div>;})}

          {/* Review actions. The lifecycle is Draft -> In Review -> Approved;
              Request More Information is an action inside it, not a state. */}
          <div className="sep"/>
          {rec.locked || rec.status==='Approved'
            ? <Note k="ok"><b>Approved and locked.</b> The file URL, version and full approval history
                are retained. A change after approval has to become a new version.</Note>
            : !rec.templateId
              ? <Note k="warn"><b>This Custom Report has no reviewer chain.</b> The chain is configured
                  on the Report Template, and a Custom Report has no Template — so there is nowhere to
                  read reviewers from and it cannot be submitted. It needs either a per-occurrence
                  reviewer table, or a Template to borrow the chain from.</Note>
              : reviewChain.length===0
                ? <Note k="warn">No reviewer is configured for this Report's Business Unit or Region,
                    so there is no route to submit into.</Note>
                : rec.status==='Draft'
                  ? <>
                      <div className="csub">Submitting routes this to
                        <b> {pos(reviewChain[0]?._lm_reviewerposition_value)||'the first reviewer'}</b>,
                        the first of {reviewChain.length} step{reviewChain.length>1?'s':''}.</div>
                      <Btn k="pri" disabled={busy==='submit'} onClick={submitReport}>
                        {busy==='submit'?'Submitting…':'Submit for review'}</Btn>
                    </>
                  : rec.status==='In Review'
                    ? <>
                        <div className="csub">Waiting on
                          <b> {pos(reviewChain[rec.reviewStep??0]?._lm_reviewerposition_value)||'the current reviewer'}</b>
                          {' '}— step {(rec.reviewStep??0)+1} of {reviewChain.length}.
                          {(rec.reviewStep??0)+1>=reviewChain.length
                            ? ' Approving this step approves the Report.' : ''}</div>
                        <div className="btn-row">
                          <Btn k="pri" disabled={!!busy} onClick={approveStep}>
                            {busy==='approve'?'Approving…'
                              :(rec.reviewStep??0)+1>=reviewChain.length?'✓ Approve and publish':'✓ Approve this step'}</Btn>
                          <Btn k="wrn" disabled={!!busy} onClick={()=>setRmi(true)}>
                            Request More Information</Btn>
                        </div>
                      </>
                    : null}
        </div>

        <div className="card">
          {rmi && <ReturnModal title="Request More Information"
            onClose={()=>setRmi(false)}
            onSave={async reason=>{
              setRmi(false);
              await runReview('rmi',
                ()=>requestMoreInfoOnReport(rec.id, {
                  actorPositionId: reviewChain[rec.reviewStep??0]?._lm_reviewerposition_value || undefined,
                  reason,
                }),
                'Returned to the Report Creator',
                'The reason is recorded and the prior review history is kept. Re-submission restarts the configured route.');
            }}/>}
          <h2>Review History</h2>
          <div className="csub">Every review action, retained across a Request More Information.</div>
          {histLoading
            ? <Empty>Reading the history…</Empty>
            : history.length===0
              ? <Empty ic="—">Nothing recorded yet.</Empty>
              : <Hist items={history.map(h=>({
                  at: h.at ? fmtISODT(h.at) : '—',
                  who: null,
                  act: h.action + (h.actorPositionId ? ' — '+(pos(h.actorPositionId)||'') : ''),
                  note: h.note,
                }))}/>}
        </div>

        <div className="card">
          <h2>Report Details</h2>
          <div className="wa-mo-r txt"><label>Status</label>
            <span className="v">{rec.status||'—'}</span></div>
          <div className="wa-mo-r txt"><label>Report Type</label>
            <span className="v">{tplRow?(REPORT_TYPE[tplRow.reportTypeCode]||'—'):'—'}</span></div>
          <div className="wa-mo-r txt"><label>Category</label>
            <span className="v">{tplRow?(REPORT_CATEGORY[tplRow.reportCategoryCode]||'—'):'—'}</span></div>
          <div className="wa-mo-r txt"><label>Frequency</label>
            <span className="v">{tplRow?(REPORT_FREQUENCY[tplRow.frequencyCode]||'—'):'—'}</span></div>
          <div className="wa-mo-r txt"><label>Business Unit</label>
            <span className="v">{dvBu(rec.businessUnitId)||'—'}</span></div>
          <div className="wa-mo-r txt"><label>Region</label>
            <span className="v">{dvRegion(rec.regionId)||'—'}</span></div>
          <div className="wa-mo-r"><label>Version</label>
            <span className="v">{rec.version!=null?'v'+rec.version:'—'}</span></div>
          <div className="wa-mo-r txt"><label>Review step</label>
            <span className="v">{rec.reviewStep!=null
              ?`Step ${rec.reviewStep+1} of ${reviewChain.length||'—'}`:'—'}</span></div>
          <div className="wa-mo-r txt"><label>Locked</label>
            <span className="v">{rec.locked?'Yes':'No'}</span></div>
        </div>

        <div className="card">
          <h2>What this Submission produces</h2>
          <div className="csub">Outputs generated from this Report and its review.</div>
          <div className="lp-produced">
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>APPROVAL</label>
                <div>{rec.status==='Approved'
                  ? 'Approved and locked.'
                  : `Reached once every reviewer in the chain approves${reviewChain.length?' ('+reviewChain.length+' step'+(reviewChain.length===1?'':'s')+')':''}.`}</div></div>
            </div>
          </div>
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
  const accred = setup && setup.cls==='Accreditation-required Committee';
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
          {rec.adhoc && <Tag c="amber">Ad Hoc — {rec.adhoc}</Tag>}
          {!rec.setup && <span className="src">No approved Setup · sent to Taxonomy</span>}
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
      {/* Ungated to match the live path — the two disagreeing about which
          meetings are scored is exactly what §7 open decision 1 was about. */}
      <button className={tab==='grid'?'on':''} onClick={()=>setTab('grid')}>
        Audit Grid{grid && <span className="c">{grid.state==='Approved'?grid.score+'%':'…'}</span>}</button>
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
            <Btn style={{width:'100%',marginBottom:8}} onClick={()=>setEdit(true)}>
              ✎ Edit date, time, mode or location</Btn>
            <Btn style={{width:'100%',marginBottom:8}} disabled={!!rec.agendaSent}
              onClick={()=>A.setAgendaSent(rec.id,TODAY)}>🗓 Record agenda distribution</Btn>
            <Btn k="dgr" style={{width:'100%',marginBottom:10}} onClick={()=>setCancel(true)}>
              ⊘ Cancel occurrence</Btn>
            <Note k="info" ic="i">Only execution-level information is editable —
              date, time, mode, location, online link, attendees, Agenda and Inputs. The approved Setup, its
              controlled name and its classification belong to Taxonomy and cannot be changed here.</Note>
          </> : <div className="csub" style={{marginBottom:0}}>No further actions — this occurrence is
            {rec.status==='Held'?' Held.':' Cancelled.'}</div>}
        </div>

        <div className="card">
          <h2>Occurrence</h2>
          <div className="wa-mo-r"><label>ID</label><span className="v mono">{occCode(rec)}</span></div>
          <div className="wa-mo-r txt"><label>Setup</label>
            <span className="v">{setup?setup.name:'Custom Ad Hoc'}</span></div>
          <div className="wa-mo-r txt"><label>Setup Type</label>
            <span className="v">{setup?setup.type:'Ad Hoc'}</span></div>
          <div className="wa-mo-r txt"><label>Classification</label>
            <span className="v">{occCls(rec)}</span></div>
          <div className="wa-mo-r txt"><label>Cadence</label>
            <span className="v">{setup?setup.cadence:'Ad Hoc — no cadence'}</span></div>
          {rec.adhoc && <div className="wa-mo-r txt"><label>Ad Hoc Type</label>
            <span className="v">{rec.adhoc}</span></div>}
          <div className="wa-mo-r txt"><label>Business Unit</label>
            <span className="v">
              {rec.bu}{(BUS.find(b=>b.id===rec.bu)||{}).region?' · '+BUS.find(b=>b.id===rec.bu).region:''}</span></div>
          <div className="wa-mo-r txt"><label>Meeting Chair</label>
            <span className="v">{P(r.chair).name}</span></div>
          <div className="wa-mo-r txt"><label>Facilitator</label>
            <span className="v">{P(r.facilitator).name}</span></div>
          <div className="wa-mo-r txt"><label>MoM Recorder</label>
            <span className="v">{P(r.recorder).name}</span></div>
          <div className="wa-mo-r txt"><label>TOR or Policy Reference</label>
            <span className="v">{setup&&setup.tor
              ? setup.tor
              : accred ? 'Required — none held' : 'Optional — none held'}</span></div>
          <div className="wa-mo-r txt"><label>Quorum Threshold</label>
            <span className="v">
              {setup&&setup.quorumPct!=null?setup.quorumPct+'%':'Not configured'}</span></div>
          <div className="wa-mo-r txt"><label>Agenda Distributed</label>
            <span className="v">
              {rec.agendaSent?fmtD(rec.agendaSent):'Not recorded'}</span></div>
          <div className="wa-mo-r txt"><label>Outlook and Teams</label>
            <span className="v">{rec.sync||'—'}</span></div>
          <div className="wa-mo-r txt"><label>Mode</label>
            <span className="v">{rec.mode}</span></div>
          <div className="wa-mo-r txt"><label>Location</label>
            <span className="v">{rec.location||'—'}</span></div>
          <div className="wa-mo-r txt"><label>Created</label>
            <span className="v">{fmtD(rec.inviteSent)}</span></div>
          {rec.link && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',
            fontSize:12,overflowWrap:'anywhere'}}>
            <span style={{color:'var(--ink-2)'}}>Online link: </span>{rec.link}</div>}
        </div>

        {setup && setup.quorumPct!=null && <div className="card">
          <h2>Quorum Rules</h2>
          <div style={{border:'1px solid var(--green-bd)',background:'var(--green-bg)',borderRadius:8,
            padding:'7px 10px',fontSize:12,color:'var(--green)',fontWeight:600}}>
            ✓ Min {Math.ceil(setup.quorumPct/100*a.den)} of {a.den} required</div>
        </div>}

        <div className="card">
          <h2>Terms of Reference or Policy</h2>
          <div className="csub">Mandatory for an Accreditation Committee, optional for a Business Meeting.
            Retrieved from the approved Setup and read-only here.</div>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,
                       background:'var(--grey-bg)',border:'1px solid var(--border)'}}>
            <span aria-hidden="true">🔒</span>
            <span>{setup&&setup.tor
              ? `${setup.tor}${setup.torReview?' · review due '+fmtD(setup.torReview):''}`
              : accred ? 'Required for this Committee classification, and none is held. AG-01 will score 0.'
                : 'Optional for this classification, and none is held. AG-01 is Not Applicable for this classification.'}</span>
          </div>
        </div>

        <div className="card">
          <h2>What this occurrence produces</h2>
          <div className="csub">Everything below lives in a tab on this page — Minutes, the governance score,
            and the Tasks and Decisions that came out of it.</div>
          <div className="lp-produced">
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>MEETING MINUTES</label>
                <div>{mom ? `Minutes ${mom.status}.` : 'Created when the Meeting is held.'}</div></div>
            </div>
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>TASKS AND DECISIONS</label>
                <div>{actionsAll.length
                  ? `${actionsAll.length} recorded.`
                  : 'None recorded.'}</div></div>
            </div>
            <div className="lp-produced-row">
              <span className="lp-produced-dot" aria-hidden="true"/>
              <div><label>GOVERNANCE AUDIT GRID</label>
                <div>{isCommittee(rec)
                  ? (grid ? `${grid.state}${grid.score!=null?' · '+grid.score+'%':''}.` : 'Created when the Minutes reach Closed.')
                  : 'Not created. The Audit Grid applies to Committee occurrences only.'}</div></div>
            </div>
          </div>
        </div>

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
          {' '}<OD id="OD-20"/>.</Note></div>}
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
  /* Same rule as the Dataverse paths: a non-working date rolls forward rather
     than being refused, and only this occurrence moves. */
  const bookedDate = f.date && isNonWorking(f.date) ? nextWorkingDay(f.date) : f.date;
  const moved = !!f.date && bookedDate !== f.date;
  const badTime = f.end<=f.start;
  const needLoc = f.mode!=='Online' && !f.location.trim();
  const needLink= f.mode!=='In person' && !f.link.trim();
  const ok = f.date && !badTime && !needLoc && !needLink;
  return <Modal title="Edit this occurrence" wide onClose={onClose}
    sub="Execution-level information only. The approved Setup, its controlled name and its classification are owned by Taxonomy."
    footer={<><Btn onClick={onClose}>Cancel</Btn>
      <Btn k="pri" disabled={!ok} onClick={()=>{A.editOcc(occ.id,{...f,date:bookedDate});onClose();}}>
        Save and resynchronize</Btn></>}>
    <div className="f-row3">
      <Field label="Date" req
        hint={moved
          ? `${dayName(f.date)} is a non-working day. This occurrence will move to ${fmtD(bookedDate)} — the series is unchanged.`
          : 'The working week is Sunday to Thursday.'}>
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


/* A searchable Position picker. The Organization Structure runs to hundreds of
   assignments, so a plain <select> is unusable — this filters as you type, over
   both the Position name and the person currently holding it.

   `opts` is already narrowed to the Meeting's scope by the caller; this only
   handles searching and selection. */
function PositionSelect({value,onChange,opts,placeholder,disabled,emptyText}){
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

  const sel=opts.find(o=>o.id===value);
  const needle=q.trim().toLowerCase();
  const shown=needle
    ? opts.filter(o=>(o.name||'').toLowerCase().includes(needle)
                  || (o.holder||'').toLowerCase().includes(needle))
    : opts;

  const box={border:'1px solid var(--border-d)',borderRadius:7,padding:'7px 9px',
             fontSize:13,background:disabled?'var(--surface)':'#fff',
             cursor:disabled?'not-allowed':'pointer',width:'100%',textAlign:'left',
             color:sel?'var(--ink)':'var(--muted)'};

  return <div ref={ref} style={{position:'relative'}}>
    <button type="button" style={box} disabled={disabled}
      onClick={()=>{ if(!disabled){ setOpen(o=>!o); setQ(''); } }}>
      {sel ? <>{sel.name}{sel.holder?<span style={{color:'var(--muted)'}}> — {sel.holder}</span>:null}</>
           : (placeholder||'Select…')}
    </button>
    {open && !disabled && <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,
        zIndex:30,background:'#fff',border:'1px solid var(--border)',borderRadius:9,
        boxShadow:'0 12px 28px -12px rgba(33,28,30,.35)',padding:5}}>
      <input autoFocus type="search" value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Search a Position or the person holding it…"
        style={{width:'100%',border:'1px solid var(--border-d)',borderRadius:6,
                padding:'6px 8px',fontSize:12.5,marginBottom:5,fontFamily:'inherit'}}/>
      <div style={{maxHeight:210,overflowY:'auto'}}>
        {shown.length===0
          ? <div style={{padding:'8px 9px',fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>
              {opts.length===0 ? (emptyText||'No Positions in this scope') : 'Nothing matches that search.'}</div>
          : shown.map(o=>
            <button type="button" key={o.id}
              onClick={()=>{ onChange(o.id); setOpen(false); setQ(''); }}
              style={{display:'block',width:'100%',textAlign:'left',border:'none',
                      background:o.id===value?'var(--teal-l,#F3EAdb)':'transparent',
                      padding:'7px 9px',borderRadius:6,fontSize:12.5,cursor:'pointer',
                      fontFamily:'inherit',color:'var(--ink)'}}>
              {o.name}{o.holder?<div style={{fontSize:11,color:'var(--muted)'}}>{o.holder}</div>:null}
            </button>)}
      </div>
    </div>}
  </div>;
}

/* Attendee picker for the Custom Ad Hoc form, sourced from
   cr603_organizationstructures so each pick is a real
   row id the lm_AttendeePosition lookup will accept. */
/* Attendee picker for the Custom Ad Hoc form. Positions come from the
   Organization Structure, already narrowed to the Meeting's scope, and are
   searchable — the list is far too long to scroll.

   Each attendee carries a type, chosen alongside the Position before adding
   and still editable in the list afterwards. It defaults to Required, since
   that is what attendance is measured against. Written to lm_type. */
const ATTENDEE_TYPES_OCC=['Required','Optional'];

function DvAttendeePicker({value,onChange,opts,scopeChosen,scopeHint}){
  const [who,setWho]=useState('');
  const [type,setType]=useState('Required');
  const free=opts.filter(p=>!value.some(a=>a.positionId===p.id));
  const add=()=>{
    if(!who) return;
    const p=opts.find(x=>x.id===who);
    onChange([...value,{positionId:who, name:p?p.name:null, holder:p?p.holder:null, type}]);
    setWho(''); setType('Required');   // back to the default for the next one
  };
  const changeType=(id,t)=>onChange(value.map(a=>a.positionId===id?{...a,type:t}:a));

  return <Field label="Attendees" req hint={scopeHint}>
    <div style={{display:'flex',gap:7,alignItems:'flex-start',marginBottom:value.length?9:0}}>
      <div style={{flex:'1 1 260px'}}>
        <PositionSelect value={who} onChange={setWho} opts={free} disabled={!scopeChosen}
          placeholder={scopeChosen?'Search a Position to add…':'Choose the scope first'}
          emptyText="No Positions left in this scope"/>
      </div>
      <select value={type} onChange={e=>setType(e.target.value)} disabled={!scopeChosen}
        style={{flex:'0 0 140px'}}>
        {ATTENDEE_TYPES_OCC.map(t=><option key={t}>{t}</option>)}</select>
      <Btn disabled={!who} onClick={add}>Add</Btn>
    </div>
    {value.length===0
      ? <div style={{fontSize:12,color:'var(--red)'}}>At least one Attendee is required.</div>
      : <table className="data"><tbody>{value.map(a=>
          <tr key={a.positionId}>
            <td><div className="t-main">{a.name}</div>
                {a.holder?<div className="t-sub">{a.holder}</div>:null}</td>
            <td style={{width:150}}>
              <select value={a.type||'Required'} onChange={e=>changeType(a.positionId,e.target.value)}
                style={{fontSize:12.5,padding:'4px 6px'}}>
                {ATTENDEE_TYPES_OCC.map(t=><option key={t}>{t}</option>)}</select></td>
            <td style={{width:80,textAlign:'right'}}>
              <Btn k="sm" onClick={()=>onChange(value.filter(x=>x.positionId!==a.positionId))}>Remove</Btn></td>
          </tr>)}
        </tbody></table>}
  </Field>;
}

/* The soonest real calendar date this Setup's own cadence lands on, at or
   after `fromDate` -- e.g. a Monthly Setup on day 1 next lands on the 1st of
   the soonest month at or after fromDate. Returns null when the Setup
   carries no day-of-month at all (Daily / Twice Weekly / Weekly / Twice
   Monthly / Custom, or a Monthly+ Setup left blank), so the caller falls
   back to its own generic default.
   Quarterly/Semesterly/Annually all share the "day within a period, plus
   which slice of the period" shape via lm_monthofthequarter's three values
   ("1st/2nd/3rd month"). That reading is exact for Quarterly (a real
   3-month quarter). For Semesterly (6 months) and Annually (12 months) the
   schema defines no equivalent field, so "1st/2nd/3rd month of a quarter"
   is generalized here to "1st/2nd/3rd slice of the period" -- a working
   assumption, not a confirmed rule. */
const PERIOD_MONTHS = { Monthly:1, Quarterly:3, Semesterly:6, Annually:12 };
function naturalRecurrenceDate(frequency, dayOfMonth, monthInQuarter, fromDate, monthOfYear){
  const periodMonths = PERIOD_MONTHS[frequency];
  if(!periodMonths || !dayOfMonth) return null;
  const sliceIdx = { '1st month':0, '2nd month':1, '3rd month':2 }[monthInQuarter] ?? 0;
  /* An Annual Setup now names its month (cr18c_month, 1..12, 29 Sep) -- that
     beats the slice assumption above whenever it is set. */
  const annualMonth = periodMonths===12 && monthOfYear>=1 && monthOfYear<=12 ? monthOfYear-1 : null;
  const offset = annualMonth!=null ? annualMonth : periodMonths===1 ? 0 : sliceIdx * (periodMonths/3);

  const from = new Date(fromDate+'T00:00:00');
  const anchorMonth = from.getMonth() - (from.getMonth()%periodMonths);
  for(let cycle=0; cycle<4; cycle++){
    const d = new Date(from.getFullYear(), anchorMonth+offset+cycle*periodMonths, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, lastDay));
    const ds = ymd(d);
    if(ds >= fromDate) return ds;
  }
  return null;
}

/* Schedule Meeting -- a full page since 29 Sep (was NewMeetingModal), styled to
   the approved design: Setup cards, Meeting Details, People, Agenda, and a side
   column with the Meeting Summary, Members and Quorum Rules. Same data, same
   rules and the same save as the modal it replaced -- only the layout changed.
   Opened with go('newmtg', 'adhoc' | 'custom'); a Setup card or the Custom
   Meeting card switches between the two on the page. */
function ScreenNewMeeting(){
  const {me,toast,refreshOccurrences,sel,go,dvMeetingOccs}=use();
  const [custom,setCustom]=useState(sel?.newmtg==='custom');
  /* previous-meeting agenda items the user UNticked (all are carried by default) */
  const [skipCarry,setSkipCarry]=useState(()=>new Set());
  /* Reports to link to the new meeting once it exists (29 Sep) -- any status,
     Draft and Custom included; see ReportLinkPicker. */
  const [linkReports,setLinkReports]=useState([]);
  const {dvReportOccs=[]}=use();
  const onClose=()=>go('mtg');
  const [setupQ,setSetupQ]=useState('');
  const [f,setF]=useState({setup:'', tplUnitKey:'', name:'', purpose:'', bu:'AHJ',
    date:addDays(TODAY,5), start:'09:00', end:'10:00', mode:'Online', location:'',
    adhoc:'Governance', restricted:false, dept:P(me).dept, stage:'Business Unit',
    chair:'u2', facilitator:'u3', recorder:null,
    attend:[{who:'u2',type:'Required'},{who:'u5',type:'Required'}], agenda:[''], inputs:[],
    inviteSent:TODAY, link:'',
    /* Real Dataverse row ids -- the lookups on lm_meetingoccurrences will not
       accept this module's seeded ids, for either an Ad Hoc from Setup or a
       Custom Ad Hoc Meeting. */
    dvBusinessUnitId:'', dvRegionId:'', dvDepartmentId:'',
    dvChairPositionId:'', dvFacilitatorPositionId:'', dvAttend:[], tz:''});
  const [saving,setSaving]=useState(false);
  const [tplDetail,setTplDetail]=useState(null);
  const [tplLoading,setTplLoading]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const agenda=f.agenda.filter(a=>a.trim());

  /* Stage decides what the Meeting is scoped to, and therefore which picker is
     shown: Stage 1 runs in a Business Unit, Stage 2 in a Region, and Group /
     ExCom run once group-wide with neither. */
  const stageBU     = f.stage==='Business Unit';
  const stageRegion = f.stage==='Region';
  const scopeOk = stageBU ? !!f.dvBusinessUnitId : stageRegion ? !!f.dvRegionId : true;
  /* ⚠️ Same rule the Report-side New Report modal already has (see its own
     comment, above): the Setup's own Departments --
     lm_meetingtemplatedepartmentfunctions, already on tplDetail as `lines`
     -- beat departmentsForScope()'s Position-inference when the Setup names
     any, since the inference can offer a Department the Setup never named
     and miss one it did. Falls back to the inference for a Custom Meeting,
     while the Setup is still loading, or when it names no Department. */
  const tplDeptIds = useMemo(()=>new Set(
    (tplDetail?.lines || []).map(l=>l._lm_department_value).filter(Boolean)),
  [tplDetail]);
  const tplDepts = DV_DEPT_LIST.filter(d=>tplDeptIds.has(d.id));
  const fromSetup = !custom && tplDepts.length > 0;
  const deptOpts = fromSetup
    ? tplDepts
    : departmentsForScope(f.stage, f.dvBusinessUnitId, f.dvRegionId);
  const chairOpts = positionsForScope(f.stage, f.dvBusinessUnitId, f.dvRegionId);
  const scopeChosen = !(stageBU && !f.dvBusinessUnitId) && !(stageRegion && !f.dvRegionId);
  const scopeHint = stageBU
    ? 'Narrowed to the Positions inside the chosen Business Unit.'
    : stageRegion
      ? 'Narrowed to the Positions inside every Business Unit in the chosen Region.'
      : 'Group and ExCom Meetings are not narrowed — every Position is offered.';
  const scopePlaceholder = stageBU&&!f.dvBusinessUnitId ? 'Choose a Business Unit first'
    : stageRegion&&!f.dvRegionId ? 'Choose a Region first' : 'Search a Position…';

  /* Every Business Unit / Region the selected Setup is actually approved to
     run in, each carrying that unit's own Chairman, Co-Chairman, Facilitator
     and core Attendees -- read straight from lm_meetingtemplatebusinessunitses
     / lm_meetingtemplateregionses via fetchMeetingTemplateDetail(). A Group or
     ExCom Setup owns no such child rows at all, so this comes back empty for
     one of those and the occurrence just runs Group-wide.

     ⚠️ Since 28 Sep a Stage 4 (ExCom) Setup CAN own such rows -- the Business
     Units or Regions it covers -- but they are scope only, with no Chairman or
     Attendees, and the meeting is still one group-wide meeting whose people
     live on the Setup itself. So they are not offered as units here. */
  const tplUnits = tplDetail && tplDetail.parent?.lm_stages !== 4 ? [
    ...(tplDetail.businessUnits||[]).map(b=>({
      key:b._lm_businessunit_value, kind:'bu',
      label: dvBu(b._lm_businessunit_value) || '(Business Unit not in the loaded list)',
      chairman:b._lm_meetingchairman_value||null,
      facilitator:b._lm_meetingorganizerfacilitator_value||null,
      attendees:(b.attendees||[]).map(a=>({positionId:a._lm_attendeeposition_value||null,
                                            type:ATTENDEE_TYPE[a.lm_attendeetype]||'Required'})),
    })),
    ...(tplDetail.regions||[]).map(r=>({
      key:r._lm_region_value, kind:'region',
      label: dvRegion(r._lm_region_value) || '(Region not in the loaded list)',
      chairman:r._lm_meetingchairman_value||null,
      facilitator:r._lm_meetingorganizerfacilitator_value||null,
      attendees:(r.attendees||[]).map(a=>({positionId:a._lm_attendeeposition_value||null,
                                            type:ATTENDEE_TYPE[a.lm_attendeetype]||'Required'})),
    })),
  ].filter(u=>u.key) : [];
  const TPL_STAGE_LABEL = {1:'Business Unit',2:'Region',3:'Group',4:'ExCom'};
  const tplGroupStage = TPL_STAGE_LABEL[tplDetail?.parent?.lm_stages] || 'Group';

  /* Applies one of the Setup's approved units (or, for a Group / ExCom Setup,
     none at all) to the form: its Chairman and Facilitator pre-fill the
     Position pickers below and its core Attendees pre-fill the Attendee list
     -- every one of them still adjustable for this occurrence only.

     A Group/ExCom Setup has no per-unit row to carry these, so its Chairman
     and Facilitator live on the Setup's own parent row instead -- read here
     as the fallback when there's no unit at all. */
  const applyUnit = unit => {
    const region = unit && unit.kind==='bu'
      ? dvRegion(DV_BU_LIST.find(b=>b.id===unit.key)?.region) : null;
    setF(x=>({...x,
      tplUnitKey: unit ? unit.key : '',
      stage: unit ? (unit.kind==='bu'?'Business Unit':'Region') : tplGroupStage,
      dvBusinessUnitId: unit&&unit.kind==='bu' ? unit.key : '',
      dvRegionId: unit&&unit.kind==='region' ? unit.key : '',
      dvDepartmentId:'',
      dvChairPositionId: unit ? (unit.chairman||'') : (tplDetail?.parent?._lm_meetingchairman_value||''),
      dvFacilitatorPositionId: unit ? (unit.facilitator||'') : (tplDetail?.parent?._lm_meetingorganizerfacilitator_value||''),
      dvAttend: unit ? unit.attendees.filter(a=>a.positionId).map(a=>({
        positionId:a.positionId, name:dvPos(a.positionId), holder:DV_POS_HOLDER[a.positionId]||null,
        type:a.type,
      })) : [],
      tz: unit
        ? (unit.kind==='bu' ? (region?tzForRegionName(region):x.tz) : tzForRegionName(unit.label))
        : x.tz,
    }));
  };

  /* Keep the Department consistent with the Setup's own list -- the same
     rule and the same reason the Report-side New Report modal already has
     it: a Department picked before the Setup's detail arrives may not be on
     its list (cleared, rather than submitted against a Setup that never
     named it), and a Setup naming exactly ONE Department has no decision to
     make (selected automatically). Only ever fills a BLANK field, so an
     explicit choice survives. Restricted to `fromSetup` on purpose -- the
     fallback list is inferred from Positions, and auto-selecting from an
     inference would put a Department the Setup never governed onto a
     governed record. */
  useEffect(()=>{
    if(!fromSetup) return;
    if(f.dvDepartmentId && !deptOpts.some(d=>d.id===f.dvDepartmentId)){
      set('dvDepartmentId','');
      return;                      // the next run picks the lone one, if any
    }
    if(!f.dvDepartmentId && deptOpts.length===1) set('dvDepartmentId', deptOpts[0].id);
  },[fromSetup, deptOpts, f.dvDepartmentId]);

  /* Reading a Setup's own per-unit placement, roles and Attendees is a
     separate, heavier call than the lightweight list the picker below is
     built from, so it only runs once a Setup is actually chosen. */
  useEffect(()=>{
    if(custom || !f.setup){ setTplDetail(null); setTplLoading(false); return; }
    let cancelled=false;
    setTplLoading(true); setTplDetail(null);
    setF(x=>({...x, tplUnitKey:'', dvBusinessUnitId:'', dvRegionId:'', dvDepartmentId:'',
                    dvChairPositionId:'', dvFacilitatorPositionId:'', dvAttend:[], agenda:['']}));
    fetchMeetingTemplateDetail(f.setup)
      .then(d=>{ if(!cancelled) setTplDetail(d); })
      .catch(e=>{ console.warn('[dataverse] fetchMeetingTemplateDetail() failed:', e); })
      .finally(()=>{ if(!cancelled) setTplLoading(false); });
    return ()=>{ cancelled=true; };
  },[custom, f.setup]);

  /* Once the Setup's detail is in: seed the Agenda from its controlled
     Agenda Items, default the Date to the Setup's own cadence (Monthly on
     day 1, say, lands on the 1st of the soonest qualifying month), and
     auto-apply its placement when there is exactly one (or none, for a
     Group / ExCom Setup) -- a Setup approved for more than one Business
     Unit or Region waits on the picker below instead.
     A cadence date landing on a weekend or holiday is not adjusted here --
     the existing bookedDate/moved logic below already detects that and
     surfaces the "will be booked on…" note, same as any manually-typed
     date. */
  useEffect(()=>{
    if(custom || !tplDetail) return;
    const ag=(tplDetail.agenda||[]).slice().sort((a,b)=>(a.lm_step||0)-(b.lm_step||0))
      .map(a=>a.lm_agendaitemname||'').filter(Boolean);
    const p = tplDetail.parent||{};
    const natural = naturalRecurrenceDate(
      MEETING_FREQUENCY[p.lm_frequency]||null,
      typeof p.lm_dayofthemonth==='number' ? p.lm_dayofthemonth : null,
      MEETING_MONTH_IN_QUARTER[p.lm_monthofthequarter]||null,
      TODAY,
      typeof p.cr18c_month==='number' ? p.cr18c_month : null,
    );
    setF(x=>({...x, agenda: ag.length?ag:[''], date: natural || x.date }));
    if(tplUnits.length<=1) applyUnit(tplUnits[0]||null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tplDetail]);

  /* An occurrence landing on a non-working day is NOT refused — it rolls forward
     to the next working day, that occurrence only, never the series. Weekend and
     public holiday behave the same way; isNonWorking() covers both. */
  const bookedDate = f.date && isNonWorking(f.date) ? nextWorkingDay(f.date) : f.date;
  const moved = !!f.date && bookedDate !== f.date;

  /* Mode decides which of the two destination fields apply. */
  const needsLink     = f.mode==='Online' || f.mode==='Hybrid';
  const needsLocation = f.mode==='In person' || f.mode==='Hybrid';
  const modeOk = (!needsLink || f.link.trim()) && (!needsLocation || f.location.trim());

  /* What this new meeting would carry from the previous one -- see
     previousOccurrence(). Worked out from the Setup and the place chosen, so it
     follows the Business Unit / Region picker. */
  const carryPrev = custom ? null : previousOccurrence({
    templateId: f.setup || null,
    businessUnitId: stageBU ? (f.dvBusinessUnitId||null) : null,
    regionId: stageRegion ? (f.dvRegionId||null) : null,
    date: bookedDate,
  }, dvMeetingOccs);
  const carryAll = carryCandidates(carryPrev, dvMeetingOccs);
  const carryNow = carryAll.filter(a=>!skipCarry.has(a.id));
  const ok = !!f.date && (agenda.length+carryNow.length)>0 && f.dvAttend.length>0 && scopeOk
    && f.dvChairPositionId && f.dvFacilitatorPositionId && f.tz && modeOk
    && (custom
      ? f.name.trim() && f.purpose.trim()
      : !!f.setup && !tplLoading && (tplUnits.length<=1 || !!f.tplUnitKey));

  /* Both an Ad Hoc from Setup and a Custom Ad Hoc Meeting are written
     straight to Dataverse -- parent row, then its agenda and attendee rows --
     and are NOT also added to the seeded demo state, which would put the
     same meeting on the calendar twice. The only difference is where the
     controlled name comes from and whether a Meeting Template is bound. */
  const save=async()=>{
    setSaving(true);
    try{
      const name = custom ? f.name.trim()
        : (tplDetail?.parent?.lm_meetingtemplatename || dvTpl(f.setup) || 'Untitled Meeting');
      const {id,errors}=await createMeetingOccurrence({
        name,
        templateId: custom ? undefined : (f.setup||undefined),
        // Scope follows the Stage: a Stage 1 Meeting carries a Business Unit,
        // a Stage 2 Meeting a Region, and Group / ExCom neither.
        stage:f.stage,
        businessUnitId:(stageBU && f.dvBusinessUnitId) ? f.dvBusinessUnitId : undefined,
        regionId:(stageRegion && f.dvRegionId) ? f.dvRegionId : undefined,
        departmentId:f.dvDepartmentId||undefined,
        chairPositionId:f.dvChairPositionId||undefined,
        facilitatorPositionId:f.dvFacilitatorPositionId||undefined,
        date:bookedDate, start:f.start, end:f.end,
        timezone:f.tz||undefined,
        mode:f.mode, status:'Scheduled',
        location:needsLocation ? (f.location.trim()||null) : null,
        link:needsLink ? (f.link.trim()||null) : null,
        adhocType:f.adhoc, restricted:!!f.restricted, inviteSent:TODAY,
        /* Carried-forward items first, each linked to the item it continues
           (lm_CarriedFromAgendaItem), then the ones typed here. */
        agenda:[
          ...carryNow.map(a=>({title:a.title, source:'Carried forward', carriedFromId:a.id,
                               ownerPositionId:a.ownerPositionId||f.dvFacilitatorPositionId||f.dvChairPositionId||undefined})),
          ...agenda.map(t=>({title:t, source:'Ad Hoc',
                             ownerPositionId:f.dvFacilitatorPositionId||f.dvChairPositionId||undefined})),
        ],
        // `type` is carried but not yet written -- lm_meetingoccurrenceattendeeses
        // has no attendee-type column. See createMeetingOccurrence().
        attendees:f.dvAttend.map(a=>({positionId:a.positionId, name:a.name||undefined,
                                      type:a.type||'Required'})),
      });
      if(!id){
        console.warn('[dataverse] Meeting Occurrence create failed:', errors);
        toast('Not saved','Creating the Meeting Occurrence in Dataverse failed. Check the console for details.','err');
        return;
      }
      /* The chosen reports, linked now the meeting has an id. A failure here is
         reported with the rest; the meeting itself is already saved. */
      for(const r of linkReports){
        const res = await linkMeetingOccurrenceReport({ meetingOccurrenceId:id, reportOccurrenceId:r.id,
          reportTemplateId:r.templateId||undefined, name:r.name });
        if(!res.id) errors.push(...res.errors);
      }
      if(errors.length){
        console.warn('[dataverse] Meeting Occurrence saved with some child rows failing:', errors);
        toast('Saved, with gaps',
          `The Meeting Occurrence was created, but ${errors.length} related row(s) failed. Check the console for details.`,'warn');
      }else if(custom){
        toast('Custom Ad Hoc Meeting saved',
          'Saved with its agenda and attendees. It now appears on the Calendar.','ok');
      }else{
        toast('Ad Hoc occurrence created',
          'Created from the approved Setup. The Setup and its classification are unchanged.','ok');
      }
      await refreshOccurrences();
      onClose();
    }catch(e){
      console.warn('[dataverse] Meeting Occurrence create threw unexpectedly:', e);
      toast('Not saved','Creating the Meeting Occurrence in Dataverse failed. Check the console for details.','err');
    }finally{ setSaving(false); }
  };

  /* ---- what the page shows, derived from the same state as the form ---- */
  const approvedSetups = (DV_TPL_LIST||[]).filter(setupIsApproved);
  const hiddenSetups = (DV_TPL_LIST||[]).length - approvedSetups.length;
  const setupNeedle = setupQ.trim().toLowerCase();
  const shownSetups = setupNeedle
    ? approvedSetups.filter(t=>matchesQuery(setupNeedle,[t.name, MEETING_SETUP_TYPE[t.setupTypeCode],
        MEETING_CATEGORY[t.categoryCode], MEETING_FREQUENCY[t.frequencyCode]]) || t.id===f.setup)
    : approvedSetups;
  const setupRow = f.setup ? dvTplDetail(f.setup) : null;
  const setupType = setupRow ? (MEETING_SETUP_TYPE[setupRow.setupTypeCode]||null) : null;
  const setupCategory = setupRow ? (MEETING_CATEGORY[setupRow.categoryCode]||null) : null;
  const setupCadence = setupRow
    ? [MEETING_FREQUENCY[setupRow.frequencyCode], MEETING_DAY_OF_WEEK[setupRow.dayOfWeekCode]].filter(Boolean).join(' — ')||null
    : null;
  const quorumPct = !custom ? (tplDetail?.parent?.lm_quorumthreshold ?? setupRow?.quorumPct ?? null) : null;
  const requiredCount = f.dvAttend.filter(a=>(a.type||'Required')==='Required').length;
  const scopeLabel = stageBU ? (dvBu(f.dvBusinessUnitId)||null)
    : stageRegion ? (dvRegion(f.dvRegionId)||null) : 'Group-wide';
  const title = custom ? f.name
    : (tplDetail?.parent?.lm_meetingtemplatename || dvTpl(f.setup) || '');
  const showForm = custom || (f.setup && !tplLoading);
  const pickSetup = id => { setCustom(false); if(id!==f.setup) set('setup', id); };
  const pickCustom = () => { setCustom(true); set('setup',''); };
  const initials = t => String(t||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const members = [
    ...(f.dvChairPositionId ? [{id:f.dvChairPositionId, role:'Chair'}] : []),
    ...(f.dvFacilitatorPositionId ? [{id:f.dvFacilitatorPositionId, role:'Facilitator'}] : []),
    ...f.dvAttend.map(a=>({id:a.positionId, role:a.type||'Required'})),
  ];
  const MEMBERS_SHOWN = 5;
  const why = !ok ? [
    !custom && !f.setup ? 'choose a Setup' : null,
    custom && !f.name.trim() ? 'a meeting name' : null,
    custom && !f.purpose.trim() ? 'a purpose' : null,
    !custom && f.setup && tplUnits.length>1 && !f.tplUnitKey ? 'the Business Unit / Region' : null,
    !scopeOk ? 'the scope' : null,
    !f.dvChairPositionId ? 'a Chair' : null,
    !f.dvFacilitatorPositionId ? 'a Facilitator' : null,
    !f.tz ? 'a time zone' : null,
    !f.dvAttend.length ? 'at least one attendee' : null,
    !(agenda.length+carryNow.length) ? 'at least one agenda item' : null,
    !modeOk ? (needsLink && !f.link.trim() ? 'a meeting link' : 'a location') : null,
  ].filter(Boolean) : [];

  return <div className="cs-root cs-newmtg">
    <div className="cs-head" style={{paddingBottom:16}}>
      <div className="cs-crumb"><button type="button" onClick={onClose}>Meetings</button> › <b>New Meeting</b></div>
      <div className="cs-head-top">
        <div><h1 className="cs-title">Schedule Meeting</h1>
          <p className="cs-sub">{custom
            ? 'A Custom Ad Hoc Meeting — for where no approved Setup exists. It is scheduled immediately and sent to Taxonomy with a No-Setup flag.'
            : 'Create a meeting from an approved Setup — it inherits the Setup’s classification, people and agenda.'}</p></div>
        <div className="cs-actions">
          <button type="button" className="cs-btn ghost lg" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="cs-btn primary lg" onClick={save} disabled={!ok||saving}
            title={ok ? 'Schedule this meeting' : 'Still needed: '+why.join(', ')}>
            <CalendarDays size={13}/>{saving?'Saving…':'Schedule Meeting'}</button>
        </div>
      </div>
    </div>

    <div className="cs-two-col cs-wide-side">
      <div className="cs-side" style={{gap:14}}>

        {/* ---- Select Setup ---- */}
        <section className="cs-card" aria-labelledby="nm-setup">
          <div className="cs-card-top" style={{marginBottom:4}}>
            <h2 className="cs-card-title" id="nm-setup">Select Setup</h2>
            <span className="cs-search">
              <input type="search" value={setupQ} placeholder="Search Setups…" aria-label="Search Setups"
                onChange={e=>setSetupQ(e.target.value)}/>
              {setupNeedle ? <span className="cs-search-n">{shownSetups.length} of {approvedSetups.length}</span> : null}
            </span>
          </div>
          <p className="cs-card-note" style={{marginBottom:12}}>
            Meetings inherit their classification, people, cadence, agenda and quorum from the selected Setup.
            {hiddenSetups>0 ? ` ${hiddenSetups} Setup${hiddenSetups===1?' is':'s are'} not approved and hidden.` : ''}</p>
          {(DV_TPL_LIST||[]).length>0 && approvedSetups.length===0
            ? <Note k="warn">None of the {(DV_TPL_LIST||[]).length} Setups read from Dataverse is Active /
                Approved, so there is nothing to create from. Approve one in Governance Setup first — or
                schedule a Custom Meeting.</Note>
            : null}
          <div className="cs-tpl-grid" role="radiogroup" aria-label="Meeting Setups">
            {shownSetups.map(t=>{
              const committee = /committee/i.test(MEETING_SETUP_TYPE[t.setupTypeCode]||'');
              const Ic = committee ? Shield : Briefcase;
              const units = (t.businessUnitIds||[]).length + (t.regionIds||[]).length;
              return <button key={t.id} type="button" role="radio" aria-checked={!custom && f.setup===t.id}
                  className={'cs-tpl'+(!custom && f.setup===t.id?' on':'')} onClick={()=>pickSetup(t.id)}>
                <span style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span className={'cs-icon '+(committee?'green':'gold')} aria-hidden="true"><Ic size={16}/></span>
                  <span style={{display:'flex',flexDirection:'column',gap:2}}>
                    <span className="cs-tpl-t">{t.name}</span>
                    <span className="cs-tpl-d">{[MEETING_SETUP_TYPE[t.setupTypeCode], MEETING_FREQUENCY[t.frequencyCode]]
                      .filter(Boolean).join(' · ') || 'Meeting Setup'}</span>
                  </span>
                </span>
                <span className="cs-tpl-tags">
                  <span className="cs-type green">Active</span>
                  {MEETING_CATEGORY[t.categoryCode] ? <span className="cs-type">{MEETING_CATEGORY[t.categoryCode]}</span> : null}
                  <span className="cs-type adhoc">{units ? `${units} unit${units===1?'':'s'}` : 'Group-wide'}</span>
                </span>
              </button>;})}
            <button type="button" role="radio" aria-checked={custom}
                className={'cs-tpl'+(custom?' on':'')} onClick={pickCustom}>
              <span style={{display:'flex',gap:10,alignItems:'center'}}>
                <span className="cs-icon dark" aria-hidden="true"><PenLine size={16}/></span>
                <span style={{display:'flex',flexDirection:'column',gap:2}}>
                  <span className="cs-tpl-t">Custom Meeting</span>
                  <span className="cs-tpl-d">No approved Setup — you name it and pick everyone.</span>
                </span>
              </span>
              <span className="cs-tpl-tags"><span className="cs-type adhoc">No Setup</span></span>
            </button>
          </div>
          {!custom && f.setup && tplLoading &&
            <div className="cs-info" style={{marginTop:12}}><Users size={13} aria-hidden="true"/>
              <span>Reading this Setup’s placement, Chair, Facilitator, Attendees and Agenda from Dataverse…</span></div>}
        </section>

        {showForm && <>
          {/* ---- Meeting Details ---- */}
          <section className="cs-card cs-mtg-form" aria-labelledby="nm-details">
            <h2 className="cs-card-title" id="nm-details" style={{marginBottom:10}}>Meeting Details</h2>
            {!custom &&
              <div className="cs-info" style={{marginBottom:12}}><Lock size={13} aria-hidden="true"/>
                <span>Locked by Taxonomy for this occurrence: the controlled name, Setup Type, classification,
                  TOR reference and quorum threshold. Everything else below can be adjusted for this occurrence only.</span></div>}
            <Field label="Meeting title" req={custom}
              hint={custom ? null : 'The Setup’s controlled name — it cannot be changed here.'}>
              <input type="text" value={title} disabled={!custom}
                onChange={e=>set('name',e.target.value)} placeholder="e.g. Sterilisation incident review"/></Field>
            {custom && <Field label="Purpose" req hint="Not stored — the occurrence table has no Purpose column.">
              <textarea value={f.purpose} onChange={e=>set('purpose',e.target.value)}/></Field>}

            {!custom && tplUnits.length>1 &&
              <Field label="Business Unit / Region" req
                hint="This Setup is approved for more than one place — choose which one this occurrence belongs to.">
                <select value={f.tplUnitKey} onChange={e=>applyUnit(tplUnits.find(u=>u.key===e.target.value)||null)}>
                  <option value="">Select…</option>
                  {tplUnits.map(u=><option key={u.key} value={u.key}>{u.label}</option>)}
                </select></Field>}
            {!custom && tplUnits.length===1 &&
              <Field label="Business Unit / Region" hint="The only place this Setup is approved to run.">
                <input type="text" value={tplUnits[0].label} disabled/></Field>}
            {!custom && tplUnits.length===0 &&
              <Field label="Scope" hint="This Setup runs once, group-wide.">
                <input type="text" value="Group-wide" disabled/></Field>}

            {custom && <div className="f-row">
              <Field label="Organizational Stage" req
                hint="Stage 1 runs in one Business Unit, Stage 2 in one Region. Group and ExCom run once, group-wide.">
                <select value={f.stage} onChange={e=>{
                  const v=e.target.value;
                  // Switching Stage clears the scope that no longer applies, and
                  // the Department with it, since it is narrowed by that scope.
                  setF(x=>({...x, stage:v, dvBusinessUnitId:'', dvRegionId:'',
                                    dvDepartmentId:'', dvChairPositionId:'', dvFacilitatorPositionId:''}));
                }}>
                {['Business Unit','Region','Group','ExCom'].map(s=><option key={s}>{s}</option>)}</select></Field>
              {stageBU
                ? <Field label="Business Unit" req hint="Shown as Business Unit — Region.">
                    <select value={f.dvBusinessUnitId} onChange={e=>{
                      const id=e.target.value;
                      const bu=DV_BU_LIST.find(b=>b.id===id);
                      const rn=bu?dvRegion(bu.region):null;
                      // Picking scope pre-selects the time zone that scope sits in.
                      setF(x=>({...x, dvBusinessUnitId:id, dvDepartmentId:'', dvChairPositionId:'',
                                      dvFacilitatorPositionId:'', dvAttend:[],
                                      tz:rn?tzForRegionName(rn):x.tz}));
                    }}>
                      <option value="">{DV_BU_LIST.length?'Select…':'No Business Units loaded'}</option>
                      {DV_BU_LIST.map(b=>{ const rn=dvRegion(b.region);
                        return <option key={b.id} value={b.id}>{rn?`${b.name} — ${rn}`:b.name}</option>; })}
                    </select></Field>
                : stageRegion
                  ? <Field label="Region" req>
                      <select value={f.dvRegionId} onChange={e=>{
                        const id=e.target.value;
                        const rg=DV_REGION_LIST.find(r=>r.id===id);
                        setF(x=>({...x, dvRegionId:id, dvDepartmentId:'', dvChairPositionId:'',
                                        dvFacilitatorPositionId:'', dvAttend:[],
                                        tz:rg?tzForRegionName(rg.name):x.tz}));
                      }}>
                        <option value="">{DV_REGION_LIST.length?'Select…':'No Regions loaded'}</option>
                        {DV_REGION_LIST.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                      </select></Field>
                  : <Field label="Scope" hint="Group and ExCom Meetings run once, group-wide — no Business Unit or Region.">
                      <input type="text" value="Group-wide" disabled/></Field>}
            </div>}

            <div className="f-row3">
              <Field label="Date" req
                hint={moved
                  ? `${dayName(f.date)} is a non-working day. This occurrence will be booked on ${fmtD(bookedDate)} — the series is unchanged.`
                  : 'The working week is Sunday to Thursday.'}>
                <input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
              <Field label="Start" req><input type="time" value={f.start}
                onChange={e=>set('start',e.target.value)}/></Field>
              <Field label="End" req><input type="time" value={f.end}
                onChange={e=>set('end',e.target.value)}/></Field>
            </div>
            {/* Mode decides what a Meeting needs to be reachable: Online needs a
                joining link, In person needs a room, Hybrid needs both. */}
            <div className="f-row">
              <Field label="Mode"><select value={f.mode} onChange={e=>set('mode',e.target.value)}>
                {['Online','In person','Hybrid'].map(m=><option key={m}>{m}</option>)}</select></Field>
              {needsLocation
                ? <Field label="Location" req hint="The room this Meeting is held in.">
                    <input type="text" value={f.location} onChange={e=>set('location',e.target.value)}
                      placeholder="e.g. Room 4B — Building A"/></Field>
                : null}
              {needsLink
                ? <Field label="Meeting link" req hint="The joining URL attendees use.">
                    <input type="text" value={f.link} onChange={e=>set('link',e.target.value)}
                      placeholder="https://teams.microsoft.com/l/meetup-join/…"/></Field>
                : null}
            </div>
            <div className="f-row">
              <Field label="Time zone" req>
                <select value={f.tz} onChange={e=>set('tz',e.target.value)}>
                  <option value="">Select…</option>
                  {TIME_ZONES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
              {!custom
                ? <Field label="Cadence (from Setup)">
                    <input type="text" value={setupCadence||'Not set on the Setup'} disabled/></Field>
                : null}
            </div>
            <Field label="Ad Hoc Type" req hint="A one-to-one or skip-level Meeting uses Leadership or Governance.">
              <Pills val={f.adhoc} onChange={v=>set('adhoc',v||'Governance')} opts={ADHOC_TYPES}/></Field>
            <Field label="">
              <label className="chk"><input type="checkbox" checked={f.restricted}
                onChange={e=>set('restricted',e.target.checked)}/>
                <span>Restrict visibility to participants — use for a one-to-one or skip-level Meeting.
                  The occurrence and its Minutes will be hidden from everyone else except permitted governance
                  roles.</span></label></Field>
          </section>

          {/* ---- People ---- */}
          <section className="cs-card cs-mtg-form" aria-labelledby="nm-people">
            <div className="cs-card-top" style={{marginBottom:10}}>
              <h2 className="cs-card-title" id="nm-people">People</h2>
              {!custom ? <span className="cs-type adhoc">From Setup</span> : null}
            </div>
            <div className="f-row">
              <Field label="Meeting Chair" req hint={scopeHint}>
                <PositionSelect value={f.dvChairPositionId} onChange={v=>set('dvChairPositionId',v)}
                  opts={chairOpts} disabled={!scopeChosen}
                  placeholder={scopePlaceholder} emptyText="No Positions in this scope"/></Field>
              <Field label="Facilitator" req
                hint="The Facilitator owns the agenda items and writes up the Minutes.">
                <PositionSelect value={f.dvFacilitatorPositionId} onChange={v=>set('dvFacilitatorPositionId',v)}
                  opts={chairOpts} disabled={!scopeChosen}
                  placeholder={scopePlaceholder} emptyText="No Positions in this scope"/></Field>
            </div>
            <Field label="Department"
              hint={fromSetup
                ? `The ${deptOpts.length} Department${deptOpts.length===1?'':'s'} this Setup is for.`
                : stageBU
                  ? 'Narrowed to the Departments inside the chosen Business Unit.'
                  : stageRegion
                    ? 'Narrowed to the Departments inside every Business Unit in the chosen Region.'
                    : 'Group and ExCom Meetings are not narrowed — every Department is offered.'}>
              <select value={f.dvDepartmentId} onChange={e=>set('dvDepartmentId',e.target.value)}
                disabled={(stageBU&&!f.dvBusinessUnitId)||(stageRegion&&!f.dvRegionId)}>
                <option value="">{
                  stageBU&&!f.dvBusinessUnitId ? 'Choose a Business Unit first'
                  : stageRegion&&!f.dvRegionId ? 'Choose a Region first'
                  : deptOpts.length ? 'Select…'
                  : fromSetup ? 'This Setup names no Department' : 'No Departments in this scope'}</option>
                {deptOpts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select></Field>
            <DvAttendeePicker value={f.dvAttend} onChange={v=>set('dvAttend',v)}
              opts={chairOpts} scopeChosen={scopeChosen} scopeHint={scopeHint}/>
          </section>

          {/* ---- Agenda ---- */}
          <section className="cs-card cs-mtg-form" aria-labelledby="nm-agenda">
            <div className="cs-card-top" style={{marginBottom:10}}>
              <h2 className="cs-card-title" id="nm-agenda">Agenda</h2>
              {!custom ? <span className="cs-type adhoc">From Setup</span> : null}
            </div>
            <p className="cs-card-note" style={{marginBottom:10}}>{custom
              ? 'At least one Agenda Item is required for every Meeting.'
              : 'Pre-filled from the Setup’s controlled Agenda — add, edit or remove items for this occurrence only.'}</p>
            {carryAll.length>0 &&
              <div className="cs-carry">
                <div className="cs-carry-hd">Carried forward from {carryPrev.name} · {fmtD(carryPrev.date)}
                  <span>{carryNow.length} of {carryAll.length} included</span></div>
                {carryAll.map(a=>
                  <label key={a.id} className="cs-carry-row">
                    <input type="checkbox" checked={!skipCarry.has(a.id)}
                      onChange={e=>setSkipCarry(x=>{ const n=new Set(x); if(e.target.checked) n.delete(a.id); else n.add(a.id); return n; })}/>
                    <span>{a.title}</span>
                    <span className="cs-type adhoc">{a.covered==='No'?'Not covered':'Not recorded'}</span>
                  </label>)}
                <p className="cs-card-note" style={{marginTop:6}}>Not covered last time. Each one ticked is added
                  first and linked back to the item it continues.</p>
              </div>}
            <div className="cs-agenda">
              {f.agenda.map((a,i)=>
                <div key={i} className="cs-agenda-row">
                  <span className="cs-agenda-n">{i+1}.</span>
                  <input type="text" value={a} placeholder={'Agenda Item '+(i+1)} aria-label={'Agenda Item '+(i+1)}
                    onChange={e=>set('agenda',f.agenda.map((x,j)=>j===i?e.target.value:x))}/>
                  {f.agenda.length>1
                    ? <button type="button" className="cs-btn" aria-label={'Remove Agenda Item '+(i+1)}
                        onClick={()=>set('agenda',f.agenda.filter((_,j)=>j!==i))}><X size={12}/></button>
                    : null}
                </div>)}
            </div>
            <button type="button" className="cs-btn" style={{marginTop:8}} onClick={()=>set('agenda',[...f.agenda,''])}>
              <Plus size={12}/>Add an item</button>
          </section>

          {/* ---- Reports ---- */}
          <section className="cs-card cs-mtg-form" aria-labelledby="nm-reports">
            <div className="cs-card-top" style={{marginBottom:6}}>
              <h2 className="cs-card-title" id="nm-reports">Reports for this meeting</h2>
              <span className="cs-type adhoc">Optional</span>
            </div>
            <p className="cs-card-note" style={{marginBottom:10}}>Link any report or plan — a Draft included, and
              Custom reports. They appear on the meeting’s Submissions tab and count as submitted once their
              author submits them for review.</p>
            {linkReports.length>0 &&
              <div className="cs-members" style={{marginBottom:10}}>
                {linkReports.map(r=><div key={r.id} className="cs-member">
                  <span className="cs-member-t"><b>{r.name}</b>
                    <span>{[fmtP(r.period), dvRptTpl(r.templateId)||'Custom report'].filter(Boolean).join(' · ')}</span></span>
                  <span className={'cs-type '+(r.status==='Draft'?'adhoc':r.status==='In Review'?'green':'')}>{RPT_STATUS_WORD(r.status)}</span>
                  <button type="button" className="cs-btn" aria-label={'Remove '+r.name}
                    onClick={()=>setLinkReports(x=>x.filter(y=>y.id!==r.id))}><X size={12}/></button>
                </div>)}
              </div>}
            <ReportLinkPicker reports={dvReportOccs} busy={saving} pickLabel="Add"
              taken={new Set(linkReports.map(r=>r.id))}
              place={{businessUnitId: stageBU ? f.dvBusinessUnitId : null,
                      regionId: stageRegion ? f.dvRegionId : null,
                      departmentId: f.dvDepartmentId || null}}
              onPick={r=>setLinkReports(x=>[...x,r])}/>
          </section>
        </>}
      </div>

      {/* ---- side column ---- */}
      <div className="cs-side">
        <section className="cs-card" aria-labelledby="nm-summary">
          <h2 className="cs-card-title" id="nm-summary" style={{marginBottom:6}}>Meeting Summary</h2>
          <div className="cs-sum">
            {[['Setup', custom ? 'Custom — no Setup' : (dvTpl(f.setup)||'—')],
              ['Type', custom ? 'Ad Hoc' : (setupType||'—')],
              ['Category', custom ? '—' : (setupCategory||'—')],
              ['Cadence', custom ? 'One-off' : (setupCadence||'—'), true],
              ['Scope', scopeLabel||'—'],
              ['Date', bookedDate ? fmtD(bookedDate) : '—', true],
              ['Time', f.start&&f.end ? `${f.start} – ${f.end}` : '—', true],
             ].map(([k,v,mono])=><div key={k} className="cs-sum-row">
               <span>{k}</span><b className={mono?'cs-mono':''}>{v}</b></div>)}
          </div>
        </section>

        <section className="cs-card" aria-labelledby="nm-members">
          <div className="cs-card-top" style={{marginBottom:8}}>
            <h2 className="cs-card-title" id="nm-members">Members</h2>
            {!custom && f.setup ? <span className="cs-type adhoc">From Setup</span> : null}
          </div>
          {members.length===0
            ? <p className="cs-card-note">{showForm ? 'No Chair, Facilitator or Attendee chosen yet.'
                : 'Choose a Setup to see who it brings.'}</p>
            : <div className="cs-members">
                {members.slice(0,MEMBERS_SHOWN).map((m,i)=>{
                  const holder=DV_POS_HOLDER[m.id]||null, pos=dvPos(m.id)||'Position';
                  return <div key={m.id+'-'+i} className="cs-member">
                    <span className={'cs-avatar'+(i%2?' g':'')} aria-hidden="true">{initials(holder||pos)}</span>
                    <span className="cs-member-t"><b>{holder||pos}</b>{holder?<span>{pos}</span>:null}</span>
                    <span className={'cs-type '+(m.role==='Chair'?'':m.role==='Facilitator'?'green':'adhoc')}>{m.role}</span>
                  </div>; })}
                {members.length>MEMBERS_SHOWN
                  ? <p className="cs-card-note">+{members.length-MEMBERS_SHOWN} more — see People.</p> : null}
              </div>}
        </section>

        <section className="cs-card" aria-labelledby="nm-quorum">
          <h2 className="cs-card-title" id="nm-quorum" style={{marginBottom:8}}>Quorum Rules</h2>
          {custom
            ? <p className="cs-card-note">A Custom Meeting has no Setup, so no quorum threshold applies.</p>
            : !f.setup
            ? <p className="cs-card-note">Choose a Setup to see its quorum threshold.</p>
            : quorumPct==null
            ? <p className="cs-card-note">This Setup sets no quorum threshold.</p>
            : <div className="cs-rule">✓ Min {Math.ceil(quorumPct/100*requiredCount)} of {requiredCount} required
                {' '}({quorumPct}%)</div>}
          <p className="cs-card-note" style={{marginTop:8}}>Quorum is measured when attendance is taken — the
            same count the Audit Grid scores.</p>
        </section>

        {!ok && showForm
          ? <section className="cs-card" aria-label="Still needed">
              <h2 className="cs-card-title" style={{marginBottom:6}}>Still needed</h2>
              <p className="cs-card-note">{why.join(' · ')}</p>
            </section>
          : null}
      </div>
    </div>
  </div>;
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
          <div className="wa-mo-r txt"><label>Meeting</label>
            <span className="v">{occCls(occ)}</span></div>
          <div className="wa-mo-r"><label>Date Held</label><span className="v">{fmtD(occ.date)}</span></div>
          <div className="wa-mo-r txt"><label>Recorder</label>
            <span className="v">{P(r.recorder).name}</span></div>
          <div className="wa-mo-r"><label>Submitted</label>
            <span className="v">{rec.submittedAt?fmtD(rec.submittedAt.split(' ')[0]):'—'}</span></div>
          <div className="wa-mo-r txt"><label>Type</label>
            <span className="v">
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

/* Committee Scores, restyled 28 Sep to the approved design
   (`leadership-practice (2).html`, #v-audit). Same data and behaviour as
   before -- every class here is cs-* and styled only by
   leadership-design.css, scoped under .cs-root, so no other screen moves.

   Added with the design: the four filter tabs, the per-row action button and
   Export (CSV of the rows the current tab shows). The "Awaiting Chair" stat
   card was dropped to match the design's four; its count is on its tab. */
const CS_TABS = [
  {id:'scoring',  label:'Awaiting Scoring', test:g=>g.state==='Pending Facilitator Review'||g.state==='Returned for Revision'},
  {id:'chair',    label:'Awaiting Chair',   test:g=>g.state==='Submitted for Approval'},
  {id:'approved', label:'Approved',         test:g=>g.state==='Approved'},
  {id:'all',      label:'All Grids',        test:()=>true, noCount:true},
];
const CS_BADGE = {
  'Pending Facilitator Review':['pending','Pending Facilitator'],
  'Returned for Revision':['returned','Returned'],
  'Submitted for Approval':['chair','Awaiting Chair'],
  'Approved':['approved','Approved'],
  'Void':['void','Void'],
};
/* Downloads a CSV. The object URL is revoked on a delay, not at once: revoking
   it synchronously after click() can cancel the download before the browser
   has read it (the 20 Sep "Excel cannot open the file" lesson). */
function csDownloadCsv(filename, rows){
  const esc = v => { const t = v==null ? '' : String(v); return /[",\n]/.test(t) ? '"'+t.replace(/"/g,'""')+'"' : t; };
  const csv = '﻿' + rows.map(r=>r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 30000);
}

function ScreenGrid(){
  const {dvMeetingOccs,dvGridInstances,openMeeting,dvMinutes=[],dvDecisions=[],S,dvTick}=use();
  const occById = useMemo(()=>{
    const m=new Map(); dvMeetingOccs.forEach(o=>m.set(o.id,o)); return m;
  },[dvMeetingOccs]);
  /* No Committee-vs-Business-Meeting filter here, and since 28 Sep that is
     because there is no such distinction to make: a Grid Instance is created
     on Minutes closure for EVERY meeting. (It previously read the same way for
     the opposite reason -- only accreditation occurrences could produce one.) */
  const list = dvGridInstances.filter(g=>occById.has(g.occurrenceId));
  const approved=list.filter(g=>g.state==='Approved');
  const avg=approved.length?Math.round(approved.reduce((s,g)=>s+g.score,0)/approved.length*10)/10:null;
  const awaitingFac = list.filter(CS_TABS[0].test).length;

  /* null = not chosen yet: open on Awaiting Scoring when there is something
     to score, as the design does, otherwise on All Grids. Deciding lazily
     keeps an empty first render (data still loading) from pinning 'all'. */
  const [tabSel,setTabSel]=useState(null);
  const tab = tabSel || (awaitingFac ? 'scoring' : 'all');
  const tabDef = CS_TABS.find(t=>t.id===tab) || CS_TABS[3];

  const committeeOf = o => {
    const tpl = dvTplDetail(o.templateId);
    return {
      name: dvTpl(o.templateId) || o.name,
      cls: tpl ? (MEETING_SETUP_TYPE[tpl.setupTypeCode] || 'Committee') : 'Ad hoc occurrence',
    };
  };
  /* Coverage (PRO-16). An Approved or frozen Grid shows what was stored when it
     was approved -- history is never recomputed. An open Grid is scored now,
     with exactly what its own Audit Grid tab uses (liveScoreGrid on the live
     occurrence, its Minutes, its Setup, the Grid's manual answers and the
     Decisions register), so the two can never disagree. Void has none.
     -> { pct, covered, total, live } or null */
  const minutesByOcc = useMemo(()=>{
    const m=new Map(); dvMinutes.forEach(x=>{ if(x.occurrenceId) m.set(x.occurrenceId,x); }); return m;
  },[dvMinutes]);
  const coverageById = useMemo(()=>{
    const m=new Map();
    for(const g of dvGridInstances){
      if(g.state==='Void') continue;
      if(g.state==='Approved' || g.frozen){
        if(g.total) m.set(g.id,{pct:Math.round(g.coverage/g.total*1000)/10, covered:g.coverage, total:g.total, live:false});
        continue;
      }
      const o=occById.get(g.occurrenceId); if(!o) continue;
      const tpl=dvTplDetail(o.templateId);
      const accred=(tpl ? MEETING_SETUP_TYPE[tpl.setupTypeCode] : null)==='Accreditation Committee';
      try{
        const t=gridTotals(liveScoreGrid(o, minutesByOcc.get(o.id)||null, tpl?.quorumPct, tpl?.torLink,
                                         accred, S, g, dvMeetingOccs, dvDecisions));
        m.set(g.id,{pct:t.coverage, covered:t.applicable, total:t.total, live:true});
      }catch(e){ console.warn('[Committee Scores] live coverage failed for Grid '+g.id+':', e); }
    }
    return m;
  // dvTick is deliberate: dvTplDetail() reads a module-level map the linter
  // cannot see, and the Setup details (quorum, TOR, Setup Type) load after the Grids.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dvGridInstances,occById,minutesByOcc,dvMeetingOccs,dvDecisions,S,dvTick]);
  const covOf = g => coverageById.get(g.id) || null;

  const rows = list.filter(tabDef.test).slice().sort((a,b)=>
    (occById.get(b.occurrenceId)?.date||'').localeCompare(occById.get(a.occurrenceId)?.date||''));

  const exportCsv = () => {
    const out = [['Committee','Occurrence','Occurrence date','Template','Version','State','Coverage %','Questions covered','Questions total','Coverage basis','Overall score %']];
    rows.forEach(g=>{
      const o = occById.get(g.occurrenceId), c = committeeOf(o), cv = covOf(g);
      out.push([c.name, o.name, o.date||'', g.templateVersion||'', g.version||1, g.state,
        cv?.pct ?? '', cv?.covered ?? '', cv?.total ?? g.total ?? '',
        cv ? (cv.live ? 'Live (not yet approved)' : 'Stored at approval') : '',
        g.state==='Approved' ? g.score : '']);
    });
    csDownloadCsv(`committee-scores-${tabDef.id}-${ymd(new Date())}.csv`, out);
  };

  const autoCount = AG_ACTIVE.filter(q=>q.src==='Auto').length;
  const manualCount = AG_ACTIVE.filter(q=>q.src==='Manual').length;

  return <div className="cs-root">
    <div className="cs-head">
      <h1 className="cs-title">Committee Scores</h1>
      <p className="cs-sub">Governance scores across every meeting occurrence — each instance keeps its own
        score. Committees and Business Meetings are both scored. To work on a Grid, open its Meeting.</p>
      <div className="cs-tabs" role="tablist" aria-label="Filter Grids by state">
        {CS_TABS.map(t=>
          <button key={t.id} type="button" role="tab" aria-selected={tab===t.id}
            className={'cs-tab'+(tab===t.id?' on':'')} onClick={()=>setTabSel(t.id)}>
            {t.label}{!t.noCount && <span className="cs-tab-badge">{list.filter(t.test).length}</span>}
          </button>)}
      </div>
    </div>

    <div className="cs-stats">
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">Approved scores</div>
        <div className="cs-stat-val">{approved.length}</div><div className="cs-stat-meta">published</div></div>
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">Average score</div>
        <div className="cs-stat-val">{avg!=null?avg+'%':'—'}</div><div className="cs-stat-meta">approved Grids only</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">Awaiting Facilitator</div>
        <div className="cs-stat-val">{awaitingFac}</div><div className="cs-stat-meta">questions to score</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Questions</div>
        <div className="cs-stat-val">{AG_ACTIVE.length}</div>
        <div className="cs-stat-meta">{autoCount} automatic · {manualCount} manual</div></div>
    </div>

    <section className="cs-card flush" aria-labelledby="cs-inst">
      <div className="cs-card-top">
        <div className="cs-card-title-grp">
          <span className="cs-icon green" aria-hidden="true"><CheckSquare size={16}/></span>
          <h2 className="cs-card-title" id="cs-inst">Audit Grid Instances</h2>
        </div>
        <button type="button" className="cs-btn" onClick={exportCsv} disabled={!rows.length}>
          <Download size={12}/>Export</button>
      </div>
      {rows.length===0
        ? <div className="cs-empty">{list.length===0
            ? 'No Grids yet. A Grid is created when a meeting’s Minutes are closed.'
            : `No Grids are ${tabDef.label.toLowerCase()}.`}</div>
        : <div className="cs-tbl-wrap"><table className="cs-tbl">
          <thead><tr><th>Committee</th><th>Occurrence</th><th>Template</th><th>State</th>
            <th>Coverage</th><th>Overall score</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{rows.map(g=>{
            const o=occById.get(g.occurrenceId), c=committeeOf(o), cv=covOf(g), cov=cv?.pct ?? null;
            const [bc,bl]=CS_BADGE[g.state]||['void',g.state||'—'];
            const toScore = CS_TABS[0].test(g), toReview = CS_TABS[1].test(g);
            const band = pctColour(cov);
            const open = ()=>openMeeting(o.id,'grid');
            return <tr key={g.id} className="cs-row" tabIndex={0} onClick={open}
                onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); open(); } }}>
              <td><div className="cs-committee">
                <span className="cs-committee-ic" aria-hidden="true"><Shield size={13}/></span>
                <div><div className="cs-name">{c.name}</div><div className="cs-name-sub">{c.cls}</div></div>
              </div></td>
              <td><span className="cs-mono">{fmtD(o.date)}</span></td>
              <td><span className="cs-mono muted">{g.templateVersion||'—'}</span>
                {g.version>1&&<div className="cs-cov-sub">version {g.version}</div>}</td>
              <td><span className={'cs-badge '+bc}><i/>{bl}</span></td>
              <td>{cov!=null
                ? <><div className="cs-cov">
                      <span className="cs-track"><span className={'cs-fill f-'+band} style={{width:cov+'%',display:'block'}}/></span>
                      <span className={'cs-pct c-'+band}>{cov}%</span></div>
                    <div className="cs-cov-sub" title={cv.live
                        ? 'Computed now from the Grid’s answers so far. It becomes final when the Chair approves the Grid.'
                        : 'Stored when the Grid was approved.'}>
                      {cv.covered} of {cv.total} questions{cv.live ? ' · live' : ''}</div></>
                : <><span className="cs-pct c-grey">—</span>
                    <div className="cs-cov-sub">{g.total?`of ${g.total} questions`:'not yet scored'}</div></>}</td>
              <td>{g.state==='Approved'
                ? <span className={'cs-score c-'+pctColour(g.score)}>{g.score}%</span>
                : <span className="cs-pending">Pending Review</span>}</td>
              <td><button type="button" className={'cs-btn'+(toScore?' outline':'')}
                  onClick={e=>{ e.stopPropagation(); open(); }}>
                {toScore?'Score':toReview?'Review':'View'}</button></td>
            </tr>;})}
          </tbody></table></div>}
    </section>

    <section className="cs-card" aria-labelledby="cs-hist">
      <div className="cs-card-top"><div className="cs-card-title-grp">
        <span className="cs-icon gold" aria-hidden="true"><Activity size={16}/></span>
        <h2 className="cs-card-title" id="cs-hist">Score History by Committee</h2></div></div>
      <p className="cs-card-note">Approved Grids only. An approved Grid is never recomputed — later changes to
        settings or the Template cannot rewrite history.</p>
      {(()=>{
        const byTpl = new Map();
        list.forEach(g=>{
          const o=occById.get(g.occurrenceId); if(!o) return;
          const key=o.templateId||'(ad hoc)';
          if(!byTpl.has(key)) byTpl.set(key,[]);
          byTpl.get(key).push(g);
        });
        const groups=[...byTpl.entries()].sort((a,b)=>(dvTpl(a[0])||'').localeCompare(dvTpl(b[0])||''));
        if(!groups.length) return <div className="cs-empty">No Grids yet.</div>;
        return groups.map(([tplId,gs])=>{
          const sorted=gs.slice().sort((a,b)=>
            (occById.get(a.occurrenceId)?.date||'').localeCompare(occById.get(b.occurrenceId)?.date||''));
          const first=occById.get(sorted[0].occurrenceId), c=committeeOf(first);
          return <div className="cs-hist-grp" key={tplId}>
            <div className="cs-hist-hd">
              <span className="cs-hist-name">{dvTpl(tplId)||'Ad hoc occurrences'}</span>
              <span className="cs-hist-cls">{c.cls}</span></div>
            <div className="cs-hist-bars">{sorted.map(g=>{
              const o=occById.get(g.occurrenceId);
              const pub=g.state==='Approved';
              const band = pub ? pctColour(g.score) : 'grey';
              return <div className="cs-hist-bar" key={g.id} title={o.name+' · '+fmtD(o.date)}>
                <div className="cs-hist-col"><i className={'f-'+band}
                  style={{height:Math.max(8,(pub?g.score:16)*0.6)+'px'}}/></div>
                <div className={'cs-hist-val c-'+band}>{pub?g.score+'%':'—'}</div>
                <div className="cs-hist-date">{fmtDS(o.date)}</div></div>;})}
            </div>
          </div>;});
      })()}
    </section>

    <section className="cs-card" aria-labelledby="cs-cat">
      <div className="cs-card-top"><div className="cs-card-title-grp">
        <span className="cs-icon amber" aria-hidden="true"><FileText size={16}/></span>
        <h2 className="cs-card-title" id="cs-cat">Question Catalogue</h2></div></div>
      <p className="cs-card-note">Owned by Taxonomy — {AG_TEMPLATE_VERSION}. Leadership Practice retrieves the
        Template and its questions and never creates or modifies them. Every question is scored 0–5, and all
        weights are 1, so question count is the effective weighting.</p>
      <div className="cs-tbl-wrap"><table className="cs-tbl cs-cat">
        <thead><tr><th>Category</th><th>Questions</th><th>Share</th><th>Auto</th><th>Manual</th></tr></thead>
        <tbody>{AG_CATEGORIES.map(c=>{
          const qs=AG_ACTIVE.filter(q=>q.cat===c);
          const a=qs.filter(q=>q.src==='Auto').length, m=qs.filter(q=>q.src==='Manual').length;
          return <tr key={c}><td className="cs-name">{c}</td>
            <td><span className="cs-mono muted">{qs.map(q=>q.id).join(', ')}</span></td>
            <td><span className="cs-mono">{Math.round(qs.length/AG_ACTIVE.length*100)}%</span></td>
            <td><span className={'cs-mono '+(a?'c-green':'c-grey')}>{a}</span></td>
            <td><span className={'cs-mono '+(m?'c-amber':'c-grey')}>{m}</span></td></tr>;})}
          <tr className="cs-total"><td className="cs-name">Total</td>
            <td><span className="cs-mono">{AG_ACTIVE.length} active questions</span></td>
            <td><span className="cs-mono">100%</span></td>
            <td><span className="cs-mono c-green">{autoCount}</span></td>
            <td><span className="cs-mono c-amber">{manualCount}</span></td></tr>
        </tbody></table></div>
      <div className="cs-retired"><Lock size={12} aria-hidden="true"/>
        <span><b>AG-07 is retired.</b> {AGQ('AG-07').rule} The identifier is kept and not reused, so history
          stays traceable.</span></div>
    </section>
  </div>;
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
  /* Keyed on the STATE, matching the live grid: any question a person scored
     by hand needs its evidence note, not only the ones declared Manual in the
     template. The two paths disagreeing about the rules is what §7's open
     decision 1 was about. */
  const blanks = rows.filter(r=>r.state==='blank');
  const missingEv = rows.filter(r=>r.state==='manual' && !(rec.evidence||{})[r.id]);
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

/* The Decision register (28 Sep): the live wlog_decisions rows (IT), each with
   where it was taken -- a report section (lm_CitedReportSection) or a meeting
   agenda item (lm_MeetingOccurrenceAgenda). Decisions are raised or attached
   there too (DecisionLink.jsx), so this is the one list of all of them.

   The seeded Authority-Matrix register (db.decisions, DecisionIntakeModal,
   DecisionDetail) is no longer shown here: its tables do not exist in IT. Its
   detail page still opens when another screen links to a seeded decision
   (go('dec', id)), so those links keep working. */
function ScreenDecisions(){
  const {db,me,sel,setSel,dvDecisions,dvReportOccs,dvMeetingOccs,openDvRec,openMeeting,dvLoading}=use();
  const [logging,setLogging]=useState(false);
  const [linking,setLinking]=useState(null);       // a decision to link, or null
  const [fSt,setFSt]=useState('All'), [fSrc,setFSrc]=useState('All'), [fRv,setFRv]=useState('All');
  const [q,setQ]=useState('');
  const [open,setOpen]=useState(null);
  const [sections,setSections]=useState(new Map()); // sectionId -> {heading, reportId}

  /* Name each linked report section and find its report: the decision row
     carries only the section id. Read once per set of ids. */
  const sectionKey = [...new Set(dvDecisions.map(d=>d.sectionId).filter(Boolean))].sort().join(',');
  useEffect(()=>{
    if(!sectionKey) return;
    let live=true;
    fetchReportSectionsByIds(sectionKey.split(','))
      .then(m=>{ if(live) setSections(m); })
      .catch(e=>console.warn('[dataverse] fetchReportSectionsByIds() failed:', e));
    return ()=>{ live=false; };
  },[sectionKey]);

  const seeded = db.decisions.filter(d=>canSeeDec(d,me)).find(d=>d.id===sel.dec);
  if(seeded) return <DecisionDetail rec={seeded} back={()=>setSel(v=>({...v,dec:null}))}/>;

  /* agenda item -> its meeting occurrence, from the meetings already loaded */
  const occByAgenda = new Map();
  (dvMeetingOccs||[]).forEach(o=>(o.agenda||[]).forEach(a=>occByAgenda.set(a.id,{occ:o, item:a})));

  const sourceOf = d => {
    if(d.sectionId){
      const sec = sections.get(d.sectionId);
      const rpt = sec && (dvReportOccs||[]).find(r=>r.id===sec.reportId);
      return { kind:'report', label: rpt?.name || sec?.reportName || 'A report',
               sub: sec?.heading || d.sectionName || 'a section',
               open: rpt ? ()=>openDvRec('Report', rpt) : null };
    }
    if(d.agendaItemId){
      const hit = occByAgenda.get(d.agendaItemId);
      return { kind:'meeting', label: hit?.occ.name || 'A meeting',
               sub: [hit?.occ.date ? fmtDS(hit.occ.date) : null, hit?.item.title || d.agendaItemName || 'an agenda item']
                      .filter(Boolean).join(' · '),
               open: hit ? ()=>openMeeting(hit.occ.id,'minutes') : null };
    }
    return { kind:'none', label: d.workLog ? 'Work Log' : 'Not linked', sub: d.workLog || null, open: null };
  };

  const statuses = [...new Set(dvDecisions.map(d=>d.status).filter(Boolean))].sort();
  const reviews  = [...new Set(dvDecisions.map(d=>d.reviewStatus).filter(Boolean))].sort();
  const fromReport  = dvDecisions.filter(d=>d.sectionId);
  const fromMeeting = dvDecisions.filter(d=>d.agendaItemId);
  const unlinked    = dvDecisions.filter(d=>!d.sectionId && !d.agendaItemId);

  const rows = dvDecisions.filter(d=>{
    if(fSt!=='All' && d.status!==fSt) return false;
    if(fRv!=='All' && d.reviewStatus!==fRv) return false;
    if(fSrc==='report'  && !d.sectionId) return false;
    if(fSrc==='meeting' && !d.agendaItemId) return false;
    if(fSrc==='none'    && (d.sectionId || d.agendaItemId)) return false;
    const src = sourceOf(d);
    return matchesQuery(q,[d.name,d.decisionTaken,d.expectedOutput,d.managerNote,d.workLog,
      d.reviewer,d.reviewerUser,src.label,src.sub]);
  });
  const filtered = fSt!=='All'||fSrc!=='All'||fRv!=='All'||q;

  return <div className="cs-root">
    <div className="cs-head">
      <div className="cs-head-top">
        <div><h1 className="cs-title">Decisions</h1>
          <p className="cs-sub">Every Decision, and where it was taken — a report section or a meeting’s agenda
            item. Raise or attach one there, or log it here.</p></div>
        <button type="button" className="cs-btn primary lg" onClick={()=>setLogging(true)}>
          <Plus size={13}/>Log a Decision</button>
      </div>
      <div className="cs-tabs" role="tablist" aria-label="Filter Decisions by status">
        {['All',...statuses].map(k=>
          <button key={k} type="button" role="tab" aria-selected={fSt===k}
            className={'cs-tab'+(fSt===k?' on':'')} onClick={()=>setFSt(k)}>
            {k==='All'?'All Decisions':k}
            {k!=='All' && <span className="cs-tab-badge">{dvDecisions.filter(d=>d.status===k).length}</span>}
          </button>)}
      </div>
    </div>

    <div className="cs-stats">
      <div className="cs-stat acc-gold"><div className="cs-stat-lbl">Decisions</div>
        <div className="cs-stat-val">{dvDecisions.length}</div><div className="cs-stat-meta">logged</div></div>
      <div className="cs-stat acc-green"><div className="cs-stat-lbl">From a report</div>
        <div className="cs-stat-val">{fromReport.length}</div><div className="cs-stat-meta">taken on a section</div></div>
      <div className="cs-stat acc-amber"><div className="cs-stat-lbl">From a meeting</div>
        <div className="cs-stat-val">{fromMeeting.length}</div><div className="cs-stat-meta">taken on an agenda item</div></div>
      <div className="cs-stat acc-alert"><div className="cs-stat-lbl">Not linked</div>
        <div className="cs-stat-val">{unlinked.length}</div><div className="cs-stat-meta">no report or meeting yet</div></div>
    </div>

    <div className="cs-chips" role="group" aria-label="Filter Decisions by where they were taken">
      {[['All','All',Layers],['report','From a report',FileText],['meeting','From a meeting',Users],
        ['none','Not linked',CircleAlert]].map(([k,l,Ic])=>
        <button key={k} type="button" aria-pressed={fSrc===k}
          className={'cs-chip'+(fSrc===k?' on':'')} onClick={()=>setFSrc(k)}>
          <Ic size={11} aria-hidden="true"/>{l}</button>)}
      <div className="cs-search cs-chips-end" style={{flexWrap:'wrap'}}>
        <select className="cs-select" value={fRv} onChange={e=>setFRv(e.target.value)} aria-label="Review status">
          {['All',...reviews].map(x=><option key={x} value={x}>{x==='All'?'Review: any':x}</option>)}</select>
        <input type="search" placeholder="Search decisions…" value={q} onChange={e=>setQ(e.target.value)}
          aria-label="Search decisions" style={{width:190}}/>
        {filtered && <button type="button" className="cs-btn"
          onClick={()=>{setFSt('All');setFSrc('All');setFRv('All');setQ('');}}>
          <RotateCcw size={11}/>Clear</button>}
      </div>
    </div>

    <section className="cs-card flush" aria-labelledby="dec-reg">
      <div className="cs-card-top">
        <div className="cs-card-title-grp">
          <span className="cs-icon amber" aria-hidden="true"><ClipboardList size={16}/></span>
          <div><h2 className="cs-card-title" id="dec-reg">Decision Register</h2>
            <div className="cs-card-note">{rows.length} of {dvDecisions.length}. Read from the Work Log
              Decisions table in IT.</div></div>
        </div>
      </div>
      {dvLoading && !dvDecisions.length ? <div className="cs-empty">Reading from Dataverse…</div>
      : rows.length===0 ? <div className="cs-empty">{dvDecisions.length?'No Decision matches these filters.':'No Decisions logged yet.'}</div>
      : <div className="cs-tbl-wrap"><table className="cs-tbl dense" style={{minWidth:860}}>
          <thead><tr><th>Decision</th><th>Taken in</th><th>Status</th><th>Review</th><th>Logged</th>
            <th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map(d=>{
            const src = sourceOf(d);
            const isOpen = open===d.id;
            const toggle = ()=>setOpen(isOpen?null:d.id);
            return <React.Fragment key={d.id}>
              <tr className="cs-row" tabIndex={0} aria-expanded={isOpen} onClick={toggle}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); toggle(); } }}>
                <td><div className="cs-name">{d.name}</div>
                  {d.decisionTaken
                    ? <div className="cs-name-sub">{d.decisionTaken.slice(0,90)}{d.decisionTaken.length>90?'…':''}</div>
                    : null}</td>
                <td><span className={'cs-type'+(src.kind==='report'?'':src.kind==='meeting'?' green':' adhoc')}>
                    {src.kind==='report'?'Report':src.kind==='meeting'?'Meeting':src.label}</span>
                  {src.kind!=='none'
                    ? <><div className="cs-name" style={{fontWeight:500,marginTop:3}}>{src.label}</div>
                        <div className="cs-name-sub">{src.sub}</div></>
                    : src.sub ? <div className="cs-name-sub">{src.sub}</div> : null}</td>
                <td>{d.status
                  ? <span className={'cs-badge '+(d.status==='Completed'?'approved':d.status==='Escalated'?'pending':'scheduled')}>
                      <i/>{d.status}</span> : '—'}</td>
                <td>{d.reviewStatus||'—'}{d.reviewer ? <div className="cs-name-sub">{d.reviewer}</div> : null}</td>
                <td><span className="cs-mono muted">{fmtISODT(d.created)}</span></td>
                <td style={{whiteSpace:'nowrap'}}>
                  {src.open
                    ? <button type="button" className="cs-btn" onClick={e=>{ e.stopPropagation(); src.open(); }}>
                        Open {src.kind==='report'?'report':'minutes'}</button>
                    : null}
                  {' '}<button type="button" className="cs-btn" onClick={e=>{ e.stopPropagation(); setLinking(d); }}>
                    {src.kind==='none'?'Link…':'Move…'}</button></td>
              </tr>
              {isOpen ? <tr className="cs-expand"><td colSpan={6}>
                <div className="cs-kv">
                  {[['Decision taken',d.decisionTaken],['Expected output',d.expectedOutput],
                    ['Manager note',d.managerNote],['Work Log',d.workLog],
                    ['Reviewer',[d.reviewer,d.reviewerUser].filter(Boolean).join(' · ')],
                    ['Reviewed on',fmtISODT(d.reviewedOn)]].filter(([,v])=>v).map(([k,v])=>
                    <div key={k}><span className="cs-lbl">{k}</span><div className="cs-kv-v">{v}</div></div>)}
                  {d.evidenceUrl
                    ? <div><span className="cs-lbl">Evidence</span><div className="cs-kv-v">
                        <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer">{d.evidenceUrl}</a></div></div>
                    : null}
                  {(d.escalatedOn||d.escalationReason||d.escalationResult||d.escalatedToUser)
                    ? <div style={{borderTop:'1px solid var(--cs-border)',paddingTop:7}}>
                        <span className="cs-lbl">Escalation</span>
                        <div className="cs-kv-v">{[d.escalatedToUser&&('to '+d.escalatedToUser),
                          d.escalatedOn&&('on '+fmtISODT(d.escalatedOn)),d.escalationResult].filter(Boolean).join(' · ')||'—'}</div>
                        {d.escalationReason ? <div className="cs-name-sub" style={{fontSize:11}}>{d.escalationReason}</div> : null}
                        {d.escalationReply ? <div className="cs-kv-v">↳ {d.escalationReply}</div> : null}
                      </div>
                    : null}
                </div></td></tr> : null}
            </React.Fragment>;})}
          </tbody></table></div>}
    </section>

    {logging && <WorkLogDecisionModal onClose={()=>setLogging(false)}/>}
    {linking && <WorkLogDecisionModal decision={linking} onClose={()=>setLinking(null)}/>}
  </div>;
}

/* Logs a new wlog_decisions row, or -- given `decision` -- links an existing one.
   "Where was it taken" picks a report and one of its sections, or a meeting and
   one of its agenda items; the same two lookups DecisionLink.jsx writes. */
function WorkLogDecisionModal({onClose, decision}){
  const {toast,refreshOccurrences,dvReportOccs,dvMeetingOccs}=use();
  const linkOnly = !!decision;
  const [f,setF]=useState({name:'',decisionTaken:'',expectedOutput:'',managerNote:'',evidenceUrl:'',
    where: decision?.agendaItemId ? 'meeting' : decision?.sectionId ? 'report' : (linkOnly?'report':'none'),
    reportId:'', sectionId:'', meetingId:'', agendaItemId:''});
  const [saving,setSaving]=useState(false);
  const [secs,setSecs]=useState(null);               // sections of the chosen report, null while reading
  const set=(k,v)=>setF(x=>({...x,[k]:v}));

  useEffect(()=>{
    if(!f.reportId){ setSecs(null); return; }
    let live=true; setSecs(null);
    fetchReportOccurrenceForEdit(f.reportId)
      .then(rows=>{ if(live) setSecs(rows||[]); })
      .catch(e=>{ console.warn('[dataverse] fetchReportOccurrenceForEdit() failed:', e); if(live) setSecs([]); });
    return ()=>{ live=false; };
  },[f.reportId]);

  const reports  = (dvReportOccs||[]).slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const meetings = (dvMeetingOccs||[]).filter(o=>(o.agenda||[]).length)
    .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const meeting  = meetings.find(o=>o.id===f.meetingId);
  const target = f.where==='report' ? (f.sectionId ? {sectionId:f.sectionId} : null)
    : f.where==='meeting' ? (f.agendaItemId ? {agendaItemId:f.agendaItemId} : null) : {};
  const ok = (linkOnly || (f.name.trim() && f.decisionTaken.trim())) && !!target
    && (!linkOnly || Object.keys(target).length);

  const save=async()=>{
    setSaving(true);
    try{
      const {id,errors} = linkOnly
        ? await linkWorkLogDecision(decision.id, target)
        : await createWorkLogDecision({
            name:f.name.trim(), decisionTaken:f.decisionTaken.trim(),
            expectedOutput:f.expectedOutput.trim()||undefined,
            managerNote:f.managerNote.trim()||undefined,
            evidenceUrl:f.evidenceUrl.trim()||undefined,
            ...target,
          });
      if(!id){
        console.warn('[dataverse] '+(linkOnly?'linkWorkLogDecision':'createWorkLogDecision')+'() failed:', errors);
        toast('Not saved',(linkOnly?'Linking':'Logging')+' this Decision failed. Check the console for details.','err');
        return;
      }
      toast(linkOnly?'Decision linked':'Decision logged',
        f.where==='none' ? 'Not linked to a report or meeting — link it later from the register.'
          : `Linked to the ${f.where==='report'?'report section':'agenda item'} chosen.`,'ok');
      await refreshOccurrences();
      onClose();
    }catch(e){
      console.warn('[dataverse] decision save threw unexpectedly:', e);
      toast('Not saved','Saving this Decision failed. Check the console for details.','err');
    }finally{ setSaving(false); }
  };

  return <Modal title={linkOnly?`Link “${decision.name}”`:'Log a Decision'} onClose={onClose}
    sub={linkOnly ? 'Where was it taken? A decision holds one report section and one agenda item — choosing another moves it.'
                  : 'Record the decision, and where it was taken.'}
    footer={<><Btn onClick={onClose} disabled={saving}>Cancel</Btn>
      <Btn k="pri" disabled={!ok||saving} onClick={save}>{saving?'Saving…':linkOnly?'Link Decision':'Log Decision'}</Btn></>}>
    {!linkOnly && <>
      <Field label="Title" req err={!f.name.trim()?'Required.':null}>
        <input type="text" value={f.name} onChange={e=>set('name',e.target.value)} maxLength={100}
          placeholder="A short, identifying title"/></Field>
      <Field label="Decision Taken" req err={!f.decisionTaken.trim()?'Required.':null}>
        <textarea rows={3} value={f.decisionTaken} onChange={e=>set('decisionTaken',e.target.value)} maxLength={4000}/></Field>
      <Field label="Expected Output">
        <textarea rows={2} value={f.expectedOutput} onChange={e=>set('expectedOutput',e.target.value)} maxLength={1000}/></Field>
    </>}

    <Field label="Where was it taken?">
      <Pills opts={linkOnly ? ['A report section','A meeting agenda item']
                            : ['Not linked','A report section','A meeting agenda item']}
        val={f.where==='report'?'A report section':f.where==='meeting'?'A meeting agenda item':'Not linked'}
        onChange={v=>setF(x=>({...x, where: v==='A report section'?'report':v==='A meeting agenda item'?'meeting':'none',
          reportId:'', sectionId:'', meetingId:'', agendaItemId:''}))}/></Field>

    {f.where==='report' && <div className="f-row">
      <Field label="Report" req>
        <select value={f.reportId} onChange={e=>setF(x=>({...x, reportId:e.target.value, sectionId:''}))}>
          <option value="">{reports.length?'Select…':'No reports loaded'}</option>
          {reports.map(r=><option key={r.id} value={r.id}>{r.name}{r.period?` — ${fmtP(r.period)}`:''}</option>)}
        </select></Field>
      <Field label="Section" req>
        <select value={f.sectionId} disabled={!f.reportId || secs===null} onChange={e=>set('sectionId',e.target.value)}>
          <option value="">{!f.reportId?'Choose a report first':secs===null?'Reading sections…':secs.length?'Select…':'This report has no sections'}</option>
          {(secs||[]).map(s=><option key={s.id} value={s.id}>{s.heading||'(untitled section)'}</option>)}
        </select></Field>
    </div>}

    {f.where==='meeting' && <div className="f-row">
      <Field label="Meeting" req>
        <select value={f.meetingId} onChange={e=>setF(x=>({...x, meetingId:e.target.value, agendaItemId:''}))}>
          <option value="">{meetings.length?'Select…':'No meetings with an agenda loaded'}</option>
          {meetings.map(o=><option key={o.id} value={o.id}>{o.name}{o.date?` — ${fmtDS(o.date)}`:''}</option>)}
        </select></Field>
      <Field label="Agenda item" req>
        <select value={f.agendaItemId} disabled={!meeting} onChange={e=>set('agendaItemId',e.target.value)}>
          <option value="">{meeting?'Select…':'Choose a meeting first'}</option>
          {(meeting?.agenda||[]).map(a=><option key={a.id} value={a.id}>{(a.seq??'')+(a.seq!=null?'. ':'')}{a.title||'(untitled item)'}</option>)}
        </select></Field>
    </div>}

    {!linkOnly && <>
      <Field label="Manager Note">
        <textarea rows={2} value={f.managerNote} onChange={e=>set('managerNote',e.target.value)} maxLength={2000}/></Field>
      <Field label="Based On / Evidence">
        <input type="text" value={f.evidenceUrl} onChange={e=>set('evidenceUrl',e.target.value)} maxLength={500}
          placeholder="A link or reference"/></Field>
    </>}
  </Modal>;
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

export default App;
