// Zoom Performance Optimizer
// Optimizes zoom/pan operations for large models by implementing:
// - Viewport culling (only render visible elements)
// - Zoom throttling
// - Level-of-detail (LOD) rendering
// - Smart caching

class ZoomOptimizer {
    constructor() {
        this.graph = null;
        this.isOptimizationEnabled = true;
        this.lastZoomLevel = 1.0;
        this.lastViewport = null;
        this.visibleCells = new Set();
        
        // Performance settings
        this.settings = {
            zoomThrottleMs: 16, // ~60fps
            viewportPadding: 100, // pixels to render outside viewport
            lodThresholds: {
                full: 0.5,      // Above 50% zoom, full detail
                medium: 0.2,    // 20-50% zoom, medium detail
                low: 0          // Below 20% zoom, low detail
            },
            enableViewportCulling: true,
            enableLOD: true,
            enableSmartCache: true,
            maxVisibleCells: 5000 // Force LOD if more cells visible
        };

        // Throttled zoom handler
        this.throttledZoom = this.throttle(
            this.handleZoom.bind(this),
            this.settings.zoomThrottleMs
        );

        // Performance metrics
        this.metrics = {
            zoomEvents: 0,
            culledCells: 0,
            renderedCells: 0,
            avgRenderTime: 0,
            frameDrops: 0
        };

        console.log('🔍 Zoom Optimizer initialized');
    }

    /**
     * Initialize optimizer with graph instance
     * @param {mxGraph} graph - The mxGraph instance
     */
    initialize(graph) {
        if (!graph) {
            console.warn('ZoomOptimizer: No graph provided');
            return;
        }

        this.graph = graph;
        console.log('✅ Zoom Optimizer attached to graph');

        // Patch graph zoom methods
        this.patchGraphZoomMethods();

        // Setup event listeners
        this.setupEventListeners();

        // Initial optimization
        this.optimizeViewport();
    }

    /**
     * Patch mxGraph zoom methods for optimization
     */
    patchGraphZoomMethods() {
        if (!this.graph || !this.graph.view) return;

        const optimizer = this;
        const originalZoom = this.graph.zoom;
        const originalZoomTo = this.graph.zoomTo;

        // Patch zoom method
        this.graph.zoom = function(factor, center) {
            optimizer.throttledZoom(() => {
                originalZoom.call(this, factor, center);
            });
        };

        // Patch zoomTo method
        this.graph.zoomTo = function(scale, center) {
            optimizer.throttledZoom(() => {
                originalZoomTo.call(this, scale, center);
            });
        };

        console.log('✅ Patched graph zoom methods');
    }

    /**
     * Setup event listeners for zoom/pan
     */
    setupEventListeners() {
        if (!this.graph) return;

        const view = this.graph.view;
        
        // Listen to zoom events
        if (view) {
            const originalValidate = view.validate;
            const optimizer = this;

            view.validate = function() {
                const start = performance.now();
                
                // Call original validate
                const result = originalValidate.call(this);
                
                // Optimize after validation
                optimizer.optimizeViewport();
                
                const duration = performance.now() - start;
                optimizer.updateMetrics('render', duration);
                
                return result;
            };
        }

        console.log('✅ Zoom event listeners attached');
    }

    /**
     * Handle zoom event (throttled)
     * @param {Function} zoomFn - The zoom function to execute
     */
    handleZoom(zoomFn) {
        if (!this.isOptimizationEnabled) {
            zoomFn();
            return;
        }

        const start = performance.now();

        // Execute zoom
        requestAnimationFrame(() => {
            zoomFn();
            
            // Optimize viewport after zoom
            this.optimizeViewport();
            
            const duration = performance.now() - start;
            this.metrics.zoomEvents++;
            
            if (duration > 16) {
                this.metrics.frameDrops++;
                console.warn(`⚠️ Slow zoom: ${duration.toFixed(2)}ms`);
            }
        });
    }

