import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseCatalogueExcel, inspectWorkbook } from '../src/lib/excel.ts';
import { parseCatalogueRows } from '../src/lib/csv.ts';
import { readCatalogueFile } from '../src/lib/import-catalogue.ts';
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function workbook(rows:(string|number|boolean|null)[][],dimensions?:string) {
 const sheet=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimensions??`A1:F${rows.length}`}"/><sheetData>${rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>value===null?'':typeof value==='string'?`<c r="${String.fromCharCode(65+c)}${r+1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`:`<c r="${String.fromCharCode(65+c)}${r+1}"${typeof value==='boolean'?' t="b"':''}><v>${typeof value==='boolean'?Number(value):value}</v></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const files={
  '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Books" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  'xl/worksheets/sheet1.xml':sheet,
 };
 return new Uint8Array(zipSync(Object.fromEntries(Object.entries(files).map(([name,xml])=>[name,strToU8(xml)])))).buffer;
}
const rows:(string|number|boolean|null)[][]=[['title','author','stock','id','tags','hiddenGem'],['Μια πόλη & ένα βιβλίο','Author, Name',4,'book-001','cities; travel',true],['Second book','Another author',0,null,null,false]];
test('a real XLSX workbook becomes validated JSON books including Unicode, numeric stock and boolean gems',async()=>{
 const books=await parseCatalogueExcel(workbook(rows));
 assert.equal(books.length,2);assert.equal(books[0].title,'Μια πόλη & ένα βιβλίο');assert.equal(books[0].author,'Author, Name');assert.equal(books[0].id,'book-001');assert.equal(books[0].stock,4);assert.equal(books[0].hiddenGem,true);assert.deepEqual(books[0].tags,['cities','travel']);assert.equal(books[1].stock,0);assert.equal(books[1].hiddenGem,false);assert.ok(books[1].id);
});
test('file dispatcher supports XLSX, CSV and JSON without changing the source array',async()=>{
 const excel=await readCatalogueFile(new File([workbook(rows)],'books.XLSX'));
 const csv=await readCatalogueFile(new File(['title,author,stock\nBook,Writer,3'],'books.csv'));
 const json=await readCatalogueFile(new File([JSON.stringify(excel)],'books.json'));
 assert.equal(csv[0].stock,3);assert.deepEqual(json,excel);assert.equal(rows[0][0],'title');
 await assert.rejects(readCatalogueFile(new File(['old binary'],'books.xls')),/Save As/);
 await assert.rejects(readCatalogueFile(new File([new Uint8Array(2_000_001)],'books.xlsx')),/2 MB/);
});
test('spreadsheet validation rejects missing columns, duplicate IDs and invalid quantities atomically',async()=>{
 await assert.rejects(parseCatalogueExcel(workbook([['title','author'],['Book','Writer']])),/stock/);
 await assert.rejects(parseCatalogueExcel(workbook([rows[0],rows[1],[...rows[1]]])),/unique/);
 await assert.rejects(parseCatalogueExcel(workbook([['title','author','stock'],['Book','Writer',1.5]])),/integer/);
 await assert.rejects(parseCatalogueExcel(workbook([['title','author','stock'],['Book','Writer',-2]])),/integer/);
 assert.throws(()=>parseCatalogueRows([['title','author','stock'],['Book','Writer',new Date()]],'Excel',true),/dates/);
 assert.throws(()=>parseCatalogueRows([['title','author','stock'],['Book','Writer',Number.MAX_SAFE_INTEGER+1]],'Excel',true),/integer/);
});
test('Excel accepts reordered headings, blank optional cells and blank rows',async()=>{
 const books=await parseCatalogueExcel(workbook([['stock','author','title','hiddenGem'],[3,'Writer','Book',null],[],[0,'Writer 2','Book 2',true]]));
 assert.equal(books.length,2);assert.equal(books[0].hiddenGem,false);assert.equal(books[1].hiddenGem,true);
});
test('archive and coordinate guards reject malformed or expansive workbooks before sheet allocation',async()=>{
 assert.throws(()=>inspectWorkbook(new Uint8Array([1,2,3]).buffer),/valid/);
 await assert.rejects(parseCatalogueExcel(workbook(rows,'A1:XFD1048576')),/1,000/);
 const archive=new Uint8Array(workbook(rows)),view=new DataView(archive.buffer);
 let central=-1;for(let i=0;i<archive.length-46;i++)if(view.getUint32(i,true)===0x02014b50){central=i;break;}
 assert.ok(central>=0);view.setUint32(central+24,100_000_000,true);
 assert.throws(()=>inspectWorkbook(archive.buffer),/valid/);
});
