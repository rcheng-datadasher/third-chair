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
  title: { default: "AI Secretary", template: "%s · AI Secretary" },
  description: "Live proposal queue and decision log",
};

/**
 * Root layout: fonts, the QueryClient provider and the app shell (sidebar on
 * desktop, top bar on mobile) with a full-width content column beside it.
 *
 * @param props - Layout props.
 * @param props.children - The active route's scene.
 * @returns The document shell.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-dvh flex-col md:flex-row">
            <Nav />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
