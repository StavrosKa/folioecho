// Credentials are opaque. Check only transport-safe syntax and bounded size;
// the provider validates authenticity on an explicitly requested operation.
// Google now issues auth keys as well as legacy standard keys.
export function plausibleGeminiKey(value: string): boolean {
  return value.length >= 20 && value.length <= 4096
    && !value.startsWith('sk-')
    && /^[A-Za-z0-9._~+\/-]+=*$/.test(value)
    && !repeatedCredential(value);
}
function repeatedCredential(value:string):boolean {
  for(let copies=2;copies<=8;copies++){
    if(value.length%copies===0&&value.length/copies>=20&&value.slice(0,value.length/copies).repeat(copies)===value)return true;
  }
  return false;
}
