import { AppShell } from "@/components/layout/AppShell";

export default function DailyLogPage() {
  return (
    <AppShell activeKey="daily-log">
      <section className="daily-log-page">
        <header className="page-header">
          <div>
            <h1>하루 기록</h1>
          </div>
        </header>
      </section>
    </AppShell>
  );
}