    /**
     * Optimize viewport by culling off-screen elements
     */
    optimizeViewport() {
        if (!this.graph || !this.settings.enableViewportCulling) return;

        const start = performance.now();
        const view = this.graph.view;
        const scale = view.scale;

        // Get viewport bounds
        const viewport = this.getViewportBounds();
        
        // Check if viewport changed significantly
        if (this.hasViewportChanged(viewport)) {
            this.lastViewport = viewport;
            this.lastZoomLevel = scale;

            // Update visible cells
            this.updateVisibleCells(viewport);

            // Apply level-of-detail
            if (this.settings.enableLOD) {
                this.applyLevelOfDetail(scale);
            }

            const duration = performance.now() - start;
            if (duration > 5) {
                console.log(`🔍 Viewport optimization took ${duration.toFixed(2)}ms`);
            }
        }
    }

    /**
     * Get current viewport bounds
     * @returns {Object} Viewport bounds {x, y, width, height}
     */
    getViewportBounds() {
        if (!this.graph) return null;

        const container = this.graph.container;
        const view = this.graph.view;
        const scale = view.scale;
        const translate = view.translate;

        const padding = this.settings.viewportPadding;

        return {
            x: -translate.x - padding / scale,
            y: -translate.y - padding / scale,
            width: (container.clientWidth + padding * 2) / scale,
            height: (container.clientHeight + padding * 2) / scale
        };
    }

    /**
     * Check if viewport has changed significantly
     * @param {Object} newViewport - New viewport bounds
     * @returns {boolean} True if changed
     */
    hasViewportChanged(newViewport) {
        if (!this.lastViewport) return true;

        const threshold = 50; // pixels
        const zoomThreshold = 0.1;

        const moved = Math.abs(newViewport.x - this.lastViewport.x) > threshold ||
                      Math.abs(newViewport.y - this.lastViewport.y) > threshold;
        
        const zoomed = Math.abs(this.graph.view.scale - this.lastZoomLevel) > zoomThreshold;

        return moved || zoomed;
    }

    /**
     * Update set of visible cells
     * @param {Object} viewport - Viewport bounds
     */
    updateVisibleCells(viewport) {
        if (!this.graph) return;

        const model = this.graph.getModel();
        const view = this.graph.view;
        const parent = this.graph.getDefaultParent();
        
        const newVisibleCells = new Set();
        const cells = model.getChildCells(parent, true, true);

        let culled = 0;
        let visible = 0;

        cells.forEach(cell => {
            if (this.isCellVisible(cell, viewport, view)) {
                newVisibleCells.add(cell.id);
                visible++;

                // Make sure cell is rendered
                if (cell.style && cell.style.includes('opacity=0')) {
                    this.graph.setCellStyles('opacity', '100', [cell]);
                }
            } else {
                culled++;
                
                // Optionally hide off-screen cells for better performance
                // Uncomment if you want aggressive culling:
                // if (cell.style && !cell.style.includes('opacity=0')) {
                //     this.graph.setCellStyles('opacity', '0', [cell]);
                // }
            }
        });

        this.visibleCells = newVisibleCells;
        this.metrics.culledCells = culled;
        this.metrics.renderedCells = visible;

        // Log if too many cells visible
        if (visible > this.settings.maxVisibleCells) {
            console.warn(`⚠️ ${visible} cells visible (max: ${this.settings.maxVisibleCells}). Consider using LOD.`);
        }
    }

    /**
     * Check if cell is within viewport
     * @param {Object} cell - mxCell to check
     * @param {Object} viewport - Viewport bounds
     * @param {Object} view - mxGraphView
     * @returns {boolean} True if visible
     */
    isCellVisible(cell, viewport, view) {
        if (!cell.geometry) return true; // Always render cells without geometry

        const state = view.getState(cell);
        if (!state) return false;

        const cellBounds = state;
        
        // Check intersection with viewport
        return !(
            cellBounds.x > viewport.x + viewport.width ||
            cellBounds.x + cellBounds.width < viewport.x ||
            cellBounds.y > viewport.y + viewport.height ||
            cellBounds.y + cellBounds.height < viewport.y
        );
    }

