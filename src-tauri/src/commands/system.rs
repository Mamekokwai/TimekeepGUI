use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemRuntimeSnapshot {
    pub boot_time_ms: i64,
    pub uptime_seconds: u64,
}

#[tauri::command]
pub fn cmd_get_system_runtime_snapshot() -> Result<SystemRuntimeSnapshot, String> {
    #[cfg(target_os = "windows")]
    {
        let uptime_seconds =
            unsafe { windows::Win32::System::SystemInformation::GetTickCount64() / 1_000 };
        let now_ms = chrono::Utc::now().timestamp_millis();
        Ok(SystemRuntimeSnapshot {
            boot_time_ms: now_ms - (uptime_seconds as i64 * 1_000),
            uptime_seconds,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("system boot time is currently supported on Windows only".to_string())
    }
}
