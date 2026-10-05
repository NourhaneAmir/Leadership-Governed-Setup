/* =========================================================================
   Post the approved Minutes to the meeting's Teams channel (05 Oct).

   The Organizer opens this from the Minutes once they are Approved or
   Closed. Teams itself cannot be shown inside the app (it refuses to be
   framed), so the message is composed and previewed here and posted through
   the Teams connector (services/teams.js) as the Organizer.

   The message carries the Minutes as stored in SharePoint -- confidential
   Stage 4 items withheld, whoever posts (a channel is wider than an item's
   readers) -- with every task of the meeting under its owner's real
   @mention, due date and details, and the link to the approved Word file.

   Channel: the meeting's own (lm_TeamChannel); else the channel on its
   Setup's Business Unit / Region row; else the Setup's own. The Organizer can
   pick another before posting.

   Its own import statements, on purpose: the long dataverse.js import list in
   LeadershipApp.jsx is rewritten by the deploy-time revert of 4ca0036.
   ========================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Btn, Note, Field } from '../../../shared/ui.jsx';
import { fetchTeamsChannels, fetchMeetingTemplateDetail, fetchUsersByIds,
         getMeetingMinutesDocument } from '../../../services/dataverse.js';
import { teamsMentionToken, postToTeamsChannel } from '../../../services/teams.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const clip = (s, n) => { const t = String(s || '').trim().replace(/\s+/g,' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
/* Teams caps a message at about 28 KB; past this the agenda notes are dropped. */
const HTML_BUDGET = 24000;

/** The Teams message as HTML. `who(task)` returns the HTML naming a task's
 *  owner: an @mention token when posting, a styled "@Name" in the preview. */
function minutesTeamsHtml(model, { intro, docUrl, docName }, who, withNotes = true){
  const m = model.meeting || {}, mi = model.minutes || {};
  const out = [];
  if(intro && intro.trim()) out.push(`<p>${esc(intro.trim()).replace(/\n/g,'<br>')}</p>`);
  out.push('<p>' + [
    ['Meeting', m.name], ['Date', [m.date, m.time].filter(Boolean).join(' · ')],
    ['Chair', m.chair], ['Organizer', m.facilitator],
    ['Minutes', [mi.status, mi.approved].filter(Boolean).join(' · ')],
  ].filter(([,v]) => v).map(([k,v]) => `<b>${k}:</b> ${esc(v)}`).join('<br>') + '</p>');
  out.push(docUrl
    ? `<p><b>Approved minutes:</b> <a href="${esc(docUrl)}">${esc(docName || 'Open the Word file')}</a></p>`
    : '<p><i>The approved Word file is not in SharePoint yet.</i></p>');

  const agenda = model.agenda || [];
  if(agenda.length){
    out.push('<p><b>Agenda</b></p><ol>' + agenda.map(a => {
      if(a.withheld) return `<li><b>${esc(a.title || '—')}</b> — 🔒 Confidential, withheld</li>`;
      const bits = [`<b>${esc(a.title || '—')}</b>`, `Covered: ${esc(a.covered || 'Not recorded')}`];
      if(withNotes && a.note) bits.push(esc(clip(a.note, 300)));
      if((a.decisions || []).length) bits.push('Decisions: ' + a.decisions.map(d => esc(d.name)).join('; '));
      return `<li>${bits.join(' — ')}</li>`;
    }).join('') + '</ol>');
  }

  const tasks = [
    ...agenda.flatMap(a => (a.tasks || []).map(t => ({ ...t, from: `#${a.seq} ${a.title || ''}`.trim() }))),
    ...(model.meetingTasks || []).map(t => ({ ...t, from: 'This meeting' })),
  ];
  if(tasks.length){
    out.push('<p><b>Tasks</b></p><ul>' + tasks.map(t => {
      const facts = [t.due ? `due <b>${esc(t.due)}</b>` : 'no due date', t.priority, t.status].filter(Boolean).map(x => x.startsWith?.('due') ? x : esc(x));
      const desc = t.description ? `<br>${esc(clip(t.description, 250))}` : '';
      return `<li>${who(t)} — <b>${esc(t.name)}</b>${t.code ? ` (${esc(t.code)})` : ''} · ${facts.join(' · ')}`
        + `${desc}<br><i>${esc(t.from)}</i></li>`;
    }).join('') + '</ul>');
  } else {
    out.push('<p><i>No tasks were raised in this meeting.</i></p>');
  }
  const html = out.join('');
  return html.length > HTML_BUDGET && withNotes ? minutesTeamsHtml(model, { intro, docUrl, docName }, who, false) : html;
}

