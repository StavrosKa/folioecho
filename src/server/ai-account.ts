import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { hosted,owner } from './context.ts';
import { get,put,remove,counter } from './store.ts';
import { personalKey,savePersonalKey } from './key-vault.ts';
import { day,readUsage,ratesFor,modelRates,type BillingMode } from './ai-usage.ts';
interface Preferences {mode:BillingMode;model:string;dailyBudget:number}
export function modelConfiguration():{key:string;model:string} {
  let saved:any={}; if(!hosted())try{saved=JSON.parse(readFileSync(path.join(homedir(),'.folioecho','openai.json'),'utf8'));}catch{}
  return {key:process.env.OPENAI_API_KEY??saved.apiKey??'',model:process.env.OPENAI_MODEL??saved.model??''};
}
export async function effectiveConfiguration() {
  const prefs=await get<Preferences>('ai-preferences','active');
  if(prefs?.mode==='personal') {
    const saved=await personalKey();
    return {key:saved?.key??'',model:prefs.model,mode:'personal' as const,dailyBudget:prefs.dailyBudget,expires:saved?.expires??null,limit:100};
  }
  const amount=Number(process.env.FOLIOECHO_DEMO_DAILY_USD??.05);
  return {...modelConfiguration(),mode:'demo' as const,dailyBudget:Number.isFinite(amount)&&amount>0?amount:.05,expires:null,limit:5};
}
export async function modelStatus() {
  const config=await effectiveConfiguration();
  return {provider:'OpenAI',configured:!!config.key&&!!config.model,hosted:hosted(),mode:config.mode};
}
export async function accountStatus() {
  const config=await effectiveConfiguration(),usage=await readUsage(config.mode);
  const qloo=await counter(`plans:${owner()}:${day()}`);
  const costKnown=!!ratesFor(config.model)&&usage.unpriced===0;
  return {provider:'OpenAI',configured:!!config.key&&!!config.model,hosted:hosted(),mode:config.mode,model:config.model,expires:config.expires,
    personalStored:!!await get('openai-key','active'),supportedModels:Object.keys(modelRates),period:day(),resetAt:new Date(new Date(day()).getTime()+86400_000).toISOString(),
    usage:{...usage,requestLimit:config.limit,requestPercent:Math.min(100,100*usage.attempts/config.limit),dailyBudget:config.dailyBudget,
      costPercent:costKnown?100*usage.estimatedUsd/config.dailyBudget:null,costKnown,pricesAsOf:'2026-10-29'},
    qloo:{plans:qloo,limit:6,percent:Math.min(100,100*qloo/6)}};
}
export async function changeAccount(body:any) {
  if(body.action==='demo') {await put('ai-preferences','active',{mode:'demo'});return;}
  if(body.action==='remove') {await remove('openai-key','active');await put('ai-preferences','active',{mode:'demo'});return;}
  if(body.action!=='connect')throw new Error('Unknown settings action.');
  const key=typeof body.key==='string'?body.key.trim():'';
  if(!/^sk-[A-Za-z0-9_-]{17,509}$/.test(key))throw new Error('Enter a valid OpenAI secret key.');
  if(key.startsWith('sk-admin'))throw new Error('Use a project API key, not an organization Admin key.');
  if(typeof body.model!=='string'||!ratesFor(body.model))throw new Error('Choose a supported model for usage and cost tracking.');
  if(!Number.isFinite(body.dailyBudget)||body.dailyBudget<.01||body.dailyBudget>100)throw new Error('Choose a daily app allowance between $0.01 and $100.');
  if(body.consent!==true)throw new Error('Confirm that FolioEcho may use this key for your AI requests.');
  await savePersonalKey(key);
  await put('ai-preferences','active',{mode:'personal',model:body.model,dailyBudget:body.dailyBudget});
}
