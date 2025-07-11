// dialogInitializer.js - Ensures proper dialog initialization
import { EditDataDialog } from './EditDataDialog.js';
import { LoadFlowDialog } from './LoadFlowDialog.js';
import { ComponentsDataDialog } from './ComponentsDataDialog.js';

// Make dialogs available globally for legacy code compatibility
window.EditDataDialog = EditDataDialog;
window.ComponentsDataDialog = ComponentsDataDialog;
window.LoadFlowDialog = LoadFlowDialog;

// Wait for all dependencies to be ready
function waitForApp(callback) {
    if (typeof EditorUi === 'undefined' || 
        !window.App || 
        !window.App.main || 
        !window.App.main.editor) {
        setTimeout(() => waitForApp(callback), 100);
        return;
    }
    callback();
}

// Initialize all dialog overrides
function initializeDialogs() {
    try {
        console.log('Initializing modern dialogs...');
        
        // Ensure dialogs are available globally
        if (!window.EditDataDialog) {
            window.EditDataDialog = EditDataDialog;
            console.log('EditDataDialog made available globally');
        }
        
        if (!window.ComponentsDataDialog) {
            window.ComponentsDataDialog = ComponentsDataDialog;
            console.log('ComponentsDataDialog made available globally');
        }

        // Store original method as backup
        const originalShowDataDialog = EditorUi.prototype.showDataDialog;

        // Override the showDataDialog method to use appropriate dialog
        EditorUi.prototype.showDataDialog = function(cell) {
            try {
                console.log('showDataDialog called with cell:', cell);
                
                if (!cell) {
                    console.log('No cell provided, using root cell');
                    cell = this.editor.graph.getModel().getRoot();
                }
                
                // Check if this is the root cell or a request for all components overview
                const model = this.editor.graph.getModel();
                const isRootCell = cell === model.getRoot();
                const cellStyle = cell.getStyle && cell.getStyle();
                
                console.log('Cell analysis:', {
                    isRootCell,
                    cellStyle: cellStyle || 'none',
                    hasShapeELXXX: cellStyle ? cellStyle.includes('shapeELXXX=') : false
                });
                
                // If it's the root cell or has no specific component style, show ComponentsDataDialog
                if (isRootCell || !cellStyle || !cellStyle.includes('shapeELXXX=')) {
                    console.log('Showing ComponentsDataDialog for all components overview');
                    const componentsDialog = new ComponentsDataDialog(this, cell);
                    componentsDialog.show();
                    return;
                }
                
                // Otherwise, show EditDataDialog for individual cell
                console.log('Showing EditDataDialog for individual cell');
                const dialog = new EditDataDialog(this, cell);
                
                // Check if the dialog should be shown (for special cases like Result elements)
                if (dialog.shouldShowDialog === false) {
                    console.log('Dialog should not be shown for this cell');
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
                console.error('Error in custom showDataDialog:', error);
                // Fallback to original method if available
                if (originalShowDataDialog && typeof originalShowDataDialog === 'function') {
                    console.log('Falling back to original showDataDialog');
                    return originalShowDataDialog.call(this, cell);
                }
            }
        };

        // Override the LoadFlowDialog method
        EditorUi.prototype.showLoadFlowDialogPandaPower = function(title, okButtonText, callback) {
            const dialog = new LoadFlowDialog(this);
            dialog.show((values) => {
                if (callback) {
                    callback(values);
                }
            });
            return dialog;
        };

        console.log('All dialog overrides initialized successfully');
        
        // Verify the override worked
        console.log('showDataDialog override verification:', {
            isOverridden: EditorUi.prototype.showDataDialog.toString().includes('ComponentsDataDialog'),
            EditDataDialogAvailable: typeof window.EditDataDialog !== 'undefined',
            ComponentsDataDialogAvailable: typeof window.ComponentsDataDialog !== 'undefined'
        });
        
    } catch (error) {
        console.error('Error initializing dialog overrides:', error);
    }
}

// Initialize when everything is ready
waitForApp(initializeDialogs); 