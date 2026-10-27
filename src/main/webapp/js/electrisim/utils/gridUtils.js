export const numberParser = (params) => {
    if (Number(params.newValue) >= 0) {
        return Number(params.newValue);
    } else {
        alert("The value of the " + params.colDef.field + " must be number (dot separated) or >= 0");
        return Number(params.oldValue);
    }
};

export const actionCellRenderer = (params) => {
    let eGui = document.createElement("div");
    
    let editingCells = params.api.getEditingCells();
    let isCurrentRowEditing = editingCells.some((cell) => {
        return cell.rowIndex === params.node.rowIndex;
    });
    
    if (isCurrentRowEditing) {
        eGui.innerHTML = `
            <button class="action-button update" data-action="update">update</button>
            <button class="action-button cancel" data-action="cancel">cancel</button>
        `;
    } else {
        eGui.innerHTML = `
            <button class="action-button edit" data-action="edit">edit</button>
            <button class="action-button delete" data-action="delete">delete</button>
            <button class="action-button update" data-action="add">add</button>
        `;
    }
    
    return eGui;
};

// Define and export utility functions for grid operations

// Get connected bus IDs for a cell
export const getConnectedBusId = (cell, isLine = false) => {
    console.log('cell in getConnectedBusId', cell);

    if (isLine) {                 
        return {            
            busFrom: cell.source?.mxObjectId?.replace('#', '_'),
            busTo: cell.target?.mxObjectId?.replace('#', '_')
        };            
    }
    const edge = cell.edges[0];
    // First check if edge exists
    if (!edge) {
        return null; // or some default value
    }

    // Then check if both target and source exist before accessing their properties
    if (!edge.target && !edge.source) {
        return null; // or some default value
    }

    // Make sure we're not accessing mxObjectId from a null object
    const bus = edge.target && edge.target.mxObjectId !== cell.mxObjectId ?
        (edge.target ? edge.target.mxObjectId : null) : 
        (edge.source ? edge.source.mxObjectId : null);

    // Only try to replace if bus is not null
    return bus ? bus.replace('#', '_') : null;
};

// Get transformer connections
export const getTransformerConnections = (cell) => {
    const hvEdge = cell.edges[0];
    const lvEdge = cell.edges[1];

    return {
        hv_bus: (hvEdge.target.mxObjectId !== cell.mxObjectId ?
            hvEdge.target.mxObjectId : hvEdge.source.mxObjectId).replace('#', '_'),
        lv_bus: (lvEdge.target.mxObjectId !== cell.mxObjectId ?
            lvEdge.target.mxObjectId : lvEdge.source.mxObjectId).replace('#', '_')
    };
};

/**
 * Busbar names per pandapower side (hv / lv) for a two-winding transformer.
 * Edge order matches export: edges[0] = hv, edges[1] = lv.
 * Does not throw when a winding is not connected.
 */
export function getTransformerSideBusNames(cell) {
    const empty = { hv: '', lv: '' };
    if (!cell || !cell.edges || cell.edges.length < 2) {
        return empty;
    }
    const [hvEdge, lvEdge] = cell.edges;
    const nameForEdge = (edge) => {
        const bus = getOtherTerminalCell(edge, cell);
        return bus ? getBusOptionLabel(bus) : '';
    };
    return {
        hv: nameForEdge(hvEdge),
        lv: nameForEdge(lvEdge)
    };
}

// Ports of the three_winding_transformer stencil (abstract.xml) and of sym-3w-transformer.svg,
// in unrotated 0..1 coordinates.
const THREE_WINDING_PORTS = {
    lv: { x: 0.5, y: 0.916 },
    mv: { x: 0.967, y: 0.389 },
    hv: { x: 0.033, y: 0.389 }
};
const PORT_MATCH_TOLERANCE = 0.06;

function styleNumber(style, key) {
    const m = new RegExp(`(?:^|;)${key}=([^;]+)`).exec(style || '');
    const v = m ? parseFloat(m[1]) : NaN;
    return Number.isFinite(v) ? v : null;
}

