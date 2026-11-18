import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

// Self-hosted (see fonts/README.md), so a build does not depend on Google Fonts
const hostGrotesk = localFont({
  src: "./fonts/host-grotesk-latin-variable.woff2",
  weight: "300 800",
  variable: "--font-host-grotesk",
  display: "swap",
});

const atkinsonMono = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/atkinson-hyperlegible-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-atkinson-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tim Tebow Tournament | Die offizielle Ligachronik",
  description: "12 Seasons. 8 Manager. Eine Legende.",
};

// Pages read Supabase at build time; re-render them hourly so the weekly
// sync (records, standings, achievements) shows up without a redeploy.
export const revalidate = 3600;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${hostGrotesk.variable} ${atkinsonMono.variable}`}>
      <body>
        <Navbar />
        {/* The sidebar is fixed from lg up; the content column makes room for it */}
        <div className="lg:pl-60">
          <main className="mx-auto max-w-[76rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </main>
          <footer className="mx-auto max-w-[76rem] px-4 pb-24 pt-8 text-xs text-text-faint sm:px-6 lg:px-10 lg:pb-8">
            Tim Tebow Tournament, die Ligachronik seit 2015
          </footer>
        </div>
      </body>
    </html>
  );
}
