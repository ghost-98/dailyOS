"use client";

import Link from "next/link";
import { Aperture, Moon, Plus, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const themeKey = "dailyos-web-theme";

export const desktopPages = [
  { key: "day", href: "/m/day", label: "하루" },
  { key: "search", href: "/m/search", label: "기록 찾기" },
  { key: "other", href: "/m/other", label: "보관함" },
] as const;

export function DesktopHeader({ activePage }: { activePage?: string }) {
  return (
    <header className="desktop-header">
      <div className="desktop-header__inner">
        <Link href="/m/day" className="desktop-brand">
          <span aria-hidden><Aperture size={21} strokeWidth={1.8} /></span>
          <strong>dailyOS</strong>
        </Link>
        <nav className="desktop-navigation" aria-label="주 메뉴">
          {desktopPages.map(({ key, href, label }) => (
            <Link key={key} href={href} className="desktop-navigation__link"
              aria-current={activePage === key ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="desktop-header__actions">
          <ThemeButton />
          <Link href="/m/settings" className="desktop-settings" aria-label="설정" title="설정"
            aria-current={activePage === "settings" ? "page" : undefined}><Settings size={19} aria-hidden /></Link>
          <Link href="/m/record" className="desktop-new-record" aria-current={activePage === "record" ? "page" : undefined}>
            <Plus size={17} aria-hidden /> 새 기록
          </Link>
        </div>
      </div>
    </header>
  );
}

function ThemeButton() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const dark = localStorage.getItem(themeKey) === "dark";
      document.documentElement.dataset.webTheme = dark ? "dark" : "light";
      setIsDark(dark);
    } catch {
      // The toggle remains usable when the browser blocks persistent storage.
    }
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.dataset.webTheme = nextTheme;
    setIsDark(!isDark);
    try { localStorage.setItem(themeKey, nextTheme); } catch { /* Session-only preference. */ }
  }

  return (
    <button type="button" className="desktop-settings desktop-theme" aria-label="야간 모드" aria-pressed={isDark}
      title={isDark ? "밝은 모드로 전환" : "야간 모드로 전환"} onClick={toggleTheme}>
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
