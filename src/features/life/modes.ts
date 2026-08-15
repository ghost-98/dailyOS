export type LifeViewMode =
  | "home"
  | "calendar"
  | "gallery"
  | "plans"
  | "search"
  | "people"
  | "places"
  | "ask"
  | "activities"
  | "logs"
  | "health";

export type LifeDataMode = Exclude<LifeViewMode, "home">;

export const lifeInputModes: LifeViewMode[] = ["activities", "plans", "logs", "health"];

export const lifeInsightModes: LifeViewMode[] = ["calendar", "gallery", "search", "people", "places", "ask"];
