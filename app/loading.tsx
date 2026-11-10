import { Brain } from "lucide-react";

export default function Loading() {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#070b1b] font-sans text-slate-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-xl shadow-violet-500/30 animate-pulse">
          <Brain className="h-8 w-8 text-slate-950" />
        </div>

        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">EdNova</h2>
          <p className="mt-1 text-sm font-semibold text-cyan-200">GenAI Peer Learning Companion</p>
          <p className="mt-2 text-xs text-slate-400">Preparing your personalized learning space…</p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2" role="status" aria-live="polite">
          <span className="sr-only">Loading</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 shadow-md shadow-cyan-500/30 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
