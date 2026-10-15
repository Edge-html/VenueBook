import Link from "next/link";
import { Logo } from "./logo";
import { Dumbbell, MonitorPlay, ShieldCheck } from "lucide-react";

/** Split-screen shell shared by the sign-in and create-account pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-16">
      {/* The one large maroon surface in the product — it anchors the two
          routes where brand and task meet. Solid tone, no gradient. */}
      <div className="order-2 hidden lg:order-1 lg:block">
        <div className="rounded-xl bg-brand-800 px-8 py-10">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-white">
            Your Space,
            <br />
            Your Schedule.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-100">
            One place to reserve the KNCHS Gymnasium and AVR, follow your requests, and
            get notified the moment they are approved.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-brand-100">
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                <Dumbbell className="h-4 w-4" />
              </span>
              Gymnasium and AVR in one calendar
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                <MonitorPlay className="h-4 w-4" />
              </span>
              Live availability, green to red
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Every request reviewed by an admin
            </li>
          </ul>
        </div>
      </div>

      <div className="order-1 w-full lg:order-2 lg:justify-self-end">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <Logo className="lg:hidden" />
          <h1 className="page-title mt-5 text-[1.75rem] lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-7 border-t border-ink-200 pt-5 text-center text-sm text-ink-500">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline banner for form-level errors. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" className="banner banner-error animate-shake font-medium">
      {message}
    </p>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="link">
      {children}
    </Link>
  );
}