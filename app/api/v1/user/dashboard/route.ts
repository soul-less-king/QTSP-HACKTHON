import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const today = new Date().toISOString().slice(0, 10);

  const [bookings, pendingRequests, user] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.id },
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      include: { room: { select: { name: true, floorNumber: true, capacity: true } } },
    }),
    prisma.bookingRequest.findMany({
      where: {
        userId: session.id,
        status: { in: ["pending_approval", "submitted_to_operator", "rejected"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, fullName: true },
    }),
  ]);

  const upcoming = bookings.filter(
    (b) => b.bookingDate >= today && b.status === "approved"
  );
  const past = bookings.filter(
    (b) => b.bookingDate < today || b.status === "cancelled"
  );

  const total = bookings.length;
  const cancelled = bookings.filter((b) => b.status === "cancelled").length;
  const capacityUtil =
    bookings.length > 0
      ? bookings.reduce(
          (acc, b) => acc + b.capacityNeeded / Math.max(1, b.room.capacity),
          0
        ) / bookings.length
      : 0;

  const mapBooking = (b: (typeof bookings)[number]) => ({
    booking_id: b.id,
    room_name: b.room.name,
    room_floor: b.room.floorNumber,
    date: b.bookingDate,
    time: b.startTime,
    end_time: b.endTime,
    duration_minutes: toMinutes(b.endTime) - toMinutes(b.startTime),
    capacity: b.capacityNeeded,
    status: b.status,
    organizer_name: b.organizerName,
    event_title: b.eventTitle,
    special_requirements: b.specialRequirements,
    approval_notes: b.approvalNotes,
    can_cancel: b.status === "approved" && b.bookingDate >= today,
    can_modify: b.status === "approved" && b.bookingDate >= today,
  });

  return ok({
    user: { id: user?.id, email: user?.email, full_name: user?.fullName },
    upcoming_bookings: upcoming.map(mapBooking),
    past_bookings: past.map(mapBooking),
    pending_requests: pendingRequests.map((r) => ({
      request_id: r.id,
      event_title: r.eventTitle,
      date: r.bookingDate,
      time: r.startTime,
      status: r.status,
      rejection_reason: r.rejectionReason,
    })),
    statistics: {
      total_bookings: total,
      approval_rate: total ? Number(((total - cancelled) / total).toFixed(2)) : 0,
      cancellation_rate: total ? Number((cancelled / total).toFixed(2)) : 0,
      average_room_capacity_used: Number(capacityUtil.toFixed(2)),
    },
  });
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
