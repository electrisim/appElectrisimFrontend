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

// Enhanced function to update the login button
function updateLoginButton() {
    // Try multiple selectors to find the button
    const selectors = [
        'div.geBtn.gePrimaryBtn[title*="share"]',
        'div.geBtn[title*="share"]',
        '.shareButton',
        'div.geBtn.gePrimaryBtn'
    ];
    
    let shareButton = null;
    
    for (const selector of selectors) {
        shareButton = document.querySelector(selector);
        if (shareButton) {
            break;
        }
    }
    
    if (shareButton) {
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
        
        return true;
    }
    
    return false;
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

// Function to continuously monitor and update button
function startButtonMonitoring() {
    // Initial update
    setTimeout(waitAndUpdate, 1000);
    
    // Also try after longer delays to catch dynamically created buttons
    setTimeout(waitAndUpdate, 3000);
    setTimeout(waitAndUpdate, 5000);
    setTimeout(waitAndUpdate, 8000);
    
    // Set up periodic checking for OAuth returns
    const checkInterval = setInterval(function() {
        updateLoginButton();
    }, 2000);
    
    // Stop periodic checking after 30 seconds
    setTimeout(function() {
        clearInterval(checkInterval);
    }, 30000);
}

// Start the process when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    startButtonMonitoring();
});

// Also start immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM not ready yet
} else {
    // DOM is ready
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

// Add a mutation observer to detect when buttons are dynamically added
function setupMutationObserver() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Check if any added nodes contain the share button
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        const shareButton = node.querySelector && node.querySelector('div.geBtn.gePrimaryBtn[title*="share"]');
                        if (shareButton || (node.matches && node.matches('div.geBtn.gePrimaryBtn[title*="share"]'))) {
                            setTimeout(updateLoginButton, 100);
                        }
                    }
                });
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
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