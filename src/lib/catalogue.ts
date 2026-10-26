export interface Book { id: string; title: string; author: string; stock: number; tags: string[]; hiddenGem: boolean }
export interface Bridge { id: string; name: string; tags: string[]; source: 'demo'; interpretation: string }
export const demoBooks: Book[] = [
 {id:'b1',title:'Invisible Cities',author:'Italo Calvino',stock:4,tags:['cities','imagination','travel'],hiddenGem:true},
 {id:'b2',title:'The Book of Disquiet',author:'Fernando Pessoa',stock:3,tags:['introspection','cities','solitude'],hiddenGem:true},
 {id:'b3',title:'The Waves',author:'Virginia Woolf',stock:2,tags:['memory','nature','introspection'],hiddenGem:true},
 {id:'b4',title:'A Room of One’s Own',author:'Virginia Woolf',stock:5,tags:['identity','creativity'],hiddenGem:false},
 {id:'b5',title:'The Odyssey',author:'Homer',stock:0,tags:['travel','memory'],hiddenGem:false}
];
export const demoBridges: Bridge[] = [
 {id:'m1',name:'Ambient listening',tags:['imagination','nature','introspection'],source:'demo',interpretation:'A quiet listening session could make space for reflective passages.'},
 {id:'m2',name:'A city in jazz',tags:['cities','creativity','solitude'],source:'demo',interpretation:'An urban soundscape could introduce contrasting voices and imagined places.'},
 {id:'m3',name:'Songs of journeys',tags:['travel','memory','identity'],source:'demo',interpretation:'A journey theme could connect readers through departure and return.'}
];
export function parseCatalogue(value: unknown): Book[] {
 if(!Array.isArray(value) || !value.length || value.length>1000) throw new Error('Upload a JSON array of 1–1,000 books.');
 const ids=new Set<string>();
 return value.map((raw,i)=>{
  if(!raw || typeof raw!=='object') throw new Error('Invalid book at row '+(i+1));
  const b=raw as Record<string,unknown>;
  if(typeof b.id!=='string'||!b.id.trim()||ids.has(b.id)||typeof b.title!=='string'||!b.title.trim()||typeof b.author!=='string'||!b.author.trim()||!Number.isSafeInteger(b.stock)||(b.stock as number)<0||!Array.isArray(b.tags)||!b.tags.every(t=>typeof t==='string'&&t.trim())||typeof b.hiddenGem!=='boolean') throw new Error('Row '+(i+1)+': unique id, title, author, integer stock >= 0, tags and hiddenGem are required.');
  ids.add(b.id); return {id:b.id,title:b.title.trim(),author:b.author.trim(),stock:b.stock as number,tags:[...new Set((b.tags as string[]).map(t=>t.trim().toLowerCase()))],hiddenGem:b.hiddenGem};
 });
}
export function categories(books:Book[]) {
 const counts=new Map<string,number>();
 books.forEach(b=>b.tags.forEach(t=>counts.set(t,(counts.get(t)??0)+1)));
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}
export function plan(books:Book[],rejected:string[]=[]){
 return books.filter(b=>b.stock>0&&b.hiddenGem).map(book=>{
  const candidates=demoBridges.filter(m=>!rejected.includes(m.id)).map(bridge=>{
   const shared=book.tags.filter(t=>bridge.tags.includes(t));
   const relevance=shared.length/Math.max(1,new Set([...book.tags,...bridge.tags]).size);
   const novelty=1-relevance, utilization=1, feasibility=1;
   return {bridge,shared,score:.4*relevance+.25*novelty+.25*utilization+.1*feasibility};
  }).filter(c=>c.shared.length>0).sort((a,b)=>b.score-a.score||a.bridge.id.localeCompare(b.bridge.id));
  return {book,match:candidates[0]??null};
 });
}
