import { sampleCourseNote } from "@/lib/ednova/sample-course";
import type { KnowledgeNote } from "@/lib/ednova/types";

export const KNOWLEDGE_STORAGE_KEY = "ednova-knowledge-v1";

export function loadKnowledgeNotes(): KnowledgeNote[] {
  if (typeof window === "undefined") return [sampleCourseNote];
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
    const notes = raw ? JSON.parse(raw) as KnowledgeNote[] : [];
    return [sampleCourseNote, ...notes.filter(isNote).filter((note) => note.id !== sampleCourseNote.id)];
  } catch {
    return [sampleCourseNote];
  }
}

export function addKnowledgeNote(input: Pick<KnowledgeNote, "title" | "content">): KnowledgeNote {
  const note: KnowledgeNote = {
    id: crypto.randomUUID(),
    title: input.title.trim().slice(0, 120) || "Untitled note",
    content: input.content.trim().slice(0, 40_000),
    createdAt: new Date().toISOString(),
  };
  const notes = loadKnowledgeNotes().filter((current) => !current.sample);
  window.localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify([note, ...notes]));
  return note;
}

export function removeKnowledgeNote(id: string): void {
  if (id === sampleCourseNote.id) return;
  const notes = loadKnowledgeNotes().filter((note) => !note.sample && note.id !== id);
  window.localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(notes));
}

function isNote(value: unknown): value is KnowledgeNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<KnowledgeNote>;
  return typeof note.id === "string" && typeof note.title === "string" && typeof note.content === "string" && typeof note.createdAt === "string";
}
