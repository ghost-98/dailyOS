export type LifeViewMode =
  | "home"
  | "calendar"
  | "plans"
  | "report"
  | "monthly"
  | "search"
  | "people"
  | "ask"
  | "places"
  | "activities"
  | "logs"
  | "photos"
  | "health"
  | "map";

export type LifeDataMode = Exclude<LifeViewMode, "home" | "map">;

export const lifeInputModes: LifeViewMode[] = ["activities", "plans", "logs", "photos", "health"];

export const lifeInsightModes: LifeViewMode[] = ["calendar", "report", "monthly", "search", "people", "ask"];
