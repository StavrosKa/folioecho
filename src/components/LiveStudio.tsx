import Icon from './Icon';
import { notify } from '../lib/notifications';
import { useEffect, useMemo, useRef, useState, type RefObject, type KeyboardEvent } from 'react';
import { ReactFlow, Background, Controls, useNodesInitialized, useReactFlow, getNodesBounds, getViewportForBounds, type Node, type Edge } from '@xyflow/react';
import type { Book } from '../lib/catalogue';
import { readCatalogueFile, catalogueFileTypes } from '../lib/import-catalogue';
import { defaultConstraints, percentile, type CuratorType, type Run, type Proposal, type AgentTraceEvent } from '../lib/curator';
import './live-studio.css';
import { downloadPDF } from '../lib/export';
import Intelligence from './Intelligence';
import AgentTrace from './AgentTrace';
import MetricHint from './MetricHint';
import { liveEstimate } from '../lib/live-estimate';
import type { EventDraft } from '../lib/programme';

type StudioTab='setup'|'matching'|'graph'|'events'|'editorial'|'changes'|'trace';
function CenterGraph({signature,container,nodeIds}:{signature:string;container:RefObject<HTMLDivElement|null>;nodeIds:string[]}){
  const ready=useNodesInitialized();const {getNodes,setViewport}=useReactFlow();
  useEffect(()=>{
    if(!ready||!container.current)return;
    let timer:ReturnType<typeof setTimeout>;
    const fit=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const host=container.current;if(!host||!host.clientWidth||!host.clientHeight)return;
        const visible=new Set(nodeIds),nodes=getNodes().filter(node=>visible.has(node.id));if(!nodes.length)return;
        const bounds=getNodesBounds(nodes);
        void setViewport(getViewportForBounds(bounds,host.clientWidth,host.clientHeight,.1,1.15,.18),{duration:0});
      },80);
    };
    const observer=new ResizeObserver(fit);observer.observe(container.current);fit();const settle=setTimeout(fit,180);
    return()=>{observer.disconnect();clearTimeout(timer);clearTimeout(settle);};
  },[ready,signature,container,getNodes,setViewport]);
  return null;
}

