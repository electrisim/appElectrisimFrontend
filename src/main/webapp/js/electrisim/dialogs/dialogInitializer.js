// dialogInitializer.js - Ensures proper dialog initialization and overrides
import { LoadFlowDialog } from './LoadFlowDialog.js';
import { ShortCircuitDialog } from './ShortCircuitDialog.js';
import { EditDataDialog } from './EditDataDialog.js';

// Wait for both the document and app.min.js to be loaded
function waitForApp(callback) {
    if (typeof LoadFlowDialogPandaPower === 'undefined' || 
        typeof ShortCircuitDialog === 'undefined' ||
        typeof EditorUi === 'undefined') {
        setTimeout(() => waitForApp(callback), 100);
        return;
    }
    callback();
}

// Initialize our dialog overrides
function initializeDialogs() {
    try {
        // Store original methods for LoadFlow
        const originalLoadFlowDialog = window.LoadFlowDialogPandaPower;
        const originalShowLoadFlow = EditorUi.prototype.showLoadFlowDialogPandaPower;

        // Store original methods for ShortCircuit
        const originalShortCircuitDialog = window.ShortCircuitDialog;
        const originalShowShortCircuit = EditorUi.prototype.showShortCircuitDialog;

        // Store original EditDataDialog method
        const originalShowDataDialog = EditorUi.prototype.showDataDialog;

        // Override the LoadFlowDialogPandaPower constructor
        window.LoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            const dialog = new LoadFlowDialog();
            dialog.show(callback);
            return dialog;
        };

        // Override the showLoadFlowDialogPandaPower method
        EditorUi.prototype.showLoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            try {
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

        // Override the ShortCircuitDialog constructor
        window.ShortCircuitDialog = function(title, okButtonText, callback) {
            const dialog = new ShortCircuitDialog();
            dialog.show(callback);
            return dialog;
        };

        // Override the showShortCircuitDialog method
        EditorUi.prototype.showShortCircuitDialog = function(title, okButtonText, callback) {
            try {
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

        // Override the showDataDialog method to use our clean EditDataDialog
        EditorUi.prototype.showDataDialog = function(cell) {
            try {
                if (!cell) return;
                
                // Create our custom EditDataDialog
                const dialog = new EditDataDialog(this, cell);
                
                // Check if the dialog should be shown (for special cases like Result elements)
                if (dialog.shouldShowDialog === false) {
                    return;
                }
                
                // Get current screen dimensions for full-width dialog
                const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                
                // Calculate dynamic width: full screen width with margins, minimum 1200px
                const dialogWidth = Math.max(screenWidth - 40, 1200);
                
                // Ultra-compact dialog height: 75px grid + 28px buttons + 15px margins = 118px
                const dialogHeight = 118;
                
                // Show the dialog with full-width dimensions
                this.showDialog(dialog.container, dialogWidth, dialogHeight, true, false, null, false);
                
                // Initialize the dialog
                dialog.init();
                
                console.log(`Custom EditDataDialog shown: ${dialogWidth}x${dialogHeight}`);
                
            } catch (error) {
                console.error('Error in showDataDialog:', error);
                // Fallback to original method if something goes wrong
                if (originalShowDataDialog) {
                    originalShowDataDialog.call(this, cell);
                }
            }
        };

        console.log('Dialog overrides initialized successfully');
    } catch (error) {
        console.error('Error initializing dialog overrides:', error);
    }
}

// Start initialization when everything is ready
waitForApp(initializeDialogs);

// Add a backup initialization in case the first one fails
window.addEventListener('load', () => {
    setTimeout(initializeDialogs, 2000); // Wait 2 seconds after load
}); 