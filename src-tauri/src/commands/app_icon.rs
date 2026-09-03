use crate::data::repositories::icon_cache;
use crate::data::sqlite_pool::wait_for_sqlite_pool;
use base64::Engine;
use rfd::FileDialog;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn cmd_pick_custom_app_icon<R: Runtime>(
    exe_name: String,
    app: AppHandle<R>,
) -> Result<Option<String>, String> {
    let Some(path) = FileDialog::new()
        .add_filter(
            "Application icon",
            &["ico", "png", "jpg", "jpeg", "webp", "svg"],
        )
        .pick_file()
    else {
        return Ok(None);
    };
    let bytes =
        std::fs::read(&path).map_err(|error| format!("failed to read icon file: {error}"))?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("icon file is larger than 4 MB".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "ico" => "image/x-icon",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    let icon = format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    );
    let pool = wait_for_sqlite_pool(&app).await?;
    icon_cache::upsert_icon(
        &pool,
        &exe_name,
        &icon,
        crate::platform::clock::unix_timestamp_millis_i64(),
    )
    .await
    .map_err(|error| format!("failed to save custom app icon: {error}"))?;
    Ok(Some(icon))
}
