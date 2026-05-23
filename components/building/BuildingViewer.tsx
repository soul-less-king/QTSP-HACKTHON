"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useI18n } from "@/components/Providers";
import { translateAttr } from "@/lib/i18n";
import { IconUsers, IconPin, IconX } from "@/components/icons";
import Building2D from "./Building2D";
import { STATUS_COLORS, type BuildingFloor, type BuildingRoom } from "./types";

const Building3DScene = dynamic(() => import("./Building3DScene"), {
  ssr: false,
  loading: () => <SceneLoading />,
});

function SceneLoading() {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
      <span className="animate-pulse-soft">{t("loading_3d")}</span>
    </div>
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

interface Props {
  floors: BuildingFloor[];
  highlightRoomIds?: string[];
  cartRoomIds?: string[];
  selectedDate?: string;
  onSelectRoom?: (room: BuildingRoom | null) => void;
  height?: string;
}

export function BuildingViewer({
  floors,
  highlightRoomIds = [],
  cartRoomIds = [],
  onSelectRoom,
  height = "h-[480px]",
}: Props) {
  const { t, lang } = useI18n();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [floorIdx, setFloorIdx] = useState(0);
  const [active, setActive] = useState<BuildingRoom | null>(null);

  useEffect(() => setWebgl(hasWebGL()), []);

  // When a highlighted or cart room exists, jump to its floor.
  useEffect(() => {
    const allHighlighted = [...highlightRoomIds, ...cartRoomIds];
    if (allHighlighted.length && floors.length) {
      const idx = floors.findIndex((f) =>
        f.rooms.some((r) => allHighlighted.includes(r.id))
      );
      if (idx >= 0) setFloorIdx(idx);
    }
  }, [highlightRoomIds, cartRoomIds, floors]);

  const floor = floors[floorIdx];

  const handleSelect = (room: BuildingRoom | null) => {
    setActive(room && room.id ? room : null);
    onSelectRoom?.(room && room.id ? room : null);
  };

  const legend = useMemo(
    () => [
      { key: "available", color: STATUS_COLORS.available },
      { key: "reserved", color: STATUS_COLORS.reserved },
      { key: "maintenance", color: STATUS_COLORS.maintenance },
      { key: "selected_status", color: STATUS_COLORS.selected },
    ],
    []
  );

  // Merge cartRoomIds into highlightRoomIds for the 3D/2D scene,
  // but pass them separately so the scene can colour them differently.
  const allHighlightIds = useMemo(
    () => [...new Set([...highlightRoomIds, ...cartRoomIds])],
    [highlightRoomIds, cartRoomIds]
  );

  if (!floor) {
    return (
      <div className={`card flex ${height} items-center justify-center text-slate-400`}>
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {floors.map((f, i) => (
            <button
              key={f.floor_number}
              onClick={() => setFloorIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                i === floorIdx
                  ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-3 text-xs text-slate-500">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: l.color }} />
              {t(l.key)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className={`card relative ${height} overflow-hidden`}>
          {webgl === null ? (
            <SceneLoading />
          ) : webgl ? (
            <Building3DScene
              floor={floor}
              highlightRoomIds={allHighlightIds}
              cartRoomIds={cartRoomIds}
              activeRoomId={active?.id ?? null}
              onSelectRoom={handleSelect}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {t("webgl_unavailable")}
              </div>
              <div className="flex-1">
                <Building2D
                  floor={floor}
                  highlightRoomIds={allHighlightIds}
                  cartRoomIds={cartRoomIds}
                  activeRoomId={active?.id ?? null}
                  onSelectRoom={handleSelect}
                />
              </div>
            </div>
          )}

          {/* Room details panel */}
          {active && (
            <div className="absolute bottom-3 end-3 start-3 z-10 animate-fade-in rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:start-auto sm:w-80">
              <button
                onClick={() => handleSelect(null)}
                className="absolute end-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-4 w-4" />
              </button>
              <h3 className="pe-6 font-semibold">{active.name}</h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <IconUsers className="h-3.5 w-3.5" /> {active.capacity}
                </span>
                <span className="flex items-center gap-1">
                  <IconPin className="h-3.5 w-3.5" /> {active.location_desc}
                </span>
                <span
                  className="badge"
                  style={{
                    background: STATUS_COLORS[active.availability_status] + "22",
                    color: STATUS_COLORS[active.availability_status],
                  }}
                >
                  {t(active.availability_status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(active.attributes)
                  .filter(([, v]) => v === true || (typeof v === "number" && v > 0))
                  .slice(0, 8)
                  .map(([k]) => (
                    <span
                      key={k}
                      className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {translateAttr(lang, k)}
                    </span>
                  ))}
              </div>
              {active.bookings && active.bookings.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">
                  {active.bookings.map((b, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{b.event_title || "Booked"}</span>
                      <span>
                        {b.start_time}–{b.end_time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">{t("click_room_hint")}</p>
    </div>
  );
}
