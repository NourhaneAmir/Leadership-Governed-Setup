/* =========================================================================
   Connection problems -> ask the user to allow the connector again (05 Oct).

   A Code App cannot open Power Apps' consent dialog itself: the player shows
   it when the app is opened, for every connection the app uses. So when a
   Teams or SharePoint call fails because the connection is missing, not
   authorised or expired, the app does not show the raw error -- it raises a
   "Allow <connector> again" prompt (ReconnectPrompt in LeadershipApp.jsx),
   whose button reopens the app in the player, where the Allow dialog appears.

   Errors that a reload cannot fix (no permission on the SharePoint folder,
   a bad request) are NOT matched here and keep their own messages.
   ========================================================================= */

const CONNECTION_ERROR = new RegExp([
  'connection reference not found',          // the app's connection list lacks it
  'failed to fetch connection',              // the player could not hand over connections
  'connection (is )?(not (found|configured|authenticated)|expired|invalid|has been removed)',
  'unauthori[sz]ed', '\\b401\\b',
  'consent', 'not authenticated', 'authentication (failed|required)',
  'invalid[_ ]?(authentication[_ ]?)?token', 'token (has )?expired', 'interaction_required',
].join('|'), 'i');

/** True when the error looks like a missing / unauthorised connection. */
export const isConnectionError = e =>
  CONNECTION_ERROR.test(String((e && (e.message || e.error?.message)) || e || ''));

/** Shows the "Allow <connector> again" prompt (ReconnectPrompt listens). */
export function askToReconnect(connector){
  try{ window.dispatchEvent(new CustomEvent('lp-reconnect', { detail: { connector } })); }
  catch{ /* no window (tests) */ }
}

/** Reopens the app in the Power Apps player, which shows the Allow dialog for
 *  any connection the user has not allowed. Called from a click, so the
 *  player's frame may navigate the top window; falls back to a plain reload. */
export async function reloadForConsent(){
  try{
    const { getContext } = await import('@microsoft/power-apps/app');
    const ctx = await getContext();
    const env = ctx?.app?.environmentId, app = ctx?.app?.appId, tenant = ctx?.user?.tenantId;
    if(env && app){
      const url = `https://apps.powerapps.com/play/e/${env}/app/${app}` + (tenant ? `?tenantId=${tenant}` : '');
      const w = window.open(url, '_top');
      if(w !== null) return;
    }
  }catch{ /* fall through */ }
  try{ window.top.location.reload(); }
  catch{ window.location.reload(); }
}
