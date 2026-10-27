import { parseCatalogue, type Book } from './catalogue.ts';

/** RFC-style quoted CSV fields, including escaped quotes and embedded newlines. */
export function parseCatalogueCSV(text: string): Book[] {
  if (text.length > 2_000_000) throw new Error('CSV is limited to 2 MB.');
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field); field = ''; closed = false;
      if (char !== ',') {
        if (char === '\r' && source[i + 1] === '\n') i++;
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !field && !closed) quoted = true;
    else if (closed || char === '"') throw new Error('Invalid CSV quoting.');
    else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  const headers = rows.shift()?.map(h => h.trim().toLowerCase()) ?? [];
  if (new Set(headers).size !== headers.length || !['title', 'author', 'stock'].every(h => headers.includes(h))) throw new Error('CSV requires unique title, author and stock columns. Optional: id, tags, hiddenGem.');
  return parseCatalogue(rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
    const record = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
    if (!/^\d+$/.test(record.stock)) throw new Error(`CSV row ${index + 2}: stock must be a non-negative integer.`);
    const gem = record.hiddengem?.toLowerCase() ?? 'false';
    if (!['true', 'false', '1', '0', ''].includes(gem)) throw new Error(`CSV row ${index + 2}: hiddenGem must be true or false.`);
    return { id: record.id || `csv-${index + 1}`, title: record.title, author: record.author, stock: Number(record.stock),
      tags: record.tags ? record.tags.split(';').map(t => t.trim()).filter(Boolean) : [], hiddenGem: gem === 'true' || gem === '1' };
  }));
}
