import type { SetlistDetail } from "@/src/lib/sanity/client";

const MISSING = "—";

function formatSongKey(item: SetlistDetail["songs"][number]): string {
  const v = item.keyOverride ?? item.defaultKey;
  return v && v.trim() ? v.trim() : MISSING;
}

/**
 * Plain-text setlist for pasting into WhatsApp: section headers, then each song
 * with name and key (`Song name : Key`), then YouTube URL on the next line.
 * Songs are grouped by consecutive identical section names (setlist order preserved).
 */
export function formatSetlistWhatsAppText(detail: SetlistDetail): string {
  const { songs } = detail;
  if (songs.length === 0) return "";

  const sectionBlocks: string[] = [];
  let i = 0;
  while (i < songs.length) {
    const section = songs[i].section;
    const songChunks: string[] = [];
    while (i < songs.length && songs[i].section === section) {
      const name = songs[i].songName ?? MISSING;
      const key = formatSongKey(songs[i]);
      const link = songs[i].youtubeUrl ?? MISSING;
      songChunks.push(`${name} : ${key}\n${link}`);
      i++;
    }
    sectionBlocks.push(`${section}\n\n${songChunks.join("\n\n")}`);
  }

  return sectionBlocks.join("\n\n");
}
