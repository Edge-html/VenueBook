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
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="order-2 hidden lg:order-1 lg:block">
        <p className="text-3xl font-bold leading-tight text-brand-900">
          Your Space, Your Schedule.
        </p>
        <p className="mt-4 max-w-sm text-ink-600">
          One place to reserve the KNCHS Gymnasium and AVR, follow your requests, and
          get notified the moment they are approved.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-ink-700">
          <li className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-white">
              <Dumbbell className="h-4 w-4" />
            </span>
            Gymnasium and AVR in one calendar
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-white">
              <MonitorPlay className="h-4 w-4" />
            </span>
            Live availability, green to red
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Every request reviewed by an admin
          </li>
        </ul>
      </div>

      <div className="order-1 w-full lg:order-2 lg:justify-self-end">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <Logo className="lg:hidden" />
          <h1 className="mt-4 text-2xl font-bold text-brand-900 lg:mt-0">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>

          <div className="mt-6">{children}</div>

          <div className="mt-6 border-t border-ink-200 pt-5 text-center text-sm text-ink-600">
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
    <p
      role="alert"
      className="animate-shake rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm font-medium text-booked"
    >
      {message}
    </p>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-700 hover:underline">
      {children}
    </Link>
  );
}