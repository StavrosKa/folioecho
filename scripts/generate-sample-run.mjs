import {writeFile} from 'node:fs/promises';
import {withOwner} from '../src/server/context.ts';
import {createRun,parseInput} from '../src/server/planner.ts';
import {sampleBooks} from '../src/lib/workspace.ts';
import {defaultConstraints} from '../src/lib/curator.ts';
const run=await withOwner('sample-preload-generation',()=>createRun(parseInput({catalogue:sampleBooks,selectedGenres:[],preferences:{curatorTypes:['listening','cinema']},constraints:defaultConstraints}),undefined,(message,completed,total)=>console.log(JSON.stringify({message,completed,total}))));
if(!run.selected.length||!run.edges.length)throw new Error('No evidence-backed proposals; seed was not written');
await writeFile('src/data/sample-qloo-run.json',JSON.stringify(run,null,2)+'\n');
console.log(JSON.stringify({saved:true,id:run.id,createdAt:run.createdAt,selected:run.selected.length,edges:run.edges.length,toolCalls:run.trace.filter(event=>event.source==='tool-call').length,cacheHits:run.trace.filter(event=>event.source==='cache').length}));
