import { useCallback, useEffect, useMemo, useState } from "react";
import type { ToolAlert } from "../../../shared/types/tools.ts";
import { ToolsRuntimeService } from "../services/toolsRuntimeService.ts";

function mergeAlerts(current: ToolAlert[], incoming: ToolAlert[]) {
  const byId = new Map(current.map((alert) => [alert.id, alert]));
  for (const alert of incoming) {
    byId.set(alert.id, alert);
  }

  return Array.from(byId.values()).sort((a, b) => a.occurredAt - b.occurredAt);
}

function isSupportedAlert(alert: ToolAlert): boolean {
  return alert.kind === "reminder" || alert.kind === "activity_reminder";
}

export function useToolAlerts() {
  const [alerts, setAlerts] = useState<ToolAlert[]>([]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void ToolsRuntimeService.getToolAlerts()
      .then((nextAlerts) => {
        if (!disposed) {
          setAlerts((current) => mergeAlerts(current, nextAlerts.filter(isSupportedAlert)));
        }
      })
      .catch((error) => {
        console.warn("load tool alerts failed", error);
      });

    void ToolsRuntimeService.onToolAlert((alert) => {
      if (!disposed) {
        if (isSupportedAlert(alert)) {
          setAlerts((current) => mergeAlerts(current, [alert]));
        }
      }
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }

        unlisten = dispose;
      })
      .catch((error) => {
        console.warn("listen tool alert failed", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const activeAlert = alerts[0] ?? null;

  const dismissActiveAlert = useCallback(() => {
    if (!activeAlert) return;

    const alertId = activeAlert.id;
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
    void ToolsRuntimeService.dismissToolAlert(alertId).catch((error) => {
      console.warn("dismiss tool alert failed", error);
    });
  }, [activeAlert]);

  return useMemo(() => ({
    activeAlert,
    dismissActiveAlert,
    pendingCount: alerts.length,
  }), [activeAlert, alerts.length, dismissActiveAlert]);
}
