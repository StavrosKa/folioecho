import test from "node:test";
import assert from "node:assert/strict";
import { sampleBooks, initialEvents } from "../src/lib/workspace.ts";
import { parseCatalogue, plan } from "../src/lib/catalogue.ts";
import { readFileSync } from 'node:fs';

test("sample workspace uses importable inventory and valid event IDs", () => {
  assert.deepEqual(parseCatalogue(sampleBooks), sampleBooks);
  assert.equal(
    new Set(initialEvents.map((event) => event.id)).size,
    initialEvents.length,
  );
  assert.equal(plan(sampleBooks).length, 3);
});

test('selected sample gems have exact confirmed title/author matches and evidence in the real bundled Qloo run',()=>{
  const seed=JSON.parse(readFileSync(new URL('../src/data/sample-qloo-run.json',import.meta.url),'utf8'));
  const gems=sampleBooks.filter(book=>book.hiddenGem);
  assert.deepEqual(gems.map(book=>book.title),['Fair Play','The Tanners','The Peregrine']);
  const normalize=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  for(const book of gems){
    const resolution=seed.resolutions.find((row:any)=>row.bookId===book.id);
    assert.equal(resolution.status,'confirmed');
    const candidate=resolution.candidates.find((row:any)=>row.id===resolution.entityId);
    assert.equal(candidate.name,book.title);assert.ok(normalize(candidate.detail).includes(normalize(book.author)));
    assert.ok(seed.edges.some((edge:any)=>edge.bookId===book.id&&edge.active&&edge.request.endpoint==='/v2/insights'));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('../public/sample-catalogue.json',import.meta.url),'utf8')),sampleBooks);
});

test("sample inventory changes remove affected books without replacing unrelated matches", () => {
  const original = plan(sampleBooks);
  const removedId=sampleBooks.find(book=>book.hiddenGem)!.id;
  const updated = plan(
    sampleBooks.map((book) =>
      book.id === removedId ? { ...book, stock: 0 } : book,
    ),
  );
  assert.equal(updated.length, original.length - 1);
  assert.ok(updated.every((row) => row.book.id !== removedId));
  assert.deepEqual(
    updated,
    original.filter((row) => row.book.id !== removedId),
  );
});
