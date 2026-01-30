// Load Flow OpenDSS and Pandapower Dispatcher
// This file acts as a dispatcher for both OpenDSS and Pandapower load flow calculations



// Import helper functions from loadFlow.js
import { DIALOG_STYLES } from './utils/dialogStyles.js';
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';
import ENV from './config/environment.js';
import { getIncompatibleElements } from './utils/engineCompatibility.js';

// Helper function to format bus IDs consistently (replace # with _)
const formatBusId = (busId) => {
    if (!busId) return null;
    return busId.replace('#', '_');
};

// Helper function to download OpenDSS commands as a text file
const downloadOpenDSSCommands = (commands) => {
    try {
        // Create a blob with the commands
        const blob = new Blob([commands], { type: 'text/plain' });
        
        // Create a download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `OpenDSS_Model_${timestamp}.txt`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('OpenDSS commands file downloaded successfully');
    } catch (error) {
        console.error('Error downloading OpenDSS commands:', error);
        alert(
            'Failed to download OpenDSS commands file. Please check the console for details.\n\n' +
            'If the problem persists, please contact electrisim@electrisim.com for support.'
        );
    }
};

// Helper function to create table formatting for OpenDSS results
const createOpenDSSTableRow = (columns, widths) => {
    return columns.map((col, i) => {
        const str = String(col);
        return str.padEnd(widths[i], ' ');
    }).join(' | ');
};

const createOpenDSSTableSeparator = (widths) => {
    return widths.map(w => '-'.repeat(w)).join('-+-');
};

