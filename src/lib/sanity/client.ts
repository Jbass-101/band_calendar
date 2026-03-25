import { createClient } from "@sanity/client";

export type MusicianAssignment = {
  role: string;
  musicianName: string | null;
};

export type Service = {
  date: string; // "YYYY-MM-DD"
  title: string;
  assignments: MusicianAssignment[];
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
    "leadVocalName": leadVocal->name,
    "leadKeyboardName": leadKeyboard->name,
    "auxKeyboardName": auxKeyboard->name,
    "leadGuitarName": leadGuitar->name,
    "bassGuitarName": bassGuitar->name,
    "drummerName": drummer->name,
    "mdName": md->name
  }`;

  const client = getSanityClient();

  const raw = await client.fetch<
    Array<{
      title: string;
      date: string;
      leadVocalName?: string | null;
      leadKeyboardName?: string | null;
      auxKeyboardName?: string | null;
      leadGuitarName?: string | null;
      bassGuitarName?: string | null;
      drummerName?: string | null;
      mdName?: string | null;
    }>
  >(query, { from, to });

  return raw.map((s) => ({
    date: s.date,
    title: s.title,
    assignments: [
      { role: "Lead Vocal", musicianName: s.leadVocalName ?? null },
      { role: "Lead Keyboard", musicianName: s.leadKeyboardName ?? null },
      { role: "Aux Keyboard", musicianName: s.auxKeyboardName ?? null },
      { role: "Lead Guitar", musicianName: s.leadGuitarName ?? null },
      { role: "Bass Guitar", musicianName: s.bassGuitarName ?? null },
      { role: "Drummer", musicianName: s.drummerName ?? null },
      { role: "MD", musicianName: s.mdName ?? null },
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

