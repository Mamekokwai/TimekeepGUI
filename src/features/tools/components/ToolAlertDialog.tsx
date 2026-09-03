import { useLocaleText } from "../../../shared/i18n/index.ts";
import { BellRing } from "lucide-react";
import { useRef, type ReactNode } from "react";
import QuietDialog from "../../../shared/components/QuietDialog.tsx";
import QuietButton from "../../../shared/components/QuietButton.tsx";

import { useToolAlerts } from "../hooks/useToolAlerts.ts";

function formatAlertTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function alertIcon(): ReactNode {
  return <BellRing size={17} />;
}

export default function ToolAlertDialog() {
  const UI_TEXT = useLocaleText();
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const { activeAlert, dismissActiveAlert } = useToolAlerts();
  const title = activeAlert?.title.trim() || UI_TEXT.tools.notificationStatus;
  const message = activeAlert?.body.trim() || UI_TEXT.tools.defaultReminderLabel;
  const occurredAtLabel = activeAlert
    ? UI_TEXT.tools.alertOccurredAt(formatAlertTime(activeAlert.occurredAt))
    : "";
  return (
    <QuietDialog
      open={Boolean(activeAlert)}
      title={title}
      closeOnBackdrop={false}
      onClose={dismissActiveAlert}
      initialFocusRef={dismissButtonRef}
      surfaceClassName="tools-alert-dialog-surface"
      actions={(
        <>
          <QuietButton
            ref={dismissButtonRef}
            tone="primary"
            size="large"
            className="qp-dialog-action"
            onClick={dismissActiveAlert}
          >
            {UI_TEXT.tools.alertDismiss}
          </QuietButton>
        </>
      )}
    >
      {activeAlert && (
        <div className="tools-alert-dialog-body">
          <div className="tools-alert-dialog-icon" aria-hidden="true">
            {alertIcon()}
          </div>
          <div className="tools-alert-dialog-copy">
            <p className="tools-alert-dialog-message">{message}</p>
            <p className="tools-alert-dialog-time">{occurredAtLabel}</p>
          </div>
        </div>
      )}
    </QuietDialog>
  );
}
