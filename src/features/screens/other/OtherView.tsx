"use client";

import Link from "next/link";
import { Camera, Map, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import { PeopleView } from "@/features/screens/other/PeopleView";
import { LedgerView } from "@/features/screens/other/LedgerView";
import { OtherMapView } from "@/features/screens/other/OtherMapView";
import { OtherGalleryView } from "@/features/screens/other/OtherGalleryView";

type OtherTab = "people" | "ledger" | "map" | "gallery";

const otherTabs: Array<{ icon: LucideIcon; key: OtherTab; label: string }> = [
  { icon: Camera, key: "gallery", label: "사진" },
  { icon: Map, key: "map", label: "지도" },
  { icon: WalletCards, key: "ledger", label: "가계부" },
  { icon: UsersRound, key: "people", label: "사람" },
];

export function OtherView({ view }: { view?: string }) {
  const activeTab = otherTabs.find(({ key }) => key === view)?.key ?? "people";

  return (
    <div className="life-tab-panel other-workspace">
      <nav className="life-other-switcher" aria-label="보관함 보기">
        {otherTabs.map((tab) => {
          const Icon = tab.icon;
          return <Link
            aria-current={activeTab === tab.key ? "page" : undefined}
            className={activeTab === tab.key ? "life-other-switcher__item life-other-switcher__item--active" : "life-other-switcher__item"}
            href={`/m/other?view=${tab.key}`}
            key={tab.key}
            scroll={false}
          >
            <Icon aria-hidden size={16} strokeWidth={2.2} />
            <span>{tab.label}</span>
          </Link>;
        })}
      </nav>

      <div className="other-workspace__content">
        {activeTab === "people" ? <PeopleView /> : null}
        {activeTab === "ledger" ? <LedgerView /> : null}
        {activeTab === "map" ? <OtherMapView /> : null}
        {activeTab === "gallery" ? <OtherGalleryView /> : null}
      </div>
    </div>
  );
}






