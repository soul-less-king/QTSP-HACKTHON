import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest, notFound } from "@/lib/api";
import { addMinutesToTime } from "@/lib/validation";
import type { ExtractedBooking, RoomRecommendation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: {
    request_id?: string;
    selected_room_id?: string;
    special_requirements?: string;
    organizer_name?: string;
    organizer_phone?: string;
    attendee_count?: number;
    event_title?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  if (!body.request_id || !body.selected_room_id) {
    return badRequest("request_id and selected_room_id are required");
  }

  const request = await prisma.bookingRequest.findUnique({
    where: { id: body.request_id },
  });
  if (!request) return notFound("Booking request not found");

  const room = await prisma.room.findUnique({ where: { id: body.selected_room_id } });
  if (!room) return notFound("Selected room not found");

  const extracted = request.extractedJson as unknown as ExtractedBooking;
  const startTime = extracted.preferred_time;
  const endTime = addMinutesToTime(startTime, extracted.duration_minutes);

  // Pull the match score for the selected room from stored recommendations.
  const recs = (request.recommendedRooms as unknown as RoomRecommendation[]) || [];
  const matchScore =
    recs.find((r) => r.room_id === body.selected_room_id)?.match_percentage ?? null;

  const updated = await prisma.bookingRequest.update({
    where: { id: request.id },
    data: {
      userSelectedRoomId: body.selected_room_id,
      recommendedRoomId: body.selected_room_id,
      bookingDate: extracted.preferred_date,
      startTime,
      endTime,
      capacityNeeded: body.attendee_count ?? extracted.capacity,
      eventTitle: body.event_title ?? null,
      organizerName: body.organizer_name ?? session.fullName,
      organizerPhone: body.organizer_phone ?? null,
      specialRequirements:
        body.special_requirements ?? extracted.special_requirements ?? null,
      matchScore: matchScore ?? null,
      status: "pending_approval",
      submittedToOperatorAt: new Date(),
    },
  });

  // Notify operators (in-app). Email side-effect would be wired here in prod.
  const operators = await prisma.user.findMany({
    where: { role: "operator", isActive: true },
    select: { id: true },
  });
  if (operators.length) {
    await prisma.notification.createMany({
      data: operators.map((op) => ({
        userId: op.id,
        type: "booking_pending",
        title: "New booking pending approval",
        message: `${updated.organizerName} requested ${room.name} on ${updated.bookingDate} at ${updated.startTime}.`,
      })),
    });
  }

  return ok({
    booking_request_id: updated.id,
    status: updated.status,
    room_id: room.id,
    room_name: room.name,
    requested_date: updated.bookingDate,
    requested_time: updated.startTime,
    submitted_at: updated.submittedToOperatorAt,
    operator_notes: null,
    next_step: "Awaiting operator approval (typically within 24 hours)",
  });
}
