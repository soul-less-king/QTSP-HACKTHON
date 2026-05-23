import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, hasRole } from "@/lib/auth";
import { ok, unauthorized, forbidden } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();
  if (!hasRole(session, "operator", "admin")) return forbidden();

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const pendingWhere: Prisma.BookingRequestWhereInput = {
    status: { in: ["pending_approval", "submitted_to_operator"] },
  };

  const [pendingCount, pending, todayBookings, maintenanceRooms] = await Promise.all([
    prisma.bookingRequest.count({ where: pendingWhere }),
    prisma.bookingRequest.findMany({
      where: pendingWhere,
      orderBy: { submittedToOperatorAt: "desc" },
      take: 5,
      include: { user: { select: { email: true, fullName: true } } },
    }),
    prisma.booking.findMany({
      where: { bookingDate: today, status: "approved" },
      orderBy: { startTime: "asc" },
      include: { room: { select: { name: true } } },
    }),
    prisma.room.findMany({
      where: { status: "maintenance" },
      select: { id: true, name: true, lastMaintenance: true, maintenanceFrequencyDays: true },
    }),
  ]);

  const roomIds = pending
    .map((p) => p.userSelectedRoomId || p.recommendedRoomId)
    .filter(Boolean) as string[];
  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    select: { id: true, name: true },
  });
  const roomMap = new Map(rooms.map((r) => [r.id, r.name]));

  return ok({
    pending_approvals_count: pendingCount,
    pending_approvals: pending.map((p) => {
      const eventAt = p.bookingDate
        ? new Date(`${p.bookingDate}T${p.startTime || "00:00"}:00`).getTime()
        : null;
      const roomId = p.userSelectedRoomId || p.recommendedRoomId;
      return {
        request_id: p.id,
        user_name: p.user?.fullName ?? p.organizerName ?? "External",
        user_email: p.user?.email ?? p.emailFrom,
        room_recommended: roomId ? roomMap.get(roomId) ?? null : null,
        match_score: p.matchScore,
        submitted_at: p.submittedToOperatorAt,
        priority: eventAt && eventAt - now < 1000 * 60 * 60 * 24 ? "high" : "normal",
      };
    }),
    today_bookings: todayBookings.map((b) => ({
      booking_id: b.id,
      room_name: b.room.name,
      organizer: b.organizerName,
      time: b.startTime,
      end_time: b.endTime,
      status: "scheduled",
    })),
    maintenance_schedule: maintenanceRooms.map((r) => {
      const next = r.lastMaintenance
        ? new Date(
            r.lastMaintenance.getTime() +
              r.maintenanceFrequencyDays * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .slice(0, 10)
        : null;
      return {
        room_id: r.id,
        room_name: r.name,
        maintenance_date: next,
        maintenance_notes: "Scheduled preventive maintenance",
      };
    }),
  });
}
