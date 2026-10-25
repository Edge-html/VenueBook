/** Local-time date helpers. Everything is anchored to the school's timezone. */

/** `YYYY-MM-DD` for a Date, in local time (never UTC — that shifts the day). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatLongDate(key: string): string {
  return fromDateKey(key).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Combines a `YYYY-MM-DD` day with a `HH:mm` wall-clock time into a local
 * `Date`. Reading it back with `getFullYear`/`getHours` returns the same values,
 * which keeps the whole app anchored to the school's local time.
 */
export function atTime(dateKey: string, time: string): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!year || !month || !day || !timeMatch) return null;

  return new Date(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
}

/** Absolute instants for a booking window, for rules-enforced timestamps. */
export function bookingInstants(
  dateKey: string,
  startTime: string,
  endTime: string,
): { startAt: Date | null; endAt: Date | null } {
  return { startAt: atTime(dateKey, startTime), endAt: atTime(dateKey, endTime) };
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Six-week grid starting on Sunday, so weekday columns line up. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPastDay(key: string): boolean {
  return key < todayKey();
}

export interface SchoolCalendarSettings {
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  closedDates: string[];
  closedReasons: Record<string, string>;
}

/** Default for a fresh install; admins can edit this in the live app. */
export const DEFAULT_SCHOOL_CALENDAR: SchoolCalendarSettings = {
  schoolYearLabel: "School Year 2026–2027",
  startDate: "2026-06-08",
  endDate: "2027-04-08",
  closedDates: [
    "2026-06-12", "2026-08-21", "2026-08-31", "2026-11-02", "2026-11-30",
    "2026-12-08", "2026-12-19", "2026-12-20", "2026-12-21", "2026-12-22",
    "2026-12-23", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-27",
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01",
    "2027-01-02", "2027-01-03", "2027-03-25", "2027-03-26",
  ],
  closedReasons: {
  "2026-06-12": "Independence Day",
  "2026-08-21": "Ninoy Aquino Day",
  "2026-08-31": "National Heroes Day",
  "2026-11-02": "All Souls' Day",
  "2026-11-30": "Bonifacio Day",
  "2026-12-08": "Feast of the Immaculate Conception",
  "2026-12-24": "Christmas Eve",
  "2026-12-25": "Christmas Day",
  "2026-12-30": "Rizal Day",
  "2026-12-31": "Last Day of the Year",
  "2027-01-01": "New Year's Day",
  "2027-03-25": "Maundy Thursday",
  "2027-03-26": "Good Friday",
  },
};

export function schoolDayReason(
  key: string,
  calendar: SchoolCalendarSettings = DEFAULT_SCHOOL_CALENDAR,
): string | null {
  if (key < calendar.startDate || key > calendar.endDate) return `Outside ${calendar.schoolYearLabel}`;
  if (calendar.closedDates.includes(key)) return calendar.closedReasons[key] || "Closed by school calendar";
  const day = fromDateKey(key).getDay();
  if (day === 0 || day === 6) return "Weekend — bookings are for weekdays only";
  return null;
}
