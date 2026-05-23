"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useTheme } from "@/components/Providers";
import { useAuth } from "@/lib/store";
import { apiFetch } from "@/lib/client";
import { IconGlobe, IconSun, IconMoon, IconSparkles } from "@/components/icons";
import { LoadingScreen } from "@/components/LoadingScreen";

const DEMO = [
  { email: "user@qstp.qa", role: "user" },
  { email: "operator@qstp.qa", role: "operator" },
];

export default function LoginPage() {
  const { t, toggleLang, lang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { setUser, fetchUser } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // If already signed in, skip the login page.
    fetchUser().then((u) => {
      if (u) router.replace("/book");
    });
  }, [fetchUser, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ user: any }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        fullName: data.user.fullName,
      });
      setRedirecting(true);
      const dest = data.user.role === "operator" ? "/operator" : "/book";
      setTimeout(() => router.push(dest), 1000);
    } catch (err: any) {
      setError(err?.status === 401 ? t("invalid_credentials") : t("login_error"));
    } finally {
      setLoading(false);
    }
  }

  function quickFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Passw0rd!");
  }

  if (redirecting) return <LoadingScreen />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200 blur-3xl dark:bg-brand-900/40" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-200 blur-3xl dark:bg-accent-900/30" />
      </div>

      <div className="absolute end-4 top-4 flex gap-1">
        <button onClick={toggleLang} className="btn-ghost px-3 py-2">
          <IconGlobe className="h-4 w-4" />
          <span className="text-xs font-semibold">{lang === "en" ? "AR" : "EN"}</span>
        </button>
        <button onClick={toggleTheme} className="btn-ghost px-2 py-2">
          {theme === "dark" ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-lg shadow-brand-600/20 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QSTP" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("app_name")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("tagline")}</p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{t("welcome_back")}</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("login_subtitle")}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@qstp.qa"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? t("signing_in") : t("login")}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <IconSparkles className="h-3.5 w-3.5" />
              {t("demo_accounts")}
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => quickFill(d.email)}
                  className="btn-outline px-3 py-1.5 text-xs"
                >
                  {d.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
