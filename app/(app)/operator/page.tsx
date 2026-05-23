"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/Providers";
import { apiFetch } from "@/lib/client";
import {
  IconInbox,
  IconCalendar,
  IconClock,
  IconUsers,
  IconCheck,
  IconX,
} from "@/components/icons";

interface PendingItem {
  request_id: string;
  user_email: string;
  user_name: string;
  request_type: string;
  room_name: string | null;
  room_floor: number | null;
  requested_date: string | null;
  requested_time: string | null;
  duration_minutes: number | null;
  capacity_requested: number | null;
  special_requirements: string | null;
  event_title: string | null;
  match_score: number | null;
  priority: string;
  user_history: { total_bookings: number; cancellation_rate: number; on_time_rate: number } | null;
}

interface OverviewData {
  pending_approvals_count: number;
  today_bookings: { booking_id: string; room_name: string; organizer: string; time: string; end_time: string }[];
  maintenance_schedule: { room_id: string; room_name: string; maintenance_date: string | null }[];
}

export default function OperatorPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ item: PendingItem; mode: "approve" | "reject" } | null>(null);

  const load = useCallback(async () => {
    const [ov, pend] = await Promise.all([
      apiFetch<OverviewData>("/api/v1/operator/dashboard"),
      apiFetch<{ data: PendingItem[] }>("/api/v1/operator/pending-bookings?limit=50"),
    ]);
    setOverview(ov);
    setPending(pend.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="py-20 text-center text-slate-400 animate-pulse-soft">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <IconInbox className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">{t("operator_dashboard")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pending approvals */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            {t("pending_approvals")}
            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {overview?.pending_approvals_count ?? 0}
            </span>
          </h2>
          {pending.length === 0 ? (
            <p className="card p-8 text-center text-sm text-slate-400">{t("no_pending")}</p>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.request_id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.event_title || t("book_room")}</h3>
                        {item.priority === "high" && (
                          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {t("priority_high")}
                          </span>
                        )}
                        {item.request_type === "email" && (
                          <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800">
                            {t("external_request")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {t("requested_by")}: {item.user_name} · {item.user_email}
                      </p>
                    </div>
                    {typeof item.match_score === "number" && (
                      <div className="text-end">
                        <p className="text-lg font-bold text-accent-600">{item.match_score}%</p>
                        <p className="text-[10px] uppercase text-slate-400">{t("match_score")}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.room_name} {item.room_floor != null && `· ${t("floor")} ${item.room_floor}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <IconCalendar className="h-3.5 w-3.5" /> {item.requested_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <IconClock className="h-3.5 w-3.5" /> {item.requested_time}
                    </span>
                    <span className="flex items-center gap-1">
                      <IconUsers className="h-3.5 w-3.5" /> {item.capacity_requested}
                    </span>
                  </div>

                  {item.special_requirements && (
                    <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800/50">
                      {item.special_requirements}
                    </p>
                  )}

                  {item.user_history && (
                    <p className="mt-2 text-xs text-slate-400">
                      {t("user_history")}: {item.user_history.total_bookings} bookings ·{" "}
                      {Math.round(item.user_history.cancellation_rate * 100)}% cancel
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setModal({ item, mode: "approve" })}
                      className="btn-primary flex-1 py-2"
                    >
                      <IconCheck className="h-4 w-4" /> {t("approve")}
                    </button>
                    <button
                      onClick={() => setModal({ item, mode: "reject" })}
                      className="btn-outline flex-1 py-2 text-red-600"
                    >
                      <IconX className="h-4 w-4" /> {t("reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side: today + maintenance */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-semibold">{t("today_bookings")}</h2>
            <div className="card divide-y divide-slate-100 dark:divide-slate-800">
              {overview?.today_bookings.length ? (
                overview.today_bookings.map((b) => (
                  <div key={b.booking_id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium">{b.room_name}</p>
                      <p className="text-xs text-slate-500">{b.organizer}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {b.time}–{b.end_time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-sm text-slate-400">{t("no_bookings")}</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-semibold">{t("maintenance_schedule")}</h2>
            <div className="card divide-y divide-slate-100 dark:divide-slate-800">
              {overview?.maintenance_schedule.length ? (
                overview.maintenance_schedule.map((m) => (
                  <div key={m.room_id} className="flex items-center justify-between p-3 text-sm">
                    <p className="font-medium">{m.room_name}</p>
                    <span className="text-xs text-slate-500">{m.maintenance_date}</span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-sm text-slate-400">{t("no_bookings")}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {modal && (
        <ApprovalModal
          item={modal.item}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            setLoading(true);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ApprovalModal({
  item,
  mode,
  onClose,
  onDone,
}: {
  item: PendingItem;
  mode: "approve" | "reject";
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [catering, setCatering] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "approve") {
        await apiFetch(`/api/v1/operator/bookings/${item.request_id}/approve`, {
          method: "POST",
          body: JSON.stringify({ operator_notes: notes, catering_notes: catering }),
        });
      } else {
        if (!reason.trim()) {
          setError(t("rejection_reason"));
          setBusy(false);
          return;
        }
        await apiFetch(`/api/v1/operator/bookings/${item.request_id}/reject`, {
          method: "POST",
          body: JSON.stringify({ rejection_reason: reason, operator_notes: notes }),
        });
      }
      onDone();
    } catch (e: any) {
      setError(e?.message || "Error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-fade-in p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">
          {mode === "approve" ? t("approve") : t("reject")}: {item.room_name}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {item.event_title} · {item.requested_date} · {item.requested_time}
        </p>

        <div className="mt-4 space-y-3">
          {mode === "reject" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t("rejection_reason")}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input min-h-[72px]"
              />
            </label>
          )}
          {mode === "approve" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t("catering_notes")}
              </span>
              <input value={catering} onChange={(e) => setCatering(e.target.value)} className="input" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              {mode === "approve" ? t("approval_notes") : t("approval_notes")}
            </span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">
            {t("cancel")}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 ${mode === "approve" ? "btn-primary" : "btn-accent"}`}
          >
            {busy ? t("loading") : mode === "approve" ? t("approve") : t("reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
