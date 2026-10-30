import DraftSourceStatus from './DraftSourceStatus';
import OverviewShowcase from './OverviewShowcase';
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { type Book } from "../lib/catalogue";
import { bookCover } from '../lib/book-covers';
import ComparisonResults from './ComparisonResults';
import EvidenceMap from './EvidenceMap';
import { sampleBooks, initialEvents } from "../lib/workspace";
import Icon from "./Icon";
import NotificationCenter from "./NotificationCenter";
import NotificationSettings from "./NotificationSettings";
import { notify } from "../lib/notifications";
import "./catalogue.css";
import LiveStudio from "./LiveStudio";
import CatalogueImportGuide from "./CatalogueImportGuide";
import { readCatalogueFile, catalogueFileTypes } from "../lib/import-catalogue";
import { downloadPDF } from "../lib/export";
import HelpGuide from "./HelpGuide";
import OpenAISettings from "./OpenAISettings";
import CategoryArt from "./CategoryArt";
import { groupedCategories,categoryGroups,type CategoryMapping,type CategoryId } from "../lib/category-groups";
import EveningProgramme from './EveningProgramme';
import { createProgramme,type EventDraft } from '../lib/programme';

type Page =
  | "live"
  | "overview"
  | "catalogue"
  | "discovery"
  | "map"
  | "planner"
  | "compare"
  | "reports"
  | "settings"
  | "usage"
  | "help";
