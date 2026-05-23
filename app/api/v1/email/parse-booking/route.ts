import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, apiError, badRequest } from "@/lib/api";
import { extractBooking } from "@/lib/llm";
import { isApprovedDomain, addMinutesToTime } from "@/lib/validation";
import { buildRecommendations } from "@/lib/booking-service";
import type { ExtractedBooking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Optional webhook signature check (Postmark/SendGrid).
  const expected = process.env.POSTMARK_TOKEN;
  if (expected) {
    const token = req.headers.get("x-postmark-token");
    if (token !== expected) return apiError(401, "Invalid webhook signature");
  }

  let body: { from?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const from = (body.from || "").trim().toLowerCase();
  if (!from || !isApprovedDomain(from)) {
    return apiError(
      403,
      "Your email domain is not pre-approved. Contact support@qstp.qa"
    );
  }

  const text = `${body.subject || ""}\n${body.body || ""}`.trim();
  const result = await extractBooking(text, "en");

  if (result.status === "error" || !result.extracted_json) {
    // Flag for manual parsing.
    await prisma.bookingRequest.create({
      data: {
        emailFrom: from,
        requestType: "email",
        rawMessage: text,
        extractedJson: {},
        status: "pending_approval",
        operatorNotes: "REQUIRES_MANUAL_PARSING",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    return ok({
      status: "manual_review",
      message:
        "We could not automatically parse your request. Our team will review it manually.",
    });
  }

  const extracted = result.extracted_json as ExtractedBooking;
  const { recommendations } = await buildRecommendations(extracted);
  const top = recommendations[0];
  const endTime = addMinutesToTime(extracted.preferred_time, extracted.duration_minutes);

  const request = await prisma.bookingRequest.create({
    data: {
      emailFrom: from,
      requestType: "email",
      rawMessage: text,
      extractedJson: extracted as object,
      llmConfidenceScore: result.confidence_score ?? null,
      recommendedRooms: recommendations as unknown as object,
      recommendedRoomId: top?.room_id ?? null,
      userSelectedRoomId: top?.room_id ?? null,
      bookingDate: extracted.preferred_date,
      startTime: extracted.preferred_time,
      endTime,
      capacityNeeded: extracted.capacity,
      eventTitle: body.subject ?? null,
      organizerName: from,
      specialRequirements: extracted.special_requirements ?? null,
      matchScore: top?.match_percentage ?? null,
      status: "pending_approval",
      submittedToOperatorAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  return ok({
    request_id: request.id,
    status: "pending_approval",
    extracted_json: extracted,
    recommended_room: top?.room_name ?? null,
    message: `Booking request received. Confirmation email sent to ${from}`,
  });
}
