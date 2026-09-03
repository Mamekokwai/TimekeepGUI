use crate::data::user_activity::{self, UserActivitySnapshot};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn cmd_get_user_activity_snapshot<R: Runtime>(
    start_ms: i64,
    end_ms: i64,
    app: AppHandle<R>,
) -> Result<UserActivitySnapshot, String> {
    user_activity::load_snapshot(&app, start_ms, end_ms).await
}
