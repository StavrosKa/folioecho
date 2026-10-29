import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createCipheriv,hkdfSync,randomBytes } from 'node:crypto';
import { withOwner } from '../src/server/context.ts';
import { accountStatus,changeAccount,effectiveConfiguration,modelStatus } from '../src/server/ai-account.ts';
import { personalKey } from '../src/server/key-vault.ts';
import { get,put } from '../src/server/store.ts';
import { geminiUsage,measuredCost,providerRates } from '../src/server/ai-usage.ts';
import { structuredModel,structuredModelWithMetadata,objectSchema } from '../src/server/openai.ts';
import { POST as intelligencePost } from '../src/pages/api/intelligence.ts';
import { createRun } from '../src/server/planner.ts';
import { defaultConstraints,type Evidence } from '../src/lib/curator.ts';
const key='AIza'+('fixture-only-').repeat(3);
const openaiKey='sk-'+('fixture-only-').repeat(4);
const connect=(billingTier='paid')=>({action:'connect',provider:'gemini',key,model:'gemini-3.5-flash-lite',dailyBudget:1,consent:true,billingTier,freeTierConfirmed:billingTier==='free'});
const tokens={promptTokenCount:1000,cachedContentTokenCount:200,candidatesTokenCount:300,thoughtsTokenCount:200,totalTokenCount:1500};
function response(finishReason='STOP',usageMetadata:any=tokens,text=JSON.stringify({title:'An evening'})) {return new Response(JSON.stringify({candidates:[{finishReason,content:{parts:[{thought:true,text:'Internal reasoning'},{text}]}}],usageMetadata}));}

test('Gemini uses a fixed endpoint, header-only credential, JSON schema and actual-provider metadata',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect());
 const schema=objectSchema({title:{type:'string'}});
 const transport=(async(url:any,options:any)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(options.headers['x-goog-api-key'],key);assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'error');
  assert.ok(!options.body.includes(key));assert.ok(!url.includes(key));
  const body=JSON.parse(options.body);assert.equal(body.generationConfig.maxOutputTokens,4000);assert.deepEqual(body.generationConfig.responseFormat.text.schema,schema);assert.equal(body.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');assert.equal(body.generationConfig.responseJsonSchema,undefined);assert.equal(body.tools,undefined);
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),[{title:'Public book'}]);return response();
 }) as typeof fetch;
 assert.deepEqual(await structuredModelWithMetadata('test',schema,'Use supplied records.',[{title:'Public book'}],transport),{data:{title:'An evening'},provider:'Gemini',model:'gemini-3.5-flash-lite'});
 const status=await accountStatus();assert.equal(status.usage.inputTokens,1000);assert.equal(status.usage.outputTokens,500);assert.equal(status.usage.completed,1);assert.equal(status.usage.pendingUsd,0);assert.ok(status.usage.estimatedUsd>0);
}));

test('Gemini accounts for thinking, validates counts, and uses zero rates only for an explicitly declared free tier',()=>{
 const raw=geminiUsage(tokens)!;assert.equal(raw.output_tokens,500);
 assert.ok(Math.abs(measuredCost(raw,providerRates('gemini','gemini-3.5-flash-lite','paid'))!.usd!-.001496)<1e-10);
 assert.equal(measuredCost(raw,providerRates('gemini','gemini-3.5-flash-lite','free'))!.usd,0);
 assert.equal(geminiUsage(undefined),undefined);assert.equal(geminiUsage({...tokens,totalTokenCount:900}),undefined);assert.equal(geminiUsage({...tokens,thoughtsTokenCount:600}),undefined);
 assert.equal(geminiUsage({...tokens,toolUsePromptTokenCount:1}),undefined);
 assert.equal(providerRates('gemini','gpt-6-luna'),undefined);assert.equal(providerRates('openai','gemini-3.5-flash-lite'),undefined);
});

test('both personal providers remain encrypted, isolated and independently selectable/deletable',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount({action:'connect',provider:'openai',key:openaiKey,model:'gpt-6-luna',dailyBudget:1,consent:true});
 await changeAccount(connect());
 let status=await accountStatus();assert.equal(status.personalConnections.length,2);assert.ok(!JSON.stringify(status).includes(key));assert.ok(!JSON.stringify(status).includes(openaiKey));
 assert.equal((await personalKey('gemini'))?.key,key);assert.equal((await personalKey('openai'))?.key,openaiKey);
 const sealed:any=await get('gemini-key','active');assert.ok(!JSON.stringify(sealed).includes(key));
 await put('openai-key','active',sealed);await assert.rejects(personalKey('openai'),/cannot be opened/);
 await changeAccount({action:'remove',provider:'openai'});assert.equal((await effectiveConfiguration()).provider,'gemini');
 await changeAccount({action:'demo'});await changeAccount({action:'use-personal',provider:'gemini'});assert.equal((await effectiveConfiguration()).key,key);
 await changeAccount({action:'remove',provider:'gemini'});assert.equal(await personalKey('gemini'),undefined);assert.equal((await accountStatus()).mode,'demo');
}));

