import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest, notFound } from "@/lib/api";
import type { RoomAttributes } from "@/lib/types";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/bookings/[request_id]/rooms/[selection_id] — update logistics */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { request_id: string; selection_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: {
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

  const selection = await prisma.eventRoomSelection.findUnique({
    where: { id: params.selection_id },
    include: { room: true },
  });
  if (!selection || selection.bookingRequestId !== params.request_id) {
    return notFound("Selection not found");
  }

  const attrs = selection.room.attributes as RoomAttributes;
  const maxTvs = attrs.tv_screens ?? 0;
  const maxMics = typeof attrs.microphones === "number" ? attrs.microphones : 0;

  const updated = await prisma.eventRoomSelection.update({
    where: { id: params.selection_id },
    data: {
      seatsSelected: body.seats_selected ?? selection.seatsSelected,
      tvsSelected:
        body.tvs_selected !== undefined
          ? Math.min(body.tvs_selected, maxTvs)
          : selection.tvsSelected,
      projectorNeeded: body.projector_needed ?? selection.projectorNeeded,
      microphonesNeeded:
        body.microphones_needed !== undefined
          ? Math.min(body.microphones_needed, maxMics)
          : selection.microphonesNeeded,
      wifiNeeded: body.wifi_needed ?? selection.wifiNeeded,
      cateringNeeded: body.catering_needed ?? selection.cateringNeeded,
      logisticsNotes:
        body.logistics_notes !== undefined ? body.logistics_notes : selection.logisticsNotes,
    },
  });

  return ok({
    selection_id: updated.id,
    logistics: {
      seatsSelected: updated.seatsSelected,
      tvsSelected: updated.tvsSelected,
      projectorNeeded: updated.projectorNeeded,
      microphonesNeeded: updated.microphonesNeeded,
      wifiNeeded: updated.wifiNeeded,
      cateringNeeded: updated.cateringNeeded,
      logisticsNotes: updated.logisticsNotes ?? "",
    },
  });
}

/** DELETE /api/v1/bookings/[request_id]/rooms/[selection_id] — remove room from event */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { request_id: string; selection_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const selection = await prisma.eventRoomSelection.findUnique({
    where: { id: params.selection_id },
  });
  if (!selection || selection.bookingRequestId !== params.request_id) {
    return notFound("Selection not found");
  }

  await prisma.eventRoomSelection.delete({ where: { id: params.selection_id } });
  return ok({ deleted: true, selection_id: params.selection_id });
}
