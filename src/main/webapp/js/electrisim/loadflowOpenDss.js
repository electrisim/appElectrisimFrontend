// Load Flow OpenDSS and Pandapower Dispatcher
// This file acts as a dispatcher for both OpenDSS and Pandapower load flow calculations



// Import helper functions from loadFlow.js
import { DIALOG_STYLES } from './utils/dialogStyles.js';
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';

// Helper function to format bus IDs consistently (replace # with _)
const formatBusId = (busId) => {
    if (!busId) return null;
    return busId.replace('#', '_');
};

// Helper functions for bus connections and cell processing
const getConnectedBusId = (cell, isLine = false) => {
    if (isLine) {                 
        // For lines, use the same approach as loadFlow.js
        // Access source and target directly from the cell (not through edges)
        return {            
            busFrom: formatBusId(cell.source?.mxObjectId),
            busTo: formatBusId(cell.target?.mxObjectId)
        };            
    }
    
    // For non-line elements (like generators, loads, etc.)
    const edge = cell.edges ? cell.edges[0] : null;
    if (!edge) {
        return null;
    }
    if (!edge.target && !edge.source) {
        return null;
    }
    const bus = edge.target && edge.target.mxObjectId !== cell.mxObjectId ?
        edge.target.mxObjectId : 
        edge.source.mxObjectId;
    return formatBusId(bus);
};

// Add helper function for transformer bus connections (same as loadFlow.js)
const getTransformerConnections = (cell) => {
    if (cell.edges && cell.edges.length >= 2) {
        const hvEdge = cell.edges[0];
        const lvEdge = cell.edges[1];

        return {
            busFrom: formatBusId(hvEdge.target && hvEdge.target.mxObjectId !== cell.mxObjectId ?
                hvEdge.target.mxObjectId : 
                hvEdge.source.mxObjectId),
            busTo: formatBusId(lvEdge.target && lvEdge.target.mxObjectId !== cell.mxObjectId ?
                lvEdge.target.mxObjectId : 
                lvEdge.source.mxObjectId)
        };
    }
    
    // Fallback for single edge transformers
    if (cell.edges && cell.edges.length === 1) {
        const edge = cell.edges[0];
        if (edge.source && edge.target) {
            const sourceId = edge.source.mxObjectId;
            const targetId = edge.target.mxObjectId;
            
            return {            
                busFrom: formatBusId(sourceId),
                busTo: formatBusId(targetId)
            };
        }
    }
    
    return {            
        busFrom: null,
        busTo: null
    };
};

const parseCellStyle = (style) => {
    if (!style) return null;
    const pairs = style.split(';').map(pair => pair.split('='));
    return Object.fromEntries(pairs);
};

const getAttributesAsObject = (cell, attributeMap) => {
    const result = {};
    if (!cell || !cell.value || !cell.value.attributes) {
        console.warn('Cell is missing required properties');
        return result;
    }
    const attributes = cell.value.attributes;
    for (const [key, config] of Object.entries(attributeMap)) {
        const isOptional = typeof config === 'object' && config.optional;
        const attributeName = typeof config === 'object' ? config.name : config;
        let found = false;
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].nodeName === attributeName) {
                result[key] = attributes[i].nodeValue;
                found = true;
                break;
            }
        }
        if (!found && !isOptional) {
            console.warn(`Missing required attribute ${key} with name ${attributeName}`);
            result[key] = null;
        }
    }
    return result;
};

const getConnectedBuses = (cell) => {
    return {
        busFrom: formatBusId(cell.source?.mxObjectId),
        busTo: formatBusId(cell.target?.mxObjectId)
    };
};

const validateBusConnections = (cell) => {
    if (!cell.source?.mxObjectId) {
        throw new Error(`Error: cell.source.mxObjectId is null or undefined`);
    }
    if (!cell.target?.mxObjectId) {
        throw new Error(`Error: cell.target.mxObjectId is null or undefined`);
    }
};

// Component type constants
const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    STATIC_GENERATOR: 'Static Generator',
    ASYMMETRIC_STATIC_GENERATOR: 'Asymmetric Static Generator',
    BUS: 'Bus',
    TRANSFORMER: 'Transformer',
    THREE_WINDING_TRANSFORMER: 'Three Winding Transformer',
    SHUNT_REACTOR: 'Shunt Reactor',
    CAPACITOR: 'Capacitor',
    LOAD: 'Load',
    ASYMMETRIC_LOAD: 'Asymmetric Load',
    IMPEDANCE: 'Impedance',
    WARD: 'Ward',
    EXTENDED_WARD: 'Extended Ward',
    MOTOR: 'Motor',
    STORAGE: 'Storage',
    SVC: 'SVC',
    TCSC: 'TCSC',
    SSC: 'SSC',
    DC_LINE: 'DC Line',
    LINE: 'Line'
};

function loadFlowOpenDss(a, b, c) {
    //a - App
    //b - Graph
    //c - Editor

    let apka = a
    let grafka = b


    if (window.LoadFlowDialog && window.LoadFlowDialog.prototype && window.LoadFlowDialog.prototype.createTabHeader && typeof a.showLoadFlowDialog === 'function') {
        console.log('✓ Using new tabbed dialog');
        // Use the new tabbed dialog
        b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialog("", "Calculate", function (values) {
            console.log('New tabbed LoadFlowDialog callback received:', values);
            
            // Check which engine was selected
            if (values.engine === 'opendss') {
                // OpenDSS calculation
                executeOpenDSSLoadFlow(values, apka, grafka);
            } else {
                // Pandapower calculation - execute directly with collected parameters
                console.log('Processing Pandapower calculation with values:', values);
                
                // Convert the values object to the array format expected by pandapower
                const pandapowerParams = [
                    values.frequency || '50',
                    values.algorithm || 'nr',
                    values.calculate_voltage_angles || 'auto',
                    values.initialization || 'auto'
                ];
                
                console.log('Converted to pandapower params array:', pandapowerParams);
                
                // Execute pandapower load flow directly
                executePandapowerLoadFlow(pandapowerParams, apka, grafka);
            }
        });
    } else {
        console.log('✗ Falling back to direct dialog creation');
        
        // Check if we can create the dialog directly
        if (window.LoadFlowDialog) {
            console.log('Creating LoadFlowDialog directly...');
            try {
                const dialog = new window.LoadFlowDialog(a);
                dialog.show(function (values) {
                    console.log('Direct LoadFlowDialog callback received:', values);
                    
                    // Check which engine was selected
                    if (values.engine === 'opendss') {
                        // OpenDSS calculation
                        executeOpenDSSLoadFlow(values, apka, grafka);
                    } else {
                        // Pandapower calculation - execute directly with collected parameters
                        console.log('Processing Pandapower calculation with values:', values);
                        
                        // Convert the values object to the array format expected by pandapower
                        const pandapowerParams = [
                            values.frequency || '50',
                            values.algorithm || 'nr',
                            values.calculate_voltage_angles || 'auto',
                            values.initialization || 'auto'
                        ];
                        
                        console.log('Converted to pandapower params array:', pandapowerParams);
                        
                        // Execute pandapower load flow directly
                        executePandapowerLoadFlow(pandapowerParams, apka, grafka);
                    }
                });
            } catch (error) {
                console.error('Error creating LoadFlowDialog directly:', error);
                // Final fallback to OpenDSS dialog if available
                if (typeof a.showLoadFlowDialogOpenDSS === 'function') {
                    console.log('Final fallback to OpenDSS dialog');
                    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialogOpenDSS("", "Calculate", function (a, c) {
                        console.log('Legacy OpenDSS dialog callback received');
                        executeOpenDSSLoadFlow(a, apka, grafka);
                    });
                } else {
                    alert('Load Flow dialog is not available. Please refresh the page and try again.');
                }
            }
        } else {
            console.log('LoadFlowDialog not available, checking for OpenDSS dialog...');
            // Final fallback to OpenDSS dialog if available
            if (typeof a.showLoadFlowDialogOpenDSS === 'function') {
                console.log('Using OpenDSS dialog as fallback');
                b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialogOpenDSS("", "Calculate", function (a, c) {
                    console.log('Legacy OpenDSS dialog callback received');
                    executeOpenDSSLoadFlow(a, apka, grafka);
                });
            } else {
                console.error('No dialog available');
                alert('Load Flow dialog is not available. Please refresh the page and try again.');
            }
        }
    }
}

