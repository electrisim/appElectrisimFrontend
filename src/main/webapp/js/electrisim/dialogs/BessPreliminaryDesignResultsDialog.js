// BessPreliminaryDesignResultsDialog.js
import { attachBackdropCloseHandler, parkOverlayForCanvas } from '../utils/dialogStyles.js';
import { buildGraphCellLookupMap, resolveGraphCellForResult } from '../utils/attributeUtils.js';
import { applyBessPreliminaryResultsToSld, pickBessSldCase } from '../utils/bessPreliminarySldResults.js';

function fmt(v, d = 3) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toFixed(d);
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function ratingLabel(el) {
    if (el?.type === 'battery_dc' && el.pmax_mw != null && el.pmax_mw !== '') {
        return `${fmt(el.pmax_mw, 1)} MW DC`;
    }
    if (el?.type === 'storage' && el.sn_mva != null && el.sn_mva !== '') {
        const p = el.max_p_mw != null && el.max_p_mw !== '' ? ` / ${fmt(el.max_p_mw, 1)} MW` : '';
        return `${fmt(el.sn_mva, 1)} MVA${p}`;
    }
    if (el?.sn_mva != null && el.sn_mva !== '') return `${fmt(el.sn_mva, 1)} MVA`;
    if (el?.max_i_ka != null && el.max_i_ka !== '') return `${fmt(el.max_i_ka, 2)} kA`;
    return '—';
}

function limiterHtml(lim) {
    if (!lim) return '—';
    const name = lim.name || '';
    const extra = lim.loading_percent != null ? ` (${fmt(lim.loading_percent, 1)}%)` : '';
    const reason = lim.limit_reason ? ` [${lim.limit_reason}]` : '';
    const text = `${lim.type || ''}: ${escapeHtml(name)}${extra}${reason}`.replace(/^: /, '');
    if (!name || name === 'load_flow' || name === 'POC target' || name === 'PCS apparent power'
        || name === 'unit rating' || name === 'PCS rating' || name === 'Battery DC Pmax'
        || name === 'PCS Pmax') {
        return text;
    }
    return `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(name)}" ` +
        `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${text}</button>`;
}

export class BessPreliminaryDesignResultsDialog {
    constructor(editorUi, dataJson, graph, wizardParams) {
        this.ui = editorUi;
        this.graph = graph;
        this.wizardParams = wizardParams || {};
        this.results = dataJson?.bess_preliminary_results || dataJson;
        this._overlay = null;
        this._parkHandle = null;
        this._paintedCase = pickBessSldCase(this.results)?.name || null;
    }

