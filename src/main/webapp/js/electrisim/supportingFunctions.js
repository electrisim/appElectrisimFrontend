import {
    vertexStyleFromElectrisimSymbol,
    vertexSizeFromElectrisimSymbol,
    vertexStyleImportedBusbar,
} from './electricalSymbols.js';

/** Horizontal busbar geometry aligned with map-generated diagrams (sym-bus.svg). */
const IMPORT_BUSBAR_W = 260;
/** Match map import / thin palette bus line (see ``vertexStyleImportedBusbar``). */
const IMPORT_BUSBAR_H = 12;

/** sym-transformer.svg viewBox -45..45, -30..28 → winding axis at y = 0 → (30/58) from top */
const TRANSFORMER_EDGE_PIN_Y = 30 / 58;

/**
 * Inline AC line segment when pandapower switches reference the line (``et='l'``).
 *
 * The vertex exists purely as an attachment point for the switch's peer edge — it should be
 * visually a *continuation* of the line, not a white rectangle. We render it with ``shape=line``
 * (same as the bus / palette line) and orient it along the feeder direction.
 */
const IMPORT_LINE_VERTEX_LENGTH = 24;
const IMPORT_LINE_VERTEX_THICKNESS = 8;
const IMPORT_LINE_VERTEX_STYLE_HORIZONTAL =
    'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;' +
    'shape=line;strokeColor=#000000;strokeWidth=1;perimeter=none;rounded=0;shapeELXXX=Line';
const IMPORT_LINE_VERTEX_STYLE_VERTICAL =
    'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;' +
    'shape=line;direction=north;strokeColor=#000000;strokeWidth=1;perimeter=none;rounded=0;shapeELXXX=Line';

const IMPORT_STUB_EDGE_STYLE =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
    'exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;' +
    'shapeELXXX=NotEditableLine';

/** Pixels per pandapower ``geo`` unit (see bus import ``geo_x`` / ``geo_y``). */
const IMPORT_GEO_SCALE = 88;
/** Vertical step between BFS layers when geo is missing. */
const IMPORT_VERTICAL_FEEDER_STEP = 152;
const IMPORT_SIBLING_BUS_GAP = 170;
const IMPORT_MAX_BUSES_VERTICAL_FEEDER = 80;

/** Rotate switch / transformer symbols for geo- or BFS-based **vertical** SLD import (pins align top/bottom). */
const IMPORT_SLD_VERTICAL_ROTATION = 90;

/** Straight edges for vertical SLD — orthogonal routing draws “bracket” paths when pins are almost collinear. */
const IMPORT_VERTICAL_SLD_EDGE_BASE =
    'edgeStyle=none;rounded=0;html=1;jettySize=0;orthogonalLoop=0;jumpStyle=none;';

/** If bus centre and peer centre differ by less than this (px), treat as one vertical feeder and snap switch X to peer. */
const IMPORT_VERTICAL_COLLINEAR_X_EPS = 24;

/** Vertical SLD: distance from busbar electrical centre to first switch centre (px). */
const IMPORT_VERTICAL_SWITCH_GAP_FROM_BUS = 18;
/** Vertical SLD: extra spacing between stacked switch *cells* on the same bus side (px). */
const IMPORT_VERTICAL_SWITCH_STACK_PADDING = 6;

/**
 * Horizontal import: legacy midpoint on switch symbol (Graph uses precise pins).
 * @see Graph.js Switch constraints — pins at y = 22/40 on left/right.
 */
const SWITCH_EDGE_PIN_Y = 0.5;
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

function importGetXmlAttribute(cell, attrName) {
    if (!cell?.value?.attributes) return null;
    const attrs = cell.value.attributes;
    for (let i = 0; i < attrs.length; i++) {
        if (attrs[i].name === attrName) return attrs[i].value;
    }
    return null;
}

function importBusbarCenterXY(busVertex) {
    if (!busVertex?.geometry) return { x: 0, y: 0 };
    return {
        x: busVertex.geometry.x + IMPORT_BUSBAR_W / 2,
        y: busVertex.geometry.y + busVertex.geometry.height / 2,
    };
}

function importFindVertexByTransformerName(grafka, parent, trafoName) {
    const want = String(trafoName);
    const childCells = grafka.getChildCells(parent, true, false);
    for (let i = 0; i < childCells.length; i++) {
        const cell = childCells[i];
        if (!cell?.style || cell.edge) continue;
        const st = String(cell.style);
        if (!st.includes('shapeELXXX=Transformer') && !st.includes('shapeELXXX=Three Winding Transformer')) continue;
        const nm = importGetXmlAttribute(cell, 'name');
        if (nm != null && String(nm) === want) return cell;
    }
    return null;
}

