// Dependencies will be resolved from global scope when needed
import ENV from './config/environment.js';
import { resolveStudyOpfCostCurrency } from './utils/opfCostCurrency.js';
import {
    getConnectedBusId,
    getTransformerConnections,
    getThreeWindingConnections,
    updateTransformerBusConnections,
    updateThreeWindingTransformerConnections,
} from './loadFlow.js';

/**
 * OPF runs from the lazy "engines" bundle; results/diagnostic dialogs live in "analysis".
 * Load them on demand so window.* constructors exist before showing UI.
 */
async function ensureElectrisimModule(modulePath) {
    const ll = window.ElectrisimLazyLoader;
    if (ll?.isLoaded?.(modulePath)) {
        return;
    }
    if (ll?.loadModule) {
        try {
            await ll.loadModule(modulePath);
            return;
        } catch (e) {
            console.warn(`LazyLoader could not load ${modulePath}:`, e);
        }
    }
    const rel = modulePath.startsWith('dialogs/')
        ? `./dialogs/${modulePath.slice('dialogs/'.length)}.js`
        : `./${modulePath}.js`;
    try {
        await import(rel);
    } catch (e2) {
        console.warn(`Dynamic import failed for ${modulePath}:`, e2);
    }
}

// Helper function to parse cell style
const parseCellStyle = (style) => {
    if (!style) return null;
    const pairs = style.split(';').map(pair => pair.split('='));
    return Object.fromEntries(pairs);
};

// Helper function to get attributes as object
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

// Define component types as constants
const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    BUS: 'Bus',
    LOAD: 'Load',
    LINE: 'Line',
    TRANSFORMER: 'Transformer',
    THREE_WINDING_TRANSFORMER: 'Three Winding Transformer',
    STORAGE: 'Storage',
    STATIC_GENERATOR: 'Static Generator',
    DC_LINE: 'DC Line',
};

