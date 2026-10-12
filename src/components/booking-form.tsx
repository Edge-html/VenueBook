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
  FACILITIES,
  FACILITY_BY_ID,
  GRADES,
  SECTIONS,
  TIME_SLOTS,
} from "@/lib/constants";
import { createBooking, getMonthAvailability, uploadIdPhoto, validateIdPhoto } from "@/lib/data";
import { addDays, formatLongDate, todayKey, toDateKey } from "@/lib/dates";
import type { FacilityId, SlotState } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

export function BookingForm() {
  const { profile } = useAuth();

  // Wait for the profile so the name field can start filled in, instead of
  // syncing it into state from an effect after mount.
  if (!profile) return <FullPageLoader label="Preparing the booking form…" />;

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
  const [timeSlot, setTimeSlot] = useState<string>("");

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

  const { data: slotData, loading: loadingSlots, reload: reloadSlots } = useAsyncData<
    Record<string, Record<string, SlotState>>
  >({
    cacheKey: `slots:${facilityId}:${date}`,
    load: loadSlots,
    fallback: {},
  });

  const slots = slotData?.[date];

  /** A slot held by someone else must not stay selected after a switch. */
  function changeFacility(next: FacilityId) {
    setFacilityId(next);
    setTimeSlot("");
  }

  function changeDate(next: string) {
    setDate(next);
    setTimeSlot("");
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
    if (!timeSlot) next.timeSlot = "Pick an available time slot.";

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
        timeSlot,
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
    const slot = TIME_SLOTS.find((s) => s.id === timeSlot);

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
          {slot?.label}) is now awaiting approval.
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIME_SLOTS.map((slot) => {
              const state: SlotState = slots?.[slot.id] ?? "available";
              const unavailable = state !== "available";

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={loadingSlots || unavailable}
                  onClick={() => setTimeSlot(slot.id)}
                  aria-pressed={timeSlot === slot.id}
                  title={unavailable ? `This slot is ${state}.` : undefined}
                  className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                    timeSlot === slot.id
                      ? "bg-maroon-700 text-white shadow-sm"
                      : state === "available"
                        ? "bg-available-soft text-available hover:bg-available hover:text-white"
                        : "cursor-not-allowed bg-cream-200 text-neutral-400"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          {fieldErrors.timeSlot && (
            <p className="mt-1.5 text-xs font-medium text-booked">{fieldErrors.timeSlot}</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Green slots are open. Booked and pending slots cannot be chosen.
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