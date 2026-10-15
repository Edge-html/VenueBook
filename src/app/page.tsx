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
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="card overflow-hidden">
          <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12 lg:p-12">
            <div>
              <span className="badge bg-brand-50 text-brand-700">KNCHS &middot; Koronadal</span>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.11] tracking-[-0.05em] text-ink-900 sm:text-5xl">
                Your Space,
                <br />
                Your Schedule.
              </h1>

              <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500">
                Reserve the KNCHS Gymnasium or AVR in seconds. Check live availability,
                send your request for approval, and follow it to the finish.
              </p>

              <div className="mt-8">
                <HeroActions />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-100">
              <SmartImage
                sources={resolveImageSources(HERO_IMAGE.photo, HERO_IMAGE.placeholder)}
                alt="The KNCHS main building"
                loading="eager"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Two headline features (signed-out visitors only) ──── */}
      <Suspense fallback={null}>
        <VisitorFeatures />
      </Suspense>

      {/* Signed-in visitors get their four main functions here. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <HomeAccountSections />
        </Suspense>
      </div>

      {/* Today's schedule sits where the upcoming reservations used to be —
          it is the more immediately useful of the two. */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <TodaysAvailability />
        </Suspense>
      </div>

      {/* ── Facilities + upcoming reservations ────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <h2 className="section-title">Our Facilities</h2>
          <span className="section-rule flex-1" />
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
                  <h3 className="text-base font-semibold tracking-[-0.015em] text-ink-900">
                    {facility.name}
                  </h3>

                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
                    <Users className="h-3.5 w-3.5" />
                    Capacity {facility.capacity}
                  </p>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
                    {facility.description}
                  </p>

                  <Link
                    href={`/availability?facility=${facility.id}`}
                    className="btn btn-outline mt-5 w-full"
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