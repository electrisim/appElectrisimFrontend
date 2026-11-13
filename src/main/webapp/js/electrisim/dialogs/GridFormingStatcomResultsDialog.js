// GridFormingStatcomResultsDialog.js - converter check, supercapacitor bank and the simulated frequency events
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

const SERIES = [
    { key: 'p_total', label: 'Total', colour: '#12263a', width: 2.6 },
    { key: 'p_inertia', label: 'Synthetic inertia', colour: '#1f77b4', width: 1.5 },
    { key: 'p_phase', label: 'Phase jump', colour: '#e8590c', width: 1.5 },
    { key: 'p_damping', label: 'Oscillation damping', colour: '#2ca02c', width: 1.5 },
    { key: 'p_support', label: 'Frequency support', colour: '#9467bd', width: 1.5 }
];
const STATUS = {
    ok: { text: 'Covered', colour: '#198754' },
    check: { text: 'Check', colour: '#c92a2a' },
    plant: { text: 'Plant control', colour: '#0b7285' },
    info: { text: 'Note', colour: '#6c757d' }
};
const SET_NAMES = {
    pse_grid_forming: 'PSE (Poland): synthetic inertia, oscillation damping, grid-forming STATCOM',
    pse_island: 'PSE (Poland): island operation with FSM, LFSM-O, LFSM-U (no grid forming)',
    custom: 'Custom'
};

function num(v, digits = 1) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function niceStep(span, target) {
    const raw = (span || 1) / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function hasSignal(arr) {
    return Array.isArray(arr) && arr.some((v) => Math.abs(v) > 1e-6);
}

/** Three stacked panels on one time axis: frequency, active power, bank voltage. */
export function drawGridFormingEventChart(ctx, W, H, results, eventKey, u = 1) {
    const ev = results?.events?.[eventKey];
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (!ev || !(ev.t || []).length) { ctx.restore(); return; }
    const font = (px, weight = 400) => `${weight} ${Math.round(px * u)}px -apple-system, "Segoe UI", Arial, sans-serif`;
    const t = ev.t;
    const left = 74 * u;
    const right = W - 22 * u;
    const top = 16 * u;
    const bottom = H - 44 * u;
    const gap = 22 * u;
    const plotW = right - left;
    const total = bottom - top - 2 * gap;
    const heights = [total * 0.22, total * 0.46, total * 0.32];
    const tMax = t[t.length - 1];
    const X = (x) => left + (x / (tMax || 1)) * plotW;
    const bank = results.bank || {};
    const headroom = results.statcom?.p_headroom_mw;

    const panels = [
        { title: 'Frequency [Hz]', series: [{ data: ev.f, colour: '#12263a', width: 2 }], digits: 1 },
        {
            title: 'Active power of the STATCOM [MW]  (+ into the grid)',
            series: SERIES.filter((s) => s.key === 'p_total' || hasSignal(ev[s.key]))
                .map((s) => ({ data: ev[s.key], colour: s.colour, width: s.width })).reverse(),
            lines: Number.isFinite(headroom) && headroom > 0 ? [
                { y: headroom, colour: '#c92a2a', label: 'converter limit' },
                { y: -headroom, colour: '#c92a2a' }] : [],
            zero: true, digits: 0
        },
        {
            title: 'Supercapacitor bank voltage [V]  (end of life)',
            series: [{ data: ev.v_bank, colour: '#0b7285', width: 2 }],
            lines: [
                { y: bank.v_max, colour: '#d39e00', label: 'highest' },
                { y: bank.v_min, colour: '#d39e00', label: 'lowest working' }],
            digits: 0
        }
    ];

    let y0 = top;
    panels.forEach((panel, pi) => {
        const h = heights[pi];
        let lo = Infinity;
        let hi = -Infinity;
        panel.series.forEach((s) => (s.data || []).forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
        (panel.lines || []).forEach((l) => { if (Number.isFinite(l.y)) { lo = Math.min(lo, l.y); hi = Math.max(hi, l.y); } });
        if (panel.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
        if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
        const pad = (hi - lo || 1) * 0.08;
        lo -= pad; hi += pad * 3.2; // room for the panel title above the curves
        const step = niceStep(hi - lo, 4);
        const Y = (v) => y0 + h - ((v - lo) / (hi - lo)) * h;

        ctx.strokeStyle = '#e6eaee';
        ctx.lineWidth = Math.max(1, u);
        ctx.fillStyle = '#5c6b7a';
        ctx.font = font(12);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
            ctx.beginPath(); ctx.moveTo(left, Y(v)); ctx.lineTo(right, Y(v)); ctx.stroke();
            ctx.fillText(v.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0), left - 8 * u, Y(v));
        }
        ctx.strokeStyle = '#9aa7b4';
        ctx.strokeRect(left, y0, plotW, h);
        if (panel.zero) {
            ctx.strokeStyle = '#9aa7b4';
            ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(right, Y(0)); ctx.stroke();
        }
        (panel.lines || []).forEach((l) => {
            if (!Number.isFinite(l.y)) return;
            ctx.save();
            ctx.setLineDash([6 * u, 5 * u]);
            ctx.strokeStyle = l.colour;
            ctx.lineWidth = Math.max(1, 1.3 * u);
            ctx.beginPath(); ctx.moveTo(left, Y(l.y)); ctx.lineTo(right, Y(l.y)); ctx.stroke();
            ctx.restore();
            if (l.label) {
                ctx.fillStyle = l.colour;
                ctx.font = font(11);
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(l.label, right - 6 * u, Y(l.y) - 2 * u);
            }
        });
        ctx.save();
        ctx.beginPath(); ctx.rect(left, y0, plotW, h); ctx.clip();
        panel.series.forEach((s) => {
            ctx.strokeStyle = s.colour;
            ctx.lineWidth = Math.max(1, s.width * u);
            ctx.lineJoin = 'round';
            ctx.beginPath();
            (s.data || []).forEach((v, i) => { if (i) ctx.lineTo(X(t[i]), Y(v)); else ctx.moveTo(X(t[i]), Y(v)); });
            ctx.stroke();
        });
        ctx.restore();
        ctx.fillStyle = '#33475b';
        ctx.font = font(12, 600);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(panel.title, left + 8 * u, y0 + 5 * u);
        y0 += h + gap;
    });

    // shared time axis
    const xStep = niceStep(tMax, 8);
    ctx.fillStyle = '#5c6b7a';
    ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = 0; x <= tMax + 1e-9; x += xStep) {
        ctx.fillText(xStep < 1 ? x.toFixed(1) : String(Math.round(x)), X(x), bottom + 6 * u);
    }
    ctx.fillStyle = '#33475b';
    ctx.font = font(12, 600);
    ctx.fillText('Time [s]', left + plotW / 2, bottom + 24 * u);
    ctx.restore();
}

