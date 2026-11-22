use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_i = MenuItem::with_id(app, "open", "Open SnapVault", true, None::<&str>)?;
    let backup_i = MenuItem::with_id(app, "backup", "Back Up Now", true, None::<&str>)?;
    let pause_i = MenuItem::with_id(app, "pause", "Pause Backups (2 Hours)", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_i, &backup_i, &pause_i, &quit_i])?;

    let icon = app.default_window_icon().cloned().ok_or("No default icon")?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("SnapVault — Windows 11 Visual Backup Time Machine")
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "backup" => {
                    // Emit trigger event to frontend or trigger default job
                    let _ = app.emit("tray-trigger-backup", ());
                }
                "pause" => {
                    let _ = app.emit("tray-pause-backups", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn dispatch_toast(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Configures background worker thread priority for Quiet Mode.
/// Lowering thread priority to THREAD_PRIORITY_BELOW_NORMAL ensures
/// background FastCDC chunking and BLAKE3 hashing never interfere with
/// foreground gaming, video calls, or heavy interactive workflows.
pub fn apply_quiet_mode_priority(enabled: bool) {
    #[cfg(windows)]
    {
        extern "system" {
            fn GetCurrentThread() -> *mut std::ffi::c_void;
            fn SetThreadPriority(h_thread: *mut std::ffi::c_void, n_priority: i32) -> i32;
        }
        const THREAD_PRIORITY_NORMAL: i32 = 0;
        const THREAD_PRIORITY_BELOW_NORMAL: i32 = -1;

        let priority = if enabled {
            THREAD_PRIORITY_BELOW_NORMAL
        } else {
            THREAD_PRIORITY_NORMAL
        };

        // SAFETY: Calling GetCurrentThread and SetThreadPriority with valid Win32 constants
        unsafe {
            let handle = GetCurrentThread();
            SetThreadPriority(handle, priority);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
    }
}
