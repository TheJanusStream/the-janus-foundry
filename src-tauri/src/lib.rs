// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::Command;

#[tauri::command]
fn execute_code(language: &str, code: &str) -> Result<String, String> {
    // Extract the language keyword (e.g., "Exec:Python" -> "python")
    let lang_key = language.split(':').nth(1).unwrap_or("").to_lowercase();

    let output = if lang_key == "python" {
        Command::new("python").arg("-c").arg(code).output()
    } else if lang_key == "shell" || lang_key == "sh" {
        if cfg!(target_os = "windows") {
            Command::new("powershell")
                .arg("-Command")
                .arg(code)
                .output()
        } else {
            Command::new("sh").arg("-c").arg(code).output()
        }
    } else {
        // Placeholder for Node/Prolog until configured
        return Err(format!(
            "Execution engine not yet configured for: {}",
            lang_key
        ));
    };

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            Ok(format!("{}{}", stdout, stderr).trim().to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    unsafe { std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1") };
    unsafe { std::env::set_var("GDK_BACKEND", "x11") };
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
