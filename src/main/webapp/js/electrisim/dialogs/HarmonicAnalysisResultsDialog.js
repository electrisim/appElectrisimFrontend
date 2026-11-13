/**
 * Results of the OpenDSS harmonic analysis (backend harmonic_analysis):
 *  - Bus voltages: VTHD and individual harmonics per bus, rated against IEEE 519 / IEC limits
 *  - Branch currents: ITHD and harmonic currents of lines and transformers
 *  - Frequency scan: impedance seen from the scanned buses over frequency, with resonances
 * plus the operating point the study started from, warnings and a CSV export.
 */

import { createDialogNameResolver } from '../utils/attributeUtils.js';
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
import { HARMONIC_LIMIT_STANDARDS, harmonicVoltageLimits, rateBusHarmonics } from '../utils/harmonicLimits.js';

const NS = 'http://www.w3.org/2000/svg';
const FONT = 'Arial, sans-serif';
const SERIES_COLORS = ['#1976d2', '#e65100', '#2e7d32', '#8e24aa', '#00838f', '#c62828'];
const STANDARD_KEY = 'electrisimHarmonicLimitStandard';
const OK_COLOR = '#2e7d32';
const OVER_COLOR = '#c62828';

function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v != null && v !== '') n.setAttribute(k, String(v));
        }
    }
    if (parent) parent.appendChild(n);
    return n;
}

function node(tag, style, text) {
    const n = document.createElement(tag);
    if (style) Object.assign(n.style, style);
    if (text != null) n.textContent = text;
    return n;
}

function fmtNum(v, decimals = 3) {
    if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
    return Number(v).toFixed(decimals);
}

/** Enough decimals to show a small value: 12.3, 1.23, 0.123, 0.0123. */
function fmtAuto(v) {
    const x = Number(v);
    if (!Number.isFinite(x)) return '—';
    const a = Math.abs(x);
    if (a === 0) return '0';
    if (a >= 100) return x.toFixed(0);
    if (a >= 10) return x.toFixed(1);
    if (a >= 1) return x.toFixed(2);
    if (a >= 0.1) return x.toFixed(3);
    return x.toFixed(4);
}

/** Line-to-line fundamental kV for spectrum %; backend field may be missing if bus key mismatch. */
function fundamentalVoltageKv(bus) {
    const f = Number(bus.fundamental_voltage_kv);
    if (Number.isFinite(f) && f > 1e-9) return f;
    const est = Number(bus.vm_pu) * Number(bus.vn_kv);
    return Number.isFinite(est) && est > 1e-9 ? est : 0;
}

/** [{order, value, pct}] of one result row; values from `field` in % of `fundamental`. */
function spectrumOf(row, field, fundamental, orders) {
    const values = row[field] || {};
    return orders.map((h) => {
        const raw = Number(values[String(h)] != null ? values[String(h)] : values[h]);
        const value = Number.isFinite(raw) ? raw : 0;
        const pct = fundamental > 1e-9 ? (value / fundamental) * 100 : 0;
        return { order: h, value, pct: Number.isFinite(pct) ? pct : 0 };
    });
}

function niceTicks(max, count = 4) {
    if (!(max > 0)) return [0, 1];
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
    const ticks = [];
    for (let v = 0; v <= max + step * 0.5; v += step) ticks.push(v);
    return ticks;
}

/**
 * Bar chart of a harmonic spectrum.
 * points: [{order, y, limit?}] - a bar above its limit is drawn in red, the limit as a tick.
 */
function drawSpectrumSvg(svg, points, yTitle) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = 860;
    const H = 250;
    const ml = 64;
    const mr = 16;
    const mt = 16;
    const mb = 42;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!points.length) return;

    const dataMax = Math.max(...points.map((p) => Math.max(p.y, p.limit != null ? p.limit : 0)), 1e-9);
    const ticks = niceTicks(dataMax * 1.08);
    const yMax = ticks[ticks.length - 1];
    const yFor = (v) => mt + plotH - (Math.min(v, yMax) / yMax) * plotH;

    ticks.forEach((t) => {
        const y = yFor(t);
        el('line', { x1: ml, y1: y, x2: ml + plotW, y2: y, stroke: t === 0 ? '#adb5bd' : '#eef0f2', 'stroke-width': 1 }, svg);
        el('text', { x: ml - 8, y: y + 4, fill: '#868e96', 'font-size': 10, 'text-anchor': 'end', 'font-family': FONT }, svg)
            .textContent = fmtAuto(t);
    });
    el('text', {
        x: 16, y: mt + plotH / 2, fill: '#868e96', 'font-size': 10, 'text-anchor': 'middle',
        transform: `rotate(-90 16 ${mt + plotH / 2})`, 'font-family': FONT
    }, svg).textContent = yTitle;

    const slot = plotW / points.length;
    const barW = Math.max(3, Math.min(30, slot * 0.62));
    const labelEvery = Math.max(1, Math.ceil(points.length / 26));
    points.forEach((p, i) => {
        const cx = ml + slot * (i + 0.5);
        const over = p.limit != null && p.y > p.limit;
        const y0 = yFor(p.y);
        const rect = el('rect', {
            x: cx - barW / 2, y: y0, width: barW, height: Math.max(p.y > 0 ? 1 : 0, mt + plotH - y0),
            fill: over ? OVER_COLOR : '#1976d2', rx: 1.5
        }, svg);
        el('title', null, rect).textContent =
            `h = ${p.order}: ${fmtAuto(p.y)}${p.limit != null ? ` (limit ${fmtAuto(p.limit)})` : ''}`;
        if (p.limit != null && p.limit <= yMax) {
            const yl = yFor(p.limit);
            el('line', {
                x1: cx - slot * 0.42, y1: yl, x2: cx + slot * 0.42, y2: yl,
                stroke: '#495057', 'stroke-width': 1.2, 'stroke-dasharray': '3 2'
            }, svg);
        }
        if (i % labelEvery === 0) {
            el('text', { x: cx, y: mt + plotH + 15, fill: '#495057', 'font-size': 10, 'text-anchor': 'middle', 'font-family': FONT }, svg)
                .textContent = String(p.order);
        }
    });
    el('text', { x: ml + plotW / 2, y: H - 8, fill: '#868e96', 'font-size': 10, 'text-anchor': 'middle', 'font-family': FONT }, svg)
        .textContent = 'Harmonic order';
}

