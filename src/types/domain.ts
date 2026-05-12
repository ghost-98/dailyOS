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
