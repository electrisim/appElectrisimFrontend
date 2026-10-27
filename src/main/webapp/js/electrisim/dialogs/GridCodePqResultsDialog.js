import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
import { RPCResultsDialog } from './RPCResultsDialog.js';
import {
    getGridTemplateRequirementsMw,
    getGridTemplateDisplayName,
    findGridTemplateKeyByName
} from './RPCDialog.js';
import {
    buildGraphCellLookupMap,
    resolveGraphCellForResult,
    getDisplayName,
    looksLikeInternalGraphObjectId
} from '../utils/attributeUtils.js';

console.log('GridCodePqResultsDialog.js LOADED');

const PQ_Q_ELEMENT_SOURCES = [
    { key: 'staticgenerators', type: 'Static generator', wind: true },
    { key: 'generators', type: 'Generator' },
    { key: 'storages', type: 'Storage' },
    { key: 'shunts', type: 'Shunt reactor' },
    { key: 'capacitors', type: 'Capacitor' },
    { key: 'svcs', type: 'SVC' }
];

const PQ_Q_TYPE_ORDER = [
    'Wind turbine',
    'Static generator',
    'Generator',
    'Storage',
    'Shunt reactor',
    'Capacitor',
    'SVC'
];

const PQ_Q_TYPE_COLOR = {
    'Wind turbine': '#198754',
    'Static generator': '#0f766e',
    'Generator': '#0dcaf0',
    'Storage': '#6f42c1',
    'Shunt reactor': '#fd7e14',
    'Capacitor': '#d63384',
    'SVC': '#6c757d'
};

function _fmt(v, digits = 3) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toFixed(digits);
}

function _csvEscape(v) {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function _pqSideLabel(side) {
    return side === 'q_min'
        ? 'Q min (underexcited, inductive)'
        : 'Q max (overexcited, capacitive)';
}

const PQ_Q_TYPE_PALETTE = {
    'Wind turbine': ['#198754', '#146c43', '#20c997'],
    'Static generator': ['#0f766e', '#115e59', '#0d9488'],
    'Generator': ['#0dcaf0', '#087990'],
    'Storage': ['#6f42c1', '#59359a'],
    'Shunt reactor': ['#fd7e14', '#d9480f', '#e67700'],
    'Capacitor': ['#d63384', '#a61e4d'],
    'SVC': ['#6c757d', '#495057']
};

function _aggregateContribution(rows, collapseTypes) {
    const buckets = new Map();
    (rows || []).forEach((row) => {
        const qNum = Number(row.qMvar);
        if (!Number.isFinite(qNum)) return;
        const collapsed = collapseTypes.has(row.type);
        const key = collapsed ? `type:${row.type}` : `name:${row.type}|${row.name}`;
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = {
                key, type: row.type, name: row.name, q: 0, count: 0, collapsed
            };
            buckets.set(key, bucket);
        }
        bucket.q += qNum;
        bucket.count += 1;
    });
    return [...buckets.values()];
}

function _chartOperatingQ(bucket) {
    // Use the solved load-flow Q. A shunt reactor at 208 Mvar is plotted at 208,
    // the same value as the result on the diagram.
    return bucket.q;
}

function _operatingWords(bucket) {
    const q = Number(bucket.q);
    if (bucket.type === 'Shunt reactor') {
        return q >= 0 ? 'inductive (underexcited)' : 'capacitive (overexcited)';
    }
    return q >= 0 ? 'capacitive (overexcited)' : 'inductive (underexcited)';
}

function _contributionLabel(bucket) {
    if (bucket.collapsed) return `${bucket.type} ×${bucket.count} total`;
    if (bucket.count > 1) return `${bucket.name} ×${bucket.count} total`;
    return bucket.name || bucket.type;
}

function _contributionSentence(bucket, magText, unit) {
    const qOp = _chartOperatingQ(bucket);
    const word = _operatingWords(bucket);
    const label = _contributionLabel(bucket);
    const mag = magText(Math.abs(qOp));
    if (bucket.count > 1) {
        return `${label}: operating Q ${mag} ${unit} ${word} (${magText(Math.abs(qOp) / bucket.count)} ${unit} on each unit).`;
    }
    return `${label}: operating Q ${mag} ${unit} ${word}.`;
}

function _voltageKeyVariants(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return [String(v)];
    return [n.toFixed(4), String(n), String(parseFloat(v)), n.toFixed(1), n.toFixed(2), n.toFixed(3)];
}

function _lookupVoltageMap(map, v) {
    if (!map || typeof map !== 'object') return undefined;
    for (const k of _voltageKeyVariants(v)) {
        if (Object.prototype.hasOwnProperty.call(map, k) && map[k] != null) return map[k];
    }
    const target = Number(v);
    if (!Number.isFinite(target)) return undefined;
    for (const [k, val] of Object.entries(map)) {
        if (Math.abs(Number(k) - target) < 1e-6) return val;
    }
    return undefined;
}

function _hasPqReqPoints(req) {
    return !!(req && Array.isArray(req.p_mw) && req.p_mw.length > 0);
}

function _firstPqRequirement(map) {
    if (!map || typeof map !== 'object') return null;
    for (const val of Object.values(map)) {
        if (_hasPqReqPoints(val)) return val;
    }
    return null;
}

function _interpPqQ(x, xs, ys) {
    const pairs = [];
    const n = Math.min((xs || []).length, (ys || []).length);
    for (let i = 0; i < n; i++) {
        if (ys[i] == null || Number.isNaN(Number(ys[i]))) continue;
        const xf = Number(xs[i]);
        const yf = Number(ys[i]);
        if (!Number.isFinite(xf) || !Number.isFinite(yf)) continue;
        pairs.push({ x: xf, y: yf });
    }
    if (!pairs.length) return null;
    pairs.sort((a, b) => a.x - b.x);
    if (pairs.length === 1) return pairs[0].y;
    if (x <= pairs[0].x) return pairs[0].y;
    if (x >= pairs[pairs.length - 1].x) return pairs[pairs.length - 1].y;
    for (let i = 0; i < pairs.length - 1; i++) {
        if (x >= pairs[i].x && x <= pairs[i + 1].x) {
            const span = pairs[i + 1].x - pairs[i].x;
            const t = span === 0 ? 0 : (x - pairs[i].x) / span;
            return pairs[i].y + t * (pairs[i + 1].y - pairs[i].y);
        }
    }
    return pairs[pairs.length - 1].y;
}

/** Interpolate Q; null if P is outside the measured PCC P span (no clip to Pn). */
function _interpPqQInSpan(x, xs, ys, pTol = 1e-3) {
    const pairs = [];
    const n = Math.min((xs || []).length, (ys || []).length);
    for (let i = 0; i < n; i++) {
        if (ys[i] == null || Number.isNaN(Number(ys[i]))) continue;
        const xf = Number(xs[i]);
        const yf = Number(ys[i]);
        if (!Number.isFinite(xf) || !Number.isFinite(yf)) continue;
        pairs.push({ x: xf, y: yf });
    }
    if (!pairs.length) return null;
    pairs.sort((a, b) => a.x - b.x);
    const lo = pairs[0].x;
    const hi = pairs[pairs.length - 1].x;
    if (x < lo - pTol || x > hi + pTol) return null;
    return _interpPqQ(Math.min(Math.max(x, lo), hi), xs, ys);
}

