"use client";

import { useMemo, useState } from "react";
import type { Song } from "@/src/lib/sanity/client";

type SongRepositoryProps = {
  songs: Song[];
  embedded?: boolean;
};

const PAGE_SIZE = 20;
const SORT_HEADER_BUTTON_CLASS =
  "inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors";
const PAGINATION_META_CLASS = "text-zinc-500 dark:text-zinc-400";
const PAGINATION_BUTTON_CLASS =
  "rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-zinc-700 dark:text-zinc-200 disabled:opacity-50";

const LYRICS_SECTION_ORDER: Array<{ key: keyof Song["lyricsSections"]; label: string }> = [
  { key: "intro", label: "Intro" },
  { key: "verse1", label: "Verse 1" },
  { key: "verse2", label: "Verse 2" },
  { key: "preChorus", label: "Pre-Chorus" },
  { key: "chorus", label: "Chorus" },
  { key: "hook", label: "Hook" },
  { key: "bridge", label: "Bridge" },
  { key: "outro", label: "Outro" },
  { key: "ending", label: "Ending" },
];

function genreLabel(genre: Song["genre"]) {
  if (genre === "worship") return "Worship";
  if (genre === "praise") return "Praise";
  return "Other";
}

function getSongLyricsSections(song: Song) {
  return LYRICS_SECTION_ORDER
    .map(({ key, label }) => ({ key, label, content: song.lyricsSections[key] }))
    .filter((section) => typeof section.content === "string" && section.content.trim().length > 0);
}

export default function SongRepository({ songs, embedded = false }: SongRepositoryProps) {
  const [query, setQuery] = useState("");
  const [lyricsSong, setLyricsSong] = useState<Song | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"number" | "name" | "genre" | "status">("number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchFields, setSearchFields] = useState<{
    name: boolean;
    genre: boolean;
    lyrics: boolean;
  }>({
    name: true,
    genre: true,
    lyrics: true,
  });

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;

    return songs.filter((song) => {
      const lyricsText = getSongLyricsSections(song)
        .map((section) => section.content)
        .join(" ");
      const haystack = [
        searchFields.name ? song.name : "",
        searchFields.genre ? song.genre : "",
        searchFields.lyrics ? lyricsText : "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [songs, query, searchFields]);

  const sortedSongs = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filteredSongs].sort((a, b) => {
      if (sortKey === "name") return factor * a.name.localeCompare(b.name);
      if (sortKey === "genre") return factor * a.genre.localeCompare(b.genre);
      if (sortKey === "status") return factor * Number(a.active) - factor * Number(b.active);
      return factor * (a.number - b.number);
    });
  }, [filteredSongs, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedSongs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSongs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedSongs.slice(start, start + PAGE_SIZE);
  }, [safePage, sortedSongs]);

  function toggleSort(nextKey: "number" | "name" | "genre" | "status") {
    setPage(1);
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortIcon(key: "number" | "name" | "genre" | "status") {
    if (sortKey !== key) return "△";
    return sortDirection === "asc" ? "▲" : "▼";
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {embedded ? "Repository" : "Song Repository"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Search and browse songs for future setlists.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Total songs: <span className="font-semibold">{songs.length}</span>
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
            placeholder="Search songs..."
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Search in:</span>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={searchFields.name}
              onChange={(e) =>
                setSearchFields((prev) => {
                  setPage(1);
                  return {
                    ...prev,
                    name: e.target.checked,
                  };
                })
              }
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Name
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={searchFields.genre}
              onChange={(e) =>
                setSearchFields((prev) => {
                  setPage(1);
                  return {
                    ...prev,
                    genre: e.target.checked,
                  };
                })
              }
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Genre
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={searchFields.lyrics}
              onChange={(e) =>
                setSearchFields((prev) => {
                  setPage(1);
                  return {
                    ...prev,
                    lyrics: e.target.checked,
                  };
                })
              }
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Lyrics
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        {sortedSongs.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No songs match your search.</p>
        ) : (
          <>
            <div className="space-y-2 sm:hidden">
              {pagedSongs.map((song) => (
                (() => {
                  const hasLyrics = getSongLyricsSections(song).length > 0;
                  return (
                <div
                  key={song._id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white/80 dark:bg-zinc-950/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        #{song.number} — {song.name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{genreLabel(song.genre)}</p>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        song.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                      ].join(" ")}
                    >
                      {song.active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                    {song.themes.length > 0 ? <p>Themes: {song.themes.join(", ")}</p> : null}
                    {song.tags.length > 0 ? <p>Tags: {song.tags.join(", ")}</p> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {song.youtubeUrl ? (
                      <a
                        href={song.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        YouTube
                      </a>
                    ) : null}
                    {song.spotifyUrl ? (
                      <a
                        href={song.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Spotify
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setLyricsSong(song)}
                      disabled={!hasLyrics}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      View Lyrics
                    </button>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 px-3"><button type="button" onClick={() => toggleSort("number")} className={SORT_HEADER_BUTTON_CLASS}># {sortIcon("number")}</button></th>
                    <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort("name")} className={SORT_HEADER_BUTTON_CLASS}>Name {sortIcon("name")}</button></th>
                    <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort("genre")} className={SORT_HEADER_BUTTON_CLASS}>Genre {sortIcon("genre")}</button></th>
                    <th className="py-2 pr-3">Themes / Tags</th>
                    <th className="py-2 pr-3">Links</th>
                    <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort("status")} className={SORT_HEADER_BUTTON_CLASS}>Status {sortIcon("status")}</button></th>
                    <th className="py-2 pr-3">Lyrics</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSongs.map((song, idx) => (
                    (() => {
                      const hasLyrics = getSongLyricsSections(song).length > 0;
                      return (
                    <tr
                      key={song._id}
                      className={[
                        "border-b border-zinc-100 dark:border-zinc-900",
                        idx % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-950/30" : "",
                      ].join(" ")}
                    >
                      <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">{song.number}</td>
                      <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{song.name}</td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{genreLabel(song.genre)}</td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                        {[...song.themes, ...song.tags].length > 0
                          ? [...song.themes, ...song.tags].join(", ")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {song.youtubeUrl ? (
                            <a
                              href={song.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              YouTube
                            </a>
                          ) : null}
                          {song.spotifyUrl ? (
                            <a
                              href={song.spotifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              Spotify
                            </a>
                          ) : null}
                          {!song.youtubeUrl && !song.spotifyUrl ? (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            song.active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                          ].join(" ")}
                        >
                          {song.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setLyricsSong(song)}
                          disabled={!hasLyrics}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          View Lyrics
                        </button>
                      </td>
                    </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
            {sortedSongs.length > PAGE_SIZE ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
                <div className={PAGINATION_META_CLASS}>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, sortedSongs.length)} of {sortedSongs.length}
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
          </>
        )}
      </div>

      {lyricsSong ? (
        (() => {
          const lyricsSections = getSongLyricsSections(lyricsSong);
          return (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Lyrics for ${lyricsSong.name}`}
          onClick={() => setLyricsSong(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  #{lyricsSong.number} — {lyricsSong.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {genreLabel(lyricsSong.genre)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLyricsSong(null)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              {lyricsSections.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No lyrics sections saved for this song.</p>
              ) : (
                <div className="space-y-4">
                  {lyricsSections.map((section, idx) => (
                    <div key={`${section.key}-${idx}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {section.label}
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
                        {section.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {lyricsSong.notes ? (
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Arrangement notes
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                  {lyricsSong.notes}
                </p>
              </div>
            ) : null}
          </div>
        </div>
          );
        })()
      ) : null}
    </section>
  );
}
