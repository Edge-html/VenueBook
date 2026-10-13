/**
 * Times are stored as 24-hour "HH:mm" strings and compared as minutes since
 * midnight, which keeps overlap maths trivial and avoids timezone drift.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** "09:30" → 570. Returns null for anything malformed. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** 570 → "09:30". */
export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

/** 7 → "7 AM", 12 → "12 PM", 13 → "1 PM" */
export function formatHour12(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

/** "09:00" for a 24-hour clock hour. */
export function hourLabel(hour: number): string {
  return `${`${hour}`.padStart(2, "0")}:00`;
}

/** Half-open overlap: touching ranges (end === start) do NOT overlap. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** 570 → "9:30 AM" */
export function formatClock(total: number): string {
  const normalized = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${displayHour} ${suffix}`
    : `${displayHour}:${`${minutes}`.padStart(2, "0")} ${suffix}`;
}

/** "09:00" + "12:00" → "9 AM – 12 PM" */
export function formatTimeRange(start: string, end: string): string {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);

  if (startMin === null || endMin === null) return `${start} – ${end}`;

  return `${formatClock(startMin)} – ${formatClock(endMin)}`;
}

/**
 * Shortens a range for dense displays, e.g. "9 AM – 12 PM" → "9–12 PM".
 */
export function formatTimeRangeCompact(start: string, end: string): string {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);

  if (startMin === null || endMin === null) return `${start}–${end}`;

  const startHour = Math.floor(startMin / 60);
  const endHour = Math.floor(endMin / 60);
  const suffix = endMin >= 12 * 60 ? "PM" : "AM";

  if (startMin % 60 === 0 && endMin % 60 === 0) {
    return `${startHour === 0 ? 12 : startHour}–${endHour % 12 === 0 ? 12 : endHour % 12} ${suffix}`;
  }

  return formatTimeRange(start, end);
}