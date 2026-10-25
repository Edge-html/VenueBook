"use client";

import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Info,
  Link2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  allBookingsQuery,
  markAllNotificationsRead,
  notificationsQueryForUser,
  parseNotificationDoc,
} from "@/lib/data";
import type { AppNotification } from "@/lib/types";
import { useLiveQuery } from "@/lib/use-live-query";


const KIND_STYLES: Record<AppNotification["kind"], { icon: typeof Bell; className: string }> = {
  approved: { icon: CheckCircle2, className: "bg-available-soft text-available" },
  rejected: { icon: XCircle, className: "bg-booked-soft text-booked" },
  cancelled: { icon: BellOff, className: "bg-ink-200 text-ink-600" },
  system: { icon: Info, className: "bg-brand-50 text-brand-700" },
};

function relativeTime(createdAt: AppNotification["createdAt"]): string {
  if (!createdAt?.toDate) return "";

  const diff = Date.now() - createdAt.toDate().getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return createdAt.toDate().toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function NotificationList() {
  const { user, profile, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  // Live: the notification arrives the moment an admin approves or declines.
  const live = useLiveQuery({
    cacheKey: `notifications:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [notificationsQueryForUser(user.uid)] : []),
  });

  const items = useMemo(() => (live.docs ?? []).map(parseNotificationDoc), [live.docs]);
  const requestsLive = useLiveQuery({ cacheKey: `notification-admin-requests:${user?.uid ?? "none"}`, enabled: Boolean(user && isAdmin), deps: [user?.uid, isAdmin, profile?.assignedFacilityIds], buildQueries: () => user && isAdmin ? [allBookingsQuery(profile?.assignedFacilityIds)] : [] });
  const pendingRequests = (requestsLive.docs ?? []).filter((entry) => entry.data().status === "pending").length;
  const loading = live.loading;

  async function markAllRead() {
    if (!user) return;

    setBusy(true);
    try {
      // The live listener reflects the change, so no local patch is needed.
      await markAllNotificationsRead(user.uid);
    } catch {
      // Leave the list as-is; the user can retry.
    } finally {
      setBusy(false);
    }
  }

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Notifications
            {unread > 0 && (
              <span className="badge bg-booked text-white">{unread} new</span>
            )}
          </h1>
          <p className="page-lede">{isAdmin ? "New requests and booking updates." : "Approval updates from the VenueBook admins."}</p>
        </div>

        {unread > 0 && (
          <button type="button" onClick={markAllRead} disabled={busy} className="btn btn-outline">
            <CheckCheck className="h-4 w-4" />
            {busy ? "Marking…" : "Mark all read"}
          </button>
        )}
      </header>

      {isAdmin && pendingRequests > 0 && <Link href="/admin" className="banner banner-warning mb-4 block font-medium">{pendingRequests} booking request{pendingRequests === 1 ? "" : "s"} awaiting review. Open Booking Requests →</Link>}

      {loading && items.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-ink-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-100 text-ink-400">
            <Bell className="h-6 w-6" />
          </span>
          <p className="mt-5 text-lg font-semibold tracking-[-0.015em] text-ink-900">
            No notifications yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            When an admin approves or declines one of your requests, you will see it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((notification) => {
            const { icon: Icon, className } = KIND_STYLES[notification.kind] ?? KIND_STYLES.system;

            return (
              <li
                key={notification.id}
                className={`card flex items-start gap-4 p-5 ${
                  notification.read ? "bg-ink-50 shadow-none" : ""
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${className}`}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-[-0.015em] text-ink-900">
                    {notification.title}
                    {!notification.read && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-600 align-middle" />
                    )}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    {notification.body}
                  </p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    {relativeTime(notification.createdAt)}
                  </p>
                </div>

                {notification.bookingId && (
                  <Link
                    href="/reservations"
                    aria-label="View reservation"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-brand-700"
                  >
                    <Link2 className="h-4 w-4" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
