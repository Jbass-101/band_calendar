"use client";

import { useMemo, useState } from "react";
import type { Setlist, Song } from "@/src/lib/sanity/client";

type SetlistRepositoryProps = {
  setlists: Setlist[];
};

function serviceTypeLabel(serviceType: Setlist["serviceType"]) {
  if (serviceType === "sunday_morning") return "Sunday Morning";
  if (serviceType === "sunday_evening") return "Sunday Evening";
  if (serviceType === "midweek") return "Midweek";
  return "Special Service";
}

function songGenreLabel(genre: Song["genre"] | null) {
  if (genre === "worship") return "Worship";
  if (genre === "praise") return "Praise";
  if (genre === "other") return "Other";
  return "—";
}

export default function SetlistRepository({ setlists }: SetlistRepositoryProps) {
  const [query, setQuery] = useState("");

  const filteredSetlists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return setlists;

    return setlists.filter((setlist) => {
      const songsText = setlist.songs
        .map((item) => [item.songNumber ?? "", item.songName ?? "", item.songGenre ?? "", item.note ?? ""].join(" "))
        .join(" ");

      const haystack = [
        setlist.title ?? "",
        setlist.date,
        setlist.serviceType,
        setlist.notes ?? "",
        setlist.active ? "active" : "archived",
        songsText,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [setlists, query]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Setlists
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Track ordered song flows for services.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Total setlists: <span className="font-semibold">{setlists.length}</span>
          </div>
        </div>
        <label className="block mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, date, service type, songs..."
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        {filteredSetlists.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No setlists found.</p>
        ) : (
          <div className="space-y-3">
            {filteredSetlists.map((setlist) => (
              <article
                key={setlist._id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/50 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {setlist.title ?? `Setlist ${setlist.date}`}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {setlist.date} • {serviceTypeLabel(setlist.serviceType)}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      setlist.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                    ].join(" ")}
                  >
                    {setlist.active ? "Active" : "Archived"}
                  </span>
                </div>

                {setlist.songs.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 pr-3">Song</th>
                          <th className="py-2 pr-3">Genre</th>
                          <th className="py-2 pr-3">Item Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setlist.songs.map((item, idx) => (
                          <tr
                            key={item._key}
                            className={idx % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-900/25" : ""}
                          >
                            <td className="py-2 px-3 font-medium text-zinc-800 dark:text-zinc-100">
                              {item.songNumber ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-100">
                              {item.songName ?? "Missing song reference"}
                            </td>
                            <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                              {songGenreLabel(item.songGenre)}
                            </td>
                            <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                              {item.note ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    No songs added.
                  </p>
                )}

                {setlist.notes ? (
                  <p className="mt-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words">
                    {setlist.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
