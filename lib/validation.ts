import type { ExtractedBooking } from "./types";

export const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TIME_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Approved domains for outsider/email bookings.
export const APPROVED_DOMAINS = ["qstp.qa", "company.qa"];
export const APPROVED_OUTSIDER_EMAILS = ["vendor@external-company.com"];

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isApprovedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return (
    APPROVED_DOMAINS.includes(domain) ||
    APPROVED_OUTSIDER_EMAILS.includes(email.toLowerCase())
  );
}

export interface ValidationError {
  field: string;
  reason: string;
}

export function validateExtractedBooking(b: ExtractedBooking): ValidationError | null {
  if (!Number.isFinite(b.capacity) || b.capacity < 1 || b.capacity > 500) {
    return { field: "capacity", reason: "Capacity must be between 1 and 500" };
  }
  if (!DATE_RE.test(b.preferred_date)) {
    return { field: "preferred_date", reason: "Invalid date format (YYYY-MM-DD)" };
  }
  const reqDate = new Date(`${b.preferred_date}T${b.preferred_time || "00:00"}:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(b.preferred_date) < today) {
    return { field: "preferred_date", reason: "Booking date cannot be in the past" };
  }
  if (!TIME_RE.test(b.preferred_time)) {
    return { field: "preferred_time", reason: "Invalid time format. Use HH:MM (24-hour)" };
  }
  if (b.duration_minutes < 30 || b.duration_minutes > 480) {
    return {
      field: "duration_minutes",
      reason: "Duration must be between 30 minutes and 8 hours",
    };
  }
  void reqDate;
  return null;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
