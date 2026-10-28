import type { Config } from '@netlify/functions';
import { validSignature } from '../../src/server/session.ts';
import { withOwner } from '../../src/server/context.ts';
import { executeJob } from '../../src/server/jobs.ts';
export default async (request:Request) => {
  if (request.method !== 'POST') return;
  const payload=await request.text(); if (payload.length>500) return;
  try {
    if (!validSignature(payload,request.headers.get('X-Folioecho-Signature') ?? '')) return;
    const body=JSON.parse(payload);
    if (!/^[a-f\d-]{36}$/.test(body.owner) || !/^[a-f\d-]{36}$/.test(body.id) || body.expires<Date.now() || body.expires>Date.now()+65_000) return;
    await withOwner(body.owner,() => executeJob(body.id));
  } catch { console.error('Demo background worker failed; inspect database/provider configuration.'); }
};
export const config:Config={background:true};
