const config = {
    development: {
      apiBaseUrl: 'http://localhost:3000/api',
      frontendUrl: 'http://127.0.0.1:5501',
      stripePublishableKey: 'pk_test_51OOivlAd4ULYw2NbezAGuGZCcd12huJWoi4GHPmUZzz5SmuCaptFp9tcR8Tefcgpkzu8S5xkI1NG8P0VWQJktoxJ00IX6EC0nO',
      isDevelopment: true
    },
    production: {
      apiBaseUrl: 'https://customers-production-16f8.up.railway.app/api',
      frontendUrl: 'https://app.electrisim.com',
      stripePublishableKey: 'pk_live_51OOivlAd4ULYw2NbUnCgqV6KHAiRzkuoMJfcYKv1R5DsarBaly7QDOQCwwHI4GQUhYqA57SGHIOIwYleWKs0UQNe00fiZkcYco',
      isDevelopment: false
    }
  };
  
  const env = window.location.hostname === 'app.electrisim.com' ? 'production' : 'development';
const currentConfig = config[env];

// Set global ENV for non-module scripts
window.ENV = currentConfig;
console.log('Current environment:', env);
console.log('Using API URL:', currentConfig.apiBaseUrl);

// Export for ES modules
export default currentConfig;