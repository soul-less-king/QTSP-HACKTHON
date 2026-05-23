import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface RoomSeed {
  name: string;
  description: string;
  capacity: number;
  floor: number;
  location: string;
  pos: { x: number; z: number };
  dims: { width_m: number; length_m: number; height_m: number };
  attributes: Record<string, string | number | boolean>;
  status?: "active" | "maintenance";
}

// 15 rooms across 3 floors. pos.x / pos.z lay out a floor plan grid.
const ROOMS: RoomSeed[] = [
  // ---- Floor 1 (Ground) ----
  {
    name: "Atrium Hall",
    description: "Large ground-floor hall with floor-to-ceiling glass and outdoor access.",
    capacity: 120,
    floor: 1,
    location: "Building A, Main Entrance",
    pos: { x: -8, z: -6 },
    dims: { width_m: 16, length_m: 20, height_m: 5 },
    attributes: {
      projector: true,
      microphones: 6,
      wifi: "5GHz",
      catering_kitchen: true,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: true,
      av_equipment: "Dual 4K projectors, line-array PA",
    },
  },
  {
    name: "Innovation Lab",
    description: "Flexible maker space with movable furniture and AV walls.",
    capacity: 40,
    floor: 1,
    location: "Building A, West Wing",
    pos: { x: 6, z: -6 },
    dims: { width_m: 10, length_m: 12, height_m: 4 },
    attributes: {
      projector: true,
      microphones: 2,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "medium",
      outdoor_access: false,
      av_equipment: "Interactive whiteboard, 75in display",
    },
  },
  {
    name: "Majlis Room",
    description: "Traditional-style reception room for guests and small gatherings.",
    capacity: 16,
    floor: 1,
    location: "Building A, East Wing",
    pos: { x: 6, z: 6 },
    dims: { width_m: 6, length_m: 8, height_m: 3.5 },
    attributes: {
      projector: false,
      microphones: 1,
      wifi: "5GHz",
      catering_kitchen: true,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: true,
      av_equipment: "65in display",
    },
  },
  {
    name: "Huddle 1A",
    description: "Compact huddle room for quick syncs.",
    capacity: 6,
    floor: 1,
    location: "Building A, Corridor 1",
    pos: { x: -8, z: 6 },
    dims: { width_m: 3, length_m: 4, height_m: 3 },
    attributes: {
      projector: false,
      microphones: 0,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: false,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "32in display",
    },
  },
  {
    name: "Cafe Meeting Nook",
    description: "Informal meeting spot beside the ground-floor cafe.",
    capacity: 10,
    floor: 1,
    location: "Building A, Cafe",
    pos: { x: -1, z: 0 },
    dims: { width_m: 5, length_m: 5, height_m: 3 },
    attributes: {
      projector: false,
      microphones: 0,
      wifi: "5GHz",
      catering_kitchen: true,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "low",
      outdoor_access: true,
      av_equipment: "",
    },
  },

  // ---- Floor 2 ----
  {
    name: "Conference A",
    description: "Premier conference room with floor-to-ceiling windows.",
    capacity: 50,
    floor: 2,
    location: "Building A, West Wing",
    pos: { x: -8, z: -6 },
    dims: { width_m: 10, length_m: 15, height_m: 3 },
    attributes: {
      projector: true,
      microphones: 4,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "4K display, Bluetooth speakers",
    },
  },
  {
    name: "Conference B",
    description: "Mid-size conference room with video-conferencing suite.",
    capacity: 30,
    floor: 2,
    location: "Building A, West Wing",
    pos: { x: 6, z: -6 },
    dims: { width_m: 8, length_m: 11, height_m: 3 },
    attributes: {
      projector: true,
      microphones: 3,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "Logitech Rally, 86in display",
    },
  },
  {
    name: "Training Room",
    description: "Classroom-style training room with breakout tables.",
    capacity: 35,
    floor: 2,
    location: "Building A, Central",
    pos: { x: -1, z: 0 },
    dims: { width_m: 9, length_m: 12, height_m: 3 },
    attributes: {
      projector: true,
      microphones: 2,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: false,
      sound_isolation: "medium",
      outdoor_access: false,
      av_equipment: "Dual projectors",
    },
    status: "maintenance",
  },
  {
    name: "Boardroom",
    description: "Executive boardroom with premium finishes.",
    capacity: 14,
    floor: 2,
    location: "Building A, East Wing",
    pos: { x: 6, z: 6 },
    dims: { width_m: 6, length_m: 9, height_m: 3 },
    attributes: {
      projector: false,
      microphones: 6,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "98in display, ceiling mics",
    },
  },
  {
    name: "Huddle 2A",
    description: "Quiet two-to-four person focus room.",
    capacity: 4,
    floor: 2,
    location: "Building A, Corridor 2",
    pos: { x: -8, z: 6 },
    dims: { width_m: 3, length_m: 3, height_m: 3 },
    attributes: {
      projector: false,
      microphones: 0,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: false,
      natural_light: false,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "27in display",
    },
  },

  // ---- Floor 3 ----
  {
    name: "Sky Auditorium",
    description: "Top-floor auditorium with panoramic views and tiered seating.",
    capacity: 90,
    floor: 3,
    location: "Building A, North",
    pos: { x: -8, z: -6 },
    dims: { width_m: 14, length_m: 18, height_m: 4.5 },
    attributes: {
      projector: true,
      microphones: 8,
      wifi: "5GHz",
      catering_kitchen: true,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "Cinema projector, 7.1 surround",
    },
  },
  {
    name: "Strategy Suite",
    description: "Workshop suite with writable walls and AV.",
    capacity: 24,
    floor: 3,
    location: "Building A, West",
    pos: { x: 6, z: -6 },
    dims: { width_m: 8, length_m: 10, height_m: 3 },
    attributes: {
      projector: true,
      microphones: 2,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "Dual 4K displays",
    },
  },
  {
    name: "Roof Terrace Room",
    description: "Indoor-outdoor event room opening onto the roof terrace.",
    capacity: 60,
    floor: 3,
    location: "Building A, Terrace",
    pos: { x: 6, z: 6 },
    dims: { width_m: 12, length_m: 14, height_m: 3.5 },
    attributes: {
      projector: true,
      microphones: 4,
      wifi: "5GHz",
      catering_kitchen: true,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "medium",
      outdoor_access: true,
      av_equipment: "Outdoor PA, 110in screen",
    },
  },
  {
    name: "Focus Pod 3A",
    description: "Single-team focus pod with natural light.",
    capacity: 8,
    floor: 3,
    location: "Building A, Corridor 3",
    pos: { x: -8, z: 6 },
    dims: { width_m: 4, length_m: 5, height_m: 3 },
    attributes: {
      projector: false,
      microphones: 0,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "good",
      outdoor_access: false,
      av_equipment: "55in display",
    },
  },
  {
    name: "Design Studio",
    description: "Creative studio with movable partitions.",
    capacity: 20,
    floor: 3,
    location: "Building A, Central",
    pos: { x: -1, z: 0 },
    dims: { width_m: 7, length_m: 9, height_m: 3 },
    attributes: {
      projector: true,
      microphones: 1,
      wifi: "5GHz",
      catering_kitchen: false,
      parking_nearby: true,
      accessibility: true,
      natural_light: true,
      sound_isolation: "medium",
      outdoor_access: false,
      av_equipment: "Interactive display",
    },
  },
];

