export type EventType = "schedule" | "todo" | "event" | "health" | "weight" | "career" | "expense";

export type TaskStatus = "todo" | "inProgress" | "done";

export type TaskPriority = "high" | "normal" | "low";

export type PlanPlace = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  providerPlaceId?: string;
  phone?: string;
  category?: string;
  url?: string;
};

export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledDate: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  completedAt?: string;
  deferredCount: number;
  memo?: string;
  expenseAmount?: number;
  companions?: string;
  place?: PlanPlace;
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

export type ExpenseCategory = "food" | "transport" | "shopping" | "housing" | "health" | "culture" | "education" | "etc";

export type ExpenseRecord = {
  id: string;
  date: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  memo?: string;
  targetType?: "schedule" | "todo" | "event";
  targetId?: string;
};

export type PlaceProvider = "naver" | "manual";

export type PlaceFolder = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
};

export type PlaceRecord = {
  id: string;
  folderId?: string;
  folderIds?: string[];
  sourceIds?: string[];
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  provider: PlaceProvider;
  providerPlaceId?: string;
  phone?: string;
  category?: string;
  url?: string;
  isFavorite?: boolean;
  memo?: string;
};
