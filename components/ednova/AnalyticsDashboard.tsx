"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Brain,
  Clock,
  Flame,
  Lightbulb,
  Medal,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

import { loadLearnerProfile, saveLearnerProfile } from "@/lib/ednova/profile-storage";
import {
  loadLearningProgress,
  loadQuizResults,
  loadStudySessions,
  purgeDemoData,
  saveLearningProgress,
} from "@/lib/ednova/progress-storage";
import {
  dailyStudyMinutes,
  streakHistory,
  subjectBreakdown,
  summaryStats,
  weeklyActivity,
} from "@/lib/ednova/analytics";
import type { LearnerProfile, LearningProgress, StudySession } from "@/lib/ednova/types";
import type { QuizResult } from "@/lib/ednova/progress-storage";
import type { SafeUser } from "@/lib/ednova/auth";
import UserMenu from "@/components/ednova/UserMenu";

// Chart.js is dynamically imported to keep the client bundle smaller for SSR.
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip);

const chartTextColor = "rgba(203,213,225,0.8)";
const gridColor = "rgba(255,255,255,0.06)";

export default function AnalyticsDashboard() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [progress, setProgress] = useState<LearningProgress>({ xp: 0, level: 1, streak: 0, badges: [], subjectAccuracy: {} });
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    // 1. Purge any stale synthetic demo items from local storage
    purgeDemoData();

    try {
      const res = await fetch("/api/ednova/analytics");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setDatabaseConnected(Boolean(data.databaseConnected));

          // If database is connected and has saved data
          if (data.databaseConnected) {
            const serverSessions: StudySession[] = data.sessions || [];
            const serverQuizzes: QuizResult[] = data.quizzes || [];
            const serverProgress: LearningProgress = data.progress || { xp: 0, level: 1, streak: 0, badges: [], subjectAccuracy: {} };
            const serverProfile: LearnerProfile | null = data.profile;

            const localSessions = loadStudySessions();
            const localQuizzes = loadQuizResults();
            const localProgress = loadLearningProgress();

            // If server has data, prioritize server data and update local cache
            if (serverSessions.length > 0 || serverQuizzes.length > 0 || serverProgress.xp > 0) {
              setSessions(serverSessions);
              setQuizResults(serverQuizzes);
              setProgress(serverProgress);
              if (serverProfile) setProfile(serverProfile);
              saveLearningProgress(serverProgress);
              if (serverProfile) saveLearnerProfile(serverProfile);
            } else if (localSessions.length > 0 || localQuizzes.length > 0 || localProgress.xp > 0) {
              // Server has 0 records but student has local un-synced activity: sync to server!
              setSessions(localSessions);
              setQuizResults(localQuizzes);
              setProgress(localProgress);
              setProfile(loadLearnerProfile());

              fetch("/api/ednova/auth/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  progress: localProgress,
                  sessions: localSessions,
                  profile: loadLearnerProfile(),
                }),
              }).catch(() => {});
            } else {
              // Fresh user with 0 activity
              setSessions([]);
              setQuizResults([]);
              setProgress(serverProgress);
              setProfile(serverProfile);
            }
            return;
          }
        }
      }
    } catch {
      // Server unreachable, fallback to client local storage
    }

    // Fallback: local storage for offline / unauthenticated state
    setSessions(loadStudySessions());
    setProgress(loadLearningProgress());
    setProfile(loadLearnerProfile());
    setQuizResults(loadQuizResults());
  }, []);

  useEffect(() => {
    let mounted = true;
    loadData().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [loadData]);

  async function handleRefresh() {
    await loadData(true);
    setRefreshing(false);
  }

  const stats = useMemo(() => summaryStats(sessions, progress, profile), [sessions, progress, profile]);
  const daily = useMemo(() => dailyStudyMinutes(sessions), [sessions]);
  const subjects = useMemo(() => subjectBreakdown(sessions), [sessions]);
  const streaks = useMemo(() => streakHistory(sessions), [sessions]);
  const weekly = useMemo(() => weeklyActivity(sessions), [sessions]);

  // -- Chart data objects --

  const dailyChartData = {
    labels: daily.slice(-14).map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Study minutes",
        data: daily.slice(-14).map((d) => d.minutes),
        backgroundColor: "rgba(6,182,212,0.35)",
        borderColor: "rgba(6,182,212,0.8)",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const streakChartData = {
    labels: streaks.slice(-21).map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Active day",
        data: streaks.slice(-21).map((d) => (d.hadSession ? 1 : 0)),
        fill: true,
        backgroundColor: "rgba(34,197,94,0.15)",
        borderColor: "rgba(34,197,94,0.7)",
        pointBackgroundColor: streaks.slice(-21).map((d) => (d.hadSession ? "#22c55e" : "#1e293b")),
        pointRadius: 4,
        tension: 0.3,
      },
    ],
  };

  const subjectChartData = {
    labels: subjects.slice(0, 6).map((s) => s.subject),
    datasets: [
      {
        data: subjects.slice(0, 6).map((s) => s.minutes),
        backgroundColor: ["#06b6d4", "#8b5cf6", "#f59e0b", "#22c55e", "#ec4899", "#64748b"],
        borderWidth: 0,
      },
    ],
  };

  const accuracyEntries = Object.entries(progress.subjectAccuracy);
  const accuracyChartData = {
    labels: accuracyEntries.map(([s]) => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [
      {
        label: "Accuracy %",
        data: accuracyEntries.map(([, v]) => (v.total ? Math.round((v.correct / v.total) * 100) : 0)),
        backgroundColor: "rgba(139,92,246,0.35)",
        borderColor: "rgba(139,92,246,0.8)",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const weeklyChartData = {
    labels: weekly.slice(-8).map((w) => w.week),
    datasets: [
      {
        label: "XP earned",
        data: weekly.slice(-8).map((w) => w.xpEarned),
        backgroundColor: "rgba(245,158,11,0.35)",
        borderColor: "rgba(245,158,11,0.8)",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1 },
    },
    scales: {
      x: { ticks: { color: chartTextColor, maxRotation: 45 }, grid: { color: gridColor } },
      y: { ticks: { color: chartTextColor }, grid: { color: gridColor } },
    },
  };

  const hasActivity = stats.totalSessions > 0 || quizResults.length > 0 || stats.totalXp > 0;

  return (
    <main className="min-h-screen bg-[#070b1b] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Student Learning Analytics</span>
              {databaseConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Cloud Sync
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {user ? `Your learning journey, ${user.name}.` : "Your learning journey, visualised."}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Real-time personal study time, topic mastery, and focus streak analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50 cursor-pointer"
              title="Refresh your live analytics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-300" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/ednova"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
            >
              Back to tutor
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* New user friendly welcome card if no activity yet */}
        {!loading && !hasActivity && (
          <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 p-5 sm:p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Welcome to your personal analytics!</h2>
                  <p className="mt-1 text-xs text-slate-300 max-w-xl leading-relaxed">
                    Start a focus session with the built-in study timer or take a collaborative quiz to begin recording your personalized study minutes, subject breakdown, and mastery stats.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/ednova"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 shadow-lg shadow-cyan-500/20"
                >
                  <Timer className="h-3.5 w-3.5" /> Start Focus Session
                </Link>
                <Link
                  href="/ednova/quiz"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Take Quiz
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Zap className="h-5 w-5 text-amber-300" />} label="Total XP" value={String(stats.totalXp)} />
          <StatCard icon={<Flame className="h-5 w-5 text-orange-400" />} label="Current streak" value={`${stats.currentStreak} days`} />
          <StatCard icon={<Clock className="h-5 w-5 text-cyan-300" />} label="Total study time" value={`${stats.totalMinutes} min`} />
          <StatCard icon={<Trophy className="h-5 w-5 text-violet-300" />} label="Level" value={String(stats.level)} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Target className="h-5 w-5 text-emerald-300" />} label="Sessions completed" value={String(stats.totalSessions)} />
          <StatCard icon={<BarChart3 className="h-5 w-5 text-blue-300" />} label="Avg. session" value={`${stats.averageSessionMinutes} min`} />
          <StatCard icon={<Lightbulb className="h-5 w-5 text-yellow-300" />} label="Hints used" value={String(stats.hintsUsed)} />
          <StatCard icon={<Brain className="h-5 w-5 text-rose-300" />} label="Confusion events" value={String(stats.confusionEvents)} />
        </div>

        {/* Charts grid */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <ChartCard title="Daily study minutes (last 14 days)">
            {daily.length ? (
              <div className="h-56"><Bar data={dailyChartData} options={chartOpts} /></div>
            ) : (
              <EmptyChart message="No study sessions recorded in the last 14 days. Complete a focus session to log study minutes." />
            )}
          </ChartCard>

          <ChartCard title="Streak calendar (last 21 days)">
            {streaks.length && streaks.some((s) => s.hadSession) ? (
              <div className="h-56"><Line data={streakChartData} options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: 1.2, ticks: { display: false } } } }} /></div>
            ) : (
              <EmptyChart message="Complete a study session today to start your learning streak!" />
            )}
          </ChartCard>

          <ChartCard title="Time per subject">
            {subjects.length ? (
              <div className="mx-auto h-56 max-w-[240px]">
                <Doughnut data={subjectChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const, labels: { color: chartTextColor, padding: 12, boxWidth: 12 } } } }} />
              </div>
            ) : (
              <EmptyChart message="Complete study sessions with subject labels to see your subject breakdown." />
            )}
          </ChartCard>

          <ChartCard title="Accuracy per topic">
            {accuracyEntries.length ? (
              <div className="h-56"><Bar data={accuracyChartData} options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: 100 } } }} /></div>
            ) : (
              <EmptyChart message="Take quizzes to see your accuracy per topic." />
            )}
          </ChartCard>

          <ChartCard title="Weekly XP earned">
            {weekly.length ? (
              <div className="h-56"><Bar data={weeklyChartData} options={chartOpts} /></div>
            ) : (
              <EmptyChart message="Earn XP by completing study sessions and quizzes." />
            )}
          </ChartCard>

          <ChartCard title="Quiz results">
            {quizResults.length ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {quizResults.slice(0, 10).map((q) => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-200">{q.topic}</p>
                      <p className="text-xs text-slate-500">{q.completedAt.slice(0, 10)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${q.correct / q.total >= 0.7 ? "text-emerald-300" : q.correct / q.total >= 0.5 ? "text-amber-300" : "text-rose-300"}`}>
                        {q.correct}/{q.total}
                      </p>
                      <p className="text-xs text-slate-500">{Math.round((q.correct / q.total) * 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart message="Complete collaborative quizzes to see your results." />
            )}
          </ChartCard>
        </div>

        {/* Badges */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-black"><Medal className="h-5 w-5 text-amber-300" /> Badges earned</h2>
          {progress.badges.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {progress.badges.map((badge) => (
                <span key={badge} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                  <TrendingUp className="h-3.5 w-3.5" /> {badge}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Complete focus sessions and quizzes to earn badges.</p>
          )}
        </section>

        {/* Progress bars per subject */}
        {accuracyEntries.length > 0 && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7">
            <h2 className="text-lg font-black">Subject mastery</h2>
            <div className="mt-4 space-y-4">
              {accuracyEntries.map(([subject, val]) => {
                const pct = val.total ? Math.round((val.correct / val.total) * 100) : 0;
                return (
                  <div key={subject}>
                    <div className="flex justify-between text-sm">
                      <span className="capitalize text-slate-200">{subject}</span>
                      <span className="font-bold text-cyan-200">{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{val.correct} correct out of {val.total}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-xl">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
      <h3 className="mb-4 text-sm font-bold text-slate-200">{title}</h3>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{message}</p>;
}