export function PostMinutesToTeams({ rec, buildModel, onClose, toast }){
  const [model, setModel] = useState(null);           // null = reading
  const [doc, setDoc] = useState(undefined);          // undefined = reading
  const [channels, setChannels] = useState(null);
  const [users, setUsers] = useState({});             // systemuser id -> { name, aadId, upn, email }
  const [chan, setChan] = useState({ team:'', id:'' });
  const [defaultFrom, setDefaultFrom] = useState(null);
  const [subject, setSubject] = useState('');
  const [intro, setIntro] = useState('');
  const [err, setErr] = useState(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try{
        const [mdl, d, ch, tpl] = await Promise.all([
          buildModel(),
          getMeetingMinutesDocument(rec.id).catch(() => null),
          fetchTeamsChannels().catch(e => { console.warn('[teams] channels:', e); return []; }),
          rec.templateId ? fetchMeetingTemplateDetail(rec.templateId).catch(() => null) : null,
        ]);
        if(!live) return;
        setModel(mdl); setDoc(d); setChannels(ch || []);
        /* The default channel, most specific first. */
        const unitRow = rec.businessUnitId
          ? (tpl?.businessUnits || []).find(b => b._lm_businessunit_value === rec.businessUnitId)
          : rec.regionId ? (tpl?.regions || []).find(r => r._lm_region_value === rec.regionId) : null;
        const pick = [[rec.teamChannelId, 'this meeting'],
                      [unitRow?._lm_teamchannel_value, rec.businessUnitId ? 'the Setup’s Business Unit' : 'the Setup’s Region'],
                      [tpl?.parent?._lm_teamchannel_value, 'the Setup']].find(([id]) => id && (ch || []).some(c => c.id === id));
        if(pick){
          const c = ch.find(x => x.id === pick[0]);
          setChan({ team: c.team || '', id: c.id }); setDefaultFrom(pick[1]);
        }
        const m = mdl.meeting || {};
        setSubject(clip(`Minutes approved — ${m.name || 'Meeting'}${m.date ? ' · ' + m.date : ''}`, 250));
        setIntro(`The approved minutes of ${m.name || 'this meeting'}${m.date ? ', held ' + m.date : ''}, are below. `
          + 'Each task is listed with its owner and due date.');
        const ids = [...new Set([...(mdl.agenda || []).flatMap(a => (a.tasks || []).map(t => t.assigneeId)),
                                 ...(mdl.meetingTasks || []).map(t => t.assigneeId)].filter(Boolean))];
        const us = ids.length ? await fetchUsersByIds(ids) : [];
        if(live) setUsers(Object.fromEntries(us.map(u => [u.id, u])));
      }catch(e){
        console.warn('[teams] preparing the post failed:', e);
        if(live) setErr('The Minutes could not be read: ' + (e?.message || 'unknown error'));
      }
    })();
    return () => { live = false; };
  }, [rec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamNames = useMemo(() => [...new Set((channels || []).map(c => c.team).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [channels]);
  const teamChannels = (channels || []).filter(c => c.team === chan.team).sort((a, b) => a.name.localeCompare(b.name));
  const channel = (channels || []).find(c => c.id === chan.id) || null;
  const docName = doc?.name ? doc.name + '.docx' : null;
  const opts = { intro, docUrl: doc?.fileUrl || null, docName };

  const nameOf = t => users[t.assigneeId]?.name || t.assignee || 'Unassigned';
  const previewHtml = model
    ? minutesTeamsHtml(model, opts, t => `<span class="tm-at">@${esc(nameOf(t))}</span>`) : '';
  const owners = model ? [...new Set([...(model.agenda || []).flatMap(a => (a.tasks || [])),
                                      ...(model.meetingTasks || [])].map(nameOf))] : [];

  const post = async () => {
    if(!channel || posting) return;
    setPosting(true); setErr(null);
    try{
      /* One @mention token per owner; anyone Teams cannot resolve is named in bold. */
      const tokens = {};
      for(const id of Object.keys(users)){
        const u = users[id];
        tokens[id] = await teamsMentionToken(u.aadId || u.upn || u.email);
      }
      const html = minutesTeamsHtml(model, opts,
        t => (t.assigneeId && tokens[t.assigneeId]) || `<b>${esc(nameOf(t))}</b>`);
      await postToTeamsChannel(channel.teamObjectId, channel.channelObjectId, { subject: subject.trim(), html });
      const missed = Object.values(tokens).filter(x => !x).length;
      setPosted(true);
      toast?.('Posted to Teams', `The Minutes are in ${channel.team} › ${channel.name}`
        + (missed ? `. ${missed} owner${missed === 1 ? '' : 's'} could not be @mentioned and ${missed === 1 ? 'is' : 'are'} named instead.` : '.'), 'ok');
    }catch(e){
      console.warn('[teams] post failed:', e);
      setErr('Teams did not accept the post: ' + (e?.message || 'unknown error')
        + '. If this is the first time, allow the app to use Microsoft Teams when asked, then try again.');
    }finally{ setPosting(false); }
  };

  const ready = !!model && !!channel && !!channel.teamObjectId && !!channel.channelObjectId;
  return createPortal(<Modal wide title="Post the Minutes to Teams" onClose={onClose}
    sub="Posted to the channel as you. Confidential items stay withheld."
    footer={<>
      {channel?.link && <a className="btn" href={channel.link} target="_blank" rel="noopener noreferrer">Open the channel ↗</a>}
      <div style={{ flex: 1 }}/>
      <Btn onClick={onClose}>{posted ? 'Close' : 'Cancel'}</Btn>
      {!posted && <Btn k="pri" disabled={!ready || posting} onClick={post}>
        {posting ? 'Posting…' : 'Post to Teams'}</Btn>}
    </>}>
    {err && <Note k="err">{err}</Note>}
    {posted && <Note k="ok">Posted to <b>{channel.team} › {channel.name}</b>.</Note>}
    {!model && !err ? <div className="dim">Reading the Minutes, tasks and the Word file…</div> : model && <>
      <div className="f-row">
        <Field label="Team" req>
          <select id="tm-team" value={chan.team} disabled={!channels || posted}
            onChange={e => { setChan({ team: e.target.value, id: '' }); setDefaultFrom(null); }}>
            <option value="">{!channels ? 'Reading teams…' : teamNames.length ? 'Select…' : 'No teams loaded'}</option>
            {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
          </select></Field>
        <Field label="Channel" req hint={defaultFrom ? `The channel of ${defaultFrom}.`
            : chan.team ? 'Choose the channel to post to.' : 'No channel is set on this meeting or its Setup — choose one.'}>
          <select id="tm-channel" value={chan.id} disabled={!chan.team || posted}
            onChange={e => { setChan(x => ({ ...x, id: e.target.value })); setDefaultFrom(null); }}>
            <option value="">{!chan.team ? '—' : teamChannels.length ? 'Select…' : 'No channels in this Team'}</option>
            {teamChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></Field>
      </div>
      {channel && (!channel.teamObjectId || !channel.channelObjectId) &&
        <Note k="warn">This channel has no Teams ids in Dataverse, so it cannot be posted to. Choose another.</Note>}
      {!doc?.fileUrl && <Note k="warn">The approved Word file is not in SharePoint yet, so the post has no link to it.
        It is saved when the Minutes are approved; if that failed, export it and upload it by hand first.</Note>}
      <Field label="Subject">
        <input type="text" id="tm-subject" value={subject} maxLength={250} disabled={posted}
          onChange={e => setSubject(e.target.value)}/></Field>
      <Field label="Message" hint="Shown above the Minutes in the post.">
        <textarea id="tm-intro" rows={3} value={intro} maxLength={1000} disabled={posted}
          onChange={e => setIntro(e.target.value)}/></Field>
      <div className="tm-lbl">
        Preview · {owners.length ? `mentions ${owners.join(', ')}` : 'no task owners to mention'}</div>
      <div className="tm-preview" dangerouslySetInnerHTML={{ __html: previewHtml }}/>
    </>}
  </Modal>, document.body);
}
