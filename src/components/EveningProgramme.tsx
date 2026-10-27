import { useState } from 'react';
import type { Book } from '../lib/catalogue';
import { clockAt, createProgramme, offsetAt, programmeTiming, segmentIdeas, type EventDraft, type ProgrammeSegment } from '../lib/programme';
import Icon from './Icon';
import './evening-programme.css';

export default function EveningProgramme({ event, books, onChange }: { event: EventDraft; books: Book[]; onChange: (programme: ProgrammeSegment[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const featured = books.filter(b => b.hiddenGem && b.stock > 0);
  const segments = event.programme ?? createProgramme(featured);
  const timing = programmeTiming(segments);
  const icons = { welcome: 'people', reading: 'book', listening: 'music', discussion: 'network', closing: 'compass', custom: 'calendar' };
  function update(id: string, patch: Partial<ProgrammeSegment>) { onChange(segments.map(s => s.id === id ? { ...s, ...patch } : s)); }
  const unavailable = [...new Set(segments.flatMap(s => s.bookIds))].filter(id => !books.some(b => b.id === id && b.stock > 0));
  return <div className="evening-programme">
    <div className="programme-summary"><span><b>{timing.elapsed} minutes</b><small>{clockAt(event.time, 0)} – {clockAt(event.time, timing.elapsed)}{offsetAt('00:00', event.time) + timing.elapsed >= 1440 ? ' · ends next day' : ''}</small></span><span>{segments.length} segments · {featured.length} selected titles · {featured.reduce((n,b) => n+b.stock,0)} copies</span><button onClick={() => { let offset = 0; onChange(timing.ordered.map(s => { const next = { ...s, offset }; offset += s.duration; return next; })); }}>Arrange consecutively</button></div>
    <p className="programme-disclosure">Editable editorial suggestions based on your selected books and tags. Cultural references and permissions need owner review; these suggestions are not additional Qloo evidence.</p>
    {timing.issues.length > 0 && <div className="live-warning" role="status">{timing.issues.map(issue => <p key={issue}>{issue}</p>)}</div>}
    {unavailable.length > 0 && <p className="live-warning">Some programme books are missing or out of stock. Review the affected segments before using or exporting this draft.</p>}
    <div className="programme-track">{timing.ordered.map((segment, index) => {
      const linked = books.filter(b => segment.bookIds.includes(b.id));
      const ideas = segmentIdeas(segment, books);
      const edit = editing === segment.id;
      return <article className={`programme-segment programme-${segment.kind}`} key={segment.id}>
        <div className="programme-marker"><Icon name={icons[segment.kind]} size={19} /></div>
        <div className="programme-segment-top"><span className="programme-kicker">{String(index+1).padStart(2,'0')} · {clockAt(event.time,segment.offset)}–{clockAt(event.time,segment.offset+segment.duration)}</span><span className="chip">{segment.duration} min</span></div>
        <div className="programme-title"><h3>{segment.title}</h3><button aria-label={`Edit ${segment.title}`} onClick={() => setEditing(edit ? null : segment.id)}><Icon name={edit ? 'check' : 'edit'} size={15} />{edit ? 'Done' : 'Edit'}</button></div>
        {edit ? <div className="programme-editor"><label>Segment title<input maxLength={150} value={segment.title} onChange={e => update(segment.id,{title:e.target.value})} /></label><label>Start time<input type="time" value={clockAt(event.time,segment.offset)} onChange={e => { if(e.target.value) update(segment.id,{offset:offsetAt(event.time,e.target.value)}); }} /></label><label>Duration (minutes)<input type="number" min={1} max={180} value={segment.duration} onChange={e => { const value=Number(e.target.value); if(Number.isSafeInteger(value)&&value>=1&&value<=180) update(segment.id,{duration:value}); }} /></label><label className="programme-full">What happens<textarea maxLength={2500} value={segment.description} onChange={e => update(segment.id,{description:e.target.value})} /></label><label className="programme-full">Host preparation<textarea maxLength={1500} value={segment.notes} onChange={e => update(segment.id,{notes:e.target.value})} /></label><fieldset className="programme-full"><legend>Featured books</legend>{books.map(book => <label className="programme-book-option" key={book.id}><input type="checkbox" checked={segment.bookIds.includes(book.id)} disabled={!book.stock && !segment.bookIds.includes(book.id)} onChange={e => update(segment.id,{bookIds:e.target.checked?[...segment.bookIds,book.id]:segment.bookIds.filter(id=>id!==book.id)})} />{book.title} · {book.stock} copies</label>)}</fieldset><button className="programme-remove" disabled={segments.length<=1} onClick={() => { onChange(segments.filter(s=>s.id!==segment.id)); setEditing(null); }}>Remove segment</button></div> : <p className="programme-description">{segment.description}</p>}
        <div className="programme-books">{linked.map(book=><span key={book.id}>{book.title}<small>{book.stock} copies</small></span>)}</div>
        <div className="programme-ideas"><h4>Ideas to try</h4><ul>{ideas.slice(0,3).map(idea=><li key={idea}>{idea}</li>)}</ul><details><summary>Another approach &amp; use an idea</summary>{ideas.map(idea=><div className="programme-idea-option" key={idea}><p>{idea}</p><button onClick={()=>update(segment.id,{description:idea})}>Use as segment introduction</button></div>)}</details></div>
        {!edit && <div className="programme-preparation"><Icon name="check" size={15} /><p><b>Before the event</b>{segment.notes}</p></div>}
      </article>;
    })}</div>
    <button disabled={segments.length>=10} onClick={()=> { const id=crypto.randomUUID(); onChange([...segments,{ id, kind:'custom', title:'Your next activity', offset:timing.elapsed, duration:10, description:'Add an activity that suits your readers and the selected books.', notes:'Confirm the host, materials and preparation.', bookIds:featured.map(b=>b.id) }]); setEditing(id); }}>Add a programme segment</button>
  </div>;
}
