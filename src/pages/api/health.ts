import type { APIRoute } from 'astro';
import { get } from '../../server/store.ts';
import { json, guard } from '../../server/http.ts';
import { modelStatus } from '../../server/openai.ts';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{
  const blocked=guard(request,url); if(blocked) return blocked;
  try { await get('workspace','local'); return json({storage:'ready',qlooConfigured:!!process.env.QLOO_API_KEY,openaiConfigured:(await modelStatus()).configured}); }
  catch { return json({storage:'unavailable'},503); }
};
