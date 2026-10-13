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

/**
 * Opening hours, in minutes since midnight. Bookings may start and end
 * anywhere inside this window, to the minute.
 */
export const OPENING_MINUTES = 7 * 60; // 07:00
export const CLOSING_MINUTES = 19 * 60; // 19:00

/** Smallest bookable duration. */
export const MIN_DURATION_MINUTES = 60;

/**
 * Fixed blocks used only for the at-a-glance availability strip and for admin
 * closures. A booking may span any part of these — see `startTime`/`endTime`
 * on a booking.
 */
export interface TimeBlock {
  id: string;
  label: string;
  startMin: number;
  endMin: number;
}

export const TIME_BLOCKS: TimeBlock[] = [
  { id: "07-09", label: "7–9 AM", startMin: 7 * 60, endMin: 9 * 60 },
  { id: "09-11", label: "9–11 AM", startMin: 9 * 60, endMin: 11 * 60 },
  { id: "11-13", label: "11 AM–1 PM", startMin: 11 * 60, endMin: 13 * 60 },
  { id: "13-15", label: "1–3 PM", startMin: 13 * 60, endMin: 15 * 60 },
  { id: "15-17", label: "3–5 PM", startMin: 15 * 60, endMin: 17 * 60 },
  { id: "17-19", label: "5–7 PM", startMin: 17 * 60, endMin: 19 * 60 },
];

/** Back-compat alias while the UI still refers to blocks as slots. */
export const TIME_SLOTS = TIME_BLOCKS;

export const BLOCK_BY_ID = Object.fromEntries(
  TIME_BLOCKS.map((b) => [b.id, b]),
) as Record<string, TimeBlock>;

export const GRADES = ["7", "8", "9", "10", "11", "12"] as const;

/** Section is typed freely by the student, so there is no fixed list. */
export const SECTION_MAX_LENGTH = 4;

/** How far ahead users are allowed to book. */
export const BOOKING_WINDOW_DAYS = 60;

/** Slots that must have started before a same-day booking is rejected. */
export const SAME_DAY_CUTOFF_HOUR = 7;

export const MAX_ID_PHOTO_BYTES = 5 * 1024 * 1024;