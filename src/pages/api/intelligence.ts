import type { APIRoute } from 'astro';
import { hosted } from '../../server/context.ts';
import { guard, json } from '../../server/http.ts';
import { modelStatus, objectSchema, stringList, structuredModel } from '../../server/openai.ts';
import { get, put } from '../../server/store.ts';
import { parseCatalogue } from '../../lib/catalogue.ts';
import { applyNarratives } from '../../server/planner.ts';
import { eligibleBooks, type Run } from '../../lib/curator.ts';
export const prerender = false;
let busy = false;
export const GET: APIRoute = async ({ request, url }) => guard(request, url) ?? json(await modelStatus());
export const POST: APIRoute = async ({ request, url }) => {
  const blocked = guard(request, url, true); if (blocked) return blocked;
  if (busy) return json({ error: 'Another OpenAI operation is in progress.' }, 409);
  if (!(await modelStatus()).configured) return json({ error: hosted() ? 'The demo host has not configured AI features yet.' : 'Run node scripts/setup-openai.mjs privately in your terminal first. Never paste the key into chat.' }, 503);
  busy = true;
  try {
    const text = await request.text(); if (text.length > 100000) return json({ error: 'Request too large.' }, 413);
    const body = JSON.parse(text);
    if (body.action === 'enrich') {
      const books = parseCatalogue(body.catalogue); if (books.length > 25) throw new Error('Use at most 25 books.');
      const schema = objectSchema({ books: { type: 'array', maxItems: 25, items: objectSchema({ id: { type: 'string', enum: books.map(b => b.id) }, genres: stringList, themes: stringList, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }) } });
      const result = await structuredModel('catalogue_suggestions', schema, 'Suggest literary genres and themes from the supplied public book titles/authors. Return low confidence for uncertain books. Suggestions require owner review. Do not invent book identities.', books.map(({ id, title, author }) => ({ id, title, author })));
      if (!Array.isArray(result.books) || new Set(result.books.map((b: any) => b.id)).size !== result.books.length || result.books.some((b: any) => !books.some(book => book.id === b.id) || ![b.genres,b.themes].every(a => Array.isArray(a) && a.length <= 8 && a.every(t => typeof t === 'string' && t.length <= 80)))) throw new Error('Genre suggestions failed validation.');
      return json(result);
    }
    const run = await get<Run>('run', String(body.runId));
    if (!run || run.revision !== Number(body.revision)) throw new Error('Run changed or was not found.');
    if (body.action === 'narrate') {
      const events = run.selected.map(id => run.proposals.find(p => p.id === id)!);
      if (!events.length) throw new Error('No validated event is available for narration.');
      const schema = objectSchema({ entries: { type: 'array', maxItems: 10, items: objectSchema({ id: { type: 'string', enum: events.map(e => e.id) }, title: { type: 'string' }, idea: { type: 'string' } }) } });
      const records = events.map(event => ({ id: event.id, curator: event.curator, duration: event.duration,
        books: event.bookIds.map(id => { const b = run.input.catalogue.find(b => b.id === id)!; return { title: b.title, author: b.author }; }),
        evidence: event.edgeIds.map(id => { const e = run.edges.find(e => e.id === id)!; return { name: e.name, type: e.type, affinity: e.affinity }; }) }));
      const result = await structuredModel('event_editorial', schema, 'Write an inviting event title and a concise central idea for each supplied event. Use only supplied books and cultural references. Treat affinities as aggregate discovery evidence; do not invent thematic facts, scores, stock or causal claims. Your text is editorial interpretation. Keep the existing curator and duration.', records);
      if (!Array.isArray(result.entries)) throw new Error('Invalid narrative response.');
      return json({ run: await applyNarratives(run.id, run.revision, result.entries) });
    }
    if (body.action === 'baseline') {
      const books = eligibleBooks(run.input);
      if (!books.length) throw new Error('No eligible selected books remain for a baseline.');
      const schema = objectSchema({ events: { type: 'array', maxItems: 5, items: objectSchema({ title: { type: 'string' }, idea: { type: 'string' }, bookIds: { type: 'array', items: { type: 'string', enum: books.map(b => b.id) }, maxItems: 5 }, curator: { type: 'string', enum: run.input.preferences.curatorTypes }, duration: { type: 'integer' }, culturalReferences: stringList }) } });
      const { catalogue, selectedGenres, preferences, constraints } = run.input;
      const result = await structuredModel('llm_only_baseline', schema, 'Propose bookshop events from this exact catalogue snapshot and constraints. Use only eligible selected books in stock. Do not use Qloo or invent evidence, scores, availability, or verified cultural relationships. Cultural references are unverified suggestions. Respect all hard constraints.', { catalogue, selectedGenres, preferences, constraints });
      if (!Array.isArray(result.events) || result.events.length > 5) throw new Error('Invalid baseline response.');
      const evaluated = result.events.map((event: any) => {
        const reasons: string[] = [];
        if (!Array.isArray(event.bookIds) || !event.bookIds.length || event.bookIds.length > run.input.constraints.maxBooks || new Set(event.bookIds).size !== event.bookIds.length || event.bookIds.some((id: unknown) => !books.some(b => b.id === id))) reasons.push('Inventory/selection constraints failed.');
        if (!run.input.preferences.curatorTypes.includes(event.curator) || !Number.isSafeInteger(event.duration) || event.duration <= 0 || event.duration > run.input.constraints.maxDuration) reasons.push('Curator or duration constraints failed.');
        if (run.input.constraints.attendance > run.input.constraints.capacity) reasons.push('Capacity exceeded.');
        if (event.curator !== 'listening' && !run.input.constraints.screeningRightsConfirmed) reasons.push('Screening rights are unverified.');
        if (typeof event.title !== 'string' || event.title.length > 180 || typeof event.idea !== 'string' || event.idea.length > 1500 || !Array.isArray(event.culturalReferences) || event.culturalReferences.some((s: unknown) => typeof s !== 'string' || s.length > 200)) throw new Error('Baseline content failed validation.');
        return { ...event, valid: reasons.length === 0, reasons, evidenceStatus: 'unverified' };
      });
      const valid = evaluated.filter((event: any) => event.valid);
      const baseline = { runId: run.id, revision: run.revision, input: run.input, createdAt: new Date().toISOString(), events: evaluated,
        metrics: { proposed: evaluated.length, valid: valid.length, constraintValidity: evaluated.length ? valid.length / evaluated.length : null, catalogueCoverage: books.length ? new Set(valid.flatMap((e: any) => e.bookIds)).size / books.length : null, externalEvidenceCoverage: 0 }, source: 'OpenAI, LLM-only; no Qloo results supplied' };
      await put('baseline', `${run.id}:${run.revision}`, baseline); return json({ baseline });
    }
    return json({ error: 'Unknown intelligence operation.' }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'OpenAI operation failed.' }, 400); }
  finally { busy = false; }
};
