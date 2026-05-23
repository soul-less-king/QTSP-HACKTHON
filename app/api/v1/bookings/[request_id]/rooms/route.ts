import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest, notFound } from "@/lib/api";
import type { RoomAttributes } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/v1/bookings/[request_id]/rooms — list all room selections */
export async function GET(
  req: NextRequest,
  { params }: { params: { request_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const request = await prisma.bookingRequest.findUnique({
    where: { id: params.request_id },
    include: {
      roomSelections: {
        include: { room: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!request) return notFound("Booking request not found");

  const selections = request.roomSelections.map((s) => ({
    selection_id: s.id,
    room_id: s.roomId,
    room_name: s.room.name,
    room_floor: s.room.floorNumber,
    room_capacity: s.room.capacity,
    room_attributes: s.room.attributes as RoomAttributes,
    logistics: {
      seatsSelected: s.seatsSelected,
      tvsSelected: s.tvsSelected,
      projectorNeeded: s.projectorNeeded,
      microphonesNeeded: s.microphonesNeeded,
      wifiNeeded: s.wifiNeeded,
      cateringNeeded: s.cateringNeeded,
      logisticsNotes: s.logisticsNotes ?? "",
    },
  }));

  return ok({ selections, count: selections.length });
}

/** POST /api/v1/bookings/[request_id]/rooms — add a room to the event */
export async function POST(
  req: NextRequest,
  { params }: { params: { request_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: {
    room_id?: string;
    seats_selected?: number;
    tvs_selected?: number;
    projector_needed?: boolean;
    microphones_needed?: number;
    wifi_needed?: boolean;
    catering_needed?: boolean;
    logistics_notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  if (!body.room_id) return badRequest("room_id is required");

  const [request, room] = await Promise.all([
    prisma.bookingRequest.findUnique({ where: { id: params.request_id } }),
    prisma.room.findUnique({ where: { id: body.room_id } }),
  ]);

  if (!request) return notFound("Booking request not found");
  if (!room) return notFound("Room not found");
  if (room.status !== "active") return badRequest("Room is not available (maintenance)");

  const seatsSelected = body.seats_selected ?? 1;
  if (seatsSelected < 1 || seatsSelected > room.capacity) {
    return badRequest(`Seats must be between 1 and ${room.capacity}`);
  }

  const attrs = room.attributes as RoomAttributes;
  const maxTvs = attrs.tv_screens ?? 0;
  const tvsSelected = Math.min(body.tvs_selected ?? 0, maxTvs);
  const maxMics = typeof attrs.microphones === "number" ? attrs.microphones : 0;
  const microphonesNeeded = Math.min(body.microphones_needed ?? 0, maxMics);

  const selection = await prisma.eventRoomSelection.upsert({
    where: { bookingRequestId_roomId: { bookingRequestId: params.request_id, roomId: body.room_id } },
    create: {
      bookingRequestId: params.request_id,
      roomId: body.room_id,
      seatsSelected,
      tvsSelected,
      projectorNeeded: body.projector_needed ?? false,
      microphonesNeeded,
      wifiNeeded: body.wifi_needed ?? false,
      cateringNeeded: body.catering_needed ?? false,
      logisticsNotes: body.logistics_notes ?? null,
    },
    update: {
      seatsSelected,
      tvsSelected,
      projectorNeeded: body.projector_needed ?? false,
      microphonesNeeded,
      wifiNeeded: body.wifi_needed ?? false,
      cateringNeeded: body.catering_needed ?? false,
      logisticsNotes: body.logistics_notes ?? null,
    },
  });

  return ok({
    selection_id: selection.id,
    room_id: room.id,
    room_name: room.name,
    logistics: {
      seatsSelected: selection.seatsSelected,
      tvsSelected: selection.tvsSelected,
      projectorNeeded: selection.projectorNeeded,
      microphonesNeeded: selection.microphonesNeeded,
      wifiNeeded: selection.wifiNeeded,
      cateringNeeded: selection.cateringNeeded,
      logisticsNotes: selection.logisticsNotes ?? "",
    },
  });
}
