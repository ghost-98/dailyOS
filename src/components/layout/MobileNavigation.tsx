import Link from "next/link";
import { mobileNav } from "@/components/layout/navigation";

export function MobileNavigation({ activePage }: { activePage?: string }) {
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {mobileNav.map(({ key, label, href, icon: Icon }) => {
        const isActive = activePage === key;
        const isRecord = key === "record";
        return (
          <Link aria-label={label} aria-current={isActive ? "page" : undefined}
            className={`bottom-nav__item ${isRecord ? "bottom-nav__item--record" : ""} ${isActive ? "bottom-nav__item--active" : ""}`}
            href={href} key={key} title={label}>
            <Icon aria-hidden size={20} />
            {!isRecord && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
