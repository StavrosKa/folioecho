import { randomUUID } from 'node:crypto';
import { parseCatalogue } from '../lib/catalogue.ts';
import { clustersFor, defaultConstraints, diverseSelection, eligibleBooks, generateProposals, type PlanningInput, type Run, type Evidence } from '../lib/curator.ts';
import { recommend, resolveBook } from './qloo.ts';
import { owner } from './context.ts';
import { get, saveRun } from './store.ts';

export class InputError extends Error {}
const sessions = new Map<string, { run: Run; touched: number; busy: boolean }>();
let creating = false;
type Provider = { resolveBook: typeof resolveBook; recommend: typeof recommend };
const liveProvider: Provider = { resolveBook, recommend };
function prune() {
  for (const [id, value] of sessions) if (Date.now() - value.touched > 30 * 60_000 && !value.busy) sessions.delete(id);
}
export function parseInput(raw: unknown): PlanningInput {
  if (!raw || typeof raw !== 'object') throw new InputError('Planning input is required.');
  const value = raw as Record<string, any>;
  let catalogue;
  try { catalogue = parseCatalogue(value.catalogue); } catch { throw new InputError('Invalid catalogue. Supply unique IDs, title, author, stock, tags and hiddenGem.'); }
  if (catalogue.length > 25) throw new InputError('This local pilot supports up to 25 catalogue titles per run.');
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string' && s.length <= 100);
  if (!strings(value.selectedGenres ?? [])) throw new InputError('Genres must be a list of strings.');
  const types = value.preferences?.curatorTypes;
  if (!strings(types) || !types.length || types.some(t => !['listening', 'cinema', 'mixed'].includes(t))) throw new InputError('Choose a supported curator type.');
  if (value.constraints && Object.keys(value.constraints).some(k => !Object.hasOwn(defaultConstraints, k))) throw new InputError('Unsupported hard constraint; it cannot be silently ignored.');
  const constraints = { ...defaultConstraints, ...value.constraints };
  for (const [key, min, max] of [['minStock', 1, 1000], ['maxBooks', 1, 5], ['maxEvents', 1, 10], ['maxDuration', 15, 600], ['capacity', 1, 1000], ['attendance', 1, 1000]] as const) {
    if (!Number.isSafeInteger(constraints[key]) || constraints[key] < min || constraints[key] > max) throw new InputError(`Invalid constraint: ${key}.`);
  }
  if (typeof constraints.screeningRightsConfirmed !== 'boolean') throw new InputError('Screening-rights confirmation must be boolean.');
  const matches = value.matches ?? {};
  if (!matches || typeof matches !== 'object' || Array.isArray(matches) || Object.values(matches).some(v => typeof v !== 'string' || !/^[a-f\d-]{36}$/i.test(v))) throw new InputError('Invalid entity selections.');
  const input: PlanningInput = { catalogue, selectedGenres: [...new Set<string>((value.selectedGenres ?? []).map((s: string) => s.trim().toLowerCase()))], preferences: { curatorTypes: [...new Set(types)] as PlanningInput['preferences']['curatorTypes'] }, constraints, matches };
  const gems = catalogue.filter(b => b.hiddenGem);
  if (gems.length < 3 || gems.length > 5) throw new InputError('Select 3–5 hidden gems before planning.');
  if (!eligibleBooks(input).length) throw new InputError('No selected hidden gems meet stock and genre constraints.');
  return input;
}
function targetTypes(input: PlanningInput): Evidence['type'][] {
  const types = input.preferences.curatorTypes;
  return [...(types.some(t => t !== 'cinema') ? ['artist' as const] : []), ...(types.some(t => t !== 'listening') ? ['movie' as const] : [])];
}
export async function applyNarratives(id: string, revision: number, entries: { id: string; title: string; idea: string }[]): Promise<Run> {
  const run = await get<Run>('run', id);
  if (!run || run.revision !== revision) throw new InputError('Run changed. Refresh before applying AI narratives.');
  if (creating || sessions.get(`${owner()}:${id}`)?.busy) throw new InputError('Planning is in progress. Try again after it finishes.');
  const allowed = new Set(run.selected);
  if (!entries.length || new Set(entries.map(e => e.id)).size !== entries.length || entries.some(e => !allowed.has(e.id) || typeof e.title !== 'string' || !e.title.trim() || e.title.length > 180 || typeof e.idea !== 'string' || !e.idea.trim() || e.idea.length > 1500)) throw new InputError('Model narratives failed validation.');
  run.revision++;
  run.proposals = run.proposals.map(proposal => {
    const narrative = entries.find(e => e.id === proposal.id);
    return narrative ? { ...proposal, title: narrative.title, interpretation: narrative.idea, narrativeSource: 'OpenAI' } : proposal;
  });
  await saveRun(run); sessions.set(`${owner()}:${id}`, { run: structuredClone(run), touched: Date.now(), busy: false });
  return run;
}
export async function createRun(input: PlanningInput, provider: Provider = liveProvider, progress: (message: string, completed: number, total: number) => void | Promise<void> = () => {}): Promise<Run> {
  prune();
  if (creating || [...sessions.values()].some(s => s.busy)) throw new InputError('Another Qloo run is in progress. Try again when it finishes.');
  if (sessions.size >= 20) throw new InputError('Pilot session limit reached. Wait for old sessions to expire.');
  creating = true;
  try {
    const run: Run = { id: randomUUID(), revision: 1, createdAt: new Date().toISOString(), input, resolutions: [], clusters: [], edges: [], references: {}, proposals: [], selected: [], excluded: [], warnings: [], changes: [] };
    const tags: Record<string, string[]> = {};
    run.algorithmVersion = 'curator-v2.0';
    let completed = 0;
    const total = input.catalogue.length + eligibleBooks(input).length * targetTypes(input).length + 1;
    for (const book of input.catalogue) {
      await progress(`Matching ${book.title}`, completed, total);
      const result = await provider.resolveBook(book, input.matches[book.id]);
      run.resolutions.push(result.resolution); tags[book.id] = result.tags;
      completed++;
    }
    run.clusters = clustersFor(input.catalogue, tags);
    for (const book of eligibleBooks(input)) {
      const resolution = run.resolutions.find(r => r.bookId === book.id)!;
      if (!resolution.entityId) { run.warnings.push(`${book.title}: entity match needs review; no recommendations requested.`); continue; }
      for (const type of targetTypes(input)) {
        await progress(`Retrieving ${type === 'artist' ? 'music' : 'films'} for ${book.title}`, completed, total);
        const response = await provider.recommend(book.id, resolution.entityId, type);
        run.edges.push(...response.edges);
        const context = `${book.id}:${type}`;
        run.references[context] = { values: response.edges.map(e => e.affinity), capturedAt: run.createdAt, method: 'empirical-percentile' };
        if (!response.edges.length) run.warnings.push(`${book.title}: no verified ${type} candidates.`);
        if (response.warning) run.warnings.push(`${book.title}: ${response.warning}`);
        completed++;
      }
    }
    await progress('Validating constraints and ranking events', total - 1, total);
    run.proposals = generateProposals(run);
    run.selected = diverseSelection(run.proposals, input.constraints.maxEvents);
    sessions.set(`${owner()}:${run.id}`, { run: structuredClone(run), touched: Date.now(), busy: false });
    if (provider === liveProvider) await saveRun(run);
    return run;
  } finally { creating = false; }
}
export async function repairRun(id: string, excludedId: string, revision: number, stock?: Record<string, number>, provider: Provider = liveProvider, checkpoint: () => void | Promise<void> = () => {}): Promise<Run> {
  prune();
  let session = sessions.get(`${owner()}:${id}`);
  if (provider === liveProvider) {
    const saved = await get<Run>('run', id);
    if (saved) { session = { run: saved, touched: Date.now(), busy: false }; sessions.set(`${owner()}:${id}`, session); }
  }
  if (!session) throw new InputError('Run expired or server restarted. Generate a new plan.');
  if (session.busy || creating || [...sessions.values()].some(s => s.busy)) throw new InputError('A Qloo operation is already in progress.');
  if (revision !== session.run.revision) throw new InputError('This result is stale. Generate a fresh run.');
  if (excludedId && !session.run.edges.some(e => e.entityId === excludedId && e.active)) throw new InputError('Cultural node is not active in this run.');
  if (!excludedId && !stock) throw new InputError('Choose a cultural node or provide a stock change.');
  session.busy = true;
  try {
    const previous = session.run;
    const run = structuredClone(previous);
    run.revision++;
    if (stock) {
      if (typeof stock !== 'object' || Array.isArray(stock) || !Object.keys(stock).length) throw new InputError('Stock changes must be a non-empty book-to-stock map.');
      for (const [bookId, amount] of Object.entries(stock)) {
        const book = run.input.catalogue.find(b => b.id === bookId);
        if (!book || !Number.isSafeInteger(amount) || amount < 0) throw new InputError('Invalid stock change.');
        book.stock = amount;
      }
    }
    if (excludedId) run.excluded.push(excludedId);
    const changedBooks = new Set(stock ? Object.keys(stock) : []);
    const affected = previous.proposals.filter(p => p.bookIds.some(id => changedBooks.has(id)) || p.edgeIds.some(id => previous.edges.some(e => e.id === id && e.entityId === excludedId)));
    for (const edge of run.edges) edge.active = !run.excluded.includes(edge.entityId) && eligibleBooks(run.input).some(b => b.id === edge.bookId);
    const contexts = new Set(previous.edges.filter(e => e.active && e.entityId === excludedId).map(e => e.context));
    for (const book of eligibleBooks(run.input).filter(b => changedBooks.has(b.id)))
      for (const type of targetTypes(run.input))
        if (!run.edges.some(e => e.bookId === book.id && e.type === type && e.active)) contexts.add(`${book.id}:${type}`);
    // Fetch alternatives only for contexts affected by the excluded node.
    for (const context of contexts) {
      await checkpoint();
      const bookId = context.slice(0, context.lastIndexOf(':'));
      const type = context.slice(context.lastIndexOf(':') + 1) as Evidence['type'];
      if (!eligibleBooks(run.input).some(b => b.id === bookId)) continue;
      const entityId = run.resolutions.find(r => r.bookId === bookId)?.entityId;
      if (!entityId) continue;
      const response = await provider.recommend(bookId, entityId, type, 20);
      for (const alternative of response.edges) {
        if (!run.edges.some(e => e.id === alternative.id)) run.edges.push({ ...alternative, active: !run.excluded.includes(alternative.entityId) });
      }
      if (response.warning) run.warnings.push(response.warning);
      if (!run.references[context]) run.references[context] = { values: response.edges.map(e => e.affinity), capturedAt: new Date().toISOString(), method: 'empirical-percentile' };
      // Initial references are deliberately never replaced by the expanded pool.
    }
    const fresh = generateProposals(run);
    const affectedIds = new Set(affected.map(p => p.id));
    run.proposals = previous.proposals.map(p => affectedIds.has(p.id) ? fresh.find(n => n.id === p.id) ?? { ...p, status: 'rejected' as const, reasons: ['No eligible replacement remains.'], factors: null, score: null } : p);
    for (const proposal of fresh) if (!run.proposals.some(p => p.id === proposal.id)) run.proposals.push(proposal);
    run.changes = previous.proposals.flatMap(before => {
      const after = run.proposals.find(p => p.id === before.id) ?? null;
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ eventId: before.id, before, after, reason: excludedId ? 'Cultural node excluded; affected evidence invalidated and alternatives evaluated against the original reference pool.' : 'Inventory changed; stock constraints and utilization re-evaluated.' }];
    });
    run.selected = diverseSelection(run.proposals, run.input.constraints.maxEvents);
    await checkpoint();
    session.run = structuredClone(run); session.touched = Date.now();
    if (provider === liveProvider) await saveRun(run);
    return run;
  } finally { session.busy = false; }
}
