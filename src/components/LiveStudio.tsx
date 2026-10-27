import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import type { Book } from '../lib/catalogue';
import { parseCatalogueCSV } from '../lib/csv';
import { defaultConstraints, percentile, type CuratorType, type Run, type Proposal } from '../lib/curator';
import './live-studio.css';
import { downloadPDF } from '../lib/export';
import Intelligence from './Intelligence';

export default function LiveStudio({ books, setBooks }: { books: Book[]; setBooks: (books: Book[]) => void }) {
  const [types, setTypes] = useState<CuratorType[]>(['listening']);
  const [constraints, setConstraints] = useState({ ...defaultConstraints });
  const [genres, setGenres] = useState('');
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [run, setRun] = useState<Run | null>(null);
  const [qlooBusy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const busy = qlooBusy || modelBusy;
  const [error, setError] = useState('');
  const [edgeId, setEdgeId] = useState('');
  const [graphBook, setGraphBook] = useState('all');
  const [graphType, setGraphType] = useState('all');
  const [graphLimit, setGraphLimit] = useState(3);
  const [jobId, setJobId] = useState('');
  const [progress, setProgress] = useState({ message: '', completed: 0, total: 1 });
  const mounted = useRef(true);
  async function poll(id: string) {
    setJobId(id); setBusy(true);
    try {
      while (mounted.current) {
        const response = await fetch(`/api/jobs?id=${encodeURIComponent(id)}`);
        const job = await response.json();
        if (!response.ok) throw new Error(job.error ?? 'Job unavailable.');
        setProgress(job);
        if (job.status !== 'running') {
          localStorage.removeItem('folioecho-job');
          if (job.status === 'done') {
            setRun(job.run); setEdgeId(''); setTypes(job.run.input.preferences.curatorTypes);
            setConstraints(job.run.input.constraints); setGenres(job.run.input.selectedGenres.join(', ')); setMatches(job.run.input.matches);
          }
          if (job.status === 'error') throw new Error(job.error ?? 'Planning failed.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } finally { if (mounted.current) { setBusy(false); setJobId(''); } }
  }
  useEffect(() => {
    mounted.current = true;
    void fetch('/api/workspace').then(r => r.json()).then(data => {
      if (!mounted.current) return;
      if (data.run) { setRun(data.run); setTypes(data.run.input.preferences.curatorTypes); setConstraints(data.run.input.constraints); setGenres(data.run.input.selectedGenres.join(', ')); setMatches(data.run.input.matches); }
      const job = localStorage.getItem('folioecho-job');
      if (job) void poll(job).catch(e => setError(e.message));
    }).catch(() => setError('Could not restore the last saved run.'));
    return () => { mounted.current = false; };
  }, []);
  const input = { catalogue: books, selectedGenres: genres.split(',').map(s => s.trim().toLowerCase()).filter(Boolean), preferences: { curatorTypes: types }, constraints, matches };
  const stale = !!run && (JSON.stringify(run.input.catalogue) !== JSON.stringify(books) || JSON.stringify(run.input.constraints) !== JSON.stringify(constraints) || JSON.stringify(run.input.preferences.curatorTypes) !== JSON.stringify(types) || JSON.stringify(run.input.selectedGenres) !== JSON.stringify(input.selectedGenres) || JSON.stringify(run.input.matches) !== JSON.stringify(matches));
  const onlyStockChanged = !!run && JSON.stringify(run.input.catalogue.map(({ stock, ...b }) => b)) === JSON.stringify(books.map(({ stock, ...b }) => b)) && JSON.stringify(run.input.constraints) === JSON.stringify(constraints) && JSON.stringify(run.input.preferences.curatorTypes) === JSON.stringify(types) && JSON.stringify(run.input.selectedGenres) === JSON.stringify(input.selectedGenres) && JSON.stringify(run.input.matches) === JSON.stringify(matches);
  async function request(body: unknown) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Planning failed.');
      localStorage.setItem('folioecho-job', data.id);
      await poll(data.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  async function importCSV(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('CSV is limited to 2 MB.');
      const imported = parseCatalogueCSV(await file.text());
      if (imported.length > 25) throw new Error('The Qloo pilot supports at most 25 books.');
      setBooks(imported); setMatches({}); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'CSV import failed.'); }
  }
  const graph = useMemo(() => {
    const nodes: Node[] = []; const edges: Edge[] = [];
    if (!run) return { nodes, edges };
    const visible = run.edges.filter(e => e.active && (graphBook === 'all' || e.bookId === graphBook) && (graphType === 'all' || e.type === graphType));
    const grouped = new Map<string, typeof visible>();
    for (const edge of visible) grouped.set(edge.context, [...(grouped.get(edge.context) ?? []), edge]);
    const shown = [...grouped.values()].flatMap(edges => edges.sort((a,b) => b.affinity-a.affinity).slice(0, graphLimit));
    const bookIds = [...new Set(shown.map(e => e.bookId))];
    bookIds.forEach((id, index) => { const book = run.input.catalogue.find(b => b.id === id); nodes.push({ id: `book:${id}`, position: { x: 0, y: index * 160 }, data: { label: `${book?.title ?? id} · ${book?.stock ?? 0} copies` }, style: { background: '#e9efdf', borderColor: '#426348', width: 185 } }); });
    const candidates = [...new Map(shown.map(e => [e.entityId, e])).values()];
    candidates.forEach((candidate, index) => nodes.push({ id: candidate.entityId, position: { x: 310 + index % 2 * 215, y: Math.floor(index / 2) * 80 }, data: { label: `${candidate.type === 'artist' ? '♫' : '▣'} ${candidate.name}` }, style: { width: 190, background: '#fbf7ec' } }));
    shown.forEach(e => edges.push({ id: e.id, source: `book:${e.bookId}`, target: e.entityId, label: e.affinity.toFixed(3), style: { stroke: edgeId === e.id ? '#bb7d27' : '#81977f', strokeWidth: edgeId === e.id ? 3 : 1 } }));
    return { nodes, edges };
  }, [run, edgeId, graphBook, graphType, graphLimit]);
  const selectedEdge = run?.edges.find(e => e.id === edgeId);
  function eventCard(event: Proposal) {
    return <article className="live-event" key={event.id}>
      <div className="live-event-head"><h3>{event.title}</h3><span className="chip">{event.score === null ? event.status : `${event.score.toFixed(1)} / 100`}</span></div>
      <p className="event-duration">{event.duration} minutes · {event.curator === 'listening' ? 'Reading & listening' : event.curator === 'cinema' ? 'Literature & cinema' : 'Cross-cultural evening'}</p>
      <h4>Central idea{event.narrativeSource ? ' · AI editorial interpretation' : ''}</h4><p>{event.narrativeSource ? event.interpretation : <>Bring readers together around {event.bookIds.map(id => run?.input.catalogue.find(b => b.id === id)?.title).join(' and ')}, using {event.curator === 'listening' ? 'music as a starting point for conversation' : 'film and cultural references to open a shared discussion'}.</>}</p>
      <h4>Books from your shelves</h4><div className="event-book-list">{event.bookIds.map(id => { const book = run?.input.catalogue.find(b => b.id === id); return <span key={id}><b>{book?.title}</b><small>{book?.stock ?? 0} copies available</small></span>; })}</div>
      {event.reasons.length > 0 && <p className="live-warning">{event.reasons.join(' ')}</p>}
      <details className="event-explanation"><summary>Why recommended</summary><p>{event.interpretation}</p>{event.factors && <div className="live-factors">{Object.entries(event.factors).map(([name, value]) => <span key={name}>{name} <b>{value.toFixed(3)}</b></span>)}</div>}<p>Score = 100 × (0.40R + 0.25N + 0.25U + 0.10F). Qloo affinity supports discovery; it does not establish thematic suitability.</p></details>
      <h4>Cultural references</h4>
      <ul>{event.edgeIds.map(id => {
        const edge = run?.edges.find(e => e.id === id);
        return edge ? <li key={id}><button className="small-button" onClick={() => setEdgeId(id)}>{edge.name} · Qloo affinity {edge.affinity.toFixed(3)}</button>{' '}<button disabled={busy || stale || !edge.active} onClick={() => void request({ action: 'repair', runId: run!.id, revision: run!.revision, exclude: edge.entityId })}>Exclude & repair</button></li> : null;
      })}</ul>
    </article>;
  }
  return <div className="live-studio">
    <div className="live-banner"><b>Event Studio · local pilot</b><span>Real Qloo evidence · validated ranking · optional private OpenAI intelligence</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    <Intelligence books={books} setBooks={setBooks} run={run} setRun={setRun} disabled={qlooBusy} stale={stale} onBusy={setModelBusy} />
    <section className="panel live-panel">
      <h2>1. Catalogue & hidden gems</h2>
      <p>Select 3–5 books to promote. Stock is a hard constraint. Up to 25 catalogue titles are resolved per run.</p>
      <label className="upload-button">Import CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { void importCSV(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <p className="muted">Columns: title, author, stock. Optional: id, tags (separated by ;), hiddenGem (true/false). Import replaces the catalogue after validation.</p>
      <div className="live-books">{books.map(book => <label className="live-book" key={book.id}>
        <input type="checkbox" disabled={busy} checked={book.hiddenGem} onChange={e => setBooks(books.map(b => b.id === book.id ? { ...b, hiddenGem: e.target.checked } : b))} />
        <span><b>{book.title}</b><small>{book.author}</small></span>
        <input type="number" min="0" max="100000" step="1" aria-label={`Stock for ${book.title}`} disabled={busy} value={book.stock} onChange={e => { const stock = Number(e.target.value); if (Number.isSafeInteger(stock) && stock >= 0) setBooks(books.map(b => b.id === book.id ? { ...b, stock } : b)); }} />
      </label>)}</div>
    </section>
    <section className="panel live-panel">
      <h2>2. Curator preferences & constraints</h2>
      <fieldset disabled={busy} className="live-controls">
        <label>Selected catalogue genres/tags<input value={genres} placeholder="Optional, comma separated" onChange={e => setGenres(e.target.value)} /></label>
        <div><b>Curator types</b>{(['listening', 'cinema', 'mixed'] as CuratorType[]).map(type => <label className="live-check" key={type}><input type="checkbox" checked={types.includes(type)} onChange={e => setTypes(e.target.checked ? [...types, type] : types.filter(t => t !== type))} />{type}</label>)}</div>
        {([['minStock', 'Minimum stock', 1, 1000], ['maxBooks', 'Books per event', 1, 5], ['maxEvents', 'Top events', 1, 10], ['maxDuration', 'Maximum minutes', 15, 600], ['capacity', 'Venue capacity', 1, 1000], ['attendance', 'Expected attendance', 1, 1000]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={constraints[key]} onChange={e => setConstraints({ ...constraints, [key]: Number(e.target.value) })} /></label>)}
        <label className="live-check"><input type="checkbox" checked={constraints.screeningRightsConfirmed} onChange={e => setConstraints({ ...constraints, screeningRightsConfirmed: e.target.checked })} />I have confirmed screening rights for film proposals.</label>
      </fieldset>
      <button className="primary" disabled={busy || !types.length} onClick={() => void request({ action: 'create', input })}>{busy ? 'Working…' : 'Generate evidence-backed events'}</button>
      {qlooBusy && <div className="job-progress" role="status"><p>{progress.message || 'Starting…'} · {progress.completed}/{progress.total}</p><progress value={progress.completed} max={progress.total} /><button disabled={!jobId} onClick={() => void fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id: jobId }) })}>Cancel</button></div>}
      {stale && <p className="live-warning" role="status">Inputs changed. Results below describe the previous snapshot. Generate a new run{onlyStockChanged ? ' or apply stock repair.' : '.'}</p>}
      {stale && onlyStockChanged && <button disabled={busy} onClick={() => void request({ action: 'repair', runId: run!.id, revision: run!.revision, stock: Object.fromEntries(books.filter(b => run!.input.catalogue.find(old => old.id === b.id)?.stock !== b.stock).map(b => [b.id, b.stock])) })}>Apply stock what-if & revalidate</button>}
    </section>
    {run && <>
      <section className="panel live-panel"><h2>3. Entity matching & thematic clusters</h2>
        <p>{run.resolutions.filter(r => r.status === 'confirmed').length}/{run.resolutions.length} confirmed · revision {run.revision}. Clusters use supplied catalogue tags, or Qloo tags when none were supplied.</p>
        <details><summary>Review all book matches</summary>{run.resolutions.map(resolution => <div className="live-match" key={resolution.bookId}>
          <b>{run.input.catalogue.find(b => b.id === resolution.bookId)?.title}</b> · {resolution.status}
          {resolution.candidates.length > 0 && <select aria-label={`Qloo match for ${resolution.bookId}`} disabled={busy} value={matches[resolution.bookId] ?? resolution.entityId ?? ''} onChange={e => { const next = { ...matches }; if (e.target.value) next[resolution.bookId] = e.target.value; else delete next[resolution.bookId]; setMatches(next); }}><option value="">Choose / automatic exact match</option>{resolution.candidates.map(c => <option key={c.id} value={c.id}>{c.name} — {c.detail}</option>)}</select>}
        </div>)}</details>
        <div className="live-clusters">{run.clusters.map(cluster => <span className="chip" key={cluster.id}>{cluster.theme} · {cluster.bookIds.length} · {cluster.source}</span>)}</div>
        {run.warnings.map((warning, index) => <p className="live-warning" key={index}>{warning}</p>)}
      </section>
      <section className="panel live-panel"><h2>4. Cultural graph & evidence</h2><p>Click a connection to inspect its source. Labels show raw Qloo affinity, not a probability about an individual.</p>
        <div className="graph-filters"><label>Book<select value={graphBook} onChange={e => setGraphBook(e.target.value)}><option value="all">All selected books</option>{run.input.catalogue.filter(b => b.hiddenGem).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label><label>References<select value={graphType} onChange={e => setGraphType(e.target.value)}><option value="all">Music & films</option><option value="artist">Music only</option><option value="movie">Films only</option></select></label><label>Connections per book/type<select value={graphLimit} onChange={e => setGraphLimit(Number(e.target.value))}><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={20}>Show all</option></select></label></div>
        <div className="live-graph"><ReactFlow nodes={graph.nodes} edges={graph.edges} fitView onEdgeClick={(_, edge) => setEdgeId(edge.id)} onNodeClick={(_, node) => { const edge = run.edges.find(e => e.entityId === node.id && e.active); if (edge) setEdgeId(edge.id); }}><Background /><Controls /></ReactFlow></div>
        {selectedEdge && <div className="live-evidence"><h3>{selectedEdge.name}</h3><p>Book: {run.input.catalogue.find(b => b.id === selectedEdge.bookId)?.title} · {selectedEdge.type} · {selectedEdge.active ? 'active' : 'invalidated'}</p><p>Raw affinity: {selectedEdge.affinity.toFixed(6)} · Normalized: {percentile(selectedEdge.affinity, run.references[selectedEdge.context]).toFixed(3)} · Popularity: {selectedEdge.popularity?.toFixed(3) ?? 'unavailable'}</p><p>Entity ID: {selectedEdge.entityId} · Retrieved: {new Date(selectedEdge.retrievedAt).toLocaleString()}</p><p>Context: {selectedEdge.context} · Fixed reference: {run.references[selectedEdge.context].values.length} candidates, {new Date(run.references[selectedEdge.context].capturedAt).toLocaleString()}</p><pre>{JSON.stringify(selectedEdge.request, null, 2)}</pre><button disabled={busy || stale || !selectedEdge.active} onClick={() => void request({ action: 'repair', runId: run.id, revision: run.revision, exclude: selectedEdge.entityId })}>Exclude this node & repair</button></div>}
      </section>
      <section className="panel live-panel"><h2>5. Diverse top-ranked events</h2><button onClick={() => void downloadPDF('folioecho-cultural-report.pdf', undefined, run.id)}>Export PDF report</button>
        <p>Score = 100 × (0.40R + 0.25N + 0.25U + 0.10F). Only validated proposals are ranked. Selection prioritizes new books or curator types in score order.</p>
        <details><summary>How the factors are calculated</summary><p>R: mean percentile of affinities against the initial candidate pool for each book/type query. Ties use midranks; constant pools use 0.5. References stay fixed during repair.</p><p>N: mean (1 − Qloo popularity), a discovery proxy. U: half the share of selected hidden gems covered (including stock-outs), plus half the use of the event's book allowance. F: half the stock-to-attendance headroom, plus half the unused duration allowance. These are explicit pilot heuristics, not validated sales predictions.</p><p>Durations are editorial allocations for discussions and listening/excerpt sessions, not verified full-film running times. Screening rights require owner confirmation.</p></details>
        {run.selected.length ? run.selected.map(id => eventCard(run.proposals.find(p => p.id === id)!)) : <p>No verified event meets the current constraints. Review missing evidence, stock, duration or screening rights.</p>}
        <details><summary>All proposals, including rejected and unverified ({run.proposals.length})</summary>{[...run.proposals].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map(eventCard)}</details>
      </section>
      {run.changes.length > 0 && <section className="panel live-panel"><h2>What changed</h2><p>Normalization references remain unchanged. {run.excluded.length} cultural nodes excluded.</p>{run.changes.map(change => <article className="live-change" key={change.eventId}><h3>{change.before.title}</h3><p>{change.reason}</p><p>Before: {change.before.edgeIds.map(id => run.edges.find(e => e.id === id)?.name).join(', ')} · {change.before.score?.toFixed(1) ?? change.before.status}</p><p>After: {change.after?.edgeIds.map(id => run.edges.find(e => e.id === id)?.name).join(', ') || 'No replacement'} · {change.after?.score?.toFixed(1) ?? change.after?.status ?? 'removed'}</p></article>)}</section>}
      <p className="muted">Your catalogue, profile and completed runs are saved privately on this computer. Qloo evidence and revision history remain outside the public repository. OpenAI features require private server configuration; public hosting is not enabled.</p>
    </>}
  </div>;
}
