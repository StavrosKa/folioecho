import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { bookCover } from '../src/lib/book-covers.ts';
import { sampleBooks } from '../src/lib/workspace.ts';
import { demoBooks } from '../src/lib/catalogue.ts';

test('every current and legacy demo title has a verified, locally cached real cover', async () => {
  for (const book of [...sampleBooks, ...demoBooks]) {
    const cover = bookCover(book);
    assert.ok(cover, book.title);
    assert.equal(cover.title, book.title);
    assert.equal(cover.author, book.author);
    assert.match(cover.source, /^https:\/\/openlibrary.org\/works\//);
    assert.match(cover.src, /^\/book-covers\/[\w-]+\.webp$/);
    await access(new URL('../public' + cover.src, import.meta.url));
  }
});

test('cover matching tolerates accents/punctuation but never trusts a reused book ID', () => {
  assert.ok(bookCover({title: 'A Room of One\'s Own', author: 'Virginia Woolf'}));
  assert.equal(bookCover({...sampleBooks[0], title: 'An unrelated imported title'}), undefined);
  assert.equal(bookCover({...sampleBooks[0], author: 'Another author'}), undefined);
});
