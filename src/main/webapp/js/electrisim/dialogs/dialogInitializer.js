// dialogInitializer.js - Ensures proper dialog initialization
import { installTransformerTerminalLabelOverlay } from '../utils/transformerTerminalLabels.js';
import '../utils/inServiceCellStyle.js';
import { EditDataDialog } from './EditDataDialog.js';
import { LoadFlowDialog } from './LoadFlowDialog.js';
import { OpenDSSLoadFlowDialog } from './OpenDSSLoadFlowDialog.js';
import { ComponentsDataDialog } from './ComponentsDataDialog.js';
import { RegControlDialog } from './RegControlDialog.js';
import { CapControlDialog } from './CapControlDialog.js';
import { StorageControllerDialog } from './StorageControllerDialog.js';
import { WindTurbineControllerDialog } from './WindTurbineControllerDialog.js';
import { WindTurbineDynamicControllerDialog } from './WindTurbineDynamicControllerDialog.js';
import { ParkControllerDialog } from './ParkControllerDialog.js';
import { syncWindTurbineFromController } from '../utils/windTurbineControllerApply.js';
import { hideMxGraphTooltip, isElectrisimDialogOpen } from '../Dialog.js';

// Make dialogs available globally for legacy code compatibility
window.EditDataDialog = EditDataDialog;
window.ComponentsDataDialog = ComponentsDataDialog;
window.LoadFlowDialog = LoadFlowDialog;
window.OpenDSSLoadFlowDialog = OpenDSSLoadFlowDialog;
window.RegControlDialog = RegControlDialog;
window.CapControlDialog = CapControlDialog;
window.StorageControllerDialog = StorageControllerDialog;
window.WindTurbineControllerDialog = WindTurbineControllerDialog;
window.WindTurbineDynamicControllerDialog = WindTurbineDynamicControllerDialog;
window.ParkControllerDialog = ParkControllerDialog;

// are loaded as standalone modules and make themselves available globally

        // Wait for all dependencies to be ready
        function waitForApp(callback) {
            const hasEditor = (window.App && window.App.main && window.App.main.editor) ||
                (window.App && window.App._instance && window.App._instance.editor);
            if (!window.EditorUi || !window.App || !hasEditor) {
                setTimeout(() => waitForApp(callback), 100);
                return;
            }
            
            // Add a small delay to ensure app.min.js has finished loading
            setTimeout(callback, 200);
        }

/** Resolve EditorUi from App globals (matches index.html App.main callback). */
function getEditorUi() {
    if (!window.App) return null;
    if (window.App._editorUi) return window.App._editorUi;
    if (window.App._instance) return window.App._instance;
    const ed = window.App.main && window.App.main.editor;
    if (ed && ed.editorUi) return ed.editorUi;
    return null;
}

function getCellStyleString(cell) {
    if (!cell) return '';
    if (typeof cell.getStyle === 'function') {
        const s = cell.getStyle();
        if (s) return s;
    }
    return cell.style || '';
}

/**
 * True when double-click should open Edit Data for this cell.
 * Skips result overlays, flow arrows, and non-editable stub edges.
 */
function isEditableElectricalCell(cell) {
    const style = getCellStyleString(cell);
    if (!style || style.indexOf('shapeELXXX=') < 0) return false;
    if (style.indexOf('shapeELXXX=Result') >= 0) return false;
    if (style.indexOf('shapeELXXX=FaultMarker') >= 0) return false;
    if (style.indexOf('shapeELXXX=FlowArrow') >= 0) return false;
    if (style.indexOf('shapeELXXX=NotEditableLine') >= 0) return false;
    return true;
}

/**
 * Prefer the electrical component if the user double-clicked a child name label
 * or a result placeholder attached to that component.
 */
function resolveEditableCell(cell) {
    let current = cell;
    let depth = 0;
    while (current && depth < 5) {
        if (isEditableElectricalCell(current)) return current;
        current = current.parent;
        depth += 1;
    }
    return null;
}

function openEditDataForCell(ui, graph, cell, evt) {
    const target = resolveEditableCell(cell);
    if (!target) return false;
    // Prevent dblClick + mouseDown double-detection from opening twice
    const now = Date.now();
    if (ui._editDataOpenedAt && now - ui._editDataOpenedAt < 500) {
        if (evt) mxEvent.consume(evt);
        return true;
    }
    ui._editDataOpenedAt = now;
    if (evt) mxEvent.consume(evt);
    hideMxGraphTooltip();
    try {
        graph.setSelectionCell(target);
    } catch (e) { /* selection optional */ }
    ui.showDataDialog(target);
    return true;
}

