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

