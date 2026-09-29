/* =========================================================================
   Every reference opens the real object (Leadership Practice Extension:
   "a reference that doesn't do this is not a reference", 29 Sep).

   A citation stores the id of a record that lives in another IT app -- a KPI,
   Strategy, Process, Project, Task or POC. recordUrl() builds the link that
   opens that record's own form in the model-driven app it belongs to, read
   from IT's app components (appmodulecomponent, 29 Sep):

     strategy_kpis, strategy_strategy -> Strategy Formulation
     strategy_process                 -> Process Hub
     cr603_projects                   -> Project Module
     hx_tasks                         -> TMS App
     stf_strategypoc                  -> in no app; opened without an appid,
                                         so Dataverse picks the default form

   BI reports and cited reports are not here: they already open in this app
   (the BI viewer, and Reports / Plans).
   ========================================================================= */
import { IT_ORG } from '../../services/xenv.js';

const APP = {
  strategy: 'fab3af08-40ba-4780-8cf8-6fee1f0aa9ef',   // Strategy Formulation
  process:  'f78ba984-5691-4bbc-b9bb-d2c581396425',   // Process Hub
  project:  '444e23d3-757b-4b59-876a-6ad20588b411',   // Project Module
  tms:      '6dbdb1b3-d3d0-4482-9f32-0eb6f3a37391',   // TMS App
};

/* citation kind -> [table logical name, app id or null, the source app's name] */
const TARGET = {
  KPI:       ['strategy_kpis',     APP.strategy, 'Strategy Formulation'],
  Breakdown: ['strategy_kpis',     APP.strategy, 'Strategy Formulation'],
  Strategy:  ['strategy_strategy', APP.strategy, 'Strategy Formulation'],
  Process:   ['strategy_process',  APP.process,  'Process Hub'],
  Project:   ['cr603_projects',    APP.project,  'Project Module'],
  Task:      ['hx_tasks',          APP.tms,      'TMS App'],
  POC:       ['stf_strategypoc',   null,         'Dataverse'],
};

/* The id a citation points at, for the kinds above. */
export const citationRecordId = c =>
    c.kind === 'KPI' || c.kind === 'Breakdown' ? c.kpiId
  : c.kind === 'Strategy' ? c.strategyId
  : c.kind === 'Process'  ? c.processId
  : c.kind === 'Project'  ? c.projectId
  : c.kind === 'Task'     ? c.taskId
  : c.kind === 'POC'      ? c.pocId
  : null;

/** -> { url, app } for a record of that kind, or null when there is nothing to open. */
export function recordUrl(kind, id){
  const t = TARGET[kind];
  if(!t || !id) return null;
  const [etn, appid, app] = t;
  const q = new URLSearchParams({ pagetype: 'entityrecord', etn, id });
  if(appid) q.set('appid', appid);
  return { url: `${IT_ORG}/main.aspx?${q.toString()}`, app };
}

/** Opens the record in a new tab. */
export function openRecord(kind, id){
  const r = recordUrl(kind, id);
  if(r) window.open(r.url, '_blank', 'noopener,noreferrer');
  return !!r;
}
