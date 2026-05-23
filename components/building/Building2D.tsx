"use client";

import { STATUS_COLORS, HIGHLIGHT_COLOR, type BuildingFloor, type BuildingRoom } from "./types";

interface Props {
  floor: BuildingFloor;
  highlightRoomIds?: string[];
  activeRoomId?: string | null;
  onSelectRoom?: (room: BuildingRoom | null) => void;
}

// Top-down SVG floor plan fallback for devices without WebGL.
export default function Building2D({
  floor,
  highlightRoomIds = [],
  activeRoomId = null,
  onSelectRoom = () => {},
}: Props) {
  const highlight = new Set(highlightRoomIds);
  const PAD = 6;
  const SCALE = 14;

  // Compute bounds from room footprints (centered coords).
  const xs = floor.rooms.flatMap((r) => [
    r.coordinates_3d.x - r.dimensions.width_m / 2,
    r.coordinates_3d.x + r.dimensions.width_m / 2,
  ]);
  const zs = floor.rooms.flatMap((r) => [
    r.coordinates_3d.z - r.dimensions.length_m / 2,
    r.coordinates_3d.z + r.dimensions.length_m / 2,
  ]);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 0);
  const minZ = Math.min(...zs, 0);
  const maxZ = Math.max(...zs, 0);
  const width = (maxX - minX) * SCALE + PAD * 2;
  const height = (maxZ - minZ) * SCALE + PAD * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      onClick={() => onSelectRoom(null)}
    >
      <rect width={width} height={height} className="fill-slate-100 dark:fill-slate-800" />
      {floor.rooms.map((r) => {
        const rx = (r.coordinates_3d.x - r.dimensions.width_m / 2 - minX) * SCALE + PAD;
        const ry = (r.coordinates_3d.z - r.dimensions.length_m / 2 - minZ) * SCALE + PAD;
        const rw = r.dimensions.width_m * SCALE;
        const rh = r.dimensions.length_m * SCALE;
        const isHi = highlight.has(r.id);
        const fill = isHi ? HIGHLIGHT_COLOR : STATUS_COLORS[r.availability_status];
        const active = activeRoomId === r.id;
        return (
          <g
            key={r.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectRoom(r);
            }}
            className="cursor-pointer"
          >
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              rx={3}
              fill={fill}
              fillOpacity={active || isHi ? 0.95 : 0.7}
              stroke={active || isHi ? "#fff" : "#0f172a"}
              strokeWidth={active || isHi ? 2 : 1}
            />
            <text
              x={rx + rw / 2}
              y={ry + rh / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-white"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              {r.name.length > 14 ? r.name.slice(0, 12) + "…" : r.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
