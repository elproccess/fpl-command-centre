import type { Metadata } from "next";
import { Inter_Tight, Sora } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const sora = Sora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FPL Command Centre",
  description: "Premium FPL decision assistant for your best move, captain pick, squad health, and 3-GW plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#F8F5FF] text-[#17002F]">{children}</body>
    </html>
  );
}