function nearestPort(x, y, tolerance) {
    let best = null;
    let bestDist = Infinity;
    for (const [side, p] of Object.entries(THREE_WINDING_PORTS)) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestDist) {
            best = side;
            bestDist = d;
        }
    }
    return bestDist <= tolerance ? best : null;
}

/** Port an edge is pinned to, from its exitX/exitY (transformer is source) or entryX/entryY (target). */
function sideFromEdgeStyle(edge, cell) {
    const style = typeof edge.getStyle === 'function' ? edge.getStyle() : edge.style;
    const prefix = edge.source === cell ? 'exit' : edge.target === cell ? 'entry' : null;
    if (!prefix) return null;
    const x = styleNumber(style, `${prefix}X`);
    const y = styleNumber(style, `${prefix}Y`);
    return x == null || y == null ? null : nearestPort(x, y, PORT_MATCH_TOLERANCE);
}

/** Floating edge: the port nearest to where the drawn line touches the symbol. */
function sideFromEdgeView(edge, cell) {
    const graph = typeof window !== 'undefined' ? window.App?.main?.editor?.graph : null;
    if (!graph?.view || typeof mxConnectionConstraint === 'undefined' || typeof mxPoint === 'undefined') {
        return null;
    }
    const cellState = graph.view.getState(cell);
    const pts = graph.view.getState(edge)?.absolutePoints;
    if (!cellState || !pts || pts.length < 2 || !pts[0] || !pts[pts.length - 1]) return null;
    const end = edge.source === cell ? pts[0] : pts[pts.length - 1];
    let best = null;
    let bestDist = Infinity;
    for (const [side, p] of Object.entries(THREE_WINDING_PORTS)) {
        const cp = graph.getConnectionPoint(cellState, new mxConnectionConstraint(new mxPoint(p.x, p.y), false));
        if (!cp) continue;
        const d = Math.hypot(cp.x - end.x, cp.y - end.y);
        if (d < bestDist) {
            best = side;
            bestDist = d;
        }
    }
    return best;
}

/**
 * Which edge is wired to which terminal of a stencil three-winding transformer, read from the port
 * each line is attached to. Returns { hv, mv, lv } edges, or null when the ports cannot tell
 * (image-based symbols, or lines not attached to distinct ports) so callers keep the edge order.
 */
export function resolveThreeWindingEdgeSides(cell) {
    if (!cell?.edges || cell.edges.length !== 3) return null;
    const style = typeof cell.getStyle === 'function' ? cell.getStyle() : cell.style;
    // The stencil and the sym-3w-transformer.svg image share these ports. The vertical image used
    // by the BESS builder has its own pins and adds edges in [LV, MV, HV] order.
    if (/sym-3w-transformer-v/.test(style || '')) return null;

    const sides = {};
    const unmatched = [];
    for (const edge of cell.edges) {
        const side = sideFromEdgeStyle(edge, cell) || sideFromEdgeView(edge, cell);
        if (side && !sides[side]) {
            sides[side] = edge;
        } else {
            unmatched.push(edge);
        }
    }
    const missing = ['hv', 'mv', 'lv'].filter((s) => !sides[s]);
    if (missing.length > 1) return null;
    if (missing.length === 1) sides[missing[0]] = unmatched[0];
    return sides;
}

/** Edges for HV / MV / LV: by port when known, else the legacy [LV, MV, HV] edge order. */
function getThreeWindingEdges(cell) {
    const bySide = resolveThreeWindingEdgeSides(cell);
    if (bySide) return [bySide.lv, bySide.mv, bySide.hv];
    return cell.edges;
}

