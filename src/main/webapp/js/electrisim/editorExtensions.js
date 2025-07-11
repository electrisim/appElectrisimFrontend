// editorExtensions.js - Extends EditorUi with modern dialog implementations
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';

// Wait for EditorUi to be ready
function waitForEditor(callback) {
    if (typeof EditorUi === 'undefined' || 
        !window.App || 
        !window.App.main || 
        !window.App.main.editor) {
        setTimeout(() => waitForEditor(callback), 100);
        return;
    }
    callback();
}

// Initialize our extensions
function initializeEditorExtensions() {
    try {
        // Override the showLoadFlowDialogPandaPower method with modern implementation
        EditorUi.prototype.showLoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            // Check subscription status
            const hasSubscription = window.subscriptionHandler?.checkSubscriptionStatus();
            
            if (!hasSubscription) {
                // Show subscription modal if no active subscription
                window.subscriptionHandler?.showSubscriptionModal();
                return;
            }
            
            // Create and show the modern dialog
            const dialog = new LoadFlowDialog();
            dialog.show(callback);
        };

        console.log('Modern dialog extensions initialized successfully');
    } catch (error) {
        console.error('Error initializing editor extensions:', error);
    }
}

// Initialize when everything is ready
waitForEditor(initializeEditorExtensions); 