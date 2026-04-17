"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type AdminNavigationProps = {
  authorized: boolean;
};

const ADMIN_DESTINATIONS = [
  {
    title: "Admin Dashboard",
    description: "Quick access to admin tools and sections.",
    href: "/admin",
  },
  {
    title: "Songs Admin",
    description: "Create, edit, archive, and delete songs.",
    href: "/admin/songs",
  },
  {
    title: "Band Calendar",
    description: "View and manage services and rehearsals.",
    href: "/admin/calendar",
  },
  {
    title: "Contributions",
    description: "Track member contributions, expenses, and logs.",
    href: "/contributions",
  },
] as const;

export default function AdminNavigation({ authorized }: AdminNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/contributions/auth", {
        method: "DELETE",
        credentials: "include",
      });
      router.push("/admin");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Navigation</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Move between admin sections without leaving the admin area.
            </p>
          </div>
          {authorized ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          ) : (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Locked
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {ADMIN_DESTINATIONS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-xl border p-4 sm:p-5 transition-colors",
                active
                  ? "border-emerald-400/70 dark:border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/20"
                  : "border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 hover:border-emerald-400/60 dark:hover:border-emerald-500/50",
              ].join(" ")}
            >
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
              <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {active ? "Current section" : "Open section"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
