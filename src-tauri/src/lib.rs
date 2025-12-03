// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::{Command, Stdio};
use std::io::Write;

#[tauri::command]
fn execute_code(language: &str, code: &str) -> Result<String, String> {
    let lang_key = language.split(':').nth(1).unwrap_or("").to_lowercase();

    let output_result = if lang_key == "python" {
        Command::new("python").arg("-c").arg(code).output()
    } else if lang_key == "shell" || lang_key == "sh" {
        if cfg!(target_os = "windows") {
            Command::new("powershell").arg("-Command").arg(code).output()
        } else {
            Command::new("sh").arg("-c").arg(code).output()
        }
    } else if lang_key == "typescript" || lang_key == "ts" {
        // Node.js v22+ Type Stripping
        Command::new("node")
            .arg("--experimental-strip-types")
            .arg("-e")
            .arg(code)
            .output()
    } else if lang_key == "node" || lang_key == "javascript" || lang_key == "js" {
        Command::new("node").arg("-e").arg(code).output()
    } else if lang_key == "prolog" {
        // SWI-Prolog (swipl) via Stdin Pipe
        // -q suppresses the welcome banner
        let mut child = Command::new("swipl")
            .arg("-q")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn swipl: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            // Append halt. to ensure termination
            let input = format!("{}\n\nhalt.\n", code);
            stdin.write_all(input.as_bytes()).map_err(|e| format!("Failed to write to stdin: {}", e))?;
        }

        child.wait_with_output()
    } else {
        return Err(format!(
            "Execution engine not yet configured for: {}",
            lang_key
        ));
    };

    match output_result {
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