// Get three winding transformer connections (terminal → bus, see resolveThreeWindingEdgeSides).
export const getThreeWindingConnections = (cell) => {
    if (!cell.edges || cell.edges.length < 3) {
        throw new Error(
            `Three Winding Transformer "${cell.id}" must be connected to exactly 3 buses (HV, MV, and LV). ` +
            `Found ${cell.edges ? cell.edges.length : 0} connection(s).`
        );
    }
    const [lvEdge, mvEdge, hvEdge] = getThreeWindingEdges(cell);
    const getConnectedBus = (edge) => {
        if (!edge) {
            throw new Error(`Three Winding Transformer "${cell.id}" has an undefined edge connection.`);
        }
        const target = edge.target;
        const source = edge.source;
        if (!target && !source) {
            throw new Error(
                `Three Winding Transformer "${cell.id}" has an edge that is not connected on either side.`
            );
        }
        const connectedCell = (target && target.mxObjectId !== cell.mxObjectId) ? target : source;
        if (!connectedCell || !connectedCell.mxObjectId) {
            throw new Error(
                `Three Winding Transformer "${cell.id}" has an edge not properly connected to a bus.`
            );
        }
        return connectedCell.mxObjectId.replace('#', '_');
    };

    return {
        hv_bus: getConnectedBus(hvEdge),
        mv_bus: getConnectedBus(mvEdge),
        lv_bus: getConnectedBus(lvEdge)
    };
};

function readCellAttribute(cell, name) {
    if (!cell || !name) {
        return '';
    }
    try {
        if (cell.value && typeof cell.value.getAttribute === 'function') {
            const v = cell.value.getAttribute(name);
            return v == null ? '' : String(v).trim();
        }
        const attr = cell.value?.attributes?.getNamedItem?.(name);
        return attr && attr.nodeValue ? String(attr.nodeValue).trim() : '';
    } catch (e) {
        return '';
    }
}

/** Display name from a bus (or any) cell's `name` attribute, else cell id. */
export function getCellDisplayName(cell) {
    if (!cell) {
        return '';
    }
    const named = readCellAttribute(cell, 'name');
    if (named) {
        return named;
    }
    try {
        if (typeof cell.getId === 'function') {
            return String(cell.getId());
        }
    } catch (e) {
        /* ignore */
    }
    return '';
}

/**
 * Busbar name for a dropdown. Adds rated voltage when the name does not already say kV,
 * so a bus called "Bus" at 15 kV reads as "Bus (15 kV)".
 */
export function getBusOptionLabel(cell) {
    const name = getCellDisplayName(cell);
    const vn = parseFloat(readCellAttribute(cell, 'vn_kv'));
    const hasVoltage = Number.isFinite(vn) && vn > 0;
    const vnText = hasVoltage ? String(vn).replace(/\.0+$/, '') : '';
    if (!name) {
        return hasVoltage ? `${vnText} kV bus` : '';
    }
    if (hasVoltage && !/kv/i.test(name)) {
        return `${name} (${vnText} kV)`;
    }
    return name;
}

/** Other end of an edge that is not the transformer vertex. */
export function getOtherTerminalCell(edge, vertexCell) {
    if (!edge) {
        return null;
    }
    const target = edge.target;
    const source = edge.source;
    if (!target && !source) {
        return null;
    }
    if (target && vertexCell && target.mxObjectId !== vertexCell.mxObjectId) {
        return target;
    }
    if (source && vertexCell && source.mxObjectId !== vertexCell.mxObjectId) {
        return source;
    }
    return target || source;
}

/**
 * Human-readable bus names per pandapower side (hv / mv / lv) for a three-winding transformer.
 * Does not throw when windings are not all connected.
 */
export function getThreeWindingSideBusNames(cell) {
    const empty = { hv: '', mv: '', lv: '' };
    if (!cell || !cell.edges || cell.edges.length < 3) {
        return empty;
    }
    const [lvEdge, mvEdge, hvEdge] = getThreeWindingEdges(cell);
    const nameForEdge = (edge) => {
        const bus = getOtherTerminalCell(edge, cell);
        return bus ? getBusOptionLabel(bus) : '';
    };
    return {
        hv: nameForEdge(hvEdge),
        mv: nameForEdge(mvEdge),
        lv: nameForEdge(lvEdge)
    };
};

