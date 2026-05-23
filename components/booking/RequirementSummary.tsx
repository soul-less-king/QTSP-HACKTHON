"use client";

import { useState } from "react";
import { useI18n } from "@/components/Providers";
import { translateAttr } from "@/lib/i18n";
import { IconEdit, IconCheck, IconUsers, IconClock, IconCalendar } from "@/components/icons";
import type { ExtractedBooking } from "@/lib/types";

interface Props {
  value: ExtractedBooking;
  confidence?: number;
  clarifying?: string[];
  onChange: (next: ExtractedBooking) => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ATTR_OPTIONS = [
  "projector",
  "wifi",
  "microphones",
  "catering_kitchen",
  "parking_nearby",
  "accessibility",
  "natural_light",
  "outdoor_access",
  "av_equipment",
];

export function RequirementSummary({
  value,
  confidence,
  clarifying = [],
  onChange,
  onConfirm,
  loading,
}: Props) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);

  const allAttrs = new Set([
    ...value.mandatory_attributes.filter((a) => a !== "capacity"),
    ...value.important_attributes,
    ...value.nice_to_have,
  ]);

  function toggleAttr(attr: string) {
    const has = allAttrs.has(attr);
    const next = { ...value };
    if (has) {
      next.important_attributes = next.important_attributes.filter((a) => a !== attr);
      next.nice_to_have = next.nice_to_have.filter((a) => a !== attr);
      next.mandatory_attributes = next.mandatory_attributes.filter((a) => a !== attr);
    } else {
      next.important_attributes = [...next.important_attributes, attr];
    }
    onChange(next);
  }

  return (
    <div className="card animate-fade-in p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{t("is_this_correct")}</h3>
          {typeof confidence === "number" && (
            <p className="mt-1 text-xs text-slate-500">
              {t("confidence")}: {Math.round(confidence * 100)}%
            </p>
          )}
        </div>
        <button onClick={() => setEditing((e) => !e)} className="btn-ghost px-2 py-1 text-xs">
          <IconEdit className="h-3.5 w-3.5" />
          {t("edit_requirements")}
        </button>
      </div>

      {clarifying.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-medium">{t("clarify_intro")}</p>
          <ul className="mt-1 list-inside list-disc">
            {clarifying.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("capacity")}>
            <input
              type="number"
              min={1}
              max={500}
              value={value.capacity}
              onChange={(e) => onChange({ ...value, capacity: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label={`${t("duration")} (${t("minutes")})`}>
            <input
              type="number"
              min={30}
              max={480}
              step={15}
              value={value.duration_minutes}
              onChange={(e) => onChange({ ...value, duration_minutes: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label={t("date")}>
            <input
              type="date"
              value={value.preferred_date}
              onChange={(e) => onChange({ ...value, preferred_date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label={t("time")}>
            <input
              type="time"
              value={value.preferred_time}
              onChange={(e) => onChange({ ...value, preferred_time: e.target.value })}
              className="input"
            />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<IconUsers className="h-4 w-4" />} label={t("capacity")} value={`${value.capacity} ${t("people")}`} />
          <Stat icon={<IconClock className="h-4 w-4" />} label={t("duration")} value={`${value.duration_minutes} ${t("minutes")}`} />
          <Stat icon={<IconCalendar className="h-4 w-4" />} label={t("date")} value={value.preferred_date} />
          <Stat icon={<IconClock className="h-4 w-4" />} label={t("time")} value={value.preferred_time} />
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">{t("amenities")}</p>
        <div className="flex flex-wrap gap-1.5">
          {ATTR_OPTIONS.map((attr) => {
            const on = allAttrs.has(attr);
            return (
              <button
                key={attr}
                onClick={() => toggleAttr(attr)}
                className={`badge border transition-colors ${
                  on
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "border-slate-200 bg-transparent text-slate-500 dark:border-slate-700"
                }`}
              >
                {on && <IconCheck className="me-1 h-3 w-3" />}
                {translateAttr(lang, attr)}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={onConfirm} disabled={loading} className="btn-primary mt-5 w-full py-2.5">
        {loading ? t("loading") : t("find_rooms")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
