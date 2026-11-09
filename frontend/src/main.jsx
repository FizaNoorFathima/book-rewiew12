import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bookmark, Check, ChevronDown, Feather, LogOut, Plus, Search, Star, Trash2, X, Sparkles } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_HOST
  ? `https://${import.meta.env.VITE_API_HOST}/api`
  : import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const genres = ["Fiction", "Mystery", "Fantasy", "Romance", "Science Fiction", "Biography", "History", "Self-help", "Poetry"];

function LogoMark() {
  return <span className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 42 42" role="presentation">
      <path className="logo-sun" d="M21 8.5a7.5 7.5 0 0 1 7.5 7.5H13.5A7.5 7.5 0 0 1 21 8.5Z" />
      <path className="logo-page logo-page-left" d="M7.5 17.5c4.7-.7 9.2.3 13.5 3.2v13.8c-4.3-2.9-8.8-3.9-13.5-3.2V17.5Z" />
      <path className="logo-page logo-page-right" d="M34.5 17.5c-4.7-.7-9.2.3-13.5 3.2v13.8c4.3-2.9 8.8-3.9 13.5-3.2V17.5Z" />
      <path className="logo-line" d="M21 20.7v13.8" />
    </svg>
  </span>;
}

function Stars({ rating }) {
  return <span className="stars" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= rating ? "currentColor" : "none"} />)}</span>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("bookmarked_token"));
  const [email, setEmail] = useState(() => localStorage.getItem("bookmarked_email"));
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooks = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/books?search=${encodeURIComponent(search)}&watched=${filter}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not load books");
      setBooks(await response.json());
      setError("");
    } catch {
      setError("Could not connect to the library. Is the API running?");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBooks(); }, [search, filter, token]);

  const stats = useMemo(() => ({
    total: books.length,
    watched: books.filter((book) => book.watched).length,
    fiveStar: books.filter((book) => book.rating === 5).length,
  }), [books]);

  const addBook = async (book) => {
    let cover_url = book.cover_url;
    try {
      const lookup = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.name)}&author=${encodeURIComponent(book.author)}&limit=1`);
      if (lookup.ok) {
        const result = await lookup.json();
        const coverId = result.docs?.[0]?.cover_i;
        if (coverId) cover_url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      }
    } catch { /* A missing cover should not prevent saving the book. */ }
    const response = await fetch(`${API_URL}/books`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...book, cover_url }) });
    if (!response.ok) throw new Error("Could not add book");
    setModalOpen(false);
    loadBooks();
  };

  const removeBook = async (id) => {
    await fetch(`${API_URL}/books/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    loadBooks();
  };

  if (!token) return <AuthScreen onAuthenticated={(newToken, newEmail) => { localStorage.setItem("bookmarked_token", newToken); localStorage.setItem("bookmarked_email", newEmail); setToken(newToken); setEmail(newEmail); }} />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><LogoMark /><span>bookmarked</span></a>
      <div className="header-actions"><span className="signed-in">{email}</span><button className="logout-button" onClick={() => { localStorage.clear(); setToken(null); setEmail(null); }}><LogOut size={15} /> Log out</button><button className="add-button" onClick={() => setModalOpen(true)}><Plus size={18} /> Add a book</button></div>
    </header>
    <main>
      <section className="hero">
        <div><p className="eyebrow">YOUR PERSONAL LIBRARY</p><h1>A shelf for every<br /><em>great story.</em></h1><p className="intro">Keep track of the books that shaped you, inspired you, and are still waiting to be read.</p></div>
        <div className="hero-art"><div className="circle circle-one"></div><div className="circle circle-two"></div><Feather size={66} strokeWidth={1.2} /></div>
      </section>
      <section className="stats">
        <div><strong>{stats.total}</strong><span>Books on shelf</span></div><div><strong>{stats.watched}</strong><span>Books read</span></div><div><strong>{stats.fiveStar}</strong><span>Five-star reads</span></div>
      </section>
      <section className="library-section">
        <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Your bookshelf</h2></div><div className="search-wrap"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your shelf..." /></div></div>
        <div className="toolbar"><div className="filter-tabs">{[["all", "All books"], ["unwatched", "To read"], ["watched", "Read"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><span className="book-count">{books.length} {books.length === 1 ? "book" : "books"}</span></div>
        {error && <div className="error">{error}</div>}
        {loading ? <div className="empty-state"><p>Loading your shelf...</p></div> : books.length === 0 ? <div className="empty-state"><Bookmark size={34} /><h3>Your shelf is waiting</h3><p>Add your first book to start building your collection.</p><button className="add-button" onClick={() => setModalOpen(true)}><Plus size={17} /> Add a book</button></div> :
          <div className="book-grid">{books.map((book) => <article className="book-card" key={book.id}><div className={`book-cover genre-${book.genre.toLowerCase().replaceAll(" ", "-")}`}>{book.cover_url ? <img src={book.cover_url} alt={`Cover of ${book.name}`} /> : <Bookmark size={30} />}<span>{book.genre}</span></div><div className="book-info"><div className="book-title-row"><div><h3>{book.name}</h3><p className="book-author">{book.author || "Unknown author"}</p></div><button className="delete-button" aria-label={`Delete ${book.name}`} onClick={() => removeBook(book.id)}><Trash2 size={16} /></button></div><div className="rating"><Stars rating={book.rating} /><span>{book.rating}.0</span></div><div className="book-footer"><span className={book.watched ? "status read" : "status"}>{book.watched && <Check size={13} />}{book.watched ? "Read" : "To read"}</span></div></div></article>)}</div>}
      </section>
    </main>
    {isModalOpen && <AddBookModal onClose={() => setModalOpen(false)} onSubmit={addBook} />}
  </div>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to continue");
      onAuthenticated(data.token, data.email);
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  };
  return <div className="auth-page"><div className="auth-art"><div className="auth-circle"></div><Feather size={62} strokeWidth={1.2} /></div><div className="auth-card"><a className="brand auth-brand" href="#"><LogoMark /><span>bookmarked</span></a><p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "START YOUR COLLECTION"}</p><h1>{mode === "login" ? <>Your shelf is<br /><em>waiting.</em></> : <>Make space for<br /><em>good stories.</em></>}</h1><p className="auth-subtitle">{mode === "login" ? "Log in to continue to your personal library." : "Create your private library account to get started."}</p><form onSubmit={submit}><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label><label>Password<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Letters and numbers, 8+ characters" /></label>{mode === "register" && <p className="password-hint">Use at least 8 characters, including one letter and one number.</p>}{error && <div className="error">{error}</div>}<button className="submit-button" disabled={saving}>{saving ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button></form><p className="auth-switch">{mode === "login" ? "New here?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}> {mode === "login" ? "Create an account" : "Log in"}</button></p></div></div>;
}

function AddBookModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", author: "", genre: "", rating: 5, watched: false, cover_url: null });
  const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { await onSubmit({ ...form, rating: Number(form.rating) }); } finally { setSaving(false); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><button className="close-button" onClick={onClose}><X size={20} /></button><p className="eyebrow">NEW ADDITION</p><h2>Add a book</h2><p className="modal-subtitle">A few details and it’s safely on your shelf.</p><form onSubmit={submit}><div className="form-row"><label>Book name<input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. The Midnight Library" /></label><label>Author<input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="e.g. Matt Haig" /></label></div><div className="form-row"><label>Genre<div className="select-wrap"><select required value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}><option value="">Choose one</option>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select><ChevronDown size={16} /></div></label><label>Rating<div className="select-wrap"><select value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select><ChevronDown size={16} /></div></label></div><p className="cover-note"><Sparkles size={14} /> We’ll look for the cover automatically.</p><label className="checkbox-label"><input type="checkbox" checked={form.watched} onChange={(event) => setForm({ ...form, watched: event.target.checked })} /><span className="fake-checkbox">{form.watched && <Check size={13} />}</span>I’ve already read this book</label><button className="submit-button" disabled={saving}>{saving ? "Finding cover..." : "Add to my shelf"} <Plus size={18} /></button></form></div></div>;
}

createRoot(document.getElementById("root")).render(<App />);
