"use client";

import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarSearch,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { DashboardOverview } from "@/components/dashboard-overview";
import { useAuth } from "@/lib/auth-context";
import { getBookingsForUser, getNotifications } from "@/lib/data";
import { useAsyncData } from "@/lib/use-async-data";

const ACTIONS = [
  {
    href: "/book",
    icon: CalendarCheck,
    title: "Book a Facility",
    description: "Reserve the gym or AVR for your activities, events, and special moments.",
  },
  {
    href: "/availability",
    icon: CalendarSearch,
    title: "Check Availability",
    description: "See the live calendar. Green is free, red is taken, amber is awaiting approval.",
  },
  {
    href: "/reservations",
    icon: ClipboardList,
    title: "My Reservations",
    description: "Follow every request you have sent, from pending to approved.",
  },
  {
    href: "/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Get told the moment an admin approves or declines your booking.",
  },
];

export default function DashboardPage() {
  const { profile, user, isAdmin } = useAuth();

  const loadCounts = useCallback(async () => {
    if (!user) return { unread: 0, pending: 0 };

    const [notifications, bookings] = await Promise.all([
      getNotifications(user.uid),
      getBookingsForUser(user.uid),
    ]);

    return {
      unread: notifications.filter((n) => !n.read).length,
      pending: bookings.filter((b) => b.status === "pending").length,
    };
  }, [user]);

  const { data: counts } = useAsyncData({ cacheKey: `counts:${user?.uid ?? "none"}`, load: loadCounts });

  const pending = counts?.pending ?? 0;
  const unread = counts?.unread ?? 0;

  const badges: Record<string, number> = {
    "/reservations": pending,
    "/notifications": unread,
  };

  const firstName = (profile?.fullName ?? "").split(" ")[0] || "there";

  return (
    <div className="animate-fade-up space-y-8">
      <section>
        <p className="text-sm font-medium text-maroon-700">KNCHS VenueBook</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-maroon-900">
          Hi, {firstName}.
        </h1>
        <p className="mt-1.5 text-neutral-600">
          {pending > 0
            ? `You have ${pending} request${pending > 1 ? "s" : ""} waiting for review.`
            : "Everything is up to date. What would you like to book today?"}
        </p>
      </section>

      {isAdmin && (
        <Link
          href="/admin"
          className="group flex items-center gap-4 rounded-2xl border border-gold-300 bg-gold-200/50 p-5 transition-colors hover:bg-gold-200/70"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon-800 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-maroon-900">Admin console</p>
            <p className="text-sm text-neutral-700">
              Review student requests and edit the venue schedule.
            </p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-maroon-700 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-cream-300 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-maroon-700 text-white">
              <Icon className="h-6 w-6" />
            </span>

            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-neutral-900">
                {title}
                {badges[href] > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-booked px-1.5 text-[11px] font-bold text-white">
                    {badges[href]}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">{description}</p>
            </div>

            <ArrowRight className="ml-auto mt-3 h-5 w-5 shrink-0 text-maroon-400 transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </section>

      <DashboardOverview />
    </div>
  );
}