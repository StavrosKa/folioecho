import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { hosted } from './context.ts';

// Read configuration only; never send a probe or return credential material.
export function qlooConfigured():boolean {
  if(process.env.QLOO_API_KEY?.trim())return true;
  if(hosted())return false;
  try {
    const home=homedir(),configured=process.env.QLOO_HOME?.trim();
    const root=configured?path.resolve(configured==='~'?home:configured.startsWith('~/')||configured.startsWith('~\\')?path.join(home,configured.slice(2)):configured):path.join(home,'.qloo');
    if(root===path.resolve(home)||root===path.parse(root).root)return false;
    const raw=readFileSync(path.join(root,'config'),'utf8').trim();
    if(raw.startsWith('{')){const value=JSON.parse(raw);return typeof value?.api_key==='string'&&!!value.api_key.trim();}
    let key='';
    for(const line of raw.split(/\r?\n/)){
      const candidate=line.trim();if(!candidate||candidate.startsWith('#'))continue;
      const separator=candidate.indexOf('=');if(separator<0||candidate.slice(0,separator).trim()!=='api_key')continue;
      key=candidate.slice(separator+1).trim();
      if(key.length>=2&&((key.startsWith('"')&&key.endsWith('"'))||(key.startsWith("'")&&key.endsWith("'"))))key=key.slice(1,-1);
    }
    return !!key.trim();
  }catch{return false;}
}
