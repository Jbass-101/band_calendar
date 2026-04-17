import { createClient } from "@sanity/client";

export type MusicianAssignment = {
  role: string;
  musicianNames: string[];
};

export type SetlistStatus = "draft" | "ready" | "final" | "archived";

export type SetlistSummary = {
  _id: string;
  title: string | null;
  status: SetlistStatus;
};

export type Service = {
  _id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  notes: string[];
  variant: "default" | "blue" | "green";
  showBandDetails: boolean;
  uniform: string;
  uniformWomen: string | null;
  uniformMen: string | null;
  assignments: MusicianAssignment[];
  setlist: SetlistSummary | null;
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
  defaultKey: string | null;
  tempoBpm: number | null;
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
  section: string;
  songNumber: number | null;
  songName: string | null;
  songGenre: Song["genre"] | null;
  note: string | null;
  keyOverride: string | null;
  tempoOverride: number | null;
  defaultKey: string | null;
  tempoBpm: number | null;
};

export type Setlist = {
  _id: string;
  title: string | null;
  assignedLeadVocal: string | null;
  status: SetlistStatus;
  notes: string | null;
  serviceId: string;
  serviceDate: string;
  serviceTitle: string;
  leadVocalNames: string[];
  songs: SetlistSongItem[];
};

export type SetlistDetailSong = SetlistSongItem & {
  lyricsSections: Song["lyricsSections"];
  youtubeUrl: string | null;
};

export type SetlistDetail = Omit<Setlist, "songs"> & {
  songs: SetlistDetailSong[];
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

function normalizeSetlistStatusValue(value: unknown): SetlistStatus {
  if (
    value === "draft" ||
    value === "ready" ||
    value === "final" ||
    value === "archived"
  ) {
    return value;
  }
  return "draft";
}

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
    _id,
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
    "mdNames": md[]->name,
    "setlist": *[_type == "setlist" && service._ref == ^._id][0]{
      _id,
      title,
      status
    }
  }`;

  const client = getSanityClient();

  const raw = await client.fetch<
    Array<{
      _id: string;
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
      setlist?: { _id: string; title?: string | null; status?: string | null } | null;
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
    _id: s._id,
    date: s.date,
    title: s.title,
    notes: normalizeNotes(s.notes),
    variant: normalizeVariant(s.variant),
    showBandDetails: normalizeShowBandDetails(s.showBandDetails),
    uniform: normalizeUniformValue(s.uniform) ?? "Smart Casual",
    uniformWomen: normalizeUniformValue(s.uniformWomen),
    uniformMen: normalizeUniformValue(s.uniformMen),
    setlist:
      s.setlist && typeof s.setlist._id === "string"
        ? {
            _id: s.setlist._id,
            title:
              typeof s.setlist.title === "string" && s.setlist.title.trim()
                ? s.setlist.title.trim()
                : null,
            status: normalizeSetlistStatusValue(s.setlist.status),
          }
        : null,
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
    defaultKey,
    tempoBpm,
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
      defaultKey?: string | null;
      tempoBpm?: number | null;
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
        defaultKey: normalizeString(song.defaultKey),
        tempoBpm:
          typeof song.tempoBpm === "number" && Number.isFinite(song.tempoBpm)
            ? song.tempoBpm
            : null,
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
  const query = `*[_type == "setlist" && defined(service)] | order(service->date desc){
    _id,
    title,
    leadVocal,
    status,
    notes,
    "serviceId": service._ref,
    "serviceDate": service->date,
    "serviceTitle": service->title,
    "leadVocalNames": select(defined(leadVocal) && leadVocal != "" => [leadVocal], service->leadVocal[]->name),
    "songs": songs[]{
      _key,
      section,
      note,
      keyOverride,
      tempoOverride,
      "songId": song._ref,
      "songNumber": song->number,
      "songName": song->name,
      "songGenre": song->genre,
      "defaultKey": song->defaultKey,
      "tempoBpm": song->tempoBpm
    }
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      _id: string;
      title?: string | null;
      leadVocal?: string | null;
      status?: string | null;
      notes?: string | null;
      serviceId?: string | null;
      serviceDate?: string | null;
      serviceTitle?: string | null;
      leadVocalNames?: Array<string | null> | null;
      songs?: Array<{
        _key?: string | null;
        section?: string | null;
        note?: string | null;
        keyOverride?: string | null;
        tempoOverride?: number | null;
        songId?: string | null;
        songNumber?: number | null;
        songName?: string | null;
        songGenre?: string | null;
        defaultKey?: string | null;
        tempoBpm?: number | null;
      } | null> | null;
    }>
  >(query);

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeSongGenre = (value: unknown): Song["genre"] | null => {
    if (value === "worship" || value === "praise" || value === "other") return value;
    return null;
  };

  return raw
    .map((setlist) => {
      const serviceId = normalizeString(setlist.serviceId);
      const serviceDate = normalizeString(setlist.serviceDate);
      const serviceTitleRaw = typeof setlist.serviceTitle === "string" ? setlist.serviceTitle.trim() : "";
      if (!serviceId || !serviceDate) return null;

      const leadVocalNames = Array.isArray(setlist.leadVocalNames)
        ? setlist.leadVocalNames
            .map((n) => (typeof n === "string" ? n.trim() : ""))
            .filter((n) => n.length > 0)
        : [];

      const songs = Array.isArray(setlist.songs)
        ? setlist.songs
            .map((item, idx) => {
              if (!item) return null;
              const tempoOverride =
                typeof item.tempoOverride === "number" && Number.isFinite(item.tempoOverride)
                  ? item.tempoOverride
                  : null;
              const tempoBpm =
                typeof item.tempoBpm === "number" && Number.isFinite(item.tempoBpm)
                  ? item.tempoBpm
                  : null;
              return {
                _key: normalizeString(item._key) ?? `row-${idx}`,
                songId: normalizeString(item.songId),
                section: normalizeString(item.section) ?? "Worship",
                songNumber: typeof item.songNumber === "number" ? item.songNumber : null,
                songName: normalizeString(item.songName),
                songGenre: normalizeSongGenre(item.songGenre),
                note: normalizeString(item.note),
                keyOverride: normalizeString(item.keyOverride),
                tempoOverride,
                defaultKey: normalizeString(item.defaultKey),
                tempoBpm,
              } satisfies SetlistSongItem;
            })
            .filter((item): item is SetlistSongItem => Boolean(item))
        : [];

      return {
        _id: setlist._id,
        title: normalizeString(setlist.title),
        assignedLeadVocal: normalizeString(setlist.leadVocal),
        status: normalizeSetlistStatusValue(setlist.status),
        notes: normalizeString(setlist.notes),
        serviceId,
        serviceDate,
        serviceTitle: serviceTitleRaw.length > 0 ? serviceTitleRaw : "Service",
        leadVocalNames,
        songs,
      } satisfies Setlist;
    })
    .filter((item): item is Setlist => Boolean(item));
}

