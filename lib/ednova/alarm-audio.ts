// ---------------------------------------------------------------------------
// EdNova Web Audio Alarm Engine
// High-fidelity, zero-dependency procedural audio synthesis
// ---------------------------------------------------------------------------

export type AlarmSound = "digital" | "bell" | "marimba" | "zen" | "radar";

export interface AlarmPresetInfo {
  id: AlarmSound;
  label: string;
  icon: string;
  description: string;
}

export const ALARM_PRESETS: AlarmPresetInfo[] = [
  {
    id: "digital",
    label: "Digital Alarm Clock",
    icon: "⏰",
    description: "Classic high-pitched rhythmic 4-pulse beep (2048 Hz)",
  },
  {
    id: "bell",
    label: "Campus School Bell",
    icon: "🔔",
    description: "Multi-harmonic acoustic metallic bell chime with long decay",
  },
  {
    id: "marimba",
    label: "Upbeat Marimba",
    icon: "🎵",
    description: "Warm 5-note melodic pentatonic arpeggio (C5 - C6)",
  },
  {
    id: "zen",
    label: "Zen Singing Bowl",
    icon: "🧘",
    description: "Deep 432 Hz mindfulness gong with binaural acoustic shimmering",
  },
  {
    id: "radar",
    label: "Electronic Radar",
    icon: "📡",
    description: "Sharp energetic dual-tone pulse that cuts through background noise",
  },
];

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new Context();
  }
  return sharedAudioContext;
}

export async function unlockAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Audio context unlock failed silently
    }
  }
}

/**
 * Play a single pattern iteration of the selected alarm sound.
 */
export async function playAlarmPattern(sound: AlarmSound, volume = 0.8): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  await unlockAudioContext();

  const masterVol = Math.max(0.01, Math.min(1.0, volume));
  const startTime = ctx.currentTime + 0.05;

  switch (sound) {
    case "digital":
      playDigitalAlarm(ctx, startTime, masterVol);
      break;
    case "bell":
      playCampusBell(ctx, startTime, masterVol);
      break;
    case "marimba":
      playMarimbaChime(ctx, startTime, masterVol);
      break;
    case "zen":
      playZenSingingBowl(ctx, startTime, masterVol);
      break;
    case "radar":
      playRadarChime(ctx, startTime, masterVol);
      break;
  }
}

// ---------------------------------------------------------------------------
// 1. Digital Alarm Clock (4 crisp beeps: beep-beep-beep-beep)
// ---------------------------------------------------------------------------
function playDigitalAlarm(ctx: AudioContext, startTime: number, masterVol: number) {
  const beepCount = 4;
  const beepDuration = 0.085;
  const gap = 0.07;
  const primaryFreq = 2048; // Classic digital clock frequency
  const harmonicFreq = 4096;

  for (let i = 0; i < beepCount; i++) {
    const t = startTime + i * (beepDuration + gap);

    // Primary pulse (square-ish / bright sine)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(primaryFreq, t);

    osc2.type = "square";
    osc2.frequency.setValueAtTime(harmonicFreq, t);

    // Gain envelope: fast attack, square hold, fast release
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(masterVol * 0.45, t + 0.008);
    gainNode.gain.setValueAtTime(masterVol * 0.45, t + beepDuration - 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + beepDuration);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.18, t); // Subdued square wave harmonic

    osc1.connect(gainNode);
    osc2.connect(subGain).connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + beepDuration + 0.01);
    osc2.stop(t + beepDuration + 0.01);
  }
}

// ---------------------------------------------------------------------------
// 2. Campus School Bell (Rich additive acoustic partials with long ring)
// ---------------------------------------------------------------------------
function playCampusBell(ctx: AudioContext, startTime: number, masterVol: number) {
  // Realistic physical bell partials (ratios relative to fundamental)
  // Strike tone ~ 587.3 Hz (D5)
  const strikeFreq = 587.33;
  const strikes = [0, 0.55, 1.15]; // 3 resonant tolls
  const partials = [
    { ratio: 0.5, gainRatio: 0.4, decay: 1.8 },   // Hum note
    { ratio: 1.0, gainRatio: 1.0, decay: 1.6 },   // Fundamental (Strike tone)
    { ratio: 1.2, gainRatio: 0.6, decay: 1.3 },   // Tierce (minor third)
    { ratio: 1.5, gainRatio: 0.45, decay: 1.1 },  // Quint (fifth)
    { ratio: 2.0, gainRatio: 0.55, decay: 0.9 },  // Nominal
    { ratio: 2.76, gainRatio: 0.3, decay: 0.7 },  // Upper partial
  ];

  strikes.forEach((strikeOffset) => {
    const t = startTime + strikeOffset;

    partials.forEach((partial) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(strikeFreq * partial.ratio, t);

      // Bell envelope: instant strike, exponential decay
      const peakGain = masterVol * 0.28 * partial.gainRatio;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peakGain, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + partial.decay);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + partial.decay + 0.05);
    });
  });
}

