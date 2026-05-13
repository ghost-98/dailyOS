import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dailyOS",
  description: "개인 생산성과 생활 관리를 위한 PWA",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#c8b6ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
