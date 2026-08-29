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
