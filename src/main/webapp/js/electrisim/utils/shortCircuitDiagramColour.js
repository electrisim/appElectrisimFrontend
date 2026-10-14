/**
 * After a successful short-circuit study, drop load-flow (and other) diagram
 * colours and paint buses, lines, and transformers from the fault results.
 *
 * Buses: green → red by Ik" relative to the highest Ik" in this study.
 * Lines and transformers: same scale by fault current versus rated current
 * (line max_i_ka, or Sn / (√3 · Un) on a transformer winding). If the element
 * has no rating, colour by Ik" relative to the other unrated branches.
 */

import { buildGraphCellLookupMap, resolveGraphCellForResult } from './attributeUtils.js';

const STUDY_FLAG = 'elStudyColour';
const STUDY_BASE = 'elStudyBaseStroke';

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toHex2(v) {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length < 2 ? '0' + s : s;
}

function rgbHex(r, g, b) {
    return '#' + toHex2(r) + toHex2(g) + toHex2(b);
}

/** Same green → amber → red scale as load-flow line loading. */
export function dutyColor(percent) {
    const p = Number(percent);
    if (!Number.isFinite(p)) return null;
    const stops = [
        [0, [46, 125, 50]],
        [60, [249, 168, 37]],
        [85, [239, 108, 0]],
        [100, [198, 40, 40]]
    ];
    if (p <= stops[0][0]) return rgbHex(stops[0][1][0], stops[0][1][1], stops[0][1][2]);
    const last = stops[stops.length - 1];
    if (p >= last[0]) return rgbHex(last[1][0], last[1][1], last[1][2]);
    for (let i = 1; i < stops.length; i++) {
        if (p <= stops[i][0]) {
            const lo = stops[i - 1];
            const hi = stops[i];
            const t = (p - lo[0]) / (hi[0] - lo[0]);
            return rgbHex(
                lo[1][0] + (hi[1][0] - lo[1][0]) * t,
                lo[1][1] + (hi[1][1] - lo[1][1]) * t,
                lo[1][2] + (hi[1][2] - lo[1][2]) * t
            );
        }
    }
    return rgbHex(last[1][0], last[1][1], last[1][2]);
}

const GRADIENT_SAMPLES = [];
for (let p = 0; p <= 140; p += 1) GRADIENT_SAMPLES.push(dutyColor(p));

