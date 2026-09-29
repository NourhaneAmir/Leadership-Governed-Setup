/* =========================================================================
   KPI coverage — every KPI this report is answerable for, and what is missing.

   A report gets its KPIs from two independent places, and neither one is the
   whole picture:

     the Setup    lm_reporttemplaterelatedkpises, written by Governance Setup.
                  What the approved Setup says this report is about, whether or
                  not anyone has written about it yet.
     its sections lm_reportsectioncitations. What an author actually rested a
                  section on.

   Showing only the first hides what the author added; showing only the second
   hides what the Setup expected and nobody covered. This unions them, marks
   where each came from, and calls out three different kinds of gap:

     not covered    named by the Setup, cited by no section -- a governance
                    gap, and the one a reviewer cares about most.
     not in the Setup  cited by a section but not named by the Setup. Not
                    wrong, but worth seeing.
     no figures     no achievement row for this report's scope and period, or
                    a row with figures missing from it -- a DATA gap, not the
                    author's doing, and it must not read as their fault.

   Processes the Setup names are listed too; they carry no figures.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { Target } from 'lucide-react';
import { Btn, Note, Empty, Tag } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { use } from '../store.jsx';
/* Each KPI and Process listed here opens in its own IT app (Extension: every
   reference opens the real object) -- the same access-checked link as a citation. */
import { OpenRecord } from '../recordLinks.jsx';
import { fetchReportTemplateRelated, fetchKpiAchievements, matchAchievement,
         syncKpiGapSection, KPI_GAP_SECTION_HEADING } from '../../../services/dataverse.js';

