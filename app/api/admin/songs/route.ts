import { NextResponse } from "next/server";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type CreateSongBody = {
  name?: string;
  genre?: "worship" | "praise" | "other";
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
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

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookiePairs = cookieHeader.split(";").map((part) => part.trim());
  const cookieName = getContribAuthCookieName();
  const authCookie = cookiePairs.find((pair) => pair.startsWith(`${cookieName}=`));
  const cookieValue = authCookie ? decodeURIComponent(authCookie.split("=")[1] ?? "") : undefined;
  const isAuthorized = await isContribSessionValidFromCookie(cookieValue);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateSongBody;
  const name = normalizeString(body.name);
  const genre = body.genre;

  if (!name) {
    return NextResponse.json({ error: "Song name is required." }, { status: 400 });
  }
  if (genre !== "worship" && genre !== "praise" && genre !== "other") {
    return NextResponse.json({ error: "Genre must be worship, praise, or other." }, { status: 400 });
  }

  const youtubeUrl = normalizeUrl(body.youtubeUrl);
  if (body.youtubeUrl != null && body.youtubeUrl !== "" && !youtubeUrl) {
    return NextResponse.json({ error: "YouTube URL is invalid." }, { status: 400 });
  }
  if (youtubeUrl && !isAllowedHost(youtubeUrl, ["youtube.com", "youtu.be"])) {
    return NextResponse.json({ error: "Use a valid YouTube URL (youtube.com or youtu.be)." }, { status: 400 });
  }

  const spotifyUrl = normalizeUrl(body.spotifyUrl);
  if (body.spotifyUrl != null && body.spotifyUrl !== "" && !spotifyUrl) {
    return NextResponse.json({ error: "Spotify URL is invalid." }, { status: 400 });
  }
  if (spotifyUrl && !isAllowedHost(spotifyUrl, ["spotify.com"])) {
    return NextResponse.json({ error: "Use a valid Spotify URL (spotify.com)." }, { status: 400 });
  }

  const client = getSanityWriteClient();

  const duplicateNameCount = await client.fetch<number>(
    `count(*[_type == "song" && name == $name])`,
    { name }
  );
  if (duplicateNameCount > 0) {
    return NextResponse.json({ error: "Song name already exists." }, { status: 409 });
  }

  const currentMax = await client.fetch<number>(
    `coalesce(*[_type == "song" && defined(number)] | order(number desc)[0].number, 0)`
  );
  const number = (typeof currentMax === "number" ? currentMax : 0) + 1;

  const lyricsSections = body.lyricsSections ?? {};

  const created = await client.create({
    _type: "song",
    number,
    name,
    genre,
    youtubeUrl: youtubeUrl ?? undefined,
    spotifyUrl: spotifyUrl ?? undefined,
    notes: normalizeString(body.notes) ?? undefined,
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
    active: body.active !== false,
  });

  return NextResponse.json(
    {
      ok: true,
      song: { _id: created._id, number, name, genre },
    },
    { status: 201 }
  );
}