// Get impedance connections
export const getImpedanceConnections = (cell) => {
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Impedance must be connected to two buses');
    }

    const fromEdge = cell.edges[0];
    const toEdge = cell.edges[1];

    return {
        busFrom: (fromEdge.target.mxObjectId !== cell.mxObjectId ?
            fromEdge.target.mxObjectId : fromEdge.source.mxObjectId).replace('#', '_'),
        busTo: (toEdge.target.mxObjectId !== cell.mxObjectId ?
            toEdge.target.mxObjectId : toEdge.source.mxObjectId).replace('#', '_')
    };
};

// Get connected buses for a cell
export const getConnectedBuses = (cell) => {
    // First try source/target approach
    if (cell.source && cell.target) {
        return {
            busFrom: cell.source.mxObjectId.replace('#', '_'),
            busTo: cell.target.mxObjectId.replace('#', '_')
        };
    }
    
    // Fallback to edges approach
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Element must be connected to two buses');
    }
    
    const fromEdge = cell.edges[0];
    const toEdge = cell.edges[1];

    return {
        busFrom: (fromEdge.target.mxObjectId !== cell.mxObjectId ?
            fromEdge.target.mxObjectId : fromEdge.source.mxObjectId).replace('#', '_'),
        busTo: (toEdge.target.mxObjectId !== cell.mxObjectId ?
            toEdge.target.mxObjectId : toEdge.source.mxObjectId).replace('#', '_')
    };
};

// Validate bus connections for a cell
export const validateBusConnections = (cell) => {
    // Check source/target approach first
    if (cell.source && cell.target) {
        if (!cell.source.mxObjectId || !cell.target.mxObjectId) {
            throw new Error('Line must be connected to two buses with valid IDs');
        }
        return;
    }
    
    // Fallback to edges approach
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Line must be connected to two buses');
    }
};

// Update transformer bus connections
export const updateTransformerBusConnections = (transformers, busbars, graph) => {
    return transformers.map(transformer => {
        // Get the cell from the graph using the transformer's ID
        const cell = graph.getModel().getCell(transformer.id);
        if (!cell || !cell.edges || cell.edges.length < 2) {
            console.warn(`Transformer ${transformer.id} is not properly connected`);
            return transformer;
        }

        try {
            const connections = getTransformerConnections(cell);
            return {
                ...transformer,
                hv_bus: connections.hv_bus,
                lv_bus: connections.lv_bus
            };
        } catch (error) {
            console.error(`Error updating connections for transformer ${transformer.id}:`, error);
            return transformer;
        }
    });
};

// Update three winding transformer connections
export const updateThreeWindingTransformerConnections = (transformers, busbars, graph) => {
    return transformers.map(transformer => {
        // Get the cell from the graph using the transformer's ID
        const cell = graph.getModel().getCell(transformer.id);
        if (!cell || !cell.edges || cell.edges.length < 3) {
            console.warn(`Three winding transformer ${transformer.id} is not properly connected`);
            return transformer;
        }

        try {
            const connections = getThreeWindingConnections(cell);
            return {
                ...transformer,
                hv_bus: connections.hv_bus,
                mv_bus: connections.mv_bus,
                lv_bus: connections.lv_bus
            };
        } catch (error) {
            console.error(`Error updating connections for three winding transformer ${transformer.id}:`, error);
            return transformer;
        }
    });
};

// Make functions available globally for legacy code
window.getConnectedBusId = getConnectedBusId;
window.getTransformerConnections = getTransformerConnections;
window.getThreeWindingConnections = getThreeWindingConnections;
window.getCellDisplayName = getCellDisplayName;
window.getThreeWindingSideBusNames = getThreeWindingSideBusNames;
window.resolveThreeWindingEdgeSides = resolveThreeWindingEdgeSides;
window.getImpedanceConnections = getImpedanceConnections;
window.getConnectedBuses = getConnectedBuses;
window.validateBusConnections = validateBusConnections;
window.updateTransformerBusConnections = updateTransformerBusConnections;
window.updateThreeWindingTransformerConnections = updateThreeWindingTransformerConnections;