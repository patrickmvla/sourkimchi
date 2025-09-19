// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

import MainNav from "@/components/nav/MainNav";
import { ClientProviders } from "@/providers/client-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "SourKimchi",
    template: "%s • SourKimchi",
  },
  description:
    "Structured recipes, buttery-smooth cook mode, and curated creators to help you fall in love with cooking.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="min-h-screen bg-background text-foreground antialiased">
          <ClientProviders>
            <MainNav />
            {children}
          </ClientProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