const pageNames: Record<Page, string> = {
  live: "Event Studio",
  overview: "Overview",
  catalogue: "Catalogue",
  discovery: "Discovery Studio",
  map: "Cultural Map",
  planner: "Event Planner",
  compare: "Compare Results",
  reports: "Reports",
  settings: "Settings",
  usage: "Usage & Billing",
  help: "Help & guide",
};
const navGroups: { label: string; items: { page: Page; icon: string }[] }[] = [
  {
    label: "Workspace",
    items: [
      { page: "overview", icon: "home" },
      { page: "catalogue", icon: "book" },
      { page: "discovery", icon: "compass" },
      { page: "live", icon: "network" },
    ],
  },
  {
    label: "Planning",
    items: [
      { page: "planner", icon: "calendar" },
      { page: "map", icon: "network" },
      { page: "compare", icon: "chart" },
    ],
  },
  {
    label: "Manage",
    items: [
      { page: "settings", icon: "settings" },
      { page: "usage", icon: "billing" },
      { page: "reports", icon: "file" },
    ],
  },
];
function Artwork({
  book,
  className = "",
}: {
  book?: Book;
  className?: string;
}) {
  const cover = book ? bookCover(book) : undefined;
  const [failedSrc, setFailedSrc] = useState<string>();
  if (cover && failedSrc !== cover.src) return (
    <div className={'artwork actual-cover ' + className}>
      <img src={cover.src} alt={`Cover of ${book!.title} by ${book!.author}`} loading="lazy" decoding="async" onError={() => setFailedSrc(cover.src)} />
    </div>
  );
  return !book ? (
    <div
      role="img"
      aria-label={
        "Illustrative music artwork"
      }
      className={"artwork art-3 " + className}
    />
  ) : (
    <div className={"fallback-cover " + className}>
      <span>FOLIOECHO COLLECTION</span>
      <strong>{book?.title}</strong>
      <small>{book?.author}</small>
      <i>✧</i>
    </div>
  );
}
function Chip({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={"chip " + tone}>{children}</span>;
}
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function saveFile(name: string, value: unknown) {
  void downloadPDF(name, value);
}

export default function Catalogue() {
  const [page, setPage] = useState<Page>("overview");
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [removedCategory,setRemovedCategory]=useState<{bookId:string;tag:string;index:number}|null>(null);
  const [categoryFilter,setCategoryFilter]=useState<CategoryId|null>(null);
  const [categoryMapping,setCategoryMapping]=useState<CategoryMapping|null>(null);
  const [categoryBusy,setCategoryBusy]=useState(false);
  const [categoryNotice,setCategoryNotice]=useState('');
  useEffect(()=>{
    let active=true;
    void fetch('/api/categories',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Could not load category grouping');return response.json();}).then(data=>{if(active)setCategoryMapping(data.mapping);}).catch(()=>{if(active)setCategoryNotice('Saved grouping is unavailable. Default thematic groups are shown.');});
    return()=>{active=false;};
  },[]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (notice && !/preparing|exported/i.test(notice)) notify('Workspace updated', notice, 'success', notice); }, [notice]);
  useEffect(() => { if (error) notify('Action needs attention', 'Please review the message shown in your workspace.', 'error', error); }, [error]);
  const [events, setEvents] = useState(initialEvents);
  const [importing, setImporting] = useState(false);
  const [importGuide, setImportGuide] = useState(false);
  const [deletedDraft, setDeletedDraft] = useState<{ event: (typeof initialEvents)[number]; index: number; selected: boolean } | null>(null);
  const [eventId, setEventId] = useState("e1");
  const [profile, setProfile] = useState({
    name: "Anna Papadopoulou",
    shop: "The Reading Room",
    city: "Athens, Greece",
    email: "anna@example.com",
    photo: "",
  });
  const [profileDraft, setProfileDraft] = useState(profile);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loading workspace…');
  const savedWorkspace = useRef('');
  useEffect(() => {
    let active = true;
    void fetch('/api/workspace').then(r => { if (!r.ok) throw new Error('Workspace unavailable'); return r.json(); }).then(({ workspace }) => {
      if (!active) return;
      if (workspace) { savedWorkspace.current = JSON.stringify({books:workspace.books,profile:workspace.profile,events:workspace.events}); setBooks(workspace.books); setEvents(workspace.events); setProfile(workspace.profile); setProfileDraft(workspace.profile); }
      setLoaded(true);
    }).catch(() => { if (active) { setError('Could not load saved workspace. Reload before editing to avoid overwriting it.'); setSaveStatus('Storage unavailable'); } });
    const errorListener = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('folioecho-error', errorListener);
    return () => { active = false; window.removeEventListener('folioecho-error', errorListener); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const snapshot = JSON.stringify({ books, profile, events });
    if (snapshot === savedWorkspace.current) { setSaveStatus('Saved'); return; }
    const initialSave = !savedWorkspace.current;
    setSaveStatus('Saving…');
    const timer = setTimeout(() => {
      void fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: snapshot }).then(async response => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Save failed');
        savedWorkspace.current = snapshot;
        setSaveStatus('Saved');
        if (!initialSave) notify('Changes saved', 'Your catalogue, profile and event drafts are saved.', 'success', 'workspace-save');
      }).catch(e => { setSaveStatus('Not saved'); setError(e.message); });
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, books, profile, events]);
  async function uploadShopPhoto(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a photo up to 2 MB.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
      setProfileDraft(current => ({ ...current, photo: canvas.toDataURL('image/webp', .85) }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid image.'); }
  }

  const gems = books.filter((b) => b.hiddenGem);
  const totalCopies = books.reduce((sum, book) => sum + book.stock, 0);
  const available = books.filter((b) => b.stock > 0);
  const categoryCards=useMemo(()=>groupedCategories(books,categoryMapping),[books,categoryMapping]);
  const clusters:[string,number][]=categoryCards.map(group=>[group.name,group.count]);
  const catalogueListRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(page!=='catalogue')return;
    const container=catalogueListRef.current,table=container?.querySelector('table');
    if(!container||!table)return;
    const measure=()=>{
      const rows=Array.from(table.tBodies[0]?.rows??[]).slice(0,5);
      const height=(table.tHead?.getBoundingClientRect().height??0)+rows.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);
      container.style.setProperty('--catalogue-list-height',Math.ceil(height+container.offsetHeight-container.clientHeight+2)+'px');
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(table);
    return()=>observer.disconnect();
  },[page,books,query,filter,categoryFilter,categoryMapping]);
  useEffect(()=>{if(catalogueListRef.current)catalogueListRef.current.scrollTop=0;},[page,query,filter,categoryFilter]);
  function removeBookCategory(bookId:string,tag:string){
    const book=books.find(item=>item.id===bookId);if(!book)return;
    setRemovedCategory({bookId,tag,index:book.tags.indexOf(tag)});
    setBooks(current=>current.map(item=>item.id===bookId?{...item,tags:item.tags.filter(value=>value!==tag)}:item));
  }
  function undoCategoryRemoval(){
    if(!removedCategory)return;
    const {bookId,tag,index}=removedCategory;
    setBooks(current=>current.map(book=>{
      if(book.id!==bookId||book.tags.includes(tag))return book;
      const tags=[...book.tags];tags.splice(Math.max(0,Math.min(index,tags.length)),0,tag);return {...book,tags};
    }));setRemovedCategory(null);
  }
  async function refineCategories(){
    setCategoryBusy(true);setCategoryNotice('');setError('');
    try{
      const tags=[...new Set(books.flatMap(book=>book.tags.map(tag=>tag.trim().toLowerCase())))];
      const response=await fetch('/api/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tags})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??'Category refinement failed.');
      setCategoryMapping(data.mapping);setCategoryNotice('Categories and backgrounds updated with Gemini.');
    }catch(error){setError(error instanceof Error?error.message:'Category refinement failed.');}
    finally{setCategoryBusy(false);}
  }
  const ready = gems.length >= 3 && gems.length <= 5;
  const selectedEvent = events.find((e) => e.id === eventId) ?? events[0] ?? initialEvents[0];
  const selectedProgramme = selectedEvent.programme ?? createProgramme(books.filter(book=>book.hiddenGem&&book.stock>0));
  function go(next: Page) {
    setPage(next);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function toggle(id: string) {
    const book = books.find((b) => b.id === id)!;
    if (!book.hiddenGem && gems.length >= 5) {
      setError("Choose up to five hidden gems.");
      return;
    }
    setBooks(
      books.map((b) => (b.id === id ? { ...b, hiddenGem: !b.hiddenGem } : b)),
    );
    setError("");
  }
  async function upload(file?: File) {
    if (!file || importing) return;
    setImporting(true);
    try {
      const next = await readCatalogueFile(file);
      setBooks(next);
      setError("");
      setNotice(
        "Imported " +
          next.length +
          " titles. Category signals updated from your tags.",
      );
      setPage("catalogue");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not import the catalogue.",
      );
    } finally { setImporting(false); }
  }
  function updateStock(id: string, value: string) {
    const stock = Number(value);
    if (Number.isSafeInteger(stock) && stock >= 0)
      setBooks(books.map((b) => (b.id === id ? { ...b, stock } : b)));
  }
  function planStudioEvent(draft:EventDraft){
    const exists=events.some(event=>event.id===draft.id);
    setEvents(current=>{const existing=current.find(event=>event.id===draft.id);return [existing??draft,...current.filter(event=>event.id!==draft.id)];});
    setEventId(draft.id);go('planner');
    setNotice(exists?'Opened the existing Event Studio draft. Your edits were kept.':'Event Studio proposal added to your drafts. Choose a date and review the programme.');
  }
  function createEvent() {
    const id = "e" + Date.now();
    setEvents([
      ...events,
      {
        id,
        title: "Untitled cultural evening",
        date: "2026-11-20",
        time: "19:00",
        capacity: 20,
        status: "Draft",
        theme: "Books, music & conversation",
      },
    ]);
    setEventId(id);
    go("planner");
  }
  function deleteEvent(id: string) {
    const index = events.findIndex(event => event.id === id);
    if (index < 0) return;
    const selected = selectedEvent.id === id;
    const remaining = events.filter(event => event.id !== id);
    setDeletedDraft({ event: events[index], index, selected });
    setEvents(remaining);
    if (selected) setEventId(remaining[Math.min(index, remaining.length - 1)]?.id ?? "");
  }
  function undoDeleteEvent() {
    if (!deletedDraft) return;
    setEvents(current => {
      if (current.some(event => event.id === deletedDraft.event.id)) return current;
      const restored = [...current];
      restored.splice(Math.min(deletedDraft.index, restored.length), 0, deletedDraft.event);
      return restored;
    });
    if (deletedDraft.selected || !events.length) setEventId(deletedDraft.event.id);
    setDeletedDraft(null);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-zone">
          <div className="brand-lockup" role="img" aria-label="FolioEcho — Where books find their audience.">
            <div className="brand-wordmark">
              <svg className="brand-symbol" viewBox="0 0 88 56" fill="none" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10Q20 2 36 10Q52 2 68 10V47Q52 39 36 48Q20 39 4 47Z M36 10V48" />
                  <path d="M11 17Q20 13 29 17 M11 25Q20 21 29 25 M11 33Q20 29 29 33 M43 17Q52 13 61 17 M43 25Q52 21 61 25 M43 33Q52 29 61 33 M74 15Q84 28 74 41 M80 9Q94 28 80 47" />
                </g>
              </svg>
              <span>FolioEcho</span>
            </div>
            <span className="brand-tagline">Where books find their audience.</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">
                {group.label}
                <span>−</span>
              </p>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  className={"nav-item " + (page === item.page ? "active" : "")}
                  aria-current={page === item.page ? "page" : undefined}
                  onClick={() => go(item.page)}
                >
                  <Icon name={item.icon} />
                  <span>{pageNames[item.page]}</span>
                  {item.page === "catalogue" && <small title="Physical copies in stock across all titles; different from the distinct title count." aria-label={`${totalCopies} total copies in stock`}>{totalCopies}</small>}
                  {item.page === "discovery" && <small title="Selected hidden gems" aria-label={`${gems.length} selected hidden gems`}>{gems.length}</small>}
                  {item.page === "planner" && <small>{events.length}</small>}
                </button>
              ))}
            </div>
          ))}
          <button className="help-button" onClick={()=>go('help')}><Icon name="help" size={17}/>Help &amp; guide<Icon name="arrow" size={14}/></button>
        </nav>
        <div className="profile-zone">
          <p className="nav-label">Your bookshop</p>
          <div className="profile-person">
            <img className="avatar user-avatar" src={profile.photo || "/sample-avatar.jpg"} alt={profile.photo ? "Your profile photo" : "Sample profile portrait"} width="36" height="36" />
            <div>
              <strong>{profile.name}</strong>
              <small>Owner · Administrator</small>
            </div>
          </div>
          <strong className="shop-name">{profile.shop}</strong>
          <span className="location">
            <Icon name="pin" size={13} />
            {profile.city}
          </span>
          <div className="profile-stats">
            <span>
              Catalogue<strong title={`${totalCopies} physical copies across ${books.length} distinct titles. ${available.length} titles have stock; ${books.length-available.length} have none.`}>{totalCopies} copies · {books.length} titles</strong>
            </span>
            <span>
              Workspace<strong>Local</strong>
            </span>
          </div>
          <p className="session-status">
            <i />
            {saveStatus}
          </p>

        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Workspace <span>/</span>
            <b>{pageNames[page]}</b>
          </div>
          <div className="top-actions">
            <Chip tone="gold">{page === "live" ? "Qloo Event Studio" : "Demo workspace"}</Chip>
            <NotificationCenter />
            <label className="upload-button catalogue-import-button" role="button" tabIndex={0} aria-disabled={importing} onKeyDown={event => { if (!importing && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.currentTarget.querySelector('input')?.click(); } }}>
              <Icon name="upload" size={17} />
              {importing ? 'Importing…' : 'Import catalogue'}
              <input
                type="file"
                accept={catalogueFileTypes}
                disabled={importing}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" className="catalogue-import-help" onClick={() => setImportGuide(true)} aria-haspopup="dialog"><Icon name="help" size={16} />Import guide</button>
          </div>
        </header>
        <div className="page-body">
          {page !== "live" && (
          <div className="page-heading">
            <div>
              <h1>{pageNames[page]}</h1>
              <p>
                {page === "usage"
                  ? "Manage connected services, personal API keys and your app usage."
                  : page === "catalogue"
                    ? "Your inventory is the starting point for every discovery."
                    : page === "planner"
                      ? "Shape a cultural evening around the books you have."
                      : "Your bookshop, connected through culture."}
              </p>
            </div>
            {page !== "usage" && <button className="primary create-event" onClick={createEvent}>
              Create event
              <Icon name="arrow" size={18} />
            </button>}
          </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Icon name="check" size={16} />
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div hidden={page !== "live"}><LiveStudio books={books} setBooks={setBooks} onPlanEvent={planStudioEvent} onCompare={()=>go("compare")} active={page==='live'} /></div>
          {page === "discovery" && <div className="discovery-workspace">
            <section className="discovery-summary"><div><span className="discovery-eyebrow">CURATE YOUR NEXT DISCOVERY</span><h2>A small selection. New possibilities.</h2><p>Your hidden gems, connected through saved Qloo evidence.</p></div><div className="discovery-totals"><span><b>{gems.length}</b>hidden gems</span><span><b>{gems.reduce((sum,book)=>sum+book.stock,0)}</b>copies in stock</span></div></section>
            <div className="discovery-grid">
              <Panel className="discovery-collection" title="Your hidden gems" subtitle="Books you want more readers to discover." action={<button className="small-button" onClick={()=>go('catalogue')}><Icon name="edit" size={14}/>Edit selection</button>}>
                <div className="discovery-selection-list" role="region" aria-label="Selected hidden gems" tabIndex={0}><div className="book-grid">{gems.map(book=><article className="book-card" key={book.id}><div className="cover-button"><Artwork book={book}/><span className="stock-badge">{book.stock} in stock</span></div><b className="book-title">{book.title}</b><p className="author">{book.author}</p><div className="tags">{book.tags.slice(0,3).map(tag=><Chip key={tag}>{tag}</Chip>)}</div><button className="discovery-open-direction" onClick={()=>go('live')}>Explore in Event Studio<Icon name="arrow" size={14}/></button></article>)}</div>{!gems.length&&<p>Select hidden gems in Catalogue to begin.</p>}</div>
              </Panel>
              <EvidenceMap onStudio={()=>go('live')}/>
            </div>
          </div>}
          {page === "map" && <EvidenceMap onStudio={()=>go('live')}/>}
          {page === "catalogue" && (
            <div className="catalogue-layout">
              <Panel
                className="collection-panel"
                title="Your collection"
                subtitle={
                  books.length +
                  " distinct titles · " + books.reduce((sum, book) => sum + book.stock, 0) + " copies in stock · " +
                  available.length +
                  " available · " +
                  (books.length - available.length) +
                  " unavailable"
                }
                action={
                  <button
                    onClick={() => saveFile("folioecho-catalogue.json", books)}
                  >
                    <Icon name="download" size={16} />
                    Export PDF
                  </button>
                }
              >
                <div className="catalogue-toolbar">
                  <div className="search-box">
                    <Icon name="search" size={17} />
                    <input
                      aria-label="Search catalogue"
                      placeholder="Search title, author or tag…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter catalogue"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All titles</option>
                    <option value="available">In stock</option>
                    <option value="gems">Hidden gems</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                  <span className="muted">
                    {gems.length} / 5 hidden gems selected
                  </span>
                </div>
                {categoryFilter&&<div className="category-filter-notice"><span>Category: {categoryGroups.find(group=>group.id===categoryFilter)?.name}</span><button onClick={()=>setCategoryFilter(null)} aria-label="Clear category filter">All categories <Icon name="close" size={13}/></button></div>}
                {removedCategory&&<div className="category-removal-notice" role="status"><span>Removed “{removedCategory.tag}” from {books.find(book=>book.id===removedCategory.bookId)?.title??'the book'}.</span><button onClick={undoCategoryRemoval} disabled={!books.some(book=>book.id===removedCategory.bookId)}>Undo</button><button onClick={()=>setRemovedCategory(null)} aria-label="Dismiss category removal notice"><Icon name="close" size={14}/></button></div>}
                <div className="table-wrap catalogue-scroll" ref={catalogueListRef} tabIndex={0} role="region" aria-label="Catalogue books — scroll to view more">
                  <table className="catalogue-table">
                    <colgroup><col className="catalogue-book-column"/><col/><col className="catalogue-stock-column"/><col className="catalogue-gem-column"/></colgroup>
                    <thead>
                      <tr>
                        <th>Book / Author</th>
                        <th>Category signals</th>
                        <th>Stock</th>
                        <th>Hidden gem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books
                        .filter(
                          (b) =>
                            (!categoryFilter || !!categoryCards.find(group=>group.id===categoryFilter)?.bookIds.includes(b.id)) &&
                            (b.title + " " + b.author + " " + b.tags.join(" "))
                              .toLowerCase()
                              .includes(query.toLowerCase()) &&
                            (filter === "all" ||
                              (filter === "available" && b.stock > 0) ||
                              (filter === "gems" && b.hiddenGem) ||
                              (filter === "unavailable" && !b.stock)),
                        )
                        .map((b) => (
                          <tr key={b.id}>
                            <td>
                              <div className="table-book">
                                <Artwork book={b} />
                                <div>
                                  <strong>{b.title}</strong>
                                  <small>{b.author}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="tags">
                                {b.tags.map((t) => (
                                  <span className="chip removable-category" key={t}><span>{t}</span><button type="button" onClick={()=>removeBookCategory(b.id,t)} aria-label={`Remove category ${t} from ${b.title}`} title="Remove category"><Icon name="close" size={12}/></button></span>
                                ))}
                                {!b.tags.length&&<span className="empty-category-label">No categories</span>}
                              </div>
                            </td>
                            <td>
                              <input
                                className="stock-input"
                                aria-label={"Stock for " + b.title}
                                type="number"
                                min="0"
                                step="1"
                                value={b.stock}
                                onChange={(e) =>
                                  updateStock(b.id, e.target.value)
                                }
                              />
                              <small
                                className={!b.stock ? "warning-text" : "muted"}
                              >
                                {b.stock ? "Available" : "Excluded"}
                              </small>
                            </td>
                            <td>
                              <button
                                className={
                                  "gem-button " +
                                  (b.hiddenGem ? "selected" : "")
                                }
                                aria-pressed={b.hiddenGem}
                                onClick={() => toggle(b.id)}
                              >
                                <Icon name="gem" size={15} />
                                {b.hiddenGem ? "Selected" : "Select"}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel-footer">
                  <span>
                    Only available titles can enter a plan. Select 3–5 hidden
                    gems.
                  </span>
                  <button
                    className="primary"
                    disabled={!ready}
                    onClick={() => go("live")}
                  >
                    Explore connections
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </Panel>
              <Panel
                className="categories-panel"
                title="Emerging categories"
                subtitle={categoryMapping?'Up to 8 themes · Gemini-assisted grouping of your tags · counts are distinct books.':'Related tags combined into up to 8 themes · counts are distinct books.'}
                action={<button disabled={categoryBusy||!books.some(book=>book.tags.length)} onClick={()=>void refineCategories()}>{categoryBusy?'Refining…':'Refine with Gemini'}<Icon name="network" size={16}/></button>}
              >
                <p className="category-group-note">Detailed tags stay on each book. Refinement uses one Gemini request; browsing uses none.</p>
                {categoryNotice&&<p className="category-group-note" role="status">{categoryNotice}</p>}
                {categoryBusy&&<p className="category-group-note" role="status">Gemini is grouping your tags and choosing local artwork. This uses one AI request.</p>}
                <div className="category-grid">
                  {categoryCards.map(({id,name,count,artwork,tags}) => (
                    <button
                      key={id}
                      className={categoryFilter===id?"selected-category":""}
                      aria-pressed={categoryFilter===id}
                      title={tags.join(" · ")}
                      onClick={() => {
                        setCategoryFilter(categoryFilter===id?null:id);
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      <CategoryArt name={name} artwork={artwork} />
                      <span>{name}</span>
                      <b>{count}</b>
                      <small>catalogue titles</small>
                      <div className="bar">
                        <i
                          style={{
                            width:
                              Math.max(12, (count / books.length) * 100) + "%",
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="overview-hero">
                <div>
                  <Chip tone="gold">
                    {profile.shop + " · Sample workspace"}
                  </Chip>
                  <h2>
                    Good stories deserve
                    <br />
                    new connections.
                  </h2>
                  <p>
                    Your collection brings together cities, memory, art and
                    music.
                    <br />
                    Start with a hidden gem and build an evening around it.
                  </p>
                  <button className="primary" onClick={() => go("live")}>
                    Open Event Studio
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
                <div className="cover-fan">
                  {books.slice(0, 3).map((b) => (
                    <Artwork book={b} key={b.id} />
                  ))}
                </div>
              </div>
              <OverviewShowcase copies={totalCopies} titles={books.length} available={available.length} drafts={events.length} onNavigate={go}/>
            </>
          )}
          {page === "planner" && (
            <div className="planner-layout">
              <div className="planner-sidebar">
              <Panel
                title="Your event drafts"
                subtitle="Editable drafts · saved to your workspace"
                action={
                  <button
                    className="icon-button"
                    aria-label="New event draft"
                    onClick={createEvent}
                  >
                    <Icon name="plus" />
                  </button>
                }
              >
                <div className="planner-draft-list" role="region" aria-label="Event drafts" tabIndex={0}>
                {events.map((e) => (
                  <div className="draft-card" key={e.id}>
                  <button
                    type="button"
                    className={
                      "draft-item " +
                      (selectedEvent.id === e.id ? "chosen" : "")
                    }
                    onClick={() => setEventId(e.id)}
                  >
                    <Icon name="calendar" />
                    <strong>{e.title}</strong>
                    <small>
                      {e.date} · {e.time}
                    </small>
                    <Chip>{e.status}</Chip>
                  </button>
                  <button type="button" className="draft-delete" aria-label={`Delete draft: ${e.title}`} onClick={() => deleteEvent(e.id)}><Icon name="trash" size={14} />Delete</button>
                  </div>
                ))}
                {!events.length && <p className="draft-empty">No event drafts yet. Use the + button to plan an evening.</p>}
                </div>
                {deletedDraft && <div className="draft-undo" role="status"><span>Draft deleted.</span><button type="button" onClick={undoDeleteEvent}>Undo</button></div>}
              </Panel>
                {events.length > 0 && (
                <Panel
                  title="Shape your evening"
                  subtitle="Draft planning — no booking or invitation is sent."
                >
                  <div className="form-grid">
                    <label className="full">
                      Event title
                      <input
                        value={selectedEvent.title}
                        onChange={(e) =>
                          setEvents(
                            events.map((x) =>
                              x.id === selectedEvent.id
                                ? { ...x, title: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={selectedEvent.date}
                        onChange={(e) =>
                          setEvents(
                            events.map((x) =>
                              x.id === selectedEvent.id
                                ? { ...x, date: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Time
                      <input
                        type="time"
                        value={selectedEvent.time}
                        onChange={(e) =>
                          setEvents(
                            events.map((x) =>
                              x.id === selectedEvent.id
                                ? { ...x, time: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Capacity
                      <input
                        type="number"
                        min="1"
                        value={selectedEvent.capacity}
                        onChange={(e) =>
                          setEvents(
                            events.map((x) =>
                              x.id === selectedEvent.id
                                ? {
                                    ...x,
                                    capacity: Math.max(
                                      1,
                                      Number(e.target.value),
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={selectedEvent.status}
                        onChange={(e) =>
                          setEvents(
                            events.map((x) =>
                              x.id === selectedEvent.id
                                ? { ...x, status: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option>Draft</option>
                        <option>In review</option>
                        <option>Ready for owner review</option>
                      </select>
                    </label>
                  </div>
                </Panel>
                )}
              </div>
              {events.length > 0 && (
              <div className="planner-programme">
                <Panel
                  title="Evening programme"
                  subtitle="A practical, editable running order for your bookshop"
                >
                  <div className="planner-programme-scroll" role="region" aria-label="Evening programme content" tabIndex={0}>
                  <DraftSourceStatus key={selectedEvent.id} event={selectedEvent} books={books} onStudio={()=>{go('live');window.dispatchEvent(new CustomEvent('folioecho-studio-tab',{detail:'events'}));}}/>
                  <EveningProgramme event={{ ...selectedEvent, programme: selectedProgramme }} books={books} onChange={programme => setEvents(events.map(event => event.id === selectedEvent.id ? { ...event, programme } : event))} />
                  </div>
                  <div className="panel-footer">
                    <span>
                      {new Set(selectedProgramme.flatMap(segment=>segment.bookIds)).size} featured titles · Editable draft; review cultural references
                    </span>
                    <button
                      className="primary"
                      onClick={() => {
                        saveFile("folioecho-event-draft.json", {
                          event: { ...selectedEvent, programme: selectedProgramme },
                          books: books.filter(book=>selectedProgramme.some(segment=>segment.bookIds.includes(book.id))),
                          source: selectedEvent.source ? "qloo" : "demo",
                          qlooEvidence: selectedEvent.source?.references ?? null,
                        });
                        setNotice("Preparing your event draft PDF.");
                      }}
                    >
                      Export draft
                      <Icon name="download" size={16} />
                    </button>
                  </div>
                </Panel>
              </div>
              )}
            </div>
          )}
          {page === "compare" && <ComparisonResults onStudio={()=>go('live')} />}
          {page === "reports" && (
            <>
              <div className="report-grid">
                {[
                  {
                    icon: "book",
                    title: "Catalogue snapshot",
                    detail: "Titles, stock, tags and hidden-gem selection.",
                    action: () => saveFile("folioecho-catalogue.json", books),
                  },
                  {
                    icon: "network",
                    title: "Qloo evidence report",
                    detail: "Recorded cultural references from your latest Qloo run.",
                    action: async () => {try { const response=await fetch('/api/workspace');if(!response.ok)throw new Error('Saved run unavailable.');const data=await response.json();if(!data.run)throw new Error('Generate a Qloo run in Event Studio first.');await downloadPDF('folioecho-cultural-report.pdf',undefined,data.run.id); } catch(error){setError(error instanceof Error?error.message:'Export failed.');}},
                  },
                  {
                    icon: "calendar",
                    title: "Event drafts",
                    detail:
                      "Your sample event details and current draft states.",
                    action: () => saveFile("folioecho-events.json", events),
                  },
                ].map((r) => (
                  <Panel key={r.title} title={r.title}>
                    <div className="report-icon">
                      <Icon name={r.icon} size={30} />
                    </div>
                    <p>{r.detail}</p>
                    <Chip>PDF report</Chip>
                    <button
                      className="primary"
                      onClick={() => {
                        r.action();
                        setNotice(r.title + " exported.");
                      }}
                    >
                      Download
                      <Icon name="download" size={16} />
                    </button>
                  </Panel>
                ))}
              </div>
              <Panel
                title="Catalogue distribution"
                subtitle="Live counts from this browser session"
              >
                <div className="distribution">
                  {clusters.slice(0, 8).map(([name, count]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <div className="bar">
                        <i
                          style={{
                            width:
                              (count / Math.max(...clusters.map((c) => c[1]))) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {page === "settings" && (
            <div className="two-col">
              <Panel
                title="Bookshop profile"
                subtitle="Your profile and photo are saved in this workspace."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setProfile(profileDraft);
                    setNotice(
                      "Profile updated. Saving to your workspace.",
                    );
                  }}
                >
                  <div className="form-grid">
                    <div className="full bookshop-photo-editor">
                      <img src={profileDraft.photo || "/sample-avatar.jpg"} alt={profileDraft.photo ? "Profile photo preview" : "Sample profile portrait"} width="96" height="96" />
                      <div className="profile-photo-controls">
                        <label className="upload-button">Change profile photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadShopPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
                        <small>JPEG, PNG or WebP · maximum 2 MB. Apply profile changes to save.</small>
                        {!profileDraft.photo && <small>Sample portrait · replace it with your own photo.</small>}
                        {profileDraft.photo && <button type="button" onClick={() => setProfileDraft({ ...profileDraft, photo: '' })}>Use default photo</button>}
                      </div>
                    </div>
                    <label className="full">
                      Owner name
                      <input
                        required
                        value={profileDraft.name}
                        onChange={(e) =>
                          setProfileDraft({
                            ...profileDraft,
                            name: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      Bookshop name
                      <input
                        required
                        value={profileDraft.shop}
                        onChange={(e) =>
                          setProfileDraft({
                            ...profileDraft,
                            shop: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      Location
                      <input
                        required
                        value={profileDraft.city}
                        onChange={(e) =>
                          setProfileDraft({
                            ...profileDraft,
                            city: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="full">
                      Contact email
                      <input
                        type="email"
                        required
                        value={profileDraft.email}
                        onChange={(e) =>
                          setProfileDraft({
                            ...profileDraft,
                            email: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <button className="primary" type="submit">
                    Apply profile changes
                    <Icon name="check" size={16} />
                  </button>
                </form>
              </Panel>
              <div>
                <Panel
                  title="Workspace storage"
                  subtitle="Private local SQLite storage."
                >
                  <p>
                    Catalogue imports, profile edits and event drafts are saved
                    in your workspace. Export a PDF when you want to share a snapshot.
                  </p>
                  <button
                    onClick={() =>
                      saveFile("folioecho-workspace.json", {
                        books,
                        events,
                        profile,
                        mode: "demo",
                      })
                    }
                  >
                    Export workspace snapshot
                    <Icon name="download" size={16} />
                  </button>
                  <button
                    className="reset-button"
                    onClick={() => {
                      setBooks(sampleBooks);
                      setEvents(initialEvents);
                      setProfile({
                        name: "Anna Papadopoulou",
                        shop: "The Reading Room",
                        city: "Athens, Greece",
                        email: "anna@example.com",
                        photo: "",
                      });
                      setProfileDraft({
                        name: "Anna Papadopoulou",
                        shop: "The Reading Room",
                        city: "Athens, Greece",
                        email: "anna@example.com",
                        photo: "",
                      });
                                                      setNotice("Sample workspace restored.");
                    }}
                  >
                    Restore sample data
                  </button>
                </Panel>
                <Panel title="Notifications" subtitle="Choose how FolioEcho keeps you informed.">
                  <NotificationSettings />
                </Panel>
              </div>
            </div>
          )}
          {page === "usage" && (
            <div className="usage-billing-page">
                <Panel
                  title="Connected services"
                  subtitle="Connection states are truthful, not simulated."
                >
                  <div className="service-row">
                    <span>
                      <b>Qloo</b>
                      <small>Cultural evidence and entity discovery</small>
                    </span>
                    <Chip>Server managed</Chip>
                  </div>
                  <OpenAISettings />
                </Panel>
            </div>
          )}
          {page === "help" && <HelpGuide />}
          <footer className="page-footer">
            <span>
              <i />
              {page === "live" ? "Qloo evidence · review recommendations before use" : "Saved workspace · recorded Qloo evidence is labelled"}
            </span>
            <span>FolioEcho · Where books find their audience.</span>
          </footer>
        </div>
      </main>
      {importGuide && <CatalogueImportGuide onClose={() => setImportGuide(false)} />}
    </div>
  );
}
