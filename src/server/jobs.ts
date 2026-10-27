import { randomUUID } from 'node:crypto';
import { createRun, parseInput, repairRun, InputError } from './planner.ts';
import { get, put } from './store.ts';
import type { Run } from '../lib/curator.ts';
export interface Job { id: string; status: 'running' | 'done' | 'error' | 'cancelled'; message: string; completed: number; total: number; run?: Run; error?: string }
const active = new Map<string, Job>();
export function readJob(id: string): Job | undefined {
  const live = active.get(id);
  if (live) return live;
  const saved = get<Job>('job', id);
  return saved?.status === 'running' ? { ...saved, status: 'error', error: 'Server restarted. Start again; completed Qloo queries are cached.' } : saved;
}
export function cancelJob(id: string): Job | undefined {
  const job = active.get(id);
  if (job?.status === 'running') { job.status = 'cancelled'; job.message = 'Cancelled; the current Qloo request may finish before stopping.'; put('job', id, job); }
  return job;
}
export function startJob(body: any): Job {
  if ([...active.values()].some(j => j.status === 'running')) throw new InputError('A planning job is already running.');
  const input = body.action === 'create' ? parseInput(body.input) : undefined;
  if (!['create', 'repair'].includes(body.action)) throw new InputError('Unknown planning action.');
  const job: Job = { id: randomUUID(), status: 'running', message: body.action === 'repair' ? 'Repairing affected events' : 'Starting catalogue matching', completed: 0, total: 1 };
  active.set(job.id, job); put('job', job.id, job);
  const work = input ? createRun(input, undefined, (message, completed, total) => {
    if (job.status === 'cancelled') throw new InputError('Job cancelled.');
    Object.assign(job, { message, completed, total }); put('job', job.id, job);
  }) : repairRun(String(body.runId ?? ''), String(body.exclude ?? ''), Number(body.revision), body.stock, undefined, () => { if (job.status === 'cancelled') throw new InputError('Job cancelled.'); });
  void work.then(run => {
    if (job.status !== 'cancelled') Object.assign(job, { status: 'done', message: 'Ready', completed: job.total, run });
    put('job', job.id, job);
  }).catch(error => {
    if (job.status !== 'cancelled') Object.assign(job, { status: 'error', error: error instanceof Error ? error.message : 'Planning failed.' });
    put('job', job.id, job);
  }).finally(() => { active.delete(job.id); });
  return job;
}
