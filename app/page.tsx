import Image from "next/image";
import BandCalendarMonth from "../src/components/BandCalendarMonth";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <header className="mb-4 sm:mb-6 flex items-center gap-4 flex-wrap">
          <div className="shrink-0">
            <Image
              src="/logo.png"
              alt="Last Harvest Instrumentalists logo"
              width={160}
              height={160}
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
              priority
            />
          </div>

          <div className="min-w-[12rem]">
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
    </div>
  );
}
