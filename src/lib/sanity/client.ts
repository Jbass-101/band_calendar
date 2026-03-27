import { createClient } from "@sanity/client";

export type MusicianAssignment = {
  role: string;
  musicianNames: string[];
};

export type Service = {
  date: string; // "YYYY-MM-DD"
  title: string;
  uniform: string;
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
    uniform,
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
      uniform?: string | null;
      leadVocalNames?: Array<string | null> | null;
      leadKeyboardNames?: Array<string | null> | null;
      auxKeyboardNames?: Array<string | null> | null;
      leadGuitarNames?: Array<string | null> | null;
      bassGuitarNames?: Array<string | null> | null;
      drummerNames?: Array<string | null> | null;
      mdNames?: Array<string | null> | null;
    }>
  >(query, { from, to });

  const normalizeNames = (value: Array<string | null> | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter((n) => n.length > 0);
  };

  return raw.map((s) => ({
    date: s.date,
    title: s.title,
    uniform:
      typeof s.uniform === "string" && s.uniform.trim().length > 0
        ? s.uniform.trim()
        : "Smart Casual",
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

