// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::io::Write;
use std::process::{Command, Stdio};
use std::thread;

#[tauri::command]
fn execute_code(language: &str, code: &str, context: Option<String>) -> Result<String, String> {
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
    } else if lang_key == "typescript" || lang_key == "ts" {
        let output = Command::new("node")
            .arg("--experimental-strip-types")
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
    } else if lang_key == "node" || lang_key == "javascript" || lang_key == "js" {
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
    } else if lang_key == "prolog" {
        let mut child = Command::new("swipl")
            .arg("-q")
            // We increase buffer limits if possible, or just rely on streaming
            .arg("-f")
            .arg("none") // Don't load user init files
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn swipl: {}", e))?;

        // We clone the data to move it into the writer thread
        let code_input = format!("{}\n\nhalt.\n", code);
        let context_input = context.unwrap_or_default();

        let mut stdin = child.stdin.take().expect("Failed to open stdin");

        // SPAWN WRITER THREAD
        // This prevents the main thread from blocking if the pipe fills up
        thread::spawn(move || {
            // Write Context first
            if !context_input.is_empty() {
                let _ = stdin.write_all(context_input.as_bytes());
                let _ = stdin.write_all(b"\n");
            }
            // Write User Code
            let _ = stdin.write_all(code_input.as_bytes());
            // Stdin closes here when variable goes out of scope
        });

        // Main thread immediately waits for output
        // This consumes the OS buffer, preventing the deadlock
        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to read swipl output: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        Err(format!("Execution engine not configured for: {}", lang_key))
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
