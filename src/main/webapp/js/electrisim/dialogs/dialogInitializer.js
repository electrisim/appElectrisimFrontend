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
                
                // Mark that a dialog is being shown for this cell and globally
                cell._dialogShowing = true;
                window._globalDialogShowing = true;
                
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
                
                // Add cleanup when dialog is closed
                const originalClose = this.closeDialog;
                this.closeDialog = function() {
                    if (cell._dialogShowing) {
                        delete cell._dialogShowing;
                    }
                    if (window._globalDialogShowing) {
                        delete window._globalDialogShowing;
                    }
                    if (originalClose) {
                        return originalClose.apply(this, arguments);
                    }
                };
                
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

        // Expose custom function globally so app.min.js can defer to it
        try { window.customShowDataDialog = customShowDataDialog; } catch (e) {}

        // Assign the custom function to the prototype (force replacement right away)
        EditorUi.prototype.showDataDialog = customShowDataDialog;

        // Guard the core showDialog to prevent duplicate overlays while one is active
        if (!EditorUi.prototype._originalShowDialogGuarded) {
            const _origShowDialog = EditorUi.prototype.showDialog;
            EditorUi.prototype.showDialog = function(elt, w, h, modal, closable, onClose, noScroll, transparent, onResize, ignoreBgClick) {
                try {
                    // If a global dialog is showing and this is not our own electrisim dialog, block it
                    const isElectrisim = elt && elt.classList && elt.classList.contains('electrisim-dialog');
                    if (window._globalDialogShowing && !isElectrisim) {
                        console.warn('Blocked duplicate dialog while another is active');
                        return;
                    }
                } catch (e) {}
                return _origShowDialog.apply(this, arguments);
            };
            EditorUi.prototype._originalShowDialogGuarded = true;
        }
        
        console.log('All dialog overrides initialized successfully');
        
        // Mark as initialized to prevent duplicate initialization
        EditorUi.prototype._dialogOverridesInitialized = true;
        
        // Verify the override worked
        console.log('showDataDialog override verification:', {
            isOverridden: EditorUi.prototype.showDataDialog.toString().includes('ComponentsDataDialog'),
            EditDataDialogAvailable: typeof window.EditDataDialog !== 'undefined',
            ComponentsDataDialogAvailable: typeof window.ComponentsDataDialog !== 'undefined'
        });
        
        // Set up a periodic check to ensure our override is still active and no duplicate dialogs
        setInterval(() => {
            try {
                if (!EditorUi.prototype.showDataDialog.toString().includes('ComponentsDataDialog')) {
                    console.warn('showDataDialog override was lost, re-applying...');
                    EditorUi.prototype.showDataDialog = customShowDataDialog;
                }
                // Hard guard: if there are multiple .geDialog overlays, keep only the last
                const overlays = document.querySelectorAll('.mxWindow, .geDialog');
                if (overlays && overlays.length > 1) {
                    for (let i = 0; i < overlays.length - 1; i++) {
                        overlays[i].parentNode && overlays[i].parentNode.removeChild(overlays[i]);
                    }
                }
            } catch (e) {
                // noop
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error initializing dialog overrides:', error);
    }
}

// Initialize when everything is ready
waitForApp(initializeDialogs); 