// src/lib/utils.ts

// Augment the global Window interface to make TypeScript aware of Tauri's core internals object.
declare global {
    interface Window {
        __TAURI_INTERNALS__?: any;
    }
}

/**
 * Checks if the application is currently running inside a Tauri webview.
 * This method is more robust as it checks for the core IPC bridge object,
 * which is less prone to race conditions than the metadata object.
 * @returns {boolean} True if in Tauri, false otherwise.
 */
export const isTauri = (): boolean =>
    typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
