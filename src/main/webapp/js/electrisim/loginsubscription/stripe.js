import config from '../config/environment.js';

// Initialize Stripe
const stripe = Stripe(config.stripePublishableKey, {
    apiVersion: '2023-10-16'
});

console.log('Stripe initialized in', config.isDevelopment ? 'development' : 'production', 'mode');

// Dispatch stripeReady event
document.dispatchEvent(new CustomEvent('stripeReady', {
    detail: {
        mode: config.isDevelopment ? 'development' : 'production',
        apiUrl: config.apiBaseUrl
    }
}));

export default stripe;