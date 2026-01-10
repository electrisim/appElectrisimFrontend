// networkPreparation.js - Shared network preparation logic for simulations
// Extracted from loadFlowPandaPower to ensure consistency across all simulation types

/**
 * Prepares network data from graph model for backend simulation
 * This function extracts all network components and prepares them in the format
 * expected by the backend.
 * 
 * @param {Object} graph - mxGraph instance
 * @param {Object} editorUi - Editor UI instance
 * @param {Object} additionalParams - Additional parameters to include (e.g., simulation params)
 * @returns {Object} Network data object ready to send to backend
 */
export function prepareNetworkData(graph, editorUi, additionalParams = {}) {
    const model = graph.getModel();
    const b = model; // Graph model alias
    
    // Import required functions and constants from loadFlow.js context
    // These should be available globally or we need to import them
    const COMPONENT_TYPES = window.COMPONENT_TYPES || {
        EXTERNAL_GRID: 'ExternalGrid',
        GENERATOR: 'Generator',
        STATIC_GENERATOR: 'StaticGenerator',
        ASYMMETRIC_STATIC_GENERATOR: 'AsymmetricStaticGenerator',
        BUS: 'Busbar',
        TRANSFORMER: 'Transformer',
        THREE_WINDING_TRANSFORMER: 'ThreeWindingTransformer',
        SHUNT_REACTOR: 'ShuntReactor',
        CAPACITOR: 'Capacitor',
        LOAD: 'Load',
        ASYMMETRIC_LOAD: 'AsymmetricLoad',
        IMPEDANCE: 'Impedance',
        WARD: 'Ward',
        EXTENDED_WARD: 'ExtendedWard',
        MOTOR: 'Motor',
        STORAGE: 'Storage',
        SVC: 'SVC',
        TCSC: 'TCSC',
        SSC: 'SSC',
        DC_BUS: 'DCBus',
        LOAD_DC: 'LoadDc',
        SOURCE_DC: 'SourceDc',
        SWITCH: 'Switch',
        VSC: 'VSC',
        B2B_VSC: 'B2BVSC',
        DC_LINE: 'DCLine',
        LINE: 'Line'
    };

    // Helper functions - these should be imported or made available
    // For now, we'll reference them from the global scope or loadFlow context
    const getCachedCell = window.getCachedCell || ((cellId) => model.getCell(cellId));
    const getUserFriendlyName = window.getUserFriendlyName || ((cell) => {
        try {
            const value = cell.value;
            if (value && value.attributes) {
                const nameAttr = value.attributes.getNamedItem('name');
                if (nameAttr) return nameAttr.nodeValue;
            }
            return cell.mxObjectId ? cell.mxObjectId.replace('#', '_') : cell.getId();
        } catch (e) {
            return cell.getId();
        }
    });
    
    const getCachedAttributes = window.getCachedAttributes || ((cell, attributeMap) => {
        const result = {};
        if (!cell || !cell.value || !cell.value.attributes) return result;
        
        for (const [key, attrConfig] of Object.entries(attributeMap)) {
            const attrName = typeof attrConfig === 'string' ? attrConfig : attrConfig.name;
            const attr = cell.value.attributes.getNamedItem(attrName);
            if (attr) {
                result[key] = attr.nodeValue;
            } else if (typeof attrConfig === 'object' && attrConfig.optional) {
                // Optional attribute, skip if not present
            }
        }
        return result;
    });
    
    const getAttributesAsObject = window.getAttributesAsObject || getCachedAttributes;
    const getConnectedBusId = window.getConnectedBusId || ((cell, isLine = false) => {
        if (!cell || !cell.edges) return null;
        for (let i = 0; i < cell.edges.length; i++) {
            const edge = cell.edges[i];
            if (edge) {
                const target = edge.target || edge.getTerminal(true);
                if (target) {
                    const style = target.getStyle();
                    if (style && (style.includes('shapeELXXX=Busbar') || style.includes('busbar'))) {
                        return target.getId();
                    }
                }
            }
        }
        return null;
    });
    
    const getTransformerConnections = window.getTransformerConnections || ((cell) => {
        const edges = cell.edges || [];
        const buses = edges.map(edge => {
            const target = edge.target || edge.getTerminal(true);
            return target ? target.getId() : null;
        }).filter(id => id);
        return {
            hv_bus: buses[0] || null,
            lv_bus: buses[1] || null
        };
    });
    
    const getThreeWindingConnections = window.getThreeWindingConnections || ((cell) => {
        const edges = cell.edges || [];
        const buses = edges.map(edge => {
            const target = edge.target || edge.getTerminal(true);
            return target ? target.getId() : null;
        }).filter(id => id);
        return {
            hv_bus: buses[0] || null,
            mv_bus: buses[1] || null,
            lv_bus: buses[2] || null
        };
    });
    
    const getImpedanceConnections = window.getImpedanceConnections || ((cell) => {
        const edges = cell.edges || [];
        const buses = edges.map(edge => {
            const target = edge.target || edge.getTerminal(true);
            return target ? target.getId() : null;
        }).filter(id => id);
        return {
            from_bus: buses[0] || null,
            to_bus: buses[1] || null
        };
    });
    
    const getConnectedBuses = window.getConnectedBuses || ((cell) => {
        const edges = cell.edges || [];
        const buses = edges.map(edge => {
            const target = edge.target || edge.getTerminal(true);
            return target ? target.getId() : null;
        }).filter(id => id);
        return {
            from_bus: buses[0] || null,
            to_bus: buses[1] || null
        };
    });
    
    const parseCellStyle = window.parseCellStyle || ((style) => {
        const result = {};
        if (!style) return result;
        const parts = style.split(';');
        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) {
                result[key] = value;
            }
        });
        return result;
    });

    // Initialize counters
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

    // Initialize component arrays
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
        SSC: [],
        SVC: [],
        TCSC: [],
        VSC: [],
        B2BVSC: [],
        dcBus: [],
        loadDc: [],
        sourceDc: [],
        switch: [],
        dcLine: [],
        line: []
    };

    // Add any additional parameters (like simulation parameters)
    if (additionalParams.simulationParameters) {
        componentArrays.simulationParameters.push(...additionalParams.simulationParameters);
    }

    // Get all cells
    const cellsArray = model.cells ? Object.values(model.cells) : [];
    
    // Process cells
    const validCells = [];
    const styleCache = new Map();
    
    cellsArray.forEach(cell => {
        if (!cell || !cell.value) return;
        
        const cellStyle = cell.getStyle();
        if (!cellStyle) return;
        
        // Cache style parsing
        let style = styleCache.get(cellStyle);
        if (!style) {
            style = parseCellStyle(cellStyle);
            styleCache.set(cellStyle, style);
        }
        
        const componentType = style.shapeELXXX;
        if (componentType && componentType !== 'NotEditableLine') {
            validCells.push({ cell, style, componentType });
        }
    });

    // Pre-compute common data
    const preComputedData = new Map();
    validCells.forEach(({ cell, componentType }) => {
        const cellId = cell.id;
        preComputedData.set(cellId, {
            name: cell.mxObjectId ? cell.mxObjectId.replace('#', '_') : cell.getId(),
            id: cellId,
            userFriendlyName: getUserFriendlyName(cell),
            bus: (componentType === 'Line' || componentType === 'DCLine') 
                ? getConnectedBusId(cell, true) 
                : getConnectedBusId(cell)
        });
    });

    // Process components
    validCells.forEach(({ cell, style, componentType }) => {
        const baseData = preComputedData.get(cell.id);
        if (!baseData) return;

        switch (componentType) {
            case COMPONENT_TYPES.EXTERNAL_GRID:
                componentArrays.externalGrid.push({
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
                });
                break;

            case COMPONENT_TYPES.BUS:
                componentArrays.busbar.push({
                    typ: `Bus${counters.busbar++}`,
                    name: baseData.name,
                    id: baseData.id,
                    vn_kv: cell.value?.attributes?.[2]?.nodeValue || '20.0',
                    userFriendlyName: baseData.userFriendlyName
                });
                break;

            case COMPONENT_TYPES.STORAGE:
                componentArrays.storage.push({
                    typ: `Storage${counters.storage++}`,
                    name: baseData.name,
                    id: baseData.id,
                    userFriendlyName: baseData.userFriendlyName,
                    bus: baseData.bus,
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
                });
                break;

            case COMPONENT_TYPES.TRANSFORMER:
                const { hv_bus, lv_bus } = getTransformerConnections(cell);
                componentArrays.transformer.push({
                    typ: `Transformer${counters.transformer++}`,
                    name: baseData.name,
                    id: baseData.id,
                    userFriendlyName: baseData.userFriendlyName,
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
                        in_service: { name: 'in_service', optional: true }
                    })
                });
                break;

            case COMPONENT_TYPES.LINE:
                componentArrays.line.push({
                    typ: `Line${counters.line++}`,
                    name: baseData.name,
                    id: baseData.id,
                    userFriendlyName: baseData.userFriendlyName,
                    ...getConnectedBuses(cell),
                    ...getAttributesAsObject(cell, {
                        length_km: 'length_km',
                        r_ohm_per_km: 'r_ohm_per_km',
                        x_ohm_per_km: 'x_ohm_per_km',
                        c_nf_per_km: 'c_nf_per_km',
                        max_i_ka: 'max_i_ka',
                        type: 'type',
                        in_service: { name: 'in_service', optional: true }
                    })
                });
                break;

            // Add other component types as needed
            // For BESS sizing, we primarily need: busbars, storage, external grids, transformers, lines
            // Other components can be added if needed for the simulation
        }
    });

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

    // Convert to object format expected by backend
    const obj = Object.assign({}, array);
    
    return obj;
}
