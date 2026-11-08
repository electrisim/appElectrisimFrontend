import { devLog } from '../utils/devLog.js';
import {
    GridCodePqResultsDialog,
    _aggregateContribution, _chartOperatingQ, _contributionLabel, _operatingWords, _pccQDirection, _fmt,
    PQ_Q_TYPE_ORDER, PQ_Q_TYPE_COLOR, PQ_Q_TYPE_PALETTE
} from './GridCodePqResultsDialog.js?v=pq20261108b';
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

devLog('GridCodeVqResultsDialog.js LOADED');

/**
 * U-Q/Pmax results. Built on the P-Q results dialog so it shares its maximized window,
 * overload check, report-quality image (copy / save) and warnings.
 */
export class GridCodeVqResultsDialog extends GridCodePqResultsDialog {
    show(results) {
        const data = results && (results.grid_code_vq_results || results.rpc_results);
        if (!data) {
            alert('No V-Q results to display.');
            return;
        }
        if (!data.uq_curve && data.curves) {
            data.uq_curve = {
                u_pu: data.voltage_levels || [],
                q_max_mvar: [],
                q_min_mvar: [],
                p_mw: data.p_dispatch_mw || data.pn_mw
            };
        }
        this.pointLoadflows = data.point_loadflows || {};
        this._vqData = data;
        this._uqChart = null;
        this._pqChartSpecs = [];
        this._pqMaximized = true;  // open full-screen; "Restore" shrinks it
        this._overloadResult = null;
        this._overloadSection = null;
        this._lineCurrents = null;
        this._lineCurrentSel = null;
        this._lineCurrentSection = null;
        this._lcRedraw = null;
        this._lcRange = null;
        this._lcHiddenV = null;
        this._lcHiddenCurve = null;
        this._lcBannerEl = null;
        this._showElementQ = false;
        this._elementQEdge = 'both';
        this._uqPanel = null;
        this._createModal(data);
    }

    // ---- Element Q (same idea as the P-Q chart, with PCC voltage on the vertical axis) ----

    /** Every stored U-Q point: [{ u, vKey, side, pKey, q }] with its load flow. */
    _uqSamples() {
        const data = this._vqData || {};
        const uq = data.uq_curve || {};
        const pAt = uq.p_mw != null ? uq.p_mw : data.total_installed_mw;
        const out = [];
        [['q_max', uq.q_max_mvar || []], ['q_min', uq.q_min_mvar || []]].forEach(([side, qArr]) => {
            (uq.u_pu || []).forEach((u, i) => {
                const q = qArr[i];
                if (q == null || !Number.isFinite(Number(u))) return;
                const vKey = String(parseFloat(u).toFixed(4));
                const lf = this._resolvePointLoadflow(vKey, side, pAt);
                if (!lf) return;
                out.push({ u: Number(u), vKey, side, pKey: pAt, q: Number(q), lf });
            });
        });
        return out;
    }

    _contributionModel(panel) {
        if (panel._contributionModel) return panel._contributionModel;
        const samples = this._uqSamples().map((s) => ({ ...s, rows: this._elementRowsFromSnapshot(s.lf) }));
        const namesByType = new Map();
        samples.forEach((sample) => sample.rows.forEach((row) => {
            if (!namesByType.has(row.type)) namesByType.set(row.type, new Set());
            namesByType.get(row.type).add(row.name);
        }));
        const collapseTypes = new Set();
        namesByType.forEach((names, type) => {
            if (names.size > 4) collapseTypes.add(type);
        });
        const tracks = new Map();
        samples.forEach((sample) => {
            _aggregateContribution(sample.rows, collapseTypes).forEach((bucket) => {
                if (!tracks.has(bucket.key)) {
                    tracks.set(bucket.key, {
                        key: bucket.key, type: bucket.type, name: bucket.name,
                        collapsed: bucket.collapsed, count: bucket.count
                    });
                }
                const track = tracks.get(bucket.key);
                track.count = Math.max(track.count, bucket.count);
            });
        });
        const typeSeen = {};
        const ordered = [...tracks.values()].sort((a, b) => {
            const ia = PQ_Q_TYPE_ORDER.indexOf(a.type);
            const ib = PQ_Q_TYPE_ORDER.indexOf(b.type);
            if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
        });
        ordered.forEach((track) => {
            const palette = PQ_Q_TYPE_PALETTE[track.type] || [PQ_Q_TYPE_COLOR[track.type] || '#495057'];
            const idx = typeSeen[track.type] || 0;
            typeSeen[track.type] = idx + 1;
            track.color = palette[idx % palette.length];
            track.label = _contributionLabel(track);
        });
        panel._contributionModel = { collapseTypes, tracks: ordered };
        return panel._contributionModel;
    }

