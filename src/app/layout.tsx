import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
