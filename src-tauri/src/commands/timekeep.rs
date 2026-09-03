use crate::platform::timekeep_bridge::TimekeepRequest;
use serde_json::Value;

#[tauri::command]
pub async fn cmd_timekeep_request(request: TimekeepRequest) -> Result<Value, String> {
    crate::platform::timekeep_bridge::request(request).await
}
