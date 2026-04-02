use std::collections::BTreeMap;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

const LOCAL_PROVIDER_TIMEOUT_MS: u64 = 250;

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

#[tauri::command]
pub fn get_local_provider_statuses() -> BTreeMap<String, bool> {
    let mut statuses = BTreeMap::new();
    statuses.insert("ollama".to_string(), detect_ollama_available());
    statuses
}

#[cfg(test)]
mod tests {
    use super::get_local_provider_statuses;

    #[test]
    fn returns_the_expected_local_provider_key() {
        let statuses = get_local_provider_statuses();

        assert!(statuses.contains_key("ollama"));
    }
}