/**
 * Draw.io dumps every XML attribute into the hover tooltip. That grey box sits
 * above parameter dialogs (tooltip z-index 10005). For Electrisim cells show
 * only name + type; while a dialog is open show nothing.
 */
function installElectricalCellTooltips() {
    const GraphCtor = window.Graph;
    if (!GraphCtor || !GraphCtor.prototype || GraphCtor.prototype._electrisimTooltipPatched) {
        return;
    }
    const original = GraphCtor.prototype.getTooltipForCell;
    GraphCtor.prototype.getTooltipForCell = function (cell) {
        if (isElectrisimDialogOpen()) return '';
        if (!cell) {
            return typeof original === 'function' ? original.apply(this, arguments) : '';
        }
        const style = getCellStyleString(cell);
        const match = style.match(/shapeELXXX=([^;]+)/);
        if (match) {
            const type = match[1];
            if (type === 'FaultMarker') return 'Fault location';
            if (type.indexOf('Result') === 0 || type === 'FlowArrow' || type === 'NotEditableLine') {
                return '';
            }
            let name = '';
            try {
                name = cell.value && cell.value.getAttribute ? (cell.value.getAttribute('name') || '') : '';
            } catch (e) { /* ignore */ }
            const esc = (s) => (typeof mxUtils !== 'undefined' && mxUtils.htmlEntities)
                ? mxUtils.htmlEntities(String(s))
                : String(s);
            if (name) return esc(name) + ' (' + esc(type) + ')';
            return esc(type);
        }
        return typeof original === 'function' ? original.apply(this, arguments) : '';
    };
    GraphCtor.prototype._electrisimTooltipPatched = true;
}

function guardTooltipWhileDialogOpen(graph) {
    const th = graph?.tooltipHandler;
    if (!th || th._electrisimDialogGuard) return;
    const originalShow = th.show;
    th.show = function (text, x, y) {
        if (isElectrisimDialogOpen()) return;
        return originalShow.apply(this, arguments);
    };
    th._electrisimDialogGuard = true;
}

/**
 * Double left-click on a canvas element opens Edit Data (showDataDialog).
 * Uses graph.dblClick override plus a mouseDown double-click detector so thin
 * shapes (e.g. busbars) still work even if native shape dblclick is missing.
 */
function installDoubleClickEditData(retryCount) {
    const attempt = retryCount || 0;
    const ui = getEditorUi();
    if (!ui || !ui.editor || !ui.editor.graph) {
        if (attempt < 20) {
            setTimeout(() => installDoubleClickEditData(attempt + 1), 250);
        } else {
            console.warn('installDoubleClickEditData: EditorUi/graph not ready');
        }
        return;
    }
    if (ui._doubleClickEditDataInstalled) return;
    ui._doubleClickEditDataInstalled = true;

    const graph = ui.editor.graph;
    installElectricalCellTooltips();
    guardTooltipWhileDialogOpen(graph);
    const previousDblClick = graph.dblClick;
    const DOUBLE_MS = 400;
    const TOLERANCE = 12;
    let lastClick = { time: 0, cell: null, x: 0, y: 0, opened: false };

    graph.dblClick = function (evt, cell) {
        if (this.isEnabled() && cell != null) {
            if (openEditDataForCell(ui, this, cell, evt)) {
                lastClick.opened = true;
                return;
            }
        }
        if (typeof previousDblClick === 'function') {
            return previousDblClick.apply(this, arguments);
        }
    };

    // Fallback: detect quick left double-click via mouse listener (reliable for busbars)
    graph.addMouseListener({
        mouseDown: function (sender, me) {
            if (!graph.isEnabled() || me.isConsumed()) return;
            const evt = me.getEvent();
            if (mxEvent.isPopupTrigger(evt) || mxEvent.isRightMouseButton(evt) || mxEvent.isMiddleMouseButton(evt)) {
                return;
            }
            const cell = me.getCell();
            if (!cell) {
                lastClick = { time: 0, cell: null, x: 0, y: 0, opened: false };
                return;
            }
            const now = Date.now();
            const x = me.getGraphX();
            const y = me.getGraphY();
            const sameSpot = Math.abs(x - lastClick.x) <= TOLERANCE && Math.abs(y - lastClick.y) <= TOLERANCE;
            const sameOrRelated =
                lastClick.cell &&
                (cell === lastClick.cell ||
                    resolveEditableCell(cell) === resolveEditableCell(lastClick.cell));

            if (sameOrRelated && sameSpot && now - lastClick.time > 0 && now - lastClick.time <= DOUBLE_MS) {
                if (openEditDataForCell(ui, graph, cell, evt)) {
                    me.consume();
                    lastClick = { time: 0, cell: null, x: 0, y: 0, opened: true };
                    return;
                }
            }
            lastClick = { time: now, cell, x, y, opened: false };
        },
        mouseMove: function () {},
        mouseUp: function () {}
    });

    console.log('Double-click → Edit Data installed');
}

