"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/Providers";
import { useAuth } from "@/lib/store";
import { apiFetch } from "@/lib/client";
import { RequirementSummary } from "@/components/booking/RequirementSummary";
import { RecommendationCard } from "@/components/booking/RecommendationCard";
import { RoomLogisticsPanel } from "@/components/booking/RoomLogisticsPanel";
import { EventCart } from "@/components/booking/EventCart";
import { BuildingViewer } from "@/components/building/BuildingViewer";
import type { BuildingFloor } from "@/components/building/types";
import {
  IconSparkles,
  IconSend,
  IconChat,
  IconCheck,
  IconArrowRight,
} from "@/components/icons";
import type {
  ExtractedBooking,
  RoomRecommendation,
  AlternativeTime,
  Language,
  RoomLogistics,
  EventCartItem,
} from "@/lib/types";

type Phase = "chat" | "confirm" | "recommend" | "review" | "done";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const DEFAULT_LOGISTICS: RoomLogistics = {
  seatsSelected: 1,
  tvsSelected: 0,
  projectorNeeded: false,
  microphonesNeeded: 0,
  wifiNeeded: false,
  cateringNeeded: false,
  logisticsNotes: "",
};

export default function BookPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  // ---------- core state ----------
  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // ---------- extraction ----------
  const [requestId, setRequestId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedBooking | null>(null);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [clarifying, setClarifying] = useState<string[]>([]);

  // ---------- recommendations ----------
  const [recs, setRecs] = useState<RoomRecommendation[]>([]);
  const [noMatch, setNoMatch] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeTime[]>([]);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  // ---------- multi-room cart ----------
  const [cartItems, setCartItems] = useState<EventCartItem[]>([]);
  const [logisticsTarget, setLogisticsTarget] = useState<{
    rec: RoomRecommendation;
    existingItem?: EventCartItem;
  } | null>(null);
  const [savingLogistics, setSavingLogistics] = useState(false);

  // ---------- review / submit ----------
  const [form, setForm] = useState({
    organizer_name: "",
    organizer_phone: "",
    event_title: "",
    special_requirements: "",
  });
  const [done, setDone] = useState<any>(null);

  // ---------- 3D building ----------
  const [floors, setFloors] = useState<BuildingFloor[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, organizer_name: f.organizer_name || user.fullName }));
  }, [user]);

  // Load building floors once we have a preferred date.
  useEffect(() => {
    if (extracted?.preferred_date) {
      apiFetch<{ building: { floors: BuildingFloor[] } }>(
        `/api/v1/rooms?date=${extracted.preferred_date}`
      )
        .then((d) => setFloors(d.building.floors))
        .catch(() => {});
    }
  }, [extracted?.preferred_date]);

  // ======================================================
  // Chat → extract
  // ======================================================
  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiFetch<{
        request_id: string;
        status: string;
        extracted_json: ExtractedBooking;
        confidence_score: number;
        clarifying_questions: string[];
      }>("/api/v1/chat/message", {
        method: "POST",
        body: JSON.stringify({ message: text, language: lang as Language }),
      });
      if (res.status === "extracted") {
        setRequestId(res.request_id);
        setExtracted(res.extracted_json);
        setConfidence(res.confidence_score);
        setClarifying(res.clarifying_questions || []);
        setMessages((m) => [...m, { role: "assistant", text: t("is_this_correct") }]);
        setPhase("confirm");
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: (res as any).suggestion || (res as any).message },
        ]);
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: e?.message || t("login_error") }]);
    } finally {
      setBusy(false);
    }
  }

  // ======================================================
  // Confirm → fetch recommendations
  // ======================================================
  async function findRooms() {
    if (!requestId || !extracted) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        recommendations: RoomRecommendation[];
        no_matches_reason: string | null;
        alternative_times: AlternativeTime[];
      }>("/api/v1/bookings/recommendations", {
        method: "POST",
        body: JSON.stringify({ request_id: requestId, extracted_json: extracted }),
      });
      setRecs(res.recommendations);
      setNoMatch(res.no_matches_reason);
      setAlternatives(res.alternative_times);
      setPhase("recommend");
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: e?.message || t("login_error") }]);
    } finally {
      setBusy(false);
    }
  }

  // ======================================================
  // Logistics panel: open / save / close
  // ======================================================
  function openLogisticsFor(rec: RoomRecommendation) {
    const existing = cartItems.find((i) => i.room.room_id === rec.room_id);
    setLogisticsTarget({ rec, existingItem: existing });
  }

  async function saveLogistics(logistics: RoomLogistics) {
    if (!logisticsTarget || !requestId) return;
    const { rec, existingItem } = logisticsTarget;
    setSavingLogistics(true);
    try {
      const body = {
        room_id: rec.room_id,
        seats_selected: logistics.seatsSelected,
        tvs_selected: logistics.tvsSelected,
        projector_needed: logistics.projectorNeeded,
        microphones_needed: logistics.microphonesNeeded,
        wifi_needed: logistics.wifiNeeded,
        catering_needed: logistics.cateringNeeded,
        logistics_notes: logistics.logisticsNotes,
      };

      let selectionId: string;

      if (existingItem?.selectionId) {
        // Update existing selection
        const res = await apiFetch<{ selection_id: string }>(
          `/api/v1/bookings/${requestId}/rooms/${existingItem.selectionId}`,
          { method: "PATCH", body: JSON.stringify(body) }
        );
        selectionId = res.selection_id;
      } else {
        // Create new selection (upsert on server handles duplicates)
        const res = await apiFetch<{ selection_id: string }>(
          `/api/v1/bookings/${requestId}/rooms`,
          { method: "POST", body: JSON.stringify(body) }
        );
        selectionId = res.selection_id;
      }

      setCartItems((prev) => {
        const existing = prev.find((i) => i.room.room_id === rec.room_id);
        if (existing) {
          return prev.map((i) =>
            i.room.room_id === rec.room_id ? { ...i, selectionId, logistics } : i
          );
        }
        return [...prev, { selectionId, room: rec, logistics }];
      });

      setLogisticsTarget(null);
    } catch (e: any) {
      alert(e?.message || "Failed to save logistics. Please try again.");
    } finally {
      setSavingLogistics(false);
    }
  }

  async function removeFromCart(item: EventCartItem) {
    if (!requestId || !item.selectionId) {
      // Not yet persisted — just remove from local state
      setCartItems((prev) => prev.filter((i) => i.room.room_id !== item.room.room_id));
      return;
    }
    try {
      await apiFetch(`/api/v1/bookings/${requestId}/rooms/${item.selectionId}`, {
        method: "DELETE",
      });
      setCartItems((prev) => prev.filter((i) => i.room.room_id !== item.room.room_id));
    } catch (e: any) {
      alert(e?.message || "Failed to remove room.");
    }
  }

  // ======================================================
  // Submit event
  // ======================================================
  async function submitEvent() {
    if (!requestId || cartItems.length === 0) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/bookings/submit", {
        method: "POST",
        body: JSON.stringify({
          request_id: requestId,
          attendee_count: extracted?.capacity,
          ...form,
        }),
      });
      setDone(res);
      setPhase("done");
    } catch (e: any) {
      alert(e?.message || t("login_error"));
    } finally {
      setBusy(false);
    }
  }

  // ======================================================
  // Reset
  // ======================================================
  function reset() {
    setPhase("chat");
    setMessages([]);
    setRequestId(null);
    setExtracted(null);
    setRecs([]);
    setCartItems([]);
    setDone(null);
    setNoMatch(null);
    setAlternatives([]);
    setHoveredRoom(null);
    setLogisticsTarget(null);
  }

  // Building highlight logic
  const cartRoomIds = cartItems.map((i) => i.room.room_id);
  const highlightIds = hoveredRoom
    ? [hoveredRoom]
    : phase === "recommend" && cartItems.length === 0
    ? recs.map((r) => r.room_id)
    : [];

  return (
    <>
      {/* Logistics modal (portal-style overlay) */}
      {logisticsTarget && (
        <RoomLogisticsPanel
          room={logisticsTarget.rec}
          initial={logisticsTarget.existingItem?.logistics}
          isEditing={!!logisticsTarget.existingItem}
          onSave={saveLogistics}
          onClose={() => setLogisticsTarget(null)}
          saving={savingLogistics}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: conversation + flow */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <IconSparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold">{t("booking_title")}</h1>
              <p className="text-sm text-slate-500">{t("tagline")}</p>
            </div>
          </div>

          {/* Chat transcript */}
          <div className="card max-h-[40vh] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <IconChat className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <p>{t("chat_intro")}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && phase === "chat" && (
              <div className="text-sm text-slate-400 animate-pulse-soft">{t("thinking")}</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          {(phase === "chat" || phase === "confirm") && (
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={t("chat_placeholder")}
                className="input flex-1"
              />
              <button onClick={sendMessage} disabled={busy} className="btn-primary px-4">
                <IconSend className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Confirmation / edit requirements */}
          {phase === "confirm" && extracted && (
            <RequirementSummary
              value={extracted}
              confidence={confidence}
              clarifying={clarifying}
              onChange={setExtracted}
              onConfirm={findRooms}
              loading={busy}
            />
          )}

          {/* Recommendations + cart (recommend phase) */}
          {phase === "recommend" && (
            <div className="space-y-4">
              {recs.length > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{t("top_matches")}</h2>
                    {cartItems.length > 0 && (
                      <span className="text-xs text-slate-500">
                        {cartItems.length} room(s) in event
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4">
                    {recs.map((rec) => {
                      const inCart = cartItems.some((i) => i.room.room_id === rec.room_id);
                      return (
                        <RecommendationCard
                          key={rec.room_id}
                          rec={rec}
                          inCart={inCart}
                          onHover={setHoveredRoom}
                          onAddToEvent={() => {
                            if (inCart) {
                              // clicking again removes from cart
                              const item = cartItems.find((i) => i.room.room_id === rec.room_id);
                              if (item) removeFromCart(item);
                            } else {
                              openLogisticsFor(rec);
                            }
                          }}
                          onConfigureInCart={() => openLogisticsFor(rec)}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="card p-5">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {t("no_matches")}
                  </p>
                  {noMatch && <p className="mt-1 text-sm text-slate-500">{noMatch}</p>}
                  {alternatives.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-medium">{t("alternative_times")}</p>
                      <div className="flex flex-wrap gap-2">
                        {alternatives.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (extracted)
                                setExtracted({
                                  ...extracted,
                                  preferred_date: a.date,
                                  preferred_time: a.time,
                                });
                              setPhase("confirm");
                            }}
                            className="btn-outline px-3 py-2 text-xs"
                          >
                            {a.date} · {a.time} · {a.available_rooms} {t("available_rooms")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setPhase("confirm")} className="btn-ghost mt-4 text-sm">
                    {t("back")}
                  </button>
                </div>
              )}

              {/* Event cart */}
              <EventCart
                items={cartItems}
                onConfigure={(item) => openLogisticsFor(item.room)}
                onRemove={removeFromCart}
                onReview={() => setPhase("review")}
                disabled={busy}
              />

              <button onClick={() => setPhase("confirm")} className="btn-ghost text-sm">
                {t("back")}
              </button>
            </div>
          )}

          {/* Review & submit phase */}
          {phase === "review" && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="font-bold text-lg">{t("event_review_title")}</h2>

              {/* Rooms summary */}
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {t("rooms_in_event")} ({cartItems.length})
                </h3>
                {cartItems.map((item, idx) => {
                  const { room, logistics } = item;
                  return (
                    <div
                      key={room.room_id}
                      className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/30 dark:bg-indigo-900/10"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <p className="font-semibold text-sm">{room.room_name}</p>
                        <span className="text-xs text-slate-500 ms-auto">
                          {t("floor")} {room.room_floor}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <Row label="Seats" value={`${logistics.seatsSelected} / ${room.capacity}`} />
                        {logistics.tvsSelected > 0 && (
                          <Row label="TVs" value={`${logistics.tvsSelected}`} />
                        )}
                        {logistics.microphonesNeeded > 0 && (
                          <Row label="Mics" value={`${logistics.microphonesNeeded}`} />
                        )}
                        {logistics.projectorNeeded && <Row label="Projector" value="Yes" />}
                        {logistics.wifiNeeded && <Row label="WiFi" value="Yes" />}
                        {logistics.cateringNeeded && <Row label="Catering" value="Yes" />}
                      </div>
                      {logistics.logisticsNotes && (
                        <p className="mt-2 text-[11px] text-slate-400 italic">
                          {logistics.logisticsNotes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event details form */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">
                  {t("event_details")}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labeled label={t("organizer_name")}>
                    <input
                      value={form.organizer_name}
                      onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
                      className="input"
                    />
                  </Labeled>
                  <Labeled label={t("organizer_phone")}>
                    <input
                      value={form.organizer_phone}
                      onChange={(e) => setForm({ ...form, organizer_phone: e.target.value })}
                      className="input"
                      placeholder="+974 ..."
                    />
                  </Labeled>
                  <Labeled label={t("event_title")} className="sm:col-span-2">
                    <input
                      value={form.event_title}
                      onChange={(e) => setForm({ ...form, event_title: e.target.value })}
                      className="input"
                    />
                  </Labeled>
                  <Labeled label={t("attendee_count")}>
                    <input
                      type="number"
                      value={extracted?.capacity ?? 1}
                      onChange={(e) =>
                        extracted &&
                        setExtracted({ ...extracted, capacity: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </Labeled>
                  <Labeled label={t("date")}>
                    <input
                      value={extracted?.preferred_date ?? ""}
                      disabled
                      className="input bg-slate-50 dark:bg-slate-800"
                    />
                  </Labeled>
                </div>
                <Labeled label={t("special_requirements")} className="mt-3">
                  <textarea
                    value={form.special_requirements}
                    onChange={(e) => setForm({ ...form, special_requirements: e.target.value })}
                    className="input min-h-[72px]"
                    placeholder={t("special_requirements_ph")}
                  />
                </Labeled>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPhase("recommend")} className="btn-outline">
                  {t("back")}
                </button>
                <button
                  onClick={submitEvent}
                  disabled={busy || cartItems.length === 0}
                  className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5"
                >
                  {busy ? (
                    <span className="animate-pulse-soft">{t("loading")}</span>
                  ) : (
                    <>
                      {t("submit_event")}
                      <IconArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div className="card animate-fade-in p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40">
                <IconCheck className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold">{t("event_submitted")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("event_awaiting")}</p>
              {done && (
                <div className="mx-auto mt-4 max-w-xs rounded-lg bg-slate-50 p-3 text-start text-sm dark:bg-slate-800/50">
                  <Row label={t("event_title")} value={form.event_title || "—"} />
                  <Row label={t("date")} value={done.requested_date || "—"} />
                  <Row label={t("time")} value={done.requested_time || "—"} />
                  <Row label="Rooms" value={`${done.rooms_count || cartItems.length} room(s)`} />
                </div>
              )}
              <button onClick={reset} className="btn-primary mt-5">
                {t("submit_another")}
              </button>
            </div>
          )}
        </div>

        {/* Right: live 3D building */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20">
            {floors.length > 0 ? (
              <BuildingViewer
                floors={floors}
                highlightRoomIds={highlightIds}
                cartRoomIds={cartRoomIds}
                selectedDate={extracted?.preferred_date}
                height="h-[420px]"
              />
            ) : (
              <div className="card flex h-[420px] flex-col items-center justify-center gap-2 text-center text-slate-400">
                <IconChat className="h-8 w-8 text-slate-300" />
                <p className="max-w-[200px] text-sm">{t("chat_intro")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Labeled({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
