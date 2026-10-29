import type { Book } from './catalogue.ts';
export const categoryArtwork=['cities','memory','travel','creativity','identity','imagination','introspection','nature','art','family','friendship','music','mystery','solitude','literature'] as const;
export type CategoryArtwork=typeof categoryArtwork[number];
export const categoryGroups=[
  {id:'identity',name:'Identity & Inner Life',artwork:'identity',description:'Identity, self, reflection, philosophy, solitude and perception.'},
  {id:'memory',name:'Memory & Time',artwork:'memory',description:'Memory, history, memoir, aging, grief and loss.'},
  {id:'creativity',name:'Art & Creativity',artwork:'creativity',description:'Art, writing, creativity, music and artistic practice.'},
  {id:'places',name:'Places & Journeys',artwork:'travel',description:'Cities, travel, journeys, wandering, home and exploration.'},
  {id:'nature',name:'Nature & Environment',artwork:'nature',description:'Nature, landscape, ecology, seasons and the natural world.'},
  {id:'relationships',name:'Relationships & Family',artwork:'family',description:'Family, friendship, love, desire, childhood and belonging.'},
  {id:'imagination',name:'Imagination & Mystery',artwork:'imagination',description:'Imagination, fantasy, dreams, mystery and speculative worlds.'},
  {id:'literature',name:'Literature & Other Themes',artwork:'literature',description:'Literary forms, movements and other supplied themes that do not fit the groups above.'},
] as const;
export type CategoryId=typeof categoryGroups[number]['id'];
export interface CategoryMapping {assignments:Record<string,CategoryId>;artwork:Partial<Record<CategoryId,CategoryArtwork>>;provider:string;model:string;updatedAt:string}
export interface GroupedCategory {id:CategoryId;name:string;artwork:CategoryArtwork;bookIds:string[];tags:string[];count:number}
const normalize=(tag:string)=>tag.trim().toLowerCase().replace(/[’']/g,'').replace(/[-_]/g,' ').replace(/\s+/g,' ');
export const isCategoryId=(id:unknown):id is CategoryId=>categoryGroups.some(group=>group.id===id);
export const isCategoryArtwork=(id:unknown):id is CategoryArtwork=>categoryArtwork.some(art=>art===id);
export function categoryFor(tag:string,mapping:CategoryMapping|null=null):CategoryId {
  const mapped=mapping?.assignments[tag.trim().toLowerCase()];
  if(isCategoryId(mapped))return mapped;
  const value=normalize(tag);
  // Specific phrases precede broad keywords; each tag belongs to one group.
  if(/nature writing|natural world|environment|ecolog|landscape|\bnature\b|\bsea\b|\bsummer\b|\bseason/.test(value))return 'nature';
  if(/art criticism|\bart\b|\bartist|creativ|\bwriting\b|\bmusic\b|\brock\b|\bjazz\b|visual culture/.test(value))return 'creativity';
  if(/memor|\btime\b|\bhistory\b|aging|ageing|\bgrief\b|\bloss\b|nostalgi|autobiograph/.test(value))return 'memory';
  if(/\bcit(?:y|ies)\b|urban|travel|journey|wander|explor|homecoming|\bhome\b|\byork\b|border|geograph|\bplace/.test(value))return 'places';
  if(/imagin|myster|fantas|magical realism|dream|surreal|speculat|science fiction|\bmyth|\bfable\b/.test(value))return 'imagination';
  if(/friend|famil|\blove\b|\bdesire\b|childhood|\bloyal|belong|relationship|heartbreak|\bkinship/.test(value))return 'relationships';
  if(/identit|introspect|solitude|self|conscious|existenti|alienat|percept|philosoph|psycholog|melanchol|boredom|gender|feminis|independence|fate|free will|human nature|innocence|loneliness/.test(value))return 'identity';
  return 'literature';
}
export function groupedCategories(books:Book[],mapping:CategoryMapping|null=null):GroupedCategory[] {
  const buckets=new Map<CategoryId,{books:Set<string>;tags:Set<string>}>();
  for(const book of books)for(const raw of book.tags){
    const tag=raw.trim().toLowerCase();if(!tag)continue;
    const id=categoryFor(tag,mapping),bucket=buckets.get(id)??{books:new Set<string>(),tags:new Set<string>()};
    bucket.books.add(book.id);bucket.tags.add(tag);buckets.set(id,bucket);
  }
  return categoryGroups.flatMap(group=>{
    const bucket=buckets.get(group.id);if(!bucket)return [];
    const art=mapping?.artwork[group.id];
    return [{id:group.id,name:group.name,artwork:isCategoryArtwork(art)?art:group.artwork,bookIds:[...bucket.books],tags:[...bucket.tags].sort(),count:bucket.books.size}];
  }).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
