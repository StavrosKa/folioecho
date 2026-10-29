import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  demoBridges,
  plan,
  type Book,
} from "../lib/catalogue";
import { sampleBooks, initialEvents, bookNotes } from "../lib/workspace";
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
  | "planner"
  | "map"
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
  planner: "Event Planner",
  map: "Cultural Map",
  compare: "Compare Results",
  reports: "Reports & Exports",
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
      { page: "reports", icon: "file" },
      { page: "settings", icon: "settings" },
      { page: "usage", icon: "billing" },
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
  const index = book ? ["b1", "b2", "b3"].indexOf(book.id) : 3;
  return index >= 0 ? (
    <div
      role="img"
      aria-label={
        book
          ? "Illustrative cover for " + book.title
          : "Illustrative music artwork"
      }
      className={"artwork art-" + index + " " + className}
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
function CulturalNode({ data }: NodeProps) {
  const book = data.book as Book | undefined;
  return (
    <div className={"cultural-node " + (book ? "book-node" : "music-node")}>
      <Handle type="target" position={Position.Left} />
      {book ? (
        <Artwork book={book} />
      ) : (
        <div className="node-music-art">
          <Icon name="music" size={20} />
        </div>
      )}
      <div>
        <strong>{String(data.label)}</strong>
        <small>{book ? "Catalogue title" : "Demo music direction"}</small>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { cultural: CulturalNode };
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
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
  const [qlooStatus,setQlooStatus]=useState<{configured:boolean;evidenceAvailable:boolean}|null>(null);
  const [qlooStatusError,setQlooStatusError]=useState(false);
  useEffect(()=>{
    if(page!=='overview')return;
    let active=true;
    const refresh=async()=>{
      try{const response=await fetch('/api/qloo-status',{cache:'no-store'});if(!response.ok)throw new Error('Status unavailable');const data=await response.json();if(active){setQlooStatus(data);setQlooStatusError(false);}}
      catch{if(active)setQlooStatusError(true);}
    };
    void refresh();window.addEventListener('focus',refresh);
    return()=>{active=false;window.removeEventListener('focus',refresh);};
  },[page]);
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
  const [rejected, setRejected] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("b1");
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

  const [kept, setKept] = useState<string[]>([]);
  const results = useMemo(() => plan(books, rejected), [books, rejected]);
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
  const selected = results.find((r) => r.book.id === selectedId) ?? results[0];
  const selectedEvent = events.find((e) => e.id === eventId) ?? events[0] ?? initialEvents[0];
  const selectedProgramme = selectedEvent.programme ?? createProgramme(results.map(row => row.book));
  const flowNodes: Node[] = [
    ...results.map((r, i) => ({
      id: "book:" + r.book.id,
      type: "cultural",
      position: { x: 20, y: 15 + i * 95 },
      data: { label: r.book.title, book: r.book },
    })),
    ...demoBridges
      .filter((m) => results.some((r) => r.match?.bridge.id === m.id))
      .map((m, i) => ({
        id: "music:" + m.id,
        type: "cultural",
        position: { x: 420, y: 45 + i * 125 },
        data: { label: m.name },
      })),
  ];
  const flowEdges: Edge[] = results.flatMap((r) =>
    r.match
      ? [
          {
            id: "edge:" + r.book.id,
            source: "book:" + r.book.id,
            target: "music:" + r.match.bridge.id,
            label: r.match.shared.join(" · "),
            style: { stroke: "#749e7c" },
            labelStyle: { fontSize: 13, fill: "#566b5b" },
          },
        ]
      : [],
  );
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
      setRejected([]);
      setKept([]);
      setSelectedId(next[0].id);
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
    setEvents(current=>current.some(event=>event.id===draft.id)?current:[...current,draft]);
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
  function rejectDirection() {
    if (!selected?.match) return;
    setRejected([...rejected, selected.match.bridge.id]);
    setNotice(
      "Music direction excluded. Affected demo connections have been recalculated.",
    );
  }
  function graph(compact = false) {
    return (
      <div
        className={"flow " + (compact ? "compact-flow" : "")}
        aria-label="Illustrative book to music connections"
      >
        {results.length ? (
          <ReactFlow
            key={results
              .map((r) => r.book.id + (r.match?.bridge.id ?? ""))
              .join()}
            nodeTypes={nodeTypes}
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            nodesDraggable={false}
            nodesConnectable={false}
            minZoom={0.25}
            maxZoom={1.5}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} color="#dae1d7" />
            {!compact && <Controls />}
          </ReactFlow>
        ) : (
          <div className="empty-state">
            <Icon name="network" size={30} />
            <h3>No available hidden gems</h3>
            <p>Select books with stock to build connections.</p>
            <button onClick={() => go("catalogue")}>Open catalogue</button>
          </div>
        )}
      </div>
    );
  }
  const bookCards = (
    <div className="book-grid">
      {gems.length ? (
        gems.map((book) => (
          <article
            key={book.id}
            className={
              "book-card " + (selected?.book.id === book.id ? "inspected" : "")
            }
          >
            <button
              className="cover-button"
              disabled={!book.stock}
              aria-pressed={selected?.book.id===book.id}
              onClick={() => setSelectedId(book.id)}
              aria-label={"Explain connection for " + book.title}
            >
              <span className="cover-check">
                <Icon name="check" size={14} />
              </span>
              <Artwork book={book} />
              <span className={"stock-badge " + (!book.stock ? "out" : "")}>
                {book.stock} in stock
              </span>
              <span className="gem-mark">
                <Icon name="gem" size={17} />
              </span>
            </button>
            <button
              className="book-title"
              disabled={!book.stock}
              onClick={() => setSelectedId(book.id)}
            >
              {book.title}
            </button>
            <p className="author">{book.author}</p>
            <div className="tags">
              {book.tags.slice(0, 3).map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
            <small className="field-label">Discovery angle</small>
            <p className="angle">
              {bookNotes[book.id] ??
                "Explore connections through " +
                  book.tags.slice(0, 2).join(" and ") +
                  "."}
            </p>
            <button className="discovery-open-direction" disabled={!book.stock} onClick={()=>setSelectedId(book.id)}>{selected?.book.id===book.id?'Viewing direction':'Explore this book'}<Icon name="arrow" size={14}/></button>
            {!book.stock && (
              <small className="warning-text">
                Excluded from the event plan
              </small>
            )}
          </article>
        ))
      ) : (
        <div className="empty-state">
          <h3>Your next discovery starts here</h3>
          <p>Choose 3–5 hidden gems from your catalogue.</p>
          <button onClick={() => go("catalogue")}>Choose books</button>
        </div>
      )}
    </div>
  );
  const inspector = (
    <Panel
      key={selected?.book.id??"no-connection"}
      title="Connection explained"
      action={<Chip tone="gold">Demo example</Chip>}
      className="inspector"
    >
      {selected?.match ? (
        <>
          <Artwork className="jazz-art" />
          <h3 className="connection-title">
            {selected.book.title} <span>→</span> {selected.match.bridge.name}
          </h3>
          <p className="muted">Music direction · illustrative match</p>
          <ol className="explanations">
            <li>
              <span className="number">1</span>
              <div>
                <h4>Catalogue signals</h4>
                <div className="tags">
                  {selected.match.shared.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
                <p>
                  Shared tags from your catalogue and the demo music fixture.
                </p>
              </div>
            </li>
            <li>
              <span className="number">2</span>
              <div>
                <h4>Editorial interpretation</h4>
                <p>{selected.match.bridge.interpretation}</p>
              </div>
            </li>
            <li>
              <span className="number blue">3</span>
              <div>
                <h4>External evidence</h4>
                <div className="evidence-note">
                  <Icon name="info" size={17} />
                  <span>
                    <b>Illustrative connection</b>This direction comes from shared tags. Open Event Studio for Qloo-backed evidence.
                  </span>
                </div>
              </div>
            </li>
          </ol>
          <div className="owner-controls">
            <h4>Owner controls</h4>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => {
                  setKept([
                    ...new Set([
                      ...kept,
                      selected.book.id + ":" + selected.match!.bridge.id,
                    ]),
                  ]);
                  setNotice(
                    "Demo direction kept for " + selected.book.title + ".",
                  );
                }}
              >
                {kept.includes(
                  selected.book.id + ":" + selected.match.bridge.id,
                )
                  ? "Direction kept ✓"
                  : "Keep direction"}
              </button>
              <button onClick={rejectDirection}>Find alternative</button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Icon name="compass" size={30} />
          <h3>No supported connection</h3>
          <p>
            Choose available books with useful tags or restore demo directions.
          </p>
          <button
            onClick={() => {
              setRejected([]);
              setNotice("Demo music directions restored.");
            }}
          >
            Restore directions
          </button>
        </div>
      )}
    </Panel>
  );

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
                  {item.page === "catalogue" && <small title="Total copies in stock" aria-label={`${totalCopies} total copies in stock`}>{totalCopies}</small>}
                  {item.page === "discovery" && <small title="Selected hidden gems" aria-label={`${gems.length} selected hidden gems`}>{gems.length}</small>}
                  {item.page === "planner" && <small>{events.length}</small>}
                </button>
              ))}
            </div>
          ))}
          <button className="help-button" onClick={() => go("help")}>
            <Icon name="help" size={17} />
            Help & guide
            <Icon name="arrow" size={14} />
          </button>
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
              Catalogue<strong>{totalCopies} copies · {books.length} titles</strong>
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
            <Chip tone="gold">{page === "live" ? "Local Qloo pilot" : "Demo workspace"}</Chip>
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
                  : page === "discovery"
                  ? "Understand your shelves. Build cultural connections. Plan better events."
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
          <div hidden={page !== "live"}><LiveStudio books={books} setBooks={setBooks} onPlanEvent={planStudioEvent} active={page==='live'} /></div>
          {page === "discovery" && (
            <div className="discovery-workspace">
              <nav className="discovery-breadcrumbs" aria-label="Discovery workflow"><button onClick={()=>go('catalogue')}>Catalogue</button><Icon name="arrow" size={13}/><span aria-current="step">Hidden gems</span><Icon name="arrow" size={13}/><button onClick={()=>go('map')}>Cultural map</button><Icon name="arrow" size={13}/><button onClick={()=>go('planner')}>Event Planner</button></nav>
              <section className="discovery-summary" aria-label="Your discovery selection"><div><span className="discovery-eyebrow">CURATE YOUR NEXT DISCOVERY</span><h2>A small selection. New possibilities.</h2><p>Choose a book to explore an editorial direction.</p></div><div className="discovery-totals"><span><b>{gems.length}</b>hidden gems</span><span><b>{gems.reduce((sum,book)=>sum+book.stock,0)}</b>copies in stock</span><span><b>{kept.length}</b>directions kept</span></div></section>
              {!ready&&<div className="error">Choose 3–5 hidden gems in the catalogue to complete your selection.</div>}
              <div className="discovery-grid">
                <Panel className="discovery-collection" title="Your hidden gems" subtitle="A focused shelf of books worth another look." action={<button className="small-button" onClick={()=>go('catalogue')}><Icon name="edit" size={14}/>Edit selection</button>}>
                  <div className="discovery-selection-list" role="region" aria-label="Selected hidden gems" tabIndex={0}>{bookCards}</div>
                </Panel>
                {inspector}
              </div>
              <div className="discovery-next"><div><Icon name="network" size={22}/><span><b>Explore with real cultural evidence</b><small>These directions are demo examples. Event Studio connects your books to Qloo.</small></span></div><div><button onClick={()=>go('map')}>View cultural map</button><button className="primary" onClick={()=>go('live')}>Open Event Studio<Icon name="arrow" size={16}/></button></div></div>
            </div>
          )}
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
                    onClick={() => go("discovery")}
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
                  <button className="primary" onClick={() => go("discovery")}>
                    Open Discovery Studio
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
                <div className="cover-fan">
                  {books.slice(0, 3).map((b) => (
                    <Artwork book={b} key={b.id} />
                  ))}
                </div>
              </div>
              <div className="overview-metrics">
                {[
                  [totalCopies, "Total copies in stock", "inventory"],
                  [books.length, "Catalogue titles", "book"],
                  [available.length, "Available titles", "check"],
                  [clusters.length, "Category signals", "network"],
                  [events.length, "Event drafts", "calendar"],
                ].map(([n, label, icon]) => (
                  <div key={label}>
                    <Icon name={String(icon)} size={25} />
                    <strong>{n}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="two-col">
                <Panel
                  title="Next on your calendar"
                  subtitle="Saved drafts · sample and Event Studio proposals"
                >
                  {events.map((e) => (
                    <button
                      className="event-list-row"
                      key={e.id}
                      onClick={() => {
                        setEventId(e.id);
                        go("planner");
                      }}
                    >
                      <div className="date-tile">
                        <b>{e.date.slice(-2)}</b>
                        <small>
                          {[
                            "JAN",
                            "FEB",
                            "MAR",
                            "APR",
                            "MAY",
                            "JUN",
                            "JUL",
                            "AUG",
                            "SEP",
                            "OCT",
                            "NOV",
                            "DEC",
                          ][Number(e.date.slice(5, 7)) - 1] ?? "—"}
                        </small>
                      </div>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {e.theme} · {e.time}
                        </small>
                      </span>
                      <Chip>{e.status}</Chip>
                    </button>
                  ))}
                </Panel>
                <Panel
                  title="Your next steps"
                  subtitle="A practical checklist for your sample workspace"
                >
                  <div className="checklist">
                    <p>
                      <Icon name="check" />
                      Review your catalogue and stock{" "}
                      <Chip tone="green">Ready</Chip>
                    </p>
                    <p>
                      <Icon name="gem" />
                      Choose 3–5 hidden gems{" "}
                      <Chip tone="green">{gems.length} selected</Chip>
                    </p>
                    <p>
                      <Icon name="music" />
                      Review cultural directions <Chip>Demo</Chip>
                    </p>
                    <p title="Shows credential configuration and saved evidence from your latest run. No live connectivity probe is performed.">
                      <Icon name="info" />
                      Qloo evidence <Chip tone={!qlooStatusError&&(qlooStatus?.configured||qlooStatus?.evidenceAvailable)?'green':''}>{qlooStatusError?'Unavailable':!qlooStatus?'Checking…':qlooStatus.evidenceAvailable?'Evidence available':qlooStatus.configured?'Configured':'Not configured'}</Chip>
                    </p>
                  </div>
                  <button onClick={() => go("help")}>
                    Read the workspace guide
                    <Icon name="arrow" size={16} />
                  </button>
                </Panel>
              </div>
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
                  {selectedEvent.source&&<div className="planner-source"><b>From Event Studio · revision {selectedEvent.source.revision}</b><p>{selectedEvent.source.duration} minutes in source proposal · {selectedEvent.source.references.map(reference=>reference.name).join(' · ')}</p><small>Saved Qloo evidence snapshot. Review availability and permissions before the event.</small></div>}
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
          {page === "map" && (
            <>
              <Panel
                title="Explore your cultural map"
                subtitle="Every edge is supported by shared demo tags. No Qloo affinity is implied."
                action={
                  <button
                    onClick={() => {
                      setRejected([]);
                      setNotice("All demo directions restored.");
                    }}
                  >
                    <Icon name="reset" size={15} />
                    Reset directions
                  </button>
                }
              >
                {graph()}
              </Panel>
              <div className="bridge-grid">
                {results.map((r) => (
                  <Panel
                    key={r.book.id}
                    title={r.book.title}
                    subtitle={r.book.stock + " copies available"}
                  >
                    <h3>{r.match?.bridge.name ?? "No supported connection"}</h3>
                    <p>
                      {r.match?.bridge.interpretation ??
                        "Restore demo directions or review catalogue tags."}
                    </p>
                    <div className="tags">
                      {r.match?.shared.map((t) => (
                        <Chip key={t}>{t}</Chip>
                      ))}
                    </div>
                    <p className="muted">
                      Source: local demo fixture · External evidence pending
                    </p>
                    <button
                      onClick={() => {
                        setSelectedId(r.book.id);
                        go("discovery");
                      }}
                    >
                      View explanation
                      <Icon name="arrow" size={15} />
                    </button>
                  </Panel>
                ))}
              </div>
            </>
          )}
          {page === "compare" && (
            <>
              <div className="info-banner">
                <Icon name="info" />
                <div>
                  <b>Comparison workspace · illustrative layout</b>
                  <p>
                    A real Qloo-backed run and an LLM-only baseline have not
                    run. Results are deliberately left unmeasured.
                  </p>
                </div>
              </div>
              <div className="two-col">
                {["FolioEcho + Qloo", "LLM-only baseline"].map((name, i) => (
                  <Panel
                    key={name}
                    title={name}
                    subtitle={
                      i
                        ? "Same catalogue, same stock constraints"
                        : "Evidence-supported cultural discovery"
                    }
                    action={<Chip>Not run</Chip>}
                  >
                    <div className="comparison-placeholder">
                      <Icon name={i ? "compass" : "network"} size={38} />
                      <h3>
                        {i ? "Baseline waiting" : "Evidence connection pending"}
                      </h3>
                      <p>
                        {i
                          ? "The baseline must use the exact same inventory snapshot and task."
                          : "Connect Qloo server-side to collect provenance and real affinity data."}
                      </p>
                    </div>
                    <dl className="metric-list">
                      <div>
                        <dt>Inventory validity</dt>
                        <dd>Not measured</dd>
                      </div>
                      <div>
                        <dt>Hidden-gem coverage</dt>
                        <dd>Not measured</dd>
                      </div>
                      <div>
                        <dt>Evidence coverage</dt>
                        <dd>Not measured</dd>
                      </div>
                      <div>
                        <dt>Owner assessment</dt>
                        <dd>Not reviewed</dd>
                      </div>
                    </dl>
                  </Panel>
                ))}
              </div>
              <Panel
                title="Evaluation protocol"
                subtitle="The comparison must be fair, reproducible and transparent."
              >
                <div className="protocol-grid">
                  {[
                    [
                      "01",
                      "Freeze the catalogue",
                      "Use one snapshot of titles, stock and owner-selected hidden gems.",
                    ],
                    [
                      "02",
                      "Apply identical constraints",
                      "Require available catalogue titles in both approaches.",
                    ],
                    [
                      "03",
                      "Separate facts from interpretation",
                      "Show external evidence, shared tags and editorial reasoning separately.",
                    ],
                    [
                      "04",
                      "Review with the bookseller",
                      "Evaluate usefulness and discovery potential alongside validity.",
                    ],
                  ].map(([n, title, detail]) => (
                    <div key={n}>
                      <b>{n}</b>
                      <h3>{title}</h3>
                      <p>{detail}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
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
                    title: "Discovery report",
                    detail:
                      "Demo matches with shared tags and editorial explanations.",
                    action: () =>
                      saveFile("folioecho-discovery.json", {
                        mode: "demo",
                        qlooEvidence: null,
                        matches: results,
                      }),
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
                      setRejected([]);
                      setKept([]);
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
              {page === "live" ? "Local Qloo evidence · review recommendations before use" : "Sample workspace · illustrative artwork & connections"}
            </span>
            <span>FolioEcho · Where books find their audience.</span>
          </footer>
        </div>
      </main>
      {importGuide && <CatalogueImportGuide onClose={() => setImportGuide(false)} />}
    </div>
  );
}
