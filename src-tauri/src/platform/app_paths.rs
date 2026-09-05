use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

pub const PRODUCT_FOLDER: &str = "TimekeepGUI";
pub const PRODUCT_FOLDER_LOCAL: &str = "TimekeepGUI Local";
pub const PRODUCT_FOLDER_DEV: &str = "TimekeepGUI Dev";

pub const IDENTIFIER_PROD: &str = "com.mamekokwai.timekeepgui";
pub const IDENTIFIER_LOCAL: &str = "com.mamekokwai.timekeepgui.local";
pub const IDENTIFIER_DEV: &str = "com.mamekokwai.timekeepgui.dev";

const LEGACY_PRODUCT_FOLDER: &str = "Patina";
const LEGACY_PRODUCT_FOLDER_LOCAL: &str = "Patina Local";
const LEGACY_PRODUCT_FOLDER_DEV: &str = "Patina Dev";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AppProfile {
    Production,
    Local,
    Dev,
}

impl AppProfile {
    pub fn from_identifier(identifier: &str) -> Self {
        match identifier {
            IDENTIFIER_PROD => Self::Production,
            IDENTIFIER_LOCAL => Self::Local,
            IDENTIFIER_DEV => Self::Dev,
            _ => Self::Production,
        }
    }

    pub fn product_folder(self) -> &'static str {
        match self {
            Self::Production => PRODUCT_FOLDER,
            Self::Local => PRODUCT_FOLDER_LOCAL,
            Self::Dev => PRODUCT_FOLDER_DEV,
        }
    }

    pub fn legacy_product_folder(self) -> &'static str {
        match self {
            Self::Production => LEGACY_PRODUCT_FOLDER,
            Self::Local => LEGACY_PRODUCT_FOLDER_LOCAL,
            Self::Dev => LEGACY_PRODUCT_FOLDER_DEV,
        }
    }

    pub fn webview_product_folder(self) -> &'static str {
        #[cfg(debug_assertions)]
        {
            if self == Self::Production {
                return PRODUCT_FOLDER_DEV;
            }
        }

        self.product_folder()
    }

    pub fn key(self) -> &'static str {
        match self {
            Self::Production => "production",
            Self::Local => "local",
            Self::Dev => "dev",
        }
    }
}

pub fn app_profile<R: Runtime>(app: &AppHandle<R>) -> AppProfile {
    AppProfile::from_identifier(&app.config().identifier)
}

pub fn product_roaming_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let isolated_root = isolated_e2e_root()?;
        ensure_persistent_profile_isolated(app_profile(app), isolated_root.is_some())?;
        if let Some(root) = isolated_root {
            return Ok(root.join("data"));
        }
    }

    let profile = app_profile(app);
    let root = roaming_root(app)?;
    migrate_legacy_product_folder(&root, profile)?;
    let target = root.join(profile.product_folder());
    migrate_legacy_database_name(&target)?;
    Ok(target)
}

pub fn product_webview_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let isolated_root = isolated_e2e_root()?;
        ensure_persistent_profile_isolated(app_profile(app), isolated_root.is_some())?;
        if let Some(root) = isolated_root {
            return Ok(root.join("webview"));
        }
    }

    let profile = app_profile(app);
    let root = local_root(app)?;
    migrate_legacy_webview_folder(&root, profile)?;
    Ok(root.join(profile.webview_product_folder()))
}

fn migrate_legacy_product_folder(root: &Path, profile: AppProfile) -> Result<(), String> {
    let target = root.join(profile.product_folder());
    let legacy = root.join(profile.legacy_product_folder());
    if target.exists() || !legacy.exists() {
        return Ok(());
    }
    copy_directory(&legacy, &target)?;
    migrate_legacy_database_name(&target)?;
    Ok(())
}

fn migrate_legacy_webview_folder(root: &Path, profile: AppProfile) -> Result<(), String> {
    let target = root.join(profile.webview_product_folder());
    let legacy = root.join(profile.legacy_product_folder());
    let legacy_webview = legacy.join("EBWebView");
    if target.join("EBWebView").exists() || !legacy_webview.exists() {
        return Ok(());
    }
    copy_directory(&legacy_webview, &target.join("EBWebView"))
}

