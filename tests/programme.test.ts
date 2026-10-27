import test from 'node:test';
import assert from 'node:assert/strict';
import { clockAt, createProgramme, offsetAt, programmeTiming, segmentIdeas, validProgramme } from '../src/lib/programme.ts';
import { demoBooks } from '../src/lib/catalogue.ts';

test('programme uses actual catalogue titles and offers multiple ideas per segment', () => {
  const books = demoBooks.slice(0,3);
  const programme = createProgramme(books);
  assert.equal(programme.length, 5);
  assert.ok(validProgramme(programme));
  assert.equal(programmeTiming(programme).elapsed, 75);
  assert.deepEqual(programmeTiming(programme).issues, []);
  assert.ok(programme.every(segment => segmentIdeas(segment,books).length >= 4));
  assert.match(segmentIdeas(programme[0], books)[0], /Invisible Cities/);
  assert.ok(programme.every(segment => segment.bookIds.every(id => books.some(book => book.id===id))));
});
test('schedule flags gaps, overlaps and recalculates times across midnight', () => {
  const programme = createProgramme(demoBooks.slice(0,3));
  programme[1].offset = 15;
  assert.ok(programmeTiming(programme).issues.some(issue=>issue.includes('5-minute gap')));
  assert.ok(programmeTiming(programme).issues.some(issue=>issue.includes('overlaps')));
  assert.equal(clockAt('23:50',30), '00:20');
  assert.equal(offsetAt('23:50','00:20'),30);
  assert.equal(clockAt('18:30',65),'19:35');
});
test('programme rejects invalid persisted timing, duplicate identities and oversized fields', () => {
  const programme = createProgramme([]);
  assert.equal(validProgramme([{...programme[0],duration:0}]),false);
  assert.equal(validProgramme([{...programme[0],offset:-1}]),false);
  assert.equal(validProgramme([{...programme[0],duration:2.5}]),false);
  assert.equal(validProgramme([programme[0],programme[0]]),false);
  assert.equal(validProgramme([{...programme[0],description:'x'.repeat(2501)}]),false);
  assert.equal(validProgramme([]),false);
});
