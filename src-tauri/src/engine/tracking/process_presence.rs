//! Timekeep-owned process presence runtime.
//!
//! Timekeep defines a session as the lifetime of a configured executable:
//! the first matching process starts it and the last matching process ends
//! it. This runtime projects that service state to the existing tray/widget
//! snapshot contract. It intentionally does not inspect the foreground
//! window, keyboard idle state, window title, or active HWND.

use super::runtime_snapshot::{
    TrackingRuntimeProbeDiagnostics, TrackingRuntimeProbeStatus, TrackingRuntimeSnapshot,
};
use super::watchdog::RuntimeHealthState;
use crate::domain::tracking::{ActiveSessionSnapshot, TrackingStatusSnapshot};
use crate::engine::tracking::ports::SharedTrackingDataStore;
use crate::platform::timekeep_bridge::{self, TimekeepActiveProcess};
use crate::platform::windows::foreground::WindowInfo;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::time::{sleep, Duration};

const PROCESS_PRESENCE_POLL_INTERVAL: Duration = Duration::from_secs(1);

pub async fn run<R: Runtime>(
    app: AppHandle<R>,
    health_state: Arc<RuntimeHealthState>,
    data: SharedTrackingDataStore,
) -> Result<(), String> {
    // Seal a session created by an older foreground-window runtime once. New
    // sessions are owned exclusively by the Timekeep service.
    let startup_time_ms = crate::platform::clock::unix_timestamp_millis_i64();
    if let Err(error) = data.end_active_sessions(startup_time_ms).await {
        eprintln!("[process-tracker] failed to seal legacy active session: {error}");
    }

    let mut previous_signature = String::new();
    let mut previous_window: Option<WindowInfo> = None;

    loop {
        let sampled_at_ms = crate::platform::clock::unix_timestamp_millis_i64();

        match timekeep_bridge::process_presence_snapshot().await {
            Ok(active_processes) => {
                // A healthy tracker means the Timekeep process monitor is
                // reachable, not merely that this GUI loop is alive.
                health_state.note_heartbeat(sampled_at_ms);
                health_state.note_successful_sample(sampled_at_ms);
                let window = project_primary_process(&active_processes);
                let signature = process_signature(&active_processes);
                let did_change = previous_signature != signature;

                replace_runtime_snapshot(&app, &active_processes, &window, sampled_at_ms, true);

                if did_change {
                    let _ = app.emit("active-window-changed", &window);
                    let _ = super::runtime::emit_tracking_data_changed(
                        &app,
                        "process-session-changed",
                        sampled_at_ms as u64,
                    );
                } else if previous_window
                    .as_ref()
                    .map(|previous| previous.exe_name != window.exe_name)
                    .unwrap_or(true)
                {
                    let _ = app.emit("active-window-changed", &window);
                }

                previous_signature = signature;
                previous_window = Some(window);
            }
            Err(error) => {
                if !previous_signature.is_empty() {
                    let window = inactive_window();
                    replace_runtime_snapshot(&app, &[], &window, sampled_at_ms, false);
                    let _ = app.emit("active-window-changed", &window);
                    let _ = super::runtime::emit_tracking_data_changed(
                        &app,
                        "process-service-unavailable",
                        sampled_at_ms as u64,
                    );
                    previous_signature.clear();
                    previous_window = Some(window);
                } else {
                    replace_runtime_snapshot(&app, &[], &inactive_window(), sampled_at_ms, false);
                }
                eprintln!("[process-tracker] {error}");
            }
        }

        sleep(PROCESS_PRESENCE_POLL_INTERVAL).await;
    }
}

fn replace_runtime_snapshot<R: Runtime>(
    app: &AppHandle<R>,
    active_processes: &[TimekeepActiveProcess],
    window: &WindowInfo,
    sampled_at_ms: i64,
    service_available: bool,
) {
    let Some(state) = app.try_state::<super::runtime_snapshot::TrackingRuntimeSnapshotState>()
    else {
        return;
    };

    let status = TrackingStatusSnapshot {
        is_tracking_active: service_available && !active_processes.is_empty(),
        ..TrackingStatusSnapshot::default()
    };

    state.replace(TrackingRuntimeSnapshot {
        window: window.clone(),
        status,
        sampled_at_ms,
        probe_status: if service_available {
            TrackingRuntimeProbeStatus::Ok
        } else {
            TrackingRuntimeProbeStatus::TaskFailedInactive
        },
        degraded_reason: (!service_available).then(|| "Timekeep service unavailable".to_string()),
        probe_diagnostics: TrackingRuntimeProbeDiagnostics::default(),
        active_session: active_processes
            .first()
            .and_then(to_active_session_snapshot),
    });
}

fn project_primary_process(active_processes: &[TimekeepActiveProcess]) -> WindowInfo {
    let Some(process) = active_processes.first() else {
        return inactive_window();
    };

    WindowInfo {
        hwnd: String::new(),
        root_owner_hwnd: String::new(),
        process_id: 0,
        window_class: "TimekeepProcess".to_string(),
        title: String::new(),
        exe_name: process.program_name.clone(),
        process_path: String::new(),
        is_afk: false,
        idle_time_ms: 0,
    }
}

fn inactive_window() -> WindowInfo {
    WindowInfo {
        hwnd: String::new(),
        root_owner_hwnd: String::new(),
        process_id: 0,
        window_class: String::new(),
        title: String::new(),
        exe_name: String::new(),
        process_path: String::new(),
        is_afk: false,
        idle_time_ms: 0,
    }
}

fn process_signature(processes: &[TimekeepActiveProcess]) -> String {
    processes
        .iter()
        .map(|process| {
            format!(
                "{}:{}:{}",
                process.id, process.program_name, process.start_time
            )
        })
        .collect::<Vec<_>>()
        .join("|")
}

fn to_active_session_snapshot(process: &TimekeepActiveProcess) -> Option<ActiveSessionSnapshot> {
    Some(ActiveSessionSnapshot {
        app_name: process.program_name.clone(),
        exe_name: process.program_name.clone(),
        start_time: parse_timekeep_timestamp(&process.start_time)?,
        continuity_group_start_time: parse_timekeep_timestamp(&process.start_time)?,
        closed_duration_ms: 0,
    })
}

fn parse_timekeep_timestamp(value: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.timestamp_millis())
        .ok()
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S%.f")
                .ok()
                .and_then(|date| date.and_local_timezone(chrono::Local).single())
                .map(|date| date.timestamp_millis())
        })
}
