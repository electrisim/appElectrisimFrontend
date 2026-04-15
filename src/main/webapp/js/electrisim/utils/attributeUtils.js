/**
 * Normalize backend / graph object id for display (underscores → #).
 */
export function normalizeGraphObjectName(name) {
    if (name == null || name === '') return '';
    return String(name).trim().replace(/_/g, '#');
}

/**
 * True for draw.io internal object names (e.g. mxCell_702, mxCell#702) — hide in result UI.
 */
export function looksLikeInternalGraphObjectId(str) {
    if (str == null || str === '') return false;
    const s = String(str).trim().replace(/#/g, '_');
    return /^mxCell_\d+$/i.test(s);
}

/**
 * User-editable name from component dialog (XML attribute `name`), shared by bus/line/trafo/etc. dialogs.
 */
export function getDialogNameFromCell(cell) {
    if (!cell?.value?.attributes?.getNamedItem) return '';
    const n = cell.value.attributes.getNamedItem('name')?.nodeValue;
    return n != null && String(n).trim() ? String(n).trim() : '';
}

/**
 * Get display name for result boxes: prefers dialog name (from cell attributes), then backend name.
 * @param {mxCell} resultCell - The graph cell (has value.attributes with 'name')
 * @param {string} backendName - Name from backend (e.g. mxCell_260)
 * @param {string} defaultName - Fallback (e.g. 'Line', 'Trafo', 'Generator')
 * @returns {string} Display name for result box
 */
export function getDisplayName(resultCell, backendName, defaultName) {
    const n = getDialogNameFromCell(resultCell);
    if (n) return n;
    const bn = backendName ? String(backendName).replace(/_/g, '#') : null;
    if (bn && !looksLikeInternalGraphObjectId(bn)) return bn;
    return defaultName || 'Unknown';
}

/**
 * Heading for on-canvas result boxes: dialog name on first line, (object id) on second when both differ.
 */
export function formatResultNameHeader(resultCell, backendName, defaultType) {
    const dialog = getDialogNameFromCell(resultCell);
    const fromBackend = backendName ? normalizeGraphObjectName(String(backendName)) : '';
    const rawMx = resultCell?.mxObjectId;
    const fromCell = rawMx
        ? normalizeGraphObjectName(String(rawMx).replace(/#/g, '_'))
        : '';
    const objectId = fromBackend || fromCell;
    const objectIdDisplay =
        objectId && !looksLikeInternalGraphObjectId(objectId) ? objectId : '';
    if (dialog) {
        if (objectIdDisplay && dialog !== objectIdDisplay) {
            return `${dialog}\n(${objectIdDisplay})`;
        }
        return dialog;
    }
    if (objectIdDisplay) return objectIdDisplay;
    return defaultType || 'Unknown';
}

function addMxLookupKeys(set, mxObjectId) {
    if (mxObjectId == null || mxObjectId === '') return;
    const raw = String(mxObjectId);
    const under = raw.replace(/#/g, '_');
    set.add(raw);
    set.add(under);
    if (under.startsWith('mxCell_')) {
        set.add('mxCell#' + under.slice('mxCell_'.length));
    }
    set.add(raw.toLowerCase());
    set.add(under.toLowerCase());
}

/**
 * All string keys to try when matching a backend result row to a graph cell.
 * Covers JSON number/string drift (e.g. 720 vs "720"), mxCell_ / mxCell#, etc.
 */
export function collectBackendResultLookupKeys(backendRow) {
    if (!backendRow) return [];
    const keys = new Set();
    const add = (v) => {
        if (v === null || v === undefined) return;
        if (v === '') return;
        keys.add(String(v));
        if (typeof v === 'number' && Number.isFinite(v)) {
            keys.add(v);
            if (Number.isInteger(v)) keys.add(String(v));
        }
        const s = String(v).trim();
        if (!s) return;
        keys.add(s);
        keys.add(s.toLowerCase());
        if (/^-?\d+\.\d+$/.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n)) {
                keys.add(String(n));
                if (Number.isInteger(n)) keys.add(n);
            }
        }
    };
    add(backendRow.id);
    if (backendRow.name != null) {
        const n = String(backendRow.name);
        add(n);
        add(n.replace(/#/g, '_'));
        add(n.replace(/_/g, '#'));
        const set = new Set();
        addMxLookupKeys(set, n);
        addMxLookupKeys(set, n.replace(/#/g, '_'));
        set.forEach((k) => add(k));
    }
    return [...keys].filter((k) => k !== '' && k != null);
}

/**
 * Last-resort: walk vertices and match id or mxObjectId to backend row (map missed).
 */
function resolveGraphCellByScanningVertices(graph, backendRow) {
    if (!graph?.getModel || !backendRow) return null;
    const model = graph.getModel();
    const cells = model.cells;
    if (!cells) return null;
    const wantNameU = backendRow.name != null ? String(backendRow.name).replace(/#/g, '_') : '';
    const wantNameRaw = backendRow.name != null ? String(backendRow.name) : '';
    const wantIdStr = backendRow.id != null ? String(backendRow.id) : '';
    const wantIdNum = wantIdStr !== '' && !Number.isNaN(Number(wantIdStr)) ? Number(wantIdStr) : null;
    for (const cid in cells) {
        const c = cells[cid];
        if (!c || model.isEdge(c)) continue;
        if (wantIdStr !== '' && (String(c.id) === wantIdStr || (wantIdNum !== null && c.id === wantIdNum))) {
            return c;
        }
        const mx = c.mxObjectId ? String(c.mxObjectId) : '';
        const mxU = mx.replace(/#/g, '_');
        if (wantNameU && (mxU === wantNameU || mx === wantNameRaw || mx.replace(/_/g, '#') === wantNameRaw)) {
            return c;
        }
    }
    return null;
}

/**
 * Map backend result row { id, name } → graph cell (same idea as OpenDSS cellIdMap).
 */
export function buildGraphCellLookupMap(graph) {
    const map = new Map();
    if (!graph?.getModel) return map;
    const cells = graph.getModel().cells;
    if (!cells || typeof cells !== 'object') return map;
    const register = (key, cell) => {
        if (key != null && key !== '') map.set(String(key), cell);
    };
    for (const cid in cells) {
        const c = cells[cid];
        if (!c) continue;
        register(c.id, c);
        if (typeof c.id === 'number') register(String(c.id), c);
        else if (c.id != null && String(c.id).trim() !== '') {
            const idStr = String(c.id);
            const asNum = Number(idStr);
            if (Number.isFinite(asNum)) register(asNum, c);
        }
        if (c.mxObjectId) {
            const keys = new Set();
            addMxLookupKeys(keys, c.mxObjectId);
            keys.forEach(k => register(k, c));
        }
    }
    return map;
}

/**
 * @param {Map} map - from buildGraphCellLookupMap(graph)
 * @param {object} backendRow - result row with id / name
 * @param {object} [graph] - optional mxGraph; if set, scan vertices when map misses
 */
export function resolveGraphCellForResult(map, backendRow, graph) {
    if (!map || !backendRow) return null;
    const tryKeys = collectBackendResultLookupKeys(backendRow);
    for (const k of tryKeys) {
        if (k === '' || k == null) continue;
        let cell = map.get(String(k));
        if (cell) return cell;
        cell = map.get(String(k).toLowerCase());
        if (cell) return cell;
    }
    if (graph) {
        const scanned = resolveGraphCellByScanningVertices(graph, backendRow);
        if (scanned) return scanned;
    }
    return null;
}

/**
 * Returns (row) => dialog name string for exported tables; empty if graph missing or cell not found.
 */
export function createDialogNameResolver(graph) {
    if (!graph?.getModel) {
        return () => '';
    }
    const map = buildGraphCellLookupMap(graph);
    return (row) => {
        const cell = resolveGraphCellForResult(map, row, graph);
        return cell ? (getDialogNameFromCell(cell) || '') : '';
    };
}

// Helper function to get attributes as object
export const getAttributesAsObject = (cell, attributeMap) => {
    const result = {};
    console.log('cell in getAttributes', cell);

    // Make sure cell has all the required properties
    if (!cell || !cell.value || !cell.value.attributes) {
        console.warn('Cell is missing required properties');
        return result;
    }

    // Get all available attributes
    const attributes = cell.value.attributes;

    // Process each requested attribute by name instead of index
    for (const [key, config] of Object.entries(attributeMap)) {
        const isOptional = typeof config === 'object' && config.optional;
        const attributeName = typeof config === 'object' ? config.name : config;

        console.log(`Looking for attribute ${key} with name ${attributeName}, optional: ${isOptional}`);

        // Find the attribute by name in the attributes collection
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
            } else if (
                key === 'vk0_hv_percent' || key === 'vk0_mv_percent' || key === 'vk0_lv_percent' ||
                key === 'vkr0_hv_percent' || key === 'vkr0_mv_percent' || key === 'vkr0_lv_percent'
            ) {
                result[key] = '0';
            }
            // Note: Other optional parameters can be left undefined as they truly are optional
        }
    }

    return result;
};

// Make it available globally for legacy code
window.getAttributesAsObject = getAttributesAsObject;
window.getDisplayName = getDisplayName;
window.formatResultNameHeader = formatResultNameHeader;
window.getDialogNameFromCell = getDialogNameFromCell;
window.createDialogNameResolver = createDialogNameResolver; 