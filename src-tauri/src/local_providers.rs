use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

const LOCAL_PROVIDER_TIMEOUT_MS: u64 = 250;
const OLLAMA_TAGS_ENDPOINT: &str = "/api/tags";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProviderModel {
    id: String,
    model_id: String,
    label: String,
    size_bytes: Option<u64>,
    modified_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaTagModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagModel {
    name: String,
    #[serde(default)]
    modified_at: Option<String>,
    #[serde(default)]
    size: Option<u64>,
}

fn ollama_address() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], 11434))
}

fn is_tcp_service_available(address: SocketAddr, timeout: Duration) -> bool {
    TcpStream::connect_timeout(&address, timeout).is_ok()
}

fn detect_ollama_available() -> bool {
    is_tcp_service_available(
        ollama_address(),
        Duration::from_millis(LOCAL_PROVIDER_TIMEOUT_MS),
    )
}

fn build_ollama_model_id(model_name: &str) -> String {
    format!("ollama:{model_name}")
}

fn parse_http_response_body(response: &str) -> Result<&str, String> {
    let mut sections = response.splitn(2, "\r\n\r\n");
    let headers = sections
        .next()
        .ok_or_else(|| "Ollama returned an empty response.".to_string())?;
    let body = sections
        .next()
        .ok_or_else(|| "Ollama response did not include a body.".to_string())?;
    let status_line = headers.lines().next().unwrap_or_default();

    if !status_line.contains(" 200 ") {
        return Err(format!("Ollama returned a non-success response: {status_line}"));
    }

    Ok(body)
}

fn parse_ollama_models_from_json(json: &str) -> Result<Vec<LocalProviderModel>, String> {
    let response: OllamaTagsResponse =
        serde_json::from_str(json).map_err(|error| format!("Invalid Ollama tags payload: {error}"))?;

    Ok(response
        .models
        .into_iter()
        .map(|model| LocalProviderModel {
            id: build_ollama_model_id(&model.name),
            label: model.name.clone(),
            model_id: model.name,
            size_bytes: model.size,
            modified_at: model.modified_at,
        })
        .collect())
}

fn fetch_ollama_models() -> Result<Vec<LocalProviderModel>, String> {
    let timeout = Duration::from_millis(LOCAL_PROVIDER_TIMEOUT_MS);
    let mut stream = TcpStream::connect_timeout(&ollama_address(), timeout)
        .map_err(|error| format!("Failed to connect to Ollama: {error}"))?;

    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| format!("Failed to configure Ollama read timeout: {error}"))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| format!("Failed to configure Ollama write timeout: {error}"))?;

    let request =
        format!("GET {OLLAMA_TAGS_ENDPOINT} HTTP/1.1\r\nHost: 127.0.0.1:11434\r\nConnection: close\r\n\r\n");
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Failed to request Ollama tags: {error}"))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("Failed to read Ollama tags response: {error}"))?;

    let body = parse_http_response_body(&response)?;
    parse_ollama_models_from_json(body)
}

#[tauri::command]
pub fn get_local_provider_statuses() -> BTreeMap<String, bool> {
    let mut statuses = BTreeMap::new();
    statuses.insert("ollama".to_string(), detect_ollama_available());
    statuses
}

#[tauri::command]
pub fn get_local_provider_models() -> Result<BTreeMap<String, Vec<LocalProviderModel>>, String> {
    let mut models = BTreeMap::new();
    let ollama_models = if detect_ollama_available() {
        fetch_ollama_models()?
    } else {
        Vec::new()
    };

    models.insert("ollama".to_string(), ollama_models);
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::{
        get_local_provider_models, get_local_provider_statuses, parse_http_response_body,
        parse_ollama_models_from_json, LocalProviderModel,
    };

    #[test]
    fn returns_the_expected_local_provider_key() {
        let statuses = get_local_provider_statuses();

        assert!(statuses.contains_key("ollama"));
    }

    #[test]
    fn returns_the_expected_local_provider_models_key() {
        let models = get_local_provider_models().expect("local provider models should resolve");

        assert!(models.contains_key("ollama"));
    }

    #[test]
    fn parses_ollama_models_from_json_payload() {
        let models = parse_ollama_models_from_json(
            r#"{
                "models": [
                    {
                        "name": "qwen3:8b",
                        "modified_at": "2026-03-17T00:00:00.000Z",
                        "size": 4294967296
                    }
                ]
            }"#,
        )
        .expect("valid Ollama tags payload should parse");

        assert_eq!(
            models,
            vec![LocalProviderModel {
                id: "ollama:qwen3:8b".to_string(),
                model_id: "qwen3:8b".to_string(),
                label: "qwen3:8b".to_string(),
                size_bytes: Some(4294967296),
                modified_at: Some("2026-03-17T00:00:00.000Z".to_string()),
            }]
        );
    }

    #[test]
    fn rejects_non_success_http_statuses() {
        let error = parse_http_response_body("HTTP/1.1 500 Internal Server Error\r\n\r\n{}")
            .expect_err("non-success status should fail");

        assert!(error.contains("non-success"));
    }
}
