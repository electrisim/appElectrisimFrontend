/**
 * Short-circuit fault-location helpers: All busbars vs User Selection.
 */

import { parseCellStyle } from '../loadFlow.js';
import { formatResultNameHeader } from './attributeUtils.js';

export function isElectricalBusCell(cell) {
    if (!cell) return false;
    if (typeof cell.isEdge === 'function' && cell.isEdge()) return false;
    const style = cell.style || (typeof cell.getStyle === 'function' ? cell.getStyle() : '') || '';
    if (!style) return false;
    const t = parseCellStyle(style)?.shapeELXXX;
    if (t === 'Bus' || t === 'Busbar') return true;
    if (t === 'DC Bus') return false;
    if (t && (String(t).includes('Result') || t === 'NotEditable' || t === 'FaultMarker')) return false;
    return style.includes('shape=mxgraph.electrical.transmission.busbar');
}

function cellById(graph, id) {
    if (!graph || id == null || id === '') return null;
    const sid = String(id);
    if (typeof graph.getCellById === 'function') {
        const c = graph.getCellById(sid);
        if (c) return c;
    }
    const model = graph.getModel?.();
    if (typeof model?.getCell === 'function') {
        const c = model.getCell(sid);
        if (c) return c;
    }
    return null;
}

export function resolveSelectedCellToBus(graph, cell) {
    if (!cell) return null;
    if (isElectricalBusCell(cell)) return cell;
    const model = graph?.getModel?.();
    const parent = model?.getParent?.(cell);
    if (parent && isElectricalBusCell(parent)) return parent;
    const style = cell.style || (typeof cell.getStyle === 'function' ? cell.getStyle() : '') || '';
    const m = String(style).match(/connectedTo=([^;]+)/);
    if (m) {
        const owner = cellById(graph, m[1]);
        if (isElectricalBusCell(owner)) return owner;
    }
    return null;
}

export function busCellPayload(cell) {
    const mxName = cell?.mxObjectId ? String(cell.mxObjectId).replace('#', '_') : '';
    let label = mxName || String(cell?.id || '');
    try {
        const attrs = cell?.value?.attributes;
        if (attrs) {
            for (let i = 0; i < attrs.length; i++) {
                if (attrs[i].nodeName === 'name' && attrs[i].nodeValue) {
                    label = String(attrs[i].nodeValue).trim() || label;
                    break;
                }
            }
        }
    } catch (e) { /* ignore */ }
    return {
        id: cell?.id != null ? String(cell.id) : '',
        name: mxName,
        label
    };
}

export function listDiagramBusbars(graph) {
    if (!graph?.getModel) return [];
    const model = graph.getModel();
    const cells = (typeof model.getDescendants === 'function' ? model.getDescendants() : null)
        || Object.values(model.cells || {});
    const out = [];
    const seen = new Set();
    cells.forEach((cell) => {
        if (!isElectricalBusCell(cell)) return;
        const id = cell.id != null ? String(cell.id) : '';
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push({ cell, ...busCellPayload(cell) });
    });
    out.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
    return out;
}

export function getSelectedDiagramBusbars(graph) {
    const selected = (graph && typeof graph.getSelectionCells === 'function')
        ? (graph.getSelectionCells() || [])
        : [];
    const map = new Map();
    selected.forEach((cell) => {
        const bus = resolveSelectedCellToBus(graph, cell);
        if (!bus) return;
        const id = bus.id != null ? String(bus.id) : '';
        if (!id || map.has(id)) return;
        map.set(id, { cell: bus, ...busCellPayload(bus) });
    });
    return [...map.values()];
}

export function isUserSelectionFaultMode(mode) {
    const m = String(mode || '').trim().toLowerCase();
    return m === 'selection' || m === 'user' || m === 'user_selection' || m === 'user selection';
}

export function formatScFaultLocationLine(dataJson) {
    const sp = dataJson?.study_params || {};
    const mode = sp.fault_bus_mode || 'all';
    if (isUserSelectionFaultMode(mode)) {
        const n = Array.isArray(dataJson?.busbars) ? dataJson.busbars.length : 0;
        return `Fault location: User Selection (${n} busbar${n === 1 ? '' : 's'})\n`;
    }
    return 'Fault location: All busbars\n';
}

/**
 * After a User Selection short-circuit, overwrite leftover Ikss boxes on
 * busbars that were not faulted.
 */
export function markBusesWithoutAppliedFault(graph, selectedIds, selectedNames) {
    if (!graph?.getModel) return 0;
    const idSet = new Set((selectedIds || []).map((x) => String(x)));
    const nameSet = new Set();
    (selectedNames || []).forEach((n) => {
        const s = String(n || '').trim();
        if (!s) return;
        nameSet.add(s);
        nameSet.add(s.replace('#', '_'));
        nameSet.add(s.replace('_', '#'));
    });
    const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
    const updateFn = typeof window !== 'undefined' && window.updateOrCreateSinglePlaceholder;
    let n = 0;
    const model = graph.getModel();
    const alreadyUpdating = typeof model.updateLevel === 'number' && model.updateLevel > 0;
    if (!alreadyUpdating) model.beginUpdate();
    try {
        listDiagramBusbars(graph).forEach((row) => {
            if (idSet.has(String(row.id)) || nameSet.has(row.name) || nameSet.has(row.label)) {
                return;
            }
            const busLabel = formatResultNameHeader(row.cell, row.label || row.name, 'Bus');
            const text = `${busLabel}\nFault not applied`;
            if (updateFn) {
                updateFn(graph, row.cell, text, row.cell, { width: 45, height: 48, positionX: 0, positionY: 1.0 });
                n += 1;
                return;
            }
            const existing = findFn ? findFn(graph, row.cell) : null;
            if (existing) {
                model.setValue(existing, text);
                n += 1;
            }
        });
    } finally {
        if (!alreadyUpdating) model.endUpdate();
    }
    return n;
}
