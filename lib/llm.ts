import type { ExtractedBooking, ExtractionResult, Language } from "./types";

const SYSTEM_PROMPT = `You are a room-booking assistant for QSTP. Parse the user's natural-language request and extract structured booking requirements. Return ONLY valid JSON (no markdown, no code fences).

Required JSON fields:
- capacity: integer (minimum attendees)
- duration_minutes: integer
- preferred_date: "YYYY-MM-DD"
- preferred_time: "HH:MM" (24-hour)
- mandatory_attributes: string[] (always include "capacity"; add any hard requirements the user states)
- important_attributes: string[] chosen from [projector, microphones, wifi, catering_kitchen, parking_nearby, accessibility]
- nice_to_have: string[] chosen from [natural_light, sound_isolation, outdoor_access, av_equipment]
- special_requirements: string
- event_type: string
- preferred_floor: integer or null
- accessibility_required: boolean

If the user wrote in Arabic, still output English JSON. Resolve relative dates using today's date: {TODAY}.

Example output:
{"capacity": 15, "duration_minutes": 120, "preferred_date": "2025-05-27", "preferred_time": "14:00", "mandatory_attributes": ["capacity","projector"], "important_attributes": ["wifi"], "nice_to_have": [], "special_requirements": "", "event_type": "meeting", "preferred_floor": null, "accessibility_required": false}`;

const REQUIRED_FIELDS: (keyof ExtractedBooking)[] = [
  "capacity",
  "duration_minutes",
  "preferred_date",
  "preferred_time",
  "mandatory_attributes",
  "important_attributes",
  "nice_to_have",
  "event_type",
];

function stripCodeFences(content: string): string {
  let c = content.trim();
  const fence = c.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) c = fence[1].trim();
  // If extra prose surrounds the object, grab the outermost {...}.
  const first = c.indexOf("{");
  const last = c.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) c = c.slice(first, last + 1);
  return c.trim();
}

function normalizeExtraction(raw: any): ExtractedBooking {
  const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);
  const mandatory = arr(raw.mandatory_attributes);
  if (!mandatory.includes("capacity")) mandatory.unshift("capacity");
  return {
    capacity: Math.max(1, Math.round(Number(raw.capacity) || 1)),
    duration_minutes: Math.round(Number(raw.duration_minutes) || 60),
    preferred_date: String(raw.preferred_date || ""),
    preferred_time: String(raw.preferred_time || ""),
    mandatory_attributes: mandatory,
    important_attributes: arr(raw.important_attributes),
    nice_to_have: arr(raw.nice_to_have),
    special_requirements: String(raw.special_requirements || ""),
    event_type: String(raw.event_type || "meeting"),
    preferred_floor:
      raw.preferred_floor === null || raw.preferred_floor === undefined
        ? null
        : Number(raw.preferred_floor),
    accessibility_required: Boolean(raw.accessibility_required),
  };
}

export async function extractBooking(
  message: string,
  language: Language = "en"
): Promise<ExtractionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return mockExtract(message, language);
  }

  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";
  const today = new Date().toISOString().slice(0, 10);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.QSTP_DOMAIN || "https://qstp.qa",
        "X-Title": "Axis Event Management System",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT.replace("{TODAY}", today) },
          { role: "user", content: `User language: ${language}\n\n${message}` },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripCodeFences(content));
    const extracted = normalizeExtraction(parsed);

    for (const f of REQUIRED_FIELDS) {
      if (extracted[f] === undefined || extracted[f] === null || extracted[f] === "") {
        // Fill obvious gaps from the mock rather than failing outright.
        const mock = mockExtract(message, language);
        if (mock.extracted_json) {
          (extracted as any)[f] = mock.extracted_json[f];
        }
      }
    }

    return {
      status: "extracted",
      extracted_json: extracted,
      confidence_score: 0.95,
      clarifying_questions: [],
    };
  } catch (err) {
    // Graceful degradation: fall back to the deterministic parser so the demo
    // keeps working even if the LLM API is unavailable.
    const fallback = mockExtract(message, language);
    if (fallback.status === "extracted") {
      return { ...fallback, confidence_score: 0.7 };
    }
    return {
      status: "error",
      error_type: "api_error",
      message: "Service temporarily unavailable",
      suggestion:
        "Please try again, or rephrase like: 'I need 20 people for 2 hours on Tuesday at 2 PM with a projector'",
    };
  }
}

// ---------------------------------------------------------------------------
// Deterministic mock parser — keeps the demo fully functional with no API key.
// ---------------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  الأحد: 0,
  الاثنين: 1,
  الإثنين: 1,
  الثلاثاء: 2,
  الأربعاء: 3,
  الخميس: 4,
  الجمعة: 5,
  السبت: 6,
};

