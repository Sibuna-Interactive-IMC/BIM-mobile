// Minimal ESM-compatible invariant shim that provides a default export
// matching the common `invariant(condition, message)` API used by RN libs.
function invariant(condition, message) {
    if (!condition) {
        throw new Error(message || 'Invariant failed');
    }
}

export default invariant;
