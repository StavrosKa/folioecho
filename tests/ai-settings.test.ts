import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withOwner } from '../src/server/context.ts';
import { get,put } from '../src/server/store.ts';
import { personalKey } from '../src/server/key-vault.ts';
import { changeAccount,accountStatus,effectiveConfiguration } from '../src/server/ai-account.ts';
import { measuredCost,modelRates,readUsage } from '../src/server/ai-usage.ts';
import { structuredModel,objectSchema } from '../src/server/openai.ts';
import { POST as settingsPost } from '../src/pages/api/ai-settings.ts';
const fixtureKey=()=> 'sk-'+('fixture-only-').repeat(4);
const connect=(key=fixtureKey(),dailyBudget=1)=>({action:'connect',key,model:'gpt-6-luna',dailyBudget,consent:true});
function response(usage:any,status='completed') {return new Response(JSON.stringify({status,usage,output:[{type:'message',content:[{type:'output_text',text:'{"title":"A reading evening"}'}]}]}));}
const usage={input_tokens:1000,input_tokens_details:{cached_tokens:200,cache_write_tokens:100},output_tokens:500};

test('personal key is encrypted, absent from status, owner-bound and deleted on request',async()=>{
 const a=randomUUID(),b=randomUUID(),key=fixtureKey();let sealed:any;
 await withOwner(a,async()=>{
  await changeAccount(connect(key));sealed=await get('openai-key','active');
  assert.ok(sealed.ciphertext);assert.ok(!JSON.stringify(sealed).includes(key));assert.equal((await personalKey())?.key,key);
  const status=await accountStatus();assert.equal(status.mode,'personal');assert.ok(!JSON.stringify(status).includes(key));assert.ok(!JSON.stringify(status).includes(sealed.ciphertext));
 });
 await withOwner(b,async()=>{assert.equal(await personalKey(),undefined);await put('openai-key','active',sealed);await assert.rejects(personalKey(),/cannot be opened/);});
 await withOwner(a,async()=>{await changeAccount({action:'remove'});assert.equal(await get('openai-key','active'),undefined);assert.equal((await accountStatus()).mode,'demo');});
});
test('expired personal key cannot silently fall back to the sponsored demo',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect());const sealed:any=await get('openai-key','active');sealed.expires=Date.now()-1;await put('openai-key','active',sealed);
 const config=await effectiveConfiguration();assert.equal(config.mode,'personal');assert.equal(config.key,'');assert.equal(await get('openai-key','active'),undefined);
 let calls=0;await assert.rejects(structuredModel('test',{},'',{},(async()=>{calls++;return response(usage);}) as typeof fetch),/Reconnect/);assert.equal(calls,0);
}));
test('reported tokens price cached input separately and unknown usage never becomes a fake zero',()=>{
 const result=measuredCost(usage,modelRates['gpt-6-luna'])!;assert.equal(result.input,1000);assert.equal(result.output,500);assert.ok(Math.abs(result.usd!-.000347)<1e-10);
 assert.equal(measuredCost({input_tokens:1000,output_tokens:500},modelRates['gpt-6-luna'])?.usd,null);
 assert.equal(measuredCost(undefined,modelRates['gpt-6-luna']),null);
 assert.equal(measuredCost({...usage,input_tokens:-1},modelRates['gpt-6-luna']),null);
});
test('personal model usage is measured and stays separate from demo allowance after a mode switch',async()=>withOwner(randomUUID(),async()=>{
 const key=fixtureKey();await changeAccount(connect(key));
 const transport=(async(_url:any,options:any)=>{assert.equal(options.headers.Authorization,'Bearer '+key);assert.ok(!options.body.includes(key));return response(usage);}) as typeof fetch;
 await structuredModel('test',objectSchema({title:{type:'string'}}),'Write a title.',{},transport);
 const personal=await accountStatus();assert.equal(personal.usage.attempts,1);assert.equal(personal.usage.completed,1);assert.equal(personal.usage.inputTokens,1000);assert.equal(personal.usage.outputTokens,500);assert.equal(personal.usage.pendingUsd,0);assert.ok(personal.usage.costPercent!>0);
 await changeAccount({action:'demo'});assert.equal((await accountStatus()).usage.attempts,0);
 await changeAccount(connect(key));assert.equal((await accountStatus()).usage.attempts,1);
}));
test('incomplete model output still records token costs and failures never use the host key',async()=>withOwner(randomUUID(),async()=>{
 const key=fixtureKey();await changeAccount(connect(key));
 await assert.rejects(structuredModel('test',{},'',{},(async()=>response(usage,'incomplete')) as typeof fetch),/did not complete/);
 assert.ok((await readUsage('personal')).estimatedUsd>0);
 let calls=0;await assert.rejects(structuredModel('test',{},'',{},(async(_url:any,options:any)=>{calls++;assert.equal(options.headers.Authorization,'Bearer '+key);return new Response('private diagnostics',{status:401});}) as typeof fetch),/401/);assert.equal(calls,1);
 assert.equal((await readUsage('personal')).unpriced,0);
}));
test('oversized request cost reservation stops before a provider call and timeout keeps an unknown charge reserved',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect(fixtureKey(),.01));let calls=0;
 await assert.rejects(structuredModel('test',{},'','x'.repeat(100000),(async()=>{calls++;return response(usage);}) as typeof fetch),/remaining estimated/);assert.equal(calls,0);
 await assert.rejects(structuredModel('test',{},'',{},(async()=>{throw new Error('simulated network timeout');}) as typeof fetch),/timeout/);
 const status=await accountStatus();assert.equal(status.usage.unpriced,1);assert.equal(status.usage.costPercent,null);assert.ok(status.usage.pendingUsd>0);
}));
test('settings require same-origin writes and explicit consent, and do not echo submitted keys',async()=>withOwner(randomUUID(),async()=>{
 const url=new URL('http://127.0.0.1:4321/api/ai-settings');
 const request=(body:any,origin=url.origin)=>({url,request:new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})});
 assert.equal((await settingsPost(request(connect(),'https://other.example') as any) as Response).status,403);
 const rejected=await settingsPost(request({...connect(),consent:false}) as any) as Response;assert.equal(rejected.status,400);assert.ok(!(await rejected.text()).includes(fixtureKey()));
 const saved=await settingsPost(request(connect()) as any) as Response;assert.equal(saved.status,200);assert.ok(!(await saved.text()).includes(fixtureKey()));
}));
test('daily demo request cap is per visitor and cannot be reset by changing billing mode',async()=>{
 const previousKey=process.env.OPENAI_API_KEY,previousModel=process.env.OPENAI_MODEL;
 process.env.OPENAI_API_KEY=fixtureKey();process.env.OPENAI_MODEL='gpt-6-luna';
 try{
  await withOwner(randomUUID(),async()=>{
   let calls=0;const transport=(async()=>{calls++;return response(usage);}) as typeof fetch;
   for(let i=0;i<5;i++)await structuredModel('test',{},'',{},transport);
   const status=await accountStatus();assert.equal(status.usage.requestPercent,100);assert.equal(status.usage.requestLimit,5);
   await assert.rejects(structuredModel('test',{},'',{},transport),/allowance/);assert.equal(calls,5);
   await changeAccount(connect());await changeAccount({action:'demo'});
   await assert.rejects(structuredModel('test',{},'',{},transport),/allowance/);assert.equal(calls,5);
  });
  await withOwner(randomUUID(),async()=>assert.equal((await accountStatus()).usage.attempts,0));
 }finally{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;if(previousModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=previousModel;}
});
