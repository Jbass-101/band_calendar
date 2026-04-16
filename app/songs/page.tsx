import type { Metadata } from "next";
import { cookies } from "next/headers";
import SongsManager from "@/src/components/SongsManager";
import { fetchSongs } from "@/src/lib/sanity/client";
import { BRANDING } from "@/src/lib/branding";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Songs | Last Harvest Choir",
  description: "Browse and manage worship songs for Last Harvest Choir setlist preparation.",
  alternates: {
    canonical: "/songs",
  },
  openGraph: {
    title: "Songs | Last Harvest Choir",
    description: "Browse and manage worship songs for Last Harvest Choir setlist preparation.",
    url: "/songs",
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
    title: "Songs | Last Harvest Choir",
    description: "Browse and manage worship songs for Last Harvest Choir setlist preparation.",
    images: [BRANDING.main.logoSrc],
  },
};

export default async function SongsPage() {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);
  const songs = await fetchSongs();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <SongsManager songs={songs} authorized={authorized} />
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
