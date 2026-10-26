import test from "node:test";
import assert from "node:assert/strict";
import { sampleBooks, initialEvents } from "../src/lib/workspace.ts";
import { parseCatalogue, plan } from "../src/lib/catalogue.ts";

test("sample workspace uses importable inventory and valid event IDs", () => {
  assert.deepEqual(parseCatalogue(sampleBooks), sampleBooks);
  assert.equal(
    new Set(initialEvents.map((event) => event.id)).size,
    initialEvents.length,
  );
  assert.equal(plan(sampleBooks).length, 3);
});

test("sample inventory changes remove affected books without replacing unrelated matches", () => {
  const original = plan(sampleBooks);
  const updated = plan(
    sampleBooks.map((book) =>
      book.id === "b1" ? { ...book, stock: 0 } : book,
    ),
  );
  assert.equal(updated.length, original.length - 1);
  assert.ok(updated.every((row) => row.book.id !== "b1"));
  assert.deepEqual(
    updated,
    original.filter((row) => row.book.id !== "b1"),
  );
});
