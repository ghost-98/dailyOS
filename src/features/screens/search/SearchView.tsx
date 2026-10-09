"use client";

import { Brain, Search } from "lucide-react";
import { useState } from "react";
import { KeywordSearchPanel } from "@/features/screens/search/KeywordSearchPanel";
import { RecordConversationPlaceholder } from "@/features/screens/search/RecordConversationPlaceholder";

export function SearchView() {
  const [mode, setMode] = useState<"search" | "ask">("search");

  return (
    <div className="life-tab-panel">
      <div className="life-search-shell">
        <div className="life-search-mode-switch" role="tablist" aria-label="검색 모드">
          <button aria-selected={mode === "search"} aria-controls="keyword-search-panel" className={mode === "search" ? "life-search-mode-switch__item life-search-mode-switch__item--active" : "life-search-mode-switch__item"} id="keyword-search-tab" onClick={() => setMode("search")} role="tab" type="button">
            <Search aria-hidden size={15} />
            <span>검색</span>
          </button>
          <button aria-selected={mode === "ask"} aria-controls="record-conversation-panel" className={mode === "ask" ? "life-search-mode-switch__item life-search-mode-switch__item--active" : "life-search-mode-switch__item"} id="record-conversation-tab" onClick={() => setMode("ask")} role="tab" type="button">
            <Brain aria-hidden size={15} />
            <span>기록 대화</span>
          </button>
        </div>
        <div aria-labelledby="keyword-search-tab" hidden={mode !== "search"} id="keyword-search-panel" role="tabpanel">
          <KeywordSearchPanel />
        </div>
        <div aria-labelledby="record-conversation-tab" hidden={mode !== "ask"} id="record-conversation-panel" role="tabpanel">
          <RecordConversationPlaceholder />
        </div>
      </div>
    </div>
  );
}
