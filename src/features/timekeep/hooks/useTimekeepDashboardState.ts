import { useEffect, useState } from "react";
import { addLocalDays, formatLocalDateKey } from "../../../shared/lib/localDate.ts";
import {
  loadTimekeepActiveSessions,
  loadTimekeepHistory,
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
  const [history, setHistory] = useState<Awaited<ReturnType<typeof loadTimekeepHistory>>>([]);
  const [yesterdayHistory, setYesterdayHistory] = useState<Awaited<ReturnType<typeof loadTimekeepHistory>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const today = new Date();
    const yesterday = addLocalDays(today, -1);
    void Promise.all([
      loadTimekeepStatus(),
      loadTimekeepPrograms(),
      loadTimekeepActiveSessions(),
      loadTimekeepHistory({ date: formatLocalDateKey(today), limit: 500 }),
      loadTimekeepHistory({ date: formatLocalDateKey(yesterday), limit: 500 }),
    ]).then(([nextStatus, nextPrograms, nextActiveSessions, nextHistory, nextYesterdayHistory]) => {
      if (cancelled) return;
      setStatus(nextStatus);
      setPrograms(nextPrograms);
      setActiveSessions(nextActiveSessions);
      setHistory(nextHistory);
      setYesterdayHistory(nextYesterdayHistory);
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

  useEffect(() => {
    let cancelled = false;
    const refreshActiveSessions = () => {
      void Promise.all([loadTimekeepPrograms(), loadTimekeepActiveSessions()]).then(([nextPrograms, nextActiveSessions]) => {
        if (cancelled) return;
        setPrograms(nextPrograms);
        setActiveSessions(nextActiveSessions);
      }).catch((reason) => {
        if (!cancelled) console.warn("Failed to refresh Timekeep active sessions", reason);
      });
    };
    const timer = window.setInterval(refreshActiveSessions, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { status, programs, activeSessions, history, yesterdayHistory, loading, error };
}
