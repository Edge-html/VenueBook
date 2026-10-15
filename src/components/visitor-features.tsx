"use client";

import { ArrowRight, CalendarCheck, CalendarSearch } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/**
 * The two marketing cards, shown only to signed-out visitors. Signed-in users
 * already get the same two actions — plus My Reservations and Notifications —
 * further down the page, so showing them twice is just noise.
 */
export function VisitorFeatures() {
  const { user, initialising } = useAuth();

  if (initialising || user) return null;

  return (
    <section className="mx-auto mt-4 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:px-8">
      <FeatureCard
        href="/book"
        icon={CalendarCheck}
        title="Book a Facility"
        description="Reserve the gym or AVR for your activities, events, and special moments."
      />
      <FeatureCard
        href="/availability"
        icon={CalendarSearch}
        title="Check Availability"
        description="View available schedules for the gym or AVR."
      />
    </section>
  );
}

function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof CalendarCheck;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-center gap-4 p-5 transition-colors hover:border-brand-300"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-semibold tracking-[-0.015em] text-ink-900">
          {title}
        </h3>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{description}</p>
      </div>

      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-brand-700" />
    </Link>
  );
}