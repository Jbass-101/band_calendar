import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Last Harvest Instrumentalists",
  description: "Monthly schedule for services and rehearsals",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    type: "website",
    title: "Last Harvest Instrumentalists",
    description: "Monthly schedule for services and rehearsals",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Last Harvest Instrumentalists" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Last Harvest Instrumentalists",
    description: "Monthly schedule for services and rehearsals",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
