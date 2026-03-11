import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PhishCatch AI – Email Phishing Detector",
  description:
    "Paste a suspicious email and get an instant AI-powered risk assessment, red flag breakdown, and actionable security advice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-slate-950 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
