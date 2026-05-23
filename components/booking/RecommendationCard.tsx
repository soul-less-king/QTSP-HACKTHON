"use client";

import { useI18n } from "@/components/Providers";
import { translateAttr, translateExplanation } from "@/lib/i18n";
import { IconUsers, IconCheck, IconClock, IconPlus, IconSliders } from "@/components/icons";
import type { RoomRecommendation } from "@/lib/types";

interface Props {
  rec: RoomRecommendation;
  inCart: boolean;
  onAddToEvent: () => void;
  onConfigureInCart: () => void;
  onHover?: (id: string | null) => void;
  // legacy single-select (kept for backwards-compat; unused in multi-room flow)
  selected?: boolean;
  onSelect?: () => void;
}

export function RecommendationCard({
  rec,
  inCart,
  onAddToEvent,
  onConfigureInCart,
  onHover,
}: Props) {
  const { t, lang } = useI18n();

  const activeAttrs = Object.entries(rec.attributes)
    .filter(([, v]) => v === true || (typeof v === "number" && v > 0))
    .map(([k]) => k);

  const pct = rec.match_percentage;
  const ring =
    pct >= 85 ? "text-green-600" : pct >= 65 ? "text-accent-600" : "text-amber-600";

  return (
    <div
      onMouseEnter={() => onHover?.(rec.room_id)}
      onMouseLeave={() => onHover?.(null)}
      className={`card relative p-4 transition-all ${
        inCart
          ? "ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10"
          : "hover:shadow-md"
      }`}
    >
      {/* Rank badge */}
      <div className="absolute -start-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow">
        {rec.rank}
      </div>

      {/* In-event indicator */}
      {inCart && (
        <div className="absolute -end-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
          <IconCheck className="h-4 w-4" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{rec.room_name}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <IconUsers className="h-3.5 w-3.5" /> {rec.capacity}
            </span>
            <span>
              {t("floor")} {rec.room_floor}
            </span>
          </div>
        </div>
        <div className="text-end">
          <p className={`text-2xl font-bold ${ring}`}>{pct}%</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{t("match")}</p>
        </div>
      </div>

      {/* Match reasons */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rec.explanation_keys.slice(0, 5).map((code, i) => (
          <span
            key={i}
            className="badge bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          >
            <IconCheck className="me-1 h-3 w-3" />
            {translateExplanation(lang, code)}
          </span>
        ))}
      </div>

      {/* Amenities */}
      <div className="mt-2 flex flex-wrap gap-1">
        {activeAttrs.slice(0, 6).map((k) => (
          <span
            key={k}
            className="badge bg-slate-100 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            {translateAttr(lang, k)}
          </span>
        ))}
      </div>

      {rec.availability.next_booking && (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <IconClock className="h-3 w-3" />
          {t("free_after")} {rec.availability.next_booking}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {inCart ? (
          <>
            <button
              onClick={onConfigureInCart}
              className="btn-outline flex flex-1 items-center justify-center gap-1.5 py-2 text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-700 dark:hover:bg-indigo-900/20"
            >
              <IconSliders className="h-3.5 w-3.5" />
              {t("configure_logistics")}
            </button>
            <button
              onClick={onAddToEvent}
              className="btn-outline flex items-center justify-center px-3 py-2 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              title={t("remove_from_event")}
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={onAddToEvent}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2"
          >
            <IconPlus className="h-4 w-4" />
            {t("add_to_event")}
          </button>
        )}
      </div>
    </div>
  );
}
