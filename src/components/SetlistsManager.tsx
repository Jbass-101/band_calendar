"use client";

import { useEffect, useState } from "react";
import type { Setlist, ServicePickerOption, Song } from "@/src/lib/sanity/client";
import AdminSetlistsManager from "@/src/components/AdminSetlistsManager";
import SetlistRepository from "@/src/components/SetlistRepository";

type SetlistsManagerProps = {
  setlists: Setlist[];
  songs: Song[];
  services: ServicePickerOption[];
  authorized: boolean;
};

type SetlistsTab = "repository" | "manage";

export default function SetlistsManager({
  setlists: initialSetlists,
  songs,
  services,
  authorized,
}: SetlistsManagerProps) {
  const [activeTab, setActiveTab] = useState<SetlistsTab>("repository");
  const [setlists, setSetlists] = useState(initialSetlists);

  useEffect(() => {
    setSetlists(initialSetlists);
  }, [initialSetlists]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">Setlists</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Browse service setlists and manage them when signed in.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Total setlists: <span className="font-semibold">{setlists.length}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("repository")}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "repository"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-300",
            ].join(" ")}
          >
            Repository
          </button>
          {authorized ? (
            <button
              type="button"
              onClick={() => setActiveTab("manage")}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "manage"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-300",
              ].join(" ")}
            >
              Manage
            </button>
          ) : null}
        </div>
      </div>

      {activeTab === "repository" ? (
        <SetlistRepository setlists={setlists} embedded />
      ) : (
        <AdminSetlistsManager
          authorized={authorized}
          initialSetlists={setlists}
          songs={songs}
          services={services}
          embedded
        />
      )}
    </section>
  );
}
