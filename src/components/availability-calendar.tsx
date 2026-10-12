"use client";

import { ChevronLeft, ChevronRight, Dumbbell, MonitorPlay, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { FULL_LEGEND, SlotChip } from "@/components/status-pill";
import { BOOKING_WINDOW_DAYS, FACILITIES, TIME_SLOTS } from "@/lib/constants";
import { getMonthAvailability } from "@/lib/data";
import {
  addDays,
  formatLongDate,
  formatMonthTitle,
  monthGrid,
  toDateKey,
  todayKey,
  WEEKDAY_SHORT,
} from "@/lib/dates";
import type { FacilityId, SlotState } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

/** Renders a day cell as a row of mini bars, one per time slot. */
const SEGMENT_STYLES: Record<SlotState, string> = {
  available: "bg-available",
  booked: "bg-booked",
  pending: "bg-pending",
  blocked: "bg-neutral-300",
};

export function AvailabilityCalendar() {
  const searchParams = useSearchParams();
  const initialFacility = searchParams.get("facility");
  const initialDate = searchParams.get("date");

  const [facilityId, setFacilityId] = useState<FacilityId>(
    initialFacility === "avr" ? "avr" : "gymnasium",
  );

  const [month, setMonth] = useState(() => {
    if (initialDate) {
      const [y, m] = initialDate.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const [selected, setSelected] = useState<string>(initialDate ?? todayKey());

  const today = todayKey();
  const maxDate = toDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS));

  const grid = useMemo(() => monthGrid(month), [month]);

  /** Only days inside the bookable window are worth fetching. */
  const wantedDates = useMemo(() => {
    const keys = grid.map(toDateKey).filter((key) => key >= today && key <= maxDate);
    return [...new Set(keys)];
  }, [grid, today, maxDate]);

  const load = useCallback(
    () => getMonthAvailability(facilityId, wantedDates),
    [facilityId, wantedDates],
  );

  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  const {
    data,
    error,
    loading,
    reload,
  } = useAsyncData<Record<string, Record<string, SlotState>>>({
    cacheKey: `${facilityId}:${monthKey}`,
    load,
    fallback: {},
  });

  function shiftMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  const currentMonth = month.getMonth();
  const canGoBack =
    month.getFullYear() > new Date().getFullYear() ||
    currentMonth > new Date().getMonth();
  const canGoForward = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= maxDate;

  const selectedSlots = data?.[selected];
  const facility = FACILITIES.find((f) => f.id === facilityId)!;
  const SelectedIcon = ICONS[facilityId];

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-maroon-900">
            Check Availability
          </h1>
          <p className="mt-1.5 text-neutral-600">
            Green is free to book, red is taken, amber is awaiting approval.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh schedule"
            className="grid h-9 w-9 place-items-center rounded-lg border border-cream-300 bg-white text-maroon-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <ul className="flex flex-wrap items-center gap-4 text-xs font-medium text-neutral-600">
            {FULL_LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* ── Facility switch ─────────────────────────────────── */}
      <div className="mb-5 inline-flex rounded-xl border border-cream-300 bg-white p-1">
        {FACILITIES.map((option) => {
          const Icon = ICONS[option.id];
          const active = option.id === facilityId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFacilityId(option.id)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-maroon-700 text-white" : "text-neutral-700 hover:bg-cream-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.shortName}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── Month grid ───────────────────────────────────── */}
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-lg border border-cream-300 text-maroon-700 disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h2 className="font-display text-lg font-bold text-maroon-900">
              {formatMonthTitle(month)}
            </h2>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canGoForward}
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-lg border border-cream-300 text-maroon-700 disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_SHORT.map((day) => (
              <div
                key={day}
                className="pb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400"
              >
                {day.charAt(0)}
              </div>
            ))}

            {grid.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === currentMonth;
              const bookable = key >= today && key <= maxDate;
              const slots = data?.[key];
              const isSelected = key === selected;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!bookable}
                  onClick={() => setSelected(key)}
                  aria-pressed={isSelected}
                  aria-label={formatLongDate(key)}
                  className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors ${
                    isSelected
                      ? "bg-maroon-700 text-white"
                      : bookable
                        ? "hover:bg-maroon-50"
                        : "cursor-default opacity-40"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      inMonth
                        ? isSelected
                          ? "text-white"
                          : "text-neutral-800"
                        : "text-neutral-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <span key={i} className="h-full flex-1 bg-cream-300" />
                        ))
                      : slots
                        ? TIME_SLOTS.map((slot) => (
                            <span
                              key={slot.id}
                              className={`h-full flex-1 ${
                                isSelected
                                  ? "bg-white/70"
                                  : SEGMENT_STYLES[slots[slot.id] ?? "available"]
                              }`}
                            />
                          ))
                        : Array.from({ length: 6 }).map((_, i) => (
                            <span key={i} className="h-full flex-1 bg-cream-200" />
                          ))}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-xs text-neutral-500">
            Each bar is one time slot. Only the next {BOOKING_WINDOW_DAYS} days can be booked.
          </p>
        </section>

        {/* ── Selected day ─────────────────────────────────── */}
        <section className="card h-fit p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-maroon-700 text-white">
              <SelectedIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-neutral-900">
                {facility.name}
              </h2>
              <p className="text-xs text-neutral-600">{formatLongDate(selected)}</p>
            </div>
          </div>

          {error && (
            <p className="mb-3 rounded-lg border border-booked/30 bg-booked-soft px-3 py-2 text-sm text-booked">
              {error}
            </p>
          )}

          <div className="space-y-2">
            {TIME_SLOTS.map((slot) =>
              loading || !selectedSlots ? (
                <div key={slot.id} className="h-10 animate-pulse rounded-lg bg-cream-200" />
              ) : (
                <div key={slot.id} className="flex items-center gap-3">
                  <SlotChip
                    label={slot.label}
                    state={selectedSlots[slot.id] ?? "available"}
                    className="w-28 shrink-0"
                  />
                  <p className="text-xs text-neutral-600">
                    {selectedSlots[slot.id] === "available"
                      ? "Open — book it now"
                      : selectedSlots[slot.id] === "booked"
                        ? "Already reserved"
                        : selectedSlots[slot.id] === "pending"
                          ? "Awaiting approval"
                          : "Closed by the admin"}
                  </p>
                </div>
              ),
            )}
          </div>

          <Link
            href={`/book?facility=${facilityId}&date=${selected}`}
            className="btn btn-primary mt-5 w-full"
          >
            Book this facility
          </Link>
        </section>
      </div>
    </div>
  );
}