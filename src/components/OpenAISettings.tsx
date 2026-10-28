import { useEffect, useState } from 'react';

export default function OpenAISettings() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hosted, setHosted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/intelligence');
      if (!response.ok) throw new Error('Could not check the server configuration.');
      const data = await response.json();
      const ready = data.configured === true;
      setConfigured(ready); setHosted(data.hosted === true);
      window.dispatchEvent(new CustomEvent('folioecho-openai-status', { detail: ready }));
    } catch (e) { setConfigured(null); setError(e instanceof Error ? e.message : 'Configuration check failed.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void check(); }, []);
  return <div>
    <div className="service-row"><span><b>OpenAI</b><small>Editorial intelligence and comparison baseline</small></span><span className="chip">{loading ? 'Checking…' : configured === null ? 'Unavailable' : configured ? 'Configured' : 'Not configured'}</span></div>
    <div className="live-warning">{hosted ? <p>AI features are managed by the demo host. Usage limits keep the demo available to visitors.</p> : <p>Set up OpenAI privately using <code>node scripts/setup-openai.mjs</code> in your terminal.</p>}<button disabled={loading} onClick={() => void check()}>{loading ? 'Checking…' : 'Check configuration'}</button><p>Never paste an API key into chat or the app.</p></div>
    {error && <p role="alert">{error}</p>}
    <p className="muted">API credentials are managed server-side. Do not enter secrets into catalogue files. This checks whether configuration is present; it does not make a live OpenAI request.</p>
  </div>;
}
