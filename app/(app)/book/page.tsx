"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/Providers";
import { useAuth } from "@/lib/store";
import { apiFetch } from "@/lib/client";
import { RequirementSummary } from "@/components/booking/RequirementSummary";
import { RecommendationCard } from "@/components/booking/RecommendationCard";
import { BuildingViewer } from "@/components/building/BuildingViewer";
import type { BuildingFloor } from "@/components/building/types";
import { IconSparkles, IconSend, IconChat, IconCheck } from "@/components/icons";
import type {
  ExtractedBooking,
  RoomRecommendation,
  AlternativeTime,
  Language,
} from "@/lib/types";

type Phase = "chat" | "confirm" | "recommend" | "submit" | "done";
interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function BookPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedBooking | null>(null);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [clarifying, setClarifying] = useState<string[]>([]);

  const [recs, setRecs] = useState<RoomRecommendation[]>([]);
  const [noMatch, setNoMatch] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeTime[]>([]);
  const [selected, setSelected] = useState<RoomRecommendation | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [form, setForm] = useState({
    organizer_name: "",
    organizer_phone: "",
    event_title: "",
    special_requirements: "",
  });
  const [done, setDone] = useState<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, organizer_name: f.organizer_name || user.fullName }));
  }, [user]);

  // Load building floors for the 3D side panel once we have a date.
  useEffect(() => {
    if (extracted?.preferred_date) {
      apiFetch<{ building: { floors: BuildingFloor[] } }>(
        `/api/v1/rooms?date=${extracted.preferred_date}`
      )
        .then((d) => setFloors(d.building.floors))
        .catch(() => {});
    }
  }, [extracted?.preferred_date]);

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
      setSelected(null);
      setPhase("recommend");
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: e?.message || t("login_error") }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitBooking() {
    if (!requestId || !selected) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/bookings/submit", {
        method: "POST",
        body: JSON.stringify({
          request_id: requestId,
          selected_room_id: selected.room_id,
          attendee_count: extracted?.capacity,
          ...form,
        }),
      });
      setDone(res);
      setPhase("done");
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: e?.message || t("login_error") }]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("chat");
    setMessages([]);
    setRequestId(null);
    setExtracted(null);
    setRecs([]);
    setSelected(null);
    setDone(null);
    setNoMatch(null);
    setAlternatives([]);
  }

  const highlightIds = selected
    ? [selected.room_id]
    : hoveredRoom
    ? [hoveredRoom]
    : recs.map((r) => r.room_id);

  return (
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
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="animate-pulse-soft">{t("thinking")}</span>
            </div>
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

        {/* Confirmation / edit */}
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

        {/* Recommendations */}
        {phase === "recommend" && (
          <div className="space-y-3">
            {recs.length > 0 ? (
              <>
                <h2 className="font-semibold">{t("top_matches")}</h2>
                <div className="grid gap-4 sm:grid-cols-1">
                  {recs.map((rec) => (
                    <RecommendationCard
                      key={rec.room_id}
                      rec={rec}
                      selected={selected?.room_id === rec.room_id}
                      onHover={setHoveredRoom}
                      onSelect={() => {
                        setSelected(rec);
                        setPhase("submit");
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="card p-5">
                <p className="font-medium text-amber-700 dark:text-amber-300">{t("no_matches")}</p>
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
          </div>
        )}

        {/* Submission form */}
        {phase === "submit" && selected && (
          <div className="card animate-fade-in p-5">
            <h2 className="font-semibold">{t("finalize_booking")}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selected.room_name} · {extracted?.preferred_date} · {extracted?.preferred_time}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              <Labeled label={t("event_title")}>
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
            </div>
            <Labeled label={t("special_requirements")} className="mt-3">
              <textarea
                value={form.special_requirements}
                onChange={(e) => setForm({ ...form, special_requirements: e.target.value })}
                className="input min-h-[72px]"
                placeholder={t("special_requirements_ph")}
              />
            </Labeled>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setPhase("recommend")} className="btn-outline">
                {t("back")}
              </button>
              <button onClick={submitBooking} disabled={busy} className="btn-primary flex-1 py-2.5">
                {busy ? t("loading") : t("submit_for_approval")}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {phase === "done" && (
          <div className="card animate-fade-in p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40">
              <IconCheck className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">{t("booking_submitted")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("awaiting_approval")}</p>
            {done && (
              <div className="mx-auto mt-4 max-w-xs rounded-lg bg-slate-50 p-3 text-start text-sm dark:bg-slate-800/50">
                <Row label={t("event_title")} value={done.room_name} />
                <Row label={t("date")} value={done.requested_date} />
                <Row label={t("time")} value={done.requested_time} />
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