fn copy_directory(source: &Path, target: &Path) -> Result<(), String> {
    std::fs::create_dir_all(target).map_err(|error| {
        format!(
            "failed to create migrated directory `{}`: {error}",
            target.display()
        )
    })?;
    for entry in std::fs::read_dir(source).map_err(|error| {
        format!(
            "failed to read legacy directory `{}`: {error}",
            source.display()
        )
    })? {
        let entry =
            entry.map_err(|error| format!("failed to inspect legacy directory: {error}"))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory(&source_path, &target_path)?;
        } else if !target_path.exists() {
            std::fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "failed to migrate `{}` to `{}`: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn migrate_legacy_database_name(data_root: &Path) -> Result<(), String> {
    let legacy = data_root.join("patina.db");
    let target = data_root.join(crate::platform::storage_paths::SQLITE_DB_FILE_NAME);
    if legacy.exists() && !target.exists() {
        std::fs::copy(&legacy, &target).map_err(|error| {
            format!(
                "failed to migrate legacy database `{}`: {error}",
                legacy.display()
            )
        })?;
        for suffix in ["-wal", "-shm"] {
            let old_sidecar = data_root.join(format!("patina.db{suffix}"));
            let new_sidecar = data_root.join(format!("timekeepgui.db{suffix}"));
            if old_sidecar.exists() && !new_sidecar.exists() {
                std::fs::copy(&old_sidecar, &new_sidecar).map_err(|error| {
                    format!(
                        "failed to migrate legacy database sidecar `{}`: {error}",
                        old_sidecar.display()
                    )
                })?;
            }
        }
    }
    Ok(())
}

#[cfg(any(debug_assertions, test))]
fn persistent_profile_is_allowed(
    profile: AppProfile,
    debug_build: bool,
    has_isolated_override: bool,
) -> bool {
    !debug_build || profile != AppProfile::Production || has_isolated_override
}

#[cfg(debug_assertions)]
fn ensure_persistent_profile_isolated(
    profile: AppProfile,
    has_isolated_override: bool,
) -> Result<(), String> {
    if persistent_profile_is_allowed(profile, cfg!(debug_assertions), has_isolated_override) {
        return Ok(());
    }

    Err(
        "refusing to open production TimekeepGUI data from a debug build; start development with `npm run tauri dev` so src-tauri/tauri.dev.conf.json is applied"
            .to_string(),
    )
}

#[cfg(debug_assertions)]
fn isolated_e2e_root() -> Result<Option<PathBuf>, String> {
    if std::env::var("TIMEKEEPGUI_E2E").as_deref() != Ok("1") {
        return Ok(None);
    }

    let root = std::env::var_os("TIMEKEEPGUI_E2E_DATA_ROOT")
        .map(PathBuf::from)
        .ok_or_else(|| {
            "TIMEKEEPGUI_E2E_DATA_ROOT is required when TIMEKEEPGUI_E2E=1".to_string()
        })?;
    if !root.is_absolute() {
        return Err("TIMEKEEPGUI_E2E_DATA_ROOT must be absolute".to_string());
    }
    Ok(Some(root))
}

fn roaming_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    parent_of_identifier_dir(
        app.path()
            .app_data_dir()
            .map_err(|error| format!("failed to resolve app data dir: {error}"))?,
    )
}

fn local_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    parent_of_identifier_dir(
        app.path()
            .app_local_data_dir()
            .map_err(|error| format!("failed to resolve app local data dir: {error}"))?,
    )
}

fn parent_of_identifier_dir(path: PathBuf) -> Result<PathBuf, String> {
    path.parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "failed to resolve parent directory for identifier path `{}`",
                path.display()
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_profile_from_current_identifiers() {
        assert_eq!(
            AppProfile::from_identifier("com.mamekokwai.timekeepgui"),
            AppProfile::Production
        );
        assert_eq!(
            AppProfile::from_identifier("com.mamekokwai.timekeepgui.local"),
            AppProfile::Local
        );
        assert_eq!(
            AppProfile::from_identifier("com.mamekokwai.timekeepgui.dev"),
            AppProfile::Dev
        );
    }

    #[test]
    fn profile_folder_names_are_user_visible() {
        assert_eq!(AppProfile::Production.product_folder(), "TimekeepGUI");
        assert_eq!(AppProfile::Local.product_folder(), "TimekeepGUI Local");
        assert_eq!(AppProfile::Dev.product_folder(), "TimekeepGUI Dev");
    }

    #[test]
    fn debug_production_build_uses_dev_webview_folder() {
        #[cfg(debug_assertions)]
        assert_eq!(
            AppProfile::Production.webview_product_folder(),
            "TimekeepGUI Dev"
        );

        #[cfg(not(debug_assertions))]
        assert_eq!(
            AppProfile::Production.webview_product_folder(),
            "TimekeepGUI"
        );
    }

    #[test]
    fn debug_build_requires_an_isolated_persistent_profile() {
        assert!(!persistent_profile_is_allowed(
            AppProfile::Production,
            true,
            false,
        ));
        assert!(persistent_profile_is_allowed(
            AppProfile::Production,
            true,
            true,
        ));
        assert!(persistent_profile_is_allowed(AppProfile::Dev, true, false,));
        assert!(persistent_profile_is_allowed(
            AppProfile::Local,
            true,
            false,
        ));
    }

    #[test]
    fn release_build_can_use_the_production_profile() {
        assert!(persistent_profile_is_allowed(
            AppProfile::Production,
            false,
            false,
        ));
    }

    #[test]
    fn profile_folder_names_do_not_use_internal_identifiers() {
        for profile in [AppProfile::Production, AppProfile::Local, AppProfile::Dev] {
            let folder = profile.product_folder();
            assert!(!folder.contains("com.mamekokwai.timekeepgui"));
            assert!(!folder.contains("io.github"));
        }
    }

    #[test]
    fn profile_keys_are_stable_anchor_identifiers() {
        assert_eq!(AppProfile::Production.key(), "production");
        assert_eq!(AppProfile::Local.key(), "local");
        assert_eq!(AppProfile::Dev.key(), "dev");
    }
}
