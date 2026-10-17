"use client";

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  ImageUp,
  Loader2,
  MonitorPlay,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullPageLoader } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_WINDOW_DAYS,
  CLOSING_MINUTES,
  FACILITIES,
  FACILITY_BY_ID,
  GRADES,
  MAX_ID_PHOTO_BYTES,
  MIN_DURATION_MINUTES,
  OPENING_MINUTES,
  SECTION_MAX_LENGTH,
} from "@/lib/constants";
import {
  createBooking,
  findRangeConflicts,
  uploadIdPhoto,
  validateIdPhoto,
} from "@/lib/data";
import { addDays, formatLongDate, todayKey, toDateKey } from "@/lib/dates";
import { earliestBookableMinutes } from "@/lib/booking-phase";
import {
  friendlyStorageError,
  withTimeout,
} from "@/lib/load-errors";
import { formatClock, formatTimeRange, fromMinutes, toMinutes } from "@/lib/time";
import type { FacilityId } from "@/lib/types";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

/** Storage can take a minute to give up; fail faster so the form stays usable. */
const UPLOAD_TIMEOUT_MS = 15_000;

export function BookingForm() {
  const { profile, initialising } = useAuth();

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

  return <BookingFields key={profile.uid} defaultFullName={profile.fullName} />;
}

