import {
  ArrowRight,
  CalendarSearch,
  CalendarCheck,
  Dumbbell,
  MapPin,
  MonitorPlay,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AvailabilitySearch } from "@/components/availability-search";
import { HomeAccountSections } from "@/components/home-account-sections";
import { SmartImage } from "@/components/smart-image";
import { TodaysAvailability } from "@/components/todays-availability";
import { FACILITIES, HERO_IMAGE } from "@/lib/constants";
import { resolveImageSources } from "@/lib/image-sources.server";

const FACILITY_ICONS = {
  gymnasium: Dumbbell,
  avr: MonitorPlay,
} as const;

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-maroon-800 shadow-xl">
          <div className="absolute inset-0">
            <SmartImage
              sources={resolveImageSources(HERO_IMAGE.photo, HERO_IMAGE.placeholder)}
              alt=""
              loading="eager"
              className="h-full w-full object-cover object-right opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-maroon-950 via-maroon-900/90 to-maroon-800/40" />
          </div>

          <div className="relative max-w-2xl px-6 py-12 sm:px-10 lg:py-16">
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur">
              VenueBook
            </span>

            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Your Space,
              <br />
              <span className="italic">Your Schedule.</span>
            </h1>

            <p className="mt-4 max-w-md text-base text-maroon-100">
              Book the KNCHS Gymnasium or AVR with ease.
            </p>

            <div className="mt-7">
              <AvailabilitySearch />
            </div>
          </div>
        </div>
      </section>

      {/* ── Two headline features ────────────────────────────── */}
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

      {/* Signed-in visitors also get their four main functions here. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Suspense fallback={null}>
          <HomeAccountSections />
        </Suspense>
      </div>

      {/* ── Facilities + today's availability ────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold text-maroon-900">Our Facilities</h2>
          <span className="h-px w-12 bg-gold-400" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          {FACILITIES.map((facility) => {
            const Icon = FACILITY_ICONS[facility.id];

            return (
              <article key={facility.id} className="card overflow-hidden">
                <div className="h-44 w-full overflow-hidden bg-gradient-to-br from-maroon-800 to-maroon-950">
                  <SmartImage
                    sources={resolveImageSources(facility.image, facility.placeholder)}
                    alt={facility.name}
                    className="h-full w-full object-cover"
                  >
                    <div className="grid h-full w-full place-items-center text-white/25">
                      <Icon className="h-14 w-14" />
                    </div>
                  </SmartImage>
                </div>

                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-700 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-neutral-900">
                        {facility.name}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                        <Users className="h-3.5 w-3.5" />
                        Capacity: {facility.capacity}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-neutral-600">{facility.description}</p>

                  <Link
                    href={`/availability?facility=${facility.id}`}
                    className="btn btn-primary mt-4 w-full"
                  >
                    View Schedule
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}

          <Suspense fallback={<AvailabilityPlaceholder />}>
            <TodaysAvailability />
          </Suspense>
        </div>
      </section>

      {/* ── Closing call to action ────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-cream-300 bg-white px-6 py-9 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="flex items-center justify-center gap-2 font-display text-xl font-extrabold text-maroon-900 sm:justify-start">
              <MapPin className="h-5 w-5 text-maroon-600" />
              Ready to reserve a space?
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Create an account and send your request in under a minute.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/signup" className="btn btn-primary">
              Create Account
            </Link>
            <Link href="/book" className="btn btn-outline">
              Book Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function AvailabilityPlaceholder() {
  return (
    <aside className="card h-full p-5" aria-hidden="true">
      <h3 className="mb-4 h-6 w-48 animate-pulse rounded-lg bg-cream-200" />
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row}>
            <div className="mb-2 h-7 w-40 animate-pulse rounded-lg bg-cream-200" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((__, cell) => (
                <div key={cell} className="h-9 animate-pulse rounded-lg bg-cream-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
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