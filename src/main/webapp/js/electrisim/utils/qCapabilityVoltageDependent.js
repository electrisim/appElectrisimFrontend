/**
 * Voltage-dependent Q capability: Qmin/Qmax as a function of P and terminal voltage U.
 * Axes and matrix values are stored in p.u. of Sn. Display may convert to MW/Mvar.
 */

/** Fully rated converter WTG ~2.5 MW 50 Hz (typical default P–U Q capability shape). */
export const DEFAULT_QCAP_U_PU = [0.9, 0.95, 1.0, 1.05, 1.08, 1.09, 1.095];
export const DEFAULT_QCAP_P_PU = [0, 0.2, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1];

/** Qmax [p.u.] rows = U, columns = P */
export const DEFAULT_QCAP_QMAX_PU = [
    [0.41, 0.41, 0.41, 0.41, 0.41, 0.4, 0.38, 0.33, 0.22, 0.12, 0],
    [0.43, 0.43, 0.43, 0.43, 0.43, 0.42, 0.4, 0.35, 0.24, 0.13, 0],
    [0.44, 0.44, 0.44, 0.44, 0.44, 0.43, 0.41, 0.36, 0.25, 0.14, 0],
    [0.4, 0.4, 0.4, 0.4, 0.4, 0.39, 0.37, 0.32, 0.22, 0.12, 0],
    [0.28, 0.28, 0.28, 0.28, 0.28, 0.27, 0.25, 0.22, 0.15, 0.08, 0],
    [0.18, 0.18, 0.18, 0.18, 0.18, 0.17, 0.16, 0.14, 0.09, 0.05, 0],
    [0.1, 0.1, 0.1, 0.1, 0.1, 0.09, 0.08, 0.07, 0.05, 0.02, 0]
];

/** Qmin [p.u.] rows = U, columns = P (underexcited / absorbing) */
export const DEFAULT_QCAP_QMIN_PU = [
    [-0.18, -0.18, -0.18, -0.18, -0.18, -0.17, -0.16, -0.14, -0.09, -0.05, 0],
    [-0.38, -0.38, -0.38, -0.38, -0.38, -0.37, -0.35, -0.3, -0.2, -0.1, 0],
    [-0.44, -0.44, -0.44, -0.44, -0.44, -0.43, -0.41, -0.36, -0.25, -0.14, 0],
    [-0.44, -0.44, -0.44, -0.44, -0.44, -0.43, -0.41, -0.36, -0.25, -0.14, 0],
    [-0.44, -0.44, -0.44, -0.44, -0.44, -0.43, -0.41, -0.36, -0.25, -0.14, 0],
    [-0.4, -0.4, -0.4, -0.4, -0.4, -0.39, -0.37, -0.32, -0.22, -0.12, 0],
    [-0.32, -0.32, -0.32, -0.32, -0.32, -0.31, -0.29, -0.25, -0.16, -0.08, 0]
];

export function defaultQCap2dState() {
    return {
        u: DEFAULT_QCAP_U_PU.slice(),
        p: DEFAULT_QCAP_P_PU.slice(),
        qmax: DEFAULT_QCAP_QMAX_PU.map((row) => row.slice()),
        qmin: DEFAULT_QCAP_QMIN_PU.map((row) => row.slice()),
        inputModel: 'pu',
        voltageDependent: true,
        scaleMinPercent: 100,
        scaleMaxPercent: 100
    };
}

/** True when a flattened 1D JSON is the old 15 MW park-level curve on a ~2.5 MW unit. */
export function isLegacyParkScaledQCurve(curveJson, snMva) {
    let pts;
    try {
        pts = typeof curveJson === 'string' ? JSON.parse(curveJson || '[]') : curveJson;
    } catch {
        return false;
    }
    if (!Array.isArray(pts) || pts.length < 2) return false;
    const sn = Number(snMva);
    const pVals = pts
        .map((pt) => Number(pt?.p_mw))
        .filter((p) => Number.isFinite(p));
    if (!pVals.length) return false;
    const maxP = Math.max(...pVals);
    if (Number.isFinite(sn) && sn > 0 && maxP > sn * 1.5) return true;
    // Exact legacy 15 MW offshore WTG template (0, 3.75, 7.5, 11.25, 15 MW)
    const legacyP = [0, 3.75, 7.5, 11.25, 15];
    if (pVals.length === legacyP.length && legacyP.every((p, i) => Math.abs(pVals[i] - p) < 0.01)) {
        return true;
    }
    return false;
}

function parseJsonArray(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(v) ? v : fallback;
    } catch {
        return fallback;
    }
}

