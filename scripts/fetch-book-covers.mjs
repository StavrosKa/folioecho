import {sampleBooks} from '../src/lib/workspace.ts';
import {demoBooks} from '../src/lib/catalogue.ts';
import {structuredModelWithMetadata,objectSchema} from '../src/server/ai.ts';
import {withOwner} from '../src/server/context.ts';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
const books=[...new Map([...sampleBooks,...demoBooks].map(book=>[book.id,book])).values()];
await mkdir('artifacts/evaluation',{recursive:true});await mkdir('public/book-covers',{recursive:true});
let suggestions;
try{suggestions=JSON.parse(await readFile('artifacts/evaluation/cover-isbn-suggestions.json','utf8'));}catch{
 suggestions=await withOwner('sample-cover-generation',()=>structuredModelWithMetadata('cover_isbn_lookup',objectSchema({books:{type:'array',minItems:books.length,maxItems:books.length,items:objectSchema({id:{type:'string',enum:books.map(b=>b.id)},isbn:{type:'string'}})}}),'Suggest one real ISBN-13 of an English-language edition for each supplied title and author. Return an empty string if uncertain. Do not provide URLs. These are suggestions and will be independently checked against a bibliographic catalogue.',books.map(({id,title,author})=>({id,title,author})),fetch,'gemini'));
 await writeFile('artifacts/evaluation/cover-isbn-suggestions.json',JSON.stringify(suggestions,null,2));
}
const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const headers={'User-Agent':'FolioEcho-demo-cover-review/1.0'};
let last=0;async function json(url){const delay=1100-(Date.now()-last);if(delay>0)await new Promise(r=>setTimeout(r,delay));last=Date.now();const r=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('Bibliographic lookup HTTP '+r.status);return r.json();}
let manifest=[];try{manifest=JSON.parse(await readFile('src/data/book-covers.json','utf8'));}catch{}
for(const book of books){
 if(manifest.some(row=>row.key===normalize(book.title)+'|'+normalize(book.author)))continue;
 try{
 const suggestion=suggestions.data.books.find(row=>row.id===book.id),isbn=(suggestion?.isbn??'').replace(/[^0-9X]/g,'');
 const url=new URL('https://openlibrary.org/search.json');url.searchParams.set('title',book.title);url.searchParams.set('author',book.author);url.searchParams.set('limit','5');url.searchParams.set('fields','key,title,author_name,cover_i,isbn');
 const data=await json(url);
 const titleKey=value=>normalize(value.replace(/^(the|a|an)\s+/i,''));
 const authorMatches=author=>normalize(author)===normalize(book.author)||(book.author==='Homer'&&normalize(author).replace(/ς/g,'σ')==='ομηροσ');
 let candidates=data.docs.filter(row=>titleKey(row.title)===titleKey(book.title)&&row.author_name?.some(authorMatches)&&Number.isSafeInteger(row.cover_i)&&row.cover_i>0);
 let match=candidates.find(row=>isbn&&row.isbn?.includes(isbn))??candidates[0];
 if(!match){
  const broad=new URL('https://openlibrary.org/search.json');broad.searchParams.set('q',book.title+' '+book.author);broad.searchParams.set('limit','5');broad.searchParams.set('fields','key,title,author_name,cover_i,isbn');
  const works=(await json(broad)).docs.filter(row=>row.author_name?.some(authorMatches));
  for(const work of works){
   const editions=await json('https://openlibrary.org'+work.key+'/editions.json?limit=1000');
   const edition=editions.entries?.find(row=>titleKey(row.title)===titleKey(book.title)&&row.covers?.some(id=>id>0));
   if(edition){match={...work,cover_i:edition.covers.find(id=>id>0),isbn:[...(edition.isbn_13??[]),...(edition.isbn_10??[])]};break;}
  }
 }
 if(!match)throw new Error('No verified title/author cover match');
 const imageUrl=`https://covers.openlibrary.org/b/id/${match.cover_i}-M.jpg?default=false`;
 const response=await fetch(imageUrl,{headers,signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('Cover HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2_000_000)throw new Error('Oversized cover');const meta=await sharp(bytes).metadata();if(!meta.width||!meta.height||meta.width<60||meta.height<90)throw new Error('Missing or placeholder cover');
 const file=`/book-covers/${book.id}.webp`;await sharp(bytes).resize({width:320,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile('public'+file);
 const row={key:normalize(book.title)+'|'+normalize(book.author),title:book.title,author:book.author,src:file,source:'https://openlibrary.org'+match.key,coverSource:imageUrl,coverId:match.cover_i,geminiSuggestedIsbn:isbn,geminiIsbnMatchedEdition:!!isbn&&!!match.isbn?.includes(isbn),provider:suggestions.provider,model:suggestions.model,verifiedAt:new Date().toISOString()};
 manifest.push(row);await writeFile('src/data/book-covers.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({title:book.title,ok:true,coverId:match.cover_i}));
 }catch(error){console.log(JSON.stringify({title:book.title,ok:false,error:error.message}));}
}
console.log(JSON.stringify({covered:manifest.length,total:books.length}));
if(manifest.length!==books.length)process.exitCode=1;