/** Capability must cover required Qmax/Qmin over the P-Q envelope. true / false / null. */
function _computePqCompliance(curve, req, tolMvar = 1e-4) {
    if (!_hasPqReqPoints(req) || !curve) return null;
    const reqP = req.p_mw || [];
    const reqMax = req.q_req_max_mvar || [];
    const reqMin = req.q_req_min_mvar || [];
    const n = Math.min(reqP.length, reqMax.length, reqMin.length);
    if (n < 1) return null;
    const capPMax = curve.p_max_mw || curve.p_mw || [];
    const capPMin = curve.p_min_mw || curve.p_mw || [];
    const capMax = curve.q_max_mvar || [];
    const capMin = curve.q_min_mvar || [];
    if (!capPMax.length && !capPMin.length) return null;

    const pCheck = new Set();
    for (let i = 0; i < n; i++) {
        const pf = Number(reqP[i]);
        if (Number.isFinite(pf)) pCheck.add(pf);
    }
    const reqPs = [...pCheck].sort((a, b) => a - b);
    if (!reqPs.length) return null;
    const pLo = reqPs[0];
    const pHi = reqPs[reqPs.length - 1];
    [...capPMax, ...capPMin].forEach((p) => {
        const pf = Number(p);
        if (Number.isFinite(pf) && pf >= pLo && pf <= pHi) pCheck.add(pf);
    });

    for (const pS of [...pCheck].sort((a, b) => a - b)) {
        const reqMaxV = _interpPqQ(pS, reqP, reqMax);
        const reqMinV = _interpPqQ(pS, reqP, reqMin);
        const capMaxV = _interpPqQInSpan(pS, capPMax, capMax);
        const capMinV = _interpPqQInSpan(pS, capPMin, capMin);
        if (reqMaxV == null || reqMinV == null || capMaxV == null || capMinV == null) return false;
        if (capMaxV < reqMaxV - tolMvar || capMinV > reqMinV + tolMvar) return false;
    }
    return true;
}

function _maxAbsP(arr) {
    let best = 0;
    (arr || []).forEach((p) => {
        const a = Math.abs(Number(p));
        if (Number.isFinite(a) && a > best) best = a;
    });
    return best > 0 ? best : null;
}

function _pmaxPccFromCurve(curve) {
    if (!curve) return 0;
    const a = _maxAbsP(curve.p_max_mw || curve.p_mw);
    const b = _maxAbsP(curve.p_min_mw || curve.p_mw);
    if (a == null) return b || 0;
    if (b == null) return a;
    return Math.min(a, b);
}

function _pmaxPccFromCurves(data) {
    const overall = Number(data && data.pmax_pcc_mw);
    if (Number.isFinite(overall) && overall > 0) return overall;
    let best = 0;
    Object.values((data && data.curves) || {}).forEach((curve) => {
        const v = _pmaxPccFromCurve(curve);
        if (v > best) best = v;
    });
    return best;
}

function _scalePqRequirement(req, k) {
    if (!_hasPqReqPoints(req) || !(k > 0)) return req;
    return {
        p_mw: (req.p_mw || []).map((p) => +(Number(p) * k).toFixed(4)),
        q_req_max_mvar: (req.q_req_max_mvar || []).map((q) => (
            q == null || Number.isNaN(Number(q)) ? q : +(Number(q) * k).toFixed(4)
        )),
        q_req_min_mvar: (req.q_req_min_mvar || []).map((q) => (
            q == null || Number.isNaN(Number(q)) ? q : +(Number(q) * k).toFixed(4)
        ))
    };
}

function _attachPqRequirementOverlay(data) {
    if (!data) return;
    const pn = Number(data.pn_mw) || Number(data.total_installed_mw) || 0;
    const pmaxPcc = _pmaxPccFromCurves(data);
    const puBase = pmaxPcc > 0 ? pmaxPcc : pn;
    let key = data.grid_code_template_key;
    if (!key || key === 'none') {
        key = findGridTemplateKeyByName(data.grid_code_template_name) || key;
    }

    const alreadyPcc = data.requirements_base === 'pcc_pmax';
    if (data.requirements && typeof data.requirements === 'object' && !alreadyPcc && pn > 0) {
        const keys = (data.voltage_levels || []).length
            ? data.voltage_levels
            : Object.keys(data.requirements);
        keys.forEach((v) => {
            const curve = _lookupVoltageMap(data.curves, v);
            const pm = _pmaxPccFromCurve(curve);
            if (!(pm > 0)) return;
            const vReq = _lookupVoltageMap(data.requirements, v);
            if (!_hasPqReqPoints(vReq)) return;
            data.requirements[Number(v).toFixed(4)] = _scalePqRequirement(vReq, pm / pn);
        });
    }

    let req = _firstPqRequirement(data.requirements);
    if (!_hasPqReqPoints(req) && key && key !== 'none' && key !== 'custom_manual' && puBase > 0) {
        const rows = getGridTemplateRequirementsMw(key, puBase);
        if (rows.length) {
            const env = {
                p_mw: rows.map((r) => r.p),
                q_req_max_mvar: rows.map((r) => r.qMax),
                q_req_min_mvar: rows.map((r) => r.qMin)
            };
            data.requirements = data.requirements || {};
            (data.voltage_levels || []).forEach((v) => {
                data.requirements[Number(v).toFixed(4)] = env;
            });
            req = env;
            if (!data.grid_code_template_key) data.grid_code_template_key = key;
            if (!data.grid_code_template_name) data.grid_code_template_name = getGridTemplateDisplayName(key);
        }
    }
    data._pqReqFallback = _hasPqReqPoints(req) ? req : null;
    if (pmaxPcc > 0 && !(Number(data.pmax_pcc_mw) > 0)) data.pmax_pcc_mw = +pmaxPcc.toFixed(4);
    if (_hasPqReqPoints(req) && (pmaxPcc > 0 || alreadyPcc)) data.requirements_base = 'pcc_pmax';

    data.compliance = data.compliance || {};
    (data.voltage_levels || []).forEach((v) => {
        const vKey = Number(v).toFixed(4);
        const curve = _lookupVoltageMap(data.curves, v);
        const vReq = _lookupVoltageMap(data.requirements, v) || data._pqReqFallback;
        const flag = _computePqCompliance(curve, vReq);
        if (flag === true || flag === false) data.compliance[vKey] = flag;
        else if (data.compliance[vKey] !== true && data.compliance[vKey] !== false) {
            data.compliance[vKey] = flag;
        }
    });

    const flags = (data.voltage_levels || []).map((v) => _lookupVoltageMap(data.compliance, v));
    if (flags.some((f) => f === false)) data.pq_compliance = false;
    else if (flags.length && flags.every((f) => f === true)) data.pq_compliance = true;
    else data.pq_compliance = null;

    const hasReq = !!data._pqReqFallback;
    data.pcc_q_convention = hasReq
        ? 'Red: plant P-Q capability at the PCC. Blue: grid-code required envelope in p.u. of Pmax at the PCC (net P after collector and transformer losses, not generator Pn). The plant is compliant when the red area fully covers the blue area.'
        : 'Red: plant P-Q capability at the PCC (P and Q from the load flow at the point of connection, including collector and transformer losses). No grid-code requirement was selected, so compliance is not assessed. Choose a Grid Code Template and run again to overlay the required envelope.';
}

export class GridCodePqResultsDialog extends RPCResultsDialog {
    constructor(editorUi) {
        super(editorUi);
        this._plotPuP = false;
        this._plotPuQ = false;
        this._plotLoadOriented = false;
        this._pn = 0;
        this._pqChartSpecs = [];
        this._pqRedrawGen = 0;
        this._unitMwBtn = null;
        this._unitPuBtn = null;
        this._signGenBtn = null;
        this._signLoadBtn = null;
        this._pqMaximized = false;
        this._pqDialogEl = null;
        this._pqMaxBtn = null;
        this._showElementQ = false;
        this._elementQOffBtn = null;
        this._elementQOnBtn = null;
    }

