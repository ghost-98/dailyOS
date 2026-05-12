export type EventType = "schedule" | "todo" | "health" | "weight" | "career";

export type ScheduleSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  place: string;
  category: string;
  status?: "active" | "canceled";
};

export type TodoSummary = {
  id: string;
  title: string;
  status: "todo" | "inProgress" | "done";
  priority: "high" | "normal" | "low";
  dueLabel: string;
};

export type TaskStatus = "todo" | "inProgress" | "done";

export type TaskPriority = "high" | "normal" | "low";

export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledDate: string;
  dueDate?: string;
  completedAt?: string;
  deferredCount: number;
  memo?: string;
};

export type HealthSummary = {
  vitalsIndex: number;
  weightKg: number;
  muscleMassKg?: number;
  bodyFatPercent?: number;
  workoutPlan: string;
  workoutDetail: string;
};

export type CareerEvent = {
  id: string;
  company: string;
  role: string;
  kind: "deadline" | "exam" | "interview" | "result";
  dateLabel: string;
  dday: string;
  status: "urgent" | "normal" | "muted";
};

export type WeightRecord = {
  id: string;
  date: string;
  weightKg: number;
  measuredFasted: boolean;
  muscleMassKg?: number;
  bodyFatPercent?: number;
  memo?: string;
};

export type WorkoutCondition = "good" | "normal" | "low";

export type WorkoutType = "running" | "stretching" | "bodyweight" | "weight" | "etc";

export type WorkoutSession = {
  id: string;
  date: string;
  type: WorkoutType;
  condition: WorkoutCondition;
  durationMinutes: number;
  memo?: string;
};
