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
        <link rel="apple-touch-icon" href="/favicon2.png" />
        <title>Narval</title>
        <meta name="description" content="Application de gestion de portefeuille et paris entre amis." />
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
