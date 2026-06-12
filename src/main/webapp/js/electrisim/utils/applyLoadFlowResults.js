/**
 * Apply pandapower load-flow JSON to diagram result boxes (shared by RPC PQ point clicks).
 */
import { buildGraphCellLookupMap, resolveGraphCellForResult, formatResultNameHeader } from './attributeUtils.js';

const COLOR_STATES = { DANGER: 'red', WARNING: 'orange', GOOD: 'green' };

function formatNumber(num, decimals = 3) {
    if (num == null || num === '' || num === 'NaN' || (typeof num === 'number' && Number.isNaN(num))) {
        return 'N/A';
    }
    return parseFloat(num).toFixed(decimals);
}

function replaceUnderscores(name) {
    return String(name || '').replace('_', '#');
}

function vnKvFromGraphCell(graphCell) {
    if (!graphCell?.value?.getAttribute) return NaN;
    return Number(graphCell.value.getAttribute('vn_kv'));
}

function formatBusVmKvForCell(dataCell, graphCell, decimals = 3) {
    const kv = Number(dataCell?.vm_kv);
    if (Number.isFinite(kv)) return kv.toFixed(decimals);
    const pu = Number(dataCell?.vm_pu);
    const vn = vnKvFromGraphCell(graphCell);
    if (Number.isFinite(pu) && Number.isFinite(vn) && vn > 0) return (pu * vn).toFixed(decimals);
    return 'N/A';
}

function updateCellColor(grafka, cell, color) {
    if (!cell || !grafka?.getModel) return;
    const style = grafka.getModel().getStyle(cell) || '';
    let newStyle;
    if (typeof mxUtils !== 'undefined' && typeof mxConstants !== 'undefined') {
        newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
    } else {
        newStyle = `${style};strokeColor=${color}`;
    }
    grafka.setCellStyle(newStyle, [cell]);
}

function processVoltageColor(grafka, cell, vmPu) {
    const n = Number(vmPu);
    if (!Number.isFinite(n)) return;
    const voltage = parseFloat(n.toFixed(2));
    let color = null;
    if (voltage >= 1.1 || voltage <= 0.9) color = COLOR_STATES.DANGER;
    else if ((voltage > 1.05 && voltage <= 1.1) || (voltage > 0.9 && voltage <= 0.95)) color = COLOR_STATES.WARNING;
    else if ((voltage > 1 && voltage <= 1.05) || (voltage > 0.95 && voltage <= 1)) color = COLOR_STATES.GOOD;
    if (color) updateCellColor(grafka, cell, color);
}

function processLoadingColor(grafka, cell, loadingPercent) {
    const n = Number(loadingPercent);
    if (!Number.isFinite(n)) return;
    const loading = parseFloat(n.toFixed(1));
    let color = null;
    if (loading > 100) color = COLOR_STATES.DANGER;
    else if (loading > 80) color = COLOR_STATES.WARNING;
    else if (loading > 0) color = COLOR_STATES.GOOD;
    if (color) updateCellColor(grafka, cell, color);
}

function findPlaceholder(graph, parentCell) {
    const fn = typeof window !== 'undefined' && window.findResultPlaceholder;
    return fn ? fn(graph, parentCell) : null;
}

function findPlaceholderForComponent(graph, componentCell) {
    const fn = typeof window !== 'undefined' && window.findResultPlaceholderForComponent;
    return fn ? fn(graph, componentCell) : findPlaceholder(graph, componentCell);
}

function insertBox(graph, parentCell, text, opts) {
    const fn = typeof window !== 'undefined' && window.insertResultBox;
    if (fn) return fn(graph, parentCell, text, opts);
    return null;
}

