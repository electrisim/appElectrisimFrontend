// Auto-Initialize Performance Optimizers
// Detects when graph is ready; ZoomOptimizer and CanvasOptimizer removed (caused slowdown on large models)

(function() {
    console.log('🚀 Auto-initializing performance optimizers...');

    let initAttempts = 0;
    /** Cold / incognito loads can exceed 5s: Electrisim modules + App.main run after this script. */
    const maxAttempts = 200;
    const pollMs = 150;

    function resolveElectrisimGraph() {
        var app = window.App;
        return (
            (app && app._editorUi && app._editorUi.editor && app._editorUi.editor.graph) ||
            (app && app._instance && app._instance.editor && app._instance.editor.graph) ||
            (app && app.main && app.main.editor && app.main.editor.graph) ||
            (window.editorUi && window.editorUi.editor && window.editorUi.editor.graph) ||
            window.graph ||
            null
        );
    }

    function tryInitialize() {
        initAttempts++;

        var graph = resolveElectrisimGraph();

        if (graph) {
            console.log('✅ Graph detected after ' + initAttempts + ' attempts');
            initializeOptimizers(graph);
            return true;
        }

        if (initAttempts < maxAttempts) {
            setTimeout(tryInitialize, pollMs);
            return false;
        }
        console.warn(
            '⚠️ Could not auto-initialize optimizers: graph not ready in time (use initializePerformanceOptimizers when editor is available)'
        );
        return false;
    }

    function initializeOptimizers(graph) {
        try {
            if (window.__electrisimPerfOptimizersApplied) {
                return;
            }
            window.__electrisimPerfOptimizersApplied = true;
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

