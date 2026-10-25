"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export function NonAdminContent({ children }: { children: ReactNode }) {
  const { initialising, isAdmin } = useAuth();
  if (initialising || isAdmin) return null;
  return <>{children}</>;
}
