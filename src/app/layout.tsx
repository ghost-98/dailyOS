import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dailyOS",
  description: "일정, 할 일, 건강, 취업 관리를 한 곳에서 다루는 개인 OS",
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
