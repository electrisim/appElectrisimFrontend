// Resend: verified sending domain noreply.electrisim.com (DNS send.noreply / resend._domainkey.noreply).
// The auth API must use this exact "from" in development and production (not onboarding@resend.dev).
const MAIL_FROM_TRANSACTIONAL = 'ElectriSim <noreply@noreply.electrisim.com>';

const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000';
const TUNNEL_BACKEND_URL = 'https://03dht3kc-5000.euw.devtunnels.ms';

function resolveDevBackendUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const q = String(params.get('backend') || '').toLowerCase();
        if (q === 'tunnel') return TUNNEL_BACKEND_URL;
        if (q === 'local' || q === 'localhost') return LOCAL_BACKEND_URL;
        const stored = String(localStorage.getItem('electrisimBackend') || '').toLowerCase();
        if (stored === 'tunnel') return TUNNEL_BACKEND_URL;
        if (stored === 'local' || stored === 'localhost') return LOCAL_BACKEND_URL;
    } catch (_) { /* ignore */ }
    const host = String(window.location.hostname || '');
    if (host === 'localhost' || host === '127.0.0.1') return LOCAL_BACKEND_URL;
    return TUNNEL_BACKEND_URL;
}

const config = {
    development: {
      // Local live-server (127.0.0.1 / localhost) talks straight to Flask so
      // python app.py shows request logs. Override: ?backend=tunnel or
      // localStorage.electrisimBackend = 'tunnel'
      backendUrl: resolveDevBackendUrl(),
      
      // Stripe subscription API  
      apiBaseUrl: 'http://localhost:5502/api',
      frontendUrl: 'http://127.0.0.1:5501',
      stripePublishableKey: 'pk_test_51OOivlAd4ULYw2NbezAGuGZCcd12huJWoi4GHPmUZzz5SmuCaptFp9tcR8Tefcgpkzu8S5xkI1NG8P0VWQJktoxJ00IX6EC0nO',
      // Stripe Price IDs (test mode). Replace the placeholders with the real
      // price IDs once the $10 Personal and $40/seat Company prices are created.
      personalPriceId: 'price_1TneZrAd4ULYw2Nb4XH8yZih',
      companyPriceId: 'price_1Tnea9Ad4ULYw2NbUTbZvCAq',
      isDevelopment: true,
      mailFromTransactional: MAIL_FROM_TRANSACTIONAL
    },
    production: {
      // Backend simulation API (custom domain for sim service)
      backendUrl: 'https://sim.electrisim.com',
      
      // Stripe subscription / auth API (custom domain)
      apiBaseUrl: 'https://api.electrisim.com/api',
      frontendUrl: 'https://app.electrisim.com',
      stripePublishableKey: 'pk_live_51OOivlAd4ULYw2NbUnCgqV6KHAiRzkuoMJfcYKv1R5DsarBaly7QDOQCwwHI4GQUhYqA57SGHIOIwYleWKs0UQNe00fiZkcYco',
      // Stripe Price IDs (live mode). Replace the placeholders with the real
      // price IDs once the $10 Personal and $40/seat Company prices are created.
      personalPriceId: 'price_1TneTZAd4ULYw2NbfzvJtGnY',
      companyPriceId: 'price_1TneVuAd4ULYw2Nbf1u2ll71',
      isDevelopment: false,
      mailFromTransactional: MAIL_FROM_TRANSACTIONAL
    }
  };
  
  // Auto-detect environment based on hostname
  const env = window.location.hostname === 'app.electrisim.com' ? 'production' : 'development';
const currentConfig = config[env];


window.ENV = currentConfig;
console.log('Current environment:', env);
console.log('Using backend URL:', currentConfig.backendUrl);
console.log('Using API URL:', currentConfig.apiBaseUrl);


export default currentConfig;