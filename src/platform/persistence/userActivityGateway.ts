import { invokeWithCommandError } from "./commandError.ts";

export interface UserActivitySnapshot {
  activeMs: number;
  hourlyActiveMs: number[];
  isActive: boolean;
  idleSinceMs: number | null;
}

export function loadUserActivitySnapshot(startMs: number, endMs: number) {
  return invokeWithCommandError<UserActivitySnapshot>("cmd_get_user_activity_snapshot", {
    startMs,
    endMs,
  });
}
