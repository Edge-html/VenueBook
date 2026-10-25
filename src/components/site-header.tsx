"use client";

import {
  Bell,
  CalendarCheck,
  CalendarSearch,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { allBookingsQuery, notificationsQueryForUser } from "@/lib/data";
import { useLiveQuery } from "@/lib/use-live-query";
import { Logo } from "./logo";

const LINKS = [
  { href: "/book", label: "Book a Facility", icon: CalendarCheck },
  { href: "/availability", label: "Check Availability", icon: CalendarSearch },
  { href: "/reservations", label: "My Reservations", icon: ClipboardList },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const HOME_LINKS = [{ href: "/", label: "Home", icon: LayoutDashboard }, ...LINKS];
const ADMIN_LINKS = [
  { href: "/admin", label: "Booking Requests", icon: ClipboardList },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const adminBookings = useLiveQuery({ cacheKey: `header-admin-bookings:${user?.uid ?? "none"}`, enabled: Boolean(user && isAdmin), deps: [user?.uid, isAdmin, profile?.assignedFacilityIds], buildQueries: () => user && isAdmin ? [allBookingsQuery(profile?.assignedFacilityIds)] : [] });
  const notices = useLiveQuery({ cacheKey: `header-notices:${user?.uid ?? "none"}`, enabled: Boolean(user), deps: [user?.uid], buildQueries: () => user ? [notificationsQueryForUser(user.uid)] : [] });
  const pendingCount = isAdmin ? (adminBookings.docs ?? []).filter((entry) => entry.data().status === "pending").length : 0;
  const unreadCount = (notices.docs ?? []).filter((entry) => !entry.data().read).length;
  const navLinks = user && isAdmin ? ADMIN_LINKS : user ? HOME_LINKS : [{ href: "/", label: "Home", icon: LayoutDashboard }];

  // Any navigation should leave the menus closed; links close them on click.
  const closeMenus = () => {
    setMobileOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // `/` is the home page for everyone, signed in or not.
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-ink-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-3">
          <Logo />
          <span className="hidden h-8 w-px bg-ink-200 lg:block xl:hidden" />
          {/* Fills the gap the icon-only nav leaves at lg. Once the labels
              arrive at xl the row needs all 1280px the container allows, so
              this decorative tagline steps aside. */}
          <span className="hidden whitespace-nowrap text-sm text-ink-500 lg:block xl:hidden">
            Your Space, Your Schedule.
          </span>
        </div>

        {/* The labels do not fit beside the logo and auth buttons until xl, so
            from lg up each link is a padded icon that grows into its label.
            That keeps every destination one click away at any width, and
            guarantees a label never breaks across two lines. */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? isHome : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={`flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors xl:px-3.5 ${
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-ink-600 hover:bg-ink-200 hover:text-ink-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-700" : "text-ink-400"}`} />
                <span className="hidden xl:inline">{label}</span>
                {href === "/admin" && pendingCount > 0 && <span className="badge bg-booked text-white">{pendingCount}</span>}
                {href === "/notifications" && unreadCount > 0 && <span className="badge bg-booked text-white">{unreadCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-2">
          {user ? (
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-ink-300 hover:bg-ink-50"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                  {(profile?.fullName || user.email || "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-28 truncate text-sm font-medium text-ink-800">
                  {profile?.fullName ?? user.email}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lift"
                >
                  <div className="border-b border-ink-200 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {profile?.fullName}
                    </p>
                    <p className="truncate text-xs text-ink-500">{user.email}</p>
                    <span
                      className={`badge mt-2 ${
                        isAdmin ? "bg-ink-200 text-ink-700" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                      {isAdmin ? "Administrator" : "Student"}
                    </span>
                  </div>

                  <div className="p-1.5">
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={closeMenus}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
                    >
                      <UserRound className="h-4 w-4 text-ink-400" /> My profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={closeMenus}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
                      >
                        <ShieldCheck className="h-4 w-4 text-ink-400" /> Admin console
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-booked transition-colors hover:bg-booked-soft"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/signin" className="btn btn-ghost">
                Sign In
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Create Account
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid h-10 w-10 place-items-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-100 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink-200 bg-ink-50 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              onClick={closeMenus}
              aria-current={isHome ? "page" : undefined}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
                isHome ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ink-200"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Home
            </Link>
            {(user && isAdmin ? ADMIN_LINKS : user ? LINKS : []).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenus}
                aria-current={pathname === href ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-brand-50 text-brand-800"
                    : "text-ink-600 hover:bg-ink-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {href === "/admin" && pendingCount > 0 && <span className="badge bg-booked text-white">{pendingCount}</span>}
                {href === "/notifications" && unreadCount > 0 && <span className="badge bg-booked text-white">{unreadCount}</span>}
              </Link>
            ))}

            <div className="my-2 h-px bg-ink-200" />

            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeMenus}
                  className="flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-200"
                >
                  <UserRound className="h-4 w-4" /> My profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={closeMenus}
                    className="flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-200"
                  >
                    <ShieldCheck className="h-4 w-4" /> Admin console
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-sm font-medium text-booked transition-colors hover:bg-booked-soft"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Link href="/signin" onClick={closeMenus} className="btn btn-outline flex-1">
                  Sign In
                </Link>
                <Link href="/signup" onClick={closeMenus} className="btn btn-primary flex-1">
                  Create Account
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
