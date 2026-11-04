import type { Metadata } from "next";
import { Archivo_Black, Bangers, Comic_Neue, Inter } from "next/font/google";
import "./globals.css";

// Paneller's type: Inter to read in, Archivo Black to shout, Bangers for comic
// headings, Comic Neue for lettering inside a balloon.
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const display = Archivo_Black({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const comic = Bangers({ variable: "--font-comic", subsets: ["latin"], weight: "400" });
const letter = Comic_Neue({ variable: "--font-letter", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Paneller Open",
  description:
    "An open-source comic page editor. Reads any comic page back into its panels and bubbles with SAM 3.1, draws panel art with Muse Image.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${comic.variable} ${letter.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
