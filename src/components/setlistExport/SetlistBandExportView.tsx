"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { downloadDomAsPdf } from "@/src/lib/exportDomToPdf";
import { BRANDING } from "@/src/lib/branding";
import type { SetlistDetail, SetlistSongItem } from "@/src/lib/sanity/client";

function formatKey(item: SetlistSongItem): string {
  const v = item.keyOverride ?? item.defaultKey;
  return v && v.trim() ? v.trim() : "—";
}

function formatTempo(item: SetlistSongItem): string {
  if (item.tempoOverride != null) return String(item.tempoOverride);
  if (item.tempoBpm != null) return String(item.tempoBpm);
  return "—";
}

type SetlistBandExportViewProps = {
  detail: SetlistDetail;
};

export default function SetlistBandExportView({ detail }: SetlistBandExportViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  async function handlePdf() {
    const node = ref.current;
    if (!node) return;
    const safeDate = detail.serviceDate.replaceAll(/[^\d-]/g, "-");
    await downloadDomAsPdf(node, {
      filename: `setlist-band-${safeDate}-${detail._id.slice(-6)}.pdf`,
      scale: 2,
      backgroundColor: "#ffffff",
    });
  }

  return (
    <div className="min-h-screen bg-zinc-100/90 dark:bg-black px-3 py-6 sm:px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl print:hidden flex flex-wrap items-center gap-2 mb-4">
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
        className="mx-auto max-w-4xl rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm print:shadow-none print:border-0 print:rounded-none"
      >
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
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
              <p className="text-xs text-zinc-500">Band Setlist</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-700">
              {detail.serviceDate} - {detail.serviceTitle}
            </p>
            <p className="text-sm text-zinc-600">
              Lead vocal:{" "}
              {detail.leadVocalNames.length > 0 ? detail.leadVocalNames.join(", ") : "—"}
            </p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-600">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Song</th>
                <th className="py-2 pr-2">Key</th>
                <th className="py-2 pr-2">Tempo</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {detail.songs.map((item, idx) => (
                <tr key={item._key} className="border-b border-zinc-100">
                  <td className="py-2 pr-2 font-medium">{item.songNumber ?? idx + 1}</td>
                  <td className="py-2 pr-2">{item.songName ?? "—"}</td>
                  <td className="py-2 pr-2">{formatKey(item)}</td>
                  <td className="py-2 pr-2">{formatTempo(item)}</td>
                  <td className="py-2 text-zinc-700">{item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail.notes ? (
          <p className="mt-4 text-sm text-zinc-700 whitespace-pre-wrap border-t border-zinc-100 pt-4">
            {detail.notes}
          </p>
        ) : null}

        <div className="mt-6 border-t border-zinc-200 pt-3 text-center text-[11px] text-zinc-600">
          Powered by{" "}
          <a href="https://extrabrains.co.za/" className="font-semibold text-emerald-600 underline">
            Extra Brains
          </a>
        </div>
      </div>
    </div>
  );
}
