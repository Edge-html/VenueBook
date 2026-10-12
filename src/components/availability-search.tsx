"use client";

import { CalendarSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AvailabilitySearch() {
  const router = useRouter();
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (venue) params.set("facility", venue);
    if (date) params.set("date", date);
    router.push(`/availability${params.size ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 rounded-full bg-white p-1.5 shadow-lg sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-maroon-600" />
        <input
          value={venue}
          onChange={(event) => setVenue(event.target.value)}
          placeholder="Search venue or date…"
          aria-label="Search venue or date"
          className="w-full bg-transparent py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
      </div>

      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Preferred date"
        className="w-full rounded-full border border-cream-300 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-maroon-400 sm:w-40"
      />

      <button type="submit" className="btn btn-primary shrink-0">
        <CalendarSearch className="h-4 w-4" />
        Check Availability
      </button>
    </form>
  );
}