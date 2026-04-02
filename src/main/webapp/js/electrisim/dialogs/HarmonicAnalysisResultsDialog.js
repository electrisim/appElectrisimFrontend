/**
 * Modal summarizing OpenDSS harmonic analysis: metadata, per-bus voltage spectrum chart,
 * and VTHD / harmonic voltage table (matches backend harmonic_analysis + busbars fields).
 */

import { createDialogNameResolver } from '../utils/attributeUtils.js';

const NS = 'http://www.w3.org/2000/svg';

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

function fmtNum(v, decimals = 3) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toFixed(decimals);
}

function thdCellColor(vthd) {
    const x = Number(vthd);
    if (!Number.isFinite(x)) return '#212529';
    if (x < 5) return '#2e7d32';
    if (x < 8) return '#e65100';
    return '#c62828';
}

/** Line-to-line fundamental kV for spectrum %; backend field may be missing if bus key mismatch. */
function fundamentalVoltageKvForSpectrum(bus) {
    const f = Number(bus.fundamental_voltage_kv);
    if (Number.isFinite(f) && f > 1e-9) return f;
    const vm = Number(bus.vm_pu);
    const vn = Number(bus.vn_kv);
    const est = vm * vn;
    if (Number.isFinite(est) && est > 1e-9) return est;
    return 0;
}

function busSpectrumPercents(bus, orders) {
    const v1 = fundamentalVoltageKvForSpectrum(bus);
    const harmKv = bus.harmonic_voltages_kv || {};
    return orders.map(h => {
        const key = String(h);
        const vk = Number(harmKv[key] != null ? harmKv[key] : harmKv[h]);
        const pct = v1 > 1e-9 ? (vk / v1) * 100 : 0;
        return { order: h, pct: Number.isFinite(pct) ? pct : 0 };
    });
}

function formatYAxisTick(val, yMax) {
    if (!Number.isFinite(val) || !Number.isFinite(yMax)) return '—';
    const ref = Math.max(Math.abs(yMax), 1e-15);
    if (ref >= 100) return String(Math.round(val));
    if (ref >= 10) return val.toFixed(1);
    if (ref >= 1) return val.toFixed(2);
    if (ref >= 0.01) return val.toFixed(3);
    return val.toFixed(4);
}

function drawSpectrumSvg(svg, statusEl, points, legendLabel = 'Spectrum') {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (statusEl) statusEl.textContent = '';

    const W = 560;
    const H = 260;
    const ml = 72;
    const mr = 24;
    const mt = 28;
    const mb = 48;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fafbfc' }, svg);

    const leg = el('g', { transform: `translate(${W - mr - 120}, ${10})` }, svg);
    el('rect', { x: 0, y: 2, width: 14, height: 10, fill: '#1976d2', rx: 1 }, leg);
    const lt = el('text', { x: 20, y: 11, fill: '#495057', 'font-size': '11', 'font-family': 'Arial, sans-serif' }, leg);
    lt.textContent = legendLabel;

    if (!points.length) {
        if (statusEl) statusEl.textContent = 'No harmonic data for this bus.';
        return;
    }

    const orders = points.map(p => p.order);
    const hMin = Math.min(...orders);
    const hMax = Math.max(...orders);
    const pcts = points.map(p => p.pct);
    const pctMax = Math.max(...pcts, 1e-6);
    const yMax = pctMax * 1.15;

    const xFor = h => {
        if (hMax <= hMin) return ml + plotW / 2;
        return ml + ((h - hMin) / (hMax - hMin)) * plotW;
    };
    const yFor = pct => mt + plotH - (pct / yMax) * plotH;

    el('line', { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: '#adb5bd', 'stroke-width': 1 }, svg);
    el('line', { x1: ml, y1: mt + plotH, x2: ml + plotW, y2: mt + plotH, stroke: '#adb5bd', 'stroke-width': 1 }, svg);

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = (yMax * i) / yTicks;
        const y = yFor(val);
        el('line', { x1: ml - 4, y1: y, x2: ml, y2: y, stroke: '#ced4da', 'stroke-width': 1 }, svg);
        const lbl = el('text', {
            x: ml - 8,
            y: y + 4,
            fill: '#868e96',
            'font-size': '10',
            'text-anchor': 'end',
            'font-family': 'Arial, sans-serif'
        }, svg);
        lbl.textContent = formatYAxisTick(val, yMax);
    }

    const yMid = mt + plotH / 2;
    const yAxisTitle = el(
        'text',
        {
            x: 22,
            y: yMid,
            fill: '#868e96',
            'font-size': '10',
            'text-anchor': 'middle',
            transform: `rotate(-90 22 ${yMid})`,
            'font-family': 'Arial, sans-serif'
        },
        svg
    );
    yAxisTitle.textContent = 'Harmonic V (% of fund.)';

    const nBar = points.length;
    const barW = Math.max(4, Math.min(28, plotW / Math.max(nBar * 1.6, 3)));

    points.forEach(p => {
        const cx = xFor(p.order);
        const x0 = cx - barW / 2;
        const y0 = yFor(p.pct);
        const y1 = mt + plotH;
        el('rect', {
            x: x0,
            y: y0,
            width: barW,
            height: Math.max(1, y1 - y0),
            fill: '#1976d2',
            rx: 2
        }, svg);
        const ox = el('text', {
            x: cx,
            y: y1 + 18,
            fill: '#495057',
            'font-size': '10',
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif'
        }, svg);
        ox.textContent = String(p.order);
    });

    el('text', {
        x: ml + plotW / 2,
        y: H - 14,
        fill: '#868e96',
        'font-size': '10',
        'text-anchor': 'middle',
        'font-family': 'Arial, sans-serif'
    }, svg).textContent = 'Harmonic';
}

