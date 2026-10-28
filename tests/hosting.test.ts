import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withOwner, owner } from '../src/server/context.ts';
import { put, get, latest, consume, acquire, release } from '../src/server/store.ts';
import { visitor, sign, validSignature } from '../src/server/session.ts';
import { readJob } from '../src/server/jobs.ts';
import { hostedSearch, hostedRecommend, qlooRequest } from '../src/server/qloo-http.ts';

test('parallel visitor contexts isolate workspaces, runs, entity choices and jobs',async () => {
  const a=randomUUID(),b=randomUUID(),id=randomUUID();
  await Promise.all([withOwner(a,async()=>{
    await put('workspace','local',{shop:'A'}); await put('run',id,{revision:1}); await put('entity-choice',id,'chosen');
    await put('job',id,{id,status:'done',body:{private:'input'},lease:'private-token'});
    assert.equal(owner(),a);
  }),withOwner(b,async()=>{ await put('workspace','local',{shop:'B'}); assert.equal(await get('run',id),undefined); assert.equal(await readJob(id),undefined); })]);
  await withOwner(a,async()=>{
    assert.deepEqual(await latest('workspace'),{shop:'A'});
    const job=await readJob(id); assert.ok(job); assert.ok(!('body' in job)); assert.ok(!('lease' in job));
  });
  await withOwner(b,async()=>{ assert.deepEqual(await latest('workspace'),{shop:'B'}); assert.equal(await get('entity-choice',id),undefined); });
});
test('counter cap and leases reject competing workers and allow token-safe release',async()=>{
  const id=randomUUID(); const results=await Promise.all(Array.from({length:8},()=>consume(id,3)));
  assert.equal(results.filter(Boolean).length,3);
  assert.equal(await acquire(id,'first'),true); assert.equal(await acquire(id,'second'),false);
  await release(id,'wrong'); assert.equal(await acquire(id,'second'),false);
  await release(id,'first'); assert.equal(await acquire(id,'second'),true); await release(id,'second');
});
test('visitor cookie rejects tampering and expiration; worker signatures bind the full payload',()=>{
  const previous=process.env.FOLIOECHO_SESSION_SECRET; process.env.FOLIOECHO_SESSION_SECRET='test-only-secret-at-least-thirty-two-characters';
  try {
    const a=visitor(); assert.equal(visitor(a.cookie).id,a.id); assert.equal(visitor(a.cookie).fresh,false);
    assert.notEqual(visitor(a.cookie+'changed').id,a.id);
    const expired=`${a.id}.${Date.now()-1}`; assert.notEqual(visitor(`${expired}.${sign(expired)}`).id,a.id);
    const signature=sign('job-a'); assert.equal(validSignature('job-a',signature),true); assert.equal(validSignature('job-b',signature),false);
  } finally { if(previous===undefined) delete process.env.FOLIOECHO_SESSION_SECRET; else process.env.FOLIOECHO_SESSION_SECRET=previous; }
});
test('hosted Qloo transport preserves returned affinities and the exact evidence query',async()=>{
  const key=process.env.QLOO_API_KEY, original=globalThis.fetch;
  process.env.QLOO_API_KEY='synthetic-test-key-not-a-real-credential';
  const requests:URL[]=[];
  globalThis.fetch=(async(input:any,options:any)=>{
    const url=new URL(String(input)); requests.push(url); assert.equal(options.headers['X-Api-Key'],process.env.QLOO_API_KEY);
    return new Response(JSON.stringify(url.pathname==='/search'?{results:[{entity_id:'fixture',name:'Fixture',types:['urn:entity:book']}]}:{results:{entities:[{entity_id:'fixture-artist',name:'Artist',subtype:'urn:entity:artist',query:{affinity:.73}}]}}));
  }) as typeof fetch;
  try {
    assert.equal((await hostedSearch('Book & author'))[0].entity_id,'fixture');
    const result=await hostedRecommend('fixture','artist',10); assert.equal(result.results[0].affinity,.73);
    assert.equal(requests[1].searchParams.get('filter.type'),'urn:entity:artist'); assert.equal(requests[1].searchParams.get('signal.interests.entities'),'fixture');
    assert.equal(result.provenance.requests[0].query.take,10);
    await assert.rejects(qlooRequest('/search',{},(async()=>new Response('forbidden',{status:403})) as typeof fetch),/Qloo request failed/);
  } finally { globalThis.fetch=original; if(key===undefined) delete process.env.QLOO_API_KEY; else process.env.QLOO_API_KEY=key; }
});
