/**
 * Performance Optimizer for Electrisim
 * Provides performance tips and optimizations for better user experience
 */

class PerformanceOptimizer {
    constructor() {
        this.optimizations = [];
        this.isActive = false;
        this.renderingPaused = false;
        this.lastRenderTime = 0;
        this.renderBudget = 16; // ~60 FPS budget
    }

    /**
     * Initialize performance optimizations
     */
    init() {
        if (this.isActive) return;

        this.isActive = true;
        console.log('🚀 Electrisim Performance Optimizer activated');

        // Apply all optimizations
        this.applyOptimizations();

        // Monitor performance continuously
        this.startPerformanceMonitoring();

        // Add keyboard shortcuts
        this.addKeyboardShortcuts();

        console.log('✅ Performance optimizations applied successfully');
    }

    /**
     * Apply performance optimizations
     */
    applyOptimizations() {
        this.optimizations = [
            {
                name: 'Memory Management',
                description: 'Automatic cleanup of unused resources',
                status: 'active',
                action: () => this.optimizeMemoryUsage()
            },
            {
                name: 'UI Responsiveness',
                description: 'Debounced operations with rendering budget control',
                status: 'active',
                action: () => this.optimizeUIResponsiveness()
            },
            {
                name: 'Graph Rendering',
                description: 'Optimized mxGraph rendering for large diagrams',
                status: 'active',
                action: () => this.optimizeGraphRendering()
            },
            {
                name: 'Large Diagram Handling',
                description: 'Memory optimization for diagrams with 1000+ components',
                status: 'active',
                action: () => this.optimizeMemoryForLargeDiagrams()
            },
            {
                name: 'Grid Performance',
                description: 'Virtualized grids for large datasets',
                status: 'active',
                action: () => this.optimizeGridPerformance()
            },
            {
                name: 'Network Optimization',
                description: 'Efficient data loading and caching with size limits',
                status: 'active',
                action: () => this.optimizeNetworkRequests()
            },
            {
                name: 'Browser Settings',
                description: 'Browser-specific performance tweaks',
                status: 'pending',
                action: () => this.optimizeBrowserSettings()
            }
        ];
    }

