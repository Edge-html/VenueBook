"use client";

import { ChevronLeft, ChevronRight, Dumbbell, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FULL_LEGEND, SlotChip } from "@/components/status-pill";
import { BOOKING_WINDOW_DAYS, FACILITIES, TIME_BLOCKS } from "@/lib/constants";
import {
  blocksQueriesForDates,
  bookingsQueriesForDates,
  foldBlocksIntoSlots,
  parseBlockedSlotDoc,
  parseBookingDoc,
} from "@/lib/data";
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
import { describeLoadError } from "@/lib/load-errors";
import { describeMinutes } from "@/lib/time";
import { useLiveQuery } from "@/lib/use-live-query";

const ICONS = { gymnasium: Dumbbell, avr: MonitorPlay } as const;

/** Renders a day cell as a row of mini bars, one per time slot. */
const SEGMENT_STYLES: Record<SlotState, string> = {
  available: "bg-available",
  booked: "bg-booked",
  pending: "bg-pending",
  blocked: "bg-closed",
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

  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  // `today` is part of the key because the bookable window slides forward at
  // midnight; without it an open tab would keep listening to the old range.
  const windowKey = `${today}:${wantedDates.length}`;

  const bookingLive = useLiveQuery({
    cacheKey: `cal-bookings:${facilityId}:${monthKey}:${windowKey}`,
    deps: [facilityId, monthKey, windowKey],
    buildQueries: () => bookingsQueriesForDates(facilityId, wantedDates),
  });

  const blockLive = useLiveQuery({
    cacheKey: `cal-blocks:${facilityId}:${monthKey}:${windowKey}`,
    deps: [facilityId, monthKey, windowKey],
    buildQueries: () => blocksQueriesForDates(facilityId, wantedDates),
  });

  const loading = bookingLive.loading || blockLive.loading;
  const error = bookingLive.error ?? blockLive.error;

  const data = useMemo(() => {
    if (!bookingLive.docs || !blockLive.docs) return null;

    const bookings = bookingLive.docs.map(parseBookingDoc);
    const blocks = blockLive.docs.map(parseBlockedSlotDoc);

    return Object.fromEntries(
      wantedDates.map((day) => [day, foldBlocksIntoSlots(bookings, blocks, day)]),
    ) as Record<string, Record<string, SlotState>>;
  }, [bookingLive.docs, blockLive.docs, wantedDates]);

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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Check Availability</h1>
          <p className="page-lede">
            Green is free to book, red is taken, amber is awaiting approval.
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-4 text-xs font-medium text-ink-500">
          {FULL_LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
              {item.label}
            </li>
          ))}
        </ul>
      </header>

      {/* ── Facility switch ─────────────────────────────────── */}
      <div className="mb-6 inline-flex rounded-lg bg-ink-100 p-1">
        {FACILITIES.map((option) => {
          const Icon = ICONS[option.id];
          const active = option.id === facilityId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFacilityId(option.id)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-700 text-white"
                  : "text-ink-600 hover:bg-ink-200 hover:text-ink-900"
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
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink-900">
              {formatMonthTitle(month)}
            </h2>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canGoForward}
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_SHORT.map((day) => (
              <div key={day} className="eyebrow pb-2">
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
                  className={`flex flex-col items-center gap-1.5 rounded-md px-1 py-2 transition-colors ${
                    isSelected
                      ? "bg-brand-700 text-white"
                      : bookable
                        ? "hover:bg-brand-50"
                        : "cursor-default opacity-40"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      inMonth
                        ? isSelected
                          ? "text-white"
                          : "text-ink-800"
                        : "text-ink-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <span key={i} className="h-full flex-1 bg-ink-300" />
                        ))
                      : slots
                        ? TIME_BLOCKS.map((slot) => (
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
                            <span key={i} className="h-full flex-1 bg-ink-200" />
                          ))}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-ink-500">
            Each bar is one hour. Only the next {BOOKING_WINDOW_DAYS} days can be booked.
          </p>
        </section>

        {/* ── Selected day ─────────────────────────────────── */}
        <section className="card h-fit p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <SelectedIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink-900">
                {facility.name}
              </h2>
              <p className="text-xs text-ink-500">{formatLongDate(selected)}</p>
            </div>
          </div>

          {error && (
            <p className="banner banner-error mb-4">
              {describeLoadError(new Error(error), "Could not load the schedule.")}
            </p>
          )}

          {error ? (
            <div className="space-y-2">
              {TIME_BLOCKS.map((slot) => (
                <div
                  key={slot.id}
                  className="flex h-10 items-center gap-3 rounded-md bg-ink-100 px-3 text-xs font-medium text-ink-400"
                >
                  <span className="w-24 shrink-0">{slot.label}</span>
                  <span>Unavailable</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {TIME_BLOCKS.map((slot) =>
                loading || !selectedSlots ? (
                  <div key={slot.id} className="h-10 animate-pulse rounded-md bg-ink-100" />
                ) : (
                  <div key={slot.id} className="flex items-center gap-3">
                    <SlotChip
                      label={slot.label}
                      state={selectedSlots[slot.id] ?? "available"}
                      title={describeMinutes(slot.startMin, slot.endMin)}
                      className="w-24 shrink-0"
                    />
                    <p className="text-xs text-ink-500">
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
          )}

          <Link
            href={`/book?facility=${facilityId}&date=${selected}`}
            className="btn btn-primary mt-6 w-full"
          >
            Book this facility
          </Link>
        </section>
      </div>
    </div>
  );
}