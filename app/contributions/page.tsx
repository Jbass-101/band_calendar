import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ContributionsManager from "@/src/components/ContributionsManager";
import { BRANDING } from "@/src/lib/branding";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choir contributions | Last Harvest Choir",
  description:
    "Track monthly choir contributions by member: overview, entries, expenses, and statements.",
  alternates: {
    canonical: "/contributions",
  },
  openGraph: {
    title: "Choir contributions | Last Harvest Choir",
    description:
      "Track monthly choir contributions by member: overview, entries, expenses, and statements.",
    url: "/contributions",
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
    title: "Choir contributions | Last Harvest Choir",
    description:
      "Track monthly choir contributions by member: overview, entries, expenses, and statements.",
    images: [BRANDING.main.logoSrc],
  },
};

export default async function ContributionsPage() {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);

  if (!authorized) {
    redirect("/login");
  }

  return (
    <div className="theme-contributions app-shell min-h-screen flex flex-col">
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1">
        <ContributionsManager authorized={authorized} />
      </main>
      <footer className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 pb-3 bg-white/70 dark:bg-zinc-950/40 backdrop-blur-sm">
        Powered by{" "}
        <a
          href="https://extrabrains.co.za/"
          className="app-footer-link font-semibold hover:underline rounded-sm"
        >
          Extra Brains
        </a>
      </footer>
    </div>
  );
}

