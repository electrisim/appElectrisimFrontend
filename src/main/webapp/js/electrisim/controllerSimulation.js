import ENV from './config/environment.js';

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
    
    // Get the user-friendly name for the connected bus
    if (bus) {
        const busCell = edge.target && edge.target.mxObjectId !== cell.mxObjectId ? edge.target : edge.source;
        if (busCell && busCell.value && busCell.value.attributes) {
            for (let i = 0; i < busCell.value.attributes.length; i++) {
                if (busCell.value.attributes[i].nodeName === 'name') {
                    return busCell.value.attributes[i].nodeValue;
                }
            }
        }
        // Fallback to mxCell_XXX if no user-friendly name found
        return bus.replace('#', '_');
    }
    return null;
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

// Component types constants
const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    BUS: 'Bus',
    LOAD: 'Load',
    LINE: 'Line',
    TRANSFORMER: 'Transformer'
};

function controllerSimulationPandaPower(a, b, c) {
    let apka = a;
    let grafka = b;
    
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        const model = b.getModel();
        const cellsArray = b.getChildCells(b.getDefaultParent(), true, true);
        
        // Component counters
        const counters = {
            externalGrid: 0,
            generator: 0,
            busbar: 0,
            load: 0,
            line: 0,
            transformer: 0
        };
        
        // Component arrays
        const componentArrays = {
            simulationParameters: [],
            externalGrid: [],
            generator: [],
            busbar: [],
            load: [],
            line: [],
            transformer: []
        };
        
        function tryCreateDialog() {
            let DialogClass = null;
            
            if (typeof globalThis !== 'undefined') {
                DialogClass = globalThis.ControllerSimulationDialog;
            } else if (typeof window !== 'undefined') {
                DialogClass = window.ControllerSimulationDialog;
            }
            
            if (!DialogClass) {
                setTimeout(tryCreateDialog, 100);
                return;
            }
            
            const dialog = new DialogClass(a);
            dialog.show(function (params) {
                
                // Global simulation counter for performance tracking
                if (!globalThis.controllerRunCount) {
                    globalThis.controllerRunCount = 0;
                }
                globalThis.controllerRunCount++;
                const runNumber = globalThis.controllerRunCount;
                const startTime = performance.now();
                console.log(`=== CONTROLLER SIMULATION #${runNumber} STARTED ===`);
                
                // Initialize performance optimization caches
                const modelCache = new Map();
                const cellCache = new Map();
                const nameCache = new Map();
                const attributeCache = new Map();
                console.log('Starting fresh simulation with clean caches');
                
                apka.spinner.spin(document.body, "Waiting for controller simulation results...");

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
                    console.log('Controller Simulation - User email:', userEmail); // Debug log
                    
                    componentArrays.simulationParameters.push({
                        typ: "ControllerSimulationPandaPower Parameters",
                        voltage_control: params[0],
                        tap_control: params[1],
                        discrete_tap_control: params[2],
                        continuous_tap_control: params[3],
                        frequency: params[4],
                        algorithm: params[5],
                        calculate_voltage_angles: params[6],
                        init: params[7],
                        user_email: userEmail  // Add user email to simulation data
                    });

                        // Process cells with performance optimization
                        const cellProcessingStart = performance.now();
                        console.log(`Processing ${cellsArray.length} cells...`);
                        
                        // First pass: collect result cells to remove and valid cells to process
                        const resultCellsToRemove = [];
                        const validCells = [];
                        
                        cellsArray.forEach(cell => {
                            // Collect result cells for batch removal
                            if (cell.getStyle()?.includes("Result")) {
                                resultCellsToRemove.push(cell);
                                return;
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
                            let userFriendlyName = null; // Start with null to indicate no user-friendly name found
                            
                            // Check if the cell itself has a name attribute stored
                            if (cell.value && cell.value.attributes) {
                                for (let i = 0; i < cell.value.attributes.length; i++) {
                                    if (cell.value.attributes[i].nodeName === 'name') {
                                        userFriendlyName = cell.value.attributes[i].nodeValue;
                                        console.log('Found user-friendly name in cell attributes:', userFriendlyName, 'for cell:', cell.id);
                                        break;
                                    }
                                }
                            }
                            
                            // If no name found in cell attributes, try to get from grid as fallback
                            if (!userFriendlyName) {
                                try {
                                    // For buses, check busDialog grid
                                    if (componentType === COMPONENT_TYPES.BUS && window.gridOptionsBus && window.gridOptionsBus.api) {
                                        const busData = window.gridOptionsBus.api.getRenderedNodes();
                                        console.log('Bus grid data:', busData);
                                        console.log('Looking for cell.id:', cell.id);
                                        if (busData && busData.length > 0) {
                                            // Since we only have 1 bus in the grid, use it for all buses
                                            // This is a simplified approach - in a real scenario you'd want to match by some identifier
                                            const busNode = busData[0];
                                            if (busNode && busNode.data && busNode.data.name) {
                                                userFriendlyName = busNode.data.name;
                                                console.log('Found user-friendly name for bus from grid:', userFriendlyName);
                                            }
                                        }
                                    }
                                    // For loads, check loadDialog grid
                                    else if (componentType === COMPONENT_TYPES.LOAD && window.gridOptionsLoad && window.gridOptionsLoad.api) {
                                        const loadData = window.gridOptionsLoad.api.getRenderedNodes();
                                        console.log('Load grid data:', loadData);
                                        if (loadData && loadData.length > 0) {
                                            // Use the first load entry for all loads
                                            const loadNode = loadData[0];
                                            if (loadNode && loadNode.data && loadNode.data.name) {
                                                userFriendlyName = loadNode.data.name;
                                                console.log('Found user-friendly name for load:', userFriendlyName);
                                            }
                                        }
                                    }
                                    // For generators, check generatorDialog grid
                                    else if (componentType === COMPONENT_TYPES.GENERATOR && window.gridOptionsGenerator && window.gridOptionsGenerator.api) {
                                        const genData = window.gridOptionsGenerator.api.getRenderedNodes();
                                        console.log('Generator grid data:', genData);
                                        if (genData && genData.length > 0) {
                                            // Use the first generator entry for all generators
                                            const genNode = genData[0];
                                            if (genNode && genNode.data && genNode.data.name) {
                                                userFriendlyName = genNode.data.name;
                                                console.log('Found user-friendly name for generator:', userFriendlyName);
                                            }
                                        }
                                    }
                                    // For lines, check lineDialog grid
                                    else if (componentType === COMPONENT_TYPES.LINE && window.gridOptionsLineDialog && window.gridOptionsLineDialog.api) {
                                        const lineData = window.gridOptionsLineDialog.api.getRenderedNodes();
                                        console.log('Line grid data:', lineData);
                                        if (lineData && lineData.length > 0) {
                                            // Use the first line entry for all lines
                                            const lineNode = lineData[0];
                                            if (lineNode && lineNode.data && lineNode.data.name) {
                                                userFriendlyName = lineNode.data.name;
                                                console.log('Found user-friendly name for line:', userFriendlyName);
                                            }
                                        }
                                    }
                                    // For external grids, check externalGridDialog grid
                                    else if (componentType === COMPONENT_TYPES.EXTERNAL_GRID && window.gridOptionsExternalGrid && window.gridOptionsExternalGrid.api) {
                                        const extGridData = window.gridOptionsExternalGrid.api.getRenderedNodes();
                                        console.log('External grid data:', extGridData);
                                        if (extGridData && extGridData.length > 0) {
                                            // Use the first external grid entry for all external grids
                                            const extGridNode = extGridData[0];
                                            if (extGridNode && extGridNode.data && extGridNode.data.name) {
                                                userFriendlyName = extGridNode.data.name;
                                                console.log('Found user-friendly name for external grid:', userFriendlyName);
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.warn('Could not get user-friendly name for', componentType, cell.id, error);
                                }
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
                                    name: cell.mxObjectId.replace('#', '_'), // technical ID - keep this for bus mapping
                                    userFriendlyName: userFriendlyName, // user-friendly name for display
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
                                    const generator = {
                                        ...baseData,
                                        typ: "Generator",
                                        ...getAttributesAsObject(cell, {
                                            name: 'name',
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
                                    break;

                                case COMPONENT_TYPES.BUS:
                                    const busbar = {
                                        ...baseData,
                                        typ: `Bus${counters.busbar++}`,
                                        ...getAttributesAsObject(cell, {
                                            name: 'name',
                                            vn_kv: 'vn_kv'
                                        })
                                    };
                                    componentArrays.busbar.push(busbar);
                                    break;

                                case COMPONENT_TYPES.LOAD:
                                    const load = {
                                        ...baseData,
                                        typ: `Load${counters.load++}`,
                                        ...getAttributesAsObject(cell, {
                                            name: 'name',
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
                                        ...baseData,
                                        typ: `Line${counters.line++}`,
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
                        
                        const componentProcessingTime = performance.now() - componentProcessingStart;
                        console.log(`Component processing: ${componentProcessingTime.toFixed(2)}ms (${processedComponents} components)`);

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
                        console.log('Controller Simulation Data:', JSON.stringify(obj));
                        
                        // Log performance summary
                        const totalProcessingTime = performance.now() - startTime;
                        console.log(`=== CONTROLLER SIMULATION PERFORMANCE SUMMARY ===`);
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

        // Check for diagnostic response format
        if (dataJson.error && dataJson.diagnostic) {
            console.log('Controller Simulation failed with diagnostic information:', dataJson);
            
            // Show diagnostic dialog if available
            if (window.DiagnosticReportDialog) {
                const diagnosticDialog = new window.DiagnosticReportDialog(dataJson.diagnostic);
                diagnosticDialog.show();
            } else {
                // Fallback to alert if dialog is not available
                alert(`Controller Simulation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return;
        }

        // Basic result processing
        if (dataJson.error) {
            alert('Controller Simulation Error: ' + dataJson.error);
            return;
        }

        // Show results in a modal dialog
        if (window.ControllerSimulationResultsDialog) {
            const dlg = new window.ControllerSimulationResultsDialog(dataJson);
            dlg.show();
        } else {
            alert('Controller simulation completed. Results dialog not available.');
        }
        
        console.log('Controller Simulation completed successfully');
        
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
                    if (el.textContent && el.textContent.includes('Waiting for controller simulation results')) {
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
        console.error('Error processing controller simulation data:', err);
    } finally {
        // Stop the spinner to clear the "Waiting for controller simulation results..." message
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
                if (el.textContent && el.textContent.includes('Waiting for controller simulation results')) {
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

// Make controllerSimulationPandaPower available globally immediately after definition
if (typeof globalThis !== 'undefined') {
    globalThis.controllerSimulationPandaPower = controllerSimulationPandaPower;
} else if (typeof window !== 'undefined') {
    window.controllerSimulationPandaPower = controllerSimulationPandaPower;
}

// Export for module usage if supported
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { controllerSimulationPandaPower };
} else if (typeof exports === 'object') {
    try {
        exports.controllerSimulationPandaPower = controllerSimulationPandaPower;
    } catch (e) {
        // Ignore export errors in non-module environments
    }
}