function optimalPowerFlowPandaPower(a, b, c) {
    // Create counters and arrays for different components
    const counters = {
        externalGrid: 0,
        generator: 0,
        busbar: 0,
        transformer: 0,
        threeWindingTransformer: 0,
        load: 0,
        line: 0,
        storage: 0,
        staticGenerator: 0,
        dcLine: 0,
    };

    const componentArrays = {
        simulationParameters: [],
        externalGrid: [],
        generator: [],
        busbar: [],
        transformer: [],
        threeWindingTransformer: [],
        load: [],
        line: [],
        storage: [],
        staticGenerator: [],
        dcLine: [],
    };    

    // Cache commonly used functions and values
    const getModel = b.getModel.bind(b);
    const model = getModel();
    const cellsArray = model.getDescendants();   

    let apka = a;
    let grafka = b;

    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Try to create dialog when ready
        function tryCreateDialog() {
            let DialogClass = null;
            
            if (typeof window !== 'undefined' && window.OptimalPowerFlowDialog) {
                DialogClass = window.OptimalPowerFlowDialog;
            } else if (typeof globalThis !== 'undefined' && globalThis.OptimalPowerFlowDialog) {
                DialogClass = globalThis.OptimalPowerFlowDialog;
            }
            
            if (!DialogClass) {
                setTimeout(tryCreateDialog, 100);
                return;
            }
            
            const dialog = new DialogClass(a);
            dialog.show(function (params) {
                if (!globalThis.opfRunCount) {
                    globalThis.opfRunCount = 0;
                }
                globalThis.opfRunCount++;
                const runNumber = globalThis.opfRunCount;
                const startTime = performance.now();
                console.log(`=== OPTIMAL POWER FLOW SIMULATION #${runNumber} STARTED ===`);
                
                // Initialize performance optimization caches
                const modelCache = new Map();
                const cellCache = new Map();
                const nameCache = new Map();
                const attributeCache = new Map();
                console.log('Starting fresh simulation with clean caches');
                
                apka.spinner.spin(document.body, "Waiting for optimal power flow results...");

                if (params.length > 0) {
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
                    console.log('Optimal Power Flow - User email:', userEmail); // Debug log

                        // Process cells with performance optimization
                        const cellProcessingStart = performance.now();
                        console.log(`Processing ${cellsArray.length} cells...`);
                        
                        // First pass: collect result cells to remove and valid cells to process
                        const resultCellsToRemove = [];
                        const validCells = [];
                        
                        cellsArray.forEach(cell => {
                            // Style-based detection (for properly tagged results)
                            if (cell.getStyle()?.includes("Result")) {
                                resultCellsToRemove.push(cell);
                                return;
                            }
                            
                            // Content-based detection (for result labels that might have lost their style)
                            const value = cell.getValue();
                            if (value && typeof value === 'string') {
                                const lowerValue = value.toLowerCase();
                                if (// Load flow patterns
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
                                    lowerValue.includes('ql[mvar]:') ||
                                    // Short circuit patterns (in case they remain)
                                    lowerValue.includes('ikss[ka]') || 
                                    lowerValue.includes('ip[ka]') || 
                                    lowerValue.includes('ith[ka]') ||
                                    lowerValue.includes('rk[ohm]') ||
                                    lowerValue.includes('xk[ohm]')) {
                                    resultCellsToRemove.push(cell);
                                    return;
                                }
                            }

                            const style = parseCellStyle(cell.getStyle());
                            if (!style) return;

                            const componentType = style.shapeELXXX;
                            if (!componentType || componentType == 'NotEditableLine') return;
                            
                            validCells.push({ cell, style, componentType });
                        });
                        
                        // Batch remove result cells for better performance
                        let resultCellsRemoved = 0;
                        const removalStart = performance.now();
                        
                        if (resultCellsToRemove.length > 0) {
                            console.log(`Removing ${resultCellsToRemove.length} result cells from previous simulation...`);
                            try {
                                model.beginUpdate();
                                resultCellsToRemove.forEach(cell => {
                                    const cellToRemove = model.getCell(cell.id);
                                    if (cellToRemove) {
                                        model.remove(cellToRemove);
                                        resultCellsRemoved++;
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

                        // Process valid cells with optimized processing
                        const componentProcessingStart = performance.now();
                        let processedComponents = 0;
                        
                        validCells.forEach(({ cell, style, componentType }) => {
                            processedComponents++;

                            // Get user-friendly name from grid data if available
                            let userFriendlyName = cell.mxObjectId.replace('#', '_'); // fallback to technical ID
                            
                            // Try to get the actual user-friendly name from the grid
                            try {
                                // For buses, check busDialog grid
                                if (componentType === COMPONENT_TYPES.BUS && window.gridOptionsBus && window.gridOptionsBus.api) {
                                    const busData = window.gridOptionsBus.api.getRenderedNodes();
                                    if (busData && busData.length > 0) {
                                        // Find matching bus by technical ID
                                        const matchingBus = busData.find(node => node.data && node.data.id === cell.id);
                                        if (matchingBus && matchingBus.data && matchingBus.data.name) {
                                            userFriendlyName = matchingBus.data.name;
                                        }
                                    }
                                }
                                // For loads, check loadDialog grid
                                else if (componentType === COMPONENT_TYPES.LOAD && window.gridOptionsLoad && window.gridOptionsLoad.api) {
                                    const loadData = window.gridOptionsLoad.api.getRenderedNodes();
                                    if (loadData && loadData.length > 0) {
                                        const matchingLoad = loadData.find(node => node.data && node.data.id === cell.id);
                                        if (matchingLoad && matchingLoad.data && matchingLoad.data.name) {
                                            userFriendlyName = matchingLoad.data.name;
                                        }
                                    }
                                }
                                // For generators, check generatorDialog grid
                                else if (componentType === COMPONENT_TYPES.GENERATOR && window.gridOptionsGenerator && window.gridOptionsGenerator.api) {
                                    const genData = window.gridOptionsGenerator.api.getRenderedNodes();
                                    if (genData && genData.length > 0) {
                                        const matchingGen = genData.find(node => node.data && node.data.id === cell.id);
                                        if (matchingGen && matchingGen.data && matchingGen.data.name) {
                                            userFriendlyName = matchingGen.data.name;
                                        }
                                    }
                                }
                                // For lines, check lineDialog grid
                                else if (componentType === COMPONENT_TYPES.LINE && window.gridOptionsLineDialog && window.gridOptionsLineDialog.api) {
                                    const lineData = window.gridOptionsLineDialog.api.getRenderedNodes();
                                    if (lineData && lineData.length > 0) {
                                        const matchingLine = lineData.find(node => node.data && node.data.id === cell.id);
                                        if (matchingLine && matchingLine.data && matchingLine.data.name) {
                                            userFriendlyName = matchingLine.data.name;
                                        }
                                    }
                                }
                                else if (componentType === COMPONENT_TYPES.EXTERNAL_GRID && window.gridOptionsExternalGrid && window.gridOptionsExternalGrid.api) {
                                    const extData = window.gridOptionsExternalGrid.api.getRenderedNodes();
                                    if (extData && extData.length > 0) {
                                        const hit = extData.find(node => node.data && node.data.id === cell.id);
                                        if (hit && hit.data && hit.data.name) {
                                            userFriendlyName = hit.data.name;
                                        }
                                    }
                                }
                                else if (componentType === COMPONENT_TYPES.STORAGE && window.gridOptionsStorage && window.gridOptionsStorage.api) {
                                    const stData = window.gridOptionsStorage.api.getRenderedNodes();
                                    if (stData && stData.length > 0) {
                                        const hit = stData.find(node => node.data && node.data.id === cell.id);
                                        if (hit && hit.data && hit.data.name) {
                                            userFriendlyName = hit.data.name;
                                        }
                                    }
                                }
                                else if (componentType === COMPONENT_TYPES.STATIC_GENERATOR && window.gridOptionsStaticGenerator && window.gridOptionsStaticGenerator.api) {
                                    const sgData = window.gridOptionsStaticGenerator.api.getRenderedNodes();
                                    if (sgData && sgData.length > 0) {
                                        const hit = sgData.find(node => node.data && node.data.id === cell.id);
                                        if (hit && hit.data && hit.data.name) {
                                            userFriendlyName = hit.data.name;
                                        }
                                    }
                                }
                                else if (componentType === COMPONENT_TYPES.DC_LINE && window.gridOptionsDCLine && window.gridOptionsDCLine.api) {
                                    const dcData = window.gridOptionsDCLine.api.getRenderedNodes();
                                    if (dcData && dcData.length > 0) {
                                        const hit = dcData.find(node => node.data && node.data.id === cell.id);
                                        if (hit && hit.data && hit.data.name) {
                                            userFriendlyName = hit.data.name;
                                        }
                                    }
                                }
                            } catch (error) {
                                console.warn('Could not get user-friendly name for', componentType, cell.id, error);
                            }
                            
                            let baseData;
                            if(componentType === 'Line' || componentType === 'DC Line'){
                                baseData = {
                                    name: cell.mxObjectId.replace('#', '_'), // technical ID
                                    userFriendlyName: userFriendlyName, // user-friendly name
                                    id: cell.id,
                                    bus: getConnectedBusId(cell, true)
                                };
                            } else {
                                baseData = {
                                    name: cell.mxObjectId.replace('#', '_'), // technical ID
                                    userFriendlyName: userFriendlyName, // user-friendly name
                                    id: cell.id,
                                    bus: getConnectedBusId(cell)
                                };
                            }

                            // Process basic component types
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
                                            x0x_max: 'x0x_max',
                                            max_p_mw: { name: 'max_p_mw', optional: true },
                                            min_p_mw: { name: 'min_p_mw', optional: true },
                                            max_q_mvar: { name: 'max_q_mvar', optional: true },
                                            min_q_mvar: { name: 'min_q_mvar', optional: true },
                                            controllable: { name: 'controllable', optional: true },
                                            opf_marginal_cost_eur_per_mwh: { name: 'opf_marginal_cost_eur_per_mwh', optional: true },
                                            opf_cp2_eur_per_mw2: { name: 'opf_cp2_eur_per_mw2', optional: true },
                                            opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                        })
                                    };
                                    componentArrays.externalGrid.push(externalGrid);
                                    break;

                                case COMPONENT_TYPES.GENERATOR:
                                    const p_mw_val = parseFloat(getAttributesAsObject(cell, {p_mw: 'p_mw'}).p_mw) || 10;
                                    const genOpfAttr = getAttributesAsObject(cell, {
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
                                        opf_marginal_cost_eur_per_mwh: 'opf_marginal_cost_eur_per_mwh',
                                        opf_cp2_eur_per_mw2: 'opf_cp2_eur_per_mw2',
                                        opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                        min_p_mw: { name: 'min_p_mw', optional: true },
                                        max_p_mw: { name: 'max_p_mw', optional: true },
                                    });
                                    const genMinP = parseFloat(genOpfAttr.min_p_mw);
                                    const genMaxP = parseFloat(genOpfAttr.max_p_mw);
                                    const minPResolved = Number.isFinite(genMinP) ? genMinP : 0;
                                    let maxPResolved = Number.isFinite(genMaxP) ? genMaxP : p_mw_val;
                                    if (maxPResolved <= minPResolved) {
                                        maxPResolved = Math.max(p_mw_val, minPResolved + 1e-6);
                                    }
                                    const generator = {
                                        ...baseData,
                                        typ: "Generator",
                                        ...genOpfAttr,
                                        min_p_mw: minPResolved,
                                        max_p_mw: maxPResolved,
                                    };
                                    componentArrays.generator.push(generator);
                                    counters.generator++;
                                    break;

                                case COMPONENT_TYPES.BUS:
                                    const busbar = {
                                        typ: `Bus${counters.busbar++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        vn_kv: cell.value.attributes[2].nodeValue,
                                        ...getAttributesAsObject(cell, {
                                            min_vm_pu: { name: 'min_vm_pu', optional: true },
                                            max_vm_pu: { name: 'max_vm_pu', optional: true },
                                        }),
                                    };
                                    componentArrays.busbar.push(busbar);
                                    break;

                                case COMPONENT_TYPES.LOAD:
                                    const loadOpf = getAttributesAsObject(cell, {
                                        p_mw: 'p_mw',
                                        q_mvar: 'q_mvar',
                                        const_z_percent: 'const_z_percent',
                                        const_i_percent: 'const_i_percent',
                                        sn_mva: 'sn_mva',
                                        scaling: 'scaling',
                                        type: 'type',
                                        controllable: { name: 'controllable', optional: true },
                                        min_p_mw: { name: 'min_p_mw', optional: true },
                                        max_p_mw: { name: 'max_p_mw', optional: true },
                                        min_q_mvar: { name: 'min_q_mvar', optional: true },
                                        max_q_mvar: { name: 'max_q_mvar', optional: true },
                                        opf_marginal_cost_eur_per_mwh: { name: 'opf_marginal_cost_eur_per_mwh', optional: true },
                                        opf_cp2_eur_per_mw2: { name: 'opf_cp2_eur_per_mw2', optional: true },
                                        opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                    });
                                    const load = {
                                        typ: `Load${counters.load++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        bus: getConnectedBusId(cell),
                                        ...loadOpf,
                                    };
                                    componentArrays.load.push(load);
                                    break;

                                case COMPONENT_TYPES.LINE:
                                    const line = {
                                        typ: `Line${counters.line++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        busFrom: cell.source?.mxObjectId?.replace('#', '_'),
                                        busTo: cell.target?.mxObjectId?.replace('#', '_'),
                                        ...getAttributesAsObject(cell, {
                                            length_km: 'length_km',
                                            parallel: 'parallel',
                                            df: 'df',
                                            r_ohm_per_km: 'r_ohm_per_km',
                                            x_ohm_per_km: 'x_ohm_per_km',
                                            c_nf_per_km: 'c_nf_per_km',
                                            g_us_per_km: 'g_us_per_km',
                                            max_i_ka: 'max_i_ka',
                                            type: 'type',
                                            max_loading_percent: { name: 'max_loading_percent', optional: true },
                                        })
                                    };
                                    componentArrays.line.push(line);
                                    break;

                                case COMPONENT_TYPES.STORAGE: {
                                    const storageObj = {
                                        typ: `Storage${counters.storage++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        userFriendlyName: userFriendlyName,
                                        bus: getConnectedBusId(cell),
                                        ...getAttributesAsObject(cell, {
                                            p_mw: 'p_mw',
                                            max_e_mwh: 'max_e_mwh',
                                            q_mvar: 'q_mvar',
                                            sn_mva: 'sn_mva',
                                            soc_percent: 'soc_percent',
                                            min_e_mwh: 'min_e_mwh',
                                            scaling: 'scaling',
                                            type: 'type',
                                            in_service: { name: 'in_service', optional: true },
                                            controllable: { name: 'controllable', optional: true },
                                            max_p_mw: { name: 'max_p_mw', optional: true },
                                            min_p_mw: { name: 'min_p_mw', optional: true },
                                            max_q_mvar: { name: 'max_q_mvar', optional: true },
                                            min_q_mvar: { name: 'min_q_mvar', optional: true },
                                            opf_marginal_cost_eur_per_mwh: { name: 'opf_marginal_cost_eur_per_mwh', optional: true },
                                            opf_cp2_eur_per_mw2: { name: 'opf_cp2_eur_per_mw2', optional: true },
                                            opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                        }),
                                    };
                                    componentArrays.storage.push(storageObj);
                                    break;
                                }

                                case COMPONENT_TYPES.TRANSFORMER:
                                case 'Two Winding Transformer': {
                                    const { hv_bus, lv_bus } = getTransformerConnections(cell);
                                    const transformer = {
                                        typ: `Transformer${counters.transformer++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        userFriendlyName: (() => {
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
                                            sn_mva: 'sn_mva',
                                            vn_hv_kv: 'vn_hv_kv',
                                            vn_lv_kv: 'vn_lv_kv',
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
                                            shift_degree: { name: 'shift_degree', optional: true },
                                            tap_side: { name: 'tap_side', optional: true },
                                            tap_pos: { name: 'tap_pos', optional: true },
                                            tap_neutral: { name: 'tap_neutral', optional: true },
                                            tap_max: { name: 'tap_max', optional: true },
                                            tap_min: { name: 'tap_min', optional: true },
                                            tap_step_percent: { name: 'tap_step_percent', optional: true },
                                            tap_step_degree: { name: 'tap_step_degree', optional: true },
                                            tap_phase_shifter: { name: 'tap_phase_shifter', optional: true },
                                            in_service: { name: 'in_service', optional: true },
                                            max_loading_percent: { name: 'max_loading_percent', optional: true },
                                        })
                                    };
                                    componentArrays.transformer.push(transformer);
                                    break;
                                }

                                case COMPONENT_TYPES.THREE_WINDING_TRANSFORMER:
                                    try {
                                        const connections = getThreeWindingConnections(cell);
                                        const threeWindingTransformer = {
                                            typ: `Three Winding Transformer${counters.threeWindingTransformer++}`,
                                            name: cell.mxObjectId.replace('#', '_'),
                                            id: cell.id,
                                            userFriendlyName: (() => {
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
                                                vk0_hv_percent: { name: 'vk0_hv_percent', optional: true },
                                                vk0_mv_percent: { name: 'vk0_mv_percent', optional: true },
                                                vk0_lv_percent: { name: 'vk0_lv_percent', optional: true },
                                                vkr0_hv_percent: { name: 'vkr0_hv_percent', optional: true },
                                                vkr0_mv_percent: { name: 'vkr0_mv_percent', optional: true },
                                                vkr0_lv_percent: { name: 'vkr0_lv_percent', optional: true },
                                                vector_group: 'vector_group',
                                                shift_mv_degree: { name: 'shift_mv_degree', optional: true },
                                                shift_lv_degree: { name: 'shift_lv_degree', optional: true },
                                                tap_step_percent: { name: 'tap_step_percent', optional: true },
                                                tap_step_degree: { name: 'tap_step_degree', optional: true },
                                                tap_side: { name: 'tap_side', optional: true },
                                                tap_neutral: { name: 'tap_neutral', optional: true },
                                                tap_min: { name: 'tap_min', optional: true },
                                                tap_max: { name: 'tap_max', optional: true },
                                                tap_pos: { name: 'tap_pos', optional: true },
                                                tap_at_star_point: { name: 'tap_at_star_point', optional: true },
                                                tap_changer_type: { name: 'tap_changer_type', optional: true },
                                                tap_phase_shifter: { name: 'tap_phase_shifter', optional: true },
                                                in_service: { name: 'in_service', optional: true },
                                                max_loading_percent: { name: 'max_loading_percent', optional: true },
                                            })
                                        };
                                        componentArrays.threeWindingTransformer.push(threeWindingTransformer);
                                    } catch (e) {
                                        console.error(e.message);
                                        const tw3CurrentStyle = b.getModel().getStyle(cell);
                                        const tw3NewStyle = mxUtils.setStyle(tw3CurrentStyle, mxConstants.STYLE_STROKECOLOR, 'red');
                                        b.setCellStyle(tw3NewStyle, [cell]);
                                        alert(e.message);
                                    }
                                    break;

                                case COMPONENT_TYPES.STATIC_GENERATOR: {
                                    const sgP = parseFloat(getAttributesAsObject(cell, { p_mw: 'p_mw' }).p_mw) || 0;
                                    const sgOpf = getAttributesAsObject(cell, {
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
                                        current_source: 'current_source',
                                        reactive_capability_curve: { name: 'reactive_capability_curve', optional: true },
                                        curve_style: { name: 'curve_style', optional: true },
                                        q_capability_curve_json: { name: 'q_capability_curve_json', optional: true },
                                        in_service: { name: 'in_service', optional: true },
                                        controllable: { name: 'controllable', optional: true },
                                        min_p_mw: { name: 'min_p_mw', optional: true },
                                        max_p_mw: { name: 'max_p_mw', optional: true },
                                        min_q_mvar: { name: 'min_q_mvar', optional: true },
                                        max_q_mvar: { name: 'max_q_mvar', optional: true },
                                        opf_marginal_cost_eur_per_mwh: { name: 'opf_marginal_cost_eur_per_mwh', optional: true },
                                        opf_cp2_eur_per_mw2: { name: 'opf_cp2_eur_per_mw2', optional: true },
                                        opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                    });
                                    const sgMinP = parseFloat(sgOpf.min_p_mw);
                                    const sgMaxP = parseFloat(sgOpf.max_p_mw);
                                    const sgMinResolved = Number.isFinite(sgMinP) ? sgMinP : 0;
                                    let sgMaxResolved = Number.isFinite(sgMaxP) ? sgMaxP : sgP;
                                    if (sgMaxResolved <= sgMinResolved) {
                                        sgMaxResolved = Math.max(sgP, sgMinResolved + 1e-6);
                                    }
                                    componentArrays.staticGenerator.push({
                                        ...baseData,
                                        typ: 'Static Generator',
                                        ...sgOpf,
                                        min_p_mw: sgMinResolved,
                                        max_p_mw: sgMaxResolved,
                                    });
                                    counters.staticGenerator++;
                                    break;
                                }

                                case COMPONENT_TYPES.DC_LINE: {
                                    const dcOpf = getAttributesAsObject(cell, {
                                        p_mw: 'p_mw',
                                        loss_percent: 'loss_percent',
                                        loss_mw: 'loss_mw',
                                        vm_from_pu: 'vm_from_pu',
                                        vm_to_pu: 'vm_to_pu',
                                        in_service: { name: 'in_service', optional: true },
                                        max_p_mw: { name: 'max_p_mw', optional: true },
                                        min_q_from_mvar: { name: 'min_q_from_mvar', optional: true },
                                        max_q_from_mvar: { name: 'max_q_from_mvar', optional: true },
                                        min_q_to_mvar: { name: 'min_q_to_mvar', optional: true },
                                        max_q_to_mvar: { name: 'max_q_to_mvar', optional: true },
                                        opf_marginal_cost_eur_per_mwh: { name: 'opf_marginal_cost_eur_per_mwh', optional: true },
                                        opf_cp2_eur_per_mw2: { name: 'opf_cp2_eur_per_mw2', optional: true },
                                        opf_cost_currency: { name: 'opf_cost_currency', optional: true },
                                    });
                                    componentArrays.dcLine.push({
                                        typ: `DC Line${counters.dcLine++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        userFriendlyName: baseData.userFriendlyName,
                                        bus: getConnectedBusId(cell, true),
                                        ...dcOpf,
                                    });
                                    break;
                                }
                            }
                        });

                        if (componentArrays.transformer.length > 0) {
                            componentArrays.transformer = updateTransformerBusConnections(
                                componentArrays.transformer,
                                componentArrays.busbar,
                                b
                            );
                        }
                        if (componentArrays.threeWindingTransformer.length > 0) {
                            componentArrays.threeWindingTransformer = updateThreeWindingTransformerConnections(
                                componentArrays.threeWindingTransformer,
                                componentArrays.busbar,
                                b
                            );
                        }

                        // Only attach cp2 when cp1 is set — avoids orphan quadratic terms (e.g. load with cp2 but empty marginal).
                        const genCostCp1 = {};
                        const genCostCp2 = {};
                        componentArrays.generator.forEach((g) => {
                            const gid = String(g.id);
                            const m = parseFloat(g.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(g.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                genCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    genCostCp2[gid] = c2;
                                }
                            }
                        });

                        const extCostCp1 = {};
                        const extCostCp2 = {};
                        componentArrays.externalGrid.forEach((eg) => {
                            const gid = String(eg.id);
                            const m = parseFloat(eg.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(eg.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                extCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    extCostCp2[gid] = c2;
                                }
                            }
                        });

                        const storCostCp1 = {};
                        const storCostCp2 = {};
                        componentArrays.storage.forEach((st) => {
                            const gid = String(st.id);
                            const m = parseFloat(st.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(st.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                storCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    storCostCp2[gid] = c2;
                                }
                            }
                        });

                        const sgenCostCp1 = {};
                        const sgenCostCp2 = {};
                        componentArrays.staticGenerator.forEach((sg) => {
                            const gid = String(sg.id);
                            const m = parseFloat(sg.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(sg.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                sgenCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    sgenCostCp2[gid] = c2;
                                }
                            }
                        });

                        const loadCostCp1 = {};
                        const loadCostCp2 = {};
                        componentArrays.load.forEach((ld) => {
                            const gid = String(ld.id);
                            const m = parseFloat(ld.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(ld.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                loadCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    loadCostCp2[gid] = c2;
                                }
                            }
                        });

                        const dclineCostCp1 = {};
                        const dclineCostCp2 = {};
                        componentArrays.dcLine.forEach((dc) => {
                            const gid = String(dc.id);
                            const m = parseFloat(dc.opf_marginal_cost_eur_per_mwh);
                            const c2 = parseFloat(dc.opf_cp2_eur_per_mw2);
                            if (Number.isFinite(m)) {
                                dclineCostCp1[gid] = m;
                                if (Number.isFinite(c2) && c2 >= 0) {
                                    dclineCostCp2[gid] = c2;
                                }
                            }
                        });

                        componentArrays.simulationParameters.push({
                            typ: 'OptimalPowerFlowPandaPower Parameters',
                            opf_type: params[0],
                            frequency: params[1],
                            ac_algorithm: params[2],
                            dc_algorithm: params[3],
                            calculate_voltage_angles: params[4],
                            init: params[5],
                            delta: params[6],
                            trafo_model: params[7],
                            trafo_loading: params[8],
                            ac_line_model: params[9],
                            numba: params[10],
                            suppress_warnings: params[11],
                            cost_function: params[12],
                            cost_currency: resolveStudyOpfCostCurrency(componentArrays),
                            generator_cost_cp1: genCostCp1,
                            generator_cost_cp2: genCostCp2,
                            ext_grid_cost_cp1: extCostCp1,
                            ext_grid_cost_cp2: extCostCp2,
                            storage_cost_cp1: storCostCp1,
                            storage_cost_cp2: storCostCp2,
                            sgen_cost_cp1: sgenCostCp1,
                            sgen_cost_cp2: sgenCostCp2,
                            load_cost_cp1: loadCostCp1,
                            load_cost_cp2: loadCostCp2,
                            dcline_cost_cp1: dclineCostCp1,
                            dcline_cost_cp2: dclineCostCp2,
                            user_email: userEmail,
                        });
                        
                        const componentProcessingTime = performance.now() - componentProcessingStart;
                        console.log(`Component processing: ${componentProcessingTime.toFixed(2)}ms (${processedComponents} components)`);

                        // Combine all arrays (order matches load-flow payload for create_other_elements)
                        const array = [
                            ...componentArrays.simulationParameters,
                            ...componentArrays.externalGrid,
                            ...componentArrays.generator,
                            ...componentArrays.staticGenerator,
                            ...componentArrays.busbar,
                            ...componentArrays.transformer,
                            ...componentArrays.threeWindingTransformer,
                            ...componentArrays.load,
                            ...componentArrays.storage,
                            ...componentArrays.dcLine,
                            ...componentArrays.line
                        ];

                        const obj = Object.assign({}, array);
                        console.log('OPF Data:', JSON.stringify(obj));
                        
                        // Log performance summary
                        const totalProcessingTime = performance.now() - startTime;
                        console.log(`=== OPF PERFORMANCE SUMMARY ===`);
                        console.log(`Run #${runNumber} - Total processing: ${totalProcessingTime.toFixed(2)}ms`);
                        console.log(`Components processed: ${processedComponents}`);
                        console.log(`Result cells removed: ${resultCellsRemoved}`);
                        
                        // Clean up caches to prevent memory accumulation
                        console.log(`Simulation completed. Cache sizes - cells: ${cellCache.size}, names: ${nameCache.size}, attributes: ${attributeCache.size}`);
                        cellCache.clear();
                        nameCache.clear();
                        attributeCache.clear();
                        console.log('Caches cleared for next simulation');

                        // Send to backend
                        console.log('🌐 Using backend URL:', ENV.backendUrl);
                        processNetworkData(ENV.backendUrl + "/", obj, b, grafka);
                    } 
                });
            }

            tryCreateDialog();
        }
    }


// Main processing function (FROM BACKEND TO FRONTEND)
async function processNetworkData(url, obj, b, grafka) {
    try {
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
        console.log('OPF Results:', dataJson);

        // Check for diagnostic response format
        if (dataJson.error && dataJson.diagnostic) {
            console.log('Optimal Power Flow failed with diagnostic information:', dataJson);

            await ensureElectrisimModule('dialogs/DiagnosticReportDialog');

            // Show diagnostic dialog if available
            if (window.DiagnosticReportDialog) {
                const diagPayload = { ...dataJson.diagnostic };
                if (dataJson.solver_verbose_log) {
                    diagPayload.solver_verbose_log = dataJson.solver_verbose_log;
                }
                const diagnosticDialog = new window.DiagnosticReportDialog(diagPayload, {
                    message: dataJson.message,
                    exception: dataJson.exception,
                });
                diagnosticDialog.show();
            } else {
                // Fallback to alert if dialog is not available
                alert(`Optimal Power Flow calculation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return;
        }

        // Basic result processing (can be expanded)
        if (dataJson.error) {
            alert('Optimal Power Flow Error: ' + dataJson.error);
            return;
        }

        await ensureElectrisimModule('dialogs/OptimalPowerFlowResultsDialog');

        // Show results in a modal dialog
        if (window.OptimalPowerFlowResultsDialog) {
            const dlg = new window.OptimalPowerFlowResultsDialog(dataJson);
            dlg.show();
        } else {
            alert('OPF completed. Results dialog not available.');
        }
        
        console.log('Optimal Power Flow completed successfully');
        
        // Force stop spinner after a short delay to ensure it's cleared
        setTimeout(() => {
            try {
                if (typeof apka !== 'undefined' && apka.spinner) {
                    apka.spinner.stop();
                }
                if (typeof window !== 'undefined' && window.apka && window.apka.spinner) {
                    window.apka.spinner.stop();
                }
                // Manual cleanup - remove any spinner elements from DOM
                const spinnerElements = document.querySelectorAll('.spinner, [class*="spinner"]');
                spinnerElements.forEach(el => {
                    if (el.style.display !== 'none') {
                        el.style.display = 'none';
                        el.remove();
                    }
                });
                
                // Remove any text overlays or status messages
                const textOverlays = document.querySelectorAll('div, span, p');
                textOverlays.forEach(el => {
                    if (el.textContent && el.textContent.includes('Waiting for optimal power flow results')) {
                        el.style.display = 'none';
                        el.remove();
                    }
                });
                
                // Clear any status messages
                if (typeof apka !== 'undefined' && apka.editor && apka.editor.setStatus) {
                    apka.editor.setStatus('');
                }
            } catch (e) {
                console.warn('Timeout spinner stop failed:', e);
            }
        }, 100);

    } catch (err) {
        if (err.message === "server") return;
        console.error('Error processing OPF data:', err);
    } finally {
        // Stop the spinner to clear the "Waiting for optimal power flow results..." message
        try {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
            // Also try to stop any global spinner
            if (typeof window !== 'undefined' && window.apka && window.apka.spinner) {
                window.apka.spinner.stop();
            }
            // Manual cleanup - remove any spinner elements from DOM
            const spinnerElements = document.querySelectorAll('.spinner, [class*="spinner"]');
            spinnerElements.forEach(el => {
                if (el.style.display !== 'none') {
                    el.style.display = 'none';
                    el.remove();
                }
            });
            
            // Remove any text overlays or status messages
            const textOverlays = document.querySelectorAll('div, span, p');
            textOverlays.forEach(el => {
                if (el.textContent && el.textContent.includes('Waiting for optimal power flow results')) {
                    el.style.display = 'none';
                    el.remove();
                }
            });
            
            // Clear any status messages
            if (typeof apka !== 'undefined' && apka.editor && apka.editor.setStatus) {
                apka.editor.setStatus('');
            }
        } catch (spinnerError) {
            console.warn('Could not stop spinner:', spinnerError);
        }
    }
}

// Make optimalPowerFlowPandaPower available globally immediately after definition
if (typeof globalThis !== 'undefined') {
    globalThis.optimalPowerFlowPandaPower = optimalPowerFlowPandaPower;
} else if (typeof window !== 'undefined') {
    window.optimalPowerFlowPandaPower = optimalPowerFlowPandaPower;
}

// Export for module usage if supported
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { optimalPowerFlowPandaPower };
} else if (typeof exports === 'object') {
    try {
        exports.optimalPowerFlowPandaPower = optimalPowerFlowPandaPower;
    } catch (e) {
        // Ignore export errors in non-module environments
    }
}