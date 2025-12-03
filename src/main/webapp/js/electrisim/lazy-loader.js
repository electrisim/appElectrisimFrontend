/**
 * Lazy Loader Module for Electrisim
 * Loads scripts and modules on-demand to improve initial page load performance
 * This reduces Total Blocking Time and improves Speed Index
 */

(function() {
    'use strict';
    
    // Track loaded modules
    const loadedModules = new Map();
    const loadingPromises = new Map();
    
    // Module dependencies and categories
    const MODULE_CATEGORIES = {
        // Core utilities - loaded on demand
        utils: [
            'utils/cellUtils',
            'utils/zoomOptimizer',
            'utils/canvasOptimizer',
            'utils/pageVisibilityManager',
            'utils/performanceMonitor',
            'utils/autoInitOptimizers'
        ],
        
        // Analysis dialogs - loaded when user accesses analysis menu
        analysis: [
            'dialogs/LoadFlowDialog',
            'dialogs/OptimalPowerFlowDialog',
            'dialogs/OptimalPowerFlowResultsDialog',
            'dialogs/ContingencyDialog',
            'dialogs/ShortCircuitDialog',
            'dialogs/DiagnosticReportDialog'
        ],
        
        // Simulation dialogs - loaded when user accesses simulation menu
        simulation: [
            'dialogs/ControllerSimulationDialog',
            'dialogs/ControllerSimulationResultsDialog',
            'dialogs/TimeSeriesSimulationDialog',
            'dialogs/TimeSeriesSimulationResultsDialog'
        ],
        
        // Component dialogs - loaded when user edits a component
        components: [
            'dialogs/EditDataDialog',
            'dialogs/ComponentsDataDialog',
            'lineBaseDialog',
            'lineLibraryDialog',
            'externalGridDialog',
            'generatorDialog',
            'staticGeneratorDialog',
            'asymmetricStaticGeneratorDialog',
            'busDialog',
            'transformerBaseDialog',
            'transformerLibraryDialog',
            'threeWindingTransformerBaseDialog',
            'threeWindingTransformerLibraryDialog',
            'shuntReactorDialog',
            'capacitorDialog',
            'loadDialog',
            'asymmetricLoadDialog',
            'impedanceDialog',
            'wardDialog',
            'extendedWardDialog',
            'motorDialog',
            'storageDialog',
            'SSCDialog',
            'SVCDialog',
            'TCSCDialog',
            'dcLineDialog'
        ],
        
        // Analysis engines - loaded when analysis is run
        engines: [
            'loadFlow',
            'loadflowOpenDss',
            'optimalPowerFlow',
            'shortCircuit',
            'contingencyAnalysis',
            'controllerSimulation',
            'timeSeriesSimulation'
        ],
        
        // Supporting functions - loaded with first component dialog
        supporting: [
            'supportingFunctions',
            'configureAttributes',
            'LibraryDialogManager'
        ],
        
        // Subscription and auth - loaded when needed
        subscription: [
            'ensureSubscriptionFunctions',
            'loginsubscription/auth-handler',
            'loginsubscription/stripe',
            'loginsubscription/stripe-subscription'
        ]
    };
    
    /**
     * Load a single module
     * @param {string} modulePath - Path to the module (relative to js/electrisim/)
     * @returns {Promise} - Resolves when module is loaded
     */
    function loadModule(modulePath) {
        // Check if already loaded
        if (loadedModules.has(modulePath)) {
            return Promise.resolve(loadedModules.get(modulePath));
        }
        
        // Check if currently loading
        if (loadingPromises.has(modulePath)) {
            return loadingPromises.get(modulePath);
        }
        
        // Create loading promise
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.async = true;
            
            // Add version parameter to prevent caching issues for some modules
            const cacheBuster = modulePath.includes('Dialog') ? `?v=${Date.now()}` : '';
            script.src = `js/electrisim/${modulePath}.js${cacheBuster}`;
            
            script.onload = () => {
                console.log(`✅ Lazy loaded: ${modulePath}`);
                loadedModules.set(modulePath, true);
                loadingPromises.delete(modulePath);
                resolve(true);
            };
            
            script.onerror = (error) => {
                console.error(`❌ Failed to lazy load: ${modulePath}`, error);
                loadingPromises.delete(modulePath);
                reject(new Error(`Failed to load module: ${modulePath}`));
            };
            
            document.head.appendChild(script);
        });
        
        loadingPromises.set(modulePath, promise);
        return promise;
    }
    
    /**
     * Load multiple modules in parallel
     * @param {string[]} modulePaths - Array of module paths
     * @returns {Promise} - Resolves when all modules are loaded
     */
    function loadModules(modulePaths) {
        const promises = modulePaths.map(path => loadModule(path));
        return Promise.all(promises);
    }
    
    /**
     * Load a category of modules
     * @param {string} category - Category name from MODULE_CATEGORIES
     * @returns {Promise} - Resolves when all modules in category are loaded
     */
    function loadCategory(category) {
        const modules = MODULE_CATEGORIES[category];
        if (!modules) {
            console.warn(`Unknown module category: ${category}`);
            return Promise.resolve();
        }
        
        console.log(`📦 Loading category: ${category} (${modules.length} modules)`);
        return loadModules(modules);
    }
    
    /**
     * Preload modules during idle time
     * @param {string[]} modulePaths - Array of module paths to preload
     */
    function preloadModules(modulePaths) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                modulePaths.forEach(path => {
                    if (!loadedModules.has(path) && !loadingPromises.has(path)) {
                        loadModule(path).catch(() => {
                            // Ignore errors during preload
                        });
                    }
                });
            }, { timeout: 5000 });
        } else {
            setTimeout(() => {
                modulePaths.forEach(path => {
                    if (!loadedModules.has(path) && !loadingPromises.has(path)) {
                        loadModule(path).catch(() => {});
                    }
                });
            }, 3000);
        }
    }
    
    /**
     * Load third-party library (XLSX) on demand
     */
    function loadXLSX() {
        if (window.XLSX) {
            return Promise.resolve(window.XLSX);
        }
        
        if (window._xlsxLoading) {
            return window._xlsxLoading;
        }
        
        window._xlsxLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/xlsx-style@0.8.13/dist/xlsx.full.min.js';
            script.async = true;
            script.onload = () => {
                console.log('✅ XLSX library loaded');
                delete window._xlsxLoading;
                resolve(window.XLSX);
            };
            script.onerror = () => {
                console.error('❌ Failed to load XLSX library');
                delete window._xlsxLoading;
                reject(new Error('Failed to load XLSX'));
            };
            document.head.appendChild(script);
        });
        
        return window._xlsxLoading;
    }
    
    /**
     * Load Stripe SDK on demand
     */
    function loadStripe() {
        if (window.Stripe) {
            return Promise.resolve(window.Stripe);
        }
        
        if (window._stripeLoading) {
            return window._stripeLoading;
        }
        
        window._stripeLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.onload = () => {
                console.log('✅ Stripe SDK loaded');
                // Also load Stripe integration modules
                loadCategory('subscription').then(() => {
                    delete window._stripeLoading;
                    resolve(window.Stripe);
                }).catch(reject);
            };
            script.onerror = () => {
                console.error('❌ Failed to load Stripe SDK');
                delete window._stripeLoading;
                reject(new Error('Failed to load Stripe'));
            };
            document.head.appendChild(script);
        });
        
        return window._stripeLoading;
    }
    
    /**
     * Get loading statistics
     */
    function getStats() {
        return {
            loaded: loadedModules.size,
            loading: loadingPromises.size,
            categories: Object.keys(MODULE_CATEGORIES).map(cat => ({
                name: cat,
                total: MODULE_CATEGORIES[cat].length,
                loaded: MODULE_CATEGORIES[cat].filter(m => loadedModules.has(m)).length
            }))
        };
    }
    
    // Export API
    window.ElectrisimLazyLoader = {
        loadModule,
        loadModules,
        loadCategory,
        preloadModules,
        loadXLSX,
        loadStripe,
        getStats,
        
        // Convenience methods
        loadAnalysisDialogs: () => loadCategory('analysis'),
        loadSimulationDialogs: () => loadCategory('simulation'),
        loadComponentDialogs: () => loadCategory('components'),
        loadEngines: () => loadCategory('engines'),
        loadSupporting: () => loadCategory('supporting'),
        
        // Check if module is loaded
        isLoaded: (modulePath) => loadedModules.has(modulePath)
    };
    
    // Log initialization
    console.log('📦 Lazy Loader initialized');
    
    // Preload commonly used modules after page is interactive
    if (document.readyState === 'complete') {
        preloadModules(['utils/cellUtils', 'dialogs/EditDataDialog']);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => {
                preloadModules(['utils/cellUtils', 'dialogs/EditDataDialog']);
            }, 2000);
        });
    }
})();

