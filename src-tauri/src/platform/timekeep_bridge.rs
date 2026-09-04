use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::time::timeout;

#[cfg(target_os = "windows")]
const TIMEKEEP_PIPE_PATH: &str = r"\\.\pipe\Timekeep";
#[cfg(unix)]
const TIMEKEEP_SOCKET_PATH: &str = "/var/run/timekeep/timekeep.sock";
const TIMEKEEP_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const TIMEKEEP_DATABASE_PATH: &str = r"C:\ProgramData\TimeKeep\timekeep.db";
const TIMEKEEP_CONFIG_PATH: &str = r"C:\ProgramData\Timekeep\config\config.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TimekeepActiveProcess {
    pub id: i64,
    pub program_name: String,
    pub start_time: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TimekeepRequest {
    pub request_id: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub programs: Option<Vec<String>>,
}

pub async fn request(request: TimekeepRequest) -> Result<Value, String> {
    timeout(TIMEKEEP_REQUEST_TIMEOUT, handle_request(request))
        .await
        .map_err(|_| "Timekeep service request timed out".to_string())?
        .map_err(|error| format!("Timekeep service request failed: {error}"))
}

pub async fn process_presence_snapshot() -> Result<Vec<TimekeepActiveProcess>, String> {
    if !service_pipe_is_available().await {
        sync_embedded_process_presence().await?;
    }

    let data = list_active_sessions().await?;
    serde_json::from_value(data)
        .map_err(|error| format!("invalid Timekeep active-session data: {error}"))
}

/// Prepare the GUI-owned usage tables and discard an unfinished foreground
/// session from a previous GUI run. The process-lifetime tables remain owned by
/// Timekeep; only the additional focused-window accounting is managed here.
pub async fn prepare_user_usage() -> Result<(), String> {
    ensure_timekeep_usage_schema().await?;
    seal_stale_user_usage().await
}

/// Record one foreground sample for the currently focused tracked program.
/// This is intentionally independent from process presence: a program can be
/// running without being the user's primary window.
#[cfg(target_os = "windows")]
pub async fn sync_user_usage() -> Result<(), String> {
    ensure_timekeep_usage_schema().await?;
    let pool = open_timekeep_database(false).await?;
    let current_program = current_tracked_foreground_program(&pool).await?;
    let now = chrono::Utc::now();
    let now_text = now.to_rfc3339();
    let active = sqlx::query(
        "SELECT id, program_name, start_time, last_sample_time
         FROM tracked_program_usage_sessions LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .map_err(|error| format!("failed to read focused usage session: {error}"))?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("failed to begin focused usage sync: {error}"))?;

    if let Some(row) = active {
        let id = row.get::<i64, _>("id");
        let program_name = row.get::<String, _>("program_name");
        let start_text = row.get::<String, _>("start_time");
        let last_sample_text = row.get::<String, _>("last_sample_time");
        let last_sample = parse_timekeep_datetime(&last_sample_text)
            .ok_or_else(|| format!("invalid focused usage sample time: {last_sample_text}"))?;
        let close_at = if current_program.is_some() {
            now
        } else {
            last_sample
        };
        let close_text = if current_program.is_some() {
            &now_text
        } else {
            &last_sample_text
        };
        let delta_seconds = bounded_usage_delta(last_sample, close_at);

        if current_program
            .as_deref()
            .is_some_and(|name| name.eq_ignore_ascii_case(&program_name))
        {
            if delta_seconds > 0 {
                increment_usage(&mut tx, &program_name, delta_seconds).await?;
            }
            sqlx::query(
                "UPDATE tracked_program_usage_sessions
                 SET last_sample_time = ? WHERE id = ?",
            )
            .bind(&now_text)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("failed to update focused usage session: {error}"))?;
        } else {
            archive_usage_session(
                &mut tx,
                id,
                &program_name,
                &start_text,
                close_text,
                delta_seconds,
            )
            .await?;

            if let Some(name) = current_program.as_deref() {
                sqlx::query(
                    "INSERT INTO tracked_program_usage_sessions
                     (program_name, start_time, last_sample_time) VALUES (?, ?, ?)",
                )
                .bind(name)
                .bind(&now_text)
                .bind(&now_text)
                .execute(&mut *tx)
                .await
                .map_err(|error| format!("failed to start focused usage session: {error}"))?;
            }
        }
    } else if let Some(name) = current_program.as_deref() {
        sqlx::query(
            "INSERT INTO tracked_program_usage_sessions
             (program_name, start_time, last_sample_time) VALUES (?, ?, ?)",
        )
        .bind(name)
        .bind(&now_text)
        .bind(&now_text)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("failed to start focused usage session: {error}"))?;
    }

    tx.commit()
        .await
        .map_err(|error| format!("failed to commit focused usage sync: {error}"))
}

