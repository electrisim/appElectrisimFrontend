/**
 * Performance Utilities for Electrisim
 * Provides debounce, throttle, and cleanup mechanisms to prevent freezing
 */

/**
 * Debounce function - Delays execution until after wait milliseconds have elapsed 
 * since the last time it was invoked
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @param {boolean} immediate - Trigger on leading edge instead of trailing
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle function - Ensures function is called at most once per specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    let lastResult;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            lastResult = func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
        return lastResult;
    };
}

/**
 * Request Animation Frame throttle - Better for visual updates
 * @param {Function} callback - Function to call on next animation frame
 * @returns {Function} RAF-throttled function
 */
export function rafThrottle(callback) {
    let requestId = null;
    let lastArgs;
    
    const later = (context) => () => {
        requestId = null;
        callback.apply(context, lastArgs);
    };
    
    const throttled = function(...args) {
        lastArgs = args;
        if (requestId === null) {
            requestId = requestAnimationFrame(later(this));
        }
    };
    
    throttled.cancel = () => {
        cancelAnimationFrame(requestId);
        requestId = null;
    };
    
    return throttled;
}

/**
 * Event Listener Cleanup Registry
 * Tracks and automatically cleans up event listeners to prevent memory leaks
 */
class EventListenerRegistry {
    constructor() {
        this.listeners = new Map();
        this.listenerCounter = 0;
    }
    
    /**
     * Add an event listener with automatic cleanup tracking
     * @param {EventTarget} element - DOM element or object
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     * @returns {string} Unique identifier for this listener
     */
    add(element, event, handler, options = {}) {
        if (!element || !event || !handler) {
            console.warn('EventListenerRegistry.add: Invalid parameters', { element, event, handler });
            return null;
        }
        
        const id = `listener_${this.listenerCounter++}`;
        element.addEventListener(event, handler, options);
        
        this.listeners.set(id, {
            element,
            event,
            handler,
            options,
            timestamp: Date.now()
        });
        
        return id;
    }
    
    /**
     * Remove a specific event listener by ID
     * @param {string} id - Listener ID returned from add()
     */
    remove(id) {
        const listener = this.listeners.get(id);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.listeners.delete(id);
            return true;
        }
        return false;
    }
    
    /**
     * Remove all event listeners associated with an element
     * @param {EventTarget} element - DOM element or object
     */
    removeByElement(element) {
        let removed = 0;
        for (const [id, listener] of this.listeners.entries()) {
            if (listener.element === element) {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
                this.listeners.delete(id);
                removed++;
            }
        }
        return removed;
    }
    
    /**
     * Remove all tracked event listeners
     */
    removeAll() {
        for (const [id, listener] of this.listeners.entries()) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        }
        this.listeners.clear();
    }
    
    /**
     * Get statistics about tracked listeners
     */
    getStats() {
        const stats = {
            total: this.listeners.size,
            byEvent: {},
            oldestTimestamp: Date.now(),
            elements: new Set()
        };
        
        for (const listener of this.listeners.values()) {
            stats.byEvent[listener.event] = (stats.byEvent[listener.event] || 0) + 1;
            stats.oldestTimestamp = Math.min(stats.oldestTimestamp, listener.timestamp);
            stats.elements.add(listener.element);
        }
        
        stats.uniqueElements = stats.elements.size;
        delete stats.elements;
        
        return stats;
    }
}

// Create global registry instance
export const globalEventRegistry = new EventListenerRegistry();

/**
 * Safe setTimeout with automatic cleanup
 * Prevents timer leaks by tracking all timeouts
 */
class TimeoutRegistry {
    constructor() {
        this.timeouts = new Set();
    }
    
    setTimeout(callback, delay, ...args) {
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(timeoutId);
            callback(...args);
        }, delay);
        this.timeouts.add(timeoutId);
        return timeoutId;
    }
    
    clearTimeout(timeoutId) {
        if (this.timeouts.has(timeoutId)) {
            clearTimeout(timeoutId);
            this.timeouts.delete(timeoutId);
        }
    }
    
    clearAll() {
        for (const timeoutId of this.timeouts) {
            clearTimeout(timeoutId);
        }
        this.timeouts.clear();
    }
    
    getStats() {
        return {
            activeTimeouts: this.timeouts.size
        };
    }
}

