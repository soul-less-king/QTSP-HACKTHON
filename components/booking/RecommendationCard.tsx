"use client";

import { useI18n } from "@/components/Providers";
import { translateAttr, translateExplanation } from "@/lib/i18n";
import { IconUsers, IconCheck, IconClock } from "@/components/icons";
import type { RoomRecommendation } from "@/lib/types";

interface Props {
  rec: RoomRecommendation;
  selected: boolean;
  onSelect: () => void;
  onHover?: (id: string | null) => void;
}

export function RecommendationCard({ rec, selected, onSelect, onHover }: Props) {
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
        selected ? "ring-2 ring-brand-500" : "hover:shadow-md"
      }`}
    >
      <div className="absolute -start-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow">
        {rec.rank}
      </div>

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

      <button
        onClick={onSelect}
        className={`mt-3 w-full py-2 ${selected ? "btn-accent" : "btn-outline"}`}
      >
        {selected ? (
          <>
            <IconCheck className="h-4 w-4" /> {t("selected")}
          </>
        ) : (
          t("select_room")
        )}
      </button>
    </div>
  );
}
