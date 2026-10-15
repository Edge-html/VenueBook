"use client";

import {
  AlertTriangle,
  CalendarRange,
  Check,
  Dumbbell,
  Loader2,
  MonitorPlay,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InUseBanner, PhasePill } from "@/components/phase-pill";
import { useAuth } from "@/lib/auth-context";
import { bookingPhase, isNoShowEligible } from "@/lib/booking-phase";
import {
  allBookingsQuery,
  blockSlot,
  blocksQueryForDate,
  cancelBooking,
  fetchIdPhoto,
  markBookingCompleted,
  markBookingNoShow,
  notifyUser,
  parseBlockedSlotDoc,
  parseBookingDoc,
  removeBooking,
  setBookingStatus,
  unblockSlot,
} from "@/lib/data";
import { formatLongDate, formatShortDate, todayKey } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, FACILITIES, FACILITY_BY_ID, TIME_BLOCKS } from "@/lib/constants";
import { formatTimeRange, describeMinutes } from "@/lib/time";
import type { Booking, BookingStatus, FacilityId } from "@/lib/types";
import { useLiveQuery } from "@/lib/use-live-query";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

type Tab = "requests" | "schedule";
type StatusFilter = BookingStatus | "all";

/** Filter pills, in the order they appear. `all` is the default. */
const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "pending",
  "approved",
  "completed",
  "no_show",
  "rejected",
];

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  completed: "Completed",
  no_show: "No show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function AdminConsole() {
  const { profile, user } = useAuth();

  const [tab, setTab] = useState<Tab>("requests");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Schedule editor state.
  const [scheduleFacility, setScheduleFacility] = useState<FacilityId>("gymnasium");
  const [scheduleDate, setScheduleDate] = useState(todayKey());
  const [blockReason, setBlockReason] = useState("");

  const bookingLive = useLiveQuery({
    cacheKey: "admin-bookings",
    deps: [],
    buildQueries: () => [allBookingsQuery()],
  });

  const blockLive = useLiveQuery({
    cacheKey: `admin-blocks:${scheduleFacility}:${scheduleDate}`,
    deps: [scheduleFacility, scheduleDate],
    buildQueries: () => [blocksQueryForDate(scheduleFacility, scheduleDate)],
  });

  const bookings = useMemo(() => (bookingLive.docs ?? []).map(parseBookingDoc), [bookingLive.docs]);
  const blocks = useMemo(
    () => (blockLive.docs ?? []).map(parseBlockedSlotDoc),
    [blockLive.docs],
  );
  const loadingBookings = bookingLive.loading;
  const loadingBlocks = blockLive.loading;

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
    const range = formatTimeRange(booking.startTime, booking.endTime);
    const when = `${formatShortDate(booking.date)} at ${range}`;

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

      // The live listener pushes the new status back, so no local patch.

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
      setToast("Booking cancelled.");
    } catch {
      setError("Could not cancel that booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoShow(booking: Booking) {
    if (!window.confirm("Release this slot as a no-show? The venue becomes bookable again.")) {
      return;
    }

    setBusyId(booking.id);
    try {
      await markBookingNoShow(booking.id);
      await notifyUser(
        booking.userId,
        "Marked as a no-show",
        `Your ${FACILITY_BY_ID[booking.facilityId]?.shortName} reservation for ${formatShortDate(
          booking.date,
        )} was closed as a no-show.`,
        "cancelled",
        booking.id,
      );
      setToast("Slot released — marked as a no-show.");
    } catch {
      setError("Could not release that slot.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(booking: Booking) {
    setBusyId(booking.id);
    try {
      await markBookingCompleted(booking.id, true);
      setToast("Booking closed out.");
    } catch {
      setError("Could not close out that booking.");
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
    } catch {
      setError("Could not update the schedule.");
    }
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-8">
        <p className="eyebrow flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
          Administrator
        </p>
        <h1 className="page-title mt-2">Admin Console</h1>
        <p className="page-lede">
          Review student requests and control the facility schedule. Updates arrive live.
        </p>
      </header>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting review" value={pendingCount} tone="text-pending" />
        <Stat label="Approved today" value={todayCount} tone="text-available" />
        <Stat label="Total requests" value={(bookings ?? []).length} tone="text-brand-700" />
      </div>

      {error && <p className="banner banner-error mb-5">{error}</p>}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="mb-6 inline-flex rounded-lg bg-ink-100 p-1">
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
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-brand-700 text-white"
                : "text-ink-600 hover:bg-ink-200 hover:text-ink-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                aria-pressed={statusFilter === value}
                className={`badge px-3 py-1.5 transition-colors ${
                  statusFilter === value
                    ? "bg-brand-700 text-white"
                    : "border border-ink-300 bg-white text-ink-600 hover:border-ink-400 hover:text-ink-900"
                }`}
              >
                {FILTER_LABELS[value]}
              </button>
            ))}
          </div>

          {loadingBookings && !bookings.length ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-xl bg-ink-200" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card px-6 py-16 text-center">
              <p className="text-base font-semibold tracking-[-0.015em] text-ink-900">
                {statusFilter === "all" ? "No bookings yet" : `No ${FILTER_LABELS[statusFilter].toLowerCase()} bookings`}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Student requests will show up here as soon as they are sent.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
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
                  onNoShow={() => handleNoShow(booking)}
                  onComplete={() => handleComplete(booking)}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <section className="card p-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
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

          <p className="mb-5 text-sm leading-relaxed text-ink-500">
            Closed slots are hidden from students on the booking form and shown grey in the
            calendar.
          </p>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <input
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Reason (e.g. Maintenance, school event)"
              className="field flex-1"
            />
          </div>

          <ul className="space-y-2">
            {TIME_BLOCKS.map((slot) => {
              const block = blocks.find((b) => b.timeSlot === slot.id);
              const Icon = ICONS[scheduleFacility];

              return (
                <li
                  key={slot.id}
                  title={describeMinutes(slot.startMin, slot.endMin)}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-50 p-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-700" />
                  <span className="w-16 shrink-0 text-sm font-medium text-ink-800">
                    {slot.label}
                  </span>

                  <span className="min-w-0 flex-1 text-xs text-ink-500">
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
                    className={`btn shrink-0 text-xs ${block ? "btn-outline" : "btn-danger"}`}
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

          <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-500">
            <CalendarRange className="h-3.5 w-3.5" />
            Students can book up to {BOOKING_WINDOW_DAYS} days ahead.
          </p>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="animate-fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-white shadow-lift"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Stat block: typographic scale only, no card chrome beyond the container the
 * caller may add. The number carries it; the label just names it.
 */
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-5">
      <p className={`text-4xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</p>
      <p className="eyebrow mt-2">{label}</p>
    </div>
  );
}

/**
 * ID photos live in Firestore as bytes, so they are fetched on demand and
 * rendered from an object URL that is released on unmount.
 */
function IdPhotoThumbnail({ photoId }: { photoId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoke: (() => void) | undefined;
    let active = true;

    fetchIdPhoto(photoId)
      .then((photo) => {
        if (!photo) {
          if (active) setMissing(true);
          return;
        }
        revoke = photo.revoke;
        if (active) setSrc(photo.url);
      })
      .catch(() => {
        if (active) setMissing(true);
      });

    return () => {
      active = false;
      revoke?.();
    };
  }, [photoId]);

  if (missing) {
    return <p className="mt-3 text-xs text-ink-500">ID photo unavailable.</p>;
  }

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-medium text-ink-500">Student ID</p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Uploaded student ID"
          className="h-28 w-44 rounded-lg border border-ink-200 object-cover"
        />
      ) : (
        <div className="h-28 w-44 animate-pulse rounded-lg bg-ink-100" />
      )}
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
  onNoShow,
  onComplete,
}: {
  booking: Booking;
  busy: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onNoShow: () => void;
  onComplete: () => void;
}) {
  const facility = FACILITY_BY_ID[booking.facilityId];
  const Icon = ICONS[booking.facilityId];
  const range = formatTimeRange(booking.startTime, booking.endTime);
  const pending = booking.status === "pending";
  const now = new Date();
  const phase = bookingPhase(booking, now);
  const noShowEligible = isNoShowEligible(booking, now);

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-[-0.015em] text-ink-900">
              {booking.fullName}
            </h3>
            <PhasePill phase={phase} />
          </div>

          <p className="mt-1 text-sm text-ink-600">
            Grade {booking.grade}-{booking.section} &middot; {facility?.name} &middot;{" "}
            {formatLongDate(booking.date)} &middot; {range}
          </p>

          {phase === "in_use" && <InUseBanner booking={booking} />}

          {noShowEligible && (
            <div className="banner banner-warning mt-4 flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Started more than an hour ago and not closed out. If the student never
              arrived, release the slot so someone else can book it.
            </div>
          )}

          <dl className="mt-4 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-500">Purpose</dt>
              <dd className="font-medium text-ink-800">{booking.purpose}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-500">Attendees</dt>
              <dd className="font-medium text-ink-800">{booking.attendees}</dd>
            </div>
            {booking.notes && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="shrink-0 text-ink-500">Notes</dt>
                <dd className="font-medium text-ink-800">{booking.notes}</dd>
              </div>
            )}
            {booking.reviewedBy && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="shrink-0 text-ink-500">Reviewed by</dt>
                <dd className="font-medium text-ink-800">{booking.reviewedBy}</dd>
              </div>
            )}
          </dl>

          {booking.idPhotoUrl && (
            <IdPhotoThumbnail photoId={booking.idPhotoUrl} />
          )}

          {pending && (
            <div className="mt-5 border-t border-ink-200 pt-5">
              <label htmlFor={`note-${booking.id}`} className="field-label">
                Note to the student <span className="font-normal text-ink-500">(optional)</span>
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

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-5">
        {pending ? (
          <>
            <button type="button" onClick={onApprove} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </button>
            <button type="button" onClick={onReject} disabled={busy} className="btn btn-danger">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Decline
            </button>
          </>
        ) : booking.status === "approved" ? (
          <>
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-danger">
              Cancel booking
            </button>

            {phase === "over" && (
              <button type="button" onClick={onComplete} disabled={busy} className="btn btn-outline">
                <Check className="h-4 w-4" />
                Mark completed
              </button>
            )}

            {noShowEligible && (
              <button
                type="button"
                onClick={onNoShow}
                disabled={busy}
                className="btn btn-warning"
              >
                <AlertTriangle className="h-4 w-4" />
                {busy ? "Releasing…" : "Mark no-show & release"}
              </button>
            )}
          </>
        ) : null}

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="btn btn-ghost ml-auto text-ink-500 hover:text-booked"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </li>
  );
}