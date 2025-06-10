// editorExtensions.js - Extends EditorUi with modern dialog implementations
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';
import { ShortCircuitDialog } from './dialogs/ShortCircuitDialog.js';

// Wait for both the document and EditorUi to be ready
function waitForEditor(callback) {
    // Check for both EditorUi and the original LoadFlowDialogPandaPower function
    if (typeof EditorUi === 'undefined' || 
        !window.App || 
        !window.App.main || 
        !window.App.main.editor ||
        typeof LoadFlowDialogPandaPower === 'undefined') {
        setTimeout(() => waitForEditor(callback), 100);
        return;
    }
    callback();
}

// Initialize our extensions
function initializeEditorExtensions() {
    try {
        // Store original methods for potential fallback
        const originalShowLoadFlow = EditorUi.prototype.showLoadFlowDialogPandaPower;
        const originalShowShortCircuit = EditorUi.prototype.showShortCircuitDialog;

        // Override the original showLoadFlowDialogPandaPower method
        EditorUi.prototype.showLoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            try {
                // Check subscription status
                const hasSubscription = window.subscriptionHandler?.checkSubscriptionStatus();
                
                if (!hasSubscription) {
                    // Show subscription modal if no active subscription
                    window.subscriptionHandler?.showSubscriptionModal();
                    return;
                }
                
                // Create and show the dialog
                const dialog = new LoadFlowDialog();
                dialog.show(callback);
                
            } catch (error) {
                console.error('Error in showLoadFlowDialogPandaPower:', error);
                // Fallback to original method if available
                if (originalShowLoadFlow) {
                    originalShowLoadFlow.call(this, title, okButtonText, callback);
                }
            }
        };

        // Override the original showShortCircuitDialog method
        EditorUi.prototype.showShortCircuitDialog = function(title, okButtonText, callback) {
            try {
                // Check subscription status
                const hasSubscription = window.subscriptionHandler?.checkSubscriptionStatus();
                
                if (!hasSubscription) {
                    // Show subscription modal if no active subscription
                    window.subscriptionHandler?.showSubscriptionModal();
                    return;
                }
                
                // Create and show the dialog
                const dialog = new ShortCircuitDialog();
                dialog.show(callback);
                
            } catch (error) {
                console.error('Error in showShortCircuitDialog:', error);
                // Fallback to original method if available
                if (originalShowShortCircuit) {
                    originalShowShortCircuit.call(this, title, okButtonText, callback);
                }
            }
        };

        console.log('Editor extensions initialized successfully');
    } catch (error) {
        console.error('Error initializing editor extensions:', error);
    }
}

// Start initialization when everything is ready
waitForEditor(initializeEditorExtensions);

// Add a backup initialization in case the first one fails
window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof EditorUi !== 'undefined' && 
            typeof LoadFlowDialogPandaPower !== 'undefined' && 
            EditorUi.prototype.showLoadFlowDialogPandaPower === LoadFlowDialogPandaPower) {
            console.log('Backup initialization of editor extensions');
            initializeEditorExtensions();
        }
    }, 2000); // Wait 2 seconds after load to ensure everything is ready
});

// Restore original methods if needed
if (typeof window !== 'undefined' && 
    EditorUi.prototype.showLoadFlowDialogPandaPower === LoadFlowDialogPandaPower) {
    EditorUi.prototype.showLoadFlowDialogPandaPower = originalShowLoadFlow;
    EditorUi.prototype.showShortCircuitDialog = originalShowShortCircuit;
} 