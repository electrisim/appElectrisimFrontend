// VoltageStabilityRankingDialog.js - how much new load each bus can take, as ranked bars
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

const KIND_COLOURS = { voltage: '#d39e00', thermal: '#e8590c', collapse: '#c92a2a' };
const KIND_WORDS = { voltage: 'voltage limit', thermal: 'overload', collapse: 'voltage collapse' };

function busName(name) {
    const t = String(name ?? '').trim();
    return /^\d+$/.test(t) ? `Bus ${t}` : t;
}

function fmtMw(v) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    const a = Math.abs(n);
    if (a >= 100) return n.toFixed(0);
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2);
}

function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Ranked bars: the solid part of each bar ends at the first limit that is met (coloured by
 * its kind), the pale part runs on to the collapse point. `opts.poster` adds title and footer.
 */
export function drawVoltageStabilityRanking(ctx, W, H, results, opts = {}) {
    const poster = !!opts.poster;
    const u = opts.unit || Math.min(W, H) / 1000;
    const font = (px, weight = 400) => `${weight} ${Math.round(px * u)}px -apple-system, "Segoe UI", Arial, sans-serif`;
    const all = results.buses || [];
    const maxRows = opts.maxRows || all.length;
    let rows = all;
    let cut = 0;
    if (all.length > maxRows) {
        // keep both ends of the ranking: they are the story
        const head = Math.ceil(maxRows / 2);
        rows = all.slice(0, head).concat(all.slice(all.length - (maxRows - head)));
        cut = head;
    }

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    let top = 20 * u;
    if (poster) {
        ctx.fillStyle = '#12263a';
        ctx.font = font(46, 700);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(opts.title || 'Where can this grid take a new load?', 48 * u, 44 * u);
        ctx.fillStyle = '#5c6b7a';
        ctx.font = font(25, 400);
        ctx.fillText(opts.subtitle || '', 48 * u, 104 * u);
        top = 168 * u;
    }
    const footer = (poster ? 190 : 84) * u;
    ctx.font = font(poster ? 21 : 13, 600);
    const labelW = Math.max(...rows.map((r) => ctx.measureText(busName(r.bus)).width), 40 * u) + 22 * u;
    const left = (poster ? 48 : 14) * u + labelW;
    const right = W - (poster ? 300 : 210) * u;
    const bottom = H - footer;
    const plotW = right - left;
    const gapRow = cut ? 1 : 0;
    const rowH = (bottom - top) / (rows.length + gapRow);
    const barH = Math.max(3 * u, Math.min(rowH * 0.68, 34 * u));
    const xMax = Math.max(...all.map((r) => r.collapse_mw || 0), 1) * 1.02;
    const X = (v) => left + (Math.max(0, v) / xMax) * plotW;

    // grid
    const step = niceStep(xMax, 6);
    ctx.strokeStyle = '#e6eaee';
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.fillStyle = '#5c6b7a';
    ctx.font = font(poster ? 20 : 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let v = 0; v <= xMax + 1e-9; v += step) {
        ctx.beginPath(); ctx.moveTo(X(v), top); ctx.lineTo(X(v), bottom); ctx.stroke();
        ctx.fillText(step >= 1 ? String(Math.round(v)) : v.toFixed(1), X(v), bottom + 6 * u);
    }
    ctx.fillStyle = '#33475b';
    ctx.font = font(poster ? 22 : 13, 600);
    ctx.fillText('New load at the bus [MW]', left + plotW / 2, bottom + (poster ? 36 : 22) * u);

    rows.forEach((r, i) => {
        const slot = i + (cut && i >= cut ? 1 : 0);
        const cy = top + rowH * (slot + 0.5);
        const colour = KIND_COLOURS[r.first_limit_kind] || '#333';
        // pale part: up to collapse
        ctx.fillStyle = '#e9edf1';
        ctx.fillRect(left, cy - barH / 2, X(r.collapse_mw) - left, barH);
        // solid part: up to the first limit
        ctx.fillStyle = colour;
        const w = Math.max(r.already_violated ? 3 * u : 0, X(r.first_limit_mw) - left);
        ctx.fillRect(left, cy - barH / 2, w, barH);
        // collapse tick
        ctx.fillStyle = KIND_COLOURS.collapse;
        ctx.fillRect(X(r.collapse_mw) - 1.5 * u, cy - barH / 2, 3 * u, barH);

        ctx.fillStyle = '#12263a';
        ctx.font = font(poster ? 21 : 13, 600);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(busName(r.bus), left - 12 * u, cy);
        if (barH >= 9 * u) {
            ctx.textAlign = 'left';
            ctx.font = font(poster ? 19 : 12, 600);
            ctx.fillStyle = '#12263a';
            const main = r.already_violated ? 'exceeded now' : `${fmtMw(r.first_limit_mw)} MW`;
            const tx = X(r.collapse_mw) + 10 * u;
            ctx.fillText(main, tx, cy);
            ctx.fillStyle = '#8795a3';
            ctx.font = font(poster ? 17 : 11, 400);
            ctx.fillText(`collapse ${fmtMw(r.collapse_mw)}`, tx + ctx.measureText(main).width * (poster ? 19 / 17 : 12 / 11) + 10 * u, cy);
        }
    });
    if (cut) {
        const cy = top + rowH * (cut + 0.5);
        ctx.fillStyle = '#8795a3';
        ctx.font = font(poster ? 19 : 12, 400);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`… ${all.length - rows.length} more buses in between …`, left, cy);
    }

    // legend: only the kinds that occur, wrapped onto a second row when it does not fit
    const x0 = (poster ? 48 : 14) * u;
    let lx = x0;
    let ly = bottom + (poster ? 86 : 50) * u;
    ctx.font = font(poster ? 21 : 12, 400);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const kinds = new Set(all.map((r) => r.first_limit_kind));
    const items = [];
    if (kinds.has('voltage')) items.push(['voltage', 'room up to the voltage limit']);
    if (kinds.has('thermal')) items.push(['thermal', 'room up to the first overload']);
    items.push(['pale', 'past the first limit'], ['collapse', 'voltage collapse']);
    items.forEach(([k, label]) => {
        const w = ctx.measureText(label).width + 62 * u;
        if (lx + w > W - 30 * u && lx > x0) { lx = x0; ly += (poster ? 34 : 20) * u; }
        ctx.fillStyle = k === 'pale' ? '#e9edf1' : KIND_COLOURS[k];
        if (k === 'collapse') ctx.fillRect(lx + 10 * u, ly - 9 * u, 3 * u, 18 * u);
        else ctx.fillRect(lx, ly - 7 * u, 24 * u, 14 * u);
        ctx.fillStyle = '#33475b';
        ctx.fillText(label, lx + 32 * u, ly);
        lx += w;
    });
    if (poster) {
        ctx.fillStyle = '#8795a3';
        ctx.font = font(20, 400);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('electrisim.com', W - 40 * u, H - 22 * u);
    }
    ctx.restore();
}

