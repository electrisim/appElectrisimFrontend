// BessDispatchReversalResultsDialog.js - V(t), P(t), Q(t) for BESS P-step study
function loadChartJs() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') {
            resolve(window.Chart);
            return;
        }
        const existing = document.querySelector('script[data-electrisim-chartjs]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.Chart));
            existing.addEventListener('error', () => reject(new Error('Chart.js failed')));
            return;
        }
        const script = document.createElement('script');
        script.src = 'js/vendor/chart.umd.min.js';
        script.dataset.electrisimChartjs = '1';
        script.onload = () => resolve(window.Chart);
        script.onerror = () => reject(new Error('Chart.js failed to load'));
        document.head.appendChild(script);
    });
}

function fmt(v, d = 3) {
    if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'N/A';
    return Number(v).toFixed(d);
}

function passBadge(ok) {
    if (ok === true) return '<span style="color:#198754;font-weight:600;">PASS</span>';
    if (ok === false) return '<span style="color:#dc3545;font-weight:600;">FAIL</span>';
    return '—';
}

export class BessDispatchReversalResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'BESS Dispatch Reversal Results';
        this.charts = [];
    }

    show() {
        const r = this.results;
        if (r.error) {
            alert('BESS Dispatch Reversal failed: ' + (r.message || 'unknown error'));
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            padding: 16px; box-sizing: border-box;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.25);
            width: min(1100px, 100%); max-height: 92vh; overflow: hidden;
            font-family: Arial, sans-serif; display: flex; flex-direction: column;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'padding: 20px 24px 12px; border-bottom: 1px solid #eee; flex-shrink: 0;';
        const title = document.createElement('h2');
        title.textContent = this.title;
        title.style.cssText = 'margin: 0 0 10px 0; font-size: 20px;';
        header.appendChild(title);

        const sum = document.createElement('div');
        sum.style.cssText = 'font-size:13px;color:#444;display:flex;flex-wrap:wrap;gap:12px 20px;';
        sum.innerHTML = `
            <span><strong>Engine:</strong> ${r.engine || '—'}</span>
            <span><strong>POC:</strong> ${r.poc_bus || '—'}</span>
            <span><strong>V(t):</strong> ${fmt(r.v_min, 4)} – ${fmt(r.v_max, 4)} pu</span>
            <span><strong>Limits:</strong> ${fmt(r.vmin_pu, 3)} – ${fmt(r.vmax_pu, 3)} pu</span>
            <span><strong>Check:</strong> ${passBadge(r.within_limits)}</span>
            <span><strong>ΔV during ramp:</strong> ${fmt((r.dv_overshoot_pu || 0) * 100, 2)} %</span>
            <span><strong>t peak:</strong> ${fmt(r.t_peak_s, 1)} s</span>
            <span><strong>P ramp:</strong> ${fmt(r.p_start_mw, 1)} → ${fmt(r.p_end_mw, 1)} MW / ${fmt(r.ramp_s, 1)} s</span>
        `;
        header.appendChild(sum);
        dialog.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 24px;';

        if (Array.isArray(r.warnings) && r.warnings.length) {
            const warn = document.createElement('div');
            warn.style.cssText = 'margin-bottom:12px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px;';
            warn.innerHTML = '<strong>Notes</strong><ul style="margin:6px 0 0;">' +
                r.warnings.map((w) => `<li>${w}</li>`).join('') + '</ul>';
            body.appendChild(warn);
        }

        const chartsHost = document.createElement('div');
        chartsHost.id = 'bess-dispatch-reversal-charts';
        body.appendChild(chartsHost);
        dialog.appendChild(body);

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 24px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';

        const csvBtn = document.createElement('button');
        csvBtn.textContent = 'Download CSV';
        csvBtn.style.cssText = 'padding:8px 14px;border:1px solid #ccc;border-radius:4px;background:#f8f9fa;cursor:pointer;';
        csvBtn.onclick = () => this.downloadCsv();
        footer.appendChild(csvBtn);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'padding:8px 18px;border:none;border-radius:4px;background:#0d6efd;color:#fff;cursor:pointer;';
        closeBtn.onclick = () => {
            this.charts.forEach((c) => { try { c.destroy(); } catch (_) {} });
            overlay.remove();
        };
        footer.appendChild(closeBtn);
        dialog.appendChild(footer);

        overlay.appendChild(dialog);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBtn.click();
        });
        document.body.appendChild(overlay);

        if (Array.isArray(r.time) && r.time.length) {
            this.renderCharts(chartsHost, r);
        }
    }

    downloadCsv() {
        const r = this.results;
        const t = r.time || [];
        const v = (r.bus_voltage && r.bus_voltage[0]?.values) || [];
        const p = (r.p_mw && r.p_mw[0]?.values) || [];
        const q = (r.q_mvar && r.q_mvar[0]?.values) || [];
        const pc = (r.p_cmd_mw && r.p_cmd_mw[0]?.values) || [];
        const lines = ['t_s,v_poc_pu,p_mw,q_mvar,p_cmd_mw'];
        for (let i = 0; i < t.length; i++) {
            lines.push([t[i], v[i], p[i], q[i], pc[i]].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bess_dispatch_reversal.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async renderCharts(host, r) {
        try {
            const ChartLib = await loadChartJs();
            const t = r.time || [];
            const colors = ['#0d6efd', '#dc3545', '#198754', '#fd7e14'];

            const addChart = (title, datasets, yLabel, extraY, limitLines) => {
                const section = document.createElement('div');
                section.innerHTML = `<h3 style="margin:16px 0 8px;font-size:15px;">${title}</h3>`;
                const canvas = document.createElement('canvas');
                canvas.height = 200;
                section.appendChild(canvas);
                host.appendChild(section);

                const plugins = limitLines ? [{
                    id: 'limitLines',
                    afterDraw(chart) {
                        const { ctx, chartArea, scales } = chart;
                        if (!scales?.y || !chartArea) return;
                        ctx.save();
                        ctx.setLineDash([6, 4]);
                        ctx.lineWidth = 1;
                        limitLines.forEach((ll) => {
                            const y = scales.y.getPixelForValue(ll.value);
                            if (y < chartArea.top || y > chartArea.bottom) return;
                            ctx.strokeStyle = ll.color || '#999';
                            ctx.beginPath();
                            ctx.moveTo(chartArea.left, y);
                            ctx.lineTo(chartArea.right, y);
                            ctx.stroke();
                        });
                        ctx.restore();
                    }
                }] : [];

                this.charts.push(new ChartLib(canvas, {
                    type: 'line',
                    data: { datasets },
                    options: {
                        responsive: true,
                        parsing: false,
                        plugins: { legend: { display: datasets.length > 1 } },
                        scales: {
                            x: { type: 'linear', title: { display: true, text: 't [s]' } },
                            y: {
                                title: { display: true, text: yLabel },
                                ...(extraY || {})
                            }
                        }
                    },
                    plugins
                }));
            };

            const vVals = (r.bus_voltage && r.bus_voltage[0]?.values) || [];
            const vmin = Number(r.vmin_pu);
            const vmax = Number(r.vmax_pu);
            const yLo = Number.isFinite(vmin) ? Math.min(vmin, ...vVals.filter(Number.isFinite)) - 0.005 : undefined;
            const yHi = Number.isFinite(vmax) ? Math.max(vmax, ...vVals.filter(Number.isFinite)) + 0.005 : undefined;
            addChart('POC voltage vs time', [{
                label: r.poc_bus || 'POC',
                data: vVals.map((y, j) => ({ x: t[j], y })),
                borderColor: colors[0],
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1
            }], 'V [pu]', {
                min: Number.isFinite(yLo) ? yLo : undefined,
                max: Number.isFinite(yHi) ? yHi : undefined
            }, [
                { value: r.vmin_pu, color: '#dc3545' },
                { value: r.vmax_pu, color: '#dc3545' },
                { value: 1.0, color: '#aaa' }
            ]);

            const pVals = (r.p_mw && r.p_mw[0]?.values) || [];
            const pCmd = (r.p_cmd_mw && r.p_cmd_mw[0]?.values) || [];
            const pSpan = Math.max(
                5,
                ...[...pVals, ...pCmd].filter(Number.isFinite).map((v) => Math.abs(v)),
                Math.abs(Number(r.p_start_mw) || 0),
                Math.abs(Number(r.p_end_mw) || 0)
            );
            const pPad = Math.max(pSpan * 0.08, 1);
            addChart('Active power vs time (+ charge, − discharge)', [
                {
                    label: 'P command',
                    data: pCmd.map((y, j) => ({ x: t[j], y })),
                    borderColor: colors[3],
                    borderDash: [4, 3],
                    borderWidth: 1.2,
                    pointRadius: 0,
                    tension: 0
                },
                {
                    label: r.storage_name || 'BESS',
                    data: pVals.map((y, j) => ({ x: t[j], y })),
                    borderColor: colors[1],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0
                }
            ], 'P [MW]', { min: -(pSpan + pPad), max: pSpan + pPad });

            const qVals = (r.q_mvar && r.q_mvar[0]?.values) || [];
            const qSpan = Math.max(
                5,
                ...qVals.filter(Number.isFinite).map((v) => Math.abs(v)),
                pSpan * 0.15
            );
            const qPad = Math.max(qSpan * 0.1, 1);
            addChart('Reactive power vs time (+ absorb, − inject)', [{
                label: r.storage_name || 'BESS',
                data: qVals.map((y, j) => ({ x: t[j], y })),
                borderColor: colors[2],
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0
            }], 'Q [MVAr]', { min: -(qSpan + qPad), max: qSpan + qPad });
        } catch (err) {
            console.error('Chart render failed', err);
        }
    }
}

window.BessDispatchReversalResultsDialog = BessDispatchReversalResultsDialog;