const fig = v => (v === null || v === undefined ? '—' : v);
const NUM = { textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' };
const FIGURES = [['baseline', 'Baseline'], ['actual', 'Actual'],
                 ['target', 'Target'], ['historical', 'Historical']];

/* How many named KPIs a gap chip-group shows before folding the rest into a
   "+N more" chip -- purely a display cap, every name is still in `items`. */
const GAP_CAP = 8;

/** One gap category as a headline chip (bold, `title` for the fuller
 *  explanation a paragraph used to carry) followed by that category's own
 *  KPI-name chips, capped, with a "+N more" chip for the remainder. Returns
 *  null when the category is empty, so the caller can just list every
 *  category without an `if` at each call site. */
function chipGroup(headline, items, hint){
  if(!items.length) return null;
  const shown = items.slice(0, GAP_CAP);
  const more = items.length - shown.length;
  return <React.Fragment key={headline}>
    <span className="gap-chip hl" title={hint}>{headline}</span>
    {shown.map(k => <span key={k.id} className="gap-chip">{k.name || k.id}</span>)}
    {more > 0 ? <span className="gap-chip more">+{more} more</span> : null}
  </React.Fragment>;
}

/** Every KPI this report answers for, from the Setup and from its sections.
 *
 *  @param {string}   p.templateId  the report's lm_reporttemplate id
 *  @param {string}   p.period      'YYYY-MM'
 *  @param {object}   p.scope       from reportAchievementScope()
 *  @param {string}   [p.unitLabel] the Business Unit's name
 *  @param {object[]} [p.citedKpis] [{ id, name, section }] -- one entry per
 *                    citation, so the same KPI may appear more than once
 *  @param {string}   [p.reportId]  the occurrence, needed only to save the section
 *  @param {boolean}  [p.canEdit]   false on a locked or submitted report
 *  @param {Function} [p.onSynced]  re-read the report after the section changes
 *  @param {boolean}  [p.openByDefault]
 */
export function KpiCoverage({ templateId, period, scope, unitLabel, citedKpis,
                              reportId, canEdit, onSynced, openByDefault }){
  const { toast } = use();
  const [open, setOpen] = useState(!!openByDefault);
  const [syncing, setSyncing] = useState(false);
  const [related, setRelated] = useState(null);   // null while reading
  const [ach, setAch] = useState(null);           // null while reading
  const [err, setErr] = useState(null);

  useEffect(() => { setRelated(null); setAch(null); setErr(null); }, [templateId]);

  /* The Setup's own lists. Read when the panel is first opened, not when the
     report is, so a reader who never expands it pays nothing. */
  useEffect(() => {
    if(!open || !templateId || related !== null) return;
    let live = true;
    setErr(null);
    fetchReportTemplateRelated(templateId)
      .then(r => { if(live) setRelated(r); })
      .catch(e => {
        console.warn('[dataverse] fetchReportTemplateRelated() failed:', e);
        if(live){ setErr(e); setRelated({ kpis: [], processes: [] }); }
      });
    return () => { live = false; };
  }, [open, templateId, related]);

  /* The union, built before the achievement read so one read covers both
     sources. A KPI cited by three sections is ONE row naming three sections. */
  const kpis = useMemo(() => {
    if(related === null) return null;
    const byId = new Map();
    const put = (id, name) => {
      if(!id) return null;
      if(!byId.has(id)) byId.set(id, { id, name: name || null, fromSetup: false, sections: [] });
      const e = byId.get(id);
      if(!e.name && name) e.name = name;
      return e;
    };
    for(const k of related.kpis) { const e = put(k.id, k.name); if(e) e.fromSetup = true; }
    for(const c of citedKpis || []){
      const e = put(c.id, c.name);
      if(e && c.section && !e.sections.includes(c.section)) e.sections.push(c.section);
    }
    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [related, citedKpis]);

  const kpiIds = useMemo(() => (kpis ?? []).map(k => k.id), [kpis]);

  useEffect(() => {
    if(!open || kpis === null) return;
    if(!kpiIds.length || !period){ setAch([]); return; }
    const [y, m] = String(period).split('-');
    let live = true;
    setAch(null);
    fetchKpiAchievements(+y, { kpiIds, month: +m })
      .then(rows => { if(live) setAch(rows); })
      .catch(e => {
        console.warn('[dataverse] fetchKpiAchievements() failed for KPI coverage:', e);
        if(live) setAch([]);          // the panel says "not recorded"; nothing breaks
      });
    return () => { live = false; };
  }, [open, kpis, kpiIds, period]);

  /* Each KPI resolved to the rows that serve it, plus what is missing. Done
     once here so the summary and the table cannot disagree. */
  const resolved = useMemo(() => {
    if(kpis === null || ach === null) return null;
    return kpis.map(k => {
      const { row, candidates } = matchAchievement(ach.filter(r => r.kpiId === k.id), scope || {});
      const rows = scope?.allDepartments ? candidates : (row ? [row] : []);
      /* A figure counts as missing when EVERY row serving this KPI leaves it
         empty -- under All Departments one department having a target is
         enough for the KPI to be covered. */
      const missing = FIGURES
        .filter(([f]) => !rows.some(r => r[f] !== null && r[f] !== undefined))
        .map(([, label]) => label);
      return { ...k, rows, missing, noRows: rows.length === 0 };
    });
  }, [kpis, ach, scope]);

  const gaps = useMemo(() => {
    if(!resolved) return null;
    return {
      notCovered: resolved.filter(k => k.fromSetup && !k.sections.length),
      notInSetup: resolved.filter(k => !k.fromSetup),
      noRows:     resolved.filter(k => k.noRows),
      noTarget:   resolved.filter(k => !k.noRows && k.missing.includes('Target')),
    };
  }, [resolved]);

  /* The KPIs the saved section cites: no Actual recorded, or no Target.
     Baseline and Historical are deliberately NOT gaps -- a report is judged on
     what it achieved against what it aimed at, and widening the rule to every
     figure would cite almost every KPI while IT holds a Target on 1 row in
     1,055, so the section would never shrink and would say nothing. */
  const gapKpis = useMemo(() => (resolved || []).filter(k =>
    k.missing.includes('Actual') || k.missing.includes('Target')), [resolved]);

  const runSync = async () => {
    if(!reportId || syncing) return;
    setSyncing(true);
    try{
      const r = await syncKpiGapSection(reportId,
        gapKpis.map(k => ({ id: k.id, name: k.name })));
      const parts = [];
      if(r.added.length)   parts.push(r.added.length + ' added');
      if(r.removed.length) parts.push(r.removed.length + ' removed (data has arrived)');
      if(r.kept)           parts.push(r.kept + ' still missing');
      if(r.sectionDeleted) parts.push('section removed \u2014 nothing is missing now');
      toast(
        r.errors.length ? 'Updated, with problems' : 'Gaps section updated',
        (parts.join(', ') || 'Nothing to change')
          + (r.errors.length ? '. ' + r.errors.length + ' write(s) failed \u2014 see the console.' : '.'),
        r.errors.length ? 'warn' : 'ok');
      if(r.errors.length) console.warn('[dataverse] syncKpiGapSection:', r.errors);
      /* The report is re-read because the section list has changed underneath
         the screen -- an editor left holding a stale draft would otherwise
         delete the section again on its next save. */
      if(onSynced) onSynced();
    }catch(e){
      console.warn('[dataverse] syncKpiGapSection() failed:', e);
      toast('Could not update the section', e?.message || 'unknown error', 'err');
    }finally{ setSyncing(false); }
  };

  /* ⚠️ Every hook above runs unconditionally. This bail-out has to come
     AFTER them: React identifies hooks by call order, so returning early
     above the useMemos would change that order the moment a report gained
     its first citation. */
  if(!templateId && !(citedKpis || []).length) return null;

  const nProc = related?.processes.length ?? 0;
  const head = resolved
    ? ` (${resolved.length} KPI${resolved.length === 1 ? '' : 's'}${nProc ? `, ${nProc} Process${nProc === 1 ? '' : 'es'}` : ''})`
    : '';

  return <div className="card" style={{ padding: '11px 13px', marginTop: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
                     flex: '0 0 auto', borderRadius: 7, background: 'var(--teal-l)', color: 'var(--teal-d)' }}>
        <Target size={14} strokeWidth={2.25}/></span>
      <span className="tset-lbl">KPI coverage</span>
      <span className="holder" style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
        Every KPI this report answers for &mdash; from its Setup and from its sections{head}
      </span>
      {/* Writes, so it is never automatic: a reader opening a report must not
          mutate it, and a submitted report must not change after the fact.
          Re-running is also what REMOVES a KPI whose data has since arrived. */}
      {open && reportId && resolved
        ? <Btn k="sm" disabled={!canEdit || syncing} onClick={runSync}
            title={canEdit
              ? 'Rechecks every KPI and rewrites the "' + KPI_GAP_SECTION_HEADING
                + '" section: adds the ones still missing data, drops the ones now filled.'
              : 'Only a Draft or Returned report can be changed.'}>
            {syncing ? 'Checking\u2026'
              : gapKpis.length ? 'Save ' + gapKpis.length + ' gap'
                                 + (gapKpis.length === 1 ? '' : 's') + ' as a section'
                               : 'Clear the gaps section'}</Btn>
        : null}
      <Btn k="sm" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'}</Btn>
    </div>

    {!open ? null : err
      ? <Note k="err">The Setup&rsquo;s KPIs and Processes could not be read.</Note>
      : resolved === null
        ? <div className="holder" style={{ marginTop: 8 }}>Reading KPIs and their figures&hellip;</div>
        : !resolved.length
          ? <Empty>Neither this Setup nor any of its sections names a KPI.</Empty>
          : <div style={{ marginTop: 9 }}>

              {/* ---- what is missing, before the detail ----
                  Same four categories as before, same names, same counts --
                  only the container changed, from a stack of full-width
                  paragraph Notes to a wrapped row of compact chips. Each
                  category keeps its own headline chip (the fuller wording a
                  Note used to carry now lives in that chip's `title`
                  tooltip) directly followed by its own KPI-name chips, so
                  categories never blur into one undifferentiated list. */}
              {gaps.notCovered.length || gaps.noRows.length || gaps.noTarget.length || gaps.notInSetup.length
                ? <div className="gap-chips">
                    {chipGroup(
                      `${gaps.notCovered.length} KPI${gaps.notCovered.length === 1 ? '' : 's'} named by the Setup `
                        + `${gaps.notCovered.length === 1 ? 'is' : 'are'} not cited`,
                      gaps.notCovered,
                      'Named by the Setup, not cited by any section — a governance gap.')}

                    {chipGroup(
                      `${gaps.noRows.length} KPI${gaps.noRows.length === 1 ? '' : 's'} `
                        + `${gaps.noRows.length === 1 ? 'has' : 'have'} no achievement recorded `
                        + `for ${unitLabel || 'this Business Unit'} in ${fmtP(period)}`,
                      gaps.noRows,
                      'This is missing data in Dataverse, not something the report can fix.')}

                    {chipGroup(
                      `${gaps.noTarget.length} KPI${gaps.noTarget.length === 1 ? '' : 's'} `
                        + `${gaps.noTarget.length === 1 ? 'has' : 'have'} figures but no Target`,
                      gaps.noTarget)}

                    {chipGroup(
                      `${gaps.notInSetup.length} KPI${gaps.notInSetup.length === 1 ? '' : 's'} cited by a section `
                        + `${gaps.notInSetup.length === 1 ? 'is' : 'are'} not named by the Setup`,
                      gaps.notInSetup,
                      'Not wrong, but worth seeing — the Setup never asked for this one.')}
                  </div>
                : <Note k="ok">Every KPI is cited and has figures recorded.</Note>}

              {/* ---- the detail ---- */}
              <div className="tset-lbl" style={{ marginBottom: 5 }}>
                KPIs &middot; {fmtP(period)}
                {scope?.allDepartments ? ' · all Departments and Functions' : ''}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data" style={{ width: '100%', minWidth: 720 }}>
                  <thead><tr>
                    <th>KPI</th><th>From</th><th>Department</th><th>Function</th>
                    <th style={NUM}>Baseline</th><th style={NUM}>Actual</th>
                    <th style={NUM}>Target</th><th style={NUM}>Historical</th>
                  </tr></thead>
                  <tbody>
                    {resolved.flatMap(k => {
                      const label = <>{k.name || '(unnamed KPI)'}
                        <OpenRecord kind="KPI" id={k.id} asLink label="Open ↗" style={{ marginLeft: 7 }}/></>;
                      const from = <>
                        {k.fromSetup ? <Tag c="teal">Setup</Tag> : null}
                        {k.sections.length
                          ? <span className="holder" style={{ fontSize: 11 }} title={k.sections.join(', ')}>
                              {' '}{k.sections.length} section{k.sections.length === 1 ? '' : 's'}</span>
                          : k.fromSetup
                            ? <span style={{ fontSize: 11, color: 'var(--amber)' }}> not cited</span>
                            : null}
                      </>;

                      /* The dot repeats what the row already says in words --
                         red when there is no achievement row at all (the
                         message below), blue when a row exists but every
                         figure on it is empty, green otherwise. Nothing here
                         compares actual to target; it only visualises data
                         presence, the same fact `missing`/`noRows` already
                         carry. */
                      if(k.noRows) return [<tr key={k.id}>
                        <td><span className="kpi-dot bad"/>{label}</td><td>{from}</td>
                        <td colSpan={6} className="holder">
                          No achievement recorded for this scope and period.</td>
                      </tr>];

                      return k.rows.map((r, i) => {
                        const empty = FIGURES.every(([f]) => r[f] === null || r[f] === undefined);
                        return <tr key={k.id + ':' + r.id}>
                        {/* Named once per block, so a KPI spanning eight
                            departments reads as one KPI, not eight. */}
                        <td>{i === 0 ? <><span className={'kpi-dot ' + (empty ? 'empty' : 'ok')}/>{label}</> : ''}</td>
                        <td>{i === 0 ? from : null}</td>
                        <td>{r.department || <span className="holder">any</span>}</td>
                        <td>{r.function || <span className="holder">any</span>}</td>
                        <td style={NUM}>{fig(r.baseline)}</td>
                        <td style={NUM}><b>{fig(r.actual)}</b></td>
                        <td style={NUM}>{fig(r.target)}</td>
                        <td style={NUM}>{fig(r.historical)}</td>
                      </tr>;
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {nProc ? <div style={{ marginTop: 11 }}>
                <div className="tset-lbl" style={{ marginBottom: 5 }}>
                  Processes named by the Setup
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {related.processes.map(p =>
                    <span key={p.id} className="cref pm" style={{ fontSize: 12 }}>
                      {p.name || '(unnamed process)'}
                      <OpenRecord kind="Process" id={p.id} asLink label="Open ↗" style={{ marginLeft: 6 }}/></span>)}
                </div>
              </div> : null}

            </div>}
  </div>;
}
