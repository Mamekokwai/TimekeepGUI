import {
  addTimekeepProgram,
  addTimekeepPrograms,
  getTimekeepStatus,
  getTimekeepConfig,
  listTimekeepActiveSessions,
  listTimekeepHistory,
  listTimekeepPrograms,
  scanTimekeepPrograms,
  refreshTimekeep,
  resetTimekeepStats,
  removeTimekeepProgram,
  updateTimekeepProgram,
  updateTimekeepConfig,
  type TimekeepProgram,
  type TimekeepProgramCandidate,
  type TimekeepServiceStatus,
  type TimekeepServiceConfig,
} from "../../../platform/timekeep/timekeepGateway.ts";
import { pickCustomAppIcon } from "../../../platform/persistence/appIconGateway.ts";
import {
  getAppIcon,
  loadAppIconsForExecutables,
  setAppIconRuntimeCacheEntry,
} from "../../../platform/persistence/appIconRuntimeCache.ts";

export { getTimekeepErrorCode } from "../../../platform/timekeep/timekeepGateway.ts";

export type { TimekeepProgram, TimekeepProgramCandidate, TimekeepServiceStatus };
export type { TimekeepActiveSession, TimekeepHistoryEntry } from "../../../platform/timekeep/timekeepGateway.ts";
export type { TimekeepIntegrationConfig, TimekeepServiceConfig } from "../../../platform/timekeep/timekeepGateway.ts";
export { getAppIcon, loadAppIconsForExecutables, pickCustomAppIcon, setAppIconRuntimeCacheEntry };

export function loadTimekeepPrograms(): Promise<TimekeepProgram[]> {
  return listTimekeepPrograms();
}

export function loadTimekeepProgramCandidates() {
  return scanTimekeepPrograms();
}

export function loadTimekeepStatus(): Promise<TimekeepServiceStatus> {
  return getTimekeepStatus();
}

export function loadTimekeepServiceConfig() {
  return getTimekeepConfig();
}

export function saveTimekeepServiceConfig(config: TimekeepServiceConfig) {
  return updateTimekeepConfig(config);
}

export function loadTimekeepActiveSessions() {
  return listTimekeepActiveSessions();
}

export function loadTimekeepHistory(options?: { name?: string; date?: string; limit?: number }) {
  return listTimekeepHistory(options);
}

export function addTrackedTimekeepProgram(name: string, category: string, project: string) {
  return addTimekeepProgram(name, category, project);
}

export function addTrackedTimekeepPrograms(names: string[], category: string, project: string) {
  return addTimekeepPrograms(names, category, project);
}

export function removeTrackedTimekeepProgram(name: string) {
  return removeTimekeepProgram(name);
}

export function updateTrackedTimekeepProgram(name: string, category: string, project: string) {
  return updateTimekeepProgram(name, category, project);
}

export function refreshTimekeepService() {
  return refreshTimekeep();
}

export function resetTimekeepServiceStats(name?: string) {
  return resetTimekeepStats(name);
}
