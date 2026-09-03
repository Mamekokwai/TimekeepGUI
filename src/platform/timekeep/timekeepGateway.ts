import { invoke } from "@tauri-apps/api/core";

export type TimekeepAction =
  | "service_status"
  | "get_config"
  | "update_config"
  | "list_programs"
  | "scan_programs"
  | "get_program"
  | "active_sessions"
  | "history"
  | "add_program"
  | "add_programs"
  | "update_program"
  | "remove_program"
  | "reset_stats"
  | "refresh";

export interface TimekeepRequest {
  request_id: string;
  action: TimekeepAction;
  name?: string;
  pid?: number;
  category?: string;
  project?: string;
  date?: string;
  start?: string;
  end?: string;
  limit?: number;
  all?: boolean;
  config?: TimekeepServiceConfig;
  programs?: string[];
}

export interface TimekeepServiceStatus {
  running: boolean;
  version: string;
}

export interface TimekeepIntegrationConfig {
  enabled: boolean;
  api_key?: string;
  cli_path?: string;
  server?: string;
  global_project?: string;
}

export interface TimekeepServiceConfig {
  wakatime: TimekeepIntegrationConfig;
  wakapi: TimekeepIntegrationConfig;
  poll_interval?: string;
  poll_grace?: number;
}

export interface TimekeepProgram {
  id: number;
  name: string;
  lifetime_seconds: number;
  category?: string;
  project?: string;
}

export interface TimekeepProgramCandidate {
  name: string;
  running_instances: number;
  tracked: boolean;
  lifetime_seconds: number;
  category?: string | null;
  project?: string | null;
}

export interface TimekeepActiveSession {
  id: number;
  program_name: string;
  start_time: string;
}

export interface TimekeepHistoryEntry {
  id: number;
  program_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

interface TimekeepResponse<T> {
  request_id?: unknown;
  ok?: unknown;
  data?: T;
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class TimekeepGatewayError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TimekeepGatewayError";
    this.code = code;
  }
}

export function getTimekeepErrorCode(error: unknown): string | null {
  return error instanceof TimekeepGatewayError ? error.code : null;
}

let requestSequence = 0;

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  requestSequence += 1;
  return `timekeep-${Date.now()}-${requestSequence}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function transportError(error: unknown): TimekeepGatewayError {
  if (error instanceof TimekeepGatewayError) return error;

  const message = error instanceof Error
    ? error.message
    : isRecord(error) && typeof error.message === "string"
      ? error.message
      : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return new TimekeepGatewayError("TIMEOUT", "Timekeep service request timed out.");
  }
  if (normalized.includes("invalid response") || normalized.includes("empty response")) {
    return new TimekeepGatewayError("INVALID_RESPONSE", "Timekeep service returned an invalid response.");
  }
  return new TimekeepGatewayError("SERVICE_UNAVAILABLE", message || "Timekeep service is unavailable.");
}

export function parseTimekeepResponse<T>(value: unknown, requestId: string): T {
  if (!isRecord(value)) {
    throw new TimekeepGatewayError("INVALID_RESPONSE", "Timekeep returned an invalid response.");
  }

  const response = value as TimekeepResponse<T>;
  if (response.request_id !== undefined && response.request_id !== requestId) {
    throw new TimekeepGatewayError("REQUEST_MISMATCH", "Timekeep returned a response for another request.");
  }
  if (response.ok !== true) {
    const error = isRecord(response.error) ? response.error : {};
    const code = typeof error.code === "string" ? error.code : "REQUEST_FAILED";
    const message = typeof error.message === "string" ? error.message : "Timekeep rejected the request.";
    throw new TimekeepGatewayError(code, message);
  }
  return response.data as T;
}

export async function requestTimekeep<T>(
  request: Omit<TimekeepRequest, "request_id">,
): Promise<T> {
  const payload: TimekeepRequest = {
    ...request,
    request_id: createRequestId(),
  };
  let response: unknown;
  try {
    response = await invoke<unknown>("cmd_timekeep_request", { request: payload });
  } catch (error) {
    throw transportError(error);
  }
  return parseTimekeepResponse<T>(response, payload.request_id);
}

export function listTimekeepPrograms(): Promise<TimekeepProgram[]> {
  return requestTimekeep<TimekeepProgram[]>({ action: "list_programs" });
}

export function scanTimekeepPrograms(): Promise<TimekeepProgramCandidate[]> {
  return requestTimekeep<TimekeepProgramCandidate[]>({ action: "scan_programs" });
}

export function getTimekeepStatus(): Promise<TimekeepServiceStatus> {
  return requestTimekeep<TimekeepServiceStatus>({ action: "service_status" });
}

export function listTimekeepActiveSessions(): Promise<TimekeepActiveSession[]> {
  return requestTimekeep<TimekeepActiveSession[]>({ action: "active_sessions" });
}

export function getTimekeepConfig(): Promise<TimekeepServiceConfig> {
  return requestTimekeep<TimekeepServiceConfig>({ action: "get_config" });
}

export function updateTimekeepConfig(config: TimekeepServiceConfig): Promise<TimekeepServiceConfig> {
  return requestTimekeep<TimekeepServiceConfig>({ action: "update_config", config });
}

export function listTimekeepHistory(options: {
  name?: string;
  date?: string;
  limit?: number;
} = {}): Promise<TimekeepHistoryEntry[]> {
  return requestTimekeep<TimekeepHistoryEntry[]>({
    action: "history",
    name: options.name || undefined,
    date: options.date || undefined,
    limit: options.limit ?? 5,
  });
}

export function addTimekeepProgram(name: string, category?: string, project?: string) {
  return requestTimekeep<{ name: string }>({
    action: "add_program",
    name,
    category: category || undefined,
    project: project || undefined,
  });
}

export function addTimekeepPrograms(names: string[], category?: string, project?: string) {
  return requestTimekeep<{ names: string[] }>({
    action: "add_programs",
    programs: names,
    category: category || undefined,
    project: project || undefined,
  });
}

export function updateTimekeepProgram(name: string, category?: string, project?: string) {
  return requestTimekeep<{ name: string }>({
    action: "update_program",
    name,
    category: category || undefined,
    project: project || undefined,
  });
}

export function removeTimekeepProgram(name: string) {
  return requestTimekeep<{ removed: boolean }>({ action: "remove_program", name });
}

export function refreshTimekeep() {
  return requestTimekeep<{ refreshed: boolean }>({ action: "refresh" });
}

export function resetTimekeepStats(name?: string) {
  return requestTimekeep<{ reset: boolean }>({
    action: "reset_stats",
    name: name || undefined,
    all: !name,
  });
}