export async function fetchSetlistById(id: string): Promise<SetlistDetail | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const query = `*[_type == "setlist" && _id == $id && defined(service)][0]{
    _id,
    title,
    leadVocal,
    status,
    notes,
    "serviceId": service._ref,
    "serviceDate": service->date,
    "serviceTitle": service->title,
    "leadVocalNames": select(defined(leadVocal) && leadVocal != "" => [leadVocal], service->leadVocal[]->name),
    "songs": songs[]{
      _key,
      section,
      note,
      keyOverride,
      tempoOverride,
      "songId": song._ref,
      "songNumber": song->number,
      "songName": song->name,
      "songGenre": song->genre,
      "youtubeUrl": song->youtubeUrl,
      "defaultKey": song->defaultKey,
      "tempoBpm": song->tempoBpm,
      "lyricsSections": song->lyricsSections{
        intro,
        hook,
        verse1,
        verse2,
        preChorus,
        chorus,
        bridge,
        outro,
        ending
      }
    }
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    | {
        _id: string;
        title?: string | null;
        leadVocal?: string | null;
        status?: string | null;
        notes?: string | null;
        serviceId?: string | null;
        serviceDate?: string | null;
        serviceTitle?: string | null;
        leadVocalNames?: Array<string | null> | null;
        songs?: Array<{
          _key?: string | null;
          section?: string | null;
          note?: string | null;
          keyOverride?: string | null;
          tempoOverride?: number | null;
          songId?: string | null;
          songNumber?: number | null;
          songName?: string | null;
          songGenre?: string | null;
          youtubeUrl?: string | null;
          defaultKey?: string | null;
          tempoBpm?: number | null;
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
        } | null> | null;
      }
    | null
  >(query, { id: trimmed });

  if (!raw?._id) return null;

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeSongGenre = (value: unknown): Song["genre"] | null => {
    if (value === "worship" || value === "praise" || value === "other") return value;
    return null;
  };

  const normalizeLyrics = (ls: {
    intro?: string | null;
    hook?: string | null;
    verse1?: string | null;
    verse2?: string | null;
    preChorus?: string | null;
    chorus?: string | null;
    bridge?: string | null;
    outro?: string | null;
    ending?: string | null;
  } | null | undefined): Song["lyricsSections"] => ({
    intro: normalizeString(ls?.intro),
    hook: normalizeString(ls?.hook),
    verse1: normalizeString(ls?.verse1),
    verse2: normalizeString(ls?.verse2),
    preChorus: normalizeString(ls?.preChorus),
    chorus: normalizeString(ls?.chorus),
    bridge: normalizeString(ls?.bridge),
    outro: normalizeString(ls?.outro),
    ending: normalizeString(ls?.ending),
  });

  const serviceId = normalizeString(raw.serviceId);
  const serviceDate = normalizeString(raw.serviceDate);
  const serviceTitleRaw = typeof raw.serviceTitle === "string" ? raw.serviceTitle.trim() : "";
  if (!serviceId || !serviceDate) return null;

  const leadVocalNames = Array.isArray(raw.leadVocalNames)
    ? raw.leadVocalNames
        .map((n) => (typeof n === "string" ? n.trim() : ""))
        .filter((n) => n.length > 0)
    : [];

  const songs = Array.isArray(raw.songs)
    ? raw.songs
        .map((item, idx) => {
          if (!item) return null;
          const tempoOverride =
            typeof item.tempoOverride === "number" && Number.isFinite(item.tempoOverride)
              ? item.tempoOverride
              : null;
          const tempoBpm =
            typeof item.tempoBpm === "number" && Number.isFinite(item.tempoBpm)
              ? item.tempoBpm
              : null;
          return {
            _key: normalizeString(item._key) ?? `row-${idx}`,
            songId: normalizeString(item.songId),
            section: normalizeString(item.section) ?? "Worship",
            songNumber: typeof item.songNumber === "number" ? item.songNumber : null,
            songName: normalizeString(item.songName),
            songGenre: normalizeSongGenre(item.songGenre),
            note: normalizeString(item.note),
            keyOverride: normalizeString(item.keyOverride),
            tempoOverride,
            defaultKey: normalizeString(item.defaultKey),
            tempoBpm,
            youtubeUrl: normalizeString(item.youtubeUrl),
            lyricsSections: normalizeLyrics(item.lyricsSections ?? undefined),
          } satisfies SetlistDetailSong;
        })
        .filter((item): item is SetlistDetailSong => Boolean(item))
    : [];

  return {
    _id: raw._id,
    title: normalizeString(raw.title),
    assignedLeadVocal: normalizeString(raw.leadVocal),
    status: normalizeSetlistStatusValue(raw.status),
    notes: normalizeString(raw.notes),
    serviceId,
    serviceDate,
    serviceTitle: serviceTitleRaw.length > 0 ? serviceTitleRaw : "Service",
    leadVocalNames,
    songs,
  };
}

export type ServicePickerOption = {
  _id: string;
  date: string;
  title: string;
  leadVocalNames: string[];
};

export type LeadVocalMusicianOption = {
  _id: string;
  name: string;
};

/** Musicians with the Lead Vocal role (setlist lead vocal picker). */
export async function fetchLeadVocalMusicians(): Promise<LeadVocalMusicianOption[]> {
  const query = `*[_type == "musician" && "Lead Vocal" in roles] | order(name asc) {
    _id,
    name
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      _id?: string | null;
      name?: string | null;
    }>
  >(query);

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return raw
    .map((row) => {
      const _id = normalizeString(row._id);
      const name = normalizeString(row.name);
      if (!_id || !name) return null;
      return { _id, name } satisfies LeadVocalMusicianOption;
    })
    .filter((row): row is LeadVocalMusicianOption => Boolean(row));
}

/** Recent services for linking setlists (admin UI). */
export async function fetchServicesForSetlistPicker(): Promise<ServicePickerOption[]> {
  const query = `*[_type == "service"] | order(date desc) [0...120] {
    _id,
    date,
    title,
    "leadVocalNames": leadVocal[]->name
  }`;

  const client = getSanityClient();
  const raw = await client.fetch<
    Array<{
      _id: string;
      date?: string | null;
      title?: string | null;
      leadVocalNames?: Array<string | null> | null;
    }>
  >(query);

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return raw
    .map((row) => {
      const date = normalizeString(row.date);
      const title = normalizeString(row.title);
      if (!date || !title) return null;
      const leadVocalNames = Array.isArray(row.leadVocalNames)
        ? row.leadVocalNames
            .map((name) => (typeof name === "string" ? name.trim() : ""))
            .filter((name) => name.length > 0)
        : [];
      return { _id: row._id, date, title, leadVocalNames } satisfies ServicePickerOption;
    })
    .filter((row): row is ServicePickerOption => Boolean(row));
}

