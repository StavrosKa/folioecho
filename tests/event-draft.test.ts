import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRun} from '../src/server/planner.ts';
import {defaultConstraints,type Evidence} from '../src/lib/curator.ts';
import {eventDraftFromRun} from '../src/server/event-draft.ts';
import {validProgramme,programmeTiming} from '../src/lib/programme.ts';
import {POST} from '../src/pages/api/event-draft.ts';
import {put} from '../src/server/store.ts';
import {withOwner} from '../src/server/context.ts';
async function fixture(){
 const catalogue=['a','b','c'].map(id=>({id,title:'Book '+id,author:'Author',tags:['memory'],stock:5,hiddenGem:true}));
 return createRun({catalogue,selectedGenres:[],matches:{},preferences:{curatorTypes:['listening']},constraints:{...defaultConstraints}},{
  async resolveBook(book){return {resolution:{bookId:book.id,status:'confirmed',entityId:'fixture-'+book.id,candidates:[]},tags:[]};},
  async recommend(bookId,_entityId,type){return {edges:[.5,.8].map((affinity,index):Evidence=>({id:`${bookId}-${index}`,bookId,entityId:`entity-${bookId}-${index}`,name:`Reference ${bookId} ${index}`,type,affinity,popularity:.5,context:`${bookId}:${type}`,active:true,retrievedAt:new Date().toISOString(),request:{endpoint:'/v2/insights',query:{'filter.type':type}}}))};}
 });
}
test('a real validated proposal becomes a draft with exact books, evidence, capacity and duration; revision IDs preserve edited drafts',async()=>withOwner(randomUUID(),async()=>{
 const run=await fixture(),proposal=run.proposals.find(item=>item.id===run.selected[0])!,before=structuredClone(run);
 const draft=eventDraftFromRun(run,proposal.id);
 assert.equal(draft.title,proposal.title);assert.equal(draft.capacity,run.input.constraints.capacity);assert.equal(draft.date,'');assert.equal(draft.source!.revision,run.revision);assert.deepEqual(draft.source!.bookIds,proposal.bookIds);
 assert.equal(validProgramme(draft.programme),true);assert.equal(programmeTiming(draft.programme!).elapsed,proposal.duration);assert.deepEqual([...new Set(draft.programme!.flatMap(segment=>segment.bookIds))].sort(),[...proposal.bookIds].sort());
 assert.ok(draft.source!.references.every(reference=>run.edges.some(edge=>edge.entityId===reference.entityId&&edge.name===reference.name&&edge.active)));assert.deepEqual(run,before);
 const edited=structuredClone(draft);edited.title='My edited draft';assert.equal(eventDraftFromRun(run,proposal.id).id,draft.id);run.revision++;assert.notEqual(eventDraftFromRun(run,proposal.id).id,draft.id);assert.equal(edited.title,'My edited draft');
}));
test('invalid, unselected, excluded and out-of-stock proposals cannot be sent to the planner',async()=>withOwner(randomUUID(),async()=>{
 const run=await fixture(),id=run.selected[0];
 const unselected=structuredClone(run);unselected.selected=[];assert.throws(()=>eventDraftFromRun(unselected,id),/validated/);
 const invalid=structuredClone(run);invalid.proposals.find(item=>item.id===id)!.status='unverified';assert.throws(()=>eventDraftFromRun(invalid,id),/validated/);
 const excluded=structuredClone(run);excluded.edges.forEach(edge=>edge.active=false);assert.throws(()=>eventDraftFromRun(excluded,id),/validated/);
 const unavailable=structuredClone(run);unavailable.input.catalogue.forEach(book=>book.stock=0);assert.throws(()=>eventDraftFromRun(unavailable,id),/validated/);
}));
test('draft API uses the owned canonical run, rejects stale catalogue/revisions and does not call providers',async()=>withOwner(randomUUID(),async()=>{
 const run=await fixture();await put('run',run.id,run);await put('workspace','local',{books:run.input.catalogue});
 const call=async(revision=run.revision,origin='http://127.0.0.1:4321')=>{const url=new URL('http://127.0.0.1:4321/api/event-draft');return await POST({url,request:new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({runId:run.id,proposalId:run.selected[0],revision})})} as any) as Response;};
 const original=globalThis.fetch;globalThis.fetch=(async()=>{throw new Error('No provider request expected');}) as typeof fetch;
 try{
  assert.equal((await call()).status,200);assert.equal((await call(run.revision-1)).status,409);assert.equal((await call(run.revision,'https://other.example')).status,403);
  await withOwner(randomUUID(),async()=>assert.equal((await call()).status,409));
  await put('workspace','local',{books:run.input.catalogue.map(book=>({...book,stock:0}))});assert.equal((await call()).status,409);
 }finally{globalThis.fetch=original;}
}));
