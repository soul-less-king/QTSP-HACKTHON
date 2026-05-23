import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, notFound } from "@/lib/api";

export const dynamic = "force-dynamic";

const OPEN_HOUR = 8;
const CLOSE_HOUR = 19;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const room = await prisma.room.findUnique({
    where: { id: params.room_id },
    select: { id: true, name: true },
  });
  if (!room) return notFound("Room not found");

  const bookings = await prisma.booking.findMany({
    where: { roomId: params.room_id, bookingDate: date, status: "approved" },
    select: { startTime: true, endTime: true },
  });

  const slots: Array<{
    time: string;
    available: boolean;
    duration_available_minutes: number;
    ends_at?: string;
  }> = [];

  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    const time = `${String(h).padStart(2, "0")}:00`;
    const slotStart = h * 60;
    const slotEnd = slotStart + 60;
    const conflict = bookings.find(
      (b) => toMinutes(b.startTime) < slotEnd && slotStart < toMinutes(b.endTime)
    );

    if (conflict) {
      slots.push({
        time,
        available: false,
        duration_available_minutes: 0,
        ends_at: conflict.endTime,
      });
    } else {
      // Minutes free until the next booking starts.
      const nextBooking = bookings
        .map((b) => toMinutes(b.startTime))
        .filter((s) => s >= slotEnd)
        .sort((a, b) => a - b)[0];
      const freeUntil = nextBooking ?? CLOSE_HOUR * 60;
      slots.push({
        time,
        available: true,
        duration_available_minutes: freeUntil - slotStart,
      });
    }
  }

  return ok({ room_id: room.id, room_name: room.name, date, slots });
}
