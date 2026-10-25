"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_SCHOOL_CALENDAR, type SchoolCalendarSettings } from "@/lib/dates";
import { db } from "@/lib/firebase";
import { ensureSchoolCalendar, saveSchoolCalendar } from "@/lib/data";

export function SchoolCalendarManager() {
  const { profile, user } = useAuth();
  const isSuperAdmin = Boolean(profile && !profile.assignedFacilityIds?.length);
  const [calendar, setCalendar] = useState<SchoolCalendarSettings>(DEFAULT_SCHOOL_CALENDAR);
  const [yearLabel, setYearLabel] = useState(DEFAULT_SCHOOL_CALENDAR.schoolYearLabel);
  const [startDate, setStartDate] = useState(DEFAULT_SCHOOL_CALENDAR.startDate);
  const [endDate, setEndDate] = useState(DEFAULT_SCHOOL_CALENDAR.endDate);
  const [closedDate, setClosedDate] = useState("");
  const [closedReason, setClosedReason] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seedAttempted = useRef(false);

  useEffect(() => onSnapshot(doc(db, "schoolCalendar", "current"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const current: SchoolCalendarSettings = {
        schoolYearLabel: String(data.schoolYearLabel ?? DEFAULT_SCHOOL_CALENDAR.schoolYearLabel),
        startDate: String(data.startDate ?? DEFAULT_SCHOOL_CALENDAR.startDate),
        endDate: String(data.endDate ?? DEFAULT_SCHOOL_CALENDAR.endDate),
        closedDates: Array.isArray(data.closedDates) ? data.closedDates.filter((date): date is string => typeof date === "string") : [],
        closedReasons: data.closedReasons && typeof data.closedReasons === "object" ? data.closedReasons as Record<string, string> : {},
      };
      setCalendar(current);
      setYearLabel(current.schoolYearLabel);
      setStartDate(current.startDate);
      setEndDate(current.endDate);
    } else if (isSuperAdmin && user && !seedAttempted.current) {
      seedAttempted.current = true;
      void ensureSchoolCalendar(user.uid).catch(() => setError("Could not initialize the school calendar. Publish the latest Firestore rules and try again."));
    }
    setReady(true);
  }, () => {
    setError("Could not load the school calendar. Check Firestore permissions.");
    setReady(true);
  }), [isSuperAdmin, user]);

  async function saveYear(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !yearLabel.trim() || !startDate || !endDate || startDate > endDate) {
      setError("Enter a school year name and a valid date range.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const closedDates = calendar.closedDates.filter((date) => date >= startDate && date <= endDate);
      const closedReasons = Object.fromEntries(closedDates.map((date) => [date, calendar.closedReasons[date] ?? "School closure"]));
      const next = { ...calendar, schoolYearLabel: yearLabel.trim(), startDate, endDate, closedDates, closedReasons };
      await saveSchoolCalendar(next, user.uid);
      setMessage("School year saved. The booking calendar now uses these dates.");
    } catch {
      setError("Could not save the school year. Make sure the latest Firestore rules are published.");
    } finally {
      setBusy(false);
    }
  }

  async function saveClosures(next: SchoolCalendarSettings): Promise<boolean> {
    if (!user) return false;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveSchoolCalendar(next, user.uid);
      setMessage("School closure saved.");
      return true;
    } catch {
      setError("Could not save the closure. Make sure the latest Firestore rules are published.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addClosure(event: React.FormEvent) {
    event.preventDefault();
    if (!closedDate || !closedReason.trim()) {
      setError("Choose a date and enter the holiday or closure name.");
      return;
    }
    const dates = [...new Set([...calendar.closedDates, closedDate])].sort();
    const saved = await saveClosures({
      ...calendar,
      closedDates: dates,
      closedReasons: { ...calendar.closedReasons, [closedDate]: closedReason.trim() },
    });
    if (saved) {
      setClosedDate("");
      setClosedReason("");
    }
  }

  if (!ready) return <div className="card flex items-center gap-2 p-5 text-sm text-ink-500"><Loader2 className="h-4 w-4 animate-spin" />Loading school calendar…</div>;

  if (!isSuperAdmin) return <section className="card p-5"><h2 className="section-title">School calendar</h2><p className="mt-2 text-sm text-ink-600">{calendar.schoolYearLabel}: {calendar.startDate} to {calendar.endDate}. Contact the main administrator to update school dates or holidays.</p></section>;

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="mb-4 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><CalendarDays className="h-5 w-5" /></span><div><h2 className="section-title">School calendar</h2><p className="mt-1 text-sm text-ink-500">Set the active school year and add holidays or school closure dates. Weekends stay unavailable.</p></div></div>
        {error && <p role="alert" className="banner banner-error mb-3">{error}</p>}
        {message && <p role="status" className="banner banner-notice mb-3">{message}</p>}
        <form onSubmit={saveYear} className="grid gap-3 sm:grid-cols-3">
          <label className="field-label sm:col-span-3">School year name<input required value={yearLabel} onChange={(event) => setYearLabel(event.target.value)} className="field mt-1" placeholder="School Year 2027–2028" /></label>
          <label className="field-label">First bookable date<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="field mt-1" /></label>
          <label className="field-label">Last bookable date<input type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="field mt-1" /></label>
          <button type="submit" disabled={busy} className="btn btn-primary self-end sm:col-span-1">{busy ? "Saving…" : "Save school year"}</button>
        </form>
      </section>

      <section className="card p-5">
        <h3 className="section-title">Holidays and school closures</h3>
        <form onSubmit={addClosure} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <label className="field-label">Date<input type="date" required min={calendar.startDate} max={calendar.endDate} value={closedDate} onChange={(event) => setClosedDate(event.target.value)} className="field mt-1" /></label>
          <label className="field-label">Reason<input required value={closedReason} onChange={(event) => setClosedReason(event.target.value)} className="field mt-1" placeholder="Holiday, school event, or break" /></label>
          <button type="submit" disabled={busy} className="btn btn-outline self-end"><Plus className="h-4 w-4" />Add closure</button>
        </form>
        {calendar.closedDates.length === 0 ? <p className="mt-4 text-sm text-ink-500">No additional closure dates.</p> : <ul className="mt-4 divide-y divide-ink-100">{calendar.closedDates.map((date) => <li key={date} className="flex items-center gap-3 py-2 text-sm"><span className="w-28 shrink-0 text-ink-500">{date}</span><span className="min-w-0 flex-1 font-medium text-ink-800">{calendar.closedReasons[date] || "School closure"}</span><button type="button" disabled={busy} aria-label={`Remove closure on ${date}`} onClick={() => { const dates = calendar.closedDates.filter((item) => item !== date); const reasons = { ...calendar.closedReasons }; delete reasons[date]; void saveClosures({ ...calendar, closedDates: dates, closedReasons: reasons }); }} className="btn btn-ghost px-2 text-booked"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
      </section>
    </div>
  );
}