/** Backend may emit plain indices (``"4"``) while buses use ``Bus_4`` when names are blank. */
function importFindBusVertexByPandapowerRef(grafka, parent, ref, busData) {
    if (ref == null || ref === '') return null;
    const s = String(ref).trim();
    let v = findVertexByBusId(grafka, parent, s);
    if (v) return v;
    if (/^\d+$/.test(s)) {
        v = findVertexByBusId(grafka, parent, `Bus_${s}`);
        if (v) return v;
        const idx = parseInt(s, 10);
        if (busData && busData.data && busData.data[idx]) {
            const rowName = busData.data[idx][0];
            return findVertexByBusId(grafka, parent, rowName);
        }
    }
    return null;
}

/**
 * Switch ``element`` for lines may be ``Line_0`` or bare ``"0"`` (pandapower index) after export.
 */
function importResolveLineDataRow(lineData, elementRef) {
    if (!lineData || !lineData.data) return null;
    const s = String(elementRef);
    let row = lineData.data.find((ln) => String(ln[0]) === s);
    if (row) return row;
    if (/^\d+$/.test(s)) {
        const idx = parseInt(s, 10);
        if (lineData.data[idx]) return lineData.data[idx];
        row = lineData.data.find((ln) => String(ln[0]) === `Line_${s}`);
        if (row) return row;
    }
    return null;
}

function importFindLineVertexPeer(importLineVertexByName, lineData, elementRef) {
    const s = String(elementRef);
    if (importLineVertexByName[s]) return importLineVertexByName[s];
    if (/^\d+$/.test(s) && importLineVertexByName[`Line_${s}`]) return importLineVertexByName[`Line_${s}`];
    const row = importResolveLineDataRow(lineData, elementRef);
    if (row && importLineVertexByName[String(row[0])]) return importLineVertexByName[String(row[0])];
    return null;
}

function importFindTrafoVertexForSwitch(grafka, parent, elementRef, transformerData) {
    let v = importFindVertexByTransformerName(grafka, parent, elementRef);
    if (v) return v;
    const s = String(elementRef).trim();
    if (/^\d+$/.test(s)) {
        v = importFindVertexByTransformerName(grafka, parent, `Trafo_${s}`);
        if (v) return v;
        const idx = parseInt(s, 10);
        if (transformerData && transformerData.data && transformerData.data[idx]) {
            const nm = transformerData.data[idx][0];
            return importFindVertexByTransformerName(grafka, parent, nm);
        }
    }
    return null;
}

/**
 * Bus name string as used on imported busbars (matches switch ``bus`` column after numeric resolve).
 */
function importBusNameFromSwitchRow(busNameImported, busData) {
    let busKey = String(busNameImported).trim();
    if (/^\d+$/.test(busKey) && busData?.data?.[parseInt(busKey, 10)]) {
        busKey = String(busData.data[parseInt(busKey, 10)][0]);
    }
    return busKey;
}

