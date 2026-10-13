"use client";

import { CalendarSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FACILITIES } from "@/lib/constants";

/** Recognises "gymnasium"/"gym"/"avr" anywhere in the query. */
function detectFacility(query: string): string | null {
  const q = query.toLowerCase();
  if (/\bavr\b|audio|visual/.test(q)) return "avr";
  if (/gym|gymnasi|hall/.test(q)) return "gymnasium";
  return null;
}

/** Accepts common date shapes and normalises to `YYYY-MM-DD`. */
function detectDate(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const d = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function AvailabilitySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const params = new URLSearchParams();
    const facility = detectFacility(query);
    const date = detectDate(query);

    if (facility) params.set("facility", facility);
    if (date) params.set("date", date);

    router.push(`/availability${params.size ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-sm"
    >
      <Search className="h-4 w-4 shrink-0 text-brand-600" />

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search venue or date…"
        aria-label="Search venue or date"
        list="venue-suggestions"
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink-800 outline-none placeholder:text-ink-400"
      />

      <button type="submit" className="btn btn-primary shrink-0">
        <CalendarSearch className="h-4 w-4" />
        Check Availability
      </button>

      <datalist id="venue-suggestions">
        {FACILITIES.map((facility) => (
          <option key={facility.id} value={facility.name} />
        ))}
      </datalist>
    </form>
  );
}