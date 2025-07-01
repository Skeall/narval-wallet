import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../../public/material-symbols-rounded.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Narval",
  description: "Application de gestion de portefeuille et paris entre amis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icon-512.png" sizes="512x512" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="description" content="Application de gestion de portefeuille et paris entre amis." />
        <meta name="theme-color" content="#0B0F1C" />
        <meta name="background-color" content="#0B0F1C" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Narval" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Narval</title>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`} 
        style={{ background: '#0B0F1C', color: '#FFFFFF', fontFamily: 'SF Pro, Inter, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
