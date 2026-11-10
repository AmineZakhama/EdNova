"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import OnboardingWizard from "@/components/ednova/OnboardingWizard";
import { loadLearnerProfile } from "@/lib/ednova/profile-storage";
import type { LearnerProfile } from "@/lib/ednova/types";

export default function ProfileLoader() {
  const [profile, setProfile] = useState<LearnerProfile | null | undefined>(undefined);
  useEffect(() => {
    const timer = window.setTimeout(() => setProfile(loadLearnerProfile()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (profile === undefined) return <main className="grid min-h-screen place-items-center bg-[#070b1b] text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin" /></main>;
  return <OnboardingWizard initialProfile={profile ?? undefined} editing />;
}
