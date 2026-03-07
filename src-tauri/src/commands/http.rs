use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time: u64,
    pub size: usize,
}

#[tauri::command]
pub async fn send_http_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let client = Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| e.to_string())?;

    let method = Method::from_bytes(method.as_bytes())
        .map_err(|e| e.to_string())?;

    let start = Instant::now();

    let mut request = client.request(method, &url);

    // Add headers
    for (key, value) in headers {
        request = request.header(&key, &value);
    }

    // Add body if present
    if let Some(body_content) = body {
        request = request.body(body_content);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    let elapsed = start.elapsed().as_millis() as u64;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();
    let status_code = status.as_u16();

    // Extract headers
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    // Get body
    let body_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let size = body_bytes.len();
    let body_text = String::from_utf8_lossy(&body_bytes).to_string();

    Ok(HttpResponse {
        status: status_code,
        status_text,
        headers: response_headers,
        body: body_text,
        time: elapsed,
        size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_send_get_request() {
        let response = send_http_request(
            "GET".to_string(),
            "https://httpbin.org/get".to_string(),
            HashMap::new(),
            None,
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("httpbin.org"));
    }

    #[tokio::test]
    async fn test_send_post_request() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let response = send_http_request(
            "POST".to_string(),
            "https://httpbin.org/post".to_string(),
            headers,
            Some(r#"{"test": "value"}"#.to_string()),
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("test"));
    }

    #[tokio::test]
    async fn test_send_request_with_headers() {
        let mut headers = HashMap::new();
        headers.insert("X-Custom-Header".to_string(), "test-value".to_string());

        let response = send_http_request(
            "GET".to_string(),
            "https://httpbin.org/headers".to_string(),
            headers,
            None,
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("X-Custom-Header"));
    }

    #[tokio::test]
    async fn test_invalid_url() {
        let response = send_http_request(
            "GET".to_string(),
            "not-a-valid-url".to_string(),
            HashMap::new(),
            None,
        )
        .await;

        assert!(response.is_err());
    }
}
