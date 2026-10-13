import Image from "next/image";
import Link from "next/link";

/** The official KNCHS seal, pre-sized in `public/images/`. */
export const LOGO_SRC = "/images/knchs-logo-256.png";

export function Crest({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="KNCHS logo"
      width={256}
      height={256}
      className={className}
      priority={false}
    />
  );
}

/** Header wordmark: crest plus the single word "VenueBook". */
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
      aria-label="VenueBook home"
    >
      <Crest className="h-10 w-10 shrink-0" />
      <span
        className={`font-display text-lg font-extrabold leading-none tracking-tight ${
          light ? "text-white" : "text-maroon-800"
        }`}
      >
        VenueBook
      </span>
    </Link>
  );
}