import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth-guard";
import { AdminConsole } from "@/components/admin-console";

export const metadata: Metadata = {
  title: "Admin Console",
  description: "Approve venue requests and manage the KNCHS facility schedule.",
};

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminConsole />
    </RequireAuth>
  );
}