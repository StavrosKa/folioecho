import { notify } from './notifications';
export async function downloadPDF(name: string, data?: unknown, runId?: string) {
  try {
    const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, data, runId }) });
    if (!response.ok) throw new Error((await response.json()).error ?? 'PDF export failed.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = name.replace(/\.json$/i, '.pdf'); link.click();
    notify('PDF ready', 'Your report download has started.', 'success', 'pdf-download');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) { window.dispatchEvent(new CustomEvent('folioecho-error', { detail: error instanceof Error ? error.message : 'Export failed.' })); }
}
