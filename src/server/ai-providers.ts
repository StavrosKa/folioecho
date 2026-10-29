export type AIProvider = 'openai' | 'gemini';
export type BillingTier = 'free' | 'paid' | 'unknown';
export const providerLabel = (provider: AIProvider) => provider === 'gemini' ? 'Gemini' : 'OpenAI';
// Text-only, standard-tier USD per million tokens; no search/tools or explicit caching.
// https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-29)
export const geminiRates = {
  'gemini-3.5-flash-lite': { input: .30, cached: .03, output: 2.50, write: .30 },
  'gemini-2.5-flash-lite': { input: .10, cached: .01, output: .40, write: .10 },
};
export const defaultGeminiModel = 'gemini-3.5-flash-lite';
export const isProvider = (value: unknown): value is AIProvider => value === 'openai' || value === 'gemini';
