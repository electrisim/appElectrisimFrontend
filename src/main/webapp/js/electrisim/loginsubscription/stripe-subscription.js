// stripe-subscription.js - Manages subscription-related functionality

import config from '../config/environment.js';
import { DIALOG_STYLES } from '../utils/dialogStyles.js';

const API_BASE_URL = config.apiBaseUrl;

// Function to get auth token from various storage options
function getAuthToken() {
    // Try different storage mechanisms
    const localToken = localStorage.getItem('token');
    const localJwt = localStorage.getItem('jwt');
    const localAuthToken = localStorage.getItem('authToken');
    const sessionToken = sessionStorage.getItem('token');
    const sessionJwt = sessionStorage.getItem('jwt');
    
    // Use the first available token
    const token = localToken || localJwt || localAuthToken || sessionToken || sessionJwt;
    
    if (!token) {
        console.log('No authentication token found');
        return null;
    }
    
    return token;
}

// Function to handle unauthenticated users
function handleUnauthenticated() {
    console.log('User not authenticated. Showing login modal...');
    
    // Clear any existing tokens
    localStorage.removeItem('token');
    localStorage.removeItem('jwt');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('jwt');
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// Function to check if user has an active subscription
async function checkSubscriptionStatus() {
    try {
        const token = getAuthToken();
        if (!token) {
            return handleUnauthenticated();
        }
        
        const response = await fetch(`${API_BASE_URL}/stripe/check-subscription`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.log('Token expired or invalid');
            return handleUnauthenticated();
        }

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
}

// Function to redirect to Stripe Checkout
async function redirectToStripeCheckout(priceId) {
    try {
        const token = getAuthToken();
        
        if (!token) {
            console.error('No authentication token found');
            return handleUnauthenticated();
        }

        const isProd = window.location.hostname === 'app.electrisim.com';
        const defaultPriceId = isProd ? 'price_1RLjivAd4ULYw2Nb6oGrb9P1' : 'price_1RMDAEAd4ULYw2Nb9nhh8Wf2';
        
        console.log('Creating checkout session:', {
            priceId: priceId || defaultPriceId,
            apiUrl: `${API_BASE_URL}/stripe/create-checkout-session`,
            isProduction: isProd
        });
        
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                priceId: priceId || defaultPriceId
            }),
        });

        if (response.status === 401) {
            console.error('Authentication failed:', {
                status: response.status,
                statusText: response.statusText
            });
            return handleUnauthenticated();
        }

        if (!response.ok) {
            const errorData = await response.json().catch(e => ({ error: 'Failed to parse error response' }));
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(errorData.error || `Failed to create checkout session: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.url) {
            console.error('Invalid response data:', data);
            throw new Error('No checkout URL received');
        }

        console.log('Redirecting to checkout URL:', data.url);
        window.location.href = data.url;
        
    } catch (error) {
        console.error('Error in redirectToStripeCheckout:', {
            message: error.message,
            stack: error.stack,
            apiUrl: `${API_BASE_URL}/stripe/create-checkout-session`
        });
        if (error.message.includes('Token expired')) {
            return handleUnauthenticated();
        }
        // Show error to user
        alert('Failed to start checkout process. Please try again or contact support if the issue persists.');
        throw error;
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
    Object.assign(overlay.style, DIALOG_STYLES.overlay);

    // Create modal content
    const modal = document.createElement('div');
    Object.assign(modal.style, DIALOG_STYLES.container);

    // Modal header
    const header = document.createElement('h2');
    Object.assign(header.style, DIALOG_STYLES.header);
    header.textContent = 'Subscription Required';
    
    // Modal message
    const message = document.createElement('p');
    Object.assign(message.style, DIALOG_STYLES.info);
    message.textContent = 'To use the Simulation feature, a monthly subscription is required.';
    
    // Price display
    const priceInfo = document.createElement('div');
    Object.assign(priceInfo.style, DIALOG_STYLES.resultItem);
    priceInfo.innerHTML = '<strong>Monthly Subscription:</strong> $5.00/month';
    
    // Features list
    const featuresList = document.createElement('ul');
    Object.assign(featuresList.style, {
        listStyle: 'none',
        padding: '0',
        margin: '20px 0'
    });
    
    const features = [
        'Unlimited simulations',
        'Priority support',
        'Access to all features',
        'Regular updates'
    ];
    
    features.forEach(feature => {
        const li = document.createElement('li');
        Object.assign(li.style, {
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center'
        });
        li.innerHTML = `
            <span style="color: #48d800; margin-right: 10px;">✓</span>
            ${feature}
        `;
        featuresList.appendChild(li);
    });
    
    // Subscribe button
    const subscribeButton = document.createElement('button');
    Object.assign(subscribeButton.style, DIALOG_STYLES.button);
    subscribeButton.textContent = 'Subscribe Now';
    
    // Cancel button
    const cancelButton = document.createElement('button');
    Object.assign(cancelButton.style, {
        ...DIALOG_STYLES.button,
        ...DIALOG_STYLES.buttonSecondary,
        marginTop: '10px'
    });
    cancelButton.textContent = 'Cancel';
    
    // Add event listeners
    subscribeButton.addEventListener('click', async () => {
        try {
            subscribeButton.disabled = true;
            subscribeButton.textContent = 'Processing...';
            await redirectToStripeCheckout();
        } catch (error) {
            console.error('Subscription error:', error);
            const errorMsg = document.createElement('div');
            Object.assign(errorMsg.style, DIALOG_STYLES.error);
            errorMsg.textContent = 'An error occurred. Please try again.';
            modal.appendChild(errorMsg);
        } finally {
            subscribeButton.disabled = false;
            subscribeButton.textContent = 'Subscribe Now';
        }
    });
    
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Add hover effects
    [subscribeButton, cancelButton].forEach(button => {
        button.addEventListener('mouseover', () => {
            if (button === subscribeButton) {
                Object.assign(button.style, DIALOG_STYLES.buttonHover);
            } else {
                button.style.backgroundColor = '#f8f9fa';
            }
        });
        
        button.addEventListener('mouseout', () => {
            if (button === subscribeButton) {
                button.style.backgroundColor = DIALOG_STYLES.button.backgroundColor;
            } else {
                button.style.backgroundColor = DIALOG_STYLES.buttonSecondary.backgroundColor;
            }
        });
    });
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(message);
    modal.appendChild(priceInfo);
    modal.appendChild(featuresList);
    modal.appendChild(subscribeButton);
    modal.appendChild(cancelButton);
    
    overlay.appendChild(modal);
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
        Object.assign(overlay.style, DIALOG_STYLES.overlay);

        // Create modal content
        const modal = document.createElement('div');
        Object.assign(modal.style, DIALOG_STYLES.container);

        // Modal header
        const header = document.createElement('h2');
        Object.assign(header.style, DIALOG_STYLES.header);
        header.textContent = 'Subscription Required';
        
        // Modal message
        const message = document.createElement('p');
        Object.assign(message.style, DIALOG_STYLES.info);
        message.textContent = 'To use the Simulation feature, a monthly subscription is required.';
        
        // Price display
        const priceInfo = document.createElement('div');
        Object.assign(priceInfo.style, DIALOG_STYLES.resultItem);
        priceInfo.innerHTML = '<strong>Monthly Subscription:</strong> $5.00/month';
        
        // Features list
        const featuresList = document.createElement('ul');
        Object.assign(featuresList.style, {
            listStyle: 'none',
            padding: '0',
            margin: '20px 0'
        });
        
        const features = [
            'Unlimited simulations',
            'Priority support',
            'Access to all features',
            'Regular updates'
        ];
        
        features.forEach(feature => {
            const li = document.createElement('li');
            Object.assign(li.style, {
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center'
            });
            li.innerHTML = `
                <span style="color: #48d800; margin-right: 10px;">✓</span>
                ${feature}
            `;
            featuresList.appendChild(li);
        });
        
        // Subscribe button
        const subscribeButton = document.createElement('button');
        Object.assign(subscribeButton.style, DIALOG_STYLES.button);
        subscribeButton.textContent = 'Subscribe Now';
        
        // Cancel button
        const cancelButton = document.createElement('button');
        Object.assign(cancelButton.style, {
            ...DIALOG_STYLES.button,
            ...DIALOG_STYLES.buttonSecondary,
            marginTop: '10px'
        });
        cancelButton.textContent = 'Cancel';
        
        // Add event listeners
        subscribeButton.addEventListener('click', async () => {
            try {
                subscribeButton.disabled = true;
                subscribeButton.textContent = 'Processing...';
                await redirectToStripeCheckout();
            } catch (error) {
                console.error('Subscription error:', error);
                const errorMsg = document.createElement('div');
                Object.assign(errorMsg.style, DIALOG_STYLES.error);
                errorMsg.textContent = 'An error occurred. Please try again.';
                modal.appendChild(errorMsg);
            } finally {
                subscribeButton.disabled = false;
                subscribeButton.textContent = 'Subscribe Now';
            }
        });
        
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        // Add hover effects
        [subscribeButton, cancelButton].forEach(button => {
            button.addEventListener('mouseover', () => {
                if (button === subscribeButton) {
                    Object.assign(button.style, DIALOG_STYLES.buttonHover);
                } else {
                    button.style.backgroundColor = '#f8f9fa';
                }
            });
            
            button.addEventListener('mouseout', () => {
                if (button === subscribeButton) {
                    button.style.backgroundColor = DIALOG_STYLES.button.backgroundColor;
                } else {
                    button.style.backgroundColor = DIALOG_STYLES.buttonSecondary.backgroundColor;
                }
            });
        });
        
        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(message);
        modal.appendChild(priceInfo);
        modal.appendChild(featuresList);
        modal.appendChild(subscribeButton);
        modal.appendChild(cancelButton);
        
        overlay.appendChild(modal);
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

// Function to fix customer ID mismatch
async function fixCustomerIdMismatch() {
    try {
        const token = getAuthToken();
        if (!token) {
            console.error('No authentication token found');
            alert('Please log in first');
            return false;
        }

        console.log('🔧 Fixing customer ID mismatch...');

        const response = await fetch(`${API_BASE_URL}/stripe/fix-customer-id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fix customer ID');
        }

        const data = await response.json();
        console.log('✅ Customer ID fixed:', data);

        // Update stored token with the new one
        if (data.newToken) {
            localStorage.setItem('token', data.newToken);
            console.log('🔄 Updated authentication token');
        }

        // Update stored user data
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('🔄 Updated user data');
        }

        alert('Customer ID fixed! You can now use Stripe subscriptions.');
        return true;

    } catch (error) {
        console.error('Error fixing customer ID:', error);
        alert('Failed to fix customer ID: ' + error.message);
        return false;
    }
}

// Function to update customer ID to existing test mode customer
async function updateCustomerIdToTest(testCustomerId) {
    try {
        const token = getAuthToken();
        if (!token) {
            console.error('No authentication token found');
            alert('Please log in first');
            return false;
        }

        console.log('🔄 Updating customer ID to test mode customer:', testCustomerId);

        const response = await fetch(`${API_BASE_URL}/stripe/update-customer-id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                newCustomerId: testCustomerId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update customer ID');
        }

        const data = await response.json();
        console.log('✅ Customer ID updated:', data);

        // Update stored token with the new one
        if (data.newToken) {
            localStorage.setItem('token', data.newToken);
            console.log('🔄 Updated authentication token');
        }

        // Update stored user data
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('🔄 Updated user data');
        }

        alert(`Customer ID updated successfully!\nOld: ${data.oldCustomerId}\nNew: ${data.newCustomerId}`);
        return true;

    } catch (error) {
        console.error('Error updating customer ID:', error);
        alert('Failed to update customer ID: ' + error.message);
        return false;
    }
}

// Make other necessary functions global
window.showSubscriptionModal = showSubscriptionModal;
window.fixCustomerIdMismatch = fixCustomerIdMismatch;
window.updateCustomerIdToTest = updateCustomerIdToTest;