#[cfg(not(target_os = "windows"))]
pub async fn sync_user_usage() -> Result<(), String> {
    Ok(())
}

/// The upstream sample service exposes a command pipe for refresh requests and
/// stores its authoritative process sessions in SQLite. The GUI deliberately
/// reads that same database instead of inventing a foreground-window timer.
/// Mutations are followed by the sample's `refresh` command so its WMI monitor
/// picks up the changed tracked-program list.
async fn handle_request(request: TimekeepRequest) -> Result<Value, String> {
    let request_id = request.request_id.clone();
    let data = match request.action.as_str() {
        "service_status" => {
            let service_available = service_pipe_is_available().await;
            json!({
                "running": service_available || Path::new(TIMEKEEP_DATABASE_PATH).exists(),
                "version": if service_available { "timekeep" } else { "embedded" },
            })
        }
        "get_config" => read_timekeep_config().await?,
        "list_programs" => list_programs().await?,
        "scan_programs" => scan_programs().await?,
        "get_program" => get_program(request.name.as_deref().unwrap_or_default()).await?,
        "active_sessions" => list_active_sessions().await?,
        "history" => list_history(&request).await?,
        "add_program" => {
            let name = normalize_program_name(request.name.as_deref().unwrap_or_default())?;
            ensure_timekeep_usage_schema().await?;
            let pool = open_timekeep_database(false).await?;
            sqlx::query(
                "INSERT OR IGNORE INTO tracked_programs (name, category, project) VALUES (?, ?, ?)",
            )
            .bind(&name)
            .bind(non_empty(request.category.as_deref()))
            .bind(non_empty(request.project.as_deref()))
            .execute(&pool)
            .await
            .map_err(|error| format!("failed to add tracked program: {error}"))?;
            refresh_service().await?;
            json!({ "name": name })
        }
        "add_programs" => {
            let names = request
                .programs
                .unwrap_or_default()
                .into_iter()
                .map(|name| normalize_program_name(&name))
                .collect::<Result<Vec<_>, _>>()?;
            if names.is_empty() {
                return Err("at least one program is required".to_string());
            }

            ensure_timekeep_usage_schema().await?;
            let pool = open_timekeep_database(false).await?;
            let mut tx = pool
                .begin()
                .await
                .map_err(|error| format!("failed to begin adding tracked programs: {error}"))?;
            for name in &names {
                sqlx::query(
                    "INSERT OR IGNORE INTO tracked_programs (name, category, project) VALUES (?, ?, ?)",
                )
                .bind(name)
                .bind(non_empty(request.category.as_deref()))
                .bind(non_empty(request.project.as_deref()))
                .execute(&mut *tx)
                .await
                .map_err(|error| format!("failed to add tracked program {name}: {error}"))?;
            }
            tx.commit()
                .await
                .map_err(|error| format!("failed to commit tracked programs: {error}"))?;
            refresh_service().await?;
            json!({ "names": names })
        }
        "update_program" => {
            let name = normalize_program_name(request.name.as_deref().unwrap_or_default())?;
            ensure_timekeep_usage_schema().await?;
            let pool = open_timekeep_database(false).await?;
            if request.category.is_some() {
                sqlx::query("UPDATE tracked_programs SET category = ? WHERE name = ?")
                    .bind(non_empty(request.category.as_deref()))
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to update program category: {error}"))?;
            }
            if request.project.is_some() {
                sqlx::query("UPDATE tracked_programs SET project = ? WHERE name = ?")
                    .bind(non_empty(request.project.as_deref()))
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to update program project: {error}"))?;
            }
            refresh_service().await?;
            json!({ "name": name })
        }
        "remove_program" => {
            let name = normalize_program_name(request.name.as_deref().unwrap_or_default())?;
            ensure_timekeep_usage_schema().await?;
            let pool = open_timekeep_database(false).await?;
            let result = sqlx::query("DELETE FROM tracked_programs WHERE name = ?")
                .bind(&name)
                .execute(&pool)
                .await
                .map_err(|error| format!("failed to remove tracked program: {error}"))?;
            refresh_service().await?;
            json!({ "removed": result.rows_affected() > 0 })
        }
        "reset_stats" => {
            ensure_timekeep_usage_schema().await?;
            let pool = open_timekeep_database(false).await?;
            if request.all.unwrap_or(false) || request.name.is_none() {
                sqlx::query("DELETE FROM active_sessions")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset active sessions: {error}"))?;
                sqlx::query("DELETE FROM session_history")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset session history: {error}"))?;
                sqlx::query("UPDATE tracked_programs SET lifetime_seconds = 0")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset program lifetimes: {error}"))?;
                sqlx::query("UPDATE tracked_programs SET usage_seconds = 0")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage durations: {error}"))?;
                sqlx::query("DELETE FROM tracked_program_usage_sessions")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage sessions: {error}"))?;
                sqlx::query("DELETE FROM tracked_program_usage_history")
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage history: {error}"))?;
            } else {
                let name = normalize_program_name(request.name.as_deref().unwrap_or_default())?;
                sqlx::query("DELETE FROM active_sessions WHERE program_name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset active session: {error}"))?;
                sqlx::query("DELETE FROM session_history WHERE program_name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset session history: {error}"))?;
                sqlx::query("UPDATE tracked_programs SET lifetime_seconds = 0 WHERE name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset program lifetime: {error}"))?;
                sqlx::query("UPDATE tracked_programs SET usage_seconds = 0 WHERE name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage duration: {error}"))?;
                sqlx::query("DELETE FROM tracked_program_usage_sessions WHERE program_name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage session: {error}"))?;
                sqlx::query("DELETE FROM tracked_program_usage_history WHERE program_name = ?")
                    .bind(&name)
                    .execute(&pool)
                    .await
                    .map_err(|error| format!("failed to reset focused usage history: {error}"))?;
            }
            refresh_service().await?;
            json!({ "reset": true })
        }
        "update_config" => {
            let config = request
                .config
                .ok_or_else(|| "missing Timekeep service config".to_string())?;
            write_timekeep_config(&config).await?;
            refresh_service().await?;
            config
        }
        "refresh" => {
            refresh_service().await?;
            json!({ "refreshed": true })
        }
        action => return Err(format!("unsupported Timekeep action: {action}")),
    };

    Ok(json!({ "request_id": request_id, "ok": true, "data": data }))
}

