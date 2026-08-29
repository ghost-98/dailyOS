export type EventType = "todo" | "event" | "health" | "weight" | "expense" | "income";

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
  measuredAtTime?: string;
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
  durationSeconds?: number;
  distanceKm?: number;
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
  targetType: "todo" | "event" | "activity";
  targetId: string;
};

export type IncomeCategory = "salary" | "business" | "investment" | "gift" | "refund" | "side" | "etc";

export type IncomeRecord = {
  id: string;
  date: string;
  title: string;
  amount: number;
  category: IncomeCategory;
  memo?: string;
};

export type LifeActivityRecord = {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  title: string;
  memo?: string;
  category?: string;
  food?: string;
  expenseAmount?: number;
  companions?: string;
  placeName?: string;
  placeAddress?: string;
  startPlaceName?: string;
  startPlaceAddress?: string;
  endPlaceName?: string;
  endPlaceAddress?: string;
  transportMode?: string;
  sourceId?: string;
  sourceTitle?: string;
  sourceType?: "todo" | "event";
  createdAt?: string;
};

export type DailyLogRecord = {
  id: string;
  date: string;
  content: string;
  linkedTargetId?: string;
  linkedTargetTitle?: string;
  linkedTargetType?: "todo" | "event" | "activity";
  createdAt?: string;
};

export type LifePhotoRecord = {
  id: string;
  date: string;
  fileName: string;
  filePath: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  caption?: string;
  linkedTargetId?: string;
  linkedTargetTitle?: string;
  linkedTargetType?: "todo" | "event" | "activity";
  takenAt?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

export type LifeMediaUploadInput = {
  file: File;
  width?: number;
  height?: number;
  durationSeconds?: number;
  takenAt?: string;
  latitude?: number;
  longitude?: number;
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

export type PersonalPlaceRecord = {
  id: string;
  label: string;
  mappedName?: string;
  address: string;
  latitude: number;
  longitude: number;
  providerPlaceId?: string;
  phone?: string;
  category?: string;
  url?: string;
  memo?: string;
};

export type PersonRecord = {
  id: string;
  name: string;
  memo?: string;
};
