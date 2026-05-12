import { AppShell } from "@/components/layout/AppShell";
import { TasksView } from "@/features/tasks/TasksView";

export default function TasksPage() {
  return (
    <AppShell activeKey="tasks">
      <TasksView />
    </AppShell>
  );
}