function BookingFields({ defaultFullName }: { defaultFullName: string }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const initialFacility = searchParams.get("facility");
  const initialDate = searchParams.get("date");

  const [facilityId, setFacilityId] = useState<FacilityId>(
    initialFacility === "avr" ? "avr" : initialFacility === "gymnasium" ? "gymnasium" : "gymnasium",
  );

  const maxDate = useMemo(() => toDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS)), []);

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
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [skipPhoto, setSkipPhoto] = useState(false);

  const [fullName, setFullName] = useState(defaultFullName);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("1");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const startMin = startTime ? toMinutes(startTime) : null;
  const endMin = endTime ? toMinutes(endTime) : null;

  // On today's date, anything that has already started is off limits.
  const earliest = earliestBookableMinutes(date);
  const minMinutes = earliest === null ? OPENING_MINUTES : Math.max(OPENING_MINUTES, earliest);
  const maxMinutes = CLOSING_MINUTES;
  const dateIsUnbookable = earliest === null;

  const rangeValid =
    startMin !== null &&
    endMin !== null &&
    endMin > startMin &&
    endMin - startMin >= MIN_DURATION_MINUTES &&
    startMin >= OPENING_MINUTES &&
    endMin <= CLOSING_MINUTES &&
    startMin >= minMinutes;

  // Re-check the range against Firestore whenever it settles on a new value.
  const rangeKey = rangeValid ? `${facilityId}:${date}:${startTime}:${endTime}` : "";

  useEffect(() => {
    if (!rangeKey) return;

    let active = true;
    findRangeConflicts(facilityId, date, startTime, endTime)
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
  }, [rangeKey, facilityId, date, startTime, endTime, checkAttempt]);

  // Results only apply to the exact range they were fetched for.
  const checking = Boolean(rangeKey) && checkedKey !== rangeKey;
  const activeConflict = checkedKey === rangeKey ? conflict : null;
  const activeWarning = checkedKey === rangeKey && !conflict ? softWarning : null;
  const activeRangeCheckError = checkedKey === rangeKey ? rangeCheckError : null;

  function changeFacility(next: FacilityId) {
    setFacilityId(next);
  }

  function changeDate(next: string) {
    setDate(next);
  }

  function handleFile(file: File | null) {
    setError(null);

    if (!file) {
      setFile(null);
      setPreview(null);
      return;
    }

    const problem = validateIdPhoto(file);
    if (problem) {
      setError(problem);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(file);
    setSkipPhoto(false);
    setPhotoUploadFailed(false);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }

  // Release the object URL when the component goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    if (fullName.trim().length < 3) next.fullName = "Please enter the full name.";
    if (!grade) next.grade = "Choose your grade.";
    if (!section) next.section = "Enter your section.";
    if (!file && !skipPhoto) next.file = "Please attach a photo of your school ID.";
    if (!date) next.date = "Choose a date.";

    if (!startTime) next.startTime = "Choose a start time.";
    if (!endTime) next.endTime = "Choose an end time.";

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
    setPhotoUploadFailed(false);

    try {
      let idPhotoUrl: string | null = null;

      if (file && !skipPhoto) {
        try {
          idPhotoUrl = await withTimeout(uploadIdPhoto(file, user.uid), UPLOAD_TIMEOUT_MS);
        } catch (uploadError) {
          // A storage outage must not block the whole system. Tell the student
          // plainly and let the request through without the photo.
          setPhotoUploadFailed(true);
          setError(friendlyStorageError(uploadError));
        }
      }

      await createBooking({
        facilityId,
        date,
        startTime,
        endTime,
        fullName: fullName.trim(),
        grade,
        section: section.trim(),
        idPhotoUrl,
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
          <span className="font-semibold text-ink-900">{FACILITY_BY_ID[facilityId]?.name}</span>{" "}
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
              handleFile(null);
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
          Pick a venue and an open slot, attach your school ID, then send it for approval.
        </p>
      </header>

      {/* ── Facility picker ─────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {FACILITIES.map((facility) => {
          const Icon = ICONS[facility.id];
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

      <form onSubmit={handleSubmit} className="card space-y-7 p-6 sm:p-8" noValidate>
        {error && (
          <p role="alert" className="banner banner-error animate-shake font-medium">
            {error}
          </p>
        )}

        {/* ── Date + time ──────────────────────────────────── */}
        <fieldset>
          <legend className="field-label mb-2.5">When do you need it?</legend>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              min={todayKey()}
              max={maxDate}
              onChange={(event) => changeDate(event.target.value)}
              aria-invalid={Boolean(fieldErrors.date)}
              className="field w-auto"
            />
            <p className="text-xs text-ink-500">{formatLongDate(date)}</p>
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
                  type="time"
                  step={900}
                  value={startTime}
                  min={fromMinutes(minMinutes)}
                  max={fromMinutes(maxMinutes)}
                  disabled={dateIsUnbookable}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, startTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.startTime)}
                  className="field w-36"
                />
              </div>

              <span className="mt-5 text-ink-400">to</span>

              <div>
                <label htmlFor="endTime" className="field-label">
                  To
                </label>
                <input
                  id="endTime"
                  type="time"
                  step={900}
                  value={endTime}
                  min={fromMinutes(minMinutes)}
                  max={fromMinutes(maxMinutes)}
                  disabled={dateIsUnbookable}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, endTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.endTime)}
                  className="field w-36"
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

        {/* ── Details ──────────────────────────────────────── */}
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Your details</legend>

          <div className="sm:col-span-2">
            <label htmlFor="fullName" className="field-label">
              Full name <span className="text-booked">*</span>
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Juan Dela Cruz"
              aria-invalid={Boolean(fieldErrors.fullName)}
              className="field"
            />
            {fieldErrors.fullName && (
              <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label htmlFor="grade" className="field-label">
              Grade <span className="text-booked">*</span>
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              aria-invalid={Boolean(fieldErrors.grade)}
              className="field"
            >
              <option value="">Select grade</option>
              {GRADES.map((value) => (
                <option key={value} value={value}>
                  Grade {value}
                </option>
              ))}
            </select>
            {fieldErrors.grade && (
              <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.grade}</p>
            )}
          </div>

          <div>
            <label htmlFor="section" className="field-label">
              Section <span className="text-booked">*</span>
            </label>
            <input
              id="section"
              type="text"
              value={section}
              onChange={(event) => setSection(event.target.value)}
              placeholder="e.g. F, STEM 1, Rizal"
              autoComplete="off"
              maxLength={SECTION_MAX_LENGTH}
              aria-invalid={Boolean(fieldErrors.section)}
              className="field"
            />
            {fieldErrors.section && (
              <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.section}</p>
            )}
          </div>

          <div>
            <label htmlFor="attendees" className="field-label">
              Expected attendees
            </label>
            <input
              id="attendees"
              type="number"
              min={1}
              max={500}
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
              aria-invalid={Boolean(fieldErrors.attendees)}
              className="field"
            />
            {fieldErrors.attendees && (
              <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.attendees}</p>
            )}
          </div>

          <div>
            <label htmlFor="purpose" className="field-label">
              Purpose <span className="text-booked">*</span>
            </label>
            <input
              id="purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="e.g. Grade 11 practical exam"
              aria-invalid={Boolean(fieldErrors.purpose)}
              className="field"
            />
            {fieldErrors.purpose && (
              <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.purpose}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="field-label">
              Notes <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Anything the admin should know?"
              className="field resize-y"
            />
          </div>
        </fieldset>

        {/* ── School ID ────────────────────────────────────── */}
        <div>
          <span className="field-label">
            School ID photo <span className="text-booked">*</span>
          </span>

          {preview ? (
            <div className="flex items-center gap-4 rounded-lg bg-ink-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Selected school ID preview"
                className="h-20 w-32 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{file?.name}</p>
                <p className="text-xs text-ink-500">
                  {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleFile(null)}
                aria-label="Remove selected photo"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-200 hover:text-booked"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="idPhoto"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg bg-ink-100 px-4 py-8 text-center transition-colors hover:bg-ink-200"
            >
              <ImageUp className="h-7 w-7 text-brand-700" />
              <span className="mt-2.5 text-sm font-semibold text-ink-800">
                Tap to upload your school ID
              </span>
              <span className="mt-1 text-xs text-ink-500">
                JPG, PNG or WEBP &middot; max {Math.round(MAX_ID_PHOTO_BYTES / 1024)} KB
              </span>
              <input
                ref={fileInputRef}
                id="idPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                aria-invalid={Boolean(fieldErrors.file)}
                className="sr-only"
              />
            </label>
          )}

          {fieldErrors.file && (
            <p className="mt-2 text-xs font-medium text-booked">{fieldErrors.file}</p>
          )}

          {photoUploadFailed && (
            <div className="banner banner-warning mt-4">
              <p className="font-medium">Your ID photo did not upload, but you can still submit.</p>
              <p className="mt-1 text-xs font-medium text-ink-500">
                An admin can request the photo later. If this keeps happening, ask them to
                check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="mt-2 text-xs font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {preview && !skipPhoto && (
            <button
              type="button"
              onClick={() => {
                setSkipPhoto(true);
                setError(null);
              }}
              className="link mt-2.5 text-xs"
            >
              Skip the photo and submit without it
            </button>
          )}
        </div>

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