export default function LiveStudio({ books, setBooks, onPlanEvent, onCompare, active=true }: { books: Book[]; setBooks: (books: Book[]) => void; onPlanEvent: (draft:EventDraft)=>void; onCompare?:()=>void; active?:boolean }) {
  const [restoring,setRestoring]=useState(true);
  const [studioTab,setStudioTab]=useState<StudioTab>('setup');
  useEffect(()=>{
    const navigate=(event:Event)=>{const tab=(event as CustomEvent<string>).detail;if(['trace','graph','events'].includes(tab))setStudioTab(tab as StudioTab);};
    window.addEventListener('folioecho-studio-tab',navigate);
    return()=>window.removeEventListener('folioecho-studio-tab',navigate);
  },[]);

  const [confirmLive,setConfirmLive]=useState(false);
  const liveDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=liveDialog.current;if(confirmLive&&active&&!dialog?.open)dialog?.showModal();else if(!confirmLive||!active)dialog?.close();},[confirmLive,active]);
  const graphContainer=useRef<HTMLDivElement>(null);
  const evidenceDialog=useRef<HTMLDialogElement>(null);
  const [types, setTypes] = useState<CuratorType[]>(['listening']);
  const [constraints, setConstraints] = useState({ ...defaultConstraints });
  const [genres, setGenres] = useState('');
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [run, setRun] = useState<Run | null>(null);
  const [qlooBusy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [draftBusy,setDraftBusy]=useState(false);
  const busy = qlooBusy || modelBusy || draftBusy;
  const [error, setError] = useState('');
  useEffect(() => { if (error) notify('Event Studio needs attention', 'Review the error shown in Event Studio.', 'error', 'studio-error'); }, [error]);
  const [edgeId, setEdgeId] = useState('');
  const [graphBook, setGraphBook] = useState('all');
  const [graphType, setGraphType] = useState('all');
  const [graphLimit, setGraphLimit] = useState(3);
  const [jobId, setJobId] = useState('');
  const [jobTrace,setJobTrace]=useState<AgentTraceEvent[]>([]);
  const [progress, setProgress] = useState({ message: '', completed: 0, total: 1 });
  const mounted = useRef(true);
  async function poll(id: string) {
    setJobId(id); setBusy(true);
    try {
      while (mounted.current) {
        const response = await fetch(`/api/jobs?id=${encodeURIComponent(id)}`);
        const job = await response.json();
        if (!response.ok) throw new Error(job.error ?? 'Job unavailable.');
        setProgress(job);if(job.trace)setJobTrace(job.trace);
        if (job.status !== 'running') {
          localStorage.removeItem('folioecho-job');
          if (job.status === 'done') {
            setJobTrace([]);
            notify('Event Studio results ready', 'Your cultural evidence and event proposals have been updated.', 'success', `studio-${id}`);
            setRun(job.run); setEdgeId(''); setStudioTab(job.run.changes.length?'changes':job.run.selected.length?'events':'matching'); setTypes(job.run.input.preferences.curatorTypes.filter((type:CuratorType)=>type!=='mixed'));
            setConstraints(job.run.input.constraints); setGenres(job.run.input.selectedGenres.join(', ')); setMatches(job.run.input.matches);
          }
          if (job.status === 'error') throw new Error(job.error ?? 'Planning failed.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } finally { if (mounted.current) { setBusy(false); setJobId(''); } }
  }
  useEffect(() => {
    mounted.current = true;
    void fetch('/api/workspace').then(r => r.json()).then(data => {
      if (!mounted.current) return;
      if (data.run) { setRun(data.run); setStudioTab(data.run.selected.length?'events':'matching'); setTypes(data.run.input.preferences.curatorTypes.filter((type:CuratorType)=>type!=='mixed')); setConstraints(data.run.input.constraints); setGenres(data.run.input.selectedGenres.join(', ')); setMatches(data.run.input.matches); }
      const job = localStorage.getItem('folioecho-job');
      if (job) void poll(job).catch(e => setError(e.message));
    }).catch(() => setError('Could not restore the last saved run.')).finally(()=>{if(mounted.current)setRestoring(false);});
    return () => { mounted.current = false; };
  }, []);
  const input = { catalogue: books, selectedGenres: genres.split(',').map(s => s.trim().toLowerCase()).filter(Boolean), preferences: { curatorTypes: types }, constraints, matches };
  const estimate=liveEstimate(books.length,books.filter(book=>book.hiddenGem&&book.stock>=constraints.minStock).length,types.includes('mixed')||(types.includes('listening')&&types.includes('cinema'))?2:1);
  const stale = !!run && (JSON.stringify(run.input.catalogue) !== JSON.stringify(books) || JSON.stringify(run.input.constraints) !== JSON.stringify(constraints) || JSON.stringify(run.input.preferences.curatorTypes) !== JSON.stringify(types) || JSON.stringify(run.input.selectedGenres) !== JSON.stringify(input.selectedGenres) || JSON.stringify(run.input.matches) !== JSON.stringify(matches));
  const onlyStockChanged = !!run && JSON.stringify(run.input.catalogue.map(({ stock, ...b }) => b)) === JSON.stringify(books.map(({ stock, ...b }) => b)) && JSON.stringify(run.input.constraints) === JSON.stringify(constraints) && JSON.stringify(run.input.preferences.curatorTypes) === JSON.stringify(types) && JSON.stringify(run.input.selectedGenres) === JSON.stringify(input.selectedGenres) && JSON.stringify(run.input.matches) === JSON.stringify(matches);
  async function request(body: unknown) {
    setBusy(true); setError('');setJobTrace([]);
    try {
      const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Planning failed.');
      localStorage.setItem('folioecho-job', data.id);
      await poll(data.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  function studioTabKeys(event:KeyboardEvent<HTMLDivElement>){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const current=buttons.findIndex(button=>button===document.activeElement);if(current<0)return;
    event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[index].focus();buttons[index].click();
  }
  async function planEvent(proposal:Proposal){
    if(!run||busy||stale)return;
    setDraftBusy(true);setError('');
    try{
      const response=await fetch('/api/event-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:run.id,revision:run.revision,proposalId:proposal.id})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not create draft.');
      onPlanEvent(data.draft);
    }catch(error){setError(error instanceof Error?error.message:'Could not create draft.');}
    finally{setDraftBusy(false);}
  }
  async function importCSV(file?: File) {
    if (!file) return;
    try {
      const imported = await readCatalogueFile(file);
      if (imported.length > 25) throw new Error('The Qloo pilot supports at most 25 books.');
      setBooks(imported); setMatches({}); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Catalogue import failed.'); }
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
  useEffect(()=>setEdgeId(''),[graphBook,graphType,graphLimit]);
  useEffect(()=>{
    const dialog=evidenceDialog.current;if(!dialog||!selectedEdge||!active||studioTab!=='graph')return;
    if(!dialog.open)dialog.showModal();
    return()=>{if(dialog.open)dialog.close();};
  },[selectedEdge,active,studioTab]);
  function closeEvidence(){evidenceDialog.current?.close();setEdgeId('');graphContainer.current?.focus({preventScroll:true});}
  function eventCard(event: Proposal) {
    return <article className="live-event" key={event.id}>
      <div className="live-event-head"><h3>{event.title}</h3><span className="chip">{event.score === null ? event.status : `${event.score.toFixed(1)} / 100`}</span></div>
      <p className="event-duration">{event.duration} minutes · {event.curator === 'listening' ? 'Reading & listening' : event.curator === 'cinema' ? 'Literature & cinema' : 'Cross-cultural evening'}</p>
      <h4>Central idea{event.narrativeSource ? ' · AI editorial interpretation' : ''}</h4><p>{event.narrativeSource ? event.interpretation : <>Bring readers together around {event.bookIds.map(id => run?.input.catalogue.find(b => b.id === id)?.title).join(' and ')}, using {event.curator === 'listening' ? 'music as a starting point for conversation' : 'film and cultural references to open a shared discussion'}.</>}</p>
      <h4>Books from your shelves</h4><div className="event-book-list">{event.bookIds.map(id => { const book = run?.input.catalogue.find(b => b.id === id); return <span key={id}><b>{book?.title}</b><small>{book?.stock ?? 0} copies available</small></span>; })}</div>
      {event.reasons.length > 0 && <p className="live-warning">{event.reasons.join(' ')}</p>}
      <details className="event-explanation"><summary>Why recommended</summary><p>{event.interpretation}</p>{event.factors && <div className="live-factors">{Object.entries(event.factors).map(([name, value]) => <span key={name}>{name} <b>{value.toFixed(3)}</b></span>)}</div>}<p>Score = 100 × (0.40R + 0.25N + 0.25U + 0.10F). Qloo affinity supports discovery; it does not establish thematic suitability.</p></details>
      <h4>Cultural references</h4>
      <div className="studio-reference-preview">{[...new Set(event.edgeIds.map(id=>run?.edges.find(edge=>edge.id===id)?.name).filter(Boolean))].join(' · ')}</div>
      <details><summary>Inspect references &amp; what-if</summary><ul>{event.edgeIds.map(id => {
        const edge = run?.edges.find(e => e.id === id);
        return edge ? <li key={id}><button className="small-button" onClick={() => {setEdgeId(id);setStudioTab('graph');}}>{edge.name} · Qloo affinity {edge.affinity.toFixed(3)}</button>{' '}<button disabled={busy || stale || !edge.active} onClick={() => void request({ action: 'repair', runId: run!.id, revision: run!.revision, exclude: edge.entityId })}>Exclude & repair</button></li> : null;
      })}</ul></details>
      {event.status==='valid'&&run?.selected.includes(event.id)&&<button disabled={busy||stale} onClick={()=>void planEvent(event)}>{draftBusy?'Preparing draft…':'Plan this event'}</button>}
    </article>;
  }
  return <div className="live-studio">
    <dialog ref={liveDialog} className="studio-evidence-dialog" aria-labelledby="live-warning-title" onCancel={event=>{event.preventDefault();setConfirmLive(false);}}>
      <h2 id="live-warning-title">Start a live Qloo run?</h2><p>Estimated time: <b>{estimate.label}</b>. Up to {estimate.lookups} catalogue and cultural lookups, with at most 3 running at once. Cache hits can reduce the work.</p><p>This is a planning estimate, not a measured service guarantee. A cold run or slow provider can take several minutes longer. It uses your Qloo planning allowance. Existing saved results stay available; leaving this tab does not cancel a job.</p>
      <div className="button-row"><button autoFocus onClick={()=>setConfirmLive(false)}>Keep saved results</button><button className="primary" disabled={busy||!types.length} onClick={()=>{setConfirmLive(false);void request({action:'create',input});}}>Start live run ({estimate.label})</button></div>
    </dialog>
    <div className="studio-header"><div><span className="studio-eyebrow">BOOKSHOP EVENT WORKSPACE</span><h1>Event Studio</h1><p>A tool-using planning agent: resolve books, retrieve Qloo evidence, validate proposals and repair your plan.</p></div><div className="studio-metrics"><span><b>{books.filter(book=>book.hiddenGem).length}</b><span className="studio-metric-label">hidden gems</span></span><span><b>{run?run.selected.length:restoring?'…':0}</b><span className="studio-metric-label">event ideas<MetricHint text="Selected proposals in the latest saved Qloo run. Planner drafts are counted separately; zero ideas does not delete drafts."/></span></span>{run&&<span><b>R{run.revision}</b><span className="studio-metric-label">saved snapshot</span></span>}</div></div>
    <div className="studio-tabs" role="tablist" aria-label="Event Studio sections" onKeyDown={studioTabKeys}>{([
      ['setup','Set up',false],['matching','Book matches',!run],['graph','Cultural graph',!run],['events','Event ideas',!run],['editorial','AI editorial',false],['trace','Agent trace',!run&&!jobTrace.length],['changes','What-if changes',!run?.changes.length],
    ] as const).map(([id,label,disabled])=><button key={id} id={`studio-tab-${id}`} role="tab" tabIndex={studioTab===id?0:-1} aria-selected={studioTab===id} aria-controls={`studio-panel-${id}`} disabled={disabled} onClick={event=>{setStudioTab(id);event.currentTarget.parentElement?.scrollIntoView({block:'start',behavior:'smooth'});}}>{label}{id==='events'&&run&&<small>{run.selected.length}</small>}</button>)}</div>
    {run?.preloaded&&<div className="studio-stale" role="status"><span><b>Preloaded Qloo example</b> · Real sample-catalogue results generated {new Date(run.preloaded.generatedAt).toLocaleString()}. Loading this snapshot makes no Qloo request; regenerate to refresh evidence.</span></div>}
    {!!run?.warnings.length&&<p className="live-warning">Some Qloo queries need review. Only recorded evidence is used. Open Book matches → Matching notes for details.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {qlooBusy && <div className="job-progress studio-progress" role="status"><div><b>{progress.message || 'Starting…'}</b><span>{progress.completed}/{progress.total}</span></div><progress value={progress.completed} max={progress.total}/><button disabled={!jobId} onClick={()=>void fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',id:jobId})})}>Cancel</button></div>}
    {qlooBusy&&jobTrace.length>0&&<AgentTrace trace={jobTrace} live/>}
    <div hidden={studioTab!=='trace'} id="studio-panel-trace" role="tabpanel" aria-labelledby="studio-tab-trace" className="studio-tab-panel"><AgentTrace trace={jobTrace.length?jobTrace:run?.trace} run={run}/></div>
    {stale&&<div className="studio-stale" role="status"><span>Inputs changed. Saved results describe the previous snapshot.</span><button onClick={()=>setStudioTab('setup')}>Review setup</button>{onlyStockChanged&&<button disabled={busy} onClick={()=>void request({action:'repair',runId:run!.id,revision:run!.revision,stock:Object.fromEntries(books.filter(book=>run!.input.catalogue.find(old=>old.id===book.id)?.stock!==book.stock).map(book=>[book.id,book.stock]))})}>Apply stock repair</button>}</div>}
    <div hidden={studioTab!=='editorial'} id="studio-panel-editorial" role="tabpanel" aria-labelledby="studio-tab-editorial" className="studio-tab-panel"><Intelligence onCompare={onCompare} books={books} setBooks={setBooks} run={run} setRun={setRun} disabled={qlooBusy||draftBusy} stale={stale} onBusy={setModelBusy}/></div>
    <div hidden={studioTab!=='setup'} id="studio-panel-setup" role="tabpanel" aria-labelledby="studio-tab-setup" className="studio-tab-panel studio-setup-grid">
    <section className="panel live-panel">
      <h2>Catalogue & hidden gems</h2>
      <p>Select 3–5 books to promote. Stock is a hard constraint. Up to 25 catalogue titles are resolved per run.</p>
      <label className="upload-button catalogue-import-button">Import Excel / CSV<input type="file" accept={catalogueFileTypes} disabled={busy} onChange={e => { void importCSV(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <p className="muted">Columns: title, author, stock. Optional: id, tags (separated by ;), hiddenGem (true/false). Import replaces the catalogue after validation.</p>
      <div className="live-books">{books.map(book => <label className="live-book" key={book.id}>
        <input type="checkbox" disabled={busy} checked={book.hiddenGem} onChange={e => setBooks(books.map(b => b.id === book.id ? { ...b, hiddenGem: e.target.checked } : b))} />
        <span><b>{book.title}</b><small>{book.author}</small></span>
        <input type="number" min="0" max="100000" step="1" aria-label={`Stock for ${book.title}`} disabled={busy} value={book.stock} onChange={e => { const stock = Number(e.target.value); if (Number.isSafeInteger(stock) && stock >= 0) setBooks(books.map(b => b.id === book.id ? { ...b, stock } : b)); }} />
      </label>)}</div>
    </section>
    <section className="panel live-panel">
      <h2>Shape the evening</h2>
      <fieldset disabled={busy} className="live-controls">
        <label>Selected catalogue genres/tags<input value={genres} placeholder="Optional, comma separated" onChange={e => setGenres(e.target.value)} /></label>
        <div className="curator-picker"><b>Curator types</b><div>{(['listening', 'cinema'] as CuratorType[]).map(type => <label className={'curator-choice '+(types.includes(type)?'selected':'')} key={type}><input type="checkbox" checked={types.includes(type)} onChange={e => setTypes(e.target.checked ? [...types, type] : types.filter(t => t !== type))} /><Icon name={type==='listening'?'music':'film'} size={24}/><span><strong>{type==='listening'?'Music & reading':'Cinema & books'}</strong><small>{type==='listening'?'Discover artists and musical connections':'Explore film connections and discussion ideas'}</small></span></label>)}</div></div>
        {([['minStock', 'Minimum stock', 1, 1000], ['maxBooks', 'Books per event', 1, 5], ['maxEvents', 'Top events', 1, 10], ['maxDuration', 'Maximum minutes', 15, 600], ['capacity', 'Venue capacity', 1, 1000], ['attendance', 'Expected attendance', 1, 1000]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={constraints[key]} onChange={e => setConstraints({ ...constraints, [key]: Number(e.target.value) })} /></label>)}
        <label className="live-check"><input type="checkbox" checked={constraints.screeningRightsConfirmed} onChange={e => setConstraints({ ...constraints, screeningRightsConfirmed: e.target.checked })} />I have confirmed screening rights for film proposals.</label>
      </fieldset>
      <button className="primary" disabled={busy || !types.length} onClick={() => setConfirmLive(true)}>{busy ? 'Working…' : `Run live (${estimate.label})`}</button>
      <p className="muted">Saved sample results are the default. Live execution is optional and uses Qloo quota; uncached requests can take longer.</p>
    </section>
    </div>
    {run && <>
      <section hidden={studioTab!=='matching'} id="studio-panel-matching" role="tabpanel" aria-labelledby="studio-tab-matching" className="panel live-panel studio-tab-panel"><h2>Book matches & themes</h2>
        <p>{run.resolutions.filter(r => r.status === 'confirmed').length}/{run.resolutions.length} confirmed · revision {run.revision}. Clusters use supplied catalogue tags, or Qloo tags when none were supplied.</p>
        <div className="studio-match-list" tabIndex={0} role="region" aria-label="Book matching results">{run.resolutions.map(resolution => <div className="live-match" key={resolution.bookId}>
          <b>{run.input.catalogue.find(b => b.id === resolution.bookId)?.title}</b><span className="match-status">{resolution.status}</span>
          {resolution.candidates.length > 0 && <select aria-label={`Qloo match for ${resolution.bookId}`} disabled={busy} value={matches[resolution.bookId] ?? resolution.entityId ?? ''} onChange={e => { const next = { ...matches }; if (e.target.value) next[resolution.bookId] = e.target.value; else delete next[resolution.bookId]; setMatches(next); }}><option value="">Choose / automatic exact match</option>{resolution.candidates.map(c => <option key={c.id} value={c.id}>{c.name} — {c.detail}</option>)}</select>}
        </div>)}</div>
        <details className="studio-theme-details"><summary>Thematic groups ({run.clusters.length})</summary><div className="live-clusters">{run.clusters.map(cluster => <span className="chip" key={cluster.id}>{cluster.theme} · {cluster.bookIds.length} · {cluster.source}</span>)}</div></details>
        {!!run.warnings.length&&<details><summary>Matching notes ({run.warnings.length})</summary><div className="studio-notes">{run.warnings.map((warning,index)=><p className="live-warning" key={index}>{warning}</p>)}</div></details>}
      </section>
      <section hidden={studioTab!=='graph'} id="studio-panel-graph" role="tabpanel" aria-labelledby="studio-tab-graph" className="panel live-panel studio-tab-panel"><h2>Cultural graph & evidence</h2><p>Click a connection to inspect its source. Labels show raw Qloo affinity, not a probability about an individual.</p>
        <div className="graph-filters"><label>Book<select aria-label="Book" value={graphBook} onChange={e => setGraphBook(e.target.value)}><option value="all">All selected books</option>{run.input.catalogue.filter(b => b.hiddenGem).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label><label>References<select aria-label="References" value={graphType} onChange={e => setGraphType(e.target.value)}><option value="all">Music & films</option><option value="artist">Music only</option><option value="movie">Films only</option></select></label><label>Connections per book/type<select aria-label="Connections per book/type" value={graphLimit} onChange={e => setGraphLimit(Number(e.target.value))}><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={20}>Show all</option></select></label></div>
        <div className="studio-graph-layout">
        <div className="live-graph" ref={graphContainer} tabIndex={0} role="region" aria-label="Cultural connections graph">{active&&studioTab==='graph'&&<ReactFlow nodes={graph.nodes} edges={graph.edges} fitView fitViewOptions={{padding:.18}} minZoom={.1} maxZoom={2} onEdgeClick={(_, edge) => setEdgeId(edge.id)} onNodeClick={(_, node) => { const edge = run.edges.find(e => e.entityId === node.id && e.active); if (edge) setEdgeId(edge.id); }}><Background /><Controls /><CenterGraph signature={`${run.id}:${run.revision}:${graphBook}:${graphType}:${graphLimit}`} container={graphContainer} nodeIds={graph.nodes.map(node=>node.id)}/></ReactFlow>}</div>
        {selectedEdge&&<dialog className="studio-evidence-dialog" ref={evidenceDialog} aria-labelledby="studio-evidence-title" onCancel={event=>{event.preventDefault();closeEvidence();}}>
          <div className="studio-evidence-heading"><div><span>QLOO EVIDENCE</span><h3 id="studio-evidence-title">{selectedEdge.name}</h3></div><button autoFocus onClick={closeEvidence} aria-label="Close evidence">×</button></div>
          <p><b>{run.input.catalogue.find(book=>book.id===selectedEdge.bookId)?.title}</b> · {selectedEdge.type==='artist'?'Music reference':'Film reference'} · {selectedEdge.active?'Active connection':'Invalidated connection'}</p>
          <div className="studio-evidence-stats"><span>Qloo affinity<b>{selectedEdge.affinity.toFixed(3)}</b></span><span>Normalized affinity<b>{run.references[selectedEdge.context]?percentile(selectedEdge.affinity,run.references[selectedEdge.context]).toFixed(3):'Unavailable'}</b></span><span>Popularity<b>{selectedEdge.popularity?.toFixed(3)??'Unavailable'}</b></span></div>
          <p className="studio-evidence-note">These are discovery signals, not proof of thematic suitability or a prediction about an individual. Review references and permissions before using them.</p>
          <details><summary>Source &amp; technical details</summary><p>Retrieved: {new Date(selectedEdge.retrievedAt).toLocaleString()}<br/>Entity: {selectedEdge.entityId}<br/>Context: {selectedEdge.context}<br/>Fixed reference: {run.references[selectedEdge.context]?.values.length??0} candidates</p><pre>{JSON.stringify(selectedEdge.request,null,2)}</pre></details>
          <div className="studio-evidence-footer"><button disabled={busy||stale||!selectedEdge.active} onClick={()=>void request({action:'repair',runId:run.id,revision:run.revision,exclude:selectedEdge.entityId})}>Exclude &amp; repair</button><button onClick={closeEvidence}>Back to graph</button></div>
        </dialog>}
        </div>
        {!graph.nodes.length&&<p className="studio-empty">No active connections match these filters.</p>}
      </section>
      <section hidden={studioTab!=='events'} id="studio-panel-events" role="tabpanel" aria-labelledby="studio-tab-events" className="panel live-panel studio-tab-panel"><div className="studio-section-header"><div><h2>Your event ideas</h2><p>Choose a validated idea to continue in Event Planner.</p></div><button onClick={() => void downloadPDF('folioecho-cultural-report.pdf', undefined, run.id)}>Export PDF report</button></div>
        <details><summary>How the factors are calculated</summary><p>R: mean percentile of affinities against the initial candidate pool for each book/type query. Ties use midranks; constant pools use 0.5. References stay fixed during repair.</p><p>N: mean (1 − Qloo popularity), a discovery proxy. U: half the share of selected hidden gems covered (including stock-outs), plus half the use of the event's book allowance. F: half the stock-to-attendance headroom, plus half the unused duration allowance. These are explicit pilot heuristics, not validated sales predictions.</p><p>Durations are editorial allocations for discussions and listening/excerpt sessions, not verified full-film running times. Screening rights require owner confirmation.</p></details>
        <div className="studio-event-list" role="region" aria-label="Top event ideas" tabIndex={0}>{run.selected.length ? run.selected.map(id => eventCard(run.proposals.find(p => p.id === id)!)) : <p>No verified event meets the current constraints. Review missing evidence, stock, duration or screening rights.</p>}</div>
        <details><summary>All proposals, including rejected and unverified ({run.proposals.length})</summary><div className="studio-all-proposals">{[...run.proposals].sort((a,b)=>(b.score??-1)-(a.score??-1)).map(eventCard)}</div></details>
      </section>
      {run.changes.length > 0 && <section hidden={studioTab!=='changes'} id="studio-panel-changes" role="tabpanel" aria-labelledby="studio-tab-changes" className="panel live-panel studio-tab-panel"><h2>What changed</h2><p>Normalization references remain unchanged. {run.excluded.length} cultural nodes excluded.</p><div className="studio-changes-list">{run.changes.map(change => <article className="live-change" key={change.eventId}><h3>{change.before.title}</h3><p>{change.reason}</p><p>Before: {change.before.edgeIds.map(id => run.edges.find(e => e.id === id)?.name).join(', ')} · {change.before.score?.toFixed(1) ?? change.before.status}</p><p>After: {change.after?.edgeIds.map(id => run.edges.find(e => e.id === id)?.name).join(', ') || 'No replacement'} · {change.after?.score?.toFixed(1) ?? change.after?.status ?? 'removed'}</p></article>)}</div></section>}

    </>}
  </div>;
}
