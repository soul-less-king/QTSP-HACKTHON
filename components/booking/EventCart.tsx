"use client";

import { useI18n } from "@/components/Providers";
import { IconTrash, IconSliders, IconUsers, IconArrowRight, IconCart } from "@/components/icons";
import type { EventCartItem } from "@/lib/types";

interface Props {
  items: EventCartItem[];
  onConfigure: (item: EventCartItem) => void;
  onRemove: (item: EventCartItem) => void;
  onReview: () => void;
  disabled?: boolean;
}

function LogisticsBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export function EventCart({ items, onConfigure, onRemove, onReview, disabled }: Props) {
  const { t } = useI18n();

  return (
    <div className="card animate-fade-in p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <IconCart className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-sm">{t("event_cart_title")}</h3>
          {items.length > 0 && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {items.length}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">{t("event_cart_empty")}</p>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map((item) => {
            const { room, logistics } = item;
            const logBadges: { label: string; value: string | number }[] = [
              { label: "Seats", value: `${logistics.seatsSelected}/${room.capacity}` },
            ];
            if (logistics.tvsSelected > 0)
              logBadges.push({ label: "TVs", value: logistics.tvsSelected });
            if (logistics.projectorNeeded) logBadges.push({ label: "Projector", value: "✓" });
            if (logistics.microphonesNeeded > 0)
              logBadges.push({ label: "Mics", value: logistics.microphonesNeeded });
            if (logistics.wifiNeeded) logBadges.push({ label: "WiFi", value: "✓" });
            if (logistics.cateringNeeded) logBadges.push({ label: "Catering", value: "✓" });

            return (
              <div
                key={item.room.room_id}
                className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/30 dark:bg-indigo-900/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{room.room_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {t("floor")} {room.room_floor} · {room.capacity} seats total
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => onConfigure(item)}
                      disabled={disabled}
                      title={t("configure_logistics")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-40 dark:hover:bg-indigo-900/30"
                    >
                      <IconSliders className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item)}
                      disabled={disabled}
                      title={t("remove_from_event")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-900/20"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {logBadges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {logBadges.map((b) => (
                      <LogisticsBadge key={b.label} label={b.label} value={b.value} />
                    ))}
                  </div>
                )}
                {logistics.logisticsNotes && (
                  <p className="mt-1.5 text-[11px] text-slate-400 italic truncate">
                    {logistics.logisticsNotes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <button
          onClick={onReview}
          disabled={disabled}
          className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
        >
          {t("review_event")}
          <IconArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
