import Icon from './Icon';
import {bookCover} from '../lib/book-covers';
import './evidence-map.css';
import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Position, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import MetricHint from './MetricHint';
import { evidenceEdges } from '../lib/comparison';
import { fetchComparison, type ComparisonData } from './ComparisonResults';
export default function EvidenceMap({ onStudio }: { onStudio: () => void }) {
  const [data, setData] = useState<ComparisonData | null>(null), [error, setError] = useState(''), [selected, setSelected] = useState('');
  useEffect(() => { let active = true; void fetchComparison().then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  const [kind,setKind]=useState('all'),[bookFilter,setBookFilter]=useState('all');
  const run = data?.run;
  const graph = useMemo(() => {
    if (!run) return { nodes: [] as Node[], edges: [] as Edge[] };
    const all = evidenceEdges(run).filter(edge=>kind==='all'||edge.type===kind), selectedBooks = run.input.catalogue.filter(book => book.hiddenGem&&(bookFilter==='all'||book.id===bookFilter));
    const visible = selectedBooks.flatMap(book => ['artist','movie'].flatMap(type=>all.filter(edge => edge.bookId === book.id&&edge.type===type).sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id)).slice(0, 2)));
    const targets = [...new Map(visible.map(edge => [edge.entityId, edge])).values()];
    return { nodes: [...selectedBooks.filter(book => visible.some(edge => edge.bookId === book.id)).map((book, i) => ({ id: `book:${book.id}`, position: { x: 0, y: i * 150 }, sourcePosition: Position.Right, data: { label: <div className="map-book-node">{bookCover(book)&&<img src={bookCover(book)!.src} alt=""/>}<span><small>CATALOGUE BOOK</small><b>{book.title}</b><small>{book.author}</small></span></div> }, className: 'map-book-card', style: { width: 250 } })), ...targets.map((edge,i)=>({id:`ref:${edge.entityId}`,position:{x:530,y:i*105},targetPosition:Position.Left,data:{label:<div className="map-reference-node"><i><Icon name={edge.type==='artist'?'music':'film'} size={22}/></i><span><small>{edge.type==='artist'?'MUSIC':'CINEMA'}</small><b>{edge.name}</b></span></div>},className:'map-reference-card',style:{width:250}}))], edges: visible.map(edge => ({ id: edge.id, source: `book:${edge.bookId}`, target: `ref:${edge.entityId}`, label: edge.affinity.toFixed(3), type:'smoothstep', interactionWidth:24, style: { stroke: selected===edge.id?'#b78531':'#b9a56d',strokeWidth:selected===edge.id?3:1.5 }, labelStyle:{fill:'#52694f',fontSize:12},labelBgStyle:{fill:'#fbf8ec',fillOpacity:1},labelBgPadding:[6,4] as [number,number] })) };
  }, [run,kind,bookFilter,selected]);
  const edge = run?.edges.find(item => item.id === selected);
  return <section className="panel overview-evidence-map"><div className="comparison-heading"><div><span className="map-eyebrow">BOOKS · MUSIC · CINEMA</span><h2>Your collection, connected.</h2><p>{run ? `Run ${run.id.slice(0, 8)} · revision ${run.revision} · ${evidenceEdges(run).length} active evidence links` : 'Connections from your latest saved Qloo run.'}</p></div><button onClick={onStudio}>Explore in Event Studio</button></div>
    <div className="map-toolbar"><div className="map-type-tabs">{[['all','All connections'],['artist','Music'],['movie','Cinema']].map(([id,label])=><button key={id} aria-pressed={kind===id} onClick={()=>{setKind(id);setSelected('')}}>{label}</button>)}</div><label>Book <select value={bookFilter} onChange={e=>{setBookFilter(e.target.value);setSelected('')}}><option value="all">All selected books</option>{run?.input.catalogue.filter(b=>b.hiddenGem).map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></label><span className="map-link-count">{graph.edges.length} visible links</span></div>
    {!!run?.selected.length&&<div className="overview-ready-events"><div><b>{run.selected.length} evidence-backed event ideas ready<MetricHint text="Qloo-selected proposals. Choosing Plan this event creates a separate Planner draft, so the two totals can differ."/></b><button className="primary" onClick={onStudio}>View event ideas</button></div>{run.selected.slice(0,2).map(id=>{const event=run.proposals.find(proposal=>proposal.id===id);return event?<article key={id}><b>{event.title}</b><p>{event.duration} min · {event.edgeIds.length} supporting links</p><small>{[...new Set(event.edgeIds.flatMap(edgeId=>{const edge=run.edges.find(item=>item.id===edgeId);return edge?[edge.name]:[];}))].join(' · ')}</small></article>:null;})}</div>}
    {run?.preloaded&&<p className="comparison-note">Preloaded real Qloo snapshot · generated {new Date(run.preloaded.generatedAt).toLocaleString()}. No provider call on page load.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {data?.catalogueChanged && <p className="comparison-note">Saved run snapshot; current catalogue differs. Regenerate in Event Studio to update the map.</p>}
    {!!graph.nodes.length ? <><div className="overview-real-graph"><ReactFlow key={`${run!.id}:${run!.revision}:${kind}:${bookFilter}`} nodes={graph.nodes} edges={graph.edges} fitView fitViewOptions={{ padding: .18,maxZoom:1 }} minZoom={.1} maxZoom={1.5} nodesConnectable={false} onEdgeClick={(_, edge) => setSelected(edge.id)}><Background color="#c7ccb8" gap={24} size={1}/><Controls /></ReactFlow></div><p className="comparison-note">Top 2 active links per book and reference type. Labels are raw Qloo affinities; click a link for provenance.</p></> : <p>{data ? 'No recorded evidence links yet. Generate a Qloo run in Event Studio; no demo connections are substituted.' : 'Loading saved evidence…'}</p>}
    {!edge&&graph.edges.length>0&&<p className="map-inspect-hint"><Icon name="info" size={17}/> Select a connection to inspect its recorded evidence. Drag to explore; use the fit control to centre the map.</p>}
    {edge && <div className="overview-edge-evidence"><b>{run!.input.catalogue.find(book => book.id === edge.bookId)?.title} → {edge.name}</b><p>Affinity {edge.affinity.toFixed(3)} · retrieved {new Date(edge.retrievedAt).toLocaleString()}</p><details><summary>Recorded Qloo request</summary><pre>{JSON.stringify(edge.request, null, 2)}</pre></details><button onClick={() => setSelected('')}>Close evidence</button></div>}
  </section>;
}