export class GridFormingStatcomResultsDialog {
    constructor(results) {
        this.results = results || {};
        this._event = 'under';
    }

    show() {
        const r = this.results;
        const overlay = document.createElement('div');
        overlay.className = 'grid-forming-statcom-results-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.28);max-width:1180px;width:100%;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#212529;";

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e9ecef;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
        const h = document.createElement('h2');
        h.textContent = 'Grid-Forming STATCOM Sizing (Supercapacitors)';
        h.style.cssText = 'margin:0;font-size:18px;font-weight:700;';
        const close = document.createElement('button');
        close.textContent = '×';
        close.title = 'Close';
        close.style.cssText = 'border:none;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#6c757d;padding:0 4px;';
        const closeAll = () => {
            if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
            overlay.remove();
        };
        close.onclick = closeAll;
        header.appendChild(h);
        header.appendChild(close);
        box.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;padding:18px 24px;';
        box.appendChild(body);

        body.appendChild(this._buildVerdict());
        body.appendChild(this._buildTiles());
        (r.warnings || []).forEach((w) => {
            const d = document.createElement('div');
            d.style.cssText = 'padding:8px 12px;margin-bottom:10px;border-radius:8px;background:#fff3cd;border:1px solid #ffecb5;color:#664d03;font-size:12px;line-height:1.5;';
            d.textContent = String(w);
            body.appendChild(d);
        });

        if ((r.checklist || []).length) body.appendChild(this._buildChecklist());

        const storage = r.storage_needed !== false && !!r.bank;
        // chart
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 8px;';
        const underBtn = this._button('Frequency falls (discharge)', '#0b5ed7');
        const overBtn = this._button('Frequency rises (charge)', '#6c757d');
        const pngBtn = this._button('Save image', '#198754');
        const csvBtn = this._button('Download CSV', '#6c757d');
        (storage ? [underBtn, overBtn, pngBtn, csvBtn] : [csvBtn]).forEach((el) => controls.appendChild(el));
        body.appendChild(controls);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;';
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:auto;';
        wrap.appendChild(canvas);
        if (storage) body.appendChild(wrap);
        this._canvas = storage ? canvas : null;

        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:#495057;margin:8px 0 14px;';
        if (storage) body.appendChild(legend);
        const drawLegend = () => {
            legend.innerHTML = '';
            if (!storage) return;
            const ev = r.events?.[this._event] || {};
            SERIES.filter((s) => s.key === 'p_total' || hasSignal(ev[s.key])).forEach((s) => {
                const item = document.createElement('span');
                const sw = document.createElement('span');
                sw.style.cssText = `display:inline-block;width:18px;height:4px;background:${s.colour};vertical-align:middle;margin-right:6px;border-radius:2px;`;
                item.appendChild(sw);
                item.appendChild(document.createTextNode(s.label));
                legend.appendChild(item);
            });
        };

        if (storage) {
            body.appendChild(this._buildDutyTable());
            body.appendChild(this._buildBankTable());
        }
        body.appendChild(this._buildModelTable());

        const notes = document.createElement('div');
        notes.style.cssText = 'font-size:12px;color:#6c757d;line-height:1.55;margin-top:10px;';
        notes.innerHTML = (r.notes || []).map((n) => `<div>• ${this._escape(n)}</div>`).join('');
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

        const redraw = () => { this._drawScreen(); drawLegend(); };
        this._resizeHandler = redraw;
        window.addEventListener('resize', redraw);
        const pick = (key) => {
            this._event = key;
            underBtn.style.background = key === 'under' ? '#0b5ed7' : '#6c757d';
            overBtn.style.background = key === 'over' ? '#0b5ed7' : '#6c757d';
            redraw();
        };
        underBtn.onclick = () => pick('under');
        overBtn.onclick = () => pick('over');
        pngBtn.onclick = () => this._savePng();
        csvBtn.onclick = () => this._downloadCsv();
        redraw();
    }

