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
      <div className="mt-7 flex flex-wrap gap-2">
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
    <div className="mt-7 border-l-2 border-white/30 pl-4">
      <p className="text-sm font-medium text-brand-200">Welcome back, {firstName}</p>
      <p className="mt-0.5 text-xl font-semibold text-white sm:text-2xl">
        What would you like to book today?
      </p>
    </div>
  );
}