function importResolveTwoWTrafoRowIndex(elementRef, transformerData) {
    if (!transformerData?.data) return -1;
    const el = String(elementRef).trim();
    if (/^\d+$/.test(el)) {
        const idx = parseInt(el, 10);
        return idx >= 0 && idx < transformerData.data.length ? idx : -1;
    }
    const byName = transformerData.data.findIndex((t) => String(t[0]) === el);
    if (byName >= 0) return byName;
    const m = el.match(/^Trafo_(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return idx >= 0 && idx < transformerData.data.length ? idx : -1;
    }
    return -1;
}

function importResolveThreeWTrafoRowIndex(elementRef, trafo3wData) {
    if (!trafo3wData?.data) return -1;
    const el = String(elementRef).trim();
    if (/^\d+$/.test(el)) {
        const idx = parseInt(el, 10);
        return idx >= 0 && idx < trafo3wData.data.length ? idx : -1;
    }
    const byName = trafo3wData.data.findIndex((t) => String(t[0]) === el);
    if (byName >= 0) return byName;
    return -1;
}

/**
 * Row index → Set of bus names that already have an ``et=='t'`` / ``et=='t3'`` switch to that transformer.
 * Omitting matching trafo↔bus import edges avoids 4-way (duplicate) connections on the symbol.
 */
function importBuildTrafoSwitchBusSets(switchData, transformerData, threeWindingTransformerData, busData) {
    const twoW = [];
    const threeW = [];
    (switchData.data || []).forEach((row) => {
        if (!Array.isArray(row) || row.length < 8) return;
        const [, busNameImported, elementRef, etRaw] = row;
        const et = String(etRaw || 'l');
        if (et !== 't' && et !== 't3') return;
        const busKey = importBusNameFromSwitchRow(busNameImported, busData);
        if (et === 't') {
            const ti = importResolveTwoWTrafoRowIndex(elementRef, transformerData);
            if (ti < 0) return;
            if (!twoW[ti]) twoW[ti] = new Set();
            twoW[ti].add(busKey);
        } else {
            const ti = importResolveThreeWTrafoRowIndex(elementRef, threeWindingTransformerData);
            if (ti < 0) return;
            if (!threeW[ti]) threeW[ti] = new Set();
            threeW[ti].add(busKey);
        }
    });
    return { twoW, threeW };
}

function importCellIs2WTransformer(c) {
    if (!c?.style) return false;
    const s = String(c.style);
    return s.includes('shapeELXXX=Transformer') && !s.includes('Three Winding');
}

function importCellIs3WTransformer(c) {
    return Boolean(c?.style && String(c.style).includes('shapeELXXX=Three Winding Transformer'));
}

function importCellIsLineGraphVertex(c) {
    return Boolean(c?.style && !c.edge && String(c.style).includes('shapeELXXX=Line'));
}

/** Electrical midpoint of horizontal imported busbar. */
function importBusbarElectricalY(busVertex) {
    if (!busVertex?.geometry) return 0;
    return busVertex.geometry.y + IMPORT_BUSBAR_H / 2;
}

/**
 * Edge bus → switch: dock on busbar; enter switch at side pins (horizontal SLD) or top/bottom (vertical SLD).
 */
function importBusToSwitchEdgeStyle(busVertex, swVertex, verticalSld) {
    if (verticalSld) {
        const bcy = importBusbarElectricalY(busVertex);
        const swCy = swVertex.geometry.y + swVertex.geometry.height / 2;
        const busAbove = bcy < swCy - 3;
        // Rotated 90° CW: unrotated left-centre (0,0.5) becomes screen top-centre,
        // unrotated right-centre (1,0.5) becomes screen bottom-centre.
        // Using exactly 0.5 keeps both endpoints on the cell centre X → no horizontal jog.
        const exitX = 0.5;
        const exitY = busAbove ? 1 : 0;
        const entryX = busAbove ? 0 : 1;
        const entryY = 0.5;
        return (
            `${IMPORT_VERTICAL_SLD_EDGE_BASE}` +
            `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
            `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
        );
    }
    const bcy = importBusbarElectricalY(busVertex);
    const swCy = swVertex.geometry.y + swVertex.geometry.height / 2;
    const bcx = busVertex.geometry.x + IMPORT_BUSBAR_W / 2;
    const swcx = swVertex.geometry.x + swVertex.geometry.width / 2;
    const dy = bcy - swCy;

    let exitX = 0.5;
    let exitY = 1;
    let entryX = 0;
    let entryY = SWITCH_EDGE_PIN_Y;

    if (Math.abs(dy) <= 3) {
        if (bcx < swcx - 8) {
            exitX = 1;
            exitY = 0.5;
            entryX = 0;
            entryY = SWITCH_EDGE_PIN_Y;
        } else if (bcx > swcx + 8) {
            exitX = 0;
            exitY = 0.5;
            entryX = 1;
            entryY = SWITCH_EDGE_PIN_Y;
        } else if (dy <= 0) {
            exitY = 1;
            entryX = 0;
        } else {
            exitY = 0;
            entryX = 1;
        }
    } else if (dy < 0) {
        exitY = 1;
        entryX = 0;
    } else {
        exitY = 0;
        entryX = 1;
    }

    return (
        'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
        `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
    );
}

/**
 * Edge switch → peer: exit switch at opposite pin; enter 2W trafo on HV/LV winding points (or top/bottom when vertical).
 */
function importSwitchToPeerEdgeStyle(swVertex, peerCell, busVertex, verticalSld) {
    if (verticalSld) {
        const bcy = importBusbarElectricalY(busVertex);
        const swCy = swVertex.geometry.y + swVertex.geometry.height / 2;
        const busAbove = bcy < swCy - 3;
        // Rotated 90° CW: exit opposite side from bus → bottom of rotated switch when bus is above.
        // Local (1, 0.5) = bottom-centre after rotation; local (0, 0.5) = top-centre.
        const exitX = busAbove ? 1 : 0;
        const exitY = 0.5;

        const peerCy = peerCell.geometry.y + peerCell.geometry.height / 2;
        const peerBelow = peerCy > swCy + 2;

        let entryX = 0.5;
        let entryY = 0.5;
        if (importCellIs2WTransformer(peerCell)) {
            // Rotated trafo: local (0, 0.5) → top-centre, local (1, 0.5) → bottom-centre.
            entryX = peerBelow ? 0 : 1;
            entryY = 0.5;
        } else if (importCellIs3WTransformer(peerCell)) {
            entryX = peerBelow ? 0 : 1;
            entryY = 0.5;
        } else if (importCellIsLineGraphVertex(peerCell)) {
            entryX = 0.5;
            entryY = 0.5;
        } else {
            entryX = 0.5;
            entryY = peerBelow ? 0 : 1;
        }

        return (
            `${IMPORT_VERTICAL_SLD_EDGE_BASE}` +
            `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
            `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
        );
    }
    const bcy = importBusbarElectricalY(busVertex);
    const swCy = swVertex.geometry.y + swVertex.geometry.height / 2;
    const bcx = busVertex.geometry.x + IMPORT_BUSBAR_W / 2;
    const swcx = swVertex.geometry.x + swVertex.geometry.width / 2;
    const dy = bcy - swCy;

    let exitX = 1;
    let exitY = SWITCH_EDGE_PIN_Y;

    if (Math.abs(dy) <= 3) {
        if (bcx < swcx - 8) {
            exitX = 1;
        } else if (bcx > swcx + 8) {
            exitX = 0;
        } else if (dy <= 0) {
            exitX = 1;
        } else {
            exitX = 0;
        }
    } else if (dy < 0) {
        exitX = 1;
    } else {
        exitX = 0;
    }

    const peerCy = peerCell.geometry.y + peerCell.geometry.height / 2;
    const peerBelow = peerCy > swCy + 2;

    let entryX = 0.5;
    let entryY = 0.5;
    if (importCellIs2WTransformer(peerCell)) {
        if (peerBelow) {
            entryX = 0;
            entryY = TRANSFORMER_EDGE_PIN_Y;
        } else {
            entryX = 1;
            entryY = TRANSFORMER_EDGE_PIN_Y;
        }
    } else if (importCellIs3WTransformer(peerCell)) {
        entryX = 0.5;
        entryY = peerBelow ? 0 : 1;
    } else if (importCellIsLineGraphVertex(peerCell)) {
        entryX = 0.5;
        entryY = 0.5;
    } else {
        entryX = 0.5;
        entryY = peerBelow ? 0 : 1;
    }

    return (
        'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
        `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
    );
}

/** Trafo → bus: winding pins (horizontal SLD) or top/bottom (vertical SLD). */
function importTrafoToBusEdgeStyle(trafoVertex, busVertex, isHvWinding, verticalSld) {
    const tcy = trafoVertex.geometry.y + trafoVertex.geometry.height / 2;
    const bcy = importBusbarElectricalY(busVertex);
    const busAbove = bcy < tcy - 2;
    if (verticalSld) {
        // Rotated 90° CW: HV winding (originally left) becomes top → local (0, 0.5).
        // LV winding (originally right) becomes bottom → local (1, 0.5).
        const exitX = isHvWinding ? 0 : 1;
        const exitY = 0.5;
        const entryX = 0.5;
        const entryY = busAbove ? 1 : 0;
        return (
            `${IMPORT_VERTICAL_SLD_EDGE_BASE}` +
            `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
            `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
        );
    }
    const exitX = isHvWinding ? 0 : 1;
    const exitY = TRANSFORMER_EDGE_PIN_Y;
    const entryX = 0.5;
    const entryY = busAbove ? 1 : 0;
    return (
        'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
        `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
    );
}

/** Three-winding trafo → bus for vertical SLD (approximate top/bottom docking). */
function importTrafo3wToBusEdgeStyle(trafoVertex, busVertex) {
    const tcy = trafoVertex.geometry.y + trafoVertex.geometry.height / 2;
    const bcy = importBusbarElectricalY(busVertex);
    const busAbove = bcy < tcy - 2;
    return (
        `${IMPORT_VERTICAL_SLD_EDGE_BASE}` +
        `exitX=0.5;exitY=${busAbove ? 0 : 1};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=0.5;entryY=${busAbove ? 1 : 0};entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=NotEditableLine`
    );
}

function importResolveBusRowIndex(ref, busData) {
    if (!busData?.data) return -1;
    const s = String(ref).trim();
    if (/^\d+$/.test(s)) {
        const i = parseInt(s, 10);
        if (i >= 0 && i < busData.data.length) return i;
    }
    const byName = busData.data.findIndex((row) => String(row[0]) === s);
    return byName;
}

function importAllBusesHaveGeo(busData) {
    if (!busData?.data?.length) return false;
    for (let r = 0; r < busData.data.length; r++) {
        const row = busData.data[r];
        const gx = row.length > 4 ? row[4] : null;
        const gy = row.length > 5 ? row[5] : null;
        if (gx == null || gy == null) return false;
        const x = Number(gx);
        const y = Number(gy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    }
    return true;
}

/** Map pandapower geo coordinates to canvas (Y grows downward; geo often uses Y up). */
function importBusPositionsFromGeo(busData, anchorX, anchorY, scale) {
    const positions = [];
    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;
    for (let i = 0; i < busData.data.length; i++) {
        const gx = Number(busData.data[i][4]);
        const gy = Number(busData.data[i][5]);
        minGx = Math.min(minGx, gx);
        maxGx = Math.max(maxGx, gx);
        minGy = Math.min(minGy, gy);
        maxGy = Math.max(maxGy, gy);
    }
    const cx = (minGx + maxGx) / 2;
    const cy = (minGy + maxGy) / 2;
    for (let i = 0; i < busData.data.length; i++) {
        const gx = Number(busData.data[i][4]);
        const gy = Number(busData.data[i][5]);
        positions[i] = {
            x: anchorX + (gx - cx) * scale - IMPORT_BUSBAR_W / 2,
            y: anchorY - (gy - cy) * scale,
        };
    }
    return positions;
}

function importBuildBusAdjacencyForLayout(busCount, lineData, transformerData, switchData, busData) {
    const adj = Array.from({ length: busCount }, () => []);
    const add = (a, b) => {
        if (a < 0 || b < 0 || a >= busCount || b >= busCount || a === b) return;
        adj[a].push(b);
        adj[b].push(a);
    };
    (lineData.data || []).forEach((line) => {
        const [, , from_bus, to_bus] = line;
        add(from_bus, to_bus);
    });
    (transformerData.data || []).forEach((t) => {
        const [, , hv, lv] = t;
        add(hv, lv);
    });
    (switchData.data || []).forEach((row) => {
        if (!Array.isArray(row) || row.length < 8) return;
        if (String(row[3] || 'l') !== 'b') return;
        const u = importResolveBusRowIndex(row[1], busData);
        const v = importResolveBusRowIndex(row[2], busData);
        add(u, v);
    });
    return adj;
}

/**
 * BFS from slack bus: vertical spine for radial feeders; siblings spread on X.
 * Returns null if the graph is disconnected.
 */
function importLayoutBfsVerticalFeeder(busCount, adj, rootIdx, anchorX, anchorY, yStep, siblingGap) {
    if (rootIdx < 0 || rootIdx >= busCount) return null;
    const depth = new Array(busCount).fill(-1);
    const q = [rootIdx];
    depth[rootIdx] = 0;
    while (q.length) {
        const u = q.shift();
        const neigh = [...new Set(adj[u])].sort((a, b) => a - b);
        for (let i = 0; i < neigh.length; i++) {
            const v = neigh[i];
            if (depth[v] >= 0) continue;
            depth[v] = depth[u] + 1;
            q.push(v);
        }
    }
    if (depth.some((d) => d < 0)) return null;

    const byDepth = new Map();
    let maxD = 0;
    for (let i = 0; i < busCount; i++) {
        const d = depth[i];
        maxD = Math.max(maxD, d);
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d).push(i);
    }
    for (const [, arr] of byDepth) {
        arr.sort((a, b) => a - b);
    }

    const positions = [];
    for (let i = 0; i < busCount; i++) {
        positions.push({ x: 0, y: 0 });
    }
    for (let d = 0; d <= maxD; d++) {
        const layer = byDepth.get(d) || [];
        const n = layer.length;
        const y = anchorY + d * yStep;
        for (let j = 0; j < n; j++) {
            const busIdx = layer[j];
            const offsetX = n === 1 ? 0 : (j - (n - 1) / 2) * siblingGap;
            positions[busIdx] = {
                x: anchorX + offsetX - IMPORT_BUSBAR_W / 2,
                y,
            };
        }
    }
    return positions;
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
        let switchData = { data: [] };
        try {
            if (data._object?.switch?._object) {
                switchData = JSON.parse(data._object.switch._object);
            }
        } catch (e) {
            console.warn('Could not parse switch bundle from pandapower import:', e);
        }
        const lineNamesNeedingVertex = new Set();
        (switchData.data || []).forEach((row) => {
            if (!Array.isArray(row) || row.length < 8) return;
            const et = String(row[3] || 'l');
            if (et !== 'l') return;
            const el = String(row[2]);
            lineNamesNeedingVertex.add(el);
            if (/^\d+$/.test(el)) {
                lineNamesNeedingVertex.add(`Line_${el}`);
            }
        });
        const importLineVertexByName = Object.create(null);
        const trafoSwitchBusSets = importBuildTrafoSwitchBusSets(
            switchData,
            transformerData,
            threeWindingTransformerData,
            busData,
        );

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

        // Bus placement: pandapower geo (preferred) → vertical BFS feeder → legacy voltage bands
        const levelHeight = 200;
        const busSpacing = 180;
        const startX = x + 100;
        const startY = y + 100;
        const layoutCenterX = startX + IMPORT_BUSBAR_W / 2;

        let busPositions = null;
        let importPandapowerVerticalSld = false;

        if (importAllBusesHaveGeo(busData)) {
            busPositions = importBusPositionsFromGeo(busData, layoutCenterX, startY, IMPORT_GEO_SCALE);
            importPandapowerVerticalSld = true;
        } else if (
            busCount > 0 &&
            busCount <= IMPORT_MAX_BUSES_VERTICAL_FEEDER &&
            externalGridData &&
            Array.isArray(externalGridData.data) &&
            externalGridData.data.length > 0
        ) {
            const rootRow = externalGridData.data[0];
            const rootSlack = parseInt(String(rootRow[1]), 10);
            if (Number.isFinite(rootSlack) && rootSlack >= 0 && rootSlack < busCount) {
                const adj = importBuildBusAdjacencyForLayout(
                    busCount,
                    lineData,
                    transformerData,
                    switchData,
                    busData,
                );
                busPositions = importLayoutBfsVerticalFeeder(
                    busCount,
                    adj,
                    rootSlack,
                    layoutCenterX,
                    startY,
                    IMPORT_VERTICAL_FEEDER_STEP,
                    IMPORT_SIBLING_BUS_GAP,
                );
                if (busPositions) {
                    importPandapowerVerticalSld = true;
                }
            }
        }

        if (!busPositions) {
            const voltageGroups = {};
            for (let index = 0; index < busData.data.length; index++) {
                const bus = busData.data[index];
                const [name, vn_kv, type, inService] = bus;
                const voltage = parseFloat(vn_kv);

                if (!voltageGroups[voltage]) {
                    voltageGroups[voltage] = [];
                }
                voltageGroups[voltage].push({ index, name, voltage });
            }

            const sortedVoltages = Object.keys(voltageGroups).map((v) => parseFloat(v)).sort((a, b) => b - a);

            busPositions = [];
            for (let i = 0; i < busCount; i++) {
                busPositions[i] = { x: 0, y: 0 };
            }

            sortedVoltages.forEach((voltage, levelIndex) => {
                const busesAtLevel = voltageGroups[voltage];
                const levelY = startY + levelIndex * levelHeight;

                const totalWidth = (busesAtLevel.length - 1) * busSpacing;
                const levelStartX = startX - totalWidth / 2;

                busesAtLevel.forEach((busInfo, busIndex) => {
                    const busX = levelStartX + busIndex * busSpacing;
                    busPositions[busInfo.index] = {
                        x: busX,
                        y: levelY,
                    };
                });
            });

            transformerData.data.forEach((trafo) => {
                const [, , hv_bus_no, lv_bus_no] = trafo;

                if (hv_bus_no < busCount && hv_bus_no >= 0 && lv_bus_no < busCount && lv_bus_no >= 0) {
                    const hvBus = busData.data[hv_bus_no];
                    const lvBus = busData.data[lv_bus_no];
                    const hvVoltage = parseFloat(hvBus[1]);
                    const lvVoltage = parseFloat(lvBus[1]);

                    if (hvVoltage !== lvVoltage) {
                        const avgX = (busPositions[hv_bus_no].x + busPositions[lv_bus_no].x) / 2;
                        busPositions[hv_bus_no].x = avgX;
                        busPositions[lv_bus_no].x = avgX;
                    }
                }
            });
        }

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

                    let trafoStyle = vertexStyleFromElectrisimSymbol('sym-transformer', 'Transformer');
                    let [trafoW, trafoH] = vertexSizeFromElectrisimSymbol('sym-transformer', 40, 60);
                    if (importPandapowerVerticalSld) {
                        [trafoW, trafoH] = [trafoH, trafoW];
                        trafoStyle = `${trafoStyle};rotation=${IMPORT_SLD_VERTICAL_ROTATION}`;
                    }

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

                    const switchedBuses = trafoSwitchBusSets.twoW[index];
                    const skipHvEdge = switchedBuses && switchedBuses.has(String(hv_bus_name));
                    const skipLvEdge = switchedBuses && switchedBuses.has(String(lv_bus_name));

                    // Create edges connecting transformer to buses (skip winding if import adds bus–switch–trafo)
                    if (!skipHvEdge) {
                        grafka.insertEdge(
                            parent,
                            null,
                            '',
                            vertex,
                            hvBusVertex,
                            importTrafoToBusEdgeStyle(vertex, hvBusVertex, true, importPandapowerVerticalSld),
                        );
                    }
                    if (!skipLvEdge) {
                        grafka.insertEdge(
                            parent,
                            null,
                            '',
                            vertex,
                            lvBusVertex,
                            importTrafoToBusEdgeStyle(vertex, lvBusVertex, false, importPandapowerVerticalSld),
                        );
                    }
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
                    const lineAttr = {
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
                        in_service: `${in_service}`,
                    };
                    const useLineVertex =
                        lineNamesNeedingVertex.has(String(name)) ||
                        lineNamesNeedingVertex.has(String(index));
                    if (useLineVertex) {
                        const fc = importBusbarCenterXY(fromBusVertex);
                        const tc = importBusbarCenterXY(toBusVertex);
                        const useVertical =
                            importPandapowerVerticalSld ||
                            Math.abs(fc.y - tc.y) > Math.abs(fc.x - tc.x);
                        const lvW = useVertical
                            ? IMPORT_LINE_VERTEX_THICKNESS
                            : IMPORT_LINE_VERTEX_LENGTH;
                        const lvH = useVertical
                            ? IMPORT_LINE_VERTEX_LENGTH
                            : IMPORT_LINE_VERTEX_THICKNESS;
                        const lvStyle = useVertical
                            ? IMPORT_LINE_VERTEX_STYLE_VERTICAL
                            : IMPORT_LINE_VERTEX_STYLE_HORIZONTAL;
                        const mx = (fc.x + tc.x) / 2 - lvW / 2;
                        const my = (fc.y + tc.y) / 2 - lvH / 2;
                        const lineVertex = grafka.insertVertex(
                            parent,
                            null,
                            ``,
                            mx,
                            my,
                            lvW,
                            lvH,
                            lvStyle,
                        );
                        configureLineAttributes(grafka, lineVertex, lineAttr);
                        grafka.insertEdge(parent, null, '', fromBusVertex, lineVertex, IMPORT_STUB_EDGE_STYLE);
                        grafka.insertEdge(parent, null, '', lineVertex, toBusVertex, IMPORT_STUB_EDGE_STYLE);
                        importLineVertexByName[String(name)] = lineVertex;
                        importLineVertexByName[String(index)] = lineVertex;
                    } else {
                        let lineStyle;
                        lineStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;;shapeELXXX=Line";
                        const edge = grafka.insertEdge(
                            parent,
                            null,
                            name,
                            fromBusVertex,
                            toBusVertex,
                            lineStyle
                        );
                        configureLineAttributes(grafka, edge, lineAttr);
                    }
                } else {
                    console.warn(`Could not create line ${name}: Bus vertices not found`, {
                        from_bus: fromBusName,
                        to_bus: toBusName,
                        fromBusVertex,
                        toBusVertex
                    });
                }
            }); 

            // Pandapower switches: two incident edges (bus–line / bus–trafo / bus–bus) for export + layout.
            // ``verticalSwitchStackPerBusSide`` stacks switches close to the busbar in vertical SLD mode
            // (otherwise t-fraction places them mid-feeder, leaving a long disconnected-looking stub).
            const verticalSwitchStackPerBusSide = new Map();
            (switchData.data || []).forEach((row, si) => {
                if (!Array.isArray(row) || row.length < 8) return;
                const [name, bus_name, element_name, etRaw, closed, type, z_ohm, in_ka] = row;
                const et = String(etRaw || 'l');
                const busVertex = importFindBusVertexByPandapowerRef(grafka, parent, bus_name, busData);
                if (!busVertex) {
                    console.warn(`Could not place switch ${name}: bus "${bus_name}" not found`);
                    return;
                }
                let [swW, swH] = vertexSizeFromElectrisimSymbol('sym-switch', 36, 42);
                let swStyle = vertexStyleFromElectrisimSymbol('sym-switch', 'Switch');
                if (importPandapowerVerticalSld) {
                    [swW, swH] = [swH, swW];
                    swStyle = `${swStyle};rotation=${IMPORT_SLD_VERTICAL_ROTATION}`;
                }

                let peerCell = null;
                if (et === 'l') {
                    peerCell = importFindLineVertexPeer(importLineVertexByName, lineData, element_name);
                } else if (et === 't' || et === 't3') {
                    peerCell = importFindTrafoVertexForSwitch(
                        grafka,
                        parent,
                        element_name,
                        transformerData,
                    );
                } else if (et === 'b') {
                    peerCell = importFindBusVertexByPandapowerRef(grafka, parent, element_name, busData);
                }

                const B = importBusbarCenterXY(busVertex);
                let swCx;
                let swCy;
                if (!peerCell) {
                    console.warn(`Could not place switch ${name}: peer for et=${et} element "${element_name}" not found — using single-bus overlay`);
                    const bx = busVertex.geometry.x;
                    const by = busVertex.geometry.y;
                    const topLX = bx + IMPORT_BUSBAR_W / 2 - swW / 2 + 48 + (si % 4) * 46;
                    const topLY = by - 60 - Math.floor(si / 4) * 52;
                    swCx = topLX + swW / 2;
                    swCy = topLY + swH / 2;
                } else {
                    let Px;
                    let Py;
                    if (peerCell.edge) {
                        const g = peerCell.geometry;
                        Px = g.x + g.width / 2;
                        Py = g.y + g.height / 2;
                    } else {
                        const g = peerCell.geometry;
                        Px = g.x + g.width / 2;
                        Py = g.y + g.height / 2;
                    }
                    let t = et === 'b' ? 0.5 : 0.34;
                    if (et === 'l') {
                        const lineRow = importResolveLineDataRow(lineData, element_name);
                        if (lineRow) {
                            const [, , fbIdx, tbIdx] = lineRow;
                            const fbNm = busData.data[fbIdx][0];
                            const tbNm = busData.data[tbIdx][0];
                            if (String(bus_name) === String(fbNm)) t = 0.26;
                            else if (String(bus_name) === String(tbNm)) t = 0.26;
                        }
                    } else if (et === 't' || et === 't3') {
                        t = 0.32;
                    }
                    swCx = B.x + t * (Px - B.x);
                    swCy = B.y + t * (Py - B.y);
                    if (importPandapowerVerticalSld && Math.abs(B.x - Px) <= IMPORT_VERTICAL_COLLINEAR_X_EPS) {
                        swCx = Px;
                    }
                    if (importPandapowerVerticalSld) {
                        const sideKey = `${busVertex.id || ''}|${String(bus_name)}|${Py > B.y ? 'below' : 'above'}`;
                        const stackIdx = verticalSwitchStackPerBusSide.get(sideKey) || 0;
                        verticalSwitchStackPerBusSide.set(sideKey, stackIdx + 1);
                        const sign = Py > B.y ? 1 : -1;
                        const firstCenterOffset = swH / 2 + IMPORT_VERTICAL_SWITCH_GAP_FROM_BUS;
                        const stackStep = swH + IMPORT_VERTICAL_SWITCH_STACK_PADDING;
                        swCx = B.x;
                        swCy = B.y + sign * (firstCenterOffset + stackIdx * stackStep);
                    }
                }

                const swVertex = grafka.insertVertex(
                    parent,
                    null,
                    ``,
                    swCx - swW / 2,
                    swCy - swH / 2,
                    swW,
                    swH,
                    swStyle,
                );
                const closedBool = closed === true || closed === 'true';
                if (typeof window.configureSwitchAttributes === 'function') {
                    window.configureSwitchAttributes(grafka, swVertex, {
                        name: String(name),
                        et,
                        type: String(type || 'CB'),
                        closed: closedBool,
                        z_ohm: z_ohm != null && z_ohm !== '' ? String(z_ohm) : '0',
                        in_ka: in_ka != null && in_ka === in_ka ? String(in_ka) : '0',
                        pp_import_bus: String(bus_name),
                        pp_import_element: String(element_name),
                    });
                }
                grafka.insertEdge(
                    parent,
                    null,
                    '',
                    busVertex,
                    swVertex,
                    importBusToSwitchEdgeStyle(busVertex, swVertex, importPandapowerVerticalSld),
                );
                if (peerCell) {
                    grafka.insertEdge(
                        parent,
                        null,
                        '',
                        swVertex,
                        peerCell,
                        importSwitchToPeerEdgeStyle(swVertex, peerCell, busVertex, importPandapowerVerticalSld),
                    );
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

                const threewindingtrafoStyleBase = vertexStyleFromElectrisimSymbol('sym-3w-transformer', 'Three Winding Transformer');
                let [twW, twH] = vertexSizeFromElectrisimSymbol('sym-3w-transformer', 40, 60);
                let threewindingtrafoStyle = threewindingtrafoStyleBase;
                if (importPandapowerVerticalSld) {
                    [twW, twH] = [twH, twW];
                    threewindingtrafoStyle = `${threewindingtrafoStyleBase};rotation=${IMPORT_SLD_VERTICAL_ROTATION}`;
                }

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

                const switchedBuses3w = trafoSwitchBusSets.threeW[index];
                const skipHv3 = switchedBuses3w && switchedBuses3w.has(String(hv_bus_name));
                const skipMv3 = switchedBuses3w && switchedBuses3w.has(String(mv_bus_name));
                const skipLv3 = switchedBuses3w && switchedBuses3w.has(String(lv_bus_name));

                if (hvBusVertex && !skipHv3) {
                    grafka.insertEdge(
                        parent,
                        null,
                        '',
                        vertex,
                        hvBusVertex,
                        importPandapowerVerticalSld
                            ? importTrafo3wToBusEdgeStyle(vertex, hvBusVertex)
                            : edgeStyleHV,
                    );
                }
                if (mvBusVertex && !skipMv3) {
                    grafka.insertEdge(
                        parent,
                        null,
                        '',
                        vertex,
                        mvBusVertex,
                        importPandapowerVerticalSld
                            ? importTrafo3wToBusEdgeStyle(vertex, mvBusVertex)
                            : edgeStyleMV,
                    );
                }
                if (lvBusVertex && !skipLv3) {
                    grafka.insertEdge(
                        parent,
                        null,
                        '',
                        vertex,
                        lvBusVertex,
                        importPandapowerVerticalSld
                            ? importTrafo3wToBusEdgeStyle(vertex, lvBusVertex)
                            : edgeStyleLV,
                    );
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