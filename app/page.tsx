import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRANDING } from "@/src/lib/branding";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";

export default async function Home() {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);

  if (authorized) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <header className="mb-5 sm:mb-7 flex flex-col items-start gap-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/40 px-3 py-3 sm:flex-row sm:items-center sm:gap-5 sm:px-4 sm:py-4 shadow-sm backdrop-blur-sm">
          <div className="shrink-0 self-center sm:self-auto">
            <Image
              src={BRANDING.main.logoSrc}
              alt={BRANDING.main.logoAlt}
              width={160}
              height={160}
              className="w-18 h-18 sm:w-24 sm:h-24 object-contain"
              priority
            />
          </div>

          <div className="min-w-0 w-full flex-1 flex flex-col sm:justify-center">
            <h1 className="text-center sm:text-left text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {BRANDING.main.title}
            </h1>
            <p className="mt-1 text-center sm:text-left text-sm sm:text-base text-zinc-600 dark:text-zinc-300">
              Plan services and rehearsals, and browse the song library.
            </p>
            <div className="mt-3 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/schedule"
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Band Schedule</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  View this month&apos;s service and rehearsal schedule.
                </p>
              </Link>
              <Link
                href="/songs"
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Song Repository</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Browse songs, lyrics, and reference links.
                </p>
              </Link>
              <Link
                href="/setlists"
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:col-span-2 lg:col-span-1"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Setlists</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  See ordered songs per service and export band or media sheets.
                </p>
              </Link>
            </div>
          </div>
        </header>
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
