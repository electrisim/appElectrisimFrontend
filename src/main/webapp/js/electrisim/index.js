// index.js - Entry point for modern Electrisim dialog implementations
import { initializeDialogs } from './dialogInitializer.js';

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize our modern dialog implementations
        initializeDialogs();
        
        console.log('Successfully initialized Electrisim modern dialogs');
    } catch (error) {
        console.error('Error initializing Electrisim dialogs:', error);
    }
}); 