import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized, badRequest } from "@/lib/api";
import { extractBooking } from "@/lib/llm";
import type { Language } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  let body: { message?: string; language?: Language };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const message = (body.message || "").trim();
  const language: Language = body.language === "ar" ? "ar" : "en";
  if (!message) return badRequest("Message is required", { field: "message" });

  const result = await extractBooking(message, language);

  if (result.status === "error") {
    return ok(result);
  }

  // Persist as a draft booking request so the confirm/recommend step can reuse it.
  const request = await prisma.bookingRequest.create({
    data: {
      userId: session.id,
      requestType: "chat",
      language,
      rawMessage: message,
      extractedJson: result.extracted_json as object,
      llmConfidenceScore: result.confidence_score ?? null,
      status: "draft",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  return ok({
    request_id: request.id,
    status: "extracted",
    extracted_json: result.extracted_json,
    confidence_score: result.confidence_score,
    clarifying_questions: result.clarifying_questions ?? [],
  });
}
