"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

interface AsyncDataResult<T> {
  data: T | null;
  error: string | null;
  /** True until the in-flight request matching `cacheKey` settles. */
  loading: boolean;
  reload: () => void;
  /** Patches loaded data locally, so an action does not need a refetch. */
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Loads async data keyed by `cacheKey`, with no `setState` in the effect body —
 * updates only land from the promise callbacks, which keeps React from doing a
 * cascading render on every mount.
 *
 * `cacheKey` must encode everything `load` depends on; identity of `load`
 * itself is intentionally ignored.
 */
export function useAsyncData<T>({
  cacheKey,
  load,
  fallback = null,
}: {
  cacheKey: string;
  load: () => Promise<T>;
  fallback?: T | null;
}): AsyncDataResult<T> {
  const [data, setData] = useState<T | null>(fallback);
  const [error, setError] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    load()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
        setSettledKey(cacheKey);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setSettledKey(cacheKey);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading: settledKey !== cacheKey, reload, setData };
}