export function liveEstimate(titles: number, selected: number, referenceTypes: number) {
  const lookups = titles + selected * referenceTypes;
  // Planning estimate: 10 seconds per lookup, three slots, plus a two-minute margin.
  const minutes = Math.max(1, Math.ceil(Math.ceil(lookups / 3) * 10 / 60));
  return { lookups, label: `~${minutes}–${minutes + 2} min` };
}