// Initialize all dialog overrides
function initializeDialogs() {
    try {
        installTransformerTerminalLabelOverlay();
        console.log('Initializing modern dialogs...');
        
        // Double-click handler is idempotent; keep trying even if dialog overrides
        // were already installed (e.g. late App ready / re-entry).
        installDoubleClickEditData();
        installElectricalCellTooltips();
        const liveUi = getEditorUi();
        if (liveUi?.editor?.graph) guardTooltipWhileDialogOpen(liveUi.editor.graph);

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
                hideMxGraphTooltip();
                console.log('showDataDialog called with cell:', cell);
                
                if (!cell) {
                    console.log('No cell provided, using root cell');
                    cell = this.editor.graph.getModel().getRoot();
                }
                
                // Force-clear any stuck flags before proceeding.
                // The actual duplicate-dialog prevention is handled inside
                // EditDataDialog / ComponentsDataDialog constructors.
                if (cell._dialogShowing) {
                    delete cell._dialogShowing;
                }
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
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
                    const componentsDialog = new ComponentsDataDialog(this, cell);
                    componentsDialog.show();
                    return;
                }

                const controlType = (cellStyle.match(/shapeELXXX=([^;]+)/) || [])[1];
                const controlDialogs = {
                    RegControl: RegControlDialog,
                    CapControl: CapControlDialog,
                    StorageController: StorageControllerDialog,
                    WindTurbineController: WindTurbineControllerDialog,
                    WindTurbineDynamicController: WindTurbineDynamicControllerDialog,
                    ParkController: ParkControllerDialog
                };
                if (controlDialogs[controlType]) {
                    const ControlDialog = controlDialogs[controlType];
                    const dialog = new ControlDialog(this);
                    dialog.populateDialog(cell.value);
                    dialog.show((values) => {
                        let value = cell.value;
                        if (!value || typeof value.setAttribute !== 'function') {
                            value = mxUtils.createXmlDocument().createElement('object');
                        }
                        Object.entries(values).forEach(([name, fieldValue]) => {
                            // Persist booleans as "true"/"false" for reliable XML round-trip
                            const stored =
                                typeof fieldValue === 'boolean' ? String(fieldValue) : fieldValue;
                            value.setAttribute(name, stored);
                        });
                        // Keep in-box text in sync for controllers that use object "label"
                        if (
                            (controlType === 'WindTurbineController' ||
                                controlType === 'WindTurbineDynamicController' ||
                                controlType === 'ParkController') &&
                            values.name != null
                        ) {
                            value.setAttribute('label', values.name);
                        }
                        this.editor.graph.getModel().setValue(cell, value);
                        this.editor.graph.refresh(cell);

                        // Steady-state Wind Turbine Controller: push Pref onto the linked turbine cell
                        if (controlType === 'WindTurbineController' && values.wind_turbine) {
                            try {
                                syncWindTurbineFromController(this.editor.graph, values);
                            } catch (e) {
                                console.warn('Wind Turbine Controller → turbine sync skipped:', e);
                            }
                        }
                    });
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
        installDoubleClickEditData();
        installElectricalCellTooltips();
        const liveUi = getEditorUi();
        if (liveUi?.editor?.graph) guardTooltipWhileDialogOpen(liveUi.editor.graph);
        if (window.EditorUi && !window.EditorUi.prototype._dialogOverridesInitialized) {
            console.log('Attempting to initialize dialogs on window load...');
            waitForApp(initializeDialogs);
        }
    }, 1000);
});

// Export for potential use in other modules
export { initializeDialogs, waitForApp, installDoubleClickEditData }; 