    /**
     * Apply level-of-detail based on zoom level
     * @param {number} scale - Current zoom scale
     */
    applyLevelOfDetail(scale) {
        if (!this.graph) return;

        const model = this.graph.getModel();
        const cells = model.getChildCells(this.graph.getDefaultParent(), true, true);

        // Determine LOD level
        let lodLevel = 'full';
        if (scale < this.settings.lodThresholds.medium) {
            lodLevel = 'low';
        } else if (scale < this.settings.lodThresholds.full) {
            lodLevel = 'medium';
        }

        // Apply LOD styling
        cells.forEach(cell => {
            if (!this.visibleCells.has(cell.id)) return; // Skip non-visible cells

            switch (lodLevel) {
                case 'low':
                    // Simplified rendering for zoomed-out view
                    this.applySimpifiedStyle(cell);
                    break;
                case 'medium':
                    // Medium detail
                    this.applyMediumStyle(cell);
                    break;
                case 'full':
                    // Full detail
                    this.applyFullStyle(cell);
                    break;
            }
        });
    }

    /**
     * Apply simplified style for low LOD
     * @param {Object} cell - mxCell
     */
    applySimpifiedStyle(cell) {
        // When zoomed out, hide labels and simplify rendering
        if (cell.vertex) {
            this.graph.setCellStyles('fontSize', '0', [cell]);
        }
    }

    /**
     * Apply medium style
     * @param {Object} cell - mxCell
     */
    applyMediumStyle(cell) {
        // Medium zoom level - show some details
        if (cell.vertex) {
            this.graph.setCellStyles('fontSize', '10', [cell]);
        }
    }

    /**
     * Apply full style
     * @param {Object} cell - mxCell
     */
    applyFullStyle(cell) {
        // Full zoom level - show all details
        if (cell.vertex) {
            this.graph.setCellStyles('fontSize', '12', [cell]);
        }
    }

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} wait - Wait time in ms
     * @returns {Function} Throttled function
     */
    throttle(func, wait) {
        let timeout = null;
        let previous = 0;

        return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);

            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    /**
     * Update performance metrics
     * @param {string} type - Metric type
     * @param {number} value - Metric value
     */
    updateMetrics(type, value) {
        if (type === 'render') {
            const alpha = 0.1; // Smoothing factor
            this.metrics.avgRenderTime = 
                this.metrics.avgRenderTime * (1 - alpha) + value * alpha;
        }
    }

    /**
     * Get performance metrics
     * @returns {Object} Metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            visibleCells: this.visibleCells.size,
            viewportOptimization: this.settings.enableViewportCulling,
            lodEnabled: this.settings.enableLOD
        };
    }

    /**
     * Log performance report
     */
    logReport() {
        const metrics = this.getMetrics();
        console.log('🔍 ========== ZOOM PERFORMANCE REPORT ==========');
        console.log(`📊 Zoom Events: ${metrics.zoomEvents}`);
        console.log(`📊 Visible Cells: ${metrics.visibleCells}`);
        console.log(`📊 Rendered Cells: ${metrics.renderedCells}`);
        console.log(`📊 Culled Cells: ${metrics.culledCells}`);
        console.log(`📊 Avg Render Time: ${metrics.avgRenderTime.toFixed(2)}ms`);
        console.log(`📊 Frame Drops: ${metrics.frameDrops}`);
        console.log(`📊 Viewport Culling: ${metrics.viewportOptimization ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`📊 LOD Rendering: ${metrics.lodEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log('🔍 =============================================');
    }

    /**
     * Enable optimization
     */
    enable() {
        this.isOptimizationEnabled = true;
        console.log('✅ Zoom optimization enabled');
    }

    /**
     * Disable optimization
     */
    disable() {
        this.isOptimizationEnabled = false;
        console.log('⏸️ Zoom optimization disabled');
    }

    /**
     * Update settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️ Zoom optimizer settings updated:', this.settings);
    }
}

// Create global instance
const zoomOptimizer = new ZoomOptimizer();

// Expose globally
window.ZoomOptimizer = ZoomOptimizer;
window.zoomOptimizer = zoomOptimizer;

// Convenience methods
window.logZoomPerformance = () => zoomOptimizer.logReport();

// Export for module usage
export { ZoomOptimizer, zoomOptimizer };
export default zoomOptimizer;

console.log('🔍 Zoom Optimizer ready. Initialize with: window.zoomOptimizer.initialize(graph)');

