// ProtectionCoordinationResultsDialog.js
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
//
// Renders the backend response from /protection_coordination as:
//   - Summary card
//   - Tripping table (one per scenario)
//   - Per-device settings table
//   - Time-current grading curves (Chart.js, log-log)
//   - Miscoordination warnings
//
// Loads Chart.js lazily from CDN, matching the approach used by
// TimeSeriesSimulationResultsDialog.js.

export class ProtectionCoordinationResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'Protection Coordination Results';
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.55); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;
        overlay.className = 'protection-coordination-results-overlay';

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white; border-radius: 8px; box-shadow: 0 6px 28px rgba(0,0,0,0.35);
            max-width: 1280px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
            font-family: Arial, sans-serif; color: #222;
        `;

        // Title
        const titleEl = document.createElement('h2');
        titleEl.textContent = this.title;
        titleEl.style.cssText = 'margin: 0 0 16px 0;';
        dialog.appendChild(titleEl);

        if (this.results.error) {
            this._renderError(dialog);
        } else {
            this._renderSummary(dialog);
            this._renderTrippingTable(dialog);
            this._renderSettingsTable(dialog);
            this._renderMiscoordination(dialog);
            this._renderChartPlaceholder(dialog);
        }

        // Footer actions
        const closeRow = document.createElement('div');
        closeRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:24px; padding-top:16px; border-top:1px solid #e9ecef;';
        if (!this.results.error) {
            const reportBtn = document.createElement('button');
            reportBtn.textContent = 'Download full report (.txt)';
            reportBtn.style.cssText = `
                padding: 8px 18px; background: #28a745; color: white; border: none; border-radius: 4px;
                cursor: pointer; font-size: 14px;
            `;
            reportBtn.onclick = () => {
                const fn = window.downloadProtectionCoordinationReport;
                if (typeof fn === 'function') {
                    fn(this.results);
                } else {
                    alert('Report export is not available. Reload the page and try again.');
                }
            };
            closeRow.appendChild(reportBtn);
        }
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            padding: 8px 18px; background: #007bff; color: white; border: none; border-radius: 4px;
            cursor: pointer; font-size: 14px;
        `;
        closeBtn.onclick = () => overlay.remove();
        closeRow.appendChild(closeBtn);
        dialog.appendChild(closeRow);

        overlay.appendChild(dialog);
        attachBackdropCloseHandler(overlay, dialog, () => overlay.remove());

        document.body.appendChild(overlay);

        // Lazy-load Chart.js then draw the I-t chart.
        if (!this.results.error) {
            this._ensureChartJs().then(() => this._drawCharacteristicsChart(dialog)).catch(err => {
                console.warn('Chart.js load failed; skipping I-t plot:', err);
            });
        }
    }

    _renderError(dialog) {
        const box = document.createElement('div');
        box.style.cssText = 'padding:16px; border:1px solid #f5c2c7; background:#f8d7da; color:#842029; border-radius:6px; line-height:1.5;';
        box.innerHTML = `<strong>Protection Coordination failed</strong><br>${this._escape(this.results.message || 'Unknown error')}`;
        if (this.results.traceback) {
            const det = document.createElement('details');
            det.style.marginTop = '8px';
            det.innerHTML = `<summary style="cursor:pointer;color:#495057;">Backend traceback</summary><pre style="white-space:pre-wrap;font-size:11px;color:#495057;background:#fff;padding:8px;border-radius:4px;border:1px solid #ced4da;">${this._escape(this.results.traceback)}</pre>`;
            box.appendChild(det);
        }
        if (this.results.attach_summaries && this.results.attach_summaries.length) {
            const det = document.createElement('details');
            det.style.marginTop = '8px';
            const rows = this.results.attach_summaries.map(s =>
                `<tr><td>${this._escape(s.user_friendly_name || s.switch_id)}</td><td>${this._escape(s.kind)}</td><td>${this._escape(s.attached ? 'yes' : 'no')}</td><td>${this._escape(s.reason || '')}</td></tr>`
            ).join('');
            det.innerHTML = `<summary style="cursor:pointer;color:#495057;">Attach summaries (${this.results.attach_summaries.length})</summary><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;"><tr style="background:#f5f5f5;"><th style="border:1px solid #ddd;padding:6px;text-align:left;">Switch</th><th style="border:1px solid #ddd;padding:6px;text-align:left;">Kind</th><th style="border:1px solid #ddd;padding:6px;text-align:left;">Attached</th><th style="border:1px solid #ddd;padding:6px;text-align:left;">Reason</th></tr>${rows}</table>`;
            box.appendChild(det);
        }
        dialog.appendChild(box);
    }

    _renderSummary(dialog) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom:16px; padding:12px 14px; background:#f8f9fa; border:1px solid #dee2e6; border-radius:6px; font-size:13px; line-height:1.6;';
        const s = this.results.summary || {};
        section.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px 24px;">
                <div><b>Status:</b> ${s.converged ? '<span style="color:#0a7d2a;">Converged</span>' : '<span style="color:#b02a37;">Failed</span>'}</div>
                <div><b>Devices attached:</b> ${this._safe(s.n_attached)}/${this._safe(s.n_devices)}</div>
                <div><b>Stub (not computed):</b> ${this._safe(s.n_not_computed)}</div>
                <div><b>Scenarios:</b> ${this._safe(s.n_scenarios)}</div>
                <div><b>Trips:</b> ${this._safe(s.n_tripped)}</div>
                <div><b>Miscoordinations:</b> ${this._safe(s.n_miscoordination)}</div>
                <div><b>Fault type:</b> ${this._safe(s.fault_type)} (case ${this._safe(s.case)})</div>
                <div><b>Fault location:</b> ${s.fault_location_mode === 'bus' ? 'Selected busbar' : 'Line fault'}</div>
                <div><b>Grading margin t_diff:</b> ${this._safe(s.t_diff_s)} s</div>
            </div>
        `;
        if (s.scenario_warning) {
            const warn = document.createElement('div');
            warn.style.cssText = 'margin-top:10px;padding:10px 12px;background:#fff3cd;border:1px solid #ffecb5;border-radius:4px;color:#664d03;font-size:12px;line-height:1.5;';
            warn.textContent = s.scenario_warning;
            section.appendChild(warn);
        }
        dialog.appendChild(section);
    }

    _renderTrippingTable(dialog) {
        const scenarios = this.results.scenarios || [];
        const section = document.createElement('div');
        section.innerHTML = '<h3 style="margin:8px 0 12px 0;">Tripping table</h3>';
        if (!scenarios.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:12px;border:1px solid #ffecb5;background:#fff3cd;color:#664d03;border-radius:6px;font-size:13px;line-height:1.5;margin-bottom:12px;';
            empty.textContent = this.results.summary?.scenario_warning
                || this.results.warning
                || 'No fault scenarios were run, so there are no trip results. Use Fault location → "At selected busbar" if the model has no lines.';
            section.appendChild(empty);
            dialog.appendChild(section);
            return;
        }
        scenarios.forEach((sc, idx) => {
            const header = document.createElement('div');
            header.style.cssText = 'font-weight:600; margin:12px 0 4px 0; color:#343a40;';
            if (sc.fault_location_mode === 'bus') {
                header.textContent = `Scenario ${idx + 1} — busbar fault at ${sc.fault_bus ?? '?'}`;
            } else {
                header.textContent = `Scenario ${idx + 1} — line ${sc.sc_line_id}, fraction=${sc.sc_fraction}, fault bus=${sc.fault_bus ?? '?'}`;
            }
            section.appendChild(header);

            if (sc.short_circuit && sc.short_circuit.ikss_ka != null) {
                const scBox = document.createElement('div');
                scBox.style.cssText = 'font-size:12px;color:#495057;margin:0 0 8px 0;padding:8px 10px;background:#eef6ff;border:1px solid #cfe2ff;border-radius:4px;';
                const scBus = sc.short_circuit;
                const parts = [`I<sub>kss</sub> = ${this._fmt(scBus.ikss_ka)} kA`];
                if (scBus.ip_ka != null) parts.push(`I<sub>p</sub> = ${this._fmt(scBus.ip_ka)} kA`);
                if (scBus.ith_ka != null) parts.push(`I<sub>th</sub> = ${this._fmt(scBus.ith_ka)} kA`);
                if (scBus.skss_mva != null) parts.push(`S<sub>kss</sub> = ${this._fmt(scBus.skss_mva)} MVA`);
                scBox.innerHTML = `<strong>Short-circuit at fault bus:</strong> ${parts.join(' · ')}`;
                section.appendChild(scBox);
            }
            if (sc.error) {
                const err = document.createElement('div');
                err.style.cssText = 'padding:8px;border:1px solid #f5c2c7;background:#f8d7da;color:#842029;border-radius:4px;';
                err.textContent = sc.error;
                section.appendChild(err);
                return;
            }
            const table = document.createElement('table');
            table.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:8px;border:1px solid #ddd;font-size:12px;';
            table.innerHTML = `
                <tr style="background:#f5f5f5;">
                    <th style="border:1px solid #ddd;padding:6px;text-align:left;">Switch</th>
                    <th style="border:1px solid #ddd;padding:6px;text-align:left;">Device</th>
                    <th style="border:1px solid #ddd;padding:6px;text-align:right;">I<sub>kss</sub> [kA]</th>
                    <th style="border:1px solid #ddd;padding:6px;text-align:right;">t<sub>trip</sub> [s]</th>
                    <th style="border:1px solid #ddd;padding:6px;text-align:right;">Melting time [s]</th>
                    <th style="border:1px solid #ddd;padding:6px;text-align:center;">Tripped</th>
                </tr>
            `;
            const trips = sc.trip || [];
            if (!trips.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="6" style="border:1px solid #ddd;padding:8px;text-align:center;color:#6c757d;font-style:italic;">No protection devices tripped for this fault.</td>`;
                table.appendChild(tr);
            } else {
                trips.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.style.background = t.tripped ? '#e8f5e9' : '';
                    const meltCell = t.is_fuse || (t.device && String(t.device).toLowerCase().startsWith('fuse'))
                        ? this._fmt(t.t_melt_s != null ? t.t_melt_s : t.t_trip_s)
                        : '—';
                    tr.innerHTML = `
                        <td style="border:1px solid #ddd;padding:6px;">${this._escape(t.user_friendly_name || t.switch_name || t.switch_id || '?')}</td>
                        <td style="border:1px solid #ddd;padding:6px;">${this._escape(t.device || '?')}</td>
                        <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(t.ikss_ka)}</td>
                        <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(t.t_trip_s)}</td>
                        <td style="border:1px solid #ddd;padding:6px;text-align:right;">${meltCell}</td>
                        <td style="border:1px solid #ddd;padding:6px;text-align:center;">${t.tripped ? 'Yes' : 'No'}</td>
                    `;
                    table.appendChild(tr);
                });
            }
            section.appendChild(table);
        });
        dialog.appendChild(section);
    }

    _renderSettingsTable(dialog) {
        const devices = this.results.devices || [];
        if (!devices.length) return;
        const section = document.createElement('div');
        section.innerHTML = '<h3 style="margin:16px 0 12px 0;">Protection device settings</h3>';
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:8px;border:1px solid #ddd;font-size:12px;';
        table.innerHTML = `
            <tr style="background:#f5f5f5;">
                <th style="border:1px solid #ddd;padding:6px;text-align:left;">Switch</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:left;">Type</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:left;">Subtype</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:left;">Curve</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:right;">TMS</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:right;">t_grade [s]</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:right;">t&gt; [s]</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:right;">t&gt;&gt; [s]</th>
                <th style="border:1px solid #ddd;padding:6px;text-align:left;">Pickup</th>
            </tr>
        `;
        devices.forEach(d => {
            const tr = document.createElement('tr');
            const settings = d.settings || {};
            const pickup = [
                settings.I_s != null ? `I_s=${this._fmt(settings.I_s)}A` : (settings.I_s_a != null ? `I_s=${this._fmt(settings.I_s_a)}A` : null),
                settings.I_g != null ? `I_g=${this._fmt(settings.I_g)}A` : (settings.I_g_a != null ? `I_g=${this._fmt(settings.I_g_a)}A` : null),
                settings.I_gg != null ? `I_gg=${this._fmt(settings.I_gg)}A` : (settings.I_gg_a != null ? `I_gg=${this._fmt(settings.I_gg_a)}A` : null),
                settings.pickup_current != null ? `I_pickup=${this._fmt(settings.pickup_current)}A` : null,
                settings.rated_i_a != null ? `I_rated=${this._fmt(settings.rated_i_a)}A` : null
            ].filter(Boolean).join(', ');
            tr.innerHTML = `
                <td style="border:1px solid #ddd;padding:6px;">${this._escape(d.user_friendly_name || d.switch_name || d.switch_id || '?')}</td>
                <td style="border:1px solid #ddd;padding:6px;">${this._escape(d.type || '?')}</td>
                <td style="border:1px solid #ddd;padding:6px;">${this._escape(d.subtype || '-')}</td>
                <td style="border:1px solid #ddd;padding:6px;">${this._escape(d.curve_type || '-')}</td>
                <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(settings.tms)}</td>
                <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(settings.t_grade)}</td>
                <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(settings.t_g)}</td>
                <td style="border:1px solid #ddd;padding:6px;text-align:right;">${this._fmt(settings.t_gg)}</td>
                <td style="border:1px solid #ddd;padding:6px;">${this._escape(pickup || '-')}</td>
            `;
            table.appendChild(tr);
        });
        section.appendChild(table);

        const csvBtn = document.createElement('button');
        csvBtn.textContent = 'Export settings to CSV';
        csvBtn.style.cssText = 'padding:6px 10px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        csvBtn.onclick = () => this._downloadSettingsCsv(devices);
        section.appendChild(csvBtn);

        dialog.appendChild(section);
    }

    _renderMiscoordination(dialog) {
        const miscoord = this.results.miscoordination || [];
        if (!miscoord.length) return;
        const section = document.createElement('div');
        section.innerHTML = '<h3 style="margin:16px 0 12px 0;color:#b02a37;">Miscoordination warnings</h3>';
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;border:1px solid #f5c2c7;font-size:12px;';
        table.innerHTML = `
            <tr style="background:#f8d7da;color:#842029;">
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:left;">Primary (closer to fault)</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:right;">t_primary [s]</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:left;">Backup</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:right;">t_backup [s]</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:right;">Δt [s]</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:right;">Required t_diff [s]</th>
                <th style="border:1px solid #f5c2c7;padding:6px;text-align:left;">Scenario</th>
            </tr>
        `;
        miscoord.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="border:1px solid #f5c2c7;padding:6px;">${this._escape(m.primary_user_friendly_name || m.primary_switch_id || '?')}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;text-align:right;">${this._fmt(m.primary_t_s)}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;">${this._escape(m.backup_user_friendly_name || m.backup_switch_id || '?')}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;text-align:right;">${this._fmt(m.backup_t_s)}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;text-align:right;color:#b02a37;font-weight:600;">${this._fmt(m.delta_t_s)}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;text-align:right;">${this._fmt(m.required_t_diff_s)}</td>
                <td style="border:1px solid #f5c2c7;padding:6px;">line ${this._escape(m.sc_line_id)} @ ${this._fmt(m.sc_fraction)}</td>
            `;
            table.appendChild(tr);
        });
        section.appendChild(table);
        dialog.appendChild(section);
    }

    _renderChartPlaceholder(dialog) {
        const section = document.createElement('div');
        section.id = 'protection-it-chart-section';
        section.style.cssText = 'margin-top:18px;';
        section.innerHTML = '<h3 style="margin:0 0 12px 0;">Time-current grading curves (I-t)</h3>';
        const container = document.createElement('div');
        container.style.cssText =
            'padding:12px;border:1px solid #dee2e6;border-radius:6px;background:#fafafa;' +
            'min-height:560px;position:relative;';
        const canvas = document.createElement('canvas');
        canvas.id = 'protectionItCanvas';
        canvas.style.cssText = 'display:block;width:100%;height:520px;max-height:72vh;';
        container.appendChild(canvas);
        section.appendChild(container);
        dialog.appendChild(section);
    }

    _ensureChartJs() {
        if (typeof window.Chart === 'function') {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-chartjs-loader]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Chart.js failed to load')));
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.setAttribute('data-chartjs-loader', 'true');
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Chart.js failed to load'));
            document.head.appendChild(script);
        });
    }

    /**
     * Format tick values on logarithmic current axis (A).
     */
    _fmtLogAxisAmpere(value) {
        const v = Number(value);
        if (!isFinite(v) || v <= 0) return '';
        if (v >= 1000) {
            const k = v / 1000;
            return (Math.abs(k - Math.round(k)) < 1e-6 ? Math.round(k) : Number(k.toPrecision(2))) + ' kA';
        }
        if (v >= 100) return String(Math.round(v));
        if (v >= 10) return Number(v.toPrecision(2)).toString();
        return Number(v.toPrecision(2)).toString();
    }

    /**
     * Format tick values on logarithmic time axis (s).
     */
    _fmtLogAxisSeconds(value) {
        const v = Number(value);
        if (!isFinite(v) || v <= 0) return '';
        if (v >= 1000) return `${Number((v / 1000).toPrecision(2))} ks`;
        if (v >= 100) return `${Math.round(v)} s`;
        if (v >= 10) return `${Number(v.toPrecision(2))} s`;
        if (v >= 1) return `${Number(v.toPrecision(3))} s`;
        if (v >= 0.01) return `${Number(v.toPrecision(3))} s`;
        return `${Number(v.toExponential(1))} s`;
    }

    /**
     * Positive finite samples from datasets + trips for log-axis limits.
     */
    _protCollectAxisSamples(curveDatasets, trips) {
        const xs = [];
        const ys = [];
        curveDatasets.forEach(ds => {
            (ds.data || []).forEach(p => {
                if (!p || !isFinite(p.x) || !isFinite(p.y) || p.x <= 0 || p.y <= 0) return;
                xs.push(p.x);
                ys.push(p.y);
            });
        });
        trips.forEach(p => {
            if (!p || !isFinite(p.x) || !isFinite(p.y) || p.x <= 0 || p.y <= 0) return;
            xs.push(p.x);
            ys.push(p.y);
        });
        return { xs, ys };
    }

    _protLogAxisMinMax(values, padDecades = 0.22) {
        const pos = values.filter(v => v > 0 && isFinite(v));
        if (!pos.length) return { min: 1, max: 10000 };
        let lo = Math.min(...pos);
        let hi = Math.max(...pos);
        if (!(lo > 0 && hi >= lo)) return { min: 1, max: 10000 };
        const logPad = padDecades;
        const min = Math.pow(10, Math.log10(lo) - logPad);
        const max = Math.pow(10, Math.log10(hi) + logPad);
        return {
            min: Math.max(min, Number.MIN_VALUE * 1e100),
            max: Math.max(max, min * 10)
        };
    }

    _drawCharacteristicsChart(dialog) {
        const devices = this.results.devices || [];
        const canvas = dialog.querySelector('#protectionItCanvas');
        if (!canvas) return;
        if (typeof window.Chart !== 'function') return;
        if (!devices.length) {
            canvas.parentElement.innerHTML = '<div style="padding:24px;text-align:center;color:#6c757d;font-style:italic;">No protection device characteristics available.</div>';
            return;
        }

        const palette = [
            '#1565c0', '#ef6c00', '#2e7d32', '#c62828', '#6a1b9a',
            '#5d4037', '#ad1457', '#455a64', '#827717', '#00838f'
        ];

        const curveDatasets = devices
            .filter(d => d.characteristic && Array.isArray(d.characteristic.i_a) && d.characteristic.i_a.length > 0)
            .map((d, idx) => {
                const color = palette[idx % palette.length];
                const pairs = d.characteristic.i_a.map((i, k) => {
                    const t = d.characteristic.t_s ? d.characteristic.t_s[k] : null;
                    if (t == null || !isFinite(t) || t <= 0 || !isFinite(i) || i <= 0) return null;
                    return { x: Number(i), y: Number(t) };
                }).filter(p => p != null);
                pairs.sort((a, b) => a.x - b.x);
                return {
                    label: `${d.user_friendly_name || d.switch_name || d.switch_id || ('Device ' + idx)} (${d.type}${d.subtype ? '-' + d.subtype : ''})`,
                    data: pairs,
                    showLine: true,
                    fill: false,
                    borderColor: color,
                    backgroundColor: color,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0,
                    parsing: false,
                    spanGaps: false,
                    order: idx
                };
            });

        const trips = [];
        (this.results.scenarios || []).forEach((sc, sci) => {
            const lineId = sc.sc_line_id != null ? String(sc.sc_line_id) : '?';
            const frac = sc.sc_fraction != null ? String(sc.sc_fraction) : '?';
            (sc.trip || []).forEach(t => {
                if (t.ikss_ka != null && isFinite(t.ikss_ka) && t.t_trip_s != null && isFinite(t.t_trip_s)) {
                    const name = t.user_friendly_name || t.switch_name || t.switch_id || 'trip';
                    trips.push({
                        x: t.ikss_ka * 1000.0,
                        y: t.t_trip_s,
                        meta: `Scenario ${sci + 1} · line ${lineId} @ ${frac} · ${name}`
                    });
                }
            });
        });

        const datasets = [...curveDatasets];
        if (trips.length) {
            datasets.push({
                label: 'Fault trip points',
                type: 'scatter',
                data: trips.map(t => ({ x: t.x, y: t.y })),
                tripMeta: trips.map(t => t.meta),
                showLine: false,
                borderColor: '#1a1a1a',
                backgroundColor: 'rgba(26,26,26,0.92)',
                pointStyle: 'rectRot',
                pointRadius: 7,
                pointHoverRadius: 10,
                borderWidth: 1,
                parsing: false,
                order: 1000
            });
        }

        if (!datasets.length) {
            canvas.parentElement.innerHTML = '<div style="padding:24px;text-align:center;color:#6c757d;font-style:italic;">Protection device characteristic data is empty - nothing to plot.</div>';
            return;
        }

        const { xs, ys } = this._protCollectAxisSamples(curveDatasets, trips);
        const xLim = this._protLogAxisMinMax(xs, 0.2);
        const yLim = this._protLogAxisMinMax(ys, 0.25);

        try {
            // eslint-disable-next-line no-new
            new window.Chart(canvas, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', axis: 'xy', intersect: false },
                    plugins: {
                        title: {
                            display: true,
                            text: [
                                'Time-current grading curves (log-log)',
                                `Typical span: ${this._fmtLogAxisAmpere(xLim.min)} … ${this._fmtLogAxisAmpere(xLim.max)} · ${this._fmtLogAxisSeconds(yLim.min)} … ${this._fmtLogAxisSeconds(yLim.max)} — hover points for exact I / t`
                            ],
                            font: { size: 14, weight: '600' },
                            padding: { bottom: 12 },
                            color: '#212529'
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 14,
                                padding: 14,
                                font: { size: 11 },
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            filter: (item) => item != null,
                            callbacks: {
                                title: () => '',
                                label: (ctx) => {
                                    const v = ctx.raw;
                                    if (!v) return ctx.dataset.label || '';
                                    const ix = Number(v.x);
                                    const iy = Number(v.y);
                                    let line = `${ctx.dataset.label}: I = ${ix.toPrecision(4)} A, t = ${iy.toPrecision(4)} s`;
                                    const metaArr = ctx.dataset.tripMeta;
                                    if (metaArr && metaArr[ctx.dataIndex]) {
                                        line += ` — ${metaArr[ctx.dataIndex]}`;
                                    }
                                    return line;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'logarithmic',
                            min: xLim.min,
                            max: xLim.max,
                            title: {
                                display: true,
                                text: 'Current [A] — logarithmic',
                                font: { size: 13, weight: '600' }
                            },
                            ticks: {
                                color: '#37474f',
                                maxTicksLimit: 22,
                                callback: (val) => this._fmtLogAxisAmpere(val)
                            },
                            grid: { color: 'rgba(55, 71, 79, 0.09)', drawBorder: true }
                        },
                        y: {
                            type: 'logarithmic',
                            min: yLim.min,
                            max: yLim.max,
                            title: {
                                display: true,
                                text: 'Trip time [s] — logarithmic',
                                font: { size: 13, weight: '600' }
                            },
                            ticks: {
                                color: '#37474f',
                                maxTicksLimit: 18,
                                callback: (val) => this._fmtLogAxisSeconds(val)
                            },
                            grid: { color: 'rgba(55, 71, 79, 0.09)', drawBorder: true }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Failed to render Chart.js I-t plot:', e);
            canvas.parentElement.innerHTML = '<div style="padding:24px;text-align:center;color:#b02a37;">Failed to render the I-t plot: ' + this._escape(e?.message || String(e)) + '</div>';
        }
    }

    _downloadSettingsCsv(devices) {
        try {
            const headers = ['switch', 'type', 'subtype', 'curve_type', 'tms', 't_grade', 't_g', 't_gg', 'I_s', 'I_g', 'I_gg', 'rated_i_a'];
            const rows = devices.map(d => {
                const s = d.settings || {};
                return [
                    JSON.stringify(d.user_friendly_name || d.switch_name || d.switch_id || ''),
                    d.type || '',
                    d.subtype || '',
                    d.curve_type || '',
                    s.tms ?? '',
                    s.t_grade ?? '',
                    s.t_g ?? '',
                    s.t_gg ?? '',
                    s.I_s ?? s.I_s_a ?? '',
                    s.I_g ?? s.I_g_a ?? '',
                    s.I_gg ?? s.I_gg_a ?? '',
                    s.rated_i_a ?? ''
                ];
            });
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `protection_settings_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export protection settings CSV:', e);
        }
    }

    _fmt(v, digits = 3) {
        if (v == null) return '-';
        const n = Number(v);
        if (!isFinite(n)) return '-';
        return n.toFixed(digits);
    }

    _safe(v) {
        if (v == null) return '-';
        return String(v);
    }

    _escape(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

if (typeof window !== 'undefined') {
    window.ProtectionCoordinationResultsDialog = ProtectionCoordinationResultsDialog;
}

export default ProtectionCoordinationResultsDialog;
