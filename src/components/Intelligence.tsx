import { useEffect, useState } from 'react';
import type { Book } from '../lib/catalogue';
import type { Run } from '../lib/curator';
type Suggestion = { id: string; genres: string[]; themes: string[]; confidence: string };
export default function Intelligence({ books, setBooks, run, setRun, disabled, stale, onBusy }: { books: Book[]; setBooks: (books: Book[]) => void; run: Run | null; setRun: (run: Run) => void; disabled: boolean; stale: boolean; onBusy: (busy: boolean) => void }) {
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [baseline, setBaseline] = useState<any>(null);
  function status() { void fetch('/api/intelligence').then(r => r.json()).then(data => setConfigured(data.configured)).catch(() => setConfigured(false)); }
  useEffect(() => {
    status();
    const update = (event: Event) => setConfigured((event as CustomEvent<boolean>).detail);
    window.addEventListener('folioecho-openai-status', update);
    return () => window.removeEventListener('folioecho-openai-status', update);
  }, []);
  async function operate(action: string) {
    setBusy(true); onBusy(true); setError('');
    try {
      const response = await fetch('/api/intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, catalogue: action === 'enrich' ? books : undefined, runId: run?.id, revision: run?.revision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'OpenAI operation failed.');
      if (data.books) setSuggestions(data.books);
      if (data.run) setRun(data.run);
      if (data.baseline) setBaseline(data.baseline);
    } catch (e) { setError(e instanceof Error ? e.message : 'OpenAI operation failed.'); }
    finally { setBusy(false); onBusy(false); }
  }
  const current = baseline && run && baseline.runId === run.id && baseline.revision === run.revision ? baseline : null;
  return <section className="panel live-panel"><h2>Editorial intelligence · OpenAI</h2>
    <p>Optional genre suggestions, grounded event copy and a real LLM-only baseline. Owner details, photos and API keys are excluded from model prompts.</p>
    {!configured && <p className="muted">Configure OpenAI in Settings to enable these optional features.</p>}
    <div className="intelligence-actions"><button disabled={!configured || disabled || busy} onClick={() => void operate('enrich')}>Suggest genres & themes</button><button disabled={!configured || disabled || busy || stale || !run?.selected.length} onClick={() => void operate('narrate')}>Write event titles & ideas</button><button disabled={!configured || disabled || busy || stale || !run} onClick={() => void operate('baseline')}>Run LLM-only baseline</button></div>
    {busy && <p role="status">Working with OpenAI… Stock, scores and hard constraints remain controlled by the application.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {suggestions.length > 0 && <details open><summary>Review suggested tags</summary>{suggestions.map(s => <article className="live-change" key={s.id}><b>{books.find(b => b.id === s.id)?.title}</b><p>{[...s.genres,...s.themes].join(' · ')} · confidence: {s.confidence}</p><button disabled={disabled || busy || !books.some(b => b.id === s.id)} onClick={() => { setBooks(books.map(b => b.id === s.id ? { ...b, tags: [...new Set([...b.tags,...s.genres,...s.themes].map(t => t.toLowerCase()))] } : b)); setSuggestions(suggestions.filter(item => item.id !== s.id)); }}>Accept tags</button><button onClick={() => setSuggestions(suggestions.filter(item => item.id !== s.id))}>Dismiss</button></article>)}</details>}
    {current && <div><h3>Measured LLM-only baseline · same snapshot</h3><p>{current.metrics.valid}/{current.metrics.proposed} proposals pass structural constraints · catalogue coverage {((current.metrics.catalogueCoverage ?? 0) * 100).toFixed(0)}% · external evidence coverage 0% (no lookup tools).</p><p>Cultural references are unverified. These measurements do not establish which system creates better events.</p>{current.events.map((event: any, index: number) => <article className="live-event" key={index}><h3>{event.title}</h3><p>{event.idea}</p><p>{event.duration} minutes · {event.bookIds.map((id: string) => run?.input.catalogue.find(b => b.id === id)?.title).join(', ')}</p><p>{event.culturalReferences.join(' · ')}</p><p>{event.valid ? 'Structural constraints passed; references unverified.' : event.reasons.join(' ')}</p></article>)}</div>}
  </section>;
}
