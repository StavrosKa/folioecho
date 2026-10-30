import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateDrafts} from '../src/server/workspace-validation.ts';
import {initialEvents,sampleBooks} from '../src/lib/workspace.ts';
import {parseCatalogue} from '../src/lib/catalogue.ts';
import {POST} from '../src/pages/api/workspace.ts';
import {withOwner} from '../src/server/context.ts';
import {get} from '../src/server/store.ts';

test('workspace rejects UI-breaking drafts atomically and preserves the previous valid workspace',async()=>withOwner(randomUUID(),async()=>{
 const body={books:sampleBooks,events:initialEvents,profile:{name:'Review',shop:'Shop',city:'Athens',email:''}};
 const save=async(value:unknown)=>{const url=new URL('http://127.0.0.1:4321/api/workspace');return await POST({url,request:new Request(url,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify(value)})} as any) as Response;};
 assert.equal((await save(body)).status,200);
 for(const change of [{date:null},{date:'2026-02-30'},{time:'25:00'},{capacity:-1},{id:''},{theme:{}},{source:{references:null}}]){
  assert.equal((await save({...body,events:[{...initialEvents[0],...change}]})).status,400);
  assert.deepEqual((await get<any>('workspace','local')).events,initialEvents);
 }
 assert.throws(()=>validateDrafts([initialEvents[0],initialEvents[0]]),/unique IDs/);
 validateDrafts([{...initialEvents[0],date:'',status:'Ready for owner review'}]);
}));

test('catalogue field limits reject oversized records without rejecting normal imports',()=>{
 assert.equal(parseCatalogue(sampleBooks).length,12);
 for(const change of [{title:'x'.repeat(301)},{author:'x'.repeat(201)},{id:'x'.repeat(201)},{tags:Array(65).fill('tag')},{tags:['x'.repeat(81)]},{stock:100001}]){
  assert.throws(()=>parseCatalogue([{...sampleBooks[0],...change}]),/field limits/);
 }
});
