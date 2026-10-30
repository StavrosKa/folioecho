import test from 'node:test';
import assert from 'node:assert/strict';
import { mapConcurrent } from '../src/server/concurrency.ts';
import { liveEstimate } from '../src/lib/live-estimate.ts';
import { createRun } from '../src/server/planner.ts';
import { defaultConstraints, type Evidence } from '../src/lib/curator.ts';
import { withOwner } from '../src/server/context.ts';
import { randomUUID } from 'node:crypto';

test('bounded pool overlaps three operations, keeps result order and never exceeds the cap', async () => {
  let active = 0, peak = 0;
  const result = await mapConcurrent([0,1,2,3,4,5,6],3,async n => { active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,n%2?3:8));active--;return n*2; });
  assert.equal(peak,3); assert.equal(active,0); assert.deepEqual(result,[0,2,4,6,8,10,12]);
});
test('failure stops queued work and drains in-flight operations before rejecting', async () => {
  const started:number[]=[]; let release!:()=>void, finished=false;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const task=mapConcurrent([0,1,2,3,4],3,async n=>{started.push(n);if(n===0)throw new Error('stop');await gate;return n;});
  const checked=task.catch(error=>{finished=true;assert.match(error.message,/stop/);});
  await new Promise(resolve=>setTimeout(resolve,5));assert.equal(finished,false);assert.deepEqual(started,[0,1,2]);release();await checked;assert.equal(finished,true);assert.deepEqual(started,[0,1,2]);
});
test('planner overlaps provider calls while reporting monotonic, immutable progress snapshots', async()=>withOwner(randomUUID(),async()=>{
  let active=0,peak=0;const counts:number[]=[],traces:any[]=[];
  const delay=async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;};
  const catalogue=['a','b','c','d'].map(id=>({id,title:id,author:'Writer',stock:3,hiddenGem:true,tags:['art']}));
  const run=await createRun({catalogue,selectedGenres:[],matches:{},preferences:{curatorTypes:['listening']},constraints:{...defaultConstraints}},{
    async resolveBook(book){await delay();return {resolution:{bookId:book.id,status:'confirmed',entityId:`entity-${book.id}`,candidates:[]},tags:[]};},
    async recommend(bookId,_entityId,type){await delay();return {edges:[.4,.6,.8].map((affinity,i):Evidence=>({id:`${bookId}-${i}`,bookId,entityId:`artist-${i}`,name:`Artist ${i}`,type,affinity,popularity:.5,context:`${bookId}:${type}`,active:true,retrievedAt:new Date().toISOString(),request:{endpoint:'/v2/insights',query:{}}}))};}
  },(_message,completed,_total,trace)=>{counts.push(completed);if(trace)traces.push(trace);});
  assert.equal(peak,3);assert.equal(active,0);assert.deepEqual(run.resolutions.map(row=>row.bookId),catalogue.map(book=>book.id));assert.ok(counts.every((value,i)=>!i||value>=counts[i-1]));assert.equal(traces[0].length,1);assert.ok(run.selected.length);
}));
test('cold-run estimate scales with work and is not a claimed benchmark',()=>{assert.equal(liveEstimate(12,3,1).label,'~1–3 min');assert.ok(liveEstimate(25,5,2).lookups>liveEstimate(12,3,1).lookups);});
