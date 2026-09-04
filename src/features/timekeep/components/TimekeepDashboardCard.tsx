import { Activity, Server } from "lucide-react";
import { useLocaleText } from "../../../shared/i18n/index.ts";
import QuietBadge from "../../../shared/components/QuietBadge.tsx";
import { useTimekeepDashboardState } from "../hooks/useTimekeepDashboardState.ts";

function formatLifetime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function TimekeepDashboardCard({ refreshKey, compact = false }: { refreshKey: number; compact?: boolean }) {
  const UI_TEXT = useLocaleText();
  const state = useTimekeepDashboardState(refreshKey);
  const totalRuntime = state.programs.reduce((total, program) => total + (program.runtime_seconds ?? program.lifetime_seconds), 0);
  const totalUsage = state.programs.reduce((total, program) => total + (program.usage_seconds ?? 0), 0);

  if (compact) {
    return (
      <section className="w-full max-w-[420px] shrink-0" aria-label={UI_TEXT.timekeep.title}>
        {state.loading ? (
          <p className="text-xs text-[var(--qp-text-tertiary)]">{UI_TEXT.common.loading}</p>
        ) : state.error ? (
          <div className="flex items-center justify-end gap-2 text-xs text-[var(--qp-text-tertiary)]">
            <Server size={14} />
            <span>{UI_TEXT.timekeep.serviceOffline}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--qp-text-secondary)]">
              <Activity size={14} className="text-[var(--qp-accent-default)]" />
              {UI_TEXT.timekeep.title}
            </span>
            <QuietBadge tone="subtle">{state.status?.version ?? "-"}</QuietBadge>
            <span className="text-[var(--qp-text-tertiary)]">
              {UI_TEXT.timekeep.programs}: <strong className="font-semibold tabular-nums text-[var(--qp-text-primary)]">{state.programs.length}</strong>
            </span>
            <span className="text-[var(--qp-text-tertiary)]">
              {UI_TEXT.timekeep.activeSessions}: <strong className="font-semibold tabular-nums text-[var(--qp-text-primary)]">{state.activeSessions.length}</strong>
            </span>
            <span className="text-[var(--qp-text-tertiary)]">
              {UI_TEXT.timekeep.runtime}: <strong className="font-semibold tabular-nums text-[var(--qp-accent-default)]">{formatLifetime(totalRuntime)}</strong>
            </span>
            <span className="text-[var(--qp-text-tertiary)]">
              {UI_TEXT.timekeep.userUsage}: <strong className="font-semibold tabular-nums text-[var(--qp-success)]">{formatLifetime(totalUsage)}</strong>
            </span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={compact ? "w-full max-w-[360px] shrink-0" : "qp-panel shrink-0 p-4"} aria-label={UI_TEXT.timekeep.title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-[var(--qp-accent-default)]" />
          <h3 className="text-sm font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.title}</h3>
        </div>
        {state.status ? <QuietBadge tone="subtle">{state.status.version}</QuietBadge> : null}
      </div>
      {state.loading ? (
        <p className="text-xs text-[var(--qp-text-tertiary)]">{UI_TEXT.common.loading}</p>
      ) : state.error ? (
        <div className="flex items-center gap-2 text-xs text-[var(--qp-text-tertiary)]">
          <Server size={14} />
          <span>{UI_TEXT.timekeep.serviceOffline}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-[8px] border border-[var(--qp-border-subtle)] px-3 py-2">
            <div className="text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.programs}</div>
            <div className="mt-1 text-base font-semibold tabular-nums text-[var(--qp-text-primary)]">{state.programs.length}</div>
          </div>
          <div className="rounded-[8px] border border-[var(--qp-border-subtle)] px-3 py-2">
            <div className="text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.activeSessions}</div>
            <div className="mt-1 text-base font-semibold tabular-nums text-[var(--qp-text-primary)]">{state.activeSessions.length}</div>
          </div>
          <div className="rounded-[8px] border border-[var(--qp-border-subtle)] px-3 py-2">
            <div className="text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.runtime}</div>
            <div className="mt-1 text-base font-semibold tabular-nums text-[var(--qp-accent-default)]">
              {formatLifetime(totalRuntime)}
            </div>
          </div>
          <div className="rounded-[8px] border border-[var(--qp-border-subtle)] px-3 py-2">
            <div className="text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.userUsage}</div>
            <div className="mt-1 text-base font-semibold tabular-nums text-[var(--qp-success)]">
              {formatLifetime(totalUsage)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
