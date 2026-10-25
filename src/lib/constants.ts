import type { FacilityId } from "./types";
import { formatHour12 } from "./time";

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
    tone: "text-brand-700",
  },
  {
    id: "avr",
    name: "KNCHS AVR",
    shortName: "AVR",
    capacity: "50–100",
    description: "Meetings, seminars, and presentations.",
    image: "/images/avr.jpg",
    placeholder: "/images/placeholders/avr.svg",
    tone: "text-brand-700",
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

/** Shown next to the live clock so the hours are never a surprise. */
export const OPENING_HOURS_LABEL = `Open ${formatHour12(OPENING_MINUTES / 60)} – ${formatHour12(CLOSING_MINUTES / 60)}`;

/** Smallest bookable duration. */
export const MIN_DURATION_MINUTES = 60;

/**
 * A booking must start strictly in the future, so a slot that has already
 * begun cannot be requested. Enforced in the UI and again by the rules.
 */
export const BOOKING_CUTOFF_MINUTES = 0;

/**
 * Once this many minutes have passed since the start of an approved booking,
 * an admin may release the slot as a no-show if the student never arrived.
 */
export const NO_SHOW_GRACE_MINUTES = 60;

/**
 * Fixed one-hour blocks used for the availability display and for admin
 * closures. A booking may still span any number of them — see `startTime` and
 * `endTime` on a booking.
 */
export interface TimeBlock {
  id: string;
  label: string;
  startMin: number;
  endMin: number;
}

const OPENING_HOUR = OPENING_MINUTES / 60;
const CLOSING_HOUR = CLOSING_MINUTES / 60;

export const TIME_BLOCKS: TimeBlock[] = Array.from(
  { length: CLOSING_HOUR - OPENING_HOUR },
  (_, index) => {
    const start = OPENING_HOUR + index;
    return {
      id: `${`${start}`.padStart(2, "0")}-${`${start + 1}`.padStart(2, "0")}`,
      // Label each one-hour block by its ending time. A 7 AM–12 PM booking
      // therefore marks through the 12 PM block; 1 PM is the next interval.
      label: formatHour12(start + 1),
      startMin: start * 60,
      endMin: (start + 1) * 60,
    };
  },
);

/** Back-compat alias while the UI still refers to blocks as slots. */
export const TIME_SLOTS = TIME_BLOCKS;

export const BLOCK_BY_ID = Object.fromEntries(
  TIME_BLOCKS.map((b) => [b.id, b]),
) as Record<string, TimeBlock>;

export const GRADES = ["7", "8", "9", "10", "11", "12"] as const;

/**
 * Section is typed freely by the student — single letters, "STEM 1", "Rizal"
 * and so on — so the cap only exists to stop a pasted paragraph. The value is
 * stored exactly as typed, apart from surrounding whitespace.
 */
export const SECTION_MAX_LENGTH = 40;

/** How far ahead users are allowed to book. */
export const BOOKING_WINDOW_DAYS = 60;

/** Slots that must have started before a same-day booking is rejected. */
export const SAME_DAY_CUTOFF_HOUR = 7;

/**
 * Firestore caps a document at 1 MiB, and a school ID photo only needs to be
 * legible to an admin, so this is kept comfortably inside that limit.
 */
export const MAX_ID_PHOTO_BYTES = 700 * 1024;
