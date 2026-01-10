/**
 * Shared network data preparation utility
 * Extracts network components from the graph model for backend processing
 * Used by both loadFlow and bessSizing calculations
 */

import {
    getConnectedBusId,
    parseCellStyle,
    getAttributesAsObject,
    getTransformerConnections,
    updateTransformerBusConnections,
    updateThreeWindingTransformerConnections,
    getThreeWindingConnections,
    getImpedanceConnections,
    getConnectedBuses,
    validateBusConnections,
    COMPONENT_TYPES
} from '../loadFlow.js';

/**
 * Get user email with robust fallback
 */
function getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) {
                return user.email;
            }
        }
        if (typeof getCurrentUser === 'function') {
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.email) {
                return currentUser.email;
            }
        }
        if (window.getCurrentUser && typeof window.getCurrentUser === 'function') {
            const currentUser = window.getCurrentUser();
            if (currentUser && currentUser.email) {
                return currentUser.email;
            }
        }
        if (window.authHandler && window.authHandler.getCurrentUser) {
            const currentUser = window.authHandler.getCurrentUser();
            if (currentUser && currentUser.email) {
                return currentUser.email;
            }
        }
        return 'unknown@user.com';
    } catch (error) {
        console.warn('Error getting user email:', error);
        return 'unknown@user.com';
    }
}

/**
 * Prepare network data from graph model
 * @param {Object} graph - The mxGraph instance
 * @param {Object} simulationParameters - Simulation-specific parameters (loadFlow params or bessSizing params)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.removeResultCells - Whether to remove previous result cells (default: true for loadFlow, false for bessSizing)
 * @returns {Object} Prepared network data object ready for backend
 */
