"use client";

import { collection, query } from "firebase/firestore";
import { useMemo } from "react";
import { FACILITIES, type Facility } from "./constants";
import { db } from "./firebase";
import { useLiveQuery } from "./use-live-query";

/** Built-in rooms remain available while the venue collection is loading. */
export function useFacilities(): Facility[] {
  const live = useLiveQuery({ cacheKey: "facilities", deps: [], buildQueries: () => [query(collection(db, "facilities"))] });
  return useMemo(() => {
    const merged = new Map(FACILITIES.map((facility) => [facility.id, facility]));
    for (const entry of live.docs ?? []) {
      const data = entry.data();
      if (data.active === false) { merged.delete(entry.id); continue; }
      merged.set(entry.id, { id: entry.id, name: String(data.name ?? entry.id), shortName: String(data.shortName ?? data.name ?? entry.id), capacity: String(data.capacity ?? "—"), description: String(data.description ?? ""), image: String(data.image ?? "/images/placeholders/avr.svg"), placeholder: "/images/placeholders/avr.svg", tone: "text-brand-700" });
    }
    return [...merged.values()];
  }, [live.docs]);
}
