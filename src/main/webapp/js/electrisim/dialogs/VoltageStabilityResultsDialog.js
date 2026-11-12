// VoltageStabilityResultsDialog.js - P-V curves with the limits met on the way, playback and export
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

const CURVE_COLOURS = ['#1f77b4', '#2ca02c', '#9467bd', '#17becf', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'];
const LIMIT_COLOURS = { voltage: '#d39e00', thermal: '#e8590c', collapse: '#c92a2a' };
const LIMIT_SHORT = { voltage: 'Voltage limit', thermal: 'Overload', collapse: 'Voltage collapse' };

function fmtMw(v) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    const a = Math.abs(n);
    if (a >= 1000) return n.toFixed(0);
    if (a >= 100) return n.toFixed(0);
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2);
}

function busName(name) {
    const t = String(name ?? '').trim();
    return /^\d+$/.test(t) ? `Bus ${t}` : t;
}

function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
        if (x <= xs[i]) {
            const t = (x - xs[i - 1]) / ((xs[i] - xs[i - 1]) || 1);
            const a = ys[i - 1];
            const b = ys[i];
            if (a == null || b == null) return b ?? a;
            return a + (b - a) * t;
        }
    }
    return ys[ys.length - 1];
}

/**
 * Draw the chart. `progress` (0..1) is how far along the load axis the curves are revealed;
 * 1 shows everything. `opts.poster` adds a title block and footer for exported images/video.
 */
