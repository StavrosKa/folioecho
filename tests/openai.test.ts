import test from 'node:test';
import assert from 'node:assert/strict';
import { modelStatus, structuredModel, objectSchema } from '../src/server/openai.ts';

test('OpenAI keeps the key in server headers, disables storage and parses structured text', async () => {
  const priorKey = process.env.OPENAI_API_KEY; const priorModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-secret-never-in-prompts'; process.env.OPENAI_MODEL = 'test-model';
  try {
    assert.deepEqual(await modelStatus(), { provider: 'OpenAI', configured: true, hosted: false, mode: 'demo' });
    const transport = (async (url: any, options: any) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-secret-never-in-prompts');
      assert.ok(!options.body.includes('test-secret-never-in-prompts'));
      const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
      assert.deepEqual(JSON.parse(body.input), [{ title: 'A public book' }]);
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"An evening"}' }] }] }));
    }) as typeof fetch;
    assert.deepEqual(await structuredModel('test', objectSchema({ title: { type: 'string' } }), 'Use public records.', [{ title: 'A public book' }], transport), { title: 'An evening' });
    await assert.rejects(structuredModel('test', {}, '', {}, (async () => new Response('test-secret-never-in-prompts', { status: 429 })) as typeof fetch), error => error instanceof Error && !error.message.includes('test-secret-never-in-prompts') && error.message.includes('429'));
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey;
    if (priorModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = priorModel;
  }
});