export class VoltageStabilityRankingDialog {
    constructor(results, options = {}) {
        this.results = results || {};
        this.onStudyBus = options.onStudyBus || null;
    }

    _titles() {
        const r = this.results;
        const n = (r.buses || []).length;
        return {
            title: 'Where can this grid take a new load?',
            subtitle: `A new load (power factor ${r.power_factor}) at each of ${n} buses in turn · MW before the first limit`
        };
    }

    show() {
        const r = this.results;
        const rows = r.buses || [];
        const overlay = document.createElement('div');
        overlay.className = 'voltage-stability-ranking-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.28);max-width:1180px;width:100%;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#212529;";
        const closeAll = () => { window.removeEventListener('resize', redraw); overlay.remove(); };

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e9ecef;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
        const h = document.createElement('h2');
        h.textContent = 'Voltage Stability Margin: buses compared';
        h.style.cssText = 'margin:0;font-size:18px;font-weight:700;';
        const close = document.createElement('button');
        close.textContent = '×';
        close.title = 'Close';
        close.style.cssText = 'border:none;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#6c757d;padding:0 4px;';
        close.onclick = closeAll;
        header.appendChild(h);
        header.appendChild(close);
        box.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;padding:18px 24px;';
        box.appendChild(body);

        const best = rows[0];
        const worst = rows[rows.length - 1];
        const verdict = document.createElement('div');
        verdict.style.cssText = 'padding:12px 16px;margin-bottom:14px;border-radius:8px;border-left:6px solid #0b5ed7;background:#f8f9fa;font-size:14px;line-height:1.55;';
        const describe = (row) => row.already_violated
            ? `<strong>${this._escape(busName(row.bus))}</strong>: a limit is already exceeded as drawn`
            : `<strong>${this._escape(busName(row.bus))}</strong>: ${fmtMw(row.first_limit_mw)} MW before the first limit (${KIND_WORDS[row.first_limit_kind] || row.first_limit_kind}), collapse at ${fmtMw(row.collapse_mw)} MW`;
        const thermalFirst = rows.filter((x) => x.first_limit_kind === 'thermal').length;
        const voltageFirst = rows.filter((x) => x.first_limit_kind === 'voltage').length;
        verdict.innerHTML = `Most room: ${describe(best)}.<br>Least room: ${describe(worst)}.<br>` +
            `The first limit is an overload at ${thermalFirst} bus${thermalFirst === 1 ? '' : 'es'} and the voltage limit at ${voltageFirst}` +
            (rows.length - thermalFirst - voltageFirst ? `; at ${rows.length - thermalFirst - voltageFirst} it is the collapse point itself` : '') + '.';
        body.appendChild(verdict);

        [...(r.warnings || []).slice(0, 3),
            ...((r.skipped_buses || []).length ? [`Not studied (no collapse point found): ${r.skipped_buses.map(busName).join(', ')}.`] : [])
        ].forEach((w) => {
            const d = document.createElement('div');
            d.style.cssText = 'padding:8px 12px;margin-bottom:10px;border-radius:8px;background:#fff3cd;border:1px solid #ffecb5;color:#664d03;font-size:12px;line-height:1.5;';
            d.textContent = String(w);
            body.appendChild(d);
        });

        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 8px;';
        const pngTall = this._button('Save image 1080×1350', '#198754');
        const pngWide = this._button('Save image 1920×1080', '#198754');
        const csvBtn = this._button('Download CSV', '#6c757d');
        [pngTall, pngWide, csvBtn].forEach((el) => controls.appendChild(el));
        body.appendChild(controls);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;';
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:auto;';
        wrap.appendChild(canvas);
        body.appendChild(wrap);

        const redraw = () => {
            const cssW = Math.max(480, wrap.clientWidth || 900);
            const cssH = Math.round(Math.max(280, Math.min(940, 110 + rows.length * 22)));
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
            drawVoltageStabilityRanking(canvas.getContext('2d'), canvas.width, canvas.height, r, { unit: dpr });
        };

        body.appendChild(this._buildTable(closeAll));
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
        window.addEventListener('resize', redraw);
        redraw();

        pngTall.onclick = () => this._savePng(1080, 1350);
        pngWide.onclick = () => this._savePng(1920, 1080);
        csvBtn.onclick = () => this._downloadCsv();
    }

