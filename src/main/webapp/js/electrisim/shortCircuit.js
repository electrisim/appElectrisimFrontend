// Import COMPONENT_TYPES from the utils
import { COMPONENT_TYPES } from './utils/componentTypes.js';
import { getAttributesAsObject } from './utils/attributeUtils.js';
import { ShortCircuitDialog } from './dialogs/ShortCircuitDialog.js';

// Make the shortCircuit function available globally
window.shortCircuitPandaPower = function(a, b, c) {
    let apka = a;
    let grafka = b;

    // Create counters object
    const counters = {
        externalGrid: 0,
        generator: 0,
        staticGenerator: 0,
        asymmetricGenerator: 0,
        busbar: 0,
        transformer: 0,
        threeWindingTransformer: 0,
        shuntReactor: 0,
        capacitor: 0,
        load: 0,
        asymmetricLoad: 0,
        impedance: 0,
        ward: 0,
        extendedWard: 0,
        motor: 0,
        storage: 0,
        SVC: 0,
        TCSC: 0,
        SSC: 0,
        dcLine: 0,
        line: 0
    };

    // Create arrays for different components
    const componentArrays = {
        simulationParameters: [],
        externalGrid: [],
        generator: [],
        staticGenerator: [],
        asymmetricGenerator: [],
        busbar: [],
        transformer: [],
        threeWindingTransformer: [],
        shuntReactor: [],
        capacitor: [],
        load: [],
        asymmetricLoad: [],
        impedance: [],
        ward: [],
        extendedWard: [],
        motor: [],
        storage: [],
        SVC: [],
        TCSC: [],
        SSC: [],
        dcLine: [],
        line: []
    };

    // Cache styles and configurations
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

    // Helper function to format numbers
    const formatNumber = (num, decimals = 3) => {
        // Handle NaN, null, undefined, or string 'NaN' values
        if (num === null || num === undefined || num === 'NaN' || (typeof num === 'number' && isNaN(num))) {
            return 'N/A';
        }
        return parseFloat(num).toFixed(decimals);
    };
    const replaceUnderscores = name => name.replace('_', '#');

    // Error handler
    function handleNetworkErrors(dataJson) {
        // Check for diagnostic response format (new error handling)
        if (dataJson.error && dataJson.diagnostic) {
            console.log('Short Circuit failed with diagnostic information:', dataJson);
            if (window.DiagnosticReportDialog) {
                const diagnosticDialog = new window.DiagnosticReportDialog(dataJson.diagnostic);
                diagnosticDialog.show();
            } else {
                alert(`Short Circuit calculation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return true;
        }

        // Legacy error handling
        const errorTypes = {
            'line': 'Line',
            'bus': 'Bus',
            'ext_grid': 'External Grid',
            'trafo3w': 'Three-winding transformer: nominal voltage does not match',
            'overload': 'One of the element is overloaded. The load flow did not converge. Contact electrisim@electrisim.com'
        };

        if (!dataJson[0]) return false;

        const errorType = Array.isArray(dataJson[0]) ? dataJson[0][0] : dataJson[0];

        if (errorType === 'trafo3w' || errorType === 'overload') {
            alert(errorTypes[errorType]);
            return true;
        }

        if (errorTypes[errorType]) {
            for (let i = 1; i < dataJson.length; i++) {
                alert(`${errorTypes[errorType]}${dataJson[i][0]} ${dataJson[i][1]} = ${dataJson[i][2]} (restriction: ${dataJson[i][3]})\nPower Flow did not converge`);
            }
            return true;
        }

        return false;
    }


    // Network element processors (FROM BACKEND TO FRONTEND)
    const elementProcessors = {
        busbars: (data, b, grafka) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                cell.name = replaceUnderscores(cell.name);

                const resultString = `${resultCell.value.attributes[0].nodeValue}
                ikss[kA]: ${formatNumber(cell.ikss_ka)}
                ip[kA]: ${formatNumber(cell.ip_ka)}
                ith[kA]: ${formatNumber(cell.ith_ka)}
                rk[ohm]: ${formatNumber(cell.rk_ohm)}
                xk[ohm]: ${formatNumber(cell.xk_ohm)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, 0.2, 4.5, 0, 0, 'shapeELXXX=Result', true);
                //processCellStyles(b, labelka);
            });
        },

    };

    // Main processing function (FROM BACKEND TO FRONTEND)
    async function processNetworkData(url, obj, b, grafka) {
        try {
            // Initialize styles once
            b.getStylesheet().putCellStyle('labelstyle', STYLES.label);
            b.getStylesheet().putCellStyle('lineStyle', STYLES.line);

            const response = await fetch(url, {
                mode: "cors",
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(obj)
            });

            if (response.status !== 200) {
                throw new Error("server");
            }

            const dataJson = await response.json();
            console.log('dataJson')
            console.log(dataJson)

            // Handle errors first
            if (handleNetworkErrors(dataJson)) {
                return;
            }

            // Process each type of network element
            Object.entries(elementProcessors).forEach(([type, processor]) => {
                if (dataJson[type]) {
                    processor(dataJson[type], b, grafka);
                }
            });

        } catch (err) {
            if (err.message === "server") return;
            alert('Error processing network data.' + err + '\n \nCheck input data or contact electrisim@electrisim.com');
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    // Helper functions for transformer connections (imported from loadFlow.js logic)
    
    // Helper function for regular transformer connections  
    const updateTransformerBusConnections = (transformerArray, busbarArray, graphModel) => {
        const getTransformerCell = (transformerId) => {
            const cell = graphModel.getModel().getCell(transformerId);
            if (!cell) {
                throw new Error(`Invalid transformer cell: ${transformerId}`);
            }
            return cell;
        };

        const updateTransformerStyle = (cell, color) => {
            const style = graphModel.getModel().getStyle(cell);
            const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
            graphModel.setCellStyle(newStyle, [cell]);
        };

        const findConnectedBusbars = (hvBusName, lvBusName) => {
            const bus1 = busbarArray.find(element => element.name === hvBusName);
            const bus2 = busbarArray.find(element => element.name === lvBusName);

            if (!bus1 || !bus2) {
                throw new Error("Transformer is not connected to valid busbars.");
            }

            return [bus1, bus2];
        };

        const sortBusbarsByVoltage = (busbars) => {
            if (busbars.length !== 2) {
                throw new Error("Transformer requires exactly two busbars.");
            }

            const [bus1, bus2] = busbars;
            const voltage1 = parseFloat(bus1.vn_kv);
            const voltage2 = parseFloat(bus2.vn_kv);

            return voltage1 > voltage2 ? 
                { highVoltage: bus1.name, lowVoltage: bus2.name } :
                { highVoltage: bus2.name, lowVoltage: bus1.name };
        };

        const processTransformer = (transformer) => {
            const transformerCell = getTransformerCell(transformer.id);

            try {
                const connectedBusbars = findConnectedBusbars(transformer.hv_bus, transformer.lv_bus);
                updateTransformerStyle(transformerCell, 'black');
                const { highVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

                return {
                    ...transformer,
                    hv_bus: highVoltage,
                    lv_bus: lowVoltage
                };

            } catch (error) {
                console.log(`Error processing transformer ${transformer.id}:`, error.message);
                updateTransformerStyle(transformerCell, 'red');
                alert('The transformer is not connected to the bus. Please check the transformer highlighted in red and connect it to the appropriate bus.');
                return transformer;
            }
        };

        return transformerArray.map(transformer => processTransformer(transformer));
    };

    // Helper function for three-winding transformer connections
    const updateThreeWindingTransformerConnections = (threeWindingTransformerArray, busbarArray, graphModel) => {
        const getTransformerCell = (transformerId) => {
            const cell = graphModel.getModel().getCell(transformerId);
            if (!cell) {
                throw new Error(`Invalid three-winding transformer cell: ${transformerId}`);
            }
            return cell;
        };

        const updateTransformerStyle = (cell, color) => {
            const style = graphModel.getModel().getStyle(cell);
            const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
            graphModel.setCellStyle(newStyle, [cell]);
        };

        const findConnectedBusbars = (hvBusName, mvBusName, lvBusName) => {
            const bus1 = busbarArray.find(element => element.name === hvBusName);
            const bus2 = busbarArray.find(element => element.name === mvBusName);
            const bus3 = busbarArray.find(element => element.name === lvBusName);

            if (!bus1 || !bus2 || !bus3) {
                throw new Error("Three-winding transformer is not connected to valid busbars.");
            }

            return [bus1, bus2, bus3];
        };

        const sortBusbarsByVoltage = (busbars) => {
            if (busbars.length !== 3) {
                throw new Error("Three-winding transformer requires exactly three busbars.");
            }

            const busbarWithHighestVoltage = busbars.reduce((prev, current) =>
                parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
            );

            const busbarWithLowestVoltage = busbars.reduce((prev, current) =>
                parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
            );

            const busbarWithMiddleVoltage = busbars.find(
                element => element.name !== busbarWithHighestVoltage.name &&
                    element.name !== busbarWithLowestVoltage.name
            );

            return {
                highVoltage: busbarWithHighestVoltage.name,
                mediumVoltage: busbarWithMiddleVoltage.name,
                lowVoltage: busbarWithLowestVoltage.name
            };
        };

        const processThreeWindingTransformer = (transformer) => {
            const transformerCell = getTransformerCell(transformer.id);

            try {
                const connectedBusbars = findConnectedBusbars(
                    transformer.hv_bus,
                    transformer.mv_bus,
                    transformer.lv_bus
                );

                updateTransformerStyle(transformerCell, 'black');
                const { highVoltage, mediumVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

                return {
                    ...transformer,
                    hv_bus: highVoltage,
                    mv_bus: mediumVoltage,
                    lv_bus: lowVoltage
                };

            } catch (error) {
                console.log(`Error processing three-winding transformer ${transformer.id}:`, error.message);
                updateTransformerStyle(transformerCell, 'red');
                alert('The three-winding transformer is not connected to the bus. Please check the three-winding transformer highlighted in red and connect it to the appropriate bus.');
                return transformer;
            }
        };

        return threeWindingTransformerArray.map(transformer =>
            processThreeWindingTransformer(transformer)
        );
    };

    // Helper functions for getting connections
    const getConnectedBusId = (cell, isLine = false) => {
        if (isLine) {                 
            return {            
                busFrom: cell.source?.mxObjectId?.replace('#', '_'),
                busTo: cell.target?.mxObjectId?.replace('#', '_')
            };            
        }
        const edge = cell.edges[0];
        if (!edge) {
            return null;
        }

        if (!edge.target && !edge.source) {
            return null;
        }

        if (edge.target && edge.target.mxObjectId !== cell.mxObjectId) {
            return edge.target.mxObjectId.replace('#', '_');
        } else if (edge.source && edge.source.mxObjectId !== cell.mxObjectId) {
            return edge.source.mxObjectId.replace('#', '_');
        }
        
        return null;
    };

    const getThreeWindingConnections = (cell) => {
        const [lvEdge, mvEdge, hvEdge] = cell.edges;
        const getConnectedBus = (edge) =>
            (edge.target.mxObjectId !== cell.mxObjectId ?
                edge.target.mxObjectId : edge.source.mxObjectId).replace('#', '_');

        return {
            hv_bus: getConnectedBus(hvEdge),
            mv_bus: getConnectedBus(mvEdge),
            lv_bus: getConnectedBus(lvEdge)
        };
    };

    const getTransformerConnections = (cell) => {
        const [hvEdge, lvEdge] = cell.edges;
        const getConnectedBus = (edge) =>
            (edge.target.mxObjectId !== cell.mxObjectId ?
                edge.target.mxObjectId : edge.source.mxObjectId).replace('#', '_');

        return {
            hv_bus: getConnectedBus(hvEdge),
            lv_bus: getConnectedBus(lvEdge)
        };
    };

    // Add other helper functions that might be missing
    const getConnectedBuses = (cell) => {
        // For lines, use the direct source/target approach like in getConnectedBusId(cell, true)
        // This matches the approach used in loadFlow.js
        return {
            busFrom: cell.source?.mxObjectId?.replace('#', '_'),
            busTo: cell.target?.mxObjectId?.replace('#', '_')
        };
    };

    const getImpedanceConnections = (cell) => {
        if (!cell.edges || cell.edges.length < 2) {
            throw new Error(`Impedance ${cell.mxObjectId} must be connected to exactly two buses`);
        }
        
        const [edge1, edge2] = cell.edges;
        
        const getBusId = (edge) => {
            if (edge.target && edge.target.mxObjectId !== cell.mxObjectId) {
                return edge.target.mxObjectId.replace('#', '_');
            } else if (edge.source && edge.source.mxObjectId !== cell.mxObjectId) {
                return edge.source.mxObjectId.replace('#', '_');
            }
            throw new Error(`Invalid edge connection for impedance ${cell.mxObjectId}`);
        };

        return {
            busFrom: getBusId(edge1),
            busTo: getBusId(edge2)
        };
    };

    const parseCellStyle = (styleString) => {
        if (!styleString) return null;
        
        const styleObj = {};
        const pairs = styleString.split(';');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                styleObj[key] = value;
            }
        });
        
        return styleObj;
    };

    const validateBusConnections = (cell) => {
        const connections = getConnectedBuses(cell);
        if (!connections.busFrom || !connections.busTo) {
            throw new Error(`Line ${cell.mxObjectId} is not connected to two buses`);
        }
        
        return true;
    };

    // Main function execution
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use modern ShortCircuitDialog directly
        const dialog = new ShortCircuitDialog(a);
        dialog.show(function (a, c) {
        
        // Global simulation counter for performance tracking
        if (!globalThis.shortCircuitRunCount) {
            globalThis.shortCircuitRunCount = 0;
        }
        globalThis.shortCircuitRunCount++;
        const runNumber = globalThis.shortCircuitRunCount;
        const startTime = performance.now();
        console.log(`=== SHORT CIRCUIT SIMULATION #${runNumber} STARTED ===`);
        
        // Initialize performance optimization caches
        const modelCache = new Map();
        const cellCache = new Map();
        const nameCache = new Map();
        const attributeCache = new Map();
        console.log('Starting fresh simulation with clean caches');
        
        // Cache commonly used functions and values
        const getModel = b.getModel.bind(b);
        const model = getModel();
        
        // Get all cells using multiple comprehensive methods to ensure we catch result cells
        let cellsArray = model.getDescendants();
        
        // Also try to get cells from the root parent to ensure we get all children
        const defaultParent = b.getDefaultParent();
        const childCells = model.getChildCells(defaultParent, true, true);
        
        // Get all cells from the model's cells object (most comprehensive)
        const allModelCells = [];
        const modelCells = model.cells;
        if (modelCells) {
            for (const cellId in modelCells) {
                const cell = modelCells[cellId];
                if (cell) {
                    allModelCells.push(cell);
                }
            }
        }
        
        // Combine and deduplicate cells
        const allCellIds = new Set();
        const combinedCells = [];
        
        [...cellsArray, ...childCells, ...allModelCells].forEach(cell => {
            if (cell && cell.id && !allCellIds.has(cell.id)) {
                allCellIds.add(cell.id);
                combinedCells.push(cell);
            }
        });
        
        cellsArray = combinedCells;
        console.log(`Processing ${cellsArray.length} cells (descendants: ${model.getDescendants().length}, children: ${childCells.length}, model.cells: ${allModelCells.length})...`);
        console.log(`Initial memory check - cellsArray length: ${cellsArray.length}`);

        // SIMPLE DIRECT RESULT CLEANUP: Use the working pattern from contingencyAnalysis.js
        console.log('=== DIRECT RESULT CLEANUP ===');
        const directCleanupStart = performance.now();
        let directlyRemoved = 0;
        
        // Use content-based detection for short circuit result cells
        model.beginUpdate();
        try {
            for (let i = cellsArray.length - 1; i >= 0; i--) {
                const cell = cellsArray[i];
                if (cell && cell.getValue) {
                    const value = cell.getValue();
                    const style = cell.getStyle();
                    
                    // Check for result cell by style (original approach)
                    if (style && style.includes("Result")) {
                        console.log(`Removing result cell by style: ${cell.id} - Style: ${style}`);
                        model.remove(model.getCell(cell.id));
                        directlyRemoved++;
                        continue;
                    }
                    
                    // Check for result cell by content patterns (NEW - based on your example)
                    if (value && typeof value === 'string') {
                        const lowerValue = value.toLowerCase();
                        // Short circuit specific patterns
                        if (lowerValue.includes('ikss[ka]') || 
                            lowerValue.includes('ip[ka]') || 
                            lowerValue.includes('ith[ka]') ||
                            lowerValue.includes('rk[ohm]') ||
                            lowerValue.includes('xk[ohm]') ||
                            // Load flow patterns that might remain from previous calculations
                            (lowerValue.includes('u[pu]') && lowerValue.includes('p[mw]')) ||
                            (lowerValue.includes('u[degree]') && lowerValue.includes('q[mvar]')) ||
                            lowerValue.includes('pf:') ||
                            lowerValue.includes('q/p:')) {
                            console.log(`Removing result cell by content: ${cell.id} - Value snippet: ${value.substring(0, 100).replace(/\n/g, ' ')}...`);
                            model.remove(model.getCell(cell.id));
                            directlyRemoved++;
                        }
                    }
                }
            }
        } finally {
            model.endUpdate();
        }
        
        const directCleanupTime = performance.now() - directCleanupStart;
        console.log(`Direct cleanup completed: ${directlyRemoved} cells removed in ${directCleanupTime.toFixed(2)}ms`);
        console.log('=== END DIRECT CLEANUP ===');
        
        // Force a graph refresh/repaint to ensure visual cleanup
        if (directlyRemoved > 0) {
            console.log('Forcing graph refresh after result cleanup...');
            try {
                b.refresh();
                if (b.view && b.view.validate) {
                    b.view.validate();
                }
                if (b.repaint) {
                    b.repaint();
                }
            } catch (refreshError) {
                console.warn('Graph refresh error (non-critical):', refreshError);
            }
            
            // Refresh cellsArray after cleanup
            cellsArray = model.getDescendants();
            console.log(`Updated cellsArray length after cleanup and refresh: ${cellsArray.length}`);
        }

        apka.spinner.spin(document.body, "Waiting for results...")

        if (a.length > 0) {
            // Get current user email with robust fallback
            function getUserEmail() {
                try {
                    // First try: direct localStorage access (most reliable)
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        if (user && user.email) {
                            return user.email;
                        }
                    }
                    
                    // Second try: global getCurrentUser function
                    if (typeof getCurrentUser === 'function') {
                        const currentUser = getCurrentUser();
                        if (currentUser && currentUser.email) {
                            return currentUser.email;
                        }
                    }
                    
                    // Third try: window.getCurrentUser
                    if (window.getCurrentUser && typeof window.getCurrentUser === 'function') {
                        const currentUser = window.getCurrentUser();
                        if (currentUser && currentUser.email) {
                            return currentUser.email;
                        }
                    }
                    
                    // Fourth try: authHandler
                    if (window.authHandler && window.authHandler.getCurrentUser) {
                        const currentUser = window.authHandler.getCurrentUser();
                        if (currentUser && currentUser.email) {
                            return currentUser.email;
                        }
                    }
                    
                    // Fallback
                    return 'unknown@user.com';
                } catch (error) {
                    console.warn('Error getting user email:', error);
                    return 'unknown@user.com';
                }
            }
            
            const userEmail = getUserEmail();
            console.log('Short Circuit - User email:', userEmail); // Debug log
            
            componentArrays.simulationParameters.push({
                typ: "ShortCircuitPandaPower Parameters",
                fault_type: a[0],
                fault_location: a[1],
                fault_impedance: a[2],
                user_email: userEmail  // Add user email to simulation data
            });

            // Process cells with performance optimization
            const cellProcessingStart = performance.now();
            
            // First pass: collect result cells to remove and valid cells to process
            const resultCellsToRemove = [];
            const validCells = [];
            
            cellsArray.forEach(cell => {
                // Check for result cells by style OR content
                const cellStyle = cell.getStyle();
                const value = cell.getValue();
                
                // Style-based detection
                if (cellStyle && cellStyle.includes("Result")) {
                    resultCellsToRemove.push(cell);
                    return;
                }
                
                // Content-based detection (for result labels like your example)
                if (value && typeof value === 'string') {
                    const lowerValue = value.toLowerCase();
                    if (// Short circuit patterns
                        lowerValue.includes('ikss[ka]') || 
                        lowerValue.includes('ip[ka]') || 
                        lowerValue.includes('ith[ka]') ||
                        lowerValue.includes('rk[ohm]') ||
                        lowerValue.includes('xk[ohm]') ||
                        // Load flow patterns that might remain
                        (lowerValue.includes('u[pu]') && lowerValue.includes('p[mw]')) ||
                        (lowerValue.includes('u[degree]') && lowerValue.includes('q[mvar]')) ||
                        lowerValue.includes('pf:') ||
                        lowerValue.includes('q/p:') ||
                        lowerValue.includes('loading[%]') ||
                        lowerValue.includes('i_hv[ka]') ||
                        lowerValue.includes('i_mv[ka]') ||
                        lowerValue.includes('i_lv[ka]') ||
                        lowerValue.includes('i_from[ka]') ||
                        lowerValue.includes('i_to[ka]') ||
                        lowerValue.includes('pl[mw]') ||
                        lowerValue.includes('vm[pu]') ||
                        lowerValue.includes('va[degree]') ||
                        lowerValue.includes('um[pu]') ||
                        // Static Generator and other component standalone patterns
                        lowerValue.includes('p[mw]:') ||
                        lowerValue.includes('q[mvar]:') ||
                        // SSC specific patterns
                        lowerValue.includes('q_mvar:') ||
                        lowerValue.includes('vm_internal_pu:') ||
                        lowerValue.includes('va_internal_degree:') ||
                        lowerValue.includes('vm_pu:') ||
                        lowerValue.includes('va_degree:') ||
                        // TCSC and SVC patterns
                        lowerValue.includes('firing angle[degree]:') ||
                        lowerValue.includes('x[ohm]:') ||
                        lowerValue.includes('q[mvar]:') ||
                        lowerValue.includes('p_from[mw]:') ||
                        lowerValue.includes('q_from[mvar]:') ||
                        lowerValue.includes('p_to[mw]:') ||
                        lowerValue.includes('q_to[mvar]:') ||
                        lowerValue.includes('p_l[mw]:') ||
                        lowerValue.includes('q_l[mvar]:') ||
                        lowerValue.includes('vm_from[pu]:') ||
                        lowerValue.includes('va_from[degree]:') ||
                        lowerValue.includes('vm_to[pu]:') ||
                        lowerValue.includes('va_to[degree]:') ||
                        // Asymmetric patterns
                        lowerValue.includes('p_a[mw]:') ||
                        lowerValue.includes('q_a[mvar]:') ||
                        lowerValue.includes('p_b[mw]:') ||
                        lowerValue.includes('q_b[mvar]:') ||
                        lowerValue.includes('p_c[mw]:') ||
                        lowerValue.includes('q_c[mvar]:') ||
                        // Impedance patterns
                        lowerValue.includes('pl[mw]:') ||
                        lowerValue.includes('ql[mvar]:')) {
                        resultCellsToRemove.push(cell);
                        return;
                    }
                }

                const style = parseCellStyle(cellStyle);
                if (!style) return;

                const componentType = style.shapeELXXX;
                if (!componentType || componentType == 'NotEditableLine') return;
                
                validCells.push({ cell, style, componentType });
            });
            
            // Batch remove result cells for better performance
            let resultCellsRemoved = 0;
            const removalStart = performance.now();
            
            // Debug: Log what we found for result cells
            console.log(`Found ${resultCellsToRemove.length} result cells to remove`);
            if (resultCellsToRemove.length > 0) {
                console.log('Result cells details:');
                resultCellsToRemove.forEach((cell, index) => {
                    console.log(`  ${index + 1}. ID: ${cell.id}, Style: ${cell.getStyle()}, Value: ${typeof cell.value === 'string' ? cell.value.substring(0, 50) + '...' : cell.value}`);
                });
            }
            
            if (resultCellsToRemove.length > 0) {
                console.log(`Removing ${resultCellsToRemove.length} result cells from previous short circuit simulation...`);
                try {
                    model.beginUpdate();
                    resultCellsToRemove.forEach(cell => {
                        const cellToRemove = model.getCell(cell.id);
                        if (cellToRemove) {
                            model.remove(cellToRemove);
                            resultCellsRemoved++;
                            console.log(`Removed result cell: ${cell.id}`);
                        } else {
                            console.warn(`Could not find cell to remove: ${cell.id}`);
                        }
                    });
                } finally {
                    model.endUpdate();
                }
                console.log(`Successfully removed ${resultCellsRemoved} result cells`);
            } else {
                console.log('No result cells to remove (first run or already clean)');
            }
            
            const removalTime = performance.now() - removalStart;
            const cellProcessingTime = performance.now() - cellProcessingStart;
            console.log(`Cell processing: ${cellProcessingTime.toFixed(2)}ms (removed ${resultCellsRemoved} result cells in ${removalTime.toFixed(2)}ms, found ${validCells.length} valid cells)`);

            // Process valid cells with optimized attribute extraction
            const componentProcessingStart = performance.now();
            let processedComponents = 0;
            
            validCells.forEach(({ cell, style, componentType }) => {
                processedComponents++;
                
                // Create base data for component
                let baseData;
                if (componentType === 'Line' || componentType === 'DCLine') {
                    baseData = {
                        name: cell.mxObjectId.replace('#', '_'),
                        id: cell.id,
                        bus: getConnectedBusId(cell, true)
                    };
                } else {
                    baseData = {
                        name: cell.mxObjectId.replace('#', '_'),
                        id: cell.id,
                        bus: getConnectedBusId(cell)
                    };
                }

                // Process each component type
                switch (componentType) {
                    case COMPONENT_TYPES.EXTERNAL_GRID:
                        const externalGrid = {
                            ...baseData,
                            typ: `External Grid${counters.externalGrid++}`,
                            ...getAttributesAsObject(cell, {
                                vm_pu: 'vm_pu',
                                va_degree: 'va_degree',
                                s_sc_max_mva: 's_sc_max_mva',
                                s_sc_min_mva: 's_sc_min_mva',
                                rx_max: 'rx_max',
                                rx_min: 'rx_min',
                                r0x0_max: 'r0x0_max',
                                x0x_max: 'x0x_max'
                            })
                        };
                        componentArrays.externalGrid.push(externalGrid);
                        break;

                    case COMPONENT_TYPES.GENERATOR:
                        const generator = {
                            ...baseData,
                            typ: "Generator",
                            ...getAttributesAsObject(cell, {
                                p_mw: 'p_mw',
                                vm_pu: 'vm_pu',
                                sn_mva: 'sn_mva',
                                scaling: 'scaling',
                                vn_kv: 'vn_kv',
                                xdss_pu: 'xdss_pu',
                                rdss_ohm: 'rdss_ohm',
                                cos_phi: 'cos_phi',
                                pg_percent: 'pg_percent',
                                power_station_trafo: 'power_station_trafo'
                            })
                        };
                        componentArrays.generator.push(generator);
                        counters.generator++;
                        break;

                    case COMPONENT_TYPES.STATIC_GENERATOR:
                        const staticGenerator = {
                            ...baseData,
                            typ: "Static Generator",
                            ...getAttributesAsObject(cell, {
                                p_mw: 'p_mw',
                                q_mvar: 'q_mvar',
                                sn_mva: 'sn_mva',
                                scaling: 'scaling',
                                type: 'type',
                                k: 'k',
                                rx: 'rx',
                                generator_type: 'generator_type',
                                lrc_pu: 'lrc_pu',
                                max_ik_ka: 'max_ik_ka',
                                kappa: 'kappa',
                                current_source: 'current_source'
                            })
                        };
                        componentArrays.staticGenerator.push(staticGenerator);
                        counters.staticGenerator++;
                        break;
                    case COMPONENT_TYPES.ASYMMETRIC_STATIC_GENERATOR:
                        const asymmetricGenerator = {
                            ...baseData,
                            typ: `Asymmetric Static Generator${counters.asymmetricGenerator++}`,
                            ...getAttributesAsObject(cell, {
                                p_a_mw: 'p_a_mw',
                                p_b_mw: 'p_b_mw',
                                p_c_mw: 'p_c_mw',
                                q_a_mvar: 'q_a_mvar',
                                q_b_mvar: 'q_b_mvar',
                                q_c_mvar: 'q_c_mvar',
                                sn_mva: 'sn_mva',
                                scaling: 'scaling',
                                type: 'type'
                            })
                        };
                        componentArrays.asymmetricGenerator.push(asymmetricGenerator);
                        break;

                    case COMPONENT_TYPES.BUS:
                        const busbar = {
                            typ: `Bus${counters.busbar++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            vn_kv: cell.value.attributes[2].nodeValue
                        };
                        componentArrays.busbar.push(busbar);
                        break;

                    case COMPONENT_TYPES.TRANSFORMER:
                        const { hv_bus, lv_bus } = getTransformerConnections(cell);
                        const transformer = {
                            typ: `Transformer${counters.transformer++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            hv_bus,
                            lv_bus,
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                sn_mva: 'sn_mva',
                                vn_hv_kv: 'vn_hv_kv',
                                vn_lv_kv: 'vn_lv_kv',

                                // Short circuit parameters
                                vkr_percent: 'vkr_percent',
                                vk_percent: 'vk_percent',
                                pfe_kw: 'pfe_kw',
                                i0_percent: 'i0_percent',
                                vector_group: { name: 'vector_group', optional: true },
                                vk0_percent: { name: 'vk0_percent', optional: true },
                                vkr0_percent: { name: 'vkr0_percent', optional: true },
                                mag0_percent: { name: 'mag0_percent', optional: true },
                                si0_hv_partial: { name: 'si0_hv_partial', optional: true },

                                // Optional parameters
                                parallel: { name: 'parallel', optional: true },
                                shift_degree: { name: 'shift_degree', optional: true },
                                tap_side: { name: 'tap_side', optional: true },
                                tap_pos: { name: 'tap_pos', optional: true },
                                tap_neutral: { name: 'tap_neutral', optional: true },
                                tap_max: { name: 'tap_max', optional: true },
                                tap_min: { name: 'tap_min', optional: true },
                                tap_step_percent: { name: 'tap_step_percent', optional: true },
                                tap_step_degree: { name: 'tap_step_degree', optional: true },
                                tap_phase_shifter: { name: 'tap_phase_shifter', optional: true }
                            })
                        };
                        componentArrays.transformer.push(transformer);
                        break;

                    case COMPONENT_TYPES.THREE_WINDING_TRANSFORMER:
                        const connections = getThreeWindingConnections(cell);
                        const threeWindingTransformer = {
                            typ: `Three Winding Transformer${counters.threeWindingTransformer++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            ...connections,
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                sn_hv_mva: 'sn_hv_mva',
                                sn_mv_mva: 'sn_mv_mva',
                                sn_lv_mva: 'sn_lv_mva',
                                vn_hv_kv: 'vn_hv_kv',
                                vn_mv_kv: 'vn_mv_kv',
                                vn_lv_kv: 'vn_lv_kv',
                                vk_hv_percent: 'vk_hv_percent',
                                vk_mv_percent: 'vk_mv_percent',
                                vk_lv_percent: 'vk_lv_percent',

                                // Short circuit parameters
                                vkr_hv_percent: 'vkr_hv_percent',
                                vkr_mv_percent: 'vkr_mv_percent',
                                vkr_lv_percent: 'vkr_lv_percent',
                                pfe_kw: 'pfe_kw',
                                i0_percent: 'i0_percent',
                                vk0_hv_percent: 'vk0_hv_percent',
                                vk0_mv_percent: 'vk0_mv_percent',
                                vk0_lv_percent: 'vk0_lv_percent',
                                vkr0_hv_percent: 'vkr0_hv_percent',
                                vkr0_mv_percent: 'vkr0_mv_percent',
                                vkr0_lv_percent: 'vkr0_lv_percent',
                                vector_group: 'vector_group',

                                // Optional parameters
                                shift_mv_degree: { name: 'shift_mv_degree', optional: true },
                                shift_lv_degree: { name: 'shift_lv_degree', optional: true },
                                tap_step_percent: { name: 'tap_step_percent', optional: true },
                                tap_side: { name: 'tap_side', optional: true },
                                tap_neutral: { name: 'tap_neutral', optional: true },
                                tap_min: { name: 'tap_min', optional: true },
                                tap_max: { name: 'tap_max', optional: true },
                                tap_pos: { name: 'tap_pos', optional: true },
                                tap_at_star_point: { name: 'tap_at_star_point', optional: true }
                            })
                        };
                        componentArrays.threeWindingTransformer.push(threeWindingTransformer);
                        break;

                    case COMPONENT_TYPES.SHUNT_REACTOR:
                        const shuntReactor = {
                            typ: `Shunt Reactor${counters.shuntReactor++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                p_mw: 'p_mw',
                                q_mvar: 'q_mvar',
                                vn_kv: 'vn_kv',
                                // Optional parameters
                                step: { name: 'step', optional: true },
                                max_step: { name: 'max_step', optional: true }
                            })
                        };
                        componentArrays.shuntReactor.push(shuntReactor);
                        break;

                    case COMPONENT_TYPES.CAPACITOR:
                        const capacitor = {
                            typ: `Capacitor${counters.capacitor++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                q_mvar: 'q_mvar',
                                loss_factor: 'loss_factor',
                                vn_kv: 'vn_kv',
                                // Optional parameters
                                step: { name: 'step', optional: true },
                                max_step: { name: 'max_step', optional: true }
                            })
                        };
                        componentArrays.capacitor.push(capacitor);
                        break;
                    case COMPONENT_TYPES.LOAD:
                        const load = {
                            typ: `Load${counters.load++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                p_mw: 'p_mw',
                                q_mvar: 'q_mvar',
                                const_z_percent: 'const_z_percent',
                                const_i_percent: 'const_i_percent',
                                sn_mva: 'sn_mva',
                                scaling: 'scaling',
                                type: 'type'
                            })
                        };
                        componentArrays.load.push(load);
                        break;

                    case COMPONENT_TYPES.ASYMMETRIC_LOAD:
                        const asymmetricLoad = {
                            typ: `Asymmetric Load${counters.asymmetricLoad++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                p_a_mw: 'p_a_mw',
                                p_b_mw: 'p_b_mw',
                                p_c_mw: 'p_c_mw',
                                q_a_mvar: 'q_a_mvar',
                                q_b_mvar: 'q_b_mvar',
                                q_c_mvar: 'q_c_mvar',
                                sn_mva: 'sn_mva',
                                scaling: 'scaling',
                                type: 'type'
                            })
                        };
                        componentArrays.asymmetricLoad.push(asymmetricLoad);
                        break;

                    case COMPONENT_TYPES.IMPEDANCE:
                        try {
                            const impedance = {
                                typ: `Impedance${counters.impedance++}`,
                                name: cell.mxObjectId.replace('#', '_'),
                                id: cell.id,
                                ...getImpedanceConnections(cell),
                                ...getAttributesAsObject(cell, {
                                    // Load flow parameters
                                    rft_pu: 'rft_pu',
                                    xft_pu: 'xft_pu',
                                    sn_mva: 'sn_mva'
                                })
                            };
                            componentArrays.impedance.push(impedance);
                        } catch (error) {
                            alert(error.message);
                        }
                        break;

                    case COMPONENT_TYPES.WARD:
                        const ward = {
                            typ: `Ward${counters.ward++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                ps_mw: 'ps_mw',
                                qs_mvar: 'qs_mvar',
                                pz_mw: 'pz_mw',
                                qz_mvar: 'qz_mvar'
                            })
                        };
                        componentArrays.ward.push(ward);
                        break;

                    case COMPONENT_TYPES.EXTENDED_WARD:
                        const extendedWard = {
                            typ: `Extended Ward${counters.extendedWard++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                ps_mw: 'ps_mw',
                                qs_mvar: 'qs_mvar',
                                pz_mw: 'pz_mw',
                                qz_mvar: 'qz_mvar',
                                r_ohm: 'r_ohm',
                                x_ohm: 'x_ohm',
                                vm_pu: 'vm_pu'
                            })
                        };
                        componentArrays.extendedWard.push(extendedWard);
                        break;

                    case COMPONENT_TYPES.MOTOR:
                        const motor = {
                            typ: `Motor${counters.motor++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                pn_mech_mw: 'pn_mech_mw',
                                cos_phi: 'cos_phi',
                                efficiency_percent: 'efficiency_percent',
                                loading_percent: 'loading_percent',
                                scaling: 'scaling',
                                cos_phi_n: 'cos_phi_n',
                                efficiency_n_percent: 'efficiency_n_percent',
                                Irc_pu: 'Irc_pu',
                                rx: 'rx',
                                vn_kv: 'vn_kv',
                                efficiency_percent: 'efficiency_percent',
                                loading_percent: 'loading_percent',
                                scaling: 'scaling'
                            })
                        };
                        componentArrays.motor.push(motor);
                        break;

                    case COMPONENT_TYPES.STORAGE:
                        const storage = {
                            typ: `Storage${counters.storage++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                p_mw: 'p_mw',
                                max_e_mwh: 'max_e_mwh',
                                q_mvar: 'q_mvar',
                                sn_mva: 'sn_mva',
                                soc_percent: 'soc_percent',
                                min_e_mwh: 'min_e_mwh',
                                scaling: 'scaling',
                                type: 'type'
                            })
                        };
                        componentArrays.storage.push(storage);
                        break;

                    case COMPONENT_TYPES.SVC:
                        const SVC = {
                            typ: `SVC${counters.SVC++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                x_l_ohm: 'x_l_ohm',
                                x_cvar_ohm: 'x_cvar_ohm',
                                set_vm_pu: 'set_vm_pu',
                                thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                                controllable: 'controllable',
                                min_angle_degree: 'min_angle_degree',
                                max_angle_degree: 'max_angle_degree'
                            })
                        };
                        componentArrays.SVC.push(SVC);
                        break;

                    case COMPONENT_TYPES.TCSC:
                        const TCSC = {
                            typ: `TCSC${counters.TCSC++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters
                                x_l_ohm: 'x_l_ohm',
                                x_cvar_ohm: 'x_cvar_ohm',
                                set_p_to_mw: 'set_p_to_mw',
                                thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                                controllable: 'controllable',
                                min_angle_degree: 'min_angle_degree',
                                max_angle_degree: 'max_angle_degree'
                            })
                        };
                        componentArrays.TCSC.push(TCSC);
                        break;

                    case COMPONENT_TYPES.SSC:
                        const SSC = {
                            typ: `SSC${counters.SSC++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters                       
                                r_ohm: 'r_ohm',
                                x_ohm: 'x_ohm',
                                set_vm_pu: 'set_vm_pu',
                                vm_internal_pu: 'vm_internal_pu',
                                va_internal_degree: 'va_internal_degree',
                                controllable: 'controllable'
                            })
                        };
                        componentArrays.SSC.push(SSC);
                        break;

                    case COMPONENT_TYPES.DC_LINE:
                        const dcLine = {
                            typ: `DC Line${counters.dcLine++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            bus: getConnectedBusId(cell),
                            ...getAttributesAsObject(cell, {
                                // Load flow parameters                       
                                p_mw: 'p_mw',
                                loss_percent: 'loss_percent',
                                loss_mw: 'loss_mw',
                                vm_from_pu: 'vm_from_pu',
                                vm_to_pu: 'vm_to_pu'
                            })
                        };
                        componentArrays.dcLine.push(dcLine);
                        break;

                    case COMPONENT_TYPES.LINE:
                        try {
                            console.log('Processing line:', cell.mxObjectId);
                            console.log('Line edges:', cell.edges?.length || 0);
                            console.log('Line connections:', cell.edges?.map(edge => ({
                                source: edge.source?.mxObjectId,
                                target: edge.target?.mxObjectId
                            })));
                            
                            const line = {
                                typ: `Line${counters.line++}`,
                                name: cell.mxObjectId.replace('#', '_'),
                                id: cell.id,
                                ...getConnectedBuses(cell),
                                ...getAttributesAsObject(cell, {
                                    // Basic parameters
                                    length_km: 'length_km',
                                    parallel: { name: 'parallel', optional: true },
                                    df: { name:'df', optional: true },

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
                                })
                            };

                            // Validate bus connections
                            try {
                                validateBusConnections(cell);
                                //setCellStyle(cell, { strokeColor: 'black' });
                            } catch (error) {
                                console.error(error.message);
                                //setCellStyle(cell, { strokeColor: 'red' });
                                alert('The line is not connected to the bus. Please check the line highlighted in red and connect it to the appropriate bus.');
                            }

                            componentArrays.line.push(line);
                        } catch (error) {
                            console.error(error.message);
                            alert('Error processing line. Please check the console for more details.');
                        }
                        break;
                }
            });
            
            const componentProcessingTime = performance.now() - componentProcessingStart;
            console.log(`Component processing: ${componentProcessingTime.toFixed(2)}ms (${processedComponents} components)`);

            //b - graphModel 
            if (componentArrays.transformer.length > 0) {
                componentArrays.transformer = updateTransformerBusConnections(componentArrays.transformer, componentArrays.busbar, b);
            }
            if (componentArrays.threeWindingTransformer.length > 0) {
                componentArrays.threeWindingTransformer = updateThreeWindingTransformerConnections(componentArrays.threeWindingTransformer, componentArrays.busbar, b);
            }

            // Combine all arrays
            const array = [
                ...componentArrays.simulationParameters,
                ...componentArrays.externalGrid,
                ...componentArrays.generator,
                ...componentArrays.staticGenerator,
                ...componentArrays.asymmetricGenerator,
                ...componentArrays.busbar,
                ...componentArrays.transformer,
                ...componentArrays.threeWindingTransformer,
                ...componentArrays.shuntReactor,
                ...componentArrays.capacitor,
                ...componentArrays.load,
                ...componentArrays.asymmetricLoad,
                ...componentArrays.impedance,
                ...componentArrays.ward,
                ...componentArrays.extendedWard,
                ...componentArrays.SSC,
                ...componentArrays.SVC,
                ...componentArrays.TCSC,
                ...componentArrays.line
            ];

            const obj = Object.assign({}, array);
            console.log('Short Circuit data prepared:', JSON.stringify(obj));
            
            // Log performance summary
            const totalProcessingTime = performance.now() - startTime;
            console.log(`=== SHORT CIRCUIT PERFORMANCE SUMMARY ===`);
            console.log(`Run #${runNumber} - Total processing: ${totalProcessingTime.toFixed(2)}ms`);
            console.log(`Components processed: ${processedComponents}`);
            console.log(`Result cells removed: ${resultCellsRemoved}`);
            
            // Clean up caches to prevent memory accumulation
            console.log(`Simulation completed. Cache sizes - cells: ${cellCache.size}, names: ${nameCache.size}, attributes: ${attributeCache.size}`);
            cellCache.clear();
            nameCache.clear();
            attributeCache.clear();
            console.log('Caches cleared for next simulation');

            // Process network data
            processNetworkData("https://03dht3kc-5000.euw.devtunnels.ms/", obj, b, grafka);
        }
        });
    }
}

// Also export it as a module
export const shortCircuitPandaPower = window.shortCircuitPandaPower;



