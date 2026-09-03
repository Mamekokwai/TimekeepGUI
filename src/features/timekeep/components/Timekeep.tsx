import { Activity, Eraser, Pencil, Plus, RefreshCw, Save, Server, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useLocaleText } from "../../../shared/i18n/index.ts";
import QuietBadge from "../../../shared/components/QuietBadge.tsx";
import QuietButton from "../../../shared/components/QuietButton.tsx";
import QuietDialog from "../../../shared/components/QuietDialog.tsx";
import QuietPageHeader from "../../../shared/components/QuietPageHeader.tsx";
import { useQuietDialogs } from "../../../shared/hooks/useQuietDialogs.tsx";
import type { QuietToastTone } from "../../../shared/types/toast.ts";
import { useTimekeepPanelState } from "../hooks/useTimekeepPanelState.ts";
import type { TimekeepIntegrationConfig, TimekeepServiceConfig } from "../services/timekeepRuntimeService.ts";

interface Props {
  onToast?: (message: string, tone?: QuietToastTone) => void;
}

function formatLifetime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Timekeep({ onToast }: Props) {
  const UI_TEXT = useLocaleText();
  const locale = useLocale();
  const { confirm, dialogs } = useQuietDialogs();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");
  const [historyProgram, setHistoryProgram] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyLimit, setHistoryLimit] = useState("5");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingProgramName, setEditingProgramName] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<TimekeepServiceConfig | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notifyError = useCallback((message: string) => {
    onToast?.(message, "error");
  }, [onToast]);
  const state = useTimekeepPanelState({
    onError: notifyError,
    loadFailedMessage: UI_TEXT.timekeep.loadFailed,
    addFailedMessage: UI_TEXT.timekeep.addFailed,
    operationFailedMessage: UI_TEXT.timekeep.operationFailed,
    serviceUnavailableMessage: UI_TEXT.timekeep.serviceOffline,
    requestTimeoutMessage: UI_TEXT.timekeep.requestTimeout,
    partialSuccessMessage: UI_TEXT.timekeep.partialSuccess,
  });

  useEffect(() => {
    if (state.config) setConfigDraft(state.config);
  }, [state.config]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateIntegration = (integration: "wakatime" | "wakapi", patch: Partial<TimekeepIntegrationConfig>) => {
    setConfigDraft((current) => current ? {
      ...current,
      [integration]: { ...current[integration], ...patch },
    } : current);
  };

  const handleSaveConfig = async () => {
    if (!configDraft) return;
    const saved = await state.saveConfig(configDraft);
    if (saved) onToast?.(UI_TEXT.timekeep.settingsSaved, "success");
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const saved = editingProgramName
      ? await state.update(editingProgramName, category.trim(), project.trim())
      : await state.add(trimmedName, category.trim(), project.trim());
    if (saved) {
      setName("");
      setCategory("");
      setProject("");
      setEditingProgramName(null);
      setAddDialogOpen(false);
    }
  };

  const openAddDialog = () => {
    setEditingProgramName(null);
    setName("");
    setCategory("");
    setProject("");
    setAddDialogOpen(true);
  };

  const openEditDialog = (program: { name: string; category?: string; project?: string }) => {
    setEditingProgramName(program.name);
    setName(program.name);
    setCategory(program.category ?? "");
    setProject(program.project ?? "");
    setAddDialogOpen(true);
  };

  const handleRemove = async (programName: string) => {
    const confirmed = await confirm({
      title: UI_TEXT.timekeep.remove,
      description: UI_TEXT.timekeep.removeConfirm,
      danger: true,
      confirmLabel: UI_TEXT.timekeep.remove,
    });
    if (confirmed) {
      await state.remove(programName);
    }
  };

  const handleResetAllStats = async () => {
    const confirmed = await confirm({
      title: UI_TEXT.timekeep.resetAllStats,
      description: UI_TEXT.timekeep.resetConfirm,
      danger: true,
      confirmLabel: UI_TEXT.timekeep.resetStats,
    });
    if (confirmed) await state.resetStats();
  };

  const handleResetProgramStats = async (programName: string) => {
    const confirmed = await confirm({
      title: UI_TEXT.timekeep.resetProgram,
      description: UI_TEXT.timekeep.resetProgramConfirm,
      danger: true,
      confirmLabel: UI_TEXT.timekeep.resetStats,
    });
    if (confirmed) await state.resetStats(programName);
  };

  const handleHistorySearch = async () => {
    const parsedLimit = Number.parseInt(historyLimit, 10);
    await state.loadHistory({
      name: historyProgram.trim() || undefined,
      date: historyDate || undefined,
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
    });
  };

  return (
    <>
      {dialogs}
      <QuietPageHeader
        icon={<Activity size={18} />}
        title={UI_TEXT.timekeep.title}
        subtitle={UI_TEXT.timekeep.subtitle}
        rightSlot={(
          <div className="flex items-center gap-2">
            <QuietButton size="compact" onClick={() => { void state.refresh(); }} busy={state.busy}>
              <RefreshCw size={14} />
              {UI_TEXT.timekeep.refresh}
            </QuietButton>
            <QuietButton size="compact" tone="danger" onClick={() => { void handleResetAllStats(); }} disabled={state.busy}>
              {UI_TEXT.timekeep.resetStats}
            </QuietButton>
            <QuietButton size="compact" tone="primary" onClick={openAddDialog}>
              <Plus size={14} />
              {UI_TEXT.timekeep.add}
            </QuietButton>
          </div>
        )}
      />

      <div className="qp-scroll-region flex-1 min-h-0 space-y-4">
        {state.loading ? (
          <div className="qp-panel flex items-center justify-center p-8 text-sm text-[var(--qp-text-tertiary)]">
            {UI_TEXT.common.loading}
          </div>
        ) : state.loadError ? (
          <div className="qp-panel flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Server size={24} className="text-[var(--qp-text-tertiary)]" />
            <p className="text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.timekeep.serviceOffline}</p>
            <QuietButton onClick={() => { void state.retry(); }}>{UI_TEXT.timekeep.retry}</QuietButton>
          </div>
        ) : (
          <>
            <section className="qp-panel flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.programs}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--qp-text-primary)]">{state.programs.length}</p>
              </div>
              <div className="text-right text-sm text-[var(--qp-text-secondary)]">
                <div>{UI_TEXT.timekeep.version}</div>
                <div className="mt-1"><QuietBadge tone="subtle">{state.status?.version ?? "-"}</QuietBadge></div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="qp-panel p-5">
                <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.activeSessions}</h2>
                {state.activeSessions.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.noActiveSessions}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {state.activeSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-[var(--qp-text-primary)]">{session.program_name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--qp-text-tertiary)]">
                          {formatElapsed(Math.max(0, Math.floor((nowMs - new Date(session.start_time).getTime()) / 1000)))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="qp-panel p-5">
                <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.recentHistory}</h2>
                <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); void handleHistorySearch(); }}>
                  <input value={historyProgram} onChange={(event) => setHistoryProgram(event.target.value)} className="qp-input h-9 min-w-0" aria-label={UI_TEXT.timekeep.programName} />
                  <label className="sr-only" htmlFor="timekeep-history-date">{UI_TEXT.timekeep.historyDate}</label>
                  <input id="timekeep-history-date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="qp-input h-9" aria-label={UI_TEXT.timekeep.historyDate} />
                  <label className="sr-only" htmlFor="timekeep-history-limit">{UI_TEXT.timekeep.historyLimit}</label>
                  <input id="timekeep-history-limit" type="number" min="1" step="1" value={historyLimit} onChange={(event) => setHistoryLimit(event.target.value)} className="qp-input h-9 w-20" aria-label={UI_TEXT.timekeep.historyLimit} />
                  <QuietButton size="compact" type="submit" disabled={state.busy} busy={state.historyLoading}>{UI_TEXT.timekeep.historySearch}</QuietButton>
                </form>
                {state.history.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.noHistory}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {state.history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate text-[var(--qp-text-primary)]">{entry.program_name}</div>
                          <div className="mt-1 text-xs text-[var(--qp-text-tertiary)]">
                            {formatTimestamp(entry.start_time, locale)} → {formatTimestamp(entry.end_time, locale)}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--qp-text-tertiary)]">{formatLifetime(entry.duration_seconds)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="qp-panel min-h-0 overflow-hidden p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.programs}</h2>
                <span className="text-xs text-[var(--qp-text-tertiary)]">{state.status?.running ? "●" : "○"}</span>
              </div>
              {state.programs.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.empty}</p>
              ) : (
                <div className="divide-y divide-[var(--qp-border-subtle)]">
                  {state.programs.map((program) => (
                    <div key={program.id || program.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--qp-text-primary)]">{program.name}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--qp-text-tertiary)]">
                          {program.category ? <span>{program.category}</span> : null}
                          {program.project ? <span>{program.project}</span> : null}
                          <span>{UI_TEXT.timekeep.lifetime}: {formatLifetime(program.lifetime_seconds)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <QuietButton size="compact" onClick={() => openEditDialog(program)} disabled={state.busy} aria-label={`${UI_TEXT.timekeep.edit} ${program.name}`}>
                          <Pencil size={14} />
                          {UI_TEXT.timekeep.edit}
                        </QuietButton>
                        <QuietButton size="compact" tone="danger" onClick={() => { void handleResetProgramStats(program.name); }} disabled={state.busy} aria-label={`${UI_TEXT.timekeep.resetStats} ${program.name}`}>
                          <Eraser size={14} />
                          {UI_TEXT.timekeep.resetStats}
                        </QuietButton>
                        <QuietButton size="compact" tone="danger" onClick={() => { void handleRemove(program.name); }} disabled={state.busy} aria-label={`${UI_TEXT.timekeep.remove} ${program.name}`}>
                          <Trash2 size={14} />
                          {UI_TEXT.timekeep.remove}
                        </QuietButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {configDraft ? (
              <section className="qp-panel p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.serviceSettings}</h2>
                  <QuietButton size="compact" tone="primary" onClick={() => { void handleSaveConfig(); }} busy={state.busy}>
                    <Save size={14} />
                    {UI_TEXT.timekeep.saveSettings}
                  </QuietButton>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  {(["wakatime", "wakapi"] as const).map((integration) => {
                    const value = configDraft[integration];
                    return (
                      <div key={integration} className="space-y-3 rounded-[10px] border border-[var(--qp-border-subtle)] p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-[var(--qp-text-primary)]">{UI_TEXT.timekeep[integration]}</h3>
                          <label className="flex items-center gap-2 text-sm text-[var(--qp-text-secondary)]">
                            <input type="checkbox" checked={value.enabled} onChange={(event) => updateIntegration(integration, { enabled: event.target.checked })} />
                            {UI_TEXT.timekeep.enabled}
                          </label>
                        </div>
                        <label className="block text-sm text-[var(--qp-text-secondary)]">
                          <span className="mb-1 block">{UI_TEXT.timekeep.apiKey}</span>
                          <input type="password" value={value.api_key ?? ""} onChange={(event) => updateIntegration(integration, { api_key: event.target.value })} className="qp-input h-9 w-full" />
                        </label>
                        {integration === "wakatime" ? (
                          <label className="block text-sm text-[var(--qp-text-secondary)]">
                            <span className="mb-1 block">{UI_TEXT.timekeep.cliPath}</span>
                            <input value={value.cli_path ?? ""} onChange={(event) => updateIntegration(integration, { cli_path: event.target.value })} className="qp-input h-9 w-full" />
                          </label>
                        ) : (
                          <label className="block text-sm text-[var(--qp-text-secondary)]">
                            <span className="mb-1 block">{UI_TEXT.timekeep.server}</span>
                            <input value={value.server ?? ""} onChange={(event) => updateIntegration(integration, { server: event.target.value })} className="qp-input h-9 w-full" />
                          </label>
                        )}
                        <label className="block text-sm text-[var(--qp-text-secondary)]">
                          <span className="mb-1 block">{UI_TEXT.timekeep.globalProject}</span>
                          <input value={value.global_project ?? ""} onChange={(event) => updateIntegration(integration, { global_project: event.target.value })} className="qp-input h-9 w-full" />
                        </label>
                      </div>
                    );
                  })}
                  <div className="space-y-3 rounded-[10px] border border-[var(--qp-border-subtle)] p-4 lg:col-span-2">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm text-[var(--qp-text-secondary)]">
                        <span className="mb-1 block">{UI_TEXT.timekeep.pollInterval}</span>
                        <input value={configDraft.poll_interval ?? ""} onChange={(event) => setConfigDraft({ ...configDraft, poll_interval: event.target.value })} className="qp-input h-9 w-full" />
                      </label>
                      <label className="block text-sm text-[var(--qp-text-secondary)]">
                        <span className="mb-1 block">{UI_TEXT.timekeep.pollGrace}</span>
                        <input type="number" min="0" step="1" value={configDraft.poll_grace ?? 0} onChange={(event) => setConfigDraft({ ...configDraft, poll_grace: Number(event.target.value) })} className="qp-input h-9 w-full" />
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <QuietDialog
        open={addDialogOpen}
        title={editingProgramName ? UI_TEXT.timekeep.edit : UI_TEXT.timekeep.add}
        onClose={() => { setAddDialogOpen(false); setEditingProgramName(null); }}
        actions={(
          <>
            <QuietButton onClick={() => { setAddDialogOpen(false); setEditingProgramName(null); }}>{UI_TEXT.common.cancel}</QuietButton>
            <QuietButton tone="primary" onClick={() => { void handleAdd(); }} busy={state.busy} disabled={!name.trim()}>{editingProgramName ? UI_TEXT.common.save : UI_TEXT.timekeep.add}</QuietButton>
          </>
        )}
      >
        <div className="space-y-3">
          <label className="block text-sm text-[var(--qp-text-secondary)]">
            <span className="mb-1 block">{UI_TEXT.timekeep.programName}</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="qp-input h-9 w-full" />
          </label>
          <label className="block text-sm text-[var(--qp-text-secondary)]">
            <span className="mb-1 block">{UI_TEXT.timekeep.category}</span>
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="qp-input h-9 w-full" />
          </label>
          <label className="block text-sm text-[var(--qp-text-secondary)]">
            <span className="mb-1 block">{UI_TEXT.timekeep.project}</span>
            <input value={project} onChange={(event) => setProject(event.target.value)} className="qp-input h-9 w-full" />
          </label>
        </div>
      </QuietDialog>
    </>
  );
}
