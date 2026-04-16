import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminNavigation from "@/src/components/AdminNavigation";
import AdminSongsManager from "@/src/components/AdminSongsManager";
import { fetchSongs } from "@/src/lib/sanity/client";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Songs Admin | Last Harvest Choir",
  description: "Create, edit, archive, and delete songs from the admin portal.",
  alternates: {
    canonical: "/admin/songs",
  },
};

export default async function AdminSongsPage() {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);
  if (!authorized) {
    redirect("/login");
  }
  const songs = await fetchSongs();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <AdminNavigation authorized={authorized} />
        <div className="mt-4">
        <AdminSongsManager authorized={authorized} initialSongs={songs} />
        </div>
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
