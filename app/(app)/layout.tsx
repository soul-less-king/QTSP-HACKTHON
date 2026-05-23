"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/components/Providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      fetchUser().then((u) => {
        if (!u) router.replace("/login");
      });
    }
  }, [user, fetchUser, router]);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <span className="animate-pulse-soft">{t("loading")}</span>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
