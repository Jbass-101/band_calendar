"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadMediaSetlistPdf } from "@/src/lib/exportMediaSetlistPdf";
import { BRANDING } from "@/src/lib/branding";
import { formatIsoDateToDDMMYYYY } from "@/src/lib/formatDate";
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

const SCROLL_TOP_THRESHOLD_PX = 320;

export default function SetlistMediaExportView({ detail }: SetlistMediaExportViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePdf() {
    const safeDate = detail.serviceDate.replaceAll(/[^\d-]/g, "-");
    await downloadMediaSetlistPdf(detail, {
      filename: `setlist-media-${safeDate}-${detail._id.slice(-6)}.pdf`,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-100/90 dark:bg-black px-3 py-6 sm:px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl print:hidden flex flex-wrap items-center gap-2 mb-4">
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
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <Image
              src={BRANDING.main.logoSrc}
              alt={BRANDING.main.logoAlt}
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              unoptimized
            />
            <div>
              <p className="text-base font-semibold tracking-tight">Last Harvest Choir</p>
              <p className="text-xs text-zinc-500">Media / Lyrics</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-700">
              {formatIsoDateToDDMMYYYY(detail.serviceDate) || detail.serviceDate} -{" "}
              {detail.serviceTitle}
            </p>
            <p className="text-sm text-zinc-600">
              Lead vocal:{" "}
              {detail.leadVocalNames.length > 0 ? detail.leadVocalNames.join(", ") : "—"}
            </p>
          </div>
        </header>

        <div className="space-y-10">
          {detail.songs.map((item, idx) => {
            const prev = detail.songs[idx - 1];
            const sectionChanged =
              idx === 0 ||
              (item.section ?? "").trim() !== (prev?.section ?? "").trim();
            const sectionLabel = (item.section ?? "").trim() || "Worship";

            return (
            <div key={item._key} className="break-inside-avoid space-y-3">
              {sectionChanged ? (
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 border-b border-zinc-200 pb-1.5">
                  {sectionLabel}
                </h2>
              ) : null}
              <section>
              <h3 className="text-lg font-semibold border-b border-zinc-200 pb-2">
                {idx + 1}. {item.songName ?? "Song"}
              </h3>
              <div className="mt-3 space-y-4 text-sm leading-relaxed">
                {LYRIC_ORDER.map(({ key, label }) => {
                  const text = item.lyricsSections[key];
                  if (!text || !text.trim()) return null;
                  return (
                    <div key={key}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                        {label}
                      </h4>
                      <div className="whitespace-pre-wrap text-zinc-800">{text}</div>
                    </div>
                  );
                })}
              </div>
              </section>
            </div>
            );
          })}
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-3 text-center text-[11px] text-zinc-600">
          Powered by{" "}
          <a href="https://extrabrains.co.za/" className="font-semibold text-emerald-600 underline">
            Extra Brains
          </a>
        </div>
      </div>

      {showScrollTop ? (
        <button
          type="button"
          onClick={scrollToTop}
          className="print:hidden fixed bottom-6 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-emerald-700 bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black sm:right-6"
          aria-label="Back to top"
        >
          <ChevronUp className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
