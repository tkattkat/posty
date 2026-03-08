use openapiv3::{OpenAPI, Schema, SchemaKind, Type};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedCollection {
    pub name: String,
    pub description: Option<String>,
    pub requests: Vec<ImportedRequest>,
    pub folders: Vec<ImportedCollection>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedRequest {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValue>,
    pub params: Vec<KeyValue>,
    pub body: Option<RequestBody>,
    pub tests: Vec<ImportedRequestTest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedRequestTest {
    pub id: String,
    pub enabled: bool,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_status: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyValue {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestBody {
    pub r#type: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PickedOpenApiFile {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenApiFileMetadata {
    pub modified_at: u64,
}

/// Generate example JSON body from schema
fn generate_example_json(schema: &Schema, openapi: &OpenAPI, depth: usize) -> Value {
    if depth > 5 {
        return json!({});
    }

    match &schema.schema_kind {
        SchemaKind::Type(Type::Object(obj)) => {
            let mut map = serde_json::Map::new();
            for (name, prop_schema) in &obj.properties {
                match prop_schema {
                    openapiv3::ReferenceOr::Item(prop) => {
                        map.insert(name.clone(), generate_example_json(prop, openapi, depth + 1));
                    }
                    openapiv3::ReferenceOr::Reference { reference } => {
                        if let Some(resolved) = resolve_schema_ref(reference, openapi) {
                            map.insert(name.clone(), generate_example_json(resolved, openapi, depth + 1));
                        }
                    }
                }
            }
            Value::Object(map)
        }
        SchemaKind::Type(Type::Array(arr)) => {
            if let Some(items) = &arr.items {
                match items {
                    openapiv3::ReferenceOr::Item(item_schema) => {
                        json!([generate_example_json(item_schema, openapi, depth + 1)])
                    }
                    openapiv3::ReferenceOr::Reference { reference } => {
                        if let Some(resolved) = resolve_schema_ref(reference, openapi) {
                            json!([generate_example_json(resolved, openapi, depth + 1)])
                        } else {
                            json!([])
                        }
                    }
                }
            } else {
                json!([])
            }
        }
        SchemaKind::Type(Type::String(s)) => {
            use openapiv3::StringFormat;
            use openapiv3::VariantOrUnknownOrEmpty;
            match &s.format {
                VariantOrUnknownOrEmpty::Item(StringFormat::Date) => json!("2024-01-01"),
                VariantOrUnknownOrEmpty::Item(StringFormat::DateTime) => json!("2024-01-01T00:00:00Z"),
                VariantOrUnknownOrEmpty::Unknown(f) if f == "email" => json!("user@example.com"),
                VariantOrUnknownOrEmpty::Unknown(f) if f == "uuid" => json!("550e8400-e29b-41d4-a716-446655440000"),
                _ => json!("string"),
            }
        }
        SchemaKind::Type(Type::Integer(_)) => json!(0),
        SchemaKind::Type(Type::Number(_)) => json!(0.0),
        SchemaKind::Type(Type::Boolean { .. }) => json!(true),
        _ => json!(null),
    }
}

/// Resolve a $ref to its schema
fn resolve_schema_ref<'a>(reference: &str, openapi: &'a OpenAPI) -> Option<&'a Schema> {
    let parts: Vec<&str> = reference.split('/').collect();
    if parts.len() >= 4 && parts[1] == "components" && parts[2] == "schemas" {
        let schema_name = parts[3];
        if let Some(components) = &openapi.components {
            if let Some(openapiv3::ReferenceOr::Item(schema)) = components.schemas.get(schema_name) {
                return Some(schema);
            }
        }
    }
    None
}

fn resolve_request_body_ref<'a>(
    reference: &str,
    openapi: &'a OpenAPI,
) -> Option<&'a openapiv3::RequestBody> {
    let parts: Vec<&str> = reference.split('/').collect();
    if parts.len() >= 4 && parts[1] == "components" && parts[2] == "requestBodies" {
        let body_name = parts[3];
        if let Some(components) = &openapi.components {
            if let Some(openapiv3::ReferenceOr::Item(body)) = components.request_bodies.get(body_name) {
                return Some(body);
            }
        }
    }
    None
}

