//define buses to which the cell is connected
const getConnectedBusId = (cell, isLine = false) => {
    //console.log('cell in getConnectedBusId', cell);

    if (isLine) {                 
        return {            
            busFrom: cell.source?.mxObjectId?.replace('#', '_'),
            busTo: cell.target?.mxObjectId?.replace('#', '_')
        };            
    }
    const edge = cell.edges[0];
    // First check if edge exists
    if (!edge) {
        return null; // or some default value
    }

    // Then check if both target and source exist before accessing their properties
    if (!edge.target && !edge.source) {
        return null; // or some default value
    }

    // Make sure we're not accessing mxObjectId from a null object
    const bus = edge.target && edge.target.mxObjectId !== cell.mxObjectId ?
        (edge.target ? edge.target.mxObjectId : null) : 
        (edge.source ? edge.source.mxObjectId : null);

    // Only try to replace if bus is not null
    return bus ? bus.replace('#', '_') : null;
    /*        
    const edge = cell.edges[0];
        const bus = edge.target.mxObjectId !== cell.mxObjectId ?
            edge.target.mxObjectId : edge.source.mxObjectId;
    return bus.replace('#', '_');*/
};

 // Helper function to parse cell style
 const parseCellStyle = (style) => {
    if (!style) return null;
    const pairs = style.split(';').map(pair => pair.split('='));
    return Object.fromEntries(pairs);
};

// Helper function to get attributes as object
const getAttributesAsObject = (cell, attributeMap) => {
    const result = {};
    //console.log('cell in getAttributes', cell);

    // Make sure cell has all the required properties
    if (!cell || !cell.value || !cell.value.attributes) {
        console.warn('Cell is missing required properties');
        return result;
    }

    // Get all available attributes
    const attributes = cell.value.attributes;

    // Process each requested attribute by name instead of index
    for (const [key, config] of Object.entries(attributeMap)) {
        const isOptional = typeof config === 'object' && config.optional;
        const attributeName = typeof config === 'object' ? config.name : config;

        // Debug logging for parallel and df parameters
        if (key === 'parallel' || key === 'df') {
            console.log(`\n=== DEBUG: Extracting ${key} ===`);
            console.log(`Looking for attribute name: ${attributeName}`);
            console.log(`Cell has ${attributes.length} attributes:`);
            for (let i = 0; i < attributes.length; i++) {
                console.log(`  [${i}] ${attributes[i].nodeName} = ${attributes[i].nodeValue}`);
            }
        }

        // Find the attribute by name in the attributes collection
        let found = false;
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].nodeName === attributeName) {
                result[key] = attributes[i].nodeValue;
                found = true;
                if (key === 'parallel' || key === 'df') {
                    console.log(`✓ Found ${key}: ${attributes[i].nodeValue}`);
                }
                break;
            }
        }

        if (!found && !isOptional) {
            console.warn(`Missing required attribute ${key} with name ${attributeName}`);
            result[key] = null;
        } else if (!found && isOptional) {
            // For optional parameters, include them with default values if not found
            if (key === 'parallel') {
                console.log(`⚠ ${key} not found, using default value: 1`);
                result[key] = '1';  // Default parallel lines/transformers
            } else if (key === 'df') {
                console.log(`⚠ ${key} not found, using default value: 1.0`);
                result[key] = '1.0';  // Default derating factor
            } else if (key === 'vector_group') {
                console.log(`⚠ ${key} not found, using default value: Dyn11`);
                result[key] = 'Dyn11';  // Default vector group
            } else if (key === 'vk0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Will be set to vk_percent in backend if needed
            } else if (key === 'vkr0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Will be set to vkr_percent in backend if needed
            } else if (key === 'mag0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Default zero sequence magnetizing current
            } else if (key === 'si0_hv_partial') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Default zero sequence partial current
            }
            // Note: Other optional parameters can be left undefined as they truly are optional
        }
    }

    return result;
};

// Add helper function for transformer bus connections
const getTransformerConnections = (cell) => {
    const hvEdge = cell.edges[0];
    const lvEdge = cell.edges[1];

    return {
        hv_bus: (hvEdge.target.mxObjectId !== cell.mxObjectId ?
            hvEdge.target.mxObjectId : hvEdge.source.mxObjectId).replace('#', '_'),
        lv_bus: (lvEdge.target.mxObjectId !== cell.mxObjectId ?
            lvEdge.target.mxObjectId : lvEdge.source.mxObjectId).replace('#', '_')
    };
};

