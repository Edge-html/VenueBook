"use client";

import { CalendarDays, Dumbbell, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/lib/auth-context";
import { FACILITY_BY_ID } from "@/lib/constants";
import { bookingsQueryForUser, parseBookingDoc } from "@/lib/data";
import { formatShortDate, todayKey } from "@/lib/dates";
import { formatTimeRange } from "@/lib/time";
import { useLiveQuery } from "@/lib/use-live-query";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

export function DashboardOverview() {
  const { user } = useAuth();

  // Live: an approval moves a pending request into this list without a refresh.
  const live = useLiveQuery({
    cacheKey: `bookings:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [bookingsQueryForUser(user.uid)] : []),
  });

  const data = useMemo(() => (live.docs ?? []).map(parseBookingDoc), [live.docs]);
  const loading = live.loading;

  const today = todayKey();
  const upcoming = (data ?? [])
    .filter((b) => b.date >= today && (b.status === "approved" || b.status === "pending"))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
          <CalendarDays className="h-5 w-5 text-brand-600" />
          Upcoming reservations
        </h2>
        <Link href="/reservations" className="text-sm font-semibold text-brand-700 hover:underline">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-ink-200" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink-700">No upcoming reservations.</p>
          <Link href="/book" className="btn btn-outline mt-4">
            Book a facility
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((booking) => {
            const facility = FACILITY_BY_ID[booking.facilityId];
            const Icon = ICONS[booking.facilityId];
            const range = formatTimeRange(booking.startTime, booking.endTime);

            return (
              <li
                key={booking.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-ink-200 bg-ink-50 p-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {facility?.name ?? booking.facilityId}
                  </p>
                  <p className="text-xs text-ink-600">
                    {formatShortDate(booking.date)} &middot; {range}
                  </p>
                </div>

                <StatusPill status={booking.status} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}