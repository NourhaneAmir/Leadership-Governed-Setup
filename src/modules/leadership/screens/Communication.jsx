/* =========================================================================
   ARTIFACT · ScreenComms -- "Communication & execution"

   The Extension prototype's third nav group, the one the readiness review
   found had no counterpart here at all. Three tabs, as it has them:

     Inbox   reports other people sent to me
     Sent    reports I sent
     Tasks   what I am accountable for, and what I raised

   WHERE THE DATA COMES FROM, and what that changes.

   The prototype runs Inbox and Sent on a seeded COMMS array: free-text
   messages with a kind (escalation, supersede, informational), a body, and an
   action button per message. None of that has a table in this app.

   Rather than port invented messages, both tabs are built on the record the
   app already keeps of one person sending a report to another --
   lm_reportoccurrenceshare. That is a real Inbox and a real Sent. What it is
   not is a messaging system: there is no body text and no per-message action,
   because a share does not carry either. Inventing a taxonomy the data cannot
   support would make the tab read as richer than it is.

   Tasks is hx_tasks, the same table Build a report/plan cites and raises
   into, so a task raised here is the same record a citation points at.
   ========================================================================= */
import React, { useState, useEffect } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Empty, Note, Combo } from '../../../shared/ui.jsx';
import { fmtD, fmtP, TODAY } from '../../../shared/format.js';
import { matchesQuery } from '../domain.jsx';
import { NewTaskForm } from './BuildReport.jsx';
import { fetchReportShares, shareReportOccurrence, fetchTasks,
         fetchAssignableUsers } from '../../../services/dataverse.js';

const TABS = ['Inbox', 'Sent', 'Tasks'];

/* A task is "open" when it is neither closed nor cancelled. The status option
   set carries seven values across four prefixes, so the closed ones are named
   rather than the open ones -- anything new a team adds counts as open, which
   is the safer way round for a work list. */
const DONE = new Set(['Closed', 'Cancelled', 'Rejected']);

export function ScreenComms(){
  const {currentUser, dvReportOccs, openDvRec, toast} = use();
  const me = currentUser?.systemUserId || null;

  const [tab, setTab]       = useState('Inbox');
  const [shares, setShares] = useState(null);
  const [tasks, setTasks]   = useState(null);
  const [q, setQ]           = useState('');
  const [mineOnly, setMineOnly] = useState(true);
  const [raising, setRaising]   = useState(false);
  const [sharing, setSharing]   = useState(false);
  const [tick, setTick]         = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetchReportShares().catch(e => {
        console.warn('[dataverse] fetchReportShares() failed:', e); return []; }),
      fetchTasks().catch(e => {
        console.warn('[dataverse] fetchTasks() failed:', e); return []; }),
    ]).then(([s, t]) => { if(live){ setShares(s); setTasks(t); } });
    return () => { live = false; };
  }, [tick]);

  const loading = shares === null || tasks === null;
  const reports = dvReportOccs || [];

  const inbox = (shares || []).filter(s => me && s.toUserId === me);
  const sent  = (shares || []).filter(s => me && s.fromUserId === me);
  /* A task is mine when it is assigned to me. "Everyone's" is offered because
     a lead needs to see what they raised for other people too. */
  const myTasks = (tasks || []).filter(t => !mineOnly || (me && t.assigneeId === me));

  const hit = rows => rows.filter(r => matchesQuery(q, [
    r.reportName, r.name, r.toUserName, r.fromUserName, r.status, r.assigneeName]));

  const openReport = id => {
    const r = reports.find(x => x.id === id);
    if(r) openDvRec('Report', r);
    else toast('Not loaded', 'That report is not in the loaded set, so it cannot be opened here.', 'err');
  };

  const counts = { Inbox: inbox.length, Sent: sent.length,
                   Tasks: (tasks || []).filter(t => !DONE.has(t.status)).length };

  return <>
    <div className="ph"><h1>Communication &amp; execution</h1>
      <div className="sub">What was sent to you, what you sent, and what you are accountable for.
        Reports move between people as shares; work moves as tasks.</div></div>

    {!me
      ? <Note k="warn" ic="⚠">You are not linked to a Dataverse user in this session, so Inbox and
          Sent cannot tell your rows from anyone else's. Tasks still lists everything.</Note>
      : null}

    <div className="card" style={{padding:14}}>
      <div className="seg-ctl" role="group" aria-label="Section">
        {TABS.map(t =>
          <button type="button" key={t} className={tab===t?'on':''} aria-pressed={tab===t}
            onClick={()=>setTab(t)}>{t}
            {counts[t] ? <span className="nb-badge" style={{marginLeft:6}}>{counts[t]}</span> : null}
          </button>)}
      </div>
      <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
        <input type="search" value={q} onChange={e=>setQ(e.target.value)}
          placeholder={tab==='Tasks' ? 'Search tasks…' : 'Search reports and people…'}
          style={{flex:'1 1 220px',border:'1px solid var(--border-d)',borderRadius:8,
                  padding:'6px 9px',fontSize:12.5}}/>
        {tab==='Tasks'
          ? <>
              <Btn k={'sm'+(mineOnly?' pri':'')} onClick={()=>setMineOnly(m=>!m)}>
                {mineOnly?'Mine':'Everyone’s'}</Btn>
              <Btn k="sm pri" onClick={()=>setRaising(true)}>+ Raise a task</Btn>
            </>
          : <Btn k="sm pri" onClick={()=>setSharing(true)}>+ Send a report</Btn>}
      </div>
    </div>

    {raising
      ? <div className="card">
          <NewTaskForm subject={null} onCancel={()=>setRaising(false)}
            onDone={()=>{ setRaising(false); setTick(x=>x+1); }} toast={toast}/>
        </div>
      : null}

    {sharing
      ? <div className="card">
          <ShareForm reports={reports} onCancel={()=>setSharing(false)} toast={toast}
            onDone={()=>{ setSharing(false); setTick(x=>x+1); }}/>
        </div>
      : null}

    <div className="card flush">
      <div className="card-hd"><h2 style={{flex:1}}>{tab}</h2>
        <span className="t-sub" style={{fontWeight:400}}>
          {tab==='Tasks' ? 'hx_tasks' : 'lm_reportoccurrenceshares'}</span></div>
      <div style={{padding:'8px 17px 17px'}}>
        {loading
          ? <Empty ic="…">Reading shares and tasks…</Empty>
          : tab==='Tasks'
          ? <TaskList rows={hit(myTasks)} mineOnly={mineOnly}/>
          : <ShareList rows={hit(tab==='Inbox' ? inbox : sent)} dir={tab}
              openReport={openReport}/>}
      </div>
    </div>
  </>;
}

