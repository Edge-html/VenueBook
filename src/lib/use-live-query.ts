"use client";

import {
  onSnapshot,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useEffect, useState, type DependencyList } from "react";
import { describeLoadError } from "./load-errors";

type Doc = QueryDocumentSnapshot<DocumentData>;

/** One slot per query; `null` until that query has answered at least once. */
type Batches = { key: string; slots: (Doc[] | null)[] };

export interface LiveQueryResult {
  /**
   * Every matching document, or `null` while the subscription for the current
   * key is still incomplete. Callers can therefore treat `null` as "show
   * nothing yet" and never render a half-populated or stale schedule.
   */
  docs: Doc[] | null;
  error: string | null;
  loading: boolean;
}

/**
 * Subscribes to one or more Firestore queries and re-renders whenever the
 * data changes, so an approval made by an admin appears on every open screen
 * without a refresh.
 *
 * Several queries are merged because a facility's schedule needs both bookings
 * and closures, which live in separate collections and so cannot share a
 * listener. Each query keeps its own slot until it answers, so a slow chunk
 * never overwrites another and the result stays `null` until all of them have.
 *
 * `cacheKey` must encode everything `buildQueries` depends on; it decides which
 * subscription the result refers to, and a change to it discards the previous
 * result rather than showing it under new parameters.
 */
export function useLiveQuery({
  cacheKey,
  buildQueries,
  deps,
  enabled = true,
}: {
  cacheKey: string;
  buildQueries: () => Query<DocumentData>[];
  deps: DependencyList;
  enabled?: boolean;
}): LiveQueryResult {
  const [batches, setBatches] = useState<Batches | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const unsubscribes: Array<() => void> = [];
    let queries: Query<DocumentData>[] = [];

    /** Fills one slot, starting a fresh set if the key or shape changed. */
    const fillSlot = (index: number, docs: Doc[]) => {
      setBatches((current) => {
        const reusable = current !== null && current.key === cacheKey && current.slots.length === queries.length;
        const slots = reusable
          ? [...current.slots]
          : Array.from({ length: queries.length }, () => null);
        slots[index] = docs;
        return { key: cacheKey, slots };
      });
    };

    try {
      queries = buildQueries();

      queries.forEach((query, index) => {
        unsubscribes.push(
          onSnapshot(
            query,
            (snapshot) => {
              if (!active) return;
              fillSlot(index, snapshot.docs);
              setError(null);
              setSettledKey(cacheKey);
            },
            (err) => {
              if (!active) return;
              setError(describeLoadError(err, "Could not load data."));
              setSettledKey(cacheKey);
            },
          ),
        );
      });
    } catch (err) {
      // Permission failures arrive through the error callback above, so this
      // only guards a malformed query. Deferred because calling setState in the
      // effect body triggers a cascading render.
      const message = describeLoadError(err, "Could not load data.");
      queueMicrotask(() => {
        if (!active) return;
        setError(message);
        setSettledKey(cacheKey);
      });
    }

    return () => {
      active = false;
      for (const off of unsubscribes) off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, ...deps]);

  const settled = settledKey === cacheKey;
  const ready = batches !== null && batches.key === cacheKey && batches.slots.every(Boolean);

  return {
    docs: settled && ready ? (batches.slots.flat() as Doc[]) : null,
    error,
    loading: !settled || !ready,
  };
}