import type { Metadata } from "next";
import { ReservationsList } from "@/components/reservations-list";

export const metadata: Metadata = {
  title: "My Reservations",
  description: "Track every venue request you have sent and its approval status.",
};

export default function ReservationsPage() {
  return <ReservationsList />;
}