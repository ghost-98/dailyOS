export type LifeViewMode =
  | "home"
  | "calendar"
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

export const lifeInputModes: LifeViewMode[] = ["calendar", "activities", "logs", "photos", "health"];

export const lifeInsightModes: LifeViewMode[] = ["report", "monthly", "search", "people", "ask"];
