/* =========================================================================
   One KPI's Baseline / Actual / Target / Historical for a report's scope.

   Shared by Build a report/plan and Reports / Plans. Those two have already
   disagreed about achievement scope once -- one rejected blank-department rows
   the other accepted, one ignored Business Unit entirely -- and the fix was to
   make them call the same matcher. This goes further and makes them draw the
   same thing too, so a figure cannot look different depending on which screen
   is open.

   ⚠️ TWO SHAPES, decided by the report, not by the caller:

     a normal report   one department and (usually) one function, so one row
                       fits and the figures show as a single line.

     All Departments   Department and Function are released (see
                       reportAchievementScope) and the report matches on
                       Business Unit and Period alone, so EVERY department's
                       and function's row qualifies. All of them are listed --
                       picking one would be arbitrary and hiding the rest would
                       be wrong.
   ========================================================================= */
import React from 'react';
import { matchAchievement } from '../../../services/dataverse.js';

const dash = v => (v === null || v === undefined ? '—' : v);
const NUM = { textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' };

/** Every achievement row that fits, as a table. Used when the report covers
 *  all departments, where one row is not the answer. */
function AllRows({ candidates }){
  return <div style={{ overflowX: 'auto', marginTop: 6 }}>
    <table className="t" style={{ width: '100%', minWidth: 460 }}>
      <thead><tr>
        <th>Department</th><th>Function</th>
        <th style={NUM}>Baseline</th><th style={NUM}>Actual</th>
        <th style={NUM}>Target</th><th style={NUM}>Historical</th>
      </tr></thead>
      <tbody>
        {candidates.map(r => <tr key={r.id}>
          <td>{r.department || <span className="holder">any</span>}</td>
          <td>{r.function || <span className="holder">any</span>}</td>
          <td style={NUM}>{dash(r.baseline)}</td>
          <td style={NUM}><b>{dash(r.actual)}</b></td>
          <td style={NUM}>{dash(r.target)}</td>
          <td style={NUM}>{dash(r.historical)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/** Figures for one KPI.
 *
 *  @param {object[]|null} p.rows  achievement rows ALREADY narrowed to this KPI
 *                                 and this period; null while they are loading
 *  @param {object} p.scope        from reportAchievementScope()
 *  @param {string} [p.periodLabel] shown when nothing is recorded
 *  @param {string} [p.unitLabel]   ditto -- the Business Unit's name
 */
export function AchievementFigures({ rows, scope, periodLabel, unitLabel }){
  if(rows === null || rows === undefined)
    return <div className="cite-m">Reading achievement&hellip;</div>;

  const { row, candidates, ambiguousOn } = matchAchievement(rows, scope || {});

  if(scope?.allDepartments){
    if(!candidates.length) return <div className="cite-m">
      No achievement recorded for {unitLabel || 'this Business Unit'}
      {periodLabel ? ' · ' + periodLabel : ''}.</div>;
    return <div>
      <div className="cite-m">
        All Departments &mdash; {candidates.length} row{candidates.length === 1 ? '' : 's'} for
        {' '}{unitLabel || 'this Business Unit'}{periodLabel ? ' · ' + periodLabel : ''},
        {' '}across every Department and Function.
      </div>
      <AllRows candidates={candidates}/>
    </div>;
  }

  if(!row) return <div className="cite-m">
    No achievement recorded for {periodLabel || 'this period'}
    {unitLabel ? ' · ' + unitLabel : ''}.</div>;

  const fig = (label, v) => <span className="mono" style={{ fontSize: 11.5 }}>
    {label} <b>{v === null || v === undefined ? '—' : v}</b></span>;

  /* What the row was recorded against, which is not always what was asked for
     -- a blank dimension applies to any, so it is never assumed to agree. */
  const on = [row.businessUnitName, row.department, row.function].filter(Boolean).join(' · ');

  return <div className="cite-hd" style={{ marginTop: 5, gap: 10, flexWrap: 'wrap' }}>
    {fig('Baseline', row.baseline)}
    {fig('Actual', row.actual)}
    {fig('Target', row.target)}
    {row.historical !== null && row.historical !== undefined ? fig('Historical', row.historical) : null}
    <span className="dg none">{on || 'not scoped'}{periodLabel ? ' · ' + periodLabel : ''}</span>
    {ambiguousOn.length
      ? <span className="dg none" style={{ flexBasis: '100%', color: 'var(--amber)' }}>
          {candidates.length} rows fit this report; showing one.
          {' '}Set {ambiguousOn.join(' and ')} on the report to narrow it.</span>
      : null}
  </div>;
}
