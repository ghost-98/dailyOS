"use client";

import { useState } from "react";
import { DayPeopleView } from "@/features/screens/day/DayPeopleView";
import { LedgerView } from "@/features/screens/other/LedgerView";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";

type OtherTab = "people" | "ledger" | "gallery";

const otherTabs: Array<{ key: OtherTab; label: string }> = [
  { key: "people", label: "사람" },
  { key: "ledger", label: "돈" },
  { key: "gallery", label: "사진" },
];

export function OtherView() {
  const { data } = useRecordsDataState();
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
          tasks={data.tasks}
        />
      ) : null}

      {activeTab === "ledger" ? <LedgerView variant="tab" /> : null}

      {activeTab === "gallery" ? <div className="life-empty-state">사진 화면은 정리 중이에요.</div> : null}
    </div>
  );
}






