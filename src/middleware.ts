import { defineMiddleware } from 'astro:middleware';
import { hosted, withOwner, owner } from './server/context.ts';
import { visitor } from './server/session.ts';
import { json } from './server/http.ts';
import { acquire, consume, release } from './server/store.ts';
import { randomUUID } from 'node:crypto';
export const onRequest = defineMiddleware(async (context, next) => {
  if (!hosted()) return next();
  try {
    const allowed = [process.env.URL,process.env.FOLIOECHO_DEPLOY_ORIGIN,process.env.FOLIOECHO_SITE_URL].filter(Boolean).map(value => new URL(value!).origin);
    if (!allowed.includes(context.url.origin)) return json({ error: 'Unrecognized demo origin.' },403);
    const session = visitor(context.cookies.get('__Host-folioecho')?.value);
    if (session.fresh) context.cookies.set('__Host-folioecho',session.cookie,{ httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:7*86400 });
    const response = await withOwner(session.id, async () => {
      const mutating = context.url.pathname.startsWith('/api/') && !['GET','HEAD'].includes(context.request.method);
      if (mutating && context.request.headers.get('origin') !== context.url.origin) return json({ error:'Same-origin access is required.' },403);
      if (mutating && !await consume(`write:${owner()}:${Math.floor(Date.now()/60_000)}`,30)) return json({ error:'Please wait a minute before making more changes.' },429);
      // Narration and planning share a database lease; different server instances cannot edit the same run simultaneously.
      if (mutating && context.url.pathname === '/api/intelligence') {
        if (!await consume(`ai:${owner()}:${new Date().toISOString().slice(0,10)}`,5)) return json({ error:'This visitor has reached the daily AI demo limit.' },429);
        const token = randomUUID(); const key = `planning:${owner()}`;
        if (!await acquire(key,token)) return json({ error:'Your planning operation is still running.' },409);
        try { return await next(); } finally { await release(key,token); }
      }
      return next();
    });
    response.headers.set('Cache-Control','private, no-store');
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    return response;
  } catch { return json({ error:'Demo server configuration or storage is unavailable. Please try again later.' },503); }
});
