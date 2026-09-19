/* =========================================================================
   ARTIFACT · ScreenBuildReport -- "Build a report/plan"

   Ported from the Build screen in Leadership Practice Extension.html, and
   wired to the real Report Occurrence tables rather than the prototype's
   in-memory draft:

     lm_reportoccurrences          the report being built (its title, status)
     lm_reportoccurrencesections   its sections -- heading, angle, text, order
     lm_reportsectioncitations     what each section rests on

   The prototype builds a report from nothing. Here the report already exists
   -- the weekly generator creates each occurrence -- so the screen opens an
   existing one that is still editable (Draft or Returned, not locked), lets
   the author write it, and submits it into the configured review route.

   Same shape as the prototype: scope, title and template, a stack of editable
   sections with a diagnostic angle and citations, an Edit / Preview switch,
   and Save draft / Submit at the foot. Nothing is written until Save.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { use } from '../store.jsx';
import { Btn, Tag, Note, Empty } from '../../../shared/ui.jsx';
import { fmtP } from '../../../shared/format.js';
import { DiagChip, rptTagC, matchesQuery } from '../domain.jsx';
import { fetchReportOccurrenceForEdit, saveReportOccurrenceContent, submitReportOccurrence,
         fetchReportTemplateDetail, fetchKpis, fetchProcesses,
         fetchKpiAchievements, pickAchievement,
         SECTION_ANGLE, SECTION_BREAKDOWN_DIM } from '../../../services/dataverse.js';

/* Dataverse angle labels, and the DiagChip / .dg-seg class each maps onto. */
const ANGLES = [['Untyped', 'none'], ['Descriptive', 'd1'], ['Diagnostic', 'd2'],
                ['Predictive', 'd3'], ['Prescriptive', 'd4']];
const ANGLE_CLS = Object.fromEntries(ANGLES);

/* What a Section can cite. Four resolve to a real record; the rest have no
   table in this app and are saved as a label, as decided for Report/Plan
   Composition (PROJECT-CONTEXT section 5, 02 Sep). "Paragraph" is left out:
   the only column that could hold a cited section, lm_citedsection, already
   holds the citation's own parent section. */
const LIVE_KINDS = ['KPI', 'Breakdown', 'Process', 'Child Report'];
const LABEL_KINDS = ['POC', 'Project', 'Strategy', 'BI Report', 'Issue', 'Task'];

const EDITABLE = r => !!r && !r.locked && (r.status === 'Draft' || r.status === 'Returned');
const BODY_MAX = 4000;

let keySeq = 0;
const newKey = () => 'new-' + (++keySeq);

/* The editor's copy of what was loaded. Each row gets a stable React key: the
   Dataverse id where there is one, a local key where there is not yet. */
const toDraft = rows => rows.map(s => ({
  ...s, key: s.id,
  citations: s.citations.map(c => ({ ...c, key: c.id })),
}));

/* A comparable fingerprint of an editor state, for "unsaved changes". */
const fingerprint = (name, sections) => JSON.stringify([
  name,
  sections.map(s => [s.id || s.key, s.heading, s.body, s.angle,
                     s.citations.map(c => c.id || c.key)]),
]);

const citeTarget = c =>
  c.kpiName || c.processName || c.citedReportName || c.label || '(no target recorded)';

const crefCls = kind =>
  kind === 'KPI' || kind === 'Breakdown' ? 'kpi'
  : kind === 'Process' ? 'pm'
  : kind === 'POC' || kind === 'Project' || kind === 'Strategy' ? 'str'
  : kind === 'Issue' ? 'iss' : '';

/* Baseline / Actual / Target for one cited KPI, for the month the report
   covers and the scope it is written for.

   The figures are shown, never edited: pm_kpiachievments is owned by
   Performance Management, and a report cites what it says rather than
   restating it. A KPI with no row for that period says so plainly -- a blank
   panel would read as "zero".

   Achievement is deliberately NOT computed here. Whether a higher actual is
   better depends on the KPI's direction, which strategy_kpis carries but the
   report does not read yet; showing a percentage without it would call a
   falling infection rate a miss. Figures only, until the direction is wired. */
