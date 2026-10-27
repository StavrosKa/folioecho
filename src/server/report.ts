import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import type { Book } from '../lib/catalogue.ts';
import type { Run } from '../lib/curator.ts';
import { clockAt, createProgramme, programmeTiming, segmentIdeas } from '../lib/programme.ts';

export async function createReport(name: string, data: any, workspace: any, run?: Run): Promise<Buffer> {
  const font = process.env.FOLIOECHO_FONT_REGULAR ?? ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(existsSync);
  const bold = process.env.FOLIOECHO_FONT_BOLD ?? ['C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(existsSync);
  if (!font || !bold) throw new Error('Configure report fonts on this server before exporting.');
  const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true, info: { Title: 'FolioEcho - Bookshop Intelligence', Author: 'FolioEcho' } });
  doc.registerFont('Body', font); doc.registerFont('Bold', bold);
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const green = '#19352a', cream = '#f7f4eb', gold = '#ad9158', ink = '#24392f';
  const width = 503;
  const profile = data?.profile ?? workspace?.profile ?? { shop: 'The Reading Room', city: 'Athens, Greece' };
  const books: Book[] = run?.input.catalogue ?? (Array.isArray(data) && data[0]?.stock !== undefined ? data : data?.books ?? workspace?.books ?? []);
  const title = run ? 'Cultural discovery report' : name.includes('event') ? 'Event collection' : name.includes('discovery') ? 'Discovery report' : name.includes('workspace') ? 'Bookshop workspace' : 'Catalogue collection';
  function pageHeader(first = false) {
    doc.rect(0, 0, 595.28, 841.89).fill(cream);
    doc.rect(0, 0, 595.28, first ? 130 : 67).fill(green);
    doc.fillColor('#f3e8cc').font('Bold').fontSize(first ? 27 : 15).text('FolioEcho', 46, first ? 28 : 23);
    if (first) doc.font('Body').fontSize(10).text('WHERE BOOKS FIND THEIR AUDIENCE', 47, 67).fillColor('#d7dcca').text(String(profile.shop), 47, 93);
    doc.y = first ? 154 : 90; doc.x = 46;
  }
  function room(height: number) { if (doc.y + height > 780) { doc.addPage(); pageHeader(); } }
  function paragraph(text: string, size = 10, color = ink) {
    doc.font('Body').fontSize(size).fillColor(color);
    const height = doc.heightOfString(text, { width, lineGap: 4 }); room(height + 12);
    doc.font('Body').fontSize(size).fillColor(color);
    doc.text(text, 46, doc.y, { width, lineGap: 4 }); doc.moveDown(.5);
  }
  function heading(text: string) { room(48); doc.moveDown(.4); doc.font('Bold').fontSize(16).fillColor(green).text(text, 46, doc.y, { width }); doc.moveDown(.6); }
  pageHeader(true);
  doc.font('Bold').fontSize(25).fillColor(green).text(title, 46, doc.y, { width }); doc.moveDown(.5);
  paragraph(`${profile.city ?? ''}  |  ${new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/Athens' })}`, 10, '#657368');
  const total = books.reduce((n, b) => n + Number(b.stock || 0), 0);
  room(75); const metricsY = doc.y;
  [[String(books.length), 'DISTINCT TITLES'], [String(total), 'COPIES IN STOCK'], [String(books.filter(b => b.hiddenGem).length), 'HIDDEN GEMS']].forEach(([number, label], i) => {
    const x = 46 + i * 172; doc.roundedRect(x, metricsY, 159, 65, 7).fill('#e5eadd');
    doc.fillColor(green).font('Bold').fontSize(23).text(number, x + 12, metricsY + 9, { width: 135 });
    doc.font('Body').fontSize(8).text(label, x + 12, metricsY + 43, { width: 135 });
  }); doc.y = metricsY + 83;
  if (run) {
    heading('Curated cultural experiences');
    paragraph(`Qloo-supported proposals | Run revision ${run.revision} | ${run.algorithmVersion ?? 'curator-v1'}. Editorial interpretations are separate from Qloo evidence.`);
    for (const id of run.selected) {
      const proposal = run.proposals.find(p => p.id === id)!;
      room(155); heading(proposal.title);
      paragraph(`${proposal.duration} minutes | ${proposal.curator} | Score ${proposal.score?.toFixed(1) ?? 'Unverified'} / 100`, 10, '#856a35');
      paragraph('Central idea: ' + proposal.interpretation);
      paragraph('Books: ' + proposal.bookIds.map(id => { const b = books.find(b => b.id === id); return `${b?.title ?? id} (${b?.stock ?? 0} copies)`; }).join('; '));
      paragraph('Cultural references: ' + proposal.edgeIds.map(id => { const e = run.edges.find(e => e.id === id); return `${e?.name ?? ''} [Qloo affinity ${e?.affinity.toFixed(3) ?? 'unavailable'}]`; }).join('; '));
      if (proposal.factors) paragraph('Why recommended: ' + Object.entries(proposal.factors).map(([k,v]) => `${k} = ${v.toFixed(3)}`).join(' | '), 9);
    }
    heading('Evidence and limits');
    paragraph('Source: Qloo Insights API, hackathon environment. Affinities describe aggregate cultural relationships, not an individual probability or proof of thematic suitability. Fixed query-specific normalization references were retained during repair.');
  } else if (name.includes('event')) {
    heading('Event drafts');
    const events = Array.isArray(data) ? data : data?.event ? [data.event] : workspace?.events ?? [];
    for (const event of events) {
      heading(String(event.title ?? 'Untitled event')); paragraph(`${event.theme ?? ''} | ${event.date ?? ''} ${event.time ?? ''} | ${event.capacity ?? '-'} places | ${event.status ?? 'Draft'}`);
      const programme = event.programme ?? createProgramme(books.filter(book => book.hiddenGem && book.stock > 0));
      const timing = programmeTiming(programme);
      paragraph(`Evening programme | ${timing.elapsed} minutes | ${clockAt(event.time ?? '19:00', 0)}-${clockAt(event.time ?? '19:00', timing.elapsed)}`);
      for (const issue of timing.issues) paragraph('Timing review: ' + issue, 9);
      for (const segment of timing.ordered) {
        room(260); heading(segment.title);
        paragraph(`${clockAt(event.time ?? '19:00', segment.offset)}-${clockAt(event.time ?? '19:00', segment.offset+segment.duration)} | ${segment.duration} minutes`, 9, '#856a35');
        paragraph(segment.description);
        const linked = books.filter(book => segment.bookIds.includes(book.id));
        if (linked.length) paragraph('Featured books: ' + linked.map(book => `${book.title} (${book.stock} copies)`).join('; '), 9);
        paragraph('Ideas to try', 10, green);
        for (const idea of segmentIdeas(segment, books).slice(0,3)) paragraph('- ' + idea, 9);
        paragraph('Host preparation: ' + segment.notes, 9, '#657368');
      }
    }
    paragraph('These are editable event drafts. Cultural references on the original demo screens are illustrative.', 9);
  } else if (name.includes('discovery')) {
    heading('Editorial discovery snapshot');
    paragraph('This report exports the original demonstration workspace. Its shared-tag matches are illustrative, not live Qloo affinities. For actual evidence use Export PDF inside Event Studio.');
  }
  heading('The bookshop collection');
  for (const book of books) {
    doc.font('Bold').fontSize(11); const h = doc.heightOfString(book.title, { width: 385 }); room(Math.max(54, h + 35));
    const y = doc.y; doc.font('Bold').fontSize(11).fillColor(green).text(book.title, 46, y, { width: 385 });
    doc.font('Bold').fontSize(10).text(`${book.stock} copies`, 440, y, { width: 109, align: 'right' });
    doc.font('Body').fontSize(9).fillColor('#647164').text(`${book.author}${book.hiddenGem ? ' | Hidden gem' : ''}`, 46, y + h + 5, { width });
    doc.y = y + h + 28; doc.moveTo(46, doc.y).lineTo(549, doc.y).strokeColor('#dbe1d2').stroke(); doc.y += 12;
  }
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i); doc.save();
    const bottomMargin = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(46, 797).lineTo(549, 797).strokeColor(gold).stroke();
    doc.font('Body').fontSize(8).fillColor('#657368').text('FolioEcho | Private bookshop report', 46, 807, { width: 350, lineBreak: false });
    doc.text(`${i + 1} / ${pages.count}`, 485, 807, { width: 64, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottomMargin; doc.restore();
  }
  doc.end(); return finished;
}
