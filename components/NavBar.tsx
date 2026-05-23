"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n, useTheme } from "./Providers";
import { useAuth } from "@/lib/store";
import {
  IconLogo,
  IconGlobe,
  IconSun,
  IconMoon,
  IconChat,
  IconCalendar,
  IconBuilding,
  IconInbox,
  IconLogout,
  IconChevron,
} from "./icons";

export function NavBar() {
  const { t, toggleLang, lang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/book", label: t("book_room"), icon: IconChat },
    { href: "/building", label: t("building_view"), icon: IconBuilding },
    { href: "/dashboard", label: t("my_bookings"), icon: IconCalendar },
  ];
  if (user?.role === "operator" || user?.role === "admin") {
    links.push({ href: "/operator", label: t("operator_console"), icon: IconInbox });
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/book" className="flex items-center gap-2 font-bold text-brand-600 dark:text-brand-400">
          <IconLogo className="h-7 w-7" />
          <span className="text-lg">{t("app_name")}</span>
        </Link>

        <nav className="ms-2 hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <button
            onClick={toggleLang}
            className="btn-ghost px-3 py-2"
            title="Language"
            aria-label="Toggle language"
          >
            <IconGlobe className="h-4 w-4" />
            <span className="text-xs font-semibold">{lang === "en" ? "AR" : "EN"}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="btn-ghost px-2 py-2"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>

          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="btn-ghost px-2 py-1.5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {user.fullName.slice(0, 1)}
                </span>
                <span className="hidden text-sm sm:inline">{user.fullName.split(" ")[0]}</span>
                <IconChevron className="h-3 w-3" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute end-0 z-20 mt-2 w-56 animate-fade-in card p-2">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      <span className="badge mt-1 bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-300 capitalize">
                        {user.role}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <IconLogout className="h-4 w-4" />
                      {t("logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1 dark:border-slate-900 md:hidden">
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
