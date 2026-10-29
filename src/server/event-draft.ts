import type { Run } from '../lib/curator.ts';
import { validateAndScore } from '../lib/curator.ts';
import { createProgramme,type EventDraft } from '../lib/programme.ts';
export function eventDraftFromRun(run:Run,proposalId:string):EventDraft {
  const proposal=run.proposals.find(item=>item.id===proposalId);
  if(!proposal||proposal.status!=='valid'||!run.selected.includes(proposalId)||validateAndScore(proposal,run).status!=='valid')throw new Error('Only a selected, validated proposal can become a planner draft.');
  if(!Number.isSafeInteger(proposal.duration)||proposal.duration<5||proposal.duration>600)throw new Error('The proposal duration cannot form a valid programme.');
  const books=run.input.catalogue.filter(book=>proposal.bookIds.includes(book.id));
  const references=proposal.edgeIds.map(id=>run.edges.find(edge=>edge.id===id&&edge.active));
  if(books.length!==proposal.bookIds.length||books.some(book=>book.stock<run.input.constraints.minStock)||references.some(edge=>!edge))throw new Error('The proposal contains unavailable books or inactive evidence. Generate or repair the plan first.');
  const programme=createProgramme(books);
  const originalDuration=programme.reduce((sum,segment)=>sum+segment.duration,0);
  let offset=0;
  programme.forEach((segment,index)=>{
    segment.duration=index===programme.length-1?proposal.duration-offset:Math.max(1,Math.floor(segment.duration*proposal.duration/originalDuration));
    segment.offset=offset;offset+=segment.duration;
  });
  const cultural=programme.find(segment=>segment.kind==='listening')!;
  const names=references.map(edge=>edge!.name).join(', ');
  cultural.title=proposal.curator==='cinema'?'Cinema & literary connections':proposal.curator==='mixed'?'Music, cinema & literary connections':'Listening & literary connections';
  cultural.description=`Introduce ${names} alongside ${books.map(book=>book.title).join(', ')}. Invite guests to compare impressions and return to the passages. Qloo affinities support discovery; thematic links remain an editorial interpretation.`;
  cultural.notes='Review these references and confirm any playback or screening permissions. The duration is an editorial discussion allocation, not verified media running time.';
  return {id:`qloo-${run.id}-${proposal.id}-r${run.revision}`,title:proposal.title,date:'',time:'19:00',capacity:run.input.constraints.capacity,status:'Draft',theme:proposal.narrativeSource?proposal.interpretation:`${books.map(book=>book.title).join(' · ')} — ${proposal.curator==='listening'?'reading and music':proposal.curator==='cinema'?'literature and cinema':'books, music and cinema'}`,programme,
    source:{runId:run.id,proposalId:proposal.id,revision:run.revision,curator:proposal.curator,duration:proposal.duration,bookIds:[...proposal.bookIds],references:references.map(edge=>({name:edge!.name,type:edge!.type,entityId:edge!.entityId,affinity:edge!.affinity}))}};
}
