import type { APIRoute } from 'astro';
import { guard, json } from '../../server/http.ts';
import { startJob, readJob, cancelJob } from '../../server/jobs.ts';
export const prerender = false;
export const GET: APIRoute = ({ request, url }) => {
  const blocked = guard(request, url); if (blocked) return blocked;
  const job = readJob(url.searchParams.get('id') ?? '');
  return job ? json(job) : json({ error: 'Job not found.' }, 404);
};
export const POST: APIRoute = async ({ request, url }) => {
  const blocked = guard(request, url, true); if (blocked) return blocked;
  try {
    const raw = await request.text(); if (raw.length > 100000) return json({ error: 'Input too large.' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'cancel') return json(cancelJob(String(body.id)) ?? { error: 'Job is no longer active.' });
    return json(startJob(body), 202);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Invalid request.' }, 400); }
};
