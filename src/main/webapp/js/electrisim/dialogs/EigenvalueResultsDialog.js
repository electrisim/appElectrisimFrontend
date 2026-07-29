// EigenvalueResultsDialog.js - ANDES EIG results with s-plane scatter
(function () {
    function loadChartJs() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve(Chart);
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

    class EigenvalueResultsDialog {
        constructor(results) {
            this.results = results || {};
            this.title = 'Eigenvalue Analysis Results (ANDES)';
            this.charts = [];
        }

        show() {
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
            header.style.cssText = 'padding: 20px 24px 12px; border-bottom: 1px solid #eee;';
            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = 'margin: 0 0 10px 0; font-size: 20px;';
            header.appendChild(title);
            header.appendChild(this.buildSummary());
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 24px;';
            const chartHost = document.createElement('div');
            chartHost.style.cssText = 'height: 320px; margin-bottom: 16px;';
            body.appendChild(chartHost);
            body.appendChild(this.buildTable());
            dialog.appendChild(body);

            const buttonRow = document.createElement('div');
            buttonRow.style.cssText = 'display:flex;padding:14px 24px;border-top:1px solid #e9ecef;background:#fafbfc;';
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'background:#6c757d;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;margin-left:auto;';
            closeBtn.onclick = () => {
                this.charts.forEach((c) => c.destroy?.());
                document.body.removeChild(overlay);
            };
            buttonRow.appendChild(closeBtn);
            dialog.appendChild(buttonRow);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            import('../utils/dialogStyles.js').then(({ attachBackdropCloseHandler }) => {
                attachBackdropCloseHandler(overlay, dialog, () => {
                    this.charts.forEach((c) => c.destroy?.());
                    if (overlay.parentNode) document.body.removeChild(overlay);
                });
            }).catch(() => {});

            this.renderScatter(chartHost);
        }

        verdictColor(v) {
            if (v === 'stable') return '#28a745';
            if (v === 'unstable') return '#dc3545';
            return '#ffc107';
        }

        buildSummary() {
            const r = this.results;
            const card = document.createElement('div');
            card.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;font-size:13px;align-items:center;';
            const verdict = document.createElement('div');
            verdict.style.cssText = `background:${this.verdictColor(r.verdict)};color:#fff;padding:8px 14px;border-radius:4px;font-weight:700;text-transform:uppercase;`;
            verdict.textContent = (r.verdict || 'unknown').replace('_', ' ');
            card.appendChild(verdict);
            [
                ['Positive', r.n_positive],
                ['Zeros', r.n_zeros],
                ['Negative', r.n_negative],
                ['Generators', r.n_generators]
            ].forEach(([k, v]) => {
                const chip = document.createElement('div');
                chip.style.cssText = 'background:#f1f3f5;padding:6px 10px;border-radius:4px;';
                chip.innerHTML = `<strong>${k}:</strong> ${v ?? '—'}`;
                card.appendChild(chip);
            });
            return card;
        }

        buildTable() {
            const wrap = document.createElement('div');
            wrap.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;">Least-damped oscillatory modes</h3>';
            const table = document.createElement('table');
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
            table.innerHTML = `
                <thead><tr style="background:#f8f9fa;text-align:left;">
                    <th style="padding:6px;border-bottom:1px solid #dee2e6;">#</th>
                    <th style="padding:6px;border-bottom:1px solid #dee2e6;">Real σ</th>
                    <th style="padding:6px;border-bottom:1px solid #dee2e6;">Imag ω</th>
                    <th style="padding:6px;border-bottom:1px solid #dee2e6;">f (Hz)</th>
                    <th style="padding:6px;border-bottom:1px solid #dee2e6;">Damping ζ</th>
                </tr></thead>`;
            const tbody = document.createElement('tbody');
            const modes = this.results.least_damped_modes || [];
            if (!modes.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:8px;color:#666;">No oscillatory modes highlighted.</td></tr>';
            } else {
                modes.forEach((m) => {
                    const tr = document.createElement('tr');
                    const fmt = (x, d = 4) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d));
                    tr.innerHTML = `
                        <td style="padding:6px;border-bottom:1px solid #eee;">${m.index}</td>
                        <td style="padding:6px;border-bottom:1px solid #eee;">${fmt(m.real)}</td>
                        <td style="padding:6px;border-bottom:1px solid #eee;">${fmt(m.imag)}</td>
                        <td style="padding:6px;border-bottom:1px solid #eee;">${fmt(m.freq_hz, 3)}</td>
                        <td style="padding:6px;border-bottom:1px solid #eee;">${fmt(m.damping_ratio, 4)}</td>`;
                    tbody.appendChild(tr);
                });
            }
            table.appendChild(tbody);
            wrap.appendChild(table);

            if (this.results.participation?.length) {
                const h = document.createElement('h3');
                h.textContent = 'Participation (top states)';
                h.style.cssText = 'margin:16px 0 8px;font-size:14px;';
                wrap.appendChild(h);
                this.results.participation.forEach((p) => {
                    const div = document.createElement('div');
                    div.style.cssText = 'font-size:12px;margin-bottom:8px;';
                    div.innerHTML = `<strong>Mode ${p.mode_index}:</strong> ` +
                        (p.states || []).map((s) => `${s.state} (${Number(s.factor).toFixed(3)})`).join(', ');
                    wrap.appendChild(div);
                });
            }

            if (this.results.defaults_applied?.length) {
                const details = document.createElement('details');
                details.style.marginTop = '12px';
                details.innerHTML = `<summary style="cursor:pointer;font-weight:600;">Defaults applied (${this.results.defaults_applied.length})</summary>
                    <ul style="font-size:12px;color:#555;">${this.results.defaults_applied.map((d) => `<li>${d}</li>`).join('')}</ul>`;
                wrap.appendChild(details);
            }
            return wrap;
        }

        async renderScatter(host) {
            const eigs = this.results.eigenvalues || [];
            if (!eigs.length) {
                host.innerHTML = '<p style="color:#666;">No eigenvalues returned.</p>';
                return;
            }
            let ChartCtor;
            try {
                ChartCtor = await loadChartJs();
            } catch (e) {
                host.innerHTML = `<p style="color:#c00;">${e.message}</p>`;
                return;
            }
            const canvas = document.createElement('canvas');
            host.appendChild(canvas);
            const points = eigs.map((e) => ({ x: e.real, y: e.imag }));
            const chart = new ChartCtor(canvas, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Eigenvalues',
                        data: points,
                        backgroundColor: points.map((p) => (p.x > 1e-6 ? '#dc3545' : '#007cba')),
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Eigenvalues on the s-plane' },
                        legend: { display: false }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Real σ [1/s]' }, grid: { color: (ctx) => (ctx.tick.value === 0 ? '#333' : '#eee') } },
                        y: { title: { display: true, text: 'Imag ω [1/s]' }, grid: { color: (ctx) => (ctx.tick.value === 0 ? '#333' : '#eee') } }
                    }
                }
            });
            this.charts.push(chart);
        }
    }

    window.EigenvalueResultsDialog = EigenvalueResultsDialog;
})();
