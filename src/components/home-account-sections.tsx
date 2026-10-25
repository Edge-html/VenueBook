"use client";

import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarSearch,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AdminConsole } from "@/components/admin-console";
import { useAuth } from "@/lib/auth-context";
import { bookingsQueryForUser, notificationsQueryForUser, parseBookingDoc } from "@/lib/data";
import { useLiveQuery } from "@/lib/use-live-query";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatTimeRange } from "@/lib/time";
import { FACILITY_BY_ID } from "@/lib/constants";
import { useFacilities } from "@/lib/use-facilities";

const ACTIONS = [
  {
    href: "/book",
    icon: CalendarCheck,
    title: "Book a Facility",
    description: "Reserve the gym or AVR for your activities, events, and special moments.",
  },
  {
    href: "/availability",
    icon: CalendarSearch,
    title: "Check Availability",
    description: "See the live calendar. Green is free, red is taken, amber is awaiting approval.",
  },
  {
    href: "/reservations",
    icon: ClipboardList,
    title: "My Reservations",
    description: "Follow every request you have sent, from pending to approved.",
  },
  {
    href: "/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Get told the moment an admin approves or declines your booking.",
  },
];

/**
 * The signed-in half of the home page.
 *
 * For an admin this *is* the home page — the console replaces the student
 * functions entirely, so opening Home drops you straight into approvals.
 * Students get their greeting, the four main functions, and upcoming
 * reservations. Visitors get nothing, so the landing page stays a plain
 * marketing page while signed out.
 */
export function HomeAccountSections() {
  const { user, initialising, isAdmin } = useAuth();

  if (initialising || !user) return null;

  if (isAdmin) {
    return (
      <div className="pt-8">
        <AdminConsole />
      </div>
    );
  }

  return <StudentSections />;
}

function StudentSections() {
  const facilities = useFacilities();
  const { user, profile } = useAuth();

  // Live: the pending/unread badges stay in step with the booking and
  // notification screens without the student having to reload.
  const bookingsLive = useLiveQuery({
    cacheKey: `counts-bookings:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [bookingsQueryForUser(user.uid)] : []),
  });

  const notificationsLive = useLiveQuery({
    cacheKey: `counts-notifications:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [notificationsQueryForUser(user.uid)] : []),
  });

  const pending = useMemo(
    () =>
      (bookingsLive.docs ?? []).filter((doc) => doc.data().status === "pending").length,
    [bookingsLive.docs],
  );

  const unread = useMemo(
    () =>
      (notificationsLive.docs ?? []).filter((doc) => !doc.data().read).length,
    [notificationsLive.docs],
  );

  const badges: Record<string, number> = {
    "/reservations": pending,
    "/notifications": unread,
  };
  const nextBooking = (bookingsLive.docs ?? []).map(parseBookingDoc).filter((booking) => booking.date >= todayKey() && (booking.status === "approved" || booking.status === "pending")).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];

  return (
    <div className="animate-fade-up mt-3 space-y-3">
      {profile?.verificationRequired && !profile.emailOtpVerified && <Link href="/verify-email" className="banner banner-warning block font-medium">Verify your email with the six-digit code to start booking →</Link>}
      <Link href="/reservations" className="card block p-4 hover:border-brand-300">
        <p className="eyebrow">My Booking</p>
        {nextBooking ? <><h2 className="mt-1 font-semibold text-ink-900">Scheduled Booking: {formatLongDate(nextBooking.date)}{nextBooking.date === todayKey() ? " · Today" : ""}</h2><p className="mt-1 text-sm text-ink-600">{facilities.find((facility) => facility.id === nextBooking.facilityId)?.name ?? FACILITY_BY_ID[nextBooking.facilityId]?.name} · {formatTimeRange(nextBooking.startTime, nextBooking.endTime)} · {nextBooking.status}</p><p className="mt-1 text-xs text-ink-500">{nextBooking.purpose} · {nextBooking.attendees} attendees</p></> : <p className="mt-1 text-sm text-ink-600">No upcoming booking. Open My Reservations to see your history.</p>}
      </Link>
      {pending > 0 && (
        <div className="banner banner-warning flex items-center gap-2 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          You have {pending} request{pending > 1 ? "s" : ""} waiting for review.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card group flex items-center gap-3 p-4 transition-colors hover:border-brand-300"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
              <Icon className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.015em] text-ink-900">
                {title}
                {badges[href] > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold text-white">
                    {badges[href]}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{description}</p>
            </div>

            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-brand-700" />
          </Link>
        ))}
      </section>
      <p className="text-center text-xs text-ink-500">How it works: Choose a venue → Pick a weekday and exact time → Send request → Track approval in My Booking.</p>
    </div>
  );
}
