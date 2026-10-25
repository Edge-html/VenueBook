"use client";

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  Loader2,
  MonitorPlay,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FullPageLoader } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_WINDOW_DAYS,
  CLOSING_MINUTES,
  FACILITY_BY_ID,
  MIN_DURATION_MINUTES,
  OPENING_MINUTES,
} from "@/lib/constants";
import {
  createBooking,
  findRangeConflicts,
} from "@/lib/data";
import { addDays, formatLongDate, fromDateKey, schoolDayReason, todayKey, toDateKey } from "@/lib/dates";
import { earliestBookableMinutes } from "@/lib/booking-phase";
import { formatClock, formatTimeRange, fromMinutes, parseClockInput } from "@/lib/time";
import type { FacilityId } from "@/lib/types";
import { useFacilities } from "@/lib/use-facilities";
import { useSchoolCalendar } from "@/lib/use-school-calendar";

const ICONS: Record<string, typeof Dumbbell> = { gymnasium: Dumbbell, avr: MonitorPlay };

export function BookingForm() {
  const { profile, user, initialising } = useAuth();

  // Wait for the auth state so the name field can start filled in. Spinning on
  // `profile` alone would hang forever if the profile read was refused.
  if (initialising) return <FullPageLoader label="Preparing the booking form…" />;

  if (!profile) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-xl font-semibold tracking-[-0.015em] text-ink-900">
          We could not load your account
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Please sign out and sign in again. If it keeps happening, an administrator needs to
          deploy the database rules.
        </p>
      </div>
    );
  }

  if (profile.verificationRequired && !profile.emailOtpVerified && !user?.emailVerified) {
    return <div className="card mx-auto max-w-lg p-6"><h1 className="page-title">Verify your email</h1><p className="page-lede mt-2">Open the verification link sent to your email before requesting a venue.</p><Link href="/verify-email" className="btn btn-primary mt-4">Continue to email verification</Link></div>;
  }

  return <BookingFields key={profile.uid} defaultFullName={profile.fullName} grade={profile.grade ?? ""} section={profile.section ?? ""} idPhotoUrl={profile.idPhotoUrl ?? null} />;
}

