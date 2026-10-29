import { useEffect,useState } from 'react';
import './openai-settings.css';
type Status={configured:boolean;hosted:boolean;mode:'demo'|'personal';model:string;expires:number|null;personalStored:boolean;supportedModels:string[];period:string;resetAt:string;
 usage:{attempts:number;completed:number;inputTokens:number;outputTokens:number;estimatedUsd:number;unpriced:number;pendingUsd:number;requestLimit:number;requestPercent:number;dailyBudget:number;costPercent:number|null;costKnown:boolean;pricesAsOf:string};qloo:{plans:number;limit:number;percent:number}};
const dollars=(value:number)=>value>0&&value<.0001?'<$0.0001':'$'+value.toFixed(4);
function Meter({label,percent,detail}:{label:string;percent:number|null;detail:string}) {
 return <div className="ai-meter"><div><b>{label}</b><strong>{percent===null?'Unavailable':percent>0&&percent<.1?'<0.1%':`${percent.toFixed(1)}%`}</strong></div><progress max={100} value={percent===null?0:Math.min(100,percent)} aria-label={label} aria-valuetext={percent===null?'Not available':`${percent.toFixed(1)} percent`}/><small>{detail}</small></div>;
}
export default function OpenAISettings(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [key,setKey]=useState(''),[model,setModel]=useState('gpt-6-luna'),[budget,setBudget]=useState('1.00'),[consent,setConsent]=useState(false),[showForm,setShowForm]=useState(false);
 function apply(data:Status){setStatus(data);window.dispatchEvent(new CustomEvent('folioecho-openai-status',{detail:data.configured}));}
 async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/ai-settings',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not load AI settings.');apply(data);}catch(e){setError(e instanceof Error?e.message:'AI settings unavailable.');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();const onFocus=()=>void refresh();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);},[]);
 async function update(action:'connect'|'demo'|'remove'){
  setBusy(true);setError('');setNotice('');
  const body=action==='connect'?{action,key,model,dailyBudget:Number(budget),consent}:{action};
  // The password field is never restored, written to localStorage or sent back by the server.
  if(action==='connect')setKey('');
  try{const response=await fetch('/api/ai-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not update settings.');apply(data);setConsent(false);setShowForm(false);setNotice(action==='connect'?'Personal key saved for 24 hours. Its validity is checked on your first AI request.':action==='remove'?'Personal key deleted. Demo mode selected.':'Demo mode selected.');}
  catch(e){setError(e instanceof Error?e.message:'Could not update AI settings.');}finally{setBusy(false);}
 }
 const usage=status?.usage;
 return <div className="ai-settings">
  <div className="service-row"><span><b>OpenAI</b><small>Editorial intelligence and event comparisons</small></span><span className="chip">{busy?'Checking…':!status?'Unavailable':status.configured?'Configured':'Not configured'}</span></div>
  <div className="ai-mode-grid">
   <section className={`ai-mode-card ${status?.mode==='demo'?'active':''}`}><h3>Try the demo</h3><p>The host provides the key. Up to 5 AI requests per visitor each day, subject to the shared demo allowance.</p><small>Sponsored usage · you pay $0</small><button disabled={busy||status?.mode==='demo'} onClick={()=>void update('demo')}>{status?.mode==='demo'?'Demo selected':'Use demo'}</button></section>
   <section className={`ai-mode-card ${status?.mode==='personal'?'active':''}`}><h3>Use your own key</h3><p>OpenAI charges your account for personal-key requests. Your demo allowance stays separate.</p><small>Encrypted · expires after 24 hours</small><button disabled={busy} onClick={()=>{if(!showForm&&status?.mode==='personal'){setModel(status.model);setBudget(status.usage.dailyBudget.toFixed(2));}setShowForm(!showForm);}}>{showForm?'Close':status?.personalStored?'Replace personal key':'Connect personal key'}</button></section>
  </div>
  {status?.mode==='personal'&&<p className="ai-key-status">{status.configured?`Personal key selected · ${status.model} · expires ${new Date(status.expires!).toLocaleString()}`:'Your personal key has expired or is unavailable. Reconnect or explicitly switch to demo.'}</p>}
  {(status?.personalStored||(!status&&!!error))&&<button className="ai-remove" disabled={busy} onClick={()=>void update('remove')}>Delete personal key</button>}
  {showForm&&<form className="ai-key-form" onSubmit={e=>{e.preventDefault();void update('connect');}}>
   <h3>Connect for this browser workspace</h3><p>Use this on your own device. Your key is encrypted on our server, used only for your AI requests and never shown again. This temporary connection is not a bookshop account.</p>
   <label>OpenAI secret key<input type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Paste your personal key here" required minLength={20} maxLength={512} disabled={busy}/></label>
   <div className="ai-form-row"><label>Model<select value={model} onChange={e=>setModel(e.target.value)} disabled={busy}>{(status?.supportedModels??['gpt-6-luna']).map(name=><option key={name}>{name}</option>)}</select></label><label>Daily FolioEcho allowance (USD)<input type="number" min="0.01" max="100" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} required disabled={busy}/></label></div>
   <label className="ai-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required disabled={busy}/>I authorize FolioEcho to use this key with OpenAI. Personal-key requests are billed to my OpenAI account.</label>
   <button className="primary" type="submit" disabled={busy||!consent||!key}>Save personal key</button>
  </form>}
  {usage&&<section className="ai-usage-panel"><div className="ai-usage-heading"><div><h3>{status?.mode==='personal'?'Personal-key usage':'Demo usage'}</h3><p>Today · resets at 00:00 UTC · {status?.model||'Model not configured'}</p></div><button disabled={busy} onClick={()=>void refresh()}>Refresh usage</button></div>
   <div className="ai-meter-grid"><Meter label="AI request allowance" percent={usage.requestPercent} detail={`${usage.attempts} / ${usage.requestLimit} attempts · ${usage.completed} completed`}/><Meter label="Estimated cost allowance" percent={usage.costPercent} detail={usage.costKnown?`${dollars(usage.estimatedUsd)} / ${dollars(usage.dailyBudget)} today`:'Cost tracking is incomplete or this model has no configured price.'}/><Meter label="Qloo planning allowance" percent={status!.qloo.percent} detail={`${status!.qloo.plans} / ${status!.qloo.limit} planning attempts · sponsored`}/></div>
   <div className="ai-token-row"><span><b>{usage.inputTokens.toLocaleString()}</b> input tokens</span><span><b>{usage.outputTokens.toLocaleString()}</b> output tokens</span><span><b>{usage.costKnown||usage.estimatedUsd>0?dollars(usage.estimatedUsd):'Unavailable'}</b> measured-token cost estimate{usage.unpriced>0?' (partial)':''}</span></div>
   {usage.pendingUsd>0&&<p className="muted">{dollars(usage.pendingUsd)} reserved or awaiting usage confirmation. Unknown charges remain reserved until the daily reset.</p>}
   <p className="ai-billing-note">{status?.mode==='demo'?'Demo costs are covered by the host; this is not a charge to you. ':''}Only activity inside FolioEcho is tracked. Percentages refer to this app’s daily allowances, not your OpenAI balance. Estimates use reported tokens and published standard prices, exclude taxes and adjustments, and may differ from the final bill. App controls do not limit spending in other apps.</p>
   <p className="ai-billing-note">Pricing reference checked {usage.pricesAsOf}. <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noopener noreferrer">Published OpenAI prices</a></p>
   <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer">View your OpenAI usage and billing ↗</a>
  </section>}
  {!status?.hosted&&<details className="ai-local-help"><summary>Configure the local demo host</summary><p>Set up OpenAI privately using <code>node scripts/setup-openai.mjs</code> in your terminal. Never paste a key into chat, catalogue files or screenshots.</p></details>}
  {notice&&<p role="status" className="ai-notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
