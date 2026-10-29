import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { categoryFor,groupedCategories,categoryGroups,type CategoryMapping } from '../src/lib/category-groups.ts';
import { sampleBooks } from '../src/lib/workspace.ts';
import { withOwner } from '../src/server/context.ts';
import { changeAccount,accountStatus } from '../src/server/ai-account.ts';
import { GET,POST } from '../src/pages/api/categories.ts';

const book=(id:string,tags:string[])=>({id,title:id,author:'Author',stock:1,hiddenGem:false,tags});
test('related enriched tags collapse into at most eight groups with distinct-book counts and real local artwork',()=>{
 const books=[book('a',['memory','memoir','grief','loss','aging','time']),book('b',['cities','urban fantasy','journey','travel']),book('c',['nature writing','environment','family','friendship','identity','introspection','magical realism','essay','creativity'])];
 const before=structuredClone(books),groups=groupedCategories(books);
 assert.ok(groups.length<=8);assert.deepEqual(books,before);
 assert.equal(groups.find(group=>group.id==='memory')!.count,1);assert.equal(groups.find(group=>group.id==='places')!.count,1);
 assert.equal(categoryFor('nature writing'),'nature');assert.equal(categoryFor('art criticism'),'creativity');
 for(const group of groups){assert.ok(group.count<=books.length);assert.equal(group.count,new Set(group.bookIds).size);assert.ok(existsSync(`public/category-art/${group.artwork}.svg`));}
 assert.ok(groupedCategories(sampleBooks).length<=8);assert.deepEqual(groupedCategories([]),[]);
});
test('Gemini assignments and artwork update groups while new or unmapped tags keep deterministic coverage',()=>{
 const mapping:CategoryMapping={assignments:{memoir:'identity'},artwork:{identity:'introspection'},provider:'Gemini',model:'fixture',updatedAt:new Date().toISOString()};
 const books=[book('a',['memoir','identity']),book('b',['nature','new theme'])];
 const groups=groupedCategories(books,mapping);
 assert.equal(groups.find(group=>group.id==='identity')!.count,1);assert.equal(groups.find(group=>group.id==='identity')!.artwork,'introspection');
 assert.equal(groups.find(group=>group.id==='nature')!.count,1);assert.equal(groups.find(group=>group.id==='literature')!.count,1);
 assert.equal(categoryFor('constructor',mapping),'literature');
});
const request=(tags:string[],origin='http://127.0.0.1:4321')=>{const url=new URL('http://127.0.0.1:4321/api/categories');return {url,request:new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({tags})})};};
const get=()=>{const url=new URL('http://127.0.0.1:4321/api/categories');return GET({url,request:new Request(url)} as any) as Promise<Response>;};
test('Gemini category refinement is metered, validated, persisted per visitor and never accepts remote artwork',async()=>withOwner(randomUUID(),async()=>{
 const key='AQ.'+('synthetic-category-fixture_').repeat(3);
 await changeAccount({action:'connect',provider:'gemini',key,model:'gemini-3.5-flash-lite',dailyBudget:1,consent:true,billingTier:'paid'});
 let result={assignments:[{tag:'memoir',categoryId:'memory'},{tag:'family',categoryId:'relationships'}],artwork:categoryGroups.map(group=>({categoryId:group.id,artwork:group.artwork}))};
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async(url:any,options:any)=>{calls++;assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));assert.ok(!options.body.includes(key));return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}],usageMetadata:{promptTokenCount:100,totalTokenCount:200,candidatesTokenCount:100}}));}) as typeof fetch;
 try{
  assert.equal((await POST(request(['memoir'],'https://other.example') as any) as Response).status,403);
  assert.equal((await POST(request(Array(151).fill('memoir')) as any) as Response).status,400);assert.equal(calls,0);
  const saved=await POST(request(['memoir','family']) as any) as Response;assert.equal(saved.status,200);const body=await saved.json();assert.equal(body.mapping.provider,'Gemini');assert.equal(body.mapping.assignments.memoir,'memory');assert.ok(!JSON.stringify(body).includes(key));
  assert.deepEqual((await (await get()).json()).mapping,body.mapping);
  await withOwner(randomUUID(),async()=>assert.equal((await (await get()).json()).mapping,null));
  result={...result,assignments:[{tag:'memoir',categoryId:'memory'},{tag:'invented',categoryId:'identity'}]};
  assert.equal((await POST(request(['memoir','family']) as any) as Response).status,400);assert.deepEqual((await (await get()).json()).mapping,body.mapping);
  result={...result,assignments:[{tag:'memoir',categoryId:'memory'},{tag:'family',categoryId:'relationships'}],artwork:categoryGroups.map(group=>({categoryId:group.id,artwork:'https://untrusted.example/image.svg' as any}))};
  assert.equal((await POST(request(['memoir','family']) as any) as Response).status,400);assert.deepEqual((await (await get()).json()).mapping,body.mapping);
  assert.equal((await accountStatus()).usage.attempts,3);
 }finally{globalThis.fetch=original;}
}));
test('category refinement never switches to OpenAI or spends a request when Gemini is not selected',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount({action:'connect',provider:'openai',key:'sk-'+('synthetic-fixture_').repeat(3),model:'gpt-6-luna',dailyBudget:1,consent:true});
 const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('Unexpected request');}) as typeof fetch;
 try{const response=await POST(request(['memoir']) as any) as Response;assert.equal(response.status,400);assert.match((await response.json()).error,/Select.*Gemini/);assert.equal(calls,0);assert.equal((await accountStatus()).usage.attempts,0);}finally{globalThis.fetch=original;}
}));
