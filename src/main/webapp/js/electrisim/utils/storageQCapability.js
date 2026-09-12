/**
 * Storage P–Q capability — four-quadrant PCS envelope (not the wind-turbine ±0.95 PF triangle).
 */
import { interpQCapabilityAtP, computeEffectiveSgenQSetpoint } from '../staticGeneratorDialog.js';

export const BESS_PCS_CIRCLE = 'pcs_circle';
export const BESS_PCS_D_SHAPE = 'pcs_d_shape';
export const BESS_PCS_CUSTOM = 'custom';
export const BESS_D_SHAPE_Q_FLAT_PU = 0.9;

function _num(v, fallback = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

function _round6(x) {
    return Math.round(Number(x) * 1e6) / 1e6;
}

/** Rated Sn and |P|max for the PCS envelope. */
export function resolveBessPcsRatings({ sn_mva, p_mw, max_p_mw, min_p_mw } = {}) {
    let sn = Math.abs(_num(sn_mva));
    const pCharge = Math.abs(_num(max_p_mw));
    const pDischarge = Math.abs(_num(min_p_mw));
    const pMom = Math.abs(_num(p_mw));
    let pMax = Math.max(pCharge, pDischarge);
    if (pMax <= 0) pMax = pMom;
    if (sn <= 0 && pMax > 0) sn = pMax;
    if (pMax <= 0 && sn > 0) pMax = sn;
    if (sn <= 0) {
        sn = 50;
        pMax = 50;
    }
    if (pMax > sn) pMax = sn;
    return { sn, pMax };
}

export function bessPcsQAbs(pMw, sn, preset = BESS_PCS_CIRCLE) {
    const s = Math.abs(_num(sn));
    if (s <= 0) return 0;
    let p = _num(pMw);
    if (Math.abs(p) > s) p = Math.sign(p) * s;
    const qCirc = Math.sqrt(Math.max(0, s * s - p * p));
    if (preset === BESS_PCS_D_SHAPE) {
        return Math.min(BESS_D_SHAPE_Q_FLAT_PU * s, qCirc);
    }
    return qCirc;
}

/**
 * Four-quadrant PCS points: P from −Pmax (discharge) to +Pmax (charge).
 * Circle: Q = ±√(Sn²−P²). D-shape: flat Q at 0.9·Sn until the current circle binds.
 */
export function buildBessPcsEnvelopePoints(snMva, pRatedMw, preset = BESS_PCS_CIRCLE, nHalf = 16) {
    const { sn, pMax } = resolveBessPcsRatings({ sn_mva: snMva, p_mw: pRatedMw });
    const shape = preset === BESS_PCS_D_SHAPE ? BESS_PCS_D_SHAPE : BESS_PCS_CIRCLE;
    const pts = [];
    const n = nHalf * 2;
    for (let i = 0; i <= n; i++) {
        const p = -pMax + (2 * pMax * i) / n;
        const q = bessPcsQAbs(p, sn, shape);
        pts.push({
            p_mw: _round6(p),
            q_min_mvar: _round6(-q),
            q_max_mvar: _round6(q)
        });
    }
    return pts;
}

export function defaultStorageQCapabilityJson(snMva, pMw) {
    const { sn, pMax } = resolveBessPcsRatings({ sn_mva: snMva, p_mw: pMw });
    return JSON.stringify(buildBessPcsEnvelopePoints(sn, pMax, BESS_PCS_CIRCLE));
}

export function parseCurvePoints(raw) {
    if (!raw) return null;
    try {
        const pts = JSON.parse(String(raw).trim());
        if (!Array.isArray(pts) || pts.length < 2) return null;
        const out = [];
        for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            if (!pt || typeof pt !== 'object') continue;
            const p = Number(pt.p_mw);
            const qMin = Number(pt.q_min_mvar);
            const qMax = Number(pt.q_max_mvar);
            if (!Number.isFinite(p) || !Number.isFinite(qMin) || !Number.isFinite(qMax)) continue;
            out.push({ p_mw: p, q_min_mvar: qMin, q_max_mvar: qMax });
        }
        if (out.length < 2) return null;
        out.sort((a, b) => a.p_mw - b.p_mw);
        return out;
    } catch {
        return null;
    }
}

/** Old Storage default: ±0.95 PF triangle (Q≈0 at idle). That is a wind-plant model, not a PCS. */
export function looksLikeWtgPfTriangle(pts) {
    if (!Array.isArray(pts) || pts.length < 2) return false;
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.p_mw > 1e-6) return false;
    const q0 = Math.max(Math.abs(first.q_min_mvar), Math.abs(first.q_max_mvar));
    const q1 = Math.max(Math.abs(last.q_min_mvar), Math.abs(last.q_max_mvar));
    return q0 < 0.05 * Math.max(q1, 1) && q1 > q0 + 0.1;
}

function _curveOn(attrs) {
    return attrs.reactive_capability_curve === true
        || String(attrs.reactive_capability_curve || '').toLowerCase() === 'true';
}

/** Interpolate Q band at operating P (signed if the table has negative P). */
export function storageQBandAtP(p_mw, attrs = {}) {
    if (!_curveOn(attrs)) return null;
    const pts = parseCurvePoints(attrs.q_capability_curve_json);
    if (!pts) return null;
    const style = attrs.curve_style || 'straightLineYValues';
    const signed = pts[0].p_mw < -1e-9;
    const pQuery = signed ? _num(p_mw) : Math.abs(_num(p_mw));
    const qMin = interpQCapabilityAtP(pts, pQuery, 'q_min_mvar', style);
    const qMax = interpQCapabilityAtP(pts, pQuery, 'q_max_mvar', style);
    if (qMin == null || qMax == null) return null;
    return { q_min_mvar: qMin, q_max_mvar: qMax };
}

/** Effective Q for load flow when curve + setpoint mode is used. */
export function resolveStorageQSetpoint(p_mw, attrs = {}) {
    const pts = parseCurvePoints(attrs.q_capability_curve_json) || [];
    const signed = pts.length >= 2 && pts[0].p_mw < -1e-9;
    const pQuery = signed ? _num(p_mw) : Math.abs(_num(p_mw));
    return computeEffectiveSgenQSetpoint({
        pMw: pQuery,
        qMvar: parseFloat(attrs.q_mvar) || 0,
        qSetpointMode: attrs.q_setpoint_mode || 'manual',
        reactiveCapabilityCurve: _curveOn(attrs),
        curveStyle: attrs.curve_style || 'straightLineYValues',
        curvePoints: pts
    });
}
