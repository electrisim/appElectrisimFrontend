// BessPreliminaryDesignResultsDialog.js
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
import { buildGraphCellLookupMap, resolveGraphCellForResult } from '../utils/attributeUtils.js';

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
        || name === 'unit rating' || name === 'PCS rating') {
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

        const panel = document.createElement('div');
        panel.style.cssText =
            'background:#fff;border-radius:10px;max-width:960px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.2);';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = '<h2 style="margin:0;font-size:18px;color:#1d4ed8;">BESS Preliminary Design Results</h2>';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:6px;background:#64748b;color:#fff;cursor:pointer;';
        closeBtn.onclick = () => overlay.remove();
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
        attachBackdropCloseHandler(overlay, panel, () => overlay.remove());

        body.addEventListener('click', (ev) => {
            const hit = ev.target.closest('[data-sld-name]');
            if (!hit) return;
            this.focusElement(hit.getAttribute('data-sld-name'));
        });

        this._drawPqChart(body.querySelector('#bess-prelim-pq-canvas'));
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

        html += `<p style="font-size:11px;color:#64748b;margin:0 0 8px;">Click a limiter or bus name to select it on the SLD.</p>`;
        html += `<h3>Named load-flow cases</h3>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Case</th><th>P POC</th><th>Q POC</th><th>Losses</th><th>Status</th><th>Limiting element</th></tr>`;
        (r.named_cases || []).forEach((c) => {
            const status = !c.converged ? '<span style="color:#dc2626">Diverged</span>' :
                c.pass ? '<span style="color:#16a34a">Pass</span>' : '<span style="color:#f59e0b">Fail</span>';
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${escapeHtml(c.name)}</td>` +
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
            html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Envelope at the diagram tap, 25% Pn steps. Use the tap table below for OLTC impact.</p>`;
            html += `<canvas id="bess-prelim-pq-canvas" width="520" height="320" style="max-width:100%;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;"></canvas>`;
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
            const note = ok ? 'Met'
                : (c.rating_clamped ? 'PCS rating exceeded' : 'Not reachable');
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
            ctx.fillText(`U=${vk} pu`, W - pad - 60, pad + 14 + i * 14);
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

    exportPdf() {
        if (typeof window.exportEngineeringReport !== 'function') {
            alert('PDF export module not loaded.');
            return;
        }
        // exportEngineeringReport owns the metadata dialog; passing a prefill
        // here avoids prompting the user twice.
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
