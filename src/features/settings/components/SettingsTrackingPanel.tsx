import { useLocaleText } from "../../../shared/i18n/index.ts";
import { MousePointerClick } from "lucide-react";
import QuietSwitch from "../../../shared/components/QuietSwitch";
import SettingsPanelHeader from "./SettingsPanelHeader";

type SettingsTrackingPanelProps = {
  trackingPaused: boolean;
  onTrackingPausedChange: (nextChecked: boolean) => void;
  titleRecordingEnabled: boolean;
  onTitleRecordingEnabledChange: (nextChecked: boolean) => void;
};

export default function SettingsTrackingPanel({
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
          <label className="text-[11px] font-semibold text-[var(--qp-text-tertiary)] uppercase tracking-[0.06em]">
            {UI_TEXT.settings.trackingPausedLabel}
          </label>
          <div className="mt-2 flex items-start justify-between gap-4">
            <p className="text-sm text-[var(--qp-text-secondary)] leading-relaxed">
              {UI_TEXT.settings.trackingPausedHint}
            </p>
            <QuietSwitch
              checked={trackingPaused}
              onChange={onTrackingPausedChange}
              ariaLabel={UI_TEXT.accessibility.settings.toggleTrackingPaused}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[var(--qp-text-tertiary)] uppercase tracking-[0.06em]">
            {UI_TEXT.settings.globalTitleLabel}
          </label>
          <div className="mt-2 flex items-start justify-between gap-4">
            <p className="text-sm text-[var(--qp-text-secondary)] leading-relaxed">
              {UI_TEXT.settings.globalTitleHint}
            </p>
            <QuietSwitch
              checked={titleRecordingEnabled}
              onChange={onTitleRecordingEnabledChange}
              ariaLabel={UI_TEXT.accessibility.settings.toggleGlobalTitle}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
