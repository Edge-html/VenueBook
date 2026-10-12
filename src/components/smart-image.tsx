"use client";

import { useState, type CSSProperties } from "react";

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
 * shows `children` (or nothing) instead of a broken-image icon.
 */
export function SmartImage({ src, alt, className = "", style, children }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{children}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}