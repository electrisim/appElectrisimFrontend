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

// Make the low-level inserter available globally so app.min.js can call it directly
window.insertComponentsForData = insertComponentsForData;

/**
 * Resolves overlapping non-bus component vertices by iteratively pushing them apart.
 * Buses (horizontal bar shapes) and transformers (between buses) are left untouched.
 * Only repositions components (loads, generators, shunts, etc.) that overlap each other.
 * @param {mxGraph} grafka - The mxGraph instance
 * @param {mxCell} parent - The parent cell containing vertices to process
 * @param {Object} options - { margin: number, maxIterations: number }
 */
function resolveOverlapsInGraph(grafka, parent, options) {
    const margin = (options && options.margin) || 10;
    const maxIterations = (options && options.maxIterations) || 40;

    var childCells = grafka.getChildCells(parent, true, false);
    var components = [];
    for (var ci = 0; ci < childCells.length; ci++) {
        var cell = childCells[ci];
        if (!grafka.getModel().isVertex(cell) || !cell.geometry) continue;
        var style = cell.style || '';
        if (style.indexOf('shapeELXXX=Bus') !== -1) continue;
        if (style.indexOf('shapeELXXX=Transformer') !== -1) continue;
        if (style.indexOf('shapeELXXX=Three Winding Transformer') !== -1) continue;
        if (style.indexOf('shapeELXXX=NotEditableLine') !== -1) continue;
        components.push(cell);
    }

    if (components.length < 2) return;

    var model = grafka.getModel();
    for (var iter = 0; iter < maxIterations; iter++) {
        var moved = false;
        for (var i = 0; i < components.length; i++) {
            for (var j = i + 1; j < components.length; j++) {
                var gA = components[i].geometry;
                var gB = components[j].geometry;
                if (!gA || !gB) continue;

                var ox = Math.min(gA.x + gA.width, gB.x + gB.width) - Math.max(gA.x, gB.x) + margin;
                var oy = Math.min(gA.y + gA.height, gB.y + gB.height) - Math.max(gA.y, gB.y) + margin;

                if (ox > 0 && oy > 0) {
                    moved = true;
                    var cax = gA.x + gA.width / 2;
                    var cbx = gB.x + gB.width / 2;
                    var shiftX = ox / 2 + 2;
                    if (cax <= cbx) {
                        var nA = gA.clone(); nA.x -= shiftX; model.setGeometry(components[i], nA);
                        var nB = gB.clone(); nB.x += shiftX; model.setGeometry(components[j], nB);
                    } else {
                        var nA2 = gA.clone(); nA2.x += shiftX; model.setGeometry(components[i], nA2);
                        var nB2 = gB.clone(); nB2.x -= shiftX; model.setGeometry(components[j], nB2);
                    }
                }
            }
        }
        if (!moved) break;
    }
}