    show(results) {
        const data = results && (results.grid_code_pq_results || results.rpc_results);
        if (!data) {
            alert('No P-Q results to display.');
            return;
        }
        this.pointLoadflows = data.point_loadflows || {};
        this._pn = Number(data.pn_mw || data.total_installed_mw) || 0;
        this._plotPuP = false;
        this._plotPuQ = false;
        this._plotLoadOriented = false;
        this._pqMaximized = false;
        this._showElementQ = false;
        this._pqChartSpecs = [];
        _attachPqRequirementOverlay(data);
        if (Number(data.pmax_pcc_mw) > 0) this._pn = Number(data.pmax_pcc_mw);
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
        titleText.textContent = 'Grid Code Compliance — P-Q';
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
        closeBtn.textContent = '\u00d7';
        Object.assign(closeBtn.style, {
            border: 'none', background: 'transparent', fontSize: '22px',
            cursor: 'pointer', color: '#6c757d', fontWeight: '700'
        });
        closeBtn.onclick = () => this.destroy();
        titleActions.appendChild(closeBtn);
        titleBar.appendChild(titleActions);
        dialog.appendChild(titleBar);
        this._pqDialogEl = dialog;

        dialog.appendChild(this._createComplianceBanner(data));
        dialog.appendChild(this._createSummaryBar(data));
        dialog.appendChild(this._createUnitToggle());

        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1 1 auto', overflowY: 'auto', padding: '20px 24px'
        });

        const voltageLevels = data.voltage_levels || [];
        if (voltageLevels.length === 0) {
            content.textContent = 'No voltage levels in results.';
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

                const curveData = data.curves ? (_lookupVoltageMap(data.curves, v) || data.curves[vKey]) : null;
                if (curveData) {
                    const complianceVal = data.compliance
                        ? (_lookupVoltageMap(data.compliance, v) ?? data.compliance[vKey] ?? null)
                        : null;
                    const reqData = (data.requirements && (_lookupVoltageMap(data.requirements, v) || data.requirements[vKey]))
                        || data._pqReqFallback
                        || null;
                    this._buildChartPanel(panel, curveData, reqData, complianceVal, v, data);
                } else {
                    panel.textContent = `No data for voltage level ${v} pu (key: ${vKey})`;
                }

                tab.onclick = () => {
                    tabsHeader.querySelectorAll('div').forEach((t) => {
                        t.style.borderBottomColor = 'transparent';
                        t.style.color = '#6c757d';
                        t.style.fontWeight = '400';
                        t.style.backgroundColor = 'transparent';
                    });
                    tab.style.borderBottomColor = '#007bff';
                    tab.style.color = '#007bff';
                    tab.style.fontWeight = '600';
                    tab.style.backgroundColor = '#f0f7ff';
                    tabPanels.forEach((p) => { p.style.display = 'none'; });
                    panel.style.display = 'block';
                };

                tabsHeader.appendChild(tab);
                tabPanels.push(panel);
            });

            content.appendChild(tabsHeader);
            tabPanels.forEach((p) => content.appendChild(p));
            this._redrawPqCharts();
        }

        content.appendChild(this._createPlantSummary(data));

        if (data.i_output && data.output_table && data.output_table.length) {
            content.appendChild(this._createOutputTable(data));
        }

        if (data.pq0) {
            content.appendChild(this._createPq0Section(data.pq0));
        }

        const warnings = this._warningsExcludingPq0(data.warnings);
        if (warnings.length > 0) {
            content.appendChild(this._createWarningsSection(warnings));
        }

        dialog.appendChild(content);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, {
            padding: '12px 24px', borderTop: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
        });
        const imageBtn = this._styledButton('Save image', '#0d6efd', '#0b5ed7');
        imageBtn.onclick = () => this._saveChartImage();
        footerBar.appendChild(imageBtn);

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

    _createComplianceBanner(data) {
        const banner = document.createElement('div');
        const hasReq = !!data._pqReqFallback;
        const ok = data.pq_compliance;
        let bg = '#fff3cd';
        let border = '#ffc107';
        let color = '#856404';
        let text = 'Compliance not assessed — no grid-code requirement was selected. Choose a Grid Code Template and run again.';
        if (hasReq && ok === true) {
            bg = '#d4edda';
            border = '#c3e6cb';
            color = '#155724';
            text = 'COMPLIANT — plant P-Q capability covers the required envelope at every voltage level.';
        } else if (hasReq && ok === false) {
            bg = '#f8d7da';
            border = '#f5c6cb';
            color = '#721c24';
            text = 'NON-COMPLIANT — plant P-Q capability does not cover the required envelope at one or more voltage levels.';
        } else if (hasReq && ok == null) {
            text = 'Grid-code requirement is shown (blue). Compliance could not be computed for every voltage level — check the tab badges.';
        }
        Object.assign(banner.style, {
            padding: '10px 24px', fontSize: '14px', fontWeight: '700', letterSpacing: '0.01em',
            backgroundColor: bg, color, borderBottom: `1px solid ${border}`
        });
        if (data.grid_code_template_name && hasReq) {
            banner.textContent = `${text} (${data.grid_code_template_name})`;
        } else {
            banner.textContent = text;
        }
        return banner;
    }

    _createUnitToggle() {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '8px 24px', backgroundColor: '#fff', borderBottom: '1px solid #e9ecef',
            display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontSize: '13px'
        });

        const addGroup = (title, ...btns) => {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const label = document.createElement('span');
            label.textContent = title;
            Object.assign(label.style, { fontWeight: '600', color: '#495057' });
            wrap.appendChild(label);
            const group = document.createElement('div');
            Object.assign(group.style, {
                display: 'inline-flex', border: '1px solid #ced4da', borderRadius: '6px', overflow: 'hidden'
            });
            btns.forEach((b) => group.appendChild(b));
            wrap.appendChild(group);
            bar.appendChild(wrap);
        };

        const makeBtn = (text, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            Object.assign(btn.style, {
                padding: '5px 12px', border: 'none', fontSize: '13px', cursor: 'pointer',
                backgroundColor: '#fff', color: '#495057', fontWeight: '500'
            });
            btn.onclick = onClick;
            return btn;
        };

        this._unitMwBtn = makeBtn('MW / Mvar', () => this._setPlotUnits(false));
        this._unitPuBtn = makeBtn('p.u. of Pmax', () => this._setPlotUnits(true));
        if (this._pn > 0) {
            this._unitPuBtn.title = 'Per-unit of Pmax at the PCC (net active power after plant losses).';
        }
        if (!(this._pn > 0)) {
            this._unitPuBtn.disabled = true;
            this._unitPuBtn.title = 'Pmax at the PCC is zero; p.u. scaling is not available.';
            this._unitPuBtn.style.cursor = 'not-allowed';
            this._unitPuBtn.style.opacity = '0.55';
        }
        addGroup('Chart units', this._unitMwBtn, this._unitPuBtn);

        this._signGenBtn = makeBtn('Generator (+P export)', () => this._setPlotSign(false));
        this._signLoadBtn = makeBtn('Load (+P import)', () => this._setPlotSign(true));
        addGroup('Sign convention', this._signGenBtn, this._signLoadBtn);

        this._elementQOffBtn = makeBtn('Off', () => this._setShowElementQ(false));
        this._elementQOnBtn = makeBtn('On', () => this._setShowElementQ(true));
        this._elementQOffBtn.title = 'Capability curve only.';
        this._elementQOnBtn.title = 'Mark each group’s operating reactive power from the selected load flow.';
        addGroup('Element Q', this._elementQOffBtn, this._elementQOnBtn);

        this._syncUnitToggleStyle();
        return bar;
    }

    _syncUnitToggleStyle() {
        const apply = (btn, active) => {
            if (!btn) return;
            btn.style.backgroundColor = active ? '#007bff' : '#fff';
            btn.style.color = active ? '#fff' : '#495057';
            btn.style.fontWeight = active ? '600' : '500';
        };
        const pu = this._plotPuP || this._plotPuQ;
        apply(this._unitMwBtn, !pu);
        apply(this._unitPuBtn, pu);
        apply(this._signGenBtn, !this._plotLoadOriented);
        apply(this._signLoadBtn, this._plotLoadOriented);
        apply(this._elementQOffBtn, !this._showElementQ);
        apply(this._elementQOnBtn, this._showElementQ);
    }

    _setShowElementQ(show) {
        if (this._showElementQ === show) return;
        this._showElementQ = show;
        this._syncUnitToggleStyle();
        (this._pqChartSpecs || []).forEach((spec) => {
            if (spec.panel?._pqClickHint) spec.panel._pqClickHint.textContent = this._pqClickHintText();
        });
        this._refreshAllElementQTables();
        (this._pqChartSpecs || []).forEach((spec) => this._refreshElementMarkers(spec.panel));
    }

    _pqClickHintText() {
        if (this._showElementQ) {
            return 'Element Q is on. Markers are the operating reactive power from the load flow of the red point you select, not the available capability. Click a red point to show that load flow on the diagram.';
        }
        return 'Click a red capability point to show that load flow on the diagram. Q max is overexcited (capacitive). Q min is underexcited (inductive). Turn on Element Q to draw each group’s total on the chart.';
    }

    _setPlotUnits(usePu) {
        if (usePu && !(this._pn > 0)) return;
        if (this._plotPuP === usePu && this._plotPuQ === usePu) return;
        this._plotPuP = usePu;
        this._plotPuQ = usePu;
        this._syncUnitToggleStyle();
        this._redrawPqCharts();
    }

    _setPlotSign(loadOriented) {
        if (this._plotLoadOriented === loadOriented) return;
        this._plotLoadOriented = loadOriented;
        this._syncUnitToggleStyle();
        this._redrawPqCharts();
    }

    _redrawPqCharts() {
        const gen = ++this._pqRedrawGen;
        (this.chartInstances || []).forEach((c) => { try { c.destroy(); } catch (e) { /* noop */ } });
        this.chartInstances = [];
        this._refreshAllElementQTables();
        this._loadChartJS().then(() => {
            if (gen !== this._pqRedrawGen) return;
            (this._pqChartSpecs || []).forEach((s) => {
                this._renderChart(s.canvas, s.curveData, s.reqData, s.voltageLevel, s.fullData, s.panel);
            });
        });
    }

    _buildChartPanel(panel, curveData, reqData, complianceVal, voltageLevel, fullData) {
        const vKey = String(parseFloat(voltageLevel).toFixed(4));
        panel.dataset.rpcVoltageKey = vKey;

        const clickHint = document.createElement('div');
        Object.assign(clickHint.style, {
            fontSize: '12px', color: '#6c757d', marginBottom: '10px', lineHeight: '1.45'
        });
        clickHint.textContent = this._pqClickHintText();
        panel._pqClickHint = clickHint;
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
        Object.assign(canvas.style, { width: '100%', height: '450px', maxHeight: '450px' });
        panel.appendChild(canvas);
        this._pqChartSpecs.push({ canvas, curveData, reqData, voltageLevel, fullData, panel });
        this._mountElementQSection(panel, curveData);
    }

    _createSummaryBar(data) {
        const bar = super._createSummaryBar(data);
        const extra = [];
        if (Number(data.pmax_pcc_mw) > 0) {
            extra.push(['Pmax at PCC', `${Number(data.pmax_pcc_mw).toFixed(2)} MW`]);
        }
        if (data.q_dispatch_mode === 'local' || data.i_park_ctrl === false) {
            extra.push(['Q dispatch', 'Local Q on each static generator / wind turbine']);
            if (data.park_controller_name) {
                extra.push(['Park Controller', data.park_controller_name + ' (not used)']);
            }
        } else if (data.park_controller_name) {
            extra.push(['Q dispatch', 'Park Controller — constant Q at PoC']);
            extra.push(['Park Controller', data.park_controller_name + ' (active)']);
        } else if (data.i_park_ctrl) {
            extra.push(['Q dispatch', 'Park Controller']);
        }
        if (data.load_flow_count != null) {
            const seconds = Number(data.elapsed_s);
            const timing = Number.isFinite(seconds) && seconds > 0 ? ` in ${seconds.toFixed(0)} s` : '';
            extra.push(['Load flows', `${data.load_flow_count}${timing}`]);
        }
        if (data.pq_compliance === true) extra.push(['P-Q compliance', 'COMPLIANT']);
        else if (data.pq_compliance === false) extra.push(['P-Q compliance', 'NON-COMPLIANT']);
        else extra.push(['P-Q compliance', 'Not assessed']);
        extra.forEach(([label, val]) => {
            const span = document.createElement('span');
            span.innerHTML = `<strong>${label}:</strong> ${val}`;
            bar.appendChild(span);
        });
        return bar;
    }

    _createPlantSummary(data) {
        const s = data.summary || {};
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            marginTop: '18px', padding: '12px 14px', backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef', borderRadius: '6px', fontSize: '13px'
        });
        const title = document.createElement('div');
        title.textContent = 'Study summary (worst-case over the sweep)';
        Object.assign(title.style, { fontWeight: '600', marginBottom: '8px', color: '#343a40' });
        wrap.appendChild(title);

        const rows = [
            ['Maximum of max. cable loading', `${_fmt(s.maxloading_cbl)} %`],
            ['Maximum of max. transformer loading', `${_fmt(s.maxloading_trf)} %`],
            ['Maximum of max. voltage inside plant', `${_fmt(s.umax_tot)} p.u.`],
            ['Minimum of min. voltage inside plant', `${_fmt(s.umin_tot)} p.u.`],
            ['Maximum of max. voltage at generation unit terminals', `${_fmt(s.ugenmax_tot)} p.u.`],
            ['Minimum of min. voltage at generation unit terminals', `${_fmt(s.ugenmin_tot)} p.u.`],
            ['Maximum of max. voltage at shunt terminal', `${_fmt(s.ushntmax_tot)} p.u.`],
            ['Minimum of min. voltage at shunt terminal', `${_fmt(s.ushntmin_tot)} p.u.`],
            ['Transformer tap max', _fmt(s.trf_tap_max, 1)],
            ['Transformer tap min', _fmt(s.trf_tap_min, 1)]
        ];
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '13px' });
        rows.forEach(([k, v]) => {
            const tr = document.createElement('tr');
            const td1 = document.createElement('td');
            td1.textContent = k;
            Object.assign(td1.style, { padding: '3px 8px 3px 0', color: '#495057' });
            const td2 = document.createElement('td');
            td2.textContent = v;
            Object.assign(td2.style, { padding: '3px 0', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' });
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
        });
        wrap.appendChild(table);
        return wrap;
    }

    _createOutputTable(data) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, { marginTop: '16px', overflowX: 'auto' });
        const title = document.createElement('div');
        title.textContent = 'Reactive power capability at 10% steps of Pn (P at PCC)';
        Object.assign(title.style, { fontWeight: '600', marginBottom: '8px', fontSize: '13px' });
        wrap.appendChild(title);
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });
        const head = document.createElement('tr');
        ['U (p.u.)', 'P at PCC (MW)', 'P (p.u.)', 'Q_max (Mvar)', 'Q_min (Mvar)', 'cosφ over', 'cosφ under'].forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                padding: '4px 6px', borderBottom: '1px solid #dee2e6', textAlign: 'left', fontWeight: '600'
            });
            head.appendChild(th);
        });
        table.appendChild(head);
        data.output_table.forEach((row) => {
            const tr = document.createElement('tr');
            [
                _fmt(row.u_pu, 4), _fmt(row.p_mw, 2), _fmt(row.p_pu, 2),
                _fmt(row.q_max_mvar, 2), _fmt(row.q_min_mvar, 2),
                _fmt(row.cosphi_over, 3), _fmt(row.cosphi_under, 3)
            ].forEach((t) => {
                const td = document.createElement('td');
                td.textContent = t;
                Object.assign(td.style, { padding: '3px 6px', borderBottom: '1px solid #f1f3f5' });
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        wrap.appendChild(table);
        return wrap;
    }

    _warningsExcludingPq0(warnings) {
        return (warnings || []).filter((w) => !/units not operating/i.test(String(w)));
    }

    _createPq0Section(pq0) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            marginTop: '16px', padding: '10px 12px', backgroundColor: '#e8f4fd',
            border: '1px solid #b8daff', borderRadius: '6px', fontSize: '13px', color: '#004085',
            lineHeight: '1.5'
        });
        const title = document.createElement('div');
        title.textContent = 'Point of connection with plant units off';
        Object.assign(title.style, { fontWeight: '700', marginBottom: '6px' });
        wrap.appendChild(title);

        const values = document.createElement('div');
        values.textContent =
            `Residual exchange at the PCC: P = ${_fmt(pq0.p_mw, 3)} MW, Q = ${_fmt(pq0.q_mvar, 3)} Mvar.`;
        wrap.appendChild(values);

        const hint = document.createElement('div');
        Object.assign(hint.style, { marginTop: '6px', fontSize: '12px', color: '#0d47a1' });
        hint.textContent =
            'This is a separate load flow with the selected units at P = Q = 0. Residual P and Q come from the rest of the network (loads, cables, shunts). It is not the P = 0 point on the red capability envelope — those Qmin/Qmax values are plant reactive capability while the units are still supplying Q.';
        wrap.appendChild(hint);
        return wrap;
    }

    _cellLookup() {
        const graph = this.ui?.editor?.graph;
        if (!graph) return null;
        if (this._cellLookupMap && this._cellLookupGraph === graph) return this._cellLookupMap;
        this._cellLookupGraph = graph;
        this._cellLookupMap = buildGraphCellLookupMap(graph);
        return this._cellLookupMap;
    }

    _cellForResultRow(row) {
        const graph = this.ui?.editor?.graph;
        const map = this._cellLookup();
        if (!graph || !map || !row) return null;
        return resolveGraphCellForResult(map, row, graph);
    }

    _elementDisplayName(row, typeLabel, cell) {
        if (cell) return getDisplayName(cell, row?.name, typeLabel);
        const raw = row?.name != null ? String(row.name) : '';
        if (raw && !looksLikeInternalGraphObjectId(raw)) return raw.replace(/_/g, '#');
        return typeLabel;
    }

    _elementRowsFromSnapshot(lf) {
        if (!lf) return [];
        const rows = [];
        PQ_Q_ELEMENT_SOURCES.forEach((src) => {
            const list = lf[src.key];
            if (!Array.isArray(list)) return;
            list.forEach((item) => {
                const cell = this._cellForResultRow(item);
                let type = src.type;
                if (src.wind && String(cell?.style || '').includes('shapeELXXX=Wind Turbine')) {
                    type = 'Wind turbine';
                }
                const pMw = item?.p_mw;
                const qMvar = item?.q_mvar;
                const pNum = (pMw == null || pMw === '') ? NaN : Number(pMw);
                const qNum = (qMvar == null || qMvar === '') ? NaN : Number(qMvar);
                rows.push({
                    name: this._elementDisplayName(item, type, cell),
                    type,
                    pMw,
                    qMvar,
                    pScaled: Number.isFinite(pNum) ? this._scaleP(pNum) : NaN,
                    qScaled: Number.isFinite(qNum) ? this._scaleQ(qNum) : NaN
                });
            });
        });
        rows.sort((a, b) => {
            const ia = PQ_Q_TYPE_ORDER.indexOf(a.type);
            const ib = PQ_Q_TYPE_ORDER.indexOf(b.type);
            if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
        });
        return rows;
    }

    _resolveEnvelopeSnapshot(vKey, side, pPlot, pDispatch) {
        let lf = this._resolvePointLoadflow(vKey, side, pPlot);
        let pKey = pPlot;
        if (!lf && pDispatch != null) {
            lf = this._resolvePointLoadflow(vKey, side, pDispatch);
            pKey = pDispatch;
        }
        return { lf, pKey };
    }

    _defaultElementSelection(vKey, curveData) {
        const pick = (side) => {
            const pArr = side === 'q_min'
                ? (curveData.p_min_mw || curveData.p_mw || [])
                : (curveData.p_max_mw || curveData.p_mw || []);
            const qArr = side === 'q_min' ? (curveData.q_min_mvar || []) : (curveData.q_max_mvar || []);
            const pDisp = curveData.p_dispatch_mw || [];
            for (let i = pArr.length - 1; i >= 0; i--) {
                const resolved = this._resolveEnvelopeSnapshot(vKey, side, pArr[i], pDisp[i]);
                if (!resolved.lf) continue;
                return {
                    side,
                    pKey: resolved.pKey,
                    pPcc: pArr[i],
                    qPcc: qArr[i]
                };
            }
            return null;
        };
        return pick('q_max') || pick('q_min');
    }

    _pqPowerUnits() {
        return {
            p: this._plotPuP ? 'p.u.' : 'MW',
            q: this._plotPuQ ? 'p.u.' : 'Mvar'
        };
    }

    _elementQStatusText(sel) {
        if (!sel) return '';
        const units = this._pqPowerUnits();
        return `Element reactive power — ${_pqSideLabel(sel.side)}: P = ${_fmt(this._scaleP(sel.pPcc))} ${units.p}, Q = ${_fmt(this._scaleQ(sel.qPcc))} ${units.q}`;
    }

    _mountElementQSection(panel, curveData) {
        const section = document.createElement('div');
        Object.assign(section.style, { marginTop: '16px' });
        panel._elementQSection = section;
        panel._pqCurveData = curveData;
        panel.appendChild(section);
        panel._elementQSelection = this._defaultElementSelection(panel.dataset.rpcVoltageKey, curveData);
        this._refreshElementQTable(panel);
    }

    _refreshAllElementQTables() {
        (this._pqChartSpecs || []).forEach((s) => this._refreshElementQTable(s.panel));
    }

    _selectElementQPoint(panel, selection) {
        panel._elementQSelection = selection;
        this._refreshElementQTable(panel);
        this._refreshElementMarkers(panel);
    }

    _togglePqMaximize() {
        this._pqMaximized = !this._pqMaximized;
        this._applyPqDialogSize();
    }

    _applyPqDialogSize() {
        const dialog = this._pqDialogEl;
        if (!dialog) return;
        if (this._pqMaximized) {
            Object.assign(dialog.style, {
                width: '98vw', height: '96vh', maxWidth: '98vw', maxHeight: '96vh', borderRadius: '6px'
            });
        } else {
            Object.assign(dialog.style, {
                width: '920px', height: '', maxWidth: '95vw', maxHeight: '90vh', borderRadius: '10px'
            });
        }
        const chartH = this._pqMaximized ? '56vh' : '450px';
        (this._pqChartSpecs || []).forEach((spec) => {
            spec.canvas.style.height = chartH;
            spec.canvas.style.maxHeight = chartH;
        });
        if (this._pqMaxBtn) this._pqMaxBtn.textContent = this._pqMaximized ? 'Restore' : 'Maximize';
        requestAnimationFrame(() => {
            (this.chartInstances || []).forEach((chart) => {
                try { chart.resize(); } catch (e) { /* chart already destroyed */ }
            });
        });
    }

    _visiblePqPanel() {
        const specs = this._pqChartSpecs || [];
        const visible = specs.find((spec) => spec.panel && spec.panel.style.display !== 'none');
        return (visible || specs[0] || {}).panel || null;
    }

    _contributionModel(panel) {
        if (panel._contributionModel) return panel._contributionModel;
        const curve = panel._pqCurveData || {};
        const vKey = panel.dataset.rpcVoltageKey;
        const samples = [];
        [
            { side: 'q_max', pKey: 'p_max_mw', qKey: 'q_max_mvar' },
            { side: 'q_min', pKey: 'p_min_mw', qKey: 'q_min_mvar' }
        ].forEach(({ side, pKey, qKey }) => {
            const pArr = curve[pKey] || curve.p_mw || [];
            const qArr = curve[qKey] || [];
            const pDisp = curve.p_dispatch_mw || [];
            const seen = new Set();
            for (let i = 0; i < pArr.length; i++) {
                const resolved = this._resolveEnvelopeSnapshot(vKey, side, pArr[i], pDisp[i]);
                if (!resolved.lf) continue;
                const dedupe = `${side}|${resolved.pKey}`;
                if (seen.has(dedupe)) continue;
                seen.add(dedupe);
                samples.push({
                    side,
                    p: Number(pArr[i]),
                    qPcc: qArr[i] == null ? null : Number(qArr[i]),
                    rows: this._elementRowsFromSnapshot(resolved.lf)
                });
            }
        });
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
                        key: bucket.key,
                        type: bucket.type,
                        name: bucket.name,
                        collapsed: bucket.collapsed,
                        count: bucket.count,
                        q_max: [],
                        q_min: []
                    });
                }
                const track = tracks.get(bucket.key);
                track.count = Math.max(track.count, bucket.count);
                track[sample.side].push({ p: sample.p, q: bucket.q });
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

    _selectedContributionLines(panel) {
        const sel = panel?._elementQSelection;
        const units = this._pqPowerUnits();
        if (!sel) return ['Click a red point to read how each group contributes at that active power.'];
        const model = this._contributionModel(panel);
        const lf = this._resolvePointLoadflow(panel.dataset.rpcVoltageKey, sel.side, sel.pKey);
        const lines = [
            `${_pqSideLabel(sel.side)} at PCC P = ${_fmt(this._scaleP(sel.pPcc))} ${units.p}. Plant Q at the PCC is ${_fmt(this._scaleQ(sel.qPcc))} ${units.q}.`
        ];
        if (!lf) {
            lines.push('No stored load flow for this point.');
            return lines;
        }
        const buckets = _aggregateContribution(this._elementRowsFromSnapshot(lf), model.collapseTypes);
        buckets.sort((a, b) => {
            const ia = PQ_Q_TYPE_ORDER.indexOf(a.type);
            const ib = PQ_Q_TYPE_ORDER.indexOf(b.type);
            if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
        });
        const magText = (q) => {
            let v = Math.abs(Number(q));
            if (this._plotPuQ && this._pn > 0) v /= this._pn;
            return _fmt(v);
        };
        buckets.forEach((bucket) => lines.push(_contributionSentence(bucket, magText, units.q)));
        if (!buckets.length) lines.push('No reactive elements in this load flow.');
        lines.push('Markers use the operating Q from this load flow, with the same sign as the result on the diagram.');
        return lines;
    }

    _elementMarkerDatasets(panel) {
        if (!this._showElementQ) return [];
        const sel = panel._elementQSelection;
        if (!sel) return [];
        const lf = this._resolvePointLoadflow(panel.dataset.rpcVoltageKey, sel.side, sel.pKey);
        if (!lf) return [];
        const y = this._scaleP(sel.pPcc);
        if (!Number.isFinite(y)) return [];
        const model = this._contributionModel(panel);
        const colorByKey = new Map(model.tracks.map((track) => [track.key, track.color]));
        const buckets = _aggregateContribution(this._elementRowsFromSnapshot(lf), model.collapseTypes);
        return buckets.map((bucket) => {
            const operatingQ = _chartOperatingQ(bucket);
            const x = this._scaleQ(operatingQ);
            const word = _operatingWords(bucket);
            const label = _contributionLabel(bucket);
            let mag = Math.abs(operatingQ);
            if (this._plotPuQ && this._pn > 0) mag /= this._pn;
            const tip = `${label}: operating Q ${ _fmt(mag) } from this load flow, ${word}`;
            return {
                label: `${label} — ${word}`,
                _elementQ: true,
                _elementTip: tip,
                data: [{ x, y, _tip: tip }],
                showLine: false,
                pointRadius: 7,
                pointHoverRadius: 9,
                pointHitRadius: 12,
                pointStyle: 'rectRot',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                borderColor: colorByKey.get(bucket.key) || PQ_Q_TYPE_COLOR[bucket.type] || '#495057',
                backgroundColor: colorByKey.get(bucket.key) || PQ_Q_TYPE_COLOR[bucket.type] || '#495057',
                order: 2
            };
        });
    }

    _refreshElementMarkers(panel) {
        const chart = panel?._pqChart;
        if (!chart) return;
        chart.data.datasets = chart.data.datasets.filter((ds) => !ds._elementQ);
        this._elementMarkerDatasets(panel).forEach((ds) => chart.data.datasets.push(ds));
        chart.update();
    }

    _saveChartImage() {
        const panel = this._visiblePqPanel();
        const chart = panel?._pqChart;
        if (!chart) {
            alert('The P-Q diagram is not ready yet.');
            return;
        }
        const chartUrl = chart.toBase64Image('image/png', 1);
        const img = new Image();
        img.onload = () => {
            const source = this._selectedContributionLines(panel);
            const measure = document.createElement('canvas').getContext('2d');
            const maxW = Math.max(280, img.width - 48);
            const wrapped = [];
            source.forEach((line, i) => {
                measure.font = i === 0 ? '600 16px sans-serif' : '15px sans-serif';
                const words = String(line).split(' ');
                let cur = '';
                words.forEach((word) => {
                    const next = cur ? `${cur} ${word}` : word;
                    if (measure.measureText(next).width > maxW && cur) {
                        wrapped.push({ text: cur, head: i === 0 && wrapped.length === 0 });
                        cur = word;
                    } else {
                        cur = next;
                    }
                });
                if (cur) wrapped.push({ text: cur, head: i === 0 && !wrapped.some((row) => row.head) });
            });
            const lineH = 22;
            const footerH = 28 + wrapped.length * lineH + 12;
            const out = document.createElement('canvas');
            out.width = img.width;
            out.height = img.height + footerH;
            const ctx = out.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.drawImage(img, 0, 0);
            ctx.textBaseline = 'top';
            wrapped.forEach((row, i) => {
                ctx.font = row.head ? '600 16px sans-serif' : '15px sans-serif';
                ctx.fillStyle = row.head ? '#212529' : '#343a40';
                ctx.fillText(row.text, 24, img.height + 16 + i * lineH);
            });
            const a = document.createElement('a');
            a.href = out.toDataURL('image/png');
            a.download = `GridCode_PQ_diagram_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        img.src = chartUrl;
    }

    _showSelectedPointOnDiagram(panel) {
        const sel = panel?._elementQSelection;
        const vKey = panel?.dataset?.rpcVoltageKey;
        if (!sel || !vKey) return;
        this._onCapabilityPointClick(vKey, sel.side, sel.pKey, sel.qPcc, panel);
    }

    _refreshElementQTable(panel) {
        const section = panel?._elementQSection;
        if (!section) return;
        section.replaceChildren();

        const units = this._pqPowerUnits();
        const sel = panel._elementQSelection;
        const vKey = panel.dataset.rpcVoltageKey;
        const lf = sel ? this._resolvePointLoadflow(vKey, sel.side, sel.pKey) : null;

        const head = document.createElement('div');
        Object.assign(head.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: '12px', flexWrap: 'wrap', marginBottom: '6px'
        });
        const title = document.createElement('div');
        title.textContent = 'Reactive power by element';
        Object.assign(title.style, { fontWeight: '700', fontSize: '14px', color: '#212529' });
        head.appendChild(title);

        const showBtn = this._styledButton('Show on diagram', '#0d6efd', '#0b5ed7');
        Object.assign(showBtn.style, { padding: '6px 12px', fontSize: '12px' });
        showBtn.disabled = !lf;
        if (!lf) {
            showBtn.style.opacity = '0.55';
            showBtn.style.cursor = 'not-allowed';
        }
        showBtn.onclick = () => this._showSelectedPointOnDiagram(panel);
        head.appendChild(showBtn);
        section.appendChild(head);

        const subtitle = document.createElement('div');
        Object.assign(subtitle.style, { fontSize: '13px', color: '#343a40', marginBottom: '4px' });
        subtitle.textContent = sel
            ? this._elementQStatusText(sel)
            : 'No stored load flow for this voltage.';
        section.appendChild(subtitle);

        const hint = document.createElement('div');
        Object.assign(hint.style, { fontSize: '12px', color: '#6c757d', lineHeight: '1.45', marginBottom: '8px' });
        hint.textContent = 'Positive generator Q is overexcited (capacitive). Positive shunt-reactor Q is inductive absorption. Values follow the chart unit and sign toggles.';
        section.appendChild(hint);

        const explain = document.createElement('div');
        Object.assign(explain.style, {
            fontSize: '13px', color: '#212529', lineHeight: '1.5', marginBottom: '10px'
        });
        const contributionLines = this._selectedContributionLines(panel);
        contributionLines.forEach((line, i) => {
            const row = document.createElement('div');
            row.textContent = line;
            if (i === 0) row.style.fontWeight = '600';
            if (i === contributionLines.length - 1) {
                row.style.color = '#6c757d';
                row.style.fontSize = '12px';
                row.style.marginTop = '4px';
            }
            explain.appendChild(row);
        });
        section.appendChild(explain);

        if (panel._rpcPointStatusEl && sel) {
            panel._rpcPointStatusEl.style.display = 'block';
            panel._rpcPointStatusEl.textContent = `${this._elementQStatusText(sel)}. Click the red point to show this load flow on the diagram.`;
        }

        if (!lf) {
            const empty = document.createElement('div');
            empty.textContent = 'No stored load flow for this point. Re-run Grid Code Compliance (P-Q) to refresh point data.';
            Object.assign(empty.style, { fontSize: '13px', color: '#856404' });
            section.appendChild(empty);
            return;
        }

        const rows = this._elementRowsFromSnapshot(lf);
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.textContent = 'This load flow has no wind turbines, generators, shunts, capacitors, storage, or SVCs.';
            Object.assign(empty.style, { fontSize: '13px', color: '#495057' });
            section.appendChild(empty);
            return;
        }

        const thStyle = {
            padding: '4px 6px', borderBottom: '1px solid #dee2e6', textAlign: 'left',
            fontWeight: '600', fontSize: '12px', color: '#495057'
        };
        const tdStyle = { padding: '3px 6px', borderBottom: '1px solid #f1f3f5', fontSize: '12px' };
        const numStyle = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

        const makeTable = (headers) => {
            const table = document.createElement('table');
            Object.assign(table.style, { width: '100%', borderCollapse: 'collapse' });
            const hr = document.createElement('tr');
            headers.forEach((h, i) => {
                const th = document.createElement('th');
                th.textContent = h;
                Object.assign(th.style, thStyle);
                const numericFrom = headers[0] === 'Element' ? 2 : 1;
                if (i >= numericFrom) th.style.textAlign = 'right';
                hr.appendChild(th);
            });
            table.appendChild(hr);
            return table;
        };

        const byType = new Map();
        rows.forEach((row) => {
            if (!byType.has(row.type)) byType.set(row.type, { count: 0, p: 0, q: 0, pOk: false, qOk: false });
            const g = byType.get(row.type);
            g.count += 1;
            if (Number.isFinite(row.pScaled)) { g.p += row.pScaled; g.pOk = true; }
            if (Number.isFinite(row.qScaled)) { g.q += row.qScaled; g.qOk = true; }
        });

        const totals = makeTable(['Type', 'Count', `P (${units.p})`, `Q (${units.q})`]);
        PQ_Q_TYPE_ORDER.forEach((type) => {
            const g = byType.get(type);
            if (!g) return;
            const tr = document.createElement('tr');
            [type, String(g.count), g.pOk ? _fmt(g.p) : '—', g.qOk ? _fmt(g.q) : '—'].forEach((text, i) => {
                const td = document.createElement('td');
                td.textContent = text;
                Object.assign(td.style, i === 0 ? tdStyle : numStyle);
                if (i === 0) td.style.fontWeight = '600';
                tr.appendChild(td);
            });
            totals.appendChild(tr);
        });
        section.appendChild(totals);

        const scroller = document.createElement('div');
        Object.assign(scroller.style, { maxHeight: '280px', overflowY: 'auto', marginTop: '10px' });
        const detail = makeTable(['Element', 'Type', `P (${units.p})`, `Q (${units.q})`]);
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            [
                row.name,
                row.type,
                Number.isFinite(row.pScaled) ? _fmt(row.pScaled) : '—',
                Number.isFinite(row.qScaled) ? _fmt(row.qScaled) : '—'
            ].forEach((text, i) => {
                const td = document.createElement('td');
                td.textContent = text;
                Object.assign(td.style, i >= 2 ? numStyle : tdStyle);
                tr.appendChild(td);
            });
            detail.appendChild(tr);
        });
        scroller.appendChild(detail);
        section.appendChild(scroller);

        let sumQ = 0;
        let anyQ = false;
        rows.forEach((row) => {
            if (Number.isFinite(row.qScaled)) {
                sumQ += row.qScaled;
                anyQ = true;
            }
        });
        const pccQ = this._scaleQ(sel.qPcc);
        const footer = document.createElement('div');
        Object.assign(footer.style, { marginTop: '8px', fontSize: '12px', color: '#343a40', lineHeight: '1.45' });
        let text = `PCC Q: ${_fmt(pccQ)} ${units.q}. Sum of listed elements: ${_fmt(anyQ ? sumQ : null)} ${units.q}.`;
        if (Number.isFinite(pccQ) && anyQ) {
            text += ` Difference (network Q — lines, transformers, and loads): ${_fmt(pccQ - sumQ)} ${units.q}.`;
        }
        footer.textContent = text;
        section.appendChild(footer);
    }

    _appendElementQCsv(data) {
        const levels = data.voltage_levels || [];
        let csv = '\n# Reactive power by element at each envelope point\nVoltage_pu,Side,P_PCC_MW,Element,Type,P_MW,Q_Mvar\n';
        let any = false;
        levels.forEach((v) => {
            const vKey = String(parseFloat(v).toFixed(4));
            const curve = data.curves ? (_lookupVoltageMap(data.curves, v) || data.curves[vKey]) : null;
            if (!curve) return;
            const pDisp = curve.p_dispatch_mw || [];
            ['q_max', 'q_min'].forEach((side) => {
                const pArr = side === 'q_min'
                    ? (curve.p_min_mw || curve.p_mw || [])
                    : (curve.p_max_mw || curve.p_mw || []);
                const n = Math.max(pArr.length, pDisp.length);
                const seen = new Set();
                for (let i = 0; i < n; i++) {
                    const resolved = this._resolveEnvelopeSnapshot(vKey, side, pArr[i], pDisp[i]);
                    if (!resolved.lf) continue;
                    const dedupe = `${side}|${resolved.pKey}`;
                    if (seen.has(dedupe)) continue;
                    seen.add(dedupe);
                    this._elementRowsFromSnapshot(resolved.lf).forEach((row) => {
                        any = true;
                        csv += `${v},${side},${pArr[i] != null ? pArr[i] : ''},${_csvEscape(row.name)},${_csvEscape(row.type)},${row.pMw != null ? row.pMw : ''},${row.qMvar != null ? row.qMvar : ''}\n`;
                    });
                }
            });
        });
        return any ? csv : '';
    }

    _scaleP(p) {
        let v = Number(p);
        if (this._plotLoadOriented) v = -v;
        if (this._plotPuP && this._pn > 0) v /= this._pn;
        return v;
    }

    _scaleQ(q) {
        if (q == null) return q;
        let v = Number(q);
        if (this._plotLoadOriented) v = -v;
        if (this._plotPuQ && this._pn > 0) v /= this._pn;
        return v;
    }

    _pAxisLabel() {
        const unit = this._plotPuP ? 'P / Pmax (p.u.)' : 'P (MW)';
        const sign = this._plotLoadOriented ? '+ import' : '+ export';
        return `Net P at PCC (${unit}) — ${sign}`;
    }

    _qAxisLabel() {
        const unit = this._plotPuQ ? 'p.u. of Pmax' : 'Mvar';
        const conv = this._plotLoadOriented
            ? '+ inductive (underexcited), − capacitive (overexcited)'
            : '+ capacitive (overexcited), − inductive (underexcited)';
        return `Net Q at PCC (${unit}) — ${conv}`;
    }

    _renderChart(canvas, curveData, reqData, voltageLevel, fullData, panel) {
        const Chart = window.Chart;
        if (!Chart) {
            console.error('Chart.js not available');
            return;
        }

        const pMaxArr = curveData.p_max_mw || curveData.p_mw || [];
        const pMinArr = curveData.p_min_mw || curveData.p_mw || [];
        const pDispArr = curveData.p_dispatch_mw || [];
        const qMaxArr = curveData.q_max_mvar || [];
        const qMinArr = curveData.q_min_mvar || [];
        const vKey = String(parseFloat(voltageLevel).toFixed(4));
        const nPts = Math.max(pMaxArr.length, pMinArr.length);

        const capabilityMaxData = pMaxArr.map((p, i) => ({
            x: (qMaxArr[i] == null || Number.isNaN(Number(qMaxArr[i]))) ? NaN : this._scaleQ(qMaxArr[i]),
            y: this._scaleP(p),
            _rpcSide: 'q_max',
            _rpcP: p,
            _rpcPDispatch: pDispArr[i],
            _rpcQ: qMaxArr[i]
        }));
        const capabilityMinData = pMinArr.map((p, i) => ({
            x: (qMinArr[i] == null || Number.isNaN(Number(qMinArr[i]))) ? NaN : this._scaleQ(qMinArr[i]),
            y: this._scaleP(p),
            _rpcSide: 'q_min',
            _rpcP: p,
            _rpcPDispatch: pDispArr[i],
            _rpcQ: qMinArr[i]
        }));

        const envelopeData = [];
        for (let i = 0; i < nPts; i++) {
            const qn = qMinArr[i];
            const pMin = pMinArr[i];
            envelopeData.push({
                x: (qn == null || Number.isNaN(Number(qn))) ? NaN : this._scaleQ(qn),
                y: this._scaleP(pMin)
            });
        }
        for (let i = nPts - 1; i >= 0; i--) {
            const qx = qMaxArr[i];
            const pMax = pMaxArr[i];
            envelopeData.push({
                x: (qx == null || Number.isNaN(Number(qx))) ? NaN : this._scaleQ(qx),
                y: this._scaleP(pMax)
            });
        }

        const datasets = [
            {
                label: 'Capability Q_max (overexcited, capacitive)',
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
                spanGaps: false,
                order: 1
            },
            {
                label: 'Capability Q_min (underexcited, inductive)',
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
                spanGaps: false,
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
                spanGaps: false,
                order: 3
            }
        ];

        if (reqData) {
            const reqP = reqData.p_mw || [];
            const reqQMax = reqData.q_req_max_mvar || [];
            const reqQMin = reqData.q_req_min_mvar || [];
            if (reqP.length > 0) {
                const reqMaxPts = reqP.map((p, i) => ({ x: this._scaleQ(reqQMax[i]), y: this._scaleP(p) }))
                    .filter((d) => d.x != null);
                const reqMinPts = reqP.map((p, i) => ({ x: this._scaleQ(reqQMin[i]), y: this._scaleP(p) }))
                    .filter((d) => d.x != null);
                const reqEnvelope = [];
                for (let i = 0; i < reqP.length; i++) {
                    if (reqQMin[i] != null) reqEnvelope.push({ x: this._scaleQ(reqQMin[i]), y: this._scaleP(reqP[i]) });
                }
                for (let i = reqP.length - 1; i >= 0; i--) {
                    if (reqQMax[i] != null) reqEnvelope.push({ x: this._scaleQ(reqQMax[i]), y: this._scaleP(reqP[i]) });
                }
                const reqLabelSuffix = fullData.grid_code_template_name ? ' (grid code)' : '';
                datasets.push({
                    label: `Required Q (overexcited, capacitive)${reqLabelSuffix}`,
                    data: reqMaxPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#0d6efd',
                    showLine: true,
                    fill: false,
                    spanGaps: true,
                    order: 0
                });
                datasets.push({
                    label: `Required Q (underexcited, inductive)${reqLabelSuffix}`,
                    data: reqMinPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    borderDash: [6, 3],
                    pointRadius: 3,
                    pointBackgroundColor: '#0d6efd',
                    showLine: true,
                    fill: false,
                    spanGaps: true,
                    order: 0
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

        const yVals = [...capabilityMaxData, ...capabilityMinData].map((d) => d.y).filter(Number.isFinite);
        const yMin = yVals.length ? Math.min(0, ...yVals) : undefined;

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
                onClick: (evt, elements, chartInst) => {
                    if (!elements?.length) return;
                    const el = elements[0];
                    const ds = chartInst.data.datasets[el.datasetIndex];
                    if (!ds?.label?.startsWith('Capability Q_')) return;
                    const raw = ds.data[el.index];
                    if (!raw || raw._rpcSide == null) return;
                    let pKey = raw._rpcP;
                    if (!this._resolvePointLoadflow(vKey, raw._rpcSide, pKey) && raw._rpcPDispatch != null) {
                        pKey = raw._rpcPDispatch;
                    }
                    this._selectElementQPoint(panel, {
                        side: raw._rpcSide,
                        pKey,
                        pPcc: raw._rpcP,
                        qPcc: raw._rpcQ
                    });
                    this._onCapabilityPointClick(vKey, raw._rpcSide, pKey, raw._rpcQ, panel);
                },
                plugins: {
                    title: {
                        display: true,
                        text: `PQ Diagram — PCC Voltage: ${voltageLevel} pu${
                            fullData.grid_code_template_name ? ` · ${fullData.grid_code_template_name}` : ''
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
                            label: (c) => {
                                if (c.raw?._tip) return c.raw._tip;
                                if (c.dataset?._elementTip) return c.dataset._elementTip;
                                const xu = this._plotPuQ ? 'p.u.' : 'Mvar';
                                const yu = this._plotPuP ? 'p.u.' : 'MW';
                                const base = `Q: ${c.parsed.x?.toFixed(3)} ${xu}, P: ${c.parsed.y?.toFixed(3)} ${yu}`;
                                const dsLabel = c.dataset?.label || '';
                                if (dsLabel.startsWith('Capability Q_')) {
                                    return `${base} at PCC — click to show this load flow on the diagram`;
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
                            text: this._qAxisLabel(),
                            font: { size: 12, weight: '600' }
                        },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        grace: '6%'
                    },
                    y: {
                        title: { display: true, text: this._pAxisLabel(), font: { size: 13, weight: '600' } },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        min: yMin,
                        grace: '8%'
                    }
                }
            }
        });
        panel._pqChart = chart;
        this.chartInstances.push(chart);
        this._refreshElementMarkers(panel);
    }

    _downloadCSV(data) {
        let csv = '# P-Q curves (P is net active power at the PCC)\nVoltage_pu,P_PCC_Qmax_MW,P_PCC_Qmin_MW,P_dispatch_MW,Q_max_Mvar,Q_min_Mvar,cosphi_over,cosphi_under\n';
        const levels = data.voltage_levels || [];
        levels.forEach((v) => {
            const vKey = String(parseFloat(v).toFixed(4));
            const curve = data.curves[vKey];
            if (!curve) return;
            const pMax = curve.p_max_mw || curve.p_mw || [];
            const pMin = curve.p_min_mw || curve.p_mw || [];
            const pDisp = curve.p_dispatch_mw || [];
            const qMax = curve.q_max_mvar || [];
            const qMin = curve.q_min_mvar || [];
            const cOver = curve.cosphi_over || [];
            const cUnder = curve.cosphi_under || [];
            const n = Math.max(pMax.length, pMin.length);
            for (let i = 0; i < n; i++) {
                csv += `${v},${pMax[i] != null ? pMax[i] : ''},${pMin[i] != null ? pMin[i] : ''},` +
                    `${pDisp[i] != null ? pDisp[i] : ''},` +
                    `${qMax[i] != null ? qMax[i] : ''},${qMin[i] != null ? qMin[i] : ''},` +
                    `${cOver[i] != null ? cOver[i] : ''},${cUnder[i] != null ? cUnder[i] : ''}\n`;
            }
        });
        if (data.output_table && data.output_table.length) {
            csv += '\n# 10% Pn table\nU_pu,P_MW,P_pu,Q_max_Mvar,Q_min_Mvar,cosphi_over,cosphi_under\n';
            data.output_table.forEach((r) => {
                csv += `${r.u_pu},${r.p_mw},${r.p_pu},${r.q_max_mvar},${r.q_min_mvar},${r.cosphi_over},${r.cosphi_under}\n`;
            });
        }
        if (data.pq0) {
            csv += `\n# Residual P/Q at PCC with selected units off (not chart P=0 capability)\nP_mw,${data.pq0.p_mw}\nQ_mvar,${data.pq0.q_mvar}\n`;
        }
        const req = data._pqReqFallback;
        if (_hasPqReqPoints(req)) {
            csv += `\n# Grid-code requirement${data.grid_code_template_name ? ` (${data.grid_code_template_name})` : ''}\nP_MW,Q_req_max_Mvar,Q_req_min_Mvar\n`;
            (req.p_mw || []).forEach((p, i) => {
                csv += `${p},${req.q_req_max_mvar[i]},${req.q_req_min_mvar[i]}\n`;
            });
        }
        if (data.compliance) {
            csv += '\n# Compliance by voltage\nU_pu,compliant\n';
            (data.voltage_levels || []).forEach((v) => {
                csv += `${v},${_lookupVoltageMap(data.compliance, v)}\n`;
            });
        }
        csv += this._appendElementQCsv(data);
        csv += `\n# Overall P-Q compliance,${data.pq_compliance === true ? 'COMPLIANT' : data.pq_compliance === false ? 'NON-COMPLIANT' : 'Not assessed'}\n`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GridCode_PQ_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.GridCodePqResultsDialog = GridCodePqResultsDialog;
