import { useLocaleText } from "../../../shared/i18n/index.ts";
import type { ReactNode } from "react";
import appIconUrl from "../../../../src-tauri/icons/icon.png";
import type { UpdateSnapshot } from "../../../shared/types/update";
import QuietButton from "../../../shared/components/QuietButton";
import UpdateStatusPanel from "../../update/components/UpdateStatusPanel";


type AboutPanelProps = {
  appVersion: string;
  effectiveUpdateSnapshot: UpdateSnapshot;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateDialogOpen: boolean;
  onCheckForUpdates?: () => void;
  onOpenUpdateDialog?: () => void;
  onOpenUpdateReleasePage?: () => void;
  onOpenUpdateDownload?: () => void;
  onOpenRepository: () => void;
  onOpenBlog: () => void;
};

type AboutLinkButtonProps = {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
};

function AboutLinkButton({
  icon,
  label,
  onClick,
}: AboutLinkButtonProps) {
  return (
    <QuietButton
      size="compact"
      className="about-pill-action"
      onClick={onClick}
    >
      <span className="about-pill-icon" aria-hidden>
        {icon}
      </span>
      <span className="about-pill-label">{label}</span>
    </QuietButton>
  );
}

export default function AboutPanel({
  appVersion,
  effectiveUpdateSnapshot,
  updateChecking,
  updateInstalling,
  updateDialogOpen,
  onCheckForUpdates,
  onOpenUpdateDialog,
  onOpenUpdateReleasePage,
  onOpenUpdateDownload,
  onOpenRepository,
  onOpenBlog,
}: AboutPanelProps) {
  const UI_TEXT = useLocaleText();
  const versionLabel = appVersion === "-" || appVersion === "unknown"
    ? UI_TEXT.about.versionUnknown
    : `v${appVersion}`;
  return (
    <div className="about-center-workbench">
      <section className="qp-panel about-center-panel">
        <div className="about-center-profile">
          <div className="about-center-icon-shell" aria-hidden>
            <img src={appIconUrl} alt="" draggable={false} />
          </div>
          <div className="about-center-title-row">
            <h2>TimekeepGUI</h2>
            <span className="about-center-version-chip">{versionLabel}</span>
          </div>
          <p>{UI_TEXT.about.description}</p>
        </div>

        <div className="about-pill-row">
          <AboutLinkButton
            icon={<span className="about-github-mark" />}
            label="项目地址"
            onClick={onOpenRepository}
          />
          <AboutLinkButton
            icon={<span className="about-blog-mark" />}
            label={UI_TEXT.about.blog}
            onClick={onOpenBlog}
          />
        </div>

        <UpdateStatusPanel
          className="about-center-update"
          variant="compact"
          snapshot={effectiveUpdateSnapshot}
          checking={updateChecking}
          installing={updateInstalling}
          suppressProgress={updateDialogOpen}
          showSupportLinks={false}
          onCheckUpdates={() => onCheckForUpdates?.()}
          onOpenConfirmDialog={() => onOpenUpdateDialog?.()}
          onOpenUpdateReleasePage={() => onOpenUpdateReleasePage?.()}
          onOpenUpdateDownload={() => onOpenUpdateDownload?.()}
          onOpenReleaseNotes={() => {}}
          onOpenFeedback={() => {}}
          onOpenSupport={() => {}}
        />
      </section>
    </div>
  );
}
