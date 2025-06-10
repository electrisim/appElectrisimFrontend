// This script initializes Stripe and makes it globally available
(function() {
    // Make sure Stripe.js is loaded
    function initStripe() {
        if (typeof Stripe === 'undefined') {
            console.log('Stripe.js not loaded, loading now...');
            
            var script = document.createElement('script');
            script.src = "https://js.stripe.com/v3/";
            script.onload = function() {
                if (typeof Stripe !== 'undefined') {
                    console.log('Stripe.js loaded successfully');
                    createStripeInstance();
                } else {
                    console.error('Failed to load Stripe.js');
                }
            };
            document.head.appendChild(script);
        } else {
            console.log('Stripe.js already loaded');
            createStripeInstance(); 
        }
    }

    // Create the Stripe instance using environment config
    function createStripeInstance() {
        if (!window.ENV) {
            console.error('Environment configuration not found');
            return;
        }

        try {
            window.stripe = Stripe(window.ENV.stripePublishableKey);
            console.log('Stripe initialized in', window.ENV === window.ENV.production ? 'production' : 'development', 'mode');
            
            // Dispatch stripeReady event
            document.dispatchEvent(new CustomEvent('stripeReady', {
                detail: {
                    mode: window.ENV === window.ENV.production ? 'production' : 'development',
                    apiUrl: window.ENV.apiBaseUrl
                }
            }));
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
        }
    }

    // Initialize when environment config is ready
    function waitForEnv() {
        if (window.ENV) {
            initStripe();
        } else {
            console.log('Waiting for environment configuration...');
            setTimeout(waitForEnv, 100);
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForEnv);
    } else {
        waitForEnv();
    }
})();