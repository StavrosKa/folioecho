import type { APIRoute } from 'astro';
import { guard,json } from '../../server/http.ts';
import { qlooConfigured } from '../../server/qloo-status.ts';
import { latest } from '../../server/store.ts';
import type { Run } from '../../lib/curator.ts';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{
  const blocked=guard(request,url);if(blocked)return blocked;
  try {
    const run=await latest<Run>('run');
    return json({configured:qlooConfigured(),evidenceAvailable:!!run?.edges?.some(edge=>edge.active&&Number.isFinite(edge.affinity))});
  }catch{return json({error:'Qloo status is unavailable.'},503);}
};
