// dialogInitializer.js - Initialize and override minified dialog implementations
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';
import { ShortCircuitDialog } from './dialogs/ShortCircuitDialog.js';

// Wait for all dependencies to be ready
function waitForDependencies(callback) {
    if (typeof EditorUi === 'undefined' || 
        !window.App || 
        !window.App.main || 
        !window.App.main.editor) {
        setTimeout(() => waitForDependencies(callback), 100);
        return;
    }
    callback();
}

// Initialize our dialog implementations
function initializeDialogs() {
    try {
        console.log('Initializing dialogs...');

        // Override the EditorUi prototype methods
        EditorUi.prototype.showLoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            console.log('showLoadFlowDialogPandaPower called');
            const dialog = new LoadFlowDialog(this);
            dialog.show((values) => {
                if (callback) {
                    callback(values);
                }
            });
            return dialog;
        };

        EditorUi.prototype.showShortCircuitDialogPandaPower = function(title, okButtonText, callback) {
            console.log('showShortCircuitDialogPandaPower called');
            const dialog = new ShortCircuitDialog(this);
            dialog.show((values) => {
                if (callback) {
                    callback(values);
                }
            });
            return dialog;
        };
        
        console.log('Successfully initialized modern dialog implementations');
    } catch (error) {
        console.error('Error initializing dialogs:', error);
    }
}

// Start initialization when everything is ready
waitForDependencies(initializeDialogs);

// Add a backup initialization in case the first one fails
window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof EditorUi !== 'undefined' && 
            window.App && 
            window.App.main && 
            window.App.main.editor) {
            console.log('Backup initialization of dialogs');
            initializeDialogs();
        }
    }, 2000); // Wait 2 seconds after load to ensure everything is ready
}); 