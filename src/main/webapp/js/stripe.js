// This script initializes Stripe and makes it globally available
(function() {
    // Make sure Stripe.js is loaded
    function initStripe() {
        if (typeof Stripe === 'undefined') {
            console.log('Stripe.js is not loaded! Loading it now...');
            
            // Dynamically load Stripe.js if not already available
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

    // Create the Stripe instance
    function createStripeInstance() {
        // Update the production URL check and key
        const isProduction = window.location.hostname === 'app.electrisim.com';
        const stripePublicKey = isProduction 
            ? 'pk_live_51OOivlAd4ULYw2NbUnCgqV6KHAiRzkuoMJfcYKv1R5DsarBaly7QDOQCwwHI4GQUhYqA57SGHIOIwYleWKs0UQNe00fiZkcYco'
            : 'pk_test_51OOivlAd4ULYw2NbezAGuGZCcd12huJWoi4GHPmUZzz5SmuCaptFp9tcR8Tefcgpkzu8S5xkI1NG8P0VWQJktoxJ00IX6EC0nO';
        
        try {
            window.stripe = Stripe(stripePublicKey);
            console.log('Stripe initialized successfully with key type:', isProduction ? 'production' : 'test');
            
            // Dispatch an event so other scripts know Stripe is ready
            document.dispatchEvent(new CustomEvent('stripeReady'));
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
        }
    }

    // Initialize when the document is ready or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStripe);
    } else {
        initStripe();
    }
    
    // Add listener for token-related events
    document.addEventListener('userLoggedIn', function(e) {
        // You can add logic here if you need to do something specific when user logs in
        console.log('User logged in, Stripe ready for subscription operations');
    });
})();