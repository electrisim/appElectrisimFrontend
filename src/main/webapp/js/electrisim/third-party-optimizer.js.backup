/**
 * Third-Party Script Optimizer for Electrisim
 * Manages loading of external libraries (Stripe, XLSX, etc.) efficiently
 * Reduces Total Blocking Time by deferring non-critical scripts
 */

(function() {
    'use strict';
    
    // Track loaded libraries
    const loadedLibraries = new Map();
    const loadingPromises = new Map();
    
    /**
     * Load XLSX library on demand
     * Used for Excel import/export functionality
     * @returns {Promise<Object>} - Resolves with XLSX library
     */
    function loadXLSX() {
        if (window.XLSX) {
            return Promise.resolve(window.XLSX);
        }
        
        if (loadingPromises.has('xlsx')) {
            return loadingPromises.get('xlsx');
        }
        
        const promise = new Promise((resolve, reject) => {
            console.log('📦 Loading XLSX library...');
            
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/xlsx-style@0.8.13/dist/xlsx.full.min.js';
            script.async = true;
            
            script.onload = () => {
                console.log('✅ XLSX library loaded');
                loadedLibraries.set('xlsx', window.XLSX);
                loadingPromises.delete('xlsx');
                resolve(window.XLSX);
            };
            
            script.onerror = (error) => {
                console.error('❌ Failed to load XLSX library:', error);
                loadingPromises.delete('xlsx');
                reject(new Error('Failed to load XLSX library'));
            };
            
            document.head.appendChild(script);
        });
        
        loadingPromises.set('xlsx', promise);
        return promise;
    }
    
    /**
     * Load Stripe SDK on demand
     * Used for payment and subscription functionality
     * @returns {Promise<Object>} - Resolves with Stripe library
     */
    function loadStripe() {
        if (window.Stripe) {
            return Promise.resolve(window.Stripe);
        }
        
        if (loadingPromises.has('stripe')) {
            return loadingPromises.get('stripe');
        }
        
        const promise = new Promise((resolve, reject) => {
            console.log('📦 Loading Stripe SDK...');
            
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            
            script.onload = () => {
                console.log('✅ Stripe SDK loaded');
                loadedLibraries.set('stripe', window.Stripe);
                
                // Also load Stripe integration modules if lazy loader is available
                if (window.ElectrisimLazyLoader) {
                    Promise.all([
                        window.ElectrisimLazyLoader.loadModule('loginsubscription/stripe'),
                        window.ElectrisimLazyLoader.loadModule('loginsubscription/stripe-subscription')
                    ]).then(() => {
                        loadingPromises.delete('stripe');
                        resolve(window.Stripe);
                    }).catch(reject);
                } else {
                    loadingPromises.delete('stripe');
                    resolve(window.Stripe);
                }
            };
            
            script.onerror = (error) => {
                console.error('❌ Failed to load Stripe SDK:', error);
                loadingPromises.delete('stripe');
                reject(new Error('Failed to load Stripe SDK'));
            };
            
            document.head.appendChild(script);
        });
        
        loadingPromises.set('stripe', promise);
        return promise;
    }
    
    /**
     * Preload external resources using link preconnect
     * Establishes early connections to external domains
     */
    function preconnectExternalResources() {
        const externalDomains = [
            'https://js.stripe.com',
            'https://unpkg.com',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com'
        ];
        
        externalDomains.forEach(domain => {
            // Check if preconnect already exists
            const existing = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
            if (existing) return;
            
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = domain;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
        
        console.log('🔗 Preconnected to external resources');
    }
    
    /**
     * Prefetch resources that will likely be needed soon
     * Uses low-priority fetching to avoid blocking critical resources
     */
    function prefetchResources(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = 'script';
            document.head.appendChild(link);
        });
    }
    
    /**
     * Load AG Grid Community (already loaded in index.html, but provide accessor)
     * @returns {Promise<Object>} - Resolves when AG Grid is available
     */
    function ensureAGGrid() {
        if (window.agGrid) {
            return Promise.resolve(window.agGrid);
        }
        
        // Wait for AG Grid to load (max 10 seconds)
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100;
            
            const checkAGGrid = setInterval(() => {
                attempts++;
                if (window.agGrid) {
                    clearInterval(checkAGGrid);
                    resolve(window.agGrid);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkAGGrid);
                    reject(new Error('AG Grid failed to load'));
                }
            }, 100);
        });
    }
    
    /**
     * Optimize loading of all third-party scripts
     * Called during page initialization
     */
    function optimizeThirdPartyLoading() {
        // Preconnect to external domains
        preconnectExternalResources();
        
        // Prefetch resources that might be needed (during idle time)
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                // Prefetch commonly used external resources
                prefetchResources([
                    'https://js.stripe.com/v3/',
                    'https://unpkg.com/xlsx-style@0.8.13/dist/xlsx.full.min.js'
                ]);
            }, { timeout: 5000 });
        }
    }
    
    /**
     * Get statistics about loaded libraries
     */
    function getStats() {
        return {
            loaded: Array.from(loadedLibraries.keys()),
            loading: Array.from(loadingPromises.keys()),
            available: {
                xlsx: !!window.XLSX,
                stripe: !!window.Stripe,
                agGrid: !!window.agGrid
            }
        };
    }
    
    // Export API
    window.ElectrisimThirdParty = {
        loadXLSX,
        loadStripe,
        ensureAGGrid,
        preconnectExternalResources,
        prefetchResources,
        optimizeThirdPartyLoading,
        getStats,
        
        // Convenience methods
        isLoaded: (library) => loadedLibraries.has(library) || 
                               (library === 'xlsx' && !!window.XLSX) ||
                               (library === 'stripe' && !!window.Stripe) ||
                               (library === 'agGrid' && !!window.agGrid)
    };
    
    // Initialize optimizations when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', optimizeThirdPartyLoading);
    } else {
        optimizeThirdPartyLoading();
    }
    
    console.log('🚀 Third-Party Optimizer initialized');
})();

