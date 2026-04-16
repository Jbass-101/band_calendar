import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Songs | Last Harvest Choir",
  description: "Browse and manage worship songs from the unified songs page.",
  alternates: {
    canonical: "/songs",
  },
};

export default function AdminSongsPage() {
  redirect("/songs");
}
