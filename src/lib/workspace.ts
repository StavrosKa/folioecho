import { demoBooks, type Book } from "./catalogue.ts";
import type { EventDraft } from './programme.ts';

// Public sample titles; stock quantities are illustrative. Selected gems have confirmed Qloo matches.
export const sampleBooks: Book[] = [
  {id:'hg-fair-play',title:'Fair Play',author:'Tove Jansson',stock:4,tags:['art','creativity','travel'],hiddenGem:true},
  {id:'hg-the-tanners',title:'The Tanners',author:'Robert Walser',stock:3,tags:['family','identity','travel'],hiddenGem:true},
  {id:'hg-the-peregrine',title:'The Peregrine',author:'J. A. Baker',stock:2,tags:['nature','introspection','identity'],hiddenGem:true},
  ...demoBooks.filter(book=>!book.hiddenGem),
  {
    id: "b6",
    title: "The Summer Book",
    author: "Tove Jansson",
    stock: 6,
    tags: ["nature", "memory", "family"],
    hiddenGem: false,
  },
  {
    id: "b7",
    title: "Ways of Seeing",
    author: "John Berger",
    stock: 4,
    tags: ["art", "identity", "creativity"],
    hiddenGem: false,
  },
  {
    id: "b8",
    title: "The City & the City",
    author: "China Miéville",
    stock: 2,
    tags: ["cities", "imagination", "mystery"],
    hiddenGem: false,
  },
  {
    id: "b9",
    title: "A Field Guide to Getting Lost",
    author: "Rebecca Solnit",
    stock: 3,
    tags: ["travel", "nature", "identity"],
    hiddenGem: false,
  },
  {
    id: "b10",
    title: "Bluets",
    author: "Maggie Nelson",
    stock: 0,
    tags: ["art", "introspection", "memory"],
    hiddenGem: false,
  },
  {
    id: "b11",
    title: "Just Kids",
    author: "Patti Smith",
    stock: 7,
    tags: ["music", "cities", "creativity"],
    hiddenGem: false,
  },
  {
    id: "b12",
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    stock: 8,
    tags: ["imagination", "travel", "friendship"],
    hiddenGem: false,
  },
];
export const initialEvents: EventDraft[] = [
  {
    id: "e1",
    title: "Art, friendship & small worlds",
    date: "2026-11-06",
    time: "19:00",
    capacity: 24,
    status: "Draft",
    theme: "Literature, jazz & conversation",
  },
  {
    id: "e2",
    title: "Wandering & the art of attention",
    date: "2026-11-13",
    time: "18:30",
    capacity: 18,
    status: "In review",
    theme: "Memory, nature & ambient listening",
  },
];
export const bookNotes: Record<string, string> = {
  b1: "A gateway to cities, imagination and travel.",
  b2: "A bridge to solitude and urban life.",
  b3: "Memory, rhythm and inner voices.",
};
