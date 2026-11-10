// ---------------------------------------------------------------------------
// EdNova Gamified Micro-Quiz Engine & Audio Synthesis
// Instant 1-question recall quizzes during tutor loading + Solo Gamified Quiz Arena
// ---------------------------------------------------------------------------

export type GamifiedQuestion = {
  id: string;
  subject: string;
  subtopic: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0, 1, 2, or 3
  explanation: string;
  xpReward: number;
};

// ---------------------------------------------------------------------------
// High-Yield Question Bank Across Favorite Learner Topics
// ---------------------------------------------------------------------------

export const GAMIFIED_QUESTION_BANK: GamifiedQuestion[] = [
  // --- Biology ---
  {
    id: "bio-1",
    subject: "Biology",
    subtopic: "Cellular Respiration & Photosynthesis",
    question: "Where in a plant cell does the light-dependent reaction of photosynthesis occur?",
    options: [
      "Thylakoid membrane",
      "Stroma",
      "Mitochondrial matrix",
      "Endoplasmic reticulum",
    ],
    correctIndex: 0,
    explanation: "Chlorophyll molecules in thylakoid membranes capture photons and initiate the electron transport chain, while the Calvin cycle occurs in the stroma.",
    xpReward: 15,
  },
  {
    id: "bio-2",
    subject: "Biology",
    subtopic: "Cell Division (Mitosis)",
    question: "During which mitotic phase do sister chromatids pull apart toward opposite cell poles?",
    options: [
      "Prophase",
      "Metaphase",
      "Anaphase",
      "Telophase",
    ],
    correctIndex: 2,
    explanation: "During anaphase, the spindle fibers shorten and pull sister chromatids apart to become individual chromosomes at opposite poles.",
    xpReward: 15,
  },
  {
    id: "bio-3",
    subject: "Biology",
    subtopic: "Molecular Genetics",
    question: "Which enzyme is primarily responsible for synthesizing mRNA from a DNA template strand?",
    options: [
      "DNA Ligase",
      "RNA Polymerase",
      "Helicase",
      "Topoisomerase",
    ],
    correctIndex: 1,
    explanation: "RNA Polymerase binds to the gene promoter and reads the template DNA strand to synthesize a complementary single-stranded mRNA transcript.",
    xpReward: 15,
  },
  {
    id: "bio-4",
    subject: "Biology",
    subtopic: "Cell Transport",
    question: "What term describes the movement of water molecules across a selectively permeable membrane down their concentration gradient?",
    options: [
      "Active transport",
      "Osmosis",
      "Endocytosis",
      "Facilitated diffusion",
    ],
    correctIndex: 1,
    explanation: "Osmosis is passive net diffusion of water across a semipermeable membrane from low solute to high solute concentration.",
    xpReward: 15,
  },

  // --- Mathematics / Calculus ---
  {
    id: "math-1",
    subject: "Mathematics",
    subtopic: "Differential Calculus",
    question: "What is the derivative of f(x) = ln(3x) with respect to x for x > 0?",
    options: [
      "3 / x",
      "1 / x",
      "1 / (3x)",
      "3 ln(x)",
    ],
    correctIndex: 1,
    explanation: "By chain rule or log rules: ln(3x) = ln(3) + ln(x). The derivative of constant ln(3) is 0, and derivative of ln(x) is 1/x.",
    xpReward: 15,
  },
  {
    id: "math-2",
    subject: "Mathematics",
    subtopic: "Integral Calculus",
    question: "What is the value of ∫ (2x + 3) dx from x = 0 to x = 2?",
    options: [
      "8",
      "10",
      "12",
      "14",
    ],
    correctIndex: 1,
    explanation: "The antiderivative is x² + 3x. Evaluating at 2: (4 + 6) - (0 + 0) = 10.",
    xpReward: 15,
  },
  {
    id: "math-3",
    subject: "Mathematics",
    subtopic: "Linear Algebra",
    question: "If matrix A has determinant 0, which statement is always true?",
    options: [
      "A is an orthogonal matrix",
      "A has an inverse",
      "A is non-invertible (singular)",
      "All eigenvalues of A are 0",
    ],
    correctIndex: 2,
    explanation: "A square matrix with determinant equal to zero is singular and cannot be inverted, meaning its rows or columns are linearly dependent.",
    xpReward: 15,
  },
  {
    id: "math-4",
    subject: "Mathematics",
    subtopic: "Probability & Combinatorics",
    question: "How many distinct ways can 3 books be arranged on a single shelf?",
    options: [
      "3",
      "6",
      "9",
      "12",
    ],
    correctIndex: 1,
    explanation: "The number of permutations of 3 distinct items is 3! = 3 × 2 × 1 = 6 arrangements.",
    xpReward: 15,
  },

  // --- Computer Science ---
  {
    id: "cs-1",
    subject: "Computer Science",
    subtopic: "Algorithms & Complexity",
    question: "What is the average-case time complexity of searching in a balanced Binary Search Tree (AVL / Red-Black)?",
    options: [
      "O(1)",
      "O(log n)",
      "O(n)",
      "O(n log n)",
    ],
    correctIndex: 1,
    explanation: "Because a balanced BST halves the search space at each depth level, finding an element takes logarithmic time O(log n).",
    xpReward: 15,
  },
  {
    id: "cs-2",
    subject: "Computer Science",
    subtopic: "Data Structures",
    question: "Which data structure operates on a Last-In, First-Out (LIFO) order?",
    options: [
      "Queue",
      "Stack",
      "Linked List",
      "Binary Heap",
    ],
    correctIndex: 1,
    explanation: "A stack pushes and pops items from the top, making the most recently added item the first one removed (LIFO).",
    xpReward: 15,
  },
  {
    id: "cs-3",
    subject: "Computer Science",
    subtopic: "Networking & Protocols",
    question: "Which transport layer protocol provides connection-oriented, ordered, and error-checked packet delivery?",
    options: [
      "UDP",
      "IP",
      "TCP",
      "ICMP",
    ],
    correctIndex: 2,
    explanation: "Transmission Control Protocol (TCP) uses a three-way handshake and packet acknowledgments to guarantee ordered, reliable byte streams.",
    xpReward: 15,
  },
  {
    id: "cs-4",
    subject: "Computer Science",
    subtopic: "Operating Systems",
    question: "What condition occurs when two processes are indefinitely waiting for resources held by each other?",
    options: [
      "Starvation",
      "Deadlock",
      "Race condition",
      "Thrashing",
    ],
    correctIndex: 1,
    explanation: "Deadlock occurs when processes in a circular wait hold non-preemptible resources while waiting for another, freezing progress.",
    xpReward: 15,
  },

  // --- Physics ---
  {
    id: "phys-1",
    subject: "Physics",
    subtopic: "Classical Mechanics",
    question: "According to Newton's Second Law, what happens to acceleration if net force is doubled while mass is quadrupled?",
    options: [
      "Acceleration doubles",
      "Acceleration is halved",
      "Acceleration remains unchanged",
      "Acceleration quadruples",
    ],
    correctIndex: 1,
    explanation: "Since a = F / m: (2F) / (4m) = 1/2 (F / m). The resulting acceleration is cut in half.",
    xpReward: 15,
  },
  {
    id: "phys-2",
    subject: "Physics",
    subtopic: "Electromagnetism",
    question: "Which law states that the induced electromotive force in any closed circuit is proportional to the rate of change of magnetic flux?",
    options: [
      "Coulomb's Law",
      "Ampère's Law",
      "Faraday's Law of Induction",
      "Gauss's Law",
    ],
    correctIndex: 2,
    explanation: "Faraday's Law (ε = -dΦ/dt) shows that changing magnetic flux induces a voltage whose polarity opposes the change (Lenz's Law).",
    xpReward: 15,
  },
  {
    id: "phys-3",
    subject: "Physics",
    subtopic: "Thermodynamics",
    question: "Which law of thermodynamics establishes that the total entropy of an isolated system never decreases over time?",
    options: [
      "Zeroth Law",
      "First Law",
      "Second Law",
      "Third Law",
    ],
    correctIndex: 2,
    explanation: "The Second Law of Thermodynamics dictates that spontaneous natural processes increase universal entropy (ΔS_total ≥ 0).",
    xpReward: 15,
  },
  {
    id: "phys-4",
    subject: "Physics",
    subtopic: "Optics & Waves",
    question: "What wave phenomenon causes light to spread out and bend around the sharp corners of an obstacle?",
    options: [
      "Refraction",
      "Diffraction",
      "Total internal reflection",
      "Polarization",
    ],
    correctIndex: 1,
    explanation: "Diffraction occurs when a wavefront encounters an aperture or obstacle with dimensions comparable to its wavelength.",
    xpReward: 15,
  },

  // --- Data Science & AI ---
  {
    id: "ai-1",
    subject: "Data Science & AI",
    subtopic: "Machine Learning Concepts",
    question: "What term describes a model that memorizes training noise so well that its test accuracy drastically plummets?",
    options: [
      "Underfitting",
      "Overfitting",
      "Data leakage",
      "Quantization",
    ],
    correctIndex: 1,
    explanation: "Overfitting happens when model complexity is too high for the dataset, capturing noise instead of generalizable latent patterns.",
    xpReward: 15,
  },
  {
    id: "ai-2",
    subject: "Data Science & AI",
    subtopic: "Deep Learning Architectures",
    question: "Which mechanism allows Transformer models to assign varying weights to different words in an input sequence simultaneously?",
    options: [
      "Recurrent memory gates",
      "Self-Attention mechanism",
      "Max-Pooling filters",
      "Stochastic Gradient Descent",
    ],
    correctIndex: 1,
    explanation: "Scaled dot-product self-attention computes query, key, and value vectors so tokens can attend across the entire sequence in parallel.",
    xpReward: 15,
  },
  {
    id: "ai-3",
    subject: "Data Science & AI",
    subtopic: "Optimization",
    question: "What hyperparameter controls the step size taken towards the loss minimum during gradient descent iterations?",
    options: [
      "Batch size",
      "Learning rate",
      "Weight decay",
      "Dropout rate",
    ],
    correctIndex: 1,
    explanation: "The learning rate (α) scales the gradient updates. If too small, training crawls; if too large, updates oscillate or diverge.",
    xpReward: 15,
  },

  // --- Chemistry ---
  {
    id: "chem-1",
    subject: "Chemistry",
    subtopic: "Acids, Bases & pH",
    question: "A solution has a hydrogen ion concentration [H+] of 1.0 × 10⁻⁴ mol/L. What is its pH?",
    options: [
      "4",
      "7",
      "10",
      "14",
    ],
    correctIndex: 0,
    explanation: "pH is defined as -log₁₀[H+]. Here, -log₁₀(10⁻⁴) = 4, which is an acidic solution.",
    xpReward: 15,
  },
  {
    id: "chem-2",
    subject: "Chemistry",
    subtopic: "Chemical Bonding",
    question: "Which type of chemical bond forms between two atoms through the sharing of electron pairs?",
    options: [
      "Ionic bond",
      "Covalent bond",
      "Metallic bond",
      "Hydrogen bond",
    ],
    correctIndex: 1,
    explanation: "Covalent bonds form when nonmetals share valence electrons to achieve stable octet noble-gas electron configurations.",
    xpReward: 15,
  },
];

