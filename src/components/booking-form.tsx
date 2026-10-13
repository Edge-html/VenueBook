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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FullPageLoader } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import {
  BOOKING_WINDOW_DAYS,
  CLOSING_MINUTES,
  FACILITIES,
  FACILITY_BY_ID,
  GRADES,
  MIN_DURATION_MINUTES,
  OPENING_MINUTES,
  SECTIONS,
  TIME_BLOCKS,
} from "@/lib/constants";
import {
  createBooking,
  findRangeConflicts,
  getMonthAvailability,
  uploadIdPhoto,
  validateIdPhoto,
} from "@/lib/data";
import { addDays, formatLongDate, todayKey, toDateKey } from "@/lib/dates";
import { describeLoadError } from "@/lib/load-errors";
import { formatClock, formatTimeRange, hourLabel, overlaps, toMinutes } from "@/lib/time";
import type { FacilityId, SlotState } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

export function BookingForm() {
  const { profile, initialising } = useAuth();

  // Wait for the auth state so the name field can start filled in. Spinning on
  // `profile` alone would hang forever if the profile read was refused.
  if (initialising) return <FullPageLoader label="Preparing the booking form…" />;

  if (!profile) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-lg font-bold text-maroon-900">
          We could not load your account
        </p>
        <p className="mt-1.5 text-sm text-neutral-600">
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
  const [checkedKey, setCheckedKey] = useState("");

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

  const loadSlots = useCallback(
    () => getMonthAvailability(facilityId, [date]),
    [facilityId, date],
  );

  const {
    data: slotData,
    error: slotsError,
    loading: loadingSlots,
    reload: reloadSlots,
  } = useAsyncData<Record<string, Record<string, SlotState>>>({
    cacheKey: `slots:${facilityId}:${date}`,
    load: loadSlots,
    fallback: {},
  });

  const slots = slotData?.[date];
  const slotError = slotsError
    ? describeLoadError(new Error(slotsError), "Could not load the schedule.")
    : null;

  const startMin = startTime ? toMinutes(startTime) : null;
  const endMin = endTime ? toMinutes(endTime) : null;

  const rangeValid =
    startMin !== null &&
    endMin !== null &&
    endMin > startMin &&
    endMin - startMin >= MIN_DURATION_MINUTES &&
    startMin >= OPENING_MINUTES &&
    endMin <= CLOSING_MINUTES;

  /** Which fixed blocks the chosen range touches, for the at-a-glance strip. */
  const coveredBlocks = useMemo(() => {
    if (startMin === null || endMin === null) return new Set<string>();
    return new Set(
      TIME_BLOCKS.filter((b) => overlaps(startMin, endMin, b.startMin, b.endMin)).map((b) => b.id),
    );
  }, [startMin, endMin]);

  // Re-check the range against Firestore whenever it settles on a new value.
  const rangeKey = rangeValid ? `${facilityId}:${date}:${startTime}:${endTime}` : "";

  useEffect(() => {
    if (!rangeKey || slotError) return;

    let active = true;

    findRangeConflicts(facilityId, date, startTime, endTime)
      .then(({ hard, pending }) => {
        if (!active) return;
        setConflict(hard);
        setSoftWarning(pending);
        setCheckedKey(rangeKey);
      })
      .catch(() => {
        if (!active) return;
        setConflict(null);
        setSoftWarning(null);
        setCheckedKey(rangeKey);
      });

    return () => {
      active = false;
    };
  }, [rangeKey, slotError, facilityId, date, startTime, endTime]);

  // Results only apply to the exact range they were fetched for.
  const checking = Boolean(rangeKey) && checkedKey !== rangeKey;
  const activeConflict = checkedKey === rangeKey ? conflict : null;
  const activeWarning = checkedKey === rangeKey && !conflict ? softWarning : null;

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
    if (!section) next.section = "Choose your section.";
    if (!file) next.file = "Please attach a photo of your school ID.";
    if (!date) next.date = "Choose a date.";

    if (!startTime) next.startTime = "Choose a start time.";
    if (!endTime) next.endTime = "Choose an end time.";

    if (startMin !== null && endMin !== null) {
      if (endMin <= startMin) next.endTime = "The end time must be after the start time.";
      else if (endMin - startMin < MIN_DURATION_MINUTES) {
        next.endTime = `Bookings must be at least ${MIN_DURATION_MINUTES / 60} hour.`;
      } else if (startMin < OPENING_MINUTES || endMin > CLOSING_MINUTES) {
        next.startTime = `The venue is open ${formatClock(OPENING_MINUTES)} – ${formatClock(CLOSING_MINUTES)}.`;
      }
    }

    if (activeConflict) next.startTime = activeConflict;

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
      const idPhotoUrl = file ? await uploadIdPhoto(file, user.uid) : null;

      await createBooking({
        facilityId,
        date,
        startTime,
        endTime,
        fullName: fullName.trim(),
        grade,
        section,
        idPhotoUrl,
        purpose: purpose.trim(),
        attendees: Number(attendees),
        notes: notes.trim(),
        userId: user.uid,
      });

      setSubmitted(true);
      reloadSlots();
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
        <h1 className="mt-5 font-display text-2xl font-extrabold text-maroon-900">
          Request sent!
        </h1>
        <p className="mt-2 text-neutral-600">
          Your booking for{" "}
          <span className="font-semibold text-neutral-900">{FACILITY_BY_ID[facilityId]?.name}</span>{" "}
          on <span className="font-semibold text-neutral-900">{formatLongDate(date)}</span> (
          {formatTimeRange(startTime, endTime)}) is now awaiting approval.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          We&rsquo;ll notify you as soon as an admin reviews it.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
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
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-maroon-900">Book a Facility</h1>
        <p className="mt-1.5 text-neutral-600">
          Pick a venue and an open slot, attach your school ID, then send it for approval.
        </p>
      </header>

      {/* ── Facility picker ─────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {FACILITIES.map((facility) => {
          const Icon = ICONS[facility.id];
          const active = facility.id === facilityId;

          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => changeFacility(facility.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                active
                  ? "border-maroon-700 bg-maroon-50"
                  : "border-cream-300 bg-white hover:border-maroon-200"
              }`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  active ? "bg-maroon-700 text-white" : "bg-cream-200 text-maroon-700"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-bold text-neutral-900">
                  {facility.name}
                </span>
                <span className="block text-xs text-neutral-600">
                  Capacity {facility.capacity} &middot; {facility.description}
                </span>
              </span>
              {active && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-maroon-700" />}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6" noValidate>
        {error && (
          <p
            role="alert"
            className="animate-shake rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm font-medium text-booked"
          >
            {error}
          </p>
        )}

        {/* ── Date + time ──────────────────────────────────── */}
        <fieldset>
          <legend className="field-label mb-2">When do you need it?</legend>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              min={todayKey()}
              max={maxDate}
              onChange={(event) => changeDate(event.target.value)}
              aria-invalid={Boolean(fieldErrors.date)}
              className="field w-auto"
            />
            <p className="text-xs text-neutral-500">{formatLongDate(date)}</p>
          </div>

          {slotError && (
            <p className="mb-3 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm text-booked">
              {slotError}
            </p>
          )}

          {/* Free-form start and end, to the minute. */}
          <div className="mb-4 grid gap-3 sm:grid-cols-[auto_1fr]">
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
                  min={hourLabel(OPENING_MINUTES / 60)}
                  max={hourLabel(CLOSING_MINUTES / 60)}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, startTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.startTime)}
                  className="field w-36"
                />
              </div>

              <span className="mt-5 text-neutral-400">to</span>

              <div>
                <label htmlFor="endTime" className="field-label">
                  To
                </label>
                <input
                  id="endTime"
                  type="time"
                  step={900}
                  value={endTime}
                  min={hourLabel(OPENING_MINUTES / 60)}
                  max={hourLabel(CLOSING_MINUTES / 60)}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, endTime: "" }));
                  }}
                  aria-invalid={Boolean(fieldErrors.endTime)}
                  className="field w-36"
                />
              </div>
            </div>

            <p className="self-end pb-2 text-xs text-neutral-500 sm:pb-3">
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

          {activeConflict && (
            <p className="mb-2 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm font-medium text-booked">
              {activeConflict}
            </p>
          )}

          {activeWarning && (
            <p className="mb-2 rounded-lg border border-pending/40 bg-pending-soft px-3 py-2.5 text-sm font-medium text-pending">
              {activeWarning}
            </p>
          )}

          {checking && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking that time is free…
            </p>
          )}

          {/* At-a-glance view of the blocks the range covers. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIME_BLOCKS.map((block) => {
              const state: SlotState = slots?.[block.id] ?? "available";
              const covered = coveredBlocks.has(block.id);

              return (
                <div
                  key={block.id}
                  title={`${block.label} — ${state}`}
                  className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                    covered && rangeValid
                      ? "bg-maroon-700 text-white shadow-sm"
                      : state === "available"
                        ? "bg-available-soft text-available"
                        : state === "booked"
                          ? "bg-booked-soft text-booked"
                          : state === "pending"
                            ? "bg-pending-soft text-pending"
                            : "bg-cream-200 text-neutral-400"
                  } ${loadingSlots ? "opacity-60" : ""}`}
                >
                  {block.label}
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            Green is open, red is booked, amber is awaiting approval, grey is closed. Your chosen
            range is highlighted in maroon.
          </p>
        </fieldset>

        {/* ── Details ──────────────────────────────────────── */}
        <fieldset className="grid gap-4 sm:grid-cols-2">
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
              <p className="mt-1 text-xs font-medium text-booked">{fieldErrors.fullName}</p>
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
              <p className="mt-1 text-xs font-medium text-booked">{fieldErrors.grade}</p>
            )}
          </div>

          <div>
            <label htmlFor="section" className="field-label">
              Section <span className="text-booked">*</span>
            </label>
            <select
              id="section"
              value={section}
              onChange={(event) => setSection(event.target.value)}
              aria-invalid={Boolean(fieldErrors.section)}
              className="field"
            >
              <option value="">Select section</option>
              {SECTIONS.map((value) => (
                <option key={value} value={value}>
                  Section {value}
                </option>
              ))}
            </select>
            {fieldErrors.section && (
              <p className="mt-1 text-xs font-medium text-booked">{fieldErrors.section}</p>
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
              <p className="mt-1 text-xs font-medium text-booked">{fieldErrors.attendees}</p>
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
              <p className="mt-1 text-xs font-medium text-booked">{fieldErrors.purpose}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="field-label">
              Notes <span className="font-normal text-neutral-500">(optional)</span>
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
            <div className="flex items-center gap-4 rounded-xl border border-cream-300 bg-cream-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Selected school ID preview"
                className="h-20 w-32 rounded-lg border border-cream-300 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">{file?.name}</p>
                <p className="text-xs text-neutral-500">
                  {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleFile(null)}
                aria-label="Remove selected photo"
                className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-cream-200 hover:text-booked"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="idPhoto"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cream-300 bg-cream-50 px-4 py-7 text-center transition-colors hover:border-maroon-300 hover:bg-maroon-50/40"
            >
              <ImageUp className="h-7 w-7 text-maroon-600" />
              <span className="mt-2 text-sm font-semibold text-neutral-800">
                Tap to upload your school ID
              </span>
              <span className="mt-0.5 text-xs text-neutral-500">JPG, PNG or WEBP &middot; max 5 MB</span>
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
            <p className="mt-1.5 text-xs font-medium text-booked">{fieldErrors.file}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-cream-200 pt-5 sm:flex-row sm:justify-end">
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

      <p className="mt-4 text-center text-xs text-neutral-500">
        Your request stays <span className="font-semibold">Pending</span> until an admin reviews it.
      </p>
    </div>
  );
}