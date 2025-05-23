// stripe-subscription.js - Manages subscription-related functionality

// Function to get auth token from various storage options
function getAuthToken() {
    // Try different storage mechanisms
    const localToken = localStorage.getItem('token');
    const localJwt = localStorage.getItem('jwt');
    const localAuthToken = localStorage.getItem('authToken');
    const sessionToken = sessionStorage.getItem('token');
    const sessionJwt = sessionStorage.getItem('jwt');
    
    // Use the first available token
    return localToken || localJwt || localAuthToken || sessionToken || sessionJwt;
}

// Function to handle unauthenticated users
function handleUnauthenticated() {
    console.log('User not authenticated. Showing login modal...');
    
    // Check if we have the authHandler functionality available
    /*if (window.authHandler && window.authHandler.showLoginModal) {
        return window.authHandler.showLoginModal();
    } else {*/
        // Fallback if authHandler is not available
        const shouldRedirect = confirm('You need to log in before subscribing. Go to login page?');
        
        if (shouldRedirect) {
            // Redirect to login page (adjust the URL to your login page)
            window.location.href = '/login.html'; //
        }
        
       // return false;
   //}
}

// Function to check if user has an active subscription
async function checkSubscriptionStatus() {
    const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';
    
    try {
        // Get the JWT token from localStorage
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return false;
        }
        
        const response = await fetch(`${API_BASE_URL}/stripe/check-subscription`, {  // Updated path
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Subscription check failed:', response.status, response.statusText);
            return false;
        }
        
        const data = await response.json();
        return data.hasActiveSubscription;
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
    }
}

// Function to redirect to Stripe Checkout
async function redirectToStripeCheckout() {    
    const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';

    try {
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return handleUnauthenticated();
        }
        
        console.log('Creating checkout session...');
        
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                priceId: 'price_1RLjivAd4ULYw2Nb6oGrb9P1' // Make sure this price ID exists in your Stripe account
            })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.error || responseData.details || 'Failed to create checkout session');
        }

        if (!responseData.url) {
            throw new Error('No checkout URL received from server');
        }

        // Redirect to Stripe Checkout
        window.location.href = responseData.url;
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert(`Checkout error: ${error.message}`);
    }
}

