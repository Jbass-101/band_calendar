import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SetlistBandExportView from "@/src/components/setlistExport/SetlistBandExportView";
import { BRANDING } from "@/src/lib/branding";
import { fetchSetlistById } from "@/src/lib/sanity/client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await fetchSetlistById(id);
  const title = detail?.title?.trim() || `Setlist ${detail?.serviceDate ?? ""}`;
  return {
    title: `Band export | ${title} | ${BRANDING.main.title}`,
    description: "Band setlist: keys, tempo, and arrangement notes.",
  };
}

export default async function SetlistBandExportPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchSetlistById(id);
  if (!detail) {
    notFound();
  }

  return <SetlistBandExportView detail={detail} />;
}
