"use client";

import {
  AlertTriangle,
  CalendarRange,
  Check,
  Download,
  Dumbbell,
  Loader2,
  MonitorPlay,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { InUseBanner, PhasePill } from "@/components/phase-pill";
import { useAuth } from "@/lib/auth-context";
import { bookingPhase, isNoShowEligible } from "@/lib/booking-phase";
import {
  allBookingsQuery,
  bookingAuditQueries,
  blockSlot,
  blocksQueryForDate,
  cancelBooking,
  ensureAvailabilityProjections,
  ensureIdPhotoFacilityAccess,
  ensureSchoolCalendar,
  fetchIdPhoto,
  markBookingCompleted,
  markBookingInUse,
  markBookingNoShow,
  notifyUser,
  parseBlockedSlotDoc,
  parseBookingAuditDoc,
  parseBookingDoc,
  removeBooking,
  reportBookingsQuery,
  setBookingStatus,
  unblockSlot,
} from "@/lib/data";
import { addDays, formatLongDate, formatShortDate, toDateKey, todayKey } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, FACILITY_BY_ID, TIME_BLOCKS, type Facility } from "@/lib/constants";
import { useFacilities } from "@/lib/use-facilities";
import { db, firebaseConfig } from "@/lib/firebase";
import { formatTimeRange, describeMinutes } from "@/lib/time";
import type { Booking, BookingStatus, FacilityId } from "@/lib/types";
import { useLiveQuery } from "@/lib/use-live-query";
import { SchoolCalendarManager } from "@/components/school-calendar-manager";
import { downloadBookingsCsv } from "@/lib/exports";

const ICONS: Record<string, typeof Dumbbell> = { gymnasium: Dumbbell, avr: MonitorPlay };

type Tab = "requests" | "schedule" | "reports" | "calendar" | "history";
type StatusFilter = BookingStatus | "all" | "upcoming" | "warnings";

