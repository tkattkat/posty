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
    cookies: Option<HashMap<String, String>>,
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

    // Add cookies as Cookie header
    if let Some(cookie_map) = cookies {
        if !cookie_map.is_empty() {
            let cookie_header: String = cookie_map
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("; ");
            request = request.header("Cookie", cookie_header);
        }
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
    use wiremock::matchers::{body_string_contains, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_send_get_request() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/get"))
            .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"ok":true}"#))
            .mount(&server)
            .await;

        let response = send_http_request(
            "GET".to_string(),
            format!("{}/get", server.uri()),
            HashMap::new(),
            None,
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("\"ok\":true"));
    }

    #[tokio::test]
    async fn test_send_post_request() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/post"))
            .and(header("content-type", "application/json"))
            .and(body_string_contains("test"))
            .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"saved":true}"#))
            .mount(&server)
            .await;

        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let response = send_http_request(
            "POST".to_string(),
            format!("{}/post", server.uri()),
            headers,
            Some(r#"{"test": "value"}"#.to_string()),
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("\"saved\":true"));
    }

    #[tokio::test]
    async fn test_send_request_with_headers() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/headers"))
            .and(header("x-custom-header", "test-value"))
            .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"headers":{"x-custom-header":"test-value"}}"#))
            .mount(&server)
            .await;

        let mut headers = HashMap::new();
        headers.insert("X-Custom-Header".to_string(), "test-value".to_string());

        let response = send_http_request(
            "GET".to_string(),
            format!("{}/headers", server.uri()),
            headers,
            None,
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.body.contains("test-value"));
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
