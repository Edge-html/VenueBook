"use client";

import {
  Bell,
  CalendarCheck,
  CalendarSearch,
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
import { Logo } from "./logo";

const LINKS = [
  { href: "/book", label: "Book a Facility", icon: CalendarCheck },
  { href: "/availability", label: "Check Availability", icon: CalendarSearch },
  { href: "/reservations", label: "My Reservations", icon: ClipboardList },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const HOME_LINKS = [{ href: "/", label: "Home", icon: LayoutDashboard }, ...LINKS];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-50 border-b border-cream-300 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden h-8 w-px bg-cream-300 lg:block" />
          <span className="hidden font-display text-sm italic text-maroon-800/70 lg:block">
            Your Space, Your Schedule.
          </span>
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {HOME_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? isHome : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-maroon-50 text-maroon-800"
                    : "text-neutral-700 hover:bg-cream-200 hover:text-maroon-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          {user ? (
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-cream-300 bg-white py-1.5 pl-1.5 pr-3 transition-colors hover:border-maroon-300"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-maroon-700 text-xs font-bold text-white">
                  {(profile?.fullName || user.email || "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-28 truncate text-sm font-medium text-neutral-800">
                  {profile?.fullName ?? user.email}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl border border-cream-300 bg-white shadow-lg"
                >
                  <div className="border-b border-cream-200 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {profile?.fullName}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isAdmin ? "bg-gold-200 text-gold-600" : "bg-maroon-50 text-maroon-700"
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
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-cream-100"
                    >
                      <UserRound className="h-4 w-4" /> My profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-cream-100"
                      >
                        <ShieldCheck className="h-4 w-4" /> Admin console
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-booked hover:bg-booked-soft"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/signin" className="btn btn-outline">
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
            className="grid h-10 w-10 place-items-center rounded-xl border border-cream-300 bg-white text-maroon-800 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-cream-300 bg-cream-50 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <Link
              href="/"
              onClick={closeMenus}
              aria-current={isHome ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isHome ? "bg-maroon-50 text-maroon-800" : "text-neutral-700 hover:bg-cream-200"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Home
            </Link>
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenus}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  pathname === href
                    ? "bg-maroon-50 text-maroon-800"
                    : "text-neutral-700 hover:bg-cream-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

            <div className="my-2 h-px bg-cream-300" />

            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={closeMenus}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-cream-200"
                >
                  <UserRound className="h-4 w-4" /> My profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={closeMenus}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-cream-200"
                  >
                    <ShieldCheck className="h-4 w-4" /> Admin console
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-booked hover:bg-booked-soft"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
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