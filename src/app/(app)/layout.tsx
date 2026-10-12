import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth-guard";

export const metadata: Metadata = {
  title: {
    default: "VenueBook",
    template: "%s · KNCHS VenueBook",
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      {/* The auth gate swaps once Firebase resolves; suspending keeps the
          prerender from evaluating client-only values like `new Date()`. */}
      <Suspense fallback={null}>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </Suspense>
    </RequireAuth>
  );
}