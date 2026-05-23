import { findBestRooms, isAvailable, suggestAlternativeTimes } from "../lib/matching";
import type { ExtractedBooking } from "../lib/types";

const rooms = [
  { id: "a", name: "Conf A", capacity: 50, floorNumber: 2, status: "active", attributes: { projector: true, wifi: "5GHz", microphones: 4, natural_light: true } },
  { id: "b", name: "Conf B", capacity: 30, floorNumber: 2, status: "active", attributes: { projector: true, wifi: "5GHz", natural_light: true } },
  { id: "c", name: "Huddle", capacity: 6, floorNumber: 1, status: "active", attributes: { wifi: "5GHz" } },
  { id: "d", name: "Maint", capacity: 40, floorNumber: 2, status: "maintenance", attributes: { projector: true } },
];

const bookings = [
  { roomId: "a", bookingDate: "2026-06-01", startTime: "14:00", endTime: "15:30", status: "approved" },
];

const req: ExtractedBooking = {
  capacity: 25,
  duration_minutes: 120,
  preferred_date: "2026-06-01",
  preferred_time: "14:00",
  mandatory_attributes: ["capacity", "projector"],
  important_attributes: ["wifi"],
  nice_to_have: ["natural_light"],
  special_requirements: "",
  event_type: "meeting",
  preferred_floor: 2,
  accessibility_required: false,
};

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}

console.log("Matching algorithm tests");
const recs = findBestRooms(req, rooms as any, bookings, 3);
check("excludes maintenance room", !recs.some((r) => r.room_id === "d"));
check("excludes too-small room (capacity)", !recs.some((r) => r.room_id === "c"));
check("excludes conflicting room A (booked 14:00-15:30)", !recs.some((r) => r.room_id === "a"));
check("returns Conf B as best available match", recs[0]?.room_id === "b");
check("ranks assigned starting at 1", recs[0]?.rank === 1);
check("match percentage within 0-100", recs.every((r) => r.match_percentage >= 0 && r.match_percentage <= 100));

const avail = isAvailable("a", "2026-06-01", "14:00", 60, bookings);
check("room A unavailable at 14:00", avail.available === false);
const avail2 = isAvailable("a", "2026-06-01", "16:00", 60, bookings);
check("room A available at 16:00", avail2.available === true);

const noFit: ExtractedBooking = { ...req, capacity: 999 };
const empty = findBestRooms(noFit, rooms as any, bookings, 3);
check("no rooms for impossible capacity", empty.length === 0);
const alts = suggestAlternativeTimes({ ...req, capacity: 25 }, rooms as any, bookings);
check("suggests alternative times array", Array.isArray(alts));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
