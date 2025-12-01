// Canvas Rendering Optimizer for Large Models
// Reduces rendering load during zoom/pan operations

class CanvasOptimizer {
    constructor() {
        this.graph = null;
        this.isOptimizing = false;
        this.renderQueue = [];
        this.renderCache = new Map();
        
        // Settings
        this.settings = {
            enableFastRender: true,      // Use simplified rendering during zoom
            enableRenderQueue: true,      // Queue renders instead of immediate
            cacheRenderedCells: true,     // Cache cell renderings
            throttleMs: 16,               // Throttle render to 60fps
            simplifyDuringZoom: true,     // Simplify rendering while zooming
            hideLabelsWhenZooming: true,  // Hide labels during zoom for speed
            zoomEndDelay: 150             // ms to wait before full render after zoom ends
        };

        // State
        this.isZooming = false;
        this.zoomTimeout = null;
        this.lastRenderTime = 0;

        console.log('🎨 Canvas Optimizer initialized');
    }

    /**
     * Initialize with graph
     * @param {mxGraph} graph - The mxGraph instance
     */
    initialize(graph) {
        if (!graph) {
            console.warn('CanvasOptimizer: No graph provided');
            return;
        }

        this.graph = graph;
        console.log('✅ Canvas Optimizer attached to graph');

        // Patch rendering methods
        this.patchRenderingMethods();

        // Setup zoom detection
        this.setupZoomDetection();
    }

    /**
     * Patch mxGraph rendering methods
     */
    patchRenderingMethods() {
        if (!this.graph || !this.graph.view) return;

        const optimizer = this;
        const view = this.graph.view;

        // Patch paint method for fast rendering during zoom
        if (view.paint) {
            const originalPaint = view.paint;
            
            view.paint = function(canvas) {
                if (optimizer.isZooming && optimizer.settings.simplifyDuringZoom) {
                    // Fast render mode
                    optimizer.fastRender(canvas, this);
                } else {
                    // Normal render
                    originalPaint.call(this, canvas);
                }
            };
        }

        console.log('✅ Patched canvas rendering methods');
    }

