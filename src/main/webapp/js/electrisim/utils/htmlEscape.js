// Escape text before it is placed into an HTML string (innerHTML / template literals).
//
// Values that come from the backend or from user-typed element names (for example
// "userFriendlyName", error messages, defaults-applied notes) must go through this
// helper. Numbers and fixed markup do not need it.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export default escapeHtml;