/**
 * @param {object} dataJson — full OpenDSS backend response after harmonic analysis
 * @param {import('mxgraph').mxGraph} [graph] — when set, bus labels use the same `name` as the Bus dialog
 */
export function showHarmonicAnalysisResultsDialog(dataJson, graph) {
    const dialogNameFor = createDialogNameResolver(graph);
    const busLabel = (bus) => {
        const dialog = dialogNameFor(bus);
        const backend = bus.name || bus.id || '';
        if (dialog) {
            if (backend && String(backend) !== dialog) return `${dialog} (${backend})`;
            return dialog;
        }
        return backend || '—';
    };

    const meta = dataJson.harmonic_analysis;
    const busbars = Array.isArray(dataJson.busbars) ? dataJson.busbars : [];
    if (!meta || !meta.executed || !busbars.length) {
        console.warn('showHarmonicAnalysisResultsDialog: missing harmonic_analysis or busbars');
        return;
    }

    const orders = Array.isArray(meta.harmonic_orders) && meta.harmonic_orders.length
        ? meta.harmonic_orders.map(h => Number(h)).filter(Number.isFinite)
        : [3, 5, 7, 11, 13];

    const buses = busbars
        .filter(b => b && (b.vthd_percent != null || (b.harmonic_voltages_kv && Object.keys(b.harmonic_voltages_kv).length)))
        .slice()
        .sort((a, b) => busLabel(a).localeCompare(busLabel(b), undefined, { numeric: true }));

    if (!buses.length) {
        console.warn('showHarmonicAnalysisResultsDialog: no buses with harmonic fields');
        return;
    }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: '10001',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        boxSizing: 'border-box'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        width: 'min(920px, 100%)',
        maxHeight: 'min(92vh, 900px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    });

    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
        padding: '14px 18px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: '0'
    });
    const title = document.createElement('div');
    title.textContent = 'Harmonic Analysis Results';
    Object.assign(title.style, { fontWeight: '600', fontSize: '17px', color: '#212529' });
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, {
        border: 'none',
        background: 'transparent',
        fontSize: '26px',
        lineHeight: '1',
        cursor: 'pointer',
        color: '#6c757d',
        padding: '0 4px'
    });

    titleBar.appendChild(title);
    titleBar.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, {
        padding: '14px 18px 18px',
        overflowY: 'auto',
        flex: '1',
        minHeight: '0',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#333'
    });

    const freq = meta.frequency_hz != null ? String(meta.frequency_hz) : '—';
    const harmStr = orders.join(', ');
    const nly = meta.neglectLoadY === true ? 'Yes' : 'No';
    const summary = document.createElement('div');
    summary.innerHTML =
        `<strong>Base frequency:</strong> ${freq} Hz &nbsp;|&nbsp; ` +
        `<strong>Harmonic orders:</strong> ${harmStr} &nbsp;|&nbsp; ` +
        `<strong>NeglectLoadY:</strong> ${nly}`;
    Object.assign(summary.style, { marginBottom: '14px', lineHeight: '1.5', color: '#495057' });
    body.appendChild(summary);

    const chartSection = document.createElement('div');
    Object.assign(chartSection.style, {
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        backgroundColor: '#fafbfc'
    });

    const row = document.createElement('div');
    Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '10px',
        flexWrap: 'wrap'
    });
    const lab = document.createElement('label');
    lab.htmlFor = 'harmonic_results_bus_select';
    lab.textContent = 'Show spectrum for:';
    Object.assign(lab.style, { fontWeight: '600', color: '#495057' });
    const sel = document.createElement('select');
    sel.id = 'harmonic_results_bus_select';
    Object.assign(sel.style, {
        minWidth: '220px',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #ced4da',
        fontSize: '13px',
        backgroundColor: '#fff'
    });

    buses.forEach((bus, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = `Bus: ${busLabel(bus)}`;
        sel.appendChild(opt);
    });

    row.appendChild(lab);
    row.appendChild(sel);
    chartSection.appendChild(row);

    const chartStatus = document.createElement('div');
    Object.assign(chartStatus.style, { fontSize: '11px', color: '#6c757d', minHeight: '16px', marginBottom: '4px' });
    const svg = document.createElementNS(NS, 'svg');
    Object.assign(svg.style, { width: '100%', maxHeight: '280px', display: 'block' });
    chartSection.appendChild(chartStatus);
    chartSection.appendChild(svg);
    body.appendChild(chartSection);

    function redrawChart(busIndex) {
        const bus = buses[Number(busIndex)] || buses[0];
        const pts = busSpectrumPercents(bus, orders);
        drawSpectrumSvg(svg, chartStatus, pts, 'Spectrum');
    }

    sel.addEventListener('change', () => redrawChart(sel.value));
    redrawChart('0');

    const tableWrap = document.createElement('div');
    Object.assign(tableWrap.style, { overflowX: 'auto', maxHeight: '320px', border: '1px solid #e9ecef', borderRadius: '6px' });
    const table = document.createElement('table');
    Object.assign(table.style, {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px'
    });

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const headers = ['Bus', 'VTHD [%]', ...orders.map(h => `V_h${h} [kV]`)];
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        Object.assign(th.style, {
            padding: '10px 8px',
            textAlign: text.startsWith('V_h') ? 'right' : 'left',
            backgroundColor: '#e9ecef',
            borderBottom: '2px solid #dee2e6',
            position: 'sticky',
            top: '0',
            zIndex: '1',
            whiteSpace: 'nowrap'
        });
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    buses.forEach(bus => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';

        const tdBus = document.createElement('td');
        tdBus.textContent = busLabel(bus);
        Object.assign(tdBus.style, { padding: '8px', fontWeight: '500' });

        const tdThd = document.createElement('td');
        const vthd = bus.vthd_percent;
        tdThd.textContent = fmtNum(vthd, 2);
        Object.assign(tdThd.style, {
            padding: '8px',
            textAlign: 'right',
            fontWeight: '600',
            color: thdCellColor(vthd)
        });

        tr.appendChild(tdBus);
        tr.appendChild(tdThd);

        const hv = bus.harmonic_voltages_kv || {};
        orders.forEach(h => {
            const td = document.createElement('td');
            const key = String(h);
            const val = hv[key] != null ? hv[key] : hv[h];
            td.textContent = fmtNum(val, 4);
            Object.assign(td.style, { padding: '8px', textAlign: 'right', fontFamily: 'Consolas, monospace' });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

    const destroy = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    closeBtn.addEventListener('click', destroy);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) destroy();
    });

    box.appendChild(titleBar);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

if (typeof window !== 'undefined') {
    window.showHarmonicAnalysisResultsDialog = showHarmonicAnalysisResultsDialog;
}
