"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      fetchUser().then((u) => {
        if (!u) router.replace("/login");
      });
    }
  }, [user, fetchUser, router]);

  if (loading && !user) return <LoadingScreen />;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
