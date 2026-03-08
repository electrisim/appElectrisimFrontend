// Auto-Initialize Performance Optimizers
// Detects when graph is ready; ZoomOptimizer and CanvasOptimizer removed (caused slowdown on large models)

(function() {
    console.log('🚀 Auto-initializing performance optimizers...');

    let initAttempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    function tryInitialize() {
        initAttempts++;

        const graph = window.editorUi?.editor?.graph || 
                     window.App?.main?.editor?.graph ||
                     window.graph;

        if (graph) {
            console.log(`✅ Graph detected after ${initAttempts} attempts`);
            initializeOptimizers(graph);
            return true;
        }

        if (initAttempts < maxAttempts) {
            setTimeout(tryInitialize, 100);
            return false;
        } else {
            console.warn('⚠️ Could not auto-initialize optimizers: Graph not found');
            return false;
        }
    }

    function initializeOptimizers(graph) {
        try {
            window.optimizedGraph = graph;
            console.log('🎉 Performance optimizers ready');
            console.log('📊 window.domCache.logStats() - DOM cache stats');
        } catch (error) {
            console.error('❌ Error initializing optimizers:', error);
        }
    }

    window.initializePerformanceOptimizers = function(graph) {
        if (!graph) {
            console.error('❌ No graph provided to initializePerformanceOptimizers');
            return false;
        }
        initializeOptimizers(graph);
        return true;
    };

    window.checkOptimizerStatus = function() {
        console.log('📊 ========== OPTIMIZER STATUS ==========');
        if (window.domCache) {
            console.log('✅ DOM Cache: Active');
            window.domCache.logStats();
        } else {
            console.log('❌ DOM Cache: Not loaded');
        }
        console.log('📊 ======================================');
    };

    setTimeout(tryInitialize, 1000);
    console.log('✅ Auto-initialization script loaded');
})();