/* ---- Inbox / Sent ------------------------------------------------------- */
function ShareList({rows, dir, openReport}){
  if(!rows.length)
    return <Empty>{dir==='Inbox'
      ? 'Nothing has been sent to you yet.'
      : 'You have not sent a report to anyone yet.'}</Empty>;
  return <table className="data">
    <thead><tr><th>Report</th><th>{dir==='Inbox'?'From':'To'}</th><th>Sent</th><th></th></tr></thead>
    <tbody>{rows.map(s =>
      <tr key={s.id}>
        <td><div className="t-main">{s.reportName || s.name || '(untitled report)'}</div></td>
        <td className="dim">{(dir==='Inbox' ? s.fromUserName : s.toUserName) || '—'}</td>
        <td className="dim">{s.sharedOn ? fmtD(s.sharedOn) : '—'}</td>
        <td style={{textAlign:'right'}}>
          {s.reportId
            ? <Btn k="sm" onClick={()=>openReport(s.reportId)}>Open</Btn>
            : <span className="holder">no report linked</span>}</td>
      </tr>)}
    </tbody></table>;
}

/* ---- Tasks -------------------------------------------------------------- */
function TaskList({rows, mineOnly}){
  if(!rows.length)
    return <Empty>{mineOnly
      ? 'No task is assigned to you.'
      : 'No task matches.'}</Empty>;
  /* Open work first, and inside that the soonest due -- a work list is read
     top-down, so what is closed should not sit above what is not. */
  const sorted = [...rows].sort((a,b) =>
    (DONE.has(a.status) - DONE.has(b.status))
    || String(a.due || '9999').localeCompare(String(b.due || '9999')));
  return <table className="data">
    <thead><tr><th>Task</th><th>Assignee</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead>
    <tbody>{sorted.map(t => {
      const late = t.due && !DONE.has(t.status) && t.due < TODAY;
      return <tr key={t.id}>
        <td><div className="t-main">{t.name}</div>
          {t.description
            ? <div className="t-sub">{t.description.slice(0,110)}
                {t.description.length>110?'…':''}</div>
            : null}</td>
        <td className="dim">{t.assigneeName || '—'}</td>
        <td className="dim">{t.priority || '—'}</td>
        <td className="dim">{t.due ? fmtD(t.due) : '—'}
          {late ? <Tag c="red" style={{marginLeft:6}}>overdue</Tag> : null}</td>
        <td><Tag c={DONE.has(t.status) ? 'grey' : 'teal'}>{t.status || '—'}</Tag></td>
      </tr>;})}
    </tbody></table>;
}

/* ---- sending a report --------------------------------------------------- */
function ShareForm({reports, onCancel, onDone, toast}){
  const [reportId, setReportId] = useState('');
  const [userId, setUserId]     = useState('');
  const [users, setUsers]       = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    let live = true;
    fetchAssignableUsers()
      .then(u => { if(live) setUsers(u); })
      .catch(e => { console.warn('[dataverse] users:', e); if(live) setUsers([]); });
    return () => { live = false; };
  }, []);

  const rec = reports.find(r => r.id === reportId);
  const ready = reportId && userId;

  const submit = async () => {
    if(!ready || saving) return;
    setSaving(true);
    const {id, errors} = await shareReportOccurrence({
      reportOccurrenceId: reportId, userId, name: rec?.name || null });
    setSaving(false);
    if(!id){
      console.warn('[dataverse] shareReportOccurrence() failed:', errors);
      toast('Not sent','Sharing this report failed. Check the console for details.','err');
      return;
    }
    toast('Report sent', `${rec?.name || 'The report'} is now in their Inbox.`, 'ok');
    onDone();
  };

  return <div className="ntf">
    <div className="ntf-h"><div><b>Send a report</b>
      <span className="ntf-sub">It appears in their Inbox, and in your Sent.</span></div>
      <button type="button" className="cite-x" title="Close" onClick={onCancel}>×</button></div>
    <Combo label="Report" value={reportId} onChange={setReportId} all="Choose a report…"
      placeholder="Search reports…"
      opts={reports.map(r => ({ id:r.id, name:r.name, sub:[r.status, fmtP(r.period)].filter(Boolean).join(' · ') }))}/>
    <Combo label="Send to" value={userId} onChange={setUserId}
      all={users===null ? 'Reading users…' : 'Choose a person…'}
      placeholder="Search people…"
      opts={(users||[]).map(u => ({ id:u.id, name:u.name, sub:u.email }))}/>
    <div className="ntf-f">
      <Btn k="sm" disabled={saving} onClick={onCancel}>Cancel</Btn>
      <Btn k="sm pri" disabled={!ready || saving} onClick={submit}>
        {saving ? 'Sending…' : 'Send'}</Btn>
    </div>
  </div>;
}
