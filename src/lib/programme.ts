import type { Book } from './catalogue.ts';
export type SegmentKind = 'welcome' | 'reading' | 'listening' | 'discussion' | 'closing' | 'custom';
export interface ProgrammeSegment { id: string; kind: SegmentKind; title: string; offset: number; duration: number; description: string; notes: string; bookIds: string[] }
export interface EventDraft { id: string; title: string; date: string; time: string; capacity: number; status: string; theme: string; programme?: ProgrammeSegment[] }

export function createProgramme(books: Book[]): ProgrammeSegment[] {
  const bookIds = books.map(b => b.id);
  return [
    { id: 'welcome', kind: 'welcome', title: 'Welcome & a first connection', offset: 0, duration: 10, description: 'Welcome readers, introduce the featured books and invite everyone to share one word they associate with the evening’s theme.', notes: 'Arrange the books where everyone can see them. Have a short host introduction ready.', bookIds },
    { id: 'reading', kind: 'reading', title: 'Readings from the shelves', offset: 10, duration: 20, description: 'Introduce a short passage from each featured book. Leave a moment of quiet after each reading, then invite a first impression.', notes: 'Choose and mark short passages in advance. Confirm the reader and any permissions needed.', bookIds },
    { id: 'listening', kind: 'listening', title: 'Listening & cultural connections', offset: 30, duration: 15, description: 'Introduce a cultural reference you have reviewed, listen briefly, and compare the atmosphere with the passages just read.', notes: 'Confirm the chosen reference, playback permissions, speaker volume and a backup plan. This draft does not select a verified track.', bookIds },
    { id: 'discussion', kind: 'discussion', title: 'Conversation & shared discoveries', offset: 45, duration: 20, description: 'Move from individual impressions to a guided conversation. Encourage different readings and invite quieter guests to contribute if they wish.', notes: 'Prepare two opening questions and one follow-up. Participation should always be optional.', bookIds },
    { id: 'closing', kind: 'closing', title: 'A book to take the evening home', offset: 65, duration: 10, description: 'Invite readers to name one discovery, recap the featured titles and leave time to browse or ask the bookseller for a personal recommendation.', notes: 'Recheck the available copies and prepare a small display. Purchases and reservations are handled by staff.', bookIds },
  ];
}
export function clockAt(start: string, offset: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(start);
  const minutes = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  const value = ((minutes + offset) % 1440 + 1440) % 1440;
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
export function offsetAt(start: string, time: string): number {
  const minutes = (value: string) => Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
  return (minutes(time) - minutes(start) + 1440) % 1440;
}
export function programmeTiming(segments: ProgrammeSegment[]) {
  const ordered = [...segments].sort((a,b) => a.offset-b.offset || a.id.localeCompare(b.id));
  const issues: string[] = []; let end = 0;
  for (const segment of ordered) {
    if (segment.offset > end) issues.push(`${segment.offset-end}-minute gap before “${segment.title}”.`);
    if (segment.offset < end) issues.push(`“${segment.title}” overlaps another segment by ${Math.min(end-segment.offset, segment.duration)} minutes.`);
    end = Math.max(end, segment.offset + segment.duration);
  }
  return { ordered, issues, elapsed: end, active: segments.reduce((n,s) => n+s.duration, 0) };
}
export function segmentIdeas(segment: ProgrammeSegment, books: Book[]): string[] {
  const linked = books.filter(b => segment.bookIds.includes(b.id));
  const names = linked.map(b => `“${b.title}”`).join(', ') || 'the books you select';
  const themes = [...new Set(linked.flatMap(b => b.tags))].slice(0,3).join(', ') || 'the evening’s theme';
  switch (segment.kind) {
    case 'welcome': return [
      `Create a small display of ${names}. Give each title a 30-second introduction: author, why your shop chose it, and one open question.`,
      `Invite guests to choose a word from ${themes}. Ask: “What made you choose that word?” Offer the option simply to listen.`,
      'Try a two-minute conversation in pairs: “Which book has stayed with you recently?” Invite a few volunteers to share.',
      'Explain the running order and make newcomers comfortable: point out seats, facilities, browsing time and how to join the discussion.',
    ];
    case 'reading': return [
      `Choose a 2–3-minute passage from each of ${names}. Before reading, give only the context needed to follow the passage.`,
      `Use ${themes} as a reading prompt. Ask guests to notice a place, an image or a change in rhythm rather than search for a “correct” interpretation.`,
      'Offer two contrasting readings, then ask: “What changed in the mood or the voice?” Leave a short pause before inviting responses.',
      'Invite a staff member or willing reader to read a second passage. Check their comfort and prepare a marked copy beforehand.',
    ];
    case 'listening': return [
      'Play a short, permitted excerpt from a cultural reference you have reviewed. Invite guests to note one image, emotion or contrast it brings to mind.',
      `Return to a passage from ${names}. Ask: “Does the music change how you hear these words?” Accept both connections and disagreements.`,
      'Use a quiet listening minute followed by conversation in pairs. Share impressions before explaining any Qloo discovery signal, so the data does not dictate reactions.',
      'If playback is impractical, discuss an artist or film reference without playing it, or replace this segment with a second reading.',
    ];
    case 'discussion': return [
      `Start with “Which image from ${names} would you take home, and why?” Invite responses grounded in the passages rather than assumed knowledge of the full book.`,
      `Choose one thread from ${themes}. Ask: “Where did the books approach this differently?” Let readers point to a phrase or moment.`,
      'Try a three-minute pair discussion, then collect one question from each pair. Choose two questions for the whole group.',
      'Ask “Who might you recommend one of these books to?” Keep personal sharing optional and welcome readers who prefer to pass.',
    ];
    case 'closing': return [
      `Give a brief reminder of ${names}, their authors and the copies currently available. Offer staff help with choosing a starting point.`,
      'Invite each guest to leave a one-sentence recommendation or a question on a card beside the book display.',
      'Close with “What would you like us to explore next?” Use the responses as ideas for a future evening.',
      'Leave a few unhurried minutes for browsing. If a title has sold out, discuss ordering options rather than promising stock.',
    ];
    default: return ['Describe the activity, the host and the intended outcome.', 'Connect the activity to a selected book or a cultural reference you have checked.', 'List equipment or preparation needed, and a simple alternative if plans change.'];
  }
}
export function validProgramme(value: unknown): value is ProgrammeSegment[] {
  if (!Array.isArray(value) || !value.length || value.length > 10) return false;
  const ids = new Set<string>();
  return value.every(s => {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || s.id.length > 100 || ids.has(s.id)) return false;
    ids.add(s.id);
    return ['welcome','reading','listening','discussion','closing','custom'].includes(s.kind) && typeof s.title === 'string' && s.title.trim().length > 0 && s.title.length <= 150 && Number.isSafeInteger(s.offset) && s.offset >= 0 && s.offset <= 1440 && Number.isSafeInteger(s.duration) && s.duration >= 1 && s.duration <= 180 && typeof s.description === 'string' && s.description.length <= 2500 && typeof s.notes === 'string' && s.notes.length <= 1500 && Array.isArray(s.bookIds) && s.bookIds.length <= 25 && s.bookIds.every((id: unknown) => typeof id === 'string' && id.length <= 100) && new Set(s.bookIds).size === s.bookIds.length;
  });
}
