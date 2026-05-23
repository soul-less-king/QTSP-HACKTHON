"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/Providers";
import { apiFetch } from "@/lib/client";
import { IconCalendar, IconUsers, IconClock, IconPin } from "@/components/icons";

interface BookingItem {
  booking_id: string;
  room_name: string;
  room_floor: number;
  date: string;
  time: string;
  end_time: string;
  capacity: number;
  status: string;
  event_title: string | null;
  special_requirements: string | null;
  approval_notes: string | null;
}
interface DashboardData {
  upcoming_bookings: BookingItem[];
  past_bookings: BookingItem[];
  pending_requests: {
    request_id: string;
    event_title: string | null;
    date: string;
    time: string;
    status: string;
    rejection_reason: string | null;
  }[];
  statistics: {
    total_bookings: number;
    approval_rate: number;
    cancellation_rate: number;
    average_room_capacity_used: number;
  };
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardData>("/api/v1/user/dashboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-400 animate-pulse-soft">{t("loading")}</div>;
  }
  if (!data) return null;

  const stats = [
    { label: t("total_bookings"), value: data.statistics.total_bookings },
    { label: t("approval_rate"), value: `${Math.round(data.statistics.approval_rate * 100)}%` },
    { label: t("cancellation_rate"), value: `${Math.round(data.statistics.cancellation_rate * 100)}%` },
    { label: t("avg_capacity"), value: `${Math.round(data.statistics.average_room_capacity_used * 100)}%` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t("dashboard")}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {data.pending_requests.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">{t("pending_requests")}</h2>
          <div className="space-y-2">
            {data.pending_requests.map((r) => (
              <div key={r.request_id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{r.event_title || t("book_room")}</p>
                  <p className="text-xs text-slate-500">
                    {r.date} · {r.time}
                  </p>
                  {r.rejection_reason && (
                    <p className="mt-1 text-xs text-red-600">{r.rejection_reason}</p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">{t("upcoming_bookings")}</h2>
        {data.upcoming_bookings.length === 0 ? (
          <p className="card p-6 text-center text-sm text-slate-400">{t("no_upcoming")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.upcoming_bookings.map((b) => (
              <BookingCard key={b.booking_id} b={b} />
            ))}
          </div>
        )}
      </section>

      {data.past_bookings.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">{t("past_bookings")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.past_bookings.map((b) => (
              <BookingCard key={b.booking_id} b={b} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingCard({ b, muted }: { b: BookingItem; muted?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`card p-4 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{b.event_title || b.room_name}</h3>
          <p className="text-sm text-slate-500">{b.room_name}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <IconCalendar className="h-3.5 w-3.5" /> {b.date}
        </span>
        <span className="flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" /> {b.time}–{b.end_time}
        </span>
        <span className="flex items-center gap-1">
          <IconUsers className="h-3.5 w-3.5" /> {b.capacity}
        </span>
        <span className="flex items-center gap-1">
          <IconPin className="h-3.5 w-3.5" /> {t("floor")} {b.room_floor}
        </span>
      </div>
      {b.approval_notes && (
        <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800/50">
          {b.approval_notes}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
    pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    submitted_to_operator: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return <span className={`badge ${map[status] || map.cancelled}`}>{t(`status_${status}`)}</span>;
}
