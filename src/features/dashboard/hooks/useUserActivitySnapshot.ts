import { useEffect, useState } from "react";
import {
  loadUserActivitySnapshot,
  type UserActivitySnapshot,
} from "../services/userActivityService.ts";

function getTodayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function useUserActivitySnapshot(refreshKey: number) {
  const [snapshot, setSnapshot] = useState<UserActivitySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const bounds = getTodayBounds(new Date());
      try {
        const next = await loadUserActivitySnapshot(bounds.startMs, bounds.endMs);
        if (!cancelled) setSnapshot(next);
      } catch (error) {
        if (!cancelled) console.warn("Failed to load user activity snapshot", error);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  return snapshot;
}
