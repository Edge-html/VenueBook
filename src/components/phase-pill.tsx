"use client";

import { PHASE_LABELS } from "@/lib/booking-phase";
import type { Booking, BookingPhase } from "@/lib/types";

const PHASE_STYLES: Record<BookingPhase, string> = {
  upcoming: "bg-ink-100 text-ink-600",
  pending: "bg-pending-soft text-pending",
  in_use: "bg-brand-700 text-white",
  over: "bg-ink-100 text-ink-500",
  completed: "bg-available-soft text-available",
  no_show: "bg-booked-soft text-booked",
  cancelled: "bg-ink-100 text-ink-500",
  rejected: "bg-booked-soft text-booked",
};

export function PhasePill({
  phase,
  size = "sm",
}: {
  phase: BookingPhase;
  size?: "sm" | "md";
}) {
  const live = phase === "in_use";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        PHASE_STYLES[phase]
      } ${size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
    >
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {PHASE_LABELS[phase]}
    </span>
  );
}

/** Compact strip shown under a booking that is running right now. */
export function InUseBanner({ booking }: { booking: Booking }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-xs font-medium text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      The venue is in use right now
      {booking.endTime && <span className="opacity-80">&middot; until {booking.endTime}</span>}
    </div>
  );
}