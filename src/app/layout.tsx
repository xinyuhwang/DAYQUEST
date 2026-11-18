import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DAYQUEST",
  description: "Your daily quest: missions, focus sessions, XP and a companion that grows with you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // v1 ships only the Minimal theme; later the server sets this from the user's choice (§11.2).
    <html lang="en" data-theme="minimal" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
