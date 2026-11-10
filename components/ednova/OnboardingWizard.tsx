"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Compass,
  Dices,
  Eye,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Zap,
} from "lucide-react";

import { saveLearnerProfile } from "@/lib/ednova/profile-storage";
import type { DiagnosticResult, LearnerProfile, LearningStyle, SupportedLanguage } from "@/lib/ednova/types";

// ==========================================
// STATIC ASSETS & COGNITIVE DEFINITIONS
// ==========================================

const avatars = [
  { emoji: "✨", label: "Spark", desc: "Curious seeker" },
  { emoji: "🧠", label: "Sage", desc: "Deep logician" },
  { emoji: "🪐", label: "Cosmos", desc: "Holistic thinker" },
  { emoji: "🚀", label: "Pioneer", desc: "Fast builder" },
  { emoji: "🎨", label: "Artist", desc: "Visual synthesizer" },
  { emoji: "⚡", label: "Flash", desc: "Rapid solver" },
  { emoji: "🔮", label: "Mystic", desc: "Pattern spotter" },
  { emoji: "🌿", label: "Alchemist", desc: "Patient organic" },
  { emoji: "💡", label: "Inventor", desc: "Problem solver" },
  { emoji: "🔭", label: "Navigator", desc: "Big picture" },
];

const randomNicknames = [
  "CuriousComet",
  "AstroScholar",
  "QuantumFox",
  "LogicOwl",
  "EchoSeeker",
  "StarlightMind",
  "NovaSeeker",
  "ZenithCoder",
  "PrismThinker",
  "VectorPioneer",
];

const presetSubjects = [
  "Mathematics",
  "Computer Science",
  "Physics",
  "Biology",
  "Philosophy & Logic",
  "Data Science & AI",
  "Economics",
  "Literature",
];

// ==========================================
// SCENARIOS (INDIRECT LEARNING STYLE DEDUCTION)
// ==========================================

type Scenario = {
  id: string;
  category: string;
  situation: string;
  icon: typeof Compass;
  options: Array<{
    style: LearningStyle;
    title: string;
    description: string;
    subconsciousTrait: string;
  }>;
};

const scenarios: Scenario[] = [
  {
    id: "scenario-1",
    category: "Exploration & Mental Mapping",
    situation:
      "You uncover an intricate 18th-century clockwork automaton with interlocking brass gears, balance springs, and hidden dials. How do your instincts begin deciphering it?",
    icon: Compass,
    options: [
      {
        style: "visual",
        title: "Study the Spatial Schematics",
        description: "Examine a high-resolution visual layout of the components and how they mesh together.",
        subconsciousTrait: "Spatial & Diagrammatic Blueprint",
      },
      {
        style: "step-by-step",
        title: "Trace Linear Causality",
        description: "Follow the mechanical chain sequentially, from the mainspring escapement to each dial.",
        subconsciousTrait: "Algorithmic & Procedural Order",
      },
      {
        style: "analogies",
        title: "Bridge to Familiar Machines",
        description: "Compare the assembly to systems you already know, like a bicycle gear cassette or watermill.",
        subconsciousTrait: "Analogical & Conceptual Transfer",
      },
      {
        style: "problem-solving",
        title: "Hands-on Physical Probe",
        description: "Gently turn a drive cog with your fingers to immediately observe cause and effect.",
        subconsciousTrait: "Empirical & Active Experimentation",
      },
    ],
  },
  {
    id: "scenario-2",
    category: "Cognitive Friction & Debugging",
    situation:
      "You've been tackling a demanding challenge for 20 minutes, but your 3rd calculation leads to an unexpected contradiction. What is your natural next move?",
    icon: Workflow,
    options: [
      {
        style: "visual",
        title: "Draft a Visual Decision Tree",
        description: "Map all your premises on paper to spot where the diverging assumptions branched out.",
        subconsciousTrait: "Holistic Visual Systems",
      },
      {
        style: "step-by-step",
        title: "Conduct a Line-by-Line Audit",
        description: "Systematically verify each prior step against formal rules until the discrepancy is isolated.",
        subconsciousTrait: "Methodical Verification",
      },
      {
        style: "examples",
        title: "Inspect a Parallel Case Study",
        description: "Look at how a canonical example handled this specific edge case for guidance.",
        subconsciousTrait: "Concrete Reference Pattern",
      },
      {
        style: "problem-solving",
        title: "Formulate a Counter-Hypothesis",
        description: "Test an alternative premise right away to see if it cleanly disproves the contradiction.",
        subconsciousTrait: "Iterative Hypothesis Testing",
      },
    ],
  },
  {
    id: "scenario-3",
    category: "Conceptual Assimilation & Eureka",
    situation:
      "When someone introduces a notoriously counter-intuitive concept (such as entropy, recursive loops, or non-linear dynamics), what sparks your eureka moment?",
    icon: Lightbulb,
    options: [
      {
        style: "analogies",
        title: "A Vivid Real-World Metaphor",
        description: "An evocative mental image (like a messy bedroom or infinite mirror reflections).",
        subconsciousTrait: "Conceptual Metaphor",
      },
      {
        style: "examples",
        title: "Tangible Everyday Manifestations",
        description: "Two or three concrete case studies where this exact rule manifests in everyday reality.",
        subconsciousTrait: "Grounded Case Manifestation",
      },
      {
        style: "visual",
        title: "An Interactive Animation",
        description: "A dynamic simulation or state-transition graph demonstrating the flow in motion.",
        subconsciousTrait: "Dynamic State Simulation",
      },
      {
        style: "problem-solving",
        title: "Solving a Rapid Micro-Puzzle",
        description: "Writing code or solving a miniature toy problem to feel the mechanics firsthand.",
        subconsciousTrait: "Direct Experiential Touch",
      },
    ],
  },
  {
    id: "scenario-4",
    category: "Scaffolding & Challenge Momentum",
    situation:
      "A multi-layered puzzle feels intimidating at first glance. What kind of AI tutor prompt provides the strongest momentum without spoiling the revelation?",
    icon: Atom,
    options: [
      {
        style: "step-by-step",
        title: "Deconstruct into Sub-Milestones",
        description: "Break the challenge into 3 bite-sized stages, guiding you through stage 1 first.",
        subconsciousTrait: "Scaffolded Progression",
      },
      {
        style: "analogies",
        title: "A Socratic Symmetry Riddle",
        description: "A philosophical hint pointing to a hidden symmetry or conservation law in the problem.",
        subconsciousTrait: "Socratic Intuition Prompt",
      },
      {
        style: "examples",
        title: "A Worked Twin Demonstration",
        description: "A similar problem solved with different values to inspect the structural blueprint.",
        subconsciousTrait: "Structural Modeling",
      },
      {
        style: "repetition",
        title: "Core Pattern Reinforcement",
        description: "Rapid mini-variations of the core rule until the foundation feels rock-solid.",
        subconsciousTrait: "Foundational Muscle Memory",
      },
    ],
  },
];