    /** Each element group drawn along the Q max edge (diamonds, solid) and Q min edge (triangles, dashed). */
    _elementMarkerDatasets(panel) {
        if (!this._showElementQ) return [];
        const model = this._contributionModel(panel);
        const colorByKey = new Map(model.tracks.map((track) => [track.key, track.color]));
        const edge = this._elementQEdge || 'both';
        const runs = [
            { side: 'q_max', tag: 'Q_max', style: 'rectRot', dash: [] },
            { side: 'q_min', tag: 'Q_min', style: 'triangle', dash: [4, 3] }
        ].filter((run) => edge === 'both'
            || (edge === 'capacitive' && run.side === 'q_max')
            || (edge === 'inductive' && run.side === 'q_min'));
        const samples = this._uqSamples();
        const groups = new Map();
        runs.forEach((run) => {
            samples.filter((s) => s.side === run.side).forEach((sample) => {
                const rows = this._elementRowsFromSnapshot(sample.lf);
                _aggregateContribution(rows, model.collapseTypes).forEach((bucket) => {
                    const x = _chartOperatingQ(bucket);
                    if (!Number.isFinite(x)) return;
                    const label = `${_contributionLabel(bucket)} (${run.tag})`;
                    const tip = `${label}: Q ${_fmt(x)} Mvar at U = ${_fmt(sample.u, 3)} pu, ${_operatingWords(bucket)}`;
                    const key = `${run.side}|${bucket.key}`;
                    if (!groups.has(key)) {
                        const color = colorByKey.get(bucket.key) || PQ_Q_TYPE_COLOR[bucket.type] || '#495057';
                        groups.set(key, {
                            label,
                            _elementQ: true,
                            data: [],
                            showLine: true,
                            borderWidth: 1,
                            borderDash: run.dash,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            pointHitRadius: 10,
                            pointStyle: run.style,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1.5,
                            borderColor: color,
                            backgroundColor: color,
                            order: 2
                        });
                    }
                    groups.get(key).data.push({ x, y: sample.u, _tip: tip });
                });
            });
        });
        return [...groups.values()].map((ds) => {
            ds.data.sort((a, b) => a.y - b.y);
            return ds;
        });
    }

    _elementQStatusText(sel) {
        if (!sel) return '';
        const side = sel.side === 'q_min' ? 'Q min (underexcited)' : 'Q max (overexcited)';
        return `Element reactive power — ${side} at U = ${_fmt(sel.u, 3)} pu: P = ${_fmt(sel.pPcc)} MW, ` +
            `Q = ${_fmt(sel.qPcc)} Mvar (${_pccQDirection(sel.qPcc)})`;
    }

    _elementQHintText() {
        return 'Element Q in Mvar, generator convention as on the chart: positive is capacitive (supplied), negative is inductive (absorbed). Click a red point to read another voltage or edge.';
    }

    _selectUqPoint(sel) {
        const panel = this._uqPanel;
        if (!panel || !sel) return;
        panel.dataset.rpcVoltageKey = sel.vKey;  // the element table reads the point at this voltage
        this._selectElementQPoint(panel, sel);
    }

    /** A click on a red U-Q point also selects it for the element table, as on the P-Q chart. */
    _onCapabilityPointClick(vKey, side, pMw, qMvar, panel) {
        if (panel && panel === this._uqPanel) {
            this._selectUqPoint({
                vKey, side, pKey: pMw, u: parseFloat(vKey), pPcc: this._uqPccP(vKey, side, pMw), qPcc: qMvar
            });
        }
        super._onCapabilityPointClick(vKey, side, pMw, qMvar, panel);
    }

    /** Net P at the PCC of a stored point (the U-Q curve itself only carries dispatched P). */
    _uqPccP(vKey, side, pKey) {
        const curve = (this._vqData?.curves || {})[vKey] || {};
        const arr = side === 'q_min' ? (curve.p_min_mw || curve.p_mw) : (curve.p_max_mw || curve.p_mw);
        const v = Array.isArray(arr) ? Number(arr[0]) : NaN;
        return Number.isFinite(v) ? v : Number(pKey);
    }