fn normalize_program_name(name: &str) -> Result<String, String> {
    let name = name.trim().to_ascii_lowercase();
    if name.is_empty() {
        return Err("program name cannot be empty".to_string());
    }
    Ok(name)
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

static TIMEKEEP_USAGE_SCHEMA_READY: AtomicBool = AtomicBool::new(false);

async fn ensure_timekeep_usage_schema() -> Result<(), String> {
    if TIMEKEEP_USAGE_SCHEMA_READY.load(Ordering::Acquire) {
        return Ok(());
    }

    let pool = open_timekeep_database(false).await?;
    let columns = sqlx::query("PRAGMA table_info(tracked_programs)")
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("failed to inspect Timekeep program schema: {error}"))?;
    let has_usage_column = columns.iter().any(|row| {
        row.get::<String, _>("name")
            .eq_ignore_ascii_case("usage_seconds")
    });
    if !has_usage_column {
        sqlx::query(
            "ALTER TABLE tracked_programs
             ADD COLUMN usage_seconds INTEGER NOT NULL DEFAULT 0",
        )
        .execute(&pool)
        .await
        .map_err(|error| format!("failed to add focused usage column: {error}"))?;
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tracked_program_usage_sessions (
            id INTEGER PRIMARY KEY,
            program_name TEXT UNIQUE NOT NULL
                REFERENCES tracked_programs(name) ON DELETE CASCADE,
            start_time DATETIME NOT NULL,
            last_sample_time DATETIME NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .map_err(|error| format!("failed to create focused usage sessions: {error}"))?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tracked_program_usage_history (
            id INTEGER PRIMARY KEY,
            program_name TEXT NOT NULL
                REFERENCES tracked_programs(name) ON DELETE CASCADE,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            duration_seconds INTEGER NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .map_err(|error| format!("failed to create focused usage history: {error}"))?;

    TIMEKEEP_USAGE_SCHEMA_READY.store(true, Ordering::Release);
    Ok(())
}

async fn seal_stale_user_usage() -> Result<(), String> {
    let pool = open_timekeep_database(false).await?;
    let rows = sqlx::query(
        "SELECT id, program_name, start_time, last_sample_time
         FROM tracked_program_usage_sessions",
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| format!("failed to read stale focused usage sessions: {error}"))?;
    if rows.is_empty() {
        return Ok(());
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("failed to begin stale usage cleanup: {error}"))?;
    for row in rows {
        let id = row.get::<i64, _>("id");
        let program_name = row.get::<String, _>("program_name");
        let start_text = row.get::<String, _>("start_time");
        let end_text = row.get::<String, _>("last_sample_time");
        let start = parse_timekeep_datetime(&start_text)
            .ok_or_else(|| format!("invalid stale usage start time: {start_text}"))?;
        let end = parse_timekeep_datetime(&end_text)
            .ok_or_else(|| format!("invalid stale usage end time: {end_text}"))?;
        let duration_seconds = (end - start).num_seconds().max(0);
        if duration_seconds > 0 {
            sqlx::query(
                "INSERT INTO tracked_program_usage_history
                 (program_name, start_time, end_time, duration_seconds)
                 VALUES (?, ?, ?, ?)",
            )
            .bind(&program_name)
            .bind(&start_text)
            .bind(&end_text)
            .bind(duration_seconds)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("failed to archive stale focused usage: {error}"))?;
        }
        sqlx::query("DELETE FROM tracked_program_usage_sessions WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("failed to remove stale focused usage: {error}"))?;
    }
    tx.commit()
        .await
        .map_err(|error| format!("failed to commit stale usage cleanup: {error}"))
}

#[cfg(target_os = "windows")]
async fn current_tracked_foreground_program(pool: &SqlitePool) -> Result<Option<String>, String> {
    let window = crate::platform::windows::foreground::get_active_window();
    if window.is_afk || window.exe_name.trim().is_empty() {
        return Ok(None);
    }

    sqlx::query("SELECT name FROM tracked_programs WHERE name = ? COLLATE NOCASE")
        .bind(window.exe_name.trim())
        .fetch_optional(pool)
        .await
        .map(|row| row.map(|row| row.get::<String, _>("name")))
        .map_err(|error| format!("failed to match focused tracked program: {error}"))
}

fn bounded_usage_delta(
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
) -> i64 {
    (end - start).num_seconds().clamp(0, 2)
}

async fn increment_usage(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    program_name: &str,
    delta_seconds: i64,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE tracked_programs
         SET usage_seconds = usage_seconds + ? WHERE name = ?",
    )
    .bind(delta_seconds)
    .bind(program_name)
    .execute(&mut **tx)
    .await
    .map_err(|error| format!("failed to update focused usage duration: {error}"))?;
    Ok(())
}

async fn archive_usage_session(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: i64,
    program_name: &str,
    start_text: &str,
    end_text: &str,
    delta_seconds: i64,
) -> Result<(), String> {
    if delta_seconds > 0 {
        increment_usage(tx, program_name, delta_seconds).await?;
    }
    let start = parse_timekeep_datetime(start_text)
        .ok_or_else(|| format!("invalid focused usage start time: {start_text}"))?;
    let end = parse_timekeep_datetime(end_text)
        .ok_or_else(|| format!("invalid focused usage end time: {end_text}"))?;
    let duration_seconds = (end - start).num_seconds().max(0);
    if duration_seconds > 0 {
        sqlx::query(
            "INSERT INTO tracked_program_usage_history
             (program_name, start_time, end_time, duration_seconds)
             VALUES (?, ?, ?, ?)",
        )
        .bind(program_name)
        .bind(start_text)
        .bind(end_text)
        .bind(duration_seconds)
        .execute(&mut **tx)
        .await
        .map_err(|error| format!("failed to archive focused usage: {error}"))?;
    }
    sqlx::query("DELETE FROM tracked_program_usage_sessions WHERE id = ?")
        .bind(id)
        .execute(&mut **tx)
        .await
        .map_err(|error| format!("failed to close focused usage session: {error}"))?;
    Ok(())
}

async fn open_timekeep_database(read_only: bool) -> Result<SqlitePool, String> {
    let path = Path::new(TIMEKEEP_DATABASE_PATH);
    if !path.exists() {
        return Err(format!("Timekeep database not found at {}", path.display()));
    }

    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(path)
        .read_only(read_only)
        .create_if_missing(false)
        .pragma("busy_timeout", "5000")
        .pragma("foreign_keys", "ON");
    sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|error| format!("failed to open Timekeep database: {error}"))
}

async fn list_programs() -> Result<Value, String> {
    ensure_timekeep_usage_schema().await?;
    let pool = open_timekeep_database(true).await?;
    let rows = sqlx::query(
        "SELECT id, name, lifetime_seconds, usage_seconds, category, project
         FROM tracked_programs ORDER BY name COLLATE NOCASE ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| format!("failed to read tracked programs: {error}"))?;
    let active_rows = sqlx::query("SELECT program_name, start_time FROM active_sessions")
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("failed to read active process sessions: {error}"))?;
    let now = chrono::Utc::now();
    let mut active_runtime = HashMap::<String, i64>::new();
    for row in active_rows {
        let name = row.get::<String, _>("program_name");
        let start_text = row.get::<String, _>("start_time");
        if let Some(start) = parse_timekeep_datetime(&start_text) {
            *active_runtime.entry(name.to_ascii_lowercase()).or_default() +=
                (now - start).num_seconds().max(0);
        }
    }
    let programs = rows
        .into_iter()
        .map(|row| {
            let name = row.get::<String, _>("name");
            let runtime_seconds = row.get::<i64, _>("lifetime_seconds")
                + active_runtime
                    .get(&name.to_ascii_lowercase())
                    .copied()
                    .unwrap_or_default();
            json!({
                "id": row.get::<i64, _>("id"),
                "name": name,
                "lifetime_seconds": row.get::<i64, _>("lifetime_seconds"),
                "runtime_seconds": runtime_seconds,
                "usage_seconds": row.get::<i64, _>("usage_seconds"),
                "category": row.get::<Option<String>, _>("category"),
                "project": row.get::<Option<String>, _>("project"),
            })
        })
        .collect::<Vec<_>>();
    Ok(Value::Array(programs))
}

