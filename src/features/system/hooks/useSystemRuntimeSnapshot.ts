import { useEffect, useState } from "react";
import {
  getSystemRuntimeSnapshot,
  type SystemRuntimeSnapshot,
} from "../services/systemRuntimeService.ts";

export function useSystemRuntimeSnapshot() {
  const [snapshot, setSnapshot] = useState<SystemRuntimeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSystemRuntimeSnapshot()
      .then((nextSnapshot) => {
        if (!cancelled) setSnapshot(nextSnapshot);
      })
      .catch((error) => {
        if (!cancelled) console.warn("Failed to load system runtime snapshot", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}
