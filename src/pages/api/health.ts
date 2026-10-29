import type { APIRoute } from 'astro';
import { get } from '../../server/store.ts';
import { json, guard } from '../../server/http.ts';
import { modelStatus } from '../../server/ai.ts';
import { qlooConfigured } from '../../server/qloo-status.ts';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{
  const blocked=guard(request,url); if(blocked) return blocked;
  try { await get('workspace','local'); const ai=await modelStatus(); return json({storage:'ready',qlooConfigured:qlooConfigured(),aiProvider:ai.provider,aiConfigured:ai.configured,openaiConfigured:ai.provider==='openai'&&ai.configured,geminiConfigured:ai.provider==='gemini'&&ai.configured}); }
  catch { return json({storage:'unavailable'},503); }
};
