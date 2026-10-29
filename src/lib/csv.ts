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
  return parseCatalogueRows(rows, 'CSV');
}

/** Shared CSV/Excel validation; only return a catalogue after every row passes. */
export function parseCatalogueRows(rawRows: unknown[][], source = 'Spreadsheet', padEmptyCells = false): Book[] {
  if (rawRows.length > 1001) throw new Error('Import at most 1,000 book rows plus the header.');
  const rows = rawRows.map((row, index) => ({ number: index + 1, values: row.map(value => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return String(value).trim();
    throw new Error(`${source} row ${index + 1}: use text, numbers or TRUE/FALSE values, not dates or unsupported cells.`);
  }) })).filter(row => row.values.some(value => value.trim()));
  const headerRow = rows.shift()?.values ?? [];
  if (padEmptyCells) while (headerRow.at(-1) === '') headerRow.pop();
  const headers = headerRow.map(h => h.trim().toLowerCase());
  if (headers.some(header => !header) || new Set(headers).size !== headers.length || !['title', 'author', 'stock'].every(h => headers.includes(h))) throw new Error(`${source} requires unique title, author and stock columns. Optional: id, tags, hiddenGem.`);
  const ids = new Set<string>();
  return parseCatalogue(rows.map(({ values: original, number }) => {
    const values = [...original];
    if (padEmptyCells) {
      if (values.slice(headers.length).some(value => value !== '')) throw new Error(`${source} row ${number} has data without a column heading.`);
      values.length = headers.length;
      for (let i = 0; i < values.length; i++) values[i] ??= '';
    }
    if (values.length !== headers.length) throw new Error(`${source} row ${number} has the wrong number of columns.`);
    const record = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
    if (!record.title || !record.author) throw new Error(`${source} row ${number}: title and author are required.`);
    if (!/^\d+$/.test(record.stock) || !Number.isSafeInteger(Number(record.stock))) throw new Error(`${source} row ${number}: stock must be a non-negative integer.`);
    const gem = record.hiddengem?.toLowerCase() ?? 'false';
    if (!['true', 'false', '1', '0', ''].includes(gem)) throw new Error(`${source} row ${number}: hiddenGem must be true or false.`);
    const id = record.id || `csv-${number - 1}`;
    if (ids.has(id)) throw new Error(`${source} row ${number}: each id must be unique.`);
    ids.add(id);
    return { id, title: record.title, author: record.author, stock: Number(record.stock),
      tags: record.tags ? record.tags.split(';').map(t => t.trim()).filter(Boolean) : [], hiddenGem: gem === 'true' || gem === '1' };
  }));
}
