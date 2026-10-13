import type { FacilityId } from "./types";

export const APP_NAME = "VenueBook";
export const SCHOOL_NAME = "Koronadal National Comprehensive High School";

export interface Facility {
  id: FacilityId;
  name: string;
  shortName: string;
  capacity: string;
  description: string;
  /** Real photo to try first. */
  image: string;
  /** Always-present fallback, so the page never requests a missing file. */
  placeholder: string;
  /** Tailwind text colour for the facility glyph. */
  tone: string;
}

export const FACILITIES: Facility[] = [
  {
    id: "gymnasium",
    name: "KNCHS Gymnasium",
    shortName: "Gymnasium",
    capacity: "500+",
    description: "Sports, school activities, and events.",
    image: "/images/gymnasium.jpg",
    placeholder: "/images/placeholders/gymnasium.svg",
    tone: "text-maroon-700",
  },
  {
    id: "avr",
    name: "KNCHS AVR",
    shortName: "AVR",
    capacity: "50–100",
    description: "Meetings, seminars, and presentations.",
    image: "/images/avr.jpg",
    placeholder: "/images/placeholders/avr.svg",
    tone: "text-maroon-700",
  },
];

/** Landing page hero backdrop. */
export const HERO_IMAGE = {
  photo: "/images/knchs-building.jpg",
  placeholder: "/images/placeholders/building.svg",
};

export const FACILITY_BY_ID = Object.fromEntries(
  FACILITIES.map((f) => [f.id, f]),
) as Record<FacilityId, Facility>;

export interface TimeSlot {
  id: string;
  label: string;
  start: number;
  end: number;
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: "07-09", label: "7–9 AM", start: 7, end: 9 },
  { id: "09-11", label: "9–11 AM", start: 9, end: 11 },
  { id: "11-13", label: "11 AM–1 PM", start: 11, end: 13 },
  { id: "13-15", label: "1–3 PM", start: 13, end: 15 },
  { id: "15-17", label: "3–5 PM", start: 15, end: 17 },
  { id: "17-19", label: "5–7 PM", start: 17, end: 19 },
];

export const SLOT_BY_ID = Object.fromEntries(
  TIME_SLOTS.map((s) => [s.id, s]),
) as Record<string, TimeSlot>;

export const GRADES = ["7", "8", "9", "10", "11", "12"] as const;
export const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

/** How far ahead users are allowed to book. */
export const BOOKING_WINDOW_DAYS = 60;

/** Slots that must have started before a same-day booking is rejected. */
export const SAME_DAY_CUTOFF_HOUR = 7;

export const MAX_ID_PHOTO_BYTES = 5 * 1024 * 1024;