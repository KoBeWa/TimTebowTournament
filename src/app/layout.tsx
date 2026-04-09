import type { Metadata } from "next";
import { Playfair_Display, Roboto_Condensed, Inter } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const robotoCond = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto-condensed",
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
      <body className={`${playfair.variable} ${robotoCond.variable} ${inter.variable}`}>
        <Navbar />
        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
