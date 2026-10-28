import { AsyncLocalStorage } from 'node:async_hooks';
const context = new AsyncLocalStorage<string>();
export const hosted = () => process.env.FOLIOECHO_HOSTED !== '0' && (process.env.FOLIOECHO_HOSTED === '1' || !!(process.env.SITE_ID && process.env.URL));
export function owner() { const value = context.getStore(); if (hosted() && !value) throw new Error('Visitor session is required.'); return value ?? 'local'; }
export function withOwner<T>(id: string, work: () => T): T { return context.run(id, work); }
