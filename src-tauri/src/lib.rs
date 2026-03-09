mod commands;

use commands::websocket::WebSocketState;
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(WebSocketState::default())))
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create custom menu items
            let check_updates = MenuItemBuilder::with_id("check_updates", "Check for Updates...")
                .build(app)?;

            // Create the app submenu (appears as "Posty" on macOS)
            let app_submenu = SubmenuBuilder::new(app, "Posty")
                .about(None)
                .separator()
                .item(&check_updates)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            // Create Edit menu for copy/paste support
            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            // Create Window menu
            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .close_window()
                .separator()
                .fullscreen()
                .build()?;

            // Build the complete menu
            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check_updates" {
                // Emit event to frontend to trigger update check
                let _ = app.emit("check-for-updates", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            // HTTP
            commands::http::send_http_request,
            // WebSocket
            commands::websocket::websocket_connect,
            commands::websocket::websocket_send,
            commands::websocket::websocket_disconnect,
            // GraphQL
            commands::graphql::send_graphql_request,
            commands::graphql::introspect_graphql_schema,
            // OpenAPI
            commands::openapi::parse_openapi_spec,
            commands::openapi::fetch_and_parse_openapi,
            commands::openapi::pick_openapi_file,
            commands::openapi::parse_openapi_file,
            commands::openapi::get_openapi_file_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