// Helper to build a diagram from a Pandapower/OpenDSS JSON string
window.buildDiagramFromModelJson = function (grafka, dataJson) {
    try {
        const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
        console.log("Building diagram from model JSON:", data);
        
        // Log what elements we're about to insert
        const impedanceData = JSON.parse(data._object.impedance._object);
        console.log("Impedances to insert:", impedanceData.data.length);
        
        // Place the network around (100, 100) in current view
        var point = new mxPoint(100, 100);
        insertComponentsForData(grafka, null, null, point, data);
    } catch (e) {
        console.error("Error building diagram from JSON:", e);
        mxUtils.alert("Error building diagram from imported model: " + e.message);
    }
};

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

        // === Identify filter buses (connected only via impedances, not lines/transformers) ===
        const busConnectedViaLineOrTrafo = new Set();
        lineData.data.forEach(line => {
            const [name, std_type, from_bus, to_bus] = line;
            if (from_bus >= 0 && from_bus < busCount) busConnectedViaLineOrTrafo.add(from_bus);
            if (to_bus >= 0 && to_bus < busCount) busConnectedViaLineOrTrafo.add(to_bus);
        });
        transformerData.data.forEach(trafo => {
            const [name, std_type, hv_bus_no, lv_bus_no] = trafo;
            if (hv_bus_no >= 0 && hv_bus_no < busCount) busConnectedViaLineOrTrafo.add(hv_bus_no);
            if (lv_bus_no >= 0 && lv_bus_no < busCount) busConnectedViaLineOrTrafo.add(lv_bus_no);
        });

        const impedanceAdj = {};
        impedanceData.data.forEach(imp => {
            const [name, from_bus_no, to_bus_no] = imp;
            if (!impedanceAdj[from_bus_no]) impedanceAdj[from_bus_no] = [];
            if (!impedanceAdj[to_bus_no]) impedanceAdj[to_bus_no] = [];
            impedanceAdj[from_bus_no].push(to_bus_no);
            impedanceAdj[to_bus_no].push(from_bus_no);
        });

        const filterBusSet = new Set();
        for (let i = 0; i < busCount; i++) {
            if (!busConnectedViaLineOrTrafo.has(i) && impedanceAdj[i]) {
                filterBusSet.add(i);
            }
        }

        // Build filter chains: root (main bus) -> [intermediate bus, end bus, ...]
        const filterChainsMap = {};
        const assignedFilterBuses = new Set();

        for (const rootBus of busConnectedViaLineOrTrafo) {
            const impConns = impedanceAdj[rootBus];
            if (!impConns) continue;

            const chains = [];
            for (const nextBus of impConns) {
                if (!filterBusSet.has(nextBus) || assignedFilterBuses.has(nextBus)) continue;

                const chain = [nextBus];
                assignedFilterBuses.add(nextBus);
                let current = nextBus;
                let prev = rootBus;

                while (true) {
                    const nextConns = (impedanceAdj[current] || [])
                        .filter(b => b !== prev && filterBusSet.has(b) && !assignedFilterBuses.has(b));
                    if (nextConns.length === 0) break;
                    chain.push(nextConns[0]);
                    assignedFilterBuses.add(nextConns[0]);
                    prev = current;
                    current = nextConns[0];
                }
                chains.push(chain);
            }

            if (chains.length > 0) {
                filterChainsMap[rootBus] = chains;
            }
        }

        console.log(`Filter buses detected: ${filterBusSet.size}, Filter chains: ${Object.keys(filterChainsMap).length} roots`);

        // === Pre-calculate component counts per bus ===
        const busComponentCounts = new Array(busCount).fill(0);
        const countBusComponents = function (dataArr, busField) {
            dataArr.forEach(function (row) { 
                const idx = row[busField];
                if (idx >= 0 && idx < busCount) busComponentCounts[idx]++;
            });
        };
        // External grids are placed above the bus, not in the component grid
        countBusComponents(generatorData.data, 1);
        countBusComponents(staticGeneratorData.data, 1);
        countBusComponents(asymmetricStaticGeneratorData.data, 1);
        countBusComponents(shuntReactorData.data, 0);
        countBusComponents(loadData.data, 1);
        countBusComponents(asymmetricLoadData.data, 1);
        countBusComponents(wardData.data, 1);
        countBusComponents(extendedWardData.data, 1);
        countBusComponents(motorData.data, 1);
        countBusComponents(storageData.data, 1);
        countBusComponents(svcData.data, 1);

        // === Placement parameters ===
        // Result boxes: bus=65x72, component=60x40, line=70x80
        // Each component needs enough room for its symbol + result box side by side
        const componentCellWidth = 140;
        const componentsPerRow = 3;
        const startX = x + 500;
        const startY = y + 120;

        // Group buses by voltage level, EXCLUDING filter buses
        const voltageGroups = {};
        for (let index = 0; index < busData.data.length; index++) {
            if (filterBusSet.has(index)) continue;
            const bus = busData.data[index];
            const [name, vn_kv, type, inService] = bus;
            const voltage = parseFloat(vn_kv);
            if (!voltageGroups[voltage]) voltageGroups[voltage] = [];
            voltageGroups[voltage].push({index, name, voltage});
        }

        const sortedVoltages = Object.keys(voltageGroups).map(v => parseFloat(v)).sort((a, b) => b - a);

        // Order buses within each level by BFS through line connections
        function orderBusesByConnectivity(busesAtLevel) {
            if (busesAtLevel.length <= 1) return busesAtLevel;

            const levelBusIndices = new Set(busesAtLevel.map(b => b.index));
            const adj = {};
            busesAtLevel.forEach(b => { adj[b.index] = []; });

            lineData.data.forEach(line => {
                const [lname, lst, fb, tb] = line;
                if (levelBusIndices.has(fb) && levelBusIndices.has(tb)) {
                    adj[fb].push(tb);
                    adj[tb].push(fb);
                }
            });

            // Prefer to start from the external grid bus
            let startBus = busesAtLevel[0].index;
            for (const eg of externalGridData.data) {
                if (levelBusIndices.has(eg[1])) { startBus = eg[1]; break; }
            }

            const visited = new Set();
            const ordered = [];
            const queue = [startBus];
            visited.add(startBus);

            while (queue.length > 0) {
                const current = queue.shift();
                const busInfo = busesAtLevel.find(b => b.index === current);
                if (busInfo) ordered.push(busInfo);
                for (const neighbor of (adj[current] || [])) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            busesAtLevel.forEach(b => {
                if (!visited.has(b.index)) ordered.push(b);
            });
            return ordered;
        }

        // Calculate max filter chain depth per voltage level
        const voltageFilterDepth = {};
        const voltageFilterWidth = {};
        for (const rootBusStr of Object.keys(filterChainsMap)) {
            const rootBus = parseInt(rootBusStr);
            const chains = filterChainsMap[rootBus];
            const rootVoltage = parseFloat(busData.data[rootBus][1]);
            const maxDepth = Math.max(...chains.map(c => c.length));
            const numChains = chains.length;
            if (!voltageFilterDepth[rootVoltage] || voltageFilterDepth[rootVoltage] < maxDepth) {
                voltageFilterDepth[rootVoltage] = maxDepth;
            }
            voltageFilterWidth[rootVoltage] = (voltageFilterWidth[rootVoltage] || 0) + numChains;
        }

        const busPositions = [];
        for (let i = 0; i < busCount; i++) {
            busPositions[i] = {x: 0, y: 0};
        }

        // Place buses level by level with DYNAMIC vertical spacing
        let currentY = startY;

        sortedVoltages.forEach((voltage, levelIndex) => {
            const orderedBuses = orderBusesByConnectivity(voltageGroups[voltage]);
            voltageGroups[voltage] = orderedBuses;

            const levelY = currentY;

            // Dynamic bus spacing: based on max component count at this level
            let maxCompsAtLevel = 0;
            orderedBuses.forEach(function (busInfo) {
                if (busComponentCounts[busInfo.index] > maxCompsAtLevel)
                    maxCompsAtLevel = busComponentCounts[busInfo.index];
            });
            const cols = Math.min(maxCompsAtLevel, componentsPerRow);
            const neededWidth = cols * componentCellWidth + 100;
            const busSpacing = Math.max(380, neededWidth + 80);

            const totalWidth = (orderedBuses.length - 1) * busSpacing;
            const levelStartX = startX - (totalWidth / 2);

            orderedBuses.forEach((busInfo, busIndex) => {
                busPositions[busInfo.index] = {
                    x: levelStartX + (busIndex * busSpacing),
                    y: levelY
                };
            });

            // Dynamic vertical spacing: account for component rows + filter chains
            const maxRows = Math.ceil(maxCompsAtLevel / componentsPerRow);
            const filterDepth = voltageFilterDepth[voltage] || 0;
            const chainSpace = filterDepth * 170;
            const componentSpace = 180 + maxRows * 100;
            currentY += Math.max(550, chainSpace + componentSpace + 150);
        });

        // Transformer alignment: move LV bus under HV bus (don't touch HV position)
        // Track which LV buses have been repositioned to detect collisions
        const lvBusRepositioned = new Set();
        transformerData.data.forEach((trafo) => {
            const [name, std_type, hv_bus_no, lv_bus_no] = trafo;

            if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                if (!filterBusSet.has(hv_bus_no) && !filterBusSet.has(lv_bus_no)) {
                    const hvVoltage = parseFloat(busData.data[hv_bus_no][1]);
                    const lvVoltage = parseFloat(busData.data[lv_bus_no][1]);
                    if (hvVoltage !== lvVoltage) {
                        let targetX = busPositions[hv_bus_no].x;
                        // Shift if another LV bus already occupies this X at the same Y
                        let collision = true;
                        while (collision) {
                            collision = false;
                            for (const prevBus of lvBusRepositioned) {
                                if (prevBus !== lv_bus_no &&
                                    Math.abs(busPositions[prevBus].x - targetX) < 280 &&
                                    Math.abs(busPositions[prevBus].y - busPositions[lv_bus_no].y) < 50) {
                                    targetX += 320;
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        busPositions[lv_bus_no].x = targetX;
                        lvBusRepositioned.add(lv_bus_no);
                    }
                }
            }
        });

        // Position filter chain buses as vertical branches below their root bus
        const chainYSpacing = 250;
        const chainXSpacing = 350;

        for (const rootBusStr of Object.keys(filterChainsMap)) {
            const rootBus = parseInt(rootBusStr);
            const chains = filterChainsMap[rootBus];
            const rootPos = busPositions[rootBus];

            const totalChainsWidth = (chains.length - 1) * chainXSpacing;
            const chainsStartX = rootPos.x - totalChainsWidth / 2;

            chains.forEach((chain, chainIndex) => {
                const chainX = chainsStartX + chainIndex * chainXSpacing;
                chain.forEach((busNo, depth) => {
                    busPositions[busNo] = {
                        x: chainX,
                        y: rootPos.y + (depth + 1) * chainYSpacing
                    };
                });
            });
        }

        // Per-bus component slot tracker – returns {x, y} in a grid centered under the bus
        const busComponentSlots = {};
        function getNextComponentSlot(busNo) {
            if (busComponentSlots[busNo] === undefined) busComponentSlots[busNo] = 0;
            return busComponentSlots[busNo]++;
        }
        function getComponentPosition(busVertex, busNo) {
            const slot = getNextComponentSlot(busNo);
            const totalComps = busComponentCounts[busNo] || 1;
            const cols = Math.min(totalComps, componentsPerRow);
            const col = slot % cols;
            const row = Math.floor(slot / cols);
            const busCenter = busVertex.geometry.x + busVertex.geometry.width / 2;
            const gridStartX = busCenter - (cols - 1) * componentCellWidth / 2;
            return {
                x: gridStartX + col * componentCellWidth,
                y: busVertex.geometry.y + 160 + row * 100
            };
        }

        // Per-bus connection point tracker — distributes edges across the bus bar
        const busConnCounters = {};
        function getNextBusConnX(busNo) {
            if (busConnCounters[busNo] === undefined) busConnCounters[busNo] = 0;
            const slot = busConnCounters[busNo]++;
            const x = 0.1 + (slot % 16) * 0.05;
            return x.toFixed(2);
        }

            // Create vertices using the calculated positions
            console.log(`Creating ${busData.data.length} buses...`);
            busData.data.forEach((bus, index) => {
                const [name, vn_kv, type, inService] = bus;

                // Get the optimized position for this bus
                const vertexX = busPositions[index].x;
                const vertexY = busPositions[index].y;

                console.log(`  Bus ${index}: ${name} at (${vertexX}, ${vertexY}), ${vn_kv} kV`);

                // Bus style definition with 20 connection points
                const busStyle = "line;strokeWidth=2;html=1;shapeELXXX=Bus;points=[[0,0.5],[0.05,0.5,0],[0.1,0.5,0],[0.15,0.5,0],[0.2,0.5,0],[0.25,0.5,0],[0.3,0.5,0],[0.35,0.5,0],[0.4,0.5,0],[0.45,0.5,0],[0.5,0.5,0],[0.55,0.5,0],[0.6,0.5,0],[0.65,0.5,0],[0.7,0.5,0],[0.75,0.5,0],[0.8,0.5,0],[0.85,0.5,0],[0.9,0.5,0],[0.95,0.5,0]]";

                // Widen bus bar to cover the component grid beneath it
                const nComps = busComponentCounts[index] || 0;
                const busCols = Math.min(nComps, componentsPerRow);
                const busWidth = Math.max(200, busCols * componentCellWidth + 60);

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    busWidth,
                    10,
                    busStyle
                );

                configureBusAttributes(grafka, vertex, {
                    name: `${name}`,
                    vn_kv: `${vn_kv}`
                });
            });

            // Track placed transformer positions to avoid overlap
            const placedTrafoPositions = [];
            const trafoSpacing = 60;

            // Now place transformers based on the positions of connected buses
            transformerData.data.forEach((trafo, index) => {
                const [name, std_type, hv_bus_no, lv_bus_no, sn_mva, vn_hv_kv, vn_lv_kv,
                    vk_percent, vkr_percent, pfe_kw, i0_percent, shift_degree,
                    tap_side, tap_neutral, tap_min, tap_max, tap_step_percent,
                    tap_step_degree, tap_pos, tap_phase_shifter, parallel, df, in_service] = trafo;
                const vector_group = trafo.length > 24 ? trafo[24] : undefined;

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

                    // Place transformer between the HV and LV buses, offset if overlapping
                    let vertexX = (hvX + lvX) / 2;
                    const vertexY = (hvY + lvY) / 2;

                    // Shift horizontally if another transformer already occupies this position
                    let shiftCount = 0;
                    for (var pi = 0; pi < placedTrafoPositions.length; pi++) {
                        var prev = placedTrafoPositions[pi];
                        if (Math.abs(prev.x - vertexX) < trafoSpacing && Math.abs(prev.y - vertexY) < 40) {
                            shiftCount++;
                        }
                    }
                    vertexX += shiftCount * trafoSpacing;
                    placedTrafoPositions.push({ x: vertexX, y: vertexY });

                    // Use transformer symbol style
                    const trafoStyle = "shapeELXXX=Transformer; verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;strokeWidth=1;shape=mxgraph.electrical.signal_sources.current_source;";

                    // Insert the transformer vertex
                    const vertex = grafka.insertVertex(
                        parent,
                        null,
                        ``,
                        vertexX,
                        vertexY,
                        40,  // width
                        60,  // height
                        trafoStyle
                    );

                    // Configure transformer attributes
                    const trafoAttrs = {
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
                    };
                    if (vector_group != null) {
                        trafoAttrs.vector_group = vector_group;
                    }
                    configureTransformerAttributes(grafka, vertex, trafoAttrs);

                    // Create edges connecting transformer to buses
                    const hvConnX = getNextBusConnX(hv_bus_no);
                    const lvConnX = getNextBusConnX(lv_bus_no);
                    const edgeStyleHV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${hvConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    const edgeStyleLV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${lvConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;

                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex, edgeStyleLV);
                } else {
                    console.warn(`Could not place transformer ${name}: One or both bus vertices not found`, {
                        hv_bus: hv_bus_name,
                        lv_bus: lv_bus_name,
                        hvBusVertex: !!hvBusVertex,
                        lvBusVertex: !!lvBusVertex
                    });
                }
            });

            
            // Channel counter per Y-level band to stagger line routing heights
            const levelLineChannels = {};
            const lineChannelSpacing = 30;
            const lineBaseOffset = 35;

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
                    const fromConnX = getNextBusConnX(from_bus);
                    const toConnX = getNextBusConnX(to_bus);

                    // Assign a unique channel to stagger same-level lines vertically
                    const minBusY = Math.min(fromBusVertex.geometry.y, toBusVertex.geometry.y);
                    const levelKey = Math.round(minBusY / 50) * 50;
                    if (levelLineChannels[levelKey] === undefined) levelLineChannels[levelKey] = 0;
                    const channel = levelLineChannels[levelKey]++;
                    const routeY = minBusY - lineBaseOffset - channel * lineChannelSpacing;

                    // Absolute X positions of connection points on bus bars
                    const fromAbsX = fromBusVertex.geometry.x + fromBusVertex.geometry.width * parseFloat(fromConnX);
                    const toAbsX = toBusVertex.geometry.x + toBusVertex.geometry.width * parseFloat(toConnX);

                    let lineStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=${fromConnX};exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${toConnX};entryY=0;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=Line`;

                    // Insert the edge for the line
                    const edge = grafka.insertEdge(
                        parent,
                        null,
                        name,
                        fromBusVertex,
                        toBusVertex,
                        lineStyle
                    );

                    // Add waypoints to route through staggered channel above the buses
                    var edgeGeo = grafka.getCellGeometry(edge);
                    if (edgeGeo) {
                        edgeGeo = edgeGeo.clone();
                        edgeGeo.points = [
                            new mxPoint(fromAbsX, routeY),
                            new mxPoint(toAbsX, routeY)
                        ];
                        grafka.getModel().setGeometry(edge, edgeGeo);
                    }

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

                // Position external grid above the bus
                const vertexX = busVertex.geometry.x;
                const vertexY = busVertex.geometry.y - 120;

                const styleExternalGrid = "verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=externalGrid;shapeELXXX=External Grid"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    70,  // width
                    58,   // height
                    styleExternalGrid
                );
                configureExternalGridAttributes(grafka, vertex, {                    
                    name: `${name}`,
                    vm_pu: `${vm_pu}`,
                    va_degree: `${va_degree}`,
                    slack_weight: `${slack_weight}`,
                    in_service: `${in_service}`
                })

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            generatorData.data.forEach((generator, index) => {
                const [name, bus_no, p_mw, vm_pu, sn_mva, min_q_mvar, max_q_mvar, scaling, slack, in_service, slack_weight, type] = generator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;

                const styleGenerator = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.ac_source;shapeELXXX=Generator"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    45,  // width
                    45,   // height
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

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            staticGeneratorData.data.forEach((staticgenerator, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, scaling, in_service, type, current_source] = staticgenerator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;

                const styleStaticGenerator = "verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.rot_mech.synchro;shapeELXXX=Static Generator"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    45,  // width
                    45,   // height
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

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            asymmetricStaticGeneratorData.data.forEach((asymmetricstaticgenerator, index) => {
                const [name, bus_no, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar, sn_mva, scaling, in_service, type, current_source] = asymmetricstaticgenerator;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;

                const styleAsymmetricStaticGenerator = "verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.rot_mech.asymmetric;shapeELXXX=Asymmetric Static Generator"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    45,  // width
                    45,   // height
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

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
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
                const vertexX = hvBusVertex.geometry.x + 60//(lv_bus_no * 150);  // Position based on lv_bus index
                const vertexY = lvBusVertex.geometry.y - 120;  // Position between buses


                // Use transformer symbol style
                const threewindingtrafoStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.inductors.pot_trans_3_windings;shapeELXXX=Three Winding Transformer";

                // Insert the transformer vertex
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,  // Center between the two buses
                    vertexY,
                    40,  // width
                    60,  // height
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
                if (hvBusVertex) {
                    const connX = getNextBusConnX(hv_bus_no);
                    const edgeStyleHV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
                }
                if (mvBusVertex) {
                    const connX = getNextBusConnX(mv_bus_no);
                    const edgeStyleMV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, mvBusVertex, edgeStyleMV);
                }
                if (lvBusVertex) {
                    const connX = getNextBusConnX(lv_bus_no);
                    const edgeStyleLV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, lvBusVertex, edgeStyleLV);
                }
            });
            shuntReactorData.data.forEach((shuntreactor, index) => {
                const [bus_no, name, q_mvar, p_mw, vn_kv, step, max_step, in_service] = shuntreactor;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleShuntReactor = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Shunt Reactor"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
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
                const spectrum = load[9], spectrum_csv = load[10], pctSeriesRL = load[11], puXharm = load[12], XRharm = load[13], conn = load[14];

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;

                const loadStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Load"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
                    loadStyle
                );
                const loadOpts = {
                    name: `${name}`,
                    p_mw: `${p_mw}`,
                    q_mvar: `${q_mvar}`,
                    const_z_percent: `${const_z_percent}`,
                    const_i_percent: `${const_i_percent}`,
                    sn_mva: `${sn_mva}`,
                    scaling: `${scaling}`,
                    type: `${type}`
                };
                if (spectrum != null) loadOpts.spectrum = `${spectrum}`;
                if (spectrum_csv != null) loadOpts.spectrum_csv = `${spectrum_csv}`;
                if (pctSeriesRL != null) loadOpts.pctSeriesRL = `${pctSeriesRL}`;
                if (conn != null) loadOpts.conn = `${conn}`;
                if (puXharm != null) loadOpts.puXharm = `${puXharm}`;
                if (XRharm != null) loadOpts.XRharm = `${XRharm}`;
                configureLoadAttributes(grafka, vertex, loadOpts)

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            asymmetricLoadData.data.forEach((asymmetricload, index) => {
                const [name, bus_no, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar, sn_mva, scaling, in_service, type] = asymmetricload;

                let bus = busData.data[bus_no];
                let bus_name = bus[0];

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;

                const asymmetricloadStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Asymmetric Load"

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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

                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            }
            );
            console.log(`Processing ${impedanceData.data.length} impedances...`);
            impedanceData.data.forEach((impedance, index) => {
                const [name, from_bus_no, to_bus_no, rft_pu, xft_pu, rtf_pu, xtf_pu, sn_mva, in_service] = impedance;
                const fromBus = busData.data[from_bus_no];
                const fromBusName = fromBus[0];
                const toBus = busData.data[to_bus_no];
                const toBusName = toBus[0];

                console.log(`Impedance ${index}: ${name} from ${fromBusName} to ${toBusName}`);

                const fromBusVertex = findVertexByBusId(grafka, parent, fromBusName);
                const toBusVertex = findVertexByBusId(grafka, parent, toBusName);

                if (fromBusVertex && toBusVertex) {
                    console.log(`  ✓ Drawing impedance ${name} as vertex`);

                    const midX = (fromBusVertex.geometry.x + toBusVertex.geometry.x) / 2;
                    // Only offset Y when buses are at the same level (horizontal connection)
                    const sameLevel = Math.abs(fromBusVertex.geometry.y - toBusVertex.geometry.y) < 30;
                    const midY = (fromBusVertex.geometry.y + toBusVertex.geometry.y) / 2 + (sameLevel ? 50 : 0);

                    let impedanceStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.impedance;shapeELXXX=Impedance";

                    const vertex = grafka.insertVertex(
                        parent,
                        null,
                        ``,
                        midX,
                        midY,
                        30,
                        20,
                        impedanceStyle
                    );

                    configureImpedanceAttributes(grafka, vertex, {
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

                    const fromConnX = getNextBusConnX(from_bus_no);
                    const toConnX = getNextBusConnX(to_bus_no);
                    const edgeStyleFrom = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${fromConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    const edgeStyleTo = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${toConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, fromBusVertex, edgeStyleFrom);
                    grafka.insertEdge(parent, null, "", vertex, toBusVertex, edgeStyleTo);
                } else {
                    console.warn(`  ✗ Could not create impedance ${name}: Bus vertices not found`, {
                        from_bus: fromBusName,
                        to_bus: toBusName,
                        fromBusVertex: !!fromBusVertex,
                        toBusVertex: !!toBusVertex
                    });
                }
            });
            wardData.data.forEach((ward, index) => {
                const [name, bus_no, ps_mw, qs_mvar, qz_mvar, pz_mw, in_service] = ward;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleWard = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Ward"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            extendedWardData.data.forEach((extendedward, index) => {
                const [name, bus_no, ps_mw, qs_mvar, qz_mvar, pz_mw, r_ohm, x_ohm, vm_pu, slack_weight, in_service] = extendedward;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleExtendedWard = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.extended_ward;shapeELXXX=Extended Ward"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            motorData.data.forEach((motor, index) => {
                const [name, bus_no, pn_mech_mw, loading_percent, cos_phi, cos_phi_n, efficiency_percent, efficiency_n_percent, lrc_pu, vn_kv, scaling, in_service, rx] = motor;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleMotor = "shapeELXXX=Motor;verticalLabelPosition=middle;shadow=0;dashed=0;align=center;html=1;verticalAlign=middle;strokeWidth=1;shape=ellipse;fontSize=32;perimeter=ellipsePerimeter;"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            storageData.data.forEach((storage, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, soc_percent, min_e_mwh, max_e_mwh, scaling, in_service, type] = storage;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleStorage = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.multicell_battery;shapeELXXX=Storage"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            svcData.data.forEach((svc, index) => {
                const [name, bus_no, x_l_ohm, x_cvar_ohm, set_vm_pu, thyristor_firing_angle_degree, controllable, in_service, min_angle_degree, max_angle_degree, type] = svc;
                let bus = busData.data[bus_no];
                let bus_name = bus[0];
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const pos = getComponentPosition(busVertex, bus_no);
                const vertexX = pos.x;
                const vertexY = pos.y;
                const styleSVC = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.svc;shapeELXXX=SVC"
                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    30,  // width
                    20,   // height
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
                if (busVertex) {
                    const connX = getNextBusConnX(bus_no);
                    const edgeStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${connX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
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

                const vertexX = hvBusVertex.geometry.x + 60//(lv_bus_no * 150);  // Position based on lv_bus index
                const vertexY = lvBusVertex.geometry.y - 120;  // Position between buses

                const tcscStyle = "pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.tcsc;shapeELXXX=TCSC";

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,  // Center between the two buses
                    vertexY,
                    40,  // width
                    60,  // height
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
                if (hvBusVertex && lvBusVertex) {
                    const fromConnX = getNextBusConnX(from_bus_no);
                    const toConnX = getNextBusConnX(to_bus_no);
                    const edgeStyleHV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${fromConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    const edgeStyleLV = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${toConnX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`;
                    grafka.insertEdge(parent, null, "", vertex, hvBusVertex, edgeStyleHV);
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

            // Post-processing: resolve overlapping vertices
            resolveOverlapsInGraph(grafka, parent, { margin: 20, maxIterations: 60 });

        } catch (error) {
            console.error('Error during vertex insertion:', error);
        } finally {
            grafka.getModel().endUpdate();

            // Ensure every bus has a result placeholder
            if (typeof window.createBusResultPlaceholder === 'function') {
                var allCells = grafka.getChildCells(parent, true, false);
                for (var ri = 0; ri < allCells.length; ri++) {
                    var rc = allCells[ri];
                    if (rc.style && rc.style.indexOf('shapeELXXX=Bus') !== -1) {
                        window.createBusResultPlaceholder(grafka, rc);
                    }
                }
            }
        }

    }


// Debounced version of useDataToInsertOnGraph
function useDataToInsertOnGraph(grafka, a, target, point) {
    waitForData().then(data => {
        debouncedComponentInsertion(grafka, a, target, point, data);
    });
}