// ---------------------------------------------------------------------------
// Smart Question Picker
// Matches user favorites, prompt context, and avoids repeating recent questions
// ---------------------------------------------------------------------------

export function pickGamifiedQuestion(
  favoriteSubjects?: string[],
  contextText?: string,
  excludeIds?: string[]
): GamifiedQuestion {
  const bank = GAMIFIED_QUESTION_BANK;
  const excludeSet = new Set(excludeIds ?? []);

  // 1. Try keyword matching on question or topic text
  if (contextText && contextText.trim().length > 2) {
    const query = contextText.toLowerCase();
    const keywordMatches = bank.filter(
      (q) =>
        !excludeSet.has(q.id) &&
        (query.includes(q.subject.toLowerCase()) ||
          query.includes(q.subtopic.toLowerCase()) ||
          q.question.toLowerCase().split(/\s+/).some((word) => word.length > 4 && query.includes(word)))
    );

    if (keywordMatches.length > 0) {
      return keywordMatches[Math.floor(Math.random() * keywordMatches.length)];
    }
  }

  // 2. Filter by user's favorite subjects
  if (favoriteSubjects && favoriteSubjects.length > 0) {
    const normalizedFavs = favoriteSubjects.map((s) => s.trim().toLowerCase());
    const subjectMatches = bank.filter(
      (q) =>
        !excludeSet.has(q.id) &&
        normalizedFavs.some((fav) => q.subject.toLowerCase().includes(fav) || fav.includes(q.subject.toLowerCase()))
    );

    if (subjectMatches.length > 0) {
      return subjectMatches[Math.floor(Math.random() * subjectMatches.length)];
    }
  }

  // 3. Fallback: Any unseen question
  const unseen = bank.filter((q) => !excludeSet.has(q.id));
  if (unseen.length > 0) {
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  // 4. If all seen, pick any random question
  return bank[Math.floor(Math.random() * bank.length)];
}

// ---------------------------------------------------------------------------
// Procedural Web Audio Sound Synthesizer
// Zero external dependencies - crisp, instant feedback
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioConstructor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioConstructor) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioConstructor();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Celebratory rising harmonic chime on correct answer (+15 XP) */
export function playQuizSuccessSound(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Ascending arpeggio: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.36);
    });
  } catch {
    // Audio synthesis failure should never crash UI
  }
}

/** Gentle, encouraging warm tone on incorrect attempt */
export function playQuizTryAgainSound(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.25); // Drop to F4

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.33);
  } catch {
    // Audio synthesis failure should never crash UI
  }
}

/** Crisp micro-click when selecting an option */
export function playQuizOptionClickSound(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Audio synthesis failure should never crash UI
  }
}