/** Filter pills, in the order they appear. `all` is the default. */
const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "upcoming",
  "pending",
  "approved",
  "completed",
  "no_show",
  "warnings",
  "rejected",
];

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  upcoming: "Upcoming",
  pending: "Pending",
  approved: "Approved",
  completed: "Completed",
  no_show: "No show",
  warnings: "Warnings",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function AdminConsole() {
  const { profile, user } = useAuth();
  const allFacilities = useFacilities();
  const facilities = profile?.assignedFacilityIds?.length ? allFacilities.filter((facility) => profile.assignedFacilityIds?.includes(facility.id)) : allFacilities;
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCapacity, setNewVenueCapacity] = useState("");
  const [newVenueDescription, setNewVenueDescription] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminFacility, setNewAdminFacility] = useState("gymnasium");

  const [tab, setTab] = useState<Tab>("requests");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warningSelection, setWarningSelection] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [projectionSyncComplete, setProjectionSyncComplete] = useState(false);

  // Schedule editor state.
  const [scheduleFacility, setScheduleFacility] = useState<FacilityId>("gymnasium");
  const activeScheduleFacility = facilities.some((facility) => facility.id === scheduleFacility) ? scheduleFacility : facilities[0]?.id ?? scheduleFacility;
  const [scheduleDate, setScheduleDate] = useState(todayKey());
  const [blockReason, setBlockReason] = useState("");

  const bookingLive = useLiveQuery({
    cacheKey: `admin-bookings:${profile?.uid ?? "none"}`,
    enabled: Boolean(profile),
    deps: [profile?.assignedFacilityIds],
    buildQueries: () => [allBookingsQuery(profile?.assignedFacilityIds)],
  });

  const blockLive = useLiveQuery({
    cacheKey: `admin-blocks:${activeScheduleFacility}:${scheduleDate}`,
    enabled: Boolean(profile) && facilities.some((facility) => facility.id === activeScheduleFacility),
    deps: [activeScheduleFacility, scheduleDate, profile?.assignedFacilityIds],
    buildQueries: () => [blocksQueryForDate(activeScheduleFacility, scheduleDate)],
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

  async function addVenue(event: React.FormEvent) {
    event.preventDefault();
    const id = newVenueName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!id || facilities.some((facility) => facility.id === id)) { setError("Choose a unique venue name."); return; }
    try {
      await setDoc(doc(db, "facilities", id), { name: newVenueName.trim(), shortName: newVenueName.trim(), capacity: newVenueCapacity.trim(), description: newVenueDescription.trim(), active: true });
      setNewVenueName(""); setNewVenueCapacity(""); setNewVenueDescription(""); setToast("Venue added.");
    } catch { setError("Could not add the venue. Check the database rules."); }
  }

  async function addAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (!facilities.some((facility) => facility.id === newAdminFacility)) { setError("Choose a venue for this admin."); return; }
    const app = initializeApp(firebaseConfig, `admin-provision-${crypto.randomUUID()}`);
    const secondaryAuth = getAuth(app);
    try {
      const random = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const credential = await createUserWithEmailAndPassword(secondaryAuth, newAdminEmail.trim().toLowerCase(), `${random}Aa1!`);
      try {
        await setDoc(doc(db, "users", credential.user.uid), { uid: credential.user.uid, fullName: newAdminName.trim(), email: newAdminEmail.trim().toLowerCase(), phone: "", role: "admin", assignedFacilityIds: [newAdminFacility] });
      } catch (cause) { await deleteUser(credential.user); throw cause; }
      await sendPasswordResetEmail(secondaryAuth, newAdminEmail.trim().toLowerCase());
      await signOut(secondaryAuth);
      setNewAdminName(""); setNewAdminEmail(""); setToast("Venue admin created. Password setup email sent.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the admin account."); }
    finally { await deleteApp(app); }
  }

  const filtered = useMemo(() => {
    return statusFilter === "all"
      ? bookings
      : statusFilter === "upcoming"
        ? bookings.filter((b) => b.date >= todayKey() && (b.status === "approved" || b.status === "pending"))
        : statusFilter === "warnings"
          ? bookings.filter((b) => Boolean(b.warningIssuedAt))
        : bookings.filter((b) => b.status === statusFilter);
    // `bookings` is a fresh array only when the query re-settles.
  }, [bookings, statusFilter]);

  const pendingCount = (bookings ?? []).filter((b) => b.status === "pending").length;
  const today = todayKey();
  const now = new Date();
  const reportStart = reportPeriod === "daily" ? today : reportPeriod === "weekly" ? toDateKey(addDays(now, -((now.getDay() + 6) % 7))) : `${today.slice(0, 7)}-01`;
  const reportLive = useLiveQuery({ cacheKey: `report:${profile?.uid ?? "none"}:${reportStart}:${today}`, enabled: Boolean(profile), deps: [reportStart, today, profile?.assignedFacilityIds], buildQueries: () => [reportBookingsQuery(reportStart, today, profile?.assignedFacilityIds)] });
  const reportBookings = (reportLive.docs ?? []).map(parseBookingDoc);
  const auditLive = useLiveQuery({
    cacheKey: `booking-audit:${profile?.uid ?? "none"}:${(profile?.assignedFacilityIds ?? []).join(",")}`,
    enabled: Boolean(profile),
    deps: [profile?.uid, profile?.assignedFacilityIds],
    buildQueries: () => bookingAuditQueries(profile?.assignedFacilityIds),
  });
  const auditEntries = useMemo(() => (auditLive.docs ?? []).map(parseBookingAuditDoc).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)), [auditLive.docs]);
  const todayCount = (bookings ?? []).filter(
    (b) => b.date === today && b.status === "approved",
  ).length;

  // Backfill the privacy-safe calendar records for bookings created before
  // this split schema. This is idempotent and only runs for administrators.
  useEffect(() => {
    if (bookingLive.loading || projectionSyncComplete) return;
    let active = true;
    Promise.all([
      ensureAvailabilityProjections(bookings),
      ...(profile?.assignedFacilityIds?.length ? [] : [ensureIdPhotoFacilityAccess(bookings), ...(user ? [ensureSchoolCalendar(user.uid)] : [])]),
    ])
      .then(() => {
        if (active) setProjectionSyncComplete(true);
      })
      .catch(() => {
        if (active) setError("Could not prepare the school calendar or existing reservation data. Publish the latest Firestore rules and try again.");
      });
    return () => {
      active = false;
    };
  }, [bookingLive.loading, bookings, projectionSyncComplete, profile?.assignedFacilityIds, user]);

  async function review(
    booking: Booking,
    decision: Extract<BookingStatus, "approved" | "rejected">,
  ) {
    if (!user) return;

    setBusyId(booking.id);
    setError(null);

    const note = noteDraft[booking.id] ?? "";
    const facility = allFacilities.find((item) => item.id === booking.facilityId) ?? FACILITY_BY_ID[booking.facilityId];
    const range = formatTimeRange(booking.startTime, booking.endTime);
    const when = `${formatShortDate(booking.date)} at ${range}`;

    try {
      await setBookingStatus(booking.id, decision, { uid: user.uid, name: adminName }, note);

      const notified = await notifyUser(
        booking.userId,
        decision === "approved" ? "Booking approved" : "Booking declined",
        decision === "approved"
          ? `Your ${facility?.shortName} reservation for ${when} is confirmed.`
          : `Your ${facility?.shortName} request for ${when} was declined.${note ? ` Note: ${note}` : ""}`,
        decision === "approved" ? "approved" : "rejected",
        booking.id,
      );

      // The live listener pushes the new status back, so no local patch.

      setToast(notified
        ? decision === "approved" ? "Booking approved and student notified." : "Booking declined and student notified."
        : "Booking updated, but the student notification could not be delivered.");
      setNoteDraft((current) => {
        const next = { ...current };
        delete next[booking.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that booking. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(booking: Booking) {
    if (!window.confirm("Delete this booking permanently? This cannot be undone.")) return;

    setBusyId(booking.id);
    try {
      await removeBooking(booking, user ? { uid: user.uid, name: adminName } : undefined);
      const notified = await notifyUser(
        booking.userId,
        "Booking removed",
        "An admin removed your reservation request.",
        "cancelled",
        booking.id,
      );
      setToast(notified ? "Booking deleted and student notified." : "Booking deleted, but the student notification could not be delivered.");
    } catch {
      setError("Could not delete that booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelApproved(booking: Booking) {
    setBusyId(booking.id);
    try {
      if (!user) throw new Error("Sign in again to continue.");
      await cancelBooking(booking.id, { uid: user.uid, name: adminName });
      const notified = await notifyUser(
        booking.userId,
        "Booking cancelled by admin",
        `An admin cancelled your ${allFacilities.find((item) => item.id === booking.facilityId)?.shortName ?? booking.facilityId} reservation for ${formatShortDate(booking.date)}.`,
        "cancelled",
        booking.id,
      );
      setToast(notified ? "Booking cancelled and student notified." : "Booking cancelled, but the student notification could not be delivered.");
    } catch {
      setError("Could not cancel that booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleNoShow(booking: Booking, issueWarning: boolean) {
    if (!window.confirm(`Release this slot as a no-show? The venue becomes bookable again.${issueWarning ? " A warning notification will be sent to the student." : ""}`)) {
      return;
    }

    setBusyId(booking.id);
    try {
      if (!user) throw new Error("Sign in again to continue.");
      await markBookingNoShow(booking.id, { uid: user.uid, name: adminName }, issueWarning);
      const notified = await notifyUser(
        booking.userId,
        issueWarning ? "No-show warning issued" : "Reservation marked as a no-show",
        issueWarning
          ? `An administrator recorded a no-show warning for your ${allFacilities.find((item) => item.id === booking.facilityId)?.shortName ?? booking.facilityId} reservation on ${formatShortDate(booking.date)}. Contact the school office if you believe this is incorrect.`
          : `Your ${allFacilities.find((item) => item.id === booking.facilityId)?.shortName ?? booking.facilityId} reservation for ${formatShortDate(booking.date)} was closed as a no-show and the time was released.`,
        issueWarning ? "warning" : "cancelled",
        booking.id,
      );
      setToast(notified ? "Slot released and student notified." : "Slot released, but the student notification could not be delivered.");
      setWarningSelection((current) => ({ ...current, [booking.id]: false }));
    } catch {
      setError("Could not release that slot.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleInUse(booking: Booking) {
    setBusyId(booking.id);
    setError(null);
    try {
      if (!user) throw new Error("Sign in again to continue.");
      await markBookingInUse(booking.id, { uid: user.uid, name: adminName });
      setToast("Booking marked in use.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark the booking in use.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(booking: Booking) {
    setBusyId(booking.id);
    try {
      if (!user) throw new Error("Sign in again to continue.");
      await markBookingCompleted(booking.id, true, { uid: user.uid, name: adminName });
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
        await unblockSlot(activeScheduleFacility, scheduleDate, timeSlot);
        setToast("Slot reopened.");
      } else {
        await blockSlot(
          activeScheduleFacility,
          scheduleDate,
          timeSlot,
          blockReason,
          user?.uid ?? "unknown",
        );
        setToast("Slot closed for bookings.");
      }
      setBlockReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the schedule.");
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
        <p className="mt-2 text-xs text-ink-500">Admin flow: Review pending requests → Check the schedule and equipment → Approve or decline → Monitor upcoming bookings and reports.</p>
      </header>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting review" value={pendingCount} tone="text-pending" />
        <Stat label="Approved today" value={todayCount} tone="text-available" />
        <Stat label="Total requests" value={(bookings ?? []).length} tone="text-brand-700" />
      </div>

      {error && <p className="banner banner-error mb-5">{error}</p>}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="mb-6 flex w-full flex-wrap gap-1 rounded-lg bg-ink-100 p-1 sm:w-fit">
        {(
          [
            { id: "requests" as const, label: "Booking requests" },
            { id: "schedule" as const, label: "Availability & schedule" },
            { id: "reports" as const, label: "Statistics & reports" },
            { id: "calendar" as const, label: "School calendar" },
            { id: "history" as const, label: "Admin history" },
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
                  facility={facilities.find((item) => item.id === booking.facilityId)}
                  busy={busyId === booking.id}
                  note={noteDraft[booking.id] ?? ""}
                  onNoteChange={(value) =>
                    setNoteDraft((current) => ({ ...current, [booking.id]: value }))
                  }
                  onApprove={() => review(booking, "approved")}
                  onReject={() => review(booking, "rejected")}
                  onCancel={() => handleCancelApproved(booking)}
                  onRemove={() => handleRemove(booking)}
                  onNoShow={(issueWarning) => handleNoShow(booking, issueWarning)}
                  onWarningChange={(checked) => setWarningSelection((current) => ({ ...current, [booking.id]: checked }))}
                  issueWarning={warningSelection[booking.id] ?? false}
                  onInUse={() => handleInUse(booking)}
                  onComplete={() => handleComplete(booking)}
                />
              ))}
            </ul>
          )}
        </>
      ) : tab === "reports" ? (
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">Booking report</h2><p className="text-sm text-ink-500">{formatShortDate(reportStart)} – {formatShortDate(today)}</p></div><div className="flex gap-2"><select aria-label="Report period" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as "daily" | "weekly" | "monthly")} className="field w-auto"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><button type="button" onClick={() => downloadBookingsCsv(reportBookings, `venuebook-${reportPeriod}-${today}.csv`)} disabled={!reportBookings.length} className="btn btn-outline"><Download className="h-4 w-4" />Export CSV</button></div></div>
          {reportLive.error && <p className="banner banner-error mb-3">Could not load this report. Deploy the new Firestore index first.</p>}
          <div className="grid gap-3 sm:grid-cols-4">{(["all", "pending", "approved", "rejected"] as const).map((status) => <Stat key={status} label={status === "all" ? "Requests" : status} value={status === "all" ? reportBookings.length : reportBookings.filter((booking) => booking.status === status).length} tone="text-brand-700" />)}</div>
          <h3 className="mt-6 font-semibold text-ink-900">By venue</h3><div className="mt-2 space-y-2">{facilities.map((facility) => <p key={facility.id} className="flex justify-between border-b border-ink-200 py-2 text-sm"><span>{facility.name}</span><strong>{reportBookings.filter((booking) => booking.facilityId === facility.id).length}</strong></p>)}</div>
        </section>
      ) : tab === "history" ? (
        <section className="card p-5">
          <div className="mb-4"><h2 className="section-title">Admin action history</h2><p className="mt-1 text-sm text-ink-500">The latest approval, rejection, cancellation, and booking close-out actions.</p></div>
          {auditLive.error && <p className="banner banner-error mb-3">Could not load the audit history. Publish the latest Firestore rules and indexes.</p>}
          {auditLive.loading && auditEntries.length === 0 ? <p className="text-sm text-ink-500">Loading history…</p> : auditEntries.length === 0 ? <p className="text-sm text-ink-500">No admin actions have been recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-ink-200 text-xs uppercase text-ink-500"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Booking</th><th className="py-2 pr-3">Student</th><th className="py-2">Admin</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id} className="border-b border-ink-100"><td className="py-3 pr-3">{entry.createdAt?.toDate().toLocaleString("en-PH") ?? "—"}</td><td className="py-3 pr-3 font-medium capitalize">{entry.action.replaceAll("_", " ")} · {entry.previousStatus} → {entry.status}</td><td className="py-3 pr-3">{formatShortDate(entry.date)} · {formatTimeRange(entry.startTime, entry.endTime)}</td><td className="py-3 pr-3">{entry.studentName}</td><td className="py-3">{entry.actorName}</td></tr>)}</tbody></table></div>}
        </section>
      ) : tab === "calendar" ? (
        <SchoolCalendarManager />
      ) : (
        <section className="card p-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="schedFacility" className="field-label">
                Facility
              </label>
              <select
                id="schedFacility"
                value={activeScheduleFacility}
                onChange={(event) => setScheduleFacility(event.target.value as FacilityId)}
                className="field"
              >
                {facilities.map((f) => (
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
              const Icon = ICONS[activeScheduleFacility] ?? Dumbbell;

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

      {!profile?.assignedFacilityIds?.length && <form onSubmit={addVenue} className="card mt-6 grid gap-3 p-5 sm:grid-cols-3"><div className="sm:col-span-3"><h2 className="section-title">Add a venue</h2><p className="text-xs text-ink-500">New venues appear in booking and availability after saving.</p></div><input aria-label="Venue name" required placeholder="Conference room" value={newVenueName} onChange={(event) => setNewVenueName(event.target.value)} className="field" /><input aria-label="Capacity" required placeholder="Capacity" value={newVenueCapacity} onChange={(event) => setNewVenueCapacity(event.target.value)} className="field" /><input aria-label="Description" required placeholder="Description" value={newVenueDescription} onChange={(event) => setNewVenueDescription(event.target.value)} className="field" /><button type="submit" className="btn btn-primary sm:col-span-3">Add venue</button></form>}

      {!profile?.assignedFacilityIds?.length && <form onSubmit={addAdmin} className="card mt-4 grid gap-3 p-5 sm:grid-cols-3"><div className="sm:col-span-3"><h2 className="section-title">Create venue admin</h2><p className="text-xs text-ink-500">The admin receives an email to set a password and sees only the assigned venue.</p></div><input aria-label="Admin full name" required placeholder="Full name" value={newAdminName} onChange={(event) => setNewAdminName(event.target.value)} className="field" /><input aria-label="Admin email" type="email" required placeholder="Email" value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} className="field" /><select aria-label="Assigned venue" value={newAdminFacility} onChange={(event) => setNewAdminFacility(event.target.value)} className="field">{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><button type="submit" className="btn btn-primary sm:col-span-3">Create admin</button></form>}

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
  facility,
  busy,
  note,
  onNoteChange,
  onApprove,
  onReject,
  onCancel,
  onRemove,
  onNoShow,
  onWarningChange,
  issueWarning,
  onInUse,
  onComplete,
}: {
  booking: Booking;
  facility?: Facility;
  busy: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onNoShow: (issueWarning: boolean) => void;
  onWarningChange: (checked: boolean) => void;
  issueWarning: boolean;
  onInUse: () => void;
  onComplete: () => void;
}) {
  facility ??= FACILITY_BY_ID[booking.facilityId];
  const Icon = ICONS[booking.facilityId] ?? Dumbbell;
  const range = formatTimeRange(booking.startTime, booking.endTime);
  const pending = booking.status === "pending";
  const now = new Date();
  const phase = bookingPhase(booking, now);
  const noShowEligible = isNoShowEligible(booking, now);

  return (
    <li className="card p-4 sm:p-5">
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
          {booking.warningIssuedAt && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> No-show warning issued</p>}

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
            {booking.equipment && Object.values(booking.equipment).some((quantity) => quantity > 0) && (
              <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 text-ink-500">Equipment</dt><dd className="font-medium text-ink-800">{Object.entries(booking.equipment).filter(([, quantity]) => quantity > 0).map(([name, quantity]) => `${name} × ${quantity}`).join(", ")}</dd></div>
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

            {phase === "in_use" && !booking.inUseAt && (
              <button type="button" onClick={onInUse} disabled={busy} className="btn btn-primary">
                <Check className="h-4 w-4" />
                {busy ? "Updating…" : "In Use"}
              </button>
            )}

            {phase === "over" && (
              <button type="button" onClick={onComplete} disabled={busy} className="btn btn-outline">
                <Check className="h-4 w-4" />
                Mark completed
              </button>
            )}

            {noShowEligible && (
              <>
                <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" checked={issueWarning} onChange={(event) => onWarningChange(event.target.checked)} disabled={busy} />
                  Send warning notification
                </label>
                <button type="button" onClick={() => onNoShow(issueWarning)} disabled={busy} className="btn btn-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {busy ? "Releasing…" : "No Show & release"}
                </button>
              </>
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
