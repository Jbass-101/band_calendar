"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  ListMusic,
  Music,
  type LucideIcon,
} from "lucide-react";
import { BRANDING } from "@/src/lib/branding";

type SiteNavigationProps = {
  authorized: boolean;
};

const PUBLIC_LINKS = [
  { href: "/schedule", label: "Schedule" },
  { href: "/songs", label: "Songs" },
  { href: "/admin", label: "Admin" },
] as const;

const AUTHORIZED_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/contributions", label: "Contributions" },
  { href: "/songs", label: "Songs" },
  { href: "/setlists", label: "Setlists" },
] as const;

const NAV_ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/calendar": CalendarDays,
  "/contributions": CircleDollarSign,
  "/songs": Music,
  "/setlists": ListMusic,
  "/schedule": CalendarDays,
};

const LINK_THEME: Record<string, string> = {
  "/admin": "theme-dashboard",
  "/calendar": "theme-calendar",
  "/contributions": "theme-contributions",
  "/songs": "theme-songs",
  "/setlists": "theme-setlists",
  "/schedule": "theme-calendar",
};

function getThemeClassForPath(pathname: string) {
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return "theme-calendar";
  if (pathname === "/contributions" || pathname.startsWith("/contributions/")) return "theme-contributions";
  if (pathname === "/songs" || pathname.startsWith("/songs/")) return "theme-songs";
  if (pathname === "/setlists" || pathname.startsWith("/setlists/")) return "theme-setlists";
  if (pathname === "/schedule" || pathname.startsWith("/schedule/")) return "theme-calendar";
  return "theme-dashboard";
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavigation({ authorized }: SiteNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const activeThemeClass = getThemeClassForPath(pathname);

  if (pathname === "/login") {
    return null;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/contributions/auth", {
        method: "DELETE",
        credentials: "include",
      });
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <nav
      className={[
        activeThemeClass,
        "sticky top-0 z-50 border-b border-[color:var(--section-default)]/40 bg-[color:var(--section-soft)]/75 backdrop-blur",
      ].join(" ")}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="group flex items-center gap-2 min-w-0 self-start transition-transform"
          aria-label="Go to home"
        >
          <Image
            src={BRANDING.main.logoSrc}
            alt={BRANDING.main.logoAlt}
            width={32}
            height={32}
            className="h-8 w-8 object-contain transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-0.5"
            priority
          />
          <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap truncate transition-all duration-300 ease-out group-hover:text-violet-700 dark:group-hover:text-violet-300 group-hover:translate-x-0.5">
            {BRANDING.main.title}
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-start gap-1 text-xs sm:justify-end sm:text-sm">
          {authorized ? (
            <>
              {AUTHORIZED_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                const Icon = NAV_ICONS[link.href];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      LINK_THEME[link.href] ?? "theme-dashboard",
                      "rounded-md px-2 py-1.5 transition-colors border whitespace-nowrap inline-flex items-center gap-1.5",
                      active
                        ? "border-[color:var(--section-default)] bg-[color:var(--section-soft)] text-[color:var(--section-strong)]"
                        : "border-[color:var(--section-default)]/55 bg-[color:var(--section-soft)]/35 text-[color:var(--section-default)] hover:border-[color:var(--section-default)] hover:bg-[color:var(--section-soft)]/60",
                    ].join(" ")}
                  >
                    {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                    {link.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="section-accent-button rounded-md px-2 py-1.5 transition-colors border whitespace-nowrap border-[color:var(--section-strong)]"
              >
                {signingOut ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : (
            PUBLIC_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              const isAdminCta = link.href === "/admin";
              const iconHref = isAdminCta ? "/admin" : link.href;
              const Icon = NAV_ICONS[iconHref];
              return (
                <Link
                  key={link.href}
                  href={isAdminCta ? "/login" : link.href}
                  className={[
                    LINK_THEME[iconHref] ?? "theme-dashboard",
                    "rounded-md px-2 py-1.5 transition-colors border whitespace-nowrap inline-flex items-center gap-1.5",
                    isAdminCta
                      ? active
                        ? "border-[color:var(--section-strong)] bg-[color:var(--section-strong)] text-white"
                        : "border-[color:var(--section-strong)] bg-[color:var(--section-strong)] text-white hover:opacity-90"
                      : active
                        ? "border-[color:var(--section-default)] bg-[color:var(--section-soft)] text-[color:var(--section-strong)]"
                        : "border-[color:var(--section-default)]/55 bg-[color:var(--section-soft)]/35 text-[color:var(--section-default)] hover:border-[color:var(--section-default)] hover:bg-[color:var(--section-soft)]/60",
                  ].join(" ")}
                >
                  {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                  {link.label}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </nav>
  );
}

