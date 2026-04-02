/**
 * Parse harmonic spectrum CSV: harmonic_order, %magnitude, angle_degrees per line
 * (same rules as opendss_electrisim._create_spectrum_from_csv).
 * @returns {{ order: number, mag: number, angle: number }[]}
 */
export function parseHarmonicSpectrumCsv(text) {
    const out = [];
    if (!text || typeof text !== 'string') return out;
    for (const line of text.trim().split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const parts = t.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) continue;
        try {
            const order = Math.round(Number(parts[0]));
            const mag = Number(parts[1]);
            const angle = Number(parts[2]);
            if (!Number.isFinite(order) || !Number.isFinite(mag) || !Number.isFinite(angle)) continue;
            out.push({ order, mag, angle });
        } catch {
            continue;
        }
    }
    out.sort((a, b) => a.order - b.order);
    return out;
}

/** Representative built-in shapes (OpenDSS defines exact tables in the engine). */
const BUILTIN_PREVIEW = {
    defaultload: [
        { order: 1, mag: 100, angle: 0 },
        { order: 5, mag: 20, angle: 0 },
        { order: 7, mag: 14.3, angle: 0 },
        { order: 11, mag: 9.1, angle: 0 },
        { order: 13, mag: 7.7, angle: 0 },
        { order: 17, mag: 5.9, angle: 0 },
        { order: 19, mag: 5.3, angle: 0 }
    ],
    defaultgen: [
        { order: 1, mag: 100, angle: 0 },
        { order: 3, mag: 4, angle: 0 },
        { order: 5, mag: 10, angle: 0 },
        { order: 7, mag: 8, angle: 0 },
        { order: 11, mag: 5, angle: 0 },
        { order: 13, mag: 4, angle: 0 }
    ],
    defaultvsource: [
        { order: 1, mag: 100, angle: 0 },
        { order: 3, mag: 0.35, angle: 0 },
        { order: 5, mag: 0.28, angle: 0 },
        { order: 7, mag: 0.22, angle: 0 },
        { order: 11, mag: 0.16, angle: 0 },
        { order: 13, mag: 0.13, angle: 0 }
    ],
    default: [
        { order: 1, mag: 100, angle: 0 },
        { order: 3, mag: 2.2, angle: 0 },
        { order: 5, mag: 1.6, angle: 0 },
        { order: 7, mag: 1.1, angle: 0 },
        { order: 9, mag: 0.85, angle: 0 },
        { order: 11, mag: 0.65, angle: 0 },
        { order: 13, mag: 0.5, angle: 0 }
    ]
};

function linearPreviewOddHarmonics() {
    const pts = [];
    for (let h = 1; h <= 25; h += 2) {
        pts.push({ order: h, mag: 100 / h, angle: 0 });
    }
    return pts;
}

/**
 * @param {string} mode - MODE_* from loadHarmonicSpectrumTriStateUi
 * @param {string} defaultSpectrum - e.g. defaultload, defaultgen
 * @param {string} csvText
 * @returns {{ points: {order:number,mag:number,angle:number}[], caption: string, footnote?: string }}
 */
export function getHarmonicSpectrumPreviewSeries(mode, defaultSpectrum, csvText) {
    const ds = String(defaultSpectrum || 'defaultload').trim().toLowerCase();

    if (mode === 'none') {
        return {
            points: [],
            caption: 'No harmonic spectrum',
            footnote: 'OpenDSS export omits spectrum= for this element.'
        };
    }
    if (mode === 'linear') {
        return {
            points: linearPreviewOddHarmonics(),
            caption: 'Linear (built-in)',
            footnote: 'Illustrative 1/h on odd harmonics 1…25; OpenDSS `linear` spectrum is defined in the engine.'
        };
    }
    if (mode === 'custom') {
        const points = parseHarmonicSpectrumCsv(csvText || '');
        if (!points.length) {
            return {
                points: [],
                caption: 'Custom spectrum',
                footnote: 'Enter CSV rows (harmonic, %magnitude, angle°) to plot the characteristic.'
            };
        }
        return {
            points,
            caption: 'Custom spectrum (% magnitude vs harmonic order)',
            footnote: 'Angles are not shown in the bar chart; they are used in OpenDSS.'
        };
    }
    // default mode → named built-in
    const pts = BUILTIN_PREVIEW[ds] || BUILTIN_PREVIEW.defaultload;
    return {
        points: pts.map(p => ({ ...p })),
        caption: `Built-in «${ds}» (representative)`,
        footnote: 'Exact %mag and angle come from the OpenDSS built-in spectrum at solve time; this chart is a typical shape.'
    };
}

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

/**
 * @param {SVGSVGElement} svg
 * @param {HTMLElement} statusEl
 * @param {{ points: {order:number,mag:number}[], caption: string, footnote?: string }} series
 */
export function drawHarmonicSpectrumChart(svg, statusEl, series) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    statusEl.textContent = '';
    statusEl.style.color = '#6c757d';

    const { points, caption, footnote } = series;
    const W = 520;
    const H = 240;
    const ml = 48;
    const mr = 16;
    const mt = 36;
    const mb = 52;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fafbfc' }, svg);

    const title = el('text', {
        x: ml,
        y: 22,
        fill: '#343a40',
        'font-size': '13',
        'font-weight': '600',
        'font-family': 'Arial, sans-serif'
    }, svg);
    title.textContent = caption;

    if (!points.length) {
        statusEl.textContent = footnote || 'Nothing to plot.';
        return;
    }

    if (footnote) {
        statusEl.textContent = footnote;
    }

    const orders = points.map(p => p.order);
    const hMin = Math.min(...orders);
    const hMax = Math.max(...orders);
    const mags = points.map(p => p.mag);
    const magMax = Math.max(...mags, 1e-6);
    const yMax = magMax * 1.12;

    const xFor = h => {
        if (hMax <= hMin) return ml + plotW / 2;
        return ml + ((h - hMin) / (hMax - hMin)) * plotW;
    };
    const yFor = mag => mt + plotH - (mag / yMax) * plotH;

    // Y axis
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
        lbl.textContent = val < 10 ? val.toFixed(1) : Math.round(val);
    }

    el('text', {
        x: 12,
        y: mt + plotH / 2,
        fill: '#868e96',
        'font-size': '10',
        transform: `rotate(-90 12 ${mt + plotH / 2})`,
        'font-family': 'Arial, sans-serif'
    }, svg).textContent = '% magnitude';

    const nBar = points.length;
    const barW = Math.max(4, Math.min(28, plotW / Math.max(nBar * 1.6, 3)));

    points.forEach(p => {
        const cx = xFor(p.order);
        const x0 = cx - barW / 2;
        const y0 = yFor(p.mag);
        const y1 = mt + plotH;
        el('rect', {
            x: x0,
            y: y0,
            width: barW,
            height: Math.max(1, y1 - y0),
            fill: '#4dabf7',
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
        y: H - 12,
        fill: '#868e96',
        'font-size': '10',
        'text-anchor': 'middle',
        'font-family': 'Arial, sans-serif'
    }, svg).textContent = 'Harmonic order h';
}
