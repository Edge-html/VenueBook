"use client";

import { useCallback, useState, type CSSProperties } from "react";

interface SmartImageProps {
  /**
   * Ordered candidates. The first is the real photo; the last must always be a
   * bundled placeholder so the page never requests a missing file.
   */
  sources: string[];
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  /** Rendered only if every candidate fails. */
  children?: React.ReactNode;
}

/**
 * Swaps to the next candidate when a source fails to load.
 *
 * A 404 usually resolves *before* React hydrates, and that error event is then
 * never delivered — so the mounted element is inspected via a ref callback
 * rather than trusting `onError` alone. The index (not a boolean) is what gets
 * tracked, which keeps each candidate from being retried forever.
 */
export function SmartImage({
  sources,
  alt,
  className = "",
  style,
  loading = "lazy",
  children,
}: SmartImageProps) {
  const [failedCount, setFailedCount] = useState(0);
  const src = sources[failedCount];

  const inspect = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) {
      setFailedCount((count) => count + 1);
    }
  }, []);

  function handleError() {
    setFailedCount((count) => count + 1);
  }

  if (!src) return <>{children}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={inspect}
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      onError={handleError}
    />
  );
}