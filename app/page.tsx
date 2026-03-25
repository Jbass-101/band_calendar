import Image from "next/image";
import BandCalendarMonth from "../src/components/BandCalendarMonth";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <header className="mb-4 sm:mb-6 flex items-start sm:items-center gap-4 flex-nowrap">
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
          </div>
        </header>
        <BandCalendarMonth />
      </main>

      <footer className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 pb-3">
        Powered by{" "}
        <a
          href="https://extrabrains.co.za/"
          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Extra Brains
        </a>
      </footer>
    </div>
  );
}
