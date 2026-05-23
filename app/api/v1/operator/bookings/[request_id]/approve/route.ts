import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, hasRole } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, apiError, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { request_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();
  if (!hasRole(session, "operator", "admin")) return forbidden();

  let body: { operator_notes?: string; catering_notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body optional
  }

  const request = await prisma.bookingRequest.findUnique({
    where: { id: params.request_id },
  });
  if (!request) return notFound("Booking request not found");
  if (request.status === "approved") return badRequest("Request already approved");

  const roomId = request.userSelectedRoomId || request.recommendedRoomId;
  if (!roomId || !request.bookingDate || !request.startTime || !request.endTime) {
    return badRequest("Request is missing room or schedule details");
  }
  if (!request.userId) {
    return badRequest("External requests must be assigned to a user before approval");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          userId: request.userId!,
          roomId,
          bookingDate: request.bookingDate!,
          startTime: request.startTime!,
          endTime: request.endTime!,
          capacityNeeded: request.capacityNeeded ?? 1,
          eventTitle: request.eventTitle,
          eventType: (request.extractedJson as any)?.event_type ?? null,
          organizerName: request.organizerName,
          organizerPhone: request.organizerPhone,
          specialRequirements: request.specialRequirements,
          status: "approved",
          approvalNotes: body.operator_notes ?? null,
          cateringNotes: body.catering_notes ?? null,
          operatorId: session.id,
          approvedAt: new Date(),
        },
      });

      await tx.bookingRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          operatorId: session.id,
          operatorNotes: body.operator_notes ?? null,
          cateringNotes: body.catering_notes ?? null,
          approvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.id,
          action: "booking_approved",
          resourceType: "booking_request",
          resourceId: request.id,
          changes: { booking_id: booking.id, room_id: roomId },
        },
      });

      await tx.notification.create({
        data: {
          userId: request.userId!,
          type: "booking_approved",
          title: "Your booking was approved",
          message: `Booking for ${request.bookingDate} at ${request.startTime} is confirmed.`,
          relatedBookingId: booking.id,
        },
      });

      return booking;
    });

    return ok({
      request_id: request.id,
      status: "approved",
      booking_id: result.id,
      room_id: roomId,
      approved_at: result.approvedAt,
      approved_by: session.email,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError(409, "That room is already booked for the requested time slot.");
    }
    throw err;
  }
}
