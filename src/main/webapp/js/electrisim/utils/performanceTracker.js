// Performance Tracking Utility
// Monitors querySelector usage and tracks performance metrics

class PerformanceTracker {
    constructor() {
        this.metrics = {
            querySelectorCalls: 0,
            querySelectorTime: 0,
            getElementByIdCalls: 0,
            getElementByIdTime: 0,
            longTasks: [],
            renderTimes: []
        };
        
        this.enabled = true;
        this.longTaskThreshold = 50; // ms
        
        // Intercept querySelector calls
        this.interceptDOMQueries();
        
        // Monitor long tasks
        this.monitorLongTasks();
    }

    /**
     * Intercept and measure querySelector calls
     */
    interceptDOMQueries() {
        // Store original methods
        const originalQuerySelector = Document.prototype.querySelector;
        const originalQuerySelectorAll = Document.prototype.querySelectorAll;
        const originalGetElementById = Document.prototype.getElementById;
        
        const tracker = this;

        // Intercept querySelector
        Document.prototype.querySelector = function(selector) {
            const start = performance.now();
            tracker.metrics.querySelectorCalls++;
            
            const result = originalQuerySelector.call(this, selector);
            
            const duration = performance.now() - start;
            tracker.metrics.querySelectorTime += duration;
            
            if (duration > 1) {
                console.warn(`⚠️ Slow querySelector: "${selector}" took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        };

        // Intercept querySelectorAll
        Document.prototype.querySelectorAll = function(selector) {
            const start = performance.now();
            const result = originalQuerySelectorAll.call(this, selector);
            const duration = performance.now() - start;
            
            if (duration > 5) {
                console.warn(`⚠️ Slow querySelectorAll: "${selector}" took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        };

        // Intercept getElementById
        Document.prototype.getElementById = function(id) {
            const start = performance.now();
            tracker.metrics.getElementByIdCalls++;
            
            const result = originalGetElementById.call(this, id);
            
            const duration = performance.now() - start;
            tracker.metrics.getElementByIdTime += duration;
            
            return result;
        };

        console.log('🔍 Performance tracking enabled for DOM queries');
    }

    /**
     * Monitor long tasks using PerformanceObserver
     */
    monitorLongTasks() {
        if (typeof PerformanceObserver === 'undefined') {
            console.warn('PerformanceObserver not available, long task monitoring disabled');
            return;
        }

        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > this.longTaskThreshold) {
                        this.metrics.longTasks.push({
                            name: entry.name,
                            duration: entry.duration,
                            startTime: entry.startTime,
                            timestamp: Date.now()
                        });
                        
                        console.warn(`⚠️ Long task detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });

            observer.observe({ entryTypes: ['measure', 'longtask'] });
            console.log('🔍 Long task monitoring enabled');
        } catch (error) {
            console.warn('Could not enable long task monitoring:', error);
        }
    }

    /**
     * Measure a function's execution time
     * @param {string} name - Name of the operation
     * @param {Function} fn - Function to measure
     * @returns {*} Result of the function
     */
    measure(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        performance.mark(`${name}-end`);
        performance.measure(name, undefined, `${name}-end`);
        
        if (duration > this.longTaskThreshold) {
            console.warn(`⚠️ ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }

    /**
     * Measure an async function's execution time
     * @param {string} name - Name of the operation
     * @param {Function} fn - Async function to measure
     * @returns {Promise<*>} Result of the function
     */
    async measureAsync(name, fn) {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        
        performance.mark(`${name}-end`);
        performance.measure(name, undefined, `${name}-end`);
        
        if (duration > this.longTaskThreshold) {
            console.warn(`⚠️ ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }

    /**
     * Get current performance metrics
     * @returns {object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            avgQuerySelectorTime: this.metrics.querySelectorCalls > 0 
                ? (this.metrics.querySelectorTime / this.metrics.querySelectorCalls).toFixed(2)
                : 0,
            avgGetElementByIdTime: this.metrics.getElementByIdCalls > 0
                ? (this.metrics.getElementByIdTime / this.metrics.getElementByIdCalls).toFixed(2)
                : 0,
            totalLongTasks: this.metrics.longTasks.length,
            totalLongTaskTime: this.metrics.longTasks.reduce((sum, task) => sum + task.duration, 0).toFixed(2)
        };
    }

    /**
     * Log performance report
     */
    logReport() {
        const metrics = this.getMetrics();
        
        console.log('📊 ========== PERFORMANCE REPORT ==========');
        console.log('📊 DOM Query Performance:');
        console.log(`   - querySelector calls: ${metrics.querySelectorCalls}`);
        console.log(`   - querySelector total time: ${metrics.querySelectorTime.toFixed(2)}ms`);
        console.log(`   - querySelector avg time: ${metrics.avgQuerySelectorTime}ms`);
        console.log(`   - getElementById calls: ${metrics.getElementByIdCalls}`);
        console.log(`   - getElementById total time: ${metrics.getElementByIdTime.toFixed(2)}ms`);
        console.log(`   - getElementById avg time: ${metrics.avgGetElementByIdTime}ms`);
        
        console.log('📊 Long Tasks:');
        console.log(`   - Total long tasks: ${metrics.totalLongTasks}`);
        console.log(`   - Total long task time: ${metrics.totalLongTaskTime}ms`);
        
        if (this.metrics.longTasks.length > 0) {
            console.log('   - Top 5 longest tasks:');
            const topTasks = [...this.metrics.longTasks]
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5);
            
            topTasks.forEach((task, i) => {
                console.log(`     ${i + 1}. ${task.name}: ${task.duration.toFixed(2)}ms`);
            });
        }
        
        console.log('📊 ========================================');
        
        return metrics;
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            querySelectorCalls: 0,
            querySelectorTime: 0,
            getElementByIdCalls: 0,
            getElementByIdTime: 0,
            longTasks: [],
            renderTimes: []
        };
        console.log('🔄 Performance metrics reset');
    }

    /**
     * Enable performance tracking
     */
    enable() {
        this.enabled = true;
        console.log('✅ Performance tracking enabled');
    }

    /**
     * Disable performance tracking
     */
    disable() {
        this.enabled = false;
        console.log('⏸️ Performance tracking disabled');
    }

    /**
     * Track a render operation
     * @param {string} name - Name of the render
     * @param {number} duration - Duration in ms
     */
    trackRender(name, duration) {
        this.metrics.renderTimes.push({
            name,
            duration,
            timestamp: Date.now()
        });
    }

    /**
     * Get render statistics
     * @returns {object} Render stats
     */
    getRenderStats() {
        if (this.metrics.renderTimes.length === 0) {
            return null;
        }

        const durations = this.metrics.renderTimes.map(r => r.duration);
        const total = durations.reduce((sum, d) => sum + d, 0);
        const avg = total / durations.length;
        const max = Math.max(...durations);
        const min = Math.min(...durations);

        return {
            count: this.metrics.renderTimes.length,
            total: total.toFixed(2),
            average: avg.toFixed(2),
            max: max.toFixed(2),
            min: min.toFixed(2)
        };
    }
}

// Create global instance (but don't enable by default to avoid overhead)
const performanceTracker = new PerformanceTracker();

// Expose globally
window.PerformanceTracker = PerformanceTracker;
window.performanceTracker = performanceTracker;

// Add convenience methods to window
window.logPerformanceReport = () => performanceTracker.logReport();
window.resetPerformanceMetrics = () => performanceTracker.reset();

// Export for module usage
export { PerformanceTracker, performanceTracker };
export default performanceTracker;

console.log('📊 Performance Tracker initialized. Use window.logPerformanceReport() to see metrics.');

