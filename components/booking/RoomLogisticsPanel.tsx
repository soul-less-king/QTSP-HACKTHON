"use client";

import { useState } from "react";
import { useI18n } from "@/components/Providers";
import { IconX, IconUsers, IconSliders, IconCheck } from "@/components/icons";
import type { RoomLogistics, RoomRecommendation } from "@/lib/types";

interface Props {
  room: RoomRecommendation;
  initial?: Partial<RoomLogistics>;
  isEditing?: boolean;
  onSave: (logistics: RoomLogistics) => void;
  onClose: () => void;
  saving?: boolean;
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-sm font-semibold">
          {value}
          {suffix && <span className="text-xs font-normal text-slate-400"> {suffix}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          +
        </button>
        <span className="text-xs text-slate-400">
          / {max} max
        </span>
      </div>
      {max > 1 && (
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-brand-600"
        />
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
        checked
          ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
          : "border-slate-200 dark:border-slate-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand-300"}`}
    >
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
      />
    </label>
  );
}

export function RoomLogisticsPanel({ room, initial, isEditing, onSave, onClose, saving }: Props) {
  const { t } = useI18n();
  const attrs = room.attributes;
  const maxSeats = room.capacity;
  const maxTvs = typeof attrs.tv_screens === "number" ? attrs.tv_screens : 0;
  const hasProjector = !!attrs.projector;
  const maxMics = typeof attrs.microphones === "number" ? attrs.microphones : 0;
  const hasWifi = !!(attrs.wifi);
  const hasCatering = !!attrs.catering_kitchen;

  const [seats, setSeats] = useState(initial?.seatsSelected ?? Math.min(1, maxSeats));
  const [tvs, setTvs] = useState(initial?.tvsSelected ?? 0);
  const [projector, setProjector] = useState(initial?.projectorNeeded ?? false);
  const [mics, setMics] = useState(initial?.microphonesNeeded ?? 0);
  const [wifi, setWifi] = useState(initial?.wifiNeeded ?? false);
  const [catering, setCatering] = useState(initial?.cateringNeeded ?? false);
  const [notes, setNotes] = useState(initial?.logisticsNotes ?? "");

  function handleSave() {
    onSave({
      seatsSelected: seats,
      tvsSelected: tvs,
      projectorNeeded: projector,
      microphonesNeeded: mics,
      wifiNeeded: wifi,
      cateringNeeded: catering,
      logisticsNotes: notes,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md animate-fade-in rounded-t-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <IconSliders className="h-4 w-4" />
              </span>
              <h2 className="font-bold">{t("logistics_title")}</h2>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <IconUsers className="h-3.5 w-3.5" />
              {room.room_name} · {t("floor")} {room.room_floor} · {room.capacity} seats total
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pe-1">
          {/* Seats */}
          <Stepper
            label={t("logistics_seats")}
            value={seats}
            min={1}
            max={maxSeats}
            onChange={setSeats}
            suffix={`of ${maxSeats}`}
          />

          {/* TVs */}
          {maxTvs > 0 && (
            <Stepper
              label={t("logistics_tvs")}
              value={tvs}
              min={0}
              max={maxTvs}
              onChange={setTvs}
              suffix={`of ${maxTvs}`}
            />
          )}

          {/* Microphones */}
          {maxMics > 0 && (
            <Stepper
              label={t("logistics_microphones")}
              value={mics}
              min={0}
              max={maxMics}
              onChange={setMics}
              suffix={`of ${maxMics}`}
            />
          )}

          {/* Toggles */}
          <div className="space-y-2">
            {hasProjector && (
              <Toggle label={t("logistics_projector")} checked={projector} onChange={setProjector} />
            )}
            {hasWifi && (
              <Toggle label={t("logistics_wifi")} checked={wifi} onChange={setWifi} />
            )}
            {hasCatering && (
              <Toggle label={t("logistics_catering")} checked={catering} onChange={setCatering} />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {t("logistics_notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("logistics_notes_ph")}
              rows={3}
              className="input w-full resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="btn-outline flex-none">
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex flex-1 items-center justify-center gap-2"
          >
            {saving ? (
              <span className="animate-pulse-soft">{t("loading")}</span>
            ) : (
              <>
                <IconCheck className="h-4 w-4" />
                {isEditing ? t("logistics_update") : t("logistics_save")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
