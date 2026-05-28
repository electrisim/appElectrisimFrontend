// TimeSeriesSimulationResultsDialog.js
(function() {
    class TimeSeriesSimulationResultsDialog {
        constructor(results, options = {}) {
            this.results = results;
            this.options = options;
            this.title = 'Time Series Simulation Results';
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
                width: min(1200px, 100%); max-height: 92vh; overflow: hidden;
                font-family: Arial, sans-serif; box-sizing: border-box;
                display: flex; flex-direction: column;
            `;

            const header = document.createElement('div');
            header.style.cssText = 'padding: 20px 24px 12px; flex-shrink: 0; border-bottom: 1px solid #eee;';
            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = 'margin: 0 0 12px 0; font-size: 20px;';
            header.appendChild(title);
            header.appendChild(this.buildSummaryCard());
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = 'flex: 1; overflow-y: auto; padding: 0 24px 16px;';

            const tabBar = document.createElement('div');
            tabBar.style.cssText = 'display:flex;gap:4px;margin:16px 0 12px;border-bottom:2px solid #e9ecef;';
            const tabs = [
                { id: 'charts', label: 'Charts' },
                { id: 'statistics', label: 'Statistics' },
                { id: 'data', label: 'Detailed data' }
            ];
            const panels = {};
            tabs.forEach(t => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = t.label;
                btn.dataset.tab = t.id;
                btn.style.cssText = `
                    padding: 8px 16px; border: none; background: none; cursor: pointer;
                    font-size: 13px; font-weight: 600; color: #666; border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                `;
                tabBar.appendChild(btn);
                const panel = document.createElement('div');
                panel.dataset.panel = t.id;
                panel.style.display = 'none';
                panels[t.id] = { btn, panel };
                body.appendChild(panel);
            });
            body.insertBefore(tabBar, body.firstChild);

            const activateTab = (id) => {
                Object.entries(panels).forEach(([key, { btn, panel }]) => {
                    const active = key === id;
                    panel.style.display = active ? 'block' : 'none';
                    btn.style.color = active ? '#007cba' : '#666';
                    btn.style.borderBottomColor = active ? '#007cba' : 'transparent';
                });
            };
            tabBar.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => activateTab(btn.dataset.tab));
            });

            const chartsPanel = panels.charts.panel;
            chartsPanel.innerHTML = '<p style="font-size:12px;color:#666;margin:0 0 8px;">Input profiles and simulated bus voltages, line loading, and element powers over time.</p>';
            const plotsAnchor = document.createElement('div');
            plotsAnchor.id = 'ts-plots-anchor';
            chartsPanel.appendChild(plotsAnchor);

            this.renderStatistics(panels.statistics.panel);
            this.renderSampleTable(panels.data.panel);

            dialog.appendChild(body);

            const buttonRow = document.createElement('div');
            buttonRow.style.cssText = `
                display:flex;gap:10px;padding:14px 24px;border-top:1px solid #e9ecef;
                background:#fafbfc;flex-shrink:0;flex-wrap:wrap;
            `;

            const exportBtn = document.createElement('button');
            exportBtn.textContent = 'Export to Excel (.xlsx)';
            exportBtn.style.cssText = 'background:#28a745;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:13px;';
            exportBtn.onclick = () => this.exportToExcel();

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.style.cssText = 'background:#6c757d;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:13px;margin-left:auto;';
            closeButton.onclick = () => {
                this.charts.forEach(c => c.destroy?.());
                document.body.removeChild(overlay);
            };

            buttonRow.appendChild(exportBtn);
            buttonRow.appendChild(closeButton);
            dialog.appendChild(buttonRow);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.charts.forEach(c => c.destroy?.());
                    document.body.removeChild(overlay);
                }
            });

            activateTab('charts');

            this.loadChartJs()
                .then(() => {
                    this.createPlots(plotsAnchor);
                    requestAnimationFrame(() => {
                        this.charts.forEach(c => { try { c.resize?.(); } catch (_) { /* ignore */ } });
                    });
                    if (this.options.exportToExcel) {
                        setTimeout(() => this.exportToExcel(true), 400);
                    }
                })
                .catch((err) => {
                    console.error('Time series charts failed to load:', err);
                    plotsAnchor.innerHTML = `
                        <div style="padding:12px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;color:#856404;font-size:13px;line-height:1.5;">
                            <strong>Charts unavailable.</strong> The chart library could not be loaded
                            (${err.message || 'unknown error'}). Statistics, detailed data, and Excel export still work.
                        </div>`;
                    if (this.options.exportToExcel) {
                        setTimeout(() => this.exportToExcel(true), 400);
                    }
                });
        }

        buildSummaryCard() {
            const converged = !!this.results.timeseries_converged;
            const steps = this.results.time_steps || 'N/A';
            const failedSteps = this.getFailedSteps();
            const card = document.createElement('div');
            card.style.cssText = `
                display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch;
            `;

            const statusBox = document.createElement('div');
            statusBox.style.cssText = `
                flex: 0 0 auto; padding: 10px 16px; border-radius: 6px; font-weight: 600; font-size: 14px;
                background: ${converged ? '#d4edda' : '#f8d7da'};
                color: ${converged ? '#155724' : '#721c24'};
                border: 1px solid ${converged ? '#c3e6cb' : '#f5c6cb'};
            `;
            statusBox.textContent = converged ? 'All time steps converged' : 'Some time steps did not converge';
            card.appendChild(statusBox);

            const meta = document.createElement('div');
            meta.style.cssText = 'flex: 1 1 200px; font-size: 13px; line-height: 1.6; color: #444;';
            const period = this.results.time_stamps?.length
                ? `${this.results.time_stamps[0]} → ${this.results.time_stamps[this.results.time_stamps.length - 1]}`
                : `${steps} hour(s)`;
            meta.innerHTML = `
                <div><strong>Duration:</strong> ${steps} time step(s) &nbsp;·&nbsp; <strong>Period:</strong> ${period}</div>
                <div><strong>Loads:</strong> ${this.countUnique(this.results.loads, 'name')} &nbsp;·&nbsp;
                <strong>Generators:</strong> ${this.countUnique(this.results.sgens, 'name') + this.countUnique(this.results.gens, 'name')} &nbsp;·&nbsp;
                <strong>Buses:</strong> ${this.countUnique(this.results.busbars, 'name')}</div>
            `;
            card.appendChild(meta);

            if (!converged && failedSteps.length) {
                const warn = document.createElement('div');
                warn.style.cssText = `
                    flex: 1 1 100%; padding: 8px 12px; background: #fff3cd; border: 1px solid #ffeeba;
                    border-radius: 6px; font-size: 12px; color: #856404; line-height: 1.45;
                `;
                const shown = failedSteps.slice(0, 12);
                const suffix = failedSteps.length > 12 ? ` … (+${failedSteps.length - 12} more)` : '';
                warn.innerHTML = `<strong>Non-converged steps:</strong> ${shown.join(', ')}${suffix}. ` +
                    'Try running Load Flow first, use <em>Absolute P (MW)</em> profiles, or adjust initialization under Advanced settings.';
                card.appendChild(warn);
            }

            return card;
        }

        getFailedSteps() {
            if (Array.isArray(this.results.failed_time_steps)) {
                return this.results.failed_time_steps;
            }
            if (!this.results.busbars?.length) return [];
            const allSteps = [...new Set(this.results.busbars.map(b => b.time_step))].sort((a, b) => a - b);
            if (this.results.timeseries_converged) return [];
            return allSteps.filter(ts => {
                const rows = this.results.busbars.filter(b => b.time_step === ts);
                return rows.some(b => b.converged === false);
            });
        }

        countUnique(arr, key) {
            if (!arr?.length) return 0;
            return new Set(arr.map(item => item[key])).size;
        }

        loadChartJs() {
            if (typeof window.Chart === 'function') {
                return Promise.resolve();
            }

            if (window.__electrisimTsChartJsLoading) {
                return window.__electrisimTsChartJsLoading;
            }

            window.__electrisimTsChartJsLoading = new Promise((resolve, reject) => {
                const finish = (ok, err) => {
                    delete window.__electrisimTsChartJsLoading;
                    if (ok) resolve();
                    else reject(err || new Error('Chart.js failed to load'));
                };

                const existing = document.getElementById('chartjs-ts-script');
                if (existing) {
                    if (typeof window.Chart === 'function') {
                        finish(true);
                        return;
                    }
                    existing.addEventListener('load', () => {
                        if (typeof window.Chart === 'function') finish(true);
                        else finish(false, new Error('Chart.js loaded but Chart is unavailable'));
                    });
                    existing.addEventListener('error', () => finish(false, new Error('Chart.js script error')));
                    return;
                }

                const chartScript = document.createElement('script');
                chartScript.id = 'chartjs-ts-script';
                // Bundled locally — production CSP blocks cdn.jsdelivr.net
                chartScript.src = 'js/vendor/chart.umd.min.js';
                chartScript.onload = () => {
                    if (typeof window.Chart === 'function') finish(true);
                    else finish(false, new Error('Chart.js loaded but Chart is unavailable'));
                };
                chartScript.onerror = () => finish(false, new Error('Chart.js script failed to load from js/vendor/chart.umd.min.js'));
                document.head.appendChild(chartScript);
            });

            return window.__electrisimTsChartJsLoading;
        }

        renderStatistics(container) {
            container.innerHTML = '<p style="font-size:12px;color:#666;margin:0 0 12px;">Min / max / average values across all time steps.</p>';
            if (this.results.voltage_statistics) {
                const section = document.createElement('div');
                section.innerHTML = '<h3 style="margin:0 0 8px;font-size:15px;color:#333;">Voltage statistics</h3>';
                section.appendChild(this.buildStatsTable(
                    ['Bus', 'Min V (pu)', 'Max V (pu)', 'Avg V (pu)'],
                    Object.entries(this.results.voltage_statistics).map(([name, s]) => [
                        name, s.min_vm_pu.toFixed(4), s.max_vm_pu.toFixed(4), s.avg_vm_pu.toFixed(4)
                    ])
                ));
                container.appendChild(section);
            }
            if (this.results.loading_statistics) {
                const section = document.createElement('div');
                section.innerHTML = '<h3 style="margin:18px 0 8px;font-size:15px;color:#333;">Line loading statistics</h3>';
                section.appendChild(this.buildStatsTable(
                    ['Line', 'Min (%)', 'Max (%)', 'Avg (%)'],
                    Object.entries(this.results.loading_statistics).map(([name, s]) => [
                        name, s.min_loading_percent.toFixed(2), s.max_loading_percent.toFixed(2), s.avg_loading_percent.toFixed(2)
                    ])
                ));
                container.appendChild(section);
            }
            if (!this.results.voltage_statistics && !this.results.loading_statistics) {
                container.innerHTML += '<p style="color:#666;">No statistics available.</p>';
            }
        }

        buildStatsTable(headers, rows) {
            const table = document.createElement('table');
            table.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:12px;border:1px solid #ddd;font-size:13px;';
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            headRow.style.background = '#f5f5f5';
            headers.forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                th.style.cssText = 'border:1px solid #ddd;padding:8px;text-align:left;position:sticky;top:0;background:#f5f5f5;';
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            rows.forEach(cols => {
                const tr = document.createElement('tr');
                tr.style.background = '#fff';
                cols.forEach(c => {
                    const td = document.createElement('td');
                    td.textContent = c;
                    td.style.cssText = 'border:1px solid #ddd;padding:8px;';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        }

        renderSampleTable(container) {
            if (!this.results.busbars?.length) {
                container.innerHTML = '<p style="color:#666;">No bus data available.</p>';
                return;
            }
            container.innerHTML = `<p style="font-size:12px;color:#666;margin:0 0 8px;">
                Bus voltages and powers at every time step. Scroll inside the table to browse all ${this.results.time_steps || ''} hours.
            </p>`;
            const section = document.createElement('div');
            const buses = [...new Set(this.results.busbars.map(b => b.name))];
            const timeSteps = [...new Set(this.results.busbars.map(b => b.time_step))].sort((a, b) => a - b);
            const rows = [];
            timeSteps.forEach(ts => {
                buses.forEach(busName => {
                    const busData = this.results.busbars.find(b => b.name === busName && b.time_step === ts);
                    if (busData) {
                        rows.push([ts, busName, busData.vm_pu.toFixed(4), busData.va_degree.toFixed(2), busData.p_mw.toFixed(2), busData.q_mvar.toFixed(2)]);
                    }
                });
            });
            const scrollWrap = document.createElement('div');
            scrollWrap.style.cssText = 'max-height:min(480px,50vh);overflow:auto;border:1px solid #e9ecef;border-radius:4px;';
            scrollWrap.appendChild(this.buildStatsTable(
                ['Hour', 'Bus', 'V (pu)', 'Angle (°)', 'P (MW)', 'Q (MVar)'],
                rows
            ));
            section.appendChild(scrollWrap);
            container.appendChild(section);
        }

        createPlots(container) {
            const timeSteps = [...new Set((this.results.busbars || []).map(b => b.time_step))].sort((a, b) => a - b);

            this.addProfilePlots(container, timeSteps);

            if (this.results.busbars?.length) {
                const buses = [...new Set(this.results.busbars.map(b => b.name))];
                this.addLineChart(container, 'Bus voltage magnitude', 'V (pu)', timeSteps, buses.map(name => ({
                    label: name,
                    data: timeSteps.map(ts => {
                        const d = this.results.busbars.find(b => b.name === name && b.time_step === ts);
                        return d ? d.vm_pu : null;
                    })
                })), '#1976d2');
            }

            if (this.results.lines?.length) {
                const lines = [...new Set(this.results.lines.map(l => l.name))];
                this.addLineChart(container, 'Line loading', 'Loading (%)', timeSteps, lines.map(name => ({
                    label: name,
                    data: timeSteps.map(ts => {
                        const d = this.results.lines.find(l => l.name === name && l.time_step === ts);
                        return d ? d.loading_percent : null;
                    })
                })), '#e65100');
            }

            if (this.results.loads?.length) {
                const loads = [...new Set(this.results.loads.map(l => l.name))];
                this.addLineChart(container, 'Load active power', 'P (MW)', timeSteps, loads.map(name => ({
                    label: name,
                    data: timeSteps.map(ts => {
                        const d = this.results.loads.find(l => l.name === name && l.time_step === ts);
                        return d ? d.p_mw : null;
                    })
                })), '#2e7d32');
            }

            if (this.results.sgens?.length) {
                const sgens = [...new Set(this.results.sgens.map(s => s.name))];
                this.addLineChart(container, 'Static generator active power', 'P (MW)', timeSteps, sgens.map(name => ({
                    label: name,
                    data: timeSteps.map(ts => {
                        const d = this.results.sgens.find(s => s.name === name && s.time_step === ts);
                        return d ? d.p_mw : null;
                    })
                })), '#7b1fa2');
            }
        }

        resolveProfileDisplayName(technicalId, spec) {
            if (spec?.display_name) return spec.display_name;
            const id = String(technicalId);
            const fromLoad = this.results.loads?.find(l => l.id === id);
            if (fromLoad?.name) return fromLoad.name;
            const fromSgen = this.results.sgens?.find(s => s.id === id);
            if (fromSgen?.name) return fromSgen.name;
            return id;
        }

        addProfilePlots(container, timeSteps) {
            const profilesUsed = this.results.profiles_used;
            if (profilesUsed && Object.keys(profilesUsed).length > 0) {
                Object.entries(profilesUsed).forEach(([technicalId, spec]) => {
                    const elementName = this.resolveProfileDisplayName(technicalId, spec);
                    const unit = spec.mode === 'absolute' ? 'MW' : '× base P';
                    this.addLineChart(container, `Input profile — ${elementName}`, spec.mode === 'absolute' ? 'P (MW)' : 'Scale factor',
                        timeSteps.slice(0, spec.values.length),
                        [{ label: `${elementName} (${unit})`, data: spec.values }],
                        spec.element_type === 'load' ? '#1565c0' : '#558b2f'
                    );
                });
                return;
            }
            if (this.results.load_profile_values?.length) {
                this.addLineChart(container, 'Load profile (scale)', 'Scale factor', timeSteps,
                    [{ label: this.results.load_profile || 'load', data: this.results.load_profile_values }], '#1565c0');
            }
            if (this.results.generation_profile_values?.length) {
                this.addLineChart(container, 'Generation profile (scale)', 'Scale factor', timeSteps,
                    [{ label: this.results.generation_profile || 'generation', data: this.results.generation_profile_values }], '#558b2f');
            }
        }

        addLineChart(container, title, yLabel, labels, datasets, defaultColor) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #ddd;border-radius:6px;background:#fafafa;';
            const h4 = document.createElement('h4');
            h4.textContent = title;
            h4.style.cssText = 'margin:0 0 8px 0;font-size:14px;color:#333;';
            wrap.appendChild(h4);

            const canvasWrap = document.createElement('div');
            canvasWrap.style.cssText = 'position:relative;height:260px;width:100%;';
            const canvas = document.createElement('canvas');
            canvasWrap.appendChild(canvas);
            wrap.appendChild(canvasWrap);
            container.appendChild(wrap);

            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
            const chartDatasets = datasets.map((ds, i) => ({
                label: ds.label,
                data: ds.data,
                borderColor: colors[i % colors.length] || defaultColor,
                backgroundColor: (colors[i % colors.length] || defaultColor) + '22',
                tension: 0.15,
                fill: false,
                pointRadius: labels.length > 48 ? 0 : 2
            }));

            const ChartCtor = window.Chart;
            if (typeof ChartCtor !== 'function') {
                wrap.innerHTML += '<p style="color:#856404;font-size:12px;">Chart library not available.</p>';
                return;
            }

            try {
                const chart = new ChartCtor(canvas, {
                    type: 'line',
                    data: { labels, datasets: chartDatasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: chartDatasets.length > 1 } },
                        scales: {
                            x: { title: { display: true, text: 'Hour (time step)' } },
                            y: { title: { display: true, text: yLabel } }
                        }
                    }
                });
                this.charts.push(chart);
            } catch (err) {
                console.error('Failed to render chart:', title, err);
                wrap.innerHTML += `<p style="color:#856404;font-size:12px;">Could not render chart: ${err.message || err}</p>`;
            }
        }

        isValidXlsxLib(x) {
            return !!(x && x.utils && typeof x.writeFile === 'function' &&
                (typeof x.utils.book_new === 'function' ||
                 typeof x.utils.aoa_to_sheet === 'function' ||
                 typeof x.utils.sheet_from_array_of_arrays === 'function'));
        }

        async ensureXlsx() {
            if (this.isValidXlsxLib(window.__electrisimTimeSeriesXlsx)) {
                return window.__electrisimTimeSeriesXlsx;
            }

            if (window.__electrisimTsXlsxLoading) {
                return window.__electrisimTsXlsxLoading;
            }

            const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

            window.__electrisimTsXlsxLoading = (async () => {
                if (!document.getElementById('electrisim-ts-sheetjs')) {
                    const previousXlsx = window.XLSX;
                    const hadValidPrevious = this.isValidXlsxLib(previousXlsx);

                    if (previousXlsx && !hadValidPrevious) {
                        try { delete window.XLSX; } catch (_) { window.XLSX = undefined; }
                    }

                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.id = 'electrisim-ts-sheetjs';
                        script.src = SHEETJS_URL;
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Failed to load SheetJS library'));
                        document.head.appendChild(script);
                    });

                    if (this.isValidXlsxLib(window.XLSX)) {
                        window.__electrisimTimeSeriesXlsx = window.XLSX;
                    }

                    if (hadValidPrevious && previousXlsx !== window.__electrisimTimeSeriesXlsx) {
                        window.XLSX = previousXlsx;
                    }
                } else if (this.isValidXlsxLib(window.XLSX)) {
                    window.__electrisimTimeSeriesXlsx = window.XLSX;
                }

                if (!this.isValidXlsxLib(window.__electrisimTimeSeriesXlsx)) {
                    throw new Error('SheetJS API unavailable');
                }
                return window.__electrisimTimeSeriesXlsx;
            })();

            try {
                return await window.__electrisimTsXlsxLoading;
            } finally {
                delete window.__electrisimTsXlsxLoading;
            }
        }

        buildExportSheets() {
            const sheets = [];
            sheets.push({
                name: 'Summary',
                rows: [
                    ['Time Series Simulation Results'],
                    ['Status', this.results.timeseries_converged ? 'Converged' : 'Not converged'],
                    ['Time steps', this.results.time_steps],
                    ['Profile mode', this.results.profile_mode || 'custom'],
                    ['Load profile preset', this.results.load_profile || ''],
                    ['Generation profile preset', this.results.generation_profile || '']
                ]
            });

            if (this.results.busbars?.length) {
                const rows = [['time_step', 'name', 'vm_pu', 'va_degree', 'p_mw', 'q_mvar']];
                this.results.busbars.forEach(b => rows.push([b.time_step, b.name, b.vm_pu, b.va_degree, b.p_mw, b.q_mvar]));
                sheets.push({ name: 'res_bus', rows });
            }
            if (this.results.lines?.length) {
                const rows = [['time_step', 'name', 'loading_percent', 'p_from_mw', 'p_to_mw']];
                this.results.lines.forEach(l => rows.push([l.time_step, l.name, l.loading_percent, l.p_from_mw, l.p_to_mw]));
                sheets.push({ name: 'res_line', rows });
            }
            if (this.results.loads?.length) {
                const rows = [['time_step', 'name', 'p_mw', 'q_mvar']];
                this.results.loads.forEach(l => rows.push([l.time_step, l.name, l.p_mw, l.q_mvar]));
                sheets.push({ name: 'res_load', rows });
            }
            if (this.results.sgens?.length) {
                const rows = [['time_step', 'name', 'p_mw', 'q_mvar']];
                this.results.sgens.forEach(s => rows.push([s.time_step, s.name, s.p_mw, s.q_mvar]));
                sheets.push({ name: 'res_sgen', rows });
            }
            const profiles = this.results.profiles_used;
            if (profiles && Object.keys(profiles).length) {
                const rows = [['element', 'element_type', 'mode', 'time_step', 'value']];
                Object.entries(profiles).forEach(([technicalId, spec]) => {
                    const elementName = this.resolveProfileDisplayName(technicalId, spec);
                    (spec.values || []).forEach((val, i) => {
                        rows.push([elementName, spec.element_type, spec.mode, i, val]);
                    });
                });
                sheets.push({ name: 'profiles', rows });
            }
            return sheets;
        }

        exportToCsvFallback(silent) {
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const sheets = this.buildExportSheets();
            const lines = [];
            sheets.forEach(({ name, rows }) => {
                lines.push(`# ${name}`);
                rows.forEach(row => {
                    lines.push(row.map(cell => {
                        const text = cell == null ? '' : String(cell);
                        return `"${text.replace(/"/g, '""')}"`;
                    }).join(','));
                });
                lines.push('');
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `time_series_results_${stamp}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (!silent) {
                alert('Excel library unavailable — results exported as CSV instead.');
            }
        }

        createWorkbook(XLSX) {
            if (typeof XLSX.utils.book_new === 'function') {
                return XLSX.utils.book_new();
            }
            return { SheetNames: [], Sheets: {} };
        }

        rowsToSheet(XLSX, rows) {
            if (typeof XLSX.utils.aoa_to_sheet === 'function') {
                return XLSX.utils.aoa_to_sheet(rows);
            }
            if (typeof XLSX.utils.sheet_from_array_of_arrays === 'function') {
                return XLSX.utils.sheet_from_array_of_arrays(rows);
            }
            throw new Error('XLSX sheet conversion API not available');
        }

        appendSheet(XLSX, workbook, sheet, name) {
            if (typeof XLSX.utils.book_append_sheet === 'function') {
                XLSX.utils.book_append_sheet(workbook, sheet, name);
                return;
            }
            workbook.SheetNames.push(name);
            workbook.Sheets[name] = sheet;
        }

        async exportToExcel(silent = false) {
            try {
                const XLSX = await this.ensureXlsx();
                const wb = this.createWorkbook(XLSX);
                this.buildExportSheets().forEach(({ name, rows }) => {
                    this.appendSheet(XLSX, wb, this.rowsToSheet(XLSX, rows), name);
                });
                const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
                XLSX.writeFile(wb, `time_series_results_${stamp}.xlsx`);
                if (!silent) console.log('Time series results exported to Excel');
            } catch (err) {
                console.error('Excel export failed:', err);
                try {
                    this.exportToCsvFallback(silent);
                } catch (csvErr) {
                    console.error('CSV fallback export failed:', csvErr);
                    if (!silent) alert('Failed to export results. Please try again.');
                }
            }
        }
    }

    globalThis.TimeSeriesSimulationResultsDialog = TimeSeriesSimulationResultsDialog;
    window.TimeSeriesSimulationResultsDialog = TimeSeriesSimulationResultsDialog;
})();
