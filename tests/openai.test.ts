import test from 'node:test';
import assert from 'node:assert/strict';
import { withOwner } from '../src/server/context.ts';
import { changeAccount } from '../src/server/ai-account.ts';
import { randomUUID } from 'node:crypto';
import { modelStatus, structuredModel, objectSchema } from '../src/server/openai.ts';

test('OpenAI keeps the key in server headers, disables storage and parses structured text', async () => withOwner(randomUUID(), async () => {
  const key='sk-'+('fixture-only-').repeat(4);
  await changeAccount({action:'connect',key,model:'gpt-6-luna',dailyBudget:1,consent:true});
    assert.deepEqual(await modelStatus(), { provider: 'openai', providerLabel:'OpenAI', configured: true, hosted: false, mode: 'personal' });
    const transport = (async (url: any, options: any) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer '+key);
      assert.ok(!options.body.includes(key));
      const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
      assert.deepEqual(JSON.parse(body.input), [{ title: 'A public book' }]);
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"An evening"}' }] }] }));
    }) as typeof fetch;
    assert.deepEqual(await structuredModel('test', objectSchema({ title: { type: 'string' } }), 'Use public records.', [{ title: 'A public book' }], transport), { title: 'An evening' });
    await assert.rejects(structuredModel('test', {}, '', {}, (async () => new Response(key, { status: 429 })) as typeof fetch), error => error instanceof Error && !error.message.includes(key) && error.message.includes('429'));
}));