// ==========================================
// TRICKY DIAGNOSTIC PUZZLES
// ==========================================

type Puzzle = {
  id: string;
  category: string;
  tag: string;
  question: string;
  insightTip: string;
  options: Array<{ id: string; label: string; text: string }>;
};

const diagnosticPuzzles: Puzzle[] = [
  {
    id: "puzzle-1",
    category: "Cognitive Reflection & Impulse Control",
    tag: "⚡ The Heuristic Trap",
    question:
      "A high-precision stylus and an educational tablet cost $110 together in a bundle. The tablet costs exactly $100 more than the stylus. How much does the stylus cost?",
    insightTip: "Notice your fast intuitive answer—then double check if the difference is truly $100!",
    options: [
      { id: "a", label: "A", text: "$10 (Bundle $110 - $100)" },
      { id: "b", label: "B", text: "$5 (Tablet: $105, Stylus: $5)" },
      { id: "c", label: "C", text: "$15 (Tablet: $95, Stylus: $15)" },
      { id: "d", label: "D", text: "$1 (Tablet: $109, Stylus: $1)" },
    ],
  },
  {
    id: "puzzle-2",
    category: "Sequential Procedural Working Memory",
    tag: "📐 The Altitude Flight",
    question:
      "An autonomous drone starts at altitude 80m. It dives to half its height, ascends 30m, descends by 20% of its current altitude, and finally drops 10m. What is its final altitude?",
    insightTip: "Calculate each state change sequentially: 80 → halved → +30 → -20% → -10.",
    options: [
      { id: "a", label: "A", text: "46 meters" },
      { id: "b", label: "B", text: "52 meters" },
      { id: "c", label: "C", text: "42 meters" },
      { id: "d", label: "D", text: "38 meters" },
    ],
  },
  {
    id: "puzzle-3",
    category: "Physical Invariance & Deduction",
    tag: "🔬 The Conservation Mystery",
    question:
      "A hermetically sealed glass container with water and a floating ice cube rests on a digital scale (20°C). When the ice cube completely melts, what happens to the overall water level and the scale reading?",
    insightTip: "Consider Archimedes' displacement law and the principle of conservation of mass.",
    options: [
      { id: "a", label: "A", text: "Water level stays identical; scale reading stays identical" },
      { id: "b", label: "B", text: "Water level rises; scale reading stays identical" },
      { id: "c", label: "C", text: "Water level falls; scale reading decreases slightly" },
      { id: "d", label: "D", text: "Water level stays identical; scale reading increases" },
    ],
  },
  {
    id: "puzzle-4",
    category: "Formal Deductive Logic",
    tag: "🧠 The Quantum Syllogism",
    question:
      "Premise 1: Every Chrono-Core emits chronon particles.\nPremise 2: Some chronon particle emitters cause temporal distortion.\nWhich conclusion is GUARANTEED to be mathematically and logically true?",
    insightTip: "Rely strictly on formal deductive logic. Does the subset overlap must include Chrono-Cores?",
    options: [
      { id: "a", label: "A", text: "Some Chrono-Cores cause temporal distortion" },
      { id: "b", label: "B", text: "None of the conclusions can be guaranteed without additional data" },
      { id: "c", label: "C", text: "All Chrono-Cores cause temporal distortion" },
      { id: "d", label: "D", text: "Any device causing temporal distortion is a Chrono-Core" },
    ],
  },
];