fn resolve_security_scheme_ref<'a>(
    reference: &str,
    openapi: &'a OpenAPI,
) -> Option<&'a openapiv3::SecurityScheme> {
    let parts: Vec<&str> = reference.split('/').collect();
    if parts.len() >= 4 && parts[1] == "components" && parts[2] == "securitySchemes" {
        let scheme_name = parts[3];
        if let Some(components) = &openapi.components {
            if let Some(openapiv3::ReferenceOr::Item(scheme)) = components.security_schemes.get(scheme_name) {
                return Some(scheme);
            }
        }
    }
    None
}

fn add_header_if_missing(headers: &mut Vec<KeyValue>, key: String, description: Option<String>) {
    if headers.iter().any(|header| header.key.eq_ignore_ascii_case(&key)) {
        return;
    }

    headers.push(KeyValue {
        id: uuid::Uuid::new_v4().to_string(),
        key,
        value: String::new(),
        enabled: true,
        description,
    });
}

fn apply_security_requirements(
    headers: &mut Vec<KeyValue>,
    security: &[openapiv3::SecurityRequirement],
    openapi: &OpenAPI,
) {
    for requirement in security {
        for (scheme_name, _) in requirement.iter() {
            let scheme = openapi
                .components
                .as_ref()
                .and_then(|components| components.security_schemes.get(scheme_name))
                .and_then(|scheme_ref| match scheme_ref {
                    openapiv3::ReferenceOr::Item(scheme) => Some(scheme),
                    openapiv3::ReferenceOr::Reference { reference } => {
                        resolve_security_scheme_ref(reference, openapi)
                    }
                });

            if let Some(openapiv3::SecurityScheme::APIKey { location, name, description, .. }) = scheme {
                if matches!(location, openapiv3::APIKeyLocation::Header) {
                    add_header_if_missing(headers, name.clone(), description.clone());
                }
            }
        }
    }
}

fn extract_media_type_content(
    media_type: &openapiv3::MediaType,
    openapi: &OpenAPI,
) -> String {
    if let Some(example) = &media_type.example {
        return serde_json::to_string_pretty(example).unwrap_or_else(|_| example.to_string());
    }

    if let Some(example) = media_type.examples.values().find_map(|example_ref| match example_ref {
        openapiv3::ReferenceOr::Item(example) => example.value.as_ref(),
        openapiv3::ReferenceOr::Reference { .. } => None,
    }) {
        return serde_json::to_string_pretty(example).unwrap_or_else(|_| example.to_string());
    }

    if let Some(schema_ref) = &media_type.schema {
        match schema_ref {
            openapiv3::ReferenceOr::Item(schema) => {
                let example = generate_example_json(schema, openapi, 0);
                serde_json::to_string_pretty(&example).unwrap_or_else(|_| "{}".to_string())
            }
            openapiv3::ReferenceOr::Reference { reference } => {
                if let Some(resolved) = resolve_schema_ref(reference, openapi) {
                    let example = generate_example_json(resolved, openapi, 0);
                    serde_json::to_string_pretty(&example).unwrap_or_else(|_| "{}".to_string())
                } else {
                    "{}".to_string()
                }
            }
        }
    } else {
        "{}".to_string()
    }
}

