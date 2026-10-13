import { ArrowRight, Dumbbell, MonitorPlay, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardOverview } from "@/components/dashboard-overview";
import { HeroActions } from "@/components/hero-actions";
import { HomeAccountSections } from "@/components/home-account-sections";
import { SmartImage } from "@/components/smart-image";
import { TodaysAvailability } from "@/components/todays-availability";
import { VisitorCta } from "@/components/visitor-cta";
import { VisitorFeatures } from "@/components/visitor-features";
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
        <div className="relative overflow-hidden rounded-lg bg-brand-800 shadow-sm">
          <div className="absolute inset-0">
            <SmartImage
              sources={resolveImageSources(HERO_IMAGE.photo, HERO_IMAGE.placeholder)}
              alt=""
              loading="eager"
              className="h-full w-full object-cover object-right opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/90 to-brand-800/40" />
          </div>

          <div className="relative max-w-2xl px-6 py-12 sm:px-10 lg:py-16">
            <span className="inline-flex items-center rounded bg-white/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-white backdrop-blur">
              KNCHS
            </span>

            <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
              Your Space, Your Schedule.
            </h1>

            <p className="mt-4 max-w-md text-base text-brand-100">
              Book the KNCHS Gymnasium or AVR with ease.
            </p>

            <div className="mt-7">
              <HeroActions />
            </div>
          </div>
        </div>
      </section>

      {/* ── Two headline features (signed-out visitors only) ──── */}
      <Suspense fallback={null}>
        <VisitorFeatures />
      </Suspense>

      {/* Signed-in visitors get their four main functions here. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Suspense fallback={null}>
          <HomeAccountSections />
        </Suspense>
      </div>

      {/* Today's schedule sits where the upcoming reservations used to be —
          it is the more immediately useful of the two. */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Suspense fallback={null}>
          <TodaysAvailability />
        </Suspense>
      </div>

      {/* ── Facilities + upcoming reservations ────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="section-title">Our Facilities</h2>
          <span className="h-px flex-1 bg-ink-200" />
        </div>

        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map((facility) => {
            const Icon = FACILITY_ICONS[facility.id];

            return (
              <article key={facility.id} className="card overflow-hidden">
                <div className="h-40 w-full overflow-hidden bg-ink-200">
                  <SmartImage
                    sources={resolveImageSources(facility.image, facility.placeholder)}
                    alt={facility.name}
                    className="h-full w-full object-cover"
                  >
                    <div className="grid h-full w-full place-items-center">
                      <Icon className="h-10 w-10 text-ink-400" />
                    </div>
                  </SmartImage>
                </div>

                <div className="card-pad">
                  <h3 className="text-base font-semibold text-ink-900">{facility.name}</h3>

                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
                    <Users className="h-3.5 w-3.5" />
                    Capacity {facility.capacity}
                  </p>
                  <p className="mt-2 text-sm text-ink-600">{facility.description}</p>

                  <Link
                    href={`/availability?facility=${facility.id}`}
                    className="btn btn-outline mt-4 w-full"
                  >
                    View Schedule
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}

          {/* Upcoming reservations took the place of today's schedule. */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Suspense fallback={null}>
              <DashboardOverview />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Closing call to action (signed-out visitors only) ── */}
      <Suspense fallback={null}>
        <VisitorCta />
      </Suspense>
    </>
  );
}