"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side gate for signed-in areas. Firebase sessions live in IndexedDB,
 * so there is no cookie for the server to read — the redirect happens after the
 * SDK resolves the user on the client.
 */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user, profile, initialising, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initialising) return;
    if (!user) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // The profile lands a tick after the user record, so only redirect once it
    // has actually resolved.
    if (adminOnly && profile && !isAdmin) {
      router.replace("/");
    }
  }, [initialising, user, profile, adminOnly, isAdmin, router, pathname]);

  if (initialising) return <FullPageLoader label="Checking your session…" />;

  if (!user) return <FullPageLoader label="Redirecting to sign in…" />;

  if (adminOnly && profile && !isAdmin) {
    return <FullPageLoader label="Administrator access only…" />;
  }

  return <>{children}</>;
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-700" />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

/** Signed-in users should not see the marketing hero's auth pitch. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialising && user) router.replace("/");
  }, [initialising, user, router]);

  if (initialising) return <FullPageLoader label="Loading…" />;
  if (user) return <FullPageLoader label="Taking you to your dashboard…" />;

  return <>{children}</>;
}