test('legacy owner-bound OpenAI ciphertext still decrypts but cannot be copied into Gemini storage',async()=>{
 const previous=process.env.FOLIOECHO_SESSION_SECRET;process.env.FOLIOECHO_SESSION_SECRET='fixture-secret-'.repeat(4);
 try{const id=randomUUID();await withOwner(id,async()=>{
  const expires=Date.now()+100000,iv=randomBytes(12),derived=Buffer.from(hkdfSync('sha256',process.env.FOLIOECHO_SESSION_SECRET!,'folioecho-v1','personal-openai-key-encryption',32));
  const cipher=createCipheriv('aes-256-gcm',derived,iv);cipher.setAAD(Buffer.from(`${id}:${expires}`));const ciphertext=Buffer.concat([cipher.update(openaiKey),cipher.final()]);
  const record={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64'),expires};
  await put('openai-key','active',record);assert.equal((await personalKey('openai'))?.key,openaiKey);
  await put('gemini-key','active',record);await assert.rejects(personalKey('gemini'),/cannot be opened/);
 });}finally{if(previous===undefined)delete process.env.FOLIOECHO_SESSION_SECRET;else process.env.FOLIOECHO_SESSION_SECRET=previous;}
});

test('demo always selects Gemini and missing Gemini never falls back to a host OpenAI key',async()=>{
 const previous={gemini:process.env.GEMINI_API_KEY,google:process.env.GOOGLE_API_KEY,openai:process.env.OPENAI_API_KEY};
 process.env.GEMINI_API_KEY='';delete process.env.GOOGLE_API_KEY;process.env.OPENAI_API_KEY=openaiKey;
 try{await withOwner(randomUUID(),async()=>{assert.equal((await modelStatus()).provider,'gemini');assert.equal((await modelStatus()).configured,false);let calls=0;await assert.rejects(structuredModel('test',{},'',{},(async()=>{calls++;return response();}) as typeof fetch),/configured Gemini/);assert.equal(calls,0);});
 process.env.GEMINI_API_KEY=key;await withOwner(randomUUID(),async()=>{assert.equal((await effectiveConfiguration()).key,key);assert.equal((await modelStatus()).configured,true);});
 }finally{for(const [name,value] of [['GEMINI_API_KEY',previous.gemini],['GOOGLE_API_KEY',previous.google],['OPENAI_API_KEY',previous.openai]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value;}}
});

test('Gemini failures are charged only from reported usage; no retry, fallback or raw error disclosure',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect());
 for(const finish of ['MAX_TOKENS','SAFETY'])await assert.rejects(structuredModel('test',{},'',{},(async()=>response(finish)) as typeof fetch),/did not complete/);
 assert.equal((await accountStatus()).usage.completed,0);assert.ok((await accountStatus()).usage.estimatedUsd>0);
 let calls=0;await assert.rejects(structuredModel('test',{},'',{},(async()=>{calls++;return new Response(key,{status:429});}) as typeof fetch),error=>error instanceof Error&&error.message.includes('429')&&!error.message.includes(key));assert.equal(calls,1);
 await assert.rejects(structuredModel('test',{},'',{},(async()=>{throw new Error(key);}) as typeof fetch),error=>error instanceof Error&&!error.message.includes(key));
 const status=await accountStatus();assert.equal(status.usage.unpriced,1);assert.ok(status.usage.pendingUsd>0);assert.equal(status.usage.costPercent,null);
}));

