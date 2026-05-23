import type { Coordinates3D, Dimensions, RoomAttributes } from "@/lib/types";

export interface BuildingRoom {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  floor_number: number;
  location_desc?: string | null;
  coordinates_3d: Coordinates3D;
  dimensions: Dimensions;
  attributes: RoomAttributes;
  availability_status: "available" | "reserved" | "maintenance";
  bookings?: { start_time: string; end_time: string; event_title?: string | null }[];
}

export interface BuildingFloor {
  floor_number: number;
  name: string;
  rooms: BuildingRoom[];
}

export const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  reserved: "#ef4444",
  maintenance: "#9ca3af",
};

export const HIGHLIGHT_COLOR = "#06b6d4";
