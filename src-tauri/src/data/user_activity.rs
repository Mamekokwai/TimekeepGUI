use crate::data::sqlite_pool::wait_for_sqlite_pool;
use crate::platform::windows::{audio, foreground, media};
use sqlx::{Pool, Row, Sqlite};
use tauri::{AppHandle, Runtime};

const TRACKING_PAUSED_KEY: &str = "tracking_paused";
const AUDIO_KEEPS_USER_ACTIVE_KEY: &str = "audio_keeps_user_active";
const DEFAULT_ACTIVE_HOLD_SECS: u64 = 300;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserActivitySnapshot {
    pub active_ms: i64,
    pub hourly_active_ms: Vec<i64>,
    pub is_active: bool,
    pub idle_since_ms: Option<i64>,
}

pub async fn record_presence(
    app: &AppHandle<impl Runtime>,
    now_ms: i64,
    idle_ms: u64,
) -> Result<(), String> {
    let pool = wait_for_sqlite_pool(app).await?;
    let hold_secs = load_u64_setting(&pool, "timeline_merge_gap_secs", DEFAULT_ACTIVE_HOLD_SECS)
        .await
        .map_err(|error| format!("failed to load active hold setting: {error}"))?
        .clamp(60, 1800);
    let paused = load_boolean_setting(&pool, TRACKING_PAUSED_KEY, false)
        .await
        .map_err(|error| format!("failed to load tracking pause setting: {error}"))?;
    let audio_enabled = load_boolean_setting(&pool, AUDIO_KEEPS_USER_ACTIVE_KEY, true)
        .await
        .map_err(|error| format!("failed to load audio activity setting: {error}"))?;
    let audio_active = audio_enabled && (audio::is_audio_active() || media::is_media_playing());
    let keyboard_or_mouse_active = idle_ms <= hold_secs.saturating_mul(1000);

    if !paused && (keyboard_or_mouse_active || audio_active) {
        let inferred_start = now_ms.saturating_sub(idle_ms.min(i64::MAX as u64) as i64);
        let updated = sqlx::query(
            "UPDATE user_activity_sessions
             SET end_time = ?, duration = MAX(0, ? - start_time)
             WHERE end_time IS NULL",
        )
        .bind(now_ms)
        .bind(now_ms)
        .execute(&pool)
        .await
        .map_err(|error| format!("failed to refresh user activity: {error}"))?
        .rows_affected();

        if updated == 0 {
            sqlx::query(
                "INSERT INTO user_activity_sessions (start_time, end_time, duration)
                 VALUES (?, NULL, NULL)",
            )
            .bind(if audio_active { now_ms } else { inferred_start })
            .execute(&pool)
            .await
            .map_err(|error| format!("failed to start user activity: {error}"))?;
        }
    } else {
        let active_end = now_ms
            .saturating_sub(idle_ms.min(i64::MAX as u64) as i64)
            .saturating_add(hold_secs.saturating_mul(1000).min(i64::MAX as u64) as i64)
            .min(now_ms);
        sqlx::query(
            "UPDATE user_activity_sessions
             SET end_time = ?, duration = MAX(0, ? - start_time)
             WHERE end_time IS NULL",
        )
        .bind(active_end)
        .bind(active_end)
        .execute(&pool)
        .await
        .map_err(|error| format!("failed to close user activity: {error}"))?;
    }

    Ok(())
}

pub async fn close_open_session(app: &AppHandle<impl Runtime>, now_ms: i64) -> Result<(), String> {
    let pool = wait_for_sqlite_pool(app).await?;
    sqlx::query(
        "UPDATE user_activity_sessions
         SET end_time = ?, duration = MAX(0, ? - start_time)
         WHERE end_time IS NULL",
    )
    .bind(now_ms)
    .bind(now_ms)
    .execute(&pool)
    .await
    .map_err(|error| format!("failed to close stale user activity: {error}"))?;
    Ok(())
}

