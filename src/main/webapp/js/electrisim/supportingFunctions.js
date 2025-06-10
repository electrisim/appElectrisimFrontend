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
function waitForData() {
    return new Promise((resolve, reject) => {
        function checkData() {
            if (globalPandaPowerData) {
                resolve(globalPandaPowerData);
            } else {
                // Check again after a short delay
                setTimeout(checkData, 100);
            }
        }
        checkData();
    });
}


// Helper function to find a bus vertex by its ID
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

//używane tylko dla PandaPowerNet
function useDataToInsertOnGraph(grafka, a, target, point) {
    waitForData().then(data => {

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


            // First pass - identify bus-transformer connections
            const busCount = busData.data.length;
            // Properly initialize the busToTransformerMap with empty arrays for each bus
            const busToTransformerMap = [];
            for (let i = 0; i < busCount; i++) {
                busToTransformerMap[i] = [];
            }
            const trafoCount = transformerData.data.length;

            // Build mapping of buses to their connected transformers
            transformerData.data.forEach((trafo, trafoIndex) => {
                const [name, std_type, hv_bus_no, lv_bus_no] = trafo;

                // Make sure the bus indices exist in the map before pushing
                if (hv_bus_no < busCount && hv_bus_no >= 0) {
                    busToTransformerMap[hv_bus_no].push(trafoIndex);
                } else {
                    console.warn(`Invalid HV bus index ${hv_bus_no} for transformer ${trafoIndex}`);
                }

                if (lv_bus_no < busCount && lv_bus_no >= 0) {
                    busToTransformerMap[lv_bus_no].push(trafoIndex);
                } else {
                    console.warn(`Invalid LV bus index ${lv_bus_no} for transformer ${trafoIndex}`);
                }
            });

            // Create adjacency matrix for bus-to-bus connections (through lines)
            const busAdjacencyMatrix = [];
            for (let i = 0; i < busCount; i++) {
                busAdjacencyMatrix[i] = [];
                for (let j = 0; j < busCount; j++) {
                    busAdjacencyMatrix[i][j] = 0;
                }
            }

            // Build the adjacency matrix from line data
            lineData.data.forEach(line => {
                const [name, std_type, from_bus, to_bus] = line;

                // Verify indices are valid before setting in matrix
                if (from_bus < busCount && from_bus >= 0 && to_bus < busCount && to_bus >= 0) {
                    busAdjacencyMatrix[from_bus][to_bus] = 1;
                    busAdjacencyMatrix[to_bus][from_bus] = 1; // Bidirectional connection
                } else {
                    console.warn(`Invalid bus indices in line: from=${from_bus}, to=${to_bus}`);
                }
            });

            // Also consider buses connected through transformers as adjacent
            transformerData.data.forEach(trafo => {
                const [name, std_type, hv_bus_no, lv_bus_no] = trafo;

                // Verify indices are valid before setting in matrix
                if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                    busAdjacencyMatrix[hv_bus_no][lv_bus_no] = 2; // Weight transformer connections higher
                    busAdjacencyMatrix[lv_bus_no][hv_bus_no] = 2;
                } else {
                    console.warn(`Invalid bus indices in transformer: hv=${hv_bus_no}, lv=${lv_bus_no}`);
                }
            });

            // Force-directed placement parameters
            const width = Math.ceil(Math.sqrt(busCount)) * 250;
            const height = Math.ceil(Math.sqrt(busCount)) * 250;
            const iterations = 50; // More iterations for better optimization
            const k = 150; // Optimal distance between vertices

            // Initialize positions randomly
            const busPositions = [];
            for (let i = 0; i < busCount; i++) {
                busPositions[i] = {
                    x: x + Math.random() * width,
                    y: y + Math.random() * height,
                    dx: 0,
                    dy: 0
                };
            }

            // Run force-directed algorithm
            for (let iter = 0; iter < iterations; iter++) {
                // Reset forces
                busPositions.forEach(pos => {
                    pos.dx = 0;
                    pos.dy = 0;
                });

                // Calculate repulsive forces (all buses repel each other)
                for (let i = 0; i < busCount; i++) {
                    for (let j = i + 1; j < busCount; j++) {
                        const dx = busPositions[j].x - busPositions[i].x;
                        const dy = busPositions[j].y - busPositions[i].y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                        // Apply inverse square repulsive force
                        const repulsiveForce = k * k / distance;
                        const fx = dx / distance * repulsiveForce;
                        const fy = dy / distance * repulsiveForce;

                        busPositions[i].dx -= fx;
                        busPositions[i].dy -= fy;
                        busPositions[j].dx += fx;
                        busPositions[j].dy += fy;
                    }
                }

                // Calculate attractive forces (connected buses attract each other)
                for (let i = 0; i < busCount; i++) {
                    for (let j = i + 1; j < busCount; j++) {
                        if (busAdjacencyMatrix[i][j]) {
                            const connectionStrength = busAdjacencyMatrix[i][j]; // 1 for lines, 2 for transformers
                            const dx = busPositions[j].x - busPositions[i].x;
                            const dy = busPositions[j].y - busPositions[i].y;
                            const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                            // Apply linear attractive force (stronger for transformer connections)
                            const attractiveForce = distance * distance / k * connectionStrength;
                            const fx = dx / distance * attractiveForce;
                            const fy = dy / distance * attractiveForce;

                            busPositions[i].dx += fx;
                            busPositions[i].dy += fy;
                            busPositions[j].dx -= fx;
                            busPositions[j].dy -= fy;
                        }
                    }
                }

                // Extra attractive force for buses connected to the same transformer
                for (let t = 0; t < trafoCount; t++) {
                    const trafo = transformerData.data[t];
                    const [name, std_type, hv_bus_no, lv_bus_no] = trafo;

                    // Check that indices are valid before processing
                    if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                        // Extra strong attraction between HV and LV buses of the same transformer
                        const dx = busPositions[lv_bus_no].x - busPositions[hv_bus_no].x;
                        const dy = busPositions[lv_bus_no].y - busPositions[hv_bus_no].y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                        // Apply stronger attractive force for transformer-connected buses
                        const attractiveForce = distance * distance / k * 3; // Stronger attraction
                        const fx = dx / distance * attractiveForce;
                        const fy = dy / distance * attractiveForce;

                        busPositions[hv_bus_no].dx += fx;
                        busPositions[hv_bus_no].dy += fy;
                        busPositions[lv_bus_no].dx -= fx;
                        busPositions[lv_bus_no].dy -= fy;
                    }
                }

                // Update positions with calculated forces (with damping)
                const damping = 0.85;
                const coolDownFactor = 1 - (iter / iterations); // Gradually reduce movement

                busPositions.forEach(pos => {
                    // Limit maximum movement per iteration
                    const maxMovement = 40 * coolDownFactor;
                    const moveMagnitude = Math.sqrt(pos.dx * pos.dx + pos.dy * pos.dy);

                    if (moveMagnitude > maxMovement) {
                        const scale = maxMovement / moveMagnitude;
                        pos.dx *= scale;
                        pos.dy *= scale;
                    }

                    pos.x += pos.dx * damping * coolDownFactor;
                    pos.y += pos.dy * damping * coolDownFactor;

                    // Ensure positions stay within bounds
                    pos.x = Math.max(x + 80, Math.min(x + width - 80, pos.x));
                    pos.y = Math.max(y + 80, Math.min(y + height - 80, pos.y));
                });
            }

            // Create vertices using the calculated positions
            busData.data.forEach((bus, index) => {
                const [name, vn_kv, type, zone, inService] = bus;

                // Get the optimized position for this bus
                const vertexX = busPositions[index].x;
                const vertexY = busPositions[index].y;

                // Bus style definition
                const busStyle = "line;strokeWidth=2;html=1;shapeELXXX=Bus;points=[[0,0.5],[0.1,0.5,0],[0.2,0.5,0],[0.3,0.5,0],[0.4,0.5,0],[0.5,0.5,0],[0.6,0.5,0],[0.7,0.5,0],[0.9,0.5,0],[1,0.5]]";

                const vertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    vertexX,
                    vertexY,
                    160,   // width 
                    10,    // height
                    busStyle  // style parameter
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

                hv_bus = busData.data[hv_bus_no];
                hv_bus_name = hv_bus[0];

                lv_bus = busData.data[lv_bus_no];
                lv_bus_name = lv_bus[0];

                // Find the vertices for the connected buses
                const hvBusVertex = findVertexByBusId(grafka, parent, hv_bus_name);
                const lvBusVertex = findVertexByBusId(grafka, parent, lv_bus_name);

                if (hvBusVertex && lvBusVertex) {
                    // Calculate the midpoint between the two buses with a slight offset
                    const hvX = hvBusVertex.geometry.x;
                    const hvY = hvBusVertex.geometry.y;
                    const lvX = lvBusVertex.geometry.x;
                    const lvY = lvBusVertex.geometry.y;

                    // Determine if buses are more horizontally or vertically arranged
                    const dx = Math.abs(hvX - lvX);
                    const dy = Math.abs(hvY - lvY);

                    let vertexX, vertexY;

                    if (dx > dy) {
                        // Buses are more horizontally arranged - place transformer between them
                        vertexX = (hvX + lvX) / 2;
                        // Place transformer slightly above the line connecting the buses
                        vertexY = (hvY + lvY) / 2 - 40;
                    } else {
                        // Buses are more vertically arranged - place transformer slightly to the side
                        vertexX = (hvX + lvX) / 2 + 60;
                        vertexY = (hvY + lvY) / 2;
                    }

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

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y - 60;  // Position over buses

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

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            generatorData.data.forEach((generator, index) => {
                const [name, bus_no, p_mw, vm_pu, sn_mva, min_q_mvar, max_q_mvar, scaling, slack, in_service, slack_weight, type] = generator;

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below bus

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

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            staticGeneratorData.data.forEach((staticgenerator, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, scaling, in_service, type, current_source] = staticgenerator;

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position above buses

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

                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";

                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }

            });
            asymmetricStaticGeneratorData.data.forEach((asymmetricstaticgenerator, index) => {
                const [name, bus_no, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar, sn_mva, scaling, in_service, type, current_source] = asymmetricstaticgenerator;

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position above buses

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

                hv_bus = busData.data[hv_bus_no]
                hv_bus_name = hv_bus[0]

                mv_bus = busData.data[mv_bus_no]
                mv_bus_name = mv_bus[0]

                lv_bus = busData.data[lv_bus_no]
                lv_bus_name = lv_bus[0]

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
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses

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

                bus = busData.data[bus_no]
                bus_name = bus[0]

                const busVertex = findVertexByBusId(grafka, parent, bus_name);

                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses

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
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            extendedWardData.data.forEach((extendedward, index) => {
                const [name, bus_no, ps_mw, qs_mvar, qz_mvar, pz_mw, r_ohm, x_ohm, vm_pu, slack_weight, in_service] = extendedward;
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            motorData.data.forEach((motor, index) => {
                const [name, bus_no, pn_mech_mw, loading_percent, cos_phi, cos_phi_n, efficiency_percent, efficiency_n_percent, lrc_pu, vn_kv, scaling, in_service, rx] = motor;
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            storageData.data.forEach((storage, index) => {
                const [name, bus_no, p_mw, q_mvar, sn_mva, soc_percent, min_e_mwh, max_e_mwh, scaling, in_service, type] = storage;
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            svcData.data.forEach((svc, index) => {
                const [name, bus_no, x_l_ohm, x_cvar_ohm, set_vm_pu, thyristor_firing_angle_degree, controllable, in_service, min_angle_degree, max_angle_degree, type] = svc;
                bus = busData.data[bus_no]
                bus_name = bus[0]
                const busVertex = findVertexByBusId(grafka, parent, bus_name);
                const vertexX = busVertex.geometry.x + 60  // Position based on bus index
                const vertexY = busVertex.geometry.y + 60;  // Position below buses
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
                const edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.3;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine";
                if (busVertex) {
                    grafka.insertEdge(parent, null, "", vertex, busVertex, edgeStyle);
                }
            });
            tcscData.data.forEach((tcsc, index) => {
                const [name, from_bus_no, to_bus_no, x_l_ohm, x_cvar_ohm, set_p_to_mw,
                    thyristor_firing_angle_degree, controllable, in_service] = tcsc;
                from_bus = busData.data[from_bus_no]
                from_bus_name = from_bus[0]

                to_bus = busData.data[to_bus_no]
                to_bus_name = to_bus[0]

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
                        lineStyle
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

    });

}