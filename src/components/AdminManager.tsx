"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type AdminManagerProps = {
  authorized: boolean;
};

const ADMIN_CARDS = [
  {
    title: "Contributions",
    description: "Manage contributions, logs, expenses, and member statements.",
    href: "/contributions",
  },
  {
    title: "Songs Admin",
    description: "Create, edit, archive, and delete songs in the library.",
    href: "/admin/songs",
  },
  {
    title: "Setlists",
    description: "View and manage the worship setlist collections.",
    href: "/setlists",
  },
  {
    title: "Songs Repository",
    description: "Browse all songs and lyrics from the public repository view.",
    href: "/songs",
  },
  {
    title: "Sanity Studio",
    description: "Open the full studio to manage all document types.",
    href: "/studio",
  },
] as const;

export default function AdminManager({ authorized }: AdminManagerProps) {
  const [isAuthed, setIsAuthed] = useState(authorized);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  async function handleUnlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUnlockError(null);

    try {
      const res = await fetch("/api/contributions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unauthorized");
      }
      setIsAuthed(true);
      setPassword("");
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Unlock failed");
    }
  }

  if (!isAuthed) {
    return (
      <section className="max-w-md mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Admin Portal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use contributions admin password to unlock.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleUnlock}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              required
            />
          </label>
          {unlockError ? <p className="text-sm text-red-600 dark:text-red-400">{unlockError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-2 text-sm font-medium"
          >
            Unlock
          </button>
        </form>
      </section>
    );
  }

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
