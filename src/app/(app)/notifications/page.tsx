import type { Metadata } from "next";
import { NotificationList } from "@/components/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Approval updates for your venue reservations.",
};

export default function NotificationsPage() {
  return <NotificationList />;
}