function busDisplayPq(cell) {
    const pInjN = Number(cell.p_mw);
    const qInjN = Number(cell.q_mvar);
    const magInj = Math.hypot(Number.isFinite(pInjN) ? pInjN : 0, Number.isFinite(qInjN) ? qInjN : 0);
    if (magInj >= 1e-6) {
        return { p: cell.p_mw, q: cell.q_mvar, pf: cell.pf, qp: cell.q_p };
    }
    const pBr = cell.p_branch_mw;
    const qBr = cell.q_branch_mvar;
    const pN = Number(pBr);
    const qN = Number(qBr);
    const magBr = Math.hypot(Number.isFinite(pN) ? pN : 0, Number.isFinite(qN) ? qN : 0);
    if (pBr != null && qBr != null && magBr >= 1e-6) {
        const p = Number.isFinite(pN) ? pN : 0;
        const q = Number.isFinite(qN) ? qN : 0;
        const denom = Math.sqrt(p * p + q * q);
        return { p, q, pf: denom > 1e-12 ? p / denom : 0, qp: Math.abs(p) > 1e-12 ? q / p : 0 };
    }
    return { p: cell.p_mw, q: cell.q_mvar, pf: cell.pf, qp: cell.q_p };
}

function mergeTapControlIntoTransformers(dataJson) {
    const rows = dataJson.tap_control_results;
    if (!Array.isArray(rows) || rows.length === 0) return;
    const byCellId = new Map();
    const byInternalName = new Map();
    for (const row of rows) {
        if (row?.cell_id) byCellId.set(String(row.cell_id), row);
        if (row?.id != null) byInternalName.set(String(row.id), row);
    }
    const attach = (tr, requireTrafo3w) => {
        let m = tr.id != null ? byCellId.get(String(tr.id)) : null;
        if (!m && tr.name != null) m = byInternalName.get(String(tr.name));
        if (!m) return;
        const is3w = m.element === 'trafo3w';
        if (requireTrafo3w && !is3w) return;
        if (!requireTrafo3w && is3w) return;
        tr.tap_control_result = m;
    };
    (dataJson.transformers || []).forEach((tr) => attach(tr, false));
    (dataJson.transformers3W || []).forEach((tr) => attach(tr, true));
}

function mergeShuntControlIntoShunts(dataJson) {
    const rows = dataJson.shunt_control_results;
    if (!Array.isArray(rows) || rows.length === 0 || !dataJson.shunts?.length) return;
    const byCellId = new Map();
    const byInternalName = new Map();
    for (const row of rows) {
        if (row?.element !== 'shunt') continue;
        if (row.cell_id) byCellId.set(String(row.cell_id), row);
        if (row.id != null) byInternalName.set(String(row.id), row);
        if (row.name != null) byInternalName.set(String(row.name), row);
    }
    for (const s of dataJson.shunts) {
        let m = s.id != null ? byCellId.get(String(s.id)) : null;
        if (!m && s.name != null) m = byInternalName.get(String(s.name));
        if (m) s.shunt_control_result = m;
    }
}

function formatTapControlOnTrafo(cell) {
    const tc = cell.tap_control_result;
    if (!tc) return '';
    const range = `[${formatNumber(tc.tap_min, 0)}…${formatNumber(tc.tap_max, 0)}]`;
    if (tc.tap_pos_initial != null && Number(tc.tap_pos_initial) !== Number(tc.tap_pos)) {
        return `\n            tap_pos: ${formatNumber(tc.tap_pos_initial, 0)} → ${formatNumber(tc.tap_pos, 0)} ${range}`;
    }
    return `\n            tap_pos: ${formatNumber(tc.tap_pos, 0)} ${range}`;
}

function formatShuntControlOnShunt(cell) {
    const sc = cell.shunt_control_result;
    if (!sc) {
        if (cell.step != null && !Number.isNaN(Number(cell.step))) {
            const mx = cell.max_step != null ? formatNumber(cell.max_step, 0) : '—';
            return `\n            step: ${formatNumber(cell.step, 0)} [0…${mx}]`;
        }
        return '';
    }
    const range = `[0…${formatNumber(sc.max_step, 0)}]`;
    if (sc.step_initial != null && Number(sc.step_initial) !== Number(sc.step)) {
        return `\n            step: ${formatNumber(sc.step_initial, 0)} → ${formatNumber(sc.step, 0)} ${range}`;
    }
    return `\n            step: ${formatNumber(sc.step, 0)} ${range}`;
}

function updateOrCreatePlaceholder(graph, parent, text, opts) {
    const model = graph.getModel();
    const existing = findPlaceholder(graph, parent);
    if (existing) {
        model.setValue(existing, text);
        return existing;
    }
    return insertBox(graph, parent, text, opts);
}

