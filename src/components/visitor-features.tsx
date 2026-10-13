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
    <section className="mx-auto mt-6 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2">
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
      className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-maroon-100 bg-maroon-50/70 p-5 transition-colors hover:bg-maroon-50"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-maroon-700 text-white">
        <Icon className="h-6 w-6" />
      </span>

      <div className="min-w-0">
        <h3 className="font-display text-lg font-bold text-neutral-900">{title}</h3>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>

      <ArrowRight className="ml-auto mt-3 h-5 w-5 shrink-0 text-maroon-400 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}