#[cfg(target_os = "windows")]
async fn scan_programs() -> Result<Value, String> {
    ensure_timekeep_usage_schema().await?;
    let pool = open_timekeep_database(true).await?;
    let rows = sqlx::query(
        "SELECT name, lifetime_seconds, usage_seconds, category, project FROM tracked_programs",
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| format!("failed to read tracked program statistics: {error}"))?;
    let tracked = rows
        .into_iter()
        .map(|row| {
            (
                row.get::<String, _>("name").to_ascii_lowercase(),
                json!({
                    "lifetime_seconds": row.get::<i64, _>("lifetime_seconds"),
                    "usage_seconds": row.get::<i64, _>("usage_seconds"),
                    "category": row.get::<Option<String>, _>("category"),
                    "project": row.get::<Option<String>, _>("project"),
                }),
            )
        })
        .collect::<HashMap<_, _>>();
    let running = crate::platform::windows::foreground::get_running_process_counts();
    let mut names = running.keys().cloned().collect::<Vec<_>>();
    names.sort_unstable();

    Ok(Value::Array(
        names
            .into_iter()
            .map(|name| {
                let stored = tracked.get(&name);
                json!({
                    "name": name,
                    "running_instances": running.get(&name).copied().unwrap_or_default(),
                    "tracked": stored.is_some(),
                    "lifetime_seconds": stored.and_then(|value| value.get("lifetime_seconds")).and_then(Value::as_i64).unwrap_or(0),
                    "usage_seconds": stored.and_then(|value| value.get("usage_seconds")).and_then(Value::as_i64).unwrap_or(0),
                    "category": stored.and_then(|value| value.get("category")).cloned().unwrap_or(Value::Null),
                    "project": stored.and_then(|value| value.get("project")).cloned().unwrap_or(Value::Null),
                })
            })
            .collect(),
    ))
}

