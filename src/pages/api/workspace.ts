import type { APIRoute } from 'astro';
import { guard, json } from '../../server/http.ts';
import { get, put } from '../../server/store.ts';
import { parseCatalogue } from '../../lib/catalogue.ts';
import { validateDrafts } from '../../server/workspace-validation.ts';
import { currentOrPreloadedRun } from '../../server/preloaded-run.ts';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
  const blocked=guard(request,url);if(blocked)return blocked;
  try {const run=await currentOrPreloadedRun();return json({workspace:await get('workspace','local')??null,run:run??null});}
  catch {return json({error:'Workspace initialization is unavailable.'},503);}
};
export const POST: APIRoute = async ({ request, url }) => {
  const blocked = guard(request, url, true); if (blocked) return blocked;
  try {
    const text = await request.text(); if (text.length > 3_100_000) return json({ error: 'Workspace is too large.' }, 413);
    const value = JSON.parse(text);
    const catalogue = parseCatalogue(value.books);
    const profile = value.profile;
    if (!profile || !['name', 'shop', 'city', 'email'].every(k => typeof profile[k] === 'string' && profile[k].length <= 200)) throw new Error('Invalid bookshop profile.');
    const photo = profile.photo ?? '';
    if (photo) {
      if (typeof photo !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) throw new Error('Use a PNG, JPEG or WebP photo.');
      const bytes = Buffer.from(photo.split(',')[1], 'base64');
      if (bytes.length > 2 * 1024 * 1024) throw new Error('Photo must be at most 2 MB.');
      const valid = bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) || bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP');
      if (!valid) throw new Error('Invalid image content.');
    }
    validateDrafts(value.events);
    await put('workspace', 'local', { books: catalogue, profile: { name: profile.name, shop: profile.shop, city: profile.city, email: profile.email, photo }, events: value.events });
    return json({ saved: true });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Invalid workspace.' }, 400); }
};
