import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SetlistMediaExportView from "@/src/components/setlistExport/SetlistMediaExportView";
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
    title: `Media / lyrics | ${title} | ${BRANDING.main.title}`,
    description: "Ordered songs with lyrics for media team.",
  };
}

export default async function SetlistMediaExportPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchSetlistById(id);
  if (!detail) {
    notFound();
  }

  return <SetlistMediaExportView detail={detail} />;
}
