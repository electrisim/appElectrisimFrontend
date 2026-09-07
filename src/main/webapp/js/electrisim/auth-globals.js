// auth-globals.js - OAuth button fix (clean version)

// Enhanced authentication function that works for both standard and OAuth login
window.isAuthenticated = function() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // For OAuth, we definitely need both token and user
    // For standard login, we should also have both
    const isAuth = !!(token && user);
    
    return isAuth;
};

window.getCurrentUser = function() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.error('Error parsing user data:', e);
            return null;
        }
    }
    return null;
};

// Debug function
window.debugAuth = function() {
    console.log('=== AUTH DEBUG ===');
    console.log('localStorage token:', localStorage.getItem('token'));
    console.log('localStorage user:', localStorage.getItem('user'));
    console.log('isAuthenticated():', window.isAuthenticated());
    console.log('getCurrentUser():', window.getCurrentUser());
    console.log('==================');
};

// Enhanced debug function specifically for OAuth troubleshooting
window.debugOAuth = function() {
    console.log('🔍 === OAUTH DEBUG ===');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 localStorage length:', localStorage.length);
    console.log('🔍 All localStorage items:');
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        console.log(`🔍   ${key}:`, value);
    }
    
    console.log('🔍 sessionStorage length:', sessionStorage.length);
    console.log('🔍 All sessionStorage items:');
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        console.log(`🔍   ${key}:`, value);
    }
    
    console.log('🔍 Auth functions available:');
    console.log('🔍   isAuthenticated:', typeof window.isAuthenticated);
    console.log('🔍   getCurrentUser:', typeof window.getCurrentUser);
    console.log('🔍   updateLoginButton:', typeof window.updateLoginButton);
    
    console.log('🔍 ==================');
};

// OPTIMIZED: Enhanced function to update the login button with DOM caching
let cachedShareButton = null; // Cache the button once found

function updateLoginButton() {
    // Try to use cached button first
    if (cachedShareButton && document.body.contains(cachedShareButton)) {
        updateButtonText(cachedShareButton);
        return true;
    }
    
    // Button not cached or was removed from DOM, find it
    const shareButton = findShareButton();
    
    if (shareButton) {
        cachedShareButton = shareButton; // Cache it for next time
        updateButtonText(shareButton);
        return true;
    }
    
    return false;
}

// Helper: true only for the toolbar Share button (not draw.io rating banners)
function isLoginShareButton(button) {
    if (!button || !button.getAttribute) {
        return false;
    }
    const title = (button.getAttribute('title') || '').toLowerCase();
    if (title.includes('share')) {
        return true;
    }
    // Rating banner is a floating bottom prompt appended to body
    if (button.style.position === 'absolute' && button.style.bottom) {
        return false;
    }
    if (button.querySelector('a[href*="marketplace.atlassian.com"]')) {
        return false;
    }
    return false;
}

// Remove any existing draw.io "Please rate us" banner (Atlassian marketplace link)
function removeRatingBanner() {
    document.querySelectorAll('a[href*="marketplace.atlassian.com"]').forEach(function(link) {
        const banner = link.closest('.geBtn.gePrimaryBtn') || link.parentElement;
        if (banner && banner.parentNode) {
            banner.parentNode.removeChild(banner);
        }
    });
}

// Helper: Find share button using cached queries
function findShareButton() {
    // Use domCache if available, fallback to document.querySelector
    const useCache = window.domCache && typeof window.domCache.querySelector === 'function';
    
    const selectors = [
        'div.geBtn.gePrimaryBtn[title*="share"]',
        'div.geBtn[title*="share"]',
        '.shareButton'
    ];
    
    for (const selector of selectors) {
        const button = useCache 
            ? window.domCache.querySelector(selector)
            : document.querySelector(selector);
            
        if (button && isLoginShareButton(button)) {
            return button;
        }
    }
    
    return null;
}

// Helper: Update button text without unnecessary DOM manipulation
function updateButtonText(shareButton) {
    const isLoggedIn = window.isAuthenticated();
    const newText = isLoggedIn ? "Logged In" : "Login";
    const currentText = shareButton.textContent.trim();
    
    // Only update if text is different to avoid unnecessary DOM manipulation
    if (currentText !== newText) {
        // Try different methods to update the text
        const textNode = shareButton.lastChild;
        if (textNode && textNode.nodeType === 3) { // Text node
            textNode.textContent = newText;
        } else {
            // Remove existing text and add new text
            const textNodes = Array.from(shareButton.childNodes).filter(node => node.nodeType === 3);
            textNodes.forEach(node => node.remove());
            shareButton.appendChild(document.createTextNode(newText));
        }
        
        // Force a style recalculation to ensure the change is visible
        shareButton.style.display = 'none';
        shareButton.offsetHeight; // Trigger reflow
        shareButton.style.display = 'inline-block';
    }
}

// Export the function
window.updateLoginButton = updateLoginButton;

// Immediate check for OAuth return (after functions are defined)
(function() {
    // Check if we just returned from OAuth
    const hasToken = !!localStorage.getItem('token');
    const hasUser = !!localStorage.getItem('user');
    
    if (hasToken && hasUser) {
        console.log('OAuth return detected - user authenticated');
        // Force immediate button update
        setTimeout(function() {
            updateLoginButton();
        }, 500);
    }
})();

