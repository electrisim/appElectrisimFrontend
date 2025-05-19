// stripe-subscription.js - Manages subscription-related functionality

// Update redirect URLs and API base URL
const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';

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
    const shouldRedirect = confirm('You need to log in before subscribing. Go to login page?');
    if (shouldRedirect) {
        window.location.href = 'https://app.electrisim.com/login.html';
    }
}

// Function to check if user has an active subscription
async function checkSubscriptionStatus() {
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
    // Check if stripe is initialized
    if (!window.stripe) {
        console.error('Stripe has not been initialized');
        alert('Payment system is not ready. Please try again in a moment.');
        return;
    }

    try {
        // Get the JWT token
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return handleUnauthenticated();
        }
        
        // Update the API endpoint path
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                priceId: 'price_1RMDAEAd4ULYw2Nb9nhh8Wf2'  // Replace with your actual Stripe price ID
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            alert('Server error: ' + (errorData.error || 'Unknown error'));
            return;
        }

        const session = await response.json();
        
        if (!session.id) {
            console.error('No session ID received from server', session);
            alert('Error: No session ID received from server');
            return;
        }
        
        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            console.error('Error redirecting to checkout:', result.error.message);
            alert('Error redirecting to payment page: ' + result.error.message);
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Error creating checkout session. Please try again.');
    }
}

// Function to redirect to Customer Portal for managing subscription
async function redirectToCustomerPortal() {
    try {
        // Get the JWT token
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return handleUnauthenticated();
        }
        
        const response = await fetch(`${API_BASE_URL}/create-customer-portal-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
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

// Make functions available globally
window.subscriptionHandler = {
    checkSubscriptionStatus,
    redirectToStripeCheckout,
    showSubscriptionModal,
    redirectToCustomerPortal
};