#[cfg(not(target_os = "windows"))]
async fn scan_programs() -> Result<Value, String> {
    Err("program scanning is currently supported on Windows only".to_string())
}

async fn get_program(name: &str) -> Result<Value, String> {
    let name = normalize_program_name(name)?;
    ensure_timekeep_usage_schema().await?;
    let pool = open_timekeep_database(true).await?;
    let row = sqlx::query(
        "SELECT id, name, lifetime_seconds, usage_seconds, category, project
         FROM tracked_programs WHERE name = ? COLLATE NOCASE",
    )
    .bind(name)
    .fetch_optional(&pool)
    .await
    .map_err(|error| format!("failed to read tracked program: {error}"))?
    .ok_or_else(|| "tracked program not found".to_string())?;
    let program_name = row.get::<String, _>("name");
    let active_rows =
        sqlx::query("SELECT start_time FROM active_sessions WHERE program_name = ? COLLATE NOCASE")
            .bind(&program_name)
            .fetch_all(&pool)
            .await
            .map_err(|error| format!("failed to read active process sessions: {error}"))?;
    let active_runtime = active_rows
        .into_iter()
        .filter_map(|active| parse_timekeep_datetime(&active.get::<String, _>("start_time")))
        .map(|start| (chrono::Utc::now() - start).num_seconds().max(0))
        .sum::<i64>();
    Ok(json!({
        "id": row.get::<i64, _>("id"),
        "name": program_name,
        "lifetime_seconds": row.get::<i64, _>("lifetime_seconds"),
        "runtime_seconds": row.get::<i64, _>("lifetime_seconds") + active_runtime,
        "usage_seconds": row.get::<i64, _>("usage_seconds"),
        "category": row.get::<Option<String>, _>("category"),
        "project": row.get::<Option<String>, _>("project"),
    }))
}