    /**
     * Setup zoom detection to trigger fast rendering
     */
    setupZoomDetection() {
        if (!this.graph) return;

        const optimizer = this;

        // Listen to mouse wheel for zoom detection
        this.graph.container.addEventListener('wheel', (e) => {
            optimizer.startZooming();
        }, { passive: true });

        // Listen to pinch zoom (touch devices)
        this.graph.container.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                optimizer.startZooming();
            }
        }, { passive: true });

        console.log('✅ Zoom detection active');
    }

    /**
     * Start zooming mode (fast rendering)
     */
    startZooming() {
        if (this.isZooming) {
            // Extend zoom period
            clearTimeout(this.zoomTimeout);
        } else {
            this.isZooming = true;
            console.log('🔍 Fast render mode activated');
            
            // Hide labels during zoom if enabled
            if (this.settings.hideLabelsWhenZooming) {
                this.hideLabels();
            }
        }

        // Set timeout to end zooming mode
        this.zoomTimeout = setTimeout(() => {
            this.endZooming();
        }, this.settings.zoomEndDelay);
    }

    /**
     * End zooming mode (back to full rendering)
     */
    endZooming() {
        this.isZooming = false;
        console.log('🎨 Full render mode restored');

        // Show labels again
        if (this.settings.hideLabelsWhenZooming) {
            this.showLabels();
        }

        // Force full re-render
        if (this.graph) {
            this.graph.refresh();
        }
    }

    /**
     * Fast render during zoom
     * @param {Object} canvas - Canvas object
     * @param {Object} view - View object
     */
    fastRender(canvas, view) {
        const start = performance.now();

        try {
            // Get visible cells only
            const cells = this.getVisibleCells();

            // Render simplified version
            cells.forEach(cell => {
                if (cell.vertex) {
                    this.renderSimplifiedVertex(canvas, cell, view);
                } else if (cell.edge) {
                    this.renderSimplifiedEdge(canvas, cell, view);
                }
            });

            const duration = performance.now() - start;
            if (duration > 16) {
                console.warn(`⚠️ Slow fast render: ${duration.toFixed(2)}ms`);
            }
        } catch (error) {
            console.error('Error in fast render:', error);
            // Fallback to normal render
            view.paint.call(view, canvas);
        }
    }

    /**
     * Render simplified vertex (no labels, simple shapes)
     * @param {Object} canvas - Canvas
     * @param {Object} cell - Cell to render
     * @param {Object} view - View
     */
    renderSimplifiedVertex(canvas, cell, view) {
        const state = view.getState(cell);
        if (!state) return;

        // Draw simple rectangle or shape
        canvas.save();
        canvas.setFillColor(state.style.fillColor || '#FFFFFF');
        canvas.setStrokeColor(state.style.strokeColor || '#000000');
        canvas.rect(state.x, state.y, state.width, state.height);
        canvas.fillAndStroke();
        canvas.restore();
    }

    /**
     * Render simplified edge (straight line, no labels)
     * @param {Object} canvas - Canvas
     * @param {Object} cell - Cell to render
     * @param {Object} view - View
     */
    renderSimplifiedEdge(canvas, cell, view) {
        const state = view.getState(cell);
        if (!state || !state.absolutePoints) return;

        const points = state.absolutePoints;
        if (points.length < 2) return;

        canvas.save();
        canvas.setStrokeColor(state.style.strokeColor || '#000000');
        canvas.begin();
        canvas.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            canvas.lineTo(points[i].x, points[i].y);
        }
        canvas.stroke();
        canvas.restore();
    }

    /**
     * Get cells that are currently visible in viewport
     * @returns {Array} Visible cells
     */
    getVisibleCells() {
        if (!this.graph) return [];

        const model = this.graph.getModel();
        const view = this.graph.view;
        const container = this.graph.container;
        
        // Get viewport bounds
        const scale = view.scale;
        const translate = view.translate;
        const viewport = {
            x: -translate.x,
            y: -translate.y,
            width: container.clientWidth / scale,
            height: container.clientHeight / scale
        };

        // Filter visible cells
        const parent = this.graph.getDefaultParent();
        const allCells = model.getChildCells(parent, true, true);
        
        return allCells.filter(cell => {
            if (!cell.geometry) return true;
            
            const geo = cell.geometry;
            return !(
                geo.x > viewport.x + viewport.width ||
                geo.x + geo.width < viewport.x ||
                geo.y > viewport.y + viewport.height ||
                geo.y + geo.height < viewport.y
            );
        });
    }

    /**
     * Hide all labels temporarily
     */
    hideLabels() {
        if (!this.graph) return;

        // Store original label visibility
        if (!this.originalLabelVisible) {
            this.originalLabelVisible = this.graph.labelsVisible;
        }

        // Hide labels
        this.graph.labelsVisible = false;
        this.graph.refresh();
    }

    /**
     * Show labels again
     */
    showLabels() {
        if (!this.graph) return;

        // Restore original visibility
        if (this.originalLabelVisible !== undefined) {
            this.graph.labelsVisible = this.originalLabelVisible;
            this.originalLabelVisible = undefined;
        }

        this.graph.refresh();
    }

    /**
     * Enable canvas optimization
     */
    enable() {
        this.settings.enableFastRender = true;
        console.log('✅ Canvas optimization enabled');
    }

    /**
     * Disable canvas optimization
     */
    disable() {
        this.settings.enableFastRender = false;
        if (this.isZooming) {
            this.endZooming();
        }
        console.log('⏸️ Canvas optimization disabled');
    }

    /**
     * Update settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️ Canvas optimizer settings updated');
    }

    /**
     * Get optimization status
     * @returns {Object} Status
     */
    getStatus() {
        return {
            isZooming: this.isZooming,
            fastRenderEnabled: this.settings.enableFastRender,
            cacheSize: this.renderCache.size,
            settings: this.settings
        };
    }
}

// Create global instance
const canvasOptimizer = new CanvasOptimizer();

// Expose globally
window.CanvasOptimizer = CanvasOptimizer;
window.canvasOptimizer = canvasOptimizer;

// Export
export { CanvasOptimizer, canvasOptimizer };
export default canvasOptimizer;

console.log('🎨 Canvas Optimizer ready. Initialize with: window.canvasOptimizer.initialize(graph)');

