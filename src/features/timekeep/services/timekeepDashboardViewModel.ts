import type { UiText } from "../../../shared/i18n/index.ts";
import { addLocalDays } from "../../../shared/lib/localDate.ts";
import {
  buildLegacyExtendedCategoryId,
  getCategoryToken,
  isAppCategory,
  type AppCategory,
} from "../../../shared/classification/categoryTokens.ts";
import type { HourlyActivityPoint, HourlyCategoryActivity } from "../../../shared/lib/hourlyActivityCompiler.ts";
import type { CategoryDistItem, TopApplicationItem } from "../../dashboard/services/dashboardFormatting.ts";
import type {
  TimekeepActiveSession,
  TimekeepHistoryEntry,
  TimekeepProgram,
} from "./timekeepRuntimeService.ts";

export interface TimekeepDashboardViewModel {
  totalTrackedTime: number;
  yesterdayTrackedTime: number;
  dayDeltaTrackedTime: number;
  topApplications: TopApplicationItem[];
  categoryDist: CategoryDistItem[];
  hourlyActivity: HourlyActivityPoint[];
  hourlyCategoryActivity: HourlyCategoryActivity;
  categoryByExecutable: Record<string, AppCategory>;
}

interface TimeRange {
  startMs: number;
  endMs: number;
}

interface MaterializedEntry {
  exeName: string;
  category: AppCategory;
  startMs: number;
  endMs: number;
  durationMs: number;
}

