import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { hosted,owner } from './context.ts';
import { get,put,remove,counter } from './store.ts';
import { personalKey,savePersonalKey } from './key-vault.ts';
import { plausibleGeminiKey } from '../lib/api-key.ts';
import { day,readUsage,providerRates,modelRates,type BillingMode } from './ai-usage.ts';
import { defaultGeminiModel,geminiRates,isProvider,providerLabel,type AIProvider,type BillingTier } from './ai-providers.ts';
interface Preferences {mode:BillingMode;provider?:AIProvider;model:string;dailyBudget:number;billingTier?:BillingTier}
export const modelsByProvider={openai:Object.keys(modelRates),gemini:Object.keys(geminiRates)};
export function modelConfiguration():{key:string;model:string} {
  let saved:any={}; if(!hosted())try{saved=JSON.parse(readFileSync(path.join(homedir(),'.folioecho','openai.json'),'utf8'));}catch{}
  return {key:process.env.OPENAI_API_KEY??saved.apiKey??'',model:process.env.OPENAI_MODEL??saved.model??''};
}
function geminiConfiguration(){
  let saved:any={};if(!hosted())try{saved=JSON.parse(readFileSync(path.join(homedir(),'.folioecho','gemini.json'),'utf8'));}catch{}
  const tier=process.env.GEMINI_BILLING_TIER??saved.billingTier;
  return {key:process.env.GEMINI_API_KEY??process.env.GOOGLE_API_KEY??saved.apiKey??'',model:process.env.GEMINI_MODEL??saved.model??defaultGeminiModel,billingTier:(tier==='free'||tier==='paid'?tier:'unknown') as BillingTier};
}
export async function effectiveConfiguration() {
  const prefs=await get<Preferences>('ai-preferences','active');
  if(prefs?.mode==='personal') {
    const provider=prefs.provider??'openai',saved=await personalKey(provider);
    return {key:saved?.key??'',provider,model:prefs.model,mode:'personal' as const,billingTier:prefs.billingTier??'unknown',dailyBudget:prefs.dailyBudget,expires:saved?.expires??null,limit:100};
  }
  const amount=Number(process.env.FOLIOECHO_DEMO_DAILY_USD??.05);
  return {...geminiConfiguration(),provider:'gemini' as const,mode:'demo' as const,dailyBudget:Number.isFinite(amount)&&amount>0?amount:.05,expires:null,limit:10};
}
export async function modelStatus() {
  const config=await effectiveConfiguration();
  return {provider:config.provider,providerLabel:providerLabel(config.provider),configured:!!config.key&&!!providerRates(config.provider,config.model),hosted:hosted(),mode:config.mode};
}
export async function accountStatus() {
  const config=await effectiveConfiguration(),usage=await readUsage(config.mode,day(),config.provider);
  const qloo=await counter(`plans:${owner()}:${day()}`);
  const costKnown=!!providerRates(config.provider,config.model)&&usage.unpriced===0;
  const personalConnections=[];
  for(const provider of ['openai','gemini'] as const){
    const record=await get<{expires:number}>(`${provider}-key`,'active');
    if(record&&record.expires<=Date.now()){await remove(`${provider}-key`,'active');await remove('ai-connections',provider);continue;}
    if(record){const connection=await get<Preferences>('ai-connections',provider);personalConnections.push({provider,providerLabel:providerLabel(provider),model:connection?.model??(prefsModel(config,provider)),expires:record.expires});}
  }
  return {provider:config.provider,providerLabel:providerLabel(config.provider),configured:!!config.key&&!!providerRates(config.provider,config.model),hosted:hosted(),mode:config.mode,model:config.model,billingTier:config.billingTier,expires:config.expires,
    personalStored:personalConnections.length>0,personalConnections,modelsByProvider,supportedModels:modelsByProvider[config.provider],period:day(),resetAt:new Date(new Date(day()).getTime()+86400_000).toISOString(),
    usage:{...usage,requestLimit:config.limit,requestPercent:Math.min(100,100*usage.attempts/config.limit),dailyBudget:config.dailyBudget,
      costPercent:costKnown?100*usage.estimatedUsd/config.dailyBudget:null,costKnown,pricesAsOf:'2026-10-29'},
    qloo:{plans:qloo,limit:6,percent:Math.min(100,100*qloo/6)}};
}
function prefsModel(config:{provider:AIProvider;model:string},provider:AIProvider){return config.provider===provider?config.model:modelsByProvider[provider][0];}
export async function changeAccount(body:any) {
  // Preserve switchable metadata for OpenAI keys saved before provider selection existed.
  const previous=await get<Preferences>('ai-preferences','active');
  if(previous?.mode==='personal'&&!previous.provider)await put('ai-connections','openai',{...previous,provider:'openai',billingTier:'paid'});
  if(body.action==='demo') {await put('ai-preferences','active',{mode:'demo'});return;}
  const provider=body.provider??'openai';
  if(!isProvider(provider))throw new Error('Choose OpenAI or Gemini.');
  if(body.action==='remove') {
    await remove(`${provider}-key`,'active');await remove('ai-connections',provider);
    const prefs=await get<Preferences>('ai-preferences','active');
    if(prefs?.mode==='personal'&&(prefs.provider??'openai')===provider)await put('ai-preferences','active',{mode:'demo'});
    return;
  }
  if(body.action==='use-personal') {
    const saved=await personalKey(provider),connection=await get<Preferences>('ai-connections',provider);
    if(!saved||!connection)throw new Error('Reconnect this personal key. Demo billing was not used.');
    await put('ai-preferences','active',connection);return;
  }
  if(body.action!=='connect')throw new Error('Unknown settings action.');
  const key=typeof body.key==='string'?body.key.trim():'';
  if(!(provider==='openai'?/^sk-[A-Za-z0-9_-]{17,509}$/.test(key):plausibleGeminiKey(key)))throw new Error(`Enter a valid ${providerLabel(provider)} API key. Copy the complete key, not its name or masked ending.`);
  if(key.startsWith('sk-admin'))throw new Error('Use a project API key, not an organization Admin key.');
  if(typeof body.model!=='string'||!modelsByProvider[provider].includes(body.model))throw new Error('Choose a supported model for this provider.');
  if(!Number.isFinite(body.dailyBudget)||body.dailyBudget<.01||body.dailyBudget>100)throw new Error('Choose a daily app allowance between $0.01 and $100.');
  if(body.consent!==true)throw new Error('Confirm that FolioEcho may use this key for your AI requests.');
  const billingTier:BillingTier=provider==='gemini'?(body.billingTier??'unknown'):'paid';
  if(!['free','paid','unknown'].includes(billingTier))throw new Error('Choose a Gemini billing tier.');
  if(billingTier==='free'&&body.freeTierConfirmed!==true)throw new Error('Confirm that your Google project uses the Free tier.');
  await savePersonalKey(key,provider);
  const preferences:Preferences={mode:'personal',provider,model:body.model,dailyBudget:body.dailyBudget,billingTier};
  await put('ai-connections',provider,preferences);
  await put('ai-preferences','active',preferences);
}
