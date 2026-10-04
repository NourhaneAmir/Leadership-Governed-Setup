/* =========================================================================
   Decisions where they are taken -- a report section, or a meeting agenda
   item (28 Sep).

   A decision is a live wlog_decisions row (IT). Two lookups on it say where
   it was taken: lm_CitedReportSection (a Report Occurrence Section) and
   lm_MeetingOccurrenceAgenda (a Meeting Occurrence agenda item, which the
   Minutes' notes hang off). Each holds ONE target, so a decision belongs to at
   most one section and one agenda item -- attaching it somewhere else of the
   same kind moves it, and the panel says so before doing it.

   Used by Reports / Plans and Build a report/plan (per section) and by the
   Meeting's Minutes tab (per agenda item). Reads dvDecisions from the app
   context and refreshes it after every write, so each screen shows the same
   list without a read of its own.
   ========================================================================= */
import React, { useState } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag } from '../../../shared/ui.jsx';
import { matchesQuery } from '../domain.jsx';
import { createWorkLogDecision, linkWorkLogDecision,
         NEW_DECISION_STATUSES } from '../../../services/dataverse.js';

const decisionTagC = s => s === 'Completed' ? 'green' : s === 'Escalated' ? 'amber' : 'grey';

/* target: { kind: 'section' | 'agenda', id, label }
   canAdd: false shows the linked decisions only (e.g. an approved, locked report). */
export function DecisionPanel({ target, canAdd = true }){
  const { dvDecisions = [], toast, refreshOccurrences } = use();
  const [mode, setMode] = useState(null);          // 'new' | 'attach' | null
  const [f, setF] = useState({ name: '', decisionTaken: '', expectedOutput: '', status: 'Pending' });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const isSection = target.kind === 'section';
  const linkKey = isSection ? 'sectionId' : 'agendaItemId';
  const linked = dvDecisions.filter(d => d[linkKey] === target.id);
  const where = isSection ? 'this section' : 'this agenda item';

  const done = async (title, msg) => {
    toast(title, msg, 'ok');
    setMode(null); setF({ name: '', decisionTaken: '', expectedOutput: '', status: 'Pending' }); setQ('');
    await refreshOccurrences();
  };

  const raise = async () => {
    setBusy(true);
    try {
      const { id, errors } = await createWorkLogDecision({
        name: f.name.trim(), decisionTaken: f.decisionTaken.trim(),
        expectedOutput: f.expectedOutput.trim() || undefined,
        status: f.status,
        [linkKey]: target.id,
      });
      if (!id) {
        console.warn('[dataverse] createWorkLogDecision() failed:', errors);
        toast('Not saved', 'Raising the decision failed. Check the console for details.', 'err');
        return;
      }
      await done('Decision raised', `“${f.name.trim()}” is recorded against ${where}.`);
    } finally { setBusy(false); }
  };

  const attach = async d => {
    const elsewhere = d[linkKey] && d[linkKey] !== target.id;
    if (elsewhere && !window.confirm(
      `“${d.name}” is already linked to ${isSection ? 'another report section' : 'another agenda item'}` +
      ` (${(isSection ? d.sectionName : d.agendaItemName) || 'elsewhere'}). A decision holds one — move it here?`)) return;
    setBusy(true);
    try {
      const { id, errors } = await linkWorkLogDecision(d.id, { [linkKey]: target.id });
      if (!id) {
        console.warn('[dataverse] linkWorkLogDecision() failed:', errors);
        toast('Not attached', 'Linking the decision failed. Check the console for details.', 'err');
        return;
      }
      await done('Decision attached', `“${d.name}” is now linked to ${where}.`);
    } finally { setBusy(false); }
  };

  const candidates = dvDecisions
    .filter(d => d[linkKey] !== target.id)
    .filter(d => matchesQuery(q, [d.name, d.decisionTaken, d.workLog, d.status]));
  const ok = f.name.trim() && f.decisionTaken.trim();

  return <div className="dec-link">
    {linked.length
      ? <div className="dec-list">
          {linked.map(d => <div key={d.id} className="dec-item">
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span className="cref dec">Decision</span>
              <b style={{ fontSize: 12.5, flex: '1 1 160px' }}>{d.name}</b>
              {d.status ? <Tag c={decisionTagC(d.status)}>{d.status}</Tag> : null}
            </div>
            {d.decisionTaken
              ? <div className="holder" style={{ fontSize: 12, marginTop: 3, whiteSpace: 'pre-wrap' }}>
                  {d.decisionTaken.length > 220 ? d.decisionTaken.slice(0, 220) + '…' : d.decisionTaken}</div>
              : null}
            {d.expectedOutput
              ? <div className="holder" style={{ fontSize: 11.5, marginTop: 2 }}>Expected: {d.expectedOutput}</div>
              : null}
          </div>)}
        </div>
      : null}

    {canAdd
      ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: linked.length ? 8 : 0 }}>
          <Btn k="sm" disabled={busy} onClick={() => setMode(m => m === 'new' ? null : 'new')}>
            {mode === 'new' ? 'Cancel' : '+ Raise a decision'}</Btn>
          <Btn k="sm" disabled={busy || !dvDecisions.length} onClick={() => setMode(m => m === 'attach' ? null : 'attach')}>
            {mode === 'attach' ? 'Cancel' : 'Attach a decision'}</Btn>
        </div>
      : null}

    {mode === 'new' && <div className="dec-form">
      <input type="text" value={f.name} maxLength={100} placeholder="Decision title (required)"
        aria-label="Decision title" onChange={e => setF(x => ({ ...x, name: e.target.value }))}/>
      <textarea rows={3} value={f.decisionTaken} maxLength={4000} placeholder="What was decided (required)"
        aria-label="Decision taken" onChange={e => setF(x => ({ ...x, decisionTaken: e.target.value }))}/>
      <textarea rows={2} value={f.expectedOutput} maxLength={1000} placeholder="Expected output (optional)"
        aria-label="Expected output" onChange={e => setF(x => ({ ...x, expectedOutput: e.target.value }))}/>
      <label className="holder" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>Status
        <select value={f.status} aria-label="Decision status"
          onChange={e => setF(x => ({ ...x, status: e.target.value }))}>
          {NEW_DECISION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select></label>
      <div><Btn k="sm pri" disabled={!ok || busy} onClick={raise}>
        {busy ? 'Saving…' : `Raise it against ${where}`}</Btn></div>
    </div>}

    {mode === 'attach' && <div className="dec-form">
      <input type="search" value={q} placeholder="Search decisions, work logs…" aria-label="Search decisions"
        onChange={e => setQ(e.target.value)}/>
      <div className="dec-pick">
        {candidates.length === 0
          ? <div className="holder" style={{ padding: 8 }}>No decision matches.</div>
          : candidates.slice(0, 50).map(d => {
              const elsewhere = isSection ? d.sectionName : d.agendaItemName;
              return <div key={d.id} className="dec-pick-row">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.name}</div>
                  <div className="holder" style={{ fontSize: 11 }}>
                    {[d.status, d.workLog, elsewhere ? `linked to “${elsewhere}” — attaching moves it` : null]
                      .filter(Boolean).join(' · ')}</div>
                </span>
                <Btn k="sm" disabled={busy} onClick={() => attach(d)}>Attach</Btn>
              </div>;
            })}
      </div>
      {candidates.length > 50
        ? <div className="holder" style={{ fontSize: 11 }}>Showing 50 of {candidates.length} — search to narrow.</div>
        : null}
    </div>}
  </div>;
}
