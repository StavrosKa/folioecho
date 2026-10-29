import { createCipheriv,createDecipheriv,hkdfSync,randomBytes } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import path from 'node:path';
import { hosted,owner } from './context.ts';
import { get,put,remove } from './store.ts';
interface SealedKey { iv:string; tag:string; ciphertext:string; expires:number }
function encryptionKey() {
  let secret=process.env.FOLIOECHO_SESSION_SECRET;
  if(!secret || secret.length<32) {
    if(hosted()) throw new Error('Private key storage has not been configured by the host.');
    const directory=process.env.FOLIOECHO_DATA_DIR ?? path.resolve('.folioecho');
    mkdirSync(directory,{recursive:true}); const file=path.join(directory,'key-encryption.key');
    try { secret=readFileSync(file,'utf8'); } catch { const candidate=randomBytes(32).toString('hex'); try { writeFileSync(file,candidate,{mode:0o600,flag:'wx'}); } catch { /* Another process created the local key. */ } secret=readFileSync(file,'utf8'); }
  }
  return Buffer.from(hkdfSync('sha256',secret,'folioecho-v1','personal-openai-key-encryption',32));
}
export async function savePersonalKey(key:string) {
  const expires=Date.now()+86400_000;
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from(`${owner()}:${expires}`));
  const ciphertext=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  const record:SealedKey={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64'),expires};
  await put('openai-key','active',record);return record.expires;
}
export async function personalKey():Promise<{key:string;expires:number}|undefined> {
  const record=await get<SealedKey>('openai-key','active'); if(!record)return;
  if(record.expires<=Date.now()){await remove('openai-key','active');return;}
  try {
    const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(record.iv,'base64'));
    decipher.setAAD(Buffer.from(`${owner()}:${record.expires}`));decipher.setAuthTag(Buffer.from(record.tag,'base64'));
    return {key:Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8'),expires:record.expires};
  } catch { throw new Error('The personal key cannot be opened. Remove it and reconnect. Demo billing was not used.'); }
}
