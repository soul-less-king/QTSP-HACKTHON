export type Language = "en" | "ar";

export type Role = "user" | "operator" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

/** Structured booking requirements extracted from natural language. */
export interface ExtractedBooking {
  capacity: number;
  duration_minutes: number;
  preferred_date: string; // YYYY-MM-DD
  preferred_time: string; // HH:MM (24h)
  mandatory_attributes: string[];
  important_attributes: string[];
  nice_to_have: string[];
  special_requirements: string;
  event_type: string;
  preferred_floor: number | null;
  accessibility_required: boolean;
}

export interface ExtractionResult {
  status: "extracted" | "error";
  extracted_json?: ExtractedBooking;
  confidence_score?: number;
  clarifying_questions?: string[];
  error_type?: "api_error" | "parse_error" | "unknown";
  message?: string;
  suggestion?: string;
}

export interface RoomAttributes {
  projector?: boolean;
  microphones?: number;
  wifi?: string | boolean;
  catering_kitchen?: boolean;
  parking_nearby?: boolean;
  accessibility?: boolean;
  natural_light?: boolean;
  sound_isolation?: string | boolean;
  outdoor_access?: boolean;
  av_equipment?: string | boolean;
}

export interface Coordinates3D {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width_m: number;
  length_m: number;
  height_m: number;
}

export interface RoomRecommendation {
  rank: number;
  room_id: string;
  room_name: string;
  room_floor: number;
  capacity: number;
  score: number;
  match_percentage: number;
  explanation: string;
  explanation_keys: string[];
  availability: {
    date: string;
    time: string;
    duration_minutes: number;
    next_booking: string | null;
  };
  attributes: RoomAttributes;
}

export interface AlternativeTime {
  date: string;
  time: string;
  available_rooms: number;
}
