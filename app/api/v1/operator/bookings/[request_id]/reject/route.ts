import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, hasRole } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { request_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();
  if (!hasRole(session, "operator", "admin")) return forbidden();

  let body: { rejection_reason?: string; operator_notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body optional
  }

  if (!body.rejection_reason) {
    return badRequest("rejection_reason is required", { field: "rejection_reason" });
  }

  const request = await prisma.bookingRequest.findUnique({
    where: { id: params.request_id },
  });
  if (!request) return notFound("Booking request not found");

  const updated = await prisma.bookingRequest.update({
    where: { id: request.id },
    data: {
      status: "rejected",
      rejectionReason: body.rejection_reason,
      operatorNotes: body.operator_notes ?? null,
      operatorId: session.id,
      rejectedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.id,
      action: "booking_rejected",
      resourceType: "booking_request",
      resourceId: request.id,
      changes: { reason: body.rejection_reason },
    },
  });

  if (request.userId) {
    await prisma.notification.create({
      data: {
        userId: request.userId,
        type: "booking_rejected",
        title: "Your booking was not approved",
        message: body.rejection_reason,
      },
    });
  }

  return ok({
    request_id: updated.id,
    status: "rejected",
    rejected_at: updated.rejectedAt,
    rejected_by: session.email,
  });
}