function nextWeekday(target: number): string {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function relativeDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function mockExtract(message: string, language: Language = "en"): ExtractionResult {
  const text = message.toLowerCase();

  // Capacity: "15 people", "for 20", Arabic "20 شخص"
  let capacity = 0;
  const capMatch =
    text.match(/(\d+)\s*(?:people|persons|attendees|pax|ppl|seats|شخص|أشخاص|اشخاص)/) ||
    text.match(/(?:for|capacity of|حجز لـ|لـ)\s*(\d+)/);
  if (capMatch) capacity = parseInt(capMatch[1], 10);

  // Duration: "2 hours", "90 minutes", Arabic "ساعتين/ساعة"
  let duration = 0;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b|ساعات?|ساعه)/);
  const minMatch = text.match(/(\d+)\s*(?:minutes?|mins?|m\b|دقيقة|دقائق)/);
  if (hourMatch) duration += Math.round(parseFloat(hourMatch[1]) * 60);
  if (minMatch) duration += parseInt(minMatch[1], 10);
  if (/\bساعتين\b/.test(text)) duration = 120;

  // Date
  let date = "";
  if (/\b(today|اليوم)\b/.test(text)) date = relativeDate(0);
  else if (/\b(tomorrow|غدا|بكرة|غداً)\b/.test(text)) date = relativeDate(1);
  else {
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) date = iso[1];
    else {
      for (const [name, idx] of Object.entries(WEEKDAYS)) {
        if (text.includes(name)) {
          date = nextWeekday(idx);
          break;
        }
      }
    }
  }

  // Time: "2 pm", "14:00", "at 9"
  let time = "";
  const tm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?/g);
  const explicit = text.match(/(\d{1,2}):(\d{2})/);
  if (explicit) {
    time = `${explicit[1].padStart(2, "0")}:${explicit[2]}`;
  } else {
    const ampm = text.match(/(\d{1,2})\s*(am|pm)/);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      if (ampm[2] === "pm" && h < 12) h += 12;
      if (ampm[2] === "am" && h === 12) h = 0;
      time = `${String(h).padStart(2, "0")}:00`;
    } else {
      const atMatch = text.match(/(?:at|الساعة)\s*(\d{1,2})/);
      if (atMatch) time = `${atMatch[1].padStart(2, "0")}:00`;
    }
  }

  // Attributes
  const important: string[] = [];
  const mandatory: string[] = ["capacity"];
  const nice: string[] = [];

  const has = (...words: string[]) => words.some((w) => text.includes(w));
  const must = /\b(must have|need|required|mandatory|يجب|لازم)\b/.test(text);

  if (has("projector", "بروجكتر", "عارض")) {
    important.push("projector");
    if (must) mandatory.push("projector");
  }
  if (has("wifi", "wi-fi", "internet", "واي فاي", "إنترنت")) important.push("wifi");
  if (has("microphone", "mic", "mics", "ميكروفون")) important.push("microphones");
  if (has("catering", "food", "kitchen", "طعام", "تموين")) important.push("catering_kitchen");
  if (has("parking", "park", "موقف", "مواقف")) important.push("parking_nearby");
  const accessibility = has("accessible", "accessibility", "wheelchair", "إعاقة", "كرسي متحرك");
  if (accessibility) important.push("accessibility");

  if (has("natural light", "window", "windows", "daylight", "إضاءة طبيعية", "نافذة"))
    nice.push("natural_light");
  if (has("quiet", "sound isolation", "soundproof", "عزل صوتي", "هادئة")) nice.push("sound_isolation");
  if (has("outdoor", "terrace", "balcony", "خارجي", "شرفة")) nice.push("outdoor_access");
  if (has("av", "screen", "display", "speakers", "شاشة", "سماعات")) nice.push("av_equipment");

  // Floor preference
  let floor: number | null = null;
  const floorMatch = text.match(/floor\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*floor|الطابق\s*(\d+)/);
  if (floorMatch) floor = parseInt(floorMatch[1] || floorMatch[2] || floorMatch[3], 10);

  // Event type
  let eventType = "meeting";
  if (has("training", "workshop", "تدريب", "ورشة")) eventType = "training";
  else if (has("conference", "summit", "مؤتمر")) eventType = "conference";
  else if (has("interview", "مقابلة")) eventType = "interview";
  else if (has("presentation", "demo", "عرض")) eventType = "presentation";

  // Confidence + clarifying questions for missing essentials.
  const clarifying: string[] = [];
  if (!capacity) clarifying.push("How many people will attend?");
  if (!date) clarifying.push("Which date do you need the room?");
  if (!time) clarifying.push("What time should it start?");

  const filled = [capacity, duration, date, time].filter(Boolean).length;
  const confidence = 0.55 + filled * 0.11; // 0.55 .. 0.99

  const extracted: ExtractedBooking = {
    capacity: capacity || 10,
    duration_minutes: duration || 60,
    preferred_date: date || relativeDate(1),
    preferred_time: time || "10:00",
    mandatory_attributes: mandatory,
    important_attributes: important,
    nice_to_have: nice,
    special_requirements: "",
    event_type: eventType,
    preferred_floor: floor,
    accessibility_required: accessibility,
  };

  return {
    status: "extracted",
    extracted_json: extracted,
    confidence_score: Math.min(0.99, Number(confidence.toFixed(2))),
    clarifying_questions: clarifying,
  };
}
