// ComponentsDataDialog.js - Dialog for viewing all components data organized by tabs
import { Dialog } from '../Dialog.js';

// Component type constants (from loadFlow.js)
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

export class ComponentsDataDialog {
    constructor(ui, rootCell) {
        this.ui = ui;
        this.graph = ui.editor.graph;
        this.model = this.graph.getModel();
        this.rootCell = rootCell;
        this.components = {};
        this.currentTab = null;
        this.gridInstances = {}; // Store grid instances for cleanup
        this.originalData = {}; // Store original data for cancel functionality
        this.hasChanges = false; // Track if any changes were made
        this.changedCells = new Map(); // Track which cells have been edited: Map<cellId, Set<attributeName>>
        
        // Initialize component arrays
        Object.values(COMPONENT_TYPES).forEach(type => {
            this.components[type] = [];
        });
        
        this.processComponents();
    }

    // Helper function to parse cell style (from loadFlow.js)
    parseCellStyle(style) {
        if (!style) return null;
        const styleObj = {};
        style.split(';').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                styleObj[key] = value;
            }
        });
        return styleObj;
    }

    // Helper function to get connected bus ID (from loadFlow.js)
    getConnectedBusId(cell, isLine = false) {
        // For lines (edges), directly access source and target
        if (isLine) {
            // Check if the cell is an edge itself
            if (cell.edge || this.model.isEdge(cell)) {
                const source = cell.source;
                const target = cell.target;
                
                if (source && target) {
                    return {
                        from_bus: source.mxObjectId?.replace('#', '_') || source.id,
                        to_bus: target.mxObjectId?.replace('#', '_') || target.id
                    };
                }
            }
            
            // Fallback: treat as a vertex with connections
            const edges = this.graph.getEdges(cell);
            if (edges && edges.length >= 2) {
                return {
                    from_bus: edges[0].source?.mxObjectId?.replace('#', '_') || edges[0].source?.id || 'N/A',
                    to_bus: edges[1].target?.mxObjectId?.replace('#', '_') || edges[1].target?.id || 'N/A'
                };
            }
            
            return null;
        }
        
        // For non-line components, get the first connected bus
        const edges = this.graph.getEdges(cell);
        if (!edges || edges.length === 0) return null;

        const connectedCells = [];
        edges.forEach(edge => {
            const target = edge.target !== cell ? edge.target : edge.source;
            if (target && target !== cell) {
                connectedCells.push(target);
            }
        });

        return connectedCells.length > 0 ? 
            (connectedCells[0].mxObjectId?.replace('#', '_') || connectedCells[0].id) : null;
    }

    // Helper function to get attributes as object (from loadFlow.js)
    getAttributesAsObject(cell, attributeMap) {
        const result = {};
        if (!cell.value || !cell.value.attributes) return result;

        Object.entries(attributeMap).forEach(([key, config]) => {
            const attributeName = typeof config === 'string' ? config : config.name;
            const isOptional = typeof config === 'object' && config.optional;
            const defaultValue = typeof config === 'object' && config.defaultValue !== undefined ? config.defaultValue : undefined;
            
            const attribute = Array.from(cell.value.attributes).find(attr => attr.name === attributeName);
            if (attribute) {
                result[key] = attribute.value;
            } else if (isOptional && defaultValue !== undefined) {
                // Use default value for optional attributes
                result[key] = defaultValue;
            } else if (!isOptional) {
                result[key] = 'N/A';
            }
        });

        return result;
    }

    // Process all components in the graph
    processComponents() {
        const cellsArray = this.model.getDescendants();
        const counters = {
            externalGrid: 1, generator: 1, staticGenerator: 1, asymmetricGenerator: 1,
            busbar: 1, transformer: 1, threeWindingTransformer: 1, shuntReactor: 1,
            capacitor: 1, load: 1, asymmetricLoad: 1, impedance: 1, ward: 1,
            extendedWard: 1, motor: 1, storage: 1, SVC: 1, TCSC: 1, SSC: 1,
            dcLine: 1, line: 1
        };

        cellsArray.forEach(cell => {
            // Skip result cells
            if (cell.getStyle()?.includes("Result")) return;
            
            const style = this.parseCellStyle(cell.getStyle());
            if (!style) return;

            const componentType = style.shapeELXXX;
            if (!componentType || componentType === 'NotEditableLine') return;

            // Get name from cell attribute if available, otherwise use mxObjectId or id
            let componentName = cell.mxObjectId?.replace('#', '_') || cell.id;
            if (cell.value && cell.value.attributes) {
                const nameAttribute = Array.from(cell.value.attributes).find(attr => attr.name === 'name');
                if (nameAttribute && nameAttribute.value) {
                    componentName = nameAttribute.value;
                }
            }

            // Create base data
            let baseData = {
                name: componentName,
                id: cell.id
            };

            // Add bus connections for non-line components
            if (componentType !== 'Line' && componentType !== 'DC Line' && componentType !== 'DCLine') {
                baseData.bus = this.getConnectedBusId(cell);
            }

            // Process each component type
            // Map shapeELXXX values to COMPONENT_TYPES values
            // Handle both with and without spaces as components may use either format
            let mappedType = null;
            switch (componentType) {
                case 'External Grid':
                case 'ExternalGrid':
                    mappedType = COMPONENT_TYPES.EXTERNAL_GRID;
                    break;
                case 'Generator':
                    mappedType = COMPONENT_TYPES.GENERATOR;
                    break;
                case 'Static Generator':
                case 'StaticGenerator':
                case 'Sgen':
                case 'sgen':
                case 'PVSystem':
                    mappedType = COMPONENT_TYPES.STATIC_GENERATOR;
                    break;
                case 'Asymmetric Static Generator':
                case 'AsymmetricStaticGenerator':
                    mappedType = COMPONENT_TYPES.ASYMMETRIC_STATIC_GENERATOR;
                    break;
                case 'Bus':
                    mappedType = COMPONENT_TYPES.BUS;
                    break;
                case 'Load':
                    mappedType = COMPONENT_TYPES.LOAD;
                    break;
                case 'Line':
                    mappedType = COMPONENT_TYPES.LINE;
                    break;
                case 'Transformer':
                    mappedType = COMPONENT_TYPES.TRANSFORMER;
                    break;
                case 'Three Winding Transformer':
                case 'ThreeWindingTransformer':
                    mappedType = COMPONENT_TYPES.THREE_WINDING_TRANSFORMER;
                    break;
                case 'Shunt Reactor':
                case 'ShuntReactor':
                    mappedType = COMPONENT_TYPES.SHUNT_REACTOR;
                    break;
                case 'Capacitor':
                    mappedType = COMPONENT_TYPES.CAPACITOR;
                    break;
                case 'Asymmetric Load':
                case 'AsymmetricLoad':
                    mappedType = COMPONENT_TYPES.ASYMMETRIC_LOAD;
                    break;
                case 'Impedance':
                    mappedType = COMPONENT_TYPES.IMPEDANCE;
                    break;
                case 'Ward':
                    mappedType = COMPONENT_TYPES.WARD;
                    break;
                case 'Extended Ward':
                case 'ExtendedWard':
                    mappedType = COMPONENT_TYPES.EXTENDED_WARD;
                    break;
                case 'Motor':
                    mappedType = COMPONENT_TYPES.MOTOR;
                    break;
                case 'Storage':
                    mappedType = COMPONENT_TYPES.STORAGE;
                    break;
                case 'SVC':
                    mappedType = COMPONENT_TYPES.SVC;
                    break;
                case 'TCSC':
                    mappedType = COMPONENT_TYPES.TCSC;
                    break;
                case 'SSC':
                    mappedType = COMPONENT_TYPES.SSC;
                    break;
                case 'DC Line':
                case 'DCLine':
                    mappedType = COMPONENT_TYPES.DC_LINE;
                    break;
            }
            
            if (!mappedType) {
                return; // Skip if component type is not recognized
            }
            
            switch (mappedType) {
                case COMPONENT_TYPES.EXTERNAL_GRID:
                    this.components[COMPONENT_TYPES.EXTERNAL_GRID].push({
                        ...baseData,
                        type: `External Grid ${counters.externalGrid++}`,
                        ...this.getAttributesAsObject(cell, {
                            vm_pu: 'vm_pu',
                            va_degree: 'va_degree',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            s_sc_max_mva: 's_sc_max_mva',
                            s_sc_min_mva: 's_sc_min_mva',
                            rx_max: 'rx_max',
                            rx_min: 'rx_min',
                            r0x0_max: 'r0x0_max',
                            x0x_max: 'x0x_max',
                            max_p_mw: 'max_p_mw',
                            min_p_mw: 'min_p_mw',
                            max_q_mvar: 'max_q_mvar',
                            min_q_mvar: 'min_q_mvar',
                            controllable: 'controllable',
                            slack_weight: 'slack_weight'
                        })
                    });
                    break;

                case COMPONENT_TYPES.GENERATOR:
                    this.components[COMPONENT_TYPES.GENERATOR].push({
                        ...baseData,
                        type: `Generator ${counters.generator++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            vm_pu: 'vm_pu',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            slack: 'slack',
                            controllable: 'controllable',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            vn_kv: 'vn_kv',
                            xdss_pu: 'xdss_pu',
                            rdss_ohm: 'rdss_ohm',
                            cos_phi: 'cos_phi',
                            pg_percent: 'pg_percent',
                            power_station_trafo: 'power_station_trafo',
                            max_p_mw: 'max_p_mw',
                            min_p_mw: 'min_p_mw',
                            max_q_mvar: 'max_q_mvar',
                            min_q_mvar: 'min_q_mvar'
                        })
                    });
                    break;

                case COMPONENT_TYPES.STATIC_GENERATOR:
                    this.components[COMPONENT_TYPES.STATIC_GENERATOR].push({
                        ...baseData,
                        type: `Static Generator ${counters.staticGenerator++}`,
                        ...this.getAttributesAsObject(cell, {
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
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.ASYMMETRIC_STATIC_GENERATOR:
                    this.components[COMPONENT_TYPES.ASYMMETRIC_STATIC_GENERATOR].push({
                        ...baseData,
                        type: `Asymmetric Static Generator ${counters.asymmetricGenerator++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_a_mw: 'p_a_mw',
                            p_b_mw: 'p_b_mw',
                            p_c_mw: 'p_c_mw',
                            q_a_mvar: 'q_a_mvar',
                            q_b_mvar: 'q_b_mvar',
                            q_c_mvar: 'q_c_mvar',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.BUS:
                    this.components[COMPONENT_TYPES.BUS].push({
                        ...baseData,
                        type: `Bus ${counters.busbar++}`,
                        ...this.getAttributesAsObject(cell, {
                            vn_kv: 'vn_kv',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            type: 'type',
                            max_vm_pu: 'max_vm_pu',
                            min_vm_pu: 'min_vm_pu'
                        })
                    });
                    break;

                case COMPONENT_TYPES.LOAD:
                    this.components[COMPONENT_TYPES.LOAD].push({
                        ...baseData,
                        type: `Load ${counters.load++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            q_mvar: 'q_mvar',
                            const_z_percent: 'const_z_percent',
                            const_i_percent: 'const_i_percent',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            controllable: 'controllable',
                            max_p_mw: 'max_p_mw',
                            min_p_mw: 'min_p_mw',
                            max_q_mvar: 'max_q_mvar',
                            min_q_mvar: 'min_q_mvar'
                        })
                    });
                    break;

                case COMPONENT_TYPES.LINE:
                    const lineBuses = this.getConnectedBusId(cell, true);
                    this.components[COMPONENT_TYPES.LINE].push({
                        ...baseData,
                        type: `Line ${counters.line++}`,
                        from_bus: lineBuses?.from_bus || 'N/A',
                        to_bus: lineBuses?.to_bus || 'N/A',
                        ...this.getAttributesAsObject(cell, {
                            length_km: 'length_km',
                            parallel: 'parallel',
                            df: 'df',
                            r_ohm_per_km: 'r_ohm_per_km',
                            x_ohm_per_km: 'x_ohm_per_km',
                            c_nf_per_km: 'c_nf_per_km',
                            g_us_per_km: 'g_us_per_km',
                            max_i_ka: 'max_i_ka',
                            type: 'type',
                            r0_ohm_per_km: 'r0_ohm_per_km',
                            x0_ohm_per_km: 'x0_ohm_per_km',
                            c0_nf_per_km: 'c0_nf_per_km',
                            endtemp_degree: 'endtemp_degree',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.TRANSFORMER:
                    this.components[COMPONENT_TYPES.TRANSFORMER].push({
                        ...baseData,
                        type: `Transformer ${counters.transformer++}`,
                        ...this.getAttributesAsObject(cell, {
                            sn_mva: 'sn_mva',
                            vn_hv_kv: 'vn_hv_kv',
                            vn_lv_kv: 'vn_lv_kv',
                            vkr_percent: 'vkr_percent',
                            vk_percent: 'vk_percent',
                            pfe_kw: 'pfe_kw',
                            i0_percent: 'i0_percent',
                            vector_group: 'vector_group',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            shift_degree: 'shift_degree',
                            parallel: 'parallel',
                            tap_side: 'tap_side',
                            tap_neutral: 'tap_neutral',
                            tap_min: 'tap_min',
                            tap_max: 'tap_max',
                            tap_step_percent: 'tap_step_percent',
                            tap_step_degree: 'tap_step_degree',
                            tap_pos: 'tap_pos',
                            tap_phase_shifter: 'tap_phase_shifter',
                            vk0_percent: 'vk0_percent',
                            vkr0_percent: 'vkr0_percent',
                            mag0_percent: 'mag0_percent',
                            mag0_rx: 'mag0_rx',
                            si0_hv_partial: 'si0_hv_partial'
                        })
                    });
                    break;

                case COMPONENT_TYPES.THREE_WINDING_TRANSFORMER:
                    this.components[COMPONENT_TYPES.THREE_WINDING_TRANSFORMER].push({
                        ...baseData,
                        type: `Three Winding Transformer ${counters.threeWindingTransformer++}`,
                        ...this.getAttributesAsObject(cell, {
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
                            shift_mv_degree: 'shift_mv_degree',
                            shift_lv_degree: 'shift_lv_degree',
                            tap_side: 'tap_side',
                            tap_neutral: 'tap_neutral',
                            tap_min: 'tap_min',
                            tap_max: 'tap_max',
                            tap_step_percent: 'tap_step_percent',
                            tap_pos: 'tap_pos',
                            tap_phase_shifter: 'tap_phase_shifter',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' },
                            vk0_hv_percent: 'vk0_hv_percent',
                            vk0_mv_percent: 'vk0_mv_percent',
                            vk0_lv_percent: 'vk0_lv_percent',
                            vkr0_hv_percent: 'vkr0_hv_percent',
                            vkr0_mv_percent: 'vkr0_mv_percent',
                            vkr0_lv_percent: 'vkr0_lv_percent',
                            vector_group: 'vector_group'
                        })
                    });
                    break;

                case COMPONENT_TYPES.SHUNT_REACTOR:
                    this.components[COMPONENT_TYPES.SHUNT_REACTOR].push({
                        ...baseData,
                        type: `Shunt Reactor ${counters.shuntReactor++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            q_mvar: 'q_mvar',
                            vn_kv: 'vn_kv',
                            step: { name: 'step', optional: true },
                            max_step: { name: 'max_step', optional: true },
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.CAPACITOR:
                    this.components[COMPONENT_TYPES.CAPACITOR].push({
                        ...baseData,
                        type: `Capacitor ${counters.capacitor++}`,
                        ...this.getAttributesAsObject(cell, {
                            q_mvar: 'q_mvar',
                            loss_factor: 'loss_factor',
                            vn_kv: 'vn_kv',
                            step: { name: 'step', optional: true },
                            max_step: { name: 'max_step', optional: true },
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.ASYMMETRIC_LOAD:
                    this.components[COMPONENT_TYPES.ASYMMETRIC_LOAD].push({
                        ...baseData,
                        type: `Asymmetric Load ${counters.asymmetricLoad++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_a_mw: 'p_a_mw',
                            p_b_mw: 'p_b_mw',
                            p_c_mw: 'p_c_mw',
                            q_a_mvar: 'q_a_mvar',
                            q_b_mvar: 'q_b_mvar',
                            q_c_mvar: 'q_c_mvar',
                            sn_mva: 'sn_mva',
                            scaling: 'scaling',
                            type: 'type',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.IMPEDANCE:
                    this.components[COMPONENT_TYPES.IMPEDANCE].push({
                        ...baseData,
                        type: `Impedance ${counters.impedance++}`,
                        ...this.getAttributesAsObject(cell, {
                            rft_pu: 'rft_pu',
                            xft_pu: 'xft_pu',
                            sn_mva: 'sn_mva',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.WARD:
                    this.components[COMPONENT_TYPES.WARD].push({
                        ...baseData,
                        type: `Ward ${counters.ward++}`,
                        ...this.getAttributesAsObject(cell, {
                            ps_mw: 'ps_mw',
                            qs_mvar: 'qs_mvar',
                            pz_mw: 'pz_mw',
                            qz_mvar: 'qz_mvar',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.EXTENDED_WARD:
                    this.components[COMPONENT_TYPES.EXTENDED_WARD].push({
                        ...baseData,
                        type: `Extended Ward ${counters.extendedWard++}`,
                        ...this.getAttributesAsObject(cell, {
                            ps_mw: 'ps_mw',
                            qs_mvar: 'qs_mvar',
                            pz_mw: 'pz_mw',
                            qz_mvar: 'qz_mvar',
                            r_ohm: 'r_ohm',
                            x_ohm: 'x_ohm',
                            vm_pu: 'vm_pu',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.MOTOR:
                    this.components[COMPONENT_TYPES.MOTOR].push({
                        ...baseData,
                        type: `Motor ${counters.motor++}`,
                        ...this.getAttributesAsObject(cell, {
                            pn_mech_mw: 'pn_mech_mw',
                            cos_phi: 'cos_phi',
                            cos_phi_n: 'cos_phi_n',
                            efficiency_percent: 'efficiency_percent',
                            efficiency_n_percent: 'efficiency_n_percent',
                            loading_percent: 'loading_percent',
                            scaling: 'scaling',
                            vn_kv: 'vn_kv',
                            lrc_pu: 'lrc_pu',
                            rx: 'rx',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.STORAGE:
                    this.components[COMPONENT_TYPES.STORAGE].push({
                        ...baseData,
                        type: `Storage ${counters.storage++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            max_e_mwh: 'max_e_mwh',
                            q_mvar: 'q_mvar',
                            sn_mva: 'sn_mva',
                            soc_percent: 'soc_percent',
                            min_e_mwh: 'min_e_mwh',
                            scaling: 'scaling',
                            type: 'type',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.SVC:
                    this.components[COMPONENT_TYPES.SVC].push({
                        ...baseData,
                        type: `SVC ${counters.SVC++}`,
                        ...this.getAttributesAsObject(cell, {
                            x_l_ohm: 'x_l_ohm',
                            x_cvar_ohm: 'x_cvar_ohm',
                            set_vm_pu: 'set_vm_pu',
                            thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                            controllable: 'controllable',
                            min_angle_degree: 'min_angle_degree',
                            max_angle_degree: 'max_angle_degree',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.TCSC:
                    this.components[COMPONENT_TYPES.TCSC].push({
                        ...baseData,
                        type: `TCSC ${counters.TCSC++}`,
                        ...this.getAttributesAsObject(cell, {
                            x_l_ohm: 'x_l_ohm',
                            x_cvar_ohm: 'x_cvar_ohm',
                            set_p_to_mw: 'set_p_to_mw',
                            thyristor_firing_angle_degree: 'thyristor_firing_angle_degree',
                            controllable: 'controllable',
                            min_angle_degree: 'min_angle_degree',
                            max_angle_degree: 'max_angle_degree',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.SSC:
                    this.components[COMPONENT_TYPES.SSC].push({
                        ...baseData,
                        type: `SSC ${counters.SSC++}`,
                        ...this.getAttributesAsObject(cell, {
                            r_ohm: 'r_ohm',
                            x_ohm: 'x_ohm',
                            set_vm_pu: 'set_vm_pu',
                            vm_internal_pu: 'vm_internal_pu',
                            va_internal_degree: 'va_internal_degree',
                            controllable: 'controllable',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;

                case COMPONENT_TYPES.DC_LINE:
                    this.components[COMPONENT_TYPES.DC_LINE].push({
                        ...baseData,
                        type: `DC Line ${counters.dcLine++}`,
                        ...this.getAttributesAsObject(cell, {
                            p_mw: 'p_mw',
                            loss_percent: 'loss_percent',
                            loss_mw: 'loss_mw',
                            vm_from_pu: 'vm_from_pu',
                            vm_to_pu: 'vm_to_pu',
                            in_service: { name: 'in_service', optional: true, defaultValue: 'true' }
                        })
                    });
                    break;
            }
        });
    }

    // Create dynamic column definitions for agGrid
    createColumnDefs(components) {
        if (components.length === 0) return [];
        
        // Get all unique properties from the data
        const allProps = new Set();
        components.forEach(comp => {
            Object.keys(comp).forEach(key => allProps.add(key));
        });
        
        // Non-editable columns (read-only)
        const readOnlyColumns = ['id', 'name', 'bus', 'from_bus', 'to_bus', 'type'];
        
        // Columns to hide from display
        const hiddenColumns = ['id'];
        
        // Create column definitions with proper types and formatting
        return Array.from(allProps).filter(prop => !hiddenColumns.includes(prop)).map(prop => {
            const sampleValue = components.find(comp => comp[prop] != null)?.[prop];
            const isNumeric = !isNaN(sampleValue) && sampleValue !== '' && sampleValue !== 'N/A';
            const isReadOnly = readOnlyColumns.includes(prop.toLowerCase());
            
            const colDef = {
                headerName: prop.replace(/_/g, ' ').toUpperCase(),
                field: prop,
                filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
                resizable: true,
                sortable: true,
                minWidth: 100,
                flex: 1,
                editable: !isReadOnly, // Make editable except for read-only columns
                cellEditor: isReadOnly ? null : (isNumeric ? 'agNumberCellEditor' : 'agTextCellEditor'),
                cellStyle: (params) => {
                    const baseStyle = isNumeric ? { textAlign: 'right' } : {};
                    
                    if (isReadOnly) {
                        // Read-only columns have gray background
                        return { ...baseStyle, backgroundColor: '#f8f9fa', color: '#6c757d' };
                    } else {
                        // Editable columns have white background with blue border on focus
                        return { ...baseStyle, backgroundColor: '#ffffff' };
                    }
                }
            };

            // Pin important columns to the left
            if (prop === 'name' || prop === 'type') {
                colDef.pinned = 'left';
                colDef.flex = 0;
                colDef.width = prop === 'name' ? 150 : 120;
            }

            // Add tooltip for read-only columns
            if (isReadOnly) {
                colDef.tooltipField = prop;
                colDef.headerTooltip = 'This column is read-only';
            } else {
                colDef.headerTooltip = 'Click to edit this parameter';
            }

            // Numeric validation for editable numeric columns
            if (!isReadOnly && isNumeric) {
                colDef.cellEditorParams = {
                    precision: -1, // Allow decimals
                    step: 0.1,
                    showStepperButtons: false
                };
            }

            return colDef;
        });
    }

    // Create agGrid instance for component data
    createComponentGrid(componentType, components) {
        // Check if AG Grid is available
        if (!window.agGrid) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #dc3545; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;';
            errorDiv.innerHTML = '<strong>AG Grid not available</strong><br>Falling back to basic table...';
            return this.createBasicTable(componentType, components);
        }

        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = 'width: 100%; height: 100%; margin-top: 8px;';
        gridDiv.className = 'ag-theme-alpine'; // Use Alpine theme

        const columnDefs = this.createColumnDefs(components);
        
        const gridOptions = {
            columnDefs: columnDefs,
            rowData: components,
            defaultColDef: {
                resizable: true,
                sortable: true,
                filter: true,
                minWidth: 100
            },
            enableRangeSelection: false, // Enterprise feature
            enableCellSelection: true,
            suppressRowClickSelection: true,
            rowSelection: 'multiple',
            pagination: true,
            paginationPageSize: 50,
            suppressColumnVirtualisation: false,
            suppressRowVirtualisation: false,
            // Handle cell value changes
            onCellValueChanged: (event) => {
                this.hasChanges = true; // Mark that changes were made
                
                // Track which cell and attribute was changed
                const cellId = event.data.id;
                const attributeName = event.colDef.field;
                const newValue = event.newValue;
                const oldValue = event.oldValue;
                
                console.log(`Cell value changed: cell=${cellId}, attr=${attributeName}, old="${oldValue}", new="${newValue}"`);
                
                if (!this.changedCells.has(cellId)) {
                    this.changedCells.set(cellId, new Set());
                }
                this.changedCells.get(cellId).add(attributeName);
                
                // Don't apply changes immediately - only track them
            },
            // Custom keyboard navigation: Enter moves to cell below
            navigateToNextCell: (params) => {
                const suggestedNextCell = params.nextCellPosition;
                const KEY_ENTER = 'Enter';
                
                if (params.key === KEY_ENTER && !params.event.shiftKey) {
                    // Move down to the next row in the same column
                    return {
                        rowIndex: params.previousCellPosition.rowIndex + 1,
                        column: params.previousCellPosition.column
                    };
                }
                
                return suggestedNextCell;
            },
            // Tab navigation for completeness
            tabToNextCell: (params) => {
                const suggestedNextCell = params.nextCellPosition;
                return suggestedNextCell;
            },
            // Add edit styling
            onCellEditingStarted: (event) => {
                // Highlight the row being edited
                if (event.node && event.node.rowElement) {
                    event.node.rowElement.style.backgroundColor = '#e3f2fd';
                }
            },
            onCellEditingStopped: (event) => {
                // Remove highlight after editing
                if (event.node && event.node.rowElement) {
                    event.node.rowElement.style.backgroundColor = '';
                }
            },
            onGridReady: (params) => {
                this.gridInstances[componentType] = params.api;
                
                // Store original data as deep copies for comparison
                if (!this.originalData[componentType]) {
                    this.originalData[componentType] = components.map(comp => {
                        const original = {};
                        Object.keys(comp).forEach(key => {
                            // Deep copy the value
                            original[key] = comp[key] != null ? comp[key] : null;
                        });
                        console.log(`Stored original data for ${comp.name}:`, original);
                        return original;
                    });
                }
                
                // Use Community-compatible column sizing
                setTimeout(() => {
                    try {
                        // First try to fit columns to container
                        params.api.sizeColumnsToFit();
                        
                        // Alternative: Set reasonable column widths manually if needed
                        const allColumns = params.columnApi.getAllColumns();
                        const containerWidth = gridDiv.clientWidth;
                        const totalColumns = allColumns.length;
                        
                        // If too many columns, set minimum widths
                        if (totalColumns > 6) {
                            allColumns.forEach(column => {
                                const colId = column.getColId();
                                if (colId === 'name' || colId === 'type') {
                                    // Keep pinned columns fixed width
                                    return;
                                }
                                // Set minimum width for other columns
                                params.columnApi.setColumnWidth(colId, Math.max(120, containerWidth / totalColumns));
                            });
                        }
                    } catch (error) {
                        console.warn('Column sizing error:', error);
                        // Fallback to basic fit
                        params.api.sizeColumnsToFit();
                    }
                }, 100);
            }
        };

        try {
            new window.agGrid.Grid(gridDiv, gridOptions);
        } catch (error) {
            console.error('Error creating AG Grid:', error);
            return this.createBasicTable(componentType, components);
        }

        return gridDiv;
    }

    // Apply all changes to the graph model
    applyChanges() {
        let changeCount = 0;
        const model = this.graph.getModel();
        
        console.log('=== APPLY CHANGES START ===');
        console.log('Changed cells tracked:', this.changedCells);
        console.log('Grid instances:', Object.keys(this.gridInstances));
        
        model.beginUpdate();
        try {
            // Iterate through all tabs/component types
            Object.entries(this.gridInstances).forEach(([componentType, gridApi]) => {
                console.log(`Processing component type: ${componentType}`);
                const originalData = this.originalData[componentType] || [];
                const rowData = [];
                gridApi.forEachNode(node => {
                    // Create a deep copy of the node data to avoid reference issues
                    const dataCopy = {};
                    Object.keys(node.data).forEach(key => {
                        dataCopy[key] = node.data[key];
                    });
                    rowData.push(dataCopy);
                });
                
                console.log(`Found ${rowData.length} rows in grid`);
                
                // Create a lookup map for original data by ID
                const originalDataById = {};
                originalData.forEach(orig => {
                    if (orig.id) {
                        originalDataById[orig.id] = orig;
                    }
                });
                
                // Update each component's attributes - only if they've changed
                rowData.forEach(data => {
                    const cell = this.findCellById(data.id);
                    if (!cell) {
                        console.log(`Cell not found for id: ${data.id}`);
                        return;
                    }
                    
                    // Find original by ID instead of index (pagination-safe)
                    const original = originalDataById[data.id];
                    const changedAttributes = this.changedCells.get(data.id) || new Set();
                    
                    console.log(`Processing row ${data.name} (id=${data.id}), changed attrs:`, Array.from(changedAttributes));
                    console.log(`Original data for this row:`, original);
                    
                    // Get all editable attributes (non-readonly columns)
                    const readOnlyColumns = ['id', 'name', 'bus', 'from_bus', 'to_bus', 'type'];
                    Object.keys(data).forEach(key => {
                        // Skip readonly columns
                        if (readOnlyColumns.includes(key.toLowerCase())) {
                            return;
                        }
                        
                        // Only update if this attribute was actually changed
                        if (changedAttributes.has(key)) {
                            const newValue = data[key];
                            const oldValue = original ? original[key] : undefined;
                            
                            console.log(`Checking attribute ${key}: oldValue="${oldValue}", newValue="${newValue}"`);
                            
                            // Only update if the value actually changed and is not empty
                            if (newValue !== oldValue && newValue !== undefined && newValue !== null && newValue !== '') {
                                console.log(`Updating ${key} from "${oldValue}" to "${newValue}" for cell ${data.id}`);
                                const success = this.updateCellAttribute(cell, key, newValue);
                                if (success) {
                                    changeCount++;
                                }
                            } else {
                                console.log(`Skipping update for ${key}: condition failed`);
                            }
                        }
                    });
                    
                    // Only trigger value change event if this cell was actually modified
                    if (changedAttributes.size > 0) {
                        model.valueForCellChanged(cell, cell.value);
                    }
                });
            });
        } finally {
            model.endUpdate();
        }
        
        console.log(`Applied ${changeCount} changes to the model`);
        return changeCount;
    }

    // Find mxCell by ID
    findCellById(cellId) {
        const model = this.graph.getModel();
        const root = model.getRoot();
        
        // Search through all cells
        const searchCell = (cell) => {
            if (cell.id === cellId) {
                return cell;
            }
            
            const childCount = model.getChildCount(cell);
            for (let i = 0; i < childCount; i++) {
                const child = model.getChildAt(cell, i);
                const result = searchCell(child);
                if (result) return result;
            }
            return null;
        };

        return searchCell(root);
    }

    // Update mxCell attribute
    updateCellAttribute(cell, attributeName, newValue) {
        try {
            console.log(`updateCellAttribute called: attr=${attributeName}, value=${newValue}`);
            console.log(`Cell value type:`, typeof cell.value, cell.value);
            
            if (!cell.value) {
                console.warn('Cell has no value');
                return false;
            }
            
            // Check if cell.value is an Element (has setAttribute method)
            if (typeof cell.value.setAttribute === 'function') {
                // Direct setAttribute for XML elements
                cell.value.setAttribute(attributeName, newValue.toString());
                console.log(`Set attribute ${attributeName} to ${newValue} using setAttribute`);
                return true;
            }
            
            if (!cell.value.attributes) {
                console.warn('Cell has no attributes collection');
                return false;
            }

            // Find the attribute by name
            let attribute = null;
            for (let i = 0; i < cell.value.attributes.length; i++) {
                if (cell.value.attributes[i].name === attributeName) {
                    attribute = cell.value.attributes[i];
                    break;
                }
            }

            if (attribute) {
                // Update existing attribute
                attribute.value = newValue.toString();
                console.log(`Updated attribute ${attributeName} to ${newValue}`);
            } else {
                // Create new attribute if it doesn't exist
                if (cell.value.ownerDocument) {
                    const newAttr = cell.value.ownerDocument.createAttribute(attributeName);
                    newAttr.value = newValue.toString();
                    cell.value.attributes.setNamedItem(newAttr);
                    console.log(`Created new attribute ${attributeName} with value ${newValue}`);
                } else {
                    // Fallback: use setAttribute if available
                    if (typeof cell.value.setAttribute === 'function') {
                        cell.value.setAttribute(attributeName, newValue.toString());
                        console.log(`Created attribute ${attributeName} with value ${newValue} using setAttribute`);
                    } else {
                        console.error(`Cannot create attribute ${attributeName}: no ownerDocument or setAttribute`);
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('Error updating cell attribute:', error);
            return false;
        }
    }

    // Removed showNotification - changes are applied only when Apply button is clicked

    // Fallback: Create basic HTML table if agGrid fails
    createBasicTable(componentType, components) {
        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            marginTop: '8px'
        });

        // Get all unique properties for table headers
        const allProps = new Set();
        components.forEach(comp => {
            Object.keys(comp).forEach(key => allProps.add(key));
        });
        const headers = Array.from(allProps);

        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        Object.assign(headerRow.style, {
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #dee2e6'
        });

        headers.forEach(header => {
            const th = document.createElement('th');
            Object.assign(th.style, {
                padding: '8px 12px',
                textAlign: 'left',
                fontWeight: 'bold',
                border: '1px solid #dee2e6'
            });
            th.textContent = header.replace(/_/g, ' ').toUpperCase();
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body rows
        const tbody = document.createElement('tbody');
        components.forEach((component, index) => {
            const row = document.createElement('tr');
            Object.assign(row.style, {
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                borderBottom: '1px solid #dee2e6'
            });

            headers.forEach(header => {
                const td = document.createElement('td');
                Object.assign(td.style, {
                    padding: '8px 12px',
                    border: '1px solid #dee2e6',
                    wordBreak: 'break-word'
                });
                td.textContent = component[header] || '-';
                row.appendChild(td);
            });

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        return table;
    }

    // Create toolbar with search and export functionality
    createToolbar(componentType) {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px 4px 0 0;
            font-size: 14px;
        `;

        // Info section
        const info = document.createElement('div');
        info.style.cssText = 'display: flex; align-items: center; gap: 16px;';
        
        const count = document.createElement('span');
        count.style.fontWeight = 'bold';
        count.style.color = '#495057';
        count.textContent = `${this.components[componentType].length} ${componentType} components`;

        const editHint = document.createElement('span');
        editHint.style.cssText = 'font-size: 12px; color: #6c757d; font-style: italic;';
        editHint.innerHTML = '💡 Double-click cells to edit parameters';

        // Actions section
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        // Quick filter input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Quick filter...';
        searchInput.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 13px;
            width: 150px;
        `;

        // Export button
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '📊 Export CSV';
        exportBtn.style.cssText = `
            padding: 4px 12px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
        `;

        // Event handlers
        searchInput.addEventListener('input', (e) => {
            const gridApi = this.gridInstances[componentType];
            if (gridApi) {
                gridApi.setQuickFilter(e.target.value);
            }
        });

        exportBtn.addEventListener('click', () => {
            const gridApi = this.gridInstances[componentType];
            if (gridApi) {
                gridApi.exportDataAsCsv({
                    fileName: `${componentType.replace(/\s+/g, '_')}_data.csv`,
                    columnSeparator: ','
                });
            } else {
                // Fallback for basic table
                this.exportToCSV(componentType);
            }
        });

        // Hover effects
        exportBtn.addEventListener('mouseenter', () => {
            exportBtn.style.background = '#218838';
        });

        exportBtn.addEventListener('mouseleave', () => {
            exportBtn.style.background = '#28a745';
        });

        info.appendChild(count);
        info.appendChild(editHint);
        actions.appendChild(searchInput);
        actions.appendChild(exportBtn);

        toolbar.appendChild(info);
        toolbar.appendChild(actions);

        return toolbar;
    }

    // Fallback CSV export for basic tables
    exportToCSV(componentType) {
        const components = this.components[componentType];
        if (components.length === 0) return;

        // Get headers
        const headers = Object.keys(components[0]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        components.forEach(component => {
            const row = headers.map(header => {
                const value = component[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                return value.toString().includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
            });
            csvContent += row.join(',') + '\n';
        });

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${componentType.replace(/\s+/g, '_')}_data.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Create the dialog container
    create() {
        const container = document.createElement('div');
        Object.assign(container.style, {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#ffffff'
        });

        // Create header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
            fontWeight: 'bold',
            fontSize: '18px',
            position: 'relative'
        });
        header.textContent = 'Components Data Overview';

        // Create tab container
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            borderBottom: '1px solid #e9ecef',
            backgroundColor: '#f8f9fa',
            overflowX: 'auto',
            flexShrink: 0
        });

        // Create content container
        const contentContainer = document.createElement('div');
        Object.assign(contentContainer.style, {
            flex: '1',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        // Create footer with Apply and Cancel buttons
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '12px 16px',
            backgroundColor: '#f8f9fa',
            borderTop: '2px solid #dee2e6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0
        });

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            padding: '8px 24px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#5a6268';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = '#6c757d';
        });
        cancelBtn.addEventListener('click', () => {
            this.close(false); // Close without applying changes
        });

        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        Object.assign(applyBtn.style, {
            padding: '8px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        applyBtn.addEventListener('mouseenter', () => {
            applyBtn.style.backgroundColor = '#0056b3';
        });
        applyBtn.addEventListener('mouseleave', () => {
            applyBtn.style.backgroundColor = '#007bff';
        });
        applyBtn.addEventListener('click', () => {
            if (this.hasChanges) {
                this.applyChanges();
            }
            this.close(true); // Close after applying changes
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(applyBtn);

        // Create tabs for each component type that has data
        Object.entries(this.components).forEach(([componentType, components]) => {
            if (components.length > 0) {
                const tab = this.createTab(componentType, components.length);
                tabContainer.appendChild(tab);
            }
        });

        container.appendChild(header);
        container.appendChild(tabContainer);
        container.appendChild(contentContainer);
        container.appendChild(footer);

        this.container = container;
        this.contentContainer = contentContainer;

        // Show first tab by default
        const firstTabType = Object.keys(this.components).find(type => this.components[type].length > 0);
        if (firstTabType) {
            this.showTab(firstTabType);
        }

        return container;
    }

    // Create a tab button
    createTab(componentType, count) {
        const tab = document.createElement('button');
        Object.assign(tab.style, {
            padding: '12px 16px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderBottom: '3px solid transparent',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
            fontWeight: '500'
        });
        
        tab.textContent = `${componentType} (${count})`;
        tab.onclick = () => this.showTab(componentType);

        // Store reference for styling
        tab.componentType = componentType;

        // Add hover effect
        tab.addEventListener('mouseenter', () => {
            if (tab.componentType !== this.currentTab) {
                tab.style.backgroundColor = '#e9ecef';
            }
        });

        tab.addEventListener('mouseleave', () => {
            if (tab.componentType !== this.currentTab) {
                tab.style.backgroundColor = 'transparent';
            }
        });
        
        return tab;
    }

    // Show content for a specific tab
    showTab(componentType) {
        // Update tab styling
        this.container.querySelectorAll('button').forEach(btn => {
            if (btn.componentType) {
                if (btn.componentType === componentType) {
                    btn.style.backgroundColor = '#007bff';
                    btn.style.color = 'white';
                    btn.style.borderBottomColor = '#007bff';
                } else {
                    btn.style.backgroundColor = 'transparent';
                    btn.style.color = '#495057';
                    btn.style.borderBottomColor = 'transparent';
                }
            }
        });

        // Clear and populate content
        this.contentContainer.innerHTML = '';
        const components = this.components[componentType];
        
        if (components.length === 0) {
            const noDataDiv = document.createElement('div');
            noDataDiv.style.cssText = 'padding: 40px; text-align: center; color: #6c757d; font-size: 16px;';
            noDataDiv.innerHTML = `<strong>No ${componentType} components found</strong><br>Add some ${componentType} components to your diagram to see them here.`;
            this.contentContainer.appendChild(noDataDiv);
            return;
        }

        // Create toolbar
        const toolbar = this.createToolbar(componentType);
        this.contentContainer.appendChild(toolbar);

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = 'flex: 1; overflow: hidden; background: white; border: 1px solid #dee2e6; border-top: none;';
        
        // Create grid
        const grid = this.createComponentGrid(componentType, components);
        gridContainer.appendChild(grid);
        
        this.contentContainer.appendChild(gridContainer);
        
        this.currentTab = componentType;
    }

    // Show the dialog
    show() {
        const content = this.create();
        
        // Make dialog full-screen with minimal margins
        const screenWidth = window.innerWidth - 20;
        const screenHeight = window.innerHeight - 20;
        
        // Show using EditorUi's dialog system
        this.dialogWindow = this.ui.showDialog(content, screenWidth, screenHeight, true, false, () => {
            this.close(false); // Close without applying changes on X button
        });
        
        const componentCount = Object.values(this.components).reduce((sum, arr) => sum + arr.length, 0);
        const typeCount = Object.values(this.components).filter(arr => arr.length > 0).length;
        
        console.log(`ComponentsDataDialog shown with ${componentCount} components across ${typeCount} types`);
    }

    // Close the dialog and cleanup
    close(applyChanges = false) {
        // Clean up grid instances
        Object.values(this.gridInstances).forEach(api => {
            if (api && typeof api.destroy === 'function') {
                try {
                    api.destroy();
                } catch (error) {
                    console.warn('Error destroying grid:', error);
                }
            }
        });
        this.gridInstances = {};
        this.originalData = {};
        this.changedCells.clear();
        this.hasChanges = false;

        if (this.ui && typeof this.ui.hideDialog === 'function') {
            this.ui.hideDialog();
        }
        
        console.log(`ComponentsDataDialog closed. Changes ${applyChanges ? 'applied' : 'discarded'}.`);
    }
}

// Make ComponentsDataDialog available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.ComponentsDataDialog = ComponentsDataDialog;
} 