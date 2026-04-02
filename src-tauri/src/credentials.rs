use std::collections::BTreeMap;

use serde::Serialize;

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

const SERVICE_NAME: &str = "ai.alae.desktop";
const EMPTY_KEY_ERROR: &str = "API key cannot be empty.";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const UNSUPPORTED_RUNTIME_ERROR: &str =
    "Secure credential storage is only supported on macOS and Windows in Phase 1.";
const UNKNOWN_PROVIDER_ERROR: &str =
    "Unsupported provider. Expected one of: openai, anthropic, google, openrouter.";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
enum SupportedProvider {
    OpenAi,
    Anthropic,
    Google,
    OpenRouter,
}

impl SupportedProvider {
    const ALL: [Self; 4] = [Self::OpenAi, Self::Anthropic, Self::Google, Self::OpenRouter];

    fn as_str(self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Anthropic => "anthropic",
            Self::Google => "google",
            Self::OpenRouter => "openrouter",
        }
    }
}

impl TryFrom<&str> for SupportedProvider {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "openai" => Ok(Self::OpenAi),
            "anthropic" => Ok(Self::Anthropic),
            "google" => Ok(Self::Google),
            "openrouter" => Ok(Self::OpenRouter),
            _ => Err(UNKNOWN_PROVIDER_ERROR.to_string()),
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ApiKeyMutationResult {
    provider: String,
    configured: bool,
}

trait CredentialStore {
    fn set_password(&self, provider: SupportedProvider, key: &str) -> Result<(), String>;
    fn get_password(&self, provider: SupportedProvider) -> Result<Option<String>, String>;
    fn delete_password(&self, provider: SupportedProvider) -> Result<(), String>;
}

struct NativeCredentialStore;

#[cfg(any(target_os = "macos", target_os = "windows"))]
impl NativeCredentialStore {
    fn entry(provider: SupportedProvider) -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE_NAME, provider.as_str()).map_err(map_keyring_error)
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
impl CredentialStore for NativeCredentialStore {
    fn set_password(&self, provider: SupportedProvider, key: &str) -> Result<(), String> {
        let entry = Self::entry(provider)?;
        entry.set_password(key).map_err(map_keyring_error)
    }

    fn get_password(&self, provider: SupportedProvider) -> Result<Option<String>, String> {
        let entry = Self::entry(provider)?;

        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(map_keyring_error(error)),
        }
    }