// ---------------------------------------------------------------------------
// 3. Upbeat Marimba Chime (Cascade of pentatonic wooden bars)
// ---------------------------------------------------------------------------
function playMarimbaChime(ctx: AudioContext, startTime: number, masterVol: number) {
  // Pentatonic scale: G4, C5, E5, G5, C6
  const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
  const step = 0.11;

  notes.forEach((freq, idx) => {
    const t = startTime + idx * step;
    const osc = ctx.createOscillator();
    const harmonicOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    // Marimba characteristic: 4x overtone on strike that dies quickly
    harmonicOsc.type = "triangle";
    harmonicOsc.frequency.setValueAtTime(freq * 3.98, t);

    const hitVol = masterVol * 0.42;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(hitVol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(hitVol * 0.2, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(hitVol * 0.35, t);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    osc.connect(gain);
    harmonicOsc.connect(harmGain).connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    harmonicOsc.start(t);
    osc.stop(t + 0.7);
    harmonicOsc.stop(t + 0.1);
  });
}

// ---------------------------------------------------------------------------
// 4. Zen Singing Bowl (Deep 432 Hz with warm acoustic shimmer)
// ---------------------------------------------------------------------------
function playZenSingingBowl(ctx: AudioContext, startTime: number, masterVol: number) {
  const baseFreq = 432; // Sacred A=432Hz harmonic
  const t = startTime;

  // Dual detuned oscillators for slow 3.5 Hz binaural acoustic shimmering
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(baseFreq, t);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(baseFreq + 3.2, t); // +3.2 Hz shimmer beat

  oscHarmonic.type = "sine";
  oscHarmonic.frequency.setValueAtTime(baseFreq * 2.75, t); // Minor shimmer overtone

  const peak = masterVol * 0.48;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.18); // Soft felt mallet attack
  gain.gain.exponentialRampToValueAtTime(peak * 0.4, t + 1.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.6); // Long meditative decay

  const harmGain = ctx.createGain();
  harmGain.gain.setValueAtTime(0.2, t);

  osc1.connect(gain);
  osc2.connect(gain);
  oscHarmonic.connect(harmGain).connect(gain);
  gain.connect(ctx.destination);

  osc1.start(t);
  osc2.start(t);
  oscHarmonic.start(t);

  const stopTime = t + 3.8;
  osc1.stop(stopTime);
  osc2.stop(stopTime);
  oscHarmonic.stop(stopTime);
}

// ---------------------------------------------------------------------------
// 5. Electronic Radar (Sharp energetic dual ping)
// ---------------------------------------------------------------------------
function playRadarChime(ctx: AudioContext, startTime: number, masterVol: number) {
  const pings = [0, 0.28, 0.56];

  pings.forEach((offset) => {
    const t = startTime + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    // Downward pitch sweep
    osc.frequency.setValueAtTime(1450, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.18);

    const biquad = ctx.createBiquadFilter();
    biquad.type = "lowpass";
    biquad.frequency.setValueAtTime(2400, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(masterVol * 0.38, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(biquad).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

// ---------------------------------------------------------------------------
// Continuous Alarm Loop Controller
// Rings periodically until user clicks "Stop" or reaches auto-dismiss timeout
// ---------------------------------------------------------------------------
export class ActiveAlarmController {
  private loopTimer: number | null = null;
  private autoStopTimer: number | null = null;
  private isRinging = false;
  private currentSound: AlarmSound = "digital";
  private currentVolume = 0.8;
  private onStopCallback?: () => void;

  start(
    sound: AlarmSound,
    volume: number,
    options?: {
      repeatIntervalMs?: number;
      autoStopSeconds?: number;
      onStop?: () => void;
    },
  ): void {
    this.stop();
    this.isRinging = true;
    this.currentSound = sound;
    this.currentVolume = volume;
    this.onStopCallback = options?.onStop;

    const intervalMs = options?.repeatIntervalMs ?? (sound === "zen" ? 4000 : sound === "bell" ? 3200 : 1600);
    const autoStopSec = options?.autoStopSeconds ?? 45;

    // Play first strike immediately
    void playAlarmPattern(this.currentSound, this.currentVolume);

    // Repeat loop
    if (typeof window !== "undefined") {
      this.loopTimer = window.setInterval(() => {
        if (!this.isRinging) return;
        void playAlarmPattern(this.currentSound, this.currentVolume);
      }, intervalMs);

      // Auto-stop safety timeout
      this.autoStopTimer = window.setTimeout(() => {
        this.stop();
      }, autoStopSec * 1000);
    }
  }

  stop(): void {
    if (this.loopTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.autoStopTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    if (this.isRinging) {
      this.isRinging = false;
      this.onStopCallback?.();
    }
  }

  get active(): boolean {
    return this.isRinging;
  }
}
