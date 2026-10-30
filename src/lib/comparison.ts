import { eligibleBooks, type PlanningInput, type Run, type Evidence } from './curator.ts';

export interface BaselineEvent { title: string; idea: string; bookIds: string[]; curator: string; duration: number; culturalReferences: string[] }
export const comparisonProtocol = 'cultural-events-v2';
export interface Baseline { protocolVersion?: string; targetCount?: number; runId: string; revision: number; input: PlanningInput; createdAt: string; events: BaselineEvent[]; provider: string; model: string }
export type ConstraintIssue = 'stock' | 'selection' | 'book-count' | 'curator' | 'duration' | 'capacity' | 'screening-rights';
export function constraintIssues(event: Pick<BaselineEvent, 'bookIds' | 'curator' | 'duration'>, input: PlanningInput): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [], c = input.constraints, eligible = new Set(eligibleBooks(input).map(book => book.id));
  if (event.bookIds.some(id => !input.catalogue.some(book => book.id === id && book.stock >= c.minStock))) issues.push('stock');
  if (event.bookIds.some(id => !eligible.has(id))) issues.push('selection');
  if (!event.bookIds.length || event.bookIds.length > c.maxBooks || new Set(event.bookIds).size !== event.bookIds.length) issues.push('book-count');
  if (!input.preferences.curatorTypes.includes(event.curator as any)) issues.push('curator');
  if (!Number.isSafeInteger(event.duration) || event.duration <= 0 || event.duration > c.maxDuration) issues.push('duration');
  if (c.attendance > c.capacity) issues.push('capacity');
  if (event.curator !== 'listening' && !c.screeningRightsConfirmed) issues.push('screening-rights');
  return issues;
}
/** Verified means a recorded Qloo response, not thematic truth or screening permission. */
export function evidenceEdges(run: Run): Evidence[] {
  const confirmed = new Set(run.resolutions.filter(row => row.status === 'confirmed').map(row => row.bookId));
  return run.edges.filter(edge => edge.active && !run.excluded.includes(edge.entityId) && confirmed.has(edge.bookId) &&
    run.input.catalogue.some(book => book.id === edge.bookId) && Number.isFinite(edge.affinity) && !!edge.retrievedAt &&
    edge.request?.endpoint === '/v2/insights' && !!edge.request.query && !!edge.entityId);
}
function totals(events: Pick<BaselineEvent, 'bookIds' | 'curator' | 'duration'>[], input: PlanningInput) {
  const issues = events.map(event => constraintIssues(event, input));
  const overLimit = Math.max(0, events.length - input.constraints.maxEvents);
  return { proposals: events.length, passing: issues.filter(list => !list.length).length, stockErrors: issues.filter(list => list.includes('stock')).length,
    constraintErrors: issues.reduce((sum, list) => sum + list.filter(issue => issue !== 'stock').length, 0) + overLimit,
    eventsWithErrors: issues.filter(list => list.length).length, overLimit, issues };
}
export function measuredComparison(run: Run, baseline?: Baseline | null) {
  const qlooEvents = run.selected.flatMap(id => { const event = run.proposals.find(row => row.id === id); return event ? [event] : []; });
  const edges = evidenceEdges(run), edgeIds = new Set(qlooEvents.flatMap(event => event.edgeIds));
  const supported = edges.filter(edge => edgeIds.has(edge.id));
  const qloo = { ...totals(qlooEvents, run.input), culturalReferences: new Set(supported.map(edge => `${edge.type}:${edge.entityId}`)).size,
    verifiedReferences: new Set(supported.map(edge => `${edge.type}:${edge.entityId}`)).size, evidenceLinks: supported.length,
    unsupportedEvents: qlooEvents.filter(event => event.edgeIds.some(id => !edges.some(edge => edge.id === id)) || event.bookIds.some(id => !supported.some(edge => event.edgeIds.includes(edge.id) && edge.bookId === id))).length };
  const comparable = !!baseline && baseline.protocolVersion === comparisonProtocol && baseline.targetCount === qlooEvents.length && baseline.events.length === qlooEvents.length && baseline.runId === run.id && baseline.revision === run.revision && JSON.stringify(baseline.input) === JSON.stringify(run.input);
  const llm = comparable ? { ...totals(baseline.events, run.input), culturalReferences: new Set(baseline.events.flatMap(event => event.culturalReferences.map(name => name.trim().toLowerCase()))).size,
    verifiedReferences: 0, evidenceLinks: 0 } : null;
  return { runId: run.id, revision: run.revision, measuredAt: new Date().toISOString(), comparable, qloo, llm, graphEvidenceLinks: edges.length };
}
