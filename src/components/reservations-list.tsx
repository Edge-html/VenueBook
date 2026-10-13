"use client";

import { CalendarPlus, Dumbbell, MonitorPlay, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/lib/auth-context";
import { FACILITY_BY_ID } from "@/lib/constants";
import { cancelBooking, getBookingsForUser } from "@/lib/data";
import { formatLongDate, todayKey } from "@/lib/dates";
import { formatTimeRange } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

type Filter = "all" | "upcoming" | "past";

export function ReservationsList() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => (user ? getBookingsForUser(user.uid) : Promise.resolve<Booking[]>([])),
    [user],
  );

  const { data: bookings, loading, reload, setData } = useAsyncData<Booking[]>({
    cacheKey: `reservations:${user?.uid ?? "none"}`,
    load,
    fallback: [],
  });

  async function handleCancel(booking: Booking) {
    if (!user) return;

    setBusyId(booking.id);
    setError(null);

    try {
      await cancelBooking(booking.id);
      setData((current) =>
        current?.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b)) ?? null,
      );
    } catch {
      setError("Could not cancel that reservation. Please try again.");
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
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh reservations"
            className="grid h-10 w-10 place-items-center rounded-md border border-ink-300 bg-white text-brand-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
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
              cancelling={busyId === booking.id}
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
  cancelling,
}: {
  booking: Booking;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const facility = FACILITY_BY_ID[booking.facilityId];
  const Icon = ICONS[booking.facilityId];
  const range = formatTimeRange(booking.startTime, booking.endTime);

  const canCancel =
    (booking.status === "pending" || booking.status === "approved") &&
    booking.date >= todayKey();

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brand-700 text-white">
          <Icon className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink-900">
              {facility?.name ?? booking.facilityId}
            </h2>
            <StatusPill status={booking.status} size="sm" />
          </div>

          <p className="mt-1 text-sm text-ink-700">
            {formatLongDate(booking.date)} &middot; {range}
          </p>

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

        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="btn btn-ghost shrink-0 text-booked hover:bg-booked-soft"
          >
            <XCircle className="h-4 w-4" />
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}