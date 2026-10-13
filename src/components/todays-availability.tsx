"use client";

import { CalendarDays, Clock, Dumbbell, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { FACILITIES, OPENING_HOURS_LABEL, TIME_BLOCKS } from "@/lib/constants";
import { getMonthAvailability } from "@/lib/data";
import { formatLongDate, todayKey } from "@/lib/dates";
import { describeLoadError } from "@/lib/load-errors";
import { useAsyncData } from "@/lib/use-async-data";
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
  // The page is statically prerendered, so "today" must not be baked into the
  // HTML — otherwise it goes stale and mismatches the client on any day after
  // the build.
  const mounted = useIsMounted();
  const { user, initialising } = useAuth();
  const date = mounted ? todayKey() : "";
  const now = useNow(mounted);

  const load = useCallback(async () => {
    // Availability is only readable when signed in; guests get a prompt
    // instead of a permission error.
    if (!date || !user) return {} as Record<string, Record<string, SlotState>>;

    const entries = await Promise.all(
      FACILITIES.map(async (facility) => {
        const snapshot = await getMonthAvailability(facility.id, [date]);
        return [facility.id, snapshot[date]] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, Record<string, SlotState>>;
  }, [date, user]);

  const { data, error, loading } = useAsyncData<Record<string, Record<string, SlotState>>>({
    cacheKey: `today:${date}:${user?.uid ?? "guest"}`,
    load,
    fallback: {},
  });

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* Date and time take the place of a static heading, so the panel
              always says which day and how late it is. */}
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <CalendarDays className="h-4 w-4 text-brand-700" />
            {date ? formatLongDate(date) : "Today"}
          </h2>
          {now && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
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

        <ul className="flex shrink-0 flex-wrap items-center gap-3 text-[11px] font-medium text-ink-600">
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

      <div className="space-y-5">
        {!initialising && !user ? (
          // Guests: bookings contain student details, so the schedule stays
          // behind sign-in. Offer the sign-in rather than a rules error.
          <div className="rounded-md border border-dashed border-ink-300 px-4 py-7 text-center">
            <p className="text-sm font-semibold text-ink-800">
              Sign in to see today&rsquo;s schedule
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
              Availability and booking details are kept private to the school.
            </p>
            <Link href="/signin" className="btn btn-primary mt-4">
              Sign In
            </Link>
          </div>
        ) : (
          FACILITIES.map((facility) => {
            const Icon = FACILITY_ICONS[facility.id];
            const daySlots = data?.[facility.id];

            if (error) {
              return (
                <div
                  key={facility.id}
                  className="flex items-center gap-2 rounded-md bg-ink-50 px-3 py-2.5"
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
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-700" />
                  <p className="text-sm font-semibold text-ink-800">{facility.name}</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                  {TIME_BLOCKS.map((slot) =>
                    daySlots ? (
                      <SlotChip key={slot.id} label={slot.label} state={daySlots[slot.id]} />
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
    </section>
  );
}