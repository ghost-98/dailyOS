"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOfflineQueueItems, OFFLINE_QUEUE_CHANGED_EVENT, processOfflineRecordQueue } from "@/features/records/offline/offlineRecordQueue";

export function OfflineQueueStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsOnline(navigator.onLine);
    setPendingCount((await getOfflineQueueItems()).length);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await processOfflineRecordQueue();
      setPendingCount(result.pending);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); void sync(); };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => void refresh();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChange);
    void refresh().then(() => { if (navigator.onLine) void sync(); });
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChange);
    };
  }, [refresh, sync]);

  if (isOnline && pendingCount === 0) return null;

  const content = (
    <>
      {isSyncing ? <RefreshCw aria-hidden className="offline-queue-status__spin" size={14} /> : <CloudOff aria-hidden size={14} />}
      <span>{isSyncing ? `${pendingCount}건 동기화 중` : isOnline ? `${pendingCount}건 동기화 대기` : `오프라인 · ${pendingCount}건 저장 대기`}</span>
    </>
  );

  return isOnline && pendingCount > 0 ? (
    <button aria-label="대기 중인 기록 다시 동기화" className="offline-queue-status" disabled={isSyncing} onClick={() => void sync()} type="button">{content}</button>
  ) : <div className="offline-queue-status" role="status">{content}</div>;
}
