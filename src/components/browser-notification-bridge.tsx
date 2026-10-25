"use client";

import { onSnapshot, type DocumentData, type Query } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { bookingRequestAlertQueries, notificationsQueryForUser } from "@/lib/data";

/** Browser alerts while VenueBook is open; Firestore remains the source of truth. */
export function BrowserNotificationBridge() {
  const { user, profile, isAdmin } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  useEffect(() => {
    if (!uid || typeof window === "undefined" || !("Notification" in window)) return;
    const unsubscribers: (() => void)[] = [];
    const listenForNew = (query: Query<DocumentData>, titleFor: (data: DocumentData) => string, bodyFor: (data: DocumentData) => string) => {
      let initialized = false;
      const seen = new Set<string>();
      unsubscribers.push(onSnapshot(query, (snapshot) => {
        if (!initialized) {
          snapshot.docs.forEach((entry) => seen.add(entry.id));
          initialized = true;
          return;
        }
        for (const entry of snapshot.docs) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          let alertsEnabled = false;
          try { alertsEnabled = window.localStorage.getItem("venuebook.browserAlerts") === "enabled"; } catch { /* Private browsing can block local storage. */ }
          if (document.visibilityState !== "hidden" || Notification.permission !== "granted" || !alertsEnabled) continue;
          const data = entry.data();
          const notification = new Notification(titleFor(data), {
            body: bodyFor(data),
            icon: "/icon.png",
            tag: `venuebook-${entry.id}`,
          });
          notification.onclick = () => {
            window.focus();
            router.push("/notifications");
            notification.close();
          };
        }
      }));
    };

    listenForNew(
      notificationsQueryForUser(uid),
      (data) => String(data.title ?? "VenueBook update"),
      (data) => String(data.body ?? "You have a new booking update."),
    );
    if (isAdmin) {
      bookingRequestAlertQueries(profile?.assignedFacilityIds).forEach((query) => {
        listenForNew(
          query,
          () => "New booking request",
          (data) => `${String(data.facilityId ?? "Facility")} · ${String(data.date ?? "Check the schedule")}. Review it in Booking Requests.`,
        );
      });
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [uid, router, isAdmin, profile?.assignedFacilityIds]);

  return null;
}
