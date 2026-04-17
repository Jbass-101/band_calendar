import type { SetlistDetail } from "@/src/lib/sanity/client";

const MISSING = "—";

const MONTH_LONG = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Strip * so WhatsApp bold markers are not broken by user content. */
function sanitizeForBold(text: string): string {
  return text.replace(/\*/g, "");
}

function parseServiceDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Start of calendar week (Sunday 00:00 local) containing `d`. */
function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** e.g. 19 May 2026 (day without leading zero). */
function formatDayMonthYear(d: Date): string {
  const day = d.getDate();
  const mon = MONTH_LONG[d.getMonth()] ?? "";
  return `${day} ${mon} ${d.getFullYear()}`;
}

/**
 * Draft program for Sunday : 19 May 2026
 * Program for next Sunday : 26 May 2026
 * Uses Sunday-based weeks: "next" when the service falls in the calendar week immediately after this week.
 */
export function buildWhatsAppSetlistTitle(detail: SetlistDetail): string {
  const svc = parseServiceDateLocal(detail.serviceDate);
  if (!svc) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  svc.setHours(0, 0, 0, 0);

  const weekdayLong = new Intl.DateTimeFormat("en", { weekday: "long" }).format(svc);

  const svcWeekStart = startOfWeekSunday(svc);
  const todayWeekStart = startOfWeekSunday(today);
  const weekDiffDays = Math.round((svcWeekStart.getTime() - todayWeekStart.getTime()) / 86_400_000);

  const nextPrefix = weekDiffDays === 7 ? "next " : "";

  const dateStr = formatDayMonthYear(svc);
  const rest = `${nextPrefix}${weekdayLong} : ${dateStr}`;

  if (detail.status === "draft") {
    return `Draft program for ${rest}`;
  }
  return `Program for ${rest}`;
}

function formatSongKey(item: SetlistDetail["songs"][number]): string {
  const v = item.keyOverride ?? item.defaultKey;
  return v && v.trim() ? v.trim() : MISSING;
}

/**
 * Plain-text setlist for pasting into WhatsApp: bold title line, bold section headers,
 * then each song with name and key (`Song name : Key`), then YouTube URL on the next line.
 * Songs are grouped by consecutive identical section names (setlist order preserved).
 */
export function formatSetlistWhatsAppText(detail: SetlistDetail): string {
  const titlePlain = buildWhatsAppSetlistTitle(detail);
  const titleLine = titlePlain ? `*${sanitizeForBold(titlePlain)}*` : "";

  const { songs } = detail;
  if (songs.length === 0) {
    return titleLine;
  }

  const sectionBlocks: string[] = [];
  let i = 0;
  while (i < songs.length) {
    const section = songs[i].section;
    const sectionBold = `*${sanitizeForBold(section)}*`;
    const songChunks: string[] = [];
    while (i < songs.length && songs[i].section === section) {
      const name = songs[i].songName ?? MISSING;
      const key = formatSongKey(songs[i]);
      const link = songs[i].youtubeUrl ?? MISSING;
      songChunks.push(`${name} : ${key}\n${link}`);
      i++;
    }
    sectionBlocks.push(`${sectionBold}\n\n${songChunks.join("\n\n")}`);
  }

  const body = sectionBlocks.join("\n\n");
  if (!titleLine) return body;
  return `${titleLine}\n\n${body}`;
}
