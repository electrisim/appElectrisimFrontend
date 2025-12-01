// Auto-Initialize Performance Optimizers
// Automatically detects when graph is ready and initializes all optimizers

(function() {
    console.log('🚀 Auto-initializing performance optimizers...');

    let initAttempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    /**
     * Try to initialize optimizers
     */
    function tryInitialize() {
        initAttempts++;

        // Check if graph is available
        const graph = window.editorUi?.editor?.graph || 
                     window.App?.main?.editor?.graph ||
                     window.graph;

        if (graph) {
            console.log(`✅ Graph detected after ${initAttempts} attempts`);
            initializeAllOptimizers(graph);
            return true;
        }

        if (initAttempts < maxAttempts) {
            setTimeout(tryInitialize, 100);
            return false;
        } else {
            console.warn('⚠️ Could not auto-initialize optimizers: Graph not found');
            console.log('💡 Manual initialization: Call initializePerformanceOptimizers(graph) when graph is ready');
            return false;
        }
    }

    /**
     * Initialize all optimizers with the graph
     * @param {Object} graph - mxGraph instance
     */
    function initializeAllOptimizers(graph) {
        try {
            console.log('🔧 Initializing performance optimizers...');

            // 1. Zoom Optimizer
            if (window.zoomOptimizer) {
                window.zoomOptimizer.initialize(graph);
                console.log('✅ Zoom Optimizer initialized');
            }

            // 2. Canvas Optimizer
            if (window.canvasOptimizer) {
                window.canvasOptimizer.initialize(graph);
                console.log('✅ Canvas Optimizer initialized');
            }

            // 3. Store graph reference globally for manual access
            window.optimizedGraph = graph;

            console.log('🎉 All performance optimizers initialized successfully!');
            console.log('📊 Use these commands to monitor performance:');
            console.log('   - window.logPerformanceReport() - Overall performance');
            console.log('   - window.logZoomPerformance() - Zoom performance');
            console.log('   - window.domCache.logStats() - DOM cache stats');

            // Show quick tip after 5 seconds
            setTimeout(() => {
                console.log('💡 TIP: For large models, optimizers automatically:');
                console.log('   ✅ Only render visible elements (viewport culling)');
                console.log('   ✅ Simplify rendering when zoomed out (LOD)');
                console.log('   ✅ Hide labels during zoom (performance mode)');
                console.log('   ✅ Throttle zoom events to 60fps');
            }, 5000);

        } catch (error) {
            console.error('❌ Error initializing optimizers:', error);
        }
    }

    /**
     * Manual initialization function (exported globally)
     * @param {Object} graph - mxGraph instance
     */
    window.initializePerformanceOptimizers = function(graph) {
        if (!graph) {
            console.error('❌ No graph provided to initializePerformanceOptimizers');
            return false;
        }
        initializeAllOptimizers(graph);
        return true;
    };

    /**
     * Check optimizer status
     */
    window.checkOptimizerStatus = function() {
        console.log('📊 ========== OPTIMIZER STATUS ==========');
        
        if (window.zoomOptimizer && window.zoomOptimizer.graph) {
            console.log('✅ Zoom Optimizer: Active');
            window.zoomOptimizer.logReport();
        } else {
            console.log('❌ Zoom Optimizer: Not initialized');
        }

        if (window.canvasOptimizer && window.canvasOptimizer.graph) {
            console.log('✅ Canvas Optimizer: Active');
            const status = window.canvasOptimizer.getStatus();
            console.log('   Status:', status);
        } else {
            console.log('❌ Canvas Optimizer: Not initialized');
        }

        if (window.domCache) {
            console.log('✅ DOM Cache: Active');
            window.domCache.logStats();
        }

        console.log('📊 ======================================');
    };

    /**
     * Toggle optimizers on/off
     * @param {boolean} enabled - Enable or disable
     */
    window.toggleOptimizers = function(enabled) {
        if (window.zoomOptimizer) {
            enabled ? window.zoomOptimizer.enable() : window.zoomOptimizer.disable();
        }
        if (window.canvasOptimizer) {
            enabled ? window.canvasOptimizer.enable() : window.canvasOptimizer.disable();
        }
        console.log(`${enabled ? '✅ Enabled' : '⏸️ Disabled'} all optimizers`);
    };

    // Start auto-initialization
    // Wait a bit for other scripts to load
    setTimeout(tryInitialize, 1000);

    console.log('✅ Auto-initialization script loaded');
})();

