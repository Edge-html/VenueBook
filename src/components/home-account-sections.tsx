"use client";

import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  MapPin,
  Send,
} from "lucide-react";
import Link from "next/link";
import { AdminConsole } from "@/components/admin-console";
import { useAuth } from "@/lib/auth-context";
import { bookingsQueryForUser, parseBookingDoc } from "@/lib/data";
import { useLiveQuery } from "@/lib/use-live-query";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatTimeRange } from "@/lib/time";
import { FACILITY_BY_ID } from "@/lib/constants";
import { useFacilities } from "@/lib/use-facilities";

const BOOKING_STEPS = [
  {
    href: "/book",
    icon: MapPin,
    number: "01",
    title: "Choose a venue",
    description: "Select the facility for your activity.",
  },
  {
    href: "/availability",
    icon: CalendarClock,
    number: "02",
    title: "Pick a date and time",
    description: "Choose an open weekday and schedule.",
  },
  {
    href: "/book",
    icon: Send,
    number: "03",
    title: "Send your request",
    description: "Add your event details and submit.",
  },
  {
    href: "/reservations",
    icon: ClipboardCheck,
    number: "04",
    title: "Track the decision",
    description: "Follow approval in My Reservations.",
  },
];

/**
 * The signed-in half of the home page.
 *
 * For an admin this *is* the home page — the console replaces the student
 * functions entirely, so opening Home drops you straight into approvals.
 * Students get their scheduled booking and booking process. Visitors get nothing, so the landing page stays a plain
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

  // Keep the next scheduled booking current without a page reload.
  const bookingsLive = useLiveQuery({
    cacheKey: `counts-bookings:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [bookingsQueryForUser(user.uid)] : []),
  });

  const nextBooking = (bookingsLive.docs ?? []).map(parseBookingDoc).filter((booking) => booking.date >= todayKey() && (booking.status === "approved" || booking.status === "pending")).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];

  return (
    <div className="animate-fade-up mt-3 space-y-3">
      {profile?.verificationRequired && !profile.emailOtpVerified && !user?.emailVerified && <Link href="/verify-email" className="banner banner-warning block font-medium">Verify your email from the link we sent to start booking →</Link>}
      <Link href="/reservations" className="card block border-brand-200 bg-gradient-to-r from-brand-50/70 to-white p-5 shadow-sm transition hover:border-brand-300">
        <p className="eyebrow">My Booking</p>
        {nextBooking ? <><p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Scheduled booking</p><div className="mt-1 flex flex-wrap items-center gap-2.5"><h2 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">{formatLongDate(nextBooking.date)}</h2>{nextBooking.date === todayKey() && <span className="rounded-full bg-brand-700 px-3 py-1 text-sm font-bold text-white shadow-sm">Today</span>}</div><p className="mt-2 text-sm font-medium text-ink-700">{facilities.find((facility) => facility.id === nextBooking.facilityId)?.name ?? FACILITY_BY_ID[nextBooking.facilityId]?.name} · {formatTimeRange(nextBooking.startTime, nextBooking.endTime)} · {nextBooking.status}</p><p className="mt-1 text-xs text-ink-500">{nextBooking.purpose} · {nextBooking.attendees} attendees</p></> : <p className="mt-1 text-sm text-ink-600">No upcoming booking. Open My Reservations to see your history.</p>}
      </Link>
      <section className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50/60 p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow text-brand-700">Student guide</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-ink-950 sm:text-xl">How facility booking works</h2>
          </div>
          <Link href="/book" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">Start a booking <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {BOOKING_STEPS.map(({ href, icon: Icon, number, title, description }) => (
            <li key={number}>
              <Link href={href} className="group flex h-full items-start gap-3 rounded-lg border border-brand-100 bg-white/90 p-3 transition hover:border-brand-300 hover:shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-[11px] font-bold tracking-widest text-brand-700">STEP {number}</span><span className="mt-0.5 block text-sm font-semibold text-ink-900 group-hover:text-brand-800">{title}</span><span className="mt-1 block text-xs leading-relaxed text-ink-500">{description}</span></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
