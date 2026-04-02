mod credentials;
mod local_providers;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            credentials::set_api_key,
            credentials::delete_api_key,
            credentials::get_api_key_statuses,
            credentials::get_api_key,
            local_providers::get_local_provider_statuses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