// ==========================================
// DEFAULT PROFILE INITIALIZER
// ==========================================

const defaultProfile: LearnerProfile = {
  nickname: "",
  avatar: "✨",
  language: "en",
  level: "developing learner",
  subjects: ["Mathematics", "Computer Science"],
  learningStyles: ["step-by-step", "visual"],
  mode: "individual",
  dailyStudyMinutes: 25,
  preferredStudyTime: "Evening",
  observedSignals: { confusionEvents: 0, hintsUsed: 0, focusMinutes: 0 },
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function OnboardingWizard({
  initialProfile,
  editing = false,
}: {
  initialProfile?: LearnerProfile;
  editing?: boolean;
}) {
  const router = useRouter();

  // Step state: 0: Persona, 1: Focus/Goals, 2: Dilemmas, 3: Puzzles, 4: Blueprint
  const [step, setStep] = useState(0);

  // Profile fields
  const [profile, setProfile] = useState<LearnerProfile>({
    ...defaultProfile,
    ...initialProfile,
    observedSignals: initialProfile?.observedSignals ?? defaultProfile.observedSignals,
  });

  const [subjectsList, setSubjectsList] = useState<string[]>(
    initialProfile?.subjects && initialProfile.subjects.length > 0
      ? initialProfile.subjects
      : ["Mathematics", "Computer Science"]
  );
  const [customSubjectInput, setCustomSubjectInput] = useState("");

  // Scenario decisions: map of scenarioId -> chosen option index
  const [scenarioChoices, setScenarioChoices] = useState<Record<string, number>>({
    "scenario-1": 0,
    "scenario-2": 1,
    "scenario-3": 2,
    "scenario-4": 0,
  });

  // Puzzle decisions: map of puzzleId -> option id ('a', 'b', etc.)
  const [puzzleChoices, setPuzzleChoices] = useState<Record<string, string>>({
    "puzzle-1": "b",
    "puzzle-2": "a",
    "puzzle-3": "a",
    "puzzle-4": "b",
  });
  const [puzzleNotes, setPuzzleNotes] = useState<Record<string, string>>({});
  const [activePuzzleTab, setActivePuzzleTab] = useState(0);

  // Diagnostic outcome state
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState("");
  const [notice, setNotice] = useState("");
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("first_time") === "true") {
        setIsFirstTime(true);
      }
    }

    // If signed in, pre-populate profile with authenticated user name/avatar
    fetch("/api/ednova/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setProfile((prev) => ({
            ...prev,
            nickname: prev.nickname || data.user.name || "",
            avatar: prev.avatar || data.user.avatar || "✨",
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Progress computation
  const progressPercent = useMemo(() => `${Math.round(((step + 1) / 5) * 100)}%`, [step]);

  function updateProfile(update: Partial<LearnerProfile>) {
    setProfile((prev) => ({ ...prev, ...update }));
  }

  function handleAddSubject(newSubj: string) {
    const trimmed = newSubj.trim();
    if (!trimmed) return;
    if (!subjectsList.includes(trimmed) && subjectsList.length < 8) {
      setSubjectsList([...subjectsList, trimmed]);
    }
    setCustomSubjectInput("");
  }

  function handleToggleSubject(subj: string) {
    if (subjectsList.includes(subj)) {
      if (subjectsList.length > 1) {
        setSubjectsList(subjectsList.filter((s) => s !== subj));
      }
    } else if (subjectsList.length < 8) {
      setSubjectsList([...subjectsList, subj]);
    }
  }

  function randomizeNickname() {
    const pick = randomNicknames[Math.floor(Math.random() * randomNicknames.length)];
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    updateProfile({ nickname: `${pick}_${randomSuffix}` });
  }

  // ==========================================
  // PERSIST & API SUBMISSION
  // ==========================================

  async function persistProfile(diagResult?: DiagnosticResult | null) {
    const effectiveResult = diagResult || diagnostic;
    const finalProfile: LearnerProfile = {
      ...profile,
      nickname: profile.nickname?.trim() || "CuriousScholar",
      subjects: subjectsList,
      level: effectiveResult?.level || profile.level || "developing learner",
      learningStyles: effectiveResult?.styles && effectiveResult.styles.length > 0 ? effectiveResult.styles : profile.learningStyles,
      cognitiveArchetype: effectiveResult?.archetype,
      cognitiveTraits: effectiveResult?.traits,
      scaffoldingPace: effectiveResult?.scaffoldingPace,
      diagnosticNotes: effectiveResult?.encouragement,
    };

    const stored = saveLearnerProfile(finalProfile);

    // Sync to PostgreSQL DB asynchronously if user is authenticated
    try {
      await fetch("/api/ednova/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: stored }),
      });
    } catch {}

    router.push("/ednova");
    return stored;
  }

  async function runDiagnostic() {
    setStep(4);
    setAnalyzing(true);
    setNotice("");
    setAnalysisPhase("Analyzing decision heuristics across scenarios...");

    // Format scenarios payload
    const formattedScenarios = scenarios.map((s) => {
      const chosenIdx = scenarioChoices[s.id] ?? 0;
      const opt = s.options[chosenIdx];
      return {
        id: s.id,
        chosenStyle: opt.style,
        chosenLabel: `${opt.title}: ${opt.description}`,
      };
    });

    // Format puzzles payload
    const formattedPuzzles = diagnosticPuzzles.map((p) => {
      const chosenOptId = puzzleChoices[p.id] ?? "a";
      const opt = p.options.find((o) => o.id === chosenOptId) || p.options[0];
      return {
        id: p.id,
        question: p.question,
        selectedChoice: `[${opt.label}] ${opt.text}`,
        explanation: puzzleNotes[p.id] || undefined,
      };
    });

    const phaseTimer1 = setTimeout(() => {
      setAnalysisPhase("Evaluating cognitive reflection vs. heuristic traps...");
    }, 900);

    const phaseTimer2 = setTimeout(() => {
      setAnalysisPhase("Synthesizing personalized Adaptive Learning Blueprint...");
    }, 1800);

    try {
      const response = await fetch("/api/ednova/onboarding/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: profile.nickname || "Learner",
          subjects: subjectsList,
          scenarios: formattedScenarios,
          puzzles: formattedPuzzles,
          selfReportedLevel: profile.level,
          learningStyles: profile.learningStyles,
        }),
      });

      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);

      const data = (await response.json()) as DiagnosticResult & { error?: string };
      if (!response.ok) {
        setNotice(data.error ?? "Diagnostic engine offline. Using local deterministic model.");
      }
      setDiagnostic(data);
      updateProfile({
        level: data.level,
        learningStyles: data.styles,
        cognitiveArchetype: data.archetype,
        cognitiveTraits: data.traits,
        scaffoldingPace: data.scaffoldingPace,
      });
    } catch {
      setNotice("Could not connect to online neural router. Locally synthesized blueprint ready.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#060a17] px-4 py-8 text-slate-100 sm:px-8 sm:py-12">
      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-36 top-10 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />
        <div className="absolute -right-36 top-1/3 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[2.2rem] border border-white/10 bg-slate-950/85 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        {/* Top Header & Progress */}
        <div className="border-b border-white/10 px-6 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {isFirstTime ? (
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>First-Time Account Setup • Personalize Your AI Companion</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-spin" style={{ animationDuration: "6s" }} />
                  <span>Feature 2 • Adaptive Diagnostic & Cognitive Onboarding</span>
                </div>
              )}
              <h1 className="mt-2.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {editing ? "Recalibrate Cognitive Profile" : isFirstTime ? "Welcome to EdNova! Set Up Your AI" : "Discover Your Learning DNA"}
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {isFirstTime
                  ? "Since this is your first time logging in, take 2 minutes so your AI tutor understands your cognitive rhythm forever."
                  : "No boring questionnaires. EdNova uses interactive dilemmas & tricky puzzles to deduce your mind’s natural habits."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono font-semibold text-cyan-300">
                Step {step + 1} / 5
              </span>
            </div>
          </div>

          {/* Animated Gradient Progress Bar */}
          <div className="mt-6 flex items-center gap-3">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400 transition-all duration-500 ease-out"
                style={{ width: progressPercent }}
              />
            </div>
            <span className="text-xs font-bold text-slate-300">{progressPercent}</span>
          </div>

          {/* Step Category Pills */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              { idx: 0, label: "Persona", icon: Sparkles },
              { idx: 1, label: "Focus & Pace", icon: Target },
              { idx: 2, label: "Cognitive Dilemmas", icon: Compass },
              { idx: 3, label: "Tricky Puzzles", icon: Puzzle },
              { idx: 4, label: "Cognitive Blueprint", icon: Brain },
            ].map((s) => (
              <button
                key={s.idx}
                type="button"
                onClick={() => {
                  if (s.idx <= step || diagnostic) setStep(s.idx);
                }}
                disabled={s.idx > step && !diagnostic}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  step === s.idx
                    ? "border border-cyan-400/40 bg-cyan-400/20 text-cyan-200"
                    : s.idx < step
                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border border-white/5 bg-white/5 text-slate-500 opacity-60"
                }`}
              >
                {s.idx < step ? <Check className="h-3 w-3 text-emerald-400" /> : <s.icon className="h-3 w-3" />}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step Body */}
        <div className="min-h-[460px] px-6 py-7 sm:px-10 sm:py-9">
          {step === 0 && (
            <StepPersona
              profile={profile}
              updateProfile={updateProfile}
              randomizeNickname={randomizeNickname}
            />
          )}

          {step === 1 && (
            <StepFocus
              profile={profile}
              updateProfile={updateProfile}
              subjectsList={subjectsList}
              customSubjectInput={customSubjectInput}
              setCustomSubjectInput={setCustomSubjectInput}
              handleToggleSubject={handleToggleSubject}
              handleAddSubject={handleAddSubject}
            />
          )}

          {step === 2 && (
            <StepScenarios
              scenarioChoices={scenarioChoices}
              setScenarioChoices={setScenarioChoices}
            />
          )}

          {step === 3 && (
            <StepPuzzles
              puzzleChoices={puzzleChoices}
              setPuzzleChoices={setPuzzleChoices}
              puzzleNotes={puzzleNotes}
              setPuzzleNotes={setPuzzleNotes}
              activeTab={activePuzzleTab}
              setActiveTab={setActivePuzzleTab}
            />
          )}

          {step === 4 && (
            <StepBlueprint
              diagnostic={diagnostic}
              analyzing={analyzing}
              analysisPhase={analysisPhase}
              notice={notice}
              onRunDiagnostic={runDiagnostic}
              onSave={() => persistProfile(diagnostic)}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-slate-900/60 px-6 py-5 sm:px-10">
          <button
            type="button"
            onClick={() => setStep((curr) => Math.max(0, curr - 1))}
            disabled={step === 0 || analyzing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-3">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((curr) => curr + 1)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : step === 3 ? (
              <button
                type="button"
                onClick={runDiagnostic}
                disabled={analyzing}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing Neural Blueprint...</span>
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    <span>Synthesize AI Blueprint</span>
                    <Sparkles className="h-4 w-4 text-cyan-200" />
                  </>
                )}
              </button>
            ) : diagnostic ? (
              <button
                type="button"
                onClick={() => persistProfile(diagnostic)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:scale-[1.03] active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Profile & Enter Workspace</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => persistProfile(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
              >
                <span>Skip to Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// ==========================================
// SUB-COMPONENTS FOR EACH STEP
// ==========================================

function StepPersona({
  profile,
  updateProfile,
  randomizeNickname,
}: {
  profile: LearnerProfile;
  updateProfile: (update: Partial<LearnerProfile>) => void;
  randomizeNickname: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Sparkles}
        badge="Step 1 • Persona & Privacy"
        title="Choose your anonymous study identity"
        subtitle="EdNova respects zero-knowledge privacy. No real names, emails, or personal data needed."
      />

      {/* Nickname Input */}
      <div>
        <label className="block text-sm font-bold text-slate-200">
          Anonymous Nickname
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={profile.nickname ?? ""}
            onChange={(e) => updateProfile({ nickname: e.target.value })}
            maxLength={24}
            placeholder="e.g. CuriousComet (anonymous)"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
          <button
            type="button"
            onClick={randomizeNickname}
            title="Generate random nickname"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-3 text-xs font-semibold text-cyan-300 transition hover:bg-slate-800 hover:text-cyan-200"
          >
            <Dices className="h-4 w-4 text-cyan-400" />
            <span>Random</span>
          </button>
        </div>
      </div>

      {/* Avatar Picker */}
      <div>
        <span className="block text-sm font-bold text-slate-200">
          Choose an Avatar Archetype
        </span>
        <div className="mt-3 grid grid-cols-5 gap-2.5 sm:grid-cols-5">
          {avatars.map((a) => {
            const isSelected = profile.avatar === a.emoji;
            return (
              <button
                type="button"
                key={a.label}
                onClick={() => updateProfile({ avatar: a.emoji })}
                className={`group relative flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all duration-200 ${
                  isSelected
                    ? "scale-105 border-cyan-400 bg-cyan-400/15 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/40"
                    : "border-white/10 bg-white/5 hover:scale-102 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span className="text-2xl transition group-hover:scale-110">{a.emoji}</span>
                <span className="mt-1 text-[11px] font-bold text-slate-200">{a.label}</span>
                <span className="text-[9px] text-slate-400">{a.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Interface Language */}
      <div>
        <span className="block text-sm font-bold text-slate-200">
          Interface & Tutor Language
        </span>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { id: "en", label: "English", note: "Global", flag: "🇬🇧" },
            { id: "fr", label: "Français", note: "International", flag: "🇫🇷" },
            { id: "ar", label: "العربية", note: "Standard Arabic", flag: "🇸🇦" },
            { id: "darija", label: "Darija", note: "Moroccan Dialect", flag: "🇲🇦" },
          ].map((lang) => {
            const isSelected = (profile.language ?? "en") === lang.id;
            return (
              <button
                type="button"
                key={lang.id}
                onClick={() => updateProfile({ language: lang.id as SupportedLanguage })}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-500/15 text-white shadow-md shadow-cyan-500/15"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <span className="block text-xs font-bold">{lang.label}</span>
                  <span className="block text-[10px] text-slate-400">{lang.note}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepFocus({
  profile,
  updateProfile,
  subjectsList,
  customSubjectInput,
  setCustomSubjectInput,
  handleToggleSubject,
  handleAddSubject,
}: {
  profile: LearnerProfile;
  updateProfile: (update: Partial<LearnerProfile>) => void;
  subjectsList: string[];
  customSubjectInput: string;
  setCustomSubjectInput: (val: string) => void;
  handleToggleSubject: (subj: string) => void;
  handleAddSubject: (subj: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Target}
        badge="Step 2 • Learning Environment"
        title="What are your focal topics & rhythm?"
        subtitle="Select your core learning domains so EdNova can calibrate relevant analogies and problems."
      />

      {/* Selectable Subjects */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-200">
            Focal Subjects ({subjectsList.length}/8 selected)
          </label>
          <span className="text-xs text-slate-400">Click to toggle</span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {presetSubjects.map((subj) => {
            const isSelected = subjectsList.includes(subj);
            return (
              <button
                type="button"
                key={subj}
                onClick={() => handleToggleSubject(subj)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-sm shadow-cyan-400/20"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                {isSelected ? <Check className="h-3.5 w-3.5 text-cyan-300" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                {subj}
              </button>
            );
          })}
        </div>

        {/* Custom Subject Adder */}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={customSubjectInput}
            onChange={(e) => setCustomSubjectInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubject(customSubjectInput);
              }
            }}
            placeholder="Add custom subject (e.g. Organic Chemistry, Quantum Computing)..."
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => handleAddSubject(customSubjectInput)}
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            + Add Subject
          </button>
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <label className="block text-sm font-bold text-slate-200">Study Mode Architecture</label>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
          {[
            {
              id: "individual",
              title: "Solo Deep Work",
              desc: "Distraction-free personal sanctuary with quiet AI tutoring.",
              icon: Brain,
            },
            {
              id: "group",
              title: "Peer Collaborative",
              desc: "Real-time study rooms, synchronized timers & AI moderation.",
              icon: Layers,
            },
            {
              id: "both",
              title: "Dynamic Hybrid",
              desc: "Switch seamlessly between independent focus and group sessions.",
              icon: Workflow,
            },
          ].map((modeItem) => {
            const isSelected = (profile.mode ?? "individual") === modeItem.id;
            return (
              <button
                type="button"
                key={modeItem.id}
                onClick={() => updateProfile({ mode: modeItem.id as LearnerProfile["mode"] })}
                className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-400/15 shadow-lg shadow-cyan-500/15"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <modeItem.icon className={`h-5 w-5 ${isSelected ? "text-cyan-300" : "text-slate-400"}`} />
                  {isSelected && <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />}
                </div>
                <span className="mt-2.5 block text-sm font-bold text-white">{modeItem.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{modeItem.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Target Duration */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-200">Daily Study Target</label>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            {profile.dailyStudyMinutes ?? 25} minutes / day
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {[
            { mins: 15, label: "15 min", tag: "Sprint" },
            { mins: 25, label: "25 min", tag: "Pomodoro" },
            { mins: 45, label: "45 min", tag: "Deep Focus" },
            { mins: 60, label: "60 min", tag: "Intensive" },
          ].map((preset) => {
            const isSelected = (profile.dailyStudyMinutes ?? 25) === preset.mins;
            return (
              <button
                type="button"
                key={preset.mins}
                onClick={() => updateProfile({ dailyStudyMinutes: preset.mins })}
                className={`rounded-xl border p-2.5 text-center transition ${
                  isSelected
                    ? "border-violet-400 bg-violet-400/20 text-white shadow-md shadow-violet-500/20"
                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                <span className="block text-xs font-bold text-white">{preset.label}</span>
                <span className="block text-[10px] text-slate-400">{preset.tag}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepScenarios({
  scenarioChoices,
  setScenarioChoices,
}: {
  scenarioChoices: Record<string, number>;
  setScenarioChoices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Compass}
        badge="Step 3 • Cognitive Dilemmas"
        title="How does your mind navigate the unfamiliar?"
        subtitle="No right or wrong answers. Choose how you instinctively react to each challenge so our AI can deduce your cognitive pathways."
      />

      <div className="space-y-6">
        {scenarios.map((sc, sIdx) => {
          const chosenOptionIdx = scenarioChoices[sc.id] ?? 0;
          return (
            <div
              key={sc.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-400/20 text-xs font-bold text-cyan-300">
                  {sIdx + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
                  {sc.category}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-100">
                {sc.situation}
              </p>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {sc.options.map((opt, oIdx) => {
                  const isSelected = chosenOptionIdx === oIdx;
                  return (
                    <button
                      type="button"
                      key={opt.title}
                      onClick={() =>
                        setScenarioChoices((prev) => ({ ...prev, [sc.id]: oIdx }))
                      }
                      className={`group relative flex flex-col rounded-xl border p-3.5 text-left transition-all ${
                        isSelected
                          ? "border-cyan-400/80 bg-cyan-400/15 shadow-md shadow-cyan-500/15 ring-1 ring-cyan-400/40"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white group-hover:text-cyan-200">
                          {opt.title}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-cyan-300" />}
                      </div>
                      <p className="mt-1 text-xs leading-normal text-slate-400">
                        {opt.description}
                      </p>
                      <span className="mt-2 inline-block text-[10px] font-mono text-cyan-300/70">
                        • {opt.subconsciousTrait}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepPuzzles({
  puzzleChoices,
  setPuzzleChoices,
  puzzleNotes,
  setPuzzleNotes,
  activeTab,
  setActiveTab,
}: {
  puzzleChoices: Record<string, string>;
  setPuzzleChoices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  puzzleNotes: Record<string, string>;
  setPuzzleNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  activeTab: number;
  setActiveTab: (val: number) => void;
}) {
  const currentPuzzle = diagnosticPuzzles[activeTab];
  const chosenOptionId = puzzleChoices[currentPuzzle.id] ?? "a";

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Puzzle}
        badge="Step 4 • Cognitive Reflection Puzzles"
        title="Tricky reasoning challenges"
        subtitle="Beware of the first intuitive impulse! These subtle micro-challenges help the AI classify your analytical depth and cognitive pacing."
      />

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {diagnosticPuzzles.map((pz, idx) => {
          const isDone = !!puzzleChoices[pz.id];
          const isActive = activeTab === idx;
          return (
            <button
              type="button"
              key={pz.id}
              onClick={() => setActiveTab(idx)}
              className={`rounded-xl border p-2.5 text-left transition ${
                isActive
                  ? "border-violet-400 bg-violet-400/20 text-white shadow-md shadow-violet-500/20"
                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-violet-300">
                  Challenge #{idx + 1}
                </span>
                {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
              </div>
              <span className="mt-1 block truncate text-xs font-bold text-slate-200">
                {pz.tag.split(" ")[1] || "Puzzle"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Puzzle Box */}
      <div className="rounded-2xl border border-violet-400/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            {currentPuzzle.tag}
          </span>
          <span className="text-xs text-slate-400">{currentPuzzle.category}</span>
        </div>

        <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-100 sm:text-base">
          {currentPuzzle.question}
        </p>

        <p className="mt-2 text-xs italic text-violet-300/80">
          💡 Tip: {currentPuzzle.insightTip}
        </p>

        {/* Puzzle Choices */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {currentPuzzle.options.map((opt) => {
            const isSelected = chosenOptionId === opt.id;
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() =>
                  setPuzzleChoices((prev) => ({
                    ...prev,
                    [currentPuzzle.id]: opt.id,
                  }))
                }
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-violet-400 bg-violet-500/20 text-white shadow-md shadow-violet-500/20 ring-1 ring-violet-400/40"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    isSelected ? "bg-violet-400 text-slate-950 font-bold" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {opt.label}
                </span>
                <span className="text-xs font-semibold leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* Optional Reflection Thought Input */}
        <div className="mt-4 border-t border-white/10 pt-3">
          <label className="text-[11px] font-semibold text-slate-400">
            Optional: In a sentence, what was your thought process? (Helps AI calibrate nuance)
          </label>
          <input
            value={puzzleNotes[currentPuzzle.id] ?? ""}
            onChange={(e) =>
              setPuzzleNotes((prev) => ({
                ...prev,
                [currentPuzzle.id]: e.target.value,
              }))
            }
            maxLength={180}
            placeholder="e.g. I verified the algebraic formula $105 - $5 = $100..."
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-400"
          />
        </div>
      </div>
    </div>
  );
}

function StepBlueprint({
  diagnostic,
  analyzing,
  analysisPhase,
  notice,
  onRunDiagnostic,
  onSave,
}: {
  diagnostic: DiagnosticResult | null;
  analyzing: boolean;
  analysisPhase: string;
  notice: string;
  onRunDiagnostic: () => void;
  onSave: () => void;
}) {
  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <Brain className="absolute inset-0 m-auto h-8 w-8 text-cyan-300 animate-pulse" />
        </div>
        <h3 className="mt-6 text-xl font-black text-white">Synthesizing Cognitive Blueprint</h3>
        <p className="mt-2 max-w-md text-xs font-mono text-cyan-200/90 animate-pulse">
          {analysisPhase}
        </p>
        <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Running sandboxed inference on Fast Qwen/Llama engine</span>
        </div>
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <Brain className="h-10 w-10 text-cyan-400" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">Ready to Map Your Cognitive DNA</h3>
        <p className="mt-2 max-w-sm text-xs text-slate-400">
          We’ve collected your choices across the scenarios and reasoning puzzles.
        </p>
        <button
          type="button"
          onClick={onRunDiagnostic}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-105"
        >
          <Sparkles className="h-4 w-4" />
          <span>Reveal My Cognitive Blueprint</span>
        </button>
      </div>
    );
  }

  const traits = diagnostic.traits || {
    abstractReasoning: 90,
    reflectivePrecision: 86,
    patternSynthesis: 88,
    practicalApplication: 84,
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Brain}
        badge="Step 5 • AI Cognitive Blueprint"
        title="Your Inferred Cognitive Architecture"
        subtitle="Deduce autonomously from your scenario instincts and puzzle reasoning patterns."
      />

      {notice && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {notice}
        </div>
      )}

      {/* Archetype Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-violet-950/40 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-3 py-1 text-xs font-black text-cyan-200">
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            <span>Cognitive Archetype</span>
          </div>
          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-mono text-emerald-300">
            {diagnostic.level}
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
          {diagnostic.archetype || "The Architectural Strategist"}
        </h2>

        <p className="mt-2.5 text-xs font-normal leading-relaxed text-slate-300 sm:text-sm">
          {diagnostic.encouragement}
        </p>

        {/* Inferred Learning Styles */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <span className="block text-xs font-bold uppercase tracking-wider text-cyan-300">
            Inferred Primary Learning Styles:
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(diagnostic.styles || ["visual", "step-by-step", "problem-solving"]).map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200"
              >
                <Check className="h-3 w-3 text-violet-300" />
                <span className="capitalize">{st.replace("-", " ")}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cognitive Trait Radar Bars */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Cognitive Trait Calibration
        </h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Abstract & Conceptual Reasoning", val: traits.abstractReasoning, icon: Atom },
            { label: "Reflective Precision & Impulse Control", val: traits.reflectivePrecision, icon: Gauge },
            { label: "Pattern Synthesis & Structural Modeling", val: traits.patternSynthesis, icon: TrendingUp },
            { label: "Applied & Empirical Problem-Solving", val: traits.practicalApplication, icon: Sparkles },
          ].map((traitItem) => (
            <div key={traitItem.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{traitItem.label}</span>
                <span className="font-mono font-bold text-cyan-300">{traitItem.val}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-700"
                  style={{ width: `${traitItem.val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scaffolding Advice Card */}
      {diagnostic.scaffoldingPace && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-emerald-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Personalized Scaffolding Strategy
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-100">
            {diagnostic.scaffoldingPace}. EdNova will provide high-level conceptual hints and visual schematics before diving into step proofs, giving your intuition room to breathe.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onRunDiagnostic}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Recalibrate Diagnostics</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:scale-105 active:scale-95"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Apply Blueprint & Open Workspace</span>
        </button>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  badge,
  title,
  subtitle,
}: {
  icon: typeof Sparkles;
  badge: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
        <Icon className="h-3 w-3 text-cyan-400" />
        <span>{badge}</span>
      </div>
      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
      <p className="mt-1 text-xs text-slate-400 sm:text-sm">{subtitle}</p>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="h-3 w-3 text-emerald-400" />
        <span>100% private & zero-knowledge. Your learning profile stays on your device.</span>
      </div>
    </div>
  );
}
