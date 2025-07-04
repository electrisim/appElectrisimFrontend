window.EXPORT_URL = 'REPLACE_WITH_YOUR_IMAGE_SERVER';
window.PLANT_URL = 'REPLACE_WITH_YOUR_PLANTUML_SERVER';
// Set the base URL explicitly for your domain
window.DRAWIO_BASE_URL = window.location.protocol + '//' + window.location.hostname;
// Prevent overriding by making it non-configurable
Object.defineProperty(window, 'DRAWIO_BASE_URL', {
    value: window.location.protocol + '//' + window.location.hostname,
    writable: false,
    configurable: false
});
window.DRAWIO_VIEWER_URL = null;
window.DRAW_MATH_URL = 'math';
window.DRAWIO_CONFIG = null; 
urlParams['sync'] = 'manual';