    _drawScreen() {
        const canvas = this._canvas;
        if (!canvas) return;
        const cssW = Math.max(480, canvas.parentElement.clientWidth || 900);
        const cssH = Math.round(Math.min(620, Math.max(460, cssW * 0.52)));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        drawGridFormingEventChart(canvas.getContext('2d'), canvas.width, canvas.height, this.results, this._event, dpr);
    }

    _fileStem() {
        return 'electrisim_grid_forming_statcom_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    _savePng() {
        const c = document.createElement('canvas');
        c.width = 1920;
        c.height = 1080;
        drawGridFormingEventChart(c.getContext('2d'), c.width, c.height, this.results, this._event, 1.6);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = `${this._fileStem()}_${this._event}_frequency.png`;
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

    _buildVerdict() {
        const r = this.results;
        const s = r.statcom || {};
        const b = r.bank || {};
        const q = r.requirement || {};
        const ok = !!s.rating_ok;
        if (r.storage_needed === false || !r.bank) {
            const d0 = document.createElement('div');
            d0.style.cssText = `padding:12px 16px;margin-bottom:14px;border-radius:8px;border-left:6px solid ${ok ? '#198754' : '#c92a2a'};background:#f8f9fa;font-size:14px;line-height:1.55;`;
            const why = r.requirement_set === 'pse_island'
                ? 'These connection conditions ask for island operation with FSM, LFSM-O and LFSM-U from the turbines and the park controller. They do not ask for grid forming or synthetic inertia.'
                : 'No duty that needs active power is switched on.';
            d0.innerHTML = `<strong>No supercapacitors are needed.</strong> ${this._escape(why)}<br>` +
                this._escape(`The ${num(s.rating_mva, 0)} MVA STATCOM works with reactive power only` +
                    (ok ? '.' : `, and ${num(s.q_reserved_mvar, 0)} Mvar is more than its rating.`));
            return d0;
        }
        const d = document.createElement('div');
        d.style.cssText = `padding:12px 16px;margin-bottom:14px;border-radius:8px;border-left:6px solid ${ok ? '#198754' : '#c92a2a'};background:#f8f9fa;font-size:14px;line-height:1.55;`;
        const converter = ok
            ? `<strong>The ${num(s.rating_mva, 0)} MVA converter is large enough:</strong> the duties need up to ${num(q.peak_mw)} MW on top of ${num(s.q_reserved_mvar, 0)} Mvar, which is ${num(s.required_rating_mva, 0)} MVA.`
            : `<strong>The ${num(s.rating_mva, 0)} MVA converter is too small:</strong> ${num(q.peak_mw)} MW on top of ${num(s.q_reserved_mvar, 0)} Mvar needs ${num(s.required_rating_mva, 0)} MVA.`;
        const bank = `Supercapacitor bank: ${num(b.cells_total, 0)} cells (${num(b.strings, 0)} strings of ${num(b.cells_series, 0)} in series), ` +
            `${num(b.energy_usable_eol_mj, 0)} MJ usable at end of life, to deliver ${num(q.energy_discharge_mj, 0)} MJ and absorb ${num(q.energy_charge_mj, 0)} MJ.`;
        d.innerHTML = `${converter}<br>${this._escape(bank)}`;
        return d;
    }

    _buildTiles() {
        const r = this.results;
        const s = r.statcom || {};
        const b = r.bank || {};
        const q = r.requirement || {};
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px;';
        const tile = (value, label, sub, colour = '#12263a') => {
            const o = document.createElement('div');
            o.style.cssText = 'padding:12px 14px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;text-align:center;';
            o.innerHTML = `<div style="font-size:21px;font-weight:700;color:${colour};line-height:1.2;">${this._escape(value)}</div>` +
                `<div style="font-size:11px;color:#6c757d;margin-top:4px;text-transform:uppercase;letter-spacing:0.03em;">${this._escape(label)}</div>` +
                `<div style="font-size:11px;color:#868e96;margin-top:2px;">${this._escape(sub)}</div>`;
            return o;
        };
        if (r.storage_needed === false || !b.cells_total) {
            grid.appendChild(tile('None', 'Supercapacitors', 'no duty needs stored energy', '#198754'));
            grid.appendChild(tile(`${num(s.rating_mva, 0)} MVA`, 'STATCOM rating', `${num(s.q_reserved_mvar, 0)} Mvar in use in the load flow`));
            const sk = r.grid?.connection_point?.sk_max_mva;
            if (sk != null) grid.appendChild(tile(`${num(sk, 0)} MVA`, 'Grid short-circuit power', 'at the connection point, maximum'));
            return grid;
        }
        grid.appendChild(tile(`${num(q.peak_mw)} MW`, 'Peak active power', `converter can give ${num(s.p_headroom_mw)} MW`));
        grid.appendChild(tile(`${num(s.required_rating_mva, 0)} MVA`, 'Converter rating needed', `installed ${num(s.rating_mva, 0)} MVA`, s.rating_ok ? '#198754' : '#c92a2a'));
        grid.appendChild(tile(`${num(q.energy_discharge_mj, 0)} MJ`, 'Energy to deliver', `${num((q.energy_discharge_mj || 0) / 3.6, 1)} kWh; absorb ${num(q.energy_charge_mj, 0)} MJ`));
        grid.appendChild(tile(num(b.cells_total, 0), 'Supercapacitor cells', `${num(b.strings, 0)} strings × ${num(b.cells_series, 0)} in series`));
        if (r.inertia?.enabled) {
            grid.appendChild(tile(`${num(r.inertia.kinetic_energy_mws, 0)} MW·s`, 'Inertia provided', `H = ${num(r.inertia.h_on_plant_s, 2)} s on the plant power`));
        }
        return grid;
    }

    _table(title, headers, rows, leftCols = 1) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '14px';
        const t = document.createElement('div');
        t.style.cssText = 'font-weight:600;margin:8px 0 6px;color:#343a40;font-size:13px;';
        t.textContent = title;
        wrap.appendChild(t);
        const scroll = document.createElement('div');
        scroll.style.cssText = 'overflow:auto;border:1px solid #dee2e6;border-radius:6px;';
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px;';
        const head = document.createElement('tr');
        headers.forEach((hd, i) => {
            const th = document.createElement('th');
            th.style.cssText = 'border-bottom:1px solid #dee2e6;padding:7px 8px;background:#f5f5f5;text-align:' + (i < leftCols ? 'left' : 'right') + ';';
            th.textContent = hd;
            head.appendChild(th);
        });
        table.appendChild(head);
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            row.forEach((cell, i) => {
                const td = document.createElement('td');
                td.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:6px 8px;vertical-align:top;text-align:' + (i < leftCols ? 'left' : 'right') + ';';
                if (cell && typeof cell === 'object' && cell.colour) {
                    td.style.color = cell.colour;
                    td.style.fontWeight = '600';
                    td.textContent = cell.text;
                } else {
                    td.textContent = cell ?? '—';
                }
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        scroll.appendChild(table);
        wrap.appendChild(scroll);
        return wrap;
    }

    _buildChecklist() {
        const r = this.results;
        return this._table(`Grid Code requirement: ${SET_NAMES[r.requirement_set] || r.requirement_set}`,
            ['Item', 'Requirement', 'This design', 'Status'],
            (r.checklist || []).map((c) => [c.item, c.requirement, c.result, STATUS[c.status] || STATUS.info]), 3);
    }

    _buildDutyTable() {
        const r = this.results;
        const q = r.requirement || {};
        const rows = (r.duties || []).map((d) => [d.label, d.basis, num(d.peak_mw), num(d.energy_discharge_mj), num(d.energy_charge_mj)]);
        rows.push(['All duties together (simulated)', 'used for the converter check and the bank', num(q.peak_mw), num(q.energy_discharge_mj), num(q.energy_charge_mj)]);
        return this._table('Duties', ['Duty', 'Basis', 'Peak power [MW]', 'Energy to deliver [MJ]', 'Energy to absorb [MJ]'], rows, 2);
    }

    _buildBankTable() {
        const b = this.results.bank || {};
        const under = this.results.events?.under || {};
        const over = this.results.events?.over || {};
        return this._table('Supercapacitor bank', ['Quantity', 'Value'], [
            ['Cell', `${num(b.cell_capacitance_f, 0)} F, ${num(b.cell_voltage_v, 2)} V, ${num(b.cell_esr_mohm, 2)} mΩ, peak ${num(b.cell_max_current_a, 0)} A`],
            ['Cells in series per string', num(b.cells_series, 0)],
            ['Strings in parallel', `${num(b.strings, 0)} (${num(b.strings_without_margin, 0)} before the ${num(b.design_margin_percent, 0)} % margin)`],
            ['Cells in total', num(b.cells_total, 0)],
            ['Capacitance of the bank, new / end of life', `${num(b.capacitance_new_f, 1)} F / ${num(b.capacitance_eol_f, 1)} F`],
            ['Resistance of the bank, new / end of life', `${num(b.esr_new_mohm, 3)} mΩ / ${num(b.esr_eol_mohm, 3)} mΩ`],
            ['Voltage window', `${num(b.v_min, 0)} V to ${num(b.v_max, 0)} V`],
            ['Resting voltage', `${num(b.v_rest, 0)} V (allowed ${num(b.v_rest_low, 0)} to ${num(b.v_rest_high, 0)} V)`],
            ['Usable energy in the window, new / end of life', `${num(b.energy_usable_new_mj, 0)} MJ / ${num(b.energy_usable_eol_mj, 0)} MJ`],
            ['Lowest voltage when the frequency falls', `${num(under.v_low, 0)} V`],
            ['Highest voltage when the frequency rises', `${num(over.v_high, 0)} V`],
            ['Peak current per cell / of the bank', `${num(b.peak_cell_current_a, 0)} A / ${num(b.peak_bank_current_ka, 1)} kA`],
            ['Peak loss in the cells (end of life)', `${num(b.peak_loss_mw, 1)} MW`]
        ]);
    }

    _buildModelTable() {
        const r = this.results;
        const s = r.statcom || {};
        const p = r.plant || {};
        const g = r.grid || {};
        const strength = (x) => (x
            ? `${num(x.sk_max_mva, 0)} MVA max` + (x.sk_min_mva != null ? `, ${num(x.sk_min_mva, 0)} MVA min` : '')
            : '—');
        const scr = (x) => (x && x.scr_max != null
            ? `${num(x.scr_max, 1)} max` + (x.scr_min != null ? `, ${num(x.scr_min, 1)} min` : '')
            : '—');
        const rows = [
            ['STATCOM', `${s.name || '—'} at ${s.bus || '—'} (${num(s.vn_kv, 0)} kV), ${num(s.rating_mva, 0)} MVA`],
            ['Coupling reactance', `${num(s.x_coupling_ohm, 1)} Ω = ${num(s.x_coupling_pu, 2)} p.u. on the STATCOM rating`],
            ['Reactive power in the load flow', s.q_operating_mvar == null ? 'not available' : `${num(s.q_operating_mvar, 1)} Mvar (+ = into the grid)`],
            ['Reactive power kept free in the converter check', `${num(s.q_reserved_mvar, 1)} Mvar`],
            ['Plant', `${num(p.p_mw, 0)} MW` + (p.units ? `, ${p.units} generating units, ${num(p.s_mva, 0)} MVA` : '')],
            ['Grid short-circuit power at the STATCOM bus', strength(g.statcom_bus)],
            ['Short-circuit ratio of the STATCOM', scr(g.statcom_bus)]
        ];
        if (g.connection_point) {
            rows.push([`Grid short-circuit power at the connection point (${g.connection_point.bus})`, strength(g.connection_point)]);
            rows.push(['Short-circuit ratio of the plant at the connection point', scr(g.connection_point)]);
        }
        if (s.phase_jump_mw != null && r.storage_needed !== false) rows.push(['Power drawn by the phase jump', `${num(s.phase_jump_mw)} MW`]);
        return this._table('Read from the model', ['Quantity', 'Value'], rows);
    }

    _downloadCsv() {
        const r = this.results;
        const csv = (v) => {
            const text = String(v ?? '');
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const rows = [];
        const s = r.statcom || {};
        const b = r.bank || {};
        const q = r.requirement || {};
        rows.push(`supercapacitors_needed,${r.storage_needed === false ? 'no' : 'yes'}`);
        rows.push('quantity,value');
        [['statcom_rating_mva', s.rating_mva], ['required_rating_mva', s.required_rating_mva], ['q_reserved_mvar', s.q_reserved_mvar],
            ['peak_active_power_mw', q.peak_mw], ['energy_to_deliver_mj', q.energy_discharge_mj], ['energy_to_absorb_mj', q.energy_charge_mj],
            ['cells_series', b.cells_series], ['strings', b.strings], ['cells_total', b.cells_total],
            ['capacitance_eol_f', b.capacitance_eol_f], ['esr_eol_mohm', b.esr_eol_mohm], ['v_min', b.v_min], ['v_max', b.v_max], ['v_rest', b.v_rest],
            ['energy_usable_eol_mj', b.energy_usable_eol_mj]].forEach((row) => rows.push(row.map(csv).join(',')));
        rows.push('');
        rows.push('duty,basis,peak_mw,energy_to_deliver_mj,energy_to_absorb_mj');
        (r.duties || []).forEach((d) => rows.push([d.label, d.basis, d.peak_mw, d.energy_discharge_mj, d.energy_charge_mj].map(csv).join(',')));
        rows.push('');
        rows.push('item,requirement,this_design,status');
        (r.checklist || []).forEach((c) => rows.push([c.item, c.requirement, c.result, c.status].map(csv).join(',')));
        ['under', 'over'].forEach((key) => {
            const ev = r.events?.[key];
            if (!ev) return;
            rows.push('');
            rows.push(`event,${key === 'under' ? 'frequency falls' : 'frequency rises'}`);
            rows.push('t_s,f_hz,p_total_mw,p_inertia_mw,p_phase_jump_mw,p_damping_mw,p_frequency_support_mw,bank_voltage_v,stored_energy_mj');
            (ev.t || []).forEach((tt, i) => rows.push([tt, ev.f[i], ev.p_total[i], ev.p_inertia[i], ev.p_phase[i], ev.p_damping[i], ev.p_support[i], ev.v_bank[i], ev.e_stored_mj[i]].join(',')));
        });
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

if (typeof window !== 'undefined') window.GridFormingStatcomResultsDialog = GridFormingStatcomResultsDialog;
export default GridFormingStatcomResultsDialog;
