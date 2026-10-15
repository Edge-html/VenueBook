import { Users } from "lucide-react";
import { Logo } from "./logo";
import { SCHOOL_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-200 bg-ink-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between lg:px-8">
        <Logo />

        <p className="eyebrow">Secure &middot; Simple &middot; Organized</p>

        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Users className="h-4 w-4 text-ink-400" />
          For students, faculty, and staff.
        </div>
      </div>

      <div className="border-t border-ink-200 py-4">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs text-ink-500 sm:px-6 lg:px-8">
          {SCHOOL_NAME}
        </p>
      </div>
    </footer>
  );
}