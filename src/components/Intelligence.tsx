import { notify } from '../lib/notifications';
import { useEffect, useState } from 'react';
import type { Book } from '../lib/catalogue';
import type { Run } from '../lib/curator';
type Suggestion = { id: string; genres: string[]; themes: string[]; confidence: string };
export default function Intelligence({ books, setBooks, run, setRun, disabled, stale, onBusy }: { books: Book[]; setBooks: (books: Book[]) => void; run: Run | null; setRun: (run: Run) => void; disabled: boolean; stale: boolean; onBusy: (busy: boolean) => void }) {
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState('Gemini');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (notice) notify('Catalogue tags updated', notice, 'success', notice); }, [notice]);
  useEffect(() => { if (error) notify('AI action failed', 'Review the error in Editorial intelligence.', 'error', 'intelligence-error'); }, [error]);
  const [baseline, setBaseline] = useState<any>(null);
  function status() { void fetch('/api/intelligence').then(r => r.json()).then(data => {setConfigured(data.configured);setProvider(data.providerLabel??'AI');}).catch(() => setConfigured(false)); }
  useEffect(() => {
    status();
    const update = (event: Event) => {const data=(event as CustomEvent<{configured:boolean;providerLabel:string}>).detail;setConfigured(data.configured);setProvider(data.providerLabel);};
    window.addEventListener('folioecho-ai-status', update);
    return () => window.removeEventListener('folioecho-ai-status', update);
  }, []);
  async function operate(action: string) {
    setBusy(true); onBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, catalogue: action === 'enrich' ? books : undefined, runId: run?.id, revision: run?.revision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'AI operation failed.');
      if (data.books) setSuggestions(data.books);
      if (data.run) setRun(data.run);
      if (data.baseline) setBaseline(data.baseline);
      notify('AI results ready', action === 'enrich' ? 'Genre and theme suggestions are ready for your review.' : action === 'baseline' ? 'Your AI comparison is ready.' : 'Event titles and ideas have been updated.', 'success', `ai-${action}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'AI operation failed.'); }
    finally { setBusy(false); onBusy(false); }
  }
  const pending = suggestions.filter(suggestion => books.some(book => book.id === suggestion.id));
  function acceptTags(selected: Suggestion[]) {
    const byId = new Map(selected.map(suggestion => [suggestion.id, suggestion]));
    setBooks(books.map(book => {
      const suggestion = byId.get(book.id);
      return suggestion ? { ...book, tags: [...new Set([...book.tags, ...suggestion.genres, ...suggestion.themes].map(tag => tag.trim().toLowerCase()).filter(Boolean))] } : book;
    }));
    setSuggestions(previous => previous.filter(suggestion => !byId.has(suggestion.id)));
    setNotice(`Tags accepted for ${selected.length} ${selected.length === 1 ? 'book' : 'books'}.`);
  }
  const current = baseline && run && baseline.runId === run.id && baseline.revision === run.revision ? baseline : null;
  return <section className="panel live-panel"><h2>Editorial intelligence · {provider}</h2>
    <p>Optional genre suggestions, grounded event copy and a real LLM-only baseline. Owner details, photos and API keys are excluded from model prompts.</p>
    {!configured && <p className="muted">Choose demo or a personal AI key in Usage & Billing to enable these optional features.</p>}
    <div className="intelligence-actions"><button disabled={!configured || disabled || busy} onClick={() => void operate('enrich')}>Suggest genres & themes</button><button disabled={!configured || disabled || busy || stale || !run?.selected.length} onClick={() => void operate('narrate')}>Write event titles & ideas</button><button disabled={!configured || disabled || busy || stale || !run} onClick={() => void operate('baseline')}>Run LLM-only baseline</button></div>
    {busy && <p role="status">Working with {provider}… Stock, scores and hard constraints remain controlled by the application.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p className="tag-review-notice" role="status">{notice}</p>}
    {pending.length > 0 && <details className="tag-review" open>
      <summary>Review suggested tags · {pending.length}</summary>
      <div className="tag-review-toolbar"><span>{pending.length} {pending.length === 1 ? 'book' : 'books'} awaiting review</span><button className="primary" disabled={disabled || busy} onClick={() => acceptTags(pending)}>Accept all ({pending.length})</button></div>
      <div className="tag-review-list" role="region" aria-label="Suggested genres and themes" tabIndex={0}>
        {pending.map(s => <article className="tag-review-card" key={s.id}>
          <div className="tag-review-heading"><b>{books.find(book => book.id === s.id)?.title}</b><span className="tag-review-confidence">{s.confidence} confidence</span></div>
          <div className="tag-review-tags">{[...new Set([...s.genres,...s.themes])].map(tag => <span key={tag}>{tag}</span>)}</div>
          <div className="tag-review-actions"><button disabled={disabled || busy} onClick={() => acceptTags([s])}>Accept tags</button><button disabled={disabled || busy} onClick={() => setSuggestions(previous => previous.filter(item => item.id !== s.id))}>Dismiss</button></div>
        </article>)}
      </div>
    </details>}
    {current && <div><h3>Measured LLM-only baseline · same snapshot</h3><p>{current.metrics.valid}/{current.metrics.proposed} proposals pass structural constraints · catalogue coverage {((current.metrics.catalogueCoverage ?? 0) * 100).toFixed(0)}% · external evidence coverage 0% (no lookup tools).</p><p>Cultural references are unverified. These measurements do not establish which system creates better events.</p>{current.events.map((event: any, index: number) => <article className="live-event" key={index}><h3>{event.title}</h3><p>{event.idea}</p><p>{event.duration} minutes · {event.bookIds.map((id: string) => run?.input.catalogue.find(b => b.id === id)?.title).join(', ')}</p><p>{event.culturalReferences.join(' · ')}</p><p>{event.valid ? 'Structural constraints passed; references unverified.' : event.reasons.join(' ')}</p></article>)}</div>}
  </section>;
}
