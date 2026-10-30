import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withOwner } from '../src/server/context.ts';
import { createRun } from '../src/server/planner.ts';
import { QlooContextError } from '../src/server/qloo-errors.ts';
import { defaultConstraints, type Evidence } from '../src/lib/curator.ts';
test('a rejected Qloo signal is isolated per book/type; other music and film evidence survives without granting screening rights',async()=>withOwner(randomUUID(),async()=>{
 const catalogue=['good-a','bad','good-c'].map(id=>({id,title:id,author:'Writer',stock:3,tags:['art'],hiddenGem:true}));
 const run=await createRun({catalogue,selectedGenres:[],matches:{},preferences:{curatorTypes:['listening','cinema']},constraints:{...defaultConstraints}},{
  async resolveBook(book){return{resolution:{bookId:book.id,status:'confirmed',entityId:book.id,candidates:[]},tags:[]};},
  async recommend(bookId,_id,type){if(bookId==='bad')throw new QlooContextError();return{edges:[.5,.7,.9].map((affinity,i):Evidence=>({id:`${bookId}-${type}-${i}`,bookId,entityId:`${type}-${i}`,name:`Candidate ${i}`,type,affinity,popularity:.5,context:`${bookId}:${type}`,active:true,retrievedAt:new Date().toISOString(),request:{endpoint:'/v2/insights',query:{}}}))};}
 });
 assert.equal(run.warnings.length,2);assert.ok(run.edges.some(edge=>edge.type==='movie'));assert.ok(!run.edges.some(edge=>edge.bookId==='bad'));assert.ok(run.selected.length);
 assert.ok(run.selected.every(id=>run.proposals.find(event=>event.id===id)!.curator==='listening'));assert.equal(run.trace!.filter(event=>event.phase==='tool'&&event.status==='unverified').length,2);
}));
