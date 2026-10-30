import { useEffect, useState } from 'react';
import type { Run } from '../lib/curator';
import { evidenceEdges, type Baseline, type measuredComparison } from '../lib/comparison';
import { notify } from '../lib/notifications';
import './comparison.css';
export interface ComparisonData { run: Run | null; baseline: Baseline | null; comparison: ReturnType<typeof measuredComparison> | null; snapshot?: string; catalogueChanged?: boolean }
export async function fetchComparison(): Promise<ComparisonData> {
  const response = await fetch('/api/comparison', { cache: 'no-store' }); const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Comparison unavailable.'); return data;
}
export default function ComparisonResults({ onStudio }: { onStudio: () => void }) {
  const [data, setData] = useState<ComparisonData | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; void fetchComparison().then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function baseline() {
    if (!data?.run || busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'baseline', runId: data.run.id, revision: data.run.revision }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Baseline failed.');
      const refreshed = await fetchComparison(); setData(refreshed);
      if (!refreshed.comparison?.comparable) throw new Error('The latest run changed. This baseline is saved with its original revision; run a new comparison for the latest snapshot.');
      notify('Comparison ready', 'The LLM-only baseline has been measured against the same saved Qloo snapshot.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Baseline failed.'); } finally { setBusy(false); }
  }
  const run = data?.run, metrics = data?.comparison, qloo = metrics?.qloo, llm = metrics?.llm;
  const rows: [string, number | undefined, number | undefined, string][] = [
    ['Event proposals measured', qloo?.proposals, llm?.proposals, 'Qloo final selection versus all returned baseline proposals.'],
    ['Cultural references suggested', qloo?.culturalReferences, llm?.culturalReferences, 'Distinct cultural entities; baseline names are deduplicated, not entity-resolved.'],
    ['References with recorded Qloo evidence', qloo?.verifiedReferences, llm?.verifiedReferences, 'Recorded Qloo affinity responses; not proof of thematic fit or factual accuracy.'],
    ['Book → reference evidence links', qloo?.evidenceLinks, llm?.evidenceLinks, 'Active supporting graph edges used by the measured events.'],
    ['Events with stock errors', qloo?.stockErrors, llm?.stockErrors, 'An unknown book or stock below the snapshot’s minimum.'],
    ['Other constraint violations', qloo?.constraintErrors, llm?.constraintErrors, 'Selection, book count, duration, curator, capacity, rights and excess event count.'],
    ['Events passing structural constraints', qloo?.passing, llm?.passing, 'Same validator and frozen inventory for both methods.'],
  ];
  return <section className="panel measured-comparison">
    <div className="comparison-heading"><div><h2>Qloo vs LLM-only · measured results</h2><p>One saved input snapshot. Observed counts, without illustrative scores.</p></div><button className="primary" disabled={!run || busy} onClick={() => void baseline()}>{busy ? 'Running baseline…' : data?.baseline ? 'Run baseline again · 1 AI request' : 'Run LLM-only baseline · 1 AI request'}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!data && !error && <p>Loading saved measurements…</p>}
    {data && !run && <div className="comparison-empty"><p>No saved Qloo run yet. Generate evidence-backed events first.</p><button onClick={onStudio}>Open Event Studio</button></div>}
    {run && <>
      <div className="comparison-provenance"><span>Run <b>{run.id.slice(0, 8)}</b> · revision <b>{run.revision}</b></span><span>Snapshot <code>{data.snapshot}</code></span><span>{run.input.catalogue.length} titles · {run.input.catalogue.reduce((sum, b) => sum + b.stock, 0)} copies</span></div>
      {data.catalogueChanged && <p className="live-warning">Your catalogue has changed. These results use the saved run’s inventory, not current stock. Generate a new Qloo run to compare the new catalogue.</p>}
      {!data.baseline && <p className="comparison-note">The baseline has not been measured for this exact run and revision. Dashes mean not measured, never zero.</p>}
      <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th scope="col">Measurement</th><th scope="col">FolioEcho + Qloo</th><th scope="col">LLM-only{data.baseline && <small>{data.baseline.provider} · {data.baseline.model}</small>}</th></tr></thead><tbody>{rows.map(([label, a, b, detail]) => <tr key={label}><th scope="row">{label}<small>{detail}</small></th><td>{a ?? '—'}</td><td>{b ?? '—'}</td></tr>)}</tbody></table></div>
      <p className="comparison-note">Scope: {qloo?.proposals} Qloo-selected events; {llm?.proposals ?? 'unmeasured'} baseline outputs. Qloo rejected {run.proposals.filter(event => event.status === 'rejected').length} candidate proposals before selection. {qloo?.unsupportedEvents ?? 0} selected events have missing supporting links.</p>
      <details className="comparison-details"><summary>Inspect evidence links ({qloo?.evidenceLinks ?? 0})</summary><div className="comparison-evidence">{evidenceEdges(run).filter(edge => run.selected.some(id => run.proposals.find(event => event.id === id)?.edgeIds.includes(edge.id))).map(edge => <article key={edge.id}><b>{run.input.catalogue.find(book => book.id === edge.bookId)?.title} → {edge.name}</b><p>{edge.type} · affinity {edge.affinity.toFixed(3)} · {new Date(edge.retrievedAt).toLocaleString()}</p><code>{edge.entityId}</code><pre>{JSON.stringify(edge.request, null, 2)}</pre></article>)}</div></details>
      {data.baseline && <details className="comparison-details"><summary>Inspect baseline proposals ({data.baseline.events.length})</summary><div className="comparison-evidence">{data.baseline.events.map((event, i) => <article key={i}><b>{event.title}</b><p>{event.idea}</p><p>{event.duration} min · {event.bookIds.map(id => run.input.catalogue.find(book => book.id === id)?.title ?? id).join(' · ')}</p><p>{event.culturalReferences.join(' · ') || 'No cultural references returned.'}</p><p>{llm?.issues[i]?.join(' · ') || 'Structural constraints passed.'}</p><small>External references unverified · {new Date(data.baseline!.createdAt).toLocaleString()}</small></article>)}</div></details>}
      <details className="comparison-details"><summary>How to interpret this comparison</summary><p>Both methods receive the same catalogue, genres, curator preferences and hard constraints, with the same output count. The baseline receives no Qloo entity IDs, affinities, graph or proposals. Both use structured book identifiers, so zero stock errors do not demonstrate a Qloo advantage.</p><p>The LLM-only method has no external lookup tools: its zero evidence counts describe provenance availability, not false recommendations. Qloo adds recorded cross-domain discovery links. A single run does not measure audience satisfaction, sales impact or superior event quality.</p><p>Counts describe saved outputs before owner editing. Revisions must match exactly; a repair or narration invalidates the old comparison. Running the baseline again is a new model request and replaces this revision’s saved baseline.</p></details>
    </>}
  </section>;
}
