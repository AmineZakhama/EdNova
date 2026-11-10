import type { KnowledgeChunk, KnowledgeNote } from "@/lib/ednova/types";

const CHUNK_SIZE = 850;
const CHUNK_OVERLAP = 130;

/** Lightweight BM25 is deliberate: no extra embedding service or model calls. */
export function chunkNotes(notes: KnowledgeNote[]): KnowledgeChunk[] {
  return notes.flatMap((note) => chunkText(note.content).map((content, index) => ({
    id: `${note.id}-${index + 1}`,
    title: note.title,
    content,
  })));
}

export function retrieveRelevantChunks(query: string, notes: KnowledgeNote[], limit = 3): KnowledgeChunk[] {
  const chunks = chunkNotes(notes);
  if (!chunks.length || !query.trim()) return [];

  const queryTerms = uniqueTerms(query);
  if (!queryTerms.length) return [];
  const documents = chunks.map((chunk) => tokenize(chunk.content));
  const averageLength = documents.reduce((sum, terms) => sum + terms.length, 0) / documents.length || 1;
  const totalDocuments = documents.length;
  const documentFrequency = new Map<string, number>();

  for (const term of queryTerms) {
    documentFrequency.set(term, documents.reduce((count, document) => count + (document.includes(term) ? 1 : 0), 0));
  }

  const k1 = 1.2;
  const b = 0.75;
  return chunks
    .map((chunk, index) => {
      const terms = documents[index];
      const score = queryTerms.reduce((sum, term) => {
        const frequency = terms.filter((word) => word === term).length;
        if (!frequency) return sum;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (totalDocuments - df + 0.5) / (df + 0.5));
        return sum + idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (terms.length / averageLength))));
      }, 0);
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > CHUNK_SIZE) {
      chunks.push(current);
      current = `${current.slice(-CHUNK_OVERLAP)}\n\n${paragraph}`.slice(0, CHUNK_SIZE);
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((term) => term.length > 1) ?? [];
}

function uniqueTerms(value: string): string[] {
  return [...new Set(tokenize(value))];
}
