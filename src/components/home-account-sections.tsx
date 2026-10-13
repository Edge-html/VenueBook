"use client";

import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarSearch,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { AdminConsole } from "@/components/admin-console";
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

/**
 * The signed-in half of the home page.
 *
 * For an admin this *is* the home page — the console replaces the student
 * functions entirely, so opening Home drops you straight into approvals.
 * Students get their greeting, the four main functions, and upcoming
 * reservations. Visitors get nothing, so the landing page stays a plain
 * marketing page while signed out.
 */
export function HomeAccountSections() {
  const { user, initialising, isAdmin } = useAuth();

  if (initialising || !user) return null;

  if (isAdmin) {
    return (
      <div className="border-t border-ink-300 pt-8">
        <AdminConsole />
      </div>
    );
  }

  return <StudentSections />;
}

function StudentSections() {
  const { profile, user } = useAuth();

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

  const { data: counts } = useAsyncData({
    cacheKey: `counts:${user?.uid ?? "none"}`,
    load: loadCounts,
  });

  const pending = counts?.pending ?? 0;
  const unread = counts?.unread ?? 0;

  const badges: Record<string, number> = {
    "/reservations": pending,
    "/notifications": unread,
  };

  const firstName = (profile?.fullName ?? "").split(" ")[0] || "there";

  return (
    <div className="animate-fade-up space-y-6">
      <section className="border-t border-ink-300 pt-8">
        <p className="text-sm font-medium text-brand-700">Welcome back, {firstName}</p>
        <h2 className="mt-1 text-2xl font-bold text-brand-900">
          {pending > 0
            ? `You have ${pending} request${pending > 1 ? "s" : ""} waiting for review.`
            : "What would you like to book today?"}
        </h2>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card flex items-center gap-3 p-4 transition-colors hover:border-ink-400"
          >
            <Icon className="h-5 w-5 shrink-0 text-brand-700" />

            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-900">
                {title}
                {badges[href] > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1.5 text-[11px] font-bold text-white">
                    {badges[href]}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-sm text-ink-600">{description}</p>
            </div>

            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
          </Link>
        ))}
      </section>

      <DashboardOverview />
    </div>
  );
}