// DOM Cache Utility - Eliminates repeated querySelector calls
// This utility caches DOM queries to improve performance significantly

class DOMCache {
    constructor() {
        this.cache = new Map();
        this.weakCache = new WeakMap();
        this.stats = {
            hits: 0,
            misses: 0,
            cacheSize: 0
        };
        
        // Auto-clear cache when DOM changes significantly
        if (typeof MutationObserver !== 'undefined') {
            this.setupMutationObserver();
        }
    }

    setupMutationObserver() {
        // Clear cache on major DOM changes
        this.observer = new MutationObserver((mutations) => {
            // Only clear if significant changes occurred
            const significantChange = mutations.some(mutation => 
                mutation.type === 'childList' && 
                (mutation.addedNodes.length > 5 || mutation.removedNodes.length > 5)
            );
            
            if (significantChange) {
                this.clearStaleEntries();
            }
        });
        
        // Observe body with throttled observation
        this.observer.observe(document.body, {
            childList: true,
            subtree: false // Only watch direct children for performance
        });
    }

    /**
     * Get element by selector with caching
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Optional context element (default: document)
     * @returns {HTMLElement|null}
     */
    querySelector(selector, context = document) {
        const cacheKey = `${selector}::${context === document ? 'doc' : context.id || 'ctx'}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            // Verify element is still in DOM
            if (cached && document.body.contains(cached)) {
                this.stats.hits++;
                return cached;
            } else {
                // Remove stale entry
                this.cache.delete(cacheKey);
            }
        }
        
        // Cache miss - query the DOM
        this.stats.misses++;
        const element = context.querySelector(selector);
        
        if (element) {
            this.cache.set(cacheKey, element);
            this.stats.cacheSize = this.cache.size;
        }
        
        return element;
    }

    /**
     * Get element by ID (fast path)
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getElementById(id) {
        const cacheKey = `#${id}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (cached && document.body.contains(cached)) {
                this.stats.hits++;
                return cached;
            } else {
                this.cache.delete(cacheKey);
            }
        }
        
        this.stats.misses++;
        const element = document.getElementById(id);
        
        if (element) {
            this.cache.set(cacheKey, element);
            this.stats.cacheSize = this.cache.size;
        }
        
        return element;
    }

    /**
     * Get multiple elements with caching
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Optional context element
     * @returns {NodeList}
     */
    querySelectorAll(selector, context = document) {
        // For querySelectorAll, we don't cache as NodeLists can become stale
        // Instead, we return a live result
        return context.querySelectorAll(selector);
    }

    /**
     * Cache a custom element with a key
     * @param {string} key - Cache key
     * @param {HTMLElement} element - Element to cache
     */
    set(key, element) {
        this.cache.set(key, element);
        this.stats.cacheSize = this.cache.size;
    }

    /**
     * Get cached element by key
     * @param {string} key - Cache key
     * @returns {HTMLElement|null}
     */
    get(key) {
        if (this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (cached && document.body.contains(cached)) {
                this.stats.hits++;
                return cached;
            } else {
                this.cache.delete(key);
            }
        }
        this.stats.misses++;
        return null;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.stats.cacheSize = 0;
        console.log('🧹 DOM cache cleared');
    }

    /**
     * Clear entries that are no longer in the DOM
     */
    clearStaleEntries() {
        let removed = 0;
        for (const [key, element] of this.cache.entries()) {
            if (!element || !document.body.contains(element)) {
                this.cache.delete(key);
                removed++;
            }
        }
        this.stats.cacheSize = this.cache.size;
        if (removed > 0) {
            console.log(`🧹 Cleared ${removed} stale cache entries`);
        }
    }

    /**
     * Get cache statistics
     * @returns {object} Stats object
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
            total
        };
    }

    /**
     * Log cache performance stats
     */
    logStats() {
        const stats = this.getStats();
        console.log('📊 DOM Cache Performance:', {
            'Cache Hits': stats.hits,
            'Cache Misses': stats.misses,
            'Hit Rate': stats.hitRate,
            'Cache Size': stats.cacheSize,
            'Total Queries': stats.total
        });
    }

    /**
     * Batch query multiple selectors at once
     * @param {Array<string>} selectors - Array of CSS selectors
     * @param {HTMLElement} context - Optional context element
     * @returns {Map<string, HTMLElement>} Map of selector to element
     */
    batchQuery(selectors, context = document) {
        const results = new Map();
        
        // Use requestIdleCallback to avoid blocking
        selectors.forEach(selector => {
            results.set(selector, this.querySelector(selector, context));
        });
        
        return results;
    }

    /**
     * Destroy the cache and cleanup
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.clear();
    }
}

// Create global instance
const domCache = new DOMCache();

// Expose globally
window.DOMCache = DOMCache;
window.domCache = domCache;

// Export for module usage
export { DOMCache, domCache };
export default domCache;

