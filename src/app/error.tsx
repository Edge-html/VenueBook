"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("VenueBook page error", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="badge mx-auto w-fit bg-booked-soft text-booked">Something went wrong</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-900">
        This page could not load
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        Your account and reservations are safe. Try loading the page again, or return to the home page.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-outline">Go to home</Link>
      </div>
    </section>
  );
}
