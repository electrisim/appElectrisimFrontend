// Dependencies will be resolved from global scope when needed

//define buses to which the cell is connected
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

    const bus = edge.target && edge.target.mxObjectId !== cell.mxObjectId ?
        (edge.target ? edge.target.mxObjectId : null) : 
        (edge.source ? edge.source.mxObjectId : null);

    return bus ? bus.replace('#', '_') : null;
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

// Define component types as constants
const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    BUS: 'Bus',
    LOAD: 'Load',
    LINE: 'Line'
};

function optimalPowerFlowPandaPower(a, b, c) {
    // Create counters and arrays for different components
    const counters = {
        externalGrid: 0,
        generator: 0,
        busbar: 0,
        load: 0,
        line: 0
    };

    const componentArrays = {
        simulationParameters: [],
        externalGrid: [],
        generator: [],
        busbar: [],
        load: [],
        line: []
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
            dialog.show(function (params, perGenLimits) {
                apka.spinner.spin(document.body, "Waiting for optimal power flow results...");

                // Extract min/max from params (find their indices)
                // Assuming min_p_mw is at index 13, max_p_mw at index 14
                const min_p_mw_user = parseFloat(params[13]);
                const max_p_mw_user = parseFloat(params[14]);

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
                    
                    componentArrays.simulationParameters.push({
                        typ: "OptimalPowerFlowPandaPower Parameters",
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
                        user_email: userEmail  // Add user email to simulation data
                    });

                        // Process cells
                        cellsArray.forEach(cell => {
                            if (cell.getStyle()?.includes("Result")) {
                                model.remove(model.getCell(cell.id));
                                return;
                            }

                            const style = parseCellStyle(cell.getStyle());
                            if (!style) return;

                            const componentType = style.shapeELXXX;
                            if (!componentType || componentType == 'NotEditableLine') return;

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
                            } catch (error) {
                                console.warn('Could not get user-friendly name for', componentType, cell.id, error);
                            }
                            
                            let baseData;
                            if(componentType === 'Line' || componentType === 'DCLine'){
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
                                            x0x_max: 'x0x_max'
                                        })
                                    };
                                    componentArrays.externalGrid.push(externalGrid);
                                    break;

                                case COMPONENT_TYPES.GENERATOR:
                                    const p_mw_val = parseFloat(getAttributesAsObject(cell, {p_mw: 'p_mw'}).p_mw) || 10;
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
                                        }),
                                        min_p_mw: perGenLimits[cell.id]?.min ?? 0,
                                        max_p_mw: perGenLimits[cell.id]?.max ?? p_mw_val
                                    };
                                    componentArrays.generator.push(generator);
                                    counters.generator++;
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

                                case COMPONENT_TYPES.LOAD:
                                    const load = {
                                        typ: `Load${counters.load++}`,
                                        name: cell.mxObjectId.replace('#', '_'),
                                        id: cell.id,
                                        bus: getConnectedBusId(cell),
                                        ...getAttributesAsObject(cell, {
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
                                            type: 'type'
                                        })
                                    };
                                    componentArrays.line.push(line);
                                    break;
                            }
                        });

                        // Combine all arrays
                        const array = [
                            ...componentArrays.simulationParameters,
                            ...componentArrays.externalGrid,
                            ...componentArrays.generator,
                            ...componentArrays.busbar,
                            ...componentArrays.load,
                            ...componentArrays.line
                        ];

                        const obj = Object.assign({}, array);
                        console.log('OPF Data:', JSON.stringify(obj));

                        // Send to backend
                        processNetworkData("https://03dht3kc-5000.euw.devtunnels.ms/", obj, b, grafka);
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
            
            // Show diagnostic dialog if available
            if (window.DiagnosticReportDialog) {
                const diagnosticDialog = new window.DiagnosticReportDialog(dataJson.diagnostic);
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