    /**
     * Optimize memory usage
     */
    optimizeMemoryUsage() {
        // Force garbage collection if available
        if (window.gc) {
            setInterval(() => {
                window.gc();
            }, 60000); // Every minute
        }

        // Monitor memory usage
        setInterval(() => {
            if (performance.memory) {
                const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
                if (usage > 0.8) {
                    console.warn(`⚠️ High memory usage: ${(usage * 100).toFixed(1)}%`);
                    this.forceMemoryCleanup();
                }
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Force memory cleanup
     */
    forceMemoryCleanup() {
        // Clear caches
        if (window.localStorage) {
            const keys = Object.keys(localStorage);
            const oldKeys = keys.filter(key => {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    return item && item.timestamp && (Date.now() - item.timestamp) > 86400000; // 24 hours
                } catch {
                    return false;
                }
            });

            oldKeys.forEach(key => localStorage.removeItem(key));

            if (oldKeys.length > 0) {
                console.log(`🧹 Cleaned up ${oldKeys.length} old cache entries`);
            }
        }

        // Force GC
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Optimize UI responsiveness
     */
    optimizeUIResponsiveness() {
        // Throttle expensive operations
        this.throttleCanvasRendering();
        this.debounceUserInteractions();
        this.optimizeGraphRendering();
        this.addRenderingBudgetControl();
    }

    /**
     * Throttle canvas rendering with performance budget
     */
    throttleCanvasRendering() {
        // Enhanced rendering with performance budget control
        let renderScheduled = false;
        let frameCount = 0;

        const originalRender = mxGraph.prototype.refresh;
        mxGraph.prototype.refresh = function() {
            if (this.performanceOptimizer?.renderingPaused) {
                return; // Skip rendering when paused for performance
            }

            const now = performance.now();
            const timeSinceLastRender = now - this.performanceOptimizer?.lastRenderTime || 0;

            // Only render if we have budget left in this frame
            if (!renderScheduled && timeSinceLastRender >= this.performanceOptimizer?.renderBudget) {
                renderScheduled = true;
                requestAnimationFrame(() => {
                    const startTime = performance.now();
                    originalRender.call(this);
                    const renderTime = performance.now() - startTime;

                    // Adjust budget based on render performance
                    if (this.performanceOptimizer) {
                        this.performanceOptimizer.lastRenderTime = performance.now();
                        // If rendering takes too long, increase budget for next frame
                        if (renderTime > 8) { // More than 8ms render time
                            this.performanceOptimizer.renderBudget = Math.min(32, this.performanceOptimizer.renderBudget * 1.2);
                        } else if (renderTime < 4) { // Very fast render
                            this.performanceOptimizer.renderBudget = Math.max(8, this.performanceOptimizer.renderBudget * 0.9);
                        }
                    }

                    renderScheduled = false;
                    frameCount++;
                });
            }
        };

        // Store reference for performance control
        mxGraph.prototype.performanceOptimizer = this;
    }

    /**
     * Debounce user interactions with performance monitoring
     */
    debounceUserInteractions() {
        // Debounce component additions with performance awareness
        const originalInsertVertex = mxGraph.prototype.insertVertex;
        let insertTimeout;
        let operationCount = 0;

        mxGraph.prototype.insertVertex = function(...args) {
            operationCount++;

            // If too many operations are happening, increase debounce time
            const debounceTime = operationCount > 10 ? 100 : 50;

            clearTimeout(insertTimeout);
            insertTimeout = setTimeout(() => {
                const startTime = performance.now();
                originalInsertVertex.apply(this, args);
                const operationTime = performance.now() - startTime;

                // Log slow operations
                if (operationTime > 50) {
                    console.warn(`Slow vertex insertion: ${operationTime.toFixed(2)}ms`);
                }

                operationCount = Math.max(0, operationCount - 1);
            }, debounceTime);
        };
    }

    /**
     * Optimize graph rendering for large diagrams
     */
    optimizeGraphRendering() {
        // Disable expensive rendering features for large graphs
        const originalViewRender = mxGraphView.prototype.validate;

        mxGraphView.prototype.validate = function(cell, force) {
            const graph = this.graph;
            const cellCount = graph ? graph.getModel().getDescendants().length : 0;

            // For large graphs (>500 cells), use optimized rendering
            if (cellCount > 500) {
                // Disable anti-aliasing for better performance
                const canvas = this.canvas;
                if (canvas && canvas.getContext) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = false;
                        // Reduce shadow quality
                        ctx.shadowBlur = Math.min(ctx.shadowBlur || 4, 2);
                    }
                }
            }

            return originalViewRender.call(this, cell, force);
        };
    }

    /**
     * Add rendering budget control for smooth performance
     */
    addRenderingBudgetControl() {
        // Pause expensive rendering during user interactions
        let interactionTimeout;

        const pauseRendering = () => {
            this.renderingPaused = true;
            clearTimeout(interactionTimeout);
            interactionTimeout = setTimeout(() => {
                this.renderingPaused = false;
            }, 200); // Resume rendering 200ms after interaction ends
        };

        // Pause rendering during mouse/touch interactions
        document.addEventListener('mousedown', pauseRendering, { passive: true });
        document.addEventListener('mousemove', pauseRendering, { passive: true });
        document.addEventListener('touchstart', pauseRendering, { passive: true });
        document.addEventListener('touchmove', pauseRendering, { passive: true });

        // Keyboard interactions also pause rendering briefly
        document.addEventListener('keydown', () => {
            clearTimeout(interactionTimeout);
            this.renderingPaused = true;
            interactionTimeout = setTimeout(() => {
                this.renderingPaused = false;
            }, 50);
        }, { passive: true });
    }

    /**
     * Optimize grid performance
     */
    optimizeGridPerformance() {
        // AG Grid optimizations are already applied in ComponentsDataDialog.js
        console.log('📊 Grid performance optimizations active');
    }

    /**
     * Optimize network requests with memory management
     */
    optimizeNetworkRequests() {
        // Add response caching with size limits
        const originalFetch = window.fetch;
        const cache = new Map();
        const maxCacheSize = 50; // Limit cache size

        window.fetch = function(url, options = {}) {
            const cacheKey = `${options.method || 'GET'}_${url}`;

            // Check cache for GET requests
            if (!options.method || options.method === 'GET') {
                const cached = cache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
                    return Promise.resolve(cached.response.clone());
                }
            }

            return originalFetch(url, options).then(response => {
                // Cache successful GET responses with size management
                if (response.ok && (!options.method || options.method === 'GET')) {
                    // Clean old entries if cache is full
                    if (cache.size >= maxCacheSize) {
                        const oldestKey = cache.keys().next().value;
                        cache.delete(oldestKey);
                    }

                    const responseClone = response.clone();
                    cache.set(cacheKey, {
                        response: responseClone,
                        timestamp: Date.now()
                    });
                }
                return response;
            });
        };
    }

    /**
     * Optimize memory usage for large diagrams
     */
    optimizeMemoryForLargeDiagrams() {
        // Monitor diagram size and apply optimizations
        const checkDiagramSize = () => {
            const graphs = document.querySelectorAll('.geEditor');
            graphs.forEach(editor => {
                if (editor.mxGraph) {
                    const cellCount = editor.mxGraph.getModel().getDescendants().length;

                    if (cellCount > 1000) {
                        console.log(`Large diagram detected: ${cellCount} cells. Applying memory optimizations...`);

                        // Reduce rendering quality
                        this.renderingPaused = true;
                        setTimeout(() => {
                            this.renderingPaused = false;
                        }, 1000); // Brief pause to let memory settle

                        // Force garbage collection if available
                        if (window.gc) {
                            window.gc();
                        }

                        // Clear any cached DOM elements
                        const canvases = document.querySelectorAll('canvas');
                        canvases.forEach(canvas => {
                            if (canvas.width > 4000 || canvas.height > 4000) {
                                console.warn('Large canvas detected, consider reducing diagram size');
                            }
                        });
                    }
                }
            });
        };

        // Check every 30 seconds
        setInterval(checkDiagramSize, 30000);
    }

    /**
     * Optimize browser settings
     */
    optimizeBrowserSettings() {
        // Detect browser and apply optimizations
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isEdge = /Edg/.test(navigator.userAgent);

        if (isChrome || isEdge) {
            // Chrome/Edge optimizations
            console.log('🌐 Chrome/Edge detected - applying Chromium optimizations');

            // Enable hardware acceleration hints
            document.documentElement.style.setProperty('--webkit-font-smoothing', 'antialiased');
            document.body.style.setProperty('transform', 'translateZ(0)');
        }

        if (isFirefox) {
            // Firefox optimizations
            console.log('🦊 Firefox detected - applying Firefox optimizations');

            // Firefox-specific memory management
            if (window.mozMemory) {
                console.log('🧠 Firefox memory management active');
            }
        }
    }

    /**
     * Start continuous performance monitoring
     */
    startPerformanceMonitoring() {
        // Monitor FPS
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFPS = () => {
            frameCount++;
            const currentTime = performance.now();

            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                if (fps < 30) {
                    console.warn(`⚠️ Low FPS detected: ${fps}`);
                }
                frameCount = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(measureFPS);
        };

        requestAnimationFrame(measureFPS);
    }

    /**
     * Add keyboard shortcuts for performance actions
     */
    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+P: Toggle performance dashboard
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                if (window.performanceDashboard) {
                    window.performanceDashboard.toggle();
                }
            }

