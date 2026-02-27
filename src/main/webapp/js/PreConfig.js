// exp.draw.io is deprecated (DNS_PROBE_FINISHED_NXDOMAIN). PDF export uses browser print dialog (printPdfExport in index.html).
// For PNG/SVG export, self-host jgraph/export-server and use ?export=https://your-server/export
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

// CRITICAL: Keep splash dialog but fix visibility and set default storage
urlParams['splash'] = '1';      // Enable splash screen dialog (Create New vs Open)
urlParams['mode'] = 'device';   // Set default storage mode to device (local files)
urlParams['chrome'] = '1';      // Enable full UI chrome

// Disable external cloud services to prevent empty script URLs
urlParams['db'] = '0';          // Disable Dropbox
urlParams['od'] = '0';          // Disable OneDrive  
urlParams['tr'] = '0';          // Disable Trello
urlParams['gh'] = '0';          // Disable GitHub
urlParams['gl'] = '0';          // Disable GitLab

// Force unregister any existing service workers to prevent blank screen
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}