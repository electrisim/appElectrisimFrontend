import { escapeHtml } from '../utils/htmlEscape.js';
import { devLog } from '../utils/devLog.js';
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';
import { RPCResultsDialog } from './RPCResultsDialog.js?v=uq20261104';
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
import { collectPqScenarios, findPqOverloads } from '../utils/pqOverloadCheck.js?v=ol20261105';
import { collectLineCurrents } from '../utils/pqLineCurrent.js?v=lc20261105';

// Marker shapes for the line-current 3D chart, one per selected line.
const PQ_LC_SYMBOLS = ['circle', 'diamond', 'square', 'cross', 'x', 'circle-open', 'diamond-open', 'square-open'];

// Loading colour scale (cmin 0 %, cmax 100 %): green → yellow → orange below the rating, red at and above it.
const PQ_LC_COLORSCALE = [
    [0, '#1a9850'], [0.5, '#66bd63'], [0.7, '#d9ef8b'], [0.85, '#fee08b'], [0.97, '#fdae61'], [0.999, '#f46d43'], [1, '#d73027']
];

/** Rated current of a line sample (A): current / loading, i.e. pandapower max_i_ka x derating x parallel. */
function _lcRatedA(sample) {
    const i = Number(sample?.currentA);
    const l = Number(sample?.loading);
    return Number.isFinite(i) && Number.isFinite(l) && l > 0 ? (i * 100) / l : NaN;
}

/**
 * Errors thrown inside Plotly (e.g. its WebGL 3D scene after the tab was in the background) must not
 * open the app's "Unknown error" dialog: log them as warnings instead. Installed once.
 */
function _pqGuardPlotlyErrors() {
    if (window.__pqPlotlyErrorGuard) return;
    window.__pqPlotlyErrorGuard = true;
    const previous = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
        if (String(source || '').includes('plotly')) {
            console.warn('3D chart (Plotly) error ignored:', message, error);
            return true;
        }
        return typeof previous === 'function' ? previous.apply(this, arguments) : false;
    };
}

devLog('GridCodePqResultsDialog.js LOADED');

const PQ_Q_ELEMENT_SOURCES = [
    { key: 'staticgenerators', type: 'Static generator', wind: true },
    { key: 'generators', type: 'Generator' },
    { key: 'storages', type: 'Storage' },
    // flip: the load flow reports these in load convention (+ = absorbing); the chart axis
    // is generator convention (+ = capacitive), so absorbing elements plot negative.
    { key: 'shunts', type: 'Shunt reactor', flip: true },
    { key: 'capacitors', type: 'Capacitor', flip: true },
    { key: 'svcs', type: 'SVC', flip: true },
    { key: 'sscs', type: 'STATCOM', flip: true }
];

// With the Park Controller as configured, only the STATCOM moves between the two edges, so the
// plant Q on the "lower" edge can still be capacitive (e.g. cable charging). Name the edges by
// position, not by inductive/capacitive.
const PQ_STATCOM_EDGE_LABEL = {
    q_max: 'Capability Q_max — highest plant Q (STATCOM at +rating)',
    q_min: 'Capability Q_min — lowest plant Q (STATCOM at −rating)'
};

/** Plain-language direction of plant Q at the PCC (generator convention). */
function _pccQDirection(qMvar) {
    const q = Number(qMvar);
    if (!Number.isFinite(q) || Math.abs(q) < 1e-3) return 'unity PF at the PCC';
    return q > 0
        ? 'capacitive: plant supplies Q to the grid'
        : 'inductive: plant absorbs Q from the grid';
}

/**
 * Q of the external grid(s) in a stored load flow, explained next to the plant Q at the PCC.
 * The External Grid box uses the grid's own sign (+ = grid supplies, − = grid absorbs), so when
 * the PCC is the grid's bus it shows the plant Q with the opposite sign.
 */
function _gridSideQ(lf, plantQ) {
    const grids = Array.isArray(lf?.externalgrids) ? lf.externalgrids : [];
    let q = 0;
    let n = 0;
    grids.forEach((g) => {
        const v = Number(g?.q_mvar);
        if (Number.isFinite(v)) { q += v; n += 1; }
    });
    if (!n) return null;
    const who = n > 1 ? 'External Grid boxes (sum)' : 'External Grid box';
    const qp = Number(plantQ);
    const mirror = Number.isFinite(qp) && Math.abs(qp + q) <= Math.max(0.01, 1e-4 * Math.abs(qp));
    const action = q < 0 ? 'grid absorbs it' : 'grid supplies it';
    return {
        q,
        short: `${who} shows ${_fmt(q)} Mvar`,
        long: mirror
            ? `${who}: ${_fmt(q)} Mvar — the same Q seen from the grid (${action}), so the sign is opposite`
            : `${who}: ${_fmt(q)} Mvar — grid's own sign (+ = grid supplies, − = grid absorbs); it differs from the plant Q by the network between the PCC and the grid`
    };
}

const PQ_Q_TYPE_ORDER = [
    'Wind turbine',
    'Static generator',
    'Generator',
    'Storage',
    'Shunt reactor',
    'Capacitor',
    'SVC',
    'STATCOM'
];

const PQ_Q_TYPE_COLOR = {
    'Wind turbine': '#198754',
    'Static generator': '#0f766e',
    'Generator': '#0dcaf0',
    'Storage': '#6f42c1',
    'Shunt reactor': '#fd7e14',
    'Capacitor': '#d63384',
    'SVC': '#6c757d',
    'STATCOM': '#82c91e'
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
    'SVC': ['#6c757d', '#495057'],
    'STATCOM': ['#82c91e', '#5c940d']
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
    // Q in the chart's generator convention: a shunt reactor absorbing 208 Mvar plots at -208.
    return bucket.q;
}

