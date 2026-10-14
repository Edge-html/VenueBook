"use client";

import { CalendarPlus, CheckCircle2, Dumbbell, MonitorPlay, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PhasePill, InUseBanner } from "@/components/phase-pill";
import { useAuth } from "@/lib/auth-context";
import { canMarkCompleted, bookingPhase } from "@/lib/booking-phase";
import { FACILITY_BY_ID } from "@/lib/constants";
import {
  bookingsQueryForUser,
  cancelBooking,
  markBookingCompleted,
  parseBookingDoc,
} from "@/lib/data";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatTimeRange } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { useLiveQuery } from "@/lib/use-live-query";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

type Filter = "all" | "upcoming" | "past";

export function ReservationsList() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live: an admin approval, decline or cancellation lands here immediately.
  const live = useLiveQuery({
    cacheKey: `reservations:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [bookingsQueryForUser(user.uid)] : []),
  });

  const bookings = useMemo(() => (live.docs ?? []).map(parseBookingDoc), [live.docs]);
  const loading = live.loading;
  const loadError = live.error;

  async function handleCancel(booking: Booking) {
    if (!user) return;

    setBusyId(booking.id);
    setError(null);

    try {
      // No local patch needed: the live listener pushes the new status back.
      await cancelBooking(booking.id);
    } catch {
      setError("Could not cancel that reservation. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(booking: Booking) {
    if (!user) return;

    setBusyId(booking.id);
    setError(null);

    try {
      await markBookingCompleted(booking.id);
    } catch {
      setError("Could not close out that reservation. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const today = todayKey();
  const filtered = (bookings ?? []).filter((booking) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return booking.date >= today;
    return booking.date < today;
  });

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">
            My Reservations
          </h1>
          <p className="mt-1.5 text-ink-600">
            Every request you have sent, and where it stands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/book" className="btn btn-primary">
            <CalendarPlus className="h-4 w-4" />
            New booking
          </Link>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm text-booked">
          {error}
        </p>
      )}

      {loadError && (
        <p className="mb-4 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm text-booked">
          {loadError}
        </p>
      )}

      <div className="mb-5 inline-flex rounded-md border border-ink-300 bg-white p-1">
        {(["upcoming", "past", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
              filter === value ? "bg-brand-700 text-white" : "text-ink-700 hover:bg-ink-100"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-ink-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold text-brand-900">
            Nothing here yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">
            {filter === "upcoming"
              ? "You have no upcoming reservations. Book the gym or AVR to get started."
              : filter === "past"
                ? "You have no past reservations on record."
                : "You have not sent any reservation requests yet."}
          </p>
          <Link href="/book" className="btn btn-primary mt-5">
            Book a facility
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((booking) => (
            <ReservationCard
              key={booking.id}
              booking={booking}
              onCancel={() => handleCancel(booking)}
              onComplete={() => handleComplete(booking)}
              cancelling={busyId === booking.id}
              userId={user?.uid ?? ""}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReservationCard({
  booking,
  onCancel,
  onComplete,
  cancelling,
  userId,
}: {
  booking: Booking;
  onCancel: () => void;
  onComplete: () => void;
  cancelling: boolean;
  userId: string;
}) {
  const facility = FACILITY_BY_ID[booking.facilityId];
  const Icon = ICONS[booking.facilityId];
  const range = formatTimeRange(booking.startTime, booking.endTime);

  const now = new Date();
  const phase = bookingPhase(booking, now);

  const canCancel =
    (booking.status === "pending" || booking.status === "approved") &&
    booking.date >= todayKey();
  const canComplete = canMarkCompleted(booking, userId, now);

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brand-700 text-white">
          <Icon className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink-900">
              {facility?.name ?? booking.facilityId}
            </h2>
            <PhasePill phase={phase} />
          </div>

          <p className="mt-1 text-sm text-ink-700">
            {formatLongDate(booking.date)} &middot; {range}
          </p>

          {phase === "in_use" && <InUseBanner booking={booking} />}

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-ink-500">Booked by</dt>
              <dd className="font-medium text-ink-800">
                {booking.fullName} &middot; Grade {booking.grade}-{booking.section}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Purpose</dt>
              <dd className="font-medium text-ink-800">{booking.purpose}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Attendees</dt>
              <dd className="font-medium text-ink-800">{booking.attendees}</dd>
            </div>
            {booking.adminNote && (
              <div className="flex gap-2">
                <dt className="text-ink-500">Admin note</dt>
                <dd className="font-medium text-ink-800">{booking.adminNote}</dd>
              </div>
            )}
          </dl>

          {booking.notes && (
            <p className="mt-2 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-700">
              {booking.notes}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {canComplete && (
            <button
              type="button"
              onClick={onComplete}
              disabled={cancelling}
              className="btn btn-primary"
            >
              <CheckCircle2 className="h-4 w-4" />
              {cancelling ? "Saving…" : "Done using venue"}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="btn btn-outline text-booked"
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}