import type { APIRoute } from 'astro';
import { guard,json } from '../../server/http.ts';
import { get,put,acquire,release } from '../../server/store.ts';
import { owner } from '../../server/context.ts';
import { randomUUID } from 'node:crypto';
import { effectiveConfiguration } from '../../server/ai-account.ts';
import { objectSchema,structuredModelWithMetadata } from '../../server/ai.ts';
import { categoryGroups,categoryArtwork,isCategoryArtwork,isCategoryId,type CategoryMapping } from '../../lib/category-groups.ts';
export const prerender=false;
export const GET:APIRoute=async({request,url})=>{
  const blocked=guard(request,url);if(blocked)return blocked;
  try{return json({mapping:await get<CategoryMapping>('category-map','active')??null});}
  catch{return json({error:'Category grouping could not be loaded.'},503);}
};
export const POST:APIRoute=async({request,url})=>{
  const blocked=guard(request,url,true);if(blocked)return blocked;
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON input is required.'},415);
  const lease=`category-update:${owner()}`,token=randomUUID();
  if(!await acquire(lease,token,120000))return json({error:'Category refinement is already running.'},409);
  try {
    const raw=await request.text();if(raw.length>20000)return json({error:'Category input is too large.'},413);
    const body=JSON.parse(raw);
    if(!Array.isArray(body.tags)||!body.tags.length||body.tags.length>150||body.tags.some((tag:unknown)=>typeof tag!=='string'||!tag.trim()||tag.length>80))throw new Error('Refine up to 150 distinct tags of at most 80 characters each.');
    const tags=[...new Set<string>(body.tags.map((tag:string)=>tag.trim().toLowerCase()))].sort();
    const config=await effectiveConfiguration();
    if(config.provider!=='gemini'||!config.key)throw new Error('Select a configured Gemini demo or personal Gemini key in Usage & Billing.');
    const schema=objectSchema({assignments:{type:'array',minItems:1,maxItems:150,items:objectSchema({tag:{type:'string'},categoryId:{type:'string',enum:categoryGroups.map(group=>group.id)}})},artwork:{type:'array',minItems:8,maxItems:8,items:objectSchema({categoryId:{type:'string',enum:categoryGroups.map(group=>group.id)},artwork:{type:'string',enum:[...categoryArtwork]}})}});
    const generated=await structuredModelWithMetadata('category_grouping',schema,'Group every supplied catalogue tag into exactly one of the eight fixed categories. Merge related concepts; do not create categories or tags. Keep original tag strings exactly as supplied. Literary forms and unmatched themes go in literature. For each of all eight categories, choose the most suitable artwork ID from the local library. Artwork is decorative, not evidence. Return one assignment for every tag and one artwork choice for every category.',{tags,categories:categoryGroups,artwork:[...categoryArtwork]},fetch,'gemini');
    const result=generated.data;
    if(result.assignments.length!==tags.length||new Set(result.assignments.map((item:any)=>item.tag)).size!==tags.length||result.assignments.some((item:any)=>!tags.includes(item.tag)||!isCategoryId(item.categoryId))||result.artwork.length!==8||new Set(result.artwork.map((item:any)=>item.categoryId)).size!==8||result.artwork.some((item:any)=>!isCategoryId(item.categoryId)||!isCategoryArtwork(item.artwork)))throw new Error('Category suggestions failed validation. Your previous grouping was kept.');
    const mapping:CategoryMapping={assignments:Object.fromEntries(result.assignments.map((item:any)=>[item.tag,item.categoryId])),artwork:Object.fromEntries(result.artwork.map((item:any)=>[item.categoryId,item.artwork])),provider:generated.provider,model:generated.model,updatedAt:new Date().toISOString()};
    await put('category-map','active',mapping);return json({mapping});
  }catch(error){return json({error:error instanceof SyntaxError?'Invalid category input.':error instanceof Error?error.message:'Category refinement failed.'},400);}
  finally{await release(lease,token);}
};
