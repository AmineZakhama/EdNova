"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { saveLearnerProfile } from "@/lib/ednova/profile-storage";
import type { LearningStyle } from "@/lib/ednova/types";

export default function EdNovaGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuthAndProfile() {
      try {
        const res = await fetch("/api/ednova/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (!active) return;

          if (data.authenticated && data.user) {
            // First-time account connection check:
            if (data.needsOnboarding) {
              router.replace("/ednova/onboarding?first_time=true");
              return;
            }

            // Sync database profile into local storage so all client tools have the exact profile
            if (data.profile && data.profile.onboarded) {
              let styles: LearningStyle[] = ["step-by-step"];
              let subjects: string[] = [];
              let cognitiveTraits = undefined;

              try {
                const parsedStyles = JSON.parse(data.profile.learningStyles || "[]");
                if (Array.isArray(parsedStyles) && parsedStyles.length > 0) {
                  styles = parsedStyles;
                }
              } catch {}

              try {
                const parsedSubjects = JSON.parse(data.profile.subjects || "[]");
                if (Array.isArray(parsedSubjects)) {
                  subjects = parsedSubjects;
                }
              } catch {}

              try {
                if (data.profile.cognitiveTraits) {
                  cognitiveTraits = JSON.parse(data.profile.cognitiveTraits);
                }
              } catch {}

              saveLearnerProfile({
                nickname: data.user.name || "Learner",
                avatar: data.user.avatar || "✨",
                language: data.profile.language || "en",
                level: data.profile.level || "developing learner",
                learningStyles: styles,
                subjects: subjects,
                mode: data.profile.mode || "individual",
                dailyStudyMinutes: data.profile.dailyStudyMinutes || 25,
                preferredStudyTime: data.profile.preferredStudyTime || "",
                cognitiveArchetype: data.profile.cognitiveArchetype || undefined,
                cognitiveTraits,
                scaffoldingPace: data.profile.scaffoldingPace || undefined,
              });

              setReady(true);
              return;
            }

            // Authenticated without explicit onboarding requirement
            setReady(true);
            return;
          }
        }
      } catch {
        // network or server error
      }

      if (!active) return;

      // Unauthenticated: Redirect strictly to login page with callbackUrl
      const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/ednova";
      router.replace(`/ednova/login?callbackUrl=${encodeURIComponent(currentPath)}`);
    }

    checkAuthAndProfile();

    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070b1b] text-cyan-100">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
            Verifying Student Session…
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
