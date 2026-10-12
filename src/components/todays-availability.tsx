"use client";

import { Dumbbell, MonitorPlay } from "lucide-react";
import { useCallback } from "react";
import { FACILITIES, TIME_SLOTS } from "@/lib/constants";
import { getMonthAvailability } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import type { FacilityId, SlotState } from "@/lib/types";
import { describeLoadError } from "@/lib/load-errors";
import { useAsyncData } from "@/lib/use-async-data";
import { LEGEND, SlotChip } from "./status-pill";

const FACILITY_ICONS: Record<FacilityId, typeof Dumbbell> = {
  gymnasium: Dumbbell,
  avr: MonitorPlay,
};

export function TodaysAvailability() {
  const date = todayKey();

  const load = useCallback(
    async () => {
      const entries = await Promise.all(
        FACILITIES.map(async (facility) => {
          const snapshot = await getMonthAvailability(facility.id, [date]);
          return [facility.id, snapshot[date]] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, Record<string, SlotState>>;
    },
    [date],
  );

  const { data, error, loading } = useAsyncData<Record<string, Record<string, SlotState>>>({
    cacheKey: `today:${date}`,
    load,
    fallback: {},
  });

  return (
    <aside className="card h-full p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-maroon-900">
          <Dumbbell className="h-5 w-5 text-maroon-600" />
          Today&rsquo;s Availability
        </h3>
        <ul className="flex shrink-0 flex-wrap items-center gap-3 text-[11px] font-medium text-neutral-600">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-5">
        {FACILITIES.map((facility) => {
          const Icon = FACILITY_ICONS[facility.id];
          const daySlots = data?.[facility.id];

          if (error) {
            return (
              <div key={facility.id} className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
                <p className="text-xs text-neutral-600">{describeLoadError(new Error(error), "Schedule unavailable.")}</p>
              </div>
            );
          }

          return (
            <div key={facility.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-maroon-700 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-neutral-800">{facility.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIME_SLOTS.map((slot) =>
                  daySlots ? (
                    <SlotChip key={slot.id} label={slot.label} state={daySlots[slot.id]} />
                  ) : (
                    <div
                      key={slot.id}
                      className={`h-9 rounded-lg bg-cream-200 ${loading ? "animate-pulse" : ""}`}
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}