pub async fn load_snapshot(
    app: &AppHandle<impl Runtime>,
    start_ms: i64,
    end_ms: i64,
) -> Result<UserActivitySnapshot, String> {
    let pool = wait_for_sqlite_pool(app).await?;
    let now_ms = crate::platform::clock::unix_timestamp_millis_i64();
    let effective_end_ms = end_ms.min(now_ms.max(start_ms));
    let rows = sqlx::query(
        "SELECT start_time, COALESCE(end_time, ?) AS end_time
         FROM user_activity_sessions
         WHERE start_time < ? AND COALESCE(end_time, ?) > ?
         ORDER BY start_time ASC",
    )
    .bind(effective_end_ms)
    .bind(end_ms)
    .bind(effective_end_ms)
    .bind(start_ms)
    .fetch_all(&pool)
    .await
    .map_err(|error| format!("failed to read user activity: {error}"))?;

    let mut hourly_active_ms = vec![0_i64; 24];
    let mut active_ms = 0_i64;
    for row in rows {
        let start = row.get::<i64, _>("start_time").max(start_ms);
        let end = row
            .get::<i64, _>("end_time")
            .min(end_ms)
            .min(effective_end_ms);
        if end <= start {
            continue;
        }
        active_ms = active_ms.saturating_add(end - start);
        add_interval_to_hours(&mut hourly_active_ms, start, end, start_ms);
    }

    let idle_since_ms = load_last_input_idle_ms()
        .map(|idle_ms| now_ms.saturating_sub(idle_ms.min(i64::MAX as u64) as i64));
    let hold_secs = load_u64_setting(&pool, "timeline_merge_gap_secs", DEFAULT_ACTIVE_HOLD_SECS)
        .await
        .unwrap_or(DEFAULT_ACTIVE_HOLD_SECS)
        .clamp(60, 1800);
    let audio_enabled = load_boolean_setting(&pool, AUDIO_KEEPS_USER_ACTIVE_KEY, true)
        .await
        .unwrap_or(true);
    let audio_active = audio_enabled && (audio::is_audio_active() || media::is_media_playing());
    let is_active = idle_since_ms
        .map(|last_input_ms| now_ms.saturating_sub(last_input_ms) <= hold_secs as i64 * 1000)
        .unwrap_or(false)
        || audio_active;

    Ok(UserActivitySnapshot {
        active_ms,
        hourly_active_ms,
        is_active,
        idle_since_ms,
    })
}

fn add_interval_to_hours(hours: &mut [i64], mut start: i64, end: i64, day_start: i64) {
    while start < end {
        let hour_index = ((start - day_start).div_euclid(3_600_000)) as usize;
        let next_hour = day_start + ((hour_index as i64 + 1) * 3_600_000);
        let segment_end = end.min(next_hour);
        if hour_index < hours.len() {
            hours[hour_index] = hours[hour_index].saturating_add(segment_end - start);
        }
        start = segment_end;
    }
}

fn load_last_input_idle_ms() -> Option<u64> {
    Some(foreground::get_last_input_idle_ms())
}

async fn load_u64_setting(
    pool: &Pool<Sqlite>,
    key: &str,
    fallback: u64,
) -> Result<u64, sqlx::Error> {
    Ok(
        sqlx::query("SELECT value FROM settings WHERE key = ? LIMIT 1")
            .bind(key)
            .fetch_optional(pool)
            .await?
            .and_then(|row| row.try_get::<String, _>("value").ok())
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(fallback),
    )
}

async fn load_boolean_setting(
    pool: &Pool<Sqlite>,
    key: &str,
    fallback: bool,
) -> Result<bool, sqlx::Error> {
    Ok(
        sqlx::query("SELECT value FROM settings WHERE key = ? LIMIT 1")
            .bind(key)
            .fetch_optional(pool)
            .await?
            .and_then(|row| row.try_get::<String, _>("value").ok())
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(fallback),
    )
}

#[cfg(test)]
mod tests {
    use super::add_interval_to_hours;

    #[test]
    fn activity_is_split_across_hour_buckets() {
        let day_start = 1_700_000_000_000_i64;
        let mut hours = vec![0_i64; 24];

        add_interval_to_hours(
            &mut hours,
            day_start + 90 * 60 * 1_000,
            day_start + 150 * 60 * 1_000,
            day_start,
        );

        assert_eq!(hours[1], 30 * 60 * 1_000);
        assert_eq!(hours[2], 30 * 60 * 1_000);
        assert_eq!(hours.iter().sum::<i64>(), 60 * 60 * 1_000);
    }
}