export function prepareNetworkData(graph, simulationParameters, options = {}) {
    const {
        removeResultCells = false  // Default to false, loadFlow can override
    } = options;

    const startTime = performance.now();
    const model = graph.getModel();
    
    // Create counters object
    const counters = {
        externalGrid: 0,
        generator: 0,
        staticGenerator: 0,
        asymmetricGenerator: 0,
        busbar: 0,
        dcBus: 0,
        transformer: 0,
        threeWindingTransformer: 0,
        shuntReactor: 0,
        capacitor: 0,
        load: 0,
        loadDc: 0,
        asymmetricLoad: 0,
        sourceDc: 0,
        switch: 0,
        impedance: 0,
        ward: 0,
        extendedWard: 0,
        motor: 0,
        storage: 0,
        SVC: 0,
        TCSC: 0,
        SSC: 0,
        VSC: 0,
        B2BVSC: 0,
        dcLine: 0,
        line: 0
    };

    // Clear all caches at the start of each simulation to prevent memory accumulation
    const cellCache = new Map();
    const nameCache = new Map();
    const attributeCache = new Map();
    
    // Helper function to get cached cell
    const getCachedCell = (cellId, cellName = null) => {
        if (cellCache.has(cellId)) {
            return cellCache.get(cellId);
        }
        
        let cell = model.getCell(cellId);
        if (cell) {
            cellCache.set(cellId, cell);
            return cell;
        }
        
        if (cellName) {
            const mxObjectId = '#' + cellName.replace('_', '');
            cell = model.getCell(mxObjectId);
            if (cell) {
                cellCache.set(cellId, cell);
                return cell;
            }
        }
        
        const allCells = model.getDescendants();
        for (let i = 0; i < allCells.length; i++) {
            const candidate = allCells[i];
            if (candidate.id === cellId || 
                candidate.mxObjectId === cellId || 
                candidate.mxObjectId === ('#' + cellId.replace('_', '')) ||
                (cellName && candidate.mxObjectId === ('#' + cellName.replace('_', '')))) {
                cellCache.set(cellId, candidate);
                return candidate;
            }
            
            if (candidate.value && candidate.value.attributes) {
                const idAttr = candidate.value.attributes.getNamedItem('id');
                if (idAttr && idAttr.nodeValue === cellId) {
                    cellCache.set(cellId, candidate);
                    return candidate;
                }
                for (let j = 0; j < candidate.value.attributes.length; j++) {
                    const attr = candidate.value.attributes[j];
                    if (attr.nodeName === 'id' && attr.nodeValue === cellId) {
                        cellCache.set(cellId, candidate);
                        return candidate;
                    }
                }
            }
        }
        
        console.warn('Could not find cell for id:', cellId, 'name:', cellName);
        return null;
    };
    
    // Optimized userFriendlyName function with caching
    const getUserFriendlyName = (cell) => {
        const cellId = cell.id;
        if (nameCache.has(cellId)) {
            return nameCache.get(cellId);
        }
        
        let name = cell.mxObjectId.replace('#', '_');
        if (cell.value && cell.value.attributes) {
            for (let i = 0; i < cell.value.attributes.length; i++) {
                if (cell.value.attributes[i].nodeName === 'name') {
                    name = cell.value.attributes[i].nodeValue;
                    break;
                }
            }
        }
        
        nameCache.set(cellId, name);
        return name;
    };
    
    // Highly optimized cached version
    const getCachedAttributes = (cell, attributeMap) => {
        const cacheKey = `${cell.id}_${Object.keys(attributeMap).length}`;
        if (attributeCache.has(cacheKey)) {
            return attributeCache.get(cacheKey);
        }
        
        const result = getAttributesAsObject(cell, attributeMap);
        attributeCache.set(cacheKey, result);
        return result;
    };

    // Create arrays for different components
    const componentArrays = {
        simulationParameters: [],
        externalGrid: [],
        generator: [],
        staticGenerator: [],
        asymmetricGenerator: [],
        busbar: [],
        dcBus: [],
        transformer: [],
        threeWindingTransformer: [],
        shuntReactor: [],
        capacitor: [],
        load: [],
        loadDc: [],
        asymmetricLoad: [],
        sourceDc: [],
        switch: [],
        impedance: [],
        ward: [],
        extendedWard: [],
        motor: [],
        storage: [],
        SVC: [],
        TCSC: [],
        SSC: [],
        VSC: [],
        B2BVSC: [],
        dcLine: [],
        line: []
    };

    // Add simulation parameters
    const userEmail = getUserEmail();
    componentArrays.simulationParameters.push({
        ...simulationParameters,
        user_email: userEmail
    });

    // Get all cells
    let cellsArray = model.getDescendants();
    
    // Process cells
    const cellProcessingStart = performance.now();
    const validCells = [];
    const resultCellsToRemove = [];
    let resultCellsRemoved = 0;
    
    const styleCache = new Map();
    cellsArray.forEach(cell => {
        const cellStyle = cell.getStyle();
        const value = cell.getValue();
        
        // Skip initial placeholders
        if (value && typeof value === 'string' && value.includes('Click Simulate')) {
            return;
        }
        
        // Remove previous results if requested
        if (removeResultCells && cellStyle?.includes("Result") &&
            !cellStyle?.includes("ResultExternalGrid") &&
            !cellStyle?.includes("placeholderId=")) {
            resultCellsToRemove.push(cell);
            resultCellsRemoved++;
            return;
        }

        // Cache style parsing
        let style = styleCache.get(cellStyle);
        if (!style) {
            style = parseCellStyle(cellStyle);
            styleCache.set(cellStyle, style);
        }
        
        if (style?.shapeELXXX && style.shapeELXXX !== 'NotEditableLine') {
            validCells.push({ cell, style, componentType: style.shapeELXXX });
        }
    });
    
    // Batch remove result cells if requested
    if (removeResultCells && resultCellsToRemove.length > 0) {
        try {
            model.beginUpdate();
            resultCellsToRemove.forEach(cell => {
                const cellToRemove = model.getCell(cell.id);
                if (cellToRemove) {
                    model.remove(cellToRemove);
                }
            });
        } finally {
            model.endUpdate();
        }
    }
    
    const cellProcessingTime = performance.now() - cellProcessingStart;

    // Process valid cells
    const componentProcessingStart = performance.now();
    let processedComponents = 0;
    
    // Pre-compute common data
    const preComputedData = new Map();
    validCells.forEach(({ cell, componentType }) => {
        const cellStyle = cell.getStyle();
        if(!cellStyle?.includes("ResultExternalGrid")){
            const cellId = cell.id;
            preComputedData.set(cellId, {
                name: cell.mxObjectId.replace('#', '_'),
                id: cellId,
                userFriendlyName: getUserFriendlyName(cell),
                bus: (componentType === 'Line' || componentType === 'DCLine') 
                    ? getConnectedBusId(cell, true) 
                    : getConnectedBusId(cell)
            });
        }
    });
    
    const componentTypeTimings = {};
    
    // Process components
    validCells.forEach(({ cell, style, componentType }, i) => {
        const componentStart = performance.now();
        processedComponents++;
        
        const baseData = preComputedData.get(cell.id);

        switch (componentType) {
            case COMPONENT_TYPES.EXTERNAL_GRID:
                const externalGrid = {
                    ...baseData,
                    typ: `External Grid${counters.externalGrid++}`,
                    ...getCachedAttributes(cell, {                                
                        vm_pu: 'vm_pu',
                        va_degree: 'va_degree',
                        s_sc_max_mva: 's_sc_max_mva',
                        s_sc_min_mva: 's_sc_min_mva',
                        rx_max: 'rx_max',
                        rx_min: 'rx_min',
                        r0x0_max: 'r0x0_max',
                        x0x_max: 'x0x_max',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.externalGrid.push(externalGrid);
                break;

            case COMPONENT_TYPES.GENERATOR:
                const generator = {
                    ...baseData,
                    typ: "Generator",
                    ...getCachedAttributes(cell, {
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
                        in_service: { name: 'in_service', optional: true }
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
                        current_source: 'current_source',
                        in_service: { name: 'in_service', optional: true }
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
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
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
                    userFriendlyName: baseData.userFriendlyName
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
                        tap_changer_type: { name: 'tap_changer_type', optional: true },
                        in_service: { name: 'in_service', optional: true }
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
                        vk0_hv_percent: 'vk0_hv_percent',
                        vk0_mv_percent: 'vk0_mv_percent',
                        vk0_lv_percent: 'vk0_lv_percent',
                        vkr0_hv_percent: 'vkr0_hv_percent',
                        vkr0_mv_percent: 'vkr0_mv_percent',
                        vkr0_lv_percent: 'vkr0_lv_percent',
                        vector_group: 'vector_group',
                        shift_mv_degree: { name: 'shift_mv_degree', optional: true },
                        shift_lv_degree: { name: 'shift_lv_degree', optional: true },
                        tap_step_percent: { name: 'tap_step_percent', optional: true },
                        tap_side: { name: 'tap_side', optional: true },
                        tap_neutral: { name: 'tap_neutral', optional: true },
                        tap_min: { name: 'tap_min', optional: true },
                        tap_max: { name: 'tap_max', optional: true },
                        tap_pos: { name: 'tap_pos', optional: true },
                        tap_at_star_point: { name: 'tap_at_star_point', optional: true },
                        tap_changer_type: { name: 'tap_changer_type', optional: true },
                        in_service: { name: 'in_service', optional: true }
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
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        vn_kv: 'vn_kv',
                        step: { name: 'step', optional: true },
                        max_step: { name: 'max_step', optional: true },
                        in_service: { name: 'in_service', optional: true }
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
                        q_mvar: 'q_mvar',
                        loss_factor: 'loss_factor',
                        vn_kv: 'vn_kv',
                        step: { name: 'step', optional: true },
                        max_step: { name: 'max_step', optional: true },
                        in_service: { name: 'in_service', optional: true }
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
                        p_mw: 'p_mw',
                        q_mvar: 'q_mvar',
                        const_z_percent: 'const_z_percent',
                        const_i_percent: 'const_i_percent',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
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
                        p_a_mw: 'p_a_mw',
                        p_b_mw: 'p_b_mw',
                        p_c_mw: 'p_c_mw',
                        q_a_mvar: 'q_a_mvar',
                        q_b_mvar: 'q_b_mvar',
                        q_c_mvar: 'q_c_mvar',
                        sn_mva: 'sn_mva',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
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
                            rft_pu: 'rft_pu',
                            xft_pu: 'xft_pu',
                            sn_mva: 'sn_mva',
                            in_service: { name: 'in_service', optional: true }
                        })
                    };
                    componentArrays.impedance.push(impedance);
                } catch (error) {
                    console.error('Error processing impedance:', error);
                }
                break;

            case COMPONENT_TYPES.WARD:
                const ward = {
                    typ: `Ward${counters.ward++}`,
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
                    bus: getConnectedBusId(cell),
                    ...getAttributesAsObject(cell, {
                        ps_mw: 'ps_mw',
                        qs_mvar: 'qs_mvar',
                        pz_mw: 'pz_mw',
                        qz_mvar: 'qz_mvar',
                        in_service: { name: 'in_service', optional: true }
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
                        ps_mw: 'ps_mw',
                        qs_mvar: 'qs_mvar',
                        pz_mw: 'pz_mw',
                        qz_mvar: 'qz_mvar',
                        r_ohm: 'r_ohm',
                        x_ohm: 'x_ohm',
                        vm_pu: 'vm_pu',
                        in_service: { name: 'in_service', optional: true }
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
                        pn_mech_mw: 'pn_mech_mw',
                        cos_phi: 'cos_phi',
                        efficiency_percent: 'efficiency_percent',
                        loading_percent: 'loading_percent',
                        scaling: 'scaling',
                        cos_phi_n: 'cos_phi_n',
                        efficiency_n_percent: 'efficiency_n_percent',
                        lrc_pu: 'lrc_pu',
                        rx: 'rx',
                        vn_kv: 'vn_kv',
                        in_service: { name: 'in_service', optional: true }
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
                        p_mw: 'p_mw',
                        max_e_mwh: 'max_e_mwh',
                        q_mvar: 'q_mvar',
                        sn_mva: 'sn_mva',
                        soc_percent: 'soc_percent',
                        min_e_mwh: 'min_e_mwh',
                        scaling: 'scaling',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
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
                        x_l_ohm: 'x_l_ohm',
                        x_cvar_ohm: 'x_cvar_ohm',
                        set_vm_pu: 'set_vm_pu',
                        thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                        controllable: 'controllable',
                        min_angle_degree: 'min_angle_degree',
                        max_angle_degree: 'max_angle_degree',
                        in_service: { name: 'in_service', optional: true }
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
                        x_l_ohm: 'x_l_ohm',
                        x_cvar_ohm: 'x_cvar_ohm',
                        set_p_to_mw: 'set_p_to_mw',
                        thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                        controllable: 'controllable',
                        min_angle_degree: 'min_angle_degree',
                        max_angle_degree: 'max_angle_degree',
                        in_service: { name: 'in_service', optional: true }
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
                        r_ohm: 'r_ohm',
                        x_ohm: 'x_ohm',
                        set_vm_pu: 'set_vm_pu',
                        vm_internal_pu: 'vm_internal_pu',
                        va_internal_degree: 'va_internal_degree',
                        controllable: 'controllable',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.SSC.push(SSC);
                break;

            case COMPONENT_TYPES.DC_BUS:
                const dcBus = {
                    typ: `DC Bus${counters.dcBus++}`,
                    name: cell.mxObjectId.replace('#', '_'),
                    id: cell.id,
                    vn_kv: cell.value.attributes[2]?.nodeValue || "0",
                    userFriendlyName: baseData.userFriendlyName
                };
                componentArrays.dcBus.push(dcBus);
                break;

            case COMPONENT_TYPES.LOAD_DC:
                const loadDc = {
                    typ: `Load DC${counters.loadDc++}`,
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
                    bus: getConnectedBusId(cell),
                    ...getAttributesAsObject(cell, {
                        p_mw: 'p_mw',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.loadDc.push(loadDc);
                break;

            case COMPONENT_TYPES.SOURCE_DC:
                const sourceDc = {
                    typ: `Source DC${counters.sourceDc++}`,
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
                    bus: getConnectedBusId(cell),
                    ...getAttributesAsObject(cell, {
                        vm_pu: 'vm_pu',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.sourceDc.push(sourceDc);
                break;

            case COMPONENT_TYPES.SWITCH:
                const switchElement = {
                    typ: `Switch${counters.switch++}`,
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
                    ...getAttributesAsObject(cell, {
                        et: 'et',
                        type: 'type',
                        closed: 'closed',
                        z_ohm: 'z_ohm',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.switch.push(switchElement);
                break;

            case COMPONENT_TYPES.VSC:
                const vsc = {
                    typ: `VSC${counters.VSC++}`,
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
                    bus: getConnectedBusId(cell),
                    ...getAttributesAsObject(cell, {
                        p_mw: 'p_mw',
                        vm_pu: 'vm_pu',
                        sn_mva: 'sn_mva',
                        rx: 'rx',
                        max_ik_ka: 'max_ik_ka',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.VSC.push(vsc);
                break;

            case COMPONENT_TYPES.B2B_VSC:
                const b2bVsc = {
                    typ: `B2B VSC${counters.B2BVSC++}`,
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
                    ...getAttributesAsObject(cell, {
                        bus1: 'bus1',
                        bus2: 'bus2',
                        p_mw: 'p_mw',
                        vm1_pu: 'vm1_pu',
                        vm2_pu: 'vm2_pu',
                        sn_mva: 'sn_mva',
                        rx: 'rx',
                        max_ik_ka: 'max_ik_ka',
                        in_service: { name: 'in_service', optional: true }
                    })
                };
                componentArrays.B2BVSC.push(b2bVsc);
                break;

            case COMPONENT_TYPES.DC_LINE:
                const dcLine = {
                    typ: `DC Line${counters.dcLine++}`,
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
                    bus: getConnectedBusId(cell),
                    ...getAttributesAsObject(cell, {
                        p_mw: 'p_mw',
                        loss_percent: 'loss_percent',
                        loss_mw: 'loss_mw',
                        vm_from_pu: 'vm_from_pu',
                        vm_to_pu: 'vm_to_pu',
                        in_service: { name: 'in_service', optional: true }
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
                        length_km: 'length_km',
                        parallel: { name: 'parallel', optional: true },
                        df: { name: 'df', optional: true },
                        in_service: { name: 'in_service', optional: true },
                        r_ohm_per_km: 'r_ohm_per_km',
                        x_ohm_per_km: 'x_ohm_per_km',
                        c_nf_per_km: 'c_nf_per_km',
                        g_us_per_km: 'g_us_per_km',
                        max_i_ka: 'max_i_ka',
                        type: 'type',
                        r0_ohm_per_km: { name: 'r0_ohm_per_km', optional: true },
                        x0_ohm_per_km: { name: 'x0_ohm_per_km', optional: true },
                        c0_nf_per_km: { name: 'c0_nf_per_km', optional: true },
                        endtemp_degree: { name: 'endtemp_degree', optional: true },
                    })
                };

                // Validate bus connections
                try {
                    validateBusConnections(cell);
                } catch (error) {
                    console.error(error.message);
                }

                componentArrays.line.push(line);
                break;
        }
        
        const componentTime = performance.now() - componentStart;
        if (!componentTypeTimings[componentType]) {
            componentTypeTimings[componentType] = { time: 0, count: 0 };
        }
        componentTypeTimings[componentType].time += componentTime;
        componentTypeTimings[componentType].count++;
    });

    // Update transformer connections
    if (componentArrays.transformer.length > 0) {
        componentArrays.transformer = updateTransformerBusConnections(componentArrays.transformer, componentArrays.busbar, graph);
    }
    if (componentArrays.threeWindingTransformer.length > 0) {
        componentArrays.threeWindingTransformer = updateThreeWindingTransformerConnections(componentArrays.threeWindingTransformer, componentArrays.busbar, graph);
    }

    // Build final array
    const array = [];
    let arrayIndex = 0;
    
    const addComponents = (components) => {
        for (let i = 0; i < components.length; i++) {
            array[arrayIndex++] = components[i];
        }
    };
    
    addComponents(componentArrays.simulationParameters);
    addComponents(componentArrays.externalGrid);
    addComponents(componentArrays.generator);
    addComponents(componentArrays.staticGenerator);
    addComponents(componentArrays.asymmetricGenerator);
    addComponents(componentArrays.busbar);
    addComponents(componentArrays.transformer);
    addComponents(componentArrays.threeWindingTransformer);
    addComponents(componentArrays.shuntReactor);
    addComponents(componentArrays.capacitor);
    addComponents(componentArrays.load);
    addComponents(componentArrays.asymmetricLoad);
    addComponents(componentArrays.impedance);
    addComponents(componentArrays.ward);
    addComponents(componentArrays.extendedWard);
    addComponents(componentArrays.motor);
    addComponents(componentArrays.storage);
    addComponents(componentArrays.SSC);
    addComponents(componentArrays.SVC);
    addComponents(componentArrays.TCSC);
    addComponents(componentArrays.VSC);
    addComponents(componentArrays.B2BVSC);
    addComponents(componentArrays.dcBus);
    addComponents(componentArrays.loadDc);
    addComponents(componentArrays.sourceDc);
    addComponents(componentArrays.switch);
    addComponents(componentArrays.dcLine);
    addComponents(componentArrays.line);

    // Create final object
    const obj = Object.assign({}, array);
    
    const dataProcessingTime = performance.now() - startTime;
    console.log(`Network data preparation completed in ${dataProcessingTime.toFixed(2)}ms`);
    console.log(`Processed ${processedComponents} components`);
    
    // Clean up caches
    cellCache.clear();
    nameCache.clear();
    attributeCache.clear();
    
    return obj;
}
