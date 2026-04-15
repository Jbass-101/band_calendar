import { createClient } from "@sanity/client";

export type MusicianAssignment = {
  role: string;
  musicianNames: string[];
};

export type Service = {
  date: string; // "YYYY-MM-DD"
  title: string;
  notes: string[];
  variant: "default" | "blue" | "green";
  showBandDetails: boolean;
  uniform: string;
  uniformWomen: string | null;
  uniformMen: string | null;
  assignments: MusicianAssignment[];
};

export type Song = {
  _id: string;
  number: number;
  name: string;
  genre: "worship" | "praise" | "other";
  themes: string[];
  tags: string[];
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  lyricsSections: {
    intro: string | null;
    hook: string | null;
    verse1: string | null;
    verse2: string | null;
    preChorus: string | null;
    chorus: string | null;
    bridge: string | null;
    outro: string | null;
    ending: string | null;
  };
  notes: string | null;
  active: boolean;
};

export type SetlistSongItem = {
  _key: string;
  songId: string | null;
  songNumber: number | null;
  songName: string | null;
  songGenre: Song["genre"] | null;
  note: string | null;
};

export type Setlist = {
  _id: string;
  title: string | null;
  date: string;
  serviceType: "sunday_morning" | "sunday_evening" | "midweek" | "special";
  notes: string | null;
  active: boolean;
  songs: SetlistSongItem[];
};

const ROLE_ORDER = [
  "Lead Vocal",
  "Lead Keyboard",
  "Aux Keyboard",
  "Lead Guitar",
  "Bass Guitar",
  "Drummer",
  "MD",
] as const;

let cachedClient:
  | ReturnType<typeof createClient>
  | undefined;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getSanityClient() {
  if (cachedClient) return cachedClient;

  const projectId = requireEnv("SANITY_PROJECT_ID", process.env.SANITY_PROJECT_ID);
  const dataset = requireEnv("SANITY_DATASET", process.env.SANITY_DATASET);
  const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";
  const useCdn =
    process.env.SANITY_USE_CDN === undefined
      ? true
      : process.env.SANITY_USE_CDN.toLowerCase() === "true";

  cachedClient = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn,
  });
  return cachedClient;
}

export async function fetchServicesForRange(
  from: string,
  to: string
): Promise<Service[]> {
  // Expected input: "YYYY-MM-DD" (Sanity `date` field comparisons work well with this).
  const query = `*[_type == "service" && date >= $from && date <= $to]{
    title,
    date,
    notes,
    variant,
    showBandDetails,
    uniform,
    uniformWomen,
    uniformMen,
    "leadVocalNames": leadVocal[]->name,
    "leadKeyboardNames": leadKeyboard[]->name,
    "auxKeyboardNames": auxKeyboard[]->name,
    "leadGuitarNames": leadGuitar[]->name,
    "bassGuitarNames": bassGuitar[]->name,
    "drummerNames": drummer[]->name,
    "mdNames": md[]->name
  }`;

  const client = getSanityClient();

  const raw = await client.fetch<
    Array<{
      title: string;
      date: string;
      notes?: Array<string | null> | null;
      variant?: string | null;
      showBandDetails?: boolean | null;
      uniform?: string | null;
      uniformWomen?: string | null;
      uniformMen?: string | null;
      leadVocalNames?: Array<string | null> | null;
      leadKeyboardNames?: Array<string | null> | null;
      auxKeyboardNames?: Array<string | null> | null;
      leadGuitarNames?: Array<string | null> | null;
      bassGuitarNames?: Array<string | null> | null;
      drummerNames?: Array<string | null> | null;
      mdNames?: Array<string | null> | null;
    }>
  >(query, { from, to });

  const normalizeUniformValue = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeNames = (value: Array<string | null> | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter((n) => n.length > 0);
  };
  const normalizeNotes = (value: Array<string | null> | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter((n) => n.length > 0);
  };
  const normalizeVariant = (value: unknown): "default" | "blue" | "green" => {
    if (value === "blue" || value === "green" || value === "default") return value;
    return "default";
  };
  const normalizeShowBandDetails = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    return true;
  };

  return raw.map((s) => ({
    date: s.date,
    title: s.title,
    notes: normalizeNotes(s.notes),
    variant: normalizeVariant(s.variant),
    showBandDetails: normalizeShowBandDetails(s.showBandDetails),
    uniform: normalizeUniformValue(s.uniform) ?? "Smart Casual",
    uniformWomen: normalizeUniformValue(s.uniformWomen),
    uniformMen: normalizeUniformValue(s.uniformMen),
    assignments: [
      { role: "Lead Vocal", musicianNames: normalizeNames(s.leadVocalNames) },
      { role: "Lead Keyboard", musicianNames: normalizeNames(s.leadKeyboardNames) },
      { role: "Aux Keyboard", musicianNames: normalizeNames(s.auxKeyboardNames) },
      { role: "Lead Guitar", musicianNames: normalizeNames(s.leadGuitarNames) },
      { role: "Bass Guitar", musicianNames: normalizeNames(s.bassGuitarNames) },
      { role: "Drummer", musicianNames: normalizeNames(s.drummerNames) },
      { role: "MD", musicianNames: normalizeNames(s.mdNames) },
    ].filter((a) => ROLE_ORDER.includes(a.role as (typeof ROLE_ORDER)[number])),
  }));
}

