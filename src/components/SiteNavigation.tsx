"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/schedule", label: "Schedule" },
  { href: "/songs", label: "Songs" },
  { href: "/setlists", label: "Setlists" },
  { href: "/contributions", label: "Contributions" },
  { href: "/admin", label: "Admin" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
  return pathname === href;
}

export default function SiteNavigation({ authorized }: SiteNavigationProps) {
  const pathname = usePathname();
  const links = authorized ? AUTHORIZED_LINKS : PUBLIC_LINKS;

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-black/50 backdrop-blur">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0 self-start"
          aria-label="Go to home"
        >
          <Image
            src={BRANDING.main.logoSrc}
            alt={BRANDING.main.logoAlt}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap truncate">
            {BRANDING.main.title}
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-start gap-1 text-xs sm:justify-end sm:text-sm">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const isAdminCta = !authorized && link.href === "/admin";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-md px-2 py-1.5 transition-colors border whitespace-nowrap",
                  isAdminCta
                    ? active
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    : active
                      ? "border-emerald-400/70 bg-emerald-50/70 dark:border-emerald-500/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200"
                      : "border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/30 text-zinc-700 dark:text-zinc-200 hover:bg-white/90 dark:hover:bg-zinc-900/40",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