async fn list_active_sessions() -> Result<Value, String> {
    let pool = open_timekeep_database(true).await?;
    let rows = sqlx::query(
        "SELECT id, program_name, start_time
         FROM active_sessions ORDER BY start_time ASC, id ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| format!("failed to read active process sessions: {error}"))?;
    Ok(Value::Array(
        rows.into_iter()
            .map(|row| {
                json!({
                    "id": row.get::<i64, _>("id"),
                    "program_name": row.get::<String, _>("program_name"),
                    "start_time": row.get::<String, _>("start_time"),
                })
            })
            .collect(),
    ))
}

#[cfg(target_os = "windows")]
async fn sync_embedded_process_presence() -> Result<(), String> {
    let pool = open_timekeep_database(false).await?;
    let tracked_rows = sqlx::query("SELECT name FROM tracked_programs")
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("failed to read tracked process list: {error}"))?;
    let tracked = tracked_rows
        .into_iter()
        .map(|row| row.get::<String, _>("name").to_ascii_lowercase())
        .collect::<HashSet<_>>();
    let running = crate::platform::windows::foreground::get_running_process_names();
    let now = chrono::Utc::now();
    let now_text = now.to_rfc3339();

    let active_rows = sqlx::query("SELECT id, program_name, start_time FROM active_sessions")
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("failed to read active process sessions: {error}"))?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("failed to begin process session sync: {error}"))?;

    for row in active_rows {
        let id = row.get::<i64, _>("id");
        let program_name = row.get::<String, _>("program_name");
        if tracked.contains(&program_name.to_ascii_lowercase())
            && running.contains(&program_name.to_ascii_lowercase())
        {
            continue;
        }

        let start_text = row.get::<String, _>("start_time");
        let start = parse_timekeep_datetime(&start_text)
            .ok_or_else(|| format!("invalid active session start time: {start_text}"))?;
        let duration_seconds = (now - start).num_seconds().max(0);
        sqlx::query(
            "INSERT INTO session_history (program_name, start_time, end_time, duration_seconds)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&program_name)
        .bind(&start_text)
        .bind(&now_text)
        .bind(duration_seconds)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("failed to archive process session: {error}"))?;
        sqlx::query(
            "UPDATE tracked_programs
             SET lifetime_seconds = lifetime_seconds + ?
             WHERE name = ?",
        )
        .bind(duration_seconds)
        .bind(&program_name)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("failed to update process lifetime: {error}"))?;
        sqlx::query("DELETE FROM active_sessions WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("failed to close process session: {error}"))?;
    }

    let active_names = sqlx::query("SELECT program_name FROM active_sessions")
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| format!("failed to re-read active process sessions: {error}"))?
        .into_iter()
        .map(|row| row.get::<String, _>("program_name").to_ascii_lowercase())
        .collect::<HashSet<_>>();

    for program_name in tracked.intersection(&running) {
        if active_names.contains(program_name) {
            continue;
        }
        sqlx::query(
            "INSERT OR IGNORE INTO active_sessions (program_name, start_time) VALUES (?, ?)",
        )
        .bind(program_name)
        .bind(&now_text)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("failed to start process session: {error}"))?;
    }

    tx.commit()
        .await
        .map_err(|error| format!("failed to commit process session sync: {error}"))
}

