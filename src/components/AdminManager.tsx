"use client";

import Link from "next/link";
import { CalendarDays, CircleDollarSign, ListMusic, Music, type LucideIcon } from "lucide-react";

type AdminManagerProps = {
  authorized?: boolean;
};

const ADMIN_CARDS = [
  {
    title: "Band Calendar",
    description: "View the month schedule and manage services and rehearsals.",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    title: "Contributions",
    description: "Manage contributions, logs, expenses, and member statements.",
    href: "/contributions",
    icon: CircleDollarSign,
  },
  {
    title: "Songs",
    description: "Browse, create, edit, archive, and manage songs in one place.",
    href: "/songs",
    icon: Music,
  },
  {
    title: "Setlists",
    description: "View and manage the worship setlist collections.",
    href: "/setlists",
    icon: ListMusic,
  },
] as const satisfies ReadonlyArray<{
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}>;

const CARD_THEME_CLASS: Record<string, string> = {
  "/calendar": "theme-calendar",
  "/contributions": "theme-contributions",
  "/songs": "theme-songs",
  "/setlists": "theme-setlists",
};

export default function AdminManager({ authorized }: AdminManagerProps) {
  void authorized;

  return (
    <section className="space-y-4">
      <div className="section-panel rounded-xl border p-4 sm:p-5">
        <div>
          <h1 className="section-accent-text text-lg sm:text-xl font-semibold">Admin Portal</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose a section below to manage admin features.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {ADMIN_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="section-panel rounded-xl border p-4 sm:p-5 hover:border-[color:var(--section-default)] hover:shadow-sm transition-colors"
          >
            <div className={CARD_THEME_CLASS[card.href] ?? "theme-dashboard"}>
              <div className="flex items-start gap-3">
                <span className="section-accent-chip mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <card.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{card.description}</p>
                  <p className="section-accent-text mt-3 text-xs font-medium">Open section</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
