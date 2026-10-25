import type { Booking } from "@/lib/types";

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function downloadBookingInvite(booking: Booking, venueName: string): void {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KNCHS VenueBook//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(booking.id)}@venuebook.knchs`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${schoolLocalDateTimeUtc(booking.date, booking.startTime)}`,
    `DTEND:${schoolLocalDateTimeUtc(booking.date, booking.endTime)}`,
    `SUMMARY:${escapeIcs(`Venue booking: ${venueName}`)}`,
    `DESCRIPTION:${escapeIcs(`${booking.purpose} — ${booking.status}`)}`,
    `LOCATION:${escapeIcs(venueName)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `venuebook-${booking.date}-${booking.id}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The school's local wall clock is Asia/Manila (UTC+8, no daylight saving). */
function schoolLocalDateTimeUtc(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute)).toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function downloadBookingsCsv(bookings: Booking[], filename: string): void {
  const fields: (keyof Booking)[] = [
    "date", "startTime", "endTime", "facilityId", "status", "fullName",
    "grade", "section", "purpose", "attendees", "notes",
  ];
  const escape = (value: unknown) => {
    const raw = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [fields.map(escape).join(","), ...bookings.map((booking) => fields.map((field) => escape(booking[field])).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
