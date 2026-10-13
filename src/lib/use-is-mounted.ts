"use client";

import { useSyncExternalStore } from "react";

/** Never changes, so subscribers are simply never notified. */
const subscribe = () => () => {};

/**
 * False during server rendering and the first client render, true afterwards.
 *
 * Statically prerendered pages freeze "now" at build time, so anything derived
 * from the current date would otherwise ship HTML for the build day and then
 * disagree with the client — a hydration mismatch that also shows stale data.
 *
 * `useSyncExternalStore` expresses this without a `setState` in an effect: React
 * reads `getServerSnapshot` while hydrating and `getSnapshot` afterwards, so
 * the first paint always matches the server HTML.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}