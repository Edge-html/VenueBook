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
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  // Live: the notification arrives the moment an admin approves or declines.
  const live = useLiveQuery({
    cacheKey: `notifications:${user?.uid ?? "none"}`,
    enabled: Boolean(user),
    deps: [user?.uid],
    buildQueries: () => (user ? [notificationsQueryForUser(user.uid)] : []),
  });

  const items = useMemo(() => (live.docs ?? []).map(parseNotificationDoc), [live.docs]);
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold text-brand-900">
            Notifications
            {unread > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-booked px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </h1>
          <p className="mt-1.5 text-ink-600">
            Approval updates from the VenueBook admins.
          </p>
        </div>

        {unread > 0 && (
          <button type="button" onClick={markAllRead} disabled={busy} className="btn btn-outline">
            <CheckCheck className="h-4 w-4" />
            {busy ? "Marking…" : "Mark all read"}
          </button>
        )}
      </header>

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg bg-ink-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-200 text-ink-500">
            <Bell className="h-6 w-6" />
          </span>
          <p className="mt-4 text-lg font-bold text-brand-900">No notifications yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">
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
                className={`card flex items-start gap-4 p-4 ${
                  notification.read ? "opacity-75" : "border-brand-200"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${className}`}>
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">
                    {notification.title}
                    {!notification.read && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-600 align-middle" />
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-600">{notification.body}</p>
                  <p className="mt-1 text-xs text-ink-400">{relativeTime(notification.createdAt)}</p>
                </div>

                {notification.bookingId && (
                  <Link
                    href="/reservations"
                    aria-label="View reservation"
                    className="shrink-0 rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-brand-700"
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