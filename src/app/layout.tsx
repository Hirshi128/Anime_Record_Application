import type { Metadata } from "next";
import "./globals.css";

import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "Anime Record",
  description: "見たアニメの評価と感想を記録するWebアプリ",
  applicationName: "Anime Record",
  appleWebApp: {
    capable: true,
    title: "Anime Record",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
