"use client";

import {
  CalendarRange,
  Check,
  Dumbbell,
  Loader2,
  MonitorPlay,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/lib/auth-context";
import {
  blockSlot,
  cancelBooking,
  getAllBookings,
  getBlocks,
  notifyUser,
  removeBooking,
  setBookingStatus,
  unblockSlot,
} from "@/lib/data";
import { formatLongDate, formatShortDate, todayKey } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, FACILITIES, FACILITY_BY_ID, SLOT_BY_ID, TIME_SLOTS } from "@/lib/constants";
import type { BlockedSlot, Booking, BookingStatus, FacilityId } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

type Tab = "requests" | "schedule";
type StatusFilter = "pending" | "approved" | "rejected" | "all";

export function AdminConsole() {
  const { profile, user } = useAuth();

  const [tab, setTab] = useState<Tab>("requests");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Schedule editor state.
  const [scheduleFacility, setScheduleFacility] = useState<FacilityId>("gymnasium");
  const [scheduleDate, setScheduleDate] = useState(todayKey());
  const [blockReason, setBlockReason] = useState("");

  const loadBookings = useCallback(() => getAllBookings(), []);
  const {
    data: bookingRows,
    loading: loadingBookings,
    reload: reloadBookings,
    setData: setBookings,
  } = useAsyncData<Booking[]>({ cacheKey: "all-bookings", load: loadBookings, fallback: [] });

  const loadBlocks = useCallback(
    () => getBlocks(scheduleFacility, scheduleDate),
    [scheduleFacility, scheduleDate],
  );
  const {
    data: blockRows,
    loading: loadingBlocks,
    reload: reloadBlocks,
  } = useAsyncData<BlockedSlot[]>({
    cacheKey: `blocks:${scheduleFacility}:${scheduleDate}`,
    load: loadBlocks,
    fallback: [],
  });

  // Memoed so downstream hooks see a stable reference between renders.
  const bookings = useMemo(() => bookingRows ?? [], [bookingRows]);
  const blocks = useMemo(() => blockRows ?? [], [blockRows]);

  // The toast is purely informational and self-clears.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const adminName = profile?.fullName ?? "Admin";

  const filtered = useMemo(() => {
    return statusFilter === "all"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);
    // `bookings` is a fresh array only when the query re-settles.
  }, [bookings, statusFilter]);

  const pendingCount = (bookings ?? []).filter((b) => b.status === "pending").length;
  const today = todayKey();
  const todayCount = (bookings ?? []).filter(
    (b) => b.date === today && b.status === "approved",
  ).length;

  async function review(
    booking: Booking,
    decision: Extract<BookingStatus, "approved" | "rejected">,
  ) {
    if (!user) return;

    setBusyId(booking.id);
    setError(null);

    const note = noteDraft[booking.id] ?? "";
    const facility = FACILITY_BY_ID[booking.facilityId];
    const slot = SLOT_BY_ID[booking.timeSlot];
    const when = `${formatShortDate(booking.date)} at ${slot?.label ?? booking.timeSlot}`;

    try {
      await setBookingStatus(booking.id, decision, { uid: user.uid, name: adminName }, note);

      await notifyUser(
        booking.userId,
        decision === "approved" ? "Booking approved" : "Booking declined",
        decision === "approved"
          ? `Your ${facility?.shortName} reservation for ${when} is confirmed.`
          : `Your ${facility?.shortName} request for ${when} was declined.${note ? ` Note: ${note}` : ""}`,
        decision === "approved" ? "approved" : "rejected",
        booking.id,
      );

      setBookings((current) =>
        current?.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: decision,
                adminNote: note.trim() || null,
                reviewedBy: adminName,
              }
            : b,
        ) ?? null,
      );

      setToast(
        decision === "approved" ? "Booking approved." : "Booking declined and student notified.",
      );
      setNoteDraft((current) => {
        const next = { ...current };
        delete next[booking.id];
        return next;
      });
    } catch {
      setError("Could not update that booking. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(booking: Booking) {
    if (!window.confirm("Delete this booking permanently? This cannot be undone.")) return;

    setBusyId(booking.id);
    try {
      await removeBooking(booking);
      await notifyUser(
        booking.userId,
        "Booking removed",
        "An admin removed your reservation request.",
        "cancelled",
        booking.id,
      );
      setBookings((current) => current?.filter((b) => b.id !== booking.id) ?? null);
      setToast("Booking deleted.");
    } catch {
      setError("Could not delete that booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelApproved(booking: Booking) {
    setBusyId(booking.id);
    try {
      await cancelBooking(booking.id, true);
      await notifyUser(
        booking.userId,
        "Booking cancelled by admin",
        `An admin cancelled your ${FACILITY_BY_ID[booking.facilityId]?.shortName} reservation for ${formatShortDate(booking.date)}.`,
        "cancelled",
        booking.id,
      );
      setBookings((current) =>
        current?.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b)) ?? null,
      );
      setToast("Booking cancelled.");
    } catch {
      setError("Could not cancel that booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlock(timeSlot: string) {
    const existing = blocks.find((b) => b.timeSlot === timeSlot);

    try {
      if (existing) {
        await unblockSlot(scheduleFacility, scheduleDate, timeSlot);
        setToast("Slot reopened.");
      } else {
        await blockSlot(
          scheduleFacility,
          scheduleDate,
          timeSlot,
          blockReason,
          user?.uid ?? "unknown",
        );
        setToast("Slot closed for bookings.");
      }
      setBlockReason("");
      reloadBlocks();
    } catch {
      setError("Could not update the schedule.");
    }
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-gold-600">
            <ShieldCheck className="h-4 w-4" />
            Administrator
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-maroon-900">Admin Console</h1>
          <p className="mt-1.5 text-neutral-600">
            Review student requests and control the facility schedule.
          </p>
        </div>

        <button type="button" onClick={reloadBookings} className="btn btn-outline">
          <RefreshCw className={`h-4 w-4 ${loadingBookings ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Awaiting review" value={pendingCount} tone="text-pending" />
        <Stat label="Approved today" value={todayCount} tone="text-available" />
        <Stat label="Total requests" value={(bookings ?? []).length} tone="text-maroon-700" />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm text-booked">
          {error}
        </p>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="mb-5 inline-flex rounded-xl border border-cream-300 bg-white p-1">
        {(
          [
            { id: "requests" as const, label: "Booking requests" },
            { id: "schedule" as const, label: "Availability & schedule" },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === item.id ? "bg-maroon-700 text-white" : "text-neutral-700 hover:bg-cream-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                aria-pressed={statusFilter === value}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === value
                    ? "border-maroon-700 bg-maroon-700 text-white"
                    : "border-cream-300 bg-white text-neutral-700 hover:bg-cream-100"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          {loadingBookings && !bookings.length ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-cream-200" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p className="font-display text-lg font-bold text-maroon-900">
                No {statusFilter === "all" ? "" : statusFilter} bookings
              </p>
              <p className="mt-1.5 text-sm text-neutral-600">
                Student requests will show up here as soon as they are sent.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((booking) => (
                <AdminBookingCard
                  key={booking.id}
                  booking={booking}
                  busy={busyId === booking.id}
                  note={noteDraft[booking.id] ?? ""}
                  onNoteChange={(value) =>
                    setNoteDraft((current) => ({ ...current, [booking.id]: value }))
                  }
                  onApprove={() => review(booking, "approved")}
                  onReject={() => review(booking, "rejected")}
                  onCancel={() => handleCancelApproved(booking)}
                  onRemove={() => handleRemove(booking)}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <section className="card p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="schedFacility" className="field-label">
                Facility
              </label>
              <select
                id="schedFacility"
                value={scheduleFacility}
                onChange={(event) => setScheduleFacility(event.target.value as FacilityId)}
                className="field"
              >
                {FACILITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="schedDate" className="field-label">
                Date
              </label>
              <input
                id="schedDate"
                type="date"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="field"
              />
            </div>
          </div>

          <p className="mb-4 text-sm text-neutral-600">
            Closed slots are hidden from students on the booking form and shown grey in the
            calendar.
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Reason (e.g. Maintenance, school event)"
              className="field flex-1"
            />
          </div>

          <ul className="space-y-2">
            {TIME_SLOTS.map((slot) => {
              const block = blocks.find((b) => b.timeSlot === slot.id);
              const Icon = ICONS[scheduleFacility];

              return (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-cream-200 bg-cream-50 p-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-maroon-700" />
                  <span className="w-24 shrink-0 text-sm font-semibold text-neutral-800">
                    {slot.label}
                  </span>

                  <span className="min-w-0 flex-1 text-xs text-neutral-600">
                    {block ? (
                      <>
                        Closed &middot; <span className="italic">{block.reason}</span>
                      </>
                    ) : (
                      "Open for bookings"
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleBlock(slot.id)}
                    disabled={loadingBlocks}
                    className={`btn shrink-0 text-xs ${
                      block
                        ? "btn-outline"
                        : "bg-booked-soft text-booked hover:bg-booked hover:text-white"
                    }`}
                  >
                    {block ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Reopen
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5" /> Close slot
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
            <CalendarRange className="h-3.5 w-3.5" />
            Students can book up to {BOOKING_WINDOW_DAYS} days ahead.
          </p>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-xl bg-maroon-800 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-4">
      <p className={`font-display text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-neutral-600">{label}</p>
    </div>
  );
}

function AdminBookingCard({
  booking,
  busy,
  note,
  onNoteChange,
  onApprove,
  onReject,
  onCancel,
  onRemove,
}: {
  booking: Booking;
  busy: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const facility = FACILITY_BY_ID[booking.facilityId];
  const Icon = ICONS[booking.facilityId];
  const slot = SLOT_BY_ID[booking.timeSlot];
  const pending = booking.status === "pending";

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-maroon-700 text-white">
          <Icon className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-neutral-900">
              {booking.fullName}
            </h3>
            <StatusPill status={booking.status} size="sm" />
          </div>

          <p className="mt-0.5 text-sm text-neutral-700">
            Grade {booking.grade}-{booking.section} &middot; {facility?.name} &middot;{" "}
            {formatLongDate(booking.date)} &middot; {slot?.label ?? booking.timeSlot}
          </p>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-neutral-500">Purpose</dt>
              <dd className="font-medium text-neutral-800">{booking.purpose}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-500">Attendees</dt>
              <dd className="font-medium text-neutral-800">{booking.attendees}</dd>
            </div>
            {booking.notes && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-neutral-500">Notes</dt>
                <dd className="font-medium text-neutral-800">{booking.notes}</dd>
              </div>
            )}
            {booking.reviewedBy && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-neutral-500">Reviewed by</dt>
                <dd className="font-medium text-neutral-800">{booking.reviewedBy}</dd>
              </div>
            )}
          </dl>

          {booking.idPhotoUrl && (
            <a
              href={booking.idPhotoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-maroon-700 hover:underline"
            >
              View student ID photo
            </a>
          )}

          {pending && (
            <div className="mt-4 border-t border-cream-200 pt-4">
              <label htmlFor={`note-${booking.id}`} className="field-label">
                Note to the student <span className="font-normal text-neutral-500">(optional)</span>
              </label>
              <input
                id={`note-${booking.id}`}
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="e.g. Please clean the court after use"
                className="field"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-cream-200 pt-4">
        {pending ? (
          <>
            <button type="button" onClick={onApprove} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="btn bg-booked-soft text-booked hover:bg-booked hover:text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Decline
            </button>
          </>
        ) : (
          booking.status === "approved" && (
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-outline">
              Cancel booking
            </button>
          )
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="btn btn-ghost ml-auto text-neutral-500 hover:bg-cream-100 hover:text-booked"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </li>
  );
}