import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "League Legacy | Fantasy Football History",
  description: "11 Seasons. 8 Managers. One Legacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${dmSans.variable} font-sans`}>
        <Navbar />
        <main className="mx-auto max-w-7xl px-[--spacing-page] py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
