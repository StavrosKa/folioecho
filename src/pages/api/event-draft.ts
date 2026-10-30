import type { APIRoute } from 'astro';
import { guard,json } from '../../server/http.ts';
import { get,latest } from '../../server/store.ts';
import type { Run } from '../../lib/curator.ts';
import type { Book } from '../../lib/catalogue.ts';
import { eventDraftFromRun } from '../../server/event-draft.ts';
export const prerender=false;
export const POST:APIRoute=async({request,url})=>{
  const blocked=guard(request,url,true);if(blocked)return blocked;
  try{
    const raw=await request.text();if(raw.length>2000)return json({error:'Request too large.'},413);
    const body=JSON.parse(raw),run=await get<Run>('run',String(body.runId));
    if(!run||run.revision!==body.revision)return json({error:'The Event Studio run changed or was not found. Refresh before creating a draft.'},409);
    const current=await latest<Run>('run');
    if(current&&current.id!==run.id)return json({error:'A newer Event Studio run is available. Open its latest ideas before creating a draft.'},409);
    const workspace=await get<{books:Book[]}>('workspace','local');
    if(workspace&&JSON.stringify(workspace.books)!==JSON.stringify(run.input.catalogue))return json({error:'The catalogue has changed. Generate or repair the Event Studio plan before creating a draft.'},409);
    return json({draft:eventDraftFromRun(run,String(body.proposalId))});
  }catch(error){return json({error:error instanceof SyntaxError?'Invalid draft request.':error instanceof Error?error.message:'Could not create the event draft.'},400);}
};
