import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Band Calendar | Last Harvest Choir",
  description: "Calendar tools for managing services and rehearsals.",
  alternates: {
    canonical: "/calendar",
  },
};

export default async function AdminCalendarPage() {
  redirect("/calendar");
}