// Element processors for OpenDSS (FROM BACKEND TO FRONTEND)
// Updated to handle simplified backend response without output classes
const elementProcessors = {
    busbars: (data, b, grafka) => {
        if (!Array.isArray(data)) {
            console.warn('busbars data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        U[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}
        U[degree]: ${cell.va_degree ? cell.va_degree.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
                processVoltageColor(grafka, resultCell, cell.vm_pu);
            } catch (error) {
                console.error(`Error processing busbar ${cell.id}:`, error);
            }
        });
    },

    lines: (data, b, grafka) => {
        if (!Array.isArray(data)) {
            console.warn('lines data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';

                const resultString = `${cellName}
        P_from[MW]: ${cell.p_from_mw ? cell.p_from_mw.toFixed(3) : 'N/A'}
        Q_from[MVar]: ${cell.q_from_mvar ? cell.q_from_mvar.toFixed(3) : 'N/A'}
        i_from[kA]: ${cell.i_from_ka ? cell.i_from_ka.toFixed(3) : 'N/A'}

        Loading[%]: ${cell.loading_percent ? cell.loading_percent.toFixed(1) : 'N/A'}

        P_to[MW]: ${cell.p_to_mw ? cell.p_to_mw.toFixed(3) : 'N/A'}
        Q_to[MVar]: ${cell.q_to_mvar ? cell.q_to_mvar.toFixed(3) : 'N/A'}
        i_to[kA]: ${cell.i_to_ka ? cell.i_to_ka.toFixed(3) : 'N/A'}`;

                const labelka = b.insertEdge(resultCell, null, resultString, resultCell.source, resultCell.target, 'shapeELXXX=Result');
                processCellStyles(b, labelka, true);
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            } catch (error) {
                console.error(`Error processing line ${cell.id}:`, error);
            }
        });
    },

    externalgrids: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('externalgrids data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        PF: ${cell.pf ? cell.pf.toFixed(3) : 'N/A'}
        Q/P: ${cell.q_p ? cell.q_p.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing external grid ${cell.id}:`, error);
            }
        });
    },

    generators: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('generators data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        U[degree]: ${cell.va_degree ? cell.va_degree.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing generator ${cell.id}:`, error);
            }
        });
    },

    loads: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('loads data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing load ${cell.id}:`, error);
            }
        });
    },

    transformers: (data, b, grafka) => {
        if (!Array.isArray(data)) {
            console.warn('transformers data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        i_HV[kA]: ${cell.i_hv_ka ? cell.i_hv_ka.toFixed(3) : 'N/A'}
        i_LV[kA]: ${cell.i_lv_ka ? cell.i_lv_ka.toFixed(3) : 'N/A'}
        loading[%]: ${cell.loading_percent ? cell.loading_percent.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            } catch (error) {
                console.error(`Error processing transformer ${cell.id}:`, error);
            }
        });
    },

    // Add support for additional element types that might be returned by the simplified backend
    shunts: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('shunts data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing shunt ${cell.id}:`, error);
            }
        });
    },

    capacitors: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('capacitors data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing capacitor ${cell.id}:`, error);
            }
        });
    },

    storages: (data, b) => {
        if (!Array.isArray(data)) {
            console.warn('storages data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                // Find cell by mxObjectId instead of internal ID
                let resultCell = null;
                const cells = b.getModel().cells;
                
                // Search through all cells to find the one with matching mxObjectId
                for (const cellId in cells) {
                    const graphCell = cells[cellId];
                    if (graphCell && graphCell.mxObjectId === cell.id) {
                        resultCell = graphCell;
                        break;
                    }
                }
                
                if (!resultCell) {
                    console.warn(`Could not find cell with mxObjectId: ${cell.id}`);
                    console.log('Available cells:', Object.keys(cells).map(id => ({ id, mxObjectId: cells[id]?.mxObjectId })));
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            } catch (error) {
                console.error(`Error processing storage ${cell.id}:`, error);
            }
        });
    }
};

// Helper functions for styling and color processing
const STYLES = {
    label: {
        [mxConstants.STYLE_FONTSIZE]: '6',
        [mxConstants.STYLE_ALIGN]: 'ALIGN_LEFT'
    },
    line: {
        [mxConstants.STYLE_FONTSIZE]: '6',
        [mxConstants.STYLE_STROKE_OPACITY]: '0',
        [mxConstants.STYLE_STROKECOLOR]: 'white',
        [mxConstants.STYLE_STROKEWIDTH]: '0',
        [mxConstants.STYLE_OVERFLOW]: 'hidden'
    }
};

const COLOR_STATES = {
    DANGER: 'red',
    WARNING: 'orange',
    GOOD: 'green'
};

function processCellStyles(b, labelka, isEdge = false) {
    if (isEdge) {
        Object.entries(STYLES.line).forEach(([style, value]) => {
            b.setCellStyles(style, value, [labelka]);
        });
        b.orderCells(true, [labelka]);
    } else {
        Object.entries(STYLES.label).forEach(([style, value]) => {
            b.setCellStyles(style, value, [labelka]);
        });
    }
}

function processVoltageColor(grafka, cell, vmPu) {
    if (!vmPu) return;
    const voltage = parseFloat(vmPu.toFixed(2));
    let color = null;

    if (voltage >= 1.1 || voltage <= 0.9) color = COLOR_STATES.DANGER;
    else if ((voltage > 1.05 && voltage <= 1.1) || (voltage > 0.9 && voltage <= 0.95)) color = COLOR_STATES.WARNING;
    else if ((voltage > 1 && voltage <= 1.05) || (voltage > 0.95 && voltage <= 1)) color = COLOR_STATES.GOOD;

    if (color) updateCellColor(grafka, cell, color);
}

