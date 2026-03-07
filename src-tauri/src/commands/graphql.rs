use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLResponse {
    pub data: Option<serde_json::Value>,
    pub errors: Option<Vec<GraphQLError>>,
    pub status: u16,
    pub time: u64,
    pub size: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locations: Option<Vec<GraphQLLocation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLLocation {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLSchema {
    pub types: Vec<GraphQLType>,
    pub query_type: Option<String>,
    pub mutation_type: Option<String>,
    pub subscription_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLType {
    pub name: String,
    pub kind: String,
    pub fields: Option<Vec<GraphQLField>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLField {
    pub name: String,
    pub r#type: String,
    pub args: Vec<GraphQLArg>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLArg {
    pub name: String,
    pub r#type: String,
}

#[tauri::command]
pub async fn send_graphql_request(
    url: String,
    query: String,
    variables: Option<String>,
    headers: HashMap<String, String>,
) -> Result<GraphQLResponse, String> {
    let client = Client::new();
    let start = Instant::now();

    let variables_json: Option<serde_json::Value> = match variables {
        Some(v) if !v.is_empty() => {
            Some(serde_json::from_str(&v).map_err(|e| format!("Invalid variables JSON: {}", e))?)
        }
        _ => None,
    };

    let graphql_request = GraphQLRequest {
        query,
        variables: variables_json,
        operation_name: None,
    };

    let mut request = client.post(&url).json(&graphql_request);

    // Add custom headers
    for (key, value) in headers {
        request = request.header(&key, &value);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    let elapsed = start.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    let body_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let size = body_bytes.len();

    let graphql_response: serde_json::Value =
        serde_json::from_slice(&body_bytes).map_err(|e| format!("Invalid JSON response: {}", e))?;

    Ok(GraphQLResponse {
        data: graphql_response.get("data").cloned(),
        errors: graphql_response
            .get("errors")
            .and_then(|e| serde_json::from_value(e.clone()).ok()),
        status,
        time: elapsed,
        size,
    })
}

#[tauri::command]
pub async fn introspect_graphql_schema(
    url: String,
    headers: HashMap<String, String>,
) -> Result<GraphQLSchema, String> {
    let introspection_query = r#"
        query IntrospectionQuery {
            __schema {
                queryType { name }
                mutationType { name }
                subscriptionType { name }
                types {
                    name
                    kind
                    fields(includeDeprecated: true) {
                        name
                        type { name kind ofType { name kind } }
                        args {
                            name
                            type { name kind ofType { name kind } }
                        }
                    }
                }
            }
        }
    "#;

    let response = send_graphql_request(url, introspection_query.to_string(), None, headers).await?;

    if let Some(data) = response.data {
        let schema = data.get("__schema").ok_or("No schema in response")?;

        let types: Vec<GraphQLType> = schema
            .get("types")
            .and_then(|t| t.as_array())
            .map(|types| {
                types
                    .iter()
                    .filter_map(|t| {
                        let name = t.get("name")?.as_str()?.to_string();
                        if name.starts_with("__") {
                            return None; // Skip introspection types
                        }
                        let kind = t.get("kind")?.as_str()?.to_string();
                        let fields = t.get("fields").and_then(|f| f.as_array()).map(|fields| {
                            fields
                                .iter()
                                .filter_map(|f| {
                                    let name = f.get("name")?.as_str()?.to_string();
                                    let type_info = f.get("type")?;
                                    let type_name = type_info
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string();
                                    let args = f
                                        .get("args")
                                        .and_then(|a| a.as_array())
                                        .map(|args| {
                                            args.iter()
                                                .filter_map(|a| {
                                                    Some(GraphQLArg {
                                                        name: a.get("name")?.as_str()?.to_string(),
                                                        r#type: a
                                                            .get("type")?
                                                            .get("name")
                                                            .and_then(|n| n.as_str())
                                                            .unwrap_or("Unknown")
                                                            .to_string(),
                                                    })
                                                })
                                                .collect()
                                        })
                                        .unwrap_or_default();
                                    Some(GraphQLField {
                                        name,
                                        r#type: type_name,
                                        args,
                                    })
                                })
                                .collect()
                        });
                        Some(GraphQLType { name, kind, fields })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(GraphQLSchema {
            types,
            query_type: schema
                .get("queryType")
                .and_then(|q| q.get("name"))
                .and_then(|n| n.as_str())
                .map(String::from),
            mutation_type: schema
                .get("mutationType")
                .and_then(|m| m.get("name"))
                .and_then(|n| n.as_str())
                .map(String::from),
            subscription_type: schema
                .get("subscriptionType")
                .and_then(|s| s.get("name"))
                .and_then(|n| n.as_str())
                .map(String::from),
        })
    } else {
        Err("Failed to introspect schema".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graphql_request_serialization() {
        let request = GraphQLRequest {
            query: "query { user { id } }".to_string(),
            variables: Some(serde_json::json!({"id": 1})),
            operation_name: Some("GetUser".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("query"));
        assert!(json.contains("user"));
    }

    #[tokio::test]
    async fn test_graphql_request_to_public_api() {
        // Test against a public GraphQL API
        let response = send_graphql_request(
            "https://countries.trevorblades.com/graphql".to_string(),
            "query { countries { code name } }".to_string(),
            None,
            HashMap::new(),
        )
        .await;

        assert!(response.is_ok());
        let response = response.unwrap();
        assert_eq!(response.status, 200);
        assert!(response.data.is_some());
    }
}
