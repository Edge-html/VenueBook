"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/**
 * The sign-up call to action. Only meaningful to visitors — someone already
 * signed in has an account, so the banner is dropped entirely rather than
 * showing them a "Create Account" button they do not need.
 */
export function VisitorCta() {
  const { user, initialising } = useAuth();

  if (initialising || user) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="card flex flex-col items-start gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.015em] text-ink-900">
            <MapPin className="h-4 w-4 text-brand-700" />
            Ready to reserve a space?
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
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
  );
}