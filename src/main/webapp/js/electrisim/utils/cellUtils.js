/**
 * Utility functions for cell operations
 */

/**
 * Parses a cell style string into an object
 * @param {string} styleStr - The style string to parse
 * @returns {Object} An object containing the parsed styles
 */
export function parseCellStyle(styleStr) {
    if (!styleStr) return null;
    
    const result = {};
    const styles = styleStr.split(';');
    
    styles.forEach(style => {
        const [key, value] = style.split('=');
        if (key && value) {
            result[key.trim()] = value.trim();
        }
    });
    
    return result;
}

/**
 * Gets the style value for a specific key
 * @param {string} styleStr - The style string
 * @param {string} key - The key to look for
 * @returns {string|null} The value for the key or null if not found
 */
export function getStyleValue(styleStr, key) {
    const styles = parseCellStyle(styleStr);
    return styles ? styles[key] : null;
}

// Make parseCellStyle globally available for legacy code
window.parseCellStyle = parseCellStyle;

// Export for ES modules
export default {
    parseCellStyle,
    getStyleValue
}; 