// Helper function to download OpenDSS results as a text file
const downloadOpenDSSResults = (dataJson) => {
    try {
        let resultsText = '========================================\n';
        resultsText += '     OpenDSS Load Flow Results\n';
        resultsText += '========================================\n\n';
        resultsText += `Generated: ${new Date().toISOString()}\n\n`;
        
        // External Grids
        if (dataJson.externalgrids && dataJson.externalgrids.length > 0) {
            resultsText += '--- EXTERNAL GRIDS ---\n';
            const widths = [20, 12, 12, 12, 10];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]', 'PF', 'Q/P'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.externalgrids.forEach(grid => {
                const row = [
                    grid.name || 'N/A',
                    grid.p_mw ? grid.p_mw.toFixed(3) : 'N/A',
                    grid.q_mvar ? grid.q_mvar.toFixed(3) : 'N/A',
                    grid.pf ? grid.pf.toFixed(3) : 'N/A',
                    grid.q_p ? grid.q_p.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Buses
        if (dataJson.busbars && dataJson.busbars.length > 0) {
            resultsText += '--- BUSES ---\n';
            const widths = [20, 12, 14, 12, 12, 10, 10];
            const headers = ['Name', 'U [pu]', 'U [degree]', 'P [MW]', 'Q [MVAr]', 'PF', 'Q/P'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.busbars.forEach(bus => {
                const fmt = (v) => (v != null && v !== '' && !Number.isNaN(v) ? Number(v).toFixed(3) : 'N/A');
                const row = [
                    bus.name || 'N/A',
                    fmt(bus.vm_pu),
                    fmt(bus.va_degree),
                    fmt(bus.p_mw),
                    fmt(bus.q_mvar),
                    fmt(bus.pf),
                    fmt(bus.q_p)
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Lines
        if (dataJson.lines && dataJson.lines.length > 0) {
            resultsText += '--- LINES ---\n';
            const widths = [20, 13, 14, 13, 12, 13, 12, 13];
            const headers = ['Name', 'P_from [MW]', 'Q_from [MVAr]', 'I_from [kA]', 'P_to [MW]', 'Q_to [MVAr]', 'I_to [kA]', 'Loading [%]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.lines.forEach(line => {
                const row = [
                    line.name || 'N/A',
                    line.p_from_mw ? line.p_from_mw.toFixed(3) : 'N/A',
                    line.q_from_mvar ? line.q_from_mvar.toFixed(3) : 'N/A',
                    line.i_from_ka ? line.i_from_ka.toFixed(3) : 'N/A',
                    line.p_to_mw ? line.p_to_mw.toFixed(3) : 'N/A',
                    line.q_to_mvar ? line.q_to_mvar.toFixed(3) : 'N/A',
                    line.i_to_ka ? line.i_to_ka.toFixed(3) : 'N/A',
                    line.loading_percent ? line.loading_percent.toFixed(1) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Transformers
        if (dataJson.transformers && dataJson.transformers.length > 0) {
            resultsText += '--- TRANSFORMERS ---\n';
            const widths = [20, 13, 13, 12, 13, 12, 12, 13, 12];
            const headers = ['Name', 'P_HV [MW]', 'Q_HV [MVAr]', 'P_LV [MW]', 'Q_LV [MVAr]', 'I_HV [kA]', 'I_LV [kA]', 'Loading [%]', 'Loss [MW]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.transformers.forEach(trafo => {
                const row = [
                    trafo.name || 'N/A',
                    trafo.p_hv_mw !== undefined ? trafo.p_hv_mw.toFixed(3) : 'N/A',
                    trafo.q_hv_mvar !== undefined ? trafo.q_hv_mvar.toFixed(3) : 'N/A',
                    trafo.p_lv_mw !== undefined ? trafo.p_lv_mw.toFixed(3) : 'N/A',
                    trafo.q_lv_mvar !== undefined ? trafo.q_lv_mvar.toFixed(3) : 'N/A',
                    trafo.i_hv_ka ? trafo.i_hv_ka.toFixed(3) : 'N/A',
                    trafo.i_lv_ka ? trafo.i_lv_ka.toFixed(3) : 'N/A',
                    trafo.loading_percent ? trafo.loading_percent.toFixed(1) : 'N/A',
                    trafo.pl_mw !== undefined ? trafo.pl_mw.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Generators
        if (dataJson.generators && dataJson.generators.length > 0) {
            resultsText += '--- GENERATORS ---\n';
            const widths = [20, 12, 12, 10, 14];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]', 'U [pu]', 'U [degree]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.generators.forEach(gen => {
                const row = [
                    gen.name || 'N/A',
                    gen.p_mw ? gen.p_mw.toFixed(3) : 'N/A',
                    gen.q_mvar ? gen.q_mvar.toFixed(3) : 'N/A',
                    gen.vm_pu ? gen.vm_pu.toFixed(3) : 'N/A',
                    gen.va_degree ? gen.va_degree.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Loads
        if (dataJson.loads && dataJson.loads.length > 0) {
            resultsText += '--- LOADS ---\n';
            const widths = [20, 12, 12];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.loads.forEach(load => {
                const row = [
                    load.name || 'N/A',
                    load.p_mw ? load.p_mw.toFixed(3) : 'N/A',
                    load.q_mvar ? load.q_mvar.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Shunts
        if (dataJson.shunts && dataJson.shunts.length > 0) {
            resultsText += '--- SHUNT REACTORS ---\n';
            const widths = [20, 12, 12, 10];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]', 'U [pu]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.shunts.forEach(shunt => {
                const row = [
                    shunt.name || 'N/A',
                    shunt.p_mw ? shunt.p_mw.toFixed(3) : 'N/A',
                    shunt.q_mvar ? shunt.q_mvar.toFixed(3) : 'N/A',
                    shunt.vm_pu ? shunt.vm_pu.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // Capacitors
        if (dataJson.capacitors && dataJson.capacitors.length > 0) {
            resultsText += '--- CAPACITORS ---\n';
            const widths = [20, 12, 12, 10];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]', 'U [pu]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.capacitors.forEach(cap => {
                const row = [
                    cap.name || 'N/A',
                    cap.p_mw ? cap.p_mw.toFixed(3) : 'N/A',
                    cap.q_mvar ? cap.q_mvar.toFixed(3) : 'N/A',
                    cap.vm_pu ? cap.vm_pu.toFixed(3) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        // PVSystems
        if (dataJson.pvsystems && dataJson.pvsystems.length > 0) {
            resultsText += '--- PV SYSTEMS ---\n';
            const widths = [20, 12, 12, 10, 14, 12, 14];
            const headers = ['Name', 'P [MW]', 'Q [MVAr]', 'U [pu]', 'U [degree]', 'Irradiance', 'Temp [°C]'];
            resultsText += createOpenDSSTableRow(headers, widths) + '\n';
            resultsText += createOpenDSSTableSeparator(widths) + '\n';
            dataJson.pvsystems.forEach(pv => {
                const row = [
                    pv.name || 'N/A',
                    pv.p_mw ? pv.p_mw.toFixed(3) : 'N/A',
                    pv.q_mvar ? pv.q_mvar.toFixed(3) : 'N/A',
                    pv.vm_pu ? pv.vm_pu.toFixed(3) : 'N/A',
                    pv.va_degree ? pv.va_degree.toFixed(3) : 'N/A',
                    pv.irradiance !== undefined ? pv.irradiance.toFixed(3) : 'N/A',
                    pv.temperature !== undefined ? pv.temperature.toFixed(1) : 'N/A'
                ];
                resultsText += createOpenDSSTableRow(row, widths) + '\n';
            });
            resultsText += '\n';
        }
        
        resultsText += '========================================\n';
        resultsText += '          End of Results\n';
        resultsText += '========================================\n';
        
        // Create and download
        const blob = new Blob([resultsText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `OpenDSS_Results_${timestamp}.txt`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('OpenDSS results file downloaded successfully');
    } catch (error) {
        console.error('Error downloading OpenDSS results:', error);
        alert(
            'Failed to download OpenDSS results file. Please check the console for details.\n\n' +
            'If the problem persists, please contact electrisim@electrisim.com for support.'
        );
    }
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
// Fixed to ensure HV bus is always busFrom and LV bus is always busTo
const getTransformerConnections = (cell, graph) => {
    // Helper function to get bus voltage from a bus cell
    const getBusVoltageLevel = (busId, graph) => {
        if (!busId || !graph) return 0;
        
        const cells = graph.getModel().cells;
        for (const cellId in cells) {
            const busCell = cells[cellId];
            if (busCell && busCell.mxObjectId === busId.replace('_', '#')) {
                const style = busCell.getStyle ? busCell.getStyle() : '';
                if (style && style.includes('shapeELXXX=Bus')) {
                    // Get voltage from attributes
                    if (busCell.value && busCell.value.attributes) {
                        for (let i = 0; i < busCell.value.attributes.length; i++) {
                            const attr = busCell.value.attributes[i];
                            if (attr.nodeName === 'vn_kv') {
                                return parseFloat(attr.nodeValue) || 0;
                            }
                        }
                    }
                }
            }
        }
        return 0;
    };
    
    if (cell.edges && cell.edges.length >= 2) {
        const edge1 = cell.edges[0];
        const edge2 = cell.edges[1];

        const bus1Id = formatBusId(edge1.target && edge1.target.mxObjectId !== cell.mxObjectId ?
            edge1.target.mxObjectId : 
            edge1.source.mxObjectId);
        const bus2Id = formatBusId(edge2.target && edge2.target.mxObjectId !== cell.mxObjectId ?
            edge2.target.mxObjectId : 
            edge2.source.mxObjectId);
        
        // Get voltage levels for both buses
        const voltage1 = getBusVoltageLevel(bus1Id, graph);
        const voltage2 = getBusVoltageLevel(bus2Id, graph);
        
        // Ensure HV bus is busFrom and LV bus is busTo
        if (voltage1 >= voltage2) {
            return {
                busFrom: bus1Id,  // HV side
                busTo: bus2Id     // LV side
            };
        } else {
            return {
                busFrom: bus2Id,  // HV side
                busTo: bus1Id     // LV side
            };
        }
    }
    
    // Fallback for single edge transformers
    if (cell.edges && cell.edges.length === 1) {
        const edge = cell.edges[0];
        if (edge.source && edge.target) {
            const sourceId = formatBusId(edge.source.mxObjectId);
            const targetId = formatBusId(edge.target.mxObjectId);
            
            // Get voltage levels
            const voltageSource = getBusVoltageLevel(sourceId, graph);
            const voltageTarget = getBusVoltageLevel(targetId, graph);
            
            // Ensure HV bus is busFrom and LV bus is busTo
            if (voltageSource >= voltageTarget) {
                return {            
                    busFrom: sourceId,  // HV side
                    busTo: targetId     // LV side
                };
            } else {
                return {            
                    busFrom: targetId,  // HV side
                    busTo: sourceId     // LV side
                };
            }
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
    DC_BUS: 'DC Bus',
    TRANSFORMER: 'Transformer',
    THREE_WINDING_TRANSFORMER: 'Three Winding Transformer',
    SHUNT_REACTOR: 'Shunt Reactor',
    CAPACITOR: 'Capacitor',
    LOAD: 'Load',
    LOAD_DC: 'Load DC',
    SOURCE_DC: 'Source DC',
    ASYMMETRIC_LOAD: 'Asymmetric Load',
    IMPEDANCE: 'Impedance',
    WARD: 'Ward',
    EXTENDED_WARD: 'Extended Ward',
    MOTOR: 'Motor',
    STORAGE: 'Storage',
    PV_SYSTEM: 'PVSystem',
    SVC: 'SVC',
    TCSC: 'TCSC',
    SSC: 'SSC',
    SWITCH: 'Switch',
    VSC: 'VSC',
    B2B_VSC: 'B2B VSC',
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
                console.log('exportPython value received:', values.exportPython);
                
                // Pass the values object directly to preserve all parameters including exportPython
                // DO NOT convert to array as that loses the exportPython flag!
                console.log('Passing values object directly to executePandapowerLoadFlow');
                
                // Execute pandapower load flow directly with the full values object
                executePandapowerLoadFlow(values, apka, grafka);
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
                        console.log('exportPython value received:', values.exportPython);
                        
                        // Pass the values object directly to preserve all parameters including exportPython
                        // DO NOT convert to array as that loses the exportPython flag!
                        console.log('Passing values object directly to executePandapowerLoadFlow');
                        
                        // Execute pandapower load flow directly with the full values object
                        executePandapowerLoadFlow(values, apka, grafka);
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
                    alert(
                        'Load Flow dialog is not available. Please refresh the page and try again.\n\n' +
                        'If the problem persists, please contact electrisim@electrisim.com for support.'
                    );
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
                alert(
                    'Load Flow dialog is not available. Please refresh the page and try again.\n\n' +
                    'If the problem persists, please contact electrisim@electrisim.com for support.'
                );
            }
        }
    }
}

// Helper function to remove old-style result cells (for backward compatibility)
// Removes ONLY standalone result cells (not children of components)
// KEEPS proper child placeholders (they will be updated, not removed)
const removeOldStyleResultCells = (grafka) => {
    const model = grafka.getModel();
    const cells = model.cells;
    const cellsToRemove = [];
    
    for (const cellId in cells) {
        const cell = cells[cellId];
        if (!cell) continue;
        
        const cellStyle = cell.getStyle ? cell.getStyle() : '';
        const value = cell.getValue ? cell.getValue() : '';
        
        // KEEP initial placeholders (they contain "Click Simulate")
        if (value && typeof value === 'string' && value.includes('Click Simulate')) {
            continue;
        }
        
        // KEEP proper child placeholders (children of component cells)
        // These will be updated by findPlaceholderForCellOpenDSS, not removed
        if (cell.parent && cell.parent.id !== '1' && cell.parent.id !== '0') {
            const parentStyle = cell.parent.getStyle ? cell.parent.getStyle() : '';
            // If parent is a component (Bus, Line, External Grid, Load, etc.), keep this child
            if (parentStyle && parentStyle.includes('shapeELXXX=')) {
                // This is a proper child placeholder - KEEP IT (it will be updated)
                continue;
            }
        }
        
        // Remove standalone result cells (old-style, not children of components)
        if (cellStyle && (cellStyle.includes('shapeELXXX=Result') || 
            cellStyle.includes('shapeELXXX=ResultBus') || 
            cellStyle.includes('shapeELXXX=ResultExternalGrid'))) {
            cellsToRemove.push(cell);
            continue;
        }
        
        // Remove standalone result cells detected by content patterns
        if (value && typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (lowerValue.includes('u[pu]') || lowerValue.includes('u[degree]') ||
                lowerValue.includes('p[mw]') || lowerValue.includes('q[mvar]') ||
                lowerValue.includes('loading[%]') || lowerValue.includes('ikss[ka]') ||
                lowerValue.includes('pf:') || lowerValue.includes('q/p:')) {
                cellsToRemove.push(cell);
            }
        }
    }
    
    // Remove old-style standalone result cells
    if (cellsToRemove.length > 0) {
        console.log(`Removing ${cellsToRemove.length} old-style standalone result cells`);
        model.beginUpdate();
        try {
            cellsToRemove.forEach(cell => {
                const cellToRemove = model.getCell(cell.id);
                if (cellToRemove) {
                    model.remove(cellToRemove);
                }
            });
        } finally {
            model.endUpdate();
        }
    }
    
    return cellsToRemove.length;
};

// Helper function to find existing placeholder for a cell
// This ensures we UPDATE existing placeholders instead of creating new ones
// Compatible with placeholders created by resultBoxes.js, loadFlow.js, etc.
// Works for both bus placeholders (children of bus) and component placeholders (children of edge)
// IMPORTANT: Always search among children first, don't rely on placeholderId attribute
// because cloned cells have stale placeholderId pointing to the original placeholder
const findPlaceholderForCellOpenDSS = (grafka, resultCell, isEdgeBased = true) => {
    let placeholder = null;
    const model = grafka.getModel();
    
    if (!isEdgeBased) {
        // For Bus - placeholder is a direct child of the bus cell
        // Use model API for consistency
        const childCount = model.getChildCount(resultCell);
        for (let i = 0; i < childCount; i++) {
            const child = model.getChildAt(resultCell, i);
            if (!child) continue;
            const childStyle = model.getStyle(child) || '';
            // Check for ResultBus, Result styles (but not ResultExternalGrid)
            if (childStyle && (childStyle.includes('shapeELXXX=ResultBus') || 
                (childStyle.includes('shapeELXXX=Result') && !childStyle.includes('ResultExternalGrid')))) {
                placeholder = child;
                break;
            }
        }
        return placeholder;
    }
    
    // For Lines - placeholder is a direct child of the line (edge) cell
    // Only check this if resultCell is actually a Line (edge), not for other components
    const resultCellStyle = model.getStyle(resultCell) || '';
    const isLineCell = resultCellStyle.includes('shapeELXXX=Line');
    if (isLineCell) {
        const lineChildCount = model.getChildCount(resultCell);
        for (let i = 0; i < lineChildCount; i++) {
            const child = model.getChildAt(resultCell, i);
            if (!child) continue;
            const childStyle = model.getStyle(child) || '';
            if (childStyle && childStyle.includes('shapeELXXX=Result')) {
                placeholder = child;
                break;
            }
        }
    }
    
    // For edge-based components (Load, Generator, External Grid, Transformer, Shunt Reactor, etc.)
    // ALWAYS search among edge children first - don't rely on placeholderId
    // because cloned components have stale placeholderId pointing to original placeholder
    if (!placeholder) {
        // Try grafka.getEdges() first, then fallback to resultCell.edges
        let edges = grafka.getEdges(resultCell);
        if ((!edges || edges.length === 0) && resultCell.edges) {
            edges = resultCell.edges;
        }
        if (edges && edges.length > 0) {
            for (let e = 0; e < edges.length; e++) {
                const edge = edges[e];
                if (!edge) continue;
                // Use model API for consistency
                const edgeChildCount = model.getChildCount(edge);
                for (let i = 0; i < edgeChildCount; i++) {
                    const child = model.getChildAt(edge, i);
                    if (!child) continue;
                    const childStyle = model.getStyle(child) || '';
                    if (childStyle && (childStyle.includes('shapeELXXX=Result') || childStyle.includes('shapeELXXX=ResultExternalGrid'))) {
                        placeholder = child;
                        break;
                    }
                }
                if (placeholder) break;
            }
        }
    }
    
    return placeholder;
};

// Helper: resolve graph cell from backend id (OpenDSS returns id with '#' or '_')
const getResultCellFromMap = (cellIdMap, id) => {
    if (!cellIdMap || id == null) return null;
    let cell = cellIdMap.get(id);
    if (!cell && id !== '') {
        const altId = String(id).indexOf('#') >= 0 ? String(id).replace(/#/g, '_') : String(id).replace(/_/g, '#');
        cell = cellIdMap.get(altId);
    }
    return cell;
};

// Element processors for OpenDSS (FROM BACKEND TO FRONTEND)
// Updated to FIND AND UPDATE existing placeholders instead of creating new ones
// OPTIMIZED: Uses cellIdMap for O(1) lookups instead of O(n) searches
const elementProcessors = {
    busbars: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('busbars data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                const fmt = (v) => (v != null && v !== '' && !Number.isNaN(v) ? Number(v).toFixed(3) : 'N/A');
                const resultString = `${cellName}
U[pu]: ${fmt(cell.vm_pu)}
U[degree]: ${fmt(cell.va_degree)}
P[MW]: ${fmt(cell.p_mw)}
Q[MVAr]: ${fmt(cell.q_mvar)}
PF: ${fmt(cell.pf)}
Q/P: ${fmt(cell.q_p)}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, false);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=ResultBus', true);
                    processCellStyles(b, labelka);
                }
                processVoltageColor(grafka, resultCell, cell.vm_pu);
            } catch (error) {
                console.error(`Error processing busbar ${cell.id}:`, error);
            }
        });
    },

    lines: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('lines data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
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

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, 0, 0, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka, true);
                }
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            } catch (error) {
                console.error(`Error processing line ${cell.id}:`, error);
            }
        });
    },

    externalgrids: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('externalgrids data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                // Use "External Grid" as label (not the mxCell id) for cleaner display
                const resultString = `External Grid
P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
PF: ${cell.pf ? cell.pf.toFixed(3) : 'N/A'}
Q/P: ${cell.q_p ? cell.q_p.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it (should always exist from resultBoxes.js)
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    // Only update the text content - don't modify geometry or create new boxes
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    console.warn(`External Grid ${cell.id}: No placeholder found - this should not happen. Placeholder should be created by resultBoxes.js`);
                }
            } catch (error) {
                console.error(`Error processing external grid ${cell.id}:`, error);
            }
        });
    },

    generators: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('generators data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        U[degree]: ${cell.va_degree ? cell.va_degree.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing generator ${cell.id}:`, error);
            }
        });
    },

    loads: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('loads data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing load ${cell.id}:`, error);
            }
        });
    },

    transformers: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('transformers data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P_HV[MW]: ${cell.p_hv_mw !== undefined ? cell.p_hv_mw.toFixed(3) : 'N/A'}
        Q_HV[MVAr]: ${cell.q_hv_mvar !== undefined ? cell.q_hv_mvar.toFixed(3) : 'N/A'}
        i_HV[kA]: ${cell.i_hv_ka ? cell.i_hv_ka.toFixed(3) : 'N/A'}
        
        P_LV[MW]: ${cell.p_lv_mw !== undefined ? cell.p_lv_mw.toFixed(3) : 'N/A'}
        Q_LV[MVAr]: ${cell.q_lv_mvar !== undefined ? cell.q_lv_mvar.toFixed(3) : 'N/A'}
        i_LV[kA]: ${cell.i_lv_ka ? cell.i_lv_ka.toFixed(3) : 'N/A'}
        
        Losses[MW]: ${cell.pl_mw !== undefined ? cell.pl_mw.toFixed(3) : 'N/A'}
        loading[%]: ${cell.loading_percent ? cell.loading_percent.toFixed(1) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            } catch (error) {
                console.error(`Error processing transformer ${cell.id}:`, error);
            }
        });
    },

    // Add support for additional element types that might be returned by the simplified backend
    shunts: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('shunts data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${(cell.p_mw !== undefined && cell.p_mw !== null) ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${(cell.q_mvar !== undefined && cell.q_mvar !== null) ? cell.q_mvar.toFixed(3) : 'N/A'}
        Um[pu]: ${(cell.vm_pu !== undefined && cell.vm_pu !== null) ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing shunt ${cell.id}:`, error);
            }
        });
    },

    capacitors: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('capacitors data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing capacitor ${cell.id}:`, error);
            }
        });
    },

    storages: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('storages data is not an array:', data);
            return;
        }
        
        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }
                
                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';
                
                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing storage ${cell.id}:`, error);
            }
        });
    },

    pvsystems: (data, b, grafka, cellIdMap) => {
        if (!Array.isArray(data)) {
            console.warn('pvsystems data is not an array:', data);
            return;
        }

        data.forEach(cell => {
            try {
                const resultCell = getResultCellFromMap(cellIdMap, cell.id);
                if (!resultCell) {
                    console.warn(`Could not find cell with id: ${cell.id}`);
                    return;
                }

                const cellName = cell.name ? cell.name.replace('_', '#') : 'Unknown';

                const resultString = `${cellName}
        P[MW]: ${cell.p_mw ? cell.p_mw.toFixed(3) : 'N/A'}
        Q[MVar]: ${cell.q_mvar ? cell.q_mvar.toFixed(3) : 'N/A'}
        Um[pu]: ${cell.vm_pu ? cell.vm_pu.toFixed(3) : 'N/A'}
        U[degree]: ${cell.va_degree ? cell.va_degree.toFixed(3) : 'N/A'}
        Irradiance: ${cell.irradiance ? cell.irradiance.toFixed(3) : 'N/A'}
        Temperature: ${cell.temperature ? cell.temperature.toFixed(3) : 'N/A'}`;

                // Find existing placeholder and update it, or create new one if not found
                const placeholder = findPlaceholderForCellOpenDSS(grafka, resultCell, true);
                if (placeholder) {
                    grafka.getModel().setValue(placeholder, resultString);
                } else {
                    // Position PVSystem results below the element for better readability (PVSystems are typically larger)
                    const labelka = b.insertVertex(resultCell, null, resultString, 0, 3.0, 0, 0, 'shapeELXXX=Result', true);
                    processCellStyles(b, labelka);
                }
            } catch (error) {
                console.error(`Error processing PVSystem ${cell.id}:`, error);
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
    // Preserve original style to maintain shapeELXXX attributes for backward compatibility
    const currentStyle = b.getModel().getStyle(labelka) || '';
    
    // Extract shapeELXXX attributes from current style (for backward compatibility)
    const shapeELXXXMatch = currentStyle.match(/shapeELXXX=[^;]+/);
    const shapeELXXXAttr = shapeELXXXMatch ? shapeELXXXMatch[0] : '';
    
    // Apply individual style properties (setCellStyles preserves other properties)
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
    
    // Ensure shapeELXXX attribute is preserved (setCellStyles might not preserve it)
    if (shapeELXXXAttr) {
        const finalStyle = b.getModel().getStyle(labelka) || '';
        if (!finalStyle.includes(shapeELXXXAttr)) {
            const newStyle = finalStyle ? finalStyle + ';' + shapeELXXXAttr : shapeELXXXAttr;
            b.getModel().setStyle(labelka, newStyle);
        }
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
async function processNetworkData(url, obj, b, grafka, app, exportCommands = false) {
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
        
        // Log what is being sent to backend
        console.log('📤 SENDING TO BACKEND:', JSON.stringify(dataDict, null, 2));

        // Performance optimization: Request gzip compression
        const requestStart = performance.now();
        const response = await fetch(url, {
            mode: "cors",
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip",  // Request compressed response
            },
            body: JSON.stringify(dataDict) // Backend expects dict with string keys like {"0": {...}}
        });

        if (response.status !== 200) {
            throw new Error("server");
        }

        const dataJson = await response.json();
        const requestTime = performance.now() - requestStart;
        // Log what is received from backend
        console.log('📥 RECEIVED FROM BACKEND:', JSON.stringify(dataJson, null, 2));

        // Handle errors first
        if (handleNetworkErrors(dataJson)) {
            return;
        }

        // The simplified backend now returns data directly without output classes
        // Process each type of network element that might be present in the response
        console.log('Processing OpenDSS results...');
        const processingStart = performance.now();
        
        // PERFORMANCE OPTIMIZATION: Create cell ID lookup map once
        // This avoids O(n) cell searches for each of the 207 elements
        // Index by both mxObjectId and backend-returned id format (OpenDSS returns id with '#' not '_')
        const cellIdMap = new Map();
        const cells = b.getModel().cells;
        const mapBuildStart = performance.now();
        for (const cellId in cells) {
            const cell = cells[cellId];
            if (!cell) continue;
            const logicalId = cell.mxObjectId != null ? cell.mxObjectId : cell.id;
            if (logicalId != null && logicalId !== '') {
                cellIdMap.set(logicalId, cell);
                const backendId = String(logicalId).replace(/_/g, '#');
                if (backendId && backendId !== logicalId) {
                    cellIdMap.set(backendId, cell);
                }
            }
        }
        const mapBuildTime = performance.now() - mapBuildStart;
        console.log(`Built cell ID map with ${cellIdMap.size} entries in ${mapBuildTime.toFixed(1)}ms`);
        
        // BACKWARD COMPATIBILITY: Remove old-style result cells from old models
        // Old models had results as separate cells, not as children of components
        const oldResultsRemoved = removeOldStyleResultCells(grafka);
        if (oldResultsRemoved > 0) {
            console.log(`Backward compatibility: Removed ${oldResultsRemoved} old-style result cells`);
        }
        
        // Check for different possible response formats
        let processedCount = 0;
        
        // PERFORMANCE OPTIMIZATION: Batch all DOM updates
        // This prevents layout thrashing and improves rendering speed
        const model = b.getModel();
        model.beginUpdate();
        try {
            // Process busbars if present
            if (dataJson.busbars && Array.isArray(dataJson.busbars)) {
                console.log(`Processing ${dataJson.busbars.length} busbars`);
                elementProcessors.busbars(dataJson.busbars, b, grafka, cellIdMap);
                processedCount += dataJson.busbars.length;
            }
            
            // Process lines if present
            if (dataJson.lines && Array.isArray(dataJson.lines)) {
                console.log(`Processing ${dataJson.lines.length} lines`);
                elementProcessors.lines(dataJson.lines, b, grafka, cellIdMap);
                processedCount += dataJson.lines.length;
            }
            
            // Process loads if present
            if (dataJson.loads && Array.isArray(dataJson.loads)) {
                console.log(`Processing ${dataJson.loads.length} loads`);
                elementProcessors.loads(dataJson.loads, b, grafka, cellIdMap);
                processedCount += dataJson.loads.length;
            }
            
            // Process generators if present
            if (dataJson.generators && Array.isArray(dataJson.generators)) {
                console.log(`Processing ${dataJson.generators.length} generators`);
                elementProcessors.generators(dataJson.generators, b, grafka, cellIdMap);
                processedCount += dataJson.generators.length;
            }
            
            // Process transformers if present
            if (dataJson.transformers && Array.isArray(dataJson.transformers)) {
                console.log(`Processing ${dataJson.transformers.length} transformers`);
                elementProcessors.transformers(dataJson.transformers, b, grafka, cellIdMap);
                processedCount += dataJson.transformers.length;
            }
            
            // Process external grids if present
            if (dataJson.externalgrids && Array.isArray(dataJson.externalgrids)) {
                console.log(`Processing ${dataJson.externalgrids.length} external grids`);
                elementProcessors.externalgrids(dataJson.externalgrids, b, grafka, cellIdMap);
                processedCount += dataJson.externalgrids.length;
            }
            
            // Process shunts if present
            if (dataJson.shunts && Array.isArray(dataJson.shunts)) {
                console.log(`Processing ${dataJson.shunts.length} shunts`);
                elementProcessors.shunts(dataJson.shunts, b, grafka, cellIdMap);
                processedCount += dataJson.shunts.length;
            }
            
            // Process capacitors if present
            if (dataJson.capacitors && Array.isArray(dataJson.capacitors)) {
                console.log(`Processing ${dataJson.capacitors.length} capacitors`);
                elementProcessors.capacitors(dataJson.capacitors, b, grafka, cellIdMap);
                processedCount += dataJson.capacitors.length;
            }
            
            // Process storages if present
            if (dataJson.storages && Array.isArray(dataJson.storages)) {
                console.log(`Processing ${dataJson.storages.length} storages`);
                elementProcessors.storages(dataJson.storages, b, grafka, cellIdMap);
                processedCount += dataJson.storages.length;
            }

            // Process pvsystems if present
            if (dataJson.pvsystems && Array.isArray(dataJson.pvsystems)) {
                console.log(`Processing ${dataJson.pvsystems.length} PVSystems`);
                elementProcessors.pvsystems(dataJson.pvsystems, b, grafka, cellIdMap);
                processedCount += dataJson.pvsystems.length;
            }
        } finally {
            model.endUpdate();
        }
        if (grafka.getView && grafka.getView().revalidate) {
            grafka.getView().revalidate();
        }
        
        const processingTime = performance.now() - processingStart;
        console.log(`Processed ${processedCount} elements in ${processingTime.toFixed(0)}ms (${(processingTime/processedCount).toFixed(1)}ms per element)`);
        console.log(`Total round-trip time: ${(requestTime + processingTime).toFixed(0)}ms`);
        
        // Check if we processed any results
        if (processedCount === 0) {
            console.warn('No results were processed from the OpenDSS backend response');
            console.log('Available keys in response:', Object.keys(dataJson));

            // No results processed - log but don't show alert
            console.log('OpenDSS calculation completed but no results were processed');
        } else {
            console.log(`Successfully processed ${processedCount} OpenDSS results`);
            // Results processed successfully - log but don't show alert
            console.log(`OpenDSS calculation completed successfully! Processed ${processedCount} results.`);
        }

        // Handle OpenDSS commands export if requested
        if (exportCommands && dataJson.opendss_commands) {
            console.log('Exporting OpenDSS commands to file...');
            downloadOpenDSSCommands(dataJson.opendss_commands);
        }
        
        // Handle OpenDSS results export if requested
        // Note: exportOpenDSSResults flag should be passed through from parameters
            if (obj && obj[0] && obj[0].exportOpenDSSResults) {
                downloadOpenDSSResults(dataJson);
            }

    } catch (err) {
        if (err.message === "server") {
            // Still stop spinner on server error
            try {
                if (app && app.spinner) {
                    app.spinner.stop();
                }
            } catch (spinnerErr) {
                console.error('Error stopping spinner:', spinnerErr);
            }
            alert(
                'The backend server reported an error or did not respond.\n\n' +
                'Please try again in a few moments. If the problem persists, contact electrisim@electrisim.com for support.'
            );
            return;
        }
        // Connection failure (e.g. VPN / ERR_CERT_AUTHORITY_INVALID) – show VPN guidance
        if (err.message && (err.message === 'Failed to fetch' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
            console.error('Error connecting to backend (possible VPN/certificate issue):', err);
            alert(
                'Unable to connect to the calculation server.\n\n' +
                'This often happens when using a corporate VPN: the network\'s security (SSL inspection) can block the connection.\n\n' +
                'Try:\n' +
                '• Disconnect from VPN and run the calculation again\n' +
                '• Use another network or device\n' +
                '• Ask IT to allow the app backend or add your organisation\'s root certificate\n\n' +
                'If the problem persists, contact electrisim@electrisim.com'
            );
            return;
        }
        console.error('Error processing OpenDSS network data:', err);
        alert('Error processing OpenDSS network data: ' + err + '\n\nCheck input data or contact electrisim@electrisim.com');
    } finally {
        // Always try to stop the spinner
        console.log('Stopping spinner in finally block...');
        try {
            if (app && app.spinner) {
                console.log('Spinner found, stopping...');
                app.spinner.stop();
                console.log('Spinner stopped successfully');
            } else {
                console.warn('Spinner not found on app parameter');
            }
        } catch (spinnerErr) {
            console.error('Error stopping spinner:', spinnerErr);
        }
    }
}

// Error handler for OpenDSS
function handleNetworkErrors(dataJson) {
    if (dataJson.error) {
        alert(
            'OpenDSS calculation error: ' + dataJson.error + '\n\n' +
            'If the problem persists, please contact electrisim@electrisim.com for support.'
        );
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
        // Array format: [frequency, mode, algorithm, loadmodel, maxIterations, tolerance, controlmode, exportCommands]
        opendssParams = parameters;
    } else {
        // New format: object with named properties
        opendssParams = [
            parameters.frequency || '50',
            parameters.mode || 'Snapshot',
            parameters.algorithm || 'Normal',
            parameters.loadmodel || 'Powerflow',
            parameters.maxIterations || '100',
            parameters.tolerance || '0.0001',
            parameters.controlmode || 'Static',
            parameters.exportCommands || false
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
    // Reference: https://opendss.epri.com/PowerFlow.html
    const opendssData = {
        typ: "PowerFlowOpenDss Parameters",
        frequency: opendssParams[0],           // Base frequency (50 or 60 Hz)
        mode: opendssParams[1],                // Solution mode (Snapshot, Daily, Dutycycle, etc.)
        algorithm: opendssParams[2],           // Solution algorithm (Normal, Newton)
        loadmodel: opendssParams[3],           // Load model (Powerflow or Admittance)
        maxIterations: opendssParams[4],       // Maximum iterations
        tolerance: opendssParams[5],           // Convergence tolerance
        controlmode: opendssParams[6],         // Control mode (Static, Event, Time)
        exportCommands: opendssParams[7] || false,  // Export OpenDSS commands to file
        exportOpenDSSResults: parameters.exportOpenDSSResults || false,  // Export OpenDSS results to file
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

    // Warn if diagram contains Pandapower-only elements (they will not be included in OpenDSS calculation)
    const { message: incompatibleMsg } = getIncompatibleElements(networkData, 'opendss');
    if (incompatibleMsg) {
        if (typeof mxUtils !== 'undefined' && mxUtils.alert) {
            mxUtils.alert(incompatibleMsg);
        } else {
            alert(incompatibleMsg);
        }
    }

    // Combine parameters with network data
    const completeData = [opendssData, ...networkData];
    console.log('Complete OpenDSS data:', completeData);
    
    // Call the new processNetworkData function
    // Pass the exportCommands flag (opendssParams[7])
    const exportCommands = opendssParams[7] || false;
    console.log('🌐 Using backend URL:', ENV.backendUrl);
    processNetworkData(ENV.backendUrl + "/", completeData, graph, graph, app, exportCommands);
}

// Function to collect network data from the graph using the new structured approach
function collectNetworkDataStructured(graph) {
    // Global simulation counter for performance tracking
    if (!globalThis.openDssRunCount) {
        globalThis.openDssRunCount = 0;
    }
    globalThis.openDssRunCount++;
    const runNumber = globalThis.openDssRunCount;
    const startTime = performance.now();
            // OpenDSS data collection started - debug log removed
    
    // Initialize performance optimization caches
    const modelCache = new Map();
    const cellCache = new Map();
    const nameCache = new Map();
    const attributeCache = new Map();
    console.log('Starting fresh data collection with clean caches');
    
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
    const cellProcessingStart = performance.now();
    console.log(`Processing ${Object.keys(cells).length} cells for OpenDSS...`);
    
    // NOTE: No cleanup needed - we now FIND AND UPDATE existing placeholders
    // instead of removing them and creating new ones. This preserves placeholders
    // across different analysis types (Pandapower, OpenDSS, Short Circuit).
    console.log('OpenDSS will update existing result placeholders instead of removing them');
    
    let processedComponents = 0;
    const validCells = [];
    
    // First pass: collect valid cells
    for (const cellId in cells) {
        const cell = cells[cellId];
        if (cell && cell.value) {
            validCells.push({ cellId, cell });
        }
    }
    
    console.log(`Found ${validCells.length} valid cells to process`);
    
    // Process valid cells with optimized approach
    const componentProcessingStart = performance.now();
    
    for (const { cellId, cell } of validCells) {
        const cellValue = cell.value;
        let cellData = null;
        processedComponents++;
        
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
                        in_service: { name: 'in_service', optional: true },

                        // Short circuit parameters
                        r0_ohm_per_km: { name: 'r0_ohm_per_km', optional: true },
                        x0_ohm_per_km: { name: 'x0_ohm_per_km', optional: true },
                        c0_nf_per_km: { name: 'c0_nf_per_km', optional: true },
                        endtemp_degree: { name: 'endtemp_degree', optional: true },
                    });
                    
                    // Provide default values for critical Line parameters if they're missing
                    // Convert in_service from string to boolean (it's stored as string in XML attributes)
                    let inServiceValue = true;  // Default to true
                    if (lineParams.in_service !== undefined) {
                        if (typeof lineParams.in_service === 'boolean') {
                            inServiceValue = lineParams.in_service;
                        } else if (typeof lineParams.in_service === 'string') {
                            inServiceValue = lineParams.in_service.toLowerCase() === 'true';
                        }
                    }
                    
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
                        in_service: inServiceValue,  // Now included!
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
                    const connections = getTransformerConnections(cell, graph);
                    
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
                        tap_phase_shifter: 'tap_phase_shifter',
                        in_service: { name: 'in_service', optional: true }
                    });
                    
                    // Convert in_service from string to boolean
                    const transInService = transParams.in_service !== undefined 
                        ? (typeof transParams.in_service === 'string' ? transParams.in_service.toLowerCase() === 'true' : Boolean(transParams.in_service))
                        : true;
                    
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
                        tap_neutral: transParams.tap_neutral || 0,
                        tap_min: transParams.tap_min || -10,
                        tap_max: transParams.tap_max || 10,
                        tap_step_percent: transParams.tap_step_percent || 1.5,
                        tap_step_degree: transParams.tap_step_degree || 0.0,
                        tap_pos: transParams.tap_pos || 0,  // Default to 0 (neutral position)
                        tap_phase_shifter: transParams.tap_phase_shifter || false,
                        in_service: transInService
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
                        min_q_mvar: 'min_q_mvar',
                        in_service: { name: 'in_service', optional: true }
                    });
                    
                    const genInService = genParams.in_service !== undefined 
                        ? (typeof genParams.in_service === 'string' ? genParams.in_service.toLowerCase() === 'true' : Boolean(genParams.in_service))
                        : true;
                    
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
                        min_q_mvar: genParams.min_q_mvar || -5.0,
                        in_service: genInService
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
                        const_s_percent_abs_degree_abs_degree: 'const_s_percent_abs_degree_abs_degree',
                        in_service: { name: 'in_service', optional: true }
                    });
                    
                    const loadInService = loadParams.in_service !== undefined 
                        ? (typeof loadParams.in_service === 'string' ? loadParams.in_service.toLowerCase() === 'true' : Boolean(loadParams.in_service))
                        : true;
                    
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
                        in_service: loadInService,
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
                        p_mw: 'p_mw',           // Active power
                        q_mvar: 'q_mvar',       // Reactive power
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        // Additional parameters
                        step: 'step',
                        step_degree: 'step_degree',
                        step_min: 'step_min',
                        step_max: 'step_max',
                        step_pos: 'step_pos',
                        step_phase_shifter: 'step_phase_shifter',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const shuntInService = shuntParams.in_service !== undefined
                        ? (typeof shuntParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(shuntParams.in_service.toLowerCase())
                            : Boolean(shuntParams.in_service))
                        : true;
                    
                    cellData = {
                        typ: 'Shunt Reactor',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        p_mw: shuntParams.p_mw || 0.0,          // Default active power
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
                        step_phase_shifter: shuntParams.step_phase_shifter || false,
                        in_service: shuntInService
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
                        step_phase_shifter: 'step_phase_shifter',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const capInService = capParams.in_service !== undefined
                        ? (typeof capParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(capParams.in_service.toLowerCase())
                            : Boolean(capParams.in_service))
                        : true;
                    
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
                        step_phase_shifter: capParams.step_phase_shifter || false,
                        in_service: capInService
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
                        min_e_mwh: 'min_e_mwh',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const storageInService = storageParams.in_service !== undefined
                        ? (typeof storageParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(storageParams.in_service.toLowerCase())
                            : Boolean(storageParams.in_service))
                        : true;
                    
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
                        min_e_mwh: storageParams.min_e_mwh || 0.0,
                        in_service: storageInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Storage ${cellData.name}: bus=${cellData.bus}, P=${cellData.p_mw}MW, Q=${cellData.q_mvar}MVar`);
                    } else {
                        console.warn(`Storage ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'PVSystem') {
                    // This is a PVSystem element
                    const pvParams = getAttributesAsObject(cell, {
                        // Basic PVSystem parameters
                        irradiance: 'irradiance',
                        pmpp: 'pmpp',
                        temperature: 'temperature',
                        phases: 'phases',
                        kv: 'kv',
                        pf: 'pf',
                        kvar: 'kvar',
                        kva: 'kva',
                        cutin: 'cutin',
                        cutout: 'cutout',
                        effcurve: 'effcurve',
                        ptcurve: 'ptcurve',
                        r: 'r',
                        x: 'x',
                        // Additional parameters from OpenDSS docs
                        conn: 'conn',
                        model: 'model',
                        vmaxpu: 'vmaxpu',
                        vminpu: 'vminpu',
                        yearly: 'yearly',
                        daily: 'daily',
                        duty: 'duty',
                        tyearly: 'tyearly',
                        tdaily: 'tdaily',
                        tduty: 'tduty',
                        class_: 'class',
                        debugtrace: 'debugtrace',
                        spectrum: 'spectrum',
                        pminkvarmax: 'pminkvarmax',
                        pminnovars: 'pminnovars',
                        pmpp_percent: 'pmpp_percent',
                        amplimit: 'amplimit',
                        amplimitgain: 'amplimitgain',
                        balanced: 'balanced',
                        basefreq: 'basefreq',
                        controlmode: 'controlmode',
                        dutystart: 'dutystart',
                        dynamiceq: 'dynamiceq',
                        dynout: 'dynout',
                        kp: 'kp',
                        kvarmax: 'kvarmax',
                        kvarmaxabs: 'kvarmaxabs',
                        kvdc: 'kvdc',
                        limitcurrent: 'limitcurrent',
                        pfpriority: 'pfpriority',
                        pitol: 'pitol',
                        safemode: 'safemode',
                        safevoltage: 'safevoltage',
                        varfollowinverter: 'varfollowinverter',
                        wattpriority: 'wattpriority',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const pvInService = pvParams.in_service !== undefined
                        ? (typeof pvParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(pvParams.in_service.toLowerCase())
                            : Boolean(pvParams.in_service))
                        : true;

                    cellData = {
                        typ: 'PVSystem',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        // Use extracted parameters or defaults for critical values
                        irradiance: pvParams.irradiance || 1.0,
                        pmpp: pvParams.pmpp || 100.0,
                        temperature: pvParams.temperature || 25.0,
                        phases: pvParams.phases || 3,
                        kv: pvParams.kv || 20.0,
                        pf: pvParams.pf || 1.0,
                        kvar: pvParams.kvar || 0.0,
                        kva: pvParams.kva || 120.0,  // Default 20% above Pmpp
                        cutin: pvParams.cutin || 0.1,
                        cutout: pvParams.cutout || 0.1,
                        // Other parameters with defaults
                        conn: pvParams.conn || 'wye',
                        model: pvParams.model || 1,
                        vmaxpu: pvParams.vmaxpu || 1.1,
                        vminpu: pvParams.vminpu || 0.9,
                        yearly: pvParams.yearly || '',
                        daily: pvParams.daily || '',
                        duty: pvParams.duty || '',
                        tyearly: pvParams.tyearly || '',
                        tdaily: pvParams.tdaily || '',
                        tduty: pvParams.tduty || '',
                        class_: pvParams.class_ || 1,
                        debugtrace: pvParams.debugtrace || false,
                        spectrum: pvParams.spectrum || 'default',
                        pminkvarmax: pvParams.pminkvarmax || 0.0,
                        pminnovars: pvParams.pminnovars || 0.0,
                        pmpp_percent: pvParams.pmpp_percent || 100.0,
                        amplimit: pvParams.amplimit || 1.0,
                        amplimitgain: pvParams.amplimitgain || 0.8,
                        balanced: pvParams.balanced || false,
                        basefreq: pvParams.basefreq || 60.0,
                        controlmode: pvParams.controlmode || 'GFL',
                        dutystart: pvParams.dutystart || 0.0,
                        dynamiceq: pvParams.dynamiceq || '',
                        dynout: pvParams.dynout || '',
                        kp: pvParams.kp || 0.1,
                        kvarmax: pvParams.kvarmax || 120.0,
                        kvarmaxabs: pvParams.kvarmaxabs || 120.0,
                        kvdc: pvParams.kvdc || 20.0,
                        limitcurrent: pvParams.limitcurrent || false,
                        pfpriority: pvParams.pfpriority || false,
                        pitol: pvParams.pitol || 0.01,
                        safemode: pvParams.safemode || false,
                        safevoltage: pvParams.safevoltage || 0.8,
                        varfollowinverter: pvParams.varfollowinverter || false,
                        wattpriority: pvParams.wattpriority || false,
                        in_service: pvInService
                    };

                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`PVSystem ${cellData.name}: bus=${cellData.bus}, Pmpp=${cellData.pmpp}kW, Irradiance=${cellData.irradiance}kW/m²`);
                    } else {
                        console.warn(`PVSystem ${cellData.name} missing bus connection`);
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
                        x0x_max: 'x0x_max',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const extGridInService = extGridParams.in_service !== undefined
                        ? (typeof extGridParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(extGridParams.in_service.toLowerCase())
                            : Boolean(extGridParams.in_service))
                        : true;
                    
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
                        x0x_max: extGridParams.x0x_max || 1.0,
                        in_service: extGridInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`External Grid ${cellData.name}: bus=${cellData.bus}, vm_pu=${cellData.vm_pu}, va_degree=${cellData.va_degree}`);
                    } else {
                        console.warn(`External Grid ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Three Winding Transformer') {
                    // This is a three winding transformer element
                    const connections = getTransformerConnections(cell, graph);
                    
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
                            shift_lv_degree: 'shift_lv_degree',
                            in_service: { name: 'in_service', optional: true }
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
                    const impedanceParams = getAttributesAsObject(cell, {
                        r_ohm: 'r_ohm',
                        x_ohm: 'x_ohm',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const impedanceInService = impedanceParams.in_service !== undefined
                        ? (typeof impedanceParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(impedanceParams.in_service.toLowerCase())
                            : Boolean(impedanceParams.in_service))
                        : true;

                    cellData = {
                        typ: 'Impedance',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        r_ohm: impedanceParams.r_ohm || 0.0,
                        x_ohm: impedanceParams.x_ohm || 0.0,
                        sn_mva: impedanceParams.sn_mva || 1.0,
                        scaling: impedanceParams.scaling || 1.0,
                        type: impedanceParams.type || 'impedance',
                        in_service: impedanceInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Impedance ${cellData.name}: bus=${cellData.bus}, R=${cellData.r_ohm}Ω, X=${cellData.x_ohm}Ω`);
                    } else {
                        console.warn(`Impedance ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Ward') {
                    // This is a ward element
                    const wardParams = getAttributesAsObject(cell, {
                        pz_mw: 'pz_mw',
                        qz_mvar: 'qz_mvar',
                        ps_mw: 'ps_mw',
                        qs_mvar: 'qs_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const wardInService = wardParams.in_service !== undefined
                        ? (typeof wardParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(wardParams.in_service.toLowerCase())
                            : Boolean(wardParams.in_service))
                        : true;

                    cellData = {
                        typ: 'Ward',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        pz_mw: wardParams.pz_mw || 0.0,
                        qz_mvar: wardParams.qz_mvar || 0.0,
                        ps_mw: wardParams.ps_mw || 0.0,
                        qs_mvar: wardParams.qs_mvar || 0.0,
                        sn_mva: wardParams.sn_mva || 1.0,
                        scaling: wardParams.scaling || 1.0,
                        type: wardParams.type || 'ward',
                        in_service: wardInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`Ward ${cellData.name}: bus=${cellData.bus}, PZ=${cellData.pz_mw}MW, QZ=${cellData.qz_mvar}MVar`);
                            } else {
                        console.warn(`Ward ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'Extended Ward') {
                    // This is an extended ward element
                    const extWardParams = getAttributesAsObject(cell, {
                        pz_mw: 'pz_mw',
                        qz_mvar: 'qz_mvar',
                        ps_mw: 'ps_mw',
                        qs_mvar: 'qs_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        r_ohm: 'r_ohm',
                        x_ohm: 'x_ohm',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const extWardInService = extWardParams.in_service !== undefined
                        ? (typeof extWardParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(extWardParams.in_service.toLowerCase())
                            : Boolean(extWardParams.in_service))
                        : true;

                    cellData = {
                        typ: 'Extended Ward',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        pz_mw: extWardParams.pz_mw || 0.0,
                        qz_mvar: extWardParams.qz_mvar || 0.0,
                        ps_mw: extWardParams.ps_mw || 0.0,
                        qs_mvar: extWardParams.qs_mvar || 0.0,
                        sn_mva: extWardParams.sn_mva || 1.0,
                        scaling: extWardParams.scaling || 1.0,
                        type: extWardParams.type || 'extended_ward',
                        r_ohm: extWardParams.r_ohm || 0.0,
                        x_ohm: extWardParams.x_ohm || 0.0,
                        in_service: extWardInService
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
                        current_source: 'current_source',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const motorInService = motorParams.in_service !== undefined
                        ? (typeof motorParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(motorParams.in_service.toLowerCase())
                            : Boolean(motorParams.in_service))
                        : true;
                    
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
                        current_source: motorParams.current_source || false,
                        in_service: motorInService
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
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const svcInService = svcParams.in_service !== undefined
                        ? (typeof svcParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(svcParams.in_service.toLowerCase())
                            : Boolean(svcParams.in_service))
                        : true;
                    
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
                        type: svcParams.type || 'svc',
                        in_service: svcInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`SVC ${cellData.name}: bus=${cellData.bus}, Q=${cellData.q_mvar}MVar, vm_set_pu=${cellData.vm_set_pu}`);
                    } else {
                        console.warn(`SVC ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'TCSC') {
                    // This is a TCSC element
                    const tcscParams = getAttributesAsObject(cell, {
                        x_l_ohm: 'x_l_ohm',
                        x_c_ohm: 'x_c_ohm',
                        x_par_ohm: 'x_par_ohm',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const tcscInService = tcscParams.in_service !== undefined
                        ? (typeof tcscParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(tcscParams.in_service.toLowerCase())
                            : Boolean(tcscParams.in_service))
                        : true;

                    cellData = {
                        typ: 'TCSC',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        x_l_ohm: tcscParams.x_l_ohm || 0.0,
                        x_c_ohm: tcscParams.x_c_ohm || 0.0,
                        x_par_ohm: tcscParams.x_par_ohm || 0.0,
                        sn_mva: tcscParams.sn_mva || 1.0,
                        scaling: tcscParams.scaling || 1.0,
                        type: tcscParams.type || 'tcsc',
                        in_service: tcscInService
                    };
                    
                    // Validate bus connection
                    if (cellData.bus) {
                        console.log(`TCSC ${cellData.name}: bus=${cellData.bus}, XL=${cellData.x_l_ohm}Ω, XC=${cellData.x_c_ohm}Ω`);
    } else {
                        console.warn(`TCSC ${cellData.name} missing bus connection`);
                    }
                } else if (styleObj && styleObj.shapeELXXX === 'SSC') {
                    // This is an SSC element
                    const sscParams = getAttributesAsObject(cell, {
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const sscInService = sscParams.in_service !== undefined
                        ? (typeof sscParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(sscParams.in_service.toLowerCase())
                            : Boolean(sscParams.in_service))
                        : true;

                    cellData = {
                        typ: 'SSC',
                        name: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id).replace('#', '_') : `mxCell_${cellId}`,
                        id: (cell.mxObjectId || cell.id) ? (cell.mxObjectId || cell.id) : `mxCell_${cellId}`,
                        bus: getConnectedBusId(cell),
                        p_mw: sscParams.p_mw || 0.0,
                        q_mvar: sscParams.q_mvar || 0.0,
                        sn_mva: sscParams.sn_mva || 1.0,
                        scaling: sscParams.scaling || 1.0,
                        type: sscParams.type || 'ssc',
                        in_service: sscInService
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
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const dcLineInService = dcLineParams.in_service !== undefined
                        ? (typeof dcLineParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(dcLineParams.in_service.toLowerCase())
                            : Boolean(dcLineParams.in_service))
                        : true;
                    
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
                        type: dcLineParams.type || 'dc_line',
                        in_service: dcLineInService
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
                        current_source: 'current_source',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const staticGenInService = staticGenParams.in_service !== undefined
                        ? (typeof staticGenParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(staticGenParams.in_service.toLowerCase())
                            : Boolean(staticGenParams.in_service))
                        : true;
                    
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
                        current_source: staticGenParams.current_source || false,
                        in_service: staticGenInService
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
                        current_source: 'current_source',
                        in_service: { name: 'in_service', optional: true }
                    });

                    const asymStaticGenInService = asymStaticGenParams.in_service !== undefined
                        ? (typeof asymStaticGenParams.in_service === 'string'
                            ? !['false', 'no', '0'].includes(asymStaticGenParams.in_service.toLowerCase())
                            : Boolean(asymStaticGenParams.in_service))
                        : true;
                    
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
                        current_source: asymStaticGenParams.current_source || false,
                        in_service: asymStaticGenInService
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
    
    const componentProcessingTime = performance.now() - componentProcessingStart;
    const cellProcessingTime = performance.now() - cellProcessingStart;
    const totalProcessingTime = performance.now() - startTime;
    
    // OpenDSS performance summary - debug log removed
    console.log(`Run #${runNumber} - Cell processing: ${cellProcessingTime.toFixed(2)}ms`);
    console.log(`Component processing: ${componentProcessingTime.toFixed(2)}ms`);
    console.log(`Total processing: ${totalProcessingTime.toFixed(2)}ms`);
    console.log(`Components processed: ${processedComponents}`);
    console.log(`Network elements collected: ${networkData.length}`);
    
    // Clean up caches to prevent memory accumulation
    console.log(`Data collection completed. Cache sizes - cells: ${cellCache.size}, names: ${nameCache.size}, attributes: ${attributeCache.size}`);
    cellCache.clear();
    nameCache.clear();
    attributeCache.clear();
    console.log('Caches cleared for next data collection');
    
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
                const voltage = attr.nodeValue;
                // Return only if it's a valid non-empty value
                if (voltage && voltage !== '' && voltage !== 'null' && voltage !== 'undefined') {
                    return voltage;
                }
            }
        }
        
        // If no vn_kv attribute, try to parse from the cell value text
        if (typeof cellValue === 'string') {
            if (cellValue.includes('110kV')) {
                return '110';
            } else if (cellValue.includes('20kV')) {
                return '20';
            } else if (cellValue.includes('30kV')) {
                return '30';
            } else if (cellValue.includes('10kV')) {
                return '10';
            }
        }
    }
    
    // No default voltage - return null to indicate missing voltage
    // This will cause backend validation to catch the error
    return null;
}

// Function to execute Pandapower load flow calculation
function executePandapowerLoadFlow(parameters, app, graph) {
        // Debug logs removed - only backend communication logs shown

    // Collect network data to check for OpenDSS-only elements (they will not be included in Pandapower calculation)
    let networkData = [];
    if (graph) {
        networkData = collectNetworkDataStructured(graph);
        if (networkData.length === 0 && window.App && window.App.editor && window.App.editor.graph) {
            networkData = collectNetworkDataStructured(window.App.editor.graph);
        }
    }
    const { message: incompatibleMsg } = getIncompatibleElements(networkData, 'pandapower');
    if (incompatibleMsg) {
        if (typeof mxUtils !== 'undefined' && mxUtils.alert) {
            mxUtils.alert(incompatibleMsg);
        } else {
            alert(incompatibleMsg);
        }
    }
    
    // Start the spinner
    app.spinner.spin(document.body, "Waiting for Pandapower results...");
    
    // If parameters is already an object with all properties, pass it directly
    // This preserves exportPython and other flags!
    if (typeof parameters === 'object' && !Array.isArray(parameters) && parameters.frequency) {
            // Parameters processing - debug log removed
        executePandapowerCoreLogic(parameters, app, graph);
    } else {
        // Legacy array format support
        console.log('⚠️ Converting array format to object (legacy path)');
        const pandapowerParams = [
            parameters.frequency || parameters[0] || '50',
            parameters.algorithm || parameters[1] || 'nr',
            parameters.calculate_voltage_angles || parameters[2] || 'auto',
            parameters.initialization || parameters[3] || 'auto'
        ];
        
        console.log('Converted pandapower parameters:', pandapowerParams);
        executePandapowerCoreLogic(pandapowerParams, app, graph);
    }
}

// Function to execute pandapower core logic without showing dialog
function executePandapowerCoreLogic(parameters, app, graph) {
        // Core logic execution - debug logs removed
    
    // Convert old array format to new object format
    let paramObject;
    if (Array.isArray(parameters)) {
        console.log('⚠️ Array format detected - converting to object (exportPython, run_control will be false)');
        paramObject = {
            frequency: parameters[0] || '50',
            algorithm: parameters[1] || 'nr',
            calculate_voltage_angles: parameters[2] || 'auto',
            initialization: parameters[3] || 'auto',
            exportPython: false,  // Default to false for this legacy path
            run_control: false,
            engine: 'pandapower'
        };
    } else if (typeof parameters === 'object' && parameters !== null) {
            // Object format detected - debug logs removed
        // Parameters is already an object, use it directly (preserves exportPython, run_control, etc.!)
        const runControl = parameters.run_control === true || parameters.run_control === 'true';
        paramObject = {
            frequency: parameters.frequency || '50',
            algorithm: parameters.algorithm || 'nr',
            calculate_voltage_angles: parameters.calculate_voltage_angles || 'auto',
            initialization: parameters.initialization || 'auto',
            exportPython: parameters.exportPython || false,  // PRESERVE the user's choice!
            exportPandapowerResults: parameters.exportPandapowerResults || false,  // PRESERVE results export choice!
            enforceLimits: parameters.enforceLimits || false,  // Also preserve other checkboxes
            run_control: runControl,  // Include controllers (DiscreteTapControl) for Pandapower
            engine: parameters.engine || 'pandapower'
        };
            // Final parameter values - debug logs removed
    } else {
        console.warn('⚠️ Unexpected parameters format:', typeof parameters);
        paramObject = {
            frequency: '50',
            algorithm: 'nr',
            calculate_voltage_angles: 'auto',
            initialization: 'auto',
            exportPython: false,
            run_control: false,
            engine: 'pandapower'
        };
    }
    
    // Store the original show method
    const originalShow = window.LoadFlowDialog.prototype.show;
    console.log('Original LoadFlowDialog.prototype.show:', originalShow);
    
    try {
        // Temporarily override the show method on the prototype
        window.LoadFlowDialog.prototype.show = function(callback) {
            console.log('Overridden LoadFlowDialog.show called, immediately calling callback with param OBJECT:', paramObject);
            // Parameter values passed to callback - debug logs removed
            // Call the callback with the object format
            callback(paramObject);
        };
        
        console.log('Replaced LoadFlowDialog.prototype.show with dummy version');
        
        // Now call the original loadFlowPandaPower function - any dialog created will use our overridden show method
        console.log('Calling original loadFlowPandaPower with overridden show method');
        globalThis.loadFlowPandaPower(app, graph, null);
        console.log('loadFlowPandaPower called successfully');
        
    } catch (error) {
        console.error('Error executing pandapower load flow:', error);
        app.spinner.stop();
        alert(
            'Error executing Pandapower load flow: ' + error.message + '\n\n' +
            'If the problem persists, please contact electrisim@electrisim.com for support.'
        );
    } finally {
        // Restore the original show method
        console.log('Restoring original LoadFlowDialog.prototype.show:', originalShow);
        window.LoadFlowDialog.prototype.show = originalShow;
    }
}

// Function to process pandapower backend call
async function processPandapowerBackend(obj, graph) {
    try {
        console.log('🌐 Using backend URL:', ENV.backendUrl);
        const response = await fetch(ENV.backendUrl + "/", {
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
        alert(
            'Error in Pandapower calculation: ' + error.message + '\n\n' +
            'If the problem persists, please contact electrisim@electrisim.com for support.'
        );
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
