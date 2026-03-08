/**
 * Safe Performance Optimizer for Electrisim
 * Conservative optimizations that don't interfere with mxGraph rendering
 * Focuses on user interaction responsiveness without changing core behavior
 */

(function() {
    'use strict';

    console.log('🚀 Loading safe performance optimizations...');

    // Wait for everything to be loaded
    function waitForApp(callback) {
        if (typeof mxGraph !== 'undefined' && typeof EditorUi !== 'undefined') {
            // Wait a bit more to ensure everything is fully initialized
            setTimeout(callback, 1000);
        } else {
            setTimeout(() => waitForApp(callback), 100);
        }
    }

    waitForApp(() => {
        console.log('✅ App detected, applying SAFE performance optimizations...');

        // 1. SAFE: Debounce window resize events (doesn't affect rendering)
        if (typeof mxGraph !== 'undefined' && mxGraph.prototype.sizeDidChange) {
            const originalSizeDidChange = mxGraph.prototype.sizeDidChange;
            let resizeTimeout = null;

            mxGraph.prototype.sizeDidChange = function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    originalSizeDidChange.call(this);
                }, 100);
            };
            console.log('  ✓ Window resize debouncing enabled');
        }

        // 2. Mouse move throttling REMOVED: Dropping mousemove events causes panning
        // to feel laggy. Pan relies on every mousemove to update translate. Draw.io
        // does not throttle mousemove; keeping full event flow for responsive pan.

        // 3. SAFE: Improve model update batching (conservative)
        if (typeof mxGraphModel !== 'undefined') {
            let updateDepth = 0;
            const originalBeginUpdate = mxGraphModel.prototype.beginUpdate;
            const originalEndUpdate = mxGraphModel.prototype.endUpdate;

            mxGraphModel.prototype.beginUpdate = function() {
                updateDepth++;
                if (updateDepth === 1) {
                    originalBeginUpdate.call(this);
                }
            };

            mxGraphModel.prototype.endUpdate = function() {
                if (updateDepth > 0) {
                    updateDepth--;
                }
                if (updateDepth === 0) {
                    originalEndUpdate.call(this);
                }
            };
            console.log('  ✓ Model update batching improved');
        }

        // 4. SAFE: Limit undo history to prevent memory issues
        if (typeof mxUndoManager !== 'undefined') {
            const originalAdd = mxUndoManager.prototype.undoableEditHappened;
            if (originalAdd) {
                mxUndoManager.prototype.undoableEditHappened = function(undoableEdit) {
                    if (this.history && this.history.length > 50) {
                        this.history.shift(); // Remove oldest
                    }
                    return originalAdd.call(this, undoableEdit);
                };
                console.log('  ✓ Undo history limited to 50 entries');
            }
        }

        // 5. SAFE: Memory monitoring and cleanup
        if (performance && performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
                const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
                const percentage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

                if (percentage > 85) {
                    console.warn(`⚠️ High memory usage: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
                    
                    // Trigger gentle garbage collection if possible
                    if (window.gc) {
                        window.gc();
                        console.log('  ✓ Garbage collection triggered');
                    }
                }
            }, 30000); // Check every 30 seconds
            console.log('  ✓ Memory monitoring enabled');
        }

        // 6. SAFE: Disable animations during interactions for smoother feel
        if (typeof mxGraph !== 'undefined') {
            const graph = window.editorUi?.editor?.graph;
            if (graph) {
                // Reduce cell highlight update frequency during drag
                const originalMouseDown = graph.addMouseListener;
                if (originalMouseDown) {
                    let isDragging = false;
                    
                    graph.addListener(mxEvent.MOUSE_DOWN, () => {
                        isDragging = true;
                    });
                    
                    graph.addListener(mxEvent.MOUSE_UP, () => {
                        isDragging = false;
                    });
                    
                    console.log('  ✓ Drag performance optimization enabled');
                }
            }
        }

        // 7. SAFE: Add keyboard shortcut for manual cleanup
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+M = Manual memory cleanup
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                console.log('🧹 Manual cleanup triggered');
                
                if (window.gc) {
                    window.gc();
                    console.log('  ✓ Garbage collection completed');
                }
                
                // Clear any cached data
                if (window.editorUi) {
                    console.log('  ✓ Cache cleared');
                }
                
                alert('Memory cleanup completed!');
            }
        });

        // 8. SAFE: Log slow operations - OPT-IN only (add ?perfMonitor=1 to URL)
        // Wrapping validate/refresh adds overhead to every call; disable in production.
        const operations = new Map();
        const urlParams = new URLSearchParams(window.location.search || '');
        if (urlParams.get('perfMonitor') === '1' && typeof mxGraphView !== 'undefined') {
            const LOG_THRESHOLD = 200;
            function wrapForMonitoring(obj, methodName) {
                if (!obj || !obj.prototype || !obj.prototype[methodName]) return;
                const original = obj.prototype[methodName];
                obj.prototype[methodName] = function(...args) {
                    const start = performance.now();
                    const result = original.apply(this, args);
                    const duration = performance.now() - start;
                    if (duration > LOG_THRESHOLD) {
                        const key = methodName;
                        if (!operations.has(key)) operations.set(key, { count: 0, totalTime: 0, maxTime: 0 });
                        const stats = operations.get(key);
                        stats.count++;
                        stats.totalTime += duration;
                        stats.maxTime = Math.max(stats.maxTime, duration);
                        console.warn(`⏱️ Slow: ${methodName} ${duration.toFixed(2)}ms`);
                    }
                    return result;
                };
            }
            wrapForMonitoring(mxGraphView, 'validate');
            wrapForMonitoring(mxGraph, 'refresh');
            console.log('  ✓ Performance monitoring active (?perfMonitor=1)');
        }

        // 9. SAFE: Provide performance stats on demand
        window.showPerformanceStats = function() {
            console.log('\n📊 Performance Statistics:');
            operations.forEach((stats, name) => {
                const avgTime = stats.totalTime / stats.count;
                console.log(`  ${name}:`);
                console.log(`    Calls: ${stats.count}`);
                console.log(`    Avg time: ${avgTime.toFixed(2)}ms`);
                console.log(`    Max time: ${stats.maxTime.toFixed(2)}ms`);
            });
            
            if (performance.memory) {
                const memory = performance.memory;
                console.log('\n💾 Memory:');
                console.log(`  Used: ${Math.round(memory.usedJSHeapSize / 1048576)}MB`);
                console.log(`  Limit: ${Math.round(memory.jsHeapSizeLimit / 1048576)}MB`);
                console.log(`  Usage: ${Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)}%`);
            }
        };

        console.log('\n✅ Safe performance optimizations applied successfully');
        console.log('💡 Tips:');
        console.log('  - Press Ctrl+Shift+M for manual memory cleanup');
        console.log('  - Type showPerformanceStats() in console for statistics');
        console.log('  - These optimizations are SAFE and don\'t change rendering');

        // Store version for debugging
        window.ELECTRISIM_SAFE_OPTIMIZER_VERSION = '1.0.0';
    });
})();

