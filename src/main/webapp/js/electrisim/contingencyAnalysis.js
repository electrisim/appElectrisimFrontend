// Import ContingencyDialog
import { ContingencyDialog } from './dialogs/ContingencyDialog.js';
import ENV from './config/environment.js';

// Define component types as constants (same as loadFlow.js)
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
    DCLINE: 'DCLine',
    LINE: 'Line'
};

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
};

// Helper function to extract component type from style
const getComponentTypeFromStyle = (style) => {
    if (!style) return null;
    
    // Look for shapeELXXX=ComponentType pattern
    const shapeMatch = style.match(/shapeELXXX=([^;]+)/);
    if (shapeMatch) {
        return shapeMatch[1].trim();
    }
    
    return null;
};

// Helper function to parse cell style
const parseCellStyle = (style) => {
    if (!style) return null;
    const pairs = style.split(';').map(pair => pair.split('='));
    return Object.fromEntries(pairs);
};

// Helper function to get attributes as object with default values
const getAttributesAsObject = (cell, attributeMap) => {
    const result = {};
    //console.log('cell in getAttributes', cell);

    // Make sure cell has all the required properties
    if (!cell || !cell.value || !cell.value.attributes) {
        console.warn('Cell is missing required properties');
        return result;
    }

    Object.entries(attributeMap).forEach(([key, attr]) => {
        if (cell.value.attributes[key]) {
            result[attr] = cell.value.attributes[key].value;
        } else {
            // Provide default values for missing attributes
            console.warn(`Missing attribute: ${key} for component, using default`);
            switch (attr) {
                case 'type':
                    result[attr] = 'wye';  // Default load type
                    break;
                case 'scaling':
                    result[attr] = '1.0';
                    break;
                case 'in_service':
                    result[attr] = 'true';
                    break;
                case 'const_z_percent':
                case 'const_i_percent':
                    result[attr] = '0.0';
                    break;
                case 'q_mvar':
                case 'p_mw':
                    result[attr] = '0.0';
                    break;
                case 'sn_mva':
                    result[attr] = '1.0';
                    break;
                default:
                    result[attr] = '';  // Empty string as fallback
                    break;
            }
        }
    });

    return result;
};

// Helper function to set cell style
const setCellStyle = (cell, style) => {
    if (!cell) return;
    
    const currentStyle = cell.getStyle() || '';
    const newStyle = Object.entries(style).map(([key, value]) => `${key}=${value}`).join(';');
    
    // If there's already a style, merge it
    if (currentStyle) {
        cell.setStyle(currentStyle + ';' + newStyle);
    } else {
        cell.setStyle(newStyle);
    }
};

// Error handlers
const handleNetworkErrors = (dataJson) => {
    if (dataJson.error) {
        console.error('Network error:', dataJson.error);
        alert('Network error: ' + dataJson.error);
        return true;
    }
    
    if (dataJson.errors && dataJson.errors.length > 0) {
        console.error('Multiple network errors:', dataJson.errors);
        alert('Network errors: ' + dataJson.errors.join(', '));
        return true;
    }
    
    return false;
};

// Define styles
const STYLES = {
    label: {
        fontSize: '11',
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: '1',
        fontColor: '#000000'
    },
    line: {
        strokeColor: '#000000',
        strokeWidth: '2',
        startArrow: 'none',
        endArrow: 'none'
    }
};

