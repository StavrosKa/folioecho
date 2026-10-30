import { randomUUID } from 'node:crypto';
import { createRun, parseInput, repairRun, InputError } from './planner.ts';
import { get, put, acquire, release, consume } from './store.ts';
import { hosted, owner } from './context.ts';
import { sign } from './session.ts';
import type { Run, AgentTraceEvent } from '../lib/curator.ts';
export interface Job { trace?:AgentTraceEvent[]; id:string; status:'running'|'done'|'error'|'cancelled'; message:string; completed:number; total:number; run?:Run; error?:string; createdAt?:number; startedAt?:number }
type SavedJob = Job & { body?:any; lease?:string };
const active = new Set<string>();
const lifetime = 13 * 60_000;
export async function readJob(id:string): Promise<Job|undefined> {
  const saved = await get<SavedJob>('job',id);
  if (!saved) return;
  const { body: _body, lease: _lease, ...job } = saved;
  if (job.status === 'running' && (hosted() ? Date.now() - (job.createdAt ?? 0) > lifetime : !active.has(id))) return { ...job,status:'error',error:'Server restarted or job timed out. Start again; completed Qloo queries are cached.' };
  return job;
}
export async function cancelJob(id:string) {
  const job = await get<SavedJob>('job',id);
  if (job?.status === 'running') { job.status='cancelled'; job.message='Cancelled; the current request may finish before stopping.'; await put('job',id,job); }
  return readJob(id);
}
export async function executeJob(id:string) {
  const claim = randomUUID();
  if (!await acquire(`job:${owner()}:${id}`,claim)) return;
  let globalClaim = false;
  let saved:SavedJob|undefined;
  try {
    saved = await get<SavedJob>('job',id);
    if (!saved || saved.status !== 'running' || saved.startedAt) return; // redelivery never repeats provider calls
    globalClaim = await acquire('provider-planner',claim);
    if (!globalClaim) throw new InputError('The shared demo planner is busy. Please try again shortly.');
    const body = saved.body; saved.startedAt=Date.now(); await put('job',id,saved);
    const checkpoint = async (trace?:AgentTraceEvent[]) => {
      if (Date.now() - saved!.createdAt! > lifetime) throw new InputError('Demo planning time limit reached. Completed queries are cached.');
      if ((await get<Job>('job',id))?.status === 'cancelled') throw new InputError('Job cancelled.');
      if(trace){saved!.trace=structuredClone(trace);saved!.message=trace.at(-1)?.summary??saved!.message;await put('job',id,saved);}
    };
    const run = body.action === 'create'
      ? await createRun(parseInput(body.input),undefined,async (message,completed,total,trace) => { await checkpoint(); Object.assign(saved!,{message,completed,total,...(trace?{trace:structuredClone(trace)}:{})}); await put('job',id,saved); })
      : await repairRun(String(body.runId),String(body.exclude ?? ''),Number(body.revision),body.stock,undefined,checkpoint);
    await checkpoint(); Object.assign(saved,{status:'done',message:'Ready',completed:saved.total,run});
  } catch(e) {
    if (saved) Object.assign(saved,{status:'error',error:e instanceof InputError ? e.message : 'Planning failed. Check provider configuration, quota and connectivity.'});
  } finally {
    if (saved) {
      const current = await get<Job>('job',id);
      if (current?.status !== 'cancelled') { delete saved.body; await put('job',id,saved); }
      if (saved.lease) await release(`planning:${owner()}`,saved.lease);
    }
    if (globalClaim) await release('provider-planner',claim);
    await release(`job:${owner()}:${id}`,claim); active.delete(id);
  }
}
export async function startJob(body:any, origin?:string):Promise<Job> {
  if (!['create','repair'].includes(body.action)) throw new InputError('Unknown planning action.');
  if (body.action === 'create') parseInput(body.input);
  else if (!await get<Run>('run',String(body.runId))) throw new InputError('Saved run not found in this workspace.');
  if (hosted() && !await consume(`plans:${owner()}:${new Date().toISOString().slice(0,10)}`,6)) throw new InputError('This visitor has reached the daily planning limit.');
  const lease=randomUUID(); const key=`planning:${owner()}`;
  if (!await acquire(key,lease)) throw new InputError('A planning operation is already running in your workspace.');
  const job:SavedJob={id:randomUUID(),status:'running',message:'Starting catalogue matching',completed:0,total:1,createdAt:Date.now(),body,lease};
  try {
    await put('job',job.id,job);
    if (hosted()) {
      if (!origin) throw new Error('Missing deployment origin.');
      const payload=JSON.stringify({id:job.id,owner:owner(),expires:Date.now()+60_000});
      const response=await fetch(new URL('/.netlify/functions/planner-background',origin),{method:'POST',headers:{'Content-Type':'application/json','X-Folioecho-Signature':sign(payload)},body:payload,signal:AbortSignal.timeout(10_000)});
      if (response.status !== 202) throw new Error('Background dispatch failed.');
    } else { active.add(job.id); void executeJob(job.id).catch(() => active.delete(job.id)); }
    return {id:job.id,status:job.status,message:job.message,completed:0,total:1};
  } catch {
    await put('job',job.id,{...job,body:undefined,status:'error',error:'Background worker could not start.'});
    await release(key,lease); throw new InputError('Background worker could not start. Check the deployment configuration.');
  }
}