/** Edge-attached injectors (External Grid, Generator, …): placeholder lives on the edge, not the vertex. */
function updateEdgeAttachedPlaceholder(graph, resultCell, text, opts) {
    const model = graph.getModel();
    const edge = (graph.getEdges && graph.getEdges(resultCell))?.[0];
    const parent = edge || resultCell;
    if (edge) {
        const orphanOnVertex = findPlaceholder(graph, resultCell);
        if (orphanOnVertex) {
            try { model.remove(orphanOnVertex); } catch (_) { /* noop */ }
        }
    }
    return updateOrCreatePlaceholder(graph, parent, text, opts);
}

/**
 * @param {mxGraph} graph
 * @param {object} dataJson - pandapower load-flow result payload
 */
export function applyLoadFlowResultsToGraph(graph, dataJson) {
    if (!graph || !dataJson) return;

    mergeTapControlIntoTransformers(dataJson);
    mergeShuntControlIntoShunts(dataJson);

    const lookup = buildGraphCellLookupMap(graph);
    const resolveCell = (row) => resolveGraphCellForResult(lookup, row, graph);

    if (typeof window !== 'undefined' && typeof window.clearFlowArrows === 'function') {
        window.clearFlowArrows(graph);
    }

    const model = graph.getModel();
    model.beginUpdate();
    try {
        (dataJson.busbars || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Bus');
            const d = busDisplayPq(cell);
            const qLine = (typeof window !== 'undefined' && window.formatBusNetReactiveQ)
                ? window.formatBusNetReactiveQ(d.q)
                : `Q[MVar]: ${formatNumber(d.q)}`;
            const text = `${label}
U[pu]: ${formatNumber(cell.vm_pu)}
U[kV]: ${formatBusVmKvForCell(cell, resultCell)}
U[deg]: ${formatNumber(cell.va_degree)}
P[MW]: ${formatNumber(d.p)}
${qLine}
PF: ${formatNumber(d.pf)}
Q/P: ${formatNumber(d.qp)}`;
            updateOrCreatePlaceholder(graph, resultCell, text, {
                width: 80, height: 76, positionX: 0, positionY: 1.0, offsetXDelta: 40, offsetYDelta: 35
            });
            processVoltageColor(graph, resultCell, cell.vm_pu);
        });

        (dataJson.lines || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Line');
            const text = `${label}
            P_from[MW]: ${formatNumber(cell.p_from_mw)}
            Q_from[MVar]: ${formatNumber(cell.q_from_mvar)}
            i_from[kA]: ${formatNumber(cell.i_from_ka)}
            Loading[%]: ${formatNumber(cell.loading_percent, 1)}
            P_to[MW]: ${formatNumber(cell.p_to_mw)}
            Q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
            i_to[kA]: ${formatNumber(cell.i_to_ka)}`;
            const edge = (graph.getEdges && graph.getEdges(resultCell))?.[0];
            const parent = edge || resultCell;
            updateOrCreatePlaceholder(graph, parent, text, { width: 70, height: 70, positionX: 0.5, positionY: 0, isLine: true });
            processLoadingColor(graph, resultCell, cell.loading_percent);
        });

        (dataJson.transformers || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Trafo');
            const tapBlock = formatTapControlOnTrafo(cell);
            const text = `${label}
            P_HV[MW]: ${formatNumber(cell.p_hv_mw)}
            P_LV[MW]: ${formatNumber(cell.p_lv_mw)}
            i_HV[kA]: ${formatNumber(cell.i_hv_ka)}
            i_LV[kA]: ${formatNumber(cell.i_lv_ka)}
            loading[%]: ${formatNumber(cell.loading_percent)}${tapBlock}`;
            let existing = findPlaceholderForComponent(graph, resultCell);
            if (!existing) {
                const edge = (graph.getEdges && graph.getEdges(resultCell))?.[0];
                existing = findPlaceholder(graph, edge || resultCell);
            }
            const parent = existing ? model.getParent(existing) : ((graph.getEdges && graph.getEdges(resultCell))?.[0] || resultCell);
            updateOrCreatePlaceholder(graph, parent, text, { width: 68, height: 64, positionX: -0.3, connectedToId: resultCell.id });
            processLoadingColor(graph, resultCell, cell.loading_percent);
        });

        (dataJson.transformers3W || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Trafo 3W');
            const text = `${label}
            P_HV[MW]: ${formatNumber(cell.p_hv_mw)}
            P_MV[MW]: ${formatNumber(cell.p_mv_mw)}
            P_LV[MW]: ${formatNumber(cell.p_lv_mw)}
            loading[%]: ${formatNumber(cell.loading_percent)}`;
            updateOrCreatePlaceholder(graph, resultCell, text, { width: 68, height: 64, positionX: -0.3 });
            processLoadingColor(graph, resultCell, cell.loading_percent);
        });

        (dataJson.externalgrids || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'External Grid');
            const qLine = (typeof window !== 'undefined' && window.formatExternalGridReactiveQ)
                ? window.formatExternalGridReactiveQ(cell.q_mvar)
                : `Q[MVar]: ${formatNumber(cell.q_mvar)}`;
            const text = `${label}
            P[MW]: ${formatNumber(cell.p_mw)}
            ${qLine}
            PF: ${formatNumber(cell.pf)}
            Q/P: ${formatNumber(cell.q_p)}`;
            updateEdgeAttachedPlaceholder(graph, resultCell, text, { width: 95, height: 68, positionX: -0.3 });
        });

        (dataJson.staticgenerators || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Static Generator');
            const text = `${label}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;
            updateEdgeAttachedPlaceholder(graph, resultCell, text, { width: 60, height: 40, positionX: -0.3 });
        });

        (dataJson.generators || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Generator');
            const text = `${label}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            U[degree]: ${formatNumber(cell.va_degree)}
            Um[pu]: ${formatNumber(cell.vm_pu)}`;
            updateEdgeAttachedPlaceholder(graph, resultCell, text, { width: 60, height: 40, positionX: -0.3 });
        });

        (dataJson.shunts || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Shunt');
            const shuntCtl = formatShuntControlOnShunt(cell);
            const text = `${label}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}
            U[pu]: ${formatNumber(cell.vm_pu)}${shuntCtl}`;
            updateOrCreatePlaceholder(graph, resultCell, text, { width: 60, height: 44, positionX: -0.3 });
        });

        (dataJson.loads || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Load');
            const text = `${label}
            P[MW]: ${formatNumber(cell.p_mw)}
            Q[MVar]: ${formatNumber(cell.q_mvar)}`;
            updateEdgeAttachedPlaceholder(graph, resultCell, text, { width: 60, height: 40, positionX: -0.3 });
        });

        (dataJson.switches || []).forEach((cell) => {
            const resultCell = resolveCell(cell);
            if (!resultCell) return;
            const label = formatResultNameHeader(resultCell, replaceUnderscores(cell.name), 'Switch');
            const text = `${label}
closed: ${(cell.closed === false || cell.closed === 'false') ? 'false' : 'true'}
P_from[MW]: ${formatNumber(cell.p_from_mw)}
Q_from[MVar]: ${formatNumber(cell.q_from_mvar)}
P_to[MW]: ${formatNumber(cell.p_to_mw)}
Q_to[MVar]: ${formatNumber(cell.q_to_mvar)}
i[kA]: ${formatNumber(cell.i_ka)}
Loading[%]: ${formatNumber(cell.loading_percent, 1)}`;
            updateOrCreatePlaceholder(graph, resultCell, text, {
                width: 78, height: 102, positionX: 0, positionY: 0, offsetXDelta: 90, connectedToId: resultCell.id
            });
            processLoadingColor(graph, resultCell, cell.loading_percent);
        });
    } finally {
        model.endUpdate();
        if (graph.getView?.().refresh) graph.getView().refresh();
    }

    try {
        window.__electrisimLastLoadFlowResultJson = dataJson;
    } catch (_) { /* non-browser */ }
}

if (typeof window !== 'undefined') {
    window.applyLoadFlowResultsToGraph = applyLoadFlowResultsToGraph;
}
