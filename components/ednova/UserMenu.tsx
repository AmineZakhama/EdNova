"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Sparkles, User, UserPlus } from "lucide-react";
import type { SafeUser } from "@/lib/ednova/auth";

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/ednova/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/ednova/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/ednova/login");
      router.refresh();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="h-7 w-20 rounded-lg bg-white/5 animate-pulse hidden sm:block" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href="/ednova/profile"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
          title={`Signed in as ${user.name} (${user.email})`}
        >
          <span>{user.avatar || "✨"}</span>
          <span className="max-w-[110px] truncate font-medium">{user.name}</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20 cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <Link
        href="/ednova/login"
        className="flex items-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20"
      >
        <LogIn className="w-3 h-3" /> Sign In
      </Link>
      <Link
        href="/ednova/register"
        className="hidden md:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
      >
        <UserPlus className="w-3 h-3" /> Register
      </Link>
    </div>
  );
}
