// PATCH FOR app.min.js - Enhanced Login Button Click Handler
// Replace the existing click handler in the updateButtonContainer function

// FIND THIS CODE (around line 91630-91640):
/*
mxEvent.addListener(this.shareButton, "click", mxUtils.bind(this, function () {
    if (isAuthenticated()) {
        // If already logged in, show user info or logout option
        //alert('Already logged in as ' + getCurrentUser().email);
      } else {
        // Show login modal
        //showLoginModal();
        window.location.href = 'login.html';                
        
      }                
}))
*/

// REPLACE WITH THIS ENHANCED CODE:
/*
mxEvent.addListener(this.shareButton, "click", mxUtils.bind(this, function () {
    if (isAuthenticated()) {
        // Enhanced behavior for logged-in users
        const user = getCurrentUser();
        if (user && user.email) {
            // Check if this is the first or second click
            if (!this.shareButton.clickCount) {
                this.shareButton.clickCount = 0;
            }
            
            this.shareButton.clickCount++;
            
            if (this.shareButton.clickCount === 1) {
                // First click: Show user email
                const originalText = this.shareButton.textContent;
                this.shareButton.textContent = user.email;
                
                // Reset after 3 seconds
                setTimeout(() => {
                    this.shareButton.textContent = originalText;
                    this.shareButton.clickCount = 0;
                }, 3000);
            } else if (this.shareButton.clickCount === 2) {
                // Second click: Ask for logout confirmation
                const confirmed = confirm(`Do you want to log out from ${user.email}?`);
                if (confirmed) {
                    // Perform logout
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    
                    // Update button text
                    this.shareButton.textContent = "Login";
                    
                    // Dispatch logout events
                    document.dispatchEvent(new CustomEvent('userLoggedOut'));
                    document.dispatchEvent(new CustomEvent('authStateChanged', {
                        detail: { isAuthenticated: false, user: null }
                    }));
                    
                    // Reset click count
                    this.shareButton.clickCount = 0;
                } else {
                    // Reset click count if user cancels
                    this.shareButton.clickCount = 0;
                }
            }
        }
    } else {
        // Not logged in: redirect to login page
        window.location.href = 'login.html';
    }
}))
*/

// INSTRUCTIONS:
// 1. Open app.min.js in your editor
// 2. Search for: mxEvent.addListener(this.shareButton, "click"
// 3. Replace the entire click handler function with the enhanced version above
// 4. Save the file
// 5. Test the functionality

console.log('Button click patch instructions loaded. Apply the changes manually to app.min.js'); 