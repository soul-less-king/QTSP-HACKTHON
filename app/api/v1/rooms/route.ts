import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [rooms, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: [{ floorNumber: "asc" }, { name: "asc" }] }),
    prisma.booking.findMany({
      where: { bookingDate: date, status: "approved" },
      select: { roomId: true, startTime: true, endTime: true, eventTitle: true },
    }),
  ]);

  const bookingsByRoom = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const list = bookingsByRoom.get(b.roomId) ?? [];
    list.push(b);
    bookingsByRoom.set(b.roomId, list);
  }

  const mapped = rooms.map((r) => {
    const roomBookings = bookingsByRoom.get(r.id) ?? [];
    let status: "available" | "reserved" | "maintenance" = "available";
    if (r.status === "maintenance") status = "maintenance";
    else if (roomBookings.length > 0) status = "reserved";

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      capacity: r.capacity,
      floor_number: r.floorNumber,
      location_desc: r.locationDesc,
      coordinates_3d: r.coordinates3d,
      dimensions: r.dimensions,
      attributes: r.attributes,
      room_status: r.status,
      availability_status: status,
      bookings: roomBookings.map((b) => ({
        start_time: b.startTime,
        end_time: b.endTime,
        event_title: b.eventTitle,
      })),
    };
  });

  // Group into floors for the 3D building view.
  const floorNums = Array.from(new Set(mapped.map((r) => r.floor_number))).sort();
  const floors = floorNums.map((n) => ({
    floor_number: n,
    name: n === 1 ? "Ground Floor" : `Floor ${n}`,
    rooms: mapped.filter((r) => r.floor_number === n),
  }));

  return ok({
    date,
    building: { name: "QSTP Building A", floors },
    rooms: mapped,
  });
}
