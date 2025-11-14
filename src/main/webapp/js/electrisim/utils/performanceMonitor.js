/**
 * Performance Monitoring Dashboard
 * Provides real-time performance monitoring and diagnostics
 */

import { memoryMonitor, profiler, globalEventRegistry, globalTimeoutRegistry } from './performanceUtils.js';
import { pageVisibilityManager } from './pageVisibilityManager.js';

class PerformanceDashboard {
    constructor() {
        this.isVisible = false;
        this.container = null;
        this.updateInterval = null;
        this.animationLoop = null;
        this.fpsHistory = [];
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.isPaused = false;
    }
    
    /**
     * Create and show the performance dashboard
     */
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.createDashboard();
        this.startMonitoring();
    }
    
    /**
     * Hide the performance dashboard
     */
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.stopMonitoring();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
    
    /**
     * Toggle dashboard visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * Create the dashboard UI
     */
    createDashboard() {
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '320px',
            maxHeight: '90vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            zIndex: '999999',
            overflowY: 'auto',
            overflowX: 'hidden',
            backdropFilter: 'blur(10px)'
        });
        
        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        });
        
        const title = document.createElement('div');
        title.textContent = '⚡ Performance Monitor';
        Object.assign(title.style, {
            fontSize: '14px',
            fontWeight: 'bold'
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0',
            width: '20px',
            height: '20px'
        });
        closeBtn.onclick = () => this.hide();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        this.container.appendChild(header);
        
        // Content area
        const content = document.createElement('div');
        content.id = 'perf-dashboard-content';
        this.container.appendChild(content);
        
        // Action buttons
        const actions = document.createElement('div');
        Object.assign(actions.style, {
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
        });
        
        const clearCacheBtn = this.createButton('Clear Cache', () => {
            if (window.localStorage) {
                const size = JSON.stringify(localStorage).length;
                localStorage.clear();
                alert(`Cleared ${(size / 1024).toFixed(2)} KB from localStorage`);
            }
        });
        
        const gcBtn = this.createButton('Force GC', () => {
            if (window.gc) {
                window.gc();
                alert('Garbage collection triggered (if supported)');
            } else {
                alert('Garbage collection not available. Run Chrome with --expose-gc flag.');
            }
        });
        
        const cleanupBtn = this.createButton('Cleanup Listeners', () => {
            const stats = globalEventRegistry.getStats();
            const count = stats.total;
            globalEventRegistry.removeAll();
            globalTimeoutRegistry.clearAll();
            alert(`Cleaned up ${count} event listeners and timeouts`);
            this.update();
        });
        
        actions.appendChild(clearCacheBtn);
        actions.appendChild(gcBtn);
        actions.appendChild(cleanupBtn);
        this.container.appendChild(actions);
        
        document.body.appendChild(this.container);
    }
    
    /**
     * Create a button for the dashboard
     */
    createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px'
        });
        btn.onmouseover = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        btn.onmouseout = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        btn.onclick = onClick;
        return btn;
    }
    
    /**
     * Start monitoring
     */
    startMonitoring() {
        // Use visibility-aware interval for updates
        this.updateInterval = pageVisibilityManager.createManagedInterval(
            () => this.update(), 
            1000
        );
        
        // Use visibility-aware animation loop for FPS tracking
        this.animationLoop = pageVisibilityManager.createManagedAnimationLoop(
            () => this.trackFPS()
        );
        
        console.log('✅ Performance monitoring started (visibility-aware)');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.updateInterval) {
            this.updateInterval.stop();
            this.updateInterval = null;
        }
        
        if (this.animationLoop) {
            this.animationLoop.stop();
            this.animationLoop = null;
        }
        
        console.log('⏹️  Performance monitoring stopped');
    }
    
    /**
     * Track FPS
     * Note: This is now called by the managed animation loop
     */
    trackFPS() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        
        if (delta > 0) {
            const fps = 1000 / delta;
            this.fpsHistory.push(fps);
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
        }
    }
    
    /**
     * Update dashboard content
     */
    update() {
        const content = document.getElementById('perf-dashboard-content');
        if (!content) return;
        
        const memStats = memoryMonitor.checkMemory();
        const eventStats = globalEventRegistry.getStats();
        const timeoutStats = globalTimeoutRegistry.getStats();
        const avgFps = this.fpsHistory.length > 0 
            ? (this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length).toFixed(1)
            : 'N/A';
        
        // Generate HTML
        let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
        
        // FPS
        html += this.createSection('Frame Rate', [
            { label: 'FPS', value: avgFps, color: this.getFPSColor(parseFloat(avgFps)) }
        ]);
        
        // Memory
        if (memStats) {
            html += this.createSection('Memory', [
                { label: 'Used', value: `${memStats.usedMB} MB`, color: this.getMemoryColor(memStats.usage) },
                { label: 'Limit', value: `${memStats.limitMB} MB` },
                { label: 'Usage', value: `${(memStats.usage * 100).toFixed(1)}%`, color: this.getMemoryColor(memStats.usage) }
            ]);
        }
        
        // Event Listeners
        html += this.createSection('Event Listeners', [
            { label: 'Total', value: eventStats.total, color: this.getListenerColor(eventStats.total) },
            { label: 'Elements', value: eventStats.uniqueElements },
            { label: 'Types', value: Object.keys(eventStats.byEvent).length }
        ]);
        
        // Top event types
        if (Object.keys(eventStats.byEvent).length > 0) {
            const sorted = Object.entries(eventStats.byEvent)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            const eventTypes = sorted.map(([type, count]) => 
                `<div style="padding: 2px 0;">${type}: ${count}</div>`
            ).join('');
            html += this.createSection('Top Events', [], eventTypes);
        }
        
        // Timeouts
        html += this.createSection('Active Timers', [
            { label: 'Timeouts', value: timeoutStats.activeTimeouts, color: this.getTimeoutColor(timeoutStats.activeTimeouts) }
        ]);
        
        // Performance metrics
        const perfStats = profiler.getStats();
        if (perfStats) {
            html += this.createSection('Performance', [
                { label: 'Operations', value: perfStats.count },
                { label: 'Avg Time', value: `${perfStats.avg}ms` },
                { label: 'Max Time', value: `${perfStats.max}ms` }
            ]);
        }
        
        html += '</div>';
        content.innerHTML = html;
    }
    
    /**
     * Create a section in the dashboard
     */
    createSection(title, items = [], customHtml = '') {
        let html = `<div style="margin-bottom: 8px;">`;
        html += `<div style="font-weight: bold; color: #4CAF50; margin-bottom: 4px;">${title}</div>`;
        
        items.forEach(item => {
            const color = item.color || '#fff';
            html += `<div style="display: flex; justify-content: space-between; padding: 2px 0;">`;
            html += `<span style="color: #aaa;">${item.label}:</span>`;
            html += `<span style="color: ${color}; font-weight: bold;">${item.value}</span>`;
            html += `</div>`;
        });
        
        if (customHtml) {
            html += `<div style="margin-top: 4px; font-size: 11px; color: #aaa;">${customHtml}</div>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Get color based on FPS
     */
    getFPSColor(fps) {
        if (fps >= 55) return '#4CAF50'; // Green
        if (fps >= 30) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }
    
    /**
     * Get color based on memory usage
     */
    getMemoryColor(usage) {
        if (usage < 0.7) return '#4CAF50'; // Green
        if (usage < 0.85) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }
    
    /**
     * Get color based on listener count
     */
    getListenerColor(count) {
        if (count < 100) return '#4CAF50'; // Green
        if (count < 200) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }
    
    /**
     * Get color based on timeout count
     */
    getTimeoutColor(count) {
        if (count < 10) return '#4CAF50'; // Green
        if (count < 30) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }
}

// Create global instance
export const performanceDashboard = new PerformanceDashboard();

// Add keyboard shortcut to toggle dashboard (Ctrl+Shift+P)
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            performanceDashboard.toggle();
        }
    });
    
    // Make it globally accessible
    window.performanceDashboard = performanceDashboard;
    
    console.log('✅ Performance dashboard loaded. Press Ctrl+Shift+P to toggle.');
}

export default performanceDashboard;