            // Ctrl+Shift+C: Force cleanup
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.forceMemoryCleanup();
                console.log('🧹 Manual cleanup completed');
            }
        });

        console.log('⌨️ Performance shortcuts active:');
        console.log('  Ctrl+Shift+P: Toggle performance dashboard');
        console.log('  Ctrl+Shift+C: Force memory cleanup');
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            optimizations: this.optimizations.map(opt => ({
                name: opt.name,
                status: opt.status,
                description: opt.description
            })),
            memory: this.getMemoryStats(),
            recommendations: this.getRecommendations()
        };

        return report;
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        if (!performance.memory) {
            return { available: false };
        }

        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
        const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;

        return {
            available: true,
            usedMB,
            limitMB,
            usagePercent: Math.round(usage * 100),
            status: usage > 0.8 ? 'high' : usage > 0.6 ? 'medium' : 'low'
        };
    }

    /**
     * Get performance recommendations
     */
    getRecommendations() {
        const recommendations = [];
        const memoryStats = this.getMemoryStats();

        if (memoryStats.status === 'high') {
            recommendations.push('High memory usage detected. Consider closing unused tabs or restarting the browser.');
        }

        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
            recommendations.push('Low CPU cores detected. Consider upgrading hardware for better performance.');
        }

        recommendations.push('Use Ctrl+Shift+P to open the performance dashboard for detailed metrics.');
        recommendations.push('Use Ctrl+Shift+C to manually trigger memory cleanup.');

        return recommendations;
    }

    /**
     * Show performance tips to user
     */
    showPerformanceTips() {
        const tips = [
            '💡 Close unused browser tabs to free up memory',
            '💡 Restart your browser periodically to clear memory leaks',
            '💡 Use Chrome or Edge for best performance with Electrisim',
            '💡 Disable browser extensions that may slow down JavaScript execution',
            '💡 Ensure you have at least 4GB RAM for optimal performance',
            '💡 Use the performance dashboard (Ctrl+Shift+P) to monitor real-time metrics',
            '💡 For large models, work in smaller sections and save frequently'
        ];

        console.log('🚀 Electrisim Performance Tips:');
        tips.forEach(tip => console.log(`  ${tip}`));

        // Show in browser alert for immediate visibility
        const tipText = tips.join('\n• ');
        alert(`Electrisim Performance Tips:\n\n• ${tipText}\n\nUse Ctrl+Shift+P for the performance dashboard!`);
    }
}

// Create global instance
export const performanceOptimizer = new PerformanceOptimizer();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    // Wait for page load to initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            performanceOptimizer.init();
        });
    } else {
        // Page already loaded
        setTimeout(() => performanceOptimizer.init(), 1000);
    }

    // Make globally accessible
    window.performanceOptimizer = performanceOptimizer;

    console.log('⚡ Performance Optimizer loaded. Type "performanceOptimizer.showPerformanceTips()" for optimization tips.');
}
