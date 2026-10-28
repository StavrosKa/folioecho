import { consume } from './store.ts';
const endpoint='https://hackathon.api.qloo.com';
export async function qlooRequest(path:string,query:Record<string,string|number|boolean>,transport:typeof fetch=fetch):Promise<any> {
  const key=process.env.QLOO_API_KEY;
  if (!key) throw new Error('Qloo server credentials are not configured.');
  if (!await consume(`qloo:${new Date().toISOString().slice(0,10)}`,Number(process.env.FOLIOECHO_QLOO_DAILY_LIMIT ?? 300))) throw new Error('The shared daily Qloo demo allowance has been reached.');
  const url=new URL(path,endpoint); for (const [name,value] of Object.entries(query)) url.searchParams.set(name,String(value));
  const response=await transport(url,{headers:{'X-Api-Key':key},signal:AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error('Qloo request failed. Check server credentials and quota.');
  const text=await response.text();
  if (text.length>4_000_000 || text.includes(key)) throw new Error('Qloo returned an unsafe or oversized response.');
  const data=JSON.parse(text);
  if (data.success === false) throw new Error('Qloo could not complete this request.');
  return data;
}
export async function hostedSearch(title:string) {
  const data=await qlooRequest('/search',{query:title,types:'urn:entity:book',take:3});
  if (!Array.isArray(data.results)) throw new Error('Unexpected Qloo search response.');
  return data.results;
}
export async function hostedRecommend(entityId:string,type:string,take:number) {
  const query={'filter.type':`urn:entity:${type}`,'signal.interests.entities':entityId,take,'feature.explainability':true};
  const data=await qlooRequest('/v2/insights',query);
  if (!Array.isArray(data.results?.entities)) throw new Error('Unexpected Qloo insights response.');
  return {status:data.results.entities.length?'ok':'empty',results:data.results.entities.map((row:any)=>({...row,affinity:row.affinity ?? row.query?.affinity})),provenance:{requests:[{path:'/v2/insights',query}]}};
}
