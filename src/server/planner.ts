import { randomUUID } from 'node:crypto';
import { parseCatalogue } from '../lib/catalogue.ts';
import { clustersFor, defaultConstraints, diverseSelection, eligibleBooks, generateProposals, type PlanningInput, type Run, type Evidence, type AgentTraceEvent } from '../lib/curator.ts';
import { recommend, resolveBook } from './qloo.ts';
import { owner } from './context.ts';
import { get, saveRun } from './store.ts';
import { QlooContextError } from './qloo-errors.ts';
import { mapConcurrent, QLOO_CONCURRENCY } from './concurrency.ts';
import { recordTrace, traceValidation } from './agent-trace.ts';

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
export async function applyNarratives(id: string, revision: number, entries: { id: string; title: string; idea: string }[], provider: 'OpenAI' | 'Gemini' = 'OpenAI', model?: string): Promise<Run> {
  const run = await get<Run>('run', id);
  if (!run || run.revision !== revision) throw new InputError('Run changed. Refresh before applying AI narratives.');
  if (creating || sessions.get(`${owner()}:${id}`)?.busy) throw new InputError('Planning is in progress. Try again after it finishes.');
  const allowed = new Set(run.selected);
  if (!entries.length || new Set(entries.map(e => e.id)).size !== entries.length || entries.some(e => !allowed.has(e.id) || typeof e.title !== 'string' || !e.title.trim() || e.title.length > 180 || typeof e.idea !== 'string' || !e.idea.trim() || e.idea.length > 1500)) throw new InputError('Model narratives failed validation.');
  run.revision++;
  run.proposals = run.proposals.map(proposal => {
    const narrative = entries.find(e => e.id === proposal.id);
    return narrative ? { ...proposal, title: narrative.title, interpretation: narrative.idea, narrativeSource: provider, narrativeModel: model } : proposal;
  });
  recordTrace(run,{phase:'editorial',status:'done',count:entries.length,summary:`Applied ${provider} editorial text to ${entries.length} proposals; Qloo evidence and scores were not changed.`});
  await saveRun(run); sessions.set(`${owner()}:${id}`, { run: structuredClone(run), touched: Date.now(), busy: false });
  return run;
}
export async function createRun(input: PlanningInput, provider: Provider = liveProvider, progress: (message: string, completed: number, total: number, trace?: AgentTraceEvent[]) => void | Promise<void> = () => {}): Promise<Run> {
  prune();
  if (creating || [...sessions.values()].some(s => s.busy)) throw new InputError('Another Qloo run is in progress. Try again when it finishes.');
  if (sessions.size >= 20) throw new InputError('Pilot session limit reached. Wait for old sessions to expire.');
  creating = true;
  try {
    const run: Run = { id: randomUUID(), revision: 1, createdAt: new Date().toISOString(), input, resolutions: [], clusters: [], edges: [], references: {}, proposals: [], selected: [], excluded: [], warnings: [], changes: [], trace: [] };
    const tags: Record<string, string[]> = {};
    let progressQueue:Promise<void>=Promise.resolve();
    const report=(message:string,done:number,total:number,trace?:AgentTraceEvent[])=>{
      const snapshot=trace?structuredClone(trace):undefined;
      progressQueue=progressQueue.then(()=>progress(message,done,total,snapshot));return progressQueue;
    };
    run.algorithmVersion = 'curator-v2.0';
    let completed = 0;
    const total = input.catalogue.length + eligibleBooks(input).length * targetTypes(input).length + 1;
    const emit=async(event:Parameters<typeof recordTrace>[1])=>{const row=recordTrace(run,event);await report(row.summary,completed,total,run.trace);};
    await emit({phase:'input',status:'done',summary:`Accepted ${input.catalogue.length} catalogue books and ${eligibleBooks(input).length} eligible hidden gems. Hard constraints are fixed for this run.`});
    for(const book of input.catalogue.filter(book=>book.hiddenGem&&!eligibleBooks(input).some(item=>item.id===book.id)))await emit({phase:'validation',status:'rejected',bookId:book.id,summary:`Excluded ${book.title} before candidate generation: ${book.stock<input.constraints.minStock?'insufficient stock':'outside the selected genre constraints'}.`});
    await mapConcurrent(input.catalogue,QLOO_CONCURRENCY,async book => {
      await report(`Matching ${book.title}`, completed, total);
      let result:Awaited<ReturnType<Provider['resolveBook']>>;
      try { result=await provider.resolveBook(book,input.matches[book.id]); }
      catch(error){await emit({phase:'tool',status:'error',tool:provider===liveProvider?'qloo.search':'provider.resolveBook',bookId:book.id,summary:'Entity resolution failed. No fabricated match or automatic retry was used.'});throw error;}
      await emit({phase:'tool',status:'done',tool:result.tool?.name??'provider.resolveBook',source:result.tool?(result.tool.cacheHit?'cache':'tool-call'):'provider',endpoint:result.tool?.endpoint,bookId:book.id,count:result.resolution.candidates.length,summary:`Resolved search tool for ${book.title}: ${result.resolution.candidates.length} candidate entities${result.tool?(result.tool.cacheHit?' · cached Qloo response':' · Qloo tool call (app cache miss)'):''}.`});
      await emit({phase:'resolution',status:result.resolution.status==='confirmed'?'done':'unverified',bookId:book.id,entityId:result.resolution.entityId,summary:`${book.title}: ${result.resolution.status==='confirmed'?'entity confirmed':'match needs owner review; do not infer an entity'}.`});
      run.resolutions.push(result.resolution); tags[book.id] = result.tags;
      completed++;
    });
    run.resolutions.sort((a,b)=>input.catalogue.findIndex(book=>book.id===a.bookId)-input.catalogue.findIndex(book=>book.id===b.bookId));
    run.clusters = clustersFor(input.catalogue, tags);
    await emit({phase:'cluster',status:'done',count:run.clusters.length,summary:`Grouped supplied catalogue/Qloo tags into ${run.clusters.length} thematic clusters.`});
    const retrievals:{book:PlanningInput['catalogue'][number];entityId:string;type:Evidence['type']}[]=[];
    for (const book of eligibleBooks(input)) {
      const resolution = run.resolutions.find(r => r.bookId === book.id)!;
      if (!resolution.entityId) { run.warnings.push(`${book.title}: entity match needs review; no recommendations requested.`); await emit({phase:'validation',status:'unverified',bookId:book.id,summary:`Skipped recommendations for ${book.title}: no confirmed Qloo entity.`}); continue; }
      for(const type of targetTypes(input))retrievals.push({book,entityId:resolution.entityId,type});
    }
    await mapConcurrent(retrievals,QLOO_CONCURRENCY,async({book,entityId,type})=>{
        await report(`Retrieving ${type === 'artist' ? 'music' : 'films'} for ${book.title}`, completed, total);
        let response:Awaited<ReturnType<Provider['recommend']>>;
        try { response=await provider.recommend(book.id,entityId,type); }
        catch(error){if(error instanceof QlooContextError){run.warnings.push(`${book.title}: Qloo rejected the ${type} recommendation context. Review the book match; no evidence available for this query.`);await emit({phase:'tool',status:'unverified',tool:'qloo.insights',bookId:book.id,summary:`Qloo rejected ${type} lookup for ${book.title}; continuing other contexts without invented evidence.`});completed++;return;}await emit({phase:'tool',status:'error',tool:provider===liveProvider?'qloo.insights':'provider.recommend',bookId:book.id,summary:'Cultural retrieval failed. No invented evidence or automatic retry was used.'});throw error;}
        await emit({phase:'tool',status:'done',tool:response.tool?.name??'provider.recommend',source:response.tool?(response.tool.cacheHit?'cache':'tool-call'):'provider',endpoint:response.tool?.endpoint,bookId:book.id,count:response.edges.length,summary:`Retrieved ${response.edges.length} ${type} links for ${book.title}${response.tool?(response.tool.cacheHit?' · cached Qloo response':' · Qloo tool call (app cache miss)'):''}.`});
        run.edges.push(...response.edges);
        const context = `${book.id}:${type}`;
        run.references[context] = { values: response.edges.map(e => e.affinity), capturedAt: run.createdAt, method: 'empirical-percentile' };
        if (!response.edges.length) run.warnings.push(`${book.title}: no verified ${type} candidates.`);
        if (response.warning) run.warnings.push(`${book.title}: ${response.warning}`);
        completed++;
    });
    run.edges.sort((a,b)=>input.catalogue.findIndex(book=>book.id===a.bookId)-input.catalogue.findIndex(book=>book.id===b.bookId)||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
    await report('Validating constraints and ranking events', total - 1, total);
    run.proposals = generateProposals(run);
    const validation=traceValidation(run);await report(validation.summary,completed,total,run.trace);
    await emit({phase:'ranking',status:'done',count:run.proposals.filter(proposal=>proposal.score!==null).length,summary:'Scored eligible proposals with R/N/U/F and fixed query-context affinity references. Rejected and unverified proposals were not ranked.'});
    run.selected = diverseSelection(run.proposals, input.constraints.maxEvents);
    await emit({phase:'selection',status:'done',count:run.selected.length,summary:`Selected ${run.selected.length} diverse eligible proposals.`});
    sessions.set(`${owner()}:${run.id}`, { run: structuredClone(run), touched: Date.now(), busy: false });
    if (provider === liveProvider) await saveRun(run);
    return run;
  } finally { creating = false; }
}
export async function repairRun(id: string, excludedId: string, revision: number, stock?: Record<string, number>, provider: Provider = liveProvider, checkpoint: (trace?:AgentTraceEvent[]) => void | Promise<void> = () => {}): Promise<Run> {
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
    let checkpointQueue:Promise<void>=Promise.resolve();
    const check=(trace?:AgentTraceEvent[])=>{const snapshot=trace?structuredClone(trace):undefined;checkpointQueue=checkpointQueue.then(()=>checkpoint(snapshot));return checkpointQueue;};
    const emit=async(event:Parameters<typeof recordTrace>[1])=>{recordTrace(run,event);await check(run.trace);};
    await emit({phase:'repair',status:'done',entityId:excludedId||undefined,summary:excludedId?`Owner excluded ${run.edges.find(edge=>edge.entityId===excludedId)?.name??'a cultural node'}; identifying affected proposals.`:'Owner changed stock; revalidating affected proposals.'});
    if (stock) {
      if (typeof stock !== 'object' || Array.isArray(stock) || !Object.keys(stock).length) throw new InputError('Stock changes must be a non-empty book-to-stock map.');
      for (const [bookId, amount] of Object.entries(stock)) {
        const book = run.input.catalogue.find(b => b.id === bookId);
        if (!book || !Number.isSafeInteger(amount) || amount < 0) throw new InputError('Invalid stock change.');
        const before=book.stock;book.stock = amount;
        await emit({phase:'input',status:'done',bookId,summary:`Stock changed for ${book.title}: ${before} → ${amount}.`});
      }
    }
    if (excludedId) run.excluded.push(excludedId);
    const changedBooks = new Set(stock ? Object.keys(stock) : []);
    const affected = previous.proposals.filter(p => p.bookIds.some(id => changedBooks.has(id)) || p.edgeIds.some(id => previous.edges.some(e => e.id === id && e.entityId === excludedId)));
    for (const edge of run.edges) edge.active = !run.excluded.includes(edge.entityId) && eligibleBooks(run.input).some(b => b.id === edge.bookId);
    const invalidated=run.edges.filter(edge=>!edge.active&&previous.edges.some(old=>old.id===edge.id&&old.active)).length;
    await emit({phase:'repair',status:'done',count:invalidated,summary:`Invalidated ${invalidated} graph edges; ${affected.length} proposals require repair.`});
    const contexts = new Set(previous.edges.filter(e => e.active && e.entityId === excludedId).map(e => e.context));
    for (const book of eligibleBooks(run.input).filter(b => changedBooks.has(b.id)))
      for (const type of targetTypes(run.input))
        if (!run.edges.some(e => e.bookId === book.id && e.type === type && e.active)) contexts.add(`${book.id}:${type}`);
    // Fetch alternatives only for contexts affected by the excluded node.
    await mapConcurrent([...contexts],QLOO_CONCURRENCY,async context => {
      await check();
      const bookId = context.slice(0, context.lastIndexOf(':'));
      const type = context.slice(context.lastIndexOf(':') + 1) as Evidence['type'];
      if (!eligibleBooks(run.input).some(b => b.id === bookId)) return;
      const entityId = run.resolutions.find(r => r.bookId === bookId)?.entityId;
      if (!entityId) return;
      let response:Awaited<ReturnType<Provider['recommend']>>;
      try { response=await provider.recommend(bookId,entityId,type,20); }
      catch(error){if(error instanceof QlooContextError){run.warnings.push(`${bookId}: Qloo rejected the alternative ${type} context; no new evidence was added.`);await emit({phase:'tool',status:'unverified',tool:'qloo.insights',bookId,summary:'Qloo rejected this alternative lookup; continuing with other recorded evidence.'});return;}await emit({phase:'tool',status:'error',tool:provider===liveProvider?'qloo.insights':'provider.recommend',bookId,summary:'Alternative retrieval failed. Repair stopped without fabricated evidence.'});throw error;}
      await emit({phase:'tool',status:'done',tool:response.tool?.name??'provider.recommend',source:response.tool?(response.tool.cacheHit?'cache':'tool-call'):'provider',endpoint:response.tool?.endpoint,bookId,count:response.edges.length,summary:`Retrieved ${response.edges.length} alternative ${type} candidates for the affected query${response.tool?(response.tool.cacheHit?' · cached Qloo response':' · Qloo tool call (app cache miss)'):''}.`});
      for (const alternative of response.edges) {
        if (!run.edges.some(e => e.id === alternative.id)) run.edges.push({ ...alternative, active: !run.excluded.includes(alternative.entityId) });
      }
      if (response.warning) run.warnings.push(response.warning);
      if (!run.references[context]) run.references[context] = { values: response.edges.map(e => e.affinity), capturedAt: new Date().toISOString(), method: 'empirical-percentile' };
      // Initial references are deliberately never replaced by the expanded pool.
    });
    const fresh = generateProposals(run);
    const affectedIds = new Set(affected.map(p => p.id));
    run.proposals = previous.proposals.map(p => affectedIds.has(p.id) ? fresh.find(n => n.id === p.id) ?? { ...p, status: 'rejected' as const, reasons: ['No eligible replacement remains.'], factors: null, score: null } : p);
    for (const proposal of fresh) if (!run.proposals.some(p => p.id === proposal.id)) run.proposals.push(proposal);
    run.changes = previous.proposals.flatMap(before => {
      const after = run.proposals.find(p => p.id === before.id) ?? null;
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ eventId: before.id, before, after, reason: excludedId ? 'Cultural node excluded; affected evidence invalidated and alternatives evaluated against the original reference pool.' : 'Inventory changed; stock constraints and utilization re-evaluated.' }];
    });
    await emit({phase:'repair',status:'done',count:run.changes.length,summary:`Repaired ${run.changes.length} affected proposals; preserved existing normalization references.`});
    traceValidation(run);await check(run.trace);
    await emit({phase:'ranking',status:'done',summary:'Reranked eligible proposals against the applicable fixed reference pools; unrelated proposals retained their scores.'});
    run.selected = diverseSelection(run.proposals, run.input.constraints.maxEvents);
    await emit({phase:'selection',status:'done',count:run.selected.length,summary:`Selected ${run.selected.length} diverse eligible proposals after repair.`});
    await check();
    session.run = structuredClone(run); session.touched = Date.now();
    if (provider === liveProvider) await saveRun(run);
    return run;
  } finally { session.busy = false; }
}
