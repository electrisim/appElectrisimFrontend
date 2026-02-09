import config from '../config/environment.js';

// Initialize Stripe only when the Stripe script has loaded (avoids "Stripe is not defined" when script fails)
let stripe = null;
if (typeof window.Stripe === 'function') {
    try {
        stripe = window.Stripe(config.stripePublishableKey, {
            apiVersion: '2023-10-16'
        });
        console.log('Stripe initialized in', config.isDevelopment ? 'development' : 'production', 'mode');
    } catch (e) {
        console.warn('Stripe initialization failed:', e);
    }
} else {
    console.warn('Stripe SDK not loaded (script may have failed). Subscription/checkout will use redirect flow.');
}

// Dispatch stripeReady event so listeners can check detail.stripe
document.dispatchEvent(new CustomEvent('stripeReady', {
    detail: {
        stripe,
        mode: config.isDevelopment ? 'development' : 'production',
        apiUrl: config.apiBaseUrl
    }
}));

/**
 * Returns a Promise that resolves with the Stripe instance when available.
 * Use this when Stripe might be loaded lazily (e.g. after loadStripe() from lazy-loader).
 */
export function getStripe() {
    if (stripe) return Promise.resolve(stripe);
    if (typeof window.Stripe === 'function') {
        try {
            stripe = window.Stripe(config.stripePublishableKey, { apiVersion: '2023-10-16' });
            return Promise.resolve(stripe);
        } catch (e) {
            return Promise.reject(e);
        }
    }
    return new Promise((resolve, reject) => {
        const handler = (e) => {
            if (e.detail && e.detail.stripe) {
                document.removeEventListener('stripeReady', handler);
                resolve(e.detail.stripe);
            }
        };
        document.addEventListener('stripeReady', handler);
        const timeout = setTimeout(() => {
            document.removeEventListener('stripeReady', handler);
            if (stripe) resolve(stripe);
            else if (typeof window.Stripe === 'function') {
                try {
                    stripe = window.Stripe(config.stripePublishableKey, { apiVersion: '2023-10-16' });
                    resolve(stripe);
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error('Stripe SDK not available'));
            }
        }, 10000);
    });
}

export default stripe;