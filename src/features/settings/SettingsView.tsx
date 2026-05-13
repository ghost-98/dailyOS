"use client";

import type { User } from "@supabase/supabase-js";
import { Bell, Database, LogOut, Mail, Save, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { signOutDailyOS } from "@/components/auth/AuthGate";
import { SectionCard } from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";

export function SettingsView() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [scheduleAlarm, setScheduleAlarm] = useState(true);
  const [taskAlarm, setTaskAlarm] = useState(true);
  const [careerAlarm, setCareerAlarm] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName(data.user?.user_metadata?.display_name ?? data.user?.email?.split("@")[0] ?? "");
    });
  }, []);

  return (
    <div className="settings-page">
      <header className="page-header">
        <div>
          <h1>설정</h1>
          <div className="today__date">
            <Settings aria-hidden size={20} />
            <span>계정, 알림, 데이터 관리 방식을 조정합니다.</span>
          </div>
        </div>
        <button className="header-action" type="button">
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
            <input placeholder="표시 이름" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <div className="settings-account-row">
            <Mail aria-hidden size={17} />
            <div>
              <span>이메일</span>
              <strong>{user?.email ?? "로그인 정보를 불러오는 중"}</strong>
            </div>
          </div>
          <div className="settings-account-row">
            <ShieldCheck aria-hidden size={17} />
            <div>
              <span>인증 상태</span>
              <strong>{user?.email_confirmed_at ? "이메일 인증 완료" : "이메일 인증 확인 필요"}</strong>
            </div>
          </div>
          <button className="settings-command settings-command--danger" onClick={() => void signOutDailyOS()} type="button">
            <LogOut aria-hidden size={16} />
            로그아웃
          </button>
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Bell aria-hidden size={20} />
            <span>알림</span>
          </div>
          <SettingToggle checked={scheduleAlarm} label="일정 알림" onChange={setScheduleAlarm} />
          <SettingToggle checked={taskAlarm} label="할 일 마감 알림" onChange={setTaskAlarm} />
          <SettingToggle checked={careerAlarm} label="취업 일정 알림" onChange={setCareerAlarm} />
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Database aria-hidden size={20} />
            <span>데이터 관리</span>
          </div>
          <button className="settings-command" type="button">데이터 내보내기</button>
          <button className="settings-command" type="button">백업 파일 가져오기</button>
          <button className="settings-command settings-command--danger" type="button">계정 데이터 삭제</button>
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
