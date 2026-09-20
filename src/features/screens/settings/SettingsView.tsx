"use client";

import type { User } from "@supabase/supabase-js";
import { AlertTriangle, Bell, CheckCircle2, Database, Download, ExternalLink, LogOut, Mail, Save, ScanSearch, Settings, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutDailyOS, useDailyOSUser } from "@/components/auth/AuthGate";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { confirmAction } from "@/lib/actionGuards";
import { supabase } from "@/lib/supabase";
import { deleteDailyOSData, downloadDailyOSExport, exportDailyOSData, importDailyOSData } from "@/features/data/settings/dataManagement";
import { inspectDataIntegrity, repairDataIntegrity } from "@/features/data/settings/dataIntegrity";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { clearRecordDataSnapshotCache } from "@/features/records/state/recordsDataLoader";

export function SettingsView() {
  const router = useRouter();
  const { data, isLoading: isLoadingRecords, reload } = useRecordsDataState();
  const { displayName: authDisplayName, profile, refreshProfile, user: authUser } = useDailyOSUser();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [isManagingData, setIsManagingData] = useState(false);
  const [eventAlarm, setEventAlarm] = useState(true);
  const [taskAlarm, setTaskAlarm] = useState(true);
  const [integrityMessage, setIntegrityMessage] = useState("");
  const [isRepairingIntegrity, setIsRepairingIntegrity] = useState(false);
  const integrityIssues = useMemo(() => inspectDataIntegrity(data), [data]);
  const repairableIssueCount = integrityIssues.filter((issue) => issue.repair).length;

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

  const repairIntegrity = async () => {
    if (repairableIssueCount === 0 || isRepairingIntegrity) return;
    if (!confirmAction(`${repairableIssueCount}개의 연결 오류를 정리할까요? 고아·중복 지출은 삭제하고 나머지 기록은 연결만 해제합니다.`)) return;
    setIsRepairingIntegrity(true);
    setIntegrityMessage("");
    try {
      const repaired = await repairDataIntegrity(data, integrityIssues);
      clearRecordDataSnapshotCache();
      await reload();
      setIntegrityMessage(`${repaired}개의 연결 오류를 정리했습니다.`);
    } catch (error) {
      console.error("Failed to repair data integrity", error);
      setIntegrityMessage("데이터 연결 정리에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsRepairingIntegrity(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <div>
          <h1>설정</h1>
          <div className="settings-header-copy">
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
          <FormField label="이름">
            <input placeholder="표시 이름" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </FormField>
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

        <SectionCard className="settings-card settings-integrity-card">
          <div className="card-title">
            <ScanSearch aria-hidden size={20} />
            <span>데이터 상태 점검</span>
          </div>
          {isLoadingRecords ? (
            <p className="settings-hint">기록 연결 상태를 확인하는 중입니다.</p>
          ) : integrityIssues.length === 0 ? (
            <div className="settings-integrity-ok"><CheckCircle2 aria-hidden size={18} /><span>발견된 연결 문제가 없습니다.</span></div>
          ) : (
            <div className="settings-integrity-list">
              {integrityIssues.slice(0, 12).map((issue) => (
                <div className={`settings-integrity-item settings-integrity-item--${issue.severity}`} key={issue.id}>
                  <AlertTriangle aria-hidden size={15} />
                  <div><strong>{issue.title}</strong><span>{issue.description}</span></div>
                  {issue.href ? <button aria-label={`${issue.title} 기록 보기`} onClick={() => router.push(issue.href!)} type="button"><ExternalLink aria-hidden size={14} /></button> : null}
                </div>
              ))}
              {integrityIssues.length > 12 ? <p className="settings-hint">그 외 {integrityIssues.length - 12}개의 문제가 더 있습니다.</p> : null}
            </div>
          )}
          {repairableIssueCount > 0 ? <ActionButton disabled={isRepairingIntegrity} onClick={() => void repairIntegrity()} variant="secondary">연결 오류 {repairableIssueCount}개 정리</ActionButton> : null}
          {integrityMessage ? <p className="settings-message">{integrityMessage}</p> : null}
          <p className="settings-hint">자동 정리는 원본 기록을 보존합니다. 경로가 비어 있는 사진처럼 판단이 필요한 항목은 직접 확인만 제공합니다.</p>
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