function toNumArr(arr) {
    return (arr || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
}

function reshapeMatrix(raw, nU, nP, fill = 0) {
    const out = [];
    const src = Array.isArray(raw) ? raw : [];
    for (let i = 0; i < nU; i++) {
        const rowSrc = Array.isArray(src[i]) ? src[i] : [];
        const row = [];
        for (let j = 0; j < nP; j++) {
            const v = Number(rowSrc[j]);
            row.push(Number.isFinite(v) ? v : fill);
        }
        out.push(row);
    }
    return out;
}

/**
 * Load 2D Q capability from cell attributes / form values.
 * Falls back to converting a 1D P–Q JSON curve to a single U=1.0 row.
 */
export function loadQCap2dFromAttrs(attrs, snMva) {
    const d = defaultQCap2dState();
    const u = toNumArr(parseJsonArray(attrs.q_cap_u_json, null));
    const p = toNumArr(parseJsonArray(attrs.q_cap_p_json, null));
    const qmax = parseJsonArray(attrs.q_cap_qmax_json, null);
    const qmin = parseJsonArray(attrs.q_cap_qmin_json, null);
    if (u.length >= 1 && p.length >= 2 && Array.isArray(qmax) && Array.isArray(qmin)) {
        d.u = u;
        d.p = p;
        d.qmax = reshapeMatrix(qmax, u.length, p.length, 0);
        d.qmin = reshapeMatrix(qmin, u.length, p.length, 0);
    } else {
        const legacy = isLegacyParkScaledQCurve(attrs.q_capability_curve_json, snMva);
        if (!legacy) {
            const from1d = oneDCurveTo2d(attrs.q_capability_curve_json, snMva);
            if (from1d) Object.assign(d, from1d);
        }
        // Legacy park-scaled 1D on a single WTG: keep defaultQCap2dState() (2.5 MW FRC WTG P–U table).
    }
    const im = String(attrs.q_cap_input_model || d.inputModel).toLowerCase();
    d.inputModel = im === 'mw_mvar' || im === 'mw/mvar' ? 'mw_mvar' : 'pu';
    const vd = attrs.q_cap_voltage_dependent;
    if (vd != null && vd !== '') {
        d.voltageDependent = vd === true || vd === 'true' || vd === '1';
    }
    const smin = Number(attrs.q_cap_scale_min_percent);
    const smax = Number(attrs.q_cap_scale_max_percent);
    if (Number.isFinite(smin)) d.scaleMinPercent = smin;
    if (Number.isFinite(smax)) d.scaleMaxPercent = smax;
    return d;
}

export function oneDCurveTo2d(curveJson, snMva) {
    let pts;
    try {
        pts = typeof curveJson === 'string' ? JSON.parse(curveJson || '[]') : curveJson;
    } catch {
        return null;
    }
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const sn = Number(snMva);
    const base = Number.isFinite(sn) && sn > 0 ? sn : 1;
    const p = [];
    const qmax = [];
    const qmin = [];
    const sorted = pts
        .map((pt) => ({
            p: Number(pt.p_mw),
            qn: Number(pt.q_min_mvar),
            qx: Number(pt.q_max_mvar)
        }))
        .filter((pt) => Number.isFinite(pt.p) && Number.isFinite(pt.qn) && Number.isFinite(pt.qx))
        .sort((a, b) => a.p - b.p);
    if (sorted.length < 2) return null;
    for (const pt of sorted) {
        p.push(pt.p / base);
        qmax.push(pt.qx / base);
        qmin.push(pt.qn / base);
    }
    return {
        u: [1],
        p,
        qmax: [qmax],
        qmin: [qmin],
        voltageDependent: false
    };
}

export function serializeQCap2d(state) {
    return {
        q_cap_u_json: JSON.stringify(state.u),
        q_cap_p_json: JSON.stringify(state.p),
        q_cap_qmax_json: JSON.stringify(state.qmax),
        q_cap_qmin_json: JSON.stringify(state.qmin),
        q_cap_input_model: state.inputModel || 'pu',
        q_cap_voltage_dependent: state.voltageDependent !== false ? 'true' : 'false',
        q_cap_scale_min_percent: String(state.scaleMinPercent ?? 100),
        q_cap_scale_max_percent: String(state.scaleMaxPercent ?? 100)
    };
}

function interp1d(xs, ys, x) {
    if (!xs.length || xs.length !== ys.length) return null;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (let i = 0; i < xs.length - 1; i++) {
        if (x >= xs[i] && x <= xs[i + 1]) {
            const span = xs[i + 1] - xs[i];
            if (Math.abs(span) < 1e-15) return ys[i];
            const t = (x - xs[i]) / span;
            return ys[i] + t * (ys[i + 1] - ys[i]);
        }
    }
    return ys[ys.length - 1];
}

/**
 * Interpolate Qmin/Qmax [p.u.] at (p_pu, u_pu).
 */
export function interpQCap2dPu(state, pPu, uPu) {
    if (!state?.p?.length || !state?.u?.length) return null;
    const p = Number(pPu);
    let u = Number(uPu);
    if (!Number.isFinite(p)) return null;
    if (!state.voltageDependent || state.u.length === 1 || !Number.isFinite(u)) {
        u = state.u.length === 1 ? state.u[0] : 1;
        const rowU = nearestIndex(state.u, u);
        const qmax = interp1d(state.p, state.qmax[rowU], p);
        const qmin = interp1d(state.p, state.qmin[rowU], p);
        if (qmax == null || qmin == null) return null;
        return { qminPu: qmin, qmaxPu: qmax };
    }
    const uArr = state.u;
    if (u <= uArr[0]) {
        return {
            qmaxPu: interp1d(state.p, state.qmax[0], p),
            qminPu: interp1d(state.p, state.qmin[0], p)
        };
    }
    if (u >= uArr[uArr.length - 1]) {
        const last = uArr.length - 1;
        return {
            qmaxPu: interp1d(state.p, state.qmax[last], p),
            qminPu: interp1d(state.p, state.qmin[last], p)
        };
    }
    let i = 0;
    for (; i < uArr.length - 1; i++) {
        if (u >= uArr[i] && u <= uArr[i + 1]) break;
    }
    const span = uArr[i + 1] - uArr[i];
    const t = Math.abs(span) < 1e-15 ? 0 : (u - uArr[i]) / span;
    const qmax0 = interp1d(state.p, state.qmax[i], p);
    const qmax1 = interp1d(state.p, state.qmax[i + 1], p);
    const qmin0 = interp1d(state.p, state.qmin[i], p);
    const qmin1 = interp1d(state.p, state.qmin[i + 1], p);
    if ([qmax0, qmax1, qmin0, qmin1].some((v) => v == null)) return null;
    return {
        qmaxPu: qmax0 + t * (qmax1 - qmax0),
        qminPu: qmin0 + t * (qmin1 - qmin0)
    };
}

function nearestIndex(arr, x) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < arr.length; i++) {
        const d = Math.abs(arr[i] - x);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

/**
 * Qmin/Qmax in Mvar at operating point (P MW, U pu), including scale factors.
 */
export function interpQCap2dMvar(state, pMw, vmPu, snMva) {
    const sn = Number(snMva);
    const base = Number.isFinite(sn) && sn > 0 ? sn : 1;
    const pPu = Number(pMw) / base;
    const lim = interpQCap2dPu(state, pPu, vmPu);
    if (!lim) return null;
    const smin = Number(state.scaleMinPercent);
    const smax = Number(state.scaleMaxPercent);
    const kmin = Number.isFinite(smin) ? smin / 100 : 1;
    const kmax = Number.isFinite(smax) ? smax / 100 : 1;
    return {
        q_min_mvar: lim.qminPu * base * kmin,
        q_max_mvar: lim.qmaxPu * base * kmax
    };
}

/** Flatten 2D table at U=1.0 pu (or nearest) to 1D pandapower P–Q points. */
export function flattenQCap2dToPqPoints(state, snMva) {
    const sn = Number(snMva);
    const base = Number.isFinite(sn) && sn > 0 ? sn : 1;
    const smin = Number.isFinite(Number(state.scaleMinPercent)) ? Number(state.scaleMinPercent) / 100 : 1;
    const smax = Number.isFinite(Number(state.scaleMaxPercent)) ? Number(state.scaleMaxPercent) / 100 : 1;
    const points = [];
    for (const pPu of state.p) {
        const lim = interpQCap2dPu(state, pPu, 1);
        if (!lim) continue;
        points.push({
            p_mw: pPu * base,
            q_min_mvar: lim.qminPu * base * smin,
            q_max_mvar: lim.qmaxPu * base * smax
        });
    }
    return points;
}

export function insertAxisValue(arr, value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return arr.length - 1;
    const next = arr.slice();
    let i = 0;
    while (i < next.length && next[i] < v) i++;
    if (next[i] === v) return i;
    next.splice(i, 0, v);
    arr.length = 0;
    next.forEach((x) => arr.push(x));
    return i;
}

export function insertMatrixColumn(matrix, colIdx, fillFrom) {
    for (const row of matrix) {
        const v = fillFrom != null && Number.isFinite(row[fillFrom]) ? row[fillFrom] : 0;
        row.splice(colIdx, 0, v);
    }
}

export function insertMatrixRow(matrix, rowIdx, nCols, fillFrom) {
    const src = fillFrom != null && matrix[fillFrom] ? matrix[fillFrom] : null;
    const row = [];
    for (let j = 0; j < nCols; j++) {
        row.push(src && Number.isFinite(src[j]) ? src[j] : 0);
    }
    matrix.splice(rowIdx, 0, row);
}

export const QCAP_PLOT_COLORS = [
    '#81d4fa',
    '#66bb6a',
    '#1565c0',
    '#ffb74d',
    '#ce93d8',
    '#f9a825',
    '#ad1457',
    '#00838f',
    '#6d4c41'
];
