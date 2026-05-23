import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, hasRole } from "@/lib/auth";
import { unauthorized, forbidden, paginated, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();
  if (!hasRole(session, "operator", "admin")) return forbidden();

  const url = new URL(req.url);
  const { page, limit } = parsePagination(url);

  const where: Prisma.BookingRequestWhereInput = {
    status: { in: ["pending_approval", "submitted_to_operator"] },
  };

  const [total, requests] = await Promise.all([
    prisma.bookingRequest.count({ where }),
    prisma.bookingRequest.findMany({
      where,
      orderBy: { submittedToOperatorAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, email: true, fullName: true } } },
    }),
  ]);

  const roomIds = Array.from(
    new Set(requests.map((r) => r.userSelectedRoomId || r.recommendedRoomId).filter(Boolean))
  ) as string[];
  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    select: { id: true, name: true, floorNumber: true },
  });
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // Per-user booking history for operator context.
  const userIds = Array.from(new Set(requests.map((r) => r.userId).filter(Boolean))) as string[];
  const histories = await Promise.all(
    userIds.map(async (uid) => {
      const [totalB, cancelled] = await Promise.all([
        prisma.booking.count({ where: { userId: uid } }),
        prisma.booking.count({ where: { userId: uid, status: "cancelled" } }),
      ]);
      return [
        uid,
        {
          total_bookings: totalB,
          cancellation_rate: totalB ? Number((cancelled / totalB).toFixed(3)) : 0,
          on_time_rate: 1.0,
        },
      ] as const;
    })
  );
  const historyMap = new Map(histories);

  const now = Date.now();
  const data = requests.map((r) => {
    const roomId = r.userSelectedRoomId || r.recommendedRoomId;
    const room = roomId ? roomMap.get(roomId) : null;
    const eventAt = r.bookingDate
      ? new Date(`${r.bookingDate}T${r.startTime || "00:00"}:00`).getTime()
      : null;
    const priority = eventAt && eventAt - now < 1000 * 60 * 60 * 24 ? "high" : "normal";

    return {
      request_id: r.id,
      user_email: r.user?.email ?? r.emailFrom,
      user_name: r.user?.fullName ?? r.organizerName ?? "External",
      request_type: r.requestType,
      room_id: roomId,
      room_name: room?.name ?? null,
      room_floor: room?.floorNumber ?? null,
      requested_date: r.bookingDate,
      requested_time: r.startTime,
      end_time: r.endTime,
      duration_minutes:
        r.startTime && r.endTime
          ? toMinutes(r.endTime) - toMinutes(r.startTime)
          : null,
      capacity_requested: r.capacityNeeded,
      special_requirements: r.specialRequirements,
      event_title: r.eventTitle,
      match_score: r.matchScore,
      priority,
      submitted_at: r.submittedToOperatorAt,
      user_history: r.userId ? historyMap.get(r.userId) ?? null : null,
    };
  });

  return paginated(data, total, { page, limit });
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
