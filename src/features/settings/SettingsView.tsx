"use client";

import type { User } from "@supabase/supabase-js";
import { Bell, Database, Download, LogOut, Mail, Save, Settings, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOutDailyOS, useDailyOSUser } from "@/components/auth/AuthGate";
import { ActionButton } from "@/components/ui/ActionButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { confirmAction } from "@/lib/actionGuards";
import { supabase } from "@/lib/supabase";
import { deleteDailyOSData, downloadDailyOSExport, exportDailyOSData, importDailyOSData } from "./dataManagement";

export function SettingsView() {
  const { displayName: authDisplayName, profile, refreshProfile, user: authUser } = useDailyOSUser();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [isManagingData, setIsManagingData] = useState(false);
  const [eventAlarm, setEventAlarm] = useState(true);
  const [taskAlarm, setTaskAlarm] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName(profile?.fullName ?? authDisplayName);
    });
  }, [authDisplayName, profile?.fullName]);

  const saveAccount = async () => {
    if (!supabase) return;
    setSaveMessage("");
    const nextName = displayName.trim();
    if (!nextName) {
      setSaveMessage("이름을 입력해 주세요.");
      return;
    }
    if (!confirmAction("계정 정보를 저장할까요?")) return;

    const { error: profileError } = await supabase.from("profiles").upsert({
      birth_date: profile?.birthDate ?? null,
      email: authUser.email ?? null,
      full_name: nextName,
      gender: profile?.gender ?? "prefer_not_to_say",
      user_id: authUser.id,
    });

    if (profileError) {
      setSaveMessage("프로필 저장에 실패했습니다.");
      return;
    }

    await supabase.auth.updateUser({ data: { full_name: nextName } });
    await refreshProfile();
    setSaveMessage("저장되었습니다.");
  };

  const exportData = async () => {
    setIsManagingData(true);
    setDataMessage("");
    try {
      const payload = await exportDailyOSData();
      downloadDailyOSExport(payload);
      setDataMessage("dailyOS 백업 파일을 내려받았습니다.");
    } catch (error) {
      console.error("Failed to export dailyOS data", error);
      setDataMessage(error instanceof Error ? error.message : "데이터 내보내기에 실패했습니다.");
    } finally {
      setIsManagingData(false);
    }
  };

  const importData = async (file?: File) => {
    if (!file) return;
    if (!confirmAction("백업 파일을 현재 계정 데이터로 가져올까요? 같은 ID의 데이터는 덮어씁니다.")) return;

    setIsManagingData(true);
    setDataMessage("");
    try {
      await importDailyOSData(file);
      setDataMessage("백업 파일을 가져왔습니다. 화면을 새로고침하면 반영됩니다.");
    } catch (error) {
      console.error("Failed to import dailyOS data", error);
      setDataMessage(error instanceof Error ? error.message : "데이터 가져오기에 실패했습니다.");
    } finally {
      setIsManagingData(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const deleteData = async () => {
    const firstConfirm = confirmAction("정말 이 계정의 dailyOS 데이터를 삭제할까요? 로그인 계정은 유지되지만 앱 기록은 삭제됩니다.");
    if (!firstConfirm) return;
    const secondConfirm = confirmAction("마지막 확인입니다. 삭제 전 백업 파일을 내보냈나요?");
    if (!secondConfirm) return;

    setIsManagingData(true);
    setDataMessage("");
    try {
      await deleteDailyOSData();
      setDataMessage("계정의 dailyOS 데이터를 삭제했습니다. 화면을 새로고침하면 반영됩니다.");
    } catch (error) {
      console.error("Failed to delete dailyOS data", error);
      setDataMessage(error instanceof Error ? error.message : "데이터 삭제에 실패했습니다.");
    } finally {
      setIsManagingData(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <div>
          <h1>설정</h1>
          <div className="today__date">
            <Settings aria-hidden size={20} />
            <span>계정, 알림, 백업과 데이터 관리 방식을 조정합니다.</span>
          </div>
        </div>
        <ActionButton className="header-action" onClick={() => void saveAccount()}>
          <Save aria-hidden size={18} />
          저장
        </ActionButton>
      </header>

      <div className="settings-grid">
        <SectionCard className="settings-card">
          <div className="card-title">
            <UserRound aria-hidden size={20} />
            <span>로그인 계정</span>
          </div>
          <label>
            <span>이름</span>
            <input placeholder="표시 이름" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          {saveMessage ? <p className="settings-message">{saveMessage}</p> : null}
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
          <ActionButton onClick={() => void signOutDailyOS()} variant="danger">
            <LogOut aria-hidden size={16} />
            로그아웃
          </ActionButton>
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Bell aria-hidden size={20} />
            <span>알림</span>
          </div>
          <SettingToggle checked={eventAlarm} label="이벤트 알림" onChange={setEventAlarm} />
          <SettingToggle checked={taskAlarm} label="할 일 마감 알림" onChange={setTaskAlarm} />
          <p className="settings-hint">현재는 화면 설정만 저장합니다. 라즈베리파이 상시 실행 이후 푸시 알림과 연결하면 완성도가 올라갑니다.</p>
        </SectionCard>

        <SectionCard className="settings-card">
          <div className="card-title">
            <Database aria-hidden size={20} />
            <span>데이터 관리</span>
          </div>
          <ActionButton disabled={isManagingData} onClick={() => void exportData()} variant="secondary">
            <Download aria-hidden size={16} />
            데이터 내보내기
          </ActionButton>
          <ActionButton disabled={isManagingData} onClick={() => importInputRef.current?.click()} variant="secondary">
            <Upload aria-hidden size={16} />
            백업 파일 가져오기
          </ActionButton>
          <input ref={importInputRef} accept="application/json" hidden type="file" onChange={(event) => void importData(event.target.files?.[0])} />
          <ActionButton disabled={isManagingData} onClick={() => void deleteData()} variant="danger">
            <Trash2 aria-hidden size={16} />
            계정 데이터 삭제
          </ActionButton>
          {dataMessage ? <p className="settings-message">{dataMessage}</p> : null}
          <p className="settings-hint">사진 파일은 Supabase Storage에 남아 있고, 백업 파일에는 사진 메타데이터와 경로가 저장됩니다.</p>
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
