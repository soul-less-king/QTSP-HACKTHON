"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/Providers";
import { apiFetch } from "@/lib/client";
import { BuildingViewer } from "@/components/building/BuildingViewer";
import type { BuildingFloor } from "@/components/building/types";
import { IconBuilding } from "@/components/icons";

export default function BuildingPage() {
  const { t } = useI18n();
  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ building: { floors: BuildingFloor[] } }>(`/api/v1/rooms?date=${date}`)
      .then((data) => setFloors(data.building.floors))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <IconBuilding className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">QSTP Building A</h1>
            <p className="text-sm text-slate-500">{t("click_room_hint")}</p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <label className="text-sm text-slate-500">{t("select_date")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input w-auto"
          />
        </div>
      </div>

      {loading && floors.length === 0 ? (
        <div className="card flex h-[480px] items-center justify-center text-slate-400">
          <span className="animate-pulse-soft">{t("loading")}</span>
        </div>
      ) : (
        <BuildingViewer floors={floors} selectedDate={date} height="h-[560px]" />
      )}
    </div>
  );
}
