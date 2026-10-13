import { redirect } from "next/navigation";

/**
 * The home page is `/`, so this only catches bookmarks and old links.
 * It lives outside the authenticated route group on purpose — otherwise the
 * layout guard would send signed-out visitors to sign in instead.
 */
export default function DashboardRedirect() {
  redirect("/");
}