function parseHex(color) {
    const m = String(color || '').trim().match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const h = m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function nearGradient(color) {
    const rgb = parseHex(color);
    if (!rgb) return false;
    for (let i = 0; i < GRADIENT_SAMPLES.length; i++) {
        const g = parseHex(GRADIENT_SAMPLES[i]);
        const d = Math.abs(rgb[0] - g[0]) + Math.abs(rgb[1] - g[1]) + Math.abs(rgb[2] - g[2]);
        if (d <= 8) return true;
    }
    return false;
}

/** True for strokes written by load flow or by this short-circuit colouring. */
export function isAnalysisStroke(color) {
    const c = String(color || '').trim().toLowerCase();
    if (!c || c === 'none') return false;
    if (c === 'red' || c === 'orange' || c === 'green') return true;
    if (c === '#ff0000' || c === '#ffa500' || c === '#008000' || c === '#00ff00') return true;
    return nearGradient(c);
}

function styleValue(style, key) {
    const m = String(style || '').match(new RegExp('(?:^|;)' + key + '=([^;]*)'));
    return m ? m[1] : null;
}

function cellStyle(model, cell) {
    return (model.getStyle && model.getStyle(cell)) || cell.style || '';
}

function isSkippedShape(style) {
    const s = String(style || '');
    if (!s.includes('shapeELXXX=')) return true;
    if (s.includes('shapeELXXX=Result')) return true;
    if (s.includes('shapeELXXX=FaultMarker')) return true;
    if (s.includes('shapeELXXX=NotEditable')) return true;
    if (styleValue(s, 'electrisimOutOfService') === '1') return true;
    return false;
}

function listCells(graph) {
    const model = graph.getModel();
    if (typeof model.getDescendants === 'function') return model.getDescendants() || [];
    return Object.values(model.cells || {});
}

function setStyleKey(style, key, value) {
    if (typeof mxUtils !== 'undefined') return mxUtils.setStyle(style, key, value);
    const parts = String(style || '').split(';').filter((p) => p && p.split('=')[0] !== key);
    if (value != null && value !== '') parts.push(key + '=' + value);
    return parts.join(';');
}

function attr(cell, name) {
    const v = cell && cell.value;
    if (v && typeof v.getAttribute === 'function') {
        const raw = v.getAttribute(name);
        if (raw != null && raw !== '') return raw;
    }
    return null;
}

function busFaultKa(row) {
    return num(row && (row.ikss_ka ?? row.i_first_sym_ka ?? row.i_ka));
}

function branchFaultKa(row) {
    if (!row) return null;
    const direct = num(row.ikss_ka ?? row.i_first_sym_ka ?? row.i_ka);
    if (direct != null) return direct;
    const ends = [row.i_from_ka, row.i_to_ka, row.ikss_from_ka, row.ikss_to_ka]
        .map(num)
        .filter((n) => n != null);
    if (!ends.length) return null;
    return Math.max(...ends);
}

function ratedCurrentKa(snMva, vnKv) {
    const sn = num(snMva);
    const vn = num(vnKv);
    if (!(sn > 0) || !(vn > 0)) return null;
    return sn / (Math.sqrt(3) * vn);
}

function trafoDutyPercent(cell, row) {
    const pairs = [
        [row.ikss_hv_ka ?? row.i_hv_ka, attr(cell, 'vn_hv_kv'), attr(cell, 'sn_mva') || attr(cell, 'sn_hv_mva')],
        [row.ikss_mv_ka ?? row.i_mv_ka, attr(cell, 'vn_mv_kv'), attr(cell, 'sn_mv_mva')],
        [row.ikss_lv_ka ?? row.i_lv_ka, attr(cell, 'vn_lv_kv'), attr(cell, 'sn_mva') || attr(cell, 'sn_lv_mva')]
    ];
    let worst = null;
    pairs.forEach(([iKa, vn, sn]) => {
        const ik = num(iKa);
        const ir = ratedCurrentKa(sn, vn);
        if (ik == null || !(ir > 0)) return;
        const pct = (ik / ir) * 100;
        if (worst == null || pct > worst) worst = pct;
    });
    return worst;
}

function lineDutyPercent(cell, row) {
    const ik = branchFaultKa(row);
    const ir = num(attr(cell, 'max_i_ka'));
    if (ik == null || !(ir > 0)) return null;
    return (ik / ir) * 100;
}

function rememberBaseStroke(style) {
    if (styleValue(style, STUDY_BASE) != null) return style;
    const current = styleValue(style, 'strokeColor');
    const base = (!current || isAnalysisStroke(current)) ? '-' : encodeURIComponent(current);
    return setStyleKey(style, STUDY_BASE, base);
}

function applyStroke(graph, cell, color) {
    const model = graph.getModel();
    let style = rememberBaseStroke(cellStyle(model, cell));
    style = setStyleKey(style, STUDY_FLAG, '1');
    const strokeKey = (typeof mxConstants !== 'undefined' && mxConstants.STYLE_STROKECOLOR) || 'strokeColor';
    style = setStyleKey(style, strokeKey, color);
    if (typeof graph.setCellStyle === 'function') graph.setCellStyle(style, [cell]);
    else model.setStyle(cell, style);
}

function clearAnalysisStroke(graph, cell) {
    const model = graph.getModel();
    let style = cellStyle(model, cell);
    const stroke = styleValue(style, 'strokeColor');
    const flagged = styleValue(style, STUDY_FLAG) === '1';
    if (!flagged && !isAnalysisStroke(stroke)) return false;
    const encoded = styleValue(style, STUDY_BASE);
    let base = null;
    if (encoded && encoded !== '-') {
        try { base = decodeURIComponent(encoded); } catch (_) { base = null; }
    }
    style = setStyleKey(style, STUDY_FLAG, null);
    style = setStyleKey(style, STUDY_BASE, null);
    const strokeKey = (typeof mxConstants !== 'undefined' && mxConstants.STYLE_STROKECOLOR) || 'strokeColor';
    style = setStyleKey(style, strokeKey, base);
    if (typeof graph.setCellStyle === 'function') graph.setCellStyle(style, [cell]);
    else model.setStyle(cell, style);
    return true;
}

function stopOtherStudyVisuals(graph) {
    if (typeof window === 'undefined') return;
    try { window.stopLoadFlowDiagramColour && window.stopLoadFlowDiagramColour(); } catch (_) { /* ignore */ }
    try { window.stopLoadFlowPowerAnimation && window.stopLoadFlowPowerAnimation(); } catch (_) { /* ignore */ }
    try { window.clearFlowArrows && window.clearFlowArrows(graph); } catch (_) { /* ignore */ }
    try { window.hideFlowConventionLegend && window.hideFlowConventionLegend(); } catch (_) { /* ignore */ }
}

function resolveRows(graph, rows) {
    let lookup = null;
    try { lookup = buildGraphCellLookupMap(graph); } catch (_) { lookup = null; }
    const out = [];
    (rows || []).forEach((row) => {
        if (!row) return;
        let cell = null;
        try { cell = resolveGraphCellForResult(lookup, row, graph); } catch (_) { cell = null; }
        if (!cell && graph.getModel) {
            const model = graph.getModel();
            const id = row.id != null ? String(row.id) : '';
            cell = (id && model.getCell && model.getCell(id)) || null;
        }
        if (cell) out.push({ cell, row });
    });
    return out;
}

/**
 * Clear previous analysis colours and paint this short-circuit result.
 * @returns {number} cells coloured from the short-circuit result
 */
export function applyShortCircuitDiagramColours(graph, dataJson) {
    if (!graph?.getModel || !dataJson || dataJson.error) return 0;
    const busRows = dataJson.busbars || dataJson.buses || [];
    const lineRows = dataJson.lines_sc || [];
    const trafoRows = dataJson.trafos_sc || [];
    const trafo3Rows = dataJson.trafos3w_sc || [];
    if (!busRows.length && !lineRows.length && !trafoRows.length && !trafo3Rows.length) return 0;

    stopOtherStudyVisuals(graph);

    const colorByCell = new Map();

    const buses = resolveRows(graph, busRows);
    let maxBus = 0;
    buses.forEach(({ row }) => {
        const ik = busFaultKa(row);
        if (ik != null && ik > maxBus) maxBus = ik;
    });
    buses.forEach(({ cell, row }) => {
        const ik = busFaultKa(row);
        if (ik == null || !(maxBus > 0)) return;
        const color = dutyColor((ik / maxBus) * 100);
        if (color) colorByCell.set(cell, color);
    });

    const lineHits = resolveRows(graph, lineRows);
    const trafoHits = resolveRows(graph, trafoRows.concat(trafo3Rows));
    const unrated = [];

    lineHits.forEach((hit) => {
        const pct = lineDutyPercent(hit.cell, hit.row);
        if (pct != null) {
            const color = dutyColor(pct);
            if (color) colorByCell.set(hit.cell, color);
        } else {
            const ik = branchFaultKa(hit.row);
            if (ik != null) unrated.push({ cell: hit.cell, ik });
        }
    });
    trafoHits.forEach((hit) => {
        const pct = trafoDutyPercent(hit.cell, hit.row);
        if (pct != null) {
            const color = dutyColor(pct);
            if (color) colorByCell.set(hit.cell, color);
        } else {
            const ik = branchFaultKa(hit.row)
                ?? num(hit.row.ikss_hv_ka ?? hit.row.i_hv_ka)
                ?? num(hit.row.ikss_lv_ka ?? hit.row.i_lv_ka);
            if (ik != null) unrated.push({ cell: hit.cell, ik });
        }
    });
    let maxUnrated = 0;
    unrated.forEach((item) => { if (item.ik > maxUnrated) maxUnrated = item.ik; });
    unrated.forEach((item) => {
        if (!(maxUnrated > 0) || colorByCell.has(item.cell)) return;
        const color = dutyColor((item.ik / maxUnrated) * 100);
        if (color) colorByCell.set(item.cell, color);
    });

    const model = graph.getModel();
    const alreadyUpdating = typeof model.updateLevel === 'number' && model.updateLevel > 0;
    if (!alreadyUpdating && typeof model.beginUpdate === 'function') model.beginUpdate();
    try {
        listCells(graph).forEach((cell) => {
            if (!cell) return;
            const style = cellStyle(model, cell);
            if (isSkippedShape(style)) return;
            if (colorByCell.has(cell)) return;
            clearAnalysisStroke(graph, cell);
        });
        colorByCell.forEach((color, cell) => applyStroke(graph, cell, color));
    } finally {
        if (!alreadyUpdating && typeof model.endUpdate === 'function') model.endUpdate();
    }
    if (graph.getView && graph.getView().refresh) {
        try { graph.getView().refresh(); } catch (_) { /* ignore */ }
    }
    return colorByCell.size;
}

if (typeof window !== 'undefined') {
    window.applyShortCircuitDiagramColours = applyShortCircuitDiagramColours;
}
