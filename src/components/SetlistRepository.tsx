"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Setlist, SetlistSongItem, Song } from "@/src/lib/sanity/client";
import { formatIsoDateToDDMMYYYY } from "@/src/lib/formatDate";

type SetlistRepositoryProps = {
  setlists: Setlist[];
  embedded?: boolean;
};

function songGenreLabel(genre: Song["genre"] | null) {
  if (genre === "worship") return "Worship";
  if (genre === "praise") return "Praise";
  if (genre === "other") return "Other";
  return "—";
}

function statusLabel(status: Setlist["status"]) {
  if (status === "draft") return "Draft";
  if (status === "ready") return "Ready";
  if (status === "final") return "Final";
  return "Archived";
}

function statusBadgeClass(status: Setlist["status"]) {
  if (status === "final") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (status === "ready") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
  }
  if (status === "archived") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
  return "bg-amber-100 text-amber-900 dark:bg-amber-900/25 dark:text-amber-200";
}

function formatKey(item: SetlistSongItem): string {
  const v = item.keyOverride ?? item.defaultKey;
  return v && v.trim() ? v.trim() : "—";
}

function formatTempo(item: SetlistSongItem): string {
  if (item.tempoOverride != null) return String(item.tempoOverride);
  if (item.tempoBpm != null) return String(item.tempoBpm);
  return "—";
}

const PAGE_SIZE = 20;
type SortKey = "date" | "title" | "status" | "songs";
const SORT_CONTROL_BUTTON_CLASS =
  "rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors";
const PAGINATION_META_CLASS = "text-zinc-500 dark:text-zinc-400";
const PAGINATION_BUTTON_CLASS =
  "rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-zinc-700 dark:text-zinc-200 disabled:opacity-50";

export default function SetlistRepository({ setlists, embedded = false }: SetlistRepositoryProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedSetlists, setExpandedSetlists] = useState<Set<string>>(new Set());

  const filteredSetlists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return setlists;

    return setlists.filter((setlist) => {
      const songsText = setlist.songs
        .map((item) =>
          [
            item.songNumber ?? "",
            item.songName ?? "",
            item.songGenre ?? "",
            item.note ?? "",
            item.keyOverride ?? "",
            item.defaultKey ?? "",
            item.tempoOverride ?? "",
            item.tempoBpm ?? "",
          ].join(" ")
        )
        .join(" ");

      const leads = setlist.leadVocalNames.join(" ");

      const haystack = [
        setlist.serviceDate,
        setlist.serviceTitle,
        setlist.status,
        setlist.notes ?? "",
        leads,
        songsText,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [setlists, query]);

  const sortedSetlists = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filteredSetlists].sort((a, b) => {
      if (sortKey === "title") return factor * a.serviceTitle.localeCompare(b.serviceTitle);
      if (sortKey === "status") return factor * a.status.localeCompare(b.status);
      if (sortKey === "songs") return factor * (a.songs.length - b.songs.length);
      return factor * a.serviceDate.localeCompare(b.serviceDate);
    });
  }, [filteredSetlists, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedSetlists.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSetlists = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedSetlists.slice(start, start + PAGE_SIZE);
  }, [safePage, sortedSetlists]);

  function toggleSort(nextKey: SortKey) {
    setPage(1);
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "date" ? "desc" : "asc");
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "△";
    return sortDirection === "asc" ? "▲" : "▼";
  }

  function toggleSetlistExpanded(setlistId: string) {
    setExpandedSetlists((prev) => {
      const next = new Set(prev);
      if (next.has(setlistId)) next.delete(setlistId);
      else next.add(setlistId);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {embedded ? "Repository" : "Setlists"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {embedded
                ? "Browse ordered songs per calendar service and open exports."
                : "Ordered songs per calendar service. Sign in to create or edit setlists in Manage."}
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
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, date, service, status, lead vocal, songs..."
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        {sortedSetlists.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No setlists found.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <button type="button" onClick={() => toggleSort("date")} className={SORT_CONTROL_BUTTON_CLASS}>
                Date {sortIcon("date")}
              </button>
              <button type="button" onClick={() => toggleSort("title")} className={SORT_CONTROL_BUTTON_CLASS}>
                Service {sortIcon("title")}
              </button>
              <button type="button" onClick={() => toggleSort("status")} className={SORT_CONTROL_BUTTON_CLASS}>
                Status {sortIcon("status")}
              </button>
              <button type="button" onClick={() => toggleSort("songs")} className={SORT_CONTROL_BUTTON_CLASS}>
                Songs {sortIcon("songs")}
              </button>
            </div>
            {pagedSetlists.map((setlist) => (
              <article
                id={setlist._id}
                key={setlist._id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/50 p-3 sm:p-4 scroll-mt-24"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {formatIsoDateToDDMMYYYY(setlist.serviceDate)} - {setlist.serviceTitle}
                    </h2>
                    {setlist.leadVocalNames.length > 0 ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Lead vocal: {setlist.leadVocalNames.join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/setlists/${setlist._id}/export/band`}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        Export band sheet
                      </Link>
                      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                        |
                      </span>
                      <Link
                        href={`/setlists/${setlist._id}/export/media`}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        Export media / lyrics
                      </Link>
                    </div>
                  </div>
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      statusBadgeClass(setlist.status),
                    ].join(" ")}
                  >
                    {statusLabel(setlist.status)}
                  </span>
                </div>

                {setlist.songs.length > 0 ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleSetlistExpanded(setlist._id)}
                      className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {expandedSetlists.has(setlist._id) ? "Hide songs" : `Show songs (${setlist.songs.length})`}
                    </button>
                    {expandedSetlists.has(setlist._id) ? (
                      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                        <table className="min-w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 pr-3">Song</th>
                              <th className="py-2 pr-3">Section</th>
                              <th className="py-2 pr-3">Genre</th>
                              <th className="py-2 pr-3">Key</th>
                              <th className="py-2 pr-3">Tempo</th>
                              <th className="py-2 pr-3">Note</th>
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
                                  {item.section}
                                </td>
                                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                                  {songGenreLabel(item.songGenre)}
                                </td>
                                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                                  {formatKey(item)}
                                </td>
                                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                                  {formatTempo(item)}
                                </td>
                                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                                  {item.note ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">No songs added.</p>
                )}

                {setlist.notes ? (
                  <p className="mt-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words">
                    {setlist.notes}
                  </p>
                ) : null}
              </article>
            ))}
            {sortedSetlists.length > PAGE_SIZE ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
                <div className={PAGINATION_META_CLASS}>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, sortedSetlists.length)} of {sortedSetlists.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className={PAGINATION_BUTTON_CLASS}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className={PAGINATION_BUTTON_CLASS}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