async function main() {
  console.log("Seeding Axis database...");

  // Clear existing data (idempotent reseed).
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Passw0rd!", 12);

  const [user, operator, admin, sara, omar] = await Promise.all([
    prisma.user.create({
      data: {
        email: "user@qstp.qa",
        passwordHash,
        fullName: "Aisha Al-Kuwari",
        phone: "+974 5512 1001",
        role: "user",
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "operator@qstp.qa",
        passwordHash,
        fullName: "Khalid Al-Thani",
        phone: "+974 5512 2002",
        role: "operator",
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "admin@qstp.qa",
        passwordHash,
        fullName: "Noora Al-Sulaiti",
        phone: "+974 5512 3003",
        role: "admin",
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "sara@company.qa",
        passwordHash,
        fullName: "Sara Mahmoud",
        phone: "+974 5512 4004",
        role: "user",
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "omar@qstp.qa",
        passwordHash,
        fullName: "Omar Hassan",
        phone: "+974 5512 5005",
        role: "user",
        emailVerified: true,
      },
    }),
  ]);

  const rooms = await Promise.all(
    ROOMS.map((r) =>
      prisma.room.create({
        data: {
          name: r.name,
          description: r.description,
          capacity: r.capacity,
          floorNumber: r.floor,
          locationDesc: r.location,
          coordinates3d: { x: r.pos.x, y: r.floor, z: r.pos.z },
          dimensions: r.dims,
          attributes: r.attributes,
          status: r.status ?? "active",
          lastMaintenance: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
          maintenanceFrequencyDays: 90,
          imageUrl: null,
        },
      })
    )
  );

  const byName = (n: string) => rooms.find((r) => r.name === n)!;

  // Sample approved bookings to create realistic availability/conflicts.
  const bookingsData = [
    {
      room: "Conference A",
      user: sara,
      operator,
      date: dateOffset(1),
      start: "10:00",
      end: "11:30",
      cap: 40,
      title: "Partner Onboarding",
      type: "meeting",
    },
    {
      room: "Conference A",
      user: omar,
      operator,
      date: dateOffset(1),
      start: "14:00",
      end: "15:30",
      cap: 30,
      title: "Q2 Product Review",
      type: "meeting",
    },
    {
      room: "Sky Auditorium",
      user: user,
      operator,
      date: dateOffset(2),
      start: "09:00",
      end: "12:00",
      cap: 80,
      title: "All-Hands Town Hall",
      type: "conference",
    },
    {
      room: "Boardroom",
      user: omar,
      operator,
      date: dateOffset(1),
      start: "13:00",
      end: "14:00",
      cap: 12,
      title: "Board Sync",
      type: "meeting",
    },
    {
      room: "Roof Terrace Room",
      user: sara,
      operator,
      date: dateOffset(3),
      start: "17:00",
      end: "20:00",
      cap: 55,
      title: "Investor Reception",
      type: "conference",
    },
    {
      room: "Innovation Lab",
      user: user,
      operator,
      date: dateOffset(2),
      start: "10:00",
      end: "12:00",
      cap: 25,
      title: "Hackathon Kickoff",
      type: "workshop",
    },
  ];

  for (const b of bookingsData) {
    await prisma.booking.create({
      data: {
        userId: b.user.id,
        roomId: byName(b.room).id,
        bookingDate: b.date,
        startTime: b.start,
        endTime: b.end,
        capacityNeeded: b.cap,
        eventTitle: b.title,
        eventType: b.type,
        organizerName: b.user.fullName,
        organizerPhone: b.user.phone,
        status: "approved",
        operatorId: b.operator.id,
        approvedAt: new Date(),
        approvalNotes: "Approved.",
      },
    });
  }

  // A couple of pending booking requests for the operator dashboard demo.
  await prisma.bookingRequest.create({
    data: {
      userId: user.id,
      requestType: "chat",
      language: "en",
      rawMessage: "I need a room for 12 people tomorrow at 2 PM with a projector and WiFi",
      extractedJson: {
        capacity: 12,
        duration_minutes: 90,
        preferred_date: dateOffset(1),
        preferred_time: "16:00",
        mandatory_attributes: ["capacity", "projector"],
        important_attributes: ["wifi"],
        nice_to_have: ["natural_light"],
        special_requirements: "",
        event_type: "meeting",
        preferred_floor: null,
        accessibility_required: false,
      },
      llmConfidenceScore: 0.95,
      recommendedRoomId: byName("Conference B").id,
      userSelectedRoomId: byName("Conference B").id,
      bookingDate: dateOffset(1),
      startTime: "16:00",
      endTime: "17:30",
      capacityNeeded: 12,
      eventTitle: "Design Critique",
      organizerName: user.fullName,
      organizerPhone: user.phone,
      specialRequirements: "Need a flip chart.",
      matchScore: 92,
      status: "pending_approval",
      submittedToOperatorAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await prisma.bookingRequest.create({
    data: {
      emailFrom: "vendor@external-company.com",
      requestType: "email",
      language: "en",
      rawMessage:
        "Hi, we need a room for 30 people on the day after tomorrow at 2 PM for a vendor demo.",
      extractedJson: {
        capacity: 30,
        duration_minutes: 120,
        preferred_date: dateOffset(2),
        preferred_time: "14:00",
        mandatory_attributes: ["capacity"],
        important_attributes: ["projector", "wifi"],
        nice_to_have: [],
        special_requirements: "Vendor demo, needs HDMI.",
        event_type: "presentation",
        preferred_floor: null,
        accessibility_required: false,
      },
      llmConfidenceScore: 0.88,
      recommendedRoomId: byName("Conference B").id,
      userSelectedRoomId: byName("Conference B").id,
      bookingDate: dateOffset(2),
      startTime: "14:00",
      endTime: "16:00",
      capacityNeeded: 30,
      eventTitle: "Vendor Product Demo",
      organizerName: "External Vendor",
      specialRequirements: "Vendor demo, needs HDMI.",
      matchScore: 85,
      status: "pending_approval",
      submittedToOperatorAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  console.log(
    `Seeded ${rooms.length} rooms, 5 users, ${bookingsData.length} bookings, 2 pending requests.`
  );
  console.log("Demo logins (password: Passw0rd!):");
  console.log("  user@qstp.qa      (user)");
  console.log("  operator@qstp.qa  (operator)");
  console.log("  admin@qstp.qa     (admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
