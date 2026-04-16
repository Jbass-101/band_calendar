import type { Metadata } from "next";
import SetlistRepository from "@/src/components/SetlistRepository";
import { fetchSetlists } from "@/src/lib/sanity/client";
import { BRANDING } from "@/src/lib/branding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setlists | Last Harvest Choir",
  description: "Service setlists with ordered songs for Last Harvest Choir rehearsal and planning.",
  alternates: {
    canonical: "/setlists",
  },
  openGraph: {
    title: "Setlists | Last Harvest Choir",
    description: "Service setlists with ordered songs for Last Harvest Choir rehearsal and planning.",
    url: "/setlists",
    siteName: "Last Harvest Choir",
    type: "website",
    images: [
      {
        url: BRANDING.main.logoSrc,
        width: 512,
        height: 512,
        alt: BRANDING.main.logoAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Setlists | Last Harvest Choir",
    description: "Service setlists with ordered songs for Last Harvest Choir rehearsal and planning.",
    images: [BRANDING.main.logoSrc],
  },
};

export default async function SetlistsPage() {
  const setlists = await fetchSetlists();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <SetlistRepository setlists={setlists} />
      </main>
      <footer className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 pb-3 bg-white/70 dark:bg-zinc-950/40 backdrop-blur-sm">
        Powered by{" "}
        <a
          href="https://extrabrains.co.za/"
          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-sm"
        >
          Extra Brains
        </a>
      </footer>
    </div>
  );
}