function getLocalDayRange(date: Date): TimeRange {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function normalizeCategory(value: string | null | undefined): AppCategory {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (isAppCategory(normalized)) return normalized;
  return normalized ? buildLegacyExtendedCategoryId(value!.trim()) : "other";
}

function materializeHistory(
  history: TimekeepHistoryEntry[],
  activeSessions: TimekeepActiveSession[],
  programsByName: Map<string, TimekeepProgram>,
  range: TimeRange,
  nowMs: number,
): MaterializedEntry[] {
  const entries: MaterializedEntry[] = [];
  const append = (exeName: string, startValue: string, endValue: string | null) => {
    const startMs = new Date(startValue).getTime();
    const endMs = endValue ? new Date(endValue).getTime() : nowMs;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;

    const clippedStart = Math.max(range.startMs, startMs);
    const clippedEnd = Math.min(range.endMs, endMs, nowMs);
    if (clippedEnd <= clippedStart) return;

    entries.push({
      exeName,
      category: normalizeCategory(programsByName.get(exeName.toLowerCase())?.category),
      startMs: clippedStart,
      endMs: clippedEnd,
      durationMs: clippedEnd - clippedStart,
    });
  };

  for (const entry of history) {
    append(entry.program_name, entry.start_time, entry.end_time);
  }
  for (const session of activeSessions) {
    append(session.program_name, session.start_time, null);
  }
  return entries;
}

function addHourlyDuration(hours: number[], entry: MaterializedEntry) {
  let cursor = entry.startMs;
  while (cursor < entry.endMs) {
    const current = new Date(cursor);
    const nextHour = new Date(current);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const segmentEnd = Math.min(entry.endMs, nextHour.getTime());
    hours[current.getHours()] += segmentEnd - cursor;
    cursor = segmentEnd;
  }
}

function buildHourlyCategoryActivity(entries: MaterializedEntry[], uiText: UiText): HourlyCategoryActivity {
  const hourly = Array.from({ length: 24 }, () => new Map<AppCategory, number>());
  const totals = new Map<AppCategory, number>();

  for (const entry of entries) {
    let cursor = entry.startMs;
    while (cursor < entry.endMs) {
      const current = new Date(cursor);
      const nextHour = new Date(current);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      const segmentEnd = Math.min(entry.endMs, nextHour.getTime());
      const duration = segmentEnd - cursor;
      hourly[current.getHours()].set(entry.category, (hourly[current.getHours()].get(entry.category) ?? 0) + duration);
      totals.set(entry.category, (totals.get(entry.category) ?? 0) + duration);
      cursor = segmentEnd;
    }
  }

  const categories = Array.from(totals.entries()).sort((left, right) => right[1] - left[1]);
  const series = categories.map(([category, duration], index) => {
    const token = getCategoryToken(category, uiText);
    return {
      dataKey: `category${index}`,
      category,
      name: token.label,
      color: token.color,
      totalMinutes: duration / 60000,
      isRemainder: false,
    };
  });
  const points = hourly.map((buckets, hour) => {
    const point: HourlyCategoryActivity["points"][number] = {
      hour: `${String(hour).padStart(2, "0")}:00`,
      minutes: 0,
      segmentDetails: {},
    };
    categories.forEach(([category], index) => {
      const minutes = Math.round((buckets.get(category) ?? 0) / 60000);
      if (minutes <= 0) return;
      const dataKey = `category${index}`;
      const seriesItem = series[index];
      point[dataKey] = minutes;
      point.segmentDetails[dataKey] = {
        category,
        name: seriesItem.name,
        color: seriesItem.color,
        minutes,
        isRemainder: false,
      };
      point.minutes += minutes;
    });
    return point;
  });
  return { points, series };
}

function buildViewModelForEntries(entries: MaterializedEntry[], programs: TimekeepProgram[], uiText: UiText): TimekeepDashboardViewModel {
  const programByName = new Map(programs.map((program) => [program.name.toLowerCase(), program]));
  const totals = new Map<string, { duration: number; category: AppCategory }>();
  const categoryTotals = new Map<AppCategory, number>();
  const categoryByExecutable: Record<string, AppCategory> = {};
  const hours = new Array<number>(24).fill(0);

  for (const entry of entries) {
    const current = totals.get(entry.exeName.toLowerCase());
    if (current) current.duration += entry.durationMs;
    else totals.set(entry.exeName.toLowerCase(), { duration: entry.durationMs, category: entry.category });
    categoryTotals.set(entry.category, (categoryTotals.get(entry.category) ?? 0) + entry.durationMs);
    categoryByExecutable[entry.exeName.toLowerCase()] = entry.category;
    addHourlyDuration(hours, entry);
  }

  for (const program of programs) {
    categoryByExecutable[program.name.toLowerCase()] = normalizeCategory(program.category);
  }

  const totalTrackedTime = Array.from(totals.values()).reduce((sum, item) => sum + item.duration, 0);
  const topApplications = Array.from(totals.entries())
    .filter(([, item]) => item.duration > 0)
    .map(([key, item]) => {
      const program = programByName.get(key);
      const name = program?.name ?? key;
      const token = getCategoryToken(item.category, uiText);
      return {
        exeName: name,
        name,
        color: token.color,
        duration: item.duration,
        suspiciousDuration: 0,
        percentage: totalTrackedTime > 0 ? Math.round((item.duration / totalTrackedTime) * 100) : 0,
        categoryInitial: token.label.trim().slice(0, 1).toUpperCase() || "T",
      };
    })
    .sort((left, right) => right.duration - left.duration);
  const categoryDist = Array.from(categoryTotals.entries())
    .map(([category, value]) => {
      const token = getCategoryToken(category, uiText);
      return { category, name: token.label, value, color: token.color };
    })
    .sort((left, right) => right.value - left.value);
  const hourlyCategoryActivity = buildHourlyCategoryActivity(entries, uiText);
  return {
    totalTrackedTime,
    yesterdayTrackedTime: 0,
    dayDeltaTrackedTime: 0,
    topApplications,
    categoryDist,
    hourlyActivity: hours.map((duration, hour) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      minutes: Math.round(duration / 60000),
    })),
    hourlyCategoryActivity,
    categoryByExecutable,
  };
}

export function buildTimekeepDashboardViewModel({
  date,
  programs,
  history,
  yesterdayHistory,
  activeSessions,
  nowMs = Date.now(),
  uiText,
}: {
  date: Date;
  programs: TimekeepProgram[];
  history: TimekeepHistoryEntry[];
  yesterdayHistory: TimekeepHistoryEntry[];
  activeSessions: TimekeepActiveSession[];
  nowMs?: number;
  uiText: UiText;
}): TimekeepDashboardViewModel {
  const programsByName = new Map(programs.map((program) => [program.name.toLowerCase(), program]));
  const today = buildViewModelForEntries(
    materializeHistory(history, activeSessions, programsByName, getLocalDayRange(date), nowMs),
    programs,
    uiText,
  );
  const yesterday = buildViewModelForEntries(
    materializeHistory(yesterdayHistory, [], programsByName, getLocalDayRange(addLocalDays(date, -1)), nowMs),
    programs,
    uiText,
  );
  return {
    ...today,
    yesterdayTrackedTime: yesterday.totalTrackedTime,
    dayDeltaTrackedTime: today.totalTrackedTime - yesterday.totalTrackedTime,
  };
}
