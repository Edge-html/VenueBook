import Link from "next/link";

/**
 * Placeholder crest. Swap `public/images/logo.svg` in later — this renders
 * whatever is there if it exists, and falls back to the built-in shield.
 */
export function Crest({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crest-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b22347" />
          <stop offset="100%" stopColor="#7a1935" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 58 11v22c0 14-11 24.5-26 28C17 57.5 6 47 6 33V11L32 3Z"
        fill="url(#crest-fill)"
        stroke="#d6b263"
        strokeWidth="2"
      />
      <path
        d="M32 9 52 15v18c0 11-8.5 19.5-20 22.5C20.5 52.5 12 44 12 33V15L32 9Z"
        fill="none"
        stroke="#f0e2c0"
        strokeWidth="1.2"
        opacity="0.55"
      />
      <text
        x="32"
        y="30"
        textAnchor="middle"
        fill="#fdfbfa"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.5"
      >
        KN
      </text>
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fill="#f0e2c0"
        fontSize="8"
        letterSpacing="1.6"
      >
        CHS
      </text>
    </svg>
  );
}

export function Logo({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const light = variant === "light";

  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${className}`}
      aria-label="KNCHS VenueBook home"
    >
      <Crest />
      <span className="leading-none">
        <span
          className={`block font-display text-[15px] font-extrabold tracking-tight ${
            light ? "text-white" : "text-maroon-800"
          }`}
        >
          KNCHS
        </span>
        <span
          className={`block font-display text-[15px] font-extrabold tracking-tight ${
            light ? "text-white" : "text-neutral-800"
          }`}
        >
          VenueBook
        </span>
      </span>
    </Link>
  );
}