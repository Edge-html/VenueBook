"use client";

import { CalendarDays, Clock, Dumbbell, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { OPENING_HOURS_LABEL, TIME_BLOCKS } from "@/lib/constants";
import { useFacilities } from "@/lib/use-facilities";
import {
  blocksQueriesForDates,
  bookingsQueriesForDates,
  foldBlocksIntoSlots,
  parseBlockedSlotDoc,
  parseBookingDoc,
} from "@/lib/data";
import { formatLongDate, todayKey } from "@/lib/dates";
import { describeLoadError } from "@/lib/load-errors";
import { describeMinutes } from "@/lib/time";
import { useLiveQuery } from "@/lib/use-live-query";
import { useIsMounted } from "@/lib/use-is-mounted";
import { SlotChip } from "@/components/status-pill";
import type { FacilityId, SlotState } from "@/lib/types";

const FACILITY_ICONS: Record<FacilityId, typeof Dumbbell> = {
  gymnasium: Dumbbell,
  avr: MonitorPlay,
};

/** Ticks the clock so the panel never shows a stale time. */
function useNow(enabled: boolean): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 30_000);

    return () => clearInterval(timer);
  }, [enabled]);

  return now;
}

export function TodaysAvailability() {
  const facilities = useFacilities();
  const facilityKey = facilities.map((facility) => facility.id).join(",");
  // The page is statically prerendered, so "today" must not be baked into the
  // HTML — otherwise it goes stale and mismatches the client on any day after
  // the build.
  const mounted = useIsMounted();
  const { user, initialising } = useAuth();
  const date = mounted ? todayKey() : "";
  const now = useNow(mounted);
  const signedIn = Boolean(user);

  // Live: an approval, a closure or a no-show lands here without a refresh.
  const bookingLive = useLiveQuery({
    cacheKey: `today-bookings:${date}:${signedIn}:${facilityKey}`,
    enabled: signedIn && Boolean(date),
    deps: [date, facilityKey],
    buildQueries: () => facilities.flatMap((facility) => bookingsQueriesForDates(facility.id, [date])),
  });

  const blockLive = useLiveQuery({
    cacheKey: `today-blocks:${date}:${signedIn}:${facilityKey}`,
    enabled: signedIn && Boolean(date),
    deps: [date, facilityKey],
    buildQueries: () => facilities.flatMap((facility) => blocksQueriesForDates(facility.id, [date])),
  });

  const error = bookingLive.error ?? blockLive.error;
  const loading = bookingLive.loading || blockLive.loading;

  const slotsByFacility = useMemo(() => {
    const bookings = (bookingLive.docs ?? []).map(parseBookingDoc);
    const blocks = (blockLive.docs ?? []).map(parseBlockedSlotDoc);

    return Object.fromEntries(
      facilities.map((facility) => [
        facility.id,
        foldBlocksIntoSlots(
          bookings.filter((b) => b.facilityId === facility.id),
          blocks.filter((b) => b.facilityId === facility.id),
          date,
        ),
      ]),
    ) as Record<string, Record<string, SlotState>>;
  }, [bookingLive.docs, blockLive.docs, date, facilities]);

  return (
    <section className="card card-pad">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* Date and time take the place of a static heading, so the panel
              always says which day and how late it is. */}
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.015em] text-ink-900">
            <CalendarDays className="h-4 w-4 text-brand-700" />
            {date ? formatLongDate(date) : "Today"}
          </h2>
          {now && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-500">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {now.toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-ink-400">&middot;</span>
              <span className="text-xs text-ink-500">{OPENING_HOURS_LABEL}</span>
            </p>
          )}
        </div>

        <ul className="flex shrink-0 flex-wrap items-center gap-3 text-[11px] font-medium text-ink-500">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-available" />
            Available
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-booked" />
            Booked
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-pending" />
            Pending
          </li>
        </ul>
      </div>

      <div className="space-y-6">
        {!initialising && !user ? (
          // Guests: bookings contain student details, so the schedule stays
          // behind sign-in. Offer the sign-in rather than a rules error.
          <div className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-800">
              Sign in to see today&rsquo;s schedule
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
              Availability and booking details are kept private to the school.
            </p>
            <Link href="/signin" className="btn btn-primary mt-5">
              Sign In
            </Link>
          </div>
        ) : (
          facilities.map((facility) => {
            const Icon = FACILITY_ICONS[facility.id] ?? Dumbbell;
            const daySlots = slotsByFacility[facility.id];

            if (error) {
              return (
                <div
                  key={facility.id}
                  className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2.5"
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-400" />
                  <p className="text-xs text-ink-600">
                    {describeLoadError(new Error(error), "Schedule unavailable.")}
                  </p>
                </div>
              );
            }

            return (
              <div key={facility.id}>
                <div className="mb-2.5 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-700" />
                  <p className="text-sm font-semibold tracking-[-0.015em] text-ink-800">
                    {facility.name}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {TIME_BLOCKS.map((slot) =>
                    daySlots ? (
                      <SlotChip key={slot.id} label={slot.label} state={daySlots[slot.id]} title={describeMinutes(slot.startMin, slot.endMin)} />
                    ) : (
                      <div
                        key={slot.id}
                        className={`h-9 rounded-md bg-ink-100 ${
                          loading || !mounted ? "animate-pulse" : ""
                        }`}
                        aria-hidden="true"
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="mt-3 text-xs text-ink-500">A booking includes its ending hour. A 7 AM–12 PM booking marks 7 AM through 12 PM; 1 PM is next available.</p>
    </section>
  );
}
