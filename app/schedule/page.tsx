import type { Metadata } from "next";
import Image from "next/image";
import BandCalendarMonth from "@/src/components/BandCalendarMonth";
import { BRANDING } from "@/src/lib/branding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Band schedule | ${BRANDING.band.title}`,
  description: "Monthly schedule for services and rehearsals.",
  alternates: {
    canonical: "/schedule",
  },
  openGraph: {
    title: `Band schedule | ${BRANDING.band.title}`,
    description: "Monthly schedule for services and rehearsals.",
    url: "/schedule",
    siteName: BRANDING.band.title,
    type: "website",
    images: [
      {
        url: BRANDING.band.logoSrc,
        width: 512,
        height: 512,
        alt: BRANDING.band.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Band schedule | ${BRANDING.band.title}`,
    description: "Monthly schedule for services and rehearsals.",
    images: [BRANDING.band.logoSrc],
  },
};

export default function SchedulePage() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <header className="mb-5 sm:mb-7 flex flex-col items-start gap-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/40 px-3 py-3 sm:flex-row sm:items-center sm:gap-5 sm:px-4 sm:py-4 shadow-sm backdrop-blur-sm">
          <div className="shrink-0 self-center sm:self-auto">
            <Image
              src={BRANDING.band.logoSrc}
              alt={BRANDING.band.logoAlt}
              width={160}
              height={160}
              className="w-18 h-18 sm:w-24 sm:h-24 object-contain"
              priority
            />
          </div>

          <div className="min-w-0 w-full flex-1 flex flex-col sm:justify-center">
            <h1 className="text-center sm:text-left text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {BRANDING.band.title}
            </h1>
            <p className="mt-1 text-center sm:text-left text-sm sm:text-base text-zinc-600 dark:text-zinc-300">
              Monthly schedule for services and rehearsals
            </p>
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
