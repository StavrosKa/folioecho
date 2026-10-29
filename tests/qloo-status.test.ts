import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { qlooConfigured } from '../src/server/qloo-status.ts';
import { GET } from '../src/pages/api/qloo-status.ts';
import { put } from '../src/server/store.ts';
import { withOwner } from '../src/server/context.ts';

async function fixture(work:(file:string,key:string)=>Promise<void>){
 const previous={key:process.env.QLOO_API_KEY,home:process.env.QLOO_HOME,hosted:process.env.FOLIOECHO_HOSTED};
 const directory=process.env.FOLIOECHO_DATA_DIR!;mkdirSync(directory,{recursive:true});
 const root=mkdtempSync(path.join(directory,'qloo-status-'));
 process.env.QLOO_HOME=root;delete process.env.QLOO_API_KEY;process.env.FOLIOECHO_HOSTED='0';
 try{await work(path.join(root,'config'),'synthetic-private-fixture');}
 finally{for(const [name,value] of [['QLOO_API_KEY',previous.key],['QLOO_HOME',previous.home],['FOLIOECHO_HOSTED',previous.hosted]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value;}}
}
test('Qloo configuration status follows private CLI/env configuration without treating configuration as authentication',async()=>fixture(async(file,key)=>{
 assert.equal(qlooConfigured(),false);
 writeFileSync(file,`# private test config\napi_key="${key}"\n`);assert.equal(qlooConfigured(),true);
 writeFileSync(file,JSON.stringify({api_key:key}));assert.equal(qlooConfigured(),true);
 process.env.FOLIOECHO_HOSTED='1';assert.equal(qlooConfigured(),false);
 process.env.QLOO_API_KEY=key;assert.equal(qlooConfigured(),true);
 process.env.FOLIOECHO_HOSTED='0';delete process.env.QLOO_API_KEY;
 for(const content of ['api_key=""','api_key=   ','{invalid json',JSON.stringify({api_key:[]})]){writeFileSync(file,content);assert.equal(qlooConfigured(),false);}
}));
test('Overview status does not call Qloo, expose credentials or leak another visitor’s evidence',async()=>fixture(async(file,key)=>{
 writeFileSync(file,`api_key=${key}\n`);
 const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('Network not allowed in status');}) as typeof fetch;
 const status=async()=>{const url=new URL('http://127.0.0.1:4321/api/qloo-status');const response=await GET({url,request:new Request(url)} as any) as Response;assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes(key));return JSON.parse(text);};
 try{
 const a=randomUUID(),b=randomUUID();
 await withOwner(a,async()=>{assert.deepEqual(await status(),{configured:true,evidenceAvailable:false});await put('run','fixture',{edges:[{active:true,affinity:.8}]});assert.deepEqual(await status(),{configured:true,evidenceAvailable:true});});
 await withOwner(b,async()=>assert.deepEqual(await status(),{configured:true,evidenceAvailable:false}));
 assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
}));
