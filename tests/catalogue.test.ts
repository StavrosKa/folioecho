import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalogue,plan,demoBooks,categories} from '../src/lib/catalogue.ts';
test('rejects invalid inventory and duplicate identities',()=>{
 for(const stock of [-1,1.5,NaN,'4']) assert.throws(()=>parseCatalogue([{...demoBooks[0],stock}]));
 assert.throws(()=>parseCatalogue([demoBooks[0],demoBooks[0]]));
 assert.throws(()=>parseCatalogue([{...demoBooks[0],tags:[12]}]));
});
test('normalizes and counts catalogue tags without inventing categories',()=>{
 const books=parseCatalogue([{...demoBooks[0],tags:[' Travel ','travel']}]);
 assert.deepEqual(categories(books),[['travel',1]]);
});
test('never recommends unavailable books, including selected gems',()=>{
 const books=demoBooks.map(b=>({...b,hiddenGem:true}));
 assert.ok(plan(books).every(r=>r.book.stock>0));
 assert.equal(plan(books.map(b=>({...b,stock:0}))).length,0);
});
test('repair preserves unaffected matches and excludes rejected directions',()=>{
 const original=plan(demoBooks);
 const rejected=original[0].match!.bridge.id;
 const repaired=plan(demoBooks,[rejected]);
 for(const row of repaired){
  assert.notEqual(row.match?.bridge.id,rejected);
  const before=original.find(r=>r.book.id===row.book.id)!;
  if(before.match?.bridge.id!==rejected) assert.deepEqual(row,before);
 }
 assert.ok(plan(demoBooks,['m1','m2','m3']).every(r=>r.match===null));
});
