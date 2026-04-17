"use client";

import Link from "next/link";
import { useRef } from "react";
import SetlistBandExportCard from "@/src/components/setlistExport/SetlistBandExportCard";
import { downloadBandSetlistPng } from "@/src/lib/setlistExport/downloadBandSetlistPng";
import type { SetlistDetail } from "@/src/lib/sanity/client";

type SetlistBandExportViewProps = {
  detail: SetlistDetail;
};

export default function SetlistBandExportView({ detail }: SetlistBandExportViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  async function handlePdf() {
    const node = ref.current;
    if (!node) return;
    const safeDate = detail.serviceDate.replaceAll(/[^\d-]/g, "-");
    await downloadBandSetlistPng(node, {
      filename: `setlist-band-${safeDate}-${detail._id.slice(-6)}.png`,
      scale: 2,
      backgroundColor: "#ffffff",
    });
  }

  return (
    <div className="min-h-screen bg-zinc-100/90 dark:bg-black px-3 py-6 sm:px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl print:hidden flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => void handlePdf()}
          className="rounded-lg border border-emerald-600 bg-emerald-600 text-white px-3 py-2 text-sm font-medium"
        >
          Download PNG
        </button>
        <Link
          href="/setlists"
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
        >
          Back to setlists
        </Link>
      </div>

      <SetlistBandExportCard ref={ref} detail={detail} />
    </div>
  );
}
