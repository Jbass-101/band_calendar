import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { BRANDING } from "@/src/lib/branding";
import SiteNavigation from "@/src/components/SiteNavigation";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: BRANDING.main.title,
  description: "Plan services and rehearsals, and browse the song library.",
  icons: {
    icon: BRANDING.main.logoSrc,
  },
  openGraph: {
    type: "website",
    title: BRANDING.main.title,
    description: "Plan services and rehearsals, and browse the song library.",
    images: [
      {
        url: BRANDING.main.logoSrc,
        width: 512,
        height: 512,
        alt: BRANDING.main.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRANDING.main.title,
    description: "Plan services and rehearsals, and browse the song library.",
    images: [BRANDING.main.logoSrc],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNavigation authorized={authorized} />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
