import { Activity, ChevronDown, Eraser, Pencil, Plus, RefreshCw, Save, Search, Server, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useLocaleText } from "../../../shared/i18n/index.ts";
import QuietBadge from "../../../shared/components/QuietBadge.tsx";
import QuietButton from "../../../shared/components/QuietButton.tsx";
import QuietDialog from "../../../shared/components/QuietDialog.tsx";
import QuietIconAction from "../../../shared/components/QuietIconAction.tsx";
import QuietPageHeader from "../../../shared/components/QuietPageHeader.tsx";
import { useQuietDialogs } from "../../../shared/hooks/useQuietDialogs.tsx";
import { useRequestedAppIcons } from "../../../shared/hooks/useRequestedAppIcons.ts";
import type { QuietToastTone } from "../../../shared/types/toast.ts";
import { useTimekeepPanelState } from "../hooks/useTimekeepPanelState.ts";
import {
  loadTimekeepProgramCandidates,
  getAppIcon,
  loadAppIconsForExecutables,
  pickCustomAppIcon,
  setAppIconRuntimeCacheEntry,
  type TimekeepIntegrationConfig,
  type TimekeepProgramCandidate,
  type TimekeepServiceConfig,
} from "../services/timekeepRuntimeService.ts";

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

// These are Windows infrastructure processes, not useful entries in a human
// program picker. The user can still add any executable manually.
const SYSTEM_PROCESS_NAMES = new Set([
  "applicationframehost.exe",
  "audiodg.exe",
  "conhost.exe",
  "csrss.exe",
  "ctfmon.exe",
  "dwm.exe",
  "dllhost.exe",
  "explorer.exe",
  "fontdrvhost.exe",
  "lsass.exe",
  "msmpeng.exe",
  "registry",
  "runtimebroker.exe",
  "searchhost.exe",
  "services.exe",
  "sihost.exe",
  "smss.exe",
  "spoolsv.exe",
  "startmenuexperiencehost.exe",
  "svchost.exe",
  "shellexperiencehost.exe",
  "system",
  "taskhostw.exe",
  "textinputhost.exe",
  "wininit.exe",
  "winlogon.exe",
  "wudfhost.exe",
]);

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
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<TimekeepProgramCandidate[]>([]);
  const [scanSelection, setScanSelection] = useState<Set<string>>(new Set());
  const [scanFilter, setScanFilter] = useState("");
  const [scanCategory, setScanCategory] = useState("");
  const [scanProject, setScanProject] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState(false);
  const scanFilterRef = useRef<HTMLInputElement>(null);
  const programNameRef = useRef<HTMLInputElement>(null);
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
  const timekeepIcons = useRequestedAppIcons({
    baseIcons: {},
    exeNames: [
      ...state.programs.map((program) => program.name),
      ...state.activeSessions.map((session) => session.program_name),
      ...scanCandidates.map((candidate) => candidate.name),
    ],
    loadIcons: loadAppIconsForExecutables,
    enabled: !state.loading && !state.loadError,
    onError: (error) => console.warn("Failed to load Timekeep program icons", error),
  });

  const visibleScanCandidates = useMemo(() => {
    const filter = scanFilter.trim().toLowerCase();
    return scanCandidates.filter((candidate) => (
      !SYSTEM_PROCESS_NAMES.has(candidate.name.toLowerCase())
      && (!filter || candidate.name.toLowerCase().includes(filter))
    ));
  }, [scanCandidates, scanFilter]);
  const selectableScanNames = useMemo(
    () => visibleScanCandidates.filter((candidate) => !candidate.tracked).map((candidate) => candidate.name),
    [visibleScanCandidates],
  );
  const activeProgramNames = useMemo(
    () => new Set(state.activeSessions.map((session) => session.program_name.toLowerCase())),
    [state.activeSessions],
  );

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

  const openScanDialog = async () => {
    setScanDialogOpen(true);
    setScanLoading(true);
    setScanError(false);
    setScanFilter("");
    setScanCategory("");
    setScanProject("");
    try {
      const candidates = await loadTimekeepProgramCandidates();
      // A disconnected/older bridge may acknowledge the request without a
      // candidate list. Keep the picker usable instead of letting a malformed
      // response crash the whole Timekeep page during filtering.
      setScanCandidates(Array.isArray(candidates) ? candidates : []);
      // Keep the first scan opt-in: process discovery can include development
      // tools and background apps that the user did not intend to track.
      setScanSelection(new Set());
    } catch (error) {
      console.warn("Failed to scan programs", error);
      setScanError(true);
      onToast?.(UI_TEXT.timekeep.scanFailed, "error");
    } finally {
      setScanLoading(false);
    }
  };

  const toggleScanSelection = (name: string) => {
    setScanSelection((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const names = [...scanSelection];
    if (names.length === 0) return;
    const added = await state.addMany(names, scanCategory.trim(), scanProject.trim());
    if (added) {
      setScanDialogOpen(false);
      setScanSelection(new Set());
    }
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

  const handleCustomIcon = async (programName: string) => {
    try {
      const icon = await pickCustomAppIcon(programName);
      if (!icon) return;
      setAppIconRuntimeCacheEntry(programName, icon);
      onToast?.(UI_TEXT.timekeep.settingsSaved, "success");
    } catch (error) {
      console.warn("Failed to update application icon", error);
      onToast?.(UI_TEXT.timekeep.operationFailed, "error");
    }
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 md:gap-5">
      {dialogs}
      <QuietPageHeader
        icon={<Activity size={18} />}
        title={UI_TEXT.timekeep.title}
        subtitle={UI_TEXT.timekeep.subtitle}
          rightSlot={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <QuietButton size="compact" onClick={() => { void state.refresh(); }} busy={state.busy}>
              <RefreshCw size={14} />
              {UI_TEXT.timekeep.refresh}
            </QuietButton>
            <QuietButton size="compact" tone="primary" onClick={() => { void openScanDialog(); }}>
              <Plus size={14} />
              {UI_TEXT.timekeep.add}
            </QuietButton>
          </div>
        )}
      />

      <div className="qp-scroll-region min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
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
                        <span className="flex min-w-0 items-center gap-2 text-[var(--qp-text-primary)]">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--qp-border-subtle)] bg-[var(--qp-bg-elevated)]">
                            {getAppIcon(timekeepIcons, session.program_name) ? (
                              <img src={getAppIcon(timekeepIcons, session.program_name) ?? undefined} alt="" className="h-4 w-4 object-contain" />
                            ) : <Activity size={13} className="text-[var(--qp-accent-default)]" />}
                          </span>
                          <span className="truncate">{session.program_name}</span>
                        </span>
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
                  <input value={historyProgram} onChange={(event) => setHistoryProgram(event.target.value)} className="qp-input h-9 min-w-0" placeholder={UI_TEXT.timekeep.historyProgramPlaceholder} aria-label={UI_TEXT.timekeep.programName} />
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
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{UI_TEXT.timekeep.programs}</h2>
                <div className="flex items-center gap-2">
                  <QuietBadge tone={state.status?.running ? "subtle" : "warning"} size="compact">
                    {state.status?.running ? UI_TEXT.timekeep.statusRunning : UI_TEXT.timekeep.statusUnavailable}
                  </QuietBadge>
                  <QuietIconAction
                    icon={<Eraser size={14} />}
                    title={UI_TEXT.timekeep.resetAllStats}
                    tone="danger"
                    disabled={state.busy}
                    onClick={() => { void handleResetAllStats(); }}
                  />
                </div>
              </div>
              {state.programs.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.empty}</p>
              ) : (
                <div className="divide-y divide-[var(--qp-border-subtle)]">
                  {state.programs.map((program) => (
                    <div key={program.id || program.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex w-9 shrink-0 flex-col items-center gap-1">
                          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[8px] border border-[var(--qp-border-subtle)] bg-[var(--qp-bg-elevated)]">
                            {getAppIcon(timekeepIcons, program.name) ? (
                              <img src={getAppIcon(timekeepIcons, program.name) ?? undefined} alt="" className="h-6 w-6 object-contain" />
                            ) : <Activity size={16} className="text-[var(--qp-accent-default)]" />}
                          </span>
                          <QuietIconAction
                            icon={<Pencil size={11} />}
                            title={UI_TEXT.timekeep.edit}
                            ariaLabel={`${UI_TEXT.timekeep.edit} ${program.name}`}
                            className="timekeep-program-action h-6 w-6"
                            disabled={state.busy}
                            onClick={() => { void handleCustomIcon(program.name); }}
                          />
                        </div>
                        <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="truncate font-medium text-[var(--qp-text-primary)]">{program.name}</div>
                          {activeProgramNames.has(program.name.toLowerCase()) ? (
                            <QuietBadge tone="subtle">{UI_TEXT.timekeep.trackingNow}</QuietBadge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--qp-text-tertiary)]">
                          {program.category ? <span>{program.category}</span> : null}
                          {program.project ? <span>{program.project}</span> : null}
                          <span>{UI_TEXT.timekeep.lifetime}: {formatLifetime(program.lifetime_seconds)}</span>
                        </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <QuietIconAction
                          icon={<Pencil size={14} />}
                          title={UI_TEXT.timekeep.edit}
                          ariaLabel={`${UI_TEXT.timekeep.edit} ${program.name}`}
                          className="timekeep-program-action"
                          disabled={state.busy}
                          onClick={() => openEditDialog(program)}
                        />
                        <QuietIconAction
                          icon={<Eraser size={14} />}
                          title={UI_TEXT.timekeep.resetStats}
                          ariaLabel={`${UI_TEXT.timekeep.resetStats} ${program.name}`}
                          tone="danger"
                          className="timekeep-program-action"
                          disabled={state.busy}
                          onClick={() => { void handleResetProgramStats(program.name); }}
                        />
                        <QuietIconAction
                          icon={<Trash2 size={14} />}
                          title={UI_TEXT.timekeep.remove}
                          ariaLabel={`${UI_TEXT.timekeep.remove} ${program.name}`}
                          tone="danger"
                          className="timekeep-program-action"
                          disabled={state.busy}
                          onClick={() => { void handleRemove(program.name); }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {configDraft ? (
              <details className="qp-panel overflow-hidden" data-timekeep-service-settings>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-base font-semibold text-[var(--qp-text-primary)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block">{UI_TEXT.timekeep.serviceSettings}</span>
                    <span className="mt-1 block truncate text-xs font-normal text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.serviceSettingsHint}</span>
                  </span>
                  <ChevronDown className="timekeep-settings-summary-icon shrink-0 text-[var(--qp-text-tertiary)]" size={16} aria-hidden="true" />
                </summary>
                <div className="border-t border-[var(--qp-border-subtle)] p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span />
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
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>

      <QuietDialog
        open={scanDialogOpen}
        title={UI_TEXT.timekeep.scanPrograms}
        description={UI_TEXT.timekeep.scanHint}
        onClose={() => setScanDialogOpen(false)}
        surfaceClassName="max-w-2xl"
        initialFocusRef={scanFilterRef}
        actions={(
          <>
            <QuietButton onClick={() => setScanDialogOpen(false)}>{UI_TEXT.common.cancel}</QuietButton>
            <QuietButton onClick={() => { setScanDialogOpen(false); openAddDialog(); }}>{UI_TEXT.timekeep.manualAdd}</QuietButton>
            <QuietButton
              tone="primary"
              onClick={() => { void handleAddSelected(); }}
              busy={state.busy}
              disabled={scanSelection.size === 0 || scanLoading}
            >
              {UI_TEXT.timekeep.addSelected} ({scanSelection.size})
            </QuietButton>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--qp-text-tertiary)]" />
            <input
              value={scanFilter}
              ref={scanFilterRef}
              onChange={(event) => setScanFilter(event.target.value)}
              className="qp-input h-9 w-full pl-9"
              placeholder={UI_TEXT.timekeep.programName}
              aria-label={UI_TEXT.timekeep.programName}
            />
          </div>

          {scanLoading ? (
            <p className="py-8 text-center text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.common.loading}</p>
          ) : scanError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.timekeep.scanFailed}</p>
              <QuietButton size="compact" onClick={() => { void openScanDialog(); }}>{UI_TEXT.timekeep.scanAgain}</QuietButton>
            </div>
          ) : visibleScanCandidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--qp-text-tertiary)]">{UI_TEXT.timekeep.scanEmpty}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--qp-text-tertiary)]">
                <span>{UI_TEXT.timekeep.selectedPrograms}: {scanSelection.size}</span>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className="mr-1">{UI_TEXT.timekeep.availablePrograms}: {visibleScanCandidates.length}</span>
                  <QuietButton
                    size="compact"
                    onClick={() => setScanSelection(new Set(selectableScanNames))}
                    disabled={selectableScanNames.length === 0}
                  >
                    {UI_TEXT.timekeep.selectAll}
                  </QuietButton>
                  <QuietButton
                    size="compact"
                    onClick={() => setScanSelection(new Set())}
                    disabled={scanSelection.size === 0}
                  >
                    {UI_TEXT.timekeep.clearSelection}
                  </QuietButton>
                </div>
              </div>
              <div className="max-h-[360px] space-y-1 overflow-y-auto overscroll-contain pr-1">
                {visibleScanCandidates.map((candidate) => {
                  const checked = candidate.tracked || scanSelection.has(candidate.name);
                  return (
                    <label
                      key={candidate.name}
                      className={`flex cursor-pointer items-center gap-3 rounded-[8px] border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--qp-border-subtle)] hover:bg-[var(--qp-surface-muted)] ${candidate.tracked ? "opacity-65" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={candidate.tracked}
                        onChange={() => toggleScanSelection(candidate.name)}
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--qp-border-subtle)] bg-[var(--qp-bg-elevated)]">
                        {getAppIcon(timekeepIcons, candidate.name) ? (
                          <img src={getAppIcon(timekeepIcons, candidate.name) ?? undefined} alt="" className="h-5 w-5 object-contain" />
                        ) : <Activity size={13} className="text-[var(--qp-accent-default)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--qp-text-primary)]">{candidate.name}</span>
                        <span className="mt-0.5 block text-xs text-[var(--qp-text-tertiary)]">
                          {candidate.running_instances} {UI_TEXT.timekeep.runningInstances}
                          {candidate.tracked ? ` · ${UI_TEXT.timekeep.trackingNow}` : ""}
                        </span>
                      </span>
                       <span className="shrink-0 text-xs tabular-nums text-[var(--qp-text-tertiary)]">
                         {UI_TEXT.timekeep.lifetime}: {formatLifetime(candidate.lifetime_seconds)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div className="grid gap-3 border-t border-[var(--qp-border-subtle)] pt-4 md:grid-cols-2">
            <label className="block text-sm text-[var(--qp-text-secondary)]">
              <span className="mb-1 block">{UI_TEXT.timekeep.category}</span>
              <input value={scanCategory} onChange={(event) => setScanCategory(event.target.value)} className="qp-input h-9 w-full" />
            </label>
            <label className="block text-sm text-[var(--qp-text-secondary)]">
              <span className="mb-1 block">{UI_TEXT.timekeep.project}</span>
              <input value={scanProject} onChange={(event) => setScanProject(event.target.value)} className="qp-input h-9 w-full" />
            </label>
          </div>
        </div>
      </QuietDialog>

      <QuietDialog
        open={addDialogOpen}
        title={editingProgramName ? UI_TEXT.timekeep.edit : UI_TEXT.timekeep.add}
        onClose={() => { setAddDialogOpen(false); setEditingProgramName(null); }}
        initialFocusRef={programNameRef}
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
            <input ref={programNameRef} value={name} onChange={(event) => setName(event.target.value)} className="qp-input h-9 w-full" />
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
    </div>
  );
}