// Element processors for different types of network elements
const elementProcessors = {
    bus: (busData, b, grafka) => {
        if (!busData || !Array.isArray(busData)) return;
        
        busData.forEach(bus => {
            try {
                const busId = bus.bus_id || bus.id;
                const cell = grafka.getModel().getCell(busId);
                
                if (cell) {
                    // Update cell with contingency analysis results
                    const voltage = bus.vm_pu || bus.voltage_pu || 1.0;
                    const angle = bus.va_degree || bus.angle_degree || 0.0;
                    
                    // Color coding based on voltage levels
                    let color = '#00FF00'; // Green for normal
                    if (voltage < 0.95 || voltage > 1.05) {
                        color = '#FF0000'; // Red for voltage violation
                    } else if (voltage < 0.97 || voltage > 1.03) {
                        color = '#FFA500'; // Orange for warning
                    }
                    
                    setCellStyle(cell, {
                        fillColor: color,
                        strokeColor: '#000000'
                    });
                    
                    // Add results label
                    const label = `V: ${voltage.toFixed(3)} pu\nθ: ${angle.toFixed(2)}°`;
                    cell.setAttribute('results', label);
                }
            } catch (error) {
                console.error('Error processing bus data:', error);
            }
        });
    },
    
    line: (lineData, b, grafka) => {
        if (!lineData || !Array.isArray(lineData)) return;
        
        lineData.forEach(line => {
            try {
                const lineId = line.line_id || line.id;
                const cell = grafka.getModel().getCell(lineId);
                
                if (cell) {
                    // Update cell with contingency analysis results
                    const loading = line.loading_percent || 0;
                    const pFlow = line.p_from_mw || 0;
                    const qFlow = line.q_from_mvar || 0;
                    
                    // Color coding based on loading
                    let color = '#00FF00'; // Green for normal
                    if (loading > 100) {
                        color = '#FF0000'; // Red for overload
                    } else if (loading > 90) {
                        color = '#FFA500'; // Orange for high loading
                    }
                    
                    setCellStyle(cell, {
                        strokeColor: color,
                        strokeWidth: loading > 100 ? '3' : '2'
                    });
                    
                    // Add results label
                    const label = `Loading: ${loading.toFixed(1)}%\nP: ${pFlow.toFixed(2)} MW\nQ: ${qFlow.toFixed(2)} Mvar`;
                    cell.setAttribute('results', label);
                }
            } catch (error) {
                console.error('Error processing line data:', error);
            }
        });
    },
    
    transformer: (transformerData, b, grafka) => {
        if (!transformerData || !Array.isArray(transformerData)) return;
        
        transformerData.forEach(trafo => {
            try {
                const trafoId = trafo.trafo_id || trafo.id;
                const cell = grafka.getModel().getCell(trafoId);
                
                if (cell) {
                    // Update cell with contingency analysis results
                    const loading = trafo.loading_percent || 0;
                    const pFlow = trafo.p_hv_mw || 0;
                    const qFlow = trafo.q_hv_mvar || 0;
                    
                    // Color coding based on loading
                    let color = '#00FF00'; // Green for normal
                    if (loading > 100) {
                        color = '#FF0000'; // Red for overload
                    } else if (loading > 90) {
                        color = '#FFA500'; // Orange for high loading
                    }
                    
                    setCellStyle(cell, {
                        fillColor: color,
                        strokeColor: '#000000'
                    });
                    
                    // Add results label
                    const label = `Loading: ${loading.toFixed(1)}%\nP: ${pFlow.toFixed(2)} MW\nQ: ${qFlow.toFixed(2)} Mvar`;
                    cell.setAttribute('results', label);
                }
            } catch (error) {
                console.error('Error processing transformer data:', error);
            }
        });
    },
    
    generator: (generatorData, b, grafka) => {
        if (!generatorData || !Array.isArray(generatorData)) return;
        
        generatorData.forEach(gen => {
            try {
                const genId = gen.gen_id || gen.id;
                const cell = grafka.getModel().getCell(genId);
                
                if (cell) {
                    // Update cell with contingency analysis results
                    const pGen = gen.p_mw || 0;
                    const qGen = gen.q_mvar || 0;
                    const inService = gen.in_service !== false;
                    
                    // Color coding based on service status
                    let color = inService ? '#00FF00' : '#FF0000';
                    
                    setCellStyle(cell, {
                        fillColor: color,
                        strokeColor: '#000000'
                    });
                    
                    // Add results label
                    const label = `P: ${pGen.toFixed(2)} MW\nQ: ${qGen.toFixed(2)} Mvar\nStatus: ${inService ? 'ON' : 'OFF'}`;
                    cell.setAttribute('results', label);
                }
            } catch (error) {
                console.error('Error processing generator data:', error);
            }
        });
    },
    
    load: (loadData, b, grafka) => {
        if (!loadData || !Array.isArray(loadData)) return;
        
        loadData.forEach(load => {
            try {
                const loadId = load.load_id || load.id;
                const cell = grafka.getModel().getCell(loadId);
                
                if (cell) {
                    // Update cell with contingency analysis results
                    const pLoad = load.p_mw || 0;
                    const qLoad = load.q_mvar || 0;
                    const inService = load.in_service !== false;
                    
                    // Color coding based on service status
                    let color = inService ? '#00FF00' : '#FF0000';
                    
                    setCellStyle(cell, {
                        fillColor: color,
                        strokeColor: '#000000'
                    });
                    
                    // Add results label
                    const label = `P: ${pLoad.toFixed(2)} MW\nQ: ${qLoad.toFixed(2)} Mvar\nStatus: ${inService ? 'ON' : 'OFF'}`;
                    cell.setAttribute('results', label);
                }
            } catch (error) {
                console.error('Error processing load data:', error);
            }
        });
    }
};