fn extract_default_request_tests(op: &openapiv3::Operation) -> Vec<ImportedRequestTest> {
    let success_status = op
        .responses
        .responses
        .iter()
        .filter_map(|(status_code, _)| match status_code {
            openapiv3::StatusCode::Code(code) if (200..400).contains(code) => Some(*code),
            _ => None,
        })
        .min();

    success_status
        .map(|status| {
            vec![ImportedRequestTest {
                id: uuid::Uuid::new_v4().to_string(),
                enabled: true,
                r#type: "status-code".to_string(),
                label: Some(format!("Status is {}", status)),
                expected_status: Some(status),
            }]
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn parse_openapi_spec(spec_content: String) -> Result<ImportedCollection, String> {
    let openapi: OpenAPI =
        serde_json::from_str(&spec_content).or_else(|_| serde_yaml::from_str(&spec_content))
            .map_err(|e| format!("Failed to parse OpenAPI spec: {}", e))?;

    let title = openapi.info.title.clone();
    let description = openapi.info.description.clone();

    // Get base URL from servers
    let base_url = openapi
        .servers
        .first()
        .map(|s| s.url.clone())
        .unwrap_or_else(|| "{{baseUrl}}".to_string());

    let mut requests: Vec<ImportedRequest> = Vec::new();
    let mut folders: HashMap<String, Vec<ImportedRequest>> = HashMap::new();

    // Parse paths
    for (path, path_item) in openapi.paths.paths.iter() {
        if let openapiv3::ReferenceOr::Item(item) = path_item {
            // Collect path-level parameters
            let path_params: Vec<&openapiv3::Parameter> = item
                .parameters
                .iter()
                .filter_map(|p| {
                    if let openapiv3::ReferenceOr::Item(param) = p {
                        Some(param)
                    } else {
                        None
                    }
                })
                .collect();

            // Process each HTTP method
            let methods = [
                ("GET", &item.get),
                ("POST", &item.post),
                ("PUT", &item.put),
                ("PATCH", &item.patch),
                ("DELETE", &item.delete),
                ("OPTIONS", &item.options),
                ("HEAD", &item.head),
            ];

            for (method, operation) in methods {
                if let Some(op) = operation {
                    let op_name = op
                        .summary
                        .clone()
                        .or_else(|| op.operation_id.clone())
                        .unwrap_or_else(|| format!("{} {}", method, path));

                    // Extract parameters (combine path-level and operation-level)
                    let mut params: Vec<KeyValue> = Vec::new();
                    let mut headers: Vec<KeyValue> = Vec::new();

                    // Helper to process a parameter
                    let mut process_param = |param: &openapiv3::Parameter| {
                        let data = param.parameter_data_ref();
                        let description = data.description.clone();

                        let kv = KeyValue {
                            id: uuid::Uuid::new_v4().to_string(),
                            key: data.name.clone(),
                            value: String::new(),
                            enabled: data.required,
                            description,
                        };

                        match param {
                            openapiv3::Parameter::Query { .. } => params.push(kv),
                            openapiv3::Parameter::Header { .. } => headers.push(kv),
                            openapiv3::Parameter::Path { .. } => {
                                // Add path params to params list with placeholder value
                                let mut path_kv = kv;
                                path_kv.value = format!("{{{}}}", path_kv.key);
                                path_kv.enabled = true; // Path params are always required
                                params.push(path_kv);
                            }
                            openapiv3::Parameter::Cookie { .. } => {
                                // Skip cookies for now
                            }
                        }
                    };

                    // Process path-level parameters first
                    for param in &path_params {
                        process_param(param);
                    }

                    // Process operation-level parameters
                    for param_ref in &op.parameters {
                        if let openapiv3::ReferenceOr::Item(param) = param_ref {
                            process_param(param);
                        }
                    }

                    let effective_security = op
                        .security
                        .clone()
                        .unwrap_or_else(|| openapi.security.clone().unwrap_or_default());
                    apply_security_requirements(&mut headers, &effective_security, &openapi);

                    // Extract request body and add Content-Type header
                    let body = if let Some(ref body_ref) = op.request_body {
                        let body = match body_ref {
                            openapiv3::ReferenceOr::Item(body) => Some(body),
                            openapiv3::ReferenceOr::Reference { reference } => {
                                resolve_request_body_ref(reference, &openapi)
                            }
                        };

                        if let Some(body) = body {
                            if let Some(media_type) = body.content.get("application/json") {
                                // Add Content-Type header
                                add_header_if_missing(&mut headers, "Content-Type".to_string(), None);
                                if let Some(content_type) = headers.iter_mut().find(|header| header.key == "Content-Type") {
                                    content_type.value = "application/json".to_string();
                                }

                                let content = extract_media_type_content(media_type, &openapi);

                                Some(RequestBody {
                                    r#type: "json".to_string(),
                                    content,
                                })
                            } else if body.content.contains_key("application/x-www-form-urlencoded") {
                                add_header_if_missing(&mut headers, "Content-Type".to_string(), None);
                                if let Some(content_type) = headers.iter_mut().find(|header| header.key == "Content-Type") {
                                    content_type.value = "application/x-www-form-urlencoded".to_string();
                                }
                                Some(RequestBody {
                                    r#type: "form".to_string(),
                                    content: String::new(),
                                })
                            } else if body.content.contains_key("text/plain") {
                                add_header_if_missing(&mut headers, "Content-Type".to_string(), None);
                                if let Some(content_type) = headers.iter_mut().find(|header| header.key == "Content-Type") {
                                    content_type.value = "text/plain".to_string();
                                }
                                Some(RequestBody {
                                    r#type: "text".to_string(),
                                    content: body
                                        .content
                                        .get("text/plain")
                                        .map(|media_type| extract_media_type_content(media_type, &openapi))
                                        .unwrap_or_default(),
                                })
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    let request = ImportedRequest {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: op_name,
                        method: method.to_string(),
                        url: format!("{}{}", base_url, path),
                        headers,
                        params,
                        body,
                        tests: extract_default_request_tests(op),
                    };

                    // Group by tag if available
                    if let Some(tag) = op.tags.first() {
                        folders.entry(tag.clone()).or_default().push(request);
                    } else {
                        requests.push(request);
                    }
                }
            }
        }
    }

    // Convert folders map to folder structs (sorted alphabetically)
    let mut folder_structs: Vec<ImportedCollection> = folders
        .into_iter()
        .map(|(name, reqs)| ImportedCollection {
            name,
            description: None,
            requests: reqs,
            folders: Vec::new(),
        })
        .collect();
    folder_structs.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(ImportedCollection {
        name: title,
        description,
        requests,
        folders: folder_structs,
    })
}

#[tauri::command]
pub async fn fetch_and_parse_openapi(url: String) -> Result<ImportedCollection, String> {
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let content = response.text().await.map_err(|e| e.to_string())?;
    parse_openapi_spec(content)
}

#[tauri::command]
pub fn pick_openapi_file() -> Result<PickedOpenApiFile, String> {
    let file = rfd::FileDialog::new()
        .add_filter("OpenAPI", &["json", "yaml", "yml"])
        .pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    Ok(PickedOpenApiFile {
        path: file.display().to_string(),
    })
}

#[tauri::command]
pub fn parse_openapi_file(file_path: String) -> Result<ImportedCollection, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read spec file '{}': {}", file_path, e))?;

    parse_openapi_spec(content)
}

#[tauri::command]
pub fn get_openapi_file_metadata(file_path: String) -> Result<OpenApiFileMetadata, String> {
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read metadata for '{}': {}", file_path, e))?;

    let modified = metadata
        .modified()
        .map_err(|e| format!("Failed to read modified time for '{}': {}", file_path, e))?;

    let modified_at = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Invalid modified time for '{}': {}", file_path, e))?
        .as_millis() as u64;

    Ok(OpenApiFileMetadata { modified_at })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_openapi_spec() {
        let spec = r##"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "servers": [
                {"url": "https://api.example.com"}
            ],
            "paths": {
                "/users": {
                    "get": {
                        "summary": "List users",
                        "responses": {
                            "200": {
                                "description": "Success"
                            }
                        }
                    },
                    "post": {
                        "summary": "Create user",
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "201": {
                                "description": "Created"
                            }
                        }
                    }
                }
            }
        }
        "##;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        assert_eq!(collection.name, "Test API");
        assert_eq!(collection.requests.len(), 2);

        let get_request = collection.requests.iter().find(|r| r.method == "GET").unwrap();
        assert_eq!(get_request.name, "List users");
        assert_eq!(get_request.url, "https://api.example.com/users");

        let post_request = collection.requests.iter().find(|r| r.method == "POST").unwrap();
        assert_eq!(post_request.name, "Create user");
        assert!(post_request.body.is_some());
    }

    #[test]
    fn test_parse_openapi_with_tags() {
        let spec = r##"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Tagged API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "get": {
                        "tags": ["Users"],
                        "summary": "List users",
                        "responses": { "200": { "description": "OK" } }
                    }
                },
                "/posts": {
                    "get": {
                        "tags": ["Posts"],
                        "summary": "List posts",
                        "responses": { "200": { "description": "OK" } }
                    }
                }
            }
        }
        "##;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        assert_eq!(collection.folders.len(), 2);

        let users_folder = collection.folders.iter().find(|f| f.name == "Users");
        assert!(users_folder.is_some());
        assert_eq!(users_folder.unwrap().requests.len(), 1);
    }

    #[test]
    fn test_parse_openapi_with_parameters() {
        let spec = r##"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Param API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "get": {
                        "summary": "List users",
                        "parameters": [
                            {
                                "name": "limit",
                                "in": "query",
                                "required": false,
                                "schema": { "type": "integer" }
                            },
                            {
                                "name": "Authorization",
                                "in": "header",
                                "required": true,
                                "schema": { "type": "string" }
                            }
                        ],
                        "responses": { "200": { "description": "OK" } }
                    }
                }
            }
        }
        "##;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        let request = &collection.requests[0];

        assert_eq!(request.params.len(), 1);
        assert_eq!(request.params[0].key, "limit");

        assert_eq!(request.headers.len(), 1);
        assert_eq!(request.headers[0].key, "Authorization");
        assert!(request.headers[0].enabled); // required = true
    }

    #[test]
    fn test_parse_openapi_with_security_schemes() {
        let spec = r#"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Secure API",
                "version": "1.0.0"
            },
            "components": {
                "securitySchemes": {
                    "ApiKeyAuth": {
                        "type": "apiKey",
                        "in": "header",
                        "name": "x-api-key",
                        "description": "API key"
                    },
                    "ProjectId": {
                        "type": "apiKey",
                        "in": "header",
                        "name": "x-project-id"
                    }
                }
            },
            "security": [
                {
                    "ApiKeyAuth": [],
                    "ProjectId": []
                }
            ],
            "paths": {
                "/secure": {
                    "post": {
                        "summary": "Secure endpoint",
                        "responses": { "200": { "description": "OK" } }
                    }
                }
            }
        }
        "#;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        let request = &collection.requests[0];
        let header_keys: Vec<&str> = request.headers.iter().map(|header| header.key.as_str()).collect();

        assert!(header_keys.contains(&"x-api-key"));
        assert!(header_keys.contains(&"x-project-id"));
    }

    #[test]
    fn test_parse_openapi_with_referenced_request_body() {
        let spec = r##"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Body API",
                "version": "1.0.0"
            },
            "components": {
                "requestBodies": {
                    "CreateUserBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "name": { "type": "string" },
                                        "email": { "type": "string", "format": "email" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "paths": {
                "/users": {
                    "post": {
                        "summary": "Create user",
                        "requestBody": {
                            "$ref": "#/components/requestBodies/CreateUserBody"
                        },
                        "responses": { "200": { "description": "OK" } }
                    }
                }
            }
        }
        "##;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        let request = &collection.requests[0];

        assert!(request.body.is_some());
        assert_eq!(request.body.as_ref().unwrap().r#type, "json");
        assert!(request.body.as_ref().unwrap().content.contains("\"email\""));
        assert!(request.headers.iter().any(|header| header.key == "Content-Type"));
    }

    #[test]
    fn test_parse_openapi_adds_default_success_test() {
        let spec = r##"
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Runner API",
                "version": "1.0.0"
            },
            "paths": {
                "/projects": {
                    "post": {
                        "summary": "Create project",
                        "responses": {
                            "201": { "description": "Created" },
                            "400": { "description": "Bad request" }
                        }
                    }
                }
            }
        }
        "##;

        let result = parse_openapi_spec(spec.to_string());
        assert!(result.is_ok());

        let collection = result.unwrap();
        let request = &collection.requests[0];

        assert_eq!(request.tests.len(), 1);
        assert_eq!(request.tests[0].r#type, "status-code");
        assert_eq!(request.tests[0].expected_status, Some(201));
        assert!(request.tests[0].enabled);
    }
}
