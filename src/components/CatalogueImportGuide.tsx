import { useEffect, useRef } from 'react';
import Icon from './Icon';
export default function CatalogueImportGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current; element?.showModal();
    const original = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = original; if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialog} className="catalogue-import-dialog" aria-labelledby="catalogue-import-title" onCancel={onClose} onClick={event => { if (event.target === dialog.current) { const box = dialog.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <div className="import-guide-head"><div><small>YOUR COLLECTION</small><h2 id="catalogue-import-title">Prepare your catalogue</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close catalogue instructions"><Icon name="close" size={20} /></button></div>
    <p>Upload an Excel <b>.xlsx</b>, <b>.csv</b> or <b>.json</b> file up to <b>2 MB</b>. Excel and CSV are converted automatically; you do not need to write JSON.</p>
    <div className="import-guide-steps"><section><b>1. One book per row</b><p>Use a plain table on the first worksheet. Put the column names below in row 1. Avoid merged cells and extra title rows.</p></section><section><b>2. Keep values simple</b><p>Use whole numbers for stock, including 0 for unavailable books. Paste values instead of formulas; formulas are not recalculated.</p></section><section><b>3. Import and review</b><p>The file replaces your current catalogue after every row passes validation. Review quantities and choose 3–5 hidden gems before generating ideas.</p></section></div>
    <div className="import-guide-table"><table><caption>Excel / CSV columns</caption><thead><tr><th>Column</th><th>Required?</th><th>What to enter</th></tr></thead><tbody>
      <tr><td><code>title</code></td><td>Yes</td><td>Book title, e.g. Invisible Cities</td></tr>
      <tr><td><code>author</code></td><td>Yes</td><td>Author name, e.g. Italo Calvino</td></tr>
      <tr><td><code>stock</code></td><td>Yes</td><td>Copies available: 0, 1, 2…</td></tr>
      <tr><td><code>id</code></td><td>No</td><td>Unique text identifier. Leave blank to create one automatically.</td></tr>
      <tr><td><code>tags</code></td><td>No</td><td>Separate themes with semicolons: <code>cities;travel</code></td></tr>
      <tr><td><code>hiddenGem</code></td><td>No</td><td>TRUE or FALSE. Blank means FALSE; you can select books later.</td></tr>
    </tbody></table></div>
    <div className="import-guide-example"><b>Example row</b><code>Invisible Cities | Italo Calvino | 4 | book-001 | cities;travel | TRUE</code></div>
    <p className="import-guide-note">Column order does not matter. Use text formatting for IDs with leading zeros. For CSV, choose UTF-8 encoding and comma-separated columns. Older .xls files must be saved as .xlsx. Up to 1,000 books can be imported into Catalogue; the live Qloo demo currently processes up to 25 titles per run.</p>
    <div className="import-guide-actions"><a href="/sample-catalogue.csv" download="folioecho-catalogue-template.csv"><Icon name="download" size={16} />Download CSV template for Excel</a><button type="button" className="primary" onClick={onClose}>Got it</button></div>
  </dialog>;
}