    show() {
        if (!this.results || typeof this.results !== 'object') {
            alert('BESS Preliminary Design returned no results.');
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'bess-prelim-results-overlay';
        overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;';
        this._overlay = overlay;

        const panel = document.createElement('div');
        panel.style.cssText =
            'background:#fff;border-radius:10px;max-width:960px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.2);';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:8px;';
        header.innerHTML = '<h2 style="margin:0;font-size:18px;color:#1d4ed8;flex:1;">BESS Preliminary Design Results</h2>';

        const minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.textContent = 'Minimize';
        minBtn.title = 'Hide this window and show the diagram';
        minBtn.style.cssText = 'padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;cursor:pointer;font-weight:600;';
        minBtn.onclick = () => this.parkForCanvas();

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:6px;background:#64748b;color:#fff;cursor:pointer;';
        closeBtn.onclick = () => this.dismiss();
        header.appendChild(minBtn);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px 20px;overflow:auto;flex:1;font-size:13px;line-height:1.5;';
        body.innerHTML = this.buildHtml();

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;';
        const pdfBtn = document.createElement('button');
        pdfBtn.textContent = 'Export PDF Summary';
        pdfBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;';
        pdfBtn.onclick = () => this.exportPdf();
        footer.appendChild(pdfBtn);

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        if (!document.getElementById('bess-prelim-sld-flash')) {
            const style = document.createElement('style');
            style.id = 'bess-prelim-sld-flash';
            style.textContent = `
                @keyframes electrisim-calc-error-flash {
                    0%, 100% { filter: drop-shadow(0 0 0 rgba(37,99,235,0)); }
                    50% { filter: drop-shadow(0 0 14px rgba(37,99,235,0.95)); }
                }
                .electrisim-calc-error-flash { animation: electrisim-calc-error-flash 1.6s ease-in-out 2; }
            `;
            document.head.appendChild(style);
        }
        attachBackdropCloseHandler(overlay, panel, () => this.dismiss());

        body.addEventListener('click', (ev) => {
            const caseHit = ev.target.closest('[data-sld-case]');
            if (caseHit) {
                const caseName = caseHit.getAttribute('data-sld-case');
                this.paintSld(caseName);
                this.parkForCanvas(caseName);
                return;
            }
            const hit = ev.target.closest('[data-sld-name]');
            if (!hit) return;
            const name = hit.getAttribute('data-sld-name');
            this.focusElement(name);
            this.parkForCanvas(name);
        });

        this._drawPqChart(body.querySelector('#bess-prelim-pq-canvas'));
        this._drawUqChart(body.querySelector('#bess-prelim-uq-canvas'));
        this.paintSld(this._paintedCase);
    }

    parkForCanvas(elementName) {
        if (!this._overlay) return;
        this._parkHandle?.dismiss?.();
        const label = elementName
            ? `Back to results (${elementName})`
            : 'Back to BESS Preliminary Design results';
        this._parkHandle = parkOverlayForCanvas(this._overlay, {
            restoreLabel: label,
            zIndex: 100001,
        });
    }

    dismiss() {
        this._parkHandle?.dismiss?.();
        this._parkHandle = null;
        if (this._overlay?.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null;
    }

    paintSld(caseName) {
        if (!this.graph) return;
        try {
            const painted = applyBessPreliminaryResultsToSld(this.graph, this.results, {
                caseName: caseName || undefined,
                umin_pu: this.wizardParams.umin_pu,
                umax_pu: this.wizardParams.umax_pu,
            });
            if (painted) this._paintedCase = painted;
            this._overlay?.querySelectorAll('[data-sld-case]').forEach((btn) => {
                const on = btn.getAttribute('data-sld-case') === this._paintedCase;
                btn.style.fontWeight = on ? '700' : '400';
                const tr = btn.closest('tr');
                if (tr) tr.style.background = on ? '#eff6ff' : 'transparent';
            });
        } catch (err) {
            console.warn('BESS preliminary SLD paint failed', err);
        }
    }

    focusElement(name) {
        if (!this.graph || !name) return false;
        const map = buildGraphCellLookupMap(this.graph);
        const cell = resolveGraphCellForResult(map, { name }, this.graph);
        if (!cell) return false;
        try {
            this.graph.setSelectionCell(cell);
            if (this.graph.scrollCellToVisible) this.graph.scrollCellToVisible(cell, true);
            const state = this.graph.view?.getState?.(cell);
            const node = state?.shape?.node;
            if (node) {
                node.classList.add('electrisim-calc-error-flash');
                setTimeout(() => node.classList.remove('electrisim-calc-error-flash'), 1600);
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    buildHtml() {
        const r = this.results;
        const summary = r.summary || {};
        let html = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">`;
        html += this.kpi('Cases passed', `${summary.passed_cases ?? 0} / ${summary.total_cases ?? 0}`, '#16a34a');
        html += this.kpi('Failed', summary.failed_cases ?? 0, '#f59e0b');
        html += this.kpi('Diverged', summary.diverged_cases ?? 0, '#dc2626');
        if (summary.target_cases) {
            const allMet = summary.target_met_cases === summary.target_cases;
            html += this.kpi('POC target met',
                `${summary.target_met_cases ?? 0} / ${summary.target_cases}`,
                allMet ? '#16a34a' : '#dc2626');
        }
        html += `</div>`;

        html += this.buildTargetTable();
        html += this.buildVoltageProfile();

        html += `<p style="font-size:11px;color:#64748b;margin:0 0 8px;">SLD result boxes show the selected load-flow case (default <b>Unom_POC_Target</b>, POC P/Q export-positive). Click a case name to paint it on the diagram. Click a limiter or bus name to select that element.</p>`;
        html += `<h3>Named load-flow cases</h3>`;
        html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Active-power setpoints are capped at the POC Pn you entered. Q corners use that Pn and the grid-code power factor (not the full PCS MVA at P ≈ 0).</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Case</th><th>P POC</th><th>Q POC</th><th>Losses</th><th>Status</th><th>Limiting element</th></tr>`;
        (r.named_cases || []).forEach((c) => {
            const status = !c.converged ? '<span style="color:#dc2626">Diverged</span>' :
                c.pass ? '<span style="color:#16a34a">Pass</span>' : '<span style="color:#f59e0b">Fail</span>';
            const painted = c.name && c.name === this._paintedCase;
            const caseBtn = c.converged
                ? `<button type="button" class="bess-prelim-sld-link" data-sld-case="${escapeHtml(c.name)}" ` +
                  `title="Show this case on the SLD" ` +
                  `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;font-weight:${painted ? '700' : '400'};">${escapeHtml(c.name)}</button>`
                : escapeHtml(c.name);
            html += `<tr style="border-bottom:1px solid #e2e8f0;background:${painted ? '#eff6ff' : 'transparent'};"><td style="padding:6px;">${caseBtn}</td>` +
                `<td style="text-align:center">${fmt(c.p_poc_mw)}</td><td style="text-align:center">${fmt(c.q_poc_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.p_loss_mw)}</td>` +
                `<td style="text-align:center">${status}</td><td style="padding:6px;">${limiterHtml(c.limiting_element)}</td></tr>`;
        });
        html += `</table>`;

        html += `<h3>Rating verification (worst-case loading vs nameplate)</h3>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Element</th><th>Type</th><th>Nameplate</th><th>Loading %</th></tr>`;
        (r.rating_table || []).forEach((el) => {
            const over = Number(el.loading_percent) > 100;
            const nameBtn = el.name
                ? `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(el.name)}" ` +
                  `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${escapeHtml(el.name)}</button>`
                : '—';
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${nameBtn}</td>` +
                `<td>${escapeHtml(el.type)}</td><td style="text-align:center">${ratingLabel(el)}</td>` +
                `<td style="text-align:center;color:${over ? '#dc2626' : 'inherit'}">${fmt(el.loading_percent, 1)}</td></tr>`;
        });
        html += `</table>`;

        html += `<h3>P/Q capability envelope at POC</h3>`;
        const envError = r.pq_envelope?.error;
        if (envError) {
            html += `<p style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;` +
                `border-radius:6px;padding:8px;">P/Q envelope was not computed: ${escapeHtml(envError)}</p>`;
        } else if (!r.pq_envelope) {
            html += `<p style="font-size:12px;color:#64748b;">P/Q envelope was not run.</p>`;
        } else {
            html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Plant capability (solid) vs grid-code Q at the entered PF (dashed). Envelope at the diagram tap, 25% Pn steps. P is export-positive on the horizontal axis.</p>`;
            html += `<canvas id="bess-prelim-pq-canvas" width="520" height="320" style="max-width:100%;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;"></canvas>`;
            html += `<h3 style="margin-top:16px;">U–Q at rated P</h3>`;
            html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Inner band 0.96–1.04 pu is the required operating area at max |P|; hatched 0.90–1.10 pu is the reduced-P region. Markers are plant Q at Pn from the envelope.</p>`;
            html += `<canvas id="bess-prelim-uq-canvas" width="520" height="280" style="max-width:100%;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;"></canvas>`;
            html += this.buildEnvelopeLimiters();
        }

        html += `<h3 style="margin-top:16px;">Tap position impact (rated discharge)</h3>`;
        const taps = r.tap_sweep || [];
        const tapProblem = taps.find((t) => t.error);
        if (tapProblem) {
            html += `<p style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;` +
                `border-radius:6px;padding:8px;">${escapeHtml(tapProblem.message || tapProblem.error)}</p>`;
        } else if (!taps.length) {
            html += `<p style="font-size:12px;color:#64748b;">Tap sweep was not run.</p>`;
        } else {
            html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
            html += `<tr style="background:#f1f5f9;"><th>Tap</th><th>HV V (pu)</th><th>MV V (pu)</th><th>P POC</th><th>Qmax</th><th>Qmin</th><th>Qmax limiter</th></tr>`;
            taps.forEach((t) => {
                const status = t.converged ? '' : ' style="color:#dc2626"';
                html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="text-align:center;padding:4px;">${t.tap_pos}</td>` +
                    `<td style="text-align:center">${fmt(t.hv_vm_pu, 4)}</td>` +
                    `<td style="text-align:center"${status}>${t.converged ? fmt(t.mv_vm_pu, 4) : 'diverged'}</td>` +
                    `<td style="text-align:center">${fmt(t.p_poc_mw)}</td>` +
                    `<td style="text-align:center">${fmt(t.q_max_mvar)}</td>` +
                    `<td style="text-align:center">${fmt(t.q_min_mvar)}</td>` +
                    `<td style="padding:4px;">${limiterHtml(t.q_max_limiter || t.limiting_element)}</td></tr>`;
            });
            html += `</table>`;
        }
        return html;
    }

    buildTargetTable() {
        const targets = (this.results.named_cases || []).filter((c) => c.target_met != null);
        if (!targets.length) return '';
        let html = `<h3>Requested POC operating point</h3>`;
        html += `<p style="font-size:11px;color:#64748b;margin:0 0 6px;">` +
            `Export-positive at the POC: P &gt; 0 delivers into the grid, Q &gt; 0 is capacitive. ` +
            `Achieved values include auxiliary load and internal losses.</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Case</th>` +
            `<th>P target</th><th>P achieved</th><th>Q target</th><th>Q achieved</th>` +
            `<th>PCS per unit</th><th>Result</th></tr>`;
        targets.forEach((c) => {
            const ok = c.target_met;
            const lim = c.limiting_element || {};
            const note = ok ? 'Met'
                : (c.clamp_reason === 'Battery DC Pmax' || lim.type === 'battery_dc' ? 'Battery DC Pmax'
                    : (c.clamp_reason === 'PCS apparent power' || c.rating_clamped ? (c.clamp_reason || 'PCS rating exceeded')
                        : 'Not reachable'));
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${escapeHtml(c.name)}</td>` +
                `<td style="text-align:center">${fmt(c.target_p_mw)}</td>` +
                `<td style="text-align:center">${fmt(c.p_poc_mw)}</td>` +
                `<td style="text-align:center">${fmt(c.target_q_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.q_poc_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.pcs_p_each_mw)} MW / ${fmt(c.pcs_q_each_mvar)} Mvar</td>` +
                `<td style="text-align:center;color:${ok ? '#16a34a' : '#dc2626'};font-weight:600;">${note}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    buildVoltageProfile() {
        const profile = this.results.voltage_profile
            || (this.results.named_cases || []).find((c) => c.voltage_profile)?.voltage_profile
            || [];
        if (!profile.length) return '';
        let html = `<h3>Voltage profile (Unom, requested POC point)</h3>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Bus</th><th>Vn (kV)</th><th>V (pu)</th></tr>`;
        profile.forEach((b) => {
            const vm = Number(b.vm_pu);
            const bad = Number.isFinite(vm) && (vm < 0.95 || vm > 1.05);
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">` +
                `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(b.name)}" ` +
                `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${escapeHtml(b.name)}</button></td>` +
                `<td style="text-align:center">${fmt(b.vn_kv, 2)}</td>` +
                `<td style="text-align:center;color:${bad ? '#dc2626' : 'inherit'}">${fmt(b.vm_pu, 4)}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    buildEnvelopeLimiters() {
        const curves = this.results.pq_envelope?.curves || {};
        const rows = [];
        Object.entries(curves).forEach(([vk, c]) => {
            const seen = new Set();
            (c.p_mw || []).forEach((p, i) => {
                ['limit_max', 'limit_min'].forEach((key) => {
                    const lim = (c[key] || [])[i];
                    if (!lim) return;
                    const id = `${vk}|${lim.type}|${lim.name}|${lim.limit_reason || ''}`;
                    if (seen.has(id)) return;
                    seen.add(id);
                    rows.push({
                        u: vk,
                        side: key === 'limit_max' ? 'Qmax' : 'Qmin',
                        p,
                        text: limiterHtml(lim),
                        name: lim.name,
                    });
                });
            });
        });
        if (!rows.length) return '';
        let html = `<p style="font-size:11px;color:#64748b;margin:8px 0 4px;">Binding constraints on the envelope (unique limiter per voltage / side):</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th>U (pu)</th><th>Side</th><th>P (MW)</th><th style="text-align:left;padding:6px;">Limiter</th></tr>`;
        rows.forEach((r) => {
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="text-align:center">${escapeHtml(r.u)}</td>` +
                `<td style="text-align:center">${r.side}</td><td style="text-align:center">${fmt(r.p)}</td>` +
                `<td style="padding:6px;">${r.text}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    kpi(label, value, color) {
        return `<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">` +
            `<div style="font-size:11px;color:#64748b;">${label}</div>` +
            `<div style="font-size:20px;font-weight:700;color:${color};">${value}</div></div>`;
    }

    _drawPqChart(canvas) {
        if (!canvas) return;
        const pq = this.results.pq_envelope;
        const curves = pq?.curves || {};
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const pad = 44;
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, W, H);

        let allP = [];
        let allQ = [];
        Object.values(curves).forEach((c) => {
            (c.p_mw || []).forEach((p) => allP.push(Number(p)));
            (c.q_max_mvar || []).forEach((q) => { if (q != null) allQ.push(Number(q)); });
            (c.q_min_mvar || []).forEach((q) => { if (q != null) allQ.push(Number(q)); });
        });
        const reqMap = pq?.requirements || {};
        const req = Object.values(reqMap).find((r) => r && r.p_mw) || null;
        if (req) {
            (req.p_mw || []).forEach((p) => allP.push(Number(p)));
            (req.q_req_max_mvar || []).forEach((q) => allQ.push(Number(q)));
            (req.q_req_min_mvar || []).forEach((q) => allQ.push(Number(q)));
        }
        if (!allP.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Arial';
            ctx.fillText('P/Q envelope not available', pad, H / 2);
            return;
        }
        const pMin = Math.min(...allP);
        const pMax = Math.max(...allP);
        const qMin = Math.min(...allQ, 0);
        const qMax = Math.max(...allQ, 0);
        const xScale = (p) => pad + ((p - pMin) / (pMax - pMin || 1)) * (W - 2 * pad);
        const yScale = (q) => H - pad - ((q - qMin) / (qMax - qMin || 1)) * (H - 2 * pad);

        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(pad, H - pad);
        ctx.lineTo(W - pad, H - pad);
        ctx.stroke();

        if (req && (req.p_mw || []).length) {
            ctx.save();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
            ctx.strokeStyle = '#64748b';
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const n = Math.min(req.p_mw.length, (req.q_req_max_mvar || []).length, (req.q_req_min_mvar || []).length);
            for (let i = 0; i < n; i++) {
                const x = xScale(Number(req.p_mw[i]));
                const y = yScale(Number(req.q_req_max_mvar[i]));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            for (let i = n - 1; i >= 0; i--) {
                ctx.lineTo(xScale(Number(req.p_mw[i])), yScale(Number(req.q_req_min_mvar[i])));
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
            ctx.fillStyle = '#64748b';
            ctx.font = '11px Arial';
            ctx.fillText(req.label || 'Grid-code requirement', pad + 8, pad + 12);
        }

        const colors = ['#2563eb', '#16a34a', '#dc2626'];
        Object.entries(curves).forEach(([vk, curve], i) => {
            const col = colors[i % colors.length];
            const pts = curve.p_mw || [];
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.beginPath();
            pts.forEach((p, j) => {
                const q = curve.q_max_mvar?.[j];
                if (q == null) return;
                const x = xScale(Number(p));
                const y = yScale(Number(q));
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.beginPath();
            pts.forEach((p, j) => {
                const q = curve.q_min_mvar?.[j];
                if (q == null) return;
                const x = xScale(Number(p));
                const y = yScale(Number(q));
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.fillStyle = col;
            ctx.font = '11px Arial';
            ctx.fillText(`U=${vk} pu`, W - pad - 60, pad + 28 + i * 14);
        });

        ctx.fillStyle = '#334155';
        ctx.font = '12px Arial';
        ctx.fillText('P [MW]', W / 2 - 20, H - 8);
        ctx.save();
        ctx.translate(12, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Q [Mvar]', 0, 0);
        ctx.restore();
    }

    _drawUqChart(canvas) {
        if (!canvas) return;
        const pq = this.results.pq_envelope;
        const curves = pq?.curves || {};
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const pad = 44;
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, W, H);

        const reqMap = pq?.requirements || {};
        const req = Object.values(reqMap).find((r) => r && (r.q_over_pn != null || r.p_mw)) || null;
        let qPn = Number(req?.q_over_pn);
        if (!Number.isFinite(qPn) || qPn <= 0) {
            const pn = Math.max(...(req?.p_mw || []).map((p) => Math.abs(Number(p))), 0);
            const qAbs = Math.max(...(req?.q_req_max_mvar || []).map((q) => Math.abs(Number(q))), 0);
            qPn = pn > 0 ? qAbs / pn : 0.329;
        }
        const umin = Number(this.wizardParams?.umin_pu) || 0.95;
        const umax = Number(this.wizardParams?.umax_pu) || 1.05;

        const xMin = -Math.max(0.45, qPn * 1.2);
        const xMax = Math.max(0.45, qPn * 1.2);
        const yMin = 0.85;
        const yMax = 1.12;
        const xScale = (q) => pad + ((q - xMin) / (xMax - xMin || 1)) * (W - 2 * pad);
        const yScale = (u) => H - pad - ((u - yMin) / (yMax - yMin || 1)) * (H - 2 * pad);

        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(pad, H - pad);
        ctx.lineTo(W - pad, H - pad);
        ctx.stroke();

        const rect = (qLo, qHi, uLo, uHi, fill, stroke, dash) => {
            ctx.save();
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.setLineDash(dash || []);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(xScale(qLo), yScale(uHi), xScale(qHi) - xScale(qLo), yScale(uLo) - yScale(uHi));
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        };
        rect(-qPn, qPn, 0.90, 1.10, 'rgba(148,163,184,0.12)', '#94a3b8', [4, 3]);
        rect(-qPn, qPn, 0.96, 1.04, 'rgba(37,99,235,0.10)', '#2563eb', []);

        const colors = ['#2563eb', '#16a34a', '#dc2626'];
        Object.entries(curves).forEach(([vk, curve], i) => {
            const pts = curve.p_mw || [];
            if (!pts.length) return;
            let best = 0;
            pts.forEach((p, j) => {
                if (Math.abs(Number(p)) >= Math.abs(Number(pts[best]))) best = j;
            });
            const pn = Math.max(...pts.map((p) => Math.abs(Number(p))), 1e-9);
            const u = Number(vk);
            const qmax = Number(curve.q_max_mvar?.[best]);
            const qmin = Number(curve.q_min_mvar?.[best]);
            ctx.fillStyle = colors[i % colors.length];
            if (Number.isFinite(qmax)) {
                ctx.beginPath();
                ctx.arc(xScale(qmax / pn), yScale(u), 4, 0, Math.PI * 2);
                ctx.fill();
            }
            if (Number.isFinite(qmin)) {
                ctx.beginPath();
                ctx.arc(xScale(qmin / pn), yScale(u), 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.font = '11px Arial';
            ctx.fillText(`U=${vk}`, W - pad - 58, pad + 14 + i * 14);
        });

        ctx.fillStyle = '#334155';
        ctx.font = '12px Arial';
        ctx.fillText('Q / Pn', W / 2 - 18, H - 8);
        ctx.save();
        ctx.translate(12, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('U / Uc  [pu]', 0, 0);
        ctx.restore();
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial';
        ctx.fillText(`|Q|/Pn = ${qPn.toFixed(3)}  ·  inner ${umin.toFixed(2)}–${umax.toFixed(2)} shown as 0.96–1.04`, pad + 8, pad + 12);
    }

    exportPdf() {
        if (typeof window.exportEngineeringReport !== 'function') {
            alert('PDF export module not loaded.');
            return;
        }
        this.parkForCanvas();
        window.exportEngineeringReport(
            { bess_preliminary_results: this.results },
            this.graph,
            {
                reportTitle: 'BESS Preliminary Design Summary',
                prefill: {
                    project: 'BESS Preliminary Design',
                    notes: this.targetSummaryText(),
                },
            }
        );
    }

    targetSummaryText() {
        const targets = (this.results.named_cases || []).filter((c) => c.target_met != null);
        if (!targets.length) return '';
        return targets
            .map((c) => `${c.name}: ${c.target_met ? 'target met' : 'target NOT met'} ` +
                `(P ${fmt(c.p_poc_mw)} / ${fmt(c.target_p_mw)} MW, ` +
                `Q ${fmt(c.q_poc_mvar)} / ${fmt(c.target_q_mvar)} Mvar)`)
            .join('; ');
    }
}
