import assert from "node:assert/strict";
import { test } from "node:test";
import { loadLocaleText } from "../src/shared/i18n/runtime.ts";
import {
  buildTimekeepDashboardViewModel,
  getComputerRuntimeTodayMs,
} from "../src/features/timekeep/services/timekeepDashboardViewModel.ts";

const date = new Date(2026, 8, 3, 12, 0, 0, 0);
const nowMs = date.getTime();
const localIso = (hour: number, minute = 0) => new Date(2026, 8, 3, hour, minute).toISOString();
const uiText = await loadLocaleText("zh-CN");

test("computer runtime today starts at the later of midnight and boot time", () => {
  assert.equal(
    getComputerRuntimeTodayMs(new Date(2026, 8, 3, 6).getTime(), nowMs),
    6 * 60 * 60_000,
  );
  assert.equal(
    getComputerRuntimeTodayMs(new Date(2026, 8, 2, 23).getTime(), nowMs),
    12 * 60 * 60_000,
  );
});

test("user active time merges overlapping Timekeep sessions", () => {
  const view = buildTimekeepDashboardViewModel({
    date,
    nowMs,
    uiText,
    programs: [
      { id: 1, name: "editor.exe", lifetime_seconds: 0, category: "development" },
      { id: 2, name: "browser.exe", lifetime_seconds: 0, category: "browser" },
    ],
    history: [
      { id: 1, program_name: "editor.exe", start_time: localIso(8), end_time: localIso(10), duration_seconds: 7200 },
      { id: 2, program_name: "browser.exe", start_time: localIso(9), end_time: localIso(11, 30), duration_seconds: 9000 },
    ],
    yesterdayHistory: [],
    activeSessions: [],
  });

  assert.equal(view.userActiveTime, 3.5 * 60 * 60_000);
  assert.deepEqual(
    view.hourlyActivity.slice(8, 12).map((point) => point.minutes),
    [60, 60, 60, 30],
  );
  assert.equal(view.totalTrackedTime, 4.5 * 60 * 60_000);
});
