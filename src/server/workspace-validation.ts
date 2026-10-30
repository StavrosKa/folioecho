import { validProgramme, type EventDraft } from '../lib/programme.ts';
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit;
export function validateDrafts(value: unknown): asserts value is EventDraft[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid event drafts.');
  const ids = new Set<string>();
  for (const e of value) {
    if (!e || !text(e.id, 300) || !e.id || ids.has(e.id) || !text(e.title, 300) || !text(e.theme, 2000) ||
      !text(e.date, 10) || (e.date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !Number.isFinite(Date.parse(e.date)) || new Date(e.date).toISOString().slice(0,10) !== e.date)) ||
      !text(e.time, 5) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) ||
      !Number.isSafeInteger(e.capacity) || e.capacity < 1 || e.capacity > 1000 || !['Draft','In review','Ready for owner review'].includes(e.status)) throw new Error('Invalid event draft fields. Check dates, times, capacity and unique IDs.');
    ids.add(e.id);
    if (e.programme !== undefined && !validProgramme(e.programme)) throw new Error('Invalid event programme.');
    if (e.source !== undefined) {
      const s=e.source;
      if (!s || !text(s.runId,200) || !text(s.proposalId,200) || !Number.isSafeInteger(s.revision) || s.revision<1 || !['listening','cinema','mixed'].includes(s.curator) || !Number.isSafeInteger(s.duration) || s.duration<1 || s.duration>600 ||
        !Array.isArray(s.bookIds) || s.bookIds.length>25 || s.bookIds.some((id:unknown)=>!text(id,200)) || !Array.isArray(s.references) || s.references.length>100 || s.references.some((r:any)=>!r||!text(r.name,300)||!text(r.entityId,200)||!['artist','movie'].includes(r.type)||!Number.isFinite(r.affinity))) throw new Error('Invalid event source snapshot.');
    }
  }
}
