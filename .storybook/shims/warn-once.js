// Minimal ESM shim for the `warn-once` package used by some libraries.
// It exports a default function that logs the warning once per key.
const seen = new Set();
export default function warnOnce(key, message) {
    try {
        const id = String(key ?? message);
        if (seen.has(id)) return;
        seen.add(id);
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(String(message));
        }
    } catch (_e) {
        // ignore
    }
}
