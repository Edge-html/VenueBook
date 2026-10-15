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
  className = "",
  showWordmark = true,
}: {
  className?: string;
  /** Drop the wordmark where the crest alone should carry the brand. */
  showWordmark?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${className}`}
      aria-label="VenueBook home"
    >
      <Crest className="h-9 w-9 shrink-0" />
      {showWordmark && (
        <span className="text-lg font-semibold leading-none tracking-[-0.025em] text-brand-800">
          VenueBook
        </span>
      )}
    </Link>
  );
}