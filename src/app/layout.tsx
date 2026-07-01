import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://levelsgov.com"),
  title: {
    default: "LevelsGov — Federal Workforce Pay & Data",
    template: "%s | LevelsGov",
  },
  description:
    "Browse and explore U.S. federal workforce data including employment, new hires, and departures from the Office of Personnel Management.",
  openGraph: {
    type: "website",
    siteName: "LevelsGov",
    title: "LevelsGov — Federal Workforce Pay & Data",
    description:
      "Transparent, searchable federal workforce compensation data powered by OPM FedScope.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LevelsGov — Federal Workforce Pay & Data",
    description:
      "Transparent, searchable federal workforce compensation data powered by OPM FedScope.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
