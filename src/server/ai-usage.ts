import { get,put } from './store.ts';
export const day=()=>new Date().toISOString().slice(0,10);
export type BillingMode='demo'|'personal';
export interface Rates {input:number;cached:number;output:number;write:number}
// Standard, short-context USD / 1M tokens. Verified 2026-10-29.
// https://developers.openai.com/api/docs/pricing
// https://developers.openai.com/api/docs/models/gpt-4.1-mini
export const modelRates:Record<string,Rates>={
  'gpt-6-luna':{input:.1,cached:.01,output:.5,write:.25},
  'gpt-6.1-terra':{input:1,cached:.05,output:5,write:2.5},
  'gpt-6.1-sol':{input:2,cached:.1,output:10,write:5},
  'gpt-6-astra':{input:10,cached:1,output:50,write:25},
  'gpt-4.1-mini':{input:.4,cached:.1,output:1.6,write:.4},
};
export const ratesFor=(model:string)=>modelRates[model.replace(/-\d{4}-\d{2}-\d{2}$/,'')];
export interface Usage {attempts:number;completed:number;inputTokens:number;outputTokens:number;cachedTokens:number;estimatedUsd:number;unpriced:number;pendingUsd:number}
const empty=():Usage=>({attempts:0,completed:0,inputTokens:0,outputTokens:0,cachedTokens:0,estimatedUsd:0,unpriced:0,pendingUsd:0});
export const readUsage=async(mode:BillingMode,date=day())=>(await get<Usage>('ai-usage',`${mode}:${date}`))??empty();
export const writeUsage=async(mode:BillingMode,usage:Usage,date=day())=>put('ai-usage',`${mode}:${date}`,usage);
export function measuredCost(raw:any,rates?:Rates) {
  const integer=(x:any)=>Number.isSafeInteger(x)&&x>=0;
  if(!raw || !integer(raw.input_tokens)||!integer(raw.output_tokens))return null;
  const cached=raw.input_tokens_details?.cached_tokens,write=raw.input_tokens_details?.cache_write_tokens ?? 0;
  const known=integer(cached)&&integer(write)&&cached+write<=raw.input_tokens;
  return {input:raw.input_tokens,output:raw.output_tokens,cached:known?cached:0,
    usd:rates&&known?((raw.input_tokens-cached-write)*rates.input+cached*rates.cached+write*rates.write+raw.output_tokens*rates.output)/1e6:null};
}
export function reserveCost(payload:string,rates:Rates) {
  // UTF-8 bytes plus format overhead conservatively reserve input tokens; no
  // visible-text character estimate is presented as measured provider usage.
  return ((Buffer.byteLength(payload,'utf8')+4096)*Math.max(rates.input,rates.write)+4000*rates.output)/1e6;
}
