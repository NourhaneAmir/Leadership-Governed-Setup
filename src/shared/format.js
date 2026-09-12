/* =========================================================================
   Dates, the working calendar, and number formatting.

   Extracted from LeadershipApp.jsx so a screen can be moved into the
   Governance module — or lifted into an app of its own — without dragging the
   execution module's 10k-line file behind it. Nothing here touches app state
   or React: it is pure functions and constants, so it is safe for either
   module to import.
   ========================================================================= */

/* A Date as a plain 'YYYY-MM-DD', read in LOCAL time.
   Not toISOString(), which converts to UTC first: local midnight in Riyadh
   (+03) or Cairo (+02) is the previous day in UTC, so every date built that way
   came out one day early -- the Calendar grid was a day out of step with its
   own weekday columns, and addDays(d,1) returned d unchanged. */
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/* The clock is the real current date. The Calendar, Workspace and Meetings
   screens read live Dataverse occurrences, which carry real dates, so a fixed
   demo clock opened the Calendar on the wrong month and mis-flagged what was
   overdue. The seeded records elsewhere keep their own literal dates. */
export const TODAY = ymd(new Date());
export const PERIOD = TODAY.slice(0,7);

/* ---- non-working days (OD-30) ------------------------------------------ */
export const WEEKEND = [5,6];              // Fri, Sat — working week is Sun–Thu
export const HOLIDAYS = ['2026-07-05','2026-08-24'];
export const isNonWorking = d => WEEKEND.includes(new Date(d+'T00:00:00').getDay()) || HOLIDAYS.includes(d);
/* Weekend and public holiday are treated identically for auto-booking: an
   occurrence landing on either rolls forward to the next working day rather
   than being refused, so isNonWorking() is the only test most booking paths
   need. Reschedule is the one deliberate, one-off exception -- it still hard
   -blocks a weekend pick outright (a holiday there is only a soft warning),
   so isWeekend() stays for that narrower check. */
export const isWeekend = d => WEEKEND.includes(new Date(d+'T00:00:00').getDay());
export const WEEKDAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const dayName = d => d ? WEEKDAY_NAME[new Date(d+'T00:00:00').getDay()] : '';
/* An occurrence landing on a non-working day moves — that occurrence only, never the series. */
export const nextWorkingDay = d => { let x=new Date(d+'T00:00:00');
  do { x.setDate(x.getDate()+1); } while(isNonWorking(ymd(x)));
  return ymd(x); };

/* Every governance lead time and review period is counted in WORKING days, not
   calendar days — the working week is Sunday to Thursday, so a deadline counted
   in calendar days across a Friday or Saturday lands up to two days early and
   silently mis-scores AG-03 and AG-15. The prototype spec says only "days";
   the BRD is explicit that the agenda lead time and the report review period
   are two WORKING days, so that is the reading applied here.
   A negative `n` counts backwards, which is how a lead time is expressed
   (the deadline sits n working days BEFORE the meeting). */
export const shiftWorkingDays = (d,n) => {
  if(!d || !n) return d;
  const step = n<0 ? -1 : 1;
  let left = Math.abs(n), x = new Date(d+'T00:00:00');
  while(left>0){
    x.setDate(x.getDate()+step);
    if(!isNonWorking(ymd(x))) left--;
  }
  return ymd(x);
};

/* ---- display ------------------------------------------------------------ */
export const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const fmtD = d => { if(!d) return '—'; const [y,m,dd]=d.split('-'); return `${+dd} ${MONTHS[+m-1]} ${y}`; };
export const fmtDS = d => { if(!d) return '—'; const [y,m,dd]=d.split('-'); return `${+dd} ${MONTHS[+m-1]}`; };
export const fmtDT = s => { if(!s) return '—'; const [d,t]=s.split(' '); return `${fmtD(d)}${t?' · '+t:''}`; };
export const fmtP  = p => { if(!p) return '—'; const [y,m]=p.split('-'); return `${MONTHS[+m-1]} ${y}`; };
export const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
export const hoursBetween=(a,b)=>{
  const p=s=>new Date(s.replace(' ','T')+(s.length<=10?'T00:00:00':'')).getTime();
  return Math.round((p(b)-p(a))/36e5);
};
export const addDays=(d,n)=>{const t=new Date(d+'T00:00:00');t.setDate(t.getDate()+n);return ymd(t);};
export const addHours=(dt,h)=>{ const t=new Date(dt.replace(' ','T')); t.setTime(t.getTime()+h*36e5);
  return ymd(t)+' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); };
export const nowStamp=()=>TODAY+' '+new Date().toTimeString().slice(0,5);
export const money=n=>n==null?'—':n.toLocaleString('en-US')+' SAR';
export const pct=n=>(Math.round(n*10)/10)+'%';
export const uid=p=>p+'-'+Math.random().toString(36).slice(2,8);

/* score band shared by every percentage question */
export const band = p => p>=90?5 : p>=80?4 : p>=70?3 : p>=60?2 : p>=50?1 : 0;
export const scoreColour = s => s==null?'grey' : s>=4.5?'green' : s>=3.5?'teal' : s>=2.5?'amber' : 'red';
export const pctColour   = p => p==null?'grey' : p>=90?'green' : p>=80?'teal' : p>=70?'amber' : 'red';