/** Impedance-over-frequency chart; series: [{label, color, z:[], resonances:[{order,z_ohm}]}]. */
function drawScanSvg(svg, orders, series, logScale, baseHz, readout) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = 860;
    const H = 320;
    const ml = 64;
    const mr = 16;
    const mt = 14;
    const mb = 40;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!orders.length || !series.length) return;

    const all = series.flatMap((s) => s.z.filter((v) => Number.isFinite(v) && v > 0));
    if (!all.length) return;
    const zMax = Math.max(...all);
    const zMin = Math.min(...all);
    const hMin = 1;
    const hMax = orders[orders.length - 1];
    const xFor = (h) => ml + ((h - hMin) / (hMax - hMin)) * plotW;
    let yFor;
    let yTicks;
    if (logScale) {
        const lo = Math.floor(Math.log10(zMin));
        const hi = Math.ceil(Math.log10(zMax));
        yFor = (v) => mt + plotH - ((Math.log10(Math.max(v, Math.pow(10, lo))) - lo) / Math.max(hi - lo, 1)) * plotH;
        yTicks = [];
        for (let e = lo; e <= hi; e++) yTicks.push(Math.pow(10, e));
    } else {
        yTicks = niceTicks(zMax * 1.05);
        const top = yTicks[yTicks.length - 1];
        yFor = (v) => mt + plotH - (v / top) * plotH;
    }

    yTicks.forEach((t) => {
        const y = yFor(t);
        el('line', { x1: ml, y1: y, x2: ml + plotW, y2: y, stroke: '#eef0f2', 'stroke-width': 1 }, svg);
        el('text', { x: ml - 8, y: y + 4, fill: '#868e96', 'font-size': 10, 'text-anchor': 'end', 'font-family': FONT }, svg)
            .textContent = t >= 1000 ? `${fmtAuto(t / 1000)}k` : fmtAuto(t);
    });
    const xStep = hMax <= 12 ? 1 : (hMax <= 30 ? 2 : 5);
    for (let h = hMin; h <= hMax + 1e-9; h += (h === 1 && xStep > 1 ? xStep - 1 : xStep)) {
        const x = xFor(h);
        el('line', { x1: x, y1: mt, x2: x, y2: mt + plotH, stroke: '#f1f3f5', 'stroke-width': 1 }, svg);
        el('text', { x, y: mt + plotH + 15, fill: '#495057', 'font-size': 10, 'text-anchor': 'middle', 'font-family': FONT }, svg)
            .textContent = String(h);
    }
    el('rect', { x: ml, y: mt, width: plotW, height: plotH, fill: 'none', stroke: '#adb5bd', 'stroke-width': 1 }, svg);
    el('text', {
        x: 16, y: mt + plotH / 2, fill: '#868e96', 'font-size': 10, 'text-anchor': 'middle',
        transform: `rotate(-90 16 ${mt + plotH / 2})`, 'font-family': FONT
    }, svg).textContent = '|Z| positive sequence [Ω]';
    el('text', { x: ml + plotW / 2, y: H - 6, fill: '#868e96', 'font-size': 10, 'text-anchor': 'middle', 'font-family': FONT }, svg)
        .textContent = `Harmonic order (× ${baseHz} Hz)`;

    series.forEach((s) => {
        let d = '';
        let pen = false;
        orders.forEach((h, i) => {
            const v = s.z[i];
            if (!Number.isFinite(v) || v <= 0) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${xFor(h).toFixed(1)},${yFor(v).toFixed(1)}`;
            pen = true;
        });
        el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, svg);
        (s.resonances || []).forEach((r) => {
            const cx = xFor(r.order);
            const cy = yFor(r.z_ohm);
            el('circle', { cx, cy, r: 3.5, fill: '#fff', stroke: s.color, 'stroke-width': 1.6 }, svg);
            el('text', { x: cx, y: Math.max(mt + 9, cy - 7), fill: s.color, 'font-size': 10, 'text-anchor': 'middle', 'font-family': FONT, 'font-weight': 600 }, svg)
                .textContent = fmtNum(r.order, 1);
        });
    });

    // Read-out under the pointer
    const cursor = el('line', { x1: 0, y1: mt, x2: 0, y2: mt + plotH, stroke: '#495057', 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: ml, y: mt, width: plotW, height: plotH, fill: 'transparent' }, svg);
    hit.addEventListener('mousemove', (ev) => {
        const box = svg.getBoundingClientRect();
        const x = ((ev.clientX - box.left) / box.width) * W;
        const h = hMin + ((x - ml) / plotW) * (hMax - hMin);
        let idx = 0;
        let best = Infinity;
        orders.forEach((o, i) => { const dist = Math.abs(o - h); if (dist < best) { best = dist; idx = i; } });
        cursor.setAttribute('x1', xFor(orders[idx]));
        cursor.setAttribute('x2', xFor(orders[idx]));
        cursor.setAttribute('visibility', 'visible');
        if (readout) {
            readout.textContent = `h = ${fmtNum(orders[idx], 2)} (${fmtNum(orders[idx] * baseHz, 0)} Hz):  ` +
                series.map((s) => `${s.label}: ${fmtAuto(s.z[idx])} Ω`).join('   |   ');
        }
    });
    hit.addEventListener('mouseleave', () => {
        cursor.setAttribute('visibility', 'hidden');
        if (readout) readout.textContent = 'Move the pointer over the chart to read the impedance.';
    });
}

function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
    const text = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TH_STYLE = {
    padding: '8px', backgroundColor: '#e9ecef', borderBottom: '2px solid #dee2e6',
    position: 'sticky', top: '0', zIndex: '2', whiteSpace: 'nowrap', textAlign: 'right'
};
const TD_NUM = { padding: '6px 8px', textAlign: 'right', fontFamily: 'Consolas, monospace', whiteSpace: 'nowrap' };

/** Table with a sticky header row and a sticky first column. */
function buildTable(headers, rows) {
    const wrap = node('div', { overflow: 'auto', maxHeight: '300px', border: '1px solid #e9ecef', borderRadius: '6px' });
    const table = node('table', { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    headers.forEach((text, i) => {
        const th = node('th', TH_STYLE, text);
        if (i === 0) Object.assign(th.style, { textAlign: 'left', left: '0', zIndex: '3' });
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach((cells) => {
        const tr = node('tr', { borderBottom: '1px solid #eee' });
        cells.forEach((cell, i) => {
            const spec = cell && typeof cell === 'object' ? cell : { text: cell };
            const td = node('td', i === 0
                ? { padding: '6px 8px', fontWeight: '500', position: 'sticky', left: '0', backgroundColor: '#fff', whiteSpace: 'nowrap', zIndex: '1' }
                : TD_NUM, spec.text == null ? '—' : String(spec.text));
            if (spec.style) Object.assign(td.style, spec.style);
            if (spec.title) td.title = spec.title;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
}

function styledSelect(options, value) {
    const sel = node('select', {
        padding: '6px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px',
        backgroundColor: '#fff', maxWidth: '100%'
    });
    options.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;
        sel.appendChild(opt);
    });
    if (value != null) sel.value = String(value);
    return sel;
}

function labelled(text, control) {
    const wrap = node('label', { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#495057', fontSize: '13px' }, text);
    wrap.appendChild(control);
    return wrap;
}

/**
 * @param {object} dataJson — full OpenDSS backend response after harmonic analysis
 * @param {import('mxgraph').mxGraph} [graph] — when set, labels use the same `name` as the element dialogs
 */
export function showHarmonicAnalysisResultsDialog(dataJson, graph) {
    const meta = dataJson.harmonic_analysis;
    const busbars = Array.isArray(dataJson.busbars) ? dataJson.busbars : [];
    if (!meta || !meta.executed || !busbars.length) {
        console.warn('showHarmonicAnalysisResultsDialog: missing harmonic_analysis or busbars');
        return;
    }
    if (typeof window !== 'undefined') window.__electrisimLastHarmonicResultJson = dataJson;

    const dialogNameFor = createDialogNameResolver(graph);
    const nameCounts = new Map();
    const dialogName = (row) => {
        let name = '';
        try { name = dialogNameFor(row) || ''; } catch (e) { name = ''; }
        return String(name).trim();
    };
    const allRows = [
        ...busbars,
        ...(dataJson.lines || []),
        ...(dataJson.transformers || []),
        ...(dataJson.transformers3w || dataJson.transformers3W || [])
    ];
    allRows.forEach((row) => {
        const n = dialogName(row);
        if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
    });
    /** The element's own name; the backend id is added only when the name is not unique. */
    const labelOf = (row) => {
        const name = dialogName(row);
        const backend = String(row.name || row.id || '');
        if (!name) return backend || '—';
        return nameCounts.get(name) > 1 && backend && backend !== name ? `${name} (${backend})` : name;
    };

    const orders = Array.isArray(meta.harmonic_orders) && meta.harmonic_orders.length
        ? meta.harmonic_orders.map((h) => Number(h)).filter(Number.isFinite)
        : [3, 5, 7, 11, 13];
    const baseHz = Number(meta.frequency_hz) || 50;

    const buses = busbars
        .filter((b) => b && (b.vthd_percent != null || (b.harmonic_voltages_kv && Object.keys(b.harmonic_voltages_kv).length)))
        .map((b) => {
            const v1 = fundamentalVoltageKv(b);
            return {
                row: b,
                label: labelOf(b),
                vn: Number(b.vn_kv),
                v1,
                thd: Number(b.vthd_percent) || 0,
                spectrum: spectrumOf(b, 'harmonic_voltages_kv', v1, orders)
            };
        });
    if (!buses.length) {
        console.warn('showHarmonicAnalysisResultsDialog: no buses with harmonic fields');
        return;
    }

    const branchOf = (row, type) => {
        const i1 = Number(row.fundamental_current_a) || 0;
        const spectrum = spectrumOf(row, 'harmonic_currents_a', i1, orders);
        return {
            row, type, label: labelOf(row), i1,
            thd: Number(row.ithd_percent) || 0,
            ih: Math.sqrt(spectrum.reduce((sum, p) => sum + p.value * p.value, 0)),
            spectrum
        };
    };
    const branches = [
        ...(dataJson.lines || []).filter((r) => r && r.harmonic_currents_a).map((r) => branchOf(r, 'Line')),
        ...(dataJson.transformers || []).filter((r) => r && r.harmonic_currents_a).map((r) => branchOf(r, 'Transformer')),
        ...(dataJson.transformers3w || dataJson.transformers3W || []).filter((r) => r && r.harmonic_currents_a)
            .map((r) => branchOf(r, '3W Transformer'))
    ].sort((a, b) => b.ih - a.ih);

    const scan = meta.frequency_scan && Array.isArray(meta.frequency_scan.buses) && meta.frequency_scan.buses.length
        ? meta.frequency_scan : null;

    let standard = 'ieee519';
    try {
        const saved = localStorage.getItem(STANDARD_KEY);
        if (HARMONIC_LIMIT_STANDARDS.some((s) => s.value === saved)) standard = saved;
    } catch (e) { /* default */ }
    let unit = 'pct';
    let busSort = 'thd';

    const rate = (bus) => rateBusHarmonics(standard, bus.vn, bus.thd, bus.spectrum);

    // ---- frame ---------------------------------------------------------------
    const overlay = node('div', {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        // above the Network Health Dashboard (10020) that the load-flow part of the study opens
        backgroundColor: 'rgba(0, 0, 0, 0.45)', zIndex: '10050', display: 'flex',
        justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box'
    });
    const box = node('div', {
        backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        width: 'min(1040px, 100%)', maxHeight: 'min(94vh, 980px)', display: 'flex',
        flexDirection: 'column', overflow: 'hidden'
    });
    const titleBar = node('div', {
        padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: '0'
    });
    titleBar.appendChild(node('div', { fontWeight: '600', fontSize: '17px', color: '#212529' }, 'Harmonic Analysis Results'));
    const closeBtn = node('button', {
        border: 'none', background: 'transparent', fontSize: '26px', lineHeight: '1',
        cursor: 'pointer', color: '#6c757d', padding: '0 4px'
    });
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    titleBar.appendChild(closeBtn);

    const body = node('div', {
        padding: '14px 18px 18px', overflowY: 'auto', flex: '1', minHeight: '0',
        fontFamily: FONT, fontSize: '13px', color: '#333'
    });

    // ---- summary ---------------------------------------------------------------
    const summary = node('div', { marginBottom: '8px', lineHeight: '1.5', color: '#495057' });
    const orderText = orders.length > 14
        ? `${orders[0]}–${orders[orders.length - 1]} (${orders.length} orders)` : orders.join(', ');
    summary.innerHTML =
        `<strong>Base frequency:</strong> ${baseHz} Hz &nbsp;|&nbsp; ` +
        `<strong>Harmonic orders:</strong> ${orderText} &nbsp;|&nbsp; ` +
        `<strong>NeglectLoadY:</strong> ${meta.neglectLoadY === true ? 'Yes' : 'No'}`;
    body.appendChild(summary);

    const op = meta.operating_point || {};
    const opLine = node('div', { marginBottom: '10px', lineHeight: '1.5', color: '#495057' });
    const opStrong = node('strong', null, 'Operating point: ');
    opLine.appendChild(opStrong);
    if (op.source === 'pandapower') {
        const parts = ['controlled load flow'];
        (op.statcoms || []).forEach((s) => {
            const q = Number(s.q_inject_mvar);
            parts.push(`STATCOM ${s.label || s.name} ${q >= 0 ? '+' : ''}${fmtAuto(q)} Mvar${s.at_q_limit ? ' (at its limit)' : ''}`);
        });
        (op.shunt_steps || []).filter((s) => s.from !== s.to).forEach((s) => parts.push(`${s.label || s.name} step ${s.from} → ${s.to}`));
        (op.tap_changes || []).forEach((t) => parts.push(`${t.name} tap ${fmtNum(t.from, 0)} → ${fmtNum(t.to, 0)}`));
        if ((op.park_controllers || []).length) parts.push(`park controller applied (${op.park_controllers.length})`);
        if (op.max_voltage_difference_pu != null) {
            parts.push(`OpenDSS voltages within ${fmtNum(op.max_voltage_difference_pu, 3)} pu of the load flow`);
        }
        opLine.appendChild(document.createTextNode(parts.join('; ') + '.'));
    } else {
        opLine.appendChild(document.createTextNode(
            'OpenDSS load flow only (no park controller, STATCOM or tap control).'));
    }
    body.appendChild(opLine);

    const warnings = Array.isArray(meta.warnings) ? meta.warnings.filter(Boolean) : [];
    if (warnings.length) {
        const warnBox = node('div', {
            marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fff8e1', border: '1px solid #ffe082',
            borderRadius: '6px', color: '#6d4c00', lineHeight: '1.45'
        });
        warnings.forEach((w) => warnBox.appendChild(node('div', null, `⚠ ${w}`)));
        body.appendChild(warnBox);
    }

    // ---- toolbar: limits + export ---------------------------------------------
    const toolbar = node('div', { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' });
    const standardSel = styledSelect(HARMONIC_LIMIT_STANDARDS, standard);
    toolbar.appendChild(labelled('Voltage limits:', standardSel));
    const exportBtn = node('button', {
        marginLeft: 'auto', padding: '7px 14px', border: '1px solid #ced4da', borderRadius: '6px',
        backgroundColor: '#fff', color: '#495057', fontSize: '13px', cursor: 'pointer'
    }, 'Export CSV');
    exportBtn.type = 'button';
    toolbar.appendChild(exportBtn);
    body.appendChild(toolbar);

    const tiles = node('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' });
    body.appendChild(tiles);
    const limitNote = node('div', { fontSize: '11px', color: '#868e96', margin: '-6px 0 12px 0' });
    body.appendChild(limitNote);

    function tile(title, value, detail, color) {
        const t = node('div', { padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', backgroundColor: '#fafbfc' });
        t.appendChild(node('div', { fontSize: '11px', color: '#868e96', textTransform: 'uppercase', letterSpacing: '0.4px' }, title));
        t.appendChild(node('div', { fontSize: '20px', fontWeight: '600', color: color || '#212529', margin: '2px 0' }, value));
        t.appendChild(node('div', { fontSize: '12px', color: '#495057', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, detail));
        t.lastChild.title = detail;
        return t;
    }

    function renderTiles() {
        while (tiles.firstChild) tiles.removeChild(tiles.firstChild);
        const worstBus = buses.reduce((a, b) => (b.thd > a.thd ? b : a), buses[0]);
        tiles.appendChild(tile('Highest voltage THD', `${fmtNum(worstBus.thd, 2)} %`,
            `${worstBus.label}${Number.isFinite(worstBus.vn) ? ` (${worstBus.vn} kV)` : ''}`));
        if (standard !== 'none') {
            const over = buses.filter((b) => rate(b).status === 'over');
            tiles.appendChild(tile('Buses above the limits', `${over.length} of ${buses.length}`,
                over.length ? over.slice(0, 3).map((b) => b.label).join(', ') + (over.length > 3 ? '…' : '') : 'All buses within the limits',
                over.length ? OVER_COLOR : OK_COLOR));
        }
        if (branches.length) {
            const loaded = branches.filter((b) => b.i1 > 1);
            const worst = (loaded.length ? loaded : branches).reduce((a, b) => (b.thd > a.thd ? b : a));
            tiles.appendChild(tile('Highest current THD', `${fmtNum(worst.thd, 2)} %`, `${worst.label} (${worst.type})`));
        }
        if (scan) {
            const first = scan.buses[0];
            const res = (first.parallel_resonances || []).slice(0, 4).map((r) => fmtNum(r.order, 1));
            tiles.appendChild(tile('Parallel resonances', res.length ? `h ≈ ${res.join(', ')}` : 'none found', `seen from ${first.label || first.name}`));
        }
        limitNote.textContent = standard === 'none' ? ''
            : 'Limits are a screening aid (individual harmonic and THD limits by nominal voltage); the limits that ' +
              'apply to a project are set by the grid operator, usually at the point of connection.';
    }

    // ---- tabs ------------------------------------------------------------------
    const tabBar = node('div', { display: 'flex', gap: '4px', borderBottom: '1px solid #dee2e6', marginBottom: '12px' });
    const panels = {};
    const tabButtons = {};
    function addTab(key, text) {
        const btn = node('button', {
            padding: '8px 14px', border: 'none', borderBottom: '3px solid transparent', background: 'transparent',
            fontSize: '13px', fontWeight: '600', color: '#6c757d', cursor: 'pointer'
        }, text);
        btn.type = 'button';
        btn.addEventListener('click', () => showTab(key));
        tabBar.appendChild(btn);
        tabButtons[key] = btn;
        panels[key] = node('div', { display: 'none' });
    }
    function showTab(key) {
        Object.keys(panels).forEach((k) => {
            panels[k].style.display = k === key ? 'block' : 'none';
            tabButtons[k].style.color = k === key ? '#1976d2' : '#6c757d';
            tabButtons[k].style.borderBottomColor = k === key ? '#1976d2' : 'transparent';
        });
    }
    addTab('buses', `Bus voltages (${buses.length})`);
    if (branches.length) addTab('branches', `Branch currents (${branches.length})`);
    if (scan) addTab('scan', 'Frequency scan');
    body.appendChild(tabBar);
    Object.values(panels).forEach((p) => body.appendChild(p));

    const chartBox = () => node('div', {
        marginBottom: '12px', padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', backgroundColor: '#fafbfc'
    });
    const controlsRow = () => node('div', { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' });
    const newSvg = (maxHeight) => {
        const svg = document.createElementNS(NS, 'svg');
        Object.assign(svg.style, { width: '100%', maxHeight, display: 'block' });
        return svg;
    };
    const unitOptions = (abs) => [{ value: 'pct', label: '% of fundamental' }, { value: 'abs', label: abs }];

    // ---- bus voltages ------------------------------------------------------------
    const busPanel = panels.buses;
    const busChart = chartBox();
    const busControls = controlsRow();
    const sortedByThd = buses.slice().sort((a, b) => b.thd - a.thd);
    const busSel = styledSelect(
        sortedByThd.map((b) => ({ value: buses.indexOf(b), label: `${b.label}${Number.isFinite(b.vn) ? ` (${b.vn} kV)` : ''} — THD ${fmtNum(b.thd, 2)} %` })),
        buses.indexOf(sortedByThd[0]));
    busSel.style.maxWidth = '460px';
    const busUnitSel = styledSelect(unitOptions('kV'), unit);
    const busSortSel = styledSelect([
        { value: 'thd', label: 'Highest THD first' },
        { value: 'margin', label: 'Closest to the limit first' },
        { value: 'voltage', label: 'Voltage level' },
        { value: 'name', label: 'Name' }
    ], busSort);
    busControls.appendChild(labelled('Spectrum of:', busSel));
    busControls.appendChild(labelled('Show:', busUnitSel));
    busControls.appendChild(labelled('Sort table:', busSortSel));
    busChart.appendChild(busControls);
    const busChartNote = node('div', { fontSize: '11px', color: '#6c757d', minHeight: '15px', marginBottom: '2px' });
    busChart.appendChild(busChartNote);
    const busSvg = newSvg('270px');
    busChart.appendChild(busSvg);
    busPanel.appendChild(busChart);
    const busTableHost = node('div');
    busPanel.appendChild(busTableHost);

    function renderBusChart() {
        const bus = buses[Number(busSel.value)] || buses[0];
        const limits = harmonicVoltageLimits(standard, bus.vn);
        const pct = unit === 'pct';
        drawSpectrumSvg(busSvg, bus.spectrum.map((p) => {
            const limitPct = limits ? limits.individual(p.order) : null;
            return {
                order: p.order,
                y: pct ? p.pct : p.value,
                limit: limitPct == null ? null : (pct ? limitPct : (limitPct / 100) * bus.v1)
            };
        }), pct ? 'Harmonic voltage [% of fundamental]' : 'Harmonic voltage [kV]');
        busChartNote.textContent = limits
            ? `${limits.label}: THD ≤ ${fmtAuto(limits.thd)} %; dashed marks are the individual limits, red bars exceed them.`
            : '';
    }

    function renderBusTable() {
        const rated = buses.map((bus) => ({ bus, rating: rate(bus) }));
        const ratio = (r) => Math.max(
            r.rating.thdLimit ? r.bus.thd / r.rating.thdLimit : 0,
            r.rating.worst ? r.rating.worst.ratio : 0);
        const sorters = {
            thd: (a, b) => b.bus.thd - a.bus.thd,
            margin: (a, b) => ratio(b) - ratio(a),
            voltage: (a, b) => (b.bus.vn || 0) - (a.bus.vn || 0) || b.bus.thd - a.bus.thd,
            name: (a, b) => a.bus.label.localeCompare(b.bus.label, undefined, { numeric: true })
        };
        rated.sort(sorters[busSort] || sorters.thd);
        const checked = standard !== 'none';
        const pct = unit === 'pct';
        const headers = ['Bus', 'Vn [kV]', 'V1 [kV]', 'VTHD [%]'];
        if (checked) headers.push('THD limit [%]', 'Worst harmonic', 'Status');
        orders.forEach((h) => headers.push(pct ? `h${h} [%]` : `h${h} [kV]`));
        const rows = rated.map(({ bus, rating }) => {
            const cells = [
                bus.label,
                Number.isFinite(bus.vn) ? fmtAuto(bus.vn) : '—',
                fmtNum(bus.v1, 3),
                { text: fmtNum(bus.thd, 2), style: { fontWeight: '600', color: !checked ? '#212529' : (rating.thdOver ? OVER_COLOR : OK_COLOR) } }
            ];
            if (checked) {
                const w = rating.worst;
                cells.push(
                    rating.thdLimit != null ? fmtAuto(rating.thdLimit) : '—',
                    w ? { text: `h${w.order}: ${fmtAuto(w.pct)} % / ${fmtAuto(w.limit)} %`, style: { color: w.ratio > 1 ? OVER_COLOR : '#495057' } } : '—',
                    rating.status === 'none' ? '—' : {
                        text: rating.status === 'over' ? 'Above limit' : 'OK',
                        style: { fontWeight: '600', fontFamily: FONT, color: rating.status === 'over' ? OVER_COLOR : OK_COLOR },
                        title: rating.label
                    });
            }
            const overSet = new Set(rating.overOrders);
            bus.spectrum.forEach((p) => cells.push({
                text: pct ? fmtAuto(p.pct) : fmtNum(p.value, 4),
                style: overSet.has(p.order) ? { color: OVER_COLOR, fontWeight: '600' } : null
            }));
            return cells;
        });
        while (busTableHost.firstChild) busTableHost.removeChild(busTableHost.firstChild);
        busTableHost.appendChild(buildTable(headers, rows));
    }

    busSel.addEventListener('change', renderBusChart);
    busUnitSel.addEventListener('change', () => { unit = busUnitSel.value === 'abs' ? 'abs' : 'pct'; renderBusChart(); renderBusTable(); });
    busSortSel.addEventListener('change', () => { busSort = busSortSel.value; renderBusTable(); });

    // ---- branch currents ---------------------------------------------------------
    let branchUnit = 'abs';
    let renderBranches = () => {};
    if (branches.length) {
        const panel = panels.branches;
        const chart = chartBox();
        const controls = controlsRow();
        const sel = styledSelect(branches.map((b, i) => ({
            value: i, label: `${b.label} (${b.type}) — ${fmtAuto(b.ih)} A harmonic, THD ${fmtNum(b.thd, 2)} %`
        })), 0);
        sel.style.maxWidth = '520px';
        const unitSel = styledSelect(unitOptions('A'), 'abs');
        controls.appendChild(labelled('Spectrum of:', sel));
        controls.appendChild(labelled('Show:', unitSel));
        chart.appendChild(controls);
        chart.appendChild(node('div', { fontSize: '11px', color: '#6c757d', marginBottom: '2px' },
            'Phase current at the first terminal (lines: from-bus, transformers: HV side). ' +
            'Current THD is relative to the fundamental current of this operating point, so it is high on lightly loaded branches.'));
        const svg = newSvg('250px');
        chart.appendChild(svg);
        panel.appendChild(chart);
        const tableHost = node('div');
        panel.appendChild(tableHost);

        const drawChart = () => {
            const b = branches[Number(sel.value)] || branches[0];
            const pct = branchUnit === 'pct';
            drawSpectrumSvg(svg, b.spectrum.map((p) => ({ order: p.order, y: pct ? p.pct : p.value })),
                pct ? 'Harmonic current [% of fundamental]' : 'Harmonic current [A]');
        };
        const drawTable = () => {
            const pct = branchUnit === 'pct';
            const headers = ['Branch', 'Type', 'I1 [A]', 'ITHD [%]', 'Harmonic RMS [A]',
                ...orders.map((h) => (pct ? `h${h} [%]` : `h${h} [A]`))];
            const rows = branches.map((b) => [
                b.label,
                { text: b.type, style: { fontFamily: FONT, textAlign: 'left' } },
                fmtAuto(b.i1), { text: fmtNum(b.thd, 2), style: { fontWeight: '600' } }, fmtAuto(b.ih),
                ...b.spectrum.map((p) => (pct ? fmtAuto(p.pct) : fmtAuto(p.value)))
            ]);
            while (tableHost.firstChild) tableHost.removeChild(tableHost.firstChild);
            tableHost.appendChild(buildTable(headers, rows));
        };
        sel.addEventListener('change', drawChart);
        unitSel.addEventListener('change', () => { branchUnit = unitSel.value === 'abs' ? 'abs' : 'pct'; drawChart(); drawTable(); });
        renderBranches = () => { drawChart(); drawTable(); };
    }

    // ---- frequency scan ------------------------------------------------------------
    if (scan) {
        const panel = panels.scan;
        const scanOrders = (scan.orders || []).map(Number);
        const series = scan.buses.map((b, i) => ({
            label: b.label || b.name,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            z: (b.z_ohm || []).map((v) => (v == null ? NaN : Number(v))),
            resonances: b.parallel_resonances || []
        }));
        const chart = chartBox();
        const controls = controlsRow();
        const scaleSel = styledSelect([{ value: 'log', label: 'Logarithmic' }, { value: 'lin', label: 'Linear' }], 'log');
        controls.appendChild(labelled('Impedance axis:', scaleSel));
        const legend = node('div', { display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: '#495057' });
        series.forEach((s) => {
            const item = node('span', { display: 'inline-flex', alignItems: 'center', gap: '6px' });
            item.appendChild(node('span', { display: 'inline-block', width: '16px', height: '3px', backgroundColor: s.color }));
            item.appendChild(document.createTextNode(s.label));
            legend.appendChild(item);
        });
        controls.appendChild(legend);
        chart.appendChild(controls);
        const readout = node('div', { fontSize: '11px', color: '#6c757d', minHeight: '15px', marginBottom: '2px' },
            'Move the pointer over the chart to read the impedance.');
        chart.appendChild(readout);
        const svg = newSvg('340px');
        chart.appendChild(svg);
        chart.appendChild(node('div', { fontSize: '11px', color: '#6c757d', marginTop: '4px', lineHeight: '1.45' },
            'Positive-sequence impedance seen from the bus with all harmonic sources switched off. Peaks are parallel ' +
            'resonances (circles): a harmonic current injected near such an order is amplified into a high voltage. ' +
            'Dips are series resonances, which attract harmonic current.'));
        panel.appendChild(chart);
        const draw = () => drawScanSvg(svg, scanOrders, series, scaleSel.value === 'log', baseHz, readout);
        scaleSel.addEventListener('change', draw);
        draw();

        const describe = (list) => (list && list.length
            ? list.map((r) => {
                const near = orders.find((h) => Math.abs(h - r.order) <= 0.3);
                return `h ${fmtNum(r.order, 1)} (${fmtNum(r.order * baseHz, 0)} Hz, ${fmtAuto(r.z_ohm)} Ω)${near != null ? ` ← near h${near}` : ''}`;
            }).join('; ')
            : 'none found');
        const rows = scan.buses.map((b) => [
            `${b.label || b.name}${b.vn_kv ? ` (${b.vn_kv} kV)` : ''}`,
            { text: describe(b.parallel_resonances), style: { fontFamily: FONT, textAlign: 'left', whiteSpace: 'normal' } },
            { text: describe(b.series_resonances), style: { fontFamily: FONT, textAlign: 'left', whiteSpace: 'normal' } }
        ]);
        const table = buildTable(['Scanned bus', 'Parallel resonances (impedance peaks)', 'Series resonances (impedance dips)'], rows);
        table.querySelectorAll('th').forEach((th) => { th.style.textAlign = 'left'; });
        panel.appendChild(table);
    }

    // ---- CSV -------------------------------------------------------------------------
    exportBtn.addEventListener('click', () => {
        const rows = [['Harmonic Analysis Results'], ['Base frequency [Hz]', baseHz], ['Harmonic orders', orders.join(' ')],
            ['Operating point', op.source === 'pandapower' ? 'controlled load flow' : 'OpenDSS load flow'], []];
        const checked = standard !== 'none';
        rows.push(['BUS VOLTAGES']);
        rows.push(['Bus', 'Vn [kV]', 'V1 [kV]', 'VTHD [%]', ...(checked ? ['THD limit [%]', 'Status'] : []),
            ...orders.map((h) => `h${h} [%]`), ...orders.map((h) => `h${h} [kV]`)]);
        buses.forEach((bus) => {
            const rating = rate(bus);
            rows.push([bus.label, Number.isFinite(bus.vn) ? bus.vn : '', bus.v1, bus.thd,
                ...(checked ? [rating.thdLimit ?? '', rating.status === 'over' ? 'Above limit' : (rating.status === 'ok' ? 'OK' : '')] : []),
                ...bus.spectrum.map((p) => Number(p.pct.toFixed(5))), ...bus.spectrum.map((p) => p.value)]);
        });
        if (branches.length) {
            rows.push([], ['BRANCH CURRENTS']);
            rows.push(['Branch', 'Type', 'I1 [A]', 'ITHD [%]', 'Harmonic RMS [A]', ...orders.map((h) => `h${h} [A]`)]);
            branches.forEach((b) => rows.push([b.label, b.type, b.i1, b.thd, Number(b.ih.toFixed(5)), ...b.spectrum.map((p) => p.value)]));
        }
        if (scan) {
            rows.push([], ['FREQUENCY SCAN - positive-sequence impedance']);
            const header = ['Harmonic order', 'Frequency [Hz]'];
            scan.buses.forEach((b) => header.push(`${b.label || b.name} |Z| [ohm]`, `${b.label || b.name} angle [deg]`));
            rows.push(header);
            (scan.orders || []).forEach((h, i) => {
                const line = [h, Number((h * baseHz).toFixed(3))];
                scan.buses.forEach((b) => line.push((b.z_ohm || [])[i] ?? '', (b.angle_deg || [])[i] ?? ''));
                rows.push(line);
            });
        }
        downloadCsv('harmonic_analysis_results.csv', rows);
    });

    standardSel.addEventListener('change', () => {
        standard = standardSel.value;
        try { localStorage.setItem(STANDARD_KEY, standard); } catch (e) { /* not stored */ }
        renderTiles();
        renderBusChart();
        renderBusTable();
    });

    renderTiles();
    renderBusChart();
    renderBusTable();
    renderBranches();
    showTab('buses');

    const destroy = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    closeBtn.addEventListener('click', destroy);
    attachBackdropCloseHandler(overlay, box, destroy);

    box.appendChild(titleBar);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

if (typeof window !== 'undefined') {
    window.showHarmonicAnalysisResultsDialog = showHarmonicAnalysisResultsDialog;
}
