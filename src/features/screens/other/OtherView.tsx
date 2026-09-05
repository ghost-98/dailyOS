"use client";

import { useState } from "react";
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

export function OtherView() {
  const [activeTab, setActiveTab] = useState<OtherTab>("people");

  return (
    <div className="life-tab-panel">
      <div className="life-other-switcher" role="tablist" aria-label="기타 탭">
        {otherTabs.map((tab) => {
          const Icon = tab.icon;
          return <button
            aria-pressed={activeTab === tab.key}
            className={activeTab === tab.key ? "life-other-switcher__item life-other-switcher__item--active" : "life-other-switcher__item"}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden size={16} strokeWidth={2.2} />
            <span>{tab.label}</span>
          </button>;
        })}
      </div>

      {activeTab === "people" ? (
        <PeopleView />
      ) : null}

      {activeTab === "ledger" ? <LedgerView /> : null}

      {activeTab === "map" ? (
        <OtherMapView />
      ) : null}

      {activeTab === "gallery" ? (
        <OtherGalleryView />
      ) : null}
    </div>
  );
}






