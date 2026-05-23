import { AppShell } from "@/components/layout/AppShell";
import { LedgerView } from "@/features/ledger/LedgerView";

export default function LedgerPage() {
  return (
    <AppShell activeKey="ledger">
      <LedgerView />
    </AppShell>
  );
}
