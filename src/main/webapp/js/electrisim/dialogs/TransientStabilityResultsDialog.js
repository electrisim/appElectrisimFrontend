function escapeHtmlText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
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
            const rt = this.results.ride_through;
            if (rt?.enabled && rt.pass === false) {
                const fail = document.createElement('div');
                fail.style.cssText = 'margin-top:10px;padding:10px;background:#fff3cd;border-radius:4px;font-size:12px;color:#664d03;';
                fail.innerHTML = `<strong>The POI voltage leaves the ride-through curve</strong> at t=${escapeHtmlText(rt.fail_time_s ?? '—')} s, V=${escapeHtmlText(rt.fail_voltage_pu ?? '—')} pu. ` +
                    'Outside the curve the facility is allowed to disconnect; the curve time counts from the start of the disturbance' +
                    (rt.t_event_s != null ? ` (${escapeHtmlText(rt.t_event_s)} s).` : '.');
                body.appendChild(fail);
            }
            // the ride-through verdicts come first, above the charts
            (this.results.data_centres || []).forEach((dc) => body.insertBefore(this.buildDataCentre(dc), chartsHost));
            if ((this.results.statcoms || []).length) body.insertBefore(this.buildStatcoms(this.results.statcoms), chartsHost);
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
            const poi = r.poi_metrics || {};
            if (poi.poi_bus) {
                items.push(['POI bus', poi.poi_bus]);
                items.push(['POI V min (pu)', poi.v_min_pu]);
                items.push(['f nadir (Hz)', poi.frequency_nadir_hz]);
                items.push(['f final (Hz)', poi.frequency_final_hz]);
            }
            const rt = r.ride_through || {};
            if (rt.enabled) {
                items.push(['POI voltage vs curve', rt.pass === true ? 'inside' : rt.pass === false ? 'outside' : '—']);
            }
            const verdicts = {
                pass: 'PASS (load kept)',
                load_dropped: 'FAIL (load dropped)',
                outside_envelope: 'outside the curve',
                outside_envelope_load_dropped: 'outside the curve, load dropped'
            };
            if (rt.verdict) items.push(['Data-centre ride-through', verdicts[rt.verdict] || rt.verdict]);
            items.forEach(([k, v]) => {
                const chip = document.createElement('div');
                chip.style.cssText = 'background:#f1f3f5;padding:6px 10px;border-radius:4px;';
                const shown = typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v;
                chip.innerHTML = `<strong>${escapeHtmlText(k)}:</strong> ${escapeHtmlText(shown ?? '—')}`;
                card.appendChild(chip);
            });
            return card;
        }

        buildDataCentre(dc) {
            const box = document.createElement('div');
            const colours = { rides_through: ['#d1e7dd', '#0f5132'], ups_transfer: ['#f8d7da', '#842029'], it_lost: ['#f8d7da', '#842029'] };
            const [bg, fg] = colours[dc.verdict] || ['#f1f3f5', '#212529'];
            const mw = (v) => (v == null ? '—' : `${Number(v).toFixed(0)} MW`);
            const sec = (v) => (v == null ? '—' : `${Number(v).toFixed(2)} s`);
            const inside = dc.within_envelope !== false;
            let head;
            if (dc.verdict === 'rides_through') {
                head = `<strong>${escapeHtmlText(dc.name)} rides through:</strong> the UPS stays on the grid and the data centre keeps drawing its power.`;
            } else if (dc.verdict === 'ups_transfer') {
                head = `<strong>${escapeHtmlText(dc.name)} drops ${mw(dc.load_drop_mw)} from the grid:</strong> the UPS moves the IT load to its battery and walks it back in` +
                    (dc.recovery_s != null ? `; the power is back to 90 % ${sec(dc.recovery_s)} after the disturbance.` : ', but the power is not back by the end of the run.');
            } else {
                head = `<strong>${escapeHtmlText(dc.name)} loses its IT load (${mw(dc.load_drop_mw)}):</strong> ` +
                    (dc.ups?.present ? 'the dip lasts longer than the UPS hold-up time.' : 'there is no UPS, so the servers restart.');
            }
            if (dc.verdict !== 'rides_through') {
                head += inside
                    ? ' The voltage stays inside the ride-through curve, so the facility should have kept its load.'
                    : ' The voltage leaves the ride-through curve, where the facility may disconnect.';
            }
            box.style.cssText = `margin:0 0 12px;padding:10px 12px;border-radius:4px;font-size:13px;line-height:1.5;background:${bg};color:${fg};`;
            const ups = dc.ups || {};
            const rows = [
                ['Power before the disturbance / lowest', `${mw(dc.p_mw_pre)} / ${mw(dc.p_mw_min)}`],
                ['IT share', `${dc.it_share_percent ?? '—'} %`],
                ['UPS', ups.present
                    ? `transfer below ${ups.transfer_pu} pu, back above ${ups.return_pu} pu after ${ups.return_delay_s} s, walk-in ${ups.walk_in_s} s, hold-up ${ups.hold_s} s`
                    : 'none (IT power supplies bridge one cycle)'],
                ['Time on battery / IT off the grid', `${sec(ups.battery_s)} / ${sec(dc.it_off_s)}`],
                ['State at the end', ups.final_state || '—']
            ];
            const events = (dc.events || []).map((e) => `<li>t = ${escapeHtmlText(e.t_s)} s: ${escapeHtmlText(e.event)} (V = ${escapeHtmlText(e.v_pu)} pu)</li>`).join('');
            box.innerHTML = `<div>${head}</div>` +
                '<table style="border-collapse:collapse;margin-top:8px;font-size:12px;">' +
                rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;font-weight:600;">${escapeHtmlText(k)}</td><td>${escapeHtmlText(v)}</td></tr>`).join('') +
                '</table>' + (events ? `<ul style="margin:6px 0 0;font-size:12px;">${events}</ul>` : '');
            return box;
        }

        buildStatcoms(list) {
            const box = document.createElement('div');
            box.style.cssText = 'margin:0 0 12px;padding:10px 12px;border-radius:4px;font-size:12px;background:#e7f1ff;color:#084298;';
            box.innerHTML = list.map((st) => `<div><strong>STATCOM ${escapeHtmlText(st.name)}</strong> (${escapeHtmlText(st.sn_mva)} MVA, k = ${escapeHtmlText(st.kqv)}, deadband ±${escapeHtmlText(st.deadband_percent)} %, current limit ${escapeHtmlText(st.imax_pu)} pu): ` +
                `${Number(st.q_mvar_pre ?? 0).toFixed(0)} Mvar before the disturbance, up to ${Number(st.q_mvar_peak ?? 0).toFixed(0)} Mvar and ${Number(st.iq_pu_peak ?? 0).toFixed(2)} pu reactive current after it.</div>`).join('');
            return box;
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
                host.innerHTML = `<p style="color:#c00;">${escapeHtmlText(e.message)}</p>`;
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
                        // ANDES takes small steps around events, so plot against real time
                        // (a category axis spaced the samples evenly and stretched the fault).
                        datasets: seriesArr.map((s, i) => ({
                            label: s.name || s.id,
                            data: (s.values || []).map((y, k) => ({ x: t[k], y })),
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
                            x: {
                                type: 'linear',
                                min: t[0],
                                max: t[t.length - 1],
                                title: { display: true, text: 'Time [s]' },
                                ticks: { maxTicksLimit: 11, callback: (v) => +Number(v).toFixed(2) }
                            },
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
            const dcs = this.results.data_centres || [];
            if (dcs.length) {
                makeChart('Data-centre power drawn from the grid (MW)', dcs.map((d) => ({ name: d.name, values: d.p_mw })), 'P [MW]');
            }
            const sts = this.results.statcoms || [];
            if (sts.length) {
                makeChart('STATCOM reactive power (Mvar, + into the grid)', sts.map((st) => ({ name: st.name, values: st.q_mvar })), 'Q [Mvar]');
                makeChart('STATCOM reactive current (pu of its rating)', sts.map((st) => ({ name: st.name, values: st.iq_pu })), 'Iq [pu]');
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
            if (this.results.frequency_hz) {
                cols.push('frequency_hz');
                series.push(this.results.frequency_hz);
            }
            (this.results.data_centres || []).forEach((d) => {
                cols.push(`p_mw_${d.name}`);
                series.push(d.p_mw);
            });
            (this.results.statcoms || []).forEach((st) => {
                cols.push(`q_mvar_${st.name}`);
                series.push(st.q_mvar);
                cols.push(`iq_pu_${st.name}`);
                series.push(st.iq_pu);
            });
            const rt = this.results.ride_through;
            if (rt?.enabled) {
                cols.push('ride_through_pass');
                series.push(t.map(() => (rt.pass === true ? 1 : rt.pass === false ? 0 : '')));
            }
            const lines = [cols.join(',')];
            for (let i = 0; i < t.length; i++) {
                const row = [t[i]];
                series.forEach((vals) => row.push(vals[i] ?? ''));
                lines.push(row.join(','));
            }
            const poi = this.results.poi_metrics;
            if (poi) {
                lines.push('');
                lines.push(`poi_bus,${poi.poi_bus ?? ''}`);
                lines.push(`poi_v_min_pu,${poi.v_min_pu ?? ''}`);
                lines.push(`frequency_nadir_hz,${poi.frequency_nadir_hz ?? ''}`);
                lines.push(`frequency_final_hz,${poi.frequency_final_hz ?? ''}`);
                if (rt?.enabled) {
                    lines.push(`ride_through_pass,${rt.pass ?? ''}`);
                }
                if (rt?.verdict) lines.push(`data_centre_ride_through,${rt.verdict}`);
                (this.results.data_centres || []).forEach((d) => {
                    lines.push(`data_centre,${d.name},verdict,${d.verdict},load_drop_mw,${d.load_drop_mw ?? ''},recovery_s,${d.recovery_s ?? ''}`);
                });
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