test('editorial routes preserve actual Gemini provenance without changing Qloo scores or hard constraints',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect());
 const catalogue=['a','b','c'].map(id=>({id,title:`Book ${id}`,author:`Author ${id}`,stock:5,tags:[id],hiddenGem:true}));
 const run=await createRun({catalogue,selectedGenres:[],matches:{},preferences:{curatorTypes:['listening']},constraints:{...defaultConstraints}},{
  async resolveBook(book){return {resolution:{bookId:book.id,status:'confirmed',entityId:`fixture-${book.id}`,candidates:[]},tags:[]};},
  async recommend(bookId,_entityId,type){return {edges:[.6,.8].map((affinity,index):Evidence=>({id:`${bookId}:${index}`,bookId,entityId:`fixture-${bookId}-${index}`,name:`Candidate ${index}`,type,affinity,popularity:.5,context:`${bookId}:${type}`,retrievedAt:new Date().toISOString(),active:true,request:{endpoint:'/v2/insights',query:{'filter.type':type}}}))};}
 });
 await put('run',run.id,run);
 const original=globalThis.fetch;
 const post=async(action:string,revision:number)=>{
  const url=new URL('http://127.0.0.1:4321/api/intelligence');
  const request=new Request(url,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({action,runId:run.id,revision})});
  const result=await intelligencePost({request,url} as any) as Response;const data=await result.json();assert.equal(result.status,200,JSON.stringify(data));return data;
 };
 try{
  globalThis.fetch=(async()=>response('STOP',tokens,JSON.stringify({entries:run.selected.map(id=>({id,title:'Gemini evening',idea:'A conversation around these books.'}))}))) as typeof fetch;
  const narrated=(await post('narrate',run.revision)).run;
  const proposal=narrated.proposals.find((p:any)=>p.id===run.selected[0]);
  assert.equal(proposal.narrativeSource,'Gemini');assert.equal(proposal.narrativeModel,'gemini-3.5-flash-lite');assert.equal(proposal.score,run.proposals.find(p=>p.id===proposal.id)!.score);assert.deepEqual(narrated.input.constraints,run.input.constraints);
  globalThis.fetch=(async()=>response('STOP',tokens,JSON.stringify({events:[{title:'A baseline',idea:'Read and discuss.',bookIds:['a'],curator:'listening',duration:60,culturalReferences:['Unverified song']}]}))) as typeof fetch;
  const baseline=(await post('baseline',narrated.revision)).baseline;
  assert.equal(baseline.provider,'Gemini');assert.equal(baseline.model,'gemini-3.5-flash-lite');assert.match(baseline.source,/Gemini/);assert.equal(baseline.events[0].valid,true);assert.equal(baseline.metrics.externalEvidenceCoverage,0);
 }finally{globalThis.fetch=original;}
}));

test('Gemini free tier needs consent and missing usage remains unknown rather than a confirmed zero charge',async()=>withOwner(randomUUID(),async()=>{
 await assert.rejects(changeAccount({...connect('free'),freeTierConfirmed:false}),/Confirm/);
 await assert.rejects(changeAccount({...connect(),model:'gpt-6-luna'}),/supported model/);
 await assert.rejects(changeAccount({...connect(),key:openaiKey}),/valid Gemini/);
 await changeAccount(connect('free'));await structuredModel('test',{},'',{},(async()=>response()) as typeof fetch);
 assert.equal((await accountStatus()).usage.estimatedUsd,0);assert.equal((await accountStatus()).usage.costKnown,true);
 await structuredModel('test',{},'',{},(async()=>response('STOP',null)) as typeof fetch);
 assert.equal((await accountStatus()).usage.unpriced,1);assert.equal((await accountStatus()).usage.costPercent,null);
 const sealed:any=await get('gemini-key','active');sealed.expires=Date.now()-1;await put('gemini-key','active',sealed);
 assert.equal((await effectiveConfiguration()).key,'');assert.equal((await effectiveConfiguration()).mode,'personal');
}));

test('new Google auth keys are accepted without assuming the old AIza prefix or short length',async()=>withOwner(randomUUID(),async()=>{
 const authKey='AQ.'+('synthetic-fixture-only_').repeat(40);
 await changeAccount({...connect(),key:authKey});
 assert.equal((await personalKey('gemini'))?.key,authKey);
 const status=await accountStatus();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes(authKey));
 const transport=(async(_url:any,options:any)=>{assert.equal(options.headers['x-goog-api-key'],authKey);return response();}) as typeof fetch;
 await structuredModel('test',{},'',{},transport);
 for(const bad of ['...MmvQ','FolioEcho Demo',authKey+'\nextra',authKey+'"','x'.repeat(4097),authKey.repeat(2),authKey.repeat(3)])await assert.rejects(changeAccount({...connect(),key:bad}),/valid Gemini/);
}));

test('simplified Gemini decoding never bypasses the original response bounds or reports invalid output as completed',async()=>withOwner(randomUUID(),async()=>{
 await changeAccount(connect());
 const schema=objectSchema({tags:{type:'array',maxItems:2,items:{type:'string'}}});
 const transport=(async(_url:any,options:any)=>{
  const providerSchema=JSON.parse(options.body).generationConfig.responseFormat.text.schema;
  assert.equal(providerSchema.properties.tags.maxItems,undefined);
  assert.match(providerSchema.properties.tags.description,/At most 2/);
  return response('STOP',tokens,JSON.stringify({tags:['one','two','three']}));
 }) as typeof fetch;
 await assert.rejects(structuredModel('tags',schema,'Return tags.',{},transport),/failed validation/);
 const status=await accountStatus();assert.equal(status.usage.attempts,1);assert.equal(status.usage.completed,0);assert.equal(status.usage.inputTokens,1000);assert.ok(status.usage.estimatedUsd>0);assert.equal(status.usage.pendingUsd,0);
}));
