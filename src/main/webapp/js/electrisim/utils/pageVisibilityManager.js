/**
 * Page Visibility Manager
 * Manages application behavior when tab is hidden/shown
 * Prevents freezing and unnecessary resource consumption
 */

class PageVisibilityManager {
    constructor() {
        this.isPageVisible = !document.hidden;
        this.pauseCallbacks = [];
        this.resumeCallbacks = [];
        this.statistics = {
            pauseCount: 0,
            resumeCount: 0,
            totalHiddenTime: 0,
            lastHiddenTime: null
        };
        
        this.init();
    }
    
    /**
     * Initialize visibility change listener
     */
    init() {
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Also listen for page hide/show events (more reliable on mobile)
        window.addEventListener('pagehide', () => this.pause());
        window.addEventListener('pageshow', () => this.resume());
        
        // Listen for blur/focus as backup
        window.addEventListener('blur', () => this.handleBlur());
        window.addEventListener('focus', () => this.handleFocus());
        
        console.log('✅ Page Visibility Manager initialized');
    }
    
    /**
     * Handle visibility change event
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else {
            this.resume();
        }
    }
    
    /**
     * Handle window blur (backup for older browsers)
     */
    handleBlur() {
        // Only pause if page is actually hidden
        // This prevents pausing when clicking on browser UI
        setTimeout(() => {
            if (document.hidden) {
                this.pause();
            }
        }, 100);
    }
    
    /**
     * Handle window focus (backup for older browsers)
     */
    handleFocus() {
        if (!document.hidden) {
            this.resume();
        }
    }
    
    /**
     * Pause all registered operations
     */
    pause() {
        if (!this.isPageVisible) return; // Already paused
        
        this.isPageVisible = false;
        this.statistics.pauseCount++;
        this.statistics.lastHiddenTime = Date.now();
        
        console.log('⏸️  Page hidden - pausing operations');
        
        // Execute all pause callbacks
        this.pauseCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in pause callback:', error);
            }
        });
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('pagepaused', {
            detail: { timestamp: this.statistics.lastHiddenTime }
        }));
    }
    
    /**
     * Resume all registered operations
     */
    resume() {
        if (this.isPageVisible) return; // Already resumed
        
        this.isPageVisible = true;
        this.statistics.resumeCount++;
        
        // Calculate time spent hidden
        if (this.statistics.lastHiddenTime) {
            const hiddenDuration = Date.now() - this.statistics.lastHiddenTime;
            this.statistics.totalHiddenTime += hiddenDuration;
            
            console.log(`▶️  Page visible - resuming operations (was hidden for ${(hiddenDuration / 1000).toFixed(1)}s)`);
        } else {
            console.log('▶️  Page visible - resuming operations');
        }
        
        // Execute all resume callbacks
        this.resumeCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in resume callback:', error);
            }
        });
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('pageresumed', {
            detail: { 
                timestamp: Date.now(),
                hiddenDuration: this.statistics.lastHiddenTime 
                    ? Date.now() - this.statistics.lastHiddenTime 
                    : 0
            }
        }));
        
        this.statistics.lastHiddenTime = null;
    }
    
    /**
     * Register a callback to be called when page is hidden
     * @param {Function} callback - Function to call on pause
     * @returns {number} - ID for unregistering
     */
    onPause(callback) {
        this.pauseCallbacks.push(callback);
        return this.pauseCallbacks.length - 1;
    }
    
    /**
     * Register a callback to be called when page is visible again
     * @param {Function} callback - Function to call on resume
     * @returns {number} - ID for unregistering
     */
    onResume(callback) {
        this.resumeCallbacks.push(callback);
        return this.resumeCallbacks.length - 1;
    }
    
    /**
     * Unregister a pause callback
     * @param {number} id - Callback ID
     */
    removePauseCallback(id) {
        if (id >= 0 && id < this.pauseCallbacks.length) {
            this.pauseCallbacks[id] = null;
        }
    }
    
    /**
     * Unregister a resume callback
     * @param {number} id - Callback ID
     */
    removeResumeCallback(id) {
        if (id >= 0 && id < this.resumeCallbacks.length) {
            this.resumeCallbacks[id] = null;
        }
    }
    
    /**
     * Get current visibility state
     * @returns {boolean} - True if page is visible
     */
    isVisible() {
        return this.isPageVisible;
    }
    
    /**
     * Get statistics about page visibility
     * @returns {Object} - Statistics object
     */
    getStatistics() {
        return {
            ...this.statistics,
            currentlyVisible: this.isPageVisible,
            currentHiddenDuration: this.statistics.lastHiddenTime 
                ? Date.now() - this.statistics.lastHiddenTime 
                : 0
        };
    }
    
    /**
     * Helper: Create a visibility-aware interval
     * Automatically pauses when page is hidden
     * @param {Function} callback - Function to call
     * @param {number} intervalMs - Interval in milliseconds
     * @returns {Object} - Object with stop() method
     */
    createManagedInterval(callback, intervalMs) {
        let intervalId = null;
        let isPaused = false;
        
        const start = () => {
            if (intervalId || isPaused) return;
            intervalId = setInterval(() => {
                if (this.isPageVisible) {
                    callback();
                }
            }, intervalMs);
        };
        
        const stop = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
        
        const pause = () => {
            isPaused = true;
            stop();
        };
        
        const resume = () => {
            isPaused = false;
            if (this.isPageVisible) {
                start();
            }
        };
        
        // Register pause/resume callbacks
        const pauseId = this.onPause(pause);
        const resumeId = this.onResume(resume);
        
        // Start immediately if page is visible
        if (this.isPageVisible) {
            start();
        }
        
        return {
            stop: () => {
                stop();
                this.removePauseCallback(pauseId);
                this.removeResumeCallback(resumeId);
            },
            pause,
            resume
        };
    }
    
    /**
     * Helper: Create a visibility-aware animation frame loop
     * Automatically pauses when page is hidden
     * @param {Function} callback - Function to call each frame
     * @returns {Object} - Object with stop() method
     */
    createManagedAnimationLoop(callback) {
        let animationId = null;
        let isRunning = false;
        
        const loop = () => {
            if (!isRunning) return;
            
            if (this.isPageVisible) {
                callback();
            }
            
            animationId = requestAnimationFrame(loop);
        };
        
        const start = () => {
            if (isRunning) return;
            isRunning = true;
            loop();
        };
        
        const stop = () => {
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        };
        
        const pause = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        };
        
        const resume = () => {
            if (isRunning && this.isPageVisible) {
                loop();
            }
        };
        
        // Register pause/resume callbacks
        const pauseId = this.onPause(pause);
        const resumeId = this.onResume(resume);
        
        // Start immediately if page is visible
        if (this.isPageVisible) {
            start();
        }
        
        return {
            stop: () => {
                stop();
                this.removePauseCallback(pauseId);
                this.removeResumeCallback(resumeId);
            },
            pause,
            resume
        };
    }
}

// Create and export global instance
export const pageVisibilityManager = new PageVisibilityManager();

// Make globally accessible
if (typeof window !== 'undefined') {
    window.pageVisibilityManager = pageVisibilityManager;
}

export default pageVisibilityManager;


