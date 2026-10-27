import type { APIRoute } from 'astro';
import { guard, json } from '../../server/http.ts';
import { get } from '../../server/store.ts';
import { createReport } from '../../server/report.ts';
import type { Run } from '../../lib/curator.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  const blocked = guard(request, url, true); if (blocked) return blocked;
  try {
    const raw = await request.text(); if (raw.length > 3_100_000) return json({ error: 'Export too large.' }, 413);
    const body = JSON.parse(raw);
    const run = body.runId ? get<Run>('run', String(body.runId)) : undefined;
    if (body.runId && !run) return json({ error: 'Saved run not found.' }, 404);
    const name = String(body.name ?? 'folioecho-report.pdf').replace(/[^a-z\d_.-]/gi, '').replace(/\.json$/i, '.pdf');
    const pdf = await createReport(name, body.data, get('workspace', 'local'), run);
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'PDF export failed.' }, 400); }
};