function processLoadingColor(grafka, cell, loadingPercent) {
    if (!loadingPercent) return;
    const loading = parseFloat(loadingPercent.toFixed(1));
    let color = null;

    if (loading > 100) color = COLOR_STATES.DANGER;
    else if (loading > 80) color = COLOR_STATES.WARNING;
    else if (loading > 0) color = COLOR_STATES.GOOD;

    if (color) updateCellColor(grafka, cell, color);
}

function updateCellColor(grafka, cell, color) {
    const style = grafka.getModel().getStyle(cell);
    const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
    grafka.setCellStyle(newStyle, [cell]);
}

// Main processing function for OpenDSS (FROM BACKEND TO FRONTEND)
// Updated to handle simplified backend response without output classes
async function processNetworkData(url, obj, b, grafka) {
    try {
        // Initialize styles once
        b.getStylesheet().putCellStyle('labelstyle', STYLES.label);
        b.getStylesheet().putCellStyle('lineStyle', STYLES.line);

        // Convert array to dictionary format that backend expects (OpenDSS specific)
        const dataDict = {};
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                dataDict[index.toString()] = item;
            });
        } else {
            dataDict["0"] = obj;
        }
        
        console.log('Sending to OpenDSS backend:', dataDict);

        const response = await fetch(url, {
            mode: "cors",
            method: "post",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(dataDict) // Backend expects dict with string keys like {"0": {...}}
        });

        if (response.status !== 200) {
            throw new Error("server");
        }

        const dataJson = await response.json();
        console.log('OpenDSS backend response:', dataJson);

        // Handle errors first
        if (handleNetworkErrors(dataJson)) {
            return;
        }

        // The simplified backend now returns data directly without output classes
        // Process each type of network element that might be present in the response
        console.log('Processing OpenDSS results...');
        
        // Check for different possible response formats
        let processedCount = 0;
        
        // Process busbars if present
        if (dataJson.busbars && Array.isArray(dataJson.busbars)) {
            console.log(`Processing ${dataJson.busbars.length} busbars`);
            elementProcessors.busbars(dataJson.busbars, b, grafka);
            processedCount += dataJson.busbars.length;
        }
        
        // Process lines if present
        if (dataJson.lines && Array.isArray(dataJson.lines)) {
            console.log(`Processing ${dataJson.lines.length} lines`);
            elementProcessors.lines(dataJson.lines, b, grafka);
            processedCount += dataJson.lines.length;
        }
        
        // Process loads if present
        if (dataJson.loads && Array.isArray(dataJson.loads)) {
            console.log(`Processing ${dataJson.loads.length} loads`);
            elementProcessors.loads(dataJson.loads, b);
            processedCount += dataJson.loads.length;
        }
        
        // Process generators if present
        if (dataJson.generators && Array.isArray(dataJson.generators)) {
            console.log(`Processing ${dataJson.generators.length} generators`);
            elementProcessors.generators(dataJson.generators, b);
            processedCount += dataJson.generators.length;
        }
        
        // Process transformers if present
        if (dataJson.transformers && Array.isArray(dataJson.transformers)) {
            console.log(`Processing ${dataJson.transformers.length} transformers`);
            elementProcessors.transformers(dataJson.transformers, b, grafka);
            processedCount += dataJson.transformers.length;
        }
        
        // Process external grids if present
        if (dataJson.externalgrids && Array.isArray(dataJson.externalgrids)) {
            console.log(`Processing ${dataJson.externalgrids.length} external grids`);
            elementProcessors.externalgrids(dataJson.externalgrids, b);
            processedCount += dataJson.externalgrids.length;
        }
        
        // Process shunts if present
        if (dataJson.shunts && Array.isArray(dataJson.shunts)) {
            console.log(`Processing ${dataJson.shunts.length} shunts`);
            elementProcessors.shunts(dataJson.shunts, b);
            processedCount += dataJson.shunts.length;
        }
        
        // Process capacitors if present
        if (dataJson.capacitors && Array.isArray(dataJson.capacitors)) {
            console.log(`Processing ${dataJson.capacitors.length} capacitors`);
            elementProcessors.capacitors(dataJson.capacitors, b);
            processedCount += dataJson.capacitors.length;
        }
        
        // Process storages if present
        if (dataJson.storages && Array.isArray(dataJson.storages)) {
            console.log(`Processing ${dataJson.storages.length} storages`);
            elementProcessors.storages(dataJson.storages, b);
            processedCount += dataJson.storages.length;
        }
        
        // Check if we processed any results
        if (processedCount === 0) {
            console.warn('No results were processed from the OpenDSS backend response');
            console.log('Available keys in response:', Object.keys(dataJson));
            
            // Try to show a success message even if no results
            alert('OpenDSS calculation completed successfully, but no results were returned to display.');
        } else {
            console.log(`Successfully processed ${processedCount} OpenDSS results`);
            alert(`OpenDSS calculation completed successfully! Processed ${processedCount} results.`);
        }

    } catch (err) {
        if (err.message === "server") return;
        console.error('Error processing OpenDSS network data:', err);
        alert('Error processing OpenDSS network data: ' + err + '\n\nCheck input data or contact electrisim@electrisim.com');
    } finally {
        if (typeof window.App !== 'undefined' && window.App.spinner) {
            window.App.spinner.stop();
        }
    }
}

// Error handler for OpenDSS
function handleNetworkErrors(dataJson) {
    if (dataJson.error) {
        alert('OpenDSS calculation error: ' + dataJson.error);
        return true;
    }
    return false;
}

// Function to execute OpenDSS load flow calculation
function executeOpenDSSLoadFlow(parameters, app, graph) {


    // Show spinner
    app.spinner.spin(document.body, "Waiting for OpenDSS results...");
    
    // Handle both old array format and new object format
    let opendssParams;
    if (Array.isArray(parameters)) {
        // Old format: array of parameters
        opendssParams = parameters;
    } else {
        // New format: object with named properties
        opendssParams = [
            parameters.frequency || '50',
            parameters.algorithm || 'nr',
            parameters.maxIterations || '100',
            parameters.tolerance || '0.0001',
            parameters.convergence || 'normal',
            parameters.voltageControl || 'off',
            parameters.tapControl || 'off'
        ];
    }
    
    console.log('OpenDSS parameters (converted to array):', opendssParams);
    
    // Get current user email
    function getUserEmail() {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && user.email) {
                    return user.email;
                }
            }
            return 'unknown@user.com';
        } catch (error) {
            return 'unknown@user.com';
        }
    }
    
    const userEmail = getUserEmail();
    console.log('OpenDSS - User email:', userEmail);
    
    // Create the data structure for OpenDSS
    const opendssData = {
        typ: "PowerFlowOpenDss Parameters",
        frequency: opendssParams[0],
        algorithm: opendssParams[1],
        maxIterations: opendssParams[2],
        tolerance: opendssParams[3],
        convergence: opendssParams[4],
        voltageControl: opendssParams[5],
        tapControl: opendssParams[6],
        user_email: userEmail
    };
    
    console.log('OpenDSS data object:', opendssData);
    
    // Collect network model data from the graph using the new structure
    let networkData = collectNetworkDataStructured(graph);
    console.log('Network data collected:', networkData);

    // If no network data collected, try using global graph
    if (networkData.length === 0 && window.App && window.App.editor && window.App.editor.graph) {
        console.log('Trying global graph as fallback...');
        networkData = collectNetworkDataStructured(window.App.editor.graph);
        console.log('Global graph network data:', networkData);
    }

    // Combine parameters with network data
    const completeData = [opendssData, ...networkData];
    console.log('Complete OpenDSS data:', completeData);
    
    // Call the new processNetworkData function
    processNetworkData("https://03dht3kc-5000.euw.devtunnels.ms/", completeData, graph, graph);
}