    _createElementQBar() {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '8px 24px', backgroundColor: '#fff', borderBottom: '1px solid #e9ecef',
            display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontSize: '13px'
        });
        const makeBtn = (text, onClick, title) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.title = title;
            Object.assign(btn.style, {
                padding: '5px 12px', border: 'none', fontSize: '13px', cursor: 'pointer',
                backgroundColor: '#fff', color: '#495057', fontWeight: '500'
            });
            btn.onclick = onClick;
            return btn;
        };
        const addGroup = (title, btns) => {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const label = document.createElement('span');
            label.textContent = title;
            Object.assign(label.style, { fontWeight: '600', color: '#495057' });
            const group = document.createElement('div');
            Object.assign(group.style, {
                display: 'inline-flex', border: '1px solid #ced4da', borderRadius: '6px', overflow: 'hidden'
            });
            btns.forEach((b) => group.appendChild(b));
            wrap.append(label, group);
            bar.appendChild(wrap);
        };
        this._elementQOffBtn = makeBtn('Off', () => this._setShowElementQ(false), 'Capability curve only.');
        this._elementQOnBtn = makeBtn('On', () => this._setShowElementQ(true),
            'Draw each element group’s reactive power at every red point.');
        addGroup('Element Q', [this._elementQOffBtn, this._elementQOnBtn]);
        this._elementQBothBtn = makeBtn('Both', () => this._setElementQEdge('both'), 'Element Q on both edges.');
        this._elementQCapBtn = makeBtn('Capacitive', () => this._setElementQEdge('capacitive'),
            'Element Q only on the capacitive edge (Q max, overexcited).');
        this._elementQIndBtn = makeBtn('Inductive', () => this._setElementQEdge('inductive'),
            'Element Q only on the inductive edge (Q min, underexcited).');
        addGroup('Element Q edge', [this._elementQBothBtn, this._elementQCapBtn, this._elementQIndBtn]);
        this._syncUnitToggleStyle();
        return bar;
    }

    _mountUqElementQSection(panel) {
        const section = document.createElement('div');
        Object.assign(section.style, { marginTop: '16px' });
        panel._elementQSection = section;
        panel.appendChild(section);
        const samples = this._uqSamples();
        // Start on the nominal-voltage Q max point when there is one.
        const first = samples.find((s) => s.side === 'q_max' && Math.abs(s.u - 1) < 1e-6)
            || samples.find((s) => s.side === 'q_max') || samples[0];
        if (first) {
            panel.dataset.rpcVoltageKey = first.vKey;
            panel._elementQSelection = {
                vKey: first.vKey, side: first.side, pKey: first.pKey, u: first.u,
                pPcc: this._uqPccP(first.vKey, first.side, first.pKey), qPcc: first.q
            };
        }
        this._refreshElementQTable(panel);
    }

    _reportFilePrefix() {
        return 'GridCode_UQ';
    }

    /** Line current 3D: P is fixed in a U-Q study, so the PCC voltage takes the second floor axis. */
    _lcYQuantity() {
        return 'u';
    }

    _reportContext() {
        const data = this._vqData || {};
        if (!this._uqChart) return null;
        const p = data.uq_curve?.p_mw ?? data.p_dispatch_mw ?? data.pn_mw;
        return {
            chart: this._uqChart,
            title: 'Grid Code Compliance — U-Q/Pmax capability at the PCC',
            subtitle: [
                data.uq_grid_code_template_name || '',
                Number(p) > 0 ? `P = ${Number(p).toFixed(1)} MW` : '',
                data.pcc_bus_name ? `PCC: ${String(data.pcc_bus_name).trim()}` : ''
            ].filter(Boolean).join('  ·  '),
            compliance: data.uq_compliance === true || data.uq_compliance === false ? data.uq_compliance : null,
            xLabel: 'Net Q at PCC (Mvar)',
            yLabel: 'Voltage at PCC (p.u.)',
            notes: this._showElementQ && this._uqPanel ? this._selectedContributionLines(this._uqPanel) : []
        };
    }

    /**
     * Q axis as on the P-Q chart: plain "Net Q at PCC (Mvar)" title with the inductive caption at
     * the left end and the capacitive caption at the right end of the title row.
     */
    _uqQAxisOptions() {
        const sidesPlugin = {
            id: 'qAxisSides',
            afterDraw(chartInst, args, pluginOpts) {
                const xScale = chartInst.scales.x;
                if (!xScale || !pluginOpts) return;
                const { ctx: c, chartArea } = chartInst;
                const y = xScale.bottom - 10;
                c.save();
                c.font = `600 12px ${window.Chart?.defaults?.font?.family || 'sans-serif'}`;
                c.fillStyle = '#212529';
                c.textBaseline = 'middle';
                c.textAlign = 'left';
                c.fillText(pluginOpts.left, chartArea.left, y);
                c.textAlign = 'right';
                c.fillText(pluginOpts.right, chartArea.right, y);
                c.restore();
            }
        };
        return {
            title: this._qAxisLabel(),
            grace: '6%',
            plugins: [sidesPlugin],
            pluginOptions: { qAxisSides: this._qAxisSideLabels() },
            layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } }
        };
    }

    _renderUqChart(canvas, uqCurve, reqData, fullData, panel) {
        super._renderUqChart(canvas, uqCurve, reqData, fullData, panel);
        const charts = this.chartInstances || [];
        this._uqChart = charts[charts.length - 1] || null;
        if (this._uqChart && panel) {
            panel._pqChart = this._uqChart;
            const cb = this._uqChart.options?.plugins?.tooltip?.callbacks;
            if (cb && cb.label) {
                const base = cb.label;
                cb.label = (ctx) => ctx.raw?._tip || base(ctx);
            }
            this._refreshElementMarkers(panel);
        }
        // The chart draws after the window was sized (Chart.js loads first): fit it now.
        requestAnimationFrame(() => {
            try { this._uqChart?.resize(); } catch (e) { /* chart already destroyed */ }
        });
    }

    _createModal(data) {
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10001',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: '920px', maxWidth: '95vw',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });
        this._pqDialogEl = dialog;

        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });
        const titleText = document.createElement('span');
        titleText.textContent = 'Grid Code Compliance — V-Q';
        Object.assign(titleText.style, { fontWeight: '700', fontSize: '16px', color: '#212529' });
        titleBar.appendChild(titleText);

        const titleActions = document.createElement('div');
        Object.assign(titleActions.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const maxBtn = document.createElement('button');
        maxBtn.type = 'button';
        maxBtn.textContent = 'Maximize';
        Object.assign(maxBtn.style, {
            border: '1px solid #ced4da', background: '#fff', color: '#212529',
            borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
        });
        maxBtn.onclick = () => this._togglePqMaximize();
        this._pqMaxBtn = maxBtn;
        titleActions.appendChild(maxBtn);
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        Object.assign(closeBtn.style, {
            border: 'none', background: 'transparent', fontSize: '22px',
            cursor: 'pointer', color: '#6c757d', fontWeight: '700'
        });
        closeBtn.onclick = () => this.destroy();
        titleActions.appendChild(closeBtn);
        titleBar.appendChild(titleActions);
        dialog.appendChild(titleBar);

        dialog.appendChild(this._createVqSummaryBar(data));
        dialog.appendChild(this._createElementQBar());

        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1 1 auto', overflowY: 'auto', padding: '20px 24px'
        });
        this._pqContentEl = content;

        const panel = document.createElement('div');
        this._uqPanel = panel;
        const pointStatus = document.createElement('div');
        Object.assign(pointStatus.style, {
            display: 'none', marginBottom: '10px', padding: '8px 12px',
            backgroundColor: '#e8f4fd', border: '1px solid #b8daff', borderRadius: '6px',
            fontSize: '12px', color: '#004085'
        });
        panel._rpcPointStatusEl = pointStatus;
        this._buildUqChartPanel(panel, data);
        const canvas = panel.querySelector('canvas');
        if (canvas) {
            panel.insertBefore(pointStatus, canvas);
            this._pqChartSpecs = [{ canvas, panel, fullData: data }];
            this._mountUqElementQSection(panel);
        }
        content.appendChild(panel);

        const tail = document.createElement('div');
        if (data.pcc_q_convention) {
            const note = document.createElement('div');
            Object.assign(note.style, {
                marginTop: '16px', fontSize: '12px', color: '#6c757d', lineHeight: '1.45'
            });
            note.textContent = data.pcc_q_convention;
            tail.appendChild(note);
        }
        if (Array.isArray(data.warnings) && data.warnings.length) {
            tail.appendChild(this._createWarningsSection(data.warnings));
        }
        content.appendChild(tail);
        this._pqPlantSummaryEl = tail;  // the overload section goes above the notes and warnings

        dialog.appendChild(content);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '12px 24px', borderTop: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
        });
        const lineCurrentBtn = this._styledButton('Line current 3D', '#6f42c1', '#59359a');
        lineCurrentBtn.title = 'Highest current in selected lines over every load flow of this study, as a 3D chart of Q, PCC voltage and line current (reads the stored load flows; runs no new calculation).';
        lineCurrentBtn.onclick = () => this._openLineCurrent3d(data);
        footer.appendChild(lineCurrentBtn);

        const overloadBtn = this._styledButton('Check overloads', '#fd7e14', '#e8590c');
        overloadBtn.title = 'List lines and transformers above the loading limit in every analysed case (reads the stored load flows; runs no new calculation).';
        overloadBtn.onclick = () => {
            const limit = this._overloadResult ? this._overloadResult.limitPct : this._overloadDefaultLimit(data);
            this._runOverloadCheck(data, limit);
            this._overloadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        footer.appendChild(overloadBtn);

        const copyBtn = this._styledButton('Copy image', '#0d6efd', '#0b5ed7');
        copyBtn.title = 'Copy a report-quality image of the U-Q chart, ready to paste into a document, article or post.';
        copyBtn.onclick = () => this._copyReportImage(copyBtn);
        footer.appendChild(copyBtn);

        const imageBtn = this._styledButton('Save image', '#0d6efd', '#0b5ed7');
        imageBtn.title = 'Save the U-Q chart as a high-resolution PNG: choose a report, print or LinkedIn size.';
        imageBtn.onclick = () => this._openImageSizeMenu(imageBtn, (preset) => this._saveChartImage(preset));
        footer.appendChild(imageBtn);

        const csvBtn = this._styledButton('Download CSV', '#28a745', '#218838');
        csvBtn.onclick = () => this._downloadVqCsv(data);
        footer.appendChild(csvBtn);

        const closeFooter = this._styledButton('Close', '#6c757d', '#5a6268');
        closeFooter.onclick = () => this.destroy();
        footer.appendChild(closeFooter);
        dialog.appendChild(footer);

        this.overlay.appendChild(dialog);
        attachBackdropCloseHandler(this.overlay, dialog, () => this.destroy());
        document.body.appendChild(this.overlay);
        this._applyPqDialogSize();
    }

    _createVqSummaryBar(data) {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '12px 24px', backgroundColor: '#f0f7ff', borderBottom: '1px solid #e9ecef',
            display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px'
        });

        const items = [];
        if (data.pcc_bus_name) items.push(['PCC', data.pcc_bus_name]);
        if (data.pn_mw != null) items.push(['Pn', `${Number(data.pn_mw).toFixed(2)} MW`]);
        if (data.p_pcc_mw != null) items.push(['P at PCC', `${Number(data.p_pcc_mw).toFixed(2)} MW`]);
        if (data.p_max_pct != null) items.push(['P setpoint', `${Number(data.p_max_pct).toFixed(0)}% of Pn`]);
        if (data.uq_grid_code_template_name) items.push(['U-Q template', data.uq_grid_code_template_name]);
        if (data.q_dispatch_mode === 'park_configured' && data.park_controller_name) {
            items.push(['Q dispatch', `${data.park_controller_name} as configured`]);
        } else if (data.q_dispatch_mode === 'park' && data.park_controller_name) {
            items.push(['Q dispatch', `${data.park_controller_name} (constant Q at the PCC)`]);
        } else if (data.q_dispatch_mode) {
            items.push(['Q dispatch', 'Local Q on each unit']);
        }
        if (data.load_flow_count != null) items.push(['Load flows', String(data.load_flow_count)]);
        if (data.uq_compliance === true || data.uq_compliance === false) {
            items.push(['Compliance', data.uq_compliance ? 'COMPLIANT' : 'NON-COMPLIANT']);
        }

        items.forEach(([k, v]) => {
            const span = document.createElement('span');
            const strong = document.createElement('strong');
            strong.textContent = `${k}:`;
            span.append(strong, ` ${v}`);
            bar.appendChild(span);
        });
        return bar;
    }

    _downloadVqCsv(data) {
        const uq = data.uq_curve || {};
        const req = data.uq_requirements || {};
        let csv = 'U_pu,Q_max_Mvar,Q_min_Mvar\n';
        (uq.u_pu || []).forEach((u, i) => {
            csv += `${u},${uq.q_max_mvar[i] ?? ''},${uq.q_min_mvar[i] ?? ''}\n`;
        });
        if (req.u_pu && req.u_pu.length) {
            csv += '\n# U-Q requirements\nU_pu,Q_req_max_Mvar,Q_req_min_Mvar\n';
            req.u_pu.forEach((u, i) => {
                csv += `${u},${req.q_req_max_mvar[i] ?? ''},${req.q_req_min_mvar[i] ?? ''}\n`;
            });
        }
        csv += this._overloadCsvText();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'grid_code_vq_results.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

window.GridCodeVqResultsDialog = GridCodeVqResultsDialog;
