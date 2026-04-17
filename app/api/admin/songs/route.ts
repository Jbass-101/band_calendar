import { NextResponse } from "next/server";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";
import { fetchSongs } from "@/src/lib/sanity/client";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type CreateSongBody = {
  songId?: string;
  name?: string;
  genre?: "worship" | "praise" | "other";
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  defaultKey?: string | null;
  tempoBpm?: number | null;
  notes?: string | null;
  active?: boolean;
  lyricsSections?: {
    intro?: string | null;
    verse1?: string | null;
    verse2?: string | null;
    preChorus?: string | null;
    chorus?: string | null;
    hook?: string | null;
    bridge?: string | null;
    outro?: string | null;
    ending?: string | null;
  };
};

async function isAuthorizedFromRequest(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookiePairs = cookieHeader.split(";").map((part) => part.trim());
  const cookieName = getContribAuthCookieName();
  const authCookie = cookiePairs.find((pair) => pair.startsWith(`${cookieName}=`));
  const cookieValue = authCookie ? decodeURIComponent(authCookie.split("=")[1] ?? "") : undefined;
  return isContribSessionValidFromCookie(cookieValue);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(value: unknown): string | null {
  const str = normalizeString(value);
  if (!str) return null;
  try {
    const url = new URL(str);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isAllowedHost(url: string, allowedHosts: string[]) {
  const host = new URL(url).hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function validateSongBody(body: CreateSongBody) {
  const name = normalizeString(body.name);
  const genre = body.genre;

  if (!name) {
    return { error: "Song name is required." };
  }
  if (genre !== "worship" && genre !== "praise" && genre !== "other") {
    return { error: "Genre must be worship, praise, or other." };
  }

  const youtubeUrl = normalizeUrl(body.youtubeUrl);
  if (!youtubeUrl) {
    return { error: "YouTube URL is required." };
  }
  if (!isAllowedHost(youtubeUrl, ["youtube.com", "youtu.be"])) {
    return { error: "Use a valid YouTube URL (youtube.com or youtu.be)." };
  }

  const spotifyUrl = normalizeUrl(body.spotifyUrl);
  if (body.spotifyUrl != null && body.spotifyUrl !== "" && !spotifyUrl) {
    return { error: "Spotify URL is invalid." };
  }
  if (spotifyUrl && !isAllowedHost(spotifyUrl, ["spotify.com"])) {
    return { error: "Use a valid Spotify URL (spotify.com)." };
  }

  let tempoBpm: number | null | undefined = undefined;
  if (body.tempoBpm === null) {
    tempoBpm = null;
  } else if (typeof body.tempoBpm === "number") {
    if (
      !Number.isFinite(body.tempoBpm) ||
      body.tempoBpm < 1 ||
      body.tempoBpm > 400
    ) {
      return { error: "Tempo must be between 1 and 400 BPM." };
    }
    tempoBpm = Math.round(body.tempoBpm);
  }

  return {
    name,
    genre,
    youtubeUrl,
    spotifyUrl,
    defaultKey: normalizeString(body.defaultKey),
    tempoBpm,
    notes: normalizeString(body.notes),
    lyricsSections: body.lyricsSections ?? {},
    active: body.active !== false,
  };
}

export async function GET(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const songs = await fetchSongs();
    return NextResponse.json({ songs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load songs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateSongBody;
  const validated = validateSongBody(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const client = getSanityWriteClient();

  const duplicateNameCount = await client.fetch<number>(
    `count(*[_type == "song" && name == $name])`,
    { name: validated.name }
  );
  if (duplicateNameCount > 0) {
    return NextResponse.json({ error: "Song name already exists." }, { status: 409 });
  }

  const currentMax = await client.fetch<number>(
    `coalesce(*[_type == "song" && defined(number)] | order(number desc)[0].number, 0)`
  );
  const number = (typeof currentMax === "number" ? currentMax : 0) + 1;

  const lyricsSections = validated.lyricsSections;

  const created = await client.create({
    _type: "song",
    number,
    name: validated.name,
    genre: validated.genre,
    youtubeUrl: validated.youtubeUrl,
    spotifyUrl: validated.spotifyUrl ?? undefined,
    defaultKey: validated.defaultKey ?? undefined,
    ...(validated.tempoBpm === undefined
      ? {}
      : { tempoBpm: validated.tempoBpm }),
    notes: validated.notes ?? undefined,
    lyricsSections: {
      intro: normalizeString(lyricsSections.intro) ?? undefined,
      verse1: normalizeString(lyricsSections.verse1) ?? undefined,
      verse2: normalizeString(lyricsSections.verse2) ?? undefined,
      preChorus: normalizeString(lyricsSections.preChorus) ?? undefined,
      chorus: normalizeString(lyricsSections.chorus) ?? undefined,
      hook: normalizeString(lyricsSections.hook) ?? undefined,
      bridge: normalizeString(lyricsSections.bridge) ?? undefined,
      outro: normalizeString(lyricsSections.outro) ?? undefined,
      ending: normalizeString(lyricsSections.ending) ?? undefined,
    },
    active: validated.active,
  });

  return NextResponse.json(
    {
      ok: true,
      song: { _id: created._id, number, name: validated.name, genre: validated.genre },
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateSongBody;
  const songId = normalizeString(body.songId);
  if (!songId) {
    return NextResponse.json({ error: "Song id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string; name?: string | null } | null>(
    `*[_type == "song" && _id == $songId][0]{_id, name}`,
    { songId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  const patch = client.patch(songId);
  let touched = false;

  if (
    body.name !== undefined ||
    body.genre !== undefined ||
    body.youtubeUrl !== undefined ||
    body.spotifyUrl !== undefined ||
    body.defaultKey !== undefined ||
    body.tempoBpm !== undefined ||
    body.notes !== undefined ||
    body.lyricsSections !== undefined
  ) {
    const validated = validateSongBody({
      name: body.name,
      genre: body.genre,
      youtubeUrl: body.youtubeUrl,
      spotifyUrl: body.spotifyUrl,
      defaultKey: body.defaultKey,
      tempoBpm: body.tempoBpm,
      notes: body.notes,
      lyricsSections: body.lyricsSections,
      active: body.active,
    });
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const duplicateNameCount = await client.fetch<number>(
      `count(*[_type == "song" && name == $name && _id != $songId])`,
      { name: validated.name, songId }
    );
    if (duplicateNameCount > 0) {
      return NextResponse.json({ error: "Song name already exists." }, { status: 409 });
    }

    patch.set({
      name: validated.name,
      genre: validated.genre,
      youtubeUrl: validated.youtubeUrl,
      spotifyUrl: validated.spotifyUrl ?? undefined,
      defaultKey: validated.defaultKey ?? undefined,
      ...(validated.tempoBpm === undefined ? {} : { tempoBpm: validated.tempoBpm }),
      notes: validated.notes ?? undefined,
      lyricsSections: {
        intro: normalizeString(validated.lyricsSections.intro) ?? undefined,
        verse1: normalizeString(validated.lyricsSections.verse1) ?? undefined,
        verse2: normalizeString(validated.lyricsSections.verse2) ?? undefined,
        preChorus: normalizeString(validated.lyricsSections.preChorus) ?? undefined,
        chorus: normalizeString(validated.lyricsSections.chorus) ?? undefined,
        hook: normalizeString(validated.lyricsSections.hook) ?? undefined,
        bridge: normalizeString(validated.lyricsSections.bridge) ?? undefined,
        outro: normalizeString(validated.lyricsSections.outro) ?? undefined,
        ending: normalizeString(validated.lyricsSections.ending) ?? undefined,
      },
    });
    touched = true;
  }

  if (body.active !== undefined) {
    patch.set({ active: body.active !== false });
    touched = true;
  }

  if (!touched) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  await patch.commit();
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { songId?: string };
  const songId = normalizeString(body.songId);
  if (!songId) {
    return NextResponse.json({ error: "Song id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "song" && _id == $songId][0]{_id}`,
    { songId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  await client.delete(songId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
