import { devLog } from './utils/devLog.js';
// ensureSubscriptionFunctions.js - Ensures subscription functions are available globally

// Function to wait for subscription functions to be loaded
function waitForSubscriptionFunctions(maxWaitTime = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        function checkFunctions() {
            const hasCheckFunction = typeof window.checkSubscriptionStatus === 'function';
            const hasShowFunction = typeof window.showSubscriptionModal === 'function';
            const hasSubscriptionManager = window.SubscriptionManager && 
                                         typeof window.SubscriptionManager.checkSubscriptionStatus === 'function';
            
            devLog('Subscription functions check:', {
                checkSubscriptionStatus: hasCheckFunction,
                showSubscriptionModal: hasShowFunction,
                SubscriptionManager: hasSubscriptionManager,
                elapsed: Date.now() - startTime
            });
            
            if (hasCheckFunction && hasShowFunction) {
                devLog('All subscription functions are available');
                resolve(true);
                return;
            }
            
            if (Date.now() - startTime > maxWaitTime) {
                console.warn('Timeout waiting for subscription functions, proceeding anyway');
                resolve(false);
                return;
            }
            
            // Try again in 100ms
            setTimeout(checkFunctions, 100);
        }
        
        checkFunctions();
    });
}

// Function to manually load subscription functions if needed
async function ensureSubscriptionFunctions() {
    devLog('Ensuring subscription functions are available...');
    
    // Wait for functions to be loaded
    const functionsAvailable = await waitForSubscriptionFunctions();
    
    if (!functionsAvailable) {
        console.warn('Subscription functions not available, attempting to load manually...');
        
        // Try to manually import the subscription module
        try {
            const { default: config } = await import('./config/environment.js');
            
            // If checkSubscriptionStatus is not available, create a fallback
            if (typeof window.checkSubscriptionStatus !== 'function') {
                window.checkSubscriptionStatus = async function() {
                    devLog('Using fallback checkSubscriptionStatus');
                    try {
                        const token = localStorage.getItem('token') || localStorage.getItem('jwt');
                        if (!token) {
                            devLog('No auth token found');
                            return false;
                        }
                        
                        const response = await fetch(`${config.apiBaseUrl}/stripe/check-subscription`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (!response.ok) {
                            console.error('Subscription check failed:', response.status);
                            return false;
                        }
                        
                        const data = await response.json();
                        return data.hasActiveSubscription;
                    } catch (error) {
                        console.error('Error checking subscription status:', error);
                        return false;
                    }
                };
                devLog('Created fallback checkSubscriptionStatus function');
            }
            
            // If showSubscriptionModal is not available, create a simple fallback
            if (typeof window.showSubscriptionModal !== 'function') {
                window.showSubscriptionModal = function() {
                    devLog('Using fallback showSubscriptionModal');
                    alert('A subscription is required to use this feature. Please contact support.');
                };
                devLog('Created fallback showSubscriptionModal function');
            }
            
        } catch (error) {
            console.error('Error loading subscription functions manually:', error);
        }
    }
    
    return {
        checkSubscriptionStatus: typeof window.checkSubscriptionStatus === 'function',
        showSubscriptionModal: typeof window.showSubscriptionModal === 'function'
    };
}

// Export for ES modules
export { ensureSubscriptionFunctions, waitForSubscriptionFunctions };

// Also make it available globally
window.ensureSubscriptionFunctions = ensureSubscriptionFunctions;
window.waitForSubscriptionFunctions = waitForSubscriptionFunctions; 