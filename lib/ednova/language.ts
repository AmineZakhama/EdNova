import type { SupportedLanguage } from "@/lib/ednova/types";

/**
 * Common English function words, core vocabulary, STEM terms, and chat abbreviations.
 * Used for typo-tolerant English detection so student prompts with typos or math notation
 * (e.g. "step 2", "wat is mitosis", "can u giv me an exampel") are never falsely
 * classified as foreign languages or routed to Gemini.
 */
const COMMON_ENGLISH_WORDS = new Set([
  // Core function words & pronouns
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
  "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
  "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
  "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "it's", "its",
  "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same",
  "she", "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what", "when", "where",
  "which", "while", "who", "whom", "why", "will", "with", "won't", "would", "wouldn't", "you",
  "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",

  // Academic, learning & common verbs
  "answer", "ask", "calculate", "check", "chemistry", "biology", "physics", "math", "mathematics",
  "concept", "confused", "definition", "define", "describe", "detail", "difference", "example",
  "explain", "explanation", "figure", "formula", "give", "help", "hint", "idea", "know", "learn",
  "learning", "lesson", "mean", "meaning", "memorize", "memory", "method", "mitosis", "need",
  "next", "note", "notes", "page", "practice", "problem", "question", "quiz", "reason", "remember",
  "repeat", "review", "show", "solve", "solution", "stage", "stages", "step", "steps", "study",
  "studying", "summary", "summarize", "tell", "test", "think", "time", "topic", "try", "understand",
  "understanding", "use", "using", "work", "worked", "write",

  // Common chat abbreviations, slang & typos
  "u", "ur", "r", "plz", "pls", "wat", "wht", "y", "im", "dont", "cant", "doesnt", "didnt", "wont",
  "isnt", "arent", "diff", "calc", "eq", "eqn", "equation", "def", "prob", "prblm", "thx", "ty",
  "tho", "thru", "bcuz", "bcoz", "cuz", "ex", "eg", "ie", "vs", "etc", "ok", "okay",
]);

/**
 * Checks whether a word is at most 1 typo edit away (insertion, deletion, substitution)
 * from a known English word in the dictionary.
 */
function isCloseEnglishWord(word: string): boolean {
  if (word.length < 3) return false;
  if (COMMON_ENGLISH_WORDS.has(word)) return true;

  // For words with length >= 4, check edit distance 1 against words of similar length
  for (const candidate of COMMON_ENGLISH_WORDS) {
    if (Math.abs(candidate.length - word.length) > 1) continue;
    if (isWithinOneEdit(word, candidate)) return true;
  }
  return false;
}

function isWithinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) {
        i++;
      } else if (a.length < b.length) {
        j++;
      } else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }

  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

/**
 * Local language detector with built-in English typo tolerance.
 * Ensures English requests (even with typos or numbers like "step 2" or "2+2")
 * stay on the Central LLM Service and NEVER get sent through Gemini.
 *
 * Only requests that are genuinely Arabic, Tunisian Darija, or French
 * are flagged for translation.
 */
export function detectLikelyLanguage(text: string, preferredLanguage?: SupportedLanguage): SupportedLanguage {
  const trimmed = text.trim();
  if (!trimmed) return preferredLanguage || "en";

  // 1. Arabic Script Check (Unicode block)
  if (/\p{Script=Arabic}/u.test(trimmed)) {
    const normalizedArabic = trimmed.toLowerCase();
    const darijaArabicKeywords = /(?:شنو|شنية|شنوة|برشا|بزاف|مزيان|علاش|فين|مافهمتش|مش فاهم|نحب|باش|وقتاش|كفاش|توا)/u;
    return darijaArabicKeywords.test(normalizedArabic) ? "darija" : "ar";
  }

  const normalized = trimmed.toLowerCase();

  // 2. French Character & Keyword Check
  const hasFrenchAccents = /[àâçéèêëîïôùûüÿœ]/.test(normalized);
  const frenchKeywords = [
    " je ", "j'", " ne ", " pas ", " est ", " sont ", " avec ", " pour ", " pourquoi",
    "comment ", "bonjour", " comprendre", " équation", "cours", "révision", " aidez",
    "merci", "salut", "exercice", "devoir", "cette", "dans", "qu'est-ce",
  ];
  const padded = ` ${normalized} `;
  const frenchKeywordMatches = frenchKeywords.filter((kw) => padded.includes(kw)).length;

  if (hasFrenchAccents || frenchKeywordMatches >= 2 || (frenchKeywordMatches >= 1 && normalized.length < 40)) {
    // Verify it's not predominantly English with an accidental accent
    const words = normalized.match(/[a-z0-9']+/g) || [];
    const englishWordCount = words.filter((w) => COMMON_ENGLISH_WORDS.has(w) || isCloseEnglishWord(w)).length;
    if (frenchKeywordMatches > englishWordCount || (hasFrenchAccents && englishWordCount <= 1)) {
      return "fr";
    }
  }

  // 3. Arabizi / Latin Tunisian Darija Check
  // Note: Only words with embedded Arabizi numeral substitutions (e.g. "3lech", "n7el", "7it"),
  // NEVER isolated numbers like "step 2" or "2 + 2"!
  const arabiziKeywords = [
    "chno", "chnou", "chnowa", "chnia", "kifach", "kifech", "3lech", "3alech",
    "7it", "mouch", "ma fhemt", "mafhemt", "barcha", "bech", "famma", "win",
    "9al", "khir", "3aslema", "brabi", "chkoun", "wa9tech", "n7eb", "ye5i",
  ];
  const hasArabiziKeyword = arabiziKeywords.some((signal) => padded.includes(` ${signal} `) || normalized.includes(signal));

  // Arabizi numeral substitutions: e.g. "3lech", "n7el", "7it", "9olli" (letters immediately adjacent to numbers)
  const hasArabiziNumeralWord = /\b[a-z]+[23579][a-z]*\b/i.test(normalized) || /\b[23579][a-z]{2,}\b/i.test(normalized);

  if (hasArabiziKeyword || hasArabiziNumeralWord) {
    const words = normalized.match(/[a-z0-9']+/g) || [];
    const englishCount = words.filter((w) => COMMON_ENGLISH_WORDS.has(w) || isCloseEnglishWord(w)).length;
    // Only classify as Darija if it truly looks Arabizi and doesn't contain mostly English words
    if (englishCount === 0 || (hasArabiziKeyword && englishCount <= 1)) {
      return "darija";
    }
  }

  // 4. Typo-Tolerant English Check
  // Extract alphabetic word tokens
  const words = normalized.match(/[a-z0-9']+/g) || [];
  if (words.length > 0) {
    let recognizedEnglishCount = 0;
    for (const w of words) {
      // Standalone numbers are not foreign words
      if (/^\d+$/.test(w)) {
        recognizedEnglishCount++;
        continue;
      }
      if (COMMON_ENGLISH_WORDS.has(w) || isCloseEnglishWord(w)) {
        recognizedEnglishCount++;
      }
    }

    // If any recognizable English word or English typo is found, default to English
    if (recognizedEnglishCount > 0) {
      return "en";
    }
  }

  // 5. If user profile preferred language is specified and not Arabic/French, default to English
  if (preferredLanguage === "en" || !preferredLanguage) {
    return "en";
  }

  return preferredLanguage;
}

export function languageName(language: SupportedLanguage): string {
  return { en: "English", fr: "French", ar: "Arabic", darija: "Tunisian Darija" }[language];
}
