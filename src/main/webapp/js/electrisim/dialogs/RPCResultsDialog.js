import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
import { applyLoadFlowResultsToGraph } from '../utils/applyLoadFlowResults.js';
import { buildUqChartGeometry } from './RPCDialog.js';

console.log('RPCResultsDialog.js LOADED');

const RPC_POINT_KEY = (pMw) => String(parseFloat(pMw).toFixed(4));

const RPC_CONVERGE_WARNING_RE = /^V=([\d.]+)pu, P=([\d.]+)MW: Q_(min|max) limited to ([\d.]+)% capability \(power flow non-convergence at higher Q\)$/;
const RPC_OVERLOAD_WARNING_RE = /^V=([\d.]+)pu, P=([\d.]+)MW: Q_(min|max) limited to ([\d.]+)% capability \(overload\)$/;

function _formatRpcPMwRange(pValues) {
    const sorted = [...pValues].map(Number).sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    if (sorted.length === 1) return `${sorted[0].toFixed(1)} MW`;
    return `${sorted[0].toFixed(1)}–${sorted[sorted.length - 1].toFixed(1)} MW (${sorted.length} operating points)`;
}

function _qDirectionLabel(qKey) {
    return qKey === 'min'
        ? 'underexcited reactive limit (Q_min, absorbing Q)'
        : 'overexcited reactive limit (Q_max, injecting Q)';
}

/** Build U-Q/Pmax series from rpc_results (Q at Pmax vs voltage). */
function _extractUqCurveFromResults(data) {
    if (data.uq_curve && data.uq_curve.u_pu && data.uq_curve.u_pu.length) {
        return data.uq_curve;
    }
    const levels = data.voltage_levels || [];
    const curves = data.curves || {};
    const pRated = data.total_installed_mw || 0;
    if (!levels.length || !(pRated > 0)) return null;

    const u_pu = [];
    const q_max_mvar = [];
    const q_min_mvar = [];

    levels.forEach(v => {
        const vKey = String(parseFloat(v).toFixed(4));
        const curve = curves[vKey];
        if (!curve) return;
        const pArr = curve.p_mw || [];
        const qMaxArr = curve.q_max_mvar || [];
        const qMinArr = curve.q_min_mvar || [];
        let bestIdx = -1;
        let bestDiff = Infinity;
        pArr.forEach((p, i) => {
            if (p == null) return;
            const diff = Math.abs(Number(p) - pRated);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        });
        if (bestIdx < 0) return;
        u_pu.push(parseFloat(v));
        q_max_mvar.push(qMaxArr[bestIdx] != null ? qMaxArr[bestIdx] : null);
        q_min_mvar.push(qMinArr[bestIdx] != null ? qMinArr[bestIdx] : null);
    });

    if (!u_pu.length) return null;
    return { u_pu, q_max_mvar, q_min_mvar, p_mw: pRated };
}

/**
 * Turn repetitive backend RPC warnings into grouped summaries plus optional detail lines.
 */
function _summarizeRpcWarnings(warnings) {
    const convergeGroups = new Map();
    const overloadGroups = new Map();
    const otherWarnings = [];

    (warnings || []).forEach((text) => {
        const conv = RPC_CONVERGE_WARNING_RE.exec(text);
        if (conv) {
            const [, vPu, pMw, qKey, pct] = conv;
            const key = `${vPu}|${qKey}|${pct}`;
            if (!convergeGroups.has(key)) {
                convergeGroups.set(key, { vPu, qKey, pct: Number(pct), pValues: [] });
            }
            convergeGroups.get(key).pValues.push(Number(pMw));
            return;
        }
        const ov = RPC_OVERLOAD_WARNING_RE.exec(text);
        if (ov) {
            const [, vPu, pMw, qKey] = ov;
            const key = `${vPu}|${qKey}`;
            if (!overloadGroups.has(key)) {
                overloadGroups.set(key, { vPu, qKey, pValues: [] });
            }
            overloadGroups.get(key).pValues.push(Number(pMw));
            return;
        }
        otherWarnings.push(text);
    });

    const summaries = [];

    convergeGroups.forEach(({ vPu, qKey, pct, pValues }) => {
        const dir = _qDirectionLabel(qKey);
        const pRange = _formatRpcPMwRange(pValues);
        summaries.push(
            `At ${vPu} pu, ${dir}: load flow converged only up to ${pct}% of generator capability ` +
            `for P = ${pRange}. The red Q_${qKey} curve shows this achievable limit — not the full ` +
            `nameplate reactive capability at those points.`
        );
    });

    overloadGroups.forEach(({ vPu, qKey, pValues }) => {
        const dir = _qDirectionLabel(qKey);
        const pRange = _formatRpcPMwRange(pValues);
        summaries.push(
            `At ${vPu} pu, ${dir}: reactive output was reduced because line or transformer loading ` +
            `exceeded the limit for P = ${pRange}.`
        );
    });

    const hasConvergenceWarnings = convergeGroups.size > 0;
    const intro = hasConvergenceWarnings
        ? 'How to read “limited to X% capability”: for each active-power step, the reactive setpoint is ' +
          'resolved by bisection to the highest fraction of generator capability whose load flow still ' +
          'converges (a stable solution). If it stops at, say, 65%, higher reactive setpoints did not ' +
          'converge, so the red Q curve shows the achievable limit at those points — not the full ' +
          'nameplate reactive capability. Typical reasons include voltage limits, weak grid strength at ' +
          'the PCC, tap-changer or shunt-controller action, or the network model operating near its ' +
          'stability limit.'
        : null;

    return { intro, summaries, otherWarnings, rawWarnings: warnings || [] };
}

