"use client";

import { useI18n } from "./Providers";

/** Full-screen branded loading screen (logo + indeterminate progress). */
export function LoadingScreen({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-7 bg-gradient-to-br from-brand-600 via-brand-700 to-accent-700">
      {/* Subtle decorative glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-400 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent-400 blur-3xl" />
      </div>

      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-3 shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QSTP" className="h-full w-full object-contain" />
        <span className="absolute -inset-2 rounded-[1.75rem] border-2 border-white/30 animate-ping" />
      </div>

      <div className="relative text-center">
        <p className="text-2xl font-bold tracking-tight text-white">{t("app_name")}</p>
        <p className="mt-1 text-sm text-white/80">{label ?? t("preparing_workspace")}</p>
      </div>

      <div className="relative h-1.5 w-44 overflow-hidden rounded-full bg-white/20">
        <span className="block h-full w-1/2 animate-loading-bar rounded-full bg-white" />
      </div>
    </div>
  );
}
