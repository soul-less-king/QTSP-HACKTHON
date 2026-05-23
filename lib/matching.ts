import type {
  ExtractedBooking,
  RoomAttributes,
  RoomRecommendation,
  AlternativeTime,
} from "./types";

export interface MatchRoom {
  id: string;
  name: string;
  capacity: number;
  floorNumber: number;
  status: string;
  attributes: RoomAttributes;
}

export interface MatchBooking {
  roomId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: string;
}

// Maps from (possibly loose) attribute names to canonical room attribute keys.
const IMPORTANT_MAP: Record<string, keyof RoomAttributes> = {
  projector: "projector",
  microphones: "microphones",
  mics: "microphones",
  wifi: "wifi",
  catering: "catering_kitchen",
  catering_kitchen: "catering_kitchen",
  parking: "parking_nearby",
  parking_nearby: "parking_nearby",
  accessibility: "accessibility",
};

const NICE_MAP: Record<string, keyof RoomAttributes> = {
  light: "natural_light",
  natural_light: "natural_light",
  sound_isolation: "sound_isolation",
  outdoor: "outdoor_access",
  outdoor_access: "outdoor_access",
  av: "av_equipment",
  av_equipment: "av_equipment",
};

const ALL_ATTR_MAP: Record<string, keyof RoomAttributes> = {
  ...IMPORTANT_MAP,
  ...NICE_MAP,
};

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

function attrTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim().length > 0 && value !== "false";
  return false;
}

export function isAvailable(
  roomId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  bookings: MatchBooking[]
): { available: boolean; nextBooking: string | null } {
  const reqStart = timeToMinutes(startTime);
  const reqEnd = reqStart + durationMinutes;

  let available = true;
  let nextBooking: string | null = null;
  let nextBookingStart = Infinity;

  for (const b of bookings) {
    if (b.roomId !== roomId || b.status !== "approved" || b.bookingDate !== date) continue;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    if (rangesOverlap(reqStart, reqEnd, bStart, bEnd)) {
      available = false;
    }
    // Track the soonest booking that starts at/after our requested end time.
    if (bStart >= reqEnd && bStart < nextBookingStart) {
      nextBookingStart = bStart;
      nextBooking = b.startTime;
    }
  }

  return { available, nextBooking };
}

export interface ScoredRoom extends RoomRecommendation {}

