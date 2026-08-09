export type LifeViewMode =
  | "home"
  | "calendar"
  | "plans"
  | "search"
  | "people"
  | "places"
  | "ask"
  | "activities"
  | "logs"
  | "photos"
  | "health";

export type LifeDataMode = Exclude<LifeViewMode, "home">;

export const lifeInputModes: LifeViewMode[] = ["activities", "plans", "logs", "photos", "health"];

export const lifeInsightModes: LifeViewMode[] = ["calendar", "search", "people", "places", "ask"];
