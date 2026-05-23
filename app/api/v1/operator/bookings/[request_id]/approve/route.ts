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
    include: { roomSelections: { include: { room: true } } },
  });
  if (!request) return notFound("Booking request not found");
  if (request.status === "approved") return badRequest("Request already approved");
  if (!request.userId) {
    return badRequest("External requests must be assigned to a user before approval");
  }
  if (!request.bookingDate || !request.startTime || !request.endTime) {
    return badRequest("Request is missing schedule details");
  }

  // Determine rooms to approve: multi-room selections take priority over legacy single room.
  const hasMultiRoom = request.roomSelections.length > 0;
  const legacyRoomId = request.userSelectedRoomId || request.recommendedRoomId;

  if (!hasMultiRoom && !legacyRoomId) {
    return badRequest("No rooms are associated with this request");
  }

  try {
    const bookingIds = await prisma.$transaction(async (tx) => {
      const created: string[] = [];

      if (hasMultiRoom) {
        // Create one Booking per room selection with per-room logistics encoded in notes.
        for (const sel of request.roomSelections) {
          const logisticsSummary = [
            `Seats: ${sel.seatsSelected}`,
            sel.tvsSelected > 0 ? `TVs: ${sel.tvsSelected}` : null,
            sel.projectorNeeded ? "Projector needed" : null,
            sel.microphonesNeeded > 0 ? `Microphones: ${sel.microphonesNeeded}` : null,
            sel.wifiNeeded ? "WiFi needed" : null,
            sel.cateringNeeded ? "Catering needed" : null,
            sel.logisticsNotes || null,
          ]
            .filter(Boolean)
            .join(" | ");

          const booking = await tx.booking.create({
            data: {
              userId: request.userId!,
              roomId: sel.roomId,
              bookingDate: request.bookingDate!,
              startTime: request.startTime!,
              endTime: request.endTime!,
              capacityNeeded: sel.seatsSelected,
              eventTitle: request.eventTitle,
              eventType: (request.extractedJson as any)?.event_type ?? null,
              organizerName: request.organizerName,
              organizerPhone: request.organizerPhone,
              specialRequirements: logisticsSummary || request.specialRequirements,
              status: "approved",
              approvalNotes: body.operator_notes ?? null,
              cateringNotes: body.catering_notes ?? null,
              operatorId: session.id,
              approvedAt: new Date(),
            },
          });
          created.push(booking.id);
        }
      } else {
        // Legacy single-room path.
        const booking = await tx.booking.create({
          data: {
            userId: request.userId!,
            roomId: legacyRoomId!,
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
        created.push(booking.id);
      }

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
          changes: { booking_ids: created, rooms_count: created.length },
        },
      });

      await tx.notification.create({
        data: {
          userId: request.userId!,
          type: "booking_approved",
          title: "Your event booking was approved",
          message: `Your event on ${request.bookingDate} at ${request.startTime} (${created.length} room(s)) is confirmed.`,
          relatedBookingId: created[0],
        },
      });

      return created;
    });

    return ok({
      request_id: request.id,
      status: "approved",
      booking_ids: bookingIds,
      rooms_approved: bookingIds.length,
      approved_at: new Date(),
      approved_by: session.email,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError(409, "One or more rooms are already booked for the requested time slot.");
    }
    throw err;
  }
}
