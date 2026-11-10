"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { addKnowledgeNote, loadKnowledgeNotes, removeKnowledgeNote } from "@/lib/ednova/knowledge-storage";
import { chunkText } from "@/lib/ednova/rag";
import type { KnowledgeNote } from "@/lib/ednova/types";

export default function KnowledgePanel({ onClose }: { onClose?: () => void } = {}) {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Reading / viewing state
  const [readingNote, setReadingNote] = useState<KnowledgeNote | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [showWhyRAG, setShowWhyRAG] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setNotes(loadKnowledgeNotes()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  function addPastedNote(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    const note = addKnowledgeNote({ title, content });
    setNotes((current) => [note, ...current.filter((n) => n.id !== note.id)]);
    setTitle("");
    setContent("");
    setMessage(`✓ "${note.title}" added to your RAG knowledge base.`);
    setReadingNote(note); // Automatically open the reader so the student can verify!
  }

  async function uploadNote(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/ednova/rag/extract", { method: "POST", body: form });
      const data = (await response.json()) as { title?: string; text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error ?? "The note could not be read.");
      const note = addKnowledgeNote({ title: data.title ?? file.name, content: data.text });
      setNotes((current) => [note, ...current.filter((n) => n.id !== note.id)]);
      setMessage(`✓ "${note.title}" parsed (${data.text.length.toLocaleString()} chars). Ready for RAG.`);
      setReadingNote(note); // Automatically open in the reader so the user can inspect the extracted text!
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The note could not be read.");
    } finally {
      setBusy(false);
    }
  }

  function removeNote(note: KnowledgeNote, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (note.sample) return;
    removeKnowledgeNote(note.id);
    setNotes((current) => current.filter((currentNote) => currentNote.id !== note.id));
    if (readingNote?.id === note.id) {
      setReadingNote(null);
    }
  }

  function toggleInlineExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyNoteContent(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadNote(note: KnowledgeNote) {
    const blob = new Blob([note.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-xl backdrop-blur-xl">
        {/* Header & Feature Title */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-300">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-200">
                Knowledge Notes & RAG
              </p>
              <p className="text-[11px] text-slate-400">
                {notes.length} note{notes.length !== 1 ? "s" : ""} active in context
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* "Why RAG?" Info Button */}
            <button
              type="button"
              onClick={() => setShowWhyRAG(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20 cursor-pointer"
              title="Click to learn why RAG is used in EdNova"
            >
              <HelpCircle className="h-3 w-3 text-cyan-400" />
              <span>Why RAG?</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Upload vs Paste Toggle */}
        <div className="mt-3 flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 rounded-lg py-1.5 font-bold transition ${
              activeTab === "upload"
                ? "bg-violet-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Upload File (.pdf, .txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`flex-1 rounded-lg py-1.5 font-bold transition ${
              activeTab === "paste"
                ? "bg-violet-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Paste Text Note
          </button>
        </div>

        {/* Tab 1: Upload File */}
        {activeTab === "upload" && (
          <div className="mt-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] p-4 text-center transition hover:border-violet-400 hover:bg-violet-500/5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
                {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <span className="mt-2 text-xs font-bold text-slate-200">
                {busy ? "Reading & Extracting Text..." : "Choose Course PDF or Lecture Note"}
              </span>
              <span className="mt-0.5 text-[10px] text-slate-400">
                Supports .pdf, .txt, .md (up to 5 MB)
              </span>
              <input
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                onChange={uploadNote}
                disabled={busy}
                className="sr-only"
              />
            </label>
          </div>
        )}

        {/* Tab 2: Paste Text Note */}
        {activeTab === "paste" && (
          <form onSubmit={addPastedNote} className="mt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Note Title (e.g. Chapter 4: Photosynthesis)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={40_000}
              rows={3}
              placeholder="Paste lecture slides, key definitions, or professor's notes here..."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-xs font-bold text-white shadow-md transition hover:scale-[1.02] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add to Knowledge Store
            </button>
          </form>
        )}

        {/* Status notice */}
        {message && (
          <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2.5 text-xs text-cyan-200">
            {message}
          </p>
        )}

        {/* Notes Search & List Header */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Attached Course Documents ({filteredNotes.length})
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              BM25 Grounded
            </span>
          </div>

          {/* Search bar if multiple notes */}
          {notes.length > 2 && (
            <div className="mt-2 relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within your notes..."
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>
          )}

          {/* Notes List */}
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-500">
                No matching notes found.
              </p>
            ) : (
              filteredNotes.map((note) => {
                const isExpanded = expandedNoteIds.has(note.id);
                const chunkCount = chunkText(note.content).length;

                return (
                  <div
                    key={note.id}
                    onClick={() => setReadingNote(note)}
                    className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-violet-400/60 hover:bg-white/[0.06] cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-300 group-hover:bg-violet-500 group-hover:text-white transition">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-xs font-bold text-slate-200 group-hover:text-white transition">
                            {note.title}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                            {note.sample ? (
                              <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-violet-300 font-medium">
                                Demo Note
                              </span>
                            ) : (
                              <span>{note.content.length.toLocaleString()} characters</span>
                            )}
                            <span>•</span>
                            <span className="text-cyan-300">{chunkCount} chunks</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Icons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Eye Read Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReadingNote(note);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-cyan-300 transition"
                          title="Open full note reader"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Inline preview toggle */}
                        <button
                          type="button"
                          onClick={(e) => toggleInlineExpand(note.id, e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition"
                          title={isExpanded ? "Collapse preview" : "Expand preview"}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        {/* Delete button (except for sample note) */}
                        {!note.sample && (
                          <button
                            type="button"
                            onClick={(e) => removeNote(note, e)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Expandable Preview */}
                    {isExpanded && (
                      <div className="mt-2.5 border-t border-white/5 pt-2 text-xs text-slate-300 leading-relaxed bg-slate-950/40 rounded-xl p-2.5">
                        <p className="line-clamp-4 italic text-slate-400">
                          {note.content.slice(0, 300)}…
                        </p>
                        <button
                          type="button"
                          onClick={() => setReadingNote(note)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200"
                        >
                          <span>Open full text reader</span> →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 1. FULL NOTE READER MODAL (The requested "Read" feature) */}
      {/* ======================================================== */}
      {readingNote && (
        <NoteReaderModal
          note={readingNote}
          copied={copiedId === readingNote.id}
          onClose={() => setReadingNote(null)}
          onCopy={() => copyNoteContent(readingNote.content, readingNote.id)}
          onDownload={() => downloadNote(readingNote)}
          onDelete={() => removeNote(readingNote)}
        />
      )}

      {/* ======================================================== */}
      {/* 2. "WHY RAG?" EDUCATIONAL EXPLANATION MODAL             */}
      {/* ======================================================== */}
      {showWhyRAG && <WhyRAGModal onClose={() => setShowWhyRAG(false)} />}
    </>
  );
}

// =========================================================================
// NOTE READER MODAL COMPONENT
// =========================================================================

function NoteReaderModal({
  note,
  copied,
  onClose,
  onCopy,
  onDownload,
  onDelete,
}: {
  note: KnowledgeNote;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const wordsCount = useMemo(() => {
    return note.content.trim().split(/\s+/).filter(Boolean).length;
  }, [note.content]);

  const readTimeMins = Math.max(1, Math.round(wordsCount / 200));
  const chunkCount = chunkText(note.content).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[88vh] rounded-3xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/80 overflow-hidden">
        {/* Modal Header */}
        <div className="border-b border-white/10 px-6 py-5 bg-slate-900/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-violet-400/15 px-2 py-0.5 text-[10px] font-mono font-bold text-violet-300">
                    {note.sample ? "Sample Document" : "Course Material"}
                  </span>
                  <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                    ⚡ {chunkCount} RAG Chunks
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-black text-white truncate">
                  {note.title}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{wordsCount.toLocaleString()} words</span>
                  <span>•</span>
                  <span>~{readTimeMins} min read</span>
                  <span>•</span>
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search inside this note */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter / find words inside this document..."
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
          </div>
        </div>

        {/* Modal Body - Full Formatted Text Reader */}
        <div className="flex-1 overflow-y-auto px-6 py-6 font-sans text-sm leading-relaxed text-slate-200">
          <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-200 selection:bg-violet-500/40 selection:text-white">
            {note.content}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied to Clipboard!" : "Copy Full Note"}</span>
            </button>

            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .txt</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!note.sample && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Note</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow hover:scale-[1.02] transition cursor-pointer"
            >
              Done Reading
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// "WHY RAG?" EDUCATIONAL MODAL
// =========================================================================

function WhyRAGModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-xl rounded-3xl border border-cyan-400/30 bg-slate-950 p-6 shadow-2xl shadow-cyan-950/50">
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/20 text-cyan-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Why Feature 5: Knowledge Notes & RAG?
              </h3>
              <p className="text-xs text-cyan-200/80">
                Retrieval-Augmented Generation explained for learners
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs text-slate-300 leading-relaxed">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
            <h4 className="flex items-center gap-2 font-bold text-white text-sm">
              <span className="text-base">🎯</span> 1. Grounds the AI in YOUR Professor’s Syllabus
            </h4>
            <p className="mt-1 text-slate-400">
              Generic ChatGPT or Gemini uses random web data that might conflict with your course. By attaching your lecture PDF, EdNova uses your university’s exact formulas, definitions, and problem-solving steps.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
            <h4 className="flex items-center gap-2 font-bold text-white text-sm">
              <span className="text-base">🛡️</span> 2. Prevents AI Hallucinations & Provides Citations
            </h4>
            <p className="mt-1 text-slate-400">
              Whenever the AI answers or gives a hint, it cites the exact note title (e.g. <code className="text-cyan-300">[Cell Energy - Slide 4]</code>). You never have to guess if the AI made it up!
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
            <h4 className="flex items-center gap-2 font-bold text-white text-sm">
              <span className="text-base">⚡</span> 3. Auto-Generates Revision Cards & Exam Quizzes
            </h4>
            <p className="mt-1 text-slate-400">
              In <strong>Feature 3 (Revision Studio)</strong>, you can turn your uploaded PDF directly into comprehensive revision flashcard decks and targeted exam practice tests with one click.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <p className="text-[11px] font-semibold text-emerald-200 flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>100% Private & Sandboxed: Your course documents are processed on your device and are never sold or trained on.</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-2 text-xs font-bold text-slate-950 shadow transition hover:scale-105"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
