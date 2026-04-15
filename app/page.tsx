import Image from "next/image";
import Link from "next/link";
import BandCalendarMonth from "../src/components/BandCalendarMonth";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <header className="mb-5 sm:mb-7 flex items-start sm:items-center gap-4 sm:gap-5 flex-nowrap rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/40 px-3 py-3 sm:px-4 sm:py-4 shadow-sm backdrop-blur-sm">
          <div className="shrink-0">
            <Image
              src="/logo.png"
              alt="Last Harvest Instrumentalists logo"
              width={160}
              height={160}
              className="w-18 h-18 sm:w-24 sm:h-24 object-contain"
              priority
            />
          </div>

          <div className="min-w-0 flex-1 flex flex-col sm:justify-center">
            <h1 className="text-left text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Last Harvest Instrumentalists
            </h1>
            <p className="mt-1 text-left text-sm sm:text-base text-zinc-600 dark:text-zinc-300">
              Monthly schedule for services and rehearsals
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/songs"
                className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Song Repository
              </Link>
              <Link
                href="/setlists"
                className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Setlists
              </Link>
              <Link
                href="/contributions"
                className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Contributions
              </Link>
            </div>
          </div>
        </header>
        <BandCalendarMonth />
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
