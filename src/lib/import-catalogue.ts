import { parseCatalogue } from './catalogue.ts';
import { parseCatalogueCSV } from './csv.ts';
export const catalogueFileTypes = '.xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json';
export async function readCatalogueFile(file: File) {
  if (!file.size || file.size > 2_000_000) throw new Error('Choose an Excel (.xlsx), CSV or JSON file up to 2 MB.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (extension === 'xlsx') {
    const { parseCatalogueExcel } = await import('./excel.ts');
    return parseCatalogueExcel(await file.arrayBuffer());
  }
  if (extension === 'csv') return parseCatalogueCSV(await file.text());
  if (extension === 'json') {
    let value; try { value = JSON.parse(await file.text()); } catch { throw new Error('This JSON file could not be read. Choose a valid catalogue array.'); }
    return parseCatalogue(value);
  }
  throw new Error('Use .xlsx, .csv or .json. For older Excel .xls files, choose Save As → Excel Workbook (.xlsx).');
}