function _operatingWords(bucket) {
    const q = Number(bucket.q);
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
    const mag = magText(qOp);
    if (bucket.count > 1) {
        return `${label}: operating Q ${mag} ${unit} ${word} (${magText(qOp / bucket.count)} ${unit} on each unit).`;
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

/** Park Controller as configured: each operating point must lie inside the required band. */
function _computeOperatingCompliance(curve, req, tolMvar = 1e-4) {
    const reqP = req.p_mw || [];
    const reqMax = req.q_req_max_mvar || [];
    const reqMin = req.q_req_min_mvar || [];
    const ps = reqP.map(Number).filter(Number.isFinite);
    if (!ps.length) return null;
    const pLo = Math.min(...ps);
    const pHi = Math.max(...ps);
    const pArr = curve.p_max_mw || curve.p_mw || [];
    const qArr = curve.q_max_mvar || [];
    let checked = 0;
    for (let i = 0; i < pArr.length; i++) {
        const p = Number(pArr[i]);
        if (!Number.isFinite(p) || p < pLo - tolMvar || p > pHi + tolMvar) continue;
        const q = qArr[i];
        if (q == null || !Number.isFinite(Number(q))) return false;
        const hi = _interpPqQ(p, reqP, reqMax);
        const lo = _interpPqQ(p, reqP, reqMin);
        if (hi == null || lo == null) return false;
        if (Number(q) > hi + tolMvar || Number(q) < lo - tolMvar) return false;
        checked++;
    }
    return checked ? true : false;
}

/** Capability must cover required Qmax/Qmin over the P-Q envelope. true / false / null. */
function _computePqCompliance(curve, req, tolMvar = 1e-4) {
    if (!_hasPqReqPoints(req) || !curve) return null;
    if (curve.operating) return _computeOperatingCompliance(curve, req, tolMvar);
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
    if (data.q_dispatch_mode === 'park_configured' && data.statcom_envelope) {
        const names = (data.statcom_names || []).join(', ') || 'STATCOM';
        data.pcc_q_convention = 'Red area: plant P-Q range at the PCC with the Park Controller running exactly as configured and ' +
            `${names} pushed to its capacitive (Q_max) and inductive (Q_min) rating: the P-Q capability of the whole plant (generators, cables, transformers, shunts and STATCOM). ` +
            (hasReq
                ? 'Blue: grid-code required envelope in p.u. of Pmax at the PCC. The plant is compliant when the red area fully covers the blue area.'
                : 'No grid-code requirement was selected, so compliance is not assessed.');
        return;
    }
    if (data.q_dispatch_mode === 'park_configured') {
        data.pcc_q_convention = hasReq
            ? 'Red: plant operating point at the PCC with the Park Controller running exactly as configured (one load flow per P). Blue: grid-code required envelope in p.u. of Pmax at the PCC. The plant is compliant when every red point lies inside the blue area. This is not a capability envelope.'
            : 'Red: plant operating point at the PCC with the Park Controller running exactly as configured (one load flow per P). This is not a capability envelope. No grid-code requirement was selected, so compliance is not assessed.';
        return;
    }
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
        this._overloadResult = null;
        this._overloadSection = null;
        this._lineCurrents = null;
        this._lineCurrentSel = null;
        this._lineCurrentSection = null;
        this._lcRedraw = null;
        this._lcRange = null;
        this._pn = Number(data.pn_mw || data.total_installed_mw) || 0;
        this._plotPuP = false;
        this._plotPuQ = false;
        this._plotLoadOriented = false;
        this._pqMaximized = true;  // open full-screen; "Restore" shrinks it
        this._showElementQ = false;
        this._pqChartSpecs = [];
        this._pqStatcomEnv = data.q_dispatch_mode === 'park_configured' && !!data.statcom_envelope;
        // Single operating curve only (no STATCOM range to sweep).
        this._pqOperating = data.q_dispatch_mode === 'park_configured' && !this._pqStatcomEnv;
        this._pqConfigured = data.q_dispatch_mode === 'park_configured';
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

        this._pqContentEl = content;
        this._pqPlantSummaryEl = this._createPlantSummary(data);
        content.appendChild(this._pqPlantSummaryEl);

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
        const lineCurrentBtn = this._styledButton('Line current 3D', '#6f42c1', '#59359a');
        lineCurrentBtn.title = 'Highest current in selected lines over every load flow of this study, as a 3D chart of Q, P and PCC voltage (reads the stored load flows; runs no new calculation).';
        lineCurrentBtn.onclick = () => this._openLineCurrent3d(data);
        footerBar.appendChild(lineCurrentBtn);

        const overloadBtn = this._styledButton('Check overloads', '#fd7e14', '#e8590c');
        overloadBtn.title = 'List lines and transformers above the loading limit in every analysed case (reads the stored load flows; runs no new calculation).';
        overloadBtn.onclick = () => {
            const limit = this._overloadResult ? this._overloadResult.limitPct : this._overloadDefaultLimit(data);
            this._runOverloadCheck(data, limit);
            this._overloadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        footerBar.appendChild(overloadBtn);

        const copyBtn = this._styledButton('Copy image', '#0d6efd', '#0b5ed7');
        copyBtn.title = 'Copy a report-quality image of the visible P-Q chart, ready to paste into a document, article or post.';
        copyBtn.onclick = () => this._copyReportImage(copyBtn);
        footerBar.appendChild(copyBtn);

        const imageBtn = this._styledButton('Save image', '#0d6efd', '#0b5ed7');
        imageBtn.title = 'Save a report-quality PNG (1600 px wide at 2x, large fonts and legend) of the visible P-Q chart.';
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
        this._applyPqDialogSize();
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
            text = this._pqStatcomEnv
                ? 'COMPLIANT — with the Park Controller as configured and the STATCOM at its rating, the plant range covers the required envelope at every voltage level.'
                : this._pqOperating
                ? 'COMPLIANT — every operating point of the Park Controller, as configured, lies inside the required envelope at every voltage level.'
                : 'COMPLIANT — plant P-Q capability covers the required envelope at every voltage level.';
        } else if (hasReq && ok === false) {
            bg = '#f8d7da';
            border = '#f5c6cb';
            color = '#721c24';
            text = this._pqStatcomEnv
                ? 'NON-COMPLIANT — with the Park Controller as configured and the STATCOM at its rating, the plant range does not cover the required envelope at one or more voltage levels.'
                : this._pqOperating
                ? 'NON-COMPLIANT — with the Park Controller as configured, at least one operating point lies outside the required envelope.'
                : 'NON-COMPLIANT — plant P-Q capability does not cover the required envelope at one or more voltage levels.';
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

        this._elementQBothBtn = makeBtn('Both', () => this._setElementQEdge('both'));
        this._elementQCapBtn = makeBtn('Capacitive', () => this._setElementQEdge('capacitive'));
        this._elementQIndBtn = makeBtn('Inductive', () => this._setElementQEdge('inductive'));
        this._elementQBothBtn.title = 'Show element Q on both edges of the STATCOM envelope.';
        this._elementQCapBtn.title = 'Show element Q only on the capacitive edge (Q max, overexcited).';
        this._elementQIndBtn.title = 'Show element Q only on the inductive edge (Q min, underexcited).';
        addGroup('Element Q edge', this._elementQBothBtn, this._elementQCapBtn, this._elementQIndBtn);

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
        const edge = this._elementQEdge || 'both';
        apply(this._elementQBothBtn, edge === 'both');
        apply(this._elementQCapBtn, edge === 'capacitive');
        apply(this._elementQIndBtn, edge === 'inductive');
        // Edge choice only matters while Element Q is on: shade and disable it otherwise.
        [this._elementQBothBtn, this._elementQCapBtn, this._elementQIndBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !this._showElementQ;
            btn.style.opacity = this._showElementQ ? '1' : '0.45';
            btn.style.cursor = this._showElementQ ? 'pointer' : 'not-allowed';
        });
    }

    _setElementQEdge(edge) {
        if ((this._elementQEdge || 'both') === edge) return;
        this._elementQEdge = edge;
        this._syncUnitToggleStyle();
        (this._pqChartSpecs || []).forEach((spec) => this._refreshElementMarkers(spec.panel));
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
        if (this._showElementQ && this._pqStatcomEnv) {
            return 'Element Q is on. Each element group, including the STATCOM, is drawn twice: diamonds and solid line along the capacitive edge (Q_max), triangles and dashed line along the inductive edge (Q_min). Click a red point to show that load flow on the diagram.';
        }
        if (this._pqStatcomEnv) {
            return 'Red edges: P-Q capability of the whole plant with the Park Controller as configured and the STATCOM at its capacitive (Q_max) / inductive (Q_min) rating. Click any point to show that load flow on the diagram. Turn on Element Q to see each element group along both edges.';
        }
        if (this._showElementQ && this._pqOperating) {
            return 'Element Q is on. Each element group is drawn at every operating point (one diamond per P), so you can follow how its Q changes along the characteristic. Click a red point to show that load flow on the diagram.';
        }
        if (this._showElementQ) {
            return 'Element Q is on. Markers are the operating reactive power from the load flow of the red point you select, not the available capability. Click a red point to show that load flow on the diagram.';
        }
        if (this._pqOperating) {
            return 'Click a red operating point to show that load flow on the diagram. Each point is the plant with the Park Controller running exactly as configured. Turn on Element Q to draw each group’s total on the chart.';
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
        const chartH = this._pqMaximized ? 'max(56vh, calc(96vh - 330px))' : '450px';
        Object.assign(canvas.style, { width: '100%', height: chartH, maxHeight: chartH });
        panel.appendChild(canvas);
        this._pqChartSpecs.push({ canvas, curveData, reqData, voltageLevel, fullData, panel });
        this._mountElementQSection(panel, curveData);
    }

    /** How element Q signs on the chart relate to the result boxes on the diagram. */
    _elementSignNote() {
        if (this._plotLoadOriented) {
            return 'Sign of element Q: the chart uses load convention (+ = absorbed, inductive; − = supplied, capacitive). ' +
                'Diagram boxes for shunt reactors, capacitors and STATCOMs use the same sign; generator boxes show the opposite sign.';
        }
        return 'Sign of element Q: the chart uses generator convention (+ = supplied, capacitive; − = absorbed, inductive). ' +
            'Diagram boxes for shunt reactors, capacitors and STATCOMs use load convention (+ = absorbed), so a STATCOM ' +
            'absorbing 200 Mvar shows +200 on the diagram and −200 here.';
    }

    _pointQNote(qMvar, lf) {
        const grid = _gridSideQ(lf, qMvar);
        return grid
            ? ` (${_pccQDirection(qMvar)}; ${grid.short})`
            : ` (${_pccQDirection(qMvar)})`;
    }

    _pointSideLabel(side) {
        if (this._pqStatcomEnv) {
            if (side === 'q_op') return 'Operating point (Park Controller as configured)';
            return side === 'q_min' ? PQ_STATCOM_EDGE_LABEL.q_min : PQ_STATCOM_EDGE_LABEL.q_max;
        }
        if (this._pqOperating) return 'Operating point (Park Controller as configured)';
        return _pqSideLabel(side);
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
        } else if (data.q_dispatch_mode === 'park_configured') {
            extra.push(['Q dispatch', data.statcom_envelope
                ? 'Park Controller — exactly as configured; range from STATCOM rating'
                : 'Park Controller — exactly as configured (operating curve)']);
            if (data.statcom_envelope && (data.statcom_names || []).length) {
                extra.push(['STATCOM', data.statcom_names.join(', ')]);
            }
            if (data.park_controller_name) {
                extra.push(['Park Controller', data.park_controller_name + ' (active)']);
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
            span.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}`;
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
        title.textContent = this._pqOperating
            ? 'Operating point at 10% steps of Pn (P at PCC), Park Controller as configured'
            : 'Reactive power capability at 10% steps of Pn (P at PCC)';
        Object.assign(title.style, { fontWeight: '600', marginBottom: '8px', fontSize: '13px' });
        wrap.appendChild(title);
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });
        const head = document.createElement('tr');
        const heads = this._pqOperating
            ? ['U (p.u.)', 'P at PCC (MW)', 'P (p.u.)', 'Q (Mvar)', 'cosφ']
            : ['U (p.u.)', 'P at PCC (MW)', 'P (p.u.)', 'Q_max (Mvar)', 'Q_min (Mvar)', 'cosφ over', 'cosφ under'];
        heads.forEach((h) => {
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
            (this._pqOperating
                ? [
                    _fmt(row.u_pu, 4), _fmt(row.p_mw, 2), _fmt(row.p_pu, 2),
                    _fmt(row.q_max_mvar, 2), _fmt(row.cosphi_over, 3)
                ]
                : [
                    _fmt(row.u_pu, 4), _fmt(row.p_mw, 2), _fmt(row.p_pu, 2),
                    _fmt(row.q_max_mvar, 2), _fmt(row.q_min_mvar, 2),
                    _fmt(row.cosphi_over, 3), _fmt(row.cosphi_under, 3)
                ]).forEach((t) => {
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
                let qMvar = item?.q_mvar;
                if (src.flip && qMvar != null && qMvar !== '' && Number.isFinite(Number(qMvar))) {
                    qMvar = -Number(qMvar);
                }
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
        return `Element reactive power — ${this._pointSideLabel(sel.side)}: P = ${_fmt(this._scaleP(sel.pPcc))} ${units.p}, Q = ${_fmt(this._scaleQ(sel.qPcc))} ${units.q} (${_pccQDirection(sel.qPcc)})`;
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
        const chartH = this._pqMaximized ? 'max(56vh, calc(96vh - 330px))' : '450px';
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
        if (!sel) return ['Click a red point to read how each group contributes at that active power.', this._elementSignNote()];
        const model = this._contributionModel(panel);
        const lf = this._resolvePointLoadflow(panel.dataset.rpcVoltageKey, sel.side, sel.pKey);
        const lines = [
            `${this._pointSideLabel(sel.side)} at PCC P = ${_fmt(this._scaleP(sel.pPcc))} ${units.p}. Plant Q at the PCC is ${_fmt(this._scaleQ(sel.qPcc))} ${units.q} (${_pccQDirection(sel.qPcc)}).`
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
        const magText = (q) => _fmt(this._scaleQ(Number(q)));
        buckets.forEach((bucket) => lines.push(_contributionSentence(bucket, magText, units.q)));
        if (!buckets.length) lines.push('No reactive elements in this load flow.');
        lines.push(this._elementSignNote());
        return lines;
    }

    /**
     * Park Controller as configured: element Q markers for every operating point at once,
     * one dataset (colour) per element group, so each group draws its own curve of dots.
     */
    _operatingElementMarkerDatasets(panel) {
        const vKey = panel.dataset.rpcVoltageKey;
        const curve = panel._pqCurveData || {};
        const pDisp = curve.p_dispatch_mw || [];
        // STATCOM envelope: one set of dots along Q_max and one along Q_min.
        // Single operating curve: one set along that curve.
        const runs = curve.statcom_envelope
            ? [
                { side: 'q_max', p: curve.p_max_mw || curve.p_mw || [], tag: 'Q_max', style: 'rectRot', dash: [] },
                { side: 'q_min', p: curve.p_min_mw || curve.p_mw || [], tag: 'Q_min', style: 'triangle', dash: [4, 3] }
            ]
            : [{ side: 'q_max', p: curve.p_max_mw || curve.p_mw || [], tag: '', style: 'rectRot', dash: [3, 3] }];
        const model = this._contributionModel(panel);
        const colorByKey = new Map(model.tracks.map((track) => [track.key, track.color]));
        const groups = new Map();
        // Edge toggle applies to the STATCOM envelope only; a single operating curve has no edge to pick.
        const edge = this._elementQEdge || 'both';
        const edgeSide = edge === 'capacitive' ? 'q_max' : edge === 'inductive' ? 'q_min' : null;
        const shownRuns = curve.statcom_envelope && edgeSide ? runs.filter((run) => run.side === edgeSide) : runs;
        shownRuns.forEach((run) => {
            run.p.forEach((p, i) => {
                const y = this._scaleP(p);
                if (!Number.isFinite(y)) return;
                const { lf } = this._resolveEnvelopeSnapshot(vKey, run.side, p, pDisp[i]);
                if (!lf) return;
                _aggregateContribution(this._elementRowsFromSnapshot(lf), model.collapseTypes).forEach((bucket) => {
                    const operatingQ = _chartOperatingQ(bucket);
                    const x = this._scaleQ(operatingQ);
                    if (!Number.isFinite(x)) return;
                    const base = _contributionLabel(bucket);
                    const label = run.tag ? `${base} (${run.tag})` : base;
                    const tip = `${label}: Q ${_fmt(x)} at P = ${_fmt(y)}, ${_operatingWords(bucket)}`;
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
                    groups.get(key).data.push({ x, y, _tip: tip });
                });
            });
        });
        return [...groups.values()].map((ds) => {
            ds.data.sort((a, b) => a.y - b.y);
            return ds;
        });
    }

    _elementMarkerDatasets(panel) {
        if (!this._showElementQ) return [];
        if (this._pqOperating || this._pqStatcomEnv) return this._operatingElementMarkerDatasets(panel);
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
            const tip = `${label}: Q ${_fmt(x)} from this load flow, ${word}`;
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

    /**
     * Report-quality image of the visible P-Q chart: the chart is redrawn off-screen at a fixed
     * size with large fonts and line widths, under a header (study, grid code, voltage, verdict)
     * and above a full-width legend, so it stays readable when pasted into a report or post.
     * Resolves to a canvas.
     */
    /**
     * What the report image shows: the chart to redraw and its header. The U-Q dialog overrides
     * this; the rest of the report rendering is shared.
     */
    _reportContext() {
        const panel = this._visiblePqPanel();
        const chart = panel?._pqChart;
        if (!chart) return null;
        const spec = (this._pqChartSpecs || []).find((sp) => sp.panel === panel) || {};
        const data = spec.fullData || {};
        const vKey = panel.dataset.rpcVoltageKey;
        const vLabel = vKey != null ? `${parseFloat(vKey)} pu` : '';
        return {
            chart,
            title: 'Grid Code Compliance — P-Q capability at the PCC',
            subtitle: [
                data.grid_code_template_name || '',
                vLabel ? `PCC voltage ${vLabel}` : '',
                Number(data.pmax_pcc_mw) > 0 ? `Pmax at PCC ${Number(data.pmax_pcc_mw).toFixed(1)} MW` : ''
            ].filter(Boolean).join('  ·  '),
            compliance: data.compliance ? (data.compliance[vKey] ?? null) : null,
            xLabel: this._qAxisLabel(),
            yLabel: this._pAxisLabel(),
            notes: this._showElementQ ? this._selectedContributionLines(panel) : []
        };
    }

    async _renderReportCanvas() {
        const rc = this._reportContext();
        const chart = rc?.chart;
        const Chart = window.Chart;
        if (!chart || !Chart) throw new Error('The diagram is not ready yet.');

        const W = 1600, H = 900, SCALE = 2;          // logical px; drawn at 2x for sharp text
        const host = document.createElement('div');
        Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${W}px`, height: `${H}px` });
        const canvas = document.createElement('canvas');
        canvas.width = W;      // Chart.js multiplies by devicePixelRatio (SCALE)
        canvas.height = H;
        Object.assign(canvas.style, { width: `${W}px`, height: `${H}px` });
        host.appendChild(canvas);
        document.body.appendChild(host);

        const grow = (v, k, min) => (typeof v === 'number' ? Math.max(v * k, min) : v);
        const datasets = chart.data.datasets
            .map((ds, i) => ({ ds, i }))
            .filter(({ i }) => chart.isDatasetVisible(i))
            .map(({ ds }) => ({
                ...ds,
                data: (ds.data || []).map((pt) => (pt && typeof pt === 'object' ? { ...pt } : pt)),
                borderWidth: grow(ds.borderWidth, 1.6, 2),
                pointRadius: typeof ds.pointRadius === 'number'
                    ? (ds.pointRadius > 0 ? Math.max(ds.pointRadius * 1.5, 4) : 0)
                    : ds.pointRadius,
                pointBorderWidth: grow(ds.pointBorderWidth, 1.4, 1)
            }));

        const src = chart.options || {};
        const xs = src.scales?.x || {};
        const ys = src.scales?.y || {};
        const sides = this._qAxisSideLabels();
        const sidesPlugin = {
            id: 'qAxisSidesReport',
            afterDraw(c) {
                const x = c.scales.x;
                if (!x) return;
                const g = c.ctx;
                g.save();
                g.font = '600 18px Arial, sans-serif';
                g.fillStyle = '#212529';
                g.textBaseline = 'middle';
                g.textAlign = 'left';
                g.fillText(sides.left, c.chartArea.left, x.bottom - 14);
                g.textAlign = 'right';
                g.fillText(sides.right, c.chartArea.right, x.bottom - 14);
                g.restore();
            }
        };
        const whiteBg = {
            id: 'whiteBg',
            beforeDraw(c) {
                const g = c.ctx;
                g.save();
                g.fillStyle = '#ffffff';
                g.fillRect(0, 0, c.width, c.height);
                g.restore();
            }
        };
        const legendFilter = src.plugins?.legend?.labels?.filter;
        const report = new Chart(canvas.getContext('2d'), {
            type: chart.config.type,
            data: { datasets },
            plugins: [whiteBg, sidesPlugin],
            options: {
                responsive: false,
                animation: false,
                devicePixelRatio: SCALE,
                layout: { padding: { top: 10, right: 28, bottom: 6, left: 10 } },
                plugins: {
                    title: { display: false },
                    tooltip: { enabled: false },
                    legend: {
                        position: 'bottom',
                        labels: {
                            filter: legendFilter,
                            font: { size: 17 },
                            color: '#212529',
                            boxWidth: 34,
                            boxHeight: 14,
                            padding: 16
                        }
                    }
                },
                scales: {
                    x: {
                        type: xs.type, min: xs.min, max: xs.max, grace: xs.grace,
                        title: { display: true, text: rc.xLabel, font: { size: 19, weight: '600' }, color: '#212529', padding: { top: 8 } },
                        ticks: { font: { size: 16 }, color: '#343a40' },
                        grid: { color: 'rgba(0,0,0,0.08)' }
                    },
                    y: {
                        type: ys.type, min: ys.min, max: ys.max, grace: ys.grace,
                        title: { display: true, text: rc.yLabel, font: { size: 19, weight: '600' }, color: '#212529' },
                        ticks: { font: { size: 16 }, color: '#343a40' },
                        grid: { color: 'rgba(0,0,0,0.08)' }
                    }
                }
            }
        });
        report.draw();
        const chartImg = report.toBase64Image('image/png', 1);
        report.destroy();
        host.remove();
        const img = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = chartImg;
        });

        // Header: study, grid code, PCC voltage, verdict. Footer: Element Q notes when shown.
        const compliance = rc.compliance;
        const verdict = compliance === true ? 'COMPLIANT' : compliance === false ? 'NON-COMPLIANT' : '';
        const subtitle = rc.subtitle || '';
        const notes = rc.notes || [];

        const pad = 40 * SCALE;
        const measure = document.createElement('canvas').getContext('2d');
        const maxW = img.width - 2 * pad;
        const wrap = (text, font) => {
            measure.font = font;
            const rows = [];
            let cur = '';
            String(text).split(' ').forEach((w) => {
                const next = cur ? `${cur} ${w}` : w;
                if (measure.measureText(next).width > maxW && cur) { rows.push(cur); cur = w; } else cur = next;
            });
            if (cur) rows.push(cur);
            return rows;
        };
        const noteFont = `${15 * SCALE}px Arial, sans-serif`;
        const noteRows = notes.flatMap((n) => wrap(n, noteFont));
        const headH = 112 * SCALE;
        const footH = (noteRows.length ? noteRows.length * 22 * SCALE + 24 * SCALE : 0) + 34 * SCALE;
        const out = document.createElement('canvas');
        out.width = img.width;
        out.height = headH + img.height + footH;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#212529';
        ctx.font = `700 ${30 * SCALE}px Arial, sans-serif`;
        ctx.fillText(rc.title, pad, 26 * SCALE);
        ctx.font = `${19 * SCALE}px Arial, sans-serif`;
        ctx.fillStyle = '#495057';
        ctx.fillText(subtitle, pad, 70 * SCALE);
        if (verdict) {
            ctx.font = `700 ${19 * SCALE}px Arial, sans-serif`;
            const tw = ctx.measureText(verdict).width;
            const bx = img.width - pad - tw - 28 * SCALE;
            ctx.fillStyle = compliance ? '#d1e7dd' : '#f8d7da';
            ctx.fillRect(bx, 24 * SCALE, tw + 28 * SCALE, 40 * SCALE);
            ctx.fillStyle = compliance ? '#0f5132' : '#842029';
            ctx.fillText(verdict, bx + 14 * SCALE, 34 * SCALE);
        }
        ctx.drawImage(img, 0, headH);
        let y = headH + img.height + 12 * SCALE;
        ctx.font = noteFont;
        ctx.fillStyle = '#343a40';
        noteRows.forEach((row) => { ctx.fillText(row, pad, y); y += 22 * SCALE; });
        ctx.font = `${13 * SCALE}px Arial, sans-serif`;
        ctx.fillStyle = '#868e96';
        ctx.textAlign = 'right';
        ctx.fillText('Electrisim · pandapower load flow', img.width - pad, out.height - 26 * SCALE);
        return out;
    }

    async _saveChartImage() {
        try {
            const out = await this._renderReportCanvas();
            const a = document.createElement('a');
            a.href = out.toDataURL('image/png');
            a.download = `${this._reportFilePrefix ? this._reportFilePrefix() : 'GridCode_PQ'}_diagram_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            alert(e.message || String(e));
        }
    }

    async _copyReportImage(btn) {
        const label = btn ? btn.textContent : '';
        try {
            if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
                throw new Error('This browser cannot copy images to the clipboard. Use "Save image" instead.');
            }
            // Pass the blob as a promise so the clipboard write starts within the click.
            const blobPromise = this._renderReportCanvas()
                .then((out) => new Promise((resolve) => out.toBlob(resolve, 'image/png')));
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blobPromise })]);
            if (btn) {
                btn.textContent = 'Copied ✓';
                setTimeout(() => { btn.textContent = label; }, 1800);
            }
        } catch (e) {
            alert(e.message || String(e));
        }
    }

    _showSelectedPointOnDiagram(panel) {
        const sel = panel?._elementQSelection;
        const vKey = panel?.dataset?.rpcVoltageKey;
        if (!sel || !vKey) return;
        this._onCapabilityPointClick(vKey, sel.side, sel.pKey, sel.qPcc, panel);
    }

    _elementQHintText() {
        return 'Positive generator Q is overexcited (capacitive). Positive shunt-reactor Q is inductive absorption. Values follow the chart unit and sign toggles.';
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
        hint.textContent = this._elementQHintText();
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
        return `Net Q at PCC (${unit})`;
    }

    // Left/right captions for the Q axis: the negative side always sits on the left.
    _qAxisSideLabels() {
        const negative = this._plotLoadOriented ? 'capacitive (overexcited)' : 'inductive (underexcited)';
        const positive = this._plotLoadOriented ? 'inductive (underexcited)' : 'capacitive (overexcited)';
        return { left: `− ${negative}`, right: `+ ${positive}` };
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

        const operating = !!curveData.operating;
        const statcomEnv = !!curveData.statcom_envelope;
        const datasets = [
            {
                label: operating ? 'Operating point (Park Controller as configured)'
                    : (statcomEnv ? PQ_STATCOM_EDGE_LABEL.q_max : 'Capability Q_max (overexcited, capacitive)'),
                _pqPoints: true,
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
                label: statcomEnv ? PQ_STATCOM_EDGE_LABEL.q_min : 'Capability Q_min (underexcited, inductive)',
                _pqPoints: true,
                hidden: operating,
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
                hidden: operating,
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

        // Draws the Q-axis captions on the x-axis title row, one at each end of the plot.
        const qAxisSidesPlugin = {
            id: 'qAxisSides',
            afterDraw(chartInst, args, pluginOpts) {
                const xScale = chartInst.scales.x;
                if (!xScale || !pluginOpts) return;
                const { ctx: c, chartArea } = chartInst;
                const y = xScale.bottom - 10;
                c.save();
                c.font = `600 12px ${Chart.defaults.font.family}`;
                c.fillStyle = '#212529';
                c.textBaseline = 'middle';
                c.textAlign = 'left';
                c.fillText(pluginOpts.left, chartArea.left, y);
                c.textAlign = 'right';
                c.fillText(pluginOpts.right, chartArea.right, y);
                c.restore();
            }
        };

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            plugins: [qAxisSidesPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
                onClick: (evt, elements, chartInst) => {
                    if (!elements?.length) return;
                    const el = elements[0];
                    const ds = chartInst.data.datasets[el.datasetIndex];
                    if (!ds?._pqPoints) return;
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
                            filter: (item, chartData) => {
                                const ds = chartData?.datasets?.[item.datasetIndex];
                                if (ds?.hidden) return false;
                                return !item.text.includes('Area') && !item.text.startsWith('_');
                            },
                            font: { size: 12 }
                        }
                    },
                    qAxisSides: this._qAxisSideLabels(),
                    tooltip: {
                        callbacks: {
                            label: (c) => {
                                if (c.raw?._tip) return c.raw._tip;
                                if (c.dataset?._elementTip) return c.dataset._elementTip;
                                const xu = this._plotPuQ ? 'p.u.' : 'Mvar';
                                const yu = this._plotPuP ? 'p.u.' : 'MW';
                                const base = `Q: ${c.parsed.x?.toFixed(3)} ${xu}, P: ${c.parsed.y?.toFixed(3)} ${yu}`;
                                const dsLabel = c.dataset?.label || '';
                                if (c.dataset?._pqPoints) {
                                    const raw = c.raw || {};
                                    let lf = null;
                                    if (raw._rpcSide != null) {
                                        lf = this._resolvePointLoadflow(vKey, raw._rpcSide, raw._rpcP);
                                        if (!lf && raw._rpcPDispatch != null) {
                                            lf = this._resolvePointLoadflow(vKey, raw._rpcSide, raw._rpcPDispatch);
                                        }
                                    }
                                    const lines = [`Plant ${base} at PCC (${_pccQDirection(raw._rpcQ)})`];
                                    const grid = _gridSideQ(lf, raw._rpcQ);
                                    if (grid) lines.push(grid.long);
                                    lines.push('Click to show this load flow on the diagram');
                                    return lines;
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

    /** Short curve name for the overload tables. */
    _overloadSideLabel(side) {
        if (side === 'q_op' || this._pqOperating) return 'Operating point';
        return side === 'q_min' ? 'Q min' : 'Q max';
    }

    _overloadDefaultLimit(data) {
        const s = data?.study_settings || {};
        const v = Number(s.max_loading_percent);
        return Number.isFinite(v) && v > 0 ? v : 100;
    }

    _runOverloadCheck(data, limitPct) {
        const scenarios = collectPqScenarios(data, (vKey, side, p) => this._resolvePointLoadflow(vKey, side, p));
        const nameOf = (item, type) => this._elementDisplayName(item, type, this._cellForResultRow(item));
        this._overloadResult = findPqOverloads(scenarios, limitPct, nameOf);
        this._renderOverloadSection(data);
        return this._overloadResult;
    }

    _overloadPanelFor(vKey) {
        const spec = (this._pqChartSpecs || []).find((sp) => sp.panel?.dataset?.rpcVoltageKey === vKey);
        return spec ? spec.panel : null;
    }

    _showOverloadScenario(scenario) {
        if (!scenario) return;
        this._onCapabilityPointClick(scenario.vKey, scenario.side, scenario.pKey, scenario.q,
            this._overloadPanelFor(scenario.vKey));
    }

    _overloadScenarioText(sc) {
        return `${sc.voltage} pu · ${this._overloadSideLabel(sc.side)} · P ${_fmt(sc.p, 1)} MW · Q ${_fmt(sc.q, 1)} Mvar`;
    }

    _overloadTable(headers, rows) {
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '6px' });
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        headers.forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #dee2e6',
                backgroundColor: '#f8f9fa', color: '#495057', fontWeight: '600'
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach((cells) => {
            const tr = document.createElement('tr');
            cells.forEach((c) => {
                const td = document.createElement('td');
                Object.assign(td.style, { padding: '5px 8px', borderBottom: '1px solid #e9ecef', verticalAlign: 'middle' });
                if (c instanceof Node) td.appendChild(c);
                else td.textContent = c == null ? '' : String(c);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _overloadShowButton(scenario) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Show on diagram';
        Object.assign(btn.style, {
            border: '1px solid #0d6efd', background: '#fff', color: '#0d6efd', borderRadius: '4px',
            padding: '2px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
        });
        btn.title = 'Apply this load flow on the diagram';
        btn.onclick = () => this._showOverloadScenario(scenario);
        return btn;
    }

    _loadingText(v, limit) {
        const span = document.createElement('span');
        span.textContent = `${_fmt(v, 1)} %`;
        Object.assign(span.style, { fontWeight: '600', color: v > limit ? '#b02a37' : '#212529' });
        return span;
    }

    /** Overload section under the charts; created on the first check, refreshed after that. */
    _renderOverloadSection(data) {
        const res = this._overloadResult;
        let section = this._overloadSection;
        if (!section) {
            section = document.createElement('div');
            section.className = 'pq-overload-section';
            Object.assign(section.style, {
                marginTop: '18px', padding: '14px 16px', border: '1px solid #dee2e6',
                borderRadius: '8px', backgroundColor: '#fff'
            });
            this._overloadSection = section;
            const host = this._pqContentEl;
            const anchor = this._pqPlantSummaryEl;
            if (host && anchor && anchor.parentNode === host) host.insertBefore(section, anchor);
            else if (host) host.appendChild(section);
        }
        section.innerHTML = '';

        const head = document.createElement('div');
        Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' });
        const title = document.createElement('div');
        title.textContent = 'Overload check — lines and transformers in every analysed case';
        Object.assign(title.style, { fontWeight: '700', fontSize: '14px', color: '#212529', marginRight: 'auto' });
        head.appendChild(title);

        const limLabel = document.createElement('label');
        limLabel.textContent = 'Loading limit (%)';
        Object.assign(limLabel.style, { fontSize: '12px', color: '#495057' });
        const limInput = document.createElement('input');
        limInput.type = 'number';
        limInput.min = '1';
        limInput.step = '1';
        limInput.value = String(res.limitPct);
        Object.assign(limInput.style, { width: '70px', padding: '3px 6px', fontSize: '12px', border: '1px solid #ced4da', borderRadius: '4px' });
        const rerun = () => {
            const v = parseFloat(String(limInput.value).replace(',', '.'));
            if (!Number.isFinite(v) || v <= 0) {
                alert('Enter a loading limit above 0 %.');
                return;
            }
            this._runOverloadCheck(data, v);
        };
        limInput.onkeydown = (e) => { if (e.key === 'Enter') rerun(); };
        const againBtn = this._styledButton('Check', '#fd7e14', '#e8590c');
        Object.assign(againBtn.style, { padding: '4px 12px', fontSize: '12px' });
        againBtn.onclick = rerun;
        const csvBtn = this._styledButton('Download CSV', '#28a745', '#218838');
        Object.assign(csvBtn.style, { padding: '4px 12px', fontSize: '12px' });
        csvBtn.onclick = () => this._downloadOverloadCsv();
        head.append(limLabel, limInput, againBtn, csvBtn);
        section.appendChild(head);

        const limit = res.limitPct;
        const over = res.elements.filter((el) => el.maxLoading > limit);
        const banner = document.createElement('div');
        Object.assign(banner.style, {
            marginTop: '10px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
            border: '1px solid', lineHeight: '1.45'
        });
        if (!res.scenarioCount) {
            Object.assign(banner.style, { backgroundColor: '#fff3cd', borderColor: '#ffe69c', color: '#664d03' });
            banner.textContent = 'No stored load flows to check. Run the P-Q study again to refresh the point data.';
            section.appendChild(banner);
            return;
        }
        const top = res.elements[0];
        if (over.length) {
            Object.assign(banner.style, { backgroundColor: '#f8d7da', borderColor: '#f1aeb5', color: '#58151c' });
            banner.textContent = `${over.length} element${over.length === 1 ? '' : 's'} above ${_fmt(limit, 1)} % in ` +
                `${res.overloadedScenarioCount} of ${res.scenarioCount} load flows. ` +
                `Highest: ${top.name} at ${_fmt(top.maxLoading, 1)} % (${this._overloadScenarioText(top.worst)}).`;
        } else {
            Object.assign(banner.style, { backgroundColor: '#d1e7dd', borderColor: '#a3cfbb', color: '#0a3622' });
            banner.textContent = `No line or transformer above ${_fmt(limit, 1)} % in any of the ${res.scenarioCount} load flows.` +
                (top ? ` Highest: ${top.name} at ${_fmt(top.maxLoading, 1)} % (${this._overloadScenarioText(top.worst)}).` : '');
        }
        section.appendChild(banner);

        // What was checked: every line and transformer, with the most loaded one of each type.
        if (res.byType?.length) {
            const plural = { 'Line': 'lines', 'Transformer': 'transformers', '3-winding transformer': 'three-winding transformers' };
            const checked = document.createElement('div');
            Object.assign(checked.style, { fontSize: '12px', color: '#495057', marginTop: '8px' });
            checked.textContent = `Checked ${res.byType.map((t) => `${t.count} ${t.count === 1 ? t.type.toLowerCase() : (plural[t.type] || t.type)}`).join(', ')} in each of the ${res.scenarioCount} load flows. Most loaded of each type:`;
            section.appendChild(checked);
            section.appendChild(this._overloadTable(
                ['Type', 'Most loaded element', 'Max loading', 'Worst case', 'Cases above limit', ''],
                res.byType.filter((t) => t.top).map((t) => [
                    t.type, t.top.name, this._loadingText(t.top.maxLoading, limit),
                    this._overloadScenarioText(t.top.worst), `${t.top.count} of ${res.scenarioCount}`,
                    this._overloadShowButton(t.top.worst)
                ])
            ));
        }

        if (data?.study_settings?.limit_overloads) {
            const note = document.createElement('div');
            Object.assign(note.style, { fontSize: '12px', color: '#6c757d', marginTop: '6px' });
            note.textContent = `The study ran with the loading limit on (${_fmt(this._overloadDefaultLimit(data), 1)} %), ` +
                'so plant Q was already reduced to keep loading within it. Cases still listed here could not be brought ' +
                'within the limit, or you checked against a lower limit.';
            section.appendChild(note);
        }

        const shown = over.length ? over : res.elements.slice(0, 5);
        if (shown.length) {
            const sub = document.createElement('div');
            sub.textContent = over.length ? 'Overloaded elements (worst case of each)' : 'Highest-loaded elements (all within the limit)';
            Object.assign(sub.style, { fontWeight: '600', fontSize: '12px', color: '#495057', marginTop: '12px' });
            section.appendChild(sub);
            section.appendChild(this._overloadTable(
                ['Element', 'Type', 'Max loading', 'Worst case', 'Cases above limit', ''],
                shown.map((el) => [
                    el.name, el.type, this._loadingText(el.maxLoading, limit),
                    this._overloadScenarioText(el.worst), `${el.count} of ${res.scenarioCount}`,
                    this._overloadShowButton(el.worst)
                ])
            ));
        }

        if (res.cases.length) {
            const details = document.createElement('details');
            details.style.marginTop = '10px';
            const summary = document.createElement('summary');
            summary.textContent = `All overloaded cases (${res.cases.length})`;
            Object.assign(summary.style, { cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#495057' });
            details.appendChild(summary);
            const MAX_ROWS = 500;
            details.appendChild(this._overloadTable(
                ['U (pu)', 'Curve', 'P at PCC (MW)', 'Q at PCC (Mvar)', 'Element', 'Type', 'Loading', ''],
                res.cases.slice(0, MAX_ROWS).map((c) => [
                    c.scenario.voltage, this._overloadSideLabel(c.scenario.side), _fmt(c.scenario.p, 1),
                    _fmt(c.scenario.q, 1), c.name, c.type, this._loadingText(c.loading, limit),
                    this._overloadShowButton(c.scenario)
                ])
            ));
            if (res.cases.length > MAX_ROWS) {
                const more = document.createElement('div');
                Object.assign(more.style, { fontSize: '12px', color: '#6c757d', marginTop: '4px' });
                more.textContent = `Showing the ${MAX_ROWS} highest. Download CSV lists all ${res.cases.length}.`;
                details.appendChild(more);
            }
            section.appendChild(details);
        }
    }

    _overloadCsvText() {
        const res = this._overloadResult;
        if (!res) return '';
        let csv = `\n# Overload check (limit ${res.limitPct} %): ${res.overloadedScenarioCount} of ${res.scenarioCount} load flows with an element above the limit\n`;
        csv += 'Element,Type,Max_loading_pct,Worst_U_pu,Worst_curve,Worst_P_PCC_MW,Worst_Q_PCC_Mvar,Cases_above_limit\n';
        res.elements.forEach((el) => {
            const w = el.worst || {};
            csv += [el.name, el.type, _fmt(el.maxLoading, 2), w.voltage, this._overloadSideLabel(w.side),
                _fmt(w.p, 3), _fmt(w.q, 3), el.count].map(_csvEscape).join(',') + '\n';
        });
        if (res.cases.length) {
            csv += '\n# Overloaded cases\nU_pu,Curve,P_PCC_MW,Q_PCC_Mvar,Element,Type,Loading_pct\n';
            res.cases.forEach((c) => {
                csv += [c.scenario.voltage, this._overloadSideLabel(c.scenario.side), _fmt(c.scenario.p, 3),
                    _fmt(c.scenario.q, 3), c.name, c.type, _fmt(c.loading, 2)].map(_csvEscape).join(',') + '\n';
            });
        }
        return csv;
    }

    _downloadOverloadCsv() {
        const csv = this._overloadCsvText().replace(/^\n/, '');
        if (!csv) return;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GridCode_PQ_overloads_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ---- Line current 3D: every stored load flow of the study, per selected line ----

    destroy() {
        try {
            const gd = this._lineCurrentSection?.querySelector('.js-plotly-plot');
            if (gd && window.Plotly) window.Plotly.purge(gd);
        } catch (e) { /* chart already gone */ }
        super.destroy();
    }

    _loadPlotly() {
        if (window.Plotly) return Promise.resolve();
        if (this._plotlyLoading) return this._plotlyLoading;
        this._plotlyLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js';
            script.crossOrigin = 'anonymous';  // readable error messages instead of "Script error."
            script.onload = () => {
                _pqGuardPlotlyErrors();
                resolve();
            };
            script.onerror = () => {
                this._plotlyLoading = null;
                reject(new Error('Could not load the 3D chart library. Check the internet connection and try again.'));
            };
            document.head.appendChild(script);
        });
        return this._plotlyLoading;
    }

    _lineCurrentData(data) {
        if (!this._lineCurrents) {
            const scenarios = collectPqScenarios(data, (vKey, side, p) => this._resolvePointLoadflow(vKey, side, p));
            const nameOf = (row) => this._elementDisplayName(row, 'Line', this._cellForResultRow(row));
            this._lineCurrents = collectLineCurrents(scenarios, nameOf);
        }
        return this._lineCurrents;
    }

    async _openLineCurrent3d(data) {
        const lines = this._lineCurrentData(data);
        if (!this._lineCurrentSel) this._lineCurrentSel = new Set(lines.slice(0, 3).map((l) => l.key));
        this._renderLineCurrentSection(data);
        this._lineCurrentSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    _renderLineCurrentSection(data) {
        const lines = this._lineCurrentData(data);
        let section = this._lineCurrentSection;
        if (!section) {
            section = document.createElement('div');
            section.className = 'pq-line-current-section';
            Object.assign(section.style, {
                marginTop: '18px', padding: '14px 16px', border: '1px solid #dee2e6',
                borderRadius: '8px', backgroundColor: '#fff'
            });
            this._lineCurrentSection = section;
            const host = this._pqContentEl;
            const anchor = this._pqPlantSummaryEl;
            if (host && anchor && anchor.parentNode === host) host.insertBefore(section, anchor);
            else if (host) host.appendChild(section);
        }
        section.replaceChildren();

        const head = document.createElement('div');
        Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' });
        const title = document.createElement('div');
        title.textContent = 'Line current 3D — every load flow of this study';
        Object.assign(title.style, { fontWeight: '700', fontSize: '14px', color: '#212529', marginRight: 'auto' });
        const csvBtn = this._styledButton('Download CSV', '#28a745', '#218838');
        Object.assign(csvBtn.style, { padding: '4px 12px', fontSize: '12px' });
        csvBtn.onclick = () => this._downloadLineCurrentCsv();
        head.append(title, csvBtn);
        section.appendChild(head);

        const hint = document.createElement('div');
        Object.assign(hint.style, { fontSize: '12px', color: '#6c757d', margin: '6px 0 10px', lineHeight: '1.45' });
        hint.textContent = 'Each point is one stored load flow of the study: X = Q at the PCC, Y = P at the PCC, '
            + 'vertical axis = PCC voltage (or loading / current, see below). Colour shows the loading against the '
            + 'line rating (green to orange below it, red above 100 %) or the current; size shows the current. One '
            + 'line gives several rows of points: one row per curve (Q max, Q min, operating point) at each PCC '
            + 'voltage, along the active-power sweep. Each selected line has its own marker shape and its highest '
            + 'current is circled and labelled. Drag to rotate, '
            + 'scroll to zoom, click a point to show that load flow on the diagram. Reads the stored results only.';
        section.appendChild(hint);

        const controls = document.createElement('div');
        Object.assign(controls.style, { display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px', fontSize: '12px' });
        const choice = (title, key, options) => {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const label = document.createElement('span');
            label.textContent = title;
            Object.assign(label.style, { fontWeight: '600', color: '#495057' });
            const group = document.createElement('div');
            Object.assign(group.style, { display: 'inline-flex', border: '1px solid #ced4da', borderRadius: '6px', overflow: 'hidden' });
            const buttons = options.map(([value, text]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                Object.assign(b.style, { padding: '4px 10px', border: 'none', fontSize: '12px', cursor: 'pointer' });
                b.onclick = () => {
                    if (key === '_lcZ' && this[key] !== value && this._lcRange) {
                        this._lcRange.z = [null, null];
                        (this._lcRangeInputs?.z || []).forEach((inp) => { inp.value = ''; });
                    }
                    this[key] = value;
                    paint();
                    this._lcRedraw?.();
                };
                return [value, b];
            });
            const paint = () => buttons.forEach(([value, b]) => {
                const active = (this[key] || options[0][0]) === value;
                b.style.backgroundColor = active ? '#6f42c1' : '#fff';
                b.style.color = active ? '#fff' : '#495057';
                b.style.fontWeight = active ? '600' : '500';
            });
            buttons.forEach(([, b]) => group.appendChild(b));
            paint();
            wrap.append(label, group);
            controls.appendChild(wrap);
        };
        choice('Colour', '_lcColour', [['loading', 'Loading (%)'], ['current', 'Current (kA)']]);
        choice('Vertical axis', '_lcZ', [['u', 'U at PCC (pu)'], ['loading', 'Loading (%)'], ['current', 'Current (kA)']]);
        section.appendChild(controls);

        // Axis ranges: empty = automatic. Changing the vertical-axis quantity clears its range.
        if (!this._lcRange) this._lcRange = { x: [null, null], y: [null, null], z: [null, null] };
        const ranges = document.createElement('div');
        Object.assign(ranges.style, { display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px', fontSize: '12px' });
        const rangeLabel = document.createElement('span');
        rangeLabel.textContent = 'Axis range';
        Object.assign(rangeLabel.style, { fontWeight: '600', color: '#495057' });
        ranges.appendChild(rangeLabel);
        const inputs = {};
        const readNum = (v) => {
            const n = parseFloat(String(v).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        };
        [['x', 'Q (Mvar)'], ['y', 'P (MW)'], ['z', 'Vertical']].forEach(([axisKey, text]) => {
            const wrap = document.createElement('span');
            Object.assign(wrap.style, { display: 'inline-flex', alignItems: 'center', gap: '4px' });
            const lab = document.createElement('span');
            lab.textContent = text;
            lab.style.color = '#495057';
            wrap.appendChild(lab);
            inputs[axisKey] = [0, 1].map((end) => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.inputMode = 'decimal';
                inp.placeholder = end === 0 ? 'min' : 'max';
                inp.title = 'Leave empty for automatic. Press Enter or leave the box to apply.';
                Object.assign(inp.style, { width: '62px', padding: '3px 5px', fontSize: '12px', border: '1px solid #ced4da', borderRadius: '4px' });
                const v = this._lcRange[axisKey][end];
                inp.value = v == null ? '' : String(v);
                const apply = () => {
                    const n = readNum(inp.value);
                    if (inp.value.trim() && n == null) {
                        inp.style.borderColor = '#dc3545';
                        return;
                    }
                    inp.style.borderColor = '#ced4da';
                    if (this._lcRange[axisKey][end] === n) return;
                    this._lcRange[axisKey][end] = n;
                    this._lcRedraw?.();
                };
                inp.onkeydown = (e) => { if (e.key === 'Enter') apply(); };
                inp.onblur = apply;
                wrap.appendChild(inp);
                return inp;
            });
            if (axisKey !== 'z') {
                const dash = document.createElement('span');
                dash.textContent = '';
                wrap.appendChild(dash);
            }
            ranges.appendChild(wrap);
        });
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reset';
        resetBtn.title = 'Automatic range on all axes';
        Object.assign(resetBtn.style, { padding: '3px 10px', fontSize: '12px', border: '1px solid #ced4da', background: '#fff', borderRadius: '4px', cursor: 'pointer' });
        resetBtn.onclick = () => {
            this._lcRange = { x: [null, null], y: [null, null], z: [null, null] };
            Object.values(inputs).flat().forEach((inp) => { inp.value = ''; inp.style.borderColor = '#ced4da'; });
            this._lcRedraw?.();
        };
        ranges.appendChild(resetBtn);
        this._lcRangeInputs = inputs;
        section.appendChild(ranges);

        if (!lines.length) {
            const empty = document.createElement('div');
            empty.textContent = 'No line results are stored with this study. Run it again to refresh the point data.';
            Object.assign(empty.style, { fontSize: '13px', color: '#856404' });
            section.appendChild(empty);
            return;
        }

        const body = document.createElement('div');
        Object.assign(body.style, { display: 'flex', gap: '14px', alignItems: 'stretch', flexWrap: 'wrap' });
        section.appendChild(body);

        // Line picker: sorted by highest current, with a filter box.
        const picker = document.createElement('div');
        Object.assign(picker.style, {
            flex: '0 0 300px', border: '1px solid #e9ecef', borderRadius: '6px', padding: '8px',
            display: 'flex', flexDirection: 'column', maxHeight: '560px'
        });
        const pickTitle = document.createElement('div');
        pickTitle.textContent = `Lines (${lines.length}) — highest current first, up to ${PQ_LC_SYMBOLS.length}`;
        Object.assign(pickTitle.style, { fontSize: '12px', fontWeight: '700', color: '#495057', marginBottom: '6px' });
        const filter = document.createElement('input');
        filter.type = 'search';
        filter.placeholder = 'Filter lines…';
        Object.assign(filter.style, { fontSize: '12px', padding: '4px 6px', border: '1px solid #ced4da', borderRadius: '4px', marginBottom: '6px' });
        const list = document.createElement('div');
        Object.assign(list.style, { overflowY: 'auto', flex: '1 1 auto' });
        picker.append(pickTitle, filter, list);
        body.appendChild(picker);

        const rows = lines.map((line) => {
            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '3px 2px', cursor: 'pointer'
            });
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this._lineCurrentSel.has(line.key);
            cb.onchange = () => {
                if (cb.checked && this._lineCurrentSel.size >= PQ_LC_SYMBOLS.length) {
                    cb.checked = false;
                    alert(`Select up to ${PQ_LC_SYMBOLS.length} lines at a time.`);
                    return;
                }
                if (cb.checked) this._lineCurrentSel.add(line.key);
                else this._lineCurrentSel.delete(line.key);
                this._drawLineCurrent3d(plotDiv, table);
            };
            const name = document.createElement('span');
            name.textContent = line.name;
            Object.assign(name.style, { flex: '1 1 auto' });
            const amps = document.createElement('span');
            amps.textContent = `${_fmt(line.maxA / 1000, 3)} kA`;
            Object.assign(amps.style, { color: '#6c757d', fontVariantNumeric: 'tabular-nums' });
            label.append(cb, name, amps);
            list.appendChild(label);
            return { label, text: String(line.name).toLowerCase() };
        });
        filter.oninput = () => {
            const f = filter.value.trim().toLowerCase();
            rows.forEach((r) => { r.label.style.display = !f || r.text.includes(f) ? 'flex' : 'none'; });
        };

        const plotDiv = document.createElement('div');
        Object.assign(plotDiv.style, { flex: '1 1 600px', minWidth: '420px', height: '560px' });
        body.appendChild(plotDiv);

        const table = document.createElement('div');
        table.style.marginTop = '10px';
        section.appendChild(table);

        this._lcRedraw = () => this._drawLineCurrent3d(plotDiv, table);
        this._lcRedraw();
    }

    async _drawLineCurrent3d(plotDiv, tableHost) {
        const lines = (this._lineCurrents || []).filter((l) => this._lineCurrentSel.has(l.key));
        this._renderLineCurrentTable(tableHost, lines);
        const hasPlot = !!plotDiv._fullLayout;
        if (!lines.length) {
            if (window.Plotly && hasPlot) window.Plotly.purge(plotDiv);
            plotDiv.textContent = 'Tick one or more lines to draw them.';
            Object.assign(plotDiv.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: '13px' });
            return;
        }
        if (!window.Plotly) {
            plotDiv.textContent = 'Loading the 3D chart…';
            try {
                await this._loadPlotly();
            } catch (e) {
                plotDiv.textContent = e.message;
                return;
            }
        }
        // Never clear the text of a live chart: that removes Plotly's canvas and the update draws nothing.
        if (!hasPlot) plotDiv.textContent = '';
        plotDiv.style.display = 'block';

        const colourBy = this._lcColour || 'loading';   // 'loading' | 'current'
        const zBy = this._lcZ || 'u';                    // 'u' | 'loading' | 'current'
        const zOf = (s) => (zBy === 'loading' ? s.loading : zBy === 'current' ? s.currentA / 1000 : s.scenario.voltage);
        const ok = (s) => [s.scenario.q, s.scenario.p, zOf(s), s.currentA].every(Number.isFinite);
        const all = lines.flatMap((l) => l.samples.filter(ok).map((s) => s.currentA));
        const cmin = Math.min(...all);
        const cmaxA = Math.max(...all);
        const span = (cmaxA - cmin) || 1;
        const scenarios = [];
        const traces = [];
        // Colour by loading: against the line's rated current (pandapower max_i_ka), green well inside
        // the rating, yellow / orange close to it, red only above 100 %.
        // Colour by current: kA on the same green-to-red scale, from 0 to the highest current shown.
        const colourOf = (s) => (colourBy === 'current'
            ? s.currentA / 1000
            : (Number.isFinite(s.loading) ? Math.max(0, s.loading) : 0));
        const colourRange = colourBy === 'current' ? [0, cmaxA / 1000] : [0, 100];
        const colorbar = colourBy === 'current'
            ? { title: { text: 'Line current (kA)' }, thickness: 14, len: 0.75 }
            : {
                title: { text: 'Loading (% of rated current)' }, thickness: 14, len: 0.75,
                tickvals: [0, 25, 50, 75, 100], ticktext: ['0', '25', '50', '75', '≥ 100']
            };
        const hoverOf = (line, s, lead = '') => {
            const rated = _lcRatedA(s);
            return `${lead}${line.name}<br>I = ${_fmt(s.currentA / 1000, 3)} kA`
                + (Number.isFinite(rated) ? ` of ${_fmt(rated / 1000, 3)} kA rated` : '')
                + (Number.isFinite(s.loading) ? ` (${_fmt(s.loading, 1)} %${s.loading > 100 ? ', ABOVE RATING' : ''})` : '')
                + `<br>${this._overloadScenarioText(s.scenario)}`;
        };
        lines.forEach((line, i) => {
            const pts = line.samples.filter(ok);
            const custom = pts.map((s) => scenarios.push(s.scenario) - 1);
            traces.push({
                type: 'scatter3d',
                mode: 'markers',
                name: `${line.name} (max ${_fmt(line.maxA / 1000, 3)} kA)`,
                x: pts.map((s) => s.scenario.q),
                y: pts.map((s) => s.scenario.p),
                z: pts.map(zOf),
                customdata: custom,
                text: pts.map((s) => hoverOf(line, s)),
                hovertemplate: '%{text}<extra></extra>',
                marker: {
                    symbol: PQ_LC_SYMBOLS[i % PQ_LC_SYMBOLS.length],
                    size: pts.map((s) => 4 + 8 * (s.currentA - cmin) / span),
                    color: pts.map(colourOf),
                    colorscale: PQ_LC_COLORSCALE,
                    cmin: colourRange[0],
                    cmax: colourRange[1],
                    showscale: i === 0,
                    colorbar: i === 0 ? colorbar : undefined,
                    line: { width: pts.map((s) => (s.loading > 100 ? 2 : 0.5)), color: '#343a40' }
                }
            });
            const w = line.samples.find((s) => s.scenario === line.worst);
            if (w && ok(w)) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers+text',
                    showlegend: false,
                    x: [w.scenario.q],
                    y: [w.scenario.p],
                    z: [zOf(w)],
                    customdata: [scenarios.push(w.scenario) - 1],
                    text: [`${line.name}: ${_fmt(line.maxA / 1000, 3)} kA`],
                    textposition: 'top center',
                    textfont: { size: 11, color: '#212529' },
                    hovertemplate: `${hoverOf(line, w, 'Highest current<br>')}<extra></extra>`,
                    marker: { symbol: 'circle-open', size: 14, color: '#212529', line: { width: 3, color: '#212529' } }
                });
            }
        });
        // Range of one axis: the user's min / max where given; otherwise automatic, except that a
        // (nearly) flat set of values gets a narrow band around it instead of Plotly's 0..2x default.
        const vals = (fn) => lines.flatMap((l) => l.samples.filter(ok).map(fn)).filter(Number.isFinite);
        const rangeFor = (key, values, pad) => {
            const user = this._lcRange?.[key] || [null, null];
            const lo = Math.min(...values);
            const hi = Math.max(...values);
            const flat = !(hi - lo > pad);
            const autoLo = flat ? lo - pad : null;
            const autoHi = flat ? hi + pad : null;
            const r0 = user[0] != null ? user[0] : autoLo;
            const r1 = user[1] != null ? user[1] : autoHi;
            if (r0 == null && r1 == null) return { autorange: true };
            const a = r0 != null ? r0 : lo - (hi - lo) * 0.05;
            const b = r1 != null ? r1 : hi + (hi - lo) * 0.05;
            return a < b ? { range: [a, b], autorange: false } : { autorange: true };
        };
        const zPad = zBy === 'loading' ? 5 : zBy === 'current' ? 0.05 : 0.05;
        const axis = (text, extra = {}) => ({ title: { text }, gridcolor: '#e9ecef', zerolinecolor: '#adb5bd', backgroundcolor: '#fff', ...extra });
        const zTitle = zBy === 'loading' ? 'Loading (% of rated current)' : zBy === 'current' ? 'Line current (kA)' : 'U at PCC (pu)';
        const layout = {
            margin: { l: 0, r: 0, t: 10, b: 0 },
            legend: { orientation: 'h', y: 1.02, x: 0, font: { size: 11 } },
            uirevision: 'line-current-3d',  // keep the user's rotation and zoom between updates
            scene: {
                xaxis: axis('Q at PCC (Mvar): − inductive / + capacitive', rangeFor('x', vals((s) => s.scenario.q), 1)),
                yaxis: axis('P at PCC (MW)', rangeFor('y', vals((s) => s.scenario.p), 1)),
                zaxis: axis(zTitle, rangeFor('z', vals(zOf), zPad)),
                camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } }
            },
            paper_bgcolor: '#fff'
        };
        await window.Plotly.react(plotDiv, traces, layout, { responsive: true, displaylogo: false });
        plotDiv.removeAllListeners?.('plotly_click');
        plotDiv.on('plotly_click', (ev) => {
            const idx = ev?.points?.[0]?.customdata;
            const scenario = Number.isInteger(idx) ? scenarios[idx] : null;
            if (scenario) this._showOverloadScenario(scenario);
        });
    }

    _renderLineCurrentTable(host, lines) {
        host.replaceChildren();
        if (!lines.length) return;
        const sub = document.createElement('div');
        sub.textContent = 'Highest current of each selected line';
        Object.assign(sub.style, { fontWeight: '600', fontSize: '12px', color: '#495057' });
        host.appendChild(sub);
        host.appendChild(this._overloadTable(
            ['Line', 'Highest current', 'Rated current', 'Loading at that point', 'Worst case', 'Load flows', ''],
            lines.map((line) => [
                line.name,
                `${_fmt(line.maxA / 1000, 3)} kA`,
                Number.isFinite(_lcRatedA({ currentA: line.maxA, loading: line.maxLoading }))
                    ? `${_fmt(_lcRatedA({ currentA: line.maxA, loading: line.maxLoading }) / 1000, 3)} kA` : '—',
                Number.isFinite(line.maxLoading) ? this._loadingText(line.maxLoading, 100) : '—',
                line.worst ? this._overloadScenarioText(line.worst) : '—',
                String(line.samples.length),
                line.worst ? this._overloadShowButton(line.worst) : ''
            ])
        ));
    }

    _downloadLineCurrentCsv() {
        const lines = (this._lineCurrents || []).filter((l) => this._lineCurrentSel?.has(l.key));
        if (!lines.length) {
            alert('Tick one or more lines first.');
            return;
        }
        let csv = 'Line,U_pu,Curve,P_PCC_MW,Q_PCC_Mvar,Current_A,Rated_current_A,Loading_pct\n';
        lines.forEach((line) => line.samples.forEach((s) => {
            csv += [line.name, s.scenario.voltage, this._overloadSideLabel(s.scenario.side), _fmt(s.scenario.p, 3),
                _fmt(s.scenario.q, 3), _fmt(s.currentA, 1), _fmt(_lcRatedA(s), 1), _fmt(s.loading, 2)].map(_csvEscape).join(',') + '\n';
        }));
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this._reportFilePrefix ? this._reportFilePrefix() : 'GridCode_PQ'}_line_currents_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
        csv += this._overloadCsvText();
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

// Shared with the U-Q results dialog (element Q grouping, labels and colours).
export {
    _aggregateContribution, _chartOperatingQ, _contributionLabel, _operatingWords, _pccQDirection, _fmt,
    PQ_Q_TYPE_ORDER, PQ_Q_TYPE_COLOR, PQ_Q_TYPE_PALETTE
};
