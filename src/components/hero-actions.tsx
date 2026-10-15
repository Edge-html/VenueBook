"use client";

import { CalendarSearch } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/**
 * Sits in the hero where the old search bar was. Signed in, it greets the user
 * and states what the page is for; signed out, it offers the two things a
 * visitor can actually do.
 */
export function HeroActions() {
  const { user, profile, initialising } = useAuth();

  if (initialising || !user) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link href="/signup" className="btn btn-primary">
          Create Account
        </Link>
        <Link href="/availability" className="btn btn-outline">
          <CalendarSearch className="h-4 w-4" />
          Check Availability
        </Link>
      </div>
    );
  }

  const firstName = (profile?.fullName ?? "").split(" ")[0] || "there";

  return (
    <div className="border-l-2 border-brand-200 pl-5">
      <p className="eyebrow">Welcome back, {firstName}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.025em] text-ink-900">
        What would you like to book today?
      </p>
      <Link href="/book" className="btn btn-primary mt-5">
        Start a booking
      </Link>
    </div>
  );
}