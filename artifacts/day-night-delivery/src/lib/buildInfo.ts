declare const __DAY_NIGHT_BUILD_ID__: string;
declare const __DAY_NIGHT_BUILT_AT__: string;

export const DAY_NIGHT_BUILD_ID =
  typeof __DAY_NIGHT_BUILD_ID__ === "string" && __DAY_NIGHT_BUILD_ID__.trim()
    ? __DAY_NIGHT_BUILD_ID__
    : "development";

export const DAY_NIGHT_BUILT_AT =
  typeof __DAY_NIGHT_BUILT_AT__ === "string" && __DAY_NIGHT_BUILT_AT__.trim()
    ? __DAY_NIGHT_BUILT_AT__
    : new Date(0).toISOString();

export function shortDayNightBuildId() {
  return DAY_NIGHT_BUILD_ID === "development" ? DAY_NIGHT_BUILD_ID : DAY_NIGHT_BUILD_ID.slice(0, 12);
}
