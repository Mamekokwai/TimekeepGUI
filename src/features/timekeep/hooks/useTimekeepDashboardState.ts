import { useEffect, useState } from "react";
import {
  loadTimekeepActiveSessions,
  loadTimekeepPrograms,
  loadTimekeepStatus,
  type TimekeepActiveSession,
  type TimekeepProgram,
  type TimekeepServiceStatus,
} from "../services/timekeepRuntimeService.ts";

export function useTimekeepDashboardState(refreshKey: number) {
  const [status, setStatus] = useState<TimekeepServiceStatus | null>(null);
  const [programs, setPrograms] = useState<TimekeepProgram[]>([]);
  const [activeSessions, setActiveSessions] = useState<TimekeepActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void Promise.all([
      loadTimekeepStatus(),
      loadTimekeepPrograms(),
      loadTimekeepActiveSessions(),
    ]).then(([nextStatus, nextPrograms, nextActiveSessions]) => {
      if (cancelled) return;
      setStatus(nextStatus);
      setPrograms(nextPrograms);
      setActiveSessions(nextActiveSessions);
    }).catch((reason) => {
      if (cancelled) return;
      console.warn("Failed to load Timekeep dashboard state", reason);
      setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { status, programs, activeSessions, loading, error };
}