    _posterCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        drawVoltageStabilityRanking(c.getContext('2d'), w, h, this.results, {
            poster: true, maxRows: h >= w ? 30 : 22, ...this._titles()
        });
        return c;
    }

    _fileStem() {
        return 'electrisim_bus_headroom_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    _savePng(w, h) {
        const a = document.createElement('a');
        a.href = this._posterCanvas(w, h).toDataURL('image/png');
        a.download = `${this._fileStem()}_${w}x${h}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    _button(text, colour) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = `padding:7px 14px;background:${colour};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;`;
        return b;
    }

    _buildTable(closeAll) {
        const r = this.results;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:14px;';
        const t = document.createElement('div');
        t.style.cssText = 'font-weight:600;margin:8px 0 6px;color:#343a40;font-size:13px;';
        t.textContent = 'Buses, most room first';
        wrap.appendChild(t);
        const scroll = document.createElement('div');
        scroll.style.cssText = 'max-height:320px;overflow:auto;border:1px solid #dee2e6;border-radius:6px;';
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px;';
        const heads = ['Bus', 'Rated [kV]', 'First limit [MW]', 'First limit', 'Voltage limit [MW]', 'First overload [MW]', 'Collapse [MW]'];
        if (this.onStudyBus) heads.push('');
        const head = document.createElement('tr');
        heads.forEach((hd, i) => {
            const th = document.createElement('th');
            th.style.cssText = 'border-bottom:1px solid #dee2e6;padding:7px 8px;background:#f5f5f5;position:sticky;top:0;text-align:' + (i === 0 || i === 3 ? 'left' : 'right') + ';';
            th.textContent = hd;
            head.appendChild(th);
        });
        table.appendChild(head);
        (r.buses || []).forEach((row) => {
            const tr = document.createElement('tr');
            const what = (KIND_WORDS[row.first_limit_kind] || row.first_limit_kind) +
                (row.first_limit_element ? ` (${row.first_limit_kind === 'voltage' ? busName(row.first_limit_element) : row.first_limit_element})` : '');
            const cells = [busName(row.bus), String(row.vn_kv), row.already_violated ? 'exceeded now' : fmtMw(row.first_limit_mw), what,
                fmtMw(row.voltage_limit_mw), fmtMw(row.thermal_limit_mw), fmtMw(row.collapse_mw)];
            cells.forEach((cell, i) => {
                const td = document.createElement('td');
                td.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:6px 8px;text-align:' + (i === 0 || i === 3 ? 'left' : 'right') + ';';
                if (i === 2) { td.style.fontWeight = '600'; td.style.color = KIND_COLOURS[row.first_limit_kind] || '#212529'; }
                td.textContent = cell;
                tr.appendChild(td);
            });
            if (this.onStudyBus) {
                const td = document.createElement('td');
                td.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:4px 8px;text-align:right;';
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = 'P-V curve';
                b.title = 'Run the full study for this bus';
                b.style.cssText = 'padding:3px 10px;border:1px solid #0b5ed7;background:#fff;color:#0b5ed7;border-radius:5px;cursor:pointer;font-size:12px;';
                b.onclick = () => { closeAll(); this.onStudyBus(row); };
                td.appendChild(b);
                tr.appendChild(td);
            }
            table.appendChild(tr);
        });
        scroll.appendChild(table);
        wrap.appendChild(scroll);
        return wrap;
    }

    _downloadCsv() {
        const csv = (v) => {
            const t = String(v ?? '');
            return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const lines = ['bus,rated_kv,first_limit_mw,first_limit,first_limit_element,voltage_limit_mw,first_overload_mw,first_overload_element,collapse_mw,already_exceeded'];
        (this.results.buses || []).forEach((r) => lines.push([r.bus, r.vn_kv, r.first_limit_mw, r.first_limit_kind, r.first_limit_element || '',
            r.voltage_limit_mw ?? '', r.thermal_limit_mw ?? '', r.thermal_limit_element || '', r.collapse_mw, r.already_violated].map(csv).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

if (typeof window !== 'undefined') window.VoltageStabilityRankingDialog = VoltageStabilityRankingDialog;
export default VoltageStabilityRankingDialog;
