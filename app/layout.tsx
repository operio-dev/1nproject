import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import React from "react";
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "1N | Niente.",
  description: "Un'app esclusiva dove paghi per il nulla. Ottieni un numero unico da 1 a 100.000.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${inter.className} bg-white text-black antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