//update Transformer connections 
const updateTransformerBusConnections = (transformerArray, busbarArray, graphModel) => {
    const getTransformerCell = (transformerId) => {
        const cell = graphModel.getModel().getCell(transformerId);
        if (!cell) {
            throw new Error(`Invalid transformer cell: ${transformerId}`);
        }
        return cell;
    };

    const updateTransformerStyle = (cell) => {
        const style = graphModel.getModel().getStyle(cell);
        const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, 'black');
        if (newStyle) {
            graphModel.setCellStyle(newStyle, [cell]);
        }
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
        if (busbars.length === 0) {
            throw new Error("No valid busbars found for transformer.");
        }

        const busbarWithHighestVoltage = busbars.reduce((prev, current) =>
            parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
        );

        const busbarWithLowestVoltage = busbars.reduce((prev, current) =>
            parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
        );

        return {
            highVoltage: busbarWithHighestVoltage.name,
            lowVoltage: busbarWithLowestVoltage.name
        };
    };

    const processTransformer = (transformer) => {
        try {
            // Get and validate transformer cell
            const transformerCell = getTransformerCell(transformer.id);

            // Update transformer style
            updateTransformerStyle(transformerCell);

            // Find connected busbars
            const connectedBusbars = findConnectedBusbars(
                transformer.hv_bus,
                transformer.lv_bus
            );

            // Sort busbars by voltage and update transformer connections
            const { highVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

            return {
                ...transformer,
                hv_bus: highVoltage,
                lv_bus: lowVoltage
            };
        } catch (error) {

            alert(`Error processing transformer ${transformer.id}:`, error.message)
            return transformer; // Return original transformer data if processing fails
        }
    };

    // Process all transformers
    return transformerArray.map(transformer => processTransformer(transformer));
};
//update 3WTransformer connections 
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

    //update 3WTransformer connections
    const processThreeWindingTransformer = (transformer) => {
        const transformerCell = getTransformerCell(transformer.id);

        try {
            // Find connected busbars
            const connectedBusbars = findConnectedBusbars(
                transformer.hv_bus,
                transformer.mv_bus,
                transformer.lv_bus
            );

            // Update transformer style to black (normal state)
            updateTransformerStyle(transformerCell, 'black');

            // Sort busbars by voltage and update transformer connections
            const { highVoltage, mediumVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

            return {
                ...transformer,
                hv_bus: highVoltage,
                mv_bus: mediumVoltage,
                lv_bus: lowVoltage
            };

        } catch (error) {
            console.log(`Error processing three-winding transformer ${transformer.id}:`, error.message);

            // Update transformer style to red (error state)
            updateTransformerStyle(transformerCell, 'red');

            // Show alert for user
            alert('The three-winding transformer is not connected to the bus. Please check the three-winding transformer highlighted in red and connect it to the appropriate bus.');

            return transformer; // Return original transformer data if processing fails
        }
    };

    // Process all three-winding transformers
    return threeWindingTransformerArray.map(transformer =>
        processThreeWindingTransformer(transformer)
    );
};


// Add helper function for three-winding transformer connections
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


// Add helper function for impedance connections
const getImpedanceConnections = (cell) => {
    try {
        const [fromEdge, toEdge] = cell.edges;
        return {
            busFrom: (fromEdge.target.mxObjectId !== cell.mxObjectId ?
                fromEdge.target.mxObjectId : fromEdge.source.mxObjectId).replace('#', '_'),
            busTo: (toEdge.target.mxObjectId !== cell.mxObjectId ?
                toEdge.target.mxObjectId : toEdge.source.mxObjectId).replace('#', '_')
        };
    } catch {
        throw new Error("Connect an impedance's 'in' and 'out' to other element in the model. The impedance has not been taken into account in the simulation.");
    }
};

// Helper functions for LINE
function getConnectedBuses(cell) {
    return {
        busFrom: cell.source?.mxObjectId?.replace('#', '_'),
        busTo: cell.target?.mxObjectId?.replace('#', '_')
    };
}

function validateBusConnections(cell) {
    if (!cell.source?.mxObjectId) {
        throw new Error(`Error: cell.source or its mxObjectId is null or undefined`);
    }
    if (!cell.target?.mxObjectId) {
        throw new Error(`Error: cell.target or its mxObjectId is null or undefined`);
    }
}

// Define component types as constants
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

import { DIALOG_STYLES } from './utils/dialogStyles.js';
import { LoadFlowDialog } from './dialogs/LoadFlowDialog.js';

