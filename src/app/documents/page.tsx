import { AppShell } from "@/components/layout/AppShell";
import { DocumentsView } from "@/features/documents/DocumentsView";

export default function DocumentsPage() {
  return (
    <AppShell activeKey="documents">
      <DocumentsView />
    </AppShell>
  );
}
