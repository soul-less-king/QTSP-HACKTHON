import { prisma } from "./db";
import {
  findBestRooms,
  suggestAlternativeTimes,
  type MatchRoom,
  type MatchBooking,
} from "./matching";
import type {
  ExtractedBooking,
  RoomAttributes,
  RoomRecommendation,
  AlternativeTime,
} from "./types";

export async function loadMatchData(): Promise<{
  rooms: MatchRoom[];
  bookings: MatchBooking[];
}> {
  const [roomsRaw, bookingsRaw] = await Promise.all([
    prisma.room.findMany(),
    prisma.booking.findMany({ where: { status: "approved" } }),
  ]);

  const rooms: MatchRoom[] = roomsRaw.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    floorNumber: r.floorNumber,
    status: r.status,
    attributes: (r.attributes as RoomAttributes) ?? {},
  }));

  const bookings: MatchBooking[] = bookingsRaw.map((b) => ({
    roomId: b.roomId,
    bookingDate: b.bookingDate,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));

  return { rooms, bookings };
}

export async function buildRecommendations(extracted: ExtractedBooking): Promise<{
  recommendations: RoomRecommendation[];
  alternative_times: AlternativeTime[];
  no_matches_reason: string | null;
}> {
  const { rooms, bookings } = await loadMatchData();
  const recommendations = findBestRooms(extracted, rooms, bookings, 3);

  if (recommendations.length === 0) {
    const alternatives = suggestAlternativeTimes(extracted, rooms, bookings);
    const altText =
      alternatives.length > 0
        ? ` Closest options: ${alternatives
            .map((a) => `${a.available_rooms} room(s) on ${a.date} at ${a.time}`)
            .join(", ")}.`
        : "";
    return {
      recommendations: [],
      alternative_times: alternatives,
      no_matches_reason: `No rooms available for ${extracted.capacity} people on ${extracted.preferred_date} at ${extracted.preferred_time}.${altText}`,
    };
  }

  return { recommendations, alternative_times: [], no_matches_reason: null };
}
