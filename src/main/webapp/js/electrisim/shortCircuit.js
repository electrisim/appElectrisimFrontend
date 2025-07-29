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
    const formatNumber = (num, decimals = 3) => num.toFixed(decimals);
    const replaceUnderscores = name => name.replace('_', '#');

    // Error handler
    function handleNetworkErrors(dataJson) {
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

    // Main function execution
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use modern ShortCircuitDialog directly
        const dialog = new ShortCircuitDialog(a);
        dialog.show(function (a, c) {
        // Cache commonly used functions and values
        const getModel = b.getModel.bind(b);
        const model = getModel();
        const cellsArray = model.getDescendants();

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
                if (!componentType) return;

                if (!componentType || componentType == 'NotEditableLine') return;

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
                                vector_group: 'vector_group',
                                vk0_percent: 'vk0_percent',
                                vkr0_percent: 'vkr0_percent',
                                mag0_percent: 'mag0_percent',
                                si0_hv_partial: 'si0_hv_partial',

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
            console.log(JSON.stringify(obj));

            // Process network data
            processNetworkData("https://03dht3kc-5000.euw.devtunnels.ms/", obj, b, grafka);
        }
        });
    }
}

// Also export it as a module
export const shortCircuitPandaPower = window.shortCircuitPandaPower;



