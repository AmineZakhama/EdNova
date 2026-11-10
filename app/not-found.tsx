import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070b1b] font-sans antialiased flex items-center justify-center relative overflow-hidden p-6 text-slate-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 md:p-12 text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-violet-500/15 text-violet-200">
          <Brain className="h-8 w-8" />
        </div>

        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500 mb-3 tracking-tight">
          404
        </h1>
        <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          Looks like this learning route doesn't exist. Let's return to your peer tutor.
        </p>

        <div className="flex justify-center">
          <Link
            href="/ednova"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-bold rounded-xl shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" /> Back to EdNova
          </Link>
        </div>
      </div>
    </div>
  );
}
