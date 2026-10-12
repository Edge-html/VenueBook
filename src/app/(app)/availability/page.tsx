import type { Metadata } from "next";
import { Suspense } from "react";
import { AvailabilityCalendar } from "@/components/availability-calendar";

export const metadata: Metadata = {
  title: "Check Availability",
  description: "See which days and time slots are free at the KNCHS Gymnasium and AVR.",
};

export default function AvailabilityPage() {
  return (
    <Suspense fallback={null}>
      <AvailabilityCalendar />
    </Suspense>
  );
}