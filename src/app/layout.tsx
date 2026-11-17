import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

// Self-hosted (see fonts/README.md), so a build does not depend on Google Fonts
const display = localFont({
  src: [
    { path: "./fonts/barlow-condensed-latin-600.woff2", weight: "600" },
    { path: "./fonts/barlow-condensed-latin-700.woff2", weight: "700" },
    { path: "./fonts/barlow-condensed-latin-800.woff2", weight: "800" },
  ],
  variable: "--font-display",
});

const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-inter",
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
    <html lang="de">
      <body className={`${display.variable} ${inter.variable}`}>
        <Navbar />
        {/* The sidebar is fixed from lg up; the content column makes room for it */}
        <div className="lg:pl-[17.5rem]">
          <main className="mx-auto max-w-[76rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
          <footer className="mx-auto max-w-[76rem] px-4 pb-28 pt-8 text-xs text-text-faint sm:px-6 lg:px-8 lg:pb-8">
            Tim Tebow Tournament, die Ligachronik seit 2015
          </footer>
        </div>
      </body>
    </html>
  );
}
