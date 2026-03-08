mod commands;

use commands::websocket::WebSocketState;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(WebSocketState::default())))
        .plugin(tauri_plugin_log::Builder::default().build())
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