export class RPCResultsDialog {
    constructor(editorUi) {
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.chartInstances = [];
        this.pointLoadflows = {};
        this._pointBanner = null;
        this._activeVoltageKey = null;
        this._viewMode = 'pq';
    }

    show(results) {
        if (!results || !results.rpc_results) {
            alert('No RPC results to display.');
            return;
        }
        const data = results.rpc_results;
        this.pointLoadflows = data.point_loadflows || {};
        this._createModal(data);
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

        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });
        const titleText = document.createElement('span');
        titleText.textContent = 'Grid Code Compliance — P-Q / U-Q';
        Object.assign(titleText.style, { fontWeight: '700', fontSize: '16px', color: '#212529' });
        titleBar.appendChild(titleText);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00d7';
        Object.assign(closeBtn.style, {
            border: 'none', background: 'transparent', fontSize: '22px',
            cursor: 'pointer', color: '#6c757d', fontWeight: '700'
        });
        closeBtn.onclick = () => this.destroy();
        titleBar.appendChild(closeBtn);
        dialog.appendChild(titleBar);

        const summaryBar = this._createSummaryBar(data);
        dialog.appendChild(summaryBar);

        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1 1 auto', overflowY: 'auto', padding: '20px 24px'
        });

        const viewToggle = this._createViewToggle(data);
        content.appendChild(viewToggle);

        const pqContainer = document.createElement('div');
        pqContainer.dataset.rpcView = 'pq';
        const uqContainer = document.createElement('div');
        uqContainer.dataset.rpcView = 'uq';
        uqContainer.style.display = 'none';

        const voltageLevels = data.voltage_levels || [];
        if (voltageLevels.length === 0) {
            pqContainer.textContent = 'No voltage levels in results.';
        } else {
            const tabsHeader = document.createElement('div');
            Object.assign(tabsHeader.style, {
                display: 'flex', borderBottom: '2px solid #e9ecef', marginBottom: '16px', flexWrap: 'wrap'
            });
            const tabPanels = [];

            voltageLevels.forEach((v, i) => {
                const vKey = String(parseFloat(v).toFixed(4));
                const tab = document.createElement('div');
                tab.textContent = `${v} pu`;
                Object.assign(tab.style, {
                    padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
                    borderBottom: i === 0 ? '2px solid #007bff' : '2px solid transparent',
                    color: i === 0 ? '#007bff' : '#6c757d',
                    fontWeight: i === 0 ? '600' : '400',
                    backgroundColor: i === 0 ? '#f0f7ff' : 'transparent',
                    borderTopLeftRadius: '4px', borderTopRightRadius: '4px',
                    transition: 'all 0.2s ease'
                });

                const panel = document.createElement('div');
                panel.style.display = i === 0 ? 'block' : 'none';

                const curveData = data.curves[vKey];
                if (curveData) {
                    const complianceVal = data.compliance ? data.compliance[vKey] : null;
                    const reqData = data.requirements ? data.requirements[vKey] : null;
                    this._buildChartPanel(panel, curveData, reqData, complianceVal, v, data);
                } else {
                    panel.textContent = `No data for voltage level ${v} pu (key: ${vKey})`;
                }

                tab.onclick = () => {
                    tabsHeader.querySelectorAll('div').forEach(t => {
                        t.style.borderBottomColor = 'transparent';
                        t.style.color = '#6c757d';
                        t.style.fontWeight = '400';
                        t.style.backgroundColor = 'transparent';
                    });
                    tab.style.borderBottomColor = '#007bff';
                    tab.style.color = '#007bff';
                    tab.style.fontWeight = '600';
                    tab.style.backgroundColor = '#f0f7ff';
                    tabPanels.forEach(p => p.style.display = 'none');
                    panel.style.display = 'block';
                };

                tabsHeader.appendChild(tab);
                tabPanels.push(panel);
            });

            pqContainer.appendChild(tabsHeader);
            tabPanels.forEach(p => pqContainer.appendChild(p));
        }

        this._buildUqChartPanel(uqContainer, data);

        content.appendChild(pqContainer);
        content.appendChild(uqContainer);
        this._pqContainer = pqContainer;
        this._uqContainer = uqContainer;

        if (data.warnings && data.warnings.length > 0) {
            content.appendChild(this._createWarningsSection(data.warnings));
        }

        dialog.appendChild(content);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, {
            padding: '12px 24px', borderTop: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
        });
        const downloadBtn = this._styledButton('Download CSV', '#28a745', '#218838');
        downloadBtn.onclick = () => this._downloadCSV(data);
        footerBar.appendChild(downloadBtn);

        const closeBtn2 = this._styledButton('Close', '#6c757d', '#5a6268');
        closeBtn2.onclick = () => this.destroy();
        footerBar.appendChild(closeBtn2);
        dialog.appendChild(footerBar);

        this.overlay.appendChild(dialog);
        attachBackdropCloseHandler(this.overlay, dialog, () => this.destroy());
        document.body.appendChild(this.overlay);
    }

    _createSummaryBar(data) {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '10px 24px', backgroundColor: '#f0f7ff', borderBottom: '1px solid #d6e9ff',
            display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#495057'
        });
        const items = [
            ['PCC Bus', data.pcc_bus_name || 'N/A'],
            ['Generators', data.generator_count || 0],
            ['Installed P', `${(data.total_installed_mw || 0).toFixed(1)} MW`],
            ['Voltage Levels', (data.voltage_levels || []).length]
        ];
        const tcc = data.tap_changer_control;
        if (tcc) {
            const applied = tcc.controllers_applied;
            const req = tcc.run_control_requested;
            let tapLine = req
                ? (applied
                    ? `On (${tcc.transformer_count || 0} transformer(s): ${(tcc.transformer_names || []).join(', ') || '—'})`
                    : 'Requested but no configured transformers')
                : 'Off';
            items.push(['Tap changer control', tapLine]);
        }
        if (data.grid_code_template_name) {
            items.push(['Grid code requirement', data.grid_code_template_name]);
        }
        if (data.uq_grid_code_template_name) {
            items.push(['U-Q requirement', data.uq_grid_code_template_name]);
        }
        if (data.uq_compliance !== null && data.uq_compliance !== undefined) {
            items.push(['U-Q/Pmax compliance', data.uq_compliance ? 'COMPLIANT' : 'NON-COMPLIANT']);
        }
        items.forEach(([label, val]) => {
            const span = document.createElement('span');
            span.innerHTML = `<strong>${label}:</strong> ${val}`;
            bar.appendChild(span);
        });
        if (data.pcc_q_convention) {
            const note = document.createElement('div');
            Object.assign(note.style, {
                flexBasis: '100%',
                marginTop: '6px',
                fontSize: '11px',
                color: '#6c757d',
                lineHeight: '1.4'
            });
            note.textContent = data.pcc_q_convention;
            bar.appendChild(note);
        }
        return bar;
    }

    _createWarningsSection(warnings) {
        const { intro, summaries, otherWarnings, rawWarnings } = _summarizeRpcWarnings(warnings);

        const section = document.createElement('div');
        Object.assign(section.style, {
            marginTop: '16px', padding: '12px 14px', backgroundColor: '#fff3cd',
            border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', color: '#856404',
            lineHeight: '1.5'
        });

        const title = document.createElement('strong');
        title.textContent = 'Warnings';
        section.appendChild(title);

        if (intro) {
            const introEl = document.createElement('p');
            Object.assign(introEl.style, { margin: '8px 0 0 0' });
            introEl.textContent = intro;
            section.appendChild(introEl);
        }

        const listItems = [...summaries, ...otherWarnings];
        if (listItems.length > 0) {
            const ul = document.createElement('ul');
            Object.assign(ul.style, { margin: '8px 0 0 0', paddingLeft: '20px' });
            listItems.forEach(text => {
                const li = document.createElement('li');
                li.textContent = text;
                li.style.marginBottom = '4px';
                ul.appendChild(li);
            });
            section.appendChild(ul);
        }

        if (rawWarnings.length > 1) {
            const details = document.createElement('details');
            Object.assign(details.style, { marginTop: '10px', fontSize: '12px' });
            const summaryEl = document.createElement('summary');
            summaryEl.textContent = `Show all ${rawWarnings.length} technical log lines`;
            summaryEl.style.cursor = 'pointer';
            details.appendChild(summaryEl);
            const pre = document.createElement('pre');
            Object.assign(pre.style, {
                margin: '8px 0 0 0', padding: '8px', backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontSize: '11px', maxHeight: '160px', overflowY: 'auto'
            });
            pre.textContent = rawWarnings.join('\n');
            details.appendChild(pre);
            section.appendChild(details);
        }

        return section;
    }

    _createViewToggle(data) {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap'
        });

        const makeBtn = (label, mode) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.dataset.rpcViewMode = mode;
            Object.assign(btn.style, {
                padding: '8px 16px', borderRadius: '6px', border: '1px solid #dee2e6',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', backgroundColor: '#fff',
                color: '#495057'
            });
            btn.onclick = () => this._switchViewMode(mode, bar);
            return btn;
        };

        bar.appendChild(makeBtn('P-Q / Pmax', 'pq'));
        bar.appendChild(makeBtn('U-Q / Pmax', 'uq'));
        this._viewToggleBar = bar;
        this._switchViewMode(this._viewMode, bar);
        return bar;
    }

    _switchViewMode(mode, bar) {
        this._viewMode = mode;
        if (bar) {
            bar.querySelectorAll('button[data-rpc-view-mode]').forEach(btn => {
                const active = btn.dataset.rpcViewMode === mode;
                btn.style.backgroundColor = active ? '#007bff' : '#fff';
                btn.style.color = active ? '#fff' : '#495057';
                btn.style.borderColor = active ? '#007bff' : '#dee2e6';
            });
        }
        if (this._pqContainer) this._pqContainer.style.display = mode === 'pq' ? 'block' : 'none';
        if (this._uqContainer) this._uqContainer.style.display = mode === 'uq' ? 'block' : 'none';
    }

    _buildUqChartPanel(panel, data) {
        const uqCurve = _extractUqCurveFromResults(data);
        if (!uqCurve || !uqCurve.u_pu.length) {
            panel.textContent = 'No U-Q/Pmax data available. Run RPC with multiple voltage levels and P sweep including Pmax.';
            return;
        }

        const clickHint = document.createElement('div');
        Object.assign(clickHint.style, {
            fontSize: '12px', color: '#6c757d', marginBottom: '10px', lineHeight: '1.45'
        });
        const pAt = uqCurve.p_mw != null ? uqCurve.p_mw : data.total_installed_mw;
        clickHint.textContent = `Reactive power capability at P = ${Number(pAt).toFixed(1)} MW (Pmax) vs PCC voltage. Click red points to show load flow on the diagram.`;
        panel.appendChild(clickHint);

        if (data.uq_compliance !== null && data.uq_compliance !== undefined) {
            const badge = document.createElement('div');
            Object.assign(badge.style, {
                display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: '600', marginBottom: '12px',
                backgroundColor: data.uq_compliance ? '#d4edda' : '#f8d7da',
                color: data.uq_compliance ? '#155724' : '#721c24',
                border: `1px solid ${data.uq_compliance ? '#c3e6cb' : '#f5c6cb'}`
            });
            badge.textContent = data.uq_compliance
                ? 'U-Q/Pmax COMPLIANT — Requirements met at Pmax'
                : 'U-Q/Pmax NON-COMPLIANT — Requirements not met at Pmax';
            panel.appendChild(badge);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 850;
        canvas.height = 450;
        Object.assign(canvas.style, { width: '100%', maxHeight: '450px' });
        panel.appendChild(canvas);

        const req = data.uq_requirements || {};
        this._loadChartJS().then(() => {
            this._renderUqChart(canvas, uqCurve, req, data, panel);
        });

        const tableWrap = document.createElement('div');
        Object.assign(tableWrap.style, { marginTop: '16px', overflowX: 'auto' });
        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%', borderCollapse: 'collapse', fontSize: '12px'
        });
        const header = document.createElement('tr');
        ['U (p.u.)', 'Q_max (Mvar)', 'Q_min (Mvar)', 'Req Q_max', 'Req Q_min', 'OK?'].forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                padding: '6px 8px', borderBottom: '2px solid #dee2e6', textAlign: 'left',
                backgroundColor: '#f8f9fa'
            });
            header.appendChild(th);
        });
        table.appendChild(header);

        const reqU = req.u_pu || [];
        const reqQMax = req.q_req_max_mvar || [];
        const reqQMin = req.q_req_min_mvar || [];
        const pRated = data.total_installed_mw || 1;

        uqCurve.u_pu.forEach((u, i) => {
            const tr = document.createElement('tr');
            const qMax = uqCurve.q_max_mvar[i];
            const qMin = uqCurve.q_min_mvar[i];
            let reqMax = '';
            let reqMin = '';
            let ok = '—';
            if (reqU.length > 0) {
                const uNum = Number(u);
                const sorted = reqU.map((ru, j) => ({ u: Number(ru), qMax: Number(reqQMax[j]), qMin: Number(reqQMin[j]) }))
                    .filter(r => !isNaN(r.u)).sort((a, b) => a.u - b.u);
                if (sorted.length) {
                    const us = sorted.map(r => r.u);
                    const qmx = sorted.map(r => r.qMax);
                    const qmn = sorted.map(r => r.qMin);
                    reqMax = this._interp1d(uNum, us, qmx);
                    reqMin = this._interp1d(uNum, us, qmn);
                    if (qMax != null && qMin != null && reqMax !== '' && reqMin !== '') {
                        ok = (qMax >= reqMax - 1e-4 && qMin <= reqMin + 1e-4) ? 'Yes' : 'No';
                    }
                }
            }
            [
                Number(u).toFixed(3),
                qMax != null ? Number(qMax).toFixed(2) : '—',
                qMin != null ? Number(qMin).toFixed(2) : '—',
                reqMax !== '' ? Number(reqMax).toFixed(2) : '—',
                reqMin !== '' ? Number(reqMin).toFixed(2) : '—',
                ok
            ].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                Object.assign(td.style, { padding: '5px 8px', borderBottom: '1px solid #eee' });
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        tableWrap.appendChild(table);
        panel.appendChild(tableWrap);
    }

    _interp1d(x, xs, ys) {
        if (!xs.length) return '';
        if (xs.length === 1) return ys[0];
        if (x <= xs[0]) return ys[0];
        if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
        for (let i = 0; i < xs.length - 1; i++) {
            if (x >= xs[i] && x <= xs[i + 1]) {
                const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
                return ys[i] + t * (ys[i + 1] - ys[i]);
            }
        }
        return ys[ys.length - 1];
    }

    _renderUqChart(canvas, uqCurve, reqData, fullData, panel) {
        const Chart = window.Chart;
        if (!Chart) return;

        const uArr = uqCurve.u_pu || [];
        const qMaxArr = uqCurve.q_max_mvar || [];
        const qMinArr = uqCurve.q_min_mvar || [];
        const pAt = uqCurve.p_mw != null ? uqCurve.p_mw : fullData.total_installed_mw;

        const capMaxData = uArr.map((u, i) => ({
            x: qMaxArr[i],
            y: Number(u),
            _rpcSide: 'q_max',
            _rpcV: u,
            _rpcP: pAt,
            _rpcQ: qMaxArr[i]
        })).filter(d => d.x !== null && d.x !== undefined && !isNaN(d.y));

        const capMinData = uArr.map((u, i) => ({
            x: qMinArr[i],
            y: Number(u),
            _rpcSide: 'q_min',
            _rpcV: u,
            _rpcP: pAt,
            _rpcQ: qMinArr[i]
        })).filter(d => d.x !== null && d.x !== undefined && !isNaN(d.y));

        const datasets = [
            {
                label: 'Capability Q_max (overexcited)',
                data: capMaxData,
                borderColor: '#dc3545',
                backgroundColor: '#dc3545',
                borderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: true,
                order: 1
            },
            {
                label: 'Capability Q_min (underexcited)',
                data: capMinData,
                borderColor: '#dc3545',
                backgroundColor: '#dc3545',
                borderWidth: 2,
                borderDash: [6, 3],
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: true,
                order: 1
            }
        ];

        const reqU = reqData.u_pu || [];
        const reqQMax = reqData.q_req_max_mvar || [];
        const reqQMin = reqData.q_req_min_mvar || [];
        if (reqU.length > 0) {
            const reqRows = reqU.map((u, i) => ({
                u: Number(u),
                qMin: reqQMin[i],
                qMax: reqQMax[i]
            }));
            const {
                qMinPts: reqMinPts,
                qMaxPts: reqMaxPts,
                closureDatasets,
                envelope: reqEnvelope
            } = buildUqChartGeometry(reqRows, { u: 'u', qMin: 'qMin', qMax: 'qMax' });

            const reqLabel = fullData.uq_grid_code_template_name
                ? ` (${fullData.uq_grid_code_template_name})`
                : '';
            datasets.push({
                label: `Required Q_max${reqLabel}`,
                data: reqMaxPts,
                borderColor: '#0d6efd',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 2,
                showLine: true,
                order: 2
            });
            datasets.push({
                label: `Required Q_min${reqLabel}`,
                data: reqMinPts,
                borderColor: '#0d6efd',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [6, 3],
                pointRadius: 2,
                showLine: true,
                order: 2
            });
            closureDatasets.forEach(c => {
                datasets.push({
                    label: c.label,
                    data: c.data,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    showLine: true,
                    order: 2
                });
            });
            if (reqEnvelope.length) {
                datasets.push({
                    label: 'U-Q Requirement Area',
                    data: reqEnvelope,
                    borderColor: 'transparent',
                    backgroundColor: 'rgba(13, 110, 253, 0.06)',
                    fill: true,
                    pointRadius: 0,
                    showLine: true,
                    order: 4
                });
            }
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements, chartInst) => {
                    if (!elements?.length) return;
                    const el = elements[0];
                    const ds = chartInst.data.datasets[el.datasetIndex];
                    if (!ds?.label?.startsWith('Capability Q_')) return;
                    const raw = ds.data[el.index];
                    if (!raw || raw._rpcSide == null) return;
                    const vKey = String(parseFloat(raw._rpcV).toFixed(4));
                    this._onCapabilityPointClick(vKey, raw._rpcSide, raw._rpcP, raw._rpcQ, panel);
                },
                plugins: {
                    title: {
                        display: true,
                        text: `U-Q/Pmax Diagram — P = ${Number(pAt).toFixed(1)} MW${
                            fullData.uq_grid_code_template_name
                                ? ` · ${fullData.uq_grid_code_template_name}`
                                : ''
                        }`,
                        font: { size: 15, weight: '600' },
                        color: '#212529'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            filter: (item) => !item.text.includes('Area') && !item.text.startsWith('_'),
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const base = `Q: ${ctx.parsed.x?.toFixed(2)} Mvar, U: ${ctx.parsed.y?.toFixed(3)} pu`;
                                if (ctx.dataset?.label?.startsWith('Capability Q_')) {
                                    return `${base} — click to show load flow on diagram`;
                                }
                                return base;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Net Q at PCC (Mvar) — + overexcited, − underexcited',
                            font: { size: 12, weight: '600' }
                        },
                        grid: { color: 'rgba(0,0,0,0.06)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Voltage at PCC (p.u.)',
                            font: { size: 12, weight: '600' }
                        },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        min: 0.85,
                        max: 1.10
                    }
                }
            }
        });
        this.chartInstances.push(chart);
    }

    _buildChartPanel(panel, curveData, reqData, complianceVal, voltageLevel, fullData) {
        const vKey = String(parseFloat(voltageLevel).toFixed(4));
        panel.dataset.rpcVoltageKey = vKey;

        const clickHint = document.createElement('div');
        Object.assign(clickHint.style, {
            fontSize: '12px', color: '#6c757d', marginBottom: '10px', lineHeight: '1.45'
        });
        clickHint.textContent = 'Click any red capability point to update load-flow result boxes on the diagram for that operating point.';
        panel.appendChild(clickHint);

        const pointStatus = document.createElement('div');
        pointStatus.className = 'rpc-point-status';
        Object.assign(pointStatus.style, {
            display: 'none', marginBottom: '10px', padding: '8px 12px',
            backgroundColor: '#e8f4fd', border: '1px solid #b8daff', borderRadius: '6px',
            fontSize: '12px', color: '#004085'
        });
        panel.appendChild(pointStatus);
        panel._rpcPointStatusEl = pointStatus;

        if (complianceVal !== null && complianceVal !== undefined) {
            const badge = document.createElement('div');
            Object.assign(badge.style, {
                display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: '600', marginBottom: '12px',
                backgroundColor: complianceVal ? '#d4edda' : '#f8d7da',
                color: complianceVal ? '#155724' : '#721c24',
                border: `1px solid ${complianceVal ? '#c3e6cb' : '#f5c6cb'}`
            });
            badge.textContent = complianceVal ? 'COMPLIANT — Requirements met' : 'NON-COMPLIANT — Requirements not met';
            panel.appendChild(badge);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 850;
        canvas.height = 450;
        Object.assign(canvas.style, { width: '100%', maxHeight: '450px' });
        panel.appendChild(canvas);

        this._loadChartJS().then(() => {
            this._renderChart(canvas, curveData, reqData, voltageLevel, fullData, panel);
        });
    }

    _resolvePointLoadflow(vKey, side, pMw) {
        const vl = this.pointLoadflows[vKey];
        if (!vl) return null;
        const sideMap = vl[side];
        if (!sideMap) return null;
        return sideMap[RPC_POINT_KEY(pMw)] || null;
    }

    _showDiagramPointBanner(label) {
        this._removePointBanner();
        const banner = document.createElement('div');
        banner.id = 'rpc-point-diagram-banner';
        Object.assign(banner.style, {
            position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '100003', backgroundColor: '#212529', color: '#f8f9fa',
            padding: '10px 16px', borderRadius: '8px', fontSize: '13px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', display: 'flex',
            alignItems: 'center', gap: '12px', maxWidth: 'min(92vw, 720px)'
        });
        const text = document.createElement('span');
        text.textContent = label;
        text.style.flex = '1';
        banner.appendChild(text);

        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back to PQ diagram';
        Object.assign(backBtn.style, {
            border: 'none', borderRadius: '4px', padding: '6px 12px',
            backgroundColor: '#0d6efd', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
        });
        backBtn.onclick = () => {
            if (this.overlay) this.overlay.style.display = 'flex';
            this._removePointBanner();
        };
        banner.appendChild(backBtn);
        document.body.appendChild(banner);
        this._pointBanner = banner;
    }

    _removePointBanner() {
        if (this._pointBanner?.parentNode) {
            this._pointBanner.parentNode.removeChild(this._pointBanner);
        }
        this._pointBanner = null;
    }

    _onCapabilityPointClick(vKey, side, pMw, qMvar, panel) {
        const lf = this._resolvePointLoadflow(vKey, side, pMw);
        if (!lf) {
            alert('No stored load-flow snapshot for this point. Re-run RPC analysis to refresh point data.');
            return;
        }
        const graph = this.ui?.editor?.graph;
        if (!graph) {
            alert('Diagram not available.');
            return;
        }

        const sideLabel = side === 'q_max' ? 'Q_max (overexcited)' : 'Q_min (underexcited)';
        const statusText = `Showing diagram load flow — ${sideLabel}: P = ${Number(pMw).toFixed(2)} MW, Q = ${Number(qMvar).toFixed(2)} Mvar @ ${parseFloat(vKey)} pu`;
        if (panel?._rpcPointStatusEl) {
            panel._rpcPointStatusEl.style.display = 'block';
            panel._rpcPointStatusEl.textContent = statusText;
        }

        applyLoadFlowResultsToGraph(graph, lf);

        if (this.overlay) this.overlay.style.display = 'none';
        this._showDiagramPointBanner(statusText);
        this._activeVoltageKey = vKey;
    }

    _loadChartJS() {
        if (window.Chart) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }

    _renderChart(canvas, curveData, reqData, voltageLevel, fullData, panel) {
        const Chart = window.Chart;
        if (!Chart) {
            console.error('Chart.js not available');
            return;
        }

        const pArr = curveData.p_mw || [];
        const qMaxArr = curveData.q_max_mvar || [];
        const qMinArr = curveData.q_min_mvar || [];

        const vKey = String(parseFloat(voltageLevel).toFixed(4));
        const capabilityMaxData = pArr.map((p, i) => ({
            x: qMaxArr[i], y: p, _rpcSide: 'q_max', _rpcP: p, _rpcQ: qMaxArr[i]
        })).filter(d => d.x !== null);
        const capabilityMinData = pArr.map((p, i) => ({
            x: qMinArr[i], y: p, _rpcSide: 'q_min', _rpcP: p, _rpcQ: qMinArr[i]
        })).filter(d => d.x !== null);

        // Build the closed envelope: go from Q_min (bottom-left) up, then Q_max top-right down
        const envelopeData = [];
        // Q_min side (ascending P)
        for (let i = 0; i < pArr.length; i++) {
            if (qMinArr[i] !== null) envelopeData.push({ x: qMinArr[i], y: pArr[i] });
        }
        // Q_max side (descending P to close the loop)
        for (let i = pArr.length - 1; i >= 0; i--) {
            if (qMaxArr[i] !== null) envelopeData.push({ x: qMaxArr[i], y: pArr[i] });
        }

        const datasets = [
            {
                label: 'Capability Q_max',
                data: capabilityMaxData,
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHitRadius: 12,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                showLine: true,
                order: 1
            },
            {
                label: 'Capability Q_min',
                data: capabilityMinData,
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                borderDash: [6, 3],
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHitRadius: 12,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                showLine: true,
                order: 1
            },
            {
                label: 'Capability Area',
                data: envelopeData,
                borderColor: 'transparent',
                backgroundColor: 'rgba(220, 53, 69, 0.08)',
                fill: true,
                pointRadius: 0,
                showLine: true,
                order: 3
            }
        ];

        if (reqData) {
            const reqP = reqData.p_mw || [];
            const reqQMax = reqData.q_req_max_mvar || [];
            const reqQMin = reqData.q_req_min_mvar || [];

            if (reqP.length > 0) {
                const reqMaxPts = reqP.map((p, i) => ({ x: reqQMax[i], y: p })).filter(d => d.x !== null && d.x !== undefined);
                const reqMinPts = reqP.map((p, i) => ({ x: reqQMin[i], y: p })).filter(d => d.x !== null && d.x !== undefined);

                const reqEnvelope = [];
                for (let i = 0; i < reqP.length; i++) {
                    if (reqQMin[i] != null) reqEnvelope.push({ x: reqQMin[i], y: reqP[i] });
                }
                for (let i = reqP.length - 1; i >= 0; i--) {
                    if (reqQMax[i] != null) reqEnvelope.push({ x: reqQMax[i], y: reqP[i] });
                }

                const reqLabelSuffix = fullData.grid_code_template_name
                    ? ' (grid code)'
                    : '';
                datasets.push({
                    label: `Required Q (overexcited)${reqLabelSuffix}`,
                    data: reqMaxPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 2,
                    showLine: true,
                    order: 2
                });
                datasets.push({
                    label: `Required Q (underexcited)${reqLabelSuffix}`,
                    data: reqMinPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 2,
                    showLine: true,
                    order: 2
                });
                datasets.push({
                    label: 'Requirement Area',
                    data: reqEnvelope,
                    borderColor: 'transparent',
                    backgroundColor: 'rgba(13, 110, 253, 0.06)',
                    fill: true,
                    pointRadius: 0,
                    showLine: true,
                    order: 4
                });
            }
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements, chart) => {
                    if (!elements?.length) return;
                    const el = elements[0];
                    const ds = chart.data.datasets[el.datasetIndex];
                    if (!ds?.label?.startsWith('Capability Q_')) return;
                    const raw = ds.data[el.index];
                    if (!raw || raw._rpcSide == null) return;
                    this._onCapabilityPointClick(vKey, raw._rpcSide, raw._rpcP, raw._rpcQ, panel);
                },
                plugins: {
                    title: {
                        display: true,
                        text: `PQ Diagram — PCC Voltage: ${voltageLevel} pu${
                            fullData.grid_code_template_name
                                ? ` · ${fullData.grid_code_template_name}`
                                : ''
                        }`,
                        font: { size: 15, weight: '600' },
                        color: '#212529'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            filter: (item) => !item.text.includes('Area') && !item.text.startsWith('_'),
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const base = `Q: ${ctx.parsed.x?.toFixed(2)} Mvar, P: ${ctx.parsed.y?.toFixed(2)} MW`;
                                const dsLabel = ctx.dataset?.label || '';
                                if (dsLabel.startsWith('Capability Q_')) {
                                    return `${base} — click to show load flow on diagram`;
                                }
                                return base;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Net Q at PCC, res_bus (Mvar) — + overexcited, − underexcited; blue = PCC req.',
                            font: { size: 12, weight: '600' }
                        },
                        grid: { color: 'rgba(0,0,0,0.06)' }
                    },
                    y: {
                        title: { display: true, text: 'P (MW)', font: { size: 13, weight: '600' } },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        min: 0
                    }
                }
            }
        });
        this.chartInstances.push(chart);
    }

    _downloadCSV(data) {
        let csv = '# P-Q curves\nVoltage_pu,P_MW,Q_max_Mvar,Q_min_Mvar\n';
        const levels = data.voltage_levels || [];
        levels.forEach(v => {
            const vKey = String(parseFloat(v).toFixed(4));
            const curve = data.curves[vKey];
            if (!curve) return;
            const pArr = curve.p_mw || [];
            const qMax = curve.q_max_mvar || [];
            const qMin = curve.q_min_mvar || [];
            pArr.forEach((p, i) => {
                csv += `${v},${p},${qMax[i] != null ? qMax[i] : ''},${qMin[i] != null ? qMin[i] : ''}\n`;
            });
        });

        const uq = _extractUqCurveFromResults(data);
        if (uq && uq.u_pu.length) {
            csv += '\n# U-Q/Pmax at P=' + (uq.p_mw != null ? uq.p_mw : '') + ' MW\n';
            csv += 'U_pu,Q_max_Mvar,Q_min_Mvar\n';
            uq.u_pu.forEach((u, i) => {
                csv += `${u},${uq.q_max_mvar[i] != null ? uq.q_max_mvar[i] : ''},${uq.q_min_mvar[i] != null ? uq.q_min_mvar[i] : ''}\n`;
            });
            const req = data.uq_requirements || {};
            if (req.u_pu && req.u_pu.length) {
                csv += '\n# U-Q requirements\nU_pu,Q_req_max_Mvar,Q_req_min_Mvar\n';
                req.u_pu.forEach((u, i) => {
                    csv += `${u},${req.q_req_max_mvar[i]},${req.q_req_min_mvar[i]}\n`;
                });
            }
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RPC_PQ_Diagram_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _styledButton(text, bg, hover) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '8px 18px', border: 'none', borderRadius: '4px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer',
            backgroundColor: bg, color: '#fff', transition: 'background-color 0.2s'
        });
        btn.onmouseenter = () => btn.style.backgroundColor = hover;
        btn.onmouseleave = () => btn.style.backgroundColor = bg;
        return btn;
    }

    destroy() {
        this._removePointBanner();
        this.chartInstances.forEach(c => { try { c.destroy(); } catch (e) { /* noop */ } });
        this.chartInstances = [];
        if (this.overlay && this.overlay.parentNode) {
            document.body.removeChild(this.overlay);
        }
        this.overlay = null;
    }
}

window.RPCResultsDialog = RPCResultsDialog;
