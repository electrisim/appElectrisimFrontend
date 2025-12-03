/**
 * Electrisim Core Module
 * Minimal critical functionality loaded immediately
 * Non-critical features are lazy loaded
 */

// Initialize core performance optimizations immediately
(function() {
    'use strict';

    // Mark core as loading
    window.ElectrisimCoreLoaded = false;

    // Critical performance patches
    if (!window.requestIdleCallback) {
        window.requestIdleCallback = function(callback) {
            return setTimeout(callback, 1);
        };
        window.cancelIdleCallback = function(id) {
            clearTimeout(id);
        };
    }

    // Safe DOM manipulation batching
    window.batchDOMUpdates = function(callbacks) {
        if (callbacks && callbacks.length > 0) {
            requestIdleCallback(function() {
                callbacks.forEach(function(cb) { cb(); });
            });
        }
    };

    // Safe performance monitoring
    window.safePerformanceMark = function(name) {
        try {
            if (performance.mark) {
                performance.mark(name);
            }
        } catch (e) {
            // Ignore errors
        }
    };

    // Initialize core DOM cache
    window.domCache = {
        get: function(selector) {
            if (!this._cache) this._cache = new Map();
            if (!this._cache.has(selector)) {
                this._cache.set(selector, document.querySelector(selector));
            }
            return this._cache.get(selector);
        },
        clear: function() {
            if (this._cache) this._cache.clear();
        }
    };

    // Core authentication state (minimal)
    window.isAuthenticated = function() {
        return !!localStorage.getItem('token');
    };

    window.getCurrentUser = function() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    };

    // Mark core as loaded
    window.ElectrisimCoreLoaded = true;
    console.log('✅ Electrisim core loaded');

})();
