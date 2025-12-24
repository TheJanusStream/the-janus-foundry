use std::process::Command;

#[tauri::command]
fn execute_code(language: &str, code: &str, _context: Option<String>) -> Result<String, String> {
    let lang_key = language.split(':').nth(1).unwrap_or("").to_lowercase();

    if lang_key == "python" {
        let output = Command::new("python")
            .arg("-c")
            .arg(code)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .trim()
        .to_string())
    } else if lang_key == "shell" || lang_key == "sh" {
        let cmd = if cfg!(target_os = "windows") {
            "powershell"
        } else {
            "sh"
        };
        let arg = if cfg!(target_os = "windows") {
            "-Command"
        } else {
            "-c"
        };
        let output = Command::new(cmd)
            .arg(arg)
            .arg(code)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .trim()
        .to_string())
    } else if lang_key == "node" || lang_key == "javascript" || lang_key == "js" {
        // "Exec:Node" is reserved for system-level NodeJS (accessing fs, etc.)
        // "Exec:Javascript" is routed to the Web Worker in the frontend
        let output = Command::new("node")
            .arg("-e")
            .arg(code)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .trim()
        .to_string())
    } else {
        Err(format!(
            "Execution engine not configured for: {}. (Note: Logic nodes run client-side)",
            lang_key
        ))
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
