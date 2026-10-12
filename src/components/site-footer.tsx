import { Users } from "lucide-react";
import { Crest } from "./logo";
import { SCHOOL_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-maroon-800 text-maroon-100">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
        <div className="flex items-center gap-3">
          <Crest className="h-12 w-12" />
          <div className="leading-tight">
            <p className="font-display text-lg font-extrabold text-white">KNCHS</p>
            <p className="font-display text-lg font-extrabold text-white">VenueBook</p>
          </div>
        </div>

        <p className="font-display text-sm italic text-maroon-200">
          Secure &middot; Simple &middot; Organized
        </p>

        <div className="flex items-center gap-2 text-sm text-maroon-100">
          <Users className="h-5 w-5" />
          For students, faculty, and staff.
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs text-maroon-200/80 sm:px-6">
          {SCHOOL_NAME}
        </p>
      </div>
    </footer>
  );
}