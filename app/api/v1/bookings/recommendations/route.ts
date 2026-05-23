import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest, notFound } from "@/lib/api";
import { buildRecommendations } from "@/lib/booking-service";
import { validateExtractedBooking } from "@/lib/validation";
import type { ExtractedBooking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: { request_id?: string; extracted_json?: ExtractedBooking };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  if (!body.request_id) return badRequest("request_id is required");

  const request = await prisma.bookingRequest.findUnique({
    where: { id: body.request_id },
  });
  if (!request) return notFound("Booking request not found");

  // Allow the user to tweak the extracted requirements before matching.
  const extracted = (body.extracted_json ??
    (request.extractedJson as unknown)) as ExtractedBooking;

  const validationError = validateExtractedBooking(extracted);
  if (validationError) {
    return badRequest(`Invalid ${validationError.field}: ${validationError.reason}`, {
      field: validationError.field,
      reason: validationError.reason,
    });
  }

  const { recommendations, alternative_times, no_matches_reason } =
    await buildRecommendations(extracted);

  await prisma.bookingRequest.update({
    where: { id: request.id },
    data: {
      extractedJson: extracted as object,
      recommendedRooms: recommendations as unknown as object,
      recommendedRoomId: recommendations[0]?.room_id ?? null,
    },
  });

  return ok({
    request_id: request.id,
    extracted_json: extracted,
    recommendations,
    no_matches_reason,
    alternative_times,
  });
}
