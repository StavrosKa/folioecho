import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  categories,
  demoBridges,
  parseCatalogue,
  plan,
  type Book,
} from "../lib/catalogue";
import { sampleBooks, initialEvents, bookNotes } from "../lib/workspace";
import Icon from "./Icon";
import "./catalogue.css";
import LiveStudio from "./LiveStudio";
import { downloadPDF } from "../lib/export";
import HelpGuide from "./HelpGuide";
import OpenAISettings from "./OpenAISettings";
import CategoryArt from "./CategoryArt";
import EveningProgramme from './EveningProgramme';
import { createProgramme } from '../lib/programme';

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
  const [page, setPage] = useState<Page>("live");
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [rejected, setRejected] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("b1");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState(initialEvents);
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
  useEffect(() => {
    let active = true;
    void fetch('/api/workspace').then(r => { if (!r.ok) throw new Error('Workspace unavailable'); return r.json(); }).then(({ workspace }) => {
      if (!active) return;
      if (workspace) { setBooks(workspace.books); setEvents(workspace.events); setProfile(workspace.profile); setProfileDraft(workspace.profile); }
      setLoaded(true);
    }).catch(() => { if (active) { setError('Could not load saved workspace. Reload before editing to avoid overwriting it.'); setSaveStatus('Storage unavailable'); } });
    const errorListener = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('folioecho-error', errorListener);
    return () => { active = false; window.removeEventListener('folioecho-error', errorListener); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus('Saving…');
    const timer = setTimeout(() => {
      void fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ books, profile, events }) }).then(async response => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Save failed');
        setSaveStatus('Saved locally');
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
  const [notifications, setNotifications] = useState(false);
  const [kept, setKept] = useState<string[]>([]);
  const results = useMemo(() => plan(books, rejected), [books, rejected]);
  const gems = books.filter((b) => b.hiddenGem);
  const available = books.filter((b) => b.stock > 0);
  const clusters = categories(books);
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
            labelStyle: { fontSize: 10, fill: "#566b5b" },
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
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Use a JSON file smaller than 2 MB.");
      const next = parseCatalogue(JSON.parse(await file.text()));
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
    }
  }
  function updateStock(id: string, value: string) {
    const stock = Number(value);
    if (Number.isSafeInteger(stock) && stock >= 0)
      setBooks(books.map((b) => (b.id === id ? { ...b, stock } : b)));
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
  function rejectDirection() {
    if (!selected?.match) return;
    setRejected([...rejected, selected.match.bridge.id]);
    setNotice(
      "Music direction excluded. Affected demo connections have been recalculated.",
    );
  }
  const statusStrip = (
    <div className="status-strip" aria-label="Catalogue and evidence status">
      <span>
        <Icon name="network" size={17} />
        <strong>{clusters.length}</strong> Category clusters{" "}
        <small>· Catalogue tags</small>
      </span>
      <span>
        <Icon name="gem" size={17} />
        <strong>{gems.length} / 5</strong> Hidden gems{" "}
        <small>
          ·{" "}
          {gems.every((b) => b.stock > 0)
            ? "All in stock"
            : "Check availability"}
        </small>
      </span>
      <span>
        <Icon name="chart" size={17} />
        <b>Evidence status</b>
        <small>· Demo · Qloo not connected</small>
        <Icon name="info" size={14} />
      </span>
    </div>
  );
  const eventBar = (
    <div className="event-bar">
      <div className="event-icon">
        <Icon name="calendar" size={24} />
      </div>
      <div className="event-summary">
        <h3>
          Event draft <span>·</span> {events[0].title}
        </h3>
        <div className="event-facts">
          <span>
            <Icon name="book" />
            <span>
              <b>Books</b>
              {results.length} available titles
            </span>
          </span>
          <span>
            <Icon name="people" />
            <span>
              <b>Format</b>Readings + conversation
            </span>
          </span>
          <span>
            <Icon name="music" />
            <span>
              <b>Music</b>Demo direction · needs review
            </span>
          </span>
        </div>
      </div>
      <button
        className="primary"
        onClick={() => {
          setEventId(events[0].id);
          go("planner");
        }}
      >
        Review event plan <Icon name="arrow" size={17} />
      </button>
    </div>
  );
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
                    <b>Qloo evidence pending</b>No API evidence or affinity
                    score is available.
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
          <img
            src="/folioecho-logo.png"
            alt="FolioEcho — Where books find their audience"
          />
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
                  {item.page === "catalogue" && <small>{books.length}</small>}
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
            <img className="avatar user-avatar" src="/sample-avatar.svg" alt="Illustrative profile avatar" width="36" height="36" />
            <div>
              <strong>{profile.name}</strong>
              <small>Owner · Administrator</small>
            </div>
          </div>
          {profile.photo && <img className="sidebar-shop-photo" src={profile.photo} alt={profile.shop} />}
          <strong className="shop-name">{profile.shop}</strong>
          <span className="location">
            <Icon name="pin" size={13} />
            {profile.city}
          </span>
          <div className="profile-stats">
            <span>
              Catalogue<strong>{books.length} titles · {books.reduce((n,b) => n+b.stock, 0)} copies</strong>
            </span>
            <span>
              Workspace<strong>Local</strong>
            </span>
          </div>
          <p className="session-status">
            <i />
            {saveStatus}
          </p>
          <button className="account-link" onClick={() => go("settings")}>
            <Icon name="settings" size={16} />
            Account settings
            <Icon name="arrow" size={13} />
          </button>
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
            <button
              className="icon-button"
              aria-label="Show workspace notices"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
              <i />
            </button>
            <label className="upload-button">
              <Icon name="download" size={17} />
              Import catalogue
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </header>
        {notifications && (
          <div className="notification-panel">
            <b>Workspace notices</b>
            <p>Workspace changes are saved privately on this computer.</p>
            <p>Event Studio uses the local backend. Other screens use demo data. LLM services are not connected.</p>
            <button onClick={() => setNotifications(false)}>Dismiss</button>
          </div>
        )}
        <div className="page-body">
          <div className="page-heading">
            <div>
              <h1>{pageNames[page]}</h1>
              <p>
                {page === "discovery"
                  ? "Understand your shelves. Build cultural connections. Plan better events."
                  : page === "catalogue"
                    ? "Your inventory is the starting point for every discovery."
                    : page === "planner"
                      ? "Shape a cultural evening around the books you have."
                      : "Your bookshop, connected through culture."}
              </p>
            </div>
            {page !== "live" && <button className="primary create-event" onClick={createEvent}>
              Create event
              <Icon name="arrow" size={18} />
            </button>}
          </div>
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
          <div hidden={page !== "live"}><LiveStudio books={books} setBooks={setBooks} /></div>
          {page === "discovery" && (
            <>
              <div className="workflow" aria-label="Discovery workflow">
                {[
                  {
                    label: "Catalogue",
                    detail: "Your books and tags",
                    page: "catalogue" as Page,
                  },
                  {
                    label: "Hidden gems",
                    detail: "Find and select books",
                    page: "discovery" as Page,
                  },
                  {
                    label: "Cultural bridges",
                    detail: "Explore connections",
                    page: "map" as Page,
                  },
                  {
                    label: "Event plan",
                    detail: "Shape your event",
                    page: "planner" as Page,
                  },
                ].map((step, i) => (
                  <button
                    key={step.label}
                    onClick={() => go(step.page)}
                    className={i === 1 ? "current" : ""}
                  >
                    <span
                      className={"step-number " + (i === 0 ? "complete" : "")}
                    >
                      {i === 0 ? <Icon name="check" size={18} /> : i + 1}
                    </span>
                    <span>
                      <b>{step.label}</b>
                      <small>{step.detail}</small>
                    </span>
                    {i < 3 && <Icon name="arrow" size={23} />}
                  </button>
                ))}
              </div>
              {!ready && (
                <div className="error">
                  Choose 3–5 hidden gems in the catalogue to complete your
                  selection.
                </div>
              )}
              <div className="discovery-grid">
                <div className="discovery-left">
                  <Panel
                    title="Selected hidden gems"
                    subtitle="Books you want more readers to discover."
                    action={
                      <button
                        className="small-button"
                        onClick={() => go("catalogue")}
                      >
                        <Icon name="edit" size={14} />
                        Edit selection
                      </button>
                    }
                  >
                    {bookCards}
                  </Panel>
                  <Panel
                    title="Cultural connections"
                    subtitle="Illustrative links between your books and music."
                    action={
                      <div className="map-legend">
                        <i />
                        Shared tags <span>· Demo</span>
                      </div>
                    }
                    className="map-panel"
                  >
                    {graph(true)}
                  </Panel>
                </div>
                {inspector}
              </div>
              {statusStrip}
              {eventBar}
            </>
          )}
          {page === "catalogue" && (
            <>
              <Panel
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
                <div className="table-wrap">
                  <table>
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
                                  <Chip key={t}>{t}</Chip>
                                ))}
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
                title="Emerging categories"
                subtitle="Grouped from your supplied tags — not automatic metadata enrichment."
              >
                <div className="category-grid">
                  {clusters.map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => {
                        setQuery(name);
                        setFilter("all");
                      }}
                    >
                      <CategoryArt name={name} />
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
            </>
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
                  [books.length, "Catalogue titles", "book"],
                  [books.reduce((n,b) => n+b.stock, 0), "Total copies in stock", "inventory"],
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
                  subtitle="Illustrative event drafts"
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
                    <p>
                      <Icon name="info" />
                      Connect Qloo evidence <Chip>Pending</Chip>
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
                subtitle="Editable drafts · saved locally"
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
                {events.map((e) => (
                  <button
                    key={e.id}
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
                ))}
              </Panel>
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
              </div>
              <div className="planner-programme">
                <Panel
                  title="Evening programme"
                  subtitle="A practical, editable running order for your bookshop"
                >
                  <EveningProgramme event={{ ...selectedEvent, programme: selectedProgramme }} books={books} onChange={programme => setEvents(events.map(event => event.id === selectedEvent.id ? { ...event, programme } : event))} />
                  <div className="panel-footer">
                    <span>
                      {results.length} in-stock titles · Editorial draft; review cultural references
                    </span>
                    <button
                      className="primary"
                      onClick={() => {
                        saveFile("folioecho-event-draft.json", {
                          event: { ...selectedEvent, programme: selectedProgramme },
                          books: results.map((r) => r.book),
                          source: "demo",
                          qlooEvidence: null,
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
                subtitle="Your profile and photo are saved in this local workspace."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setProfile(profileDraft);
                    setNotice(
                      "Profile updated. Saving to your local workspace.",
                    );
                  }}
                >
                  <div className="form-grid">
                    <div className="full bookshop-photo-editor">
                      {profileDraft.photo ? <img src={profileDraft.photo} alt="Bookshop photo preview" /> : <div className="photo-placeholder">Your bookshop, in a picture</div>}
                      <label className="upload-button">{profileDraft.photo ? 'Change bookshop photo' : 'Upload bookshop photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadShopPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
                      <small>JPEG, PNG or WebP · maximum 2 MB. Apply profile changes to save.</small>
                      {profileDraft.photo && <button type="button" onClick={() => setProfileDraft({ ...profileDraft, photo: '' })}>Remove photo</button>}
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
                <Panel
                  title="Workspace storage"
                  subtitle="Private local SQLite storage."
                >
                  <p>
                    Catalogue imports, profile edits and event drafts are saved
                    privately on this computer. Export a PDF to share a snapshot.
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
              </div>
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
    </div>
  );
}