function loadFlowPandaPower(a, b, c) {

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


    //*********FROM FRONTEND TO BACKEND **************/
    // Cache commonly used functions and values
    const getModel = b.getModel.bind(b);
    const model = getModel();
    const cellsArray = model.getDescendants();   
       
    function setCellStyle(cell, styles) {
        let currentStyle = b.getModel().getStyle(cell);
        let newStyle = Object.entries(styles).reduce((style, [key, value]) => {
            return mxUtils.setStyle(style, `mxConstants.STYLE_${key.toUpperCase()}`, value);
        }, currentStyle);
        b.setCellStyle(newStyle, [cell]);
    }


    //*********FROM BACKEND TO FRONTEND***************
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

    const COLOR_STATES = {
        DANGER: 'red',
        WARNING: 'orange',
        GOOD: 'green'
    };

    // Helper functions
    const formatNumber = (num, decimals = 3) => num.toFixed(decimals);
    const replaceUnderscores = name => name.replace('_', '#');

    // Generic cell processor
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

    // Color processors
    function processVoltageColor(grafka, cell, vmPu) {
        const voltage = parseFloat(vmPu.toFixed(2));
        let color = null;

        if (voltage >= 1.1 || voltage <= 0.9) color = COLOR_STATES.DANGER;
        else if ((voltage > 1.05 && voltage <= 1.1) || (voltage > 0.9 && voltage <= 0.95)) color = COLOR_STATES.WARNING;
        else if ((voltage > 1 && voltage <= 1.05) || (voltage > 0.95 && voltage <= 1)) color = COLOR_STATES.GOOD;

        if (color) updateCellColor(grafka, cell, color);
    }

    function processLoadingColor(grafka, cell, loadingPercent) {
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

    // Error handler
    function handleNetworkErrors(dataJson) {
        // Check for new diagnostic response format
        if (dataJson.error && dataJson.diagnostic) {
            console.log('Power flow failed with diagnostic information:', dataJson);
            
            // Show diagnostic dialog if available
            if (window.DiagnosticReportDialog) {
                const diagnosticDialog = new window.DiagnosticReportDialog(dataJson.diagnostic);
                diagnosticDialog.show();
            } else {
                // Fallback to alert if dialog is not available
                alert(`Power flow calculation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return true;
        }

        // Handle legacy error format
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
            U[pu]: ${formatNumber(cell.vm_pu)}
            U[degree]: ${formatNumber(cell.va_degree)}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            PF: ${formatNumber(cell.pf)}
            Q/P: ${formatNumber(cell.q_p)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
                processVoltageColor(grafka, resultCell, cell.vm_pu);
            });
        },

        lines: (data, b, grafka) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const linia = resultCell;
                cell.name = replaceUnderscores(cell.name);

                const resultString = `${linia.value.attributes[6].nodeValue}
            P_from[MW]: ${formatNumber(cell.p_from_mw)}
            Q_from[MVar]: ${formatNumber(cell.q_from_mvar)}
            i_from[kA]: ${formatNumber(cell.i_from_ka)}

            Loading[%]: ${formatNumber(cell.loading_percent, 1)}

            P_to[MW]: ${formatNumber(cell.p_to_mw)}
            Q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
            i_to[kA]: ${formatNumber(cell.i_to_ka)}`;

                const labelka = b.insertEdge(resultCell, null, resultString, linia.source, linia.target, 'shapeELXXX=Result');
                processCellStyles(b, labelka, true);
                processLoadingColor(grafka, linia, cell.loading_percent);
            });
        },


        externalgrids: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            PF: ${formatNumber(cell.pf)}
            Q/P: ${formatNumber(cell.q_p)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },

        generators: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            U[degree]: ${formatNumber(cell.va_degree)}
            Um[pu]: ${formatNumber(cell.vm_pu)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        staticgenerators: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        asymmetricstaticgenerators: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P_A[MW]: ${formatNumber(cell.p_a_mw)}
            Q_A[MVar]: ${formatNumber(cell.q_a_mvar)}
            P_B[MW]: ${formatNumber(cell.p_b_mw)}
            Q_B[MVar]: ${formatNumber(cell.q_b_mvar)}
            P_C[MW]: ${formatNumber(cell.p_c_mw)}
            Q_C[MVar]: ${formatNumber(cell.q_c_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        transformers: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);

                const resultString = `${resultCell.value.attributes[0].nodeValue}
            i_HV[kA]: ${formatNumber(cell.i_hv_ka)}
            i_LV[kA]: ${formatNumber(cell.i_lv_ka)}
            loading[%]: ${formatNumber(cell.loading_percent)}
            `;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            });
        },
        transformers3W: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            i_HV[kA]: ${formatNumber(cell.i_hv_ka)}
            i_MV[kA]: ${formatNumber(cell.i_mv_ka)}
            i_LV[kA]: ${formatNumber(cell.i_lv_ka)}
            loading[%]: ${formatNumber(cell.loading_percent)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
                processLoadingColor(grafka, resultCell, cell.loading_percent);
            });
        },
        shunts: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            Um[pu]: ${formatNumber(cell.vm_pu)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.5, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);

            });
        },
        capacitors: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            Um[pu]: ${formatNumber(cell.vm_pu)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        loads: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        asymmetricloads: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P_A[MW]: ${formatNumber(cell.p_a_mw)}
            Q_A[MVar]: ${formatNumber(cell.q_a_mvar)}
            P_B[MW]: ${formatNumber(cell.p_b_mw)}
            Q_B[MVar]: ${formatNumber(cell.q_b_mvar)}
            P_C[MW]: ${formatNumber(cell.p_c_mw)}
            Q_C[MVar]: ${formatNumber(cell.q_c_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        impedances: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P_from[MW]: ${formatNumber(cell.p_from_mw)}
            Q_from[MVar]: ${formatNumber(cell.q_from_mvar)}
            P_to[MW]: ${formatNumber(cell.p_to_mw)}
            Q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
            Pl[MW]: ${formatNumber(cell.pl_mw)}
            Ql[MVar]: ${formatNumber(cell.ql_mvar)}
            i_from[kA]: ${formatNumber(cell.i_from_ka)}
            i_to[kA]: ${formatNumber(cell.i_to_ka)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        wards: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            Um[pu]: ${formatNumber(cell.p_to_mw)}
            `;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        extendedwards: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            Um[pu]: ${formatNumber(cell.p_to_mw)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        motors: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        storages: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        svc: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            Firing angle[degree]: ${formatNumber(cell.thyristor_firing_angle_degree)}
            x[Ohm]: ${formatNumber(cell.x_ohm)}
            q[MVar]: ${formatNumber(cell.q_mvar)}
            vm[pu]: ${formatNumber(cell.vm_pu)}
            va[degree]: ${formatNumber(cell.va_degree)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        tcsc: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            Firing angle[degree]: ${formatNumber(cell.thyristor_firing_angle_degree)}
            x[Ohm]: ${formatNumber(cell.x_ohm)}
            p_from[MW]: ${formatNumber(cell.p_from_mw)}
            q_from[MVar]: ${formatNumber(cell.q_from_mvar)}
            p_to[MW]: ${formatNumber(cell.p_to_mw)}
            q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
            p_l[MW]: ${formatNumber(cell.p_l_mw)}
            q_l[MVar]: ${formatNumber(cell.q_l_mvar)}
            vm_from[pu]: ${formatNumber(cell.vm_from_pu)}
            va_from[degree]: ${formatNumber(cell.va_from_degree)}
            vm_to[pu]: ${formatNumber(cell.vm_to_pu)}
            va_to[degree]: ${formatNumber(cell.va_to_degree)}`;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        sscs: (data, b) => {
            
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            q_mvar: ${formatNumber(cell.q_mvar)}
            vm_internal_pu: ${formatNumber(cell.vm_internal_pu)}
            va_internal_degree: ${formatNumber(cell.va_internal_degree)}
            vm_pu: ${formatNumber(cell.vm_pu)}
            va_degree: ${formatNumber(cell.va_degree)}            
            `;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.7, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
            });
        },
        dclines: (data, b) => {
            data.forEach(cell => {
                const resultCell = b.getModel().getCell(cell.id);
                const resultString = `${resultCell.value.attributes[0].nodeValue}
            P_from[MW]: ${formatNumber(cell.p_from_mw)}
            Q_from[MVar]: ${formatNumber(cell.q_mvar)}
            P_to[MW]: ${formatNumber(cell.p_to_mw)}
            Q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
            Pl[MW]: ${formatNumber(cell.pl_mw)}
            `;

                const labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true);
                processCellStyles(b, labelka);
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
           // alert('Error processing network data.' + err+'\n \nCheck input data or contact electrisim@electrisim.com', );
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    
    let apka = a
    let grafka = b
    //FROM FRONTEND TO BACKEND
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use  LoadFlowDialog directly
        const dialog = new LoadFlowDialog(a);
        dialog.show(function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")

        // Initialize load flow parameters
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
            console.log('Load Flow - User email:', userEmail); // Debug log
            
            // Additional debugging
            console.log('=== Load Flow Debug ===');
            console.log('localStorage user:', localStorage.getItem('user'));
            console.log('localStorage token:', localStorage.getItem('token'));
            console.log('Final userEmail:', userEmail);
            console.log('======================');
            
            componentArrays.simulationParameters.push({
                typ: "PowerFlowPandaPower Parameters",
                frequency: a[0],
                algorithm: a[1],
                calculate_voltage_angles: a[2],
                initialization: a[3],
                user_email: userEmail  // Add user email to simulation data
            });

            // Process cells
            cellsArray.forEach(cell => {
                // Remove previous results
                if (cell.getStyle()?.includes("Result")) {
                    model.remove(model.getCell(cell.id));
                    return;
                }

                const style = parseCellStyle(cell.getStyle());
                if (!style) return;

                const componentType = style.shapeELXXX;
                if (!componentType || componentType == 'NotEditableLine') return;

              
                let baseData;
                if(componentType === 'Line' || componentType === 'DCLine'){
                    baseData = {
                        name: cell.mxObjectId.replace('#', '_'),
                        id: cell.id,
                        bus: getConnectedBusId(cell, true)
                    };
                }else{
                    baseData = {
                        name: cell.mxObjectId.replace('#', '_'),
                        id: cell.id,
                        bus: getConnectedBusId(cell)
                    };
                }


                switch (componentType) {
                    case COMPONENT_TYPES.EXTERNAL_GRID:
                        const externalGrid = {
                            ...baseData,
                            typ: `External Grid${counters.externalGrid++}`,
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            vn_kv: cell.value.attributes[2].nodeValue,
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })()
                        };
                        componentArrays.busbar.push(busbar);
                        break;

                    case COMPONENT_TYPES.TRANSFORMER:
                        const { hv_bus, lv_bus } = getTransformerConnections(cell);
                        const transformer = {
                            typ: `Transformer${counters.transformer++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                                parallel: { name: 'parallel', optional: true },

                                // Optional parameters
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                                userFriendlyName: (() => {
                                    // Check if the cell has a name attribute stored
                                    if (cell.value && cell.value.attributes) {
                                        for (let i = 0; i < cell.value.attributes.length; i++) {
                                            if (cell.value.attributes[i].nodeName === 'name') {
                                                return cell.value.attributes[i].nodeValue;
                                            }
                                        }
                                    }
                                    return cell.mxObjectId.replace('#', '_');
                                })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
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
                        const line = {
                            typ: `Line${counters.line++}`,
                            name: cell.mxObjectId.replace('#', '_'),
                            id: cell.id,
                            userFriendlyName: (() => {
                                // Check if the cell has a name attribute stored
                                if (cell.value && cell.value.attributes) {
                                    for (let i = 0; i < cell.value.attributes.length; i++) {
                                        if (cell.value.attributes[i].nodeName === 'name') {
                                            return cell.value.attributes[i].nodeValue;
                                        }
                                    }
                                }
                                return cell.mxObjectId.replace('#', '_');
                            })(),
                            ...getConnectedBuses(cell),
                            ...getAttributesAsObject(cell, {
                                // Basic parameters
                                length_km: 'length_km',
                                parallel: { name: 'parallel', optional: true },
                                df: { name: 'df', optional: true },

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
                            setCellStyle(cell, { strokeColor: 'black' });
                        } catch (error) {
                            console.error(error.message);
                            setCellStyle(cell, { strokeColor: 'red' });
                            alert('The line is not connected to the bus. Please check the line highlighted in red and connect it to the appropriate bus.');
                        }

                        componentArrays.line.push(line);
                        break;
                }
            });


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
            ...componentArrays.motor,
            ...componentArrays.storage,
            ...componentArrays.SSC,
            ...componentArrays.SVC,
            ...componentArrays.TCSC,
            ...componentArrays.dcLine,
            ...componentArrays.line
            
        ];

        const obj = Object.assign({}, array);
        console.log(JSON.stringify(obj));

        processNetworkData("https://03dht3kc-5000.euw.devtunnels.ms/", obj, b, grafka);
        } 
        });
    }
}

// Make loadFlowPandaPower available globally
globalThis.loadFlowPandaPower = loadFlowPandaPower;

// Export for module usage
export { loadFlowPandaPower };
