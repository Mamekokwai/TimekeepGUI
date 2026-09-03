import type { ReactNode } from "react";
import { MousePointerClick } from "lucide-react";

import QuietStepperSlider from "../../../shared/components/QuietStepperSlider.tsx";
import QuietSwitch from "../../../shared/components/QuietSwitch";
import { useLocaleText } from "../../../shared/i18n/index.ts";
import SettingsPanelHeader from "./SettingsPanelHeader";

type SettingsTrackingPanelProps = {
  activeHoldMinutes: number;
  onActiveHoldMinutesChange: (minutes: number) => void;
  audioKeepsUserActive: boolean;
  onAudioKeepsUserActiveChange: (checked: boolean) => void;
  trackingPaused: boolean;
  onTrackingPausedChange: (checked: boolean) => void;
  titleRecordingEnabled: boolean;
  onTitleRecordingEnabledChange: (checked: boolean) => void;
};

function SettingRow({ label, hint, children }: { label: string; hint: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--qp-text-tertiary)]">
        {label}
      </label>
      <div className="mt-2 flex items-start justify-between gap-4">
        <p className="text-sm leading-relaxed text-[var(--qp-text-secondary)]">{hint}</p>
        {children}
      </div>
    </div>
  );
}

export default function SettingsTrackingPanel({
  activeHoldMinutes,
  onActiveHoldMinutesChange,
  audioKeepsUserActive,
  onAudioKeepsUserActiveChange,
  trackingPaused,
  onTrackingPausedChange,
  titleRecordingEnabled,
  onTitleRecordingEnabledChange,
}: SettingsTrackingPanelProps) {
  const UI_TEXT = useLocaleText();

  return (
    <section className="qp-panel min-h-[240px] p-5 md:p-6">
      <SettingsPanelHeader
        icon={<MousePointerClick size={16} className="text-[var(--qp-accent-default)]" />}
        title={UI_TEXT.settings.trackingPanelTitle}
      />

      <div className="mt-5 space-y-5">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--qp-text-tertiary)]">
            {UI_TEXT.settings.timelineMergeGapLabel}
          </label>
          <div className="mt-2 grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,260px)] md:gap-4">
            <p className="text-sm leading-relaxed text-[var(--qp-text-secondary)]">
              {UI_TEXT.settings.timelineMergeGapHint}
            </p>
            <QuietStepperSlider
              ariaLabel={UI_TEXT.settings.timelineMergeGapLabel}
              value={activeHoldMinutes}
              min={1}
              max={5}
              displayValue={UI_TEXT.settings.minuteValue(activeHoldMinutes)}
              decreaseAriaLabel={UI_TEXT.settings.decreaseMinute(UI_TEXT.settings.timelineMergeGapLabel)}
              increaseAriaLabel={UI_TEXT.settings.increaseMinute(UI_TEXT.settings.timelineMergeGapLabel)}
              onChange={onActiveHoldMinutesChange}
            />
          </div>
        </div>

        <SettingRow
          label={UI_TEXT.settings.idleTimeoutLabel}
          hint={UI_TEXT.settings.idleTimeoutHint}
        >
          <QuietSwitch
            checked={audioKeepsUserActive}
            onChange={onAudioKeepsUserActiveChange}
            ariaLabel={UI_TEXT.settings.idleTimeoutLabel}
          />
        </SettingRow>

        <SettingRow label={UI_TEXT.settings.trackingPausedLabel} hint={UI_TEXT.settings.trackingPausedHint}>
          <QuietSwitch
            checked={trackingPaused}
            onChange={onTrackingPausedChange}
            ariaLabel={UI_TEXT.accessibility.settings.toggleTrackingPaused}
          />
        </SettingRow>

        <SettingRow label={UI_TEXT.settings.globalTitleLabel} hint={UI_TEXT.settings.globalTitleHint}>
          <QuietSwitch
            checked={titleRecordingEnabled}
            onChange={onTitleRecordingEnabledChange}
            ariaLabel={UI_TEXT.accessibility.settings.toggleGlobalTitle}
          />
        </SettingRow>
      </div>
    </section>
  );
}
