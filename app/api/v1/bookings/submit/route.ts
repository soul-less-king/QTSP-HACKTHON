import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest, notFound } from "@/lib/api";
import { addMinutesToTime } from "@/lib/validation";
import type { ExtractedBooking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: {
    request_id?: string;
    special_requirements?: string;
    organizer_name?: string;
    organizer_phone?: string;
    attendee_count?: number;
    event_title?: string;
    // legacy single-room (still supported for backwards compat)
    selected_room_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  if (!body.request_id) return badRequest("request_id is required");

  const request = await prisma.bookingRequest.findUnique({
    where: { id: body.request_id },
    include: { roomSelections: { include: { room: true } } },
  });
  if (!request) return notFound("Booking request not found");

  const extracted = request.extractedJson as unknown as ExtractedBooking;
  const startTime = extracted.preferred_time;
  const endTime = addMinutesToTime(startTime, extracted.duration_minutes);

  // Determine which rooms are being submitted.
  // Priority: multi-room selections > legacy single selected_room_id.
  const hasMultiRoom = request.roomSelections.length > 0;
  const legacyRoomId = body.selected_room_id;

  if (!hasMultiRoom && !legacyRoomId) {
    return badRequest("At least one room must be selected before submitting.");
  }

  const roomNames = hasMultiRoom
    ? request.roomSelections.map((s) => s.room.name).join(", ")
    : legacyRoomId ?? "—";

  const updated = await prisma.bookingRequest.update({
    where: { id: request.id },
    data: {
      ...(legacyRoomId && !hasMultiRoom
        ? { userSelectedRoomId: legacyRoomId, recommendedRoomId: legacyRoomId }
        : {}),
      bookingDate: extracted.preferred_date,
      startTime,
      endTime,
      capacityNeeded: body.attendee_count ?? extracted.capacity,
      eventTitle: body.event_title ?? null,
      organizerName: body.organizer_name ?? session.fullName,
      organizerPhone: body.organizer_phone ?? null,
      specialRequirements:
        body.special_requirements ?? extracted.special_requirements ?? null,
      status: "pending_approval",
      submittedToOperatorAt: new Date(),
    },
  });

  // Notify all operators.
  const operators = await prisma.user.findMany({
    where: { role: "operator", isActive: true },
    select: { id: true },
  });
  if (operators.length) {
    await prisma.notification.createMany({
      data: operators.map((op) => ({
        userId: op.id,
        type: "booking_pending",
        title: "New event booking pending approval",
        message: `${updated.organizerName} requested ${hasMultiRoom ? `${request.roomSelections.length} room(s)` : roomNames} on ${updated.bookingDate} at ${updated.startTime}.`,
      })),
    });
  }

  return ok({
    booking_request_id: updated.id,
    status: updated.status,
    rooms_count: hasMultiRoom ? request.roomSelections.length : 1,
    room_names: roomNames,
    requested_date: updated.bookingDate,
    requested_time: updated.startTime,
    submitted_at: updated.submittedToOperatorAt,
    next_step: "Awaiting operator approval (typically within 24 hours)",
  });
}