export function findBestRooms(
  request: ExtractedBooking,
  rooms: MatchRoom[],
  bookings: MatchBooking[],
  maxResults = 3
): RoomRecommendation[] {
  // STEP 1 — filter mandatory criteria.
  const mandatoryAttrs = (request.mandatory_attributes || []).filter(
    (a) => a !== "capacity"
  );

  interface Candidate {
    room: MatchRoom;
    nextBooking: string | null;
  }
  const candidates: Candidate[] = [];

  for (const room of rooms) {
    if (room.status !== "active") continue;
    if (room.capacity < request.capacity) continue;

    // Mandatory attributes are deal-breakers.
    let missingMandatory = false;
    for (const attr of mandatoryAttrs) {
      const key = ALL_ATTR_MAP[attr] ?? (attr as keyof RoomAttributes);
      if (!attrTruthy(room.attributes[key])) {
        missingMandatory = true;
        break;
      }
    }
    if (missingMandatory) continue;

    const { available, nextBooking } = isAvailable(
      room.id,
      request.preferred_date,
      request.preferred_time,
      request.duration_minutes,
      bookings
    );
    if (!available) continue;

    candidates.push({ room, nextBooking });
  }

  if (candidates.length === 0) return [];

  // STEP 2 — score each candidate.
  const scored = candidates.map(({ room, nextBooking }) => {
    let score = 0;
    const explanationKeys: string[] = [];
    const details: string[] = [];

    const ratio = request.capacity / room.capacity;
    if (ratio >= 0.8) {
      score += 100;
      explanationKeys.push("capacity_perfect");
      details.push(`Perfect capacity fit (${request.capacity}/${room.capacity})`);
    } else if (ratio >= 0.6) {
      score += 70;
      explanationKeys.push("capacity_good");
      details.push(`Good capacity fit (${request.capacity}/${room.capacity})`);
    } else if (ratio >= 0.4) {
      score += 30;
      explanationKeys.push("capacity_acceptable");
      details.push(`Acceptable capacity (${request.capacity}/${room.capacity})`);
    } else {
      explanationKeys.push("capacity_buffer");
      details.push(`Large buffer capacity (${request.capacity}/${room.capacity})`);
    }

    // CRITICAL — mandatory attributes (100 pts each).
    for (const attr of mandatoryAttrs) {
      const key = ALL_ATTR_MAP[attr] ?? (attr as keyof RoomAttributes);
      if (attrTruthy(room.attributes[key])) {
        score += 100;
        explanationKeys.push(`mandatory:${key}`);
        details.push(`Has required ${key}`);
      }
    }

    // IMPORTANT attributes (50 pts each).
    for (const attr of request.important_attributes || []) {
      const key = IMPORTANT_MAP[attr];
      if (key && attrTruthy(room.attributes[key]) && !mandatoryAttrs.includes(attr)) {
        score += 50;
        explanationKeys.push(`important:${key}`);
        details.push(`Has ${key}`);
      }
    }

    // NICE-TO-HAVE attributes (15 pts each).
    for (const attr of request.nice_to_have || []) {
      const key = NICE_MAP[attr];
      if (key && attrTruthy(room.attributes[key])) {
        score += 15;
        explanationKeys.push(`nice:${key}`);
        details.push(`Has ${key}`);
      }
    }

    // Preferred floor bonus.
    if (request.preferred_floor && room.floorNumber === request.preferred_floor) {
      score += 25;
      explanationKeys.push("preferred_floor");
      details.push(`On preferred floor ${request.preferred_floor}`);
    }

    // Accessibility bonus.
    if (request.accessibility_required && attrTruthy(room.attributes.accessibility)) {
      score += 30;
      explanationKeys.push("accessibility");
      details.push("Accessibility available");
    }

    const matchPercentage = Math.min(100, Math.round((score / 300) * 100));

    const rec: RoomRecommendation = {
      rank: 0,
      room_id: room.id,
      room_name: room.name,
      room_floor: room.floorNumber,
      capacity: room.capacity,
      score,
      match_percentage: matchPercentage,
      explanation: details.join(" + "),
      explanation_keys: explanationKeys,
      availability: {
        date: request.preferred_date,
        time: request.preferred_time,
        duration_minutes: request.duration_minutes,
        next_booking: nextBooking,
      },
      attributes: room.attributes,
    };
    return rec;
  });

  // STEP 3 — sort (desc score, then smallest room as tie-break) and rank.
  scored.sort((a, b) => b.score - a.score || a.capacity - b.capacity);
  return scored.slice(0, maxResults).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Suggest alternative dates/times when no rooms match the requested slot. */
export function suggestAlternativeTimes(
  request: ExtractedBooking,
  rooms: MatchRoom[],
  bookings: MatchBooking[]
): AlternativeTime[] {
  const alternatives: AlternativeTime[] = [];
  const baseDate = new Date(`${request.preferred_date}T00:00:00`);
  const candidateTimes = ["09:00", "11:00", "13:00", "15:00"];

  for (let dayOffset = 0; dayOffset <= 3 && alternatives.length < 4; dayOffset++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toISOString().slice(0, 10);

    for (const time of candidateTimes) {
      if (dayOffset === 0 && time === request.preferred_time) continue;
      let count = 0;
      for (const room of rooms) {
        if (room.status !== "active" || room.capacity < request.capacity) continue;
        const { available } = isAvailable(
          room.id,
          dateStr,
          time,
          request.duration_minutes,
          bookings
        );
        if (available) count++;
      }
      if (count > 0) {
        alternatives.push({ date: dateStr, time, available_rooms: count });
        if (alternatives.length >= 4) break;
      }
    }
  }

  return alternatives;
}
