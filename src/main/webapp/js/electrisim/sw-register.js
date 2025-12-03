/**
 * Service Worker Registration for Electrisim
 * Registers the service worker and handles updates
 */

(function() {
    'use strict';
    
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        console.log('Service workers are not supported');
        return;
    }
    
    // Register service worker after page load
    window.addEventListener('load', () => {
        // Determine service worker path based on current location
        // Service worker must be at same level or higher than the page
        const currentPath = window.location.pathname;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        
        // Try multiple paths to handle different server configurations
        // Order matters - try most likely paths first
        const swPaths = [
            basePath + '/service-worker.js', // Same directory as current page (most likely)
            './service-worker.js',           // Relative to current page
            'service-worker.js',             // Same directory (no leading slash)
            '/service-worker.js'             // Absolute from server root (last resort)
        ];
        
        // Try to register with the first available path
        function tryRegister(index) {
            if (index >= swPaths.length) {
                console.warn('⚠️ Could not register service worker with any path');
                return;
            }
            
            const swPath = swPaths[index];
            navigator.serviceWorker.register(swPath)
            .then((registration) => {
                console.log(`✅ ServiceWorker registered successfully with path: "${swPath}"`);
                console.log('   Scope:', registration.scope);
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 3600000); // Check every hour
                
                // Handle updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 ServiceWorker update found');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is ready
                            console.log('✅ New ServiceWorker installed');
                            
                            // Optionally notify user about update
                            if (window.confirm('A new version is available. Reload to update?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch((error) => {
                console.warn(`⚠️ ServiceWorker registration failed with path "${swPath}":`, error.message);
                // Try next path
                tryRegister(index + 1);
            });
        }
        
        // Start trying paths
        tryRegister(0);
        
        // Handle controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 ServiceWorker controller changed');
        });
    });
    
    // Expose API for cache management
    window.ElectrisimCache = {
        /**
         * Clear all caches
         */
        clear: function() {
            if (!navigator.serviceWorker.controller) {
                return Promise.reject('No active service worker');
            }
            
            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data.success) {
                        resolve();
                    } else {
                        reject(event.data.error);
                    }
                };
                
                navigator.serviceWorker.controller.postMessage(
                    { type: 'CLEAR_CACHE' },
                    [messageChannel.port2]
                );
            });
        },
        
        /**
         * Preload specific URLs into cache
         */
        preload: function(urls) {
            if (!navigator.serviceWorker.controller) {
                return Promise.reject('No active service worker');
            }
            
            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data.success) {
                        resolve();
                    } else {
                        reject(event.data.error);
                    }
                };
                
                navigator.serviceWorker.controller.postMessage(
                    { type: 'CACHE_URLS', urls: urls },
                    [messageChannel.port2]
                );
            });
        }
    };
})();

