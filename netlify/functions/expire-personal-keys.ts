import type { Config } from '@netlify/functions';
import { purgeExpiredKeys } from '../../src/server/store.ts';
export default async()=>{await purgeExpiredKeys();};
export const config:Config={schedule:'0 * * * *'};
