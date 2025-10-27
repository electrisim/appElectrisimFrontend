// dialogInitializer.js - Ensures proper dialog initialization
import { EditDataDialog } from './EditDataDialog.js';
import { LoadFlowDialog } from './LoadFlowDialog.js';
import { OpenDSSLoadFlowDialog } from './OpenDSSLoadFlowDialog.js';
import { ComponentsDataDialog } from './ComponentsDataDialog.js';

// Make dialogs available globally for legacy code compatibility
window.EditDataDialog = EditDataDialog;
window.ComponentsDataDialog = ComponentsDataDialog;
window.LoadFlowDialog = LoadFlowDialog;
window.OpenDSSLoadFlowDialog = OpenDSSLoadFlowDialog;

        // Wait for all dependencies to be ready
        function waitForApp(callback) {
            if (typeof EditorUi === 'undefined' || 
                !window.App || 
                !window.App.main || 
                !window.App.main.editor) {
                setTimeout(() => waitForApp(callback), 100);
                return;
            }
            
            // Add a small delay to ensure app.min.js has finished loading
            setTimeout(callback, 200);
        }

// Initialize all dialog overrides
function initializeDialogs() {
    try {
        console.log('Initializing modern dialogs...');
        
        // Check if already initialized to prevent multiple initializations
        if (EditorUi.prototype._dialogOverridesInitialized) {
            console.log('Dialog overrides already initialized, skipping...');
            return;
        }
        
        // Ensure dialogs are available globally
        if (!window.EditDataDialog) {
            window.EditDataDialog = EditDataDialog;
            console.log('EditDataDialog made available globally');
        }
        
        if (!window.ComponentsDataDialog) {
            window.ComponentsDataDialog = ComponentsDataDialog;
            console.log('ComponentsDataDialog made available globally');
        }

        if (!window.LoadFlowDialog) {
            window.LoadFlowDialog = LoadFlowDialog;
            console.log('LoadFlowDialog made available globally');
        }

        if (!window.OpenDSSLoadFlowDialog) {
            window.OpenDSSLoadFlowDialog = OpenDSSLoadFlowDialog;
            console.log('OpenDSSLoadFlowDialog made available globally');
        }

        // Store original method as backup
        const originalShowDataDialog = EditorUi.prototype.showDataDialog;

        // Completely replace the showDataDialog method to prevent conflicts
        const customShowDataDialog = function(cell) {
            try {
                console.log('showDataDialog called with cell:', cell);
                
                if (!cell) {
                    console.log('No cell provided, using root cell');
                    cell = this.editor.graph.getModel().getRoot();
                }
                
                // Check if there's already a dialog showing for this cell
                if (cell._dialogShowing) {
                    console.log('Dialog already showing for this cell, ignoring duplicate call');
                    return;
                }
                
                // Check if there's already a dialog showing globally
                if (window._globalDialogShowing) {
                    console.log('Global dialog already showing, ignoring duplicate call');
                    return;
                }
                
                // NOTE: Do NOT set cell._dialogShowing or window._globalDialogShowing here!
                // These flags are managed by EditDataDialog and ComponentsDataDialog internally.
                // Setting them here causes issues because if the dialog creation fails or
                // the user clicks quickly, the flags can get stuck.
                
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
                    console.log('Dialog should not be shown for this cell type');
                    // Flags are managed internally by the dialog classes
                    return;
                }
                
                dialog.show();
                
                // Clean up flags when dialog is closed
                const cleanup = () => {
                    cell._dialogShowing = false;
                    window._globalDialogShowing = false;
                };
                
                // Store cleanup callback
                dialog.cleanupCallback = cleanup;
                
            } catch (error) {
                console.error('Error in custom showDataDialog:', error);
                // Reset flags on error
                if (cell) cell._dialogShowing = false;
                window._globalDialogShowing = false;
            }
        };

        // Override the showDataDialog method
        EditorUi.prototype.showDataDialog = customShowDataDialog;

        // Add load flow dialog methods
        if (!EditorUi.prototype.showLoadFlowDialog) {
            EditorUi.prototype.showLoadFlowDialog = function(title, buttonText, callback) {
                try {
                    console.log('showLoadFlowDialog called');
                    
                    if (window.LoadFlowDialog) {
                        const dialog = new window.LoadFlowDialog(this);
                        dialog.show(callback);
                    } else {
                        console.error('LoadFlowDialog not available');
                        alert('Load Flow dialog is not available');
                    }
                } catch (error) {
                    console.error('Error showing LoadFlowDialog:', error);
                    alert('Error showing Load Flow dialog: ' + error.message);
                }
            };
        }

        // Add OpenDSS load flow dialog method
        if (!EditorUi.prototype.showLoadFlowDialogOpenDSS) {
            EditorUi.prototype.showLoadFlowDialogOpenDSS = function(title, buttonText, callback) {
                try {
                    console.log('showLoadFlowDialogOpenDSS called');
                    
                    if (window.OpenDSSLoadFlowDialog) {
                        const dialog = new window.OpenDSSLoadFlowDialog(this);
                        dialog.show(callback);
                    } else {
                        console.error('OpenDSSLoadFlowDialog not available');
                        alert('OpenDSS Load Flow dialog is not available');
                    }
                } catch (error) {
                    console.error('Error showing OpenDSSLoadFlowDialog:', error);
                    alert('Error showing OpenDSS Load Flow dialog: ' + error.message);
                }
            };
        }

        // Mark as initialized
        EditorUi.prototype._dialogOverridesInitialized = true;
        console.log('Dialog overrides initialized successfully');
        
    } catch (error) {
        console.error('Error initializing dialogs:', error);
    }
}

// Initialize when the page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        waitForApp(initializeDialogs);
    });
} else {
    waitForApp(initializeDialogs);
}

// Also try to initialize when the window loads (fallback)
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!EditorUi.prototype._dialogOverridesInitialized) {
            console.log('Attempting to initialize dialogs on window load...');
            waitForApp(initializeDialogs);
        }
    }, 1000);
});

// Export for potential use in other modules
export { initializeDialogs, waitForApp }; 