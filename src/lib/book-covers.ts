import covers from '../data/book-covers.json' with { type: 'json' };

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Match bibliographic identity rather than reusable workspace IDs. */
export function bookCover(book: { title: string; author: string }) {
  const key = `${normalize(book.title)}|${normalize(book.author)}`;
  return covers.find(cover => cover.key === key);
}
