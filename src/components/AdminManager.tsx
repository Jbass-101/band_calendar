"use client";

import Link from "next/link";

type AdminManagerProps = {
  authorized?: boolean;
};

const ADMIN_CARDS = [
  {
    title: "Contributions",
    description: "Manage contributions, logs, expenses, and member statements.",
    href: "/contributions",
  },
  {
    title: "Songs",
    description: "Browse, create, edit, archive, and manage songs in one place.",
    href: "/songs",
  },
  {
    title: "Setlists",
    description: "View and manage the worship setlist collections.",
    href: "/setlists",
  },
  {
    title: "Sanity Studio",
    description: "Open the full studio to manage all document types.",
    href: "/studio",
  },
] as const;

export default function AdminManager({ authorized }: AdminManagerProps) {
  void authorized;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">Admin Portal</h1>
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
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5 hover:border-emerald-400/60 dark:hover:border-emerald-500/50 hover:shadow-sm transition-colors"
          >
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{card.description}</p>
            <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">Open section</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
