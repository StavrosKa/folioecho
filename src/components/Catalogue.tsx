import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { categories, demoBooks, demoBridges, parseCatalogue, plan, type Book } from '../lib/catalogue';
import './catalogue.css';

export default function Catalogue(){
 const [books,setBooks]=useState<Book[]>(demoBooks);
 const [query,setQuery]=useState('');
 const [rejected,setRejected]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('Demo catalogue loaded. Your files stay in this browser session.');
 const [tab,setTab]=useState<'catalogue'|'bridges'>('catalogue');
 const results=useMemo(()=>plan(books,rejected),[books,rejected]);
 const gems=books.filter(b=>b.hiddenGem);
 const available=books.filter(b=>b.stock>0);
 const ready=gems.length>=3&&gems.length<=5;
 const usedBridges=[...new Set(results.flatMap(r=>r.match?[r.match.bridge.id]:[]))];
 const nodes:Node[]=[
  ...results.map((r,i)=>({id:r.book.id,position:{x:0,y:i*115},data:{label:r.book.title},style:{background:'#ede5d1',color:'#19251e',border:'1px solid #b4a47d',borderRadius:12,width:210}})),
  ...usedBridges.map((id,i)=>({id:'bridge-'+id,position:{x:400,y:i*130},data:{label:demoBridges.find(b=>b.id===id)!.name+' · demo'},style:{background:'#233c32',color:'#f4ebd6',border:'1px solid #688675',borderRadius:12,width:210}}))
 ];
 const edges:Edge[]=results.flatMap(r=>r.match?[{id:r.book.id+'-'+r.match.bridge.id,source:r.book.id,target:'bridge-'+r.match.bridge.id,label:r.match.shared.join(', '),style:{stroke:'#6b8c76'}}]:[]);
 async function upload(file?:File){
  if(!file)return;
  try{
   if(file.size>2_000_000)throw new Error('Please use a JSON file smaller than 2 MB.');
   const next=parseCatalogue(JSON.parse(await file.text()));setBooks(next);setRejected([]);setError('');setNotice('Imported '+next.length+' books. Categories were grouped from your catalogue tags.');
  }catch(e){setError(e instanceof Error?e.message:'Could not import this file.');}
 }
 function toggle(id:string){
  const book=books.find(b=>b.id===id)!;
  if(!book.hiddenGem&&gems.length>=5){setError('Choose up to five hidden gems.');return;}
  setError('');setBooks(books.map(b=>b.id===id?{...b,hiddenGem:!b.hiddenGem}:b));
 }
 function download(){
  const blob=new Blob([JSON.stringify(books,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='folioecho-catalogue.json';a.click();URL.revokeObjectURL(url);
 }
 return <div className="shell">
  <aside><img className="logo" src="/folioecho-logo.png" alt="FolioEcho — Where books find their audience"/><div className="workspace">BOOKSHOP WORKSPACE</div><nav aria-label="Workspace"><button className={tab==='catalogue'?'active':''} onClick={()=>setTab('catalogue')}>01 <span>Smart catalogue</span></button><button className={tab==='bridges'?'active':''} onClick={()=>setTab('bridges')}>02 <span>Cultural bridges</span></button></nav><div className="aside-note"><span className="dot"/>Demo workspace<p>Small shelves.<br/>Unexpected connections.</p><small>Qloo integration pending</small></div></aside>
  <main><header><span>FolioEcho / Intelligence studio</span><span className="pill">MVP · DEMO DATA</span></header>
  <section className="intro"><div><div className="eyebrow">LET YOUR SHELVES SPEAK</div><h1>{tab==='catalogue'?'Every book has':'Find the unexpected'}<br/><em>{tab==='catalogue'?'an audience.':'in common.'}</em></h1><p>Start with the books you have. Discover the cultural<br className="desktop"/> connections that bring new readers to them.</p></div><div className="intro-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="book-spine">FOLIO<br/>ECHO</div><span className="spark">✧</span></div></section>
  <section className="stats" aria-label="Catalogue overview">{[[books.length,'Catalogue titles'],[available.length,'Available titles'],[categories(books).length,'Category signals'],[gems.length+'/5','Hidden gems selected']].map(([n,label])=><div key={label}><strong>{n}</strong><span>{label}</span></div>)}</section>
  <div role="status" className="notice">{notice}</div>{error&&<div role="alert" className="error">{error}</div>}
  {tab==='catalogue'?<>
   <section className="panel"><div className="section-heading"><div><div className="eyebrow">YOUR COLLECTION, CONNECTED</div><h2>Smart catalogue</h2></div><div className="actions"><button onClick={download}>Export JSON</button><label className="primary upload">Import catalogue<input type="file" accept=".json,application/json" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label></div></div>
   <div className="toolbar"><input aria-label="Search books" placeholder="Search title, author or tag…" value={query} onChange={e=>setQuery(e.target.value)}/><span>Choose 3–5 books to put in the spotlight</span></div>
   <div className="table-wrap"><table><thead><tr><th>BOOK / AUTHOR</th><th>CATEGORY SIGNALS</th><th>STOCK</th><th>HIDDEN GEM</th></tr></thead><tbody>{books.filter(b=>(b.title+' '+b.author+' '+b.tags.join(' ')).toLowerCase().includes(query.toLowerCase())).map((b,i)=><tr key={b.id}><td><div className="book-cell"><div className={'cover c'+i%3} aria-hidden="true">{b.title.slice(0,1)}</div><div><strong>{b.title}</strong><small>{b.author}</small></div></div></td><td><div className="tags">{b.tags.map(t=><span key={t}>{t}</span>)}</div></td><td><label className="stock"><input aria-label={'Stock for '+b.title} type="number" min="0" step="1" value={b.stock} onChange={e=>{const stock=Number(e.target.value);if(Number.isSafeInteger(stock)&&stock>=0)setBooks(books.map(x=>x.id===b.id?{...x,stock}:x));}}/><small>{b.stock?'available':'unavailable'}</small></label></td><td><button aria-pressed={b.hiddenGem} aria-label={'Mark '+b.title+' as a hidden gem'} className={'gem '+(b.hiddenGem?'selected':'')} onClick={()=>toggle(b.id)}>{b.hiddenGem?'✦ Selected':'＋ Select'}</button></td></tr>)}</tbody></table></div>
   <div className="panel-footer"><span>Only available books can enter a plan.</span><button className="primary" disabled={!ready} onClick={()=>setTab('bridges')}>Explore cultural bridges →</button></div>
   {!ready&&<p className="helper">Select 3–5 hidden gems to explore. Unavailable books remain excluded.</p>}</section>
   <section className="category-section"><div><div className="eyebrow">A MAP OF YOUR SHELVES</div><h2>Emerging categories</h2><p>Grouped from supplied tags.<br/>Review these signals before planning.</p></div><div className="category-cloud">{categories(books).map(([tag,count])=><span key={tag}>{tag}<b>{count}</b></span>)}</div></section>
  </>:<section className="panel"><div className="section-heading"><div><div className="eyebrow">EXPLAINABLE DISCOVERY</div><h2>Cultural bridges</h2></div><button onClick={()=>{setRejected([]);setNotice('All demo music directions restored.');}}>Reset directions</button></div>
   {!ready?<p>Select 3–5 hidden gems in your catalogue before planning.</p>:<>
   <p className="helper">Illustrative tag matching only. No Qloo request or LLM has run. Scores are heuristic, not Qloo affinity.</p>
   <div className="flow" aria-label="Book to cultural bridge graph"><ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}><Background color="#d7d6c9"/><Controls/></ReactFlow></div>
   <div className="bridge-cards">{results.map(r=><article key={r.book.id}><small>AVAILABLE · {r.book.stock} COPIES</small><h3>{r.book.title}</h3>{r.match?<><h4>↳ {r.match.bridge.name}</h4><p><b>Catalogue evidence:</b> shared tags: {r.match.shared.join(', ')}.</p><p><b>Editorial interpretation:</b> {r.match.bridge.interpretation}</p><p className="helper">Demo heuristic score: {r.match.score.toFixed(3)} · Qloo evidence: unavailable</p><button onClick={()=>{setRejected([...rejected,r.match!.bridge.id]);setNotice('Direction rejected. Only affected matches are recalculated; stock constraints remain active.');}}>Reject this music direction</button></>:<p>No supported connection remains. Add useful catalogue tags or restore directions.</p>}</article>)}</div>
   {results.length===0&&<p>No selected books are in stock. Update availability or choose different hidden gems.</p>}
   </>}
   <div className="comparison"><h3>Evidence-based comparison</h3><p>Not run. A real Qloo-backed run and an LLM-only baseline must receive the same catalogue snapshot and constraints before a comparison can be reported.</p></div>
  </section>}
  <footer>FolioEcho <span>Where books find their audience.</span><button onClick={()=>{setBooks(demoBooks);setRejected([]);setError('');setNotice('Demo catalogue restored.');}}>Restore demo</button></footer>
  </main></div>;
}
