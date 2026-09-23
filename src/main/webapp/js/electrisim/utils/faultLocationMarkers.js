/**
 * Red thunder overlays on short-circuit fault buses.
 * Cleared at the start of the next study of any type.
 */

export const FAULT_MARKER_SHAPE = 'FaultMarker';

const MARKER_W = 22;
const MARKER_H = 28;

const MARKER_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">' +
    '<path fill="#DC2626" stroke="#7F1D1D" stroke-width="1.2" stroke-linejoin="round" ' +
    'd="M13.2 1.2L3.4 17.4h7.1L8.2 30.8 20.8 12.6h-7.3L15.8 1.2z"/>' +
    '</svg>';

const MARKER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(MARKER_SVG);

const MARKER_STYLE = [
    `shapeELXXX=${FAULT_MARKER_SHAPE}`,
    'shape=image',
    `image=${MARKER_IMAGE}`,
    'aspect=fixed',
    'fillColor=none',
    'strokeColor=none',
    'connectable=0',
    'editable=0',
    'movable=0',
    'resizable=0',
    'rotatable=0',
    'deletable=0',
    'cloneable=0',
    'selectable=0'
].join(';');

export function isFaultMarkerCell(cell) {
    if (!cell) return false;
    const style = cell.style || (typeof cell.getStyle === 'function' ? cell.getStyle() : '') || '';
    return String(style).includes(`shapeELXXX=${FAULT_MARKER_SHAPE}`);
}

export function isFaultMarkerStyle(style) {
    return !!style && String(style).includes(`shapeELXXX=${FAULT_MARKER_SHAPE}`);
}

function resolveGraph(graph) {
    if (graph && typeof graph.getModel === 'function') return graph;
    try {
        const app = typeof window !== 'undefined' ? window.App : null;
        return app?._editorUi?.editor?.graph
            || app?.editor?.graph
            || app?._instance?.editor?.graph
            || app?.main?.editor?.graph
            || null;
    } catch (e) {
        return null;
    }
}

function listModelCells(graph) {
    const model = graph.getModel();
    if (typeof model.getDescendants === 'function') {
        return model.getDescendants() || [];
    }
    return Object.values(model.cells || {});
}

export function clearFaultLocationMarkers(graph) {
    const g = resolveGraph(graph);
    if (!g?.getModel) return 0;
    const model = g.getModel();
    const toRemove = listModelCells(g).filter(isFaultMarkerCell);
    if (!toRemove.length) return 0;
    const alreadyUpdating = typeof model.updateLevel === 'number' && model.updateLevel > 0;
    if (!alreadyUpdating) model.beginUpdate();
    try {
        toRemove.forEach((cell) => {
            try {
                model.remove(cell);
            } catch (e) { /* ignore */ }
        });
    } finally {
        if (!alreadyUpdating) model.endUpdate();
    }
    return toRemove.length;
}

function insertMarkerOnBus(graph, busCell) {
    if (!graph || !busCell) return null;
    const model = graph.getModel();
    const childCount = typeof model.getChildCount === 'function' ? model.getChildCount(busCell) : 0;
    for (let i = 0; i < childCount; i++) {
        const child = model.getChildAt(busCell, i);
        if (isFaultMarkerCell(child)) return child;
    }
    const marker = graph.insertVertex(
        busCell, null, '',
        0.5, 0, MARKER_W, MARKER_H,
        MARKER_STYLE, true
    );
    if (!marker) return null;
    const geo = model.getGeometry(marker);
    if (geo) {
        geo.relative = true;
        geo.x = 0.5;
        geo.y = 0;
        if (typeof mxPoint !== 'undefined') {
            geo.offset = new mxPoint(-MARKER_W / 2, -MARKER_H - 2);
        }
        model.setGeometry(marker, geo);
    }
    if (typeof graph.orderCells === 'function') {
        try { graph.orderCells(false, [marker]); } catch (e) { /* ignore */ }
    }
    return marker;
}

/**
 * Place a red thunder overlay on each unique bus cell (after clearing old markers).
 */
export function placeFaultLocationMarkers(graph, busCells) {
    const g = resolveGraph(graph);
    if (!g?.getModel) return 0;
    clearFaultLocationMarkers(g);
    const list = Array.isArray(busCells) ? busCells.filter(Boolean) : [];
    if (!list.length) return 0;
    const seen = new Set();
    const unique = [];
    list.forEach((cell) => {
        const id = cell.id != null ? String(cell.id) : '';
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        unique.push(cell);
    });
    const model = g.getModel();
    const alreadyUpdating = typeof model.updateLevel === 'number' && model.updateLevel > 0;
    if (!alreadyUpdating) model.beginUpdate();
    let n = 0;
    try {
        unique.forEach((bus) => {
            if (insertMarkerOnBus(g, bus)) n += 1;
        });
    } finally {
        if (!alreadyUpdating) model.endUpdate();
    }
    return n;
}

/**
 * Resolve result-row buses and mark them as the short-circuit fault locations.
 */
export function placeFaultMarkersForScRows(graph, rows, resolveRow) {
    const g = resolveGraph(graph);
    if (!g) return 0;
    const buses = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        try {
            const cell = resolveRow ? resolveRow(row) : null;
            if (cell) buses.push(cell);
        } catch (e) { /* skip unmatched */ }
    });
    return placeFaultLocationMarkers(g, buses);
}

if (typeof window !== 'undefined') {
    window.clearFaultLocationMarkers = clearFaultLocationMarkers;
    window.placeFaultLocationMarkers = placeFaultLocationMarkers;
}