function KpiFigures({ kpiId, rows, rec, L, nm }){
  if (!kpiId) return null;
  if (rows === null) return <div className="cite-m">Reading achievement…</div>;

  const hit = pickAchievement(rows.filter(r => r.kpiId === kpiId), {
    businessUnitId: rec?.businessUnitId || null,
    departmentName: nm(L.dept, rec?.departmentId) || null,
    functionName:   nm(L.func, rec?.functionId) || null,
  });

  if (!hit) return <div className="cite-m">
    No achievement recorded for {fmtP(rec?.period)}
    {nm(L.bu, rec?.businessUnitId) ? ' · ' + nm(L.bu, rec.businessUnitId) : ''}.</div>;

  const fig = (label, v) => <span className="mono" style={{ fontSize: 11.5 }}>
    {label} <b>{v == null ? '—' : v}</b></span>;

  /* What the row was actually matched on, so a figure is never mistaken for one
     recorded against a narrower scope than it really was. */
  const on = [hit.businessUnitName, hit.department, hit.function].filter(Boolean).join(' · ');

  return <div className="cite-hd" style={{ marginTop: 5, gap: 10, flexWrap: 'wrap' }}>
    {fig('Baseline', hit.baseline)}
    {fig('Actual', hit.actual)}
    {fig('Target', hit.target)}
    {hit.historical != null ? fig('Historical', hit.historical) : null}
    <span className="dg none">{on || 'not scoped'} · {fmtP(rec?.period)}</span>
  </div>;
}

