import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";

export const metadata: Metadata = {
  title: "Book a Facility",
  description: "Reserve the KNCHS Gymnasium or AVR and send your request for approval.",
};

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookingForm />
    </Suspense>
  );
}