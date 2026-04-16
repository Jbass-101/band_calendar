"use client";

import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Song } from "@/src/lib/sanity/client";

type AdminSongsManagerProps = {
  authorized: boolean;
  initialSongs: Song[];
};

type LyricsSectionsDraft = {
  intro: string;
  verse1: string;
  verse2: string;
  preChorus: string;
  chorus: string;
  hook: string;
  bridge: string;
  outro: string;
  ending: string;
};

type SongDraft = {
  name: string;
  genre: "worship" | "praise" | "other";
  youtubeUrl: string;
  spotifyUrl: string;
  notes: string;
  active: boolean;
  lyricsSections: LyricsSectionsDraft;
};

const EMPTY_LYRICS: LyricsSectionsDraft = {
  intro: "",
  verse1: "",
  verse2: "",
  preChorus: "",
  chorus: "",
  hook: "",
  bridge: "",
  outro: "",
  ending: "",
};

const EMPTY_DRAFT: SongDraft = {
  name: "",
  genre: "worship",
  youtubeUrl: "",
  spotifyUrl: "",
  notes: "",
  active: true,
  lyricsSections: EMPTY_LYRICS,
};

const LYRICS_FIELDS: Array<{ key: keyof LyricsSectionsDraft; label: string }> = [
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

function toDraft(song: Song): SongDraft {
  return {
    name: song.name,
    genre: song.genre,
    youtubeUrl: song.youtubeUrl ?? "",
    spotifyUrl: song.spotifyUrl ?? "",
    notes: song.notes ?? "",
    active: song.active,
    lyricsSections: {
      intro: song.lyricsSections.intro ?? "",
      verse1: song.lyricsSections.verse1 ?? "",
      verse2: song.lyricsSections.verse2 ?? "",
      preChorus: song.lyricsSections.preChorus ?? "",
      chorus: song.lyricsSections.chorus ?? "",
      hook: song.lyricsSections.hook ?? "",
      bridge: song.lyricsSections.bridge ?? "",
      outro: song.lyricsSections.outro ?? "",
      ending: song.lyricsSections.ending ?? "",
    },
  };
}

export default function AdminSongsManager({ authorized, initialSongs }: AdminSongsManagerProps) {
  void authorized;

  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<SongDraft>(EMPTY_DRAFT);

  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editDraft, setEditDraft] = useState<SongDraft>(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const [busySongId, setBusySongId] = useState<string | null>(null);

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((song) => `${song.number} ${song.name} ${song.genre}`.toLowerCase().includes(q));
  }, [songs, query]);

  async function refreshSongs() {
    const res = await fetch("/api/admin/songs", { credentials: "include" });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; songs?: Song[] };
    if (!res.ok) throw new Error(payload.error ?? "Failed to load songs");
    setSongs(payload.songs ?? []);
  }

  async function handleCreateSong(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createDraft),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        song?: { number?: number; name?: string };
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create song");
      toast.success(payload.song ? `Added #${payload.song.number} ${payload.song.name}` : "Song added");
      setCreateDraft(EMPTY_DRAFT);
      await refreshSongs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create song");
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(song: Song) {
    setEditingSong(song);
    setEditDraft(toDraft(song));
  }

  async function handleSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSong) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/admin/songs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          songId: editingSong._id,
          ...editDraft,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update song");
      toast.success("Song updated");
      setEditingSong(null);
      await refreshSongs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update song");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveToggle(song: Song) {
    const action = song.active ? "archive" : "reactivate";
    const confirmed = window.confirm(
      song.active
        ? `Archive "${song.name}"? It will be hidden from active lists.`
        : `Reactivate "${song.name}"?`
    );
    if (!confirmed) return;

    setBusySongId(song._id);
    try {
      const res = await fetch("/api/admin/songs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ songId: song._id, active: !song.active }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `Failed to ${action} song`);
      toast.success(song.active ? "Song archived" : "Song reactivated");
      await refreshSongs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} song`);
    } finally {
      setBusySongId(null);
    }
  }

  async function handlePermanentDelete(song: Song) {
    const confirmed = window.confirm(
      `Permanently delete "${song.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setBusySongId(song._id);
    try {
      const res = await fetch("/api/admin/songs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ songId: song._id }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete song");
      toast.success("Song permanently deleted");
      await refreshSongs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete song");
    } finally {
      setBusySongId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">Songs Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Full CRUD for songs with archive and permanent delete actions.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Create Song</h2>
        <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleCreateSong}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
            Song Name
            <input
              type="text"
              value={createDraft.name}
              onChange={(e) => setCreateDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Genre
            <select
              value={createDraft.genre}
              onChange={(e) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  genre: e.target.value as SongDraft["genre"],
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="worship">Worship</option>
              <option value="praise">Praise</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={createDraft.active}
              onChange={(e) => setCreateDraft((prev) => ({ ...prev, active: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            />
            Active
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            YouTube URL
            <input
              type="url"
              value={createDraft.youtubeUrl}
              onChange={(e) => setCreateDraft((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              placeholder="https://youtube.com/..."
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Spotify URL
            <input
              type="url"
              value={createDraft.spotifyUrl}
              onChange={(e) => setCreateDraft((prev) => ({ ...prev, spotifyUrl: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              placeholder="https://open.spotify.com/..."
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
            Notes
            <textarea
              rows={3}
              value={createDraft.notes}
              onChange={(e) => setCreateDraft((prev) => ({ ...prev, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              placeholder="Arrangement notes..."
            />
          </label>
          <div className="sm:col-span-2 mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Lyrics Sections</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LYRICS_FIELDS.map((field) => (
                <label key={field.key} className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  {field.label}
                  <textarea
                    rows={3}
                    value={createDraft.lyricsSections[field.key]}
                    onChange={(e) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        lyricsSections: {
                          ...prev.lyricsSections,
                          [field.key]: e.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
            >
              {creating ? "Saving..." : "Create Song"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Manage Songs</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total: {songs.length}</p>
        </div>
        <label className="block mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Search by number, name, or genre..."
          />
        </label>
        <div className="mt-3 space-y-2">
          {visibleSongs.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No songs found.</p>
          ) : (
            visibleSongs.map((song) => (
              <div
                key={song._id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    #{song.number} - {song.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {song.genre} - {song.active ? "Active" : "Archived"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(song)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveToggle(song)}
                    disabled={busySongId === song._id}
                    className="rounded-md border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300 disabled:opacity-60"
                  >
                    {song.active ? "Archive" : "Reactivate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(song)}
                    disabled={busySongId === song._id}
                    className="rounded-md border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs text-red-700 dark:text-red-300 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingSong ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingSong.name}`}
          onClick={() => setEditingSong(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Edit #{editingSong.number} - {editingSong.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSong(null)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
            </div>
            <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleSaveEdit}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                Song Name
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Genre
                <select
                  value={editDraft.genre}
                  onChange={(e) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      genre: e.target.value as SongDraft["genre"],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="worship">Worship</option>
                  <option value="praise">Praise</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={editDraft.active}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Active
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                YouTube URL
                <input
                  type="url"
                  value={editDraft.youtubeUrl}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="https://youtube.com/..."
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Spotify URL
                <input
                  type="url"
                  value={editDraft.spotifyUrl}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, spotifyUrl: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="https://open.spotify.com/..."
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                Notes
                <textarea
                  rows={3}
                  value={editDraft.notes}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="Arrangement notes..."
                />
              </label>
              <div className="sm:col-span-2 mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Lyrics Sections</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LYRICS_FIELDS.map((field) => (
                    <label key={field.key} className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      {field.label}
                      <textarea
                        rows={3}
                        value={editDraft.lyricsSections[field.key]}
                        onChange={(e) =>
                          setEditDraft((prev) => ({
                            ...prev,
                            lyricsSections: {
                              ...prev.lyricsSections,
                              [field.key]: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
