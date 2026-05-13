import { AppShell } from "@/components/layout/AppShell";
import { EventsView } from "@/features/events/EventsView";

export default function EventsPage() {
  return (
    <AppShell activeKey="events">
      <EventsView />
    </AppShell>
  );
}
