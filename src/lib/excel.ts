import { unzipSync, strFromU8 } from 'fflate';
import { parseCatalogueRows } from './csv.ts';

/** Bound ZIP expansion and sheet coordinates before a spreadsheet reader allocates rows. */
export function inspectWorkbook(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const fail = () => { throw new Error('Use a valid, unencrypted Excel .xlsx workbook.'); };
  if (bytes.length < 22 || bytes.length > 2_000_000) fail();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail();
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true), size = view.getUint32(end + 12, true);
  if (!count || count > 256 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || offset + size !== end) fail();
  let cursor = offset, total = 0; const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) fail();
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const expanded = view.getUint32(cursor + 24, true), compressed = view.getUint32(cursor + 20, true);
    const length = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + length + extra + comment, local = view.getUint32(cursor + 42, true);
    if (next > end || flags & 1 || ![0, 8].includes(method) || expanded > 8_000_000 || (total += expanded) > 16_000_000 || local + 30 > offset) fail();
    const name = strFromU8(bytes.subarray(cursor + 46, cursor + 46 + length));
    if (names.has(name) || name.startsWith('/') || name.includes('..') || name.includes('\\')) fail();
    names.add(name);
    if (view.getUint32(local, true) !== 0x04034b50 || local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true) + compressed > offset) fail();
    cursor = next;
  }
  if (cursor !== end || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) fail();
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(bytes, { filter: file => file.name.endsWith('.xml') }); } catch { return fail(); }
  for (const [name, data] of Object.entries(entries)) {
    if (data.length > 8_000_000) fail();
    const xml = strFromU8(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail();
    if (name.startsWith('xl/worksheets/')) {
      let rowCount = 0, cellCount = 0;
      for (const row of xml.matchAll(/<(?:\w+:)?row\b[^>]*>/gi)) {
        const index = row[0].match(/\br=["'](\d+)["']/i);
        if (++rowCount > 1001 || (index && (Number(index[1]) < 1 || Number(index[1]) > 1001))) throw new Error('Use at most 1,000 book rows and remove unused formatted rows.');
      }
      const cells = /<(?:\w+:)?c\b/gi;
      while (cells.exec(xml)) if (++cellCount > 64 * 1001) throw new Error('Remove unused formatted cells before importing.');
      for (const match of xml.matchAll(/<(?:\w+:)?(?:c|dimension)\b[^>]*\b(?:r|ref)=["']([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?["']/gi)) {
        const columns = (letters: string) => [...letters.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
        if (Number(match[2]) < 1 || Number(match[2]) > 1001 || Number(match[4] ?? 0) > 1001 || columns(match[1]) > 64 || (match[3] && columns(match[3]) > 64)) throw new Error('Use a plain catalogue sheet with at most 1,000 book rows and 64 columns. Remove unused formatted rows and columns.');
      }
    }
  }
}
export async function parseCatalogueExcel(buffer: ArrayBuffer) {
  inspectWorkbook(buffer);
  const { readSheet } = await import('read-excel-file/universal');
  let rows;
  try { rows = await readSheet(buffer, 1); } catch { throw new Error('Could not read this workbook. Save it as an unencrypted .xlsx file and try again.'); }
  return parseCatalogueRows(rows, 'Excel', true);
}
