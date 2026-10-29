import type { APIRoute } from 'astro';
import { guard,json } from '../../server/http.ts';
import { accountStatus,changeAccount } from '../../server/ai-account.ts';
import { acquire,release } from '../../server/store.ts';
import { owner } from '../../server/context.ts';
import { randomUUID } from 'node:crypto';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{
  const blocked=guard(request,url);if(blocked)return blocked;
  try{return json(await accountStatus());}catch{return json({error:'AI settings are unavailable. Reconnect or check server storage.'},503);}
};
export const POST:APIRoute=async({request,url})=>{
  const blocked=guard(request,url,true);if(blocked)return blocked;
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON input is required.'},415);
  const key=`ai-billing:${owner()}`,token=randomUUID();
  if(!await acquire(key,token,120_000))return json({error:'An AI request is in progress. Wait before changing credentials.'},409);
  try{
    const raw=await request.text();if(raw.length>2500)return json({error:'Settings input is too large.'},413);
    await changeAccount(JSON.parse(raw));return json(await accountStatus());
  }catch(error){return json({error:error instanceof SyntaxError?'Invalid settings input.':error instanceof Error?error.message:'Could not update AI settings.'},400);}
  finally{await release(key,token);}
};