#[cfg(not(target_os = "windows"))]
async fn sync_embedded_process_presence() -> Result<(), String> {
    Err("embedded process presence is currently supported on Windows only".to_string())
}

fn parse_timekeep_datetime(value: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&chrono::Utc))
        .ok()
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S%.f")
                .ok()
                .and_then(|date| date.and_local_timezone(chrono::Local).single())
                .map(|date| date.with_timezone(&chrono::Utc))
        })
}

async fn list_history(request: &TimekeepRequest) -> Result<Value, String> {
    let pool = open_timekeep_database(true).await?;
    let limit = request.limit.unwrap_or(25).clamp(1, 500);
    let mut statement = String::from(
        "SELECT id, program_name, start_time, end_time, duration_seconds
         FROM session_history WHERE 1 = 1",
    );
    let name = non_empty(request.name.as_deref());
    if name.is_some() {
        statement.push_str(" AND program_name = ? COLLATE NOCASE");
    }

    // Match the sample CLI's overlap semantics: a session is included when
    // any part of it falls inside the requested calendar day/range.
    let mut date_bounds = None;
    if let Some(date) = non_empty(request.date.as_deref()) {
        validate_history_date(date)?;
        statement.push_str(" AND date(start_time) <= ? AND date(end_time) >= ?");
        date_bounds = Some((date.to_string(), date.to_string()));
    } else {
        let start = non_empty(request.start.as_deref());
        let end = non_empty(request.end.as_deref());
        if let Some(start) = start {
            validate_history_date(start)?;
            statement.push_str(" AND date(end_time) >= ?");
            date_bounds = Some((start.to_string(), String::new()));
        }
        if let Some(end) = end {
            validate_history_date(end)?;
            statement.push_str(" AND date(start_time) <= ?");
            if let Some((_, upper)) = date_bounds.as_mut() {
                *upper = end.to_string();
            } else {
                date_bounds = Some((String::new(), end.to_string()));
            }
        }
    }
    statement.push_str(" ORDER BY end_time DESC LIMIT ?");

    let mut query = sqlx::query(&statement);
    if let Some(name) = name {
        query = query.bind(name);
    }
    if let Some((lower, upper)) = date_bounds {
        if !lower.is_empty() && !upper.is_empty() && request.date.is_some() {
            query = query.bind(lower).bind(upper);
        } else if !lower.is_empty() {
            query = query.bind(lower);
        } else if !upper.is_empty() {
            query = query.bind(upper);
        }
    }
    let rows = query
        .bind(limit)
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("failed to read Timekeep history: {error}"))?;
    Ok(Value::Array(
        rows.into_iter()
            .rev()
            .map(|row| {
                json!({
                    "id": row.get::<i64, _>("id"),
                    "program_name": row.get::<String, _>("program_name"),
                    "start_time": row.get::<String, _>("start_time"),
                    "end_time": row.get::<String, _>("end_time"),
                    "duration_seconds": row.get::<i64, _>("duration_seconds"),
                })
            })
            .collect(),
    ))
}

fn validate_history_date(value: &str) -> Result<(), String> {
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!("invalid history date: {value}"))
}

async fn read_timekeep_config() -> Result<Value, String> {
    let path = Path::new(TIMEKEEP_CONFIG_PATH);
    if !path.exists() {
        return Ok(json!({
            "wakatime": { "enabled": false },
            "wakapi": { "enabled": false },
        }));
    }
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|error| format!("failed to read Timekeep config: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("invalid Timekeep config: {error}"))
}

async fn write_timekeep_config(config: &Value) -> Result<(), String> {
    let path = Path::new(TIMEKEEP_CONFIG_PATH);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("failed to create Timekeep config directory: {error}"))?;
    }
    let content = serde_json::to_vec_pretty(config)
        .map_err(|error| format!("failed to serialize Timekeep config: {error}"))?;
    tokio::fs::write(path, content)
        .await
        .map_err(|error| format!("failed to write Timekeep config: {error}"))
}