    fn delete_password(&self, provider: SupportedProvider) -> Result<(), String> {
        let entry = Self::entry(provider)?;

        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(map_keyring_error(error)),
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
impl CredentialStore for NativeCredentialStore {
    fn set_password(&self, _provider: SupportedProvider, _key: &str) -> Result<(), String> {
        Err(UNSUPPORTED_RUNTIME_ERROR.to_string())
    }

    fn get_password(&self, _provider: SupportedProvider) -> Result<Option<String>, String> {
        Err(UNSUPPORTED_RUNTIME_ERROR.to_string())
    }

    fn delete_password(&self, _provider: SupportedProvider) -> Result<(), String> {
        Err(UNSUPPORTED_RUNTIME_ERROR.to_string())
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn map_keyring_error(error: keyring::Error) -> String {
    match error {
        keyring::Error::NoEntry => "Credential not found in secure store.".to_string(),
        other => format!("Secure store error: {other}"),
    }
}

fn parse_provider(value: &str) -> Result<SupportedProvider, String> {
    SupportedProvider::try_from(value)
}

fn validate_key(key: &str) -> Result<String, String> {
    let sanitized = key.trim();

    if sanitized.is_empty() {
        return Err(EMPTY_KEY_ERROR.to_string());
    }

    Ok(sanitized.to_string())
}

fn set_api_key_with_store(
    store: &impl CredentialStore,
    provider: &str,
    key: &str,
) -> Result<ApiKeyMutationResult, String> {
    let provider = parse_provider(provider)?;
    let sanitized_key = validate_key(key)?;

    store.set_password(provider, &sanitized_key)?;

    Ok(ApiKeyMutationResult {
        provider: provider.as_str().to_string(),
        configured: true,
    })
}

fn delete_api_key_with_store(
    store: &impl CredentialStore,
    provider: &str,
) -> Result<ApiKeyMutationResult, String> {
    let provider = parse_provider(provider)?;
    store.delete_password(provider)?;

    Ok(ApiKeyMutationResult {
        provider: provider.as_str().to_string(),
        configured: false,
    })
}

fn get_api_key_statuses_with_store(
    store: &impl CredentialStore,
) -> Result<BTreeMap<String, bool>, String> {
    let mut statuses = BTreeMap::new();

    for provider in SupportedProvider::ALL {
        let configured = store.get_password(provider)?.is_some();
        statuses.insert(provider.as_str().to_string(), configured);
    }

    Ok(statuses)
}

fn get_api_key_with_store(
    store: &impl CredentialStore,
    provider: &str,
) -> Result<Option<String>, String> {
    let provider = parse_provider(provider)?;
    store.get_password(provider)
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<ApiKeyMutationResult, String> {
    set_api_key_with_store(&NativeCredentialStore, &provider, &key)
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<ApiKeyMutationResult, String> {
    delete_api_key_with_store(&NativeCredentialStore, &provider)
}

#[tauri::command]
pub fn get_api_key_statuses() -> Result<BTreeMap<String, bool>, String> {
    get_api_key_statuses_with_store(&NativeCredentialStore)
}

#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    get_api_key_with_store(&NativeCredentialStore, &provider)
}

#[cfg(test)]
#[derive(Default)]
struct InMemoryCredentialStore {
    values: Mutex<HashMap<&'static str, String>>,
    next_error: Mutex<Option<String>>,
}

#[cfg(test)]
impl InMemoryCredentialStore {
    fn fail_next(&self, message: &str) {
        *self.next_error.lock().expect("poisoned error mutex") = Some(message.to_string());
    }

    fn take_error(&self) -> Option<String> {
        self.next_error.lock().expect("poisoned error mutex").take()
    }
}

#[cfg(test)]
impl CredentialStore for InMemoryCredentialStore {
    fn set_password(&self, provider: SupportedProvider, key: &str) -> Result<(), String> {
        if let Some(error) = self.take_error() {
            return Err(error);
        }

        self.values
            .lock()
            .expect("poisoned value mutex")
            .insert(provider.as_str(), key.to_string());

        Ok(())
    }

    fn get_password(&self, provider: SupportedProvider) -> Result<Option<String>, String> {
        if let Some(error) = self.take_error() {
            return Err(error);
        }

        Ok(self
            .values
            .lock()
            .expect("poisoned value mutex")
            .get(provider.as_str())
            .cloned())
    }

    fn delete_password(&self, provider: SupportedProvider) -> Result<(), String> {
        if let Some(error) = self.take_error() {
            return Err(error);
        }

        self.values
            .lock()
            .expect("poisoned value mutex")
            .remove(provider.as_str());

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ApiKeyMutationResult, InMemoryCredentialStore, delete_api_key_with_store,
        get_api_key_statuses_with_store, get_api_key_with_store, set_api_key_with_store,
    };

    #[test]
    fn saves_and_reads_a_provider_key() {
        let store = InMemoryCredentialStore::default();

        let result = set_api_key_with_store(&store, "openai", "  sk-openai  ").unwrap();
        let stored_key = get_api_key_with_store(&store, "openai").unwrap();

        assert_eq!(
            result,
            ApiKeyMutationResult {
                provider: "openai".to_string(),
                configured: true,
            }
        );
        assert_eq!(stored_key.as_deref(), Some("sk-openai"));
    }

    #[test]
    fn overwrites_existing_values() {
        let store = InMemoryCredentialStore::default();

        set_api_key_with_store(&store, "openai", "sk-old").unwrap();
        set_api_key_with_store(&store, "openai", "sk-new").unwrap();

        let stored_key = get_api_key_with_store(&store, "openai").unwrap();
        assert_eq!(stored_key.as_deref(), Some("sk-new"));
    }

    #[test]
    fn rejects_unknown_providers() {
        let store = InMemoryCredentialStore::default();

        let error = set_api_key_with_store(&store, "mistral", "sk-test").unwrap_err();
        assert!(error.contains("Unsupported provider"));
    }

    #[test]
    fn rejects_empty_values() {
        let store = InMemoryCredentialStore::default();

        let error = set_api_key_with_store(&store, "openai", "   ").unwrap_err();
        assert_eq!(error, "API key cannot be empty.");
    }

    #[test]
    fn deletes_missing_credentials_idempotently() {
        let store = InMemoryCredentialStore::default();

        let result = delete_api_key_with_store(&store, "google").unwrap();
        let stored_key = get_api_key_with_store(&store, "google").unwrap();

        assert_eq!(
            result,
            ApiKeyMutationResult {
                provider: "google".to_string(),
                configured: false,
            }
        );
        assert_eq!(stored_key, None);
    }

    #[test]
    fn reports_all_provider_statuses() {
        let store = InMemoryCredentialStore::default();

        set_api_key_with_store(&store, "openai", "sk-openai").unwrap();
        set_api_key_with_store(&store, "google", "sk-google").unwrap();
        set_api_key_with_store(&store, "openrouter", "sk-openrouter").unwrap();

        let statuses = get_api_key_statuses_with_store(&store).unwrap();

        assert_eq!(statuses.get("openai"), Some(&true));
        assert_eq!(statuses.get("anthropic"), Some(&false));
        assert_eq!(statuses.get("google"), Some(&true));
        assert_eq!(statuses.get("openrouter"), Some(&true));
    }

    #[test]
    fn propagates_store_failures() {
        let store = InMemoryCredentialStore::default();
        store.fail_next("credential backend unavailable");

        let error = get_api_key_statuses_with_store(&store).unwrap_err();
        assert_eq!(error, "credential backend unavailable");
    }
}
