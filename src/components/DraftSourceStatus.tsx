import {useEffect,useState} from 'react';
import {fetchComparison,type ComparisonData} from './ComparisonResults';
import type {EventDraft} from '../lib/programme';
import type {Book} from '../lib/catalogue';
export default function DraftSourceStatus({event,books,onStudio}:{event:EventDraft;books:Book[];onStudio:()=>void}){
 const [data,setData]=useState<ComparisonData|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;fetchComparison().then(value=>{if(active)setData(value)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[event.id]);
 if(!event.source)return <div className="planner-source"><b>Independent draft</b><p>This draft is not linked to an Event Studio proposal.</p><button onClick={onStudio}>Choose an Event Studio idea</button></div>;
 const source=event.source,run=data?.run;
 const current=run?.id===source.runId&&run.revision===source.revision;
 const unavailable=source.bookIds.filter(id=>!books.some(book=>book.id===id&&book.stock>0));
 return <div className="planner-source"><b>From Event Studio · revision {source.revision}</b><p>{source.duration} minutes in source proposal · {source.references.map(r=>r.name).join(' · ')}</p><small>{error?'Could not check source freshness.':!data?'Checking source…':current?'Matches the current Event Studio snapshot.':'A different Event Studio snapshot is available. Your saved draft and edits have been kept.'}</small>{unavailable.length>0&&<p role="alert">{unavailable.length} featured book(s) are missing or out of stock. Review before using this programme.</p>}<p>Programmes are editable snapshots; later runs do not silently overwrite your work.</p><button onClick={onStudio}>Review latest Event Studio ideas</button></div>;
}