#[cfg(target_os = "windows")]
async fn service_pipe_is_available() -> bool {
    use tokio::net::windows::named_pipe::ClientOptions;
    ClientOptions::new()
        .read(true)
        .write(true)
        .open(TIMEKEEP_PIPE_PATH)
        .is_ok()
}

#[cfg(not(target_os = "windows"))]
async fn service_pipe_is_available() -> bool {
    Path::new(TIMEKEEP_SOCKET_PATH).exists()
}

#[cfg(target_os = "windows")]
async fn refresh_service() -> Result<(), String> {
    use tokio::net::windows::named_pipe::ClientOptions;
    if !service_pipe_is_available().await {
        return Ok(());
    }
    let mut stream = ClientOptions::new()
        .read(true)
        .write(true)
        .open(TIMEKEEP_PIPE_PATH)
        .map_err(|error| format!("failed to connect to Timekeep service: {error}"))?;
    stream
        .write_all(
            br#"{"action":"refresh"}
"#,
        )
        .await
        .map_err(|error| format!("failed to notify Timekeep service: {error}"))?;
    stream
        .flush()
        .await
        .map_err(|error| format!("failed to flush Timekeep refresh: {error}"))
}

#[cfg(all(unix, not(target_os = "windows")))]
async fn refresh_service() -> Result<(), String> {
    let mut stream = tokio::net::UnixStream::connect(TIMEKEEP_SOCKET_PATH)
        .await
        .map_err(|error| format!("failed to connect to Timekeep service: {error}"))?;
    stream
        .write_all(
            br#"{"action":"refresh"}
"#,
        )
        .await
        .map_err(|error| format!("failed to notify Timekeep service: {error}"))?;
    stream
        .flush()
        .await
        .map_err(|error| format!("failed to flush Timekeep refresh: {error}"))
}

#[cfg(test)]
async fn send_json<S>(mut stream: S, request: TimekeepRequest) -> Result<Value, String>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let mut payload = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    payload.push(b'\n');
    stream
        .write_all(&payload)
        .await
        .map_err(|error| error.to_string())?;
    stream.flush().await.map_err(|error| error.to_string())?;

    let mut response_line = String::new();
    BufReader::new(stream)
        .read_line(&mut response_line)
        .await
        .map_err(|error| error.to_string())?;
    if response_line.trim().is_empty() {
        return Err("Timekeep service returned an empty response".to_string());
    }

    serde_json::from_str(response_line.trim()).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{duplex, AsyncBufReadExt, AsyncWriteExt, BufReader};

    #[tokio::test]
    async fn send_json_round_trips_a_structured_response() {
        let (client, server) = duplex(4096);
        let server_task = tokio::spawn(async move {
            let mut reader = BufReader::new(server);
            let mut request_line = String::new();
            reader.read_line(&mut request_line).await.unwrap();
            let request: TimekeepRequest = serde_json::from_str(request_line.trim()).unwrap();
            assert_eq!(request.request_id, "rust-test-request");
            assert_eq!(request.action, "service_status");

            let mut server = reader.into_inner();
            server
                .write_all(
                    br#"{"request_id":"rust-test-request","ok":true,"data":{"running":true}}"#,
                )
                .await
                .unwrap();
            server.write_all(b"\n").await.unwrap();
        });

        let response = send_json(
            client,
            TimekeepRequest {
                request_id: "rust-test-request".to_string(),
                action: "service_status".to_string(),
                name: None,
                pid: None,
                category: None,
                project: None,
                date: None,
                start: None,
                end: None,
                limit: None,
                all: None,
                config: None,
                programs: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(response["ok"], true);
        assert_eq!(response["data"]["running"], true);
        server_task.await.unwrap();
    }

    #[test]
    fn focused_usage_delta_is_bounded_to_one_poll_window() {
        let start = chrono::DateTime::parse_from_rfc3339("2026-09-04T10:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);

        assert_eq!(
            bounded_usage_delta(start, start + chrono::Duration::seconds(1)),
            1
        );
        assert_eq!(
            bounded_usage_delta(start, start + chrono::Duration::seconds(30)),
            2
        );
        assert_eq!(
            bounded_usage_delta(start, start - chrono::Duration::seconds(1)),
            0
        );
    }
}