function BookingFields({ defaultFullName, grade, section, idPhotoUrl }: { defaultFullName: string; grade: string; section: string; idPhotoUrl: string | null }) {
  const facilities = useFacilities();
  const { calendar } = useSchoolCalendar();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const initialFacility = searchParams.get("facility");
  const initialDate = searchParams.get("date");

  const [facilityId, setFacilityId] = useState<FacilityId>(
    initialFacility || "gymnasium",
  );

  const maxDate = useMemo(() => {
    const rollingLimit = toDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS));
    return rollingLimit < calendar.endDate ? rollingLimit : calendar.endDate;
  }, [calendar.endDate]);

  const [date, setDate] = useState(
    initialDate && initialDate >= todayKey() && initialDate <= maxDate ? initialDate : todayKey(),
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [rangeCheckError, setRangeCheckError] = useState<string | null>(null);
  const [checkedKey, setCheckedKey] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);

  const [fullName, setFullName] = useState(defaultFullName);
  const [equipment, setEquipment] = useState<Record<string, number>>({});
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("1");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);


  const startMin = startTime ? parseClockInput(startTime) : null;
  const endMin = endTime ? parseClockInput(endTime) : null;

  // On today's date, anything that has already started is off limits.
  const earliest = earliestBookableMinutes(date);
  const minMinutes = earliest === null ? OPENING_MINUTES : Math.max(OPENING_MINUTES, earliest);
  const dateIsUnbookable = earliest === null || Boolean(schoolDayReason(date, calendar));

  const rangeValid =
    !dateIsUnbookable &&
    startMin !== null &&
    endMin !== null &&
    endMin > startMin &&
    endMin - startMin >= MIN_DURATION_MINUTES &&
    startMin >= OPENING_MINUTES &&
    endMin <= CLOSING_MINUTES &&
    startMin >= minMinutes;

  // Re-check the range against Firestore whenever it settles on a new value.
  const rangeKey = rangeValid ? `${facilityId}:${date}:${startMin}:${endMin}` : "";

  useEffect(() => {
    if (!rangeKey) return;

    let active = true;
    findRangeConflicts(facilityId, date, fromMinutes(startMin!), fromMinutes(endMin!))
      .then(({ hard, pending }) => {
        if (!active) return;
        setConflict(hard);
        setSoftWarning(pending);
        setRangeCheckError(null);
        setCheckedKey(rangeKey);
      })
      .catch(() => {
        if (!active) return;
        setConflict(null);
        setSoftWarning(null);
        setRangeCheckError("We couldn't check availability. Try again before submitting your request.");
        setCheckedKey(rangeKey);
      });

    return () => {
      active = false;
    };
  }, [rangeKey, facilityId, date, startTime, endTime, startMin, endMin, checkAttempt]);

  // Results only apply to the exact range they were fetched for.
  const checking = Boolean(rangeKey) && checkedKey !== rangeKey;
  const activeConflict = checkedKey === rangeKey ? conflict : null;
  const activeWarning = checkedKey === rangeKey && !conflict ? softWarning : null;
  const activeRangeCheckError = checkedKey === rangeKey ? rangeCheckError : null;

  function changeFacility(next: FacilityId) {
    setFacilityId(next);
  }

  function changeDate(next: string) {
    const [year, month, day] = next.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setDate(`${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`);
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    if (fullName.trim().length < 3) next.fullName = "Please enter the full name.";
    if (!grade || !section || !idPhotoUrl) next.profile = "Complete your grade, section, and school ID in your profile before booking.";
    if (!date) next.date = "Choose a date.";
    else if (date < todayKey() || date > maxDate) next.date = `Choose a date within the next ${BOOKING_WINDOW_DAYS} days.`;
    else if (schoolDayReason(date, calendar)) next.date = schoolDayReason(date, calendar)!;

    if (startMin === null) next.startTime = "Type a start time, for example 1 PM.";
    if (endMin === null) next.endTime = "Type an end time, for example 4 PM.";

    if (startMin !== null && endMin !== null) {
      if (endMin <= startMin) next.endTime = "The end time must be after the start time.";
      else if (endMin - startMin < MIN_DURATION_MINUTES) {
        next.endTime = `Bookings must be at least ${MIN_DURATION_MINUTES / 60} hour.`;
      } else if (startMin < OPENING_MINUTES || endMin > CLOSING_MINUTES) {
        next.startTime = `The venue is open ${formatClock(OPENING_MINUTES)} – ${formatClock(CLOSING_MINUTES)}.`;
      } else if (startMin < minMinutes) {
        next.startTime = `That time has already passed. The earliest start today is ${formatClock(minMinutes)}.`;
      }
    }

    if (activeConflict) next.startTime = activeConflict;
    if (activeRangeCheckError) next.startTime = activeRangeCheckError;
    else if (checking) next.startTime = "Please wait while we check availability.";

    const count = Number(attendees);
    if (!Number.isFinite(count) || count < 1) next.attendees = "Enter at least 1 attendee.";
    if (purpose.trim().length < 3) next.purpose = "Tell us what the reservation is for.";

    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      document
        .querySelector('[aria-invalid="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!user) return;

    setSubmitting(true);
    setError(null);
    try {
      await createBooking({
        facilityId,
        date,
        startTime: fromMinutes(startMin!),
        endTime: fromMinutes(endMin!),
        fullName: fullName.trim(),
        grade,
        section,
        idPhotoUrl,
        equipment,
        purpose: purpose.trim(),
        attendees: Number(attendees),
        notes: notes.trim(),
        userId: user.uid,
      });

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your request. Please check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="animate-fade-up mx-auto max-w-xl py-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-available-soft text-available">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.025em] text-ink-900">
          Request sent!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink-600">
          Your booking for{" "}
          <span className="font-semibold text-ink-900">{facilities.find((facility) => facility.id === facilityId)?.name ?? FACILITY_BY_ID[facilityId]?.name}</span>{" "}
          on <span className="font-semibold text-ink-900">{formatLongDate(date)}</span> (
          {formatTimeRange(startTime, endTime)}) is now awaiting approval.
        </p>
        <p className="mt-2 text-sm text-ink-500">
          We&rsquo;ll notify you as soon as an admin reviews it.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/reservations" className="btn btn-primary">
            View my reservations
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setSubmitting(false);
              setPurpose("");
              setNotes("");
              setEquipment({});
            }}
            className="btn btn-outline"
          >
            Book another slot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="page-title">Book a Facility</h1>
        <p className="page-lede">
          Pick a venue, weekday, and exact time, then send the request for approval.
        </p>
      </header>

      {/* ── Facility picker ─────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {facilities.map((facility) => {
          const Icon = ICONS[facility.id] ?? Dumbbell;
          const active = facility.id === facilityId;

          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => changeFacility(facility.id)}
              aria-pressed={active}
              className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-brand-300 bg-brand-50"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
                  active ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-500"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold tracking-[-0.015em] text-ink-900">
                  {facility.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  Capacity {facility.capacity} &middot; {facility.description}
                </span>
              </span>
              {active && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-brand-700" />}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-4 sm:p-6" noValidate>
        {error && (
          <p role="alert" className="banner banner-error animate-shake font-medium">
            {error}
          </p>
        )}

        {/* ── Date + time ──────────────────────────────────── */}
        <fieldset>
          <legend className="field-label mb-2.5">When do you need it?</legend>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select aria-label="Month" value={fromDateKey(date).getMonth() + 1} onChange={(event) => changeDate(`${date.slice(0, 4)}-${event.target.value.padStart(2, "0")}-${date.slice(8)}`)} className="field w-auto">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2026,i,1).toLocaleString("en-PH",{month:"long"})}</option>)}</select>
            <select aria-label="Day" value={fromDateKey(date).getDate()} onChange={(event) => changeDate(`${date.slice(0, 8)}${event.target.value.padStart(2, "0")}`)} className="field w-auto">{Array.from({length:new Date(fromDateKey(date).getFullYear(),fromDateKey(date).getMonth()+1,0).getDate()},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select>
            <select aria-label="Year" value={fromDateKey(date).getFullYear()} onChange={(event) => changeDate(`${event.target.value}${date.slice(4)}`)} className="field w-auto">{[2026,2027].map((year)=><option key={year} value={year}>{year}</option>)}</select>
            <p className="text-xs text-ink-500">{formatLongDate(date)}</p>
            {schoolDayReason(date, calendar) && <p className="text-xs font-medium text-booked">{schoolDayReason(date, calendar)}</p>}
          </div>

          {/* Free-form start and end, to the minute. */}
          <div className="mb-5 grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-2">
              <div>
                <label htmlFor="startTime" className="field-label">
                  From
                </label>
                <input
                  id="startTime"
                  type="text"
                  inputMode="text"
                  placeholder="1 PM or 13:00"
                  value={startTime}
                  disabled={dateIsUnbookable}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, startTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.startTime)}
                  className="field w-40"
                />
              </div>

              <span className="mt-5 text-ink-400">to</span>

              <div>
                <label htmlFor="endTime" className="field-label">
                  To
                </label>
                <input
                  id="endTime"
                  type="text"
                  inputMode="text"
                  placeholder="4 PM or 16:00"
                  value={endTime}
                  disabled={dateIsUnbookable}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, endTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.endTime)}
                  className="field w-40"
                />
              </div>
            </div>

            <p className="self-end pb-2 text-xs leading-relaxed text-ink-500 sm:pb-3">
              Any duration you like, from{" "}
              {formatClock(OPENING_MINUTES)} to {formatClock(CLOSING_MINUTES)}.
              {!startTime && !endTime && (
                <>
                  {" "}
                  Tip: 9:00 – 12:00 works even though it crosses a block boundary.
                </>
              )}
            </p>
          </div>

          <div className="mb-3 flex flex-wrap gap-2" aria-label="Quick time choices">
            {[9, 10, 13, 14, 15, 16].map((hour) => <button type="button" key={hour} disabled={dateIsUnbookable} onClick={() => { setStartTime(fromMinutes(hour * 60)); setEndTime(fromMinutes(Math.min(hour + 1, 19) * 60)); }} className="badge border border-ink-300 bg-white px-2 py-1 text-ink-700">{formatClock(hour * 60)} start</button>)}
          </div>

          {fieldErrors.startTime && (
            <p className="mb-2 text-xs font-medium text-booked">{fieldErrors.startTime}</p>
          )}
          {fieldErrors.endTime && (
            <p className="mb-2 text-xs font-medium text-booked">{fieldErrors.endTime}</p>
          )}

          {activeConflict && <p className="banner banner-error mb-2 font-medium">{activeConflict}</p>}

          {activeWarning && (
            <p className="banner banner-warning mb-2 font-medium">{activeWarning}</p>
          )}

          {checking && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking that time is free…
            </p>
          )}

          {activeRangeCheckError && (
            <div role="alert" className="banner banner-error mb-2 flex flex-wrap items-center justify-between gap-2">
              <span>{activeRangeCheckError}</span>
              <button
                type="button"
                className="text-xs font-semibold underline"
                onClick={() => {
                  setCheckedKey("");
                  setRangeCheckError(null);
                  setCheckAttempt((attempt) => attempt + 1);
                }}
              >
                Retry check
              </button>
            </div>
          )}

          {!activeConflict && !activeWarning && !checking && !activeRangeCheckError && startTime && endTime && (
            <p className="text-xs text-ink-500">
              {formatTimeRange(startTime, endTime)} looks free. You can still{" "}
              <Link href={`/availability?facility=${facilityId}&date=${date}`} className="link">
                check the full schedule
              </Link>
              .
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="field-label mb-2">Booking details</legend>
          {fieldErrors.profile && <p className="banner banner-error sm:col-span-2">{fieldErrors.profile}</p>}
          <p className="text-sm text-ink-600 sm:col-span-2">Grade {grade || "—"} · Section {section || "—"} · School ID {idPhotoUrl ? "on file" : "missing"}. <Link href="/profile" className="link">Update profile</Link></p>
          <div><label htmlFor="fullName" className="field-label">Full name</label><input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" aria-invalid={Boolean(fieldErrors.fullName)} />{fieldErrors.fullName && <p className="text-xs text-booked">{fieldErrors.fullName}</p>}</div>
          <div><label htmlFor="attendees" className="field-label">Expected attendees</label><input id="attendees" type="number" min={1} max={500} value={attendees} onChange={(event) => setAttendees(event.target.value)} className="field" aria-invalid={Boolean(fieldErrors.attendees)} />{fieldErrors.attendees && <p className="text-xs text-booked">{fieldErrors.attendees}</p>}</div>
          <div className="sm:col-span-2"><label htmlFor="purpose" className="field-label">Purpose</label><input id="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} className="field" aria-invalid={Boolean(fieldErrors.purpose)} />{fieldErrors.purpose && <p className="text-xs text-booked">{fieldErrors.purpose}</p>}</div>
          <div className="sm:col-span-2"><label htmlFor="notes" className="field-label">Notes (optional)</label><textarea id="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="field" /></div>
        </fieldset>

        <fieldset className="rounded-lg border border-ink-200 p-4">
          <legend className="field-label px-1">Equipment requested</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Speakers", "Tables", "Microphones"].map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={Boolean(equipment[item])} onChange={(event) => setEquipment((current) => ({ ...current, [item]: event.target.checked ? 1 : 0 }))} />
                {item}
                {Boolean(equipment[item]) && <input type="number" min={1} max={100} aria-label={item + " quantity"} value={equipment[item]} onChange={(event) => setEquipment((current) => ({ ...current, [item]: Math.min(100, Math.max(1, Number(event.target.value) || 1)) }))} className="field ml-auto w-16" />}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-200 pt-5 sm:flex-row sm:justify-end">
          <Link href="/availability" className="btn btn-ghost">
            Check availability first
          </Link>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending request…
              </>
            ) : (
              <>
                <CalendarCheck className="h-4 w-4" />
                Submit for approval
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-ink-500">
        Your request stays <span className="font-semibold">Pending</span> until an admin reviews it.
      </p>
    </div>
  );
}
