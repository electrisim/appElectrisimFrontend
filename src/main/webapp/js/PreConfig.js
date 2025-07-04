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

// Disable Google APIs to prevent tracking prevention warnings
urlParams['gapi'] = '0';
urlParams['google'] = '0';
urlParams['analytics'] = '0';

// Disable PWA and offline mode to prevent blank screen in production
urlParams['offline'] = '0';
urlParams['pwa'] = '0';

// Force unregister any existing service workers to prevent blank screen
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}