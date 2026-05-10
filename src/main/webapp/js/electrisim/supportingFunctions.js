import {
    vertexStyleFromElectrisimSymbol,
    vertexSizeFromElectrisimSymbol,
    vertexStyleImportedBusbar,
} from './electricalSymbols.js';

/** Horizontal busbar geometry aligned with map-generated diagrams (sym-bus.svg). */
const IMPORT_BUSBAR_W = 260;
const IMPORT_BUSBAR_H = 16;

/** sym-transformer.svg viewBox -45..45, -30..28 → winding axis at y = 0 → (30/58) from top */
const TRANSFORMER_EDGE_PIN_Y = 30 / 58;
// Use existing globalPandaPowerData if it exists, otherwise create it
if (typeof globalPandaPowerData === 'undefined') {
    window.globalPandaPowerData = null;
}

// Helper function to safely parse JSON or return empty array if data doesn't exist
if (typeof safeJsonParse === 'undefined') {
    window.safeJsonParse = (jsonData) => {
        try {
            return jsonData ? JSON.parse(jsonData) : [];
        } catch (error) {
            console.warn("Error parsing JSON:", error);
            return [];
        }
    };
}

/*
function fetchPandaPowerData() {
    return fetch('js/electrisim/models/example_simple.json')
        .then(response => {
            console.log('Response:', response);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Explicitly assign to global variable
            globalPandaPowerData = data;
            console.log('Data fetched and stored:', globalPandaPowerData);
            return data;
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}*/
function fetchPandaPowerData() {
    // Add cache-busting parameter using current timestamp
    const cacheBuster = `?_=${new Date().getTime()}`;

    return fetch(`js/electrisim/models/example_simple.json${cacheBuster}`, {
        // Add cache control headers
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
        .then(response => {
            console.log('Response:', response);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Explicitly assign to global variable
            globalPandaPowerData = data;
            console.log('Data fetched and stored:', globalPandaPowerData);
            return data;
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

// Make the function globally available
window.fetchPandaPowerData = fetchPandaPowerData;

// Function to use the data
function usePandaPowerData() {
    // Add a check to ensure data is loaded
    if (globalPandaPowerData) {
        console.log('Using global data:', globalPandaPowerData);
        // Your data processing logic here
    } else {
        console.log('Data not yet loaded');
    }
}

// If you need to ensure data is loaded before using
// FIXED: Added timeout to prevent infinite polling loop that causes freezing
function waitForData(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const maxAttempts = Math.ceil(timeoutMs / 100);
        let attempts = 0;
        
        function checkData() {
            attempts++;
            const elapsed = Date.now() - startTime;
            
            if (globalPandaPowerData) {
                console.log(`✅ Data loaded after ${attempts} attempts (${elapsed}ms)`);
                resolve(globalPandaPowerData);
            } else if (elapsed >= timeoutMs || attempts >= maxAttempts) {
                const error = new Error(`Timeout waiting for data after ${elapsed}ms (${attempts} attempts)`);
                console.error('❌ waitForData timeout:', error);
                reject(error);
            } else {
                // Check again after a short delay
                setTimeout(checkData, 100);
            }
        }
        checkData();
    });
}

// Also make other functions globally available if needed
window.useDataToInsertOnGraph = useDataToInsertOnGraph;
window.waitForData = waitForData;
window.findVertexByBusId = findVertexByBusId;

// Helper function to find a bus vertex by its ID
function findVertexByBusId(grafka, parent, busName) {
    const childCells = grafka.getChildCells(parent, true, false);
    //console.log("childCells");
    //console.log(childCells);

    for (let i = 0; i < childCells.length; i++) {
        const cell = childCells[i];
        if (cell.value === "PandapowerNet") {
            continue;
        } else {
            if (String(cell.value.attributes[0].nodeValue) === String(busName)) {
              
                return cell;
            }
        }
    }
    return null;
}

// Optimized component insertion with proper batching and UI yielding
let componentInsertionQueue = [];
let isProcessingComponents = false;

// Component creation batch processor with UI yielding
// OPTIMIZED: Uses requestIdleCallback for better performance and prevents long tasks
async function processComponentBatches(componentTasks, batchSize = 3, yieldMs = 0) {
    const totalTasks = componentTasks.length;
    let processedCount = 0;
    
    // Show progress for large batches
    const showProgress = totalTasks > 50;
    if (showProgress) {
        console.log(`🚀 Processing ${totalTasks} component tasks in batches of ${batchSize}`);
    }
    
    for (let i = 0; i < totalTasks; i += batchSize) {
        const batch = componentTasks.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        // Process batch synchronously for better performance
        batch.forEach(task => {
            try {
                task();
                processedCount++;
            } catch (error) {
                console.error('Error processing component task:', error);
            }
        });

        // Yield to UI thread between batches using requestIdleCallback when available
        if (i + batchSize < totalTasks) {
            if (typeof requestIdleCallback !== 'undefined') {
                await new Promise(resolve => {
                    requestIdleCallback(() => {
                        resolve();
                    }, { timeout: 50 }); // Force execution after 50ms max
                });
            } else {
                // Fallback to setTimeout
                if (yieldMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, yieldMs));
                }
            }
        }
        
        // Log progress periodically
        if (showProgress && (batchNum % 10 === 0 || i + batchSize >= totalTasks)) {
            console.log(`   Progress: ${processedCount}/${totalTasks} (${((processedCount/totalTasks)*100).toFixed(1)}%)`);
        }
    }
    
    if (showProgress) {
        console.log(`✅ Completed processing ${processedCount} component tasks`);
    }
    
    return processedCount;
}

// Enhanced debounced component insertion
const debouncedComponentInsertion = (() => {
    let timeoutId = null;
    return (grafka, a, target, point, data) => {
        // Add to queue
        componentInsertionQueue.push({ grafka, a, target, point, data });

        // Clear existing timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Shorter debounce for better responsiveness
        timeoutId = setTimeout(async () => {
            if (isProcessingComponents) return;

            isProcessingComponents = true;
            try {
                const batchSize = componentInsertionQueue.length > 20 ? 3 : 5; // Smaller batches for large operations
                while (componentInsertionQueue.length > 0) {
                    const items = componentInsertionQueue.splice(0, batchSize);

                    for (const item of items) {
                        await insertComponentsForData(item.grafka, item.a, item.target, item.point, item.data);
                    }

                    // Yield between items for very large operations
                    if (componentInsertionQueue.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
            } finally {
                isProcessingComponents = false;
            }
        }, 50); // Reduced from 100ms to 50ms for better responsiveness
    };
})();

/**
 * Called from app (import .py / .dss) after backend returns pandapower-compatible JSON.
 * Uses the same insertion path as dropping a "Pandapower Network" shape.
 */
window.buildDiagramFromModelJson = function (graph, jsonText) {
    if (!graph || !graph.view) {
        console.error('buildDiagramFromModelJson: invalid graph');
        return;
    }
    let parsed;
    try {
        parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    } catch (e) {
        if (typeof mxUtils !== 'undefined' && mxUtils.alert) {
            mxUtils.alert('Invalid JSON from import: ' + e.message);
        } else {
            console.error('Invalid JSON from import:', e);
        }
        return;
    }
    if (parsed && typeof parsed.error === 'string') {
        const msg = parsed.error;
        if (typeof mxUtils !== 'undefined' && mxUtils.alert) {
            mxUtils.alert('Import failed: ' + msg);
        } else {
            console.error('Import failed:', msg);
        }
        return;
    }
    if (!parsed || !parsed._object) {
        if (typeof mxUtils !== 'undefined' && mxUtils.alert) {
            mxUtils.alert('Import response missing network model.');
        }
        return;
    }
    const scale = graph.view.scale;
    const tr = graph.view.translate;
    let ip;
    if (typeof graph.getFreeInsertPoint === 'function') {
        ip = graph.getFreeInsertPoint();
    } else {
        ip = { x: 100, y: 100 };
    }
    const point = { x: (ip.x + tr.x) * scale, y: (ip.y + tr.y) * scale };
    debouncedComponentInsertion(graph, null, null, point, parsed);
};

// Extract component insertion logic into separate function
async function insertComponentsForData(grafka, a, target, point, data) {
    // Show progress indicator for large component sets
    const totalComponents = Object.values(data._object).reduce((sum, obj) => {
        try {
            const parsed = JSON.parse(obj._object);
            return sum + (parsed.data ? parsed.data.length : 0);
        } catch {
            return sum;
        }
    }, 0);

    if (totalComponents > 50) {
        if (window.performanceOptimizer) {
            console.log(`🚀 Processing ${totalComponents} components with optimizations...`);
        }
    }

    const externalGridData = safeJsonParse(data?._object?.ext_grid?._object);
    const generatorData = JSON.parse(data._object.gen._object);
    const staticGeneratorData = JSON.parse(data._object.sgen._object);
    const asymmetricStaticGeneratorData = JSON.parse(data._object.asymmetric_sgen._object);

    const lineData = JSON.parse(data._object.line._object);
    const busData = JSON.parse(data._object.bus._object);

    const transformerData = JSON.parse(data._object.trafo._object);
    const threeWindingTransformerData = JSON.parse(data._object.trafo3w._object);
    const shuntReactorData = JSON.parse(data._object.shunt._object);
    //const capacitorData = JSON.parse(data._object.capacitor._object);
    const loadData = JSON.parse(data._object.load._object);
    const asymmetricLoadData = JSON.parse(data._object.asymmetric_load._object);
    const impedanceData = JSON.parse(data._object.impedance._object);
    const wardData = JSON.parse(data._object.ward._object);
    const extendedWardData = JSON.parse(data._object.xward._object);
    const motorData = JSON.parse(data._object.motor._object);
    const storageData = JSON.parse(data._object.storage._object);
    const svcData = JSON.parse(data._object.svc._object);
    const tcscData = JSON.parse(data._object.tcsc._object);
    //const sscData = JSON.parse(data._object.ssc._object); //to be added
    const dcLineData = JSON.parse(data._object.dcline._object);


    var scale = grafka.view.scale;
    var tr = grafka.view.translate;
    var x = point.x / scale - tr.x;
    var y = point.y / scale - tr.y;

    var parent = grafka.getDefaultParent();
    grafka.getModel().beginUpdate();

    try {
        // First pass - identify bus-transformer connections with progress tracking
        const busCount = busData.data.length;
        const busToTransformerMap = new Array(busCount).fill().map(() => []);
        const trafoCount = transformerData.data.length;

        // Build transformer mappings efficiently
        for (let trafoIndex = 0; trafoIndex < trafoCount; trafoIndex++) {
            const trafo = transformerData.data[trafoIndex];
            const [name, std_type, hv_bus_no, lv_bus_no] = trafo;

            if (hv_bus_no < busCount && hv_bus_no >= 0) {
                busToTransformerMap[hv_bus_no].push(trafoIndex);
            }
            if (lv_bus_no < busCount && lv_bus_no >= 0) {
                busToTransformerMap[lv_bus_no].push(trafoIndex);
            }
        }

        // Create adjacency matrix more efficiently
        const busAdjacencyMatrix = Array.from({ length: busCount },
            () => new Array(busCount).fill(0));

        // Build adjacency matrix from lines
        lineData.data.forEach(line => {
            const [name, std_type, from_bus, to_bus] = line;
            if (from_bus < busCount && from_bus >= 0 && to_bus < busCount && to_bus >= 0) {
                busAdjacencyMatrix[from_bus][to_bus] = 1;
                busAdjacencyMatrix[to_bus][from_bus] = 1;
            }
        });

        // Add transformer connections
        transformerData.data.forEach(trafo => {
            const [name, std_type, hv_bus_no, lv_bus_no] = trafo;
            if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                busAdjacencyMatrix[hv_bus_no][lv_bus_no] = 2;
                busAdjacencyMatrix[lv_bus_no][hv_bus_no] = 2;
            }
        });

        // Hierarchical placement parameters
        const levelHeight = 200; // Vertical spacing between voltage levels
        const busSpacing = 180;  // Horizontal spacing between buses on same level
        const startX = x + 100;  // Starting X position
        const startY = y + 100;  // Starting Y position

        // Group buses by voltage level efficiently
        const voltageGroups = {};
        for (let index = 0; index < busData.data.length; index++) {
            const bus = busData.data[index];
            const [name, vn_kv, type, inService] = bus;
            const voltage = parseFloat(vn_kv);

            if (!voltageGroups[voltage]) {
                voltageGroups[voltage] = [];
                }
            voltageGroups[voltage].push({index, name, voltage});
        }

            // Sort voltage levels in descending order (highest voltage at top)
            const sortedVoltages = Object.keys(voltageGroups).map(v => parseFloat(v)).sort((a, b) => b - a);
            
            // Calculate positions for each voltage level
            const busPositions = [];
            for (let i = 0; i < busCount; i++) {
                busPositions[i] = {x: 0, y: 0};
            }

            sortedVoltages.forEach((voltage, levelIndex) => {
                const busesAtLevel = voltageGroups[voltage];
                const levelY = startY + (levelIndex * levelHeight);
                
                // Center the buses horizontally at this voltage level
                const totalWidth = (busesAtLevel.length - 1) * busSpacing;
                const levelStartX = startX - (totalWidth / 2);
                
                busesAtLevel.forEach((busInfo, busIndex) => {
                    const busX = levelStartX + (busIndex * busSpacing);
                    busPositions[busInfo.index] = {
                        x: busX,
                        y: levelY
                    };
                });
            });

            // Fine-tune positions based on transformer connections
            // Move connected buses closer together if they're on different levels
            transformerData.data.forEach((trafo) => {
                const [name, std_type, hv_bus_no, lv_bus_no] = trafo;
                
                if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                    const hvBus = busData.data[hv_bus_no];
                    const lvBus = busData.data[lv_bus_no];
                    const hvVoltage = parseFloat(hvBus[1]);
                    const lvVoltage = parseFloat(lvBus[1]);
                    
                    // If buses are on different voltage levels, align them vertically
                    if (hvVoltage !== lvVoltage) {
                        // Average their X positions to align them vertically
                        const avgX = (busPositions[hv_bus_no].x + busPositions[lv_bus_no].x) / 2;
                        busPositions[hv_bus_no].x = avgX;
                        busPositions[lv_bus_no].x = avgX;
                    }
                }
            });

            // Create vertices using the calculated positions
            busData.data.forEach((bus, index) => {
                const [name, vn_kv, type, inService] = bus;

                // Get the optimized position for this bus
                const vertexX = busPositions[index].x;
                const vertexY = busPositions[index].y;

                // Svg busbar stretched to cell; points= restore edge docking along the bar (Graph.js)
                const busStyle = vertexStyleImportedBusbar('Bus');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    IMPORT_BUSBAR_W,
                    IMPORT_BUSBAR_H,
                    busStyle
                );

                configureBusAttributes(grafka, vertex, {
                    name: `${name}`,
                    vn_kv: `${vn_kv}`
                });
            });

            // Now place transformers based on the positions of connected buses
            transformerData.data.forEach((trafo, index) => {
                const [name, std_type, hv_bus_no, lv_bus_no, sn_mva, vn_hv_kv, vn_lv_kv,
                    vk_percent, vkr_percent, pfe_kw, i0_percent, shift_degree,
                    tap_side, tap_neutral, tap_min, tap_max, tap_step_percent,
                    tap_step_degree, tap_pos, tap_phase_shifter, parallel, df, in_service] = trafo;

                // Verify indices are valid before proceeding
                if (hv_bus_no >= busData.data.length || hv_bus_no < 0 ||
                    lv_bus_no >= busData.data.length || lv_bus_no < 0) {
                    console.warn(`Skipping transformer ${index} due to invalid bus indices: hv=${hv_bus_no}, lv=${lv_bus_no}`);
                    return;
                }

                let hv_bus = busData.data[hv_bus_no];
                let hv_bus_name = hv_bus[0];

                let lv_bus = busData.data[lv_bus_no];
                let lv_bus_name = lv_bus[0];

                // Find the vertices for the connected buses
                const hvBusVertex = findVertexByBusId(grafka, parent, hv_bus_name);
                const lvBusVertex = findVertexByBusId(grafka, parent, lv_bus_name);

                if (hvBusVertex && lvBusVertex) {
                    // Calculate the midpoint between the two buses
                    const hvX = hvBusVertex.geometry.x;
                    const hvY = hvBusVertex.geometry.y;
                    const lvX = lvBusVertex.geometry.x;
                    const lvY = lvBusVertex.geometry.y;

                    const hvCx = hvX + IMPORT_BUSBAR_W / 2;
                    const lvCx = lvX + IMPORT_BUSBAR_W / 2;

                    // Place transformer between busbar centers (palette SVG)
                    const vertexCenterX = (hvCx + lvCx) / 2;
                    const vertexCenterY = (hvY + lvY) / 2;

                    const trafoStyle = vertexStyleFromElectrisimSymbol('sym-transformer', 'Transformer');
                    const [trafoW, trafoH] = vertexSizeFromElectrisimSymbol('sym-transformer', 40, 60);

                    const vertex = grafka.insertVertex(
                        parent,
                        null,
                        ``,
                        vertexCenterX - trafoW / 2,
                        vertexCenterY - trafoH / 2,
                        trafoW,
                        trafoH,
                        trafoStyle
                    );

                    // Configure transformer attributes
                    configureTransformerAttributes(grafka, vertex, {
                        name: `${name}`,
                        std_type: `${std_type}`,
                        sn_mva: `${sn_mva}`,
                        vn_hv_kv: `${vn_hv_kv}`,
                        vn_lv_kv: `${vn_lv_kv}`,
                        vk_percent: `${vk_percent}`,
                        vkr_percent: `${vkr_percent}`,
                        pfe_kw: `${pfe_kw}`,
                        i0_percent: `${i0_percent}`,
                        shift_degree: `${shift_degree}`,
                        tap_side: `${tap_side}`,
                        tap_neutral: `${tap_neutral}`,
                        tap_min: `${tap_min}`,
                        tap_max: `${tap_max}`,
                        tap_step_percent: `${tap_step_percent}`,
                        tap_step_degree: `${tap_step_degree}`,
                        tap_pos: `${tap_pos}`,
                        tap_phase_shifter: `${tap_phase_shifter}`,
                        parallel: `${parallel}`,
                        df: `${df}`,
                        in_service: `${in_service}`
                    });

                    // Create edges connecting transformer to buses
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex,
                        `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0;exitY=${TRANSFORMER_EDGE_PIN_Y};exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`);
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex,
                        `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=${TRANSFORMER_EDGE_PIN_Y};exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`);
                } else {
                    console.warn(`Could not place transformer ${name}: One or both bus vertices not found`, {
                        hv_bus: hv_bus_name,
                        lv_bus: lv_bus_name,
                        hvBusVertex: !!hvBusVertex,
                        lvBusVertex: !!lvBusVertex
                    });
                }
            });

            
            lineData.data.forEach((line, index) => {
                const [name, std_type, from_bus, to_bus, length_km, r_ohm_per_km,
                    x_ohm_per_km, c_nf_per_km, g_us_per_km, max_i_ka, df,
                    parallel, type, in_service] = line;

                // Get bus data for from and to buses
                const fromBus = busData.data[from_bus];
                const fromBusName = fromBus[0];

                const toBus = busData.data[to_bus];
                const toBusName = toBus[0];

                // Find the vertices for the from and to buses
                const fromBusVertex = findVertexByBusId(grafka, parent, fromBusName);
                const toBusVertex = findVertexByBusId(grafka, parent, toBusName);

                if (fromBusVertex && toBusVertex) {
                    // Define line style based on type (cs for cable, ol for overhead line)
                    let lineStyle;

                    lineStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=Line";


                    // Insert the edge for the line
                    const edge = grafka.insertEdge(
                        parent,
                        null,
                        name,
                        fromBusVertex,
                        toBusVertex,
                        lineStyle
                    );

                    // Configure line attributes
                    configureLineAttributes(grafka, edge, {
                        name: `${name}`,
                        std_type: `${std_type}`,
                        from_bus: `${from_bus}`,
                        to_bus: `${to_bus}`,
                        length_km: `${length_km}`,
                        r_ohm_per_km: `${r_ohm_per_km}`,
                        x_ohm_per_km: `${x_ohm_per_km}`,
                        c_nf_per_km: `${c_nf_per_km}`,
                        g_us_per_km: `${g_us_per_km}`,
                        max_i_ka: `${max_i_ka}`,
                        df: `${df}`,
                        parallel: `${parallel}`,
                        type: `${type}`,
                        in_service: `${in_service}`
                    });
                } else {
                    console.warn(`Could not create line ${name}: Bus vertices not found`, {
                        from_bus: fromBusName,
                        to_bus: toBusName,
                        fromBusVertex,
                        toBusVertex
                    });
                }
            }); 

            externalGridData.data.forEach((externalgrid, index) => {
                const [name, bus_no, vm_pu, va_degree, slack_weight, in_service] = externalgrid;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const [egW, egH] = vertexSizeFromElectrisimSymbol('sym-ext-grid', 70, 58);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2;
                const anchorY = busVertex.geometry.y - 80;
                const styleExternalGrid = vertexStyleFromElectrisimSymbol('sym-ext-grid', 'External Grid');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - egW / 2,
                    anchorY - egH / 2,
                    egW,
                    egH,
                    styleExternalGrid
                );
                configureExternalGridAttributes(grafka, vertex, {                    
                    name: `${name}`,
                    vm_pu: `${vm_pu}`,
                    va_degree: `${va_degree}`,
                    slack_weight: `${slack_weight}`,
                    in_service: `${in_service}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            generatorData.data.forEach((generator, index) => {
                const [name, bus_no, p_mw, vm_pu, sn_mva, min_q_mvar, max_q_mvar, scaling, slack, in_service, slack_weight, type] = generator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const generatorOffset = index * 30;
                const [genW, genH] = vertexSizeFromElectrisimSymbol('sym-generator', 45, 45);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + generatorOffset;
                const anchorY = busVertex.geometry.y + 80;
                const styleGenerator = vertexStyleFromElectrisimSymbol('sym-generator', 'Generator');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - genW / 2,
                    anchorY - genH / 2,
                    genW,
                    genH,
                    styleGenerator
                );
                configureGeneratorAttributes(grafka, vertex, {
                    name: `${name}`,
                    bus_no: `${bus_no}`,
                    p_mw: `${p_mw}`,
                    vm_pu: `${vm_pu}`,
                    sn_mva: `${sn_mva}`,
                    min_q_mvar: `${min_q_mvar}`,
                    max_q_mvar: `${max_q_mvar}`,
                    scaling: `${scaling}`,
                    slack: `${slack}`,
                    in_service: `${in_service}`,
                    slack_weight: `${slack_weight}`,
                    type: `${type}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            staticGeneratorData.data.forEach((staticgenerator, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, scaling, in_service, type, current_source] = staticgenerator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const staticGenOffset = index * 40;
                const [sgW, sgH] = vertexSizeFromElectrisimSymbol('sym-static-gen', 45, 45);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + staticGenOffset;
                const anchorY = busVertex.geometry.y + 120;
                const styleStaticGenerator = vertexStyleFromElectrisimSymbol('sym-static-gen', 'Static Generator');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - sgW / 2,
                    anchorY - sgH / 2,
                    sgW,
                    sgH,
                    styleStaticGenerator
                );
                configureStaticGeneratorAttributes(grafka, vertex, {
                    name: `${name}`,
                    p_mw: `${p_mw}`,
                    q_mvar: `${q_mvar}`,
                    sn_mva: `${sn_mva}`,
                    scaling: `${scaling}`,
                    in_service: `${in_service}`,
                    type: `${type}`,
                    current_source: `${current_source}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            asymmetricStaticGeneratorData.data.forEach((asymmetricstaticgenerator, index) => {
                const [name, bus_no, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar, sn_mva, scaling, in_service, type, current_source] = asymmetricstaticgenerator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const [asgW, asgH] = vertexSizeFromElectrisimSymbol('sym-asym-static-gen', 45, 45);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleAsymmetricStaticGenerator = vertexStyleFromElectrisimSymbol('sym-asym-static-gen', 'Asymmetric Static Generator');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - asgW / 2,
                    anchorY - asgH / 2,
                    asgW,
                    asgH,
                    styleAsymmetricStaticGenerator
                );
                configureStaticGeneratorAttributes(grafka, vertex, {
                    name: `${name}`,
                    p_a_mw: `${p_a_mw}`,
                    q_a_mvar: `${q_a_mvar}`,
                    p_b_mw: `${p_b_mw}`,
                    q_b_mvar: `${q_b_mvar}`,
                    p_c_mw: `${p_c_mw}`,
                    q_c_mvar: `${q_c_mvar}`,
                    sn_mva: `${sn_mva}`,
                    scaling: `${scaling}`,
                    in_service: `${in_service}`,
                    type: `${type}`,
                    current_source: `${current_source}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });


            /*
            transformerData.data.forEach((trafo, index) => {
                const [name, std_type, hv_bus_no, lv_bus_no, sn_mva, vn_hv_kv, vn_lv_kv,
                    vk_percent, vkr_percent, pfe_kw, i0_percent, shift_degree,
                    tap_side, tap_neutral, tap_min, tap_max, tap_step_percent,
                    tap_step_degree, tap_pos, tap_phase_shifter, parallel, df, in_service] = trafo;

                hv_bus = busData.data[hv_bus_no]
                hv_bus_name = hv_bus[0]

                lv_bus = busData.data[lv_bus_no]
                lv_bus_name = lv_bus[0]

                // Add edges to connect transformer to the HV and LV buses
                const hvBusVertex = findVertexByBusId(grafka, parent, hv_bus_name);
                const lvBusVertex = findVertexByBusId(grafka, parent, lv_bus_name);


                // Calculate positions for the transformer
                //const vertexXHV = hvBusVertex.geometry.x // + (hv_bus_no * 150);  // Position based on hv_bus index
                const vertexX = hvBusVertex.geometry.x + 60//(lv_bus_no * 150);  // Position based on lv_bus index
                const vertexY = lvBusVertex.geometry.y - 120;  // Position between buses


                // Use transformer symbol style
                const trafoStyle = "shapeELXXX=Transformer; verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;strokeWidth=1;shape=mxgraph.electrical.signal_sources.current_source;";

                // Insert the transformer vertex
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,  // Center between the two buses
                    vertexY,
                    40,  // width
                    60,  // height
                    trafoStyle
                );

                // Configure transformer attributes
                configureTransformerAttributes(grafka, vertex, {
                    name: `${name}`,
                    std_type: `${std_type}`,

                    sn_mva: `${sn_mva}`,
                    vn_hv_kv: `${vn_hv_kv}`,
                    vn_lv_kv: `${vn_lv_kv}`,
                    vk_percent: `${vk_percent}`,
                    vkr_percent: `${vkr_percent}`,
                    pfe_kw: `${pfe_kw}`,
                    i0_percent: `${i0_percent}`,
                    shift_degree: `${shift_degree}`,
                    tap_side: `${tap_side}`,
                    tap_neutral: `${tap_neutral}`,
                    tap_min: `${tap_min}`,
                    tap_max: `${tap_max}`,
                    tap_step_percent: `${tap_step_percent}`,
                    tap_step_degree: `${tap_step_degree}`,
                    tap_pos: `${tap_pos}`,
                    tap_phase_shifter: `${tap_phase_shifter}`,
                    parallel: `${parallel}`,
                    df: `${df}`,
                    in_service: `${in_service}`
                });

                // Create edges connecting transformer to buses
                const edgeStyleHV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                const edgeStyleLV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.4;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (hvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
                }

                if (lvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex, edgeStyleLV);
                }
            }); */
            threeWindingTransformerData.data.forEach((threewindingtransformer, index) => {
                const [name, std_type, hv_bus_no, mv_bus_no, lv_bus_no, sn_hv_mva, sn_mv_mva, sn_lv_mva,
                    vn_hv_kv, vn_mv_kv, vn_lv_kv, vk_hv_percent, vk_mv_percent,
                    vk_lv_percent, vkr_hv_percent, vkr_mv_percent, vkr_lv_percent, pfe_kw,
                    i0_percent, shift_mv_degree, tap_side, tap_neutral, tap_min, tap_max, tap_step_percent, tap_step_degree, tap_pos, tap_at_star_point, in_service] = threewindingtransformer;

                let hv_bus = busData.data[hv_bus_no];
                let hv_bus_name = hv_bus[0];

                let mv_bus = busData.data[mv_bus_no];
                let mv_bus_name = mv_bus[0];

                let lv_bus = busData.data[lv_bus_no];
                let lv_bus_name = lv_bus[0];

                // Add edges to connect transformer to the HV and LV buses
                const hvBusVertex = findVertexByBusId(grafka, parent, hv_bus_name);
                const mvBusVertex = findVertexByBusId(grafka, parent, mv_bus_name);
                const lvBusVertex = findVertexByBusId(grafka, parent, lv_bus_name);


                // Calculate positions for the transformer
                //const vertexXHV = hvBusVertex.geometry.x // + (hv_bus_no * 150);  // Position based on hv_bus index
                const vertexCenterX = hvBusVertex.geometry.x + 60;
                const vertexCenterY = lvBusVertex.geometry.y - 120;

                const threewindingtrafoStyle = vertexStyleFromElectrisimSymbol('sym-3w-transformer', 'Three Winding Transformer');
                const [twW, twH] = vertexSizeFromElectrisimSymbol('sym-3w-transformer', 40, 60);

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexCenterX - twW / 2,
                    vertexCenterY - twH / 2,
                    twW,
                    twH,
                    threewindingtrafoStyle
                );

                // Configure transformer attributes
                configureTransformerAttributes(grafka, vertex, {
                    name: `${name}`,
                    std_type: `${std_type}`,
                    sn_hv_mva: `${sn_hv_mva}`,
                    sn_mv_mva: `${sn_mv_mva}`,
                    sn_lv_mva: `${sn_lv_mva}`,
                    vn_hv_kv: `${vn_hv_kv}`,
                    vn_mv_kv: `${vn_mv_kv}`,
                    vn_lv_kv: `${vn_lv_kv}`,
                    vk_hv_percent: `${vk_hv_percent}`,
                    vk_mv_percent: `${vk_mv_percent}`,
                    vk_lv_percent: `${vk_lv_percent}`,
                    vkr_hv_percent: `${vkr_hv_percent}`,
                    vkr_mv_percent: `${vkr_mv_percent}`,
                    vkr_lv_percent: `${vkr_lv_percent}`,
                    pfe_kw: `${pfe_kw}`,
                    i0_percent: `${i0_percent}`,
                    shift_mv_degree: `${shift_mv_degree}`,
                    tap_side: `${tap_side}`,
                    tap_neutral: `${tap_neutral}`,
                    tap_min: `${tap_min}`,
                    tap_max: `${tap_max}`,
                    tap_step_percent: `${tap_step_percent}`,
                    tap_step_degree: `${tap_step_degree}`,
                    tap_pos: `${tap_pos}`,
                    tap_at_star_point: `${tap_at_star_point}`,
                    in_service: `${in_service}`
                });

                // Create edges connecting transformer to buses
                const edgeStyleHV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                const edgeStyleMV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.4;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                const edgeStyleLV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.4;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (hvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
                }
                if (mvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, mvBusVertex, edgeStyleMV);
                }
                if (lvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex, edgeStyleLV);
                }
            });
            shuntReactorData.data.forEach((shuntreactor, index) => {
                const [bus_no, name, q_mvar, p_mw, vn_kv, step, max_step, in_service] = shuntreactor;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [shW, shH] = vertexSizeFromElectrisimSymbol('sym-shunt', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleShuntReactor = vertexStyleFromElectrisimSymbol('sym-shunt', 'Shunt Reactor');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - shW / 2,
                    anchorY - shH / 2,
                    shW,
                    shH,
                    styleShuntReactor
                );
                configureShuntReactorAttributes(grafka, vertex, {
                    name: `${name}`,
                    q_mvar: `${q_mvar}`,
                    p_mw: `${p_mw}`,
                    vn_kv: `${vn_kv}`,
                    step: `${step}`,
                    max_step: `${max_step}`,
                    in_service: `${in_service}`
                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            /*
            capacitorData.data.forEach((capacitor, index) => {
                const [name, bus_no, q_mvar, p_mw, vn_kv, step, max_step, in_service] = capacitor;
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
                const styleCapacitor = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.capacitors.capacitor_4;shapeELXXX=Capacitor"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
                    styleCapacitor
                );
                configureCapacitorAttributes(grafka, vertex,{
                    name: `${name}`,                    
                    q_mvar: `${q_mvar}`,
                    p_mw: `${p_mw}`,
                    vn_kv: `${vn_kv}`,
                    step: `${step}`,
                    max_step: `${max_step}`,
                    in_service: `${in_service}`                 
                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });      */
            loadData.data.forEach((load, index) => {
                const [name, bus_no, p_mw, q_mvar, const_z_percent, const_i_percent, sn_mva, scaling, type] = load;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const loadOffset = index * 35;
                const [ldW, ldH] = vertexSizeFromElectrisimSymbol('sym-load', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 - 60 + loadOffset;
                const anchorY = busVertex.geometry.y + 80;
                const loadStyle = vertexStyleFromElectrisimSymbol('sym-load', 'Load');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - ldW / 2,
                    anchorY - ldH / 2,
                    ldW,
                    ldH,
                    loadStyle
                );
                configureLoadAttributes(grafka, vertex, {
                    name: `${name}`,
                    p_mw: `${p_mw}`,
                    q_mvar: `${q_mvar}`,
                    const_z_percent: `${const_z_percent}`,
                    const_i_percent: `${const_i_percent}`,
                    sn_mva: `${sn_mva}`,
                    scaling: `${scaling}`,
                    type: `${type}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            asymmetricLoadData.data.forEach((asymmetricload, index) => {
                const [name, bus_no, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar, sn_mva, scaling, in_service, type] = asymmetricload;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const [alW, alH] = vertexSizeFromElectrisimSymbol('sym-asym-load', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const asymmetricloadStyle = vertexStyleFromElectrisimSymbol('sym-asym-load', 'Asymmetric Load');

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - alW / 2,
                    anchorY - alH / 2,
                    alW,
                    alH,
                    asymmetricloadStyle
                );
                configureAsymmetricLoadAttributes(grafka, vertex, {
                    name: `${name}`,
                    p_a_mw: `${p_a_mw}`,
                    q_a_mvar: `${q_a_mvar}`,
                    p_b_mw: `${p_b_mw}`,
                    q_b_mvar: `${q_b_mvar}`,
                    p_c_mw: `${p_c_mw}`,
                    q_c_mvar: `${q_c_mvar}`,
                    sn_mva: `${sn_mva}`,
                    scaling: `${scaling}`,
                    in_service: `${in_service}`,
                    type: `${type}`
                })

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            }
            );
            impedanceData.data.forEach((impedance, index) => {
                const [name, from_bus_no, to_bus_no, rft_pu, xft_pu, rtf_pu, xtf_pu, sn_mva, in_service] = impedance;
                // Get bus data for from and to buses
                const fromBus = busData.data[from_bus_no];
                const fromBusName = fromBus[0];
                const toBus = busData.data[to_bus_no];
                const toBusName = toBus[0];

                // Find the vertices for the from and to buses
                const fromBusVertex = findVertexByBusId(grafka, parent, fromBusName);
                const toBusVertex = findVertexByBusId(grafka, parent, toBusName);


                if (fromBusVertex && toBusVertex) {
                    let impedanceStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.impedance;shapeELXXX=Impedance";

                    // Insert the edge for the line
                    const edge = grafka.insertEdge(
                        parent,
                        null,
                        name,
                        fromBusVertex,
                        toBusVertex,
                        impedanceStyle
                    );
                    // Configure line attributes
                    configureImpedanceAttributes(grafka, edge, {
                        name: `${name}`,
                        from_bus: `${from_bus_no}`,
                        to_bus: `${to_bus_no}`,
                        rft_pu: `${rft_pu}`,
                        xft_pu: `${xft_pu}`,
                        rtf_pu: `${rtf_pu}`,
                        xtf_pu: `${xtf_pu}`,
                        sn_mva: `${sn_mva}`,
                        in_service: `${in_service}`,
                    });
                } else {
                    console.warn(`Could not create impedance ${name}: Bus vertices not found`, {
                        from_bus: fromBusName,
                        to_bus: toBusName,
                        fromBusVertex,
                        toBusVertex
                    });
                }
            });
            wardData.data.forEach((ward, index) => {
                const [name, bus_no, ps_mw, qs_mvar, qz_mvar, pz_mw, in_service] = ward;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [wW, wH] = vertexSizeFromElectrisimSymbol('sym-ward', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleWard = vertexStyleFromElectrisimSymbol('sym-ward', 'Ward');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - wW / 2,
                    anchorY - wH / 2,
                    wW,
                    wH,
                    styleWard
                );
                configureWardAttributes(grafka, vertex, {
                    name: `${name}`,
                    ps_mw: `${ps_mw}`,
                    qs_mvar: `${qs_mvar}`,
                    qz_mvar: `${qz_mvar}`,
                    pz_mw: `${pz_mw}`,
                    in_service: `${in_service}`
                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            extendedWardData.data.forEach((extendedward, index) => {
                const [name, bus_no, ps_mw, qs_mvar, qz_mvar, pz_mw, r_ohm, x_ohm, vm_pu, slack_weight, in_service] = extendedward;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [ewW, ewH] = vertexSizeFromElectrisimSymbol('sym-ext-ward', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleExtendedWard = vertexStyleFromElectrisimSymbol('sym-ext-ward', 'Extended Ward');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - ewW / 2,
                    anchorY - ewH / 2,
                    ewW,
                    ewH,
                    styleExtendedWard
                );
                configureExtendedWardAttributes(grafka, vertex, {
                    name: `${name}`,
                    ps_mw: `${ps_mw}`,
                    qs_mvar: `${qs_mvar}`,
                    qz_mvar: `${qz_mvar}`,
                    pz_mw: `${pz_mw}`,
                    r_ohm: `${r_ohm}`,
                    x_ohm: `${x_ohm}`,
                    vm_pu: `${vm_pu}`,
                    slack_weight: `${slack_weight}`,
                    in_service: `${in_service}`
                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            motorData.data.forEach((motor, index) => {
                const [name, bus_no, pn_mech_mw, loading_percent, cos_phi, cos_phi_n, efficiency_percent, efficiency_n_percent, lrc_pu, vn_kv, scaling, in_service, rx] = motor;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [mW, mH] = vertexSizeFromElectrisimSymbol('sym-motor', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleMotor = vertexStyleFromElectrisimSymbol('sym-motor', 'Motor');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - mW / 2,
                    anchorY - mH / 2,
                    mW,
                    mH,
                    styleMotor
                );
                configureMotorAttributes(grafka, vertex, {
                    name: `${name}`,
                    bus_no: `${bus_no}`,
                    pn_mech_mw: `${pn_mech_mw}`,
                    loading_percent: `${loading_percent}`,
                    cos_phi: `${cos_phi}`,
                    cos_phi_n: `${cos_phi_n}`,
                    efficiency_percent: `${efficiency_percent}`,
                    efficiency_n_percent: `${efficiency_n_percent}`,
                    lrc_pu: `${lrc_pu}`,
                    vn_kv: `${vn_kv}`,
                    scaling: `${scaling}`,
                    in_service: `${in_service}`,
                    rx: `${rx}`

                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            storageData.data.forEach((storage, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, soc_percent, min_e_mwh, max_e_mwh, scaling, in_service, type] = storage;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [stW, stH] = vertexSizeFromElectrisimSymbol('sym-storage', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleStorage = vertexStyleFromElectrisimSymbol('sym-storage', 'Storage');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - stW / 2,
                    anchorY - stH / 2,
                    stW,
                    stH,
                    styleStorage
                );
                configureStorageAttributes(grafka, vertex, {
                    name: `${name}`,
                    bus_no: `${bus_no}`,
                    p_mw: `${p_mw}`,
                    q_mvar: `${q_mvar}`,
                    sn_mva: `${sn_mva}`,
                    soc_percent: `${soc_percent}`,
                    min_e_mwh: `${min_e_mwh}`,
                    max_e_mwh: `${max_e_mwh}`,
                    scaling: `${scaling}`,
                    in_service: `${in_service}`,
                    type: `${type}`

                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            svcData.data.forEach((svc, index) => {
                const [name, bus_no, x_l_ohm, x_cvar_ohm, set_vm_pu, thyristor_firing_angle_degree, controllable, in_service, min_angle_degree, max_angle_degree, type] = svc;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const [svcW, svcH] = vertexSizeFromElectrisimSymbol('sym-svc', 30, 20);
                const anchorX = busVertex.geometry.x + IMPORT_BUSBAR_W / 2 + 60;
                const anchorY = busVertex.geometry.y + 60;
                const styleSVC = vertexStyleFromElectrisimSymbol('sym-svc', 'SVC');
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    anchorX - svcW / 2,
                    anchorY - svcH / 2,
                    svcW,
                    svcH,
                    styleSVC
                );
                configureSVCAttributes(grafka, vertex, {
                    name: `${name}`,
                    bus_no: `${bus_no}`,
                    x_l_ohm: `${x_l_ohm}`,
                    x_cvar_ohm: `${x_cvar_ohm}`,
                    set_vm_pu: `${set_vm_pu}`,
                    thyristor_firing_angle_degree: `${thyristor_firing_angle_degree}`,
                    controllable: `${controllable}`,
                    in_service: `${in_service}`,
                    min_angle_degree: `${min_angle_degree}`,
                    max_angle_degree: `${max_angle_degree}`,
                    type: `${type}`

                })
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            tcscData.data.forEach((tcsc, index) => {
                const [name, from_bus_no, to_bus_no, x_l_ohm, x_cvar_ohm, set_p_to_mw,
                    thyristor_firing_angle_degree, controllable, in_service] = tcsc;
                let from_bus = busData.data[from_bus_no];
                let from_bus_name = from_bus[0];

                let to_bus = busData.data[to_bus_no];
                let to_bus_name = to_bus[0];

                const hvBusVertex = findVertexByBusId(grafka, parent, from_bus_name);
                const lvBusVertex = findVertexByBusId(grafka, parent, to_bus_name);

                const hvCx = hvBusVertex.geometry.x + IMPORT_BUSBAR_W / 2;
                const lvCx = lvBusVertex.geometry.x + IMPORT_BUSBAR_W / 2;
                const vertexCenterX = (hvCx + lvCx) / 2;
                const vertexCenterY = (hvBusVertex.geometry.y + lvBusVertex.geometry.y) / 2 - 40;

                const tcscStyle = vertexStyleFromElectrisimSymbol('sym-tcsc', 'TCSC');
                const [tcscW, tcscH] = vertexSizeFromElectrisimSymbol('sym-tcsc', 40, 60);

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexCenterX - tcscW / 2,
                    vertexCenterY - tcscH / 2,
                    tcscW,
                    tcscH,
                    tcscStyle
                );

                // Configure transformer attributes
                configureTCSCAttributes(grafka, vertex, {
                    name: `${name}`,
                    from_bus_no: `${from_bus_no}`,
                    to_bus_no: `${to_bus_no}`,
                    x_l_ohm: `${x_l_ohm}`,
                    x_cvar_ohm: `${x_cvar_ohm}`,
                    set_p_to_mw: `${set_p_to_mw}`,
                    thyristor_firing_angle_degree: `${thyristor_firing_angle_degree}`,
                    controllable: `${controllable}`,
                    in_service: `${in_service}`
                });

                // Create edges connecting transformer to buses
                const edgeStyleHV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                const edgeStyleLV = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.4;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (hvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
                }

                if (lvBusVertex) {
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex, edgeStyleLV);
                }
            });

            //ssc to be added

            dcLineData.data.forEach((dcline, index) => {
                const [name, from_bus, to_bus, p_mw, loss_percent,
                    loss_mw, vm_from_pu, vm_to_pu, max_p_mw, min_q_from_mvar,
                    min_q_to_mvar, max_q_from_mvar, max_q_to_mvar, in_service] = dcline;

                // Get bus data for from and to buses
                const fromBus = busData.data[from_bus];
                const fromBusName = fromBus[0];

                const toBus = busData.data[to_bus];
                const toBusName = toBus[0];

                // Find the vertices for the from and to buses
                const fromBusVertex = findVertexByBusId(grafka, parent, fromBusName);
                const toBusVertex = findVertexByBusId(grafka, parent, toBusName);

                if (fromBusVertex && toBusVertex) {
                    // Define line style based on type (cs for cable, ol for overhead line)


                    let dclineStyle = "shapeELXXX=DC Line;text;html=1;strokeColor=black;fillColor=white;overflow=fill;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;";


                    // Insert the edge for the line
                    const edge = grafka.insertEdge(
                        parent,
                        null,
                        name,
                        fromBusVertex,
                        toBusVertex,
                        dclineStyle
                    );

                    // Configure line attributes
                    configureDCLineAttributes(grafka, edge, {
                        name: `${name}`,
                        from_bus: `${from_bus}`,
                        to_bus: `${to_bus}`,
                        p_mw: `${p_mw}`,
                        loss_percent: `${loss_percent}`,
                        loss_mw: `${loss_mw}`,
                        vm_from_pu: `${vm_from_pu}`,
                        vm_to_pu: `${vm_to_pu}`,
                        max_p_mw: `${max_p_mw}`,
                        min_q_from_mvar: `${min_q_from_mvar}`,
                        min_q_to_mvar: `${min_q_to_mvar}`,
                        max_q_from_mvar: `${max_q_from_mvar}`,
                        max_q_to_mvar: `${max_q_to_mvar}`,
                        in_service: `${in_service}`

                    });
                } else {
                    console.warn(`Could not create line ${name}: Bus vertices not found`, {
                        from_bus: fromBusName,
                        to_bus: toBusName,
                        fromBusVertex,
                        toBusVertex
                    });
                }
            });

        } catch (error) {
            console.error('Error during vertex insertion:', error);
        } finally {
            grafka.getModel().endUpdate();
        }

        //this.drop(grafka, a, target, x, y);

    }


// Debounced version of useDataToInsertOnGraph
function useDataToInsertOnGraph(grafka, a, target, point) {
    waitForData().then(data => {
        debouncedComponentInsertion(grafka, a, target, point, data);
    });
}