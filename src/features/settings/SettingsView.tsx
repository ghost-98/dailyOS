"use client";

import { Bell, Database, Save, Settings, UserRound } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";

export function SettingsView() {
  const [displayName, setDisplayName] = useState("daily user");
  const [email, setEmail] = useState("user@example.com");
  const [scheduleAlarm, setScheduleAlarm] = useState(true);
  const [taskAlarm, setTaskAlarm] = useState(true);
  const [careerAlarm, setCareerAlarm] = useState(true);

  return (
    <div className="settings-page">
      <header className="page-header">
        <div>
          <h1>설정</h1>
          <div className="today__date">
            <Settings aria-hidden size={20} />
            <span>계정, 알림, 데이터 관리 옵션을 설정합니다.</span>
          </div>
        </div>
        <button className="header-action">
          <Save aria-hidden size={18} />
          저장
        </button>
      </header>

      <div className="settings-grid">
        <SectionCard className="settings-card">
          <div className="card-title">
            <UserRound aria-hidden size={20} />
            <span>로그인/계정</span>
          </div>
          <label>
            <span>이름</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            <span>이메일</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Bell aria-hidden size={20} />
            <span>알림</span>
          </div>
          <SettingToggle checked={scheduleAlarm} label="일정 알림" onChange={setScheduleAlarm} />
          <SettingToggle checked={taskAlarm} label="할 일 마감 알림" onChange={setTaskAlarm} />
          <SettingToggle checked={careerAlarm} label="취업 이벤트 알림" onChange={setCareerAlarm} />
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Database aria-hidden size={20} />
            <span>데이터 관리</span>
          </div>
          <button className="settings-command">데이터 내보내기</button>
          <button className="settings-command">데이터 가져오기</button>
          <button className="settings-command settings-command--danger">초기화</button>
        </SectionCard>
      </div>
    </div>
  );
}

function SettingToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <div className="settings-toggle">
      <span>{label}</span>
      <label className="ios-switch">
        <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
        <span />
      </label>
    </div>
  );
}
