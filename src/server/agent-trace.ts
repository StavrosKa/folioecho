import { randomUUID } from 'node:crypto';
import type { AgentTraceEvent, Run } from '../lib/curator.ts';
export function recordTrace(run: Run, event: Omit<AgentTraceEvent, 'id' | 'at' | 'revision'>): AgentTraceEvent {
  const row = { ...event, id: randomUUID(), at: new Date().toISOString(), revision: run.revision };
  run.trace ??= []; run.trace.push(row);
  if (run.trace.length > 1000) run.trace = run.trace.slice(-1000);
  return row;
}
export function traceValidation(run: Run) {
  const invalid = run.proposals.filter(proposal => proposal.status !== 'valid');
  for (const proposal of invalid) {
    const stockFailure = proposal.bookIds.some(id => !run.input.catalogue.some(book => book.id === id && book.stock >= run.input.constraints.minStock));
    recordTrace(run, { phase: 'validation', status: proposal.status === 'rejected' ? 'rejected' : 'unverified', proposalId: proposal.id,
      summary: `${proposal.status === 'rejected' ? 'Rejected' : 'Marked unverified'}: ${proposal.title}. ${stockFailure ? 'A linked book is missing or below minimum stock. ' : ''}${proposal.reasons.join(' ')}` });
  }
  return recordTrace(run, { phase: 'validation', status: 'done', count: run.proposals.length,
    summary: `Validated ${run.proposals.length} proposals: ${run.proposals.filter(proposal => proposal.status === 'valid').length} eligible, ${run.proposals.filter(proposal => proposal.status === 'rejected').length} rejected, ${run.proposals.filter(proposal => proposal.status === 'unverified').length} unverified.` });
}
