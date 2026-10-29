import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiSchema,matchesSchema} from '../src/server/ai-schema.ts';
const schema={type:'object',properties:{books:{type:'array',maxItems:25,items:{type:'object',properties:{id:{type:'string',enum:['a','b']},tags:{type:'array',minItems:1,maxItems:8,items:{type:'string'}},confidence:{type:'string',enum:['low','medium','high']}},required:['id','tags','confidence'],additionalProperties:false}}},required:['books'],additionalProperties:false};
test('Gemini receives a simpler nested grammar while the original constraints remain mandatory',()=>{
 const original=structuredClone(schema),transport=geminiSchema(schema);
 assert.deepEqual(schema,original);assert.equal(transport.properties.books.maxItems,undefined);assert.equal(transport.properties.books.items.properties.tags.maxItems,undefined);assert.match(transport.properties.books.items.properties.tags.description,/At most 8/);assert.deepEqual(transport.properties.books.items.properties.id.enum,['a','b']);
 const item={id:'a',tags:['cities'],confidence:'high'};
 assert.equal(matchesSchema({books:[item]},schema),true);
 for(const invalid of [{books:Array.from({length:26},()=>item)},{books:[{...item,tags:Array(9).fill('tag')}]},{books:[{...item,tags:[]}]},{books:[{...item,id:'invented'}]},{books:[{...item,confidence:'invented'}]},{books:[{...item,tags:'cities'}]},{books:[{...item,unexpected:true}]},{books:[{id:'a',tags:[]}]},{books:null},null])assert.equal(matchesSchema(invalid,schema),false);
});