// Test functions
window.simulateOAuthLogin = function() {
    console.log('Simulating OAuth login...');
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({id: '123', email: 'test@example.com'}));
    updateLoginButton();
};

window.simulateOAuthLogout = function() {
    console.log('Simulating OAuth logout...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateLoginButton();
};

// Enhanced button update function with OAuth support
function waitAndUpdate() {
    // Try to update immediately
    if (updateLoginButton()) {
        return;
    }
    
    // If not found, wait and try again
    setTimeout(function() {
        if (updateLoginButton()) {
            // Button updated successfully
        } else {
            setTimeout(waitAndUpdate, 1000);
        }
    }, 2000);
}

// OPTIMIZED: Function to monitor and update button (less aggressive polling)
let buttonMonitoringActive = false;

function startButtonMonitoring() {
    // Prevent multiple monitoring instances
    if (buttonMonitoringActive) {
        return;
    }
    buttonMonitoringActive = true;
    
    // Initial update
    setTimeout(removeRatingBanner, 1000);
    setTimeout(waitAndUpdate, 1000);
    
    // Try a few times to catch dynamically created buttons
    setTimeout(waitAndUpdate, 3000);
    setTimeout(waitAndUpdate, 5000);
    
    // OPTIMIZED: Reduced polling frequency from 2s to 5s
    // Once button is cached, updates are instant anyway
    const checkInterval = setInterval(function() {
        updateLoginButton();
    }, 5000); // Changed from 2000ms to 5000ms
    
    // Stop periodic checking after 30 seconds (button should be found by then)
    setTimeout(function() {
        clearInterval(checkInterval);
        buttonMonitoringActive = false;
    }, 30000);
}

// Start the process when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    removeRatingBanner();
    startButtonMonitoring();
});

// Also start immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM not ready yet
} else {
    removeRatingBanner();
    startButtonMonitoring();
}

// Listen for auth state changes
document.addEventListener('authStateChanged', function(event) {
    setTimeout(updateLoginButton, 100);
    // Also trigger a new monitoring cycle
    setTimeout(startButtonMonitoring, 500);
});

document.addEventListener('oauthSuccess', function(event) {
    setTimeout(updateLoginButton, 100);
    // Also trigger a new monitoring cycle
    setTimeout(startButtonMonitoring, 500);
});

// Listen for user login events (from OAuth callback)
document.addEventListener('userLoggedIn', function(event) {
    setTimeout(updateLoginButton, 100);
    setTimeout(startButtonMonitoring, 500);
});

// OPTIMIZED: Mutation observer with better performance
function setupMutationObserver() {
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        
        // Batch check all mutations first
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        // Check if this node or its children contain a share button
                        if (node.matches && node.matches('div.geBtn[title*="share"]')) {
                            shouldUpdate = true;
                            cachedShareButton = null; // Clear cache to force re-find
                            break;
                        } else if (node.querySelector) {
                            const shareButton = node.querySelector('div.geBtn[title*="share"]');
                            if (shareButton) {
                                shouldUpdate = true;
                                cachedShareButton = null; // Clear cache
                                break;
                            }
                        }
                    }
                }
                if (shouldUpdate) break;
            }
        }
        
        // Update only once after checking all mutations
        if (shouldUpdate) {
            setTimeout(updateLoginButton, 100);
        }
    });

    // Start observing (less aggressive - only direct children of body)
    observer.observe(document.body, {
        childList: true,
        subtree: false // Changed from true to false for better performance
    });
}

// Enhanced page visibility handling for OAuth returns
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        setTimeout(function() {
            updateLoginButton();
            startButtonMonitoring();
        }, 500);
    }
});

// Handle page focus events (useful for OAuth returns)
window.addEventListener('focus', function() {
    setTimeout(function() {
        updateLoginButton();
        startButtonMonitoring();
    }, 500);
});

// Set up mutation observer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMutationObserver);
} else {
    setupMutationObserver();
}

// Final verification function for OAuth button functionality
window.verifyOAuthButtonIntegration = function() {
    console.log('=== OAUTH BUTTON INTEGRATION VERIFICATION ===');
    console.log('1. isAuthenticated function:', typeof window.isAuthenticated);
    console.log('2. getCurrentUser function:', typeof window.getCurrentUser);
    console.log('3. updateLoginButton function:', typeof window.updateLoginButton);
    console.log('4. Current auth state:', window.isAuthenticated());
    console.log('5. Current user:', window.getCurrentUser());
    
    // Try to find and update the button
    const buttonFound = updateLoginButton();
    console.log('6. Button update result:', buttonFound);
    
    // Check localStorage
    console.log('7. Token in localStorage:', !!localStorage.getItem('token'));
    console.log('8. User in localStorage:', !!localStorage.getItem('user'));
    
    console.log('=== VERIFICATION COMPLETE ===');
    
    return {
        isAuthenticated: window.isAuthenticated(),
        hasCurrentUser: !!window.getCurrentUser(),
        buttonFound: buttonFound,
        hasToken: !!localStorage.getItem('token'),
        hasUser: !!localStorage.getItem('user')
    };
};

// OAuth button fix loaded successfully
// OAuth button fix loaded successfully