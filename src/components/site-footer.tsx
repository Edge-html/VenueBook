import { Users } from "lucide-react";
import { Logo } from "./logo";
import { SCHOOL_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand-800 text-brand-100">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
        <Logo variant="light" />

        <p className="text-sm text-brand-200">Secure &middot; Simple &middot; Organized</p>

        <div className="flex items-center gap-2 text-sm text-brand-100">
          <Users className="h-5 w-5" />
          For students, faculty, and staff.
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs text-brand-200/80 sm:px-6">
          {SCHOOL_NAME}
        </p>
      </div>
    </footer>
  );
}