// Function to collect network data from the graph using the new structured approach
function collectNetworkDataStructured(graph) {
    const networkData = [];
    let index = 1; // Start from 1 since 0 is parameters    

    
    // Try different ways to access graph data
    let cells = null;
    
    // Method 1: Try getModel().cells
    if (graph && graph.getModel && graph.getModel().cells) {
        cells = graph.getModel().cells;
        console.log('Method 1 - getModel().cells:', cells);
    }
    
    // Method 2: Try getModel().getChildCells()
    if (!cells && graph && graph.getModel && graph.getModel().getChildCells) {
        try {
            cells = graph.getModel().getChildCells(graph.getDefaultParent());
            console.log('Method 2 - getChildCells():', cells);
        } catch (e) {
            console.log('Method 2 failed:', e);
        }
    }
    
    // Method 3: Try getSelectionCells() to see what's selected
    if (!cells && graph && graph.getSelectionCells) {
        try {
            cells = graph.getSelectionCells();
            console.log('Method 3 - getSelectionCells():', cells);
        } catch (e) {
            console.log('Method 3 failed:', e);
        }
    }
    
    // Method 4: Try getAllCells() if available
    if (!cells && graph && graph.getAllCells) {
        try {
            cells = graph.getAllCells();
            console.log('Method 4 - getAllCells():', cells);
        } catch (e) {
            console.log('Method 4 failed:', e);
        }
    }
    
    if (!cells) {
        console.error('Could not access graph cells data');
        return networkData;
    }
    
    // Process the cells using the proper structured approach similar to loadFlow.js
    for (const cellId in cells) {
        const cell = cells[cellId];
        if (cell && cell.value) {
            const cellValue = cell.value;
            let cellData = null;
            
            // Check if this is a bus element by looking at the cell style
            const style = cell.getStyle();
            if (style) {
                const styleObj = parseCellStyle(style);
                if (styleObj && styleObj.shapeELXXX === 'Bus') {
                    // This is a bus element - collect it properly
                    cellData = {
                        typ: `Bus${index - 1}`, // Start from Bus0
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        vn_kv: getBusVoltage(cellValue),
                        userFriendlyName: "Bus"
                    };
                    index++;
                } else if (styleObj && styleObj.shapeELXXX === 'Line') {
                    // This is a line element - collect all necessary parameters like loadFlow.js
                    const connections = getConnectedBusId(cell, true);
                    
                    // Get line parameters from attributes
                    const lineParams = getAttributesAsObject(cell, {
                        // Basic parameters
                        length_km: 'length_km',
                        parallel: 'parallel',
                        df: 'df',

                        // Load flow parameters
                        r_ohm_per_km: 'r_ohm_per_km',
                        x_ohm_per_km: 'x_ohm_per_km',
                        c_nf_per_km: 'c_nf_per_km',
                        g_us_per_km: 'g_us_per_km',
                        max_i_ka: 'max_i_ka',
                        type: 'type',

                        // Short circuit parameters
                        r0_ohm_per_km: { name: 'r0_ohm_per_km', optional: true },
                        x0_ohm_per_km: { name: 'x0_ohm_per_km', optional: true },
                        c0_nf_per_km: { name: 'c0_nf_per_km', optional: true },
                        endtemp_degree: { name: 'endtemp_degree', optional: true },
                    });
                    
                    // Provide default values for critical Line parameters if they're missing
                    cellData = {
                        typ: 'Line',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        busFrom: connections?.busFrom,
                        busTo: connections?.busTo,
                        // Use extracted parameters or defaults for critical values
                        r_ohm_per_km: lineParams.r_ohm_per_km || 0.122,  // Default resistance
                        x_ohm_per_km: lineParams.x_ohm_per_km || 0.112,  // Default reactance
                        length_km: lineParams.length_km || 1.0,          // Default length
                        c_nf_per_km: lineParams.c_nf_per_km || 304,     // Default capacitance
                        // Optional parameters
                        parallel: lineParams.parallel || 1,
                        df: lineParams.df || 1.0,
                        g_us_per_km: lineParams.g_us_per_km || 0,
                        max_i_ka: lineParams.max_i_ka || 1.0,
                        type: lineParams.type || 'OH',
                        r0_ohm_per_km: lineParams.r0_ohm_per_km || 0,
                        x0_ohm_per_km: lineParams.x0_ohm_per_km || 0,
                        c0_nf_per_km: lineParams.c0_nf_per_km || 0,
                        endtemp_degree: lineParams.endtemp_degree || 20
                    };
                    
                    // Validate bus connections
                    if (cellData.busFrom && cellData.busTo) {
                        console.log(`Line ${cellData.name}: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                        console.log(`Line parameters: R1=${cellData.r_ohm_per_km}, X1=${cellData.x_ohm_per_km}, Length=${cellData.length_km}km`);
                    } else {
                        console.warn(`Line ${cellData.name} missing bus connections: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Transformer') {
                    // This is a transformer element
                    const connections = getTransformerConnections(cell);
                    
                    const transParams = getAttributesAsObject(cell, {
                        // Basic transformer parameters
                        sn_mva: 'sn_mva',
                        vn_hv_kv: 'vn_hv_kv',
                        vn_lv_kv: 'vn_lv_kv',
                        vk_percent: 'vk_percent',
                        vkr_percent: 'vkr_percent',
                        pfe_kw: 'pfe_kw',
                        i0_percent: 'i0_percent',
                        shift_degree: 'shift_degree',
                        tap_side: 'tap_side',
                        tap_neutral: 'tap_neutral',
                        tap_min: 'tap_min',
                        tap_max: 'tap_max',
                        tap_step_percent: 'tap_step_percent',
                        tap_step_degree: 'tap_step_degree',
                        tap_pos: 'tap_pos',
                        tap_phase_shifter: 'tap_phase_shifter'
                    });
                    
                    cellData = {
                        typ: 'Transformer',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        busFrom: connections?.busFrom,
                        busTo: connections?.busTo,
                        // Use extracted parameters or defaults for critical values
                        sn_mva: transParams.sn_mva || 1.0,        // Default power rating
                        vk_percent: transParams.vk_percent || 7.0, // Default impedance
                        vkr_percent: transParams.vkr_percent || 0.5, // Default resistance
                        // Other parameters
                        vn_hv_kv: transParams.vn_hv_kv || 110.0,
                        vn_lv_kv: transParams.vn_lv_kv || 20.0,
                        pfe_kw: transParams.pfe_kw || 0.0,
                        i0_percent: transParams.i0_percent || 0.0,
                        shift_degree: transParams.shift_degree || 0.0,
                        tap_side: transParams.tap_side || 'hv',
                        tap_neutral: transParams.tap_neutral || 1.0,
                        tap_min: transParams.tap_min || 0.9,
                        tap_max: transParams.tap_max || 1.1,
                        tap_step_percent: transParams.tap_step_percent || 1.25,
                        tap_step_degree: transParams.tap_step_degree || 0.0,
                        tap_pos: transParams.tap_pos || 1.0,
                        tap_phase_shifter: transParams.tap_phase_shifter || false
                    };
                    
                    // Validate bus connections
                    if (cellData.busFrom && cellData.busTo) {
                        console.log(`Transformer ${cellData.name}: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    } else {
                        console.warn(`Transformer ${cellData.name} missing bus connections: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Generator') {
                    // This is a generator element
                    const genParams = getAttributesAsObject(cell, {
                        // Basic generator parameters
                        p_mw: 'p_mw',
                        vm_pu: 'vm_pu',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        vn_kv: 'vn_kv',
                        xdss_pu: 'xdss_pu',
                        rdss_ohm: 'rdss_ohm',
                        cos_phi: 'cos_phi',
                        pg_percent: 'pg_percent',
                        power_station_trafo: 'power_station_trafo',
                        // Additional parameters
                        q_mvar: 'q_mvar',
                        va_degree: 'va_degree',
                        max_p_mw: 'max_p_mw',
                        min_p_mw: 'min_p_mw',
                        max_q_mvar: 'max_q_mvar',
                        min_q_mvar: 'min_q_mvar'
                    });
                    
                    cellData = {
                        typ: 'Generator',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_mw: genParams.p_mw || 10.0,      // Default power
                        q_mvar: genParams.q_mvar || 0.0,   // Default reactive power
                        vm_pu: genParams.vm_pu || 1.0,     // Default voltage
                        // Other parameters
                        sn_mva: genParams.sn_mva || 10.0,
                        scaling: genParams.scaling || 1.0,
                        vn_kv: genParams.vn_kv || 20.0,
                        xdss_pu: genParams.xdss_pu || 0.2,
                        rdss_ohm: genParams.rdss_ohm || 0.0,
                        cos_phi: genParams.cos_phi || 0.9,
                        pg_percent: genParams.pg_percent || 100.0,
                        power_station_trafo: genParams.power_station_trafo || false,
                        va_degree: genParams.va_degree || 0.0,
                        max_p_mw: genParams.max_p_mw || 10.0,
                        min_p_mw: genParams.min_p_mw || 0.0,
                        max_q_mvar: genParams.max_q_mvar || 5.0,
                        min_q_mvar: genParams.min_q_mvar || -5.0
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Generator ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Generator ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Load') {
                    // This is a load element
                    const loadParams = getAttributesAsObject(cell, {
                        // Basic load parameters
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        const_p_percent: 'const_p_percent',
                        const_q_percent: 'const_q_percent',
                        const_i_percent: 'const_i_percent',
                        const_z_percent: 'const_z_percent',
                        const_y_percent: 'const_y_percent',
                        const_s_percent: 'const_s_percent',
                        const_s_percent_abs: 'const_s_percent_abs',
                        const_s_percent_abs_degree: 'const_s_percent_abs_degree',
                        const_s_percent_abs_degree_abs: 'const_s_percent_abs_degree_abs',
                        const_s_percent_abs_degree_abs_degree: 'const_s_percent_abs_degree_abs_degree'
                    });
                    
                    cellData = {
                        typ: 'Load',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_mw: loadParams.p_mw || 1.0,      // Default power
                        q_mvar: loadParams.q_mvar || 0.0,   // Default reactive power
                        // Other parameters
                        sn_mva: loadParams.sn_mva || 1.0,
                        scaling: loadParams.scaling || 1.0,
                        type: loadParams.type || 'const_p',
                        const_p_percent: loadParams.const_p_percent || 100.0,
                        const_q_percent: loadParams.const_q_percent || 100.0,
                        const_i_percent: loadParams.const_i_percent || 100.0,
                        const_z_percent: loadParams.const_z_percent || 100.0,
                        const_y_percent: loadParams.const_y_percent || 100.0,
                        const_s_percent: loadParams.const_s_percent || 100.0,
                        const_s_percent_abs: loadParams.const_s_percent_abs || 100.0,
                        const_s_percent_abs_degree: loadParams.const_s_percent_abs_degree || 0.0,
                        const_s_percent_abs_degree_abs: loadParams.const_s_percent_abs_degree_abs || 100.0,
                        const_s_percent_abs_degree_abs_degree: loadParams.const_s_percent_abs_degree_abs_degree || 0.0
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Load ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Load ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Shunt Reactor') {
                    // This is a shunt reactor element
                    const shuntParams = getAttributesAsObject(cell, {
                        // Basic shunt reactor parameters
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        step: 'step',
                        step_degree: 'step_degree',
                        step_min: 'step_min',
                        step_max: 'step_max',
                        step_pos: 'step_pos',
                        step_phase_shifter: 'step_phase_shifter'
                    });
                    
                    cellData = {
                        typ: 'Shunt Reactor',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        q_mvar: shuntParams.q_mvar || 1.0,      // Default reactive power
                        // Other parameters
                        sn_mva: shuntParams.sn_mva || 1.0,
                        scaling: shuntParams.scaling || 1.0,
                        type: shuntParams.type || 'const_q',
                        step: shuntParams.step || 1.0,
                        step_degree: shuntParams.step_degree || 0.0,
                        step_min: shuntParams.step_min || 0.0,
                        step_max: shuntParams.step_max || 1.0,
                        step_pos: shuntParams.step_pos || 1.0,
                        step_phase_shifter: shuntParams.step_phase_shifter || false
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Shunt Reactor ${cellData.name}: bus=${cellData.bus}, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Shunt Reactor ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Capacitor') {
                    // This is a capacitor element
                    const capParams = getAttributesAsObject(cell, {
                        // Basic capacitor parameters
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        step: 'step',
                        step_degree: 'step_degree',
                        step_min: 'step_min',
                        step_max: 'step_max',
                        step_pos: 'step_pos',
                        step_phase_shifter: 'step_phase_shifter'
                    });
                    
                    cellData = {
                        typ: 'Capacitor',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        q_mvar: capParams.q_mvar || 1.0,      // Default reactive power
                        // Other parameters
                        sn_mva: capParams.sn_mva || 1.0,
                        scaling: capParams.scaling || 1.0,
                        type: capParams.type || 'const_q',
                        step: capParams.step || 1.0,
                        step_degree: capParams.step_degree || 0.0,
                        step_min: capParams.step_min || 0.0,
                        step_max: capParams.step_max || 1.0,
                        step_pos: capParams.step_pos || 1.0,
                        step_phase_shifter: capParams.step_phase_shifter || false
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Capacitor ${cellData.name}: bus=${cellData.bus}, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Capacitor ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Storage') {
                    // This is a storage element
                    const storageParams = getAttributesAsObject(cell, {
                        // Basic storage parameters
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        max_e_mwh: 'max_e_mwh',
                        max_p_mw: 'max_p_mw',
                        min_p_mw: 'min_p_mw',
                        max_q_mvar: 'max_q_mvar',
                        min_q_mvar: 'min_q_mvar',
                        soc_percent: 'soc_percent',
                        min_e_mwh: 'min_e_mwh'
                    });
                    
                    cellData = {
                        typ: 'Storage',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_mw: storageParams.p_mw || 0.0,      // Default power
                        q_mvar: storageParams.q_mvar || 0.0,  // Default reactive power
                        // Other parameters
                        sn_mva: storageParams.sn_mva || 1.0,
                        scaling: storageParams.scaling || 1.0,
                        type: storageParams.type || 'storage',
                        max_e_mwh: storageParams.max_e_mwh || 1.0,
                        max_p_mw: storageParams.max_p_mw || 1.0,
                        min_p_mw: storageParams.min_p_mw || -1.0,
                        max_q_mvar: storageParams.max_q_mvar || 1.0,
                        min_q_mvar: storageParams.min_q_mvar || -1.0,
                        soc_percent: storageParams.soc_percent || 50.0,
                        min_e_mwh: storageParams.min_e_mwh || 0.0
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Storage ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Storage ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'External Grid') {
                    // This is an external grid element
                    const extGridParams = getAttributesAsObject(cell, {
                        // Basic external grid parameters
                        vm_pu: 'vm_pu',
                        va_degree: 'va_degree',
                        s_sc_max_mva: 's_sc_max_mva',
                        s_sc_min_mva: 's_sc_min_mva',
                        rx_max: 'rx_max',
                        rx_min: 'rx_min',
                        r0x0_max: 'r0x0_max',
                        x0x_max: 'x0x_max'
                    });
                    
                    cellData = {
                        typ: 'External Grid',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        vm_pu: extGridParams.vm_pu || 1.0,      // Default voltage
                        va_degree: extGridParams.va_degree || 0.0, // Default angle
                        // Other parameters
                        s_sc_max_mva: extGridParams.s_sc_max_mva || 1000.0,
                        s_sc_min_mva: extGridParams.s_sc_min_mva || 1000.0,
                        rx_max: extGridParams.rx_max || 0.1,
                        rx_min: extGridParams.rx_min || 0.1,
                        r0x0_max: extGridParams.r0x0_max || 0.1,
                        x0x_max: extGridParams.x0x_max || 1.0
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`External Grid ${cellData.name}: bus=${cellData.bus}, vm_pu=${cellData.vm_pu}, va_degree=${cellData.va_degree}`);
                    } else {
                        console.warn(`External Grid ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Three Winding Transformer') {
                    // This is a three winding transformer element
                    const connections = getTransformerConnections(cell);
                    
                    cellData = {
                        typ: 'Three Winding Transformer',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        busFrom: connections?.busFrom,
                        busTo: connections?.busTo,
                        // Add three winding transformer parameters
                        ...getAttributesAsObject(cell, {
                            sn_hv_mva: 'sn_hv_mva',
                            sn_mv_mva: 'sn_mv_mva',
                            sn_lv_mva: 'sn_lv_mva',
                            vn_hv_kv: 'vn_hv_kv',
                            vn_mv_kv: 'vn_mv_kv',
                            vn_lv_kv: 'vn_lv_kv',
                            vk_hv_percent: 'vk_hv_percent',
                            vk_mv_percent: 'vk_mv_percent',
                            vk_lv_percent: 'vk_lv_percent',
                            vkr_hv_percent: 'vkr_hv_percent',
                            vkr_mv_percent: 'vkr_mv_percent',
                            vkr_lv_percent: 'vkr_lv_percent',
                            pfe_kw: 'pfe_kw',
                            i0_percent: 'i0_percent',
                            shift_hv_degree: 'shift_hv_degree',
                            shift_mv_degree: 'shift_mv_degree',
                            shift_lv_degree: 'shift_lv_degree'
                        })
                    };
                    
                    // Validate bus connections
                    if (cellData.busFrom && cellData.busTo) {
                        console.log(`Three Winding Transformer ${cellData.name}: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    } else {
                        console.warn(`Three Winding Transformer ${cellData.name} missing bus connections: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Impedance') {
                    // This is an impedance element
                    cellData = {
                        typ: 'Impedance',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Add impedance parameters
                        ...getAttributesAsObject(cell, {
                            r_ohm: 'r_ohm',
                            x_ohm: 'x_ohm',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type'
                        })
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Impedance ${cellData.name}: bus=${cellData.bus}, R=${cellData.r_ohm}Ω, X=${cellData.x_ohm}Ω`);
                    } else {
                        console.warn(`Impedance ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Ward') {
                    // This is a ward element
                    cellData = {
                        typ: 'Ward',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Add ward parameters
                        ...getAttributesAsObject(cell, {
                            pz_mw: 'pz_mw',
                            qz_mvar: 'qz_mvar',
                            ps_mw: 'ps_mw',
                            qs_mvar: 'qs_mvar',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type'
                        })
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Ward ${cellData.name}: bus=${cellData.bus}, PZ=${cellData.pz_mw}MW, QZ=${cellData.qz_mvar}MVar`);
                            } else {
                        console.warn(`Ward ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Extended Ward') {
                    // This is an extended ward element
                    cellData = {
                        typ: 'Extended Ward',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Add extended ward parameters
                        ...getAttributesAsObject(cell, {
                            pz_mw: 'pz_mw',
                            qz_mvar: 'qz_mvar',
                            ps_mw: 'ps_mw',
                            qs_mvar: 'qs_mvar',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type',
                            r_ohm: 'r_ohm',
                            x_ohm: 'x_ohm'
                        })
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Extended Ward ${cellData.name}: bus=${cellData.bus}, PZ=${cellData.pz_mw}MW, QZ=${cellData.qz_mvar}MVar`);
                        } else {
                        console.warn(`Extended Ward ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Motor') {
                    // This is a motor element
                    const motorParams = getAttributesAsObject(cell, {
                        pn_mw: 'pn_mw',
                        cos_phi_n: 'cos_phi_n',
                        efficiency_percent: 'efficiency_percent',
                        scaling: 'scaling',
                        type: 'type',
                        lrc_pu: 'lrc_pu',
                        max_ik_ka: 'max_ik_ka',
                        kappa: 'kappa',
                        current_source: 'current_source'
                    });
                    
                    cellData = {
                        typ: 'Motor',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        pn_mw: motorParams.pn_mw || 1.0,      // Default power
                        cos_phi_n: motorParams.cos_phi_n || 0.9, // Default power factor
                        // Other parameters
                        efficiency_percent: motorParams.efficiency_percent || 95.0,
                        scaling: motorParams.scaling || 1.0,
                        type: motorParams.type || 'motor',
                        lrc_pu: motorParams.lrc_pu || 0.0,
                        max_ik_ka: motorParams.max_ik_ka || 1.0,
                        kappa: motorParams.kappa || 1.0,
                        current_source: motorParams.current_source || false
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Motor ${cellData.name}: bus=${cellData.bus}, Pn=${cellData.pn_mw}MW, cos_phi=${cellData.cos_phi_n}`);
                    } else {
                        console.warn(`Motor ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'SVC') {
                    // This is an SVC element
                    const svcParams = getAttributesAsObject(cell, {
                        q_mvar: 'q_mvar',
                        vm_set_pu: 'vm_set_pu',
                        vm_mag_pu: 'vm_mag_pu',
                        thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type'
                    });
                    
                    cellData = {
                        typ: 'SVC',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        q_mvar: svcParams.q_mvar || 1.0,      // Default reactive power
                        vm_set_pu: svcParams.vm_set_pu || 1.0, // Default voltage setpoint
                        // Other parameters
                        vm_mag_pu: svcParams.vm_mag_pu || 1.0,
                        thyristor_firing_angle_degree: svcParams.thyristor_firing_angle_degree || 90.0,
                        sn_mva: svcParams.sn_mva || 1.0,
                        scaling: svcParams.scaling || 1.0,
                        type: svcParams.type || 'svc'
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`SVC ${cellData.name}: bus=${cellData.bus}, Q=${cellData.q_mvar}MVar, vm_set_pu=${cellData.vm_set_pu}`);
                    } else {
                        console.warn(`SVC ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'TCSC') {
                    // This is a TCSC element
                    cellData = {
                        typ: 'TCSC',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Add TCSC parameters
                        ...getAttributesAsObject(cell, {
                            x_l_ohm: 'x_l_ohm',
                            x_c_ohm: 'x_c_ohm',
                            x_par_ohm: 'x_par_ohm',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type'
                        })
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`TCSC ${cellData.name}: bus=${cellData.bus}, XL=${cellData.x_l_ohm}Ω, XC=${cellData.x_c_ohm}Ω`);
    } else {
                        console.warn(`TCSC ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'SSC') {
                    // This is an SSC element
                    cellData = {
                        typ: 'SSC',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Add SSC parameters
                        ...getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            q_mvar: 'q_mvar',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type'
                        })
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`SSC ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`SSC ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'DC Line') {
                    // This is a DC line element
                    const connections = getConnectedBusId(cell, true);
                    
                    const dcLineParams = getAttributesAsObject(cell, {
                        p_mw: 'p_mw',
                        v_kv: 'v_kv',
                        max_p_mw: 'max_p_mw',
                        min_p_mw: 'min_p_mw',
                        max_q_mvar: 'max_q_mvar',
                        min_q_mvar: 'min_q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type'
                    });
                    
                    cellData = {
                        typ: 'DC Line',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        busFrom: connections?.busFrom,
                        busTo: connections?.busTo,
                        // Use extracted parameters or defaults for critical values
                        p_mw: dcLineParams.p_mw || 1.0,      // Default power
                        v_kv: dcLineParams.v_kv || 100.0,    // Default voltage
                        // Other parameters
                        max_p_mw: dcLineParams.max_p_mw || 1.0,
                        min_p_mw: dcLineParams.min_p_mw || 0.0,
                        max_q_mvar: dcLineParams.max_q_mvar || 1.0,
                        min_q_mvar: dcLineParams.min_q_mvar || -1.0,
                        sn_mva: dcLineParams.sn_mva || 1.0,
                        scaling: dcLineParams.scaling || 1.0,
                        type: dcLineParams.type || 'dc_line'
                    };
                    
                    // Validate bus connections
                    if (cellData.busFrom && cellData.busTo) {
                        console.log(`DC Line ${cellData.name}: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}, P=${cellData.p_mw}MW`);
                    } else {
                        console.warn(`DC Line ${cellData.name} missing bus connections: busFrom=${cellData.busFrom}, busTo=${cellData.busTo}`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Static Generator') {
                    // This is a static generator element
                    const staticGenParams = getAttributesAsObject(cell, {
                        // Basic static generator parameters
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        max_p_mw: 'max_p_mw',
                        min_p_mw: 'min_p_mw',
                        max_q_mvar: 'max_q_mvar',
                        min_q_mvar: 'min_q_mvar',
                        vm_pu: 'vm_pu',
                        va_degree: 'va_degree',
                        k: 'k',
                        rx: 'rx',
                        generator_type: 'generator_type',
                        lrc_pu: 'lrc_pu',
                        max_ik_ka: 'max_ik_ka',
                        kappa: 'kappa',
                        current_source: 'current_source'
                    });
                    
                    cellData = {
                        typ: 'Static Generator',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_mw: staticGenParams.p_mw || 1.0,      // Default power
                        q_mvar: staticGenParams.q_mvar || 0.0,  // Default reactive power
                        // Other parameters
                        sn_mva: staticGenParams.sn_mva || 1.0,
                        scaling: staticGenParams.scaling || 1.0,
                        type: staticGenParams.type || 'static_generator',
                        max_p_mw: staticGenParams.max_p_mw || 1.0,
                        min_p_mw: staticGenParams.min_p_mw || 0.0,
                        max_q_mvar: staticGenParams.max_q_mvar || 1.0,
                        min_q_mvar: staticGenParams.min_q_mvar || -1.0,
                        vm_pu: staticGenParams.vm_pu || 1.0,
                        va_degree: staticGenParams.va_degree || 0.0,
                        k: staticGenParams.k || 1.0,
                        rx: staticGenParams.rx || 0.1,
                        generator_type: staticGenParams.generator_type || 'static_generator',
                        lrc_pu: staticGenParams.lrc_pu || 0.0,
                        max_ik_ka: staticGenParams.max_ik_ka || 1.0,
                        kappa: staticGenParams.kappa || 1.0,
                        current_source: staticGenParams.current_source || false
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Static Generator ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Static Generator ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Asymmetric Static Generator') {
                    // This is an asymmetric static generator element
                    const asymStaticGenParams = getAttributesAsObject(cell, {
                        // Basic asymmetric static generator parameters
                        p_a_mw: 'p_a_mw',
                        p_b_mw: 'p_b_mw',
                        p_c_mw: 'p_c_mw',
                        q_a_mvar: 'q_a_mvar',
                        q_b_mvar: 'q_b_mvar',
                        q_c_mvar: 'q_c_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        max_p_mw: 'max_p_mw',
                        min_p_mw: 'min_p_mw',
                        max_q_mvar: 'max_q_mvar',
                        min_q_mvar: 'min_q_mvar',
                        vm_pu: 'vm_pu',
                        va_degree: 'va_degree',
                        k: 'k',
                        rx: 'rx',
                        generator_type: 'generator_type',
                        lrc_pu: 'lrc_pu',
                        max_ik_ka: 'max_ik_ka',
                        kappa: 'kappa',
                        current_source: 'current_source'
                    });
                    
                    cellData = {
                        typ: 'Asymmetric Static Generator',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_a_mw: asymStaticGenParams.p_a_mw || 1.0,      // Default power phase A
                        p_b_mw: asymStaticGenParams.p_b_mw || 1.0,      // Default power phase B
                        p_c_mw: asymStaticGenParams.p_c_mw || 1.0,      // Default power phase C
                        q_a_mvar: asymStaticGenParams.q_a_mvar || 0.0,  // Default reactive power phase A
                        q_b_mvar: asymStaticGenParams.q_b_mvar || 0.0,  // Default reactive power phase B
                        q_c_mvar: asymStaticGenParams.q_c_mvar || 0.0,  // Default reactive power phase C
                        // Other parameters
                        sn_mva: asymStaticGenParams.sn_mva || 1.0,
                        scaling: asymStaticGenParams.scaling || 1.0,
                        type: asymStaticGenParams.type || 'asymmetric_static_generator',
                        max_p_mw: asymStaticGenParams.max_p_mw || 1.0,
                        min_p_mw: asymStaticGenParams.min_p_mw || 0.0,
                        max_q_mvar: asymStaticGenParams.max_q_mvar || 1.0,
                        min_q_mvar: asymStaticGenParams.min_q_mvar || -1.0,
                        vm_pu: asymStaticGenParams.vm_pu || 1.0,
                        va_degree: asymStaticGenParams.va_degree || 0.0,
                        k: asymStaticGenParams.k || 1.0,
                        rx: asymStaticGenParams.rx || 0.1,
                        generator_type: asymStaticGenParams.generator_type || 'asymmetric_static_generator',
                        lrc_pu: asymStaticGenParams.lrc_pu || 0.0,
                        max_ik_ka: asymStaticGenParams.max_ik_ka || 1.0,
                        kappa: asymStaticGenParams.kappa || 1.0,
                        current_source: asymStaticGenParams.current_source || false
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Asymmetric Static Generator ${cellData.name}: bus=${cellData.bus}, P_A=${cellData.p_a_mw}MW, P_B=${cellData.p_b_mw}MW, P_C=${cellData.p_c_mw}MW`);
                    } else {
                        console.warn(`Asymmetric Static Generator ${cellData.name} missing bus connection`);
                    }
                }
            }
            
            // Add to network data if we successfully parsed it
            if (cellData && cellData.typ) {
                networkData.push(cellData);
            }
        }
    }
    
    console.log(`Collected ${networkData.length} network elements:`, networkData);
    return networkData;
}

// Helper function to get bus voltage from cell value
function getBusVoltage(cellValue) {
    if (cellValue && cellValue.attributes) {
        // Look for voltage information in attributes
        for (let i = 0; i < cellValue.attributes.length; i++) {
            const attr = cellValue.attributes[i];
            if (attr.nodeName === 'vn_kv') {
                return attr.nodeValue;
            }
        }
        
        // If no vn_kv attribute, try to parse from the cell value text
        if (typeof cellValue === 'string') {
            if (cellValue.includes('110kV')) {
                return '110';
            } else if (cellValue.includes('20kV')) {
                return '20';
            }
        }
    }
    
    // Default voltage
    return '110';
}

// Function to execute Pandapower load flow calculation
function executePandapowerLoadFlow(parameters, app, graph) {
    console.log('Executing Pandapower load flow with parameters:', parameters);
    
    // Start the spinner
    app.spinner.spin(document.body, "Waiting for Pandapower results...");
    
    // Convert parameters to the format expected by the pandapower processing logic
    const pandapowerParams = [
        parameters.frequency || '50',
        parameters.algorithm || 'nr',
        parameters.calculate_voltage_angles || 'auto',
        parameters.initialization || 'auto'
    ];
    
    console.log('Converted pandapower parameters:', pandapowerParams);
    
    // Execute pandapower core logic directly
    executePandapowerCoreLogic(pandapowerParams, app, graph);
}

// Function to execute pandapower core logic without showing dialog
function executePandapowerCoreLogic(parameters, app, graph) {
    console.log('Executing pandapower core logic with parameters:', parameters);
    
    // Let's try a different approach - override the show method of all LoadFlowDialog instances
    // and then call the original function
    
    // Store the original show method
    const originalShow = window.LoadFlowDialog.prototype.show;
    console.log('Original LoadFlowDialog.prototype.show:', originalShow);
    
    try {
        // Temporarily override the show method on the prototype
        window.LoadFlowDialog.prototype.show = function(callback) {
            console.log('Overridden LoadFlowDialog.show called, immediately calling callback with parameters:', parameters);
            // Immediately call the callback with our parameters
            callback(parameters, null);
        };
        
        console.log('Replaced LoadFlowDialog.prototype.show with dummy version');
        
        // Now call the original loadFlowPandaPower function - any dialog created will use our overridden show method
        console.log('Calling original loadFlowPandaPower with overridden show method');
        globalThis.loadFlowPandaPower(app, graph, null);
        console.log('loadFlowPandaPower called successfully');
        
    } catch (error) {
        console.error('Error executing pandapower load flow:', error);
        app.spinner.stop();
        alert('Error executing Pandapower load flow: ' + error.message);
    } finally {
        // Restore the original show method
        console.log('Restoring original LoadFlowDialog.prototype.show:', originalShow);
        window.LoadFlowDialog.prototype.show = originalShow;
    }
}

// Function to process pandapower backend call
async function processPandapowerBackend(obj, graph) {
    try {
        const response = await fetch("https://03dht3kc-5000.euw.devtunnels.ms/", {
            mode: "cors",
            method: "post",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(obj)
        });
        
        if (response.status !== 200) {
            throw new Error("Server error");
        }
        
        const dataJson = await response.json();
        console.log('Pandapower backend response:', dataJson);
        
        // Process the response - you may need to add visualization logic here
        alert('Pandapower calculation completed successfully!');
        
    } catch (error) {
        console.error('Pandapower backend error:', error);
        alert('Error in Pandapower calculation: ' + error.message);
    } finally {
        // Stop spinner
        if (window.App && window.App.spinner) {
            window.App.spinner.stop();
        }
    }
}

// Make the function available globally
window.loadFlowOpenDss = loadFlowOpenDss;
globalThis.loadFlowOpenDss = loadFlowOpenDss;

// Export for module usage
export { loadFlowOpenDss };
