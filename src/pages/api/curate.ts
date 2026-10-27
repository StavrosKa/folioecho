import type { APIRoute } from 'astro';
import { createRun, InputError, parseInput, repairRun } from '../../server/planner.ts';
import { QlooFailure } from '../../server/qloo.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  // This pilot has no account system: bind locally and reject public hosts.
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return json({ error: 'The Qloo pilot is available locally only.' }, 403);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Same-origin browser access is required.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON input is required.' }, 415);
  try {
    const text = await request.text();
    if (text.length > 100_000) return json({ error: 'Request is too large.' }, 413);
    const body = JSON.parse(text);
    const run = body.action === 'repair'
      ? await repairRun(String(body.runId ?? ''), String(body.exclude ?? ''), Number(body.revision), body.stock)
      : body.action === 'create' ? await createRun(parseInput(body.input)) : null;
    return run ? json(run) : json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof QlooFailure) return json({ error: error.message }, 502);
    if (error instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400);
    return json({ error: 'Planning failed. Check the local server setup; no results were fabricated.' }, 500);
  }
};
