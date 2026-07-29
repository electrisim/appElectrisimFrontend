// MotorStartingResultsDialog.js - Motor starting report with tables, CSV, Chart.js
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

    function fmt(v, d = 3) {
        if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'N/A';
        return Number(v).toFixed(d);
    }

    function passBadge(ok) {
        if (ok === true) return '<span style="color:#198754;font-weight:600;">PASS</span>';
        if (ok === false) return '<span style="color:#dc3545;font-weight:600;">FAIL</span>';
        return '—';
    }

    function tableHtml(headers, rows) {
        let h = '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0 16px;">';
        h += '<thead><tr>' + headers.map((x) =>
            `<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #dee2e6;background:#f8f9fa;">${x}</th>`
        ).join('') + '</tr></thead><tbody>';
        rows.forEach((r, i) => {
            const bg = i % 2 ? '#fafafa' : '#fff';
            h += `<tr style="background:${bg};">` + r.map((c) =>
                `<td style="padding:5px 8px;border-bottom:1px solid #eee;">${c}</td>`
            ).join('') + '</tr>';
        });
        h += '</tbody></table>';
        return h;
    }

    function toCsv(headers, rows) {
        const esc = (v) => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    }

    class MotorStartingResultsDialog {
        constructor(results) {
            this.results = results || {};
            this.title = 'Motor Starting Results';
            this.charts = [];
        }

        show() {
            const r = this.results;
            const mode = r.mode || 'steady';
            const summary = r.summary || {};

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
            title.textContent = `${this.title} (${mode === 'dynamic' ? 'Dynamic' : 'Steady-state'})`;
            title.style.cssText = 'margin: 0 0 10px 0; font-size: 20px;';
            header.appendChild(title);

            const sum = document.createElement('div');
            sum.style.cssText = 'font-size:13px;color:#444;display:flex;flex-wrap:wrap;gap:12px 20px;';
            sum.innerHTML = `
                <span><strong>Worst dip:</strong> ${fmt(summary.worst_dip_percent, 2)}%</span>
                <span><strong>Voltage fails:</strong> ${summary.n_fail_voltage ?? 0}</span>
                <span><strong>Thermal fails:</strong> ${summary.n_fail_thermal ?? 0}</span>
                <span><strong>Method:</strong> ${summary.starting_method || '—'}</span>
                <span><strong>Motors:</strong> ${summary.n_motors_started ?? 0}</span>
                <span><strong>Dip limit:</strong> ${fmt(summary.voltage_limit_percent, 1)}%</span>
            `;
            header.appendChild(sum);
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 24px;';

            // Motors table
            const motors = Array.isArray(r.motors) ? r.motors : [];
            body.insertAdjacentHTML('beforeend', '<h3 style="margin:0 0 4px;font-size:15px;">Starting Motors</h3>');
            body.insertAdjacentHTML('beforeend', tableHtml(
                ['Name', 'Method', 'I start', 'I rated', 'k', 'Start time [s]', 'Status'],
                motors.map((m) => [
                    m.name || m.id,
                    m.method || '—',
                    m.i_start_ka != null ? `${fmt(m.i_start_ka)} kA` : (m.i_start_pu != null ? `${fmt(m.i_start_pu)} pu` : '—'),
                    m.i_rated_ka != null ? `${fmt(m.i_rated_ka)} kA` : '—',
                    m.k_method != null ? fmt(m.k_method, 3) : '—',
                    m.start_time_s != null ? fmt(m.start_time_s, 3) : '—',
                    m.pass === false ? passBadge(false) : (m.pass === true ? passBadge(true) : '—')
                ])
            ));

            // Buses table
            const buses = Array.isArray(r.buses) ? r.buses : [];
            body.insertAdjacentHTML('beforeend', '<h3 style="margin:12px 0 4px;font-size:15px;">Bus Voltages</h3>');
            body.insertAdjacentHTML('beforeend', tableHtml(
                ['Bus', 'V before [pu]', 'V during [pu]', 'V after [pu]', 'Dip [%]', 'Check'],
                buses.map((b) => [
                    b.name || b.id,
                    fmt(b.vm_before),
                    fmt(b.vm_during),
                    fmt(b.vm_after),
                    fmt(b.dip_percent, 2),
                    passBadge(b.pass)
                ])
            ));

            // Branches
            const branches = Array.isArray(r.branches) ? r.branches : [];
            if (branches.length) {
                body.insertAdjacentHTML('beforeend', '<h3 style="margin:12px 0 4px;font-size:15px;">Branch Loading During Start</h3>');
                body.insertAdjacentHTML('beforeend', tableHtml(
                    ['Element', 'Type', 'Loading [%]', 'Check'],
                    branches.map((b) => [
                        b.name || b.id,
                        b.element || '—',
                        fmt(b.loading_during_percent, 1),
                        passBadge(b.pass)
                    ])
                ));
            }

            if (Array.isArray(r.warnings) && r.warnings.length) {
                const warn = document.createElement('div');
                warn.style.cssText = 'margin-top:10px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px;';
                warn.innerHTML = '<strong>Warnings</strong><ul style="margin:6px 0 0;">' +
                    r.warnings.map((w) => `<li>${w}</li>`).join('') + '</ul>';
                body.appendChild(warn);
            }

            const chartsHost = document.createElement('div');
            chartsHost.id = 'motor-start-charts';
            chartsHost.style.cssText = 'margin-top:16px;';
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

            if (mode === 'dynamic' && r.timeseries?.t?.length) {
                this.renderCharts(chartsHost, r.timeseries);
            }
        }

        downloadCsv() {
            const r = this.results;
            const parts = [];
            const buses = r.buses || [];
            parts.push('BUS RESULTS');
            parts.push(toCsv(
                ['id', 'name', 'vm_before', 'vm_during', 'vm_after', 'dip_percent', 'pass'],
                buses.map((b) => [b.id, b.name, b.vm_before, b.vm_during, b.vm_after, b.dip_percent, b.pass])
            ));
            parts.push('');
            parts.push('MOTOR RESULTS');
            parts.push(toCsv(
                ['id', 'name', 'method', 'i_start_ka', 'i_start_pu', 'i_rated_ka', 'k_method', 'start_time_s'],
                (r.motors || []).map((m) => [m.id, m.name, m.method, m.i_start_ka, m.i_start_pu, m.i_rated_ka, m.k_method, m.start_time_s])
            ));
            if ((r.branches || []).length) {
                parts.push('');
                parts.push('BRANCH RESULTS');
                parts.push(toCsv(
                    ['id', 'name', 'element', 'loading_during_percent', 'pass'],
                    r.branches.map((b) => [b.id, b.name, b.element, b.loading_during_percent, b.pass])
                ));
            }
            const blob = new Blob([parts.join('\n')], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `motor_starting_${r.mode || 'steady'}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        async renderCharts(host, ts) {
            try {
                const ChartLib = await loadChartJs();
                const t = ts.t || [];
                const colors = ['#0d6efd', '#dc3545', '#198754', '#fd7e14', '#6f42c1', '#20c997'];

                const vSection = document.createElement('div');
                vSection.innerHTML = '<h3 style="margin:0 0 8px;font-size:15px;">Bus Voltage vs Time</h3>';
                const vCanvas = document.createElement('canvas');
                vCanvas.height = 220;
                vSection.appendChild(vCanvas);
                host.appendChild(vSection);

                const busEntries = Object.values(ts.buses || {});
                const vDatasets = busEntries.slice(0, 8).map((b, i) => ({
                    label: b.name || b.id,
                    data: (b.v || []).map((y, j) => ({ x: t[j], y })),
                    borderColor: colors[i % colors.length],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.1
                }));
                this.charts.push(new ChartLib(vCanvas, {
                    type: 'line',
                    data: { datasets: vDatasets },
                    options: {
                        responsive: true,
                        parsing: false,
                        scales: {
                            x: { type: 'linear', title: { display: true, text: 't [s]' } },
                            y: { title: { display: true, text: 'V [pu]' } }
                        },
                        plugins: { legend: { position: 'bottom' } }
                    }
                }));

                const mSection = document.createElement('div');
                mSection.style.marginTop = '16px';
                mSection.innerHTML = '<h3 style="margin:0 0 8px;font-size:15px;">Motor Current / Slip vs Time</h3>';
                const mCanvas = document.createElement('canvas');
                mCanvas.height = 220;
                mSection.appendChild(mCanvas);
                host.appendChild(mSection);

                const motorEntries = Object.values(ts.motors || {});
                const mDatasets = [];
                motorEntries.slice(0, 4).forEach((m, i) => {
                    if (m.i_pu) {
                        mDatasets.push({
                            label: `${m.name || m.id} I [pu]`,
                            data: m.i_pu.map((y, j) => ({ x: t[j], y })),
                            borderColor: colors[i % colors.length],
                            borderWidth: 1.5,
                            pointRadius: 0,
                            yAxisID: 'y',
                            tension: 0.1
                        });
                    }
                    if (m.slip) {
                        mDatasets.push({
                            label: `${m.name || m.id} slip`,
                            data: m.slip.map((y, j) => ({ x: t[j], y })),
                            borderColor: colors[(i + 2) % colors.length],
                            borderWidth: 1.5,
                            borderDash: [4, 3],
                            pointRadius: 0,
                            yAxisID: 'y1',
                            tension: 0.1
                        });
                    }
                });
                this.charts.push(new ChartLib(mCanvas, {
                    type: 'line',
                    data: { datasets: mDatasets },
                    options: {
                        responsive: true,
                        parsing: false,
                        scales: {
                            x: { type: 'linear', title: { display: true, text: 't [s]' } },
                            y: { position: 'left', title: { display: true, text: 'I [pu]' } },
                            y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'slip' } }
                        },
                        plugins: { legend: { position: 'bottom' } }
                    }
                }));
            } catch (err) {
                console.warn('Motor starting charts unavailable:', err);
                host.insertAdjacentHTML('beforeend',
                    '<p style="font-size:12px;color:#888;">Charts could not be loaded (Chart.js).</p>');
            }
        }
    }

    window.MotorStartingResultsDialog = MotorStartingResultsDialog;
})();
