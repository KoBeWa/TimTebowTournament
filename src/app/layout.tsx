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
  description: "11 Seasons. 8 Manager. Eine Legende.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${display.variable} ${inter.variable}`}>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
          {children}
        </main>
        <footer className="mt-12 border-t border-border-light">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-faint">
            <span className="label-nav">Tim Tebow Tournament · Est. 2015</span>
            <span>Die offizielle Ligachronik</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