// Function to redirect to Customer Portal for managing subscription
async function redirectToCustomerPortal() {
    const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';
    
    try {
        // Get the JWT token
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return handleUnauthenticated();
        }
        
        const response = await fetch(`${API_BASE_URL}/stripe/create-customer-portal-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
            // Remove credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            alert('Server error: ' + (errorData.error || 'Unknown error'));
            return;
        }

        const { url } = await response.json();
        
        if (!url) {
            console.error('No portal URL received');
            alert('Error: No customer portal URL received');
            return;
        }
        
        // Redirect to Stripe Customer Portal
        window.open(url, '_blank');
    } catch (error) {
        console.error('Error opening customer portal:', error);
        alert('Error opening customer portal. Please try again.');
    }
}

// Function to show subscription modal
function showSubscriptionModal() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'subscription-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.style.backgroundColor = 'white';
    modal.style.borderRadius = '8px';
    modal.style.padding = '30px';
    modal.style.width = '480px';
    modal.style.maxWidth = '90%';
    modal.style.textAlign = 'center';

    // Modal header
    const header = document.createElement('h2');
    header.textContent = 'Subscription Required';
    header.style.marginBottom = '20px';
    
    // Modal message
    const message = document.createElement('p');
    message.textContent = 'To use the Simulation feature, a monthly subscription is required.';
    message.style.marginBottom = '30px';
    
    // Price display
    const priceInfo = document.createElement('div');
    priceInfo.innerHTML = '<strong>Monthly Subscription:</strong> $5.00/month';
    priceInfo.style.marginBottom = '30px';
    
    // Subscribe button
    const subscribeBtn = document.createElement('button');
    subscribeBtn.textContent = 'Subscribe Now';
    subscribeBtn.style.backgroundColor = '#4CAF50';
    subscribeBtn.style.color = 'white';
    subscribeBtn.style.border = 'none';
    subscribeBtn.style.padding = '12px 24px';
    subscribeBtn.style.borderRadius = '4px';
    subscribeBtn.style.cursor = 'pointer';
    subscribeBtn.style.fontSize = '16px';
    subscribeBtn.style.marginRight = '15px';
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.backgroundColor = '#f44336';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.padding = '12px 24px';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '16px';
    
    // Add event listeners
    subscribeBtn.addEventListener('click', async () => {
        overlay.remove();
        // Check if user is authenticated first
        const token = getAuthToken();
        if (!token) {
            const authenticated = await handleUnauthenticated();
            if (authenticated) {
                redirectToStripeCheckout();
            }
        } else {
            redirectToStripeCheckout();
        }
    });
    
    cancelBtn.addEventListener('click', () => {
        overlay.remove();
    });
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(message);
    modal.appendChild(priceInfo);
    modal.appendChild(subscribeBtn);
    modal.appendChild(cancelBtn);
    overlay.appendChild(modal);
    
    // Add to body
    document.body.appendChild(overlay);
}

// Listen for messages from the Stripe checkout callback pages
window.addEventListener('message', function(event) {
    if (event.data && event.data.type) {
        switch(event.data.type) {
            case 'subscription_success':
                try {
                    // Show success message
                    alert('Your subscription has been successfully activated!');
                    
                    // Attempt to refresh with error handling
                    checkSubscriptionStatus()
                        .then(status => {
                            if (status) {
                                window.location.reload();
                            } else {
                                throw new Error('Unable to verify subscription status');
                            }
                        })
                        .catch(error => {
                            console.error('Error verifying subscription:', error);
                            alert('Subscription activated but unable to refresh status. Please try refreshing the page manually.');
                        });
                } catch (error) {
                    console.error('Error handling subscription success:', error);
                    alert('Subscription successful but encountered an error. Please refresh the page.');
                }
                break;
            case 'subscription_canceled':
                console.log('Subscription process was canceled');
                break;
        }
    }
});

const SubscriptionManager = {
    async checkSubscriptionStatus() {
        const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';
        
        try {
            const token = getAuthToken();
            
            if (!token) {
                console.error('No authentication token found');
                return false;
            }
            
            const response = await fetch(`${API_BASE_URL}/stripe/check-subscription`, {
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
    },
    
    showSubscriptionModal() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'subscription-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'subscription-modal';
        modal.style.backgroundColor = 'white';
        modal.style.borderRadius = '8px';
        modal.style.padding = '30px';
        modal.style.width = '480px';
        modal.style.maxWidth = '90%';
        modal.style.textAlign = 'center';

        // Modal header
        const header = document.createElement('h2');
        header.textContent = 'Subscription Required';
        header.style.marginBottom = '20px';
        
        // Modal message
        const message = document.createElement('p');
        message.textContent = 'To use the Simulation feature, a monthly subscription is required.';
        message.style.marginBottom = '30px';
        
        // Price display
        const priceInfo = document.createElement('div');
        priceInfo.innerHTML = '<strong>Monthly Subscription:</strong> $5.00/month';
        priceInfo.style.marginBottom = '30px';
        
        // Subscribe button
        const subscribeBtn = document.createElement('button');
        subscribeBtn.textContent = 'Subscribe Now';
        subscribeBtn.style.backgroundColor = '#4CAF50';
        subscribeBtn.style.color = 'white';
        subscribeBtn.style.border = 'none';
        subscribeBtn.style.padding = '12px 24px';
        subscribeBtn.style.borderRadius = '4px';
        subscribeBtn.style.cursor = 'pointer';
        subscribeBtn.style.fontSize = '16px';
        subscribeBtn.style.marginRight = '15px';
        
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.backgroundColor = '#f44336';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '12px 24px';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '16px';
        
        // Add event listeners
        subscribeBtn.addEventListener('click', async () => {
            overlay.remove();
            // Check if user is authenticated first
            const token = getAuthToken();
            if (!token) {
                const authenticated = await handleUnauthenticated();
                if (authenticated) {
                    redirectToStripeCheckout();
                }
            } else {
                redirectToStripeCheckout();
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });
        
        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(message);
        modal.appendChild(priceInfo);
        modal.appendChild(subscribeBtn);
        modal.appendChild(cancelBtn);
        overlay.appendChild(modal);
        
        // Add to body
        document.body.appendChild(overlay);
    }
    // ... other functions ...
};

// Make it globally available
window.SubscriptionManager = SubscriptionManager;

// Make functions available globally
window.subscriptionHandler = {
    checkSubscriptionStatus,
    redirectToStripeCheckout,
    showSubscriptionModal,
    redirectToCustomerPortal
};

// Make function globally available
window.checkSubscriptionStatus = async function() {
    const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';
    
    try {
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return false;
        }
        
        const response = await fetch(`${API_BASE_URL}/stripe/check-subscription`, {
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

// Make other necessary functions global
window.showSubscriptionModal = showSubscriptionModal;