use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub id: String,
    pub direction: String, // "sent" or "received"
    pub content: String,
    pub timestamp: i64,
}

// Store active WebSocket connections
pub struct WebSocketState {
    pub connections: HashMap<String, tokio::sync::mpsc::Sender<String>>,
}

impl Default for WebSocketState {
    fn default() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }
}

#[tauri::command]
pub async fn websocket_connect(
    app: AppHandle,
    connection_id: String,
    url: String,
) -> Result<(), String> {
    let (ws_stream, _) = connect_async(&url)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let (mut write, mut read) = ws_stream.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(32);

    // Store the sender in app state
    let state = app.state::<Arc<Mutex<WebSocketState>>>();
    {
        let mut state = state.lock().await;
        state.connections.insert(connection_id.clone(), tx);
    }

    let app_clone = app.clone();
    let conn_id = connection_id.clone();

    // Spawn task to handle incoming messages
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let ws_msg = WebSocketMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        direction: "received".to_string(),
                        content: text.to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = app_clone.emit(&format!("ws-message-{}", conn_id), ws_msg);
                }
                Ok(Message::Binary(data)) => {
                    let ws_msg = WebSocketMessage {
                        id: uuid::Uuid::new_v4().to_string(),
                        direction: "received".to_string(),
                        content: format!("[Binary: {} bytes]", data.len()),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    };
                    let _ = app_clone.emit(&format!("ws-message-{}", conn_id), ws_msg);
                }
                Ok(Message::Close(_)) => {
                    let _ = app_clone.emit(&format!("ws-closed-{}", conn_id), ());
                    break;
                }
                Err(e) => {
                    let _ = app_clone.emit(&format!("ws-error-{}", conn_id), e.to_string());
                    break;
                }
                _ => {}
            }
        }
    });

    // Spawn task to handle outgoing messages
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn websocket_send(
    app: AppHandle,
    connection_id: String,
    message: String,
) -> Result<(), String> {
    let state = app.state::<Arc<Mutex<WebSocketState>>>();
    let state = state.lock().await;

    if let Some(tx) = state.connections.get(&connection_id) {
        tx.send(message.clone())
            .await
            .map_err(|e| format!("Failed to send: {}", e))?;

        // Emit sent message event
        let ws_msg = WebSocketMessage {
            id: uuid::Uuid::new_v4().to_string(),
            direction: "sent".to_string(),
            content: message,
            timestamp: chrono::Utc::now().timestamp_millis(),
        };
        let _ = app.emit(&format!("ws-message-{}", connection_id), ws_msg);

        Ok(())
    } else {
        Err("Connection not found".to_string())
    }
}

#[tauri::command]
pub async fn websocket_disconnect(app: AppHandle, connection_id: String) -> Result<(), String> {
    let state = app.state::<Arc<Mutex<WebSocketState>>>();
    let mut state = state.lock().await;
    state.connections.remove(&connection_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    // WebSocket tests would require a mock server
    // For now, we test the message structure
    use super::*;

    #[test]
    fn test_websocket_message_serialization() {
        let msg = WebSocketMessage {
            id: "test-id".to_string(),
            direction: "sent".to_string(),
            content: "Hello, WebSocket!".to_string(),
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("sent"));
        assert!(json.contains("Hello, WebSocket!"));
    }
}