export async function fetchRehearsalsForRange(
  from: string,
  to: string
): Promise<string[]> {
  const parseYMDLocal = (ymd: string): Date | null => {
    const parts = ymd.split("-").map((x) => Number(x));
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const formatYMDLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const addDaysLocal = (d: Date, days: number): Date => {
    const next = new Date(d.getTime());
    next.setDate(next.getDate() + days);
    return next;
  };

  const rangeFrom = parseYMDLocal(from);
  const rangeTo = parseYMDLocal(to);
  if (!rangeFrom || !rangeTo) return [];

  // Rehearsal series:
  // - one-time: `date` only
  // - repeating: `date` is startDate, `untilDate` inclusive, `repeatEveryDays` steps by N days
  // We only fetch series that can generate at least one occurrence in [from, to].
  const query = `*[_type == "rehearsal" && date <= $to && (
    (!defined(repeatEveryDays) && date >= $from) ||
    (defined(repeatEveryDays) && defined(untilDate) && untilDate >= $from)
  )]{
    date,
    repeatEveryDays,
    untilDate
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      date: string;
      repeatEveryDays?: number | null;
      untilDate?: string | null;
    }>
  >(query, { from, to });

  const occurrences = new Set<string>();
  const MAX_ITERATIONS = 2000;

  for (const series of raw) {
    const start = parseYMDLocal(series.date);
    if (!start) continue;

    const repeat = series.repeatEveryDays ?? null;
    const until = series.untilDate ? parseYMDLocal(series.untilDate) : null;

    // One-time rehearsal (no repeat step)
    if (!repeat || typeof repeat !== "number" || repeat < 1 || !until) {
      if (start >= rangeFrom && start <= rangeTo) {
        occurrences.add(formatYMDLocal(start));
      }
      continue;
    }

    if (until < start) continue;

    let current = new Date(start.getTime());

    // Advance to first possible occurrence >= rangeFrom to reduce loops.
    let advanceGuard = 0;
    while (current < rangeFrom && current <= until && advanceGuard < MAX_ITERATIONS) {
      current = addDaysLocal(current, repeat);
      advanceGuard++;
    }

    let guard = 0;
    while (current <= until && current <= rangeTo && guard < MAX_ITERATIONS) {
      if (current >= rangeFrom && current <= rangeTo) {
        occurrences.add(formatYMDLocal(current));
      }
      current = addDaysLocal(current, repeat);
      guard++;
    }
  }

  return Array.from(occurrences).sort();
}

export async function fetchSongs(): Promise<Song[]> {
  const query = `*[_type == "song"] | order(number asc, name asc){
    _id,
    number,
    name,
    genre,
    "themes": themes[]->title,
    "tags": tags[]->title,
    youtubeUrl,
    spotifyUrl,
    lyricsSections{
      intro,
      hook,
      verse1,
      verse2,
      preChorus,
      chorus,
      bridge,
      outro,
      ending
    },
    notes,
    active
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      _id: string;
      number?: number | null;
      name?: string | null;
      genre?: string | null;
      themes?: Array<string | null> | null;
      tags?: Array<string | null> | null;
      youtubeUrl?: string | null;
      spotifyUrl?: string | null;
      lyricsSections?: {
        intro?: string | null;
        hook?: string | null;
        verse1?: string | null;
        verse2?: string | null;
        preChorus?: string | null;
        chorus?: string | null;
        bridge?: string | null;
        outro?: string | null;
        ending?: string | null;
      } | null;
      notes?: string | null;
      active?: boolean | null;
    }>
  >(query);

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeStringArray = (value: Array<string | null> | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  };

  const normalizeGenre = (value: unknown): "worship" | "praise" | "other" => {
    if (value === "worship" || value === "praise" || value === "other") return value;
    return "other";
  };
  return raw
    .map((song) => {
      const number = typeof song.number === "number" ? song.number : null;
      const name = normalizeString(song.name);
      if (number === null || name === null) return null;

      return {
        _id: song._id,
        number,
        name,
        genre: normalizeGenre(song.genre),
        themes: normalizeStringArray(song.themes),
        tags: normalizeStringArray(song.tags),
        youtubeUrl: normalizeString(song.youtubeUrl),
        spotifyUrl: normalizeString(song.spotifyUrl),
        lyricsSections: {
          intro: normalizeString(song.lyricsSections?.intro),
          hook: normalizeString(song.lyricsSections?.hook),
          verse1: normalizeString(song.lyricsSections?.verse1),
          verse2: normalizeString(song.lyricsSections?.verse2),
          preChorus: normalizeString(song.lyricsSections?.preChorus),
          chorus: normalizeString(song.lyricsSections?.chorus),
          bridge: normalizeString(song.lyricsSections?.bridge),
          outro: normalizeString(song.lyricsSections?.outro),
          ending: normalizeString(song.lyricsSections?.ending),
        },
        notes: normalizeString(song.notes),
        active: song.active !== false,
      } satisfies Song;
    })
    .filter((song): song is Song => Boolean(song));
}

export async function fetchSetlists(): Promise<Setlist[]> {
  const query = `*[_type == "setlist"] | order(date desc){
    _id,
    title,
    date,
    serviceType,
    notes,
    active,
    "songs": songs[]{
      _key,
      note,
      "songId": song._ref,
      "songNumber": song->number,
      "songName": song->name,
      "songGenre": song->genre
    }
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      _id: string;
      title?: string | null;
      date?: string | null;
      serviceType?: string | null;
      notes?: string | null;
      active?: boolean | null;
      songs?: Array<{
        _key?: string | null;
        note?: string | null;
        songId?: string | null;
        songNumber?: number | null;
        songName?: string | null;
        songGenre?: string | null;
      } | null> | null;
    }>
  >(query);

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeServiceType = (
    value: unknown
  ): "sunday_morning" | "sunday_evening" | "midweek" | "special" => {
    if (
      value === "sunday_morning" ||
      value === "sunday_evening" ||
      value === "midweek" ||
      value === "special"
    ) {
      return value;
    }
    return "special";
  };

  const normalizeSongGenre = (value: unknown): Song["genre"] | null => {
    if (value === "worship" || value === "praise" || value === "other") return value;
    return null;
  };

  return raw
    .map((setlist) => {
      const date = normalizeString(setlist.date);
      if (!date) return null;

      const songs = Array.isArray(setlist.songs)
        ? setlist.songs
            .map((item, idx) => {
              if (!item) return null;
              return {
                _key: normalizeString(item._key) ?? `row-${idx}`,
                songId: normalizeString(item.songId),
                songNumber: typeof item.songNumber === "number" ? item.songNumber : null,
                songName: normalizeString(item.songName),
                songGenre: normalizeSongGenre(item.songGenre),
                note: normalizeString(item.note),
              } satisfies SetlistSongItem;
            })
            .filter((item): item is SetlistSongItem => Boolean(item))
        : [];

      return {
        _id: setlist._id,
        title: normalizeString(setlist.title),
        date,
        serviceType: normalizeServiceType(setlist.serviceType),
        notes: normalizeString(setlist.notes),
        active: setlist.active !== false,
        songs,
      } satisfies Setlist;
    })
    .filter((item): item is Setlist => Boolean(item));
}