export function drawVoltageStabilityChart(ctx, W, H, results, progress, opts = {}) {
    const poster = !!opts.poster;
    // unit that scales text and strokes: canvas-relative for posters, CSS pixels on screen
    const u = opts.unit || Math.min(W, H) / 1000;
    const font = (px, weight = 400) => `${weight} ${Math.round(px * u)}px -apple-system, "Segoe UI", Arial, sans-serif`;
    const xs = results.x_mw || [];
    const curves = results.curves || [];
    const limits = results.limits || [];
    const base = results.base_mw ?? xs[0];
    const tip = results.tip_mw ?? xs[xs.length - 1];
    const minVm = results.min_vm_pu ?? 0.95;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ---- header (poster only)
    let top = 26 * u;
    if (poster) {
        ctx.fillStyle = '#12263a';
        ctx.font = font(46, 700);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(opts.title || 'How much load before the voltage collapses?', 48 * u, 44 * u);
        ctx.fillStyle = '#5c6b7a';
        ctx.font = font(26, 400);
        ctx.fillText(opts.subtitle || '', 48 * u, 104 * u);
        top = 170 * u;
    }

    const footer = poster ? 250 * u : 0;
    const left = (poster ? 120 : 78) * u;
    const right = W - (poster ? 60 : 30) * u;
    const bottom = H - footer - (poster ? 96 : 62) * u;
    const plotW = right - left;
    const plotH = bottom - top;

    // ---- scales
    const xMin = base;
    const xMax = tip + (tip - base) * 0.09;
    let yMin = Infinity;
    let yMax = -Infinity;
    curves.forEach((c) => (c.vm_pu || []).forEach((v) => {
        if (v == null) return;
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
    }));
    if (!Number.isFinite(yMin)) { yMin = 0.5; yMax = 1.1; }
    yMin = Math.min(yMin, minVm) - 0.03;
    yMax = Math.max(yMax, 1.0) + 0.03;
    const yStep = niceStep(yMax - yMin, 7);
    yMin = Math.floor(yMin / yStep) * yStep;
    yMax = Math.ceil(yMax / yStep) * yStep;
    const X = (x) => left + ((x - xMin) / ((xMax - xMin) || 1)) * plotW;
    const Y = (y) => bottom - ((y - yMin) / ((yMax - yMin) || 1)) * plotH;


    // ---- "no solution" zone beyond the tip, once the playhead gets there
    const p = Math.max(0, Math.min(1, progress == null ? 1 : progress));
    const xNow = xMin + (tip - xMin) * p;
    if (p >= 1) {
        ctx.fillStyle = '#fdecec';
        ctx.fillRect(X(tip), top, right - X(tip), plotH);
    }

    // ---- grid and axes
    ctx.strokeStyle = '#e6eaee';
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.fillStyle = '#5c6b7a';
    ctx.font = font(poster ? 22 : 17);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = yMin; y <= yMax + 1e-9; y += yStep) {
        ctx.beginPath(); ctx.moveTo(left, Y(y)); ctx.lineTo(right, Y(y)); ctx.stroke();
        ctx.fillText(y.toFixed(yStep < 0.1 ? 2 : 1), left - 10 * u, Y(y));
    }
    const xStep = niceStep(xMax - xMin, 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax + 1e-9; x += xStep) {
        ctx.beginPath(); ctx.moveTo(X(x), top); ctx.lineTo(X(x), bottom); ctx.stroke();
        ctx.fillText(xStep >= 1 ? String(Math.round(x)) : x.toFixed(xStep >= 0.1 ? 1 : 2), X(x), bottom + 10 * u);
    }
    ctx.strokeStyle = '#9aa7b4';
    ctx.lineWidth = Math.max(1, 1.6 * u);
    ctx.strokeRect(left, top, plotW, plotH);
    ctx.fillStyle = '#33475b';
    ctx.font = font(poster ? 24 : 18, 600);
    ctx.fillText(results.x_label || 'Load [MW]', left + plotW / 2, bottom + (poster ? 46 : 36) * u);
    ctx.save();
    ctx.translate(left - (poster ? 84 : 56) * u, top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText('Bus voltage [p.u.]', 0, 0);
    ctx.restore();

    // ---- minimum voltage line
    ctx.setLineDash([10 * u, 8 * u]);
    ctx.strokeStyle = LIMIT_COLOURS.voltage;
    ctx.lineWidth = Math.max(1, 2 * u);
    ctx.beginPath(); ctx.moveTo(left, Y(minVm)); ctx.lineTo(right, Y(minVm)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = LIMIT_COLOURS.voltage;
    ctx.font = font(poster ? 20 : 15, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`minimum voltage ${minVm} p.u.`, left + 10 * u, Y(minVm) + 6 * u);

    // ---- curves, revealed up to the playhead
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, Math.max(0, X(xNow) - left) + 1, plotH);
    ctx.clip();
    curves.forEach((c, i) => {
        const ys = c.vm_pu || [];
        ctx.strokeStyle = c.is_study_bus ? '#0b3d91' : CURVE_COLOURS[i % CURVE_COLOURS.length];
        ctx.lineWidth = Math.max(1.5, (c.is_study_bus ? 5 : i === 0 ? 4 : 2.6) * u);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        for (let k = 0; k < xs.length; k++) {
            if (ys[k] == null) continue;
            if (!started) { ctx.moveTo(X(xs[k]), Y(ys[k])); started = true; } else ctx.lineTo(X(xs[k]), Y(ys[k]));
        }
        ctx.stroke();
    });
    ctx.restore();

    // ---- limit markers (appear when the playhead reaches them)
    const shownLimits = limits.filter((l) => l.x_mw <= xNow + 1e-9 || p >= 1);
    shownLimits.forEach((l, idx) => {
        const colour = LIMIT_COLOURS[l.kind] || '#333';
        const lx = X(Math.max(xMin, l.x_mw));
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1.5, 3 * u);
        ctx.setLineDash(l.kind === 'collapse' ? [] : [6 * u, 6 * u]);
        ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, bottom); ctx.stroke();
        ctx.setLineDash([]);
        const text = `${LIMIT_SHORT[l.kind] || l.kind}: ${fmtMw(l.x_mw)} MW`;
        ctx.font = font(poster ? 21 : 15, 700);
        const tw = ctx.measureText(text).width;
        const padX = 9 * u;
        const boxH = (poster ? 34 : 26) * u;
        const stackedY = top + 10 * u + idx * (boxH + 6 * u);
        // labels sit on the left of their line once past mid-plot, so they never cover the tip
        let bx = lx + 8 * u;
        if (lx > left + plotW * 0.5 || bx + tw + 2 * padX > right) bx = lx - 8 * u - tw - 2 * padX;
        ctx.fillStyle = colour;
        ctx.fillRect(bx, stackedY, tw + 2 * padX, boxH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + padX, stackedY + boxH / 2);
    });

    // ---- playhead
    if (p < 1) {
        ctx.strokeStyle = '#12263a';
        ctx.lineWidth = Math.max(1, 2 * u);
        ctx.beginPath(); ctx.moveTo(X(xNow), top); ctx.lineTo(X(xNow), bottom); ctx.stroke();
        curves.forEach((c, i) => {
            const v = interp(xs, c.vm_pu || [], xNow);
            if (v == null) return;
            ctx.fillStyle = c.is_study_bus ? '#0b3d91' : CURVE_COLOURS[i % CURVE_COLOURS.length];
            ctx.beginPath(); ctx.arc(X(xNow), Y(v), (c.is_study_bus || i === 0 ? 8 : 5) * u, 0, Math.PI * 2); ctx.fill();
        });
    } else {
        // tip dot on the weakest curve
        const c0 = curves.find((c) => c.is_study_bus) || curves[0];
        if (c0) {
            const v = c0.vm_pu[c0.vm_pu.length - 1];
            ctx.fillStyle = LIMIT_COLOURS.collapse;
            ctx.beginPath(); ctx.arc(X(tip), Y(v), 9 * u, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.fillStyle = '#c92a2a';
    ctx.font = font(poster ? 20 : 14, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (right - X(tip) > 40 * u && (p >= 1 || xNow >= tip - 1e-9)) {
        ctx.save();
        ctx.translate(X(tip) + (right - X(tip)) / 2 + 6 * u, bottom - 12 * u);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('no solution', 0, 0);
        ctx.restore();
    }

    // ---- live readout (top right of the plot)
    const vNow = interp(xs, results.min_vm_pu_series || [], xNow);
    const loadNow = interp(xs, results.max_loading_series || [], xNow);
    const readout = [
        `${results.mode === 'bus' ? 'Added load' : 'Total load'}: ${fmtMw(xNow)} MW`,
        `Lowest voltage: ${vNow != null ? vNow.toFixed(3) : '—'} p.u.`,
        loadNow != null ? `Highest loading: ${loadNow.toFixed(0)} %` : null
    ].filter(Boolean);
    ctx.font = font(poster ? 23 : 16, 600);
    const rw = Math.max(...readout.map((t) => ctx.measureText(t).width)) + 28 * u;
    const lineH = (poster ? 34 : 24) * u;
    const rh = readout.length * lineH + 18 * u;
    const rx = left + 14 * u;
    const ry = bottom - rh - 14 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    ctx.strokeStyle = '#c9d2db';
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    readout.forEach((t, i) => {
        const bad = (i === 1 && vNow != null && vNow < minVm) || (i === 2 && loadNow != null && loadNow > (results.max_loading_percent ?? 100));
        ctx.fillStyle = bad ? '#c92a2a' : '#12263a';
        ctx.fillText(t, rx + 14 * u, ry + 10 * u + i * lineH);
    });

    // ---- footer (poster only): legend + the three limits in plain words
    if (poster) {
        let fy = H - footer + 6 * u;
        ctx.font = font(21, 400);
        ctx.textBaseline = 'middle';
        let lx = 48 * u;
        curves.slice(0, 6).forEach((c, i) => {
            const label = busName(c.bus) + (c.is_study_bus ? ' (study bus)' : i === 0 ? ' (weakest)' : '');
            const w = ctx.measureText(label).width + 46 * u;
            if (lx + w > W - 40 * u) { lx = 48 * u; fy += 32 * u; }
            ctx.fillStyle = c.is_study_bus ? '#0b3d91' : CURVE_COLOURS[i % CURVE_COLOURS.length];
            ctx.fillRect(lx, fy - 3 * u, 26 * u, 6 * u);
            ctx.fillStyle = '#33475b';
            ctx.textAlign = 'left';
            ctx.fillText(label, lx + 34 * u, fy);
            lx += w + 14 * u;
        });
        fy += 44 * u;
        ctx.font = font(26, 600);
        shownLimits.forEach((l) => {
            ctx.fillStyle = LIMIT_COLOURS[l.kind] || '#333';
            ctx.beginPath(); ctx.arc(60 * u, fy, 9 * u, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#12263a';
            ctx.textAlign = 'left';
            const where = l.element ? ` (${l.kind === 'voltage' ? busName(l.element) : l.element})` : '';
            const margin = l.already_violated ? 'already exceeded today'
                : `${fmtMw(l.x_mw)} MW` + (l.margin_percent != null ? `, +${l.margin_percent.toFixed(0)} % on today` : '');
            ctx.fillText(`${l.label}${where}: ${margin}`, 82 * u, fy);
            fy += 40 * u;
        });
        ctx.fillStyle = '#8795a3';
        ctx.font = font(20, 400);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('electrisim.com', W - 40 * u, H - 22 * u);
    }
    ctx.restore();
}

export class VoltageStabilityResultsDialog {
    constructor(results) {
        this.results = results || {};
        this._progress = 1;
        this._raf = null;
    }

    _titleLines() {
        const r = this.results;
        const subject = r.mode === 'bus'
            ? `New load at ${busName(r.study_bus) || 'the selected bus'}` + (r.power_factor ? `, power factor ${r.power_factor}` : '')
            : 'All loads grow together';
        return {
            title: r.mode === 'bus'
                ? `How many MW can ${busName(r.study_bus) || 'this bus'} take?`
                : 'How much load before the voltage collapses?',
            subtitle: `${subject} · P-V curves of the ${Math.min((r.curves || []).length, 8)} weakest buses`
        };
    }

    show() {
        const r = this.results;
        const overlay = document.createElement('div');
        overlay.className = 'voltage-stability-results-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.28);max-width:1180px;width:100%;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#212529;";

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e9ecef;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
        const h = document.createElement('h2');
        h.textContent = 'Voltage Stability Margin (P-V Curves)';
        h.style.cssText = 'margin:0;font-size:18px;font-weight:700;';
        const close = document.createElement('button');
        close.textContent = '×';
        close.title = 'Close';
        close.style.cssText = 'border:none;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#6c757d;padding:0 4px;';
        const closeAll = () => { this._stop(); overlay.remove(); };
        close.onclick = closeAll;
        header.appendChild(h);
        header.appendChild(close);
        box.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;padding:18px 24px;';
        box.appendChild(body);

        body.appendChild(this._buildVerdict());
        body.appendChild(this._buildTiles());
        (r.warnings || []).slice(0, 4).forEach((w) => {
            const d = document.createElement('div');
            d.style.cssText = 'padding:8px 12px;margin-bottom:10px;border-radius:8px;background:#fff3cd;border:1px solid #ffecb5;color:#664d03;font-size:12px;line-height:1.5;';
            d.textContent = String(w);
            body.appendChild(d);
        });

        // chart + controls
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 8px;';
        const playBtn = this._button('▶ Play', '#0b5ed7');
        const pngTall = this._button('Save image 1080×1350', '#198754');
        const pngWide = this._button('Save image 1920×1080', '#198754');
        const videoBtn = this._button('Export video', '#6f42c1');
        const csvBtn = this._button('Download CSV', '#6c757d');
        const status = document.createElement('span');
        status.style.cssText = 'font-size:12px;color:#6c757d;';
        [playBtn, pngTall, pngWide, videoBtn, csvBtn, status].forEach((el) => controls.appendChild(el));
        body.appendChild(controls);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;';
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:auto;';
        wrap.appendChild(canvas);
        body.appendChild(wrap);
        this._canvas = canvas;

        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:#495057;margin:8px 0 14px;';
        (r.curves || []).forEach((c, i) => {
            const s = document.createElement('span');
            const colour = c.is_study_bus ? '#0b3d91' : CURVE_COLOURS[i % CURVE_COLOURS.length];
            const sw = document.createElement('span');
            sw.style.cssText = `display:inline-block;width:18px;height:4px;background:${colour};vertical-align:middle;margin-right:6px;border-radius:2px;`;
            s.appendChild(sw);
            s.appendChild(document.createTextNode(busName(c.bus) + (c.is_study_bus ? ' (study bus)' : i === 0 ? ' (weakest)' : '')));
            legend.appendChild(s);
        });
        body.appendChild(legend);

        body.appendChild(this._buildLimitsTable());
        body.appendChild(this._buildWeakestTable());
        const notes = document.createElement('div');
        notes.style.cssText = 'font-size:12px;color:#6c757d;line-height:1.55;margin-top:10px;';
        notes.innerHTML = (r.notes || []).map((n) => `<div>• ${this._escape(n)}</div>`).join('') +
            `<div>• ${this._escape(String(r.load_flows_run ?? '—'))} load flows were run.</div>`;
        body.appendChild(notes);

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 24px;border-top:1px solid #e9ecef;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;background:#fafbfc;';
        const closeBtn = this._button('Close', '#007bff');
        closeBtn.onclick = closeAll;
        footer.appendChild(closeBtn);
        box.appendChild(footer);

        overlay.appendChild(box);
        attachBackdropCloseHandler(overlay, box, closeAll);
        document.body.appendChild(overlay);

        const redraw = () => this._drawScreen();
        this._resizeHandler = redraw;
        window.addEventListener('resize', redraw);
        redraw();

        playBtn.onclick = () => {
            if (this._raf) { this._stop(); playBtn.textContent = '▶ Play'; this._progress = 1; redraw(); return; }
            playBtn.textContent = '■ Stop';
            this._play(9000, () => { playBtn.textContent = '▶ Play'; });
        };
        pngTall.onclick = () => this._savePng(1080, 1350);
        pngWide.onclick = () => this._savePng(1920, 1080);
        csvBtn.onclick = () => this._downloadCsv();
        videoBtn.onclick = async () => {
            videoBtn.disabled = true;
            status.textContent = 'Recording… about 12 s';
            try {
                const name = await this._exportVideo(1080, 1350);
                status.textContent = `Saved ${name}`;
            } catch (e) {
                status.textContent = 'Video export is not available in this browser: ' + (e?.message || e);
            }
            videoBtn.disabled = false;
        };
    }

    _stop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        if (this._resizeHandler && !document.body.contains(this._canvas)) {
            window.removeEventListener('resize', this._resizeHandler);
        }
    }

    _drawScreen() {
        const canvas = this._canvas;
        if (!canvas) return;
        const cssW = Math.max(480, canvas.parentElement.clientWidth || 900);
        const cssH = Math.round(Math.min(520, Math.max(340, cssW * 0.46)));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        drawVoltageStabilityChart(canvas.getContext('2d'), canvas.width, canvas.height, this.results, this._progress, { unit: dpr * 0.82 });
    }

    _play(durationMs, onDone) {
        const start = performance.now();
        const tick = (now) => {
            // ease-out: slow down towards the tip, where the curve bends
            const t = Math.min(1, (now - start) / durationMs);
            this._progress = 1 - Math.pow(1 - t, 1.6);
            this._drawScreen();
            if (t < 1) {
                this._raf = requestAnimationFrame(tick);
            } else {
                this._raf = null;
                this._progress = 1;
                this._drawScreen();
                if (onDone) onDone();
            }
        };
        this._raf = requestAnimationFrame(tick);
    }

    _posterCanvas(w, h, progress) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        drawVoltageStabilityChart(c.getContext('2d'), w, h, this.results, progress, { poster: true, ...this._titleLines() });
        return c;
    }

    _fileStem() {
        return 'electrisim_pv_curve_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    _savePng(w, h) {
        const c = this._posterCanvas(w, h, 1);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = `${this._fileStem()}_${w}x${h}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    _exportVideo(w, h) {
        return new Promise((resolve, reject) => {
            if (typeof MediaRecorder === 'undefined') { reject(new Error('MediaRecorder is missing')); return; }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');
            const titles = this._titleLines();
            const draw = (p) => drawVoltageStabilityChart(ctx, w, h, this.results, p, { poster: true, ...titles });
            draw(0);
            const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
            const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
            if (!mime) { reject(new Error('no supported video format')); return; }
            const stream = c.captureStream(30);
            const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.onerror = (e) => reject(e.error || new Error('recording failed'));
            recorder.onstop = () => {
                const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
                const blob = new Blob(chunks, { type: mime.split(';')[0] });
                const name = `${this._fileStem()}_${w}x${h}.${ext}`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
                resolve(name);
            };
            const lead = 800;
            const run = 9000;
            const hold = 2500;
            const start = performance.now();
            recorder.start();
            // A timer, not requestAnimationFrame: animation frames stop when the window is covered
            // or minimised, which would leave the recording running for ever.
            const timer = setInterval(() => {
                const el = performance.now() - start;
                if (el < lead) draw(0);
                else if (el < lead + run) draw(1 - Math.pow(1 - (el - lead) / run, 1.6));
                else draw(1);
                if (el >= lead + run + hold) {
                    clearInterval(timer);
                    recorder.stop();
                }
            }, 1000 / 30);
        });
    }

    _button(text, colour) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = `padding:7px 14px;background:${colour};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;`;
        return b;
    }

    _buildVerdict() {
        const r = this.results;
        const b = r.binding_limit || {};
        const d = document.createElement('div');
        const colour = LIMIT_COLOURS[b.kind] || '#0b5ed7';
        d.style.cssText = `padding:12px 16px;margin-bottom:14px;border-radius:8px;border-left:6px solid ${colour};background:#f8f9fa;font-size:14px;line-height:1.55;`;
        const what = r.mode === 'bus' ? `at ${busName(r.study_bus) || 'the selected bus'}` : 'across all loads';
        const bEl = b.element ? (b.kind === 'voltage' ? busName(b.element) : b.element) : '';
        let first;
        if (b.already_violated) {
            first = `<strong>${this._escape(b.label)}${bEl ? ` (${this._escape(bEl)})` : ''} is already exceeded as drawn</strong>, before any load is added.`;
        } else if (b.kind === 'collapse') {
            first = `<strong>Voltage collapse is the first limit:</strong> ${fmtMw(b.margin_mw)} MW more ${what} and the load flow no longer solves.`;
        } else {
            first = `<strong>The first limit is ${b.kind === 'voltage' ? 'voltage' : 'thermal loading'}:</strong> ` +
                `${this._escape(b.label)}${bEl && !(r.mode === 'bus' && b.element === r.study_bus) ? ` at ${this._escape(bEl)}` : ''} after ${fmtMw(b.margin_mw)} MW more ${what}` +
                (b.margin_percent != null ? ` (+${b.margin_percent.toFixed(0)} %)` : '') + '.';
        }
        const tipText = `Voltage collapse comes at ${fmtMw(r.tip_mw)} MW` +
            (r.mode === 'bus' ? ' of added load' : ` total load (+${fmtMw(r.tip_margin_mw)} MW` + (r.tip_margin_percent != null ? `, +${r.tip_margin_percent.toFixed(0)} %` : '') + ')') +
            `, with the lowest bus at ${r.tip_min_vm_pu != null ? Number(r.tip_min_vm_pu).toFixed(3) : '—'} p.u.`;
        d.innerHTML = `${first}<br>${this._escape(tipText)}`;
        return d;
    }

    _buildTiles() {
        const r = this.results;
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px;';
        const find = (kind) => (r.limits || []).find((l) => l.kind === kind);
        const tile = (label, limit, colour) => {
            const o = document.createElement('div');
            o.style.cssText = 'padding:12px 14px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;text-align:center;';
            let value = 'not reached';
            let sub = 'before the collapse point';
            if (limit) {
                value = limit.already_violated ? 'now' : `+${fmtMw(limit.margin_mw)} MW`;
                sub = limit.already_violated ? 'already exceeded as drawn'
                    : (limit.element ? (limit.kind === 'voltage' ? busName(limit.element) : limit.element) : (limit.margin_percent != null ? `+${limit.margin_percent.toFixed(0)} % on today` : ''));
            }
            o.innerHTML = `<div style="font-size:21px;font-weight:700;color:${limit ? colour : '#198754'};line-height:1.2;">${this._escape(value)}</div>` +
                `<div style="font-size:11px;color:#6c757d;margin-top:4px;text-transform:uppercase;letter-spacing:0.03em;">${this._escape(label)}</div>` +
                `<div style="font-size:11px;color:#868e96;margin-top:2px;">${this._escape(sub)}</div>`;
            return o;
        };
        grid.appendChild(tile('Voltage limit', find('voltage'), LIMIT_COLOURS.voltage));
        grid.appendChild(tile('First overload', find('thermal'), LIMIT_COLOURS.thermal));
        grid.appendChild(tile('Voltage collapse', find('collapse'), LIMIT_COLOURS.collapse));
        return grid;
    }

    _table(title, headers, rows) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '14px';
        const t = document.createElement('div');
        t.style.cssText = 'font-weight:600;margin:8px 0 6px;color:#343a40;font-size:13px;';
        t.textContent = title;
        wrap.appendChild(t);
        const scroll = document.createElement('div');
        scroll.style.cssText = 'max-height:240px;overflow:auto;border:1px solid #dee2e6;border-radius:6px;';
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px;';
        const head = document.createElement('tr');
        headers.forEach((hd, i) => {
            const th = document.createElement('th');
            th.style.cssText = 'border-bottom:1px solid #dee2e6;padding:7px 8px;background:#f5f5f5;position:sticky;top:0;text-align:' + (i ? 'right' : 'left') + ';';
            th.textContent = hd;
            head.appendChild(th);
        });
        table.appendChild(head);
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');
                td.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:6px 8px;text-align:' + (i ? 'right' : 'left') + ';';
                td.textContent = cell ?? '—';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        scroll.appendChild(table);
        wrap.appendChild(scroll);
        return wrap;
    }

    _buildLimitsTable() {
        const r = this.results;
        const unit = r.mode === 'bus' ? 'Added load [MW]' : 'Total load [MW]';
        return this._table('Limits in the order they are met', ['Limit', 'Where', unit, 'Margin [MW]', 'Margin [%]'],
            (r.limits || []).map((l) => [
                l.label,
                l.element ? (l.kind === 'voltage' ? busName(l.element) : l.element) : '—',
                fmtMw(l.x_mw),
                l.already_violated ? 'exceeded now' : fmtMw(l.margin_mw),
                l.margin_percent != null && !l.already_violated ? l.margin_percent.toFixed(0) : '—'
            ]));
    }

    _buildWeakestTable() {
        const r = this.results;
        return this._table('Weakest buses (lowest voltage at the collapse point)', ['Bus', 'Rated [kV]', 'Voltage now [p.u.]', 'Voltage at collapse [p.u.]', 'Drop [p.u.]'],
            (r.weakest_buses || []).map((w) => [busName(w.bus), String(w.vn_kv), Number(w.vm_start_pu).toFixed(3), Number(w.vm_tip_pu).toFixed(3), Number(w.drop_pu).toFixed(3)]));
    }

    _downloadCsv() {
        const r = this.results;
        const csv = (v) => {
            const t = String(v ?? '');
            return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const curves = r.curves || [];
        const rows = [[r.mode === 'bus' ? 'added_load_mw' : 'total_load_mw', 'lowest_voltage_pu', 'highest_loading_percent', ...curves.map((c) => `vm_pu ${c.bus}`)].map(csv).join(',')];
        (r.x_mw || []).forEach((x, i) => {
            rows.push([x, r.min_vm_pu_series?.[i], r.max_loading_series?.[i], ...curves.map((c) => c.vm_pu?.[i])].map(csv).join(','));
        });
        rows.push('');
        rows.push('limit,where,load_mw,margin_mw');
        (r.limits || []).forEach((l) => rows.push([l.label, l.element || '', l.x_mw, l.margin_mw].map(csv).join(',')));
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this._fileStem()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    _escape(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

if (typeof window !== 'undefined') window.VoltageStabilityResultsDialog = VoltageStabilityResultsDialog;
export default VoltageStabilityResultsDialog;
