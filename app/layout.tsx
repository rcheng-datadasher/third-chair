import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Secretary",
  description: "Live proposal queue and decision log",
};

/**
 * Root layout: fonts, the QueryClient provider and the shared two-link nav.
 *
 * @param props - Layout props.
 * @param props.children - The active route's page.
 * @returns The document shell.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
