import { NO_SHOW_GRACE_MINUTES } from "./constants";
import { atTime } from "./dates";
import { toMinutes } from "./time";
import type { Booking, BookingPhase } from "./types";

/**
 * Works out where a booking stands from its status and the current clock,
 * rather than from anything stored. That keeps "in use now" honest without
 * needing a background job to flip a flag.
 */
export function bookingPhase(booking: Booking, now: Date = new Date()): BookingPhase {
  if (booking.status === "completed") return "completed";
  if (booking.status === "no_show") return "no_show";
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "rejected") return "rejected";

  const start = atTime(booking.date, booking.startTime);
  const end = atTime(booking.date, booking.endTime);
  if (!start || !end) return "upcoming";

  if (booking.status === "pending") {
    return now.getTime() >= end.getTime() ? "over" : "pending";
  }

  // approved
  if (now.getTime() < start.getTime()) return "upcoming";
  if (now.getTime() < end.getTime()) return "in_use";
  return "over";
}

export const PHASE_LABELS: Record<BookingPhase, string> = {
  upcoming: "Upcoming",
  pending: "Awaiting approval",
  in_use: "In use now",
  over: "Finished",
  completed: "Completed",
  no_show: "No show",
  cancelled: "Cancelled",
  rejected: "Declined",
};

/**
 * An approved booking can be released as a no-show once it is underway and
 * the grace period has passed without being closed out.
 */
export function isNoShowEligible(booking: Booking, now: Date = new Date()): boolean {
  if (booking.status !== "approved") return false;

  const start = atTime(booking.date, booking.startTime);
  if (!start) return false;

  return now.getTime() >= start.getTime() + NO_SHOW_GRACE_MINUTES * 60_000;
}

/**
 * The student can close out their own booking once it has started; waiting
 * until the slot ends would be pointless.
 */
export function canMarkCompleted(booking: Booking, userId: string, now: Date = new Date()): boolean {
  if (booking.userId !== userId) return false;
  if (booking.status !== "approved") return false;

  const start = atTime(booking.date, booking.startTime);
  const end = atTime(booking.date, booking.endTime);
  if (!start || !end) return false;

  return now.getTime() >= start.getTime();
}

/** True when the window has already begun, so it can no longer be booked. */
export function hasStarted(booking: Booking, now: Date = new Date()): boolean {
  const start = atTime(booking.date, booking.startTime);
  return start ? now.getTime() >= start.getTime() : false;
}

/**
 * Earliest bookable clock time on `date`, accounting for a booking made
 * earlier the same day. Dates in the past return null.
 */
export function earliestBookableMinutes(dateKey: string, now: Date = new Date()): number | null {
  const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;

  if (dateKey < today) return null;
  if (dateKey > today) return 0;

  const minutes = now.getHours() * 60 + now.getMinutes();
  // Round up to the next quarter hour so the picker always offers a future slot.
  const rounded = Math.ceil((minutes + 15) / 15) * 15;
  return rounded >= 24 * 60 ? null : rounded;
}

/** Minutes from midnight for a `HH:mm` string, or null. */
export function minutesOf(time: string): number | null {
  return toMinutes(time);
}