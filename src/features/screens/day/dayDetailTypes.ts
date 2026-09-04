import type { DayTimelineItem, ExternalCalendarItem } from "@/features/calendar/types";

export type DayDetailView = "map" | "photos" | "companions" | "finance" | "logs" | null;

export type DayActivityItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "activity" };
export type DayLogItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "daily_log" };
export type DayPhotoItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "photo" };
export type DayFinanceItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "expense" | "income" };

export type DayStandalonePhotoGroup = {
  id: string;
  items: DayPhotoItem[];
  sortMinutes: number;
  timeLabel: string;
};

export type DayRouteStop = {
  address?: string;
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  name: string;
  photos?: DayPhotoItem[];
  sortMinutes?: number;
  timeLabel: string;
};

export type DayResolvedRouteStop = DayRouteStop & {
  latitude: number;
  longitude: number;
};

export type DayFinanceTotals = {
  expense: number;
  income: number;
  net: number;
};

export type DayCounterItem = {
  count: number;
  value: string;
};

export type DayItemActions = {
  deleteActivity: (id: string) => Promise<void> | void;
  deleteIncome: (id: string) => Promise<void> | void;
  deleteLog: (id: string) => Promise<void> | void;
  deletePhoto: (id: string) => Promise<void> | void;
  editActivity: (id: string) => Promise<void> | void;
  editIncome: (id: string) => Promise<void> | void;
  editLog: (id: string) => Promise<void> | void;
  editPhoto: (id: string) => Promise<void> | void;
};
