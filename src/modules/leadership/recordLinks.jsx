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

   <OpenRecord> checks first that the reader can open it (checkRecordAccess()
   in dataverse.js: the record, then the app's security roles) and, when they
   cannot, says so here instead of sending them to Dataverse's error page.

   BI reports and cited reports are not here: they already open in this app
   (the BI viewer, and Reports / Plans).
   ========================================================================= */
import React, { useState } from 'react';
import { use } from './store.jsx';
import { Btn } from '../../shared/ui.jsx';
import { IT_ORG } from '../../services/xenv.js';
import { checkRecordAccess } from '../../services/dataverse.js';

const APP = {
  strategy: 'fab3af08-40ba-4780-8cf8-6fee1f0aa9ef',   // Strategy Formulation
  process:  'f78ba984-5691-4bbc-b9bb-d2c581396425',   // Process Hub
  project:  '444e23d3-757b-4b59-876a-6ad20588b411',   // Project Module
  tms:      '6dbdb1b3-d3d0-4482-9f32-0eb6f3a37391',   // TMS App
};

/* citation kind -> table logical name, entity set, primary key, app id or null, app name */
const TARGET = {
  KPI:       { etn:'strategy_kpis',     set:'strategy_kpises',     pk:'strategy_kpisid',     appId:APP.strategy, app:'Strategy Formulation' },
  Breakdown: { etn:'strategy_kpis',     set:'strategy_kpises',     pk:'strategy_kpisid',     appId:APP.strategy, app:'Strategy Formulation' },
  Strategy:  { etn:'strategy_strategy', set:'strategy_strategies', pk:'strategy_strategyid', appId:APP.strategy, app:'Strategy Formulation' },
  Process:   { etn:'strategy_process',  set:'strategy_processes',  pk:'strategy_processid',  appId:APP.process,  app:'Process Hub' },
  Project:   { etn:'cr603_projects',    set:'cr603_projectses',    pk:'cr603_projectsid',    appId:APP.project,  app:'Project Module' },
  Task:      { etn:'hx_tasks',          set:'hx_taskses',          pk:'hx_tasksid',          appId:APP.tms,      app:'TMS App' },
  POC:       { etn:'stf_strategypoc',   set:'stf_strategypocs',    pk:'stf_strategypocid',   appId:null,         app:'Dataverse' },
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
  const q = new URLSearchParams({ pagetype: 'entityrecord', etn: t.etn, id });
  if(t.appId) q.set('appid', t.appId);
  return { url: `${IT_ORG}/main.aspx?${q.toString()}`, app: t.app };
}

const noun = kind => kind === 'Breakdown' ? 'KPI' : kind;

/* What to tell a reader who can't open it -> [title, message] */
function refusal(state, kind, app){
  const k = noun(kind);
  if(state === 'noApp')
    return [`You don't have access to ${app}`,
      `This ${k} lives in ${app}, and none of your security roles gives you access to that app. Ask IT to give you access to ${app}.`];
  if(state === 'missing')
    return [`This ${k} no longer exists`,
      `It may have been deleted in ${app}. The citation still names it, but there is nothing to open.`];
  return [`You can't open this ${k}`,
    `You don't have permission to read this ${k}${app === 'Dataverse' ? '' : ' in ' + app}. Ask its owner or IT for access.`];
}

/** A button (or, with asLink, a text link) that opens the record after
 *  checking the reader can. Renders nothing when there is nothing to open. */
export function OpenRecord({ kind, id, label, asLink = false, style }){
  const { toast } = use();
  const [busy, setBusy] = useState(false);
  const link = recordUrl(kind, id);
  if(!link) return null;
  const t = TARGET[kind];

  const open = async () => {
    if(busy) return;
    /* Opened NOW, inside the click: a tab opened after the access check has
       awaited is treated as a pop-up and blocked. It is pointed at the record
       once the check passes, or closed if it fails. */
    const win = window.open('', '_blank');
    try{
      if(win){ win.opener = null; win.document.title = 'Opening…';
               win.document.body.textContent = `Checking your access to this ${noun(kind)}…`; }
    }catch{ /* a cross-origin blank can refuse this; harmless */ }
    setBusy(true);
    let res;
    try{ res = await checkRecordAccess({ entitySet: t.set, pkField: t.pk, id, appId: t.appId }); }
    catch(e){ console.warn('[recordLinks] access check failed, opening anyway:', e); res = { state: 'unknown' }; }
    finally{ setBusy(false); }

    if(res.state === 'ok' || res.state === 'unknown'){
      if(win) win.location.href = link.url;
      else window.open(link.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if(win) win.close();
    const [title, msg] = refusal(res.state, kind, link.app);
    toast(title, msg, res.state === 'missing' ? 'warn' : 'err');
  };

  const text = busy ? 'Checking access…' : (label || `Open in ${link.app} ↗`);
  const title = `Open this ${noun(kind)} in ${link.app}, in a new tab`;
  return asLink
    ? <a role="button" tabIndex={0} title={title} aria-busy={busy}
        style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', cursor: busy ? 'progress' : 'pointer', ...style }}
        onClick={open} onKeyDown={e => { if(e.key === 'Enter') open(); }}>{text}</a>
    : <Btn k="sm" title={title} disabled={busy} onClick={open} style={style}>{text}</Btn>;
}
