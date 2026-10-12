"use client";

import { useCallback, useState, type CSSProperties } from "react";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  /** Rendered in place of the photo until a real file exists in `public/`. */
  children?: React.ReactNode;
}

/**
 * Drops in the real photo once it is added to `public/images/`; until then it
 * shows `children` instead of a broken-image icon.
 *
 * A 404 usually resolves *before* React hydrates, and that error event is then
 * never delivered — so the mounted element is inspected directly via a ref
 * callback rather than trusting `onError` alone. Tracking the failed `src`
 * (rather than a boolean) also means a new `src` retries without an effect.
 */
export function SmartImage({ src, alt, className = "", style, children }: SmartImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const inspect = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) {
      setFailedSrc(node.getAttribute("src"));
    }
  }, []);

  if (failedSrc === src) return <>{children}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={inspect}
      src={src}
      alt={alt}
      className={className}
      style={style}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}