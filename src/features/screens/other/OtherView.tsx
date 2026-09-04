"use client";

import { useState } from "react";
import { DayGalleryView } from "@/features/screens/day/DayGalleryView";
import { DayPeopleView } from "@/features/screens/day/DayPeopleView";
import { LedgerView } from "@/features/screens/other/LedgerView";
import { useLifeDataState } from "@/features/life/useLifeDataState";

type OtherTab = "people" | "ledger" | "gallery";

const otherTabs: Array<{ key: OtherTab; label: string }> = [
  { key: "people", label: "사람" },
  { key: "ledger", label: "돈" },
  { key: "gallery", label: "사진" },
];

export function OtherView() {
  const { data, mutations } = useLifeDataState();
  const [activeTab, setActiveTab] = useState<OtherTab>("people");

  return (
    <div className="life-tab-panel">
      <div className="life-other-switcher" role="tablist" aria-label="기타 탭">
        {otherTabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.key}
            className={activeTab === tab.key ? "life-other-switcher__item life-other-switcher__item--active" : "life-other-switcher__item"}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "people" ? (
        <DayPeopleView
          activities={data.activities}
          dailyLogs={data.dailyLogs}
          events={data.events}
          expenses={data.expenses}
          photos={data.lifePhotos}
          showHeading={false}
          tasks={data.tasks}
        />
      ) : null}

      {activeTab === "ledger" ? <LedgerView variant="tab" /> : null}

      {activeTab === "gallery" ? <DayGalleryView onDeletePhoto={mutations.deleteLifePhoto} photos={data.lifePhotos} showHeading={false} /> : null}
    </div>
  );
}
