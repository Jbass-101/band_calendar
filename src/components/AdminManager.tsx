"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

type AdminManagerProps = {
  authorized: boolean;
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

export default function AdminManager({ authorized }: AdminManagerProps) {
  const [isAuthed, setIsAuthed] = useState(authorized);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [genre, setGenre] = useState<"worship" | "praise" | "other">("worship");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [active, setActive] = useState(true);
  const [lyricsSections, setLyricsSections] = useState<LyricsSectionsDraft>({
    intro: "",
    verse1: "",
    verse2: "",
    preChorus: "",
    chorus: "",
    hook: "",
    bridge: "",
    outro: "",
    ending: "",
  });

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

  async function handleSignOut() {
    await fetch("/api/contributions/auth", {
      method: "DELETE",
      credentials: "include",
    });
    setIsAuthed(false);
  }

  async function handleCreateSong(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/songs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          genre,
          youtubeUrl: youtubeUrl.trim() || null,
          spotifyUrl: spotifyUrl.trim() || null,
          active,
          lyricsSections,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        song?: { number?: number; name?: string };
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to create song");

      toast.success(
        body.song?.number && body.song?.name
          ? `Added #${body.song.number} ${body.song.name}`
          : "Song added"
      );

      setName("");
      setGenre("worship");
      setYoutubeUrl("");
      setSpotifyUrl("");
      setActive(true);
      setLyricsSections({
        intro: "",
        verse1: "",
        verse2: "",
        preChorus: "",
        chorus: "",
        hook: "",
        bridge: "",
        outro: "",
        ending: "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create song");
    } finally {
      setSaving(false);
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">Admin Portal</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Phase 1: Add songs outside Studio.</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add Song</h2>
        <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleCreateSong}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
            Song Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Genre
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as "worship" | "praise" | "other")}
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
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            />
            Active
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            YouTube URL
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              placeholder="https://youtube.com/..."
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Spotify URL
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              placeholder="https://open.spotify.com/..."
            />
          </label>
          <div className="sm:col-span-2 mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Lyrics Sections</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  ["intro", "Intro"],
                  ["verse1", "Verse 1"],
                  ["verse2", "Verse 2"],
                  ["preChorus", "Pre-Chorus"],
                  ["chorus", "Chorus"],
                  ["hook", "Hook"],
                  ["bridge", "Bridge"],
                  ["outro", "Outro"],
                  ["ending", "Ending"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  {label}
                  <textarea
                    rows={3}
                    value={lyricsSections[key]}
                    onChange={(e) =>
                      setLyricsSections((prev) => ({
                        ...prev,
                        [key]: e.target.value,
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
              disabled={saving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
            >
              {saving ? "Saving..." : "Create Song"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
