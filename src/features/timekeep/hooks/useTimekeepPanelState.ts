import { useCallback, useEffect, useState } from "react";
import {
  addTrackedTimekeepProgram,
  loadTimekeepPrograms,
  loadTimekeepActiveSessions,
  loadTimekeepHistory,
  loadTimekeepServiceConfig,
  loadTimekeepStatus,
  refreshTimekeepService,
  resetTimekeepServiceStats,
  removeTrackedTimekeepProgram,
  updateTrackedTimekeepProgram,
  saveTimekeepServiceConfig,
  type TimekeepProgram,
  type TimekeepActiveSession,
  type TimekeepHistoryEntry,
  type TimekeepServiceStatus,
  type TimekeepServiceConfig,
  getTimekeepErrorCode,
} from "../services/timekeepRuntimeService.ts";

interface UseTimekeepPanelStateOptions {
  onError?: (message: string) => void;
  loadFailedMessage: string;
  addFailedMessage: string;
  operationFailedMessage: string;
  serviceUnavailableMessage: string;
  requestTimeoutMessage: string;
  partialSuccessMessage: string;
}

export function useTimekeepPanelState({
  onError,
  loadFailedMessage,
  addFailedMessage,
  operationFailedMessage,
  serviceUnavailableMessage,
  requestTimeoutMessage,
  partialSuccessMessage,
}: UseTimekeepPanelStateOptions) {
  const [programs, setPrograms] = useState<TimekeepProgram[]>([]);
  const [status, setStatus] = useState<TimekeepServiceStatus | null>(null);
  const [activeSessions, setActiveSessions] = useState<TimekeepActiveSession[]>([]);
  const [history, setHistory] = useState<TimekeepHistoryEntry[]>([]);
  const [config, setConfig] = useState<TimekeepServiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const reportError = useCallback((error: unknown, fallback: string) => {
    const code = getTimekeepErrorCode(error);
    onError?.(code === "TIMEOUT"
      ? requestTimeoutMessage
      : code === "SERVICE_UNAVAILABLE"
        ? serviceUnavailableMessage
        : fallback);
  }, [onError, requestTimeoutMessage, serviceUnavailableMessage]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [nextStatus, nextPrograms, nextActiveSessions, nextHistory, nextConfig] = await Promise.all([
        loadTimekeepStatus(),
        loadTimekeepPrograms(),
        loadTimekeepActiveSessions(),
        loadTimekeepHistory(),
        loadTimekeepServiceConfig(),
      ]);
      setStatus(nextStatus);
      setPrograms(nextPrograms);
      setActiveSessions(nextActiveSessions);
      setHistory(nextHistory);
      setConfig(nextConfig);
      return true;
    } catch (error) {
      console.warn("Failed to load Timekeep panel", error);
      setLoadError(true);
      reportError(error, loadFailedMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadFailedMessage, reportError]);

  const loadHistory = useCallback(async (options: { name?: string; date?: string; limit?: number }) => {
    setHistoryLoading(true);
    try {
      setHistory(await loadTimekeepHistory(options));
      return true;
    } catch (error) {
      console.warn("Failed to load Timekeep history", error);
      reportError(error, loadFailedMessage);
      return false;
    } finally {
      setHistoryLoading(false);
    }
  }, [loadFailedMessage, reportError]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (name: string, category: string, project: string) => {
    setBusy(true);
    try {
      await addTrackedTimekeepProgram(name, category, project);
      if (!await load()) onError?.(partialSuccessMessage);
      return true;
    } catch (error) {
      console.warn("Failed to add Timekeep program", error);
      reportError(error, addFailedMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [addFailedMessage, load, onError, partialSuccessMessage, reportError]);

  const remove = useCallback(async (name: string) => {
    setBusy(true);
    try {
      await removeTrackedTimekeepProgram(name);
      if (!await load()) onError?.(partialSuccessMessage);
      return true;
    } catch (error) {
      console.warn("Failed to remove Timekeep program", error);
      reportError(error, operationFailedMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, onError, operationFailedMessage, partialSuccessMessage, reportError]);

  const update = useCallback(async (name: string, category: string, project: string) => {
    setBusy(true);
    try {
      await updateTrackedTimekeepProgram(name, category, project);
      if (!await load()) onError?.(partialSuccessMessage);
      return true;
    } catch (error) {
      console.warn("Failed to update Timekeep program", error);
      reportError(error, operationFailedMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, onError, operationFailedMessage, partialSuccessMessage, reportError]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      await refreshTimekeepService();
      if (!await load()) onError?.(partialSuccessMessage);
    } catch (error) {
      console.warn("Failed to refresh Timekeep", error);
      reportError(error, operationFailedMessage);
    } finally {
      setBusy(false);
    }
  }, [load, onError, operationFailedMessage, partialSuccessMessage, reportError]);

  const saveConfig = useCallback(async (nextConfig: TimekeepServiceConfig) => {
    setBusy(true);
    try {
      const savedConfig = await saveTimekeepServiceConfig(nextConfig);
      setConfig(savedConfig);
      if (!await load()) onError?.(partialSuccessMessage);
      return true;
    } catch (error) {
      console.warn("Failed to save Timekeep configuration", error);
      reportError(error, operationFailedMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, onError, operationFailedMessage, partialSuccessMessage, reportError]);

  const resetStats = useCallback(async (name?: string) => {
    setBusy(true);
    try {
      await resetTimekeepServiceStats(name);
      if (!await load()) onError?.(partialSuccessMessage);
      return true;
    } catch (error) {
      console.warn("Failed to reset Timekeep statistics", error);
      reportError(error, operationFailedMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, onError, operationFailedMessage, partialSuccessMessage, reportError]);

  return {
    programs,
    status,
    activeSessions,
    history,
    config,
    loading,
    busy,
    loadError,
    historyLoading,
    retry: load,
    loadHistory,
    add,
    remove,
    update,
    refresh,
    saveConfig,
    resetStats,
  };
}
