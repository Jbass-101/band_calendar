"use client";

import Link from "next/link";
import { useRef } from "react";
import { downloadDomAsPdf } from "@/src/lib/exportDomToPdf";
import type { SetlistDetail, SetlistDetailSong } from "@/src/lib/sanity/client";

const LYRIC_ORDER: Array<{ key: keyof SetlistDetailSong["lyricsSections"]; label: string }> = [
  { key: "intro", label: "Intro" },
  { key: "verse1", label: "Verse 1" },
  { key: "verse2", label: "Verse 2" },
  { key: "preChorus", label: "Pre-Chorus" },
  { key: "chorus", label: "Chorus" },
  { key: "hook", label: "Hook" },
  { key: "bridge", label: "Bridge" },
  { key: "outro", label: "Outro" },
  { key: "ending", label: "Ending" },
];

type SetlistMediaExportViewProps = {
  detail: SetlistDetail;
};

export default function SetlistMediaExportView({ detail }: SetlistMediaExportViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  async function handlePdf() {
    const node = ref.current;
    if (!node) return;
    const safeDate = detail.serviceDate.replaceAll(/[^\d-]/g, "-");
    await downloadDomAsPdf(node, {
      filename: `setlist-media-${safeDate}-${detail._id.slice(-6)}.pdf`,
      scale: 2,
      backgroundColor: "#ffffff",
    });
  }

  const heading = detail.title?.trim() || `Setlist — ${detail.serviceDate}`;

  return (
    <div className="min-h-screen bg-zinc-100/90 dark:bg-black px-3 py-6 sm:px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl print:hidden flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => void handlePdf()}
          className="rounded-lg border border-emerald-600 bg-emerald-600 text-white px-3 py-2 text-sm font-medium"
        >
          Download PDF
        </button>
        <Link
          href="/setlists"
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
        >
          Back to setlists
        </Link>
      </div>

      <div
        ref={ref}
        className="mx-auto max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm print:shadow-none print:border-0 print:rounded-none"
      >
        <header className="border-b border-zinc-200 pb-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Media / lyrics</p>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {detail.serviceDate} — {detail.serviceTitle}
          </p>
        </header>

        <div className="space-y-10">
          {detail.songs.map((item, idx) => (
            <section key={item._key} className="break-inside-avoid">
              <h2 className="text-lg font-semibold border-b border-zinc-200 pb-2">
                {idx + 1}. {item.songName ?? "Song"}
              </h2>
              <div className="mt-3 space-y-4 text-sm leading-relaxed">
                {LYRIC_ORDER.map(({ key, label }) => {
                  const text = item.lyricsSections[key];
                  if (!text || !text.trim()) return null;
                  return (
                    <div key={key}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                        {label}
                      </h3>
                      <div className="whitespace-pre-wrap text-zinc-800">{text}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