export function ScreenBuildReport(){
  const { dvReportOccs, dvLoading, dvLookup, sel, setSel, refreshOccurrences, toast, go } = use();
  const L = dvLookup || {};
  const nm = (fn, id) => (id && typeof fn === 'function' ? fn(id) : null);

  const reports = dvReportOccs || [];
  const editable = reports.filter(EDITABLE)
    .slice().sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))
                         || String(a.name).localeCompare(String(b.name)));

  const [mode, setMode]         = useState('edit');     // 'edit' | 'preview'
  const [before, setBefore]     = useState(null);       // loaded rows, or null while reading
  const [origName, setOrigName] = useState('');
  const [name, setName]         = useState('');
  const [sections, setSections] = useState([]);
  const [loadErr, setLoadErr]   = useState(null);
  const [busy, setBusy]         = useState(null);       // 'save' | 'submit' | 'template' | null
  const [reload, setReload]     = useState(0);
  const [catalog, setCatalog]   = useState({ kpis: null, processes: null });
  const [picker, setPicker]     = useState(null);       // { key, kind, q, kpiId, dim, text }
  const [ach, setAch]           = useState(null);       // achievement rows, or null while reading

  /* The report being built follows the app's selection, so "Edit" elsewhere
     (and a Report link from any screen) can open one here. */
  const selected = sel?.build && editable.find(r => r.id === sel.build);
  const rec = selected || editable[0] || null;
  const recId = rec ? rec.id : null;

  const dirty = before !== null && fingerprint(name, sections) !== fingerprint(origName, toDraft(before));

  /* KPIs and Processes for the picker -- read once. */
  useEffect(() => {
    let live = true;
    Promise.all([fetchKpis().catch(() => []), fetchProcesses().catch(() => [])])
      .then(([kpis, processes]) => { if (live) setCatalog({ kpis, processes }); });
    return () => { live = false; };
  }, []);

  /* Every KPI this report cites, from every section. A KPI cited twice is read
     once. */
  const citedKpiIds = useMemo(() => [...new Set(
    sections.flatMap(s => (s.citations || [])
      .filter(c => c.kind === 'KPI' || c.kind === 'Breakdown')
      .map(c => c.kpiId).filter(Boolean)))].sort().join(','),
    [sections]);

  /* Achievement for the period this report covers. One read for all of its
     KPIs, redone when the report or the set of cited KPIs changes -- not per
     citation, which would be a round trip each. */
  const period = rec?.period || null;
  useEffect(() => {
    const ids = citedKpiIds ? citedKpiIds.split(',') : [];
    if (!ids.length || !period) { setAch([]); return; }
    const [y, m] = String(period).split('-');
    let live = true;
    setAch(null);
    fetchKpiAchievements(+y, { kpiIds: ids, month: +m })
      .then(rows => { if (live) setAch(rows); })
      .catch(e => {
        console.warn('[dataverse] fetchKpiAchievements() failed:', e);
        if (live) setAch([]);          // the panel says "not recorded", the report still edits
      });
    return () => { live = false; };
  }, [citedKpiIds, period]);

  /* Load the selected report's content. */
  useEffect(() => {
    if (!recId) { setBefore([]); return; }
    let live = true;
    setBefore(null); setLoadErr(null); setPicker(null);
    fetchReportOccurrenceForEdit(recId)
      .then(rows => {
        if (!live) return;
        setBefore(rows); setSections(toDraft(rows));
        const current = reports.find(r => r.id === recId);
        setOrigName(current?.name || ''); setName(current?.name || '');
      })
      .catch(e => {
        console.warn('[dataverse] Reading report content for editing failed:', e);
        if (live) { setLoadErr(e); setBefore([]); setSections([]); }
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId, reload]);

  const choose = id => {
    if (id === recId) return;
    if (dirty && !window.confirm('This report has unsaved changes. Switch reports and discard them?')) return;
    setSel(v => ({ ...v, build: id }));
    setMode('edit');
  };

  /* ---- editing ------------------------------------------------------- */
  const patch = (key, fields) => setSections(ss => ss.map(s => (s.key === key ? { ...s, ...fields } : s)));
  const move = (key, dir) => setSections(ss => {
    const i = ss.findIndex(s => s.key === key), j = i + dir;
    if (i < 0 || j < 0 || j >= ss.length) return ss;
    const next = ss.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const remove = key => {
    const s = sections.find(x => x.key === key);
    if (s && (s.body.trim() || s.citations.length)
        && !window.confirm(`Remove "${s.heading || 'this section'}" and everything cited in it?`)) return;
    setSections(ss => ss.filter(x => x.key !== key));
    if (picker?.key === key) setPicker(null);
  };
  const addSection = () => {
    const key = newKey();
    setSections(ss => [...ss, { key, id: null, heading: '', body: '', angle: 'Untyped', citations: [] }]);
  };
  const cite = (key, c) => {
    setSections(ss => ss.map(s => (s.key === key
      ? { ...s, citations: [...s.citations, { ...c, id: null, key: newKey() }] } : s)));
    setPicker(p => (p ? { ...p, q: '', text: '' } : p));
  };
  const uncite = (key, ckey) =>
    setSections(ss => ss.map(s => (s.key === key
      ? { ...s, citations: s.citations.filter(c => c.key !== ckey) } : s)));

  /* The prototype's "Insert as starting rows": the Template's own sections,
     with the KPIs, breakdowns and processes each one cites. Offered only on an
     empty report, so it can never duplicate what is already there. */
  const insertTemplate = async () => {
    if (!rec?.templateId) return;
    setBusy('template');
    try {
      const t = await fetchReportTemplateDetail(rec.templateId);
      const rows = (t?.checklist || []).slice()
        .sort((a, b) => (a.lm_checklistitemstep ?? 1e9) - (b.lm_checklistitemstep ?? 1e9));
      const kpiName = id => (catalog.kpis || []).find(k => k.id === id)?.name || null;
      const procName = id => (catalog.processes || []).find(p => p.id === id)?.name || null;
      setSections(rows.map(c => ({
        key: newKey(), id: null,
        heading: c.lm_checklistitemname || '',
        body: '',
        angle: SECTION_ANGLE[c.lm_diagnosticangle] || 'Untyped',
        citations: (c.items || []).map(it => {
          if (it.type === 'KPI')
            return { key: newKey(), id: null, kind: 'KPI', kpiId: it.kpiId, kpiName: kpiName(it.kpiId),
                     label: it.label || 'KPI: ' + (kpiName(it.kpiId) || '') };
          if (it.type === 'Breakdown')
            return { key: newKey(), id: null, kind: 'Breakdown', kpiId: it.kpiId, kpiName: kpiName(it.kpiId),
                     breakdown: it.dimension, label: it.label || `${kpiName(it.kpiId) || 'KPI'} by ${it.dimension}` };
          if (it.type === 'Process')
            return { key: newKey(), id: null, kind: 'Process', processId: it.processId,
                     processName: procName(it.processId), label: it.label || 'Process: ' + (procName(it.processId) || '') };
          /* a child TEMPLATE has no occurrence to point at yet -- keep it as a label */
          return { key: newKey(), id: null, kind: 'Child Report', label: it.label || 'Child report' };
        }),
      })));
      toast('Template sections inserted',
        `${rows.length} section${rows.length === 1 ? '' : 's'} added below. Nothing is saved until you choose Save draft.`, 'ok');
    } catch (e) {
      console.warn('[dataverse] Reading the Report Template failed:', e);
      toast('Could not insert the template', 'Reading the Report Template from Dataverse failed. Check the console for details.', 'err');
    } finally { setBusy(null); }
  };

  /* ---- saving -------------------------------------------------------- */
  const save = async () => {
    const { errors } = await saveReportOccurrenceContent(recId, {
      name: name !== origName ? name : undefined,
      before: before || [],
      after: sections,
    });
    if (errors.length) {
      console.warn('[dataverse] Saving the report left some changes unsaved:', errors);
      toast('Some changes did not save',
        `${errors.length} change${errors.length === 1 ? '' : 's'} failed — the report below now shows what actually saved. Check the console for details.`, 'err');
    }
    if (name !== origName) await refreshOccurrences();
    setReload(n => n + 1);
    return errors.length === 0;
  };

  const onSave = async () => {
    setBusy('save');
    try { if (await save()) toast('Draft saved', 'Your changes are saved to Dataverse.', 'ok'); }
    finally { setBusy(null); }
  };

  const onSubmit = async () => {
    const written = sections.filter(s => s.body.trim()).length;
    if (!sections.length) { toast('Nothing to submit', 'Add at least one section first.', 'err'); return; }
    if (written === 0
        && !window.confirm('No section has any text yet. Submit it for review anyway?')) return;
    setBusy('submit');
    try {
      if (dirty && !(await save())) {
        toast('Not submitted', 'Some changes did not save, so the report was not sent for review.', 'err');
        return;
      }
      const { id, errors } = await submitReportOccurrence(recId, { actorPositionId: (L.myPositionIds || [])[0] });
      if (!id) {
        console.warn('[dataverse] Submitting the report failed:', errors);
        toast('Submit failed', 'The report could not be sent for review. Check the console for details.', 'err');
        return;
      }
      if (errors.length) console.warn('[dataverse] Submitted, but the history entry failed:', errors);
      toast('Submitted for review', `“${name || rec.name}” is now In Review, at the first step of its review route.`, 'ok');
      setSel(v => ({ ...v, build: null }));
      await refreshOccurrences();
    } finally { setBusy(null); }
  };

  /* ---- derived ------------------------------------------------------- */
  /* Scope always follows the report's own metadata now -- Department is no
     longer an independent filter the author can widen, it just says what the
     picker is limited to and why. */
  const scopeDept = rec?.departmentId || '';
  const inScope = x => !scopeDept || x.dept === scopeDept;
  const citeCount = sections.reduce((n, s) => n + s.citations.length, 0);

  /* ---- render -------------------------------------------------------- */
  return <>
    <div className="ph"><h1>Build a report/plan</h1>
      <div className="sub">Flexible, like the Excel you use today — but every line you add is a live
        reference back to its source, not a typed-in copy.</div></div>

    {editable.length === 0
      ? <div className="card"><Empty ic={dvLoading ? '…' : '📝'}>
          <b>{dvLoading ? 'Reading reports…' : 'No report is waiting to be written'}</b>
          <div style={{ marginTop: 5 }}>{dvLoading
            ? 'Reading lm_reportoccurrences from Dataverse.'
            : 'A report can be built while it is Draft or Returned and not locked. Reports in review or approved are read in Reports / Plans.'}</div>
          {!dvLoading
            ? <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
                <Btn k="sm" onClick={() => go('orpt')}>Open Reports / Plans</Btn></div>
            : null}
        </Empty></div>
      : <>
          <div className="tabs">
            {[['edit', 'Edit'], ['preview', 'Preview']].map(([k, l]) =>
              <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
          </div>

          {/* ---- which report, its scope, its title and template ---- */}
          <div className="card">
            <div className="bld-grid">
              <div className="bld-fld" style={{ gridColumn: 'span 2' }}>
                <label>Report</label>
                <select value={recId || ''} onChange={e => choose(e.target.value)} disabled={!!busy}>
                  {editable.map(r =>
                    <option key={r.id} value={r.id}>
                      {r.name} · {fmtP(r.period)} · {r.status}</option>)}
                </select>
              </div>
              <div className="bld-fld">
                <label>Status</label>
                <div className="ro"><Tag c={rptTagC(rec.status)}>{rec.status}</Tag></div>
              </div>
              <div className="bld-fld">
                <label>Period</label>
                <div className="ro">{fmtP(rec.period)}</div>
              </div>
            </div>

            <div className="flbl" style={{ margin: '14px 0 8px' }}>Scope — which KPIs and processes the picker offers</div>
            <div className="bld-grid">
              <div className="bld-fld">
                <label>Department</label>
                <div className="ro">{nm(L.dept, rec.departmentId) || '—'}</div>
              </div>
              <div className="bld-fld">
                <label>Function</label>
                <div className="ro">{nm(L.func, rec.functionId) || '—'}</div>
              </div>
              <div className="bld-fld">
                <label>Business Unit</label>
                <div className="ro">{nm(L.bu, rec.businessUnitId) || nm(L.region, rec.regionId) || '—'}</div>
              </div>
              <div className="bld-fld">
                <label>Created by</label>
                <div className="ro">{nm(L.pos, rec.creatorPositionId) || '—'}</div>
              </div>
            </div>

            <div className="bld-grid" style={{ marginTop: 14 }}>
              <div className="bld-fld" style={{ gridColumn: 'span 2' }}>
                <label>Title</label>
                <input value={name} maxLength={850} disabled={mode !== 'edit' || !!busy}
                  onChange={e => setName(e.target.value)} placeholder="The report's title"/>
              </div>
              <div className="bld-fld">
                <label>Template</label>
                <div className="ro">{rec.templateId ? (nm(L.rptTpl, rec.templateId) || 'A Report Template') : 'Custom — no Template'}</div>
              </div>
            </div>
            {rec.templateId && mode === 'edit' && before !== null && sections.length === 0
              ? <div style={{ marginTop: 10 }}>
                  <Btn k="sm" disabled={!!busy} onClick={insertTemplate}>
                    {busy === 'template' ? 'Reading the template…' : 'Insert the template’s sections as starting rows'}</Btn>
                </div>
              : null}
          </div>

          {loadErr
            ? <Note k="err">Reading this report’s sections from Dataverse failed.{' '}
                <Btn k="sm" onClick={() => setReload(n => n + 1)}>Try again</Btn></Note>
            : null}

          {before === null
            ? <div className="card"><Empty ic="…">Reading sections…</Empty></div>

            : mode === 'preview'
              ? <div className="card flush"><div className="bld-prev">
                  <h2 style={{ marginBottom: 4 }}>{name.trim() || 'Untitled report/plan'}</h2>
                  <div className="csub" style={{ paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    {[nm(L.dept, rec.departmentId), nm(L.bu, rec.businessUnitId) || nm(L.region, rec.regionId),
                      fmtP(rec.period)].filter(Boolean).join(' · ')}</div>
                  {sections.filter(s => s.body.trim() || s.citations.length).length === 0
                    ? <div className="holder" style={{ padding: '20px 0', textAlign: 'center' }}>
                        Nothing written yet — switch to Edit to start.</div>
                    : sections.filter(s => s.body.trim() || s.citations.length).map(s =>
                        <div key={s.key}>
                          <h4>{s.heading || ' '} {s.angle !== 'Untyped' ? <DiagChip d={ANGLE_CLS[s.angle]}/> : null}</h4>
                          {s.body.trim()
                            ? <p>{s.body.trim()}</p>
                            : <div className="holder">Nothing written for this section yet.</div>}
                          {s.citations.map(c =>
                            <div key={c.key} className="cite">
                              <div className="cite-hd">
                                <span className={'cref ' + crefCls(c.kind)}>{c.kind}</span>
                                <span className="cite-t">{citeTarget(c)}</span>
                                {c.breakdown ? <span className="dg none">by {c.breakdown}</span> : null}
                              </div>
                            </div>)}
                        </div>)}
                </div></div>

              : <>
                  {sections.length === 0
                    ? <div className="card"><Empty ic="📝">This report has no sections yet.
                        {rec.templateId ? ' Insert the template’s sections above, or add one below.' : ' Add one below.'}</Empty></div>
                    : sections.map((s, i) =>
                        <SectionEditor key={s.key} s={s} i={i} total={sections.length} busy={!!busy}
                          patch={patch} move={move} remove={remove} uncite={uncite} cite={cite}
                          picker={picker?.key === s.key ? picker : null}
                          setPicker={setPicker} catalog={catalog} inScope={inScope}
                          reports={reports.filter(r => r.id !== recId)}
                          ach={ach} rec={rec} L={L} nm={nm}/>)}

                  <div className="card" style={{ textAlign: 'center' }}>
                    <Btn k="sm pri" disabled={!!busy} onClick={addSection}>+ Add a section</Btn>
                  </div>
                </>}

          {/* ---- the foot ---- */}
          <div className="card">
            <div className="bld-foot">
              <span className="count">
                {sections.length} section{sections.length === 1 ? '' : 's'} · {citeCount} citation{citeCount === 1 ? '' : 's'}
                {dirty ? <> · <b style={{ color: 'var(--amber)' }}>unsaved changes</b></> : null}
              </span>
              <Btn k="sm" disabled={!dirty || !!busy || before === null} onClick={onSave}>
                {busy === 'save' ? 'Saving…' : 'Save draft'}</Btn>
              <Btn k="pri" disabled={!!busy || before === null} onClick={onSubmit}>
                {busy === 'submit' ? 'Submitting…' : 'Submit for review'}</Btn>
            </div>
          </div>
          <Note k="info" ic="i"><b>Submitting sends it into the review route configured on its Template</b>,
            starting at the first reviewer. It stays editable here only while it is Draft or Returned —
            once in review it is read in Reports / Plans.</Note>
        </>}
  </>;
}

/* ---- one section --------------------------------------------------------- */
/* `ach`, `rec`, `L` and `nm` are only used by the KPI figures panel on a
   citation. They are passed down rather than read from context because this
   component is otherwise props-only, and because reading them from the wrong
   scope is exactly what broke this screen once already. */
function SectionEditor({ s, i, total, busy, patch, move, remove, uncite, cite, picker, setPicker,
                         catalog, inScope, reports, ach, rec, L, nm }){
  const len = s.body.length;
  return <div className="sec">
    <div className="sec-h">
      <span className="sec-n">{i + 1}</span>
      <input className="sec-t" value={s.heading} maxLength={850} disabled={busy}
        placeholder="Heading" onChange={e => patch(s.key, { heading: e.target.value })}/>
      <div className="dg-seg">
        {ANGLES.map(([label, cls]) =>
          <button key={cls} type="button" disabled={busy}
            className={(s.angle === label ? 'on ' : '') + cls}
            onClick={() => patch(s.key, { angle: label })}>{label}</button>)}
      </div>
      <span style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        {i > 0 ? <Btn k="sm" title="Move up" disabled={busy} onClick={() => move(s.key, -1)}>↑</Btn> : null}
        {i < total - 1 ? <Btn k="sm" title="Move down" disabled={busy} onClick={() => move(s.key, 1)}>↓</Btn> : null}
        <Btn k="sm" title="Remove this section" disabled={busy} onClick={() => remove(s.key)}>✕</Btn>
      </span>
    </div>
    <div className="sec-b">
      <textarea value={s.body} maxLength={BODY_MAX} disabled={busy}
        placeholder="Write it — the conclusion, the update, whatever this row is for. Cite what it rests on below."
        onChange={e => patch(s.key, { body: e.target.value })}/>
      {len > BODY_MAX - 400
        ? <div className="holder" style={{ textAlign: 'right' }}>{len} / {BODY_MAX} characters</div> : null}

      {s.citations.length
        ? s.citations.map(c =>
            <div key={c.key} className="cite" style={{ position: 'relative' }}>
              <div className="cite-hd">
                <span className={'cref ' + crefCls(c.kind)}>{c.kind}</span>
                <span className="cite-t">{citeTarget(c)}</span>
                {c.breakdown ? <span className="dg none">by {c.breakdown}</span> : null}
                {!c.id ? <Tag c="amber">not saved</Tag> : null}
              </div>
              {c.label && c.label !== citeTarget(c) ? <div className="cite-m">{c.label}</div> : null}
              {c.kind === 'KPI' || c.kind === 'Breakdown'
                ? <KpiFigures kpiId={c.kpiId} rows={ach} rec={rec} L={L} nm={nm}/>
                : null}
              <button type="button" className="cite-x" title="Remove this citation" disabled={busy}
                onClick={() => uncite(s.key, c.key)}>×</button>
            </div>)
        : <div className="dg none" style={{ marginTop: 8, display: 'inline-block' }}>
            No source yet — free text only</div>}

      <div className="sec-f">
        <Btn k="sm" disabled={busy}
          onClick={() => setPicker(picker ? null : { key: s.key, kind: 'KPI', q: '', kpiId: '', dim: '', text: '' })}>
          {picker ? 'Close the picker' : '+ Cite a KPI, breakdown, process, child report or other source'}</Btn>
      </div>

      {picker
        ? <CitePicker picker={picker} setPicker={setPicker} onCite={c => cite(s.key, c)}
            catalog={catalog} inScope={inScope} reports={reports} taken={s.citations}/>
        : null}
    </div>
  </div>;
}

/* ---- the citation picker ------------------------------------------------- */
function CitePicker({ picker, setPicker, onCite, catalog, inScope, reports, taken }){
  const set = f => setPicker(p => ({ ...p, ...f }));
  const k = picker.kind;
  const has = pred => taken.some(pred);

  const list = (rows, pick) =>
    <div className="cpick-l">
      {rows.length === 0
        ? <div className="holder" style={{ padding: 10 }}>Nothing matches.</div>
        : rows.slice(0, 200).map(r =>
            <button type="button" key={r.id} className={'cpick-i' + (r.taken ? ' taken' : '')}
              disabled={r.taken} onClick={() => pick(r)}>
              <div style={{ textAlign: 'left' }}>
                <div>{r.n}</div>{r.m ? <div className="m">{r.m}</div> : null}
              </div>
            </button>)}
    </div>;

  const search = placeholder =>
    <input type="search" value={picker.q} placeholder={placeholder}
      onChange={e => set({ q: e.target.value })}
      style={{ width: '100%', border: '1px solid var(--border-d)', borderRadius: 7,
               padding: '6px 9px', fontSize: 12.5, marginBottom: 8 }}/>;

  let body;
  if (k === 'KPI' || k === 'Process') {
    const src = k === 'KPI' ? catalog.kpis : catalog.processes;
    if (!src) body = <div className="holder">Reading {k === 'KPI' ? 'KPIs' : 'processes'}…</div>;
    else {
      const rows = src.filter(inScope).filter(x => matchesQuery(picker.q, [x.name]))
        .map(x => ({ id: x.id, n: x.name,
          taken: has(c => (k === 'KPI' ? c.kind === 'KPI' && c.kpiId === x.id : c.processId === x.id)) }));
      body = <>
        {search(`Search ${k === 'KPI' ? 'KPIs' : 'processes'}…`)}
        {list(rows, x => onCite(k === 'KPI'
          ? { kind: 'KPI', kpiId: x.id, kpiName: x.n, label: 'KPI: ' + x.n }
          : { kind: 'Process', processId: x.id, processName: x.n, label: 'Process: ' + x.n }))}
        <div className="holder" style={{ marginTop: 6 }}>
          Showing {rows.length} in this report's own department — the same one shown in Scope above.</div>
      </>;
    }
  } else if (k === 'Breakdown') {
    if (!catalog.kpis) body = <div className="holder">Reading KPIs…</div>;
    else {
      const kpis = catalog.kpis.filter(inScope);
      const K = kpis.find(x => x.id === picker.kpiId);
      body = <>
        <select value={picker.kpiId} onChange={e => set({ kpiId: e.target.value, dim: '' })}
          style={{ width: '100%', marginBottom: 8, border: '1px solid var(--border-d)', borderRadius: 7,
                   padding: '6px 9px', fontSize: 12.5, background: '#fff' }}>
          <option value="">Choose a KPI…</option>
          {kpis.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {K ? <>
          <div className="cpick-k">
            {Object.values(SECTION_BREAKDOWN_DIM).map(dim =>
              <Btn key={dim} k={'sm' + (picker.dim === dim ? ' pri' : '')} onClick={() => set({ dim })}>{dim}</Btn>)}
          </div>
          <Btn k="sm pri" disabled={!picker.dim
                || has(c => c.kind === 'Breakdown' && c.kpiId === K.id && c.breakdown === picker.dim)}
            onClick={() => onCite({ kind: 'Breakdown', kpiId: K.id, kpiName: K.name, breakdown: picker.dim,
                                    label: `${K.name} by ${picker.dim}` })}>
            Cite {K.name}{picker.dim ? ' by ' + picker.dim : ''}</Btn>
          <div className="holder" style={{ marginTop: 6 }}>
            A breakdown is saved as the KPI plus a dimension. The members resolve when the figures are read.</div>
        </> : null}
      </>;
    }
  } else if (k === 'Child Report') {
    const rows = reports.filter(r => matchesQuery(picker.q, [r.name, r.status, r.period]))
      .map(r => ({ id: r.id, n: r.name, m: `${r.status} · ${fmtP(r.period)}`,
                   taken: has(c => c.citedReportId === r.id) }));
    body = <>
      {search('Search reports…')}
      {list(rows, r => onCite({ kind: 'Child Report', citedReportId: r.id, citedReportName: r.n,
                                label: 'Report: ' + r.n }))}
    </>;
  } else {
    body = <>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={picker.text} maxLength={850} placeholder={`Name the ${k}`}
          onChange={e => set({ text: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter' && picker.text.trim()) onCite({ kind: k, label: picker.text.trim() }); }}
          style={{ flex: 1, border: '1px solid var(--border-d)', borderRadius: 7, padding: '6px 9px', fontSize: 12.5 }}/>
        <Btn k="sm pri" disabled={!picker.text.trim()} onClick={() => onCite({ kind: k, label: picker.text.trim() })}>Cite</Btn>
      </div>
      <div className="holder" style={{ marginTop: 6 }}>
        There is no {k} table in this app yet, so this is saved as a named reference, not a link.</div>
    </>;
  }

  return <div className="cpick">
    <div className="flbl" style={{ marginBottom: 8 }}>What do you want to cite?</div>
    <div className="cpick-k">
      {[...LIVE_KINDS, ...LABEL_KINDS].map(x =>
        <Btn key={x} k={'sm' + (k === x ? ' pri' : '')}
          onClick={() => set({ kind: x, q: '', text: '', kpiId: '', dim: '' })}>{x}</Btn>)}
    </div>
    {body}
  </div>;
}
