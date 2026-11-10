"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Check,
  Coffee,
  Flame,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  TimerReset,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import {
  ActiveAlarmController,
  ALARM_PRESETS,
  AlarmSound,
  playAlarmPattern,
  unlockAudioContext,
} from "@/lib/ednova/alarm-audio";
import { completeStudySession } from "@/lib/ednova/progress-storage";
import { loadLearnerProfile, recordLearningSignal } from "@/lib/ednova/profile-storage";
import type { StudySession } from "@/lib/ednova/types";

type Phase = StudySession["kind"];

const defaultMinutes: Record<Phase, number> = {
  focus: 25,
  break: 5,
  "long-break": 15,
  custom: 20,
};

const TIMER_SETTINGS_KEY = "ednova-timer-settings-v2";

type TimerSettings = {
  minutes: Record<Phase, number>;
  sound: AlarmSound;
  volume: number;
  reminderEnabled: boolean;
  reminderTime: string;
  selectedSubject: string;
};

export default function StudyTimer({ onClose }: { onClose?: () => void }) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [remaining, setRemaining] = useState(defaultMinutes.focus * 60);
  const [deadline, setDeadline] = useState<number | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound, setSound] = useState<AlarmSound>("digital");
  const [volume, setVolume] = useState(0.8);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [selectedSubject, setSelectedSubject] = useState("General");
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(["General", "Math", "Biology", "Physics"]);

  const [message, setMessage] = useState("");
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  const alarmControllerRef = useRef<ActiveAlarmController | null>(null);

  const isRunning = deadline !== null;
  const activeMinutes = minutes[phase];
  const totalSeconds = activeMinutes * 60;
  const progressRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, (totalSeconds - remaining) / totalSeconds)) : 0;
  const formatted = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  // Initialize Audio Loop Controller
  useEffect(() => {
    alarmControllerRef.current = new ActiveAlarmController();
    return () => {
      alarmControllerRef.current?.stop();
    };
  }, []);

  // Load saved settings & profile subjects
  useEffect(() => {
    try {
      // Check v2 or migrate v1
      const raw = window.localStorage.getItem(TIMER_SETTINGS_KEY) || window.localStorage.getItem("ednova-timer-settings-v1");
      if (raw) {
        const saved = JSON.parse(raw) as Partial<TimerSettings> & { sound?: string };
        if (saved.minutes) setMinutes({ ...defaultMinutes, ...saved.minutes });

        // Map legacy sounds
        const rawSound = (saved as { sound?: string }).sound;
        if (rawSound === "chime") setSound("marimba");
        else if (rawSound === "laser") setSound("radar");
        else if (rawSound && ["digital", "bell", "marimba", "zen", "radar"].includes(rawSound)) {
          setSound(rawSound as AlarmSound);
        }

        if (typeof saved.volume === "number") setVolume(saved.volume);
        if (typeof saved.reminderEnabled === "boolean") setReminderEnabled(saved.reminderEnabled);
        if (saved.reminderTime) setReminderTime(saved.reminderTime);
        if (saved.selectedSubject) setSelectedSubject(saved.selectedSubject);
      }
    } catch {
      // Use defaults
    }

    const profile = loadLearnerProfile();
    if (profile?.subjects?.length) {
      const merged = Array.from(new Set(["General", ...profile.subjects]));
      setAvailableSubjects(merged);
    }
  }, []);

  // Save settings on update
  useEffect(() => {
    try {
      const settings: TimerSettings = {
        minutes,
        sound,
        volume,
        reminderEnabled,
        reminderTime,
        selectedSubject,
      };
      window.localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Silent catch
    }
  }, [minutes, sound, volume, reminderEnabled, reminderTime, selectedSubject]);

  // Main countdown timer interval
  useEffect(() => {
    if (!deadline) return;
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
    }, 500);

    const complete = window.setTimeout(() => finishPhase(), Math.max(0, deadline - Date.now()));
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(complete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  // Live browser tab title update
  useEffect(() => {
    if (typeof document === "undefined") return;
    const defaultTitle = "EdNova · AI Socratic Learning Assistant";

    if (isAlarmRinging) {
      document.title = `⏰ TIME'S UP! (${phase === "focus" ? "Focus" : "Break"} Done) · EdNova`;
      return () => {
        document.title = defaultTitle;
      };
    }

    if (isRunning) {
      document.title = `(${formatted}) ${phase === "focus" ? "🎯 Focus" : "☕ Break"} · EdNova`;
      return () => {
        document.title = defaultTitle;
      };
    }

    document.title = defaultTitle;
  }, [isRunning, formatted, phase, isAlarmRinging]);

  // Broadcast timer state for top dashboard dock & quick widgets
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("ednova-timer-tick", {
        detail: {
          formatted,
          remaining,
          phase,
          isRunning,
          isAlarmRinging,
        },
      })
    );
  }, [formatted, remaining, phase, isRunning, isAlarmRinging]);

  // Daily reminder background ticker
  useEffect(() => {
    if (!reminderEnabled) return;
    const check = window.setInterval(() => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (current === reminderTime && !isRunning && !isAlarmRinging) {
        notify("EdNova Study Reminder", "Ready for a small, focused learning step? Start your study timer.");
      }
    }, 30_000);
    return () => window.clearInterval(check);
  }, [reminderEnabled, reminderTime, isRunning, isAlarmRinging]);

  function startPause() {
    void unlockAudioContext();
    if (isRunning) {
      setRemaining(Math.max(0, Math.ceil((deadline! - Date.now()) / 1000)));
      setDeadline(null);
      return;
    }
    void requestNotifications();
    setDeadline(Date.now() + remaining * 1000);
  }

  function reset(nextPhase = phase) {
    stopAlarm();
    setDeadline(null);
    setPhase(nextPhase);
    setRemaining(minutes[nextPhase] * 60);
  }

  function applyPreset(presetPhase: Phase, presetMinutes: number) {
    stopAlarm();
    void unlockAudioContext();
    setDeadline(null);
    setPhase(presetPhase);
    const updated = { ...minutes, [presetPhase]: presetMinutes };
    setMinutes(updated);
    setRemaining(presetMinutes * 60);
  }

  function finishPhase() {
    const completedPhase = phase;
    setDeadline(null);
    setRemaining(0);
    setIsAlarmRinging(true);

    // 🚨 TRIGGER REAL CONTINUOUS WEB AUDIO ALARM LOOP
    alarmControllerRef.current?.start(sound, volume, {
      repeatIntervalMs: sound === "zen" ? 4000 : sound === "bell" ? 3400 : 1600,
      autoStopSeconds: 45, // rings continuously for up to 45 seconds or until dismissed
      onStop: () => setIsAlarmRinging(false),
    });

    notify(
      "⏰ EdNova Timer Complete!",
      completedPhase === "focus" || completedPhase === "custom"
        ? `Focus session in ${selectedSubject} complete – time for a well-deserved break!`
        : "Break complete – ready to jump back into your next focus goal!"
    );

    if (completedPhase === "focus" || completedPhase === "custom") {
      const { progress } = completeStudySession({
        kind: completedPhase,
        plannedMinutes: minutes[completedPhase],
        subject: selectedSubject !== "General" ? selectedSubject : undefined,
      });
      recordLearningSignal("focus", minutes[completedPhase]);
      setMessage(`+${Math.max(10, Math.min(80, minutes[completedPhase] * 2))} XP earned! Level ${progress.level}, ${progress.streak}-day streak.`);
    } else {
      setMessage("Break complete! Ready for your next learning step.");
    }
  }

  function stopAlarm() {
    alarmControllerRef.current?.stop();
    setIsAlarmRinging(false);
  }

  function handleTakeBreak() {
    stopAlarm();
    reset("break");
    // Start break immediately
    setDeadline(Date.now() + minutes.break * 60 * 1000);
  }

  function handleExtendFocus() {
    stopAlarm();
    setPhase("focus");
    setRemaining(5 * 60);
    setDeadline(Date.now() + 5 * 60 * 1000);
  }

  function changeMinutes(nextMinutes: number) {
    const safe = Math.max(1, Math.min(180, nextMinutes || 1));
    const next = { ...minutes, [phase]: safe };
    setMinutes(next);
    if (!isRunning) setRemaining(safe * 60);
  }

  async function handleTestSound(targetSound: AlarmSound = sound) {
    if (isPreviewPlaying) return;
    setIsPreviewPlaying(true);
    await unlockAudioContext();
    await playAlarmPattern(targetSound, volume);
    setTimeout(() => setIsPreviewPlaying(false), 1400);
  }

  async function requestNotifications() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  function notify(title: string, body: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/clock.png" });
    }
  }

  // SVG Circular Gauge calculation
  const circleRadius = 52;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const phaseColors = {
    focus: "from-cyan-400 to-violet-500",
    break: "from-emerald-400 to-teal-500",
    "long-break": "from-violet-400 to-indigo-500",
    custom: "from-amber-400 to-orange-500",
  };

  const ringColors = {
    focus: "#22d3ee",
    break: "#34d399",
    "long-break": "#a78bfa",
    custom: "#fbbf24",
  };

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl transition-all">
        {/* Subtle ambient glow header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-cyan-200">
              <TimerReset className="h-4 w-4 text-cyan-400" /> Focus Timer
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsZenMode(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-cyan-300"
              title="Open Fullscreen Focus Mode"
              aria-label="Fullscreen focus mode"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className={`rounded-lg p-1.5 transition ${
                settingsOpen ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              title="Timer & Alarm Settings"
              aria-label="Timer settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                title="Close Window"
                aria-label="Close timer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Phase selector tabs */}
        <div className="mt-4 flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {(["focus", "break", "long-break", "custom"] as Phase[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => reset(item)}
              className={`flex-1 rounded-lg px-1 py-1.5 text-[10px] font-bold capitalize transition ${
                phase === item
                  ? `bg-gradient-to-r ${phaseColors[item]} text-slate-950 font-black shadow-sm`
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Quick Pomodoro Preset Chips */}
        <div className="mt-2.5 flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => applyPreset("focus", 25)}
            className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200 transition"
          >
            25m Focus
          </button>
          <button
            type="button"
            onClick={() => applyPreset("focus", 50)}
            className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:border-violet-400/30 hover:text-violet-200 transition"
          >
            50m Deep
          </button>
          <button
            type="button"
            onClick={() => applyPreset("break", 5)}
            className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:border-emerald-400/30 hover:text-emerald-200 transition"
          >
            5m Break
          </button>
          <button
            type="button"
            onClick={() => applyPreset("long-break", 15)}
            className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:border-indigo-400/30 hover:text-indigo-200 transition"
          >
            15m Rest
          </button>
        </div>

        {/* Subject tag selector */}
        {(phase === "focus" || phase === "custom") && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] text-slate-400">Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/90 px-2 py-0.5 text-xs font-medium text-slate-200 outline-none focus:border-cyan-300/50"
              aria-label="Study subject"
            >
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Circular Progress Gauge & Clock Display */}
        <div className="relative my-4 flex flex-col items-center justify-center">
          <div className="relative flex h-36 w-36 items-center justify-center">
            {/* SVG Progress Ring */}
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={circleRadius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="6"
                className="text-white/[0.06]"
              />
              <circle
                cx="60"
                cy="60"
                r={circleRadius}
                fill="transparent"
                stroke={ringColors[phase]}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
                style={{
                  filter: isRunning ? `drop-shadow(0 0 8px ${ringColors[phase]}88)` : undefined,
                }}
              />
            </svg>

            {/* Inner Clock Face */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="font-mono text-3xl font-black tracking-tight text-white tabular-nums drop-shadow-sm">
                {formatted}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isRunning ? (
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Flame className="h-3 w-3 text-cyan-400 animate-pulse" /> Active
                  </span>
                ) : (
                  <span>Ready</span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-1 text-center text-[11px] capitalize text-slate-400">
            {phase.replace("-", " ")} session · background synchronized
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startPause}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition shadow-lg ${
              isRunning
                ? "bg-amber-400/20 text-amber-200 border border-amber-400/30 hover:bg-amber-400/30"
                : "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:scale-[1.02] active:scale-[0.98]"
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-slate-950" /> Start Session
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="grid w-11 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/5 active:scale-95"
            title="Reset Timer"
            aria-label="Reset timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* XP and status message */}
        {message ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <p className="leading-snug">{message}</p>
          </div>
        ) : null}

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="mt-4 space-y-3.5 border-t border-white/10 pt-4 animate-in fade-in duration-200">
            {/* Custom Minutes Input */}
            <label className="block text-xs font-semibold text-slate-300">
              {phase.replace("-", " ")} duration (minutes)
              <input
                type="number"
                min="1"
                max="180"
                value={activeMinutes}
                onChange={(event) => changeMinutes(Number(event.target.value))}
                className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-mono text-white outline-none focus:border-cyan-300/50"
              />
            </label>

            {/* Sound Selector with Preview Button */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Alarm Sound</span>
                <button
                  type="button"
                  onClick={() => void handleTestSound()}
                  disabled={isPreviewPlaying}
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200 transition disabled:opacity-50"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {isPreviewPlaying ? "Playing..." : "Test Sound"}
                </button>
              </div>

              <div className="mt-1.5 space-y-1.5">
                {ALARM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSound(preset.id);
                      void handleTestSound(preset.id);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border p-2 text-left transition ${
                      sound === preset.id
                        ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                        : "border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{preset.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{preset.label}</p>
                        <p className="text-[10px] text-slate-400">{preset.description}</p>
                      </div>
                    </div>
                    {sound === preset.id && <Check className="h-4 w-4 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Control */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  {volume === 0 ? <VolumeX className="h-3.5 w-3.5 text-slate-400" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-400" />}
                  Alarm Volume
                </span>
                <span className="font-mono text-cyan-300">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="mt-1.5 w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Daily Reminder */}
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setReminderEnabled((enabled) => !enabled);
                  void requestNotifications();
                }}
                className={`grid h-7 w-7 place-items-center rounded-lg transition ${
                  reminderEnabled ? "bg-cyan-400/20 text-cyan-300" : "bg-white/5 text-slate-400"
                }`}
                title={reminderEnabled ? "Disable Reminder" : "Enable Daily Reminder"}
              >
                {reminderEnabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </button>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Daily Study Reminder</p>
                <p className="text-[10px] text-slate-400">Notification at designated time</p>
              </div>
              <input
                type="time"
                value={reminderTime}
                onChange={(event) => setReminderTime(event.target.value)}
                disabled={!reminderEnabled}
                className="ml-auto rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs font-mono text-white outline-none disabled:opacity-40"
              />
            </div>
          </div>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Coffee className="h-3.5 w-3.5 text-amber-400/70" /> High-fidelity Web Audio synthesized offline.
        </p>
      </section>

      {/* 🚨 ACTIVE ALARM RINGING POPUP / BANNER */}
      {isAlarmRinging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm rounded-3xl border border-cyan-400/30 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/20 text-center">
            {/* Animated ringing bell & waves */}
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/40">
              <span className="absolute h-full w-full rounded-full bg-cyan-400/30 animate-ping" />
              <BellRing className="h-10 w-10 text-white animate-bounce" />
            </div>

            <h3 className="mt-4 text-xl font-black text-white">
              {phase === "focus" || phase === "custom" ? "Focus Session Complete!" : "Break Finished!"}
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              {phase === "focus" || phase === "custom"
                ? `Awesome work in ${selectedSubject}! Time to rest your eyes.`
                : "Your break is done. Ready to dive into the next session?"}
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={stopAlarm}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 py-3 text-sm font-black text-slate-950 shadow-md hover:scale-[1.02] active:scale-[0.98] transition"
              >
                Stop Alarm
              </button>

              {phase === "focus" || phase === "custom" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleTakeBreak}
                    className="flex-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition"
                  >
                    Start 5m Break
                  </button>
                  <button
                    type="button"
                    onClick={handleExtendFocus}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition"
                  >
                    +5 Min Focus
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    stopAlarm();
                    reset("focus");
                    setDeadline(Date.now() + minutes.focus * 60 * 1000);
                  }}
                  className="w-full rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 transition"
                >
                  Start Next Focus Session
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🧘 FULLSCREEN ZEN FOCUS MODE MODAL */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/95 p-6 backdrop-blur-2xl text-white animate-in zoom-in-95 duration-200">
          {/* Top header */}
          <div className="flex w-full max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                Zen Focus Mode · {phase.replace("-", " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsZenMode(false)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Exit Fullscreen"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>

          {/* Centered Clock Face */}
          <div className="flex flex-col items-center text-center">
            {(phase === "focus" || phase === "custom") && (
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200 mb-4">
                {selectedSubject} Focus
              </span>
            )}

            <div className="font-mono text-8xl md:text-9xl font-black tracking-tight tabular-nums drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
              {formatted}
            </div>

            <p className="mt-4 max-w-md text-sm text-slate-400 italic">
              &ldquo;Deep focus builds real mastery. Work through the concept step-by-step.&rdquo;
            </p>

            {/* Quick Zen Controls */}
            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                onClick={startPause}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-3 text-base font-black text-slate-950 shadow-xl hover:scale-105 active:scale-95 transition"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-5 w-5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-slate-950" /> Start Focus
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => reset()}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 active:scale-95 transition"
                title="Reset"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Bottom indicator */}
          <div className="text-center text-xs text-slate-500">
            Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">Esc</kbd> or click the exit button to return to chat.
          </div>
        </div>
      )}
    </>
  );
}
