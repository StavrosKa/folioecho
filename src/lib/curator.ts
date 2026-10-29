import type { Book } from './catalogue.ts';

export type CuratorType = 'listening' | 'cinema' | 'mixed';
export interface PlanningInput {
  catalogue: Book[];
  selectedGenres: string[];
  preferences: { curatorTypes: CuratorType[] };
  constraints: { minStock: number; maxBooks: number; maxEvents: number; maxDuration: number; capacity: number; attendance: number; screeningRightsConfirmed: boolean };
  matches: Record<string, string>;
}
export interface Resolution { bookId: string; status: 'confirmed' | 'needs_input' | 'missing'; candidates: { id: string; name: string; detail: string }[]; entityId?: string }
export interface Evidence {
  id: string; bookId: string; entityId: string; name: string; type: 'artist' | 'movie'; affinity: number;
  popularity?: number; context: string; retrievedAt: string; active: boolean;
  request: { endpoint: string; query: Record<string, unknown> };
}
export interface Reference { values: number[]; capturedAt: string; method: 'empirical-percentile'; }
export interface Cluster { id: string; theme: string; bookIds: string[]; source: 'catalogue-tags' | 'qloo-tags' | 'ungrouped' }
export interface Proposal {
  narrativeSource?: 'OpenAI' | 'Gemini';
  narrativeModel?: string;
  id: string; title: string; curator: CuratorType; bookIds: string[]; edgeIds: string[]; duration: number;
  status: 'valid' | 'unverified' | 'rejected'; reasons: string[];
  factors: { R: number; N: number; U: number; F: number } | null; score: number | null; interpretation: string;
}
export interface Run {
  algorithmVersion?: string;
  id: string; revision: number; createdAt: string; input: PlanningInput; resolutions: Resolution[];
  clusters: Cluster[]; edges: Evidence[]; references: Record<string, Reference>;
  proposals: Proposal[]; selected: string[]; excluded: string[]; warnings: string[];
  changes: { eventId: string; before: Proposal; after: Proposal | null; reason: string }[];
}
export const defaultConstraints: PlanningInput['constraints'] = {
  minStock: 1, maxBooks: 3, maxEvents: 5, maxDuration: 150, capacity: 24, attendance: 12, screeningRightsConfirmed: false,
};
export const contextKey = (bookId: string, type: string) => `${bookId}:${type}`;
export function percentile(value: number, reference: Reference): number {
  const values = reference.values;
  if (!values.length || values.every(v => v === values[0])) return .5;
  if (value < Math.min(...values)) return 0;
  if (value > Math.max(...values)) return 1;
  const below = values.filter(v => v < value).length;
  const equal = values.filter(v => v === value).length;
  return Math.max(0, Math.min(1, (below + Math.max(0, equal - 1) / 2) / (values.length - 1)));
}
export function clustersFor(books: Book[], qlooTags: Record<string, string[]> = {}): Cluster[] {
  const groups = new Map<string, Cluster>();
  for (const book of books) {
    const supplied = book.tags.length > 0;
    const tags = supplied ? book.tags : (qlooTags[book.id] ?? []);
    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase();
      const key = `${supplied ? 'catalogue' : 'qloo'}:${normalized}`;
      const group = groups.get(key) ?? { id: key, theme: normalized, bookIds: [], source: supplied ? 'catalogue-tags' : 'qloo-tags' };
      group.bookIds.push(book.id); groups.set(key, group);
    }
  }
  const shared = [...groups.values()].filter(g => g.bookIds.length > 1).sort((a, b) => a.id.localeCompare(b.id));
  const covered = new Set(shared.flatMap(g => g.bookIds));
  return [...shared, ...books.filter(b => !covered.has(b.id)).map(b => ({ id: `book:${b.id}`, theme: b.title, bookIds: [b.id], source: 'ungrouped' as const }))];
}
export function eligibleBooks(input: PlanningInput): Book[] {
  return input.catalogue.filter(b => b.hiddenGem && b.stock >= input.constraints.minStock &&
    (!input.selectedGenres.length || b.tags.some(t => input.selectedGenres.includes(t.toLowerCase()))));
}
function normalized(edge: Evidence, run: Run): number {
  const reference = run.references[edge.context];
  return reference ? percentile(edge.affinity, reference) : 0;
}
export function validateAndScore(proposal: Proposal, run: Run): Proposal {
  const { constraints } = run.input;
  const reasons: string[] = [];
  const books = proposal.bookIds.map(id => run.input.catalogue.find(b => b.id === id));
  if (books.some(b => !b || b.stock < constraints.minStock)) reasons.push('Book missing from inventory or insufficient stock.');
  const eligible = new Set(eligibleBooks(run.input).map(b => b.id));
  if (proposal.bookIds.some(id => !eligible.has(id))) reasons.push('Book is outside the selected hidden gems or genres.');
  if (!books.length || books.length > constraints.maxBooks) reasons.push('Book count exceeds the event limit.');
  if (proposal.duration > constraints.maxDuration) reasons.push('Duration exceeds the allowed time.');
  if (constraints.attendance > constraints.capacity) reasons.push('Expected attendance exceeds capacity.');
  const edges = proposal.edgeIds.map(id => run.edges.find(e => e.id === id));
  if (edges.some(e => !e || !e.active || run.excluded.includes(e.entityId))) reasons.push('Cultural evidence is missing or excluded.');
  if (proposal.bookIds.some(id => !edges.some(e => e?.bookId === id))) reasons.push('Not every book has supporting evidence.');
  const types = new Set(edges.flatMap(e => e ? [e.type] : []));
  if ((proposal.curator !== 'cinema' && !types.has('artist')) || (proposal.curator !== 'listening' && !types.has('movie'))) reasons.push('Required cultural candidate type is missing.');
  if (reasons.length) return { ...proposal, status: 'rejected', reasons, factors: null, score: null };
  if (proposal.curator !== 'listening' && !constraints.screeningRightsConfirmed)
    return { ...proposal, status: 'unverified', reasons: ['Confirm screening rights before ranking a film event.'], factors: null, score: null };
  const verified = edges as Evidence[];
  if (verified.some(e => !run.references[e.context] || !Number.isFinite(e.popularity)))
    return { ...proposal, status: 'unverified', reasons: ['Affinity reference or popularity data is unavailable.'], factors: null, score: null };
  const R = verified.reduce((sum, e) => sum + normalized(e, run), 0) / verified.length;
  const N = verified.reduce((sum, e) => sum + 1 - e.popularity!, 0) / verified.length;
  // The selected inventory snapshot defines utilization, independent of stock
  // what-ifs, so an unrelated proposal's score does not drift after a removal.
  const selectedCount = run.input.catalogue.filter(b => b.hiddenGem && (!run.input.selectedGenres.length || b.tags.some(t => run.input.selectedGenres.includes(t.toLowerCase())))).length;
  const U = .5 * books.length / selectedCount + .5 * books.length / constraints.maxBooks;
  const stockHeadroom = Math.min(...books.map(b => Math.min(1, b!.stock / Math.max(constraints.minStock, constraints.attendance))));
  const F = .5 * stockHeadroom + .5 * (1 - proposal.duration / constraints.maxDuration);
  const factors = { R, N, U, F };
  return { ...proposal, status: 'valid', reasons: [], factors, score: 100 * (.40 * R + .25 * N + .25 * U + .10 * F) };
}
export function generateProposals(run: Run): Proposal[] {
  const books = eligibleBooks(run.input);
  const ids = new Set(books.map(b => b.id));
  const groups = [...books.map(b => ({ id: `solo:${b.id}`, theme: b.title, bookIds: [b.id] })),
    ...run.clusters.filter(g => g.bookIds.filter(id => ids.has(id)).length > 1).map(g => ({ ...g, bookIds: g.bookIds.filter(id => ids.has(id)).slice(0, run.input.constraints.maxBooks) }))];
  const proposals: Proposal[] = [];
  for (const group of groups) for (const curator of run.input.preferences.curatorTypes) for (let variant = 0; variant < 3; variant++) {
    const duration = curator === 'listening' ? 45 : curator === 'cinema' ? 120 : 150;
    const required: Evidence['type'][] = curator === 'mixed' ? ['artist', 'movie'] : [curator === 'listening' ? 'artist' : 'movie'];
    const edgeIds: string[] = [];
    for (const bookId of group.bookIds) for (const type of required) {
      const candidate = run.edges.filter(e => e.bookId === bookId && e.type === type && e.active && !run.excluded.includes(e.entityId))
        .sort((a, b) => normalized(b, run) - normalized(a, run) || b.affinity - a.affinity || a.entityId.localeCompare(b.entityId))[variant];
      if (candidate) edgeIds.push(candidate.id);
    }
    const proposal: Proposal = {
      id: `${group.id}:${curator}${variant ? `:alternative:${variant}` : ''}`, title: `${group.theme} · ${curator === 'listening' ? 'Books & listening' : curator === 'cinema' ? 'Books & cinema' : 'Across books, music & cinema'}${variant ? ` · ${variant + 1}` : ''}`,
      curator, bookIds: group.bookIds, edgeIds, duration, status: 'unverified', reasons: [], factors: null, score: null,
      interpretation: 'Editorial proposal: introduce the selected books, explore the returned cultural references, and invite a reader discussion. Qloo affinity supports discovery; thematic suitability needs owner review.',
    };
    proposals.push(validateAndScore(proposal, run));
  }
  return proposals;
}
export function diverseSelection(proposals: Proposal[], limit: number): string[] {
  const signatures = new Set<string>();
  const remaining = proposals.filter(p => p.status === 'valid').sort((a, b) => b.score! - a.score! || a.id.localeCompare(b.id)).filter(p => {
    const signature = JSON.stringify([p.curator, [...p.bookIds].sort(), [...p.edgeIds].sort()]);
    if (signatures.has(signature)) return false;
    signatures.add(signature); return true;
  });
  const selected: Proposal[] = [];
  while (remaining.length && selected.length < limit) {
    // Diversity is a selection step; the published weighted score never changes.
    const seenBooks = new Set(selected.flatMap(p => p.bookIds));
    const seenTypes = new Set(selected.map(p => p.curator));
    const diverse = remaining.findIndex(p => p.bookIds.some(id => !seenBooks.has(id)) || !seenTypes.has(p.curator));
    selected.push(remaining.splice(diverse < 0 ? 0 : diverse, 1)[0]);
  }
  return selected.map(p => p.id);
}