export const globalTimeoutRegistry = new TimeoutRegistry();

/**
 * Promise with timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Error message on timeout
 * @returns {Promise} Promise that rejects on timeout
 */
export function promiseWithTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}

/**
 * Batch processor - Execute operations in chunks to avoid UI blocking
 * @param {Array} items - Items to process
 * @param {Function} processFn - Function to process each item
 * @param {number} batchSize - Items per batch
 * @param {number} delayMs - Delay between batches
 * @returns {Promise} Promise that resolves when all items are processed
 */
export async function processBatch(items, processFn, batchSize = 50, delayMs = 10) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processFn));
        results.push(...batchResults);
        
        // Yield to UI thread between batches
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return results;
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
    constructor(threshold = 0.9) {
        this.threshold = threshold;
        this.samples = [];
        this.maxSamples = 100;
    }
    
    checkMemory() {
        if (performance.memory) {
            const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            this.samples.push({
                timestamp: Date.now(),
                usage,
                usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
                limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            });
            
            // Keep only recent samples
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
            }
            
            return {
                usage,
                isHigh: usage > this.threshold,
                usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
                limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            };
        }
        return null;
    }
    
    getStats() {
        if (this.samples.length === 0) return null;
        
        const avgUsage = this.samples.reduce((sum, s) => sum + s.usage, 0) / this.samples.length;
        const maxUsage = Math.max(...this.samples.map(s => s.usage));
        
        return {
            avgUsage: avgUsage.toFixed(3),
            maxUsage: maxUsage.toFixed(3),
            samples: this.samples.length,
            current: this.samples[this.samples.length - 1]
        };
    }
}

/**
 * Performance profiler for tracking operation timing
 */
export class PerformanceProfiler {
    constructor() {
        this.marks = new Map();
        this.measures = [];
    }
    
    start(name) {
        this.marks.set(name, performance.now());
    }
    
    end(name) {
        const startTime = this.marks.get(name);
        if (startTime !== undefined) {
            const duration = performance.now() - startTime;
            this.measures.push({
                name,
                duration,
                timestamp: Date.now()
            });
            this.marks.delete(name);
            return duration;
        }
        return null;
    }
    
    getStats(name = null) {
        const filtered = name 
            ? this.measures.filter(m => m.name === name)
            : this.measures;
            
        if (filtered.length === 0) return null;
        
        const durations = filtered.map(m => m.duration);
        return {
            count: filtered.length,
            avg: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
            min: Math.min(...durations).toFixed(2),
            max: Math.max(...durations).toFixed(2),
            total: durations.reduce((a, b) => a + b, 0).toFixed(2)
        };
    }
    
    clear() {
        this.marks.clear();
        this.measures = [];
    }
}

// Create global instances
export const memoryMonitor = new MemoryMonitor();
export const profiler = new PerformanceProfiler();

/**
 * Idle callback wrapper for non-critical work
 * @param {Function} callback - Function to call when idle
 * @param {Object} options - Options for idle callback
 */
export function runWhenIdle(callback, options = { timeout: 2000 }) {
    if ('requestIdleCallback' in window) {
        return requestIdleCallback(callback, options);
    } else {
        // Fallback for browsers without requestIdleCallback
        return setTimeout(callback, 1);
    }
}

/**
 * Cancel idle callback
 * @param {number} id - ID from runWhenIdle
 */
export function cancelIdle(id) {
    if ('cancelIdleCallback' in window) {
        cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

// Export singleton instances for global use
if (typeof window !== 'undefined') {
    window.performanceUtils = {
        debounce,
        throttle,
        rafThrottle,
        globalEventRegistry,
        globalTimeoutRegistry,
        promiseWithTimeout,
        processBatch,
        memoryMonitor,
        profiler,
        runWhenIdle,
        cancelIdle
    };
}

console.log('✅ Performance utilities loaded');


