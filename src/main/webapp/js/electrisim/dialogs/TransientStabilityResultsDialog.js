// TransientStabilityResultsDialog.js - ANDES TDS results with charts
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

    class TransientStabilityResultsDialog {
        constructor(results) {
            this.results = results || {};
            this.title = 'Transient Stability Results (ANDES)';
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
            header.style.cssText = 'padding: 20px 24px 12px; border-bottom: 1px solid #eee; flex-shrink: 0;';
            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = 'margin: 0 0 10px 0; font-size: 20px;';
            header.appendChild(title);
            header.appendChild(this.buildSummary());
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 24px;';
            const chartsHost = document.createElement('div');
            chartsHost.id = 'tds-charts-host';
            body.appendChild(chartsHost);

            if (this.results.defaults_applied?.length) {
                const details = document.createElement('details');
                details.style.marginTop = '12px';
                details.innerHTML = `<summary style="cursor:pointer;font-weight:600;">Defaults applied (${this.results.defaults_applied.length})</summary>`;
                const ul = document.createElement('ul');
                ul.style.cssText = 'font-size:12px;color:#555;margin:8px 0;';
                this.results.defaults_applied.forEach((d) => {
                    const li = document.createElement('li');
                    li.textContent = d;
                    ul.appendChild(li);
                });
                details.appendChild(ul);
                body.appendChild(details);
            }
            if (this.results.warnings?.length) {
                const warn = document.createElement('div');
                warn.style.cssText = 'margin-top:10px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px;';
                warn.innerHTML = '<strong>Warnings</strong><ul style="margin:6px 0 0;">' +
                    this.results.warnings.map((w) => `<li>${w}</li>`).join('') + '</ul>';
                body.appendChild(warn);
            }
            dialog.appendChild(body);

            const buttonRow = document.createElement('div');
            buttonRow.style.cssText = 'display:flex;gap:10px;padding:14px 24px;border-top:1px solid #e9ecef;background:#fafbfc;';
            const exportBtn = document.createElement('button');
            exportBtn.textContent = 'Export CSV';
            exportBtn.style.cssText = 'background:#28a745;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;';
            exportBtn.onclick = () => this.exportCsv();
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'background:#6c757d;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;margin-left:auto;';
            closeBtn.onclick = () => {
                this.charts.forEach((c) => c.destroy?.());
                document.body.removeChild(overlay);
            };
            buttonRow.appendChild(exportBtn);
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

            this.renderCharts(chartsHost);
        }

        buildSummary() {
            const r = this.results;
            const card = document.createElement('div');
            card.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;font-size:13px;';
            const items = [
                ['Status', r.converged ? 'Completed' : 'Failed'],
                ['tf (s)', r.tf],
                ['Points', r.n_points],
                ['Generators', r.n_generators],
                ['Buses', r.n_buses],
                ['f base (Hz)', r.frequency_base_hz]
            ];
            items.forEach(([k, v]) => {
                const chip = document.createElement('div');
                chip.style.cssText = 'background:#f1f3f5;padding:6px 10px;border-radius:4px;';
                chip.innerHTML = `<strong>${k}:</strong> ${v ?? '—'}`;
                card.appendChild(chip);
            });
            return card;
        }

        async renderCharts(host) {
            const t = this.results.time || [];
            if (!t.length) {
                host.innerHTML = '<p style="color:#666;">No time-series data returned.</p>';
                return;
            }
            let ChartCtor;
            try {
                ChartCtor = await loadChartJs();
            } catch (e) {
                host.innerHTML = `<p style="color:#c00;">${e.message}</p>`;
                return;
            }

            const palette = ['#007cba', '#e67e22', '#27ae60', '#8e44ad', '#c0392b', '#16a085', '#2c3e50'];
            const makeChart = (title, seriesArr, yLabel) => {
                if (!seriesArr?.length) return;
                const wrap = document.createElement('div');
                wrap.style.cssText = 'margin-bottom:20px;height:280px;position:relative;';
                const h = document.createElement('h3');
                h.textContent = title;
                h.style.cssText = 'margin:0 0 8px;font-size:14px;';
                const canvas = document.createElement('canvas');
                wrap.appendChild(h);
                wrap.appendChild(canvas);
                host.appendChild(wrap);
                const chart = new ChartCtor(canvas, {
                    type: 'line',
                    data: {
                        labels: t,
                        datasets: seriesArr.map((s, i) => ({
                            label: s.name || s.id,
                            data: s.values,
                            borderColor: palette[i % palette.length],
                            backgroundColor: 'transparent',
                            borderWidth: 1.5,
                            pointRadius: 0,
                            tension: 0.1
                        }))
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                        scales: {
                            x: { title: { display: true, text: 'Time [s]' }, ticks: { maxTicksLimit: 10 } },
                            y: { title: { display: true, text: yLabel } }
                        }
                    }
                });
                this.charts.push(chart);
            };

            makeChart('Generator Speed ω (pu)', this.results.omega, 'ω [pu]');
            makeChart('Generator Angle δ (rad)', this.results.delta, 'δ [rad]');
            makeChart('Bus Voltage (pu)', this.results.bus_voltage, 'V [pu]');
            if (this.results.frequency_hz) {
                makeChart('System Frequency (Hz)', [{
                    name: 'Mean frequency',
                    values: this.results.frequency_hz
                }], 'f [Hz]');
            }
        }

        exportCsv() {
            const t = this.results.time || [];
            if (!t.length) return;
            const cols = ['time'];
            const series = [];
            (this.results.omega || []).forEach((s) => {
                cols.push(`omega_${s.name}`);
                series.push(s.values);
            });
            (this.results.delta || []).forEach((s) => {
                cols.push(`delta_${s.name}`);
                series.push(s.values);
            });
            (this.results.bus_voltage || []).forEach((s) => {
                cols.push(`v_${s.name}`);
                series.push(s.values);
            });
            const lines = [cols.join(',')];
            for (let i = 0; i < t.length; i++) {
                const row = [t[i]];
                series.forEach((vals) => row.push(vals[i] ?? ''));
                lines.push(row.join(','));
            }
            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'transient_stability_results.csv';
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }

    window.TransientStabilityResultsDialog = TransientStabilityResultsDialog;
})();
