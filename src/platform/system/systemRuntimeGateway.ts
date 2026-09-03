import { invoke } from "@tauri-apps/api/core";

export interface SystemRuntimeSnapshot {
  boot_time_ms: number;
  uptime_seconds: number;
}

export function getSystemRuntimeSnapshot(): Promise<SystemRuntimeSnapshot> {
  return invoke<SystemRuntimeSnapshot>("cmd_get_system_runtime_snapshot");
}
