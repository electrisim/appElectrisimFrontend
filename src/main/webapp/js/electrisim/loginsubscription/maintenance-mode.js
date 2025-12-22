/**
 * Maintenance Mode Handler
 * Monitors backend health and displays maintenance messages during downtime
 */

import config from '../config/environment.js';

class MaintenanceMode {
    constructor() {
        this.isBackendDown = false;
        this.checkInterval = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.checkIntervalMs = 5000; // Check every 5 seconds
        this.banner = null;
    }

    /**
     * Initialize maintenance mode monitoring
     */
    init() {
        // Check immediately
        this.checkBackendHealth();
        
        // Then check periodically
        this.startHealthChecks();
        
        // Monitor fetch errors globally
        this.monitorFetchErrors();
    }

    /**
     * Check if backend is available
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${config.apiBaseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok') {
                    this.onBackendAvailable();
                    return true;
                }
            }
            
            this.onBackendUnavailable();
            return false;
        } catch (error) {
            console.warn('Backend health check failed:', error.message);
            this.onBackendUnavailable();
            return false;
        }
    }

    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.checkBackendHealth();
        }, this.checkIntervalMs);
    }

    /**
     * Stop health checks
     */
    stopHealthChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Handle backend unavailable
     */
    onBackendUnavailable() {
        if (!this.isBackendDown) {
            this.isBackendDown = true;
            this.showMaintenanceBanner();
            this.retryCount = 0;
            
            // Track with Smartlook if available
            if (typeof smartlook !== 'undefined') {
                smartlook('track', 'backend_unavailable', {
                    timestamp: new Date().toISOString(),
                    apiBaseUrl: config.apiBaseUrl
                });
            }
        }
        
        this.retryCount++;
        
        // If too many failures, increase check interval to reduce load
        if (this.retryCount > this.maxRetries) {
            this.checkIntervalMs = 15000; // Slow down to 15 seconds
            this.startHealthChecks();
        }
    }

    /**
     * Handle backend available
     */
    onBackendAvailable() {
        if (this.isBackendDown) {
            this.isBackendDown = false;
            this.hideMaintenanceBanner();
            this.retryCount = 0;
            this.checkIntervalMs = 5000; // Reset to normal interval
            
            // Track recovery with Smartlook
            if (typeof smartlook !== 'undefined') {
                smartlook('track', 'backend_recovered', {
                    timestamp: new Date().toISOString(),
                    apiBaseUrl: config.apiBaseUrl
                });
            }
            
            // Show success message briefly
            this.showRecoveryMessage();
        }
    }

    /**
     * Show maintenance banner
     */
    showMaintenanceBanner() {
        // Don't create duplicate banners
        if (this.banner && document.body.contains(this.banner)) {
            return;
        }

        this.banner = document.createElement('div');
        this.banner.id = 'maintenance-banner';
        this.banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #FFA726 0%, #FB8C00 100%);
            color: white;
            padding: 15px 20px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            animation: slideDown 0.3s ease;
        `;

        this.banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                <div class="spinner" style="
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                "></div>
                <div>
                    <strong>⚠️ System Maintenance</strong>
                    <div style="font-size: 0.9em; margin-top: 5px;">
                        We're updating our systems. Your work is saved. Please wait a moment...
                    </div>
                </div>
            </div>
        `;

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        document.body.insertBefore(this.banner, document.body.firstChild);
        
        // Add body padding to prevent content from being hidden
        document.body.style.paddingTop = '60px';
    }

    /**
     * Hide maintenance banner
     */
    hideMaintenanceBanner() {
        if (this.banner && document.body.contains(this.banner)) {
            this.banner.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (this.banner && document.body.contains(this.banner)) {
                    this.banner.remove();
                }
                document.body.style.paddingTop = '0';
            }, 300);
        }
    }

    /**
     * Show brief recovery message
     */
    showRecoveryMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10001;
            font-family: Arial, sans-serif;
            animation: slideIn 0.3s ease;
        `;
        
        message.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5em;">✅</span>
                <div>
                    <strong>System Restored</strong>
                    <div style="font-size: 0.9em;">Everything is back to normal!</div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(message);

        // Remove after 3 seconds
        setTimeout(() => {
            message.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(message)) {
                    message.remove();
                }
            }, 300);
        }, 3000);
    }

    /**
     * Monitor all fetch errors globally
     */
    monitorFetchErrors() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);
                
                // If this is a request to our API and it fails, trigger maintenance mode
                if (args[0].includes(config.apiBaseUrl) && !response.ok) {
                    if (response.status >= 500 || response.status === 0) {
                        self.onBackendUnavailable();
                    }
                }
                
                return response;
            } catch (error) {
                // Network errors - check if it's our API
                if (args[0].includes(config.apiBaseUrl)) {
                    self.onBackendUnavailable();
                }
                throw error;
            }
        };
    }

    /**
     * Check if backend is currently down
     */
    isDown() {
        return this.isBackendDown;
    }
}

// Create singleton instance
const maintenanceMode = new MaintenanceMode();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => maintenanceMode.init());
} else {
    maintenanceMode.init();
}

// Export for use in other modules
export default maintenanceMode;

// Also make it globally available
window.maintenanceMode = maintenanceMode;

