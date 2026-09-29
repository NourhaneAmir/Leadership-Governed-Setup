/* =========================================================================
   Respond to a section -- a reader's comment on someone else's report,
   written as a draft section in one of the reader's OWN reports (Leadership
   Practice Extension: "comment on a report as a draft paragraph", 29 Sep).

   The response lands at the end of a report the reader issued that is still
   editable (Draft or Returned), as an ordinary section they can reword, move
   or delete in Build a report/plan. It carries one Paragraph citation back to
   the answered report (respondToReportSection() in dataverse.js), so a reader
   of the response can open what it answers. Nothing in the answered report
   changes.

   Used by Reports / Plans, per section, on reports the reader did not issue.
   ========================================================================= */
import React, { useState } from 'react';
import { Btn, Note } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { respondToReportSection } from '../../../services/dataverse.js';

const ANGLES = ['Untyped', 'Descriptive', 'Diagnostic', 'Predictive', 'Prescriptive'];
const BODY_MAX = 4000;

/* section: { id, heading }   report: the answered report (rec)
   myReports: the reader's editable reports, newest first */
export function RespondPanel({ section, report, myReports, toast, go, openNewReport, onCancel, onSaved }){
  const secName = (section.heading || '').trim() || 'Untitled section';
  const [targetId, setTargetId] = useState(myReports[0]?.id || '');
  const [heading, setHeading]   = useState(('Response: ' + secName).slice(0, 850));
  const [body, setBody]         = useState('');
  const [angle, setAngle]       = useState('Untyped');
  const [busy, setBusy]         = useState(false);
  const [saved, setSaved]       = useState(null);   // the report the response went into

  if (!myReports.length)
    return <div className="dec-form">
      <Note k="info" ic="i">A response is written into one of your own reports or plans while it is
        still Draft or Returned — and you have none right now.</Note>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {openNewReport ? <Btn k="sm pri" onClick={() => openNewReport()}>Create a report</Btn> : null}
        <Btn k="sm" onClick={onCancel}>Close</Btn>
      </div>
    </div>;

  if (saved)
    return <div className="dec-form">
      <Note k="ok">Your response is the last section of <b>{saved.name}</b>, citing this report.
        It stays a draft there until you submit that report.</Note>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn k="sm pri" onClick={() => go('build', saved.id)}>Open it in Build</Btn>
        <Btn k="sm" onClick={onCancel}>Done</Btn>
      </div>
    </div>;

  const ok = targetId && heading.trim() && body.trim();

  const save = async () => {
    const target = myReports.find(r => r.id === targetId);
    setBusy(true);
    try {
      const label = `Responds to “${secName}” in ${report.name}${report.period ? ' · ' + fmtP(report.period) : ''}`;
      const { id, errors } = await respondToReportSection({
        targetOccurrenceId: targetId, heading, body, angle,
        citedReportId: report.id, citedLabel: label.slice(0, 850),
      });
      if (!id) {
        console.warn('[dataverse] respondToReportSection() failed:', errors);
        toast('Not saved', 'Writing the response failed. Check the console for details.', 'err');
        return;
      }
      if (errors.length) {
        console.warn('[dataverse] respondToReportSection() citation failed:', errors);
        toast('Saved without its link', `The response is in ${target?.name || 'your report'}, but citing this report failed.`, 'warn');
      } else {
        toast('Response saved', `Added to ${target?.name || 'your report'} as a draft section.`, 'ok');
      }
      setSaved(target || { id: targetId, name: 'your report' });
      if (onSaved) onSaved();
    } catch (e) {
      console.warn('[dataverse] respondToReportSection() failed:', e);
      toast('Not saved', e?.message || 'Writing the response failed.', 'err');
    } finally { setBusy(false); }
  };

  return <div className="dec-form">
    <label className="holder" style={{ fontSize: 11.5 }}>Into which of your reports
      <select value={targetId} onChange={e => setTargetId(e.target.value)} aria-label="Your report"
        style={{ display: 'block', width: '100%', marginTop: 3 }}>
        {myReports.map(r => <option key={r.id} value={r.id}>
          {r.name}{r.period ? ' · ' + fmtP(r.period) : ''} ({r.status})</option>)}
      </select>
    </label>
    <input type="text" value={heading} maxLength={850} placeholder="Heading (required)"
      aria-label="Response heading" onChange={e => setHeading(e.target.value)}/>
    <textarea rows={4} value={body} maxLength={BODY_MAX} aria-label="Your response"
      placeholder={`Your response to “${secName}” (required)`}
      onChange={e => setBody(e.target.value)}/>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="holder" style={{ fontSize: 11.5 }}>Angle{' '}
        <select value={angle} onChange={e => setAngle(e.target.value)} aria-label="Diagnostic angle">
          {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
        </select></label>
      <span className="holder" style={{ fontSize: 11, marginLeft: 'auto' }}>{body.length}/{BODY_MAX}</span>
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Btn k="sm pri" disabled={!ok || busy} onClick={save}>{busy ? 'Saving…' : 'Save as a draft section'}</Btn>
      <Btn k="sm" disabled={busy} onClick={onCancel}>Cancel</Btn>
    </div>
  </div>;
}