function contingencyAnalysisPandaPower(a, b, c) {

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

    // Main processing function (FROM BACKEND TO FRONTEND)
    async function processNetworkData(url, obj, b, grafka) {
        try {
            // Initialize styles once
            b.getStylesheet().putCellStyle('labelstyle', STYLES.label);
            b.getStylesheet().putCellStyle('lineStyle', STYLES.line);

            // Log what is being sent to backend
            console.log('📤 SENDING TO BACKEND:', JSON.stringify(obj, null, 2));

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
            // Log what is received from backend
            console.log('📥 RECEIVED FROM BACKEND:', JSON.stringify(dataJson, null, 2));

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

            // Display contingency analysis summary
            if (dataJson.summary) {
                displayContingencySummary(dataJson.summary);
            }

        } catch (err) {
            if (err.message === "server") return;
            console.error('Error processing contingency analysis data:', err);
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    // Function to display contingency analysis summary
    function displayContingencySummary(summary) {
        try {
            let message = 'Contingency Analysis Results:\n\n';
            
            if (summary.contingencies_analyzed) {
                message += `Total Contingencies Analyzed: ${summary.contingencies_analyzed}\n`;
            }
            
            if (summary.violations) {
                message += `Violations Found: ${summary.violations.length}\n`;
                if (summary.violations.length > 0) {
                    message += '\nViolations:\n';
                    summary.violations.forEach((violation, index) => {
                        message += `${index + 1}. ${violation.type}: ${violation.element} - ${violation.description}\n`;
                    });
                }
            }
            
            if (summary.critical_contingencies) {
                message += `\nCritical Contingencies: ${summary.critical_contingencies.length}\n`;
                if (summary.critical_contingencies.length > 0) {
                    message += '\nCritical Cases:\n';
                    summary.critical_contingencies.forEach((contingency, index) => {
                        message += `${index + 1}. ${contingency.name}: ${contingency.description}\n`;
                    });
                }
            }
            
            console.log(message);
            // Optionally display in a dialog or results panel
            // alert(message);
        } catch (error) {
            console.error('Error displaying contingency summary:', error);
        }
    }
    
    let apka = a
    let grafka = b
    //FROM FRONTEND TO BACKEND
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use ContingencyDialog directly
        const dialog = new ContingencyDialog(a);
        dialog.show(function (params) {

            apka.spinner.spin(document.body, "Running Contingency Analysis...")

            // Initialize contingency analysis parameters
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
                console.log('Contingency Analysis - User email:', userEmail); // Debug log
                
                componentArrays.simulationParameters.push({
                    typ: "ContingencyAnalysisPandaPower Parameters",
                    contingency_type: a[0],
                    element_type: a[1],
                    elements_to_analyze: a[2],
                    voltage_limits: a[3],
                    thermal_limits: a[4],
                    min_vm_pu: a[5],
                    max_vm_pu: a[6],
                    max_loading_percent: a[7],
                    post_contingency_actions: a[8],
                    analysis_mode: a[9],
                    user_email: userEmail  // Add user email to simulation data
                });
            }

            // Get all cells from the graph
            const model = b.getModel();
            const parent = b.getDefaultParent();
            const cellsArray = model.getChildren(parent);

            console.log('Total cells found:', cellsArray.length);
            console.log('Graph model:', model);
            console.log('Parent:', parent);

            // Debug: Let's see what cell types we actually have
            const cellTypes = {};
            cellsArray.forEach(cell => {
                const style = parseCellStyle(cell.getStyle());
                const cellType = style?.shapeELXXX || 'NO_TYPE';
                cellTypes[cellType] = (cellTypes[cellType] || 0) + 1;
            });
            console.log('Cell types found:', cellTypes);

            // Debug: Look at first few cells in detail
            console.log('First 5 cells details:');
            cellsArray.slice(0, 5).forEach((cell, index) => {
                const style = parseCellStyle(cell.getStyle());
                console.log(`Cell ${index}:`, {
                    id: cell.id,
                    mxObjectId: cell.mxObjectId,
                    componentType: style?.shapeELXXX,
                    style: cell.style,
                    edges: cell.edges?.length || 0
                });
            });

            // Track unique buses to avoid duplicates
            const uniqueBuses = new Set();

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
                console.log('Processing cell:', componentType, 'ID:', cell.id, 'mxObjectId:', cell.mxObjectId);
                
                if (!componentType || componentType === 'NotEditableLine') {
                    console.log('Skipping component type:', componentType);
                    return;
                }

                try {
                    // Prepare base data
                    let baseData;
                    if (componentType === 'Line' || componentType === 'DCLine') {
                        const busIds = getConnectedBusId(cell, true);
                        baseData = {
                            name: cell.mxObjectId?.replace('#', '_') || cell.id,
                            id: cell.id,
                            busFrom: busIds?.busFrom,
                            busTo: busIds?.busTo
                        };
                        
                        // Add buses to unique set if they don't exist
                        if (busIds?.busFrom && !uniqueBuses.has(busIds.busFrom)) {
                            uniqueBuses.add(busIds.busFrom);
                            componentArrays.busbar.push({
                                typ: 'Bus',
                                name: busIds.busFrom,
                                id: busIds.busFrom,
                                vn_kv: '230'  // Default voltage for line buses
                            });
                            console.log('Added unique bus for line:', busIds.busFrom);
                        }
                        if (busIds?.busTo && !uniqueBuses.has(busIds.busTo)) {
                            uniqueBuses.add(busIds.busTo);
                            componentArrays.busbar.push({
                                typ: 'Bus',
                                name: busIds.busTo,
                                id: busIds.busTo,
                                vn_kv: '230'  // Default voltage for line buses
                            });
                            console.log('Added unique bus for line:', busIds.busTo);
                        }
                    } else {
                        const busId = getConnectedBusId(cell);
                        baseData = {
                            name: cell.mxObjectId?.replace('#', '_') || cell.id,
                            id: cell.id,
                            bus: busId
                        };
                        
                        // Add bus to unique set if it doesn't exist
                        if (busId && !uniqueBuses.has(busId)) {
                            uniqueBuses.add(busId);
                            componentArrays.busbar.push({
                                typ: 'Bus',
                                name: busId,
                                id: busId,
                                vn_kv: cell.value?.attributes?.[2]?.nodeValue || '230'  // Use cell voltage or default
                            });
                            console.log('Added unique bus for component:', busId);
                        }
                    }

                    // Process different cell types based on style (using same pattern as loadFlow.js)
                    switch (componentType) {
                        case COMPONENT_TYPES.BUS:
                        case 'Bus Bar':
                            // Skip - buses are now handled above to avoid duplicates
                            console.log('Skipping explicit Bus component - handled automatically');
                            break;

                        case COMPONENT_TYPES.EXTERNAL_GRID:
                            console.log('Processing External Grid:', baseData);
                            // Debug: see what attributes are available
                            console.log('External Grid cell attributes:', cell.value?.attributes);
                            if (baseData.bus) {
                                const gridAttributes = getAttributesAsObject(cell, {
                                    vm_pu: 'vm_pu',
                                    va_degree: 'va_degree',
                                    s_sc_max_mva: 's_sc_max_mva',
                                    s_sc_min_mva: 's_sc_min_mva',
                                    rx_max: 'rx_max',
                                    rx_min: 'rx_min',
                                    r0x0_max: 'r0x0_max',
                                    x0x_max: 'x0x_max'
                                });
                                componentArrays.externalGrid.push({
                                    typ: 'ExternalGrid',
                                    name: baseData.name,
                                    id: baseData.id,
                                    bus: baseData.bus,
                                    ...gridAttributes
                                });
                                console.log('Added external grid:', baseData.name, 'attributes:', gridAttributes);
                            }
                            break;

                        case COMPONENT_TYPES.GENERATOR:
                        case 'Synchronous Generator':
                            console.log('Processing Generator:', baseData);
                            // Debug: see what attributes are available
                            console.log('Generator cell attributes:', cell.value?.attributes);
                            if (baseData.bus) {
                                const genAttributes = getAttributesAsObject(cell, {
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
                                });
                                componentArrays.generator.push({
                                    typ: 'Generator',
                                    name: baseData.name,
                                    id: baseData.id,
                                    bus: baseData.bus,
                                    ...genAttributes
                                });
                                console.log('Added generator:', baseData.name, 'attributes:', genAttributes);
                            }
                            break;

                        case COMPONENT_TYPES.LOAD:
                        case 'Static Load':
                            console.log('Processing Load:', baseData);
                            // Debug: see what attributes are available
                            console.log('Load cell attributes:', cell.value?.attributes);
                            if (baseData.bus) {
                                const loadAttributes = getAttributesAsObject(cell, {
                                    p_mw: 'p_mw',
                                    q_mvar: 'q_mvar',
                                    const_z_percent: 'const_z_percent',
                                    const_i_percent: 'const_i_percent',
                                    sn_mva: 'sn_mva',
                                    scaling: 'scaling',
                                    type: 'type',
                                    in_service: 'in_service'
                                });
                                componentArrays.load.push({
                                    typ: 'Load',
                                    name: baseData.name,
                                    id: baseData.id,
                                    bus: baseData.bus,
                                    ...loadAttributes
                                });
                                console.log('Added load:', baseData.name, 'attributes:', loadAttributes);
                            }
                            break;

                        case COMPONENT_TYPES.LINE:
                        case 'Transmission Line':
                            console.log('Processing Line:', baseData);
                            // Debug: see what attributes are available
                            console.log('Line cell attributes:', cell.value?.attributes);
                            if (baseData.busFrom && baseData.busTo) {
                                const lineAttributes = getAttributesAsObject(cell, {
                                    std_type: 'std_type',
                                    length_km: 'length_km',
                                    r_ohm_per_km: 'r_ohm_per_km',
                                    x_ohm_per_km: 'x_ohm_per_km',
                                    c_nf_per_km: 'c_nf_per_km',
                                    g_us_per_km: 'g_us_per_km',
                                    max_i_ka: 'max_i_ka',
                                    df: 'df',
                                    parallel: 'parallel',
                                    type: 'type',
                                    in_service: 'in_service'
                                });
                                componentArrays.line.push({
                                    typ: 'Line',
                                    name: baseData.name,
                                    id: baseData.id,
                                    busFrom: baseData.busFrom,
                                    busTo: baseData.busTo,
                                    ...lineAttributes
                                });
                                console.log('Added line:', baseData.name, 'attributes:', lineAttributes);
                            }
                            break;

                        case COMPONENT_TYPES.TRANSFORMER:
                        case 'Two Winding Transformer':
                            console.log('Processing Transformer:', baseData);
                            // Debug: see what attributes are available
                            console.log('Transformer cell attributes:', cell.value?.attributes);
                            if (baseData.busFrom && baseData.busTo) {
                                const trafoAttributes = getAttributesAsObject(cell, {
                                    std_type: 'std_type',
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
                                    parallel: 'parallel',
                                    df: 'df',
                                    in_service: 'in_service'
                                });
                                componentArrays.transformer.push({
                                    typ: 'Transformer',
                                    name: baseData.name,
                                    id: baseData.id,
                                    hv_bus: baseData.busFrom,
                                    lv_bus: baseData.busTo,
                                    ...trafoAttributes
                                });
                                console.log('Added transformer:', baseData.name, 'attributes:', trafoAttributes);
                            }
                            break;

                        default:
                            console.log('Unknown cell type:', componentType, 'Style:', cell.style);
                            break;
                    }
                } catch (error) {
                    console.error('Error processing cell:', componentType, error);
                }
            });

            console.log('Component arrays summary:');
            console.log('Buses:', componentArrays.busbar.length);
            console.log('External grids:', componentArrays.externalGrid.length);
            console.log('Generators:', componentArrays.generator.length);
            console.log('Loads:', componentArrays.load.length);
            console.log('Lines:', componentArrays.line.length);
            console.log('Transformers:', componentArrays.transformer.length);

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
            // Log what is being sent to backend
            console.log('📤 SENDING TO BACKEND:', JSON.stringify(obj, null, 2));

            processNetworkData(ENV.backendUrl + "/", obj, b, grafka);
        });
    }
}

// Make contingencyAnalysisPandaPower available globally
globalThis.contingencyAnalysisPandaPower = contingencyAnalysisPandaPower;

// Export for module usage
export { contingencyAnalysisPandaPower }; 