/* =========================================================================
   Microsoft Teams (05 Oct) -- post approved Minutes to a meeting's channel.

   The Teams connector is an action-only connector. `power-apps
   add-data-source -a shared_teams -c <connection>` generates a 5,500-line
   registry entry and a 130 KB service for every Teams action; this app needs
   two, so only those are registered here, the way sharepoint.js adds the
   SharePoint file actions. Both definitions are copied from that generated
   entry (connector schema of 05 Oct):

     AtMentionUser          GET  /{connectionId}/v1.0/users/{userId}
                            -> { atMention }  a token placed in message HTML
     PostMessageToChannelV3 POST /{connectionId}/v3/beta/teams/{groupId}/channels/{channelId}/messages
                            body { subject?, body: { content, contentType } }

   The data source is named "teams"; the deployed app's power.config.json must
   carry a shared_teams connection reference with dataSources ["teams"]. The
   message is posted as the signed-in user (their own Teams connection).

   ⚠️ The "teams" entry MUST be in the generated registry file
   (apps/leadership/.power/schemas/appschemas/dataSourcesInfo.ts) when the
   app starts. The runtime's RuntimeDataSourceService.initialize() copies the
   registry's KEYS into its own object once, so an entry added at run time is
   never found -- "Data source not found: Unable to find data source: teams in
   data sources info" (first live try, 05 Oct). Actions added to an EXISTING
   entry are found (entries are shared by reference), which is why
   sharepoint.js can add its file actions to "documents" -- and why the code
   below only tops up the apis of an entry that is already there. The entry
   holds just these two actions, copied from the CLI-generated registry.
   ========================================================================= */
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '@generated/../../.power/schemas/appschemas/dataSourcesInfo';

const DS = 'teams';
const p = (name, where, required = true, type = 'string') => ({ name, in: where, required, type });
const ENTRY = {
  tableId: '', version: '', primaryKey: '', dataSourceType: 'Connector',
  apis: {
    AtMentionUser: {
      path: '/{connectionId}/v1.0/users/{userId}',
      method: 'GET',
      parameters: [p('connectionId', 'path'), p('userId', 'path')],
      responseInfo: { 200: { type: 'object' } },
    },
    PostMessageToChannelV3: {
      path: '/{connectionId}/v3/beta/teams/{groupId}/channels/{channelId}/messages',
      method: 'POST',
      parameters: [p('connectionId', 'path'), p('groupId', 'path'), p('channelId', 'path'),
                   { name: 'body', in: 'body', required: true, type: 'object' }],
      responseInfo: { 201: { type: 'object' } },
    },
  },
};

let client = null;
function teamsClient(){
  if(client) return client;
  if(!dataSourcesInfo[DS]) dataSourcesInfo[DS] = ENTRY;
  else Object.assign((dataSourcesInfo[DS].apis = dataSourcesInfo[DS].apis || {}), ENTRY.apis);
  client = getClient(dataSourcesInfo);
  return client;
}
const call = (operationName, parameters) =>
  teamsClient().executeAsync({ connectorOperation: { tableName: DS, operationName, parameters } });
const errorOf = res => res?.error?.message || (typeof res?.error === 'string' ? res.error : '') || 'Teams refused the request';

/** An @mention token for one user (Entra object id or sign-in email), or
 *  null when Teams cannot resolve them -- the caller then names them in bold. */
export async function teamsMentionToken(userId){
  if(!userId) return null;
  try{
    const res = await call('AtMentionUser', { userId });
    if(res?.success === false) throw new Error(errorOf(res));
    const data = res?.data ?? res;
    return data?.atMention || null;
  }catch(e){
    console.warn('[teams] AtMentionUser failed for', userId, e);
    return null;
  }
}

/** Posts an HTML message to a channel as the signed-in user. Throws with
 *  Teams' own message on failure. */
export async function postToTeamsChannel(teamId, channelId, { subject, html }){
  if(!teamId || !channelId) throw new Error('this channel has no Teams ids');
  const body = { body: { content: html, contentType: 'html' } };
  if(subject) body.subject = subject;
  const res = await call('PostMessageToChannelV3', { groupId: teamId, channelId, body });
  if(res?.success === false) throw new Error(errorOf(res));
  return res?.data ?? null;
}
