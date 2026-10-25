"use client";

import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useFacilities } from "@/lib/use-facilities";

export function AdditionalFacilities() {
  const facilities = useFacilities().filter((facility) => facility.id !== "gymnasium" && facility.id !== "avr");
  if (!facilities.length) return null;
  return <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{facilities.map((facility) => <article key={facility.id} className="card p-5"><Building2 className="mb-3 h-8 w-8 text-brand-700" /><h3 className="font-semibold text-ink-900">{facility.name}</h3><p className="mt-1 text-sm text-ink-600">Capacity {facility.capacity} · {facility.description}</p><Link href={`/availability?facility=${facility.id}`} className="btn btn-outline mt-4 w-full">View schedule <ArrowRight className="h-4 w-4" /></Link></article>)}</div>;
}
