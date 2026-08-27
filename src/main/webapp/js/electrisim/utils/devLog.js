// Development-only logging.
//
// Verbose logging inside click handlers is charged to INP: string building and
// console I/O run before the browser can paint the interaction. These helpers keep
// the diagnostics available locally while keeping production handlers quiet.
// Errors and real warnings should still use console.error / console.warn directly.

export function isDevEnvironment() {
    try {
        if (window.ENV && typeof window.ENV.isDevelopment === 'boolean') {
            return window.ENV.isDevelopment;
        }
        // Mirrors the hostname check in config/environment.js for the window before
        // ENV is assigned, or if it failed to load.
        return window.location.hostname !== 'app.electrisim.com';
    } catch (error) {
        return false;
    }
}

export function devLog(...args) {
    if (isDevEnvironment()) {
        console.log(...args);
    }
}

export function devWarn(...args) {
    if (isDevEnvironment()) {
        console.warn(...args);
    }
}

export default devLog;
