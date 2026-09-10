/**
 * Storage P–Q capability (Qmin/Qmax vs |P|) — shared frontend helpers.
 */
import {
    qCapabilityCurve15MwOffshoreWtgPoints,
    scaleQCapabilityPointsForPlantRating,
    interpQCapabilityAtP,
    computeEffectiveSgenQSetpoint
} from '../staticGeneratorDialog.js';

export function defaultStorageQCapabilityJson(pRatedMw) {
    const p = Math.abs(parseFloat(pRatedMw) || 50);
    const scale = p / 15;
    return JSON.stringify(scaleQCapabilityPointsForPlantRating(qCapabilityCurve15MwOffshoreWtgPoints, scale));
}

function parseCurvePoints(raw) {
    if (!raw) return null;
    try {
        const pts = JSON.parse(String(raw).trim());
        if (!Array.isArray(pts) || pts.length < 2) return null;
        return pts;
    } catch {
        return null;
    }
}

/** Interpolate Q band at |p_mw| from Storage curve attributes. */
export function storageQBandAtP(p_mw, attrs = {}) {
    const curveOn = attrs.reactive_capability_curve === true
        || String(attrs.reactive_capability_curve || '').toLowerCase() === 'true';
    if (!curveOn) return null;
    const pts = parseCurvePoints(attrs.q_capability_curve_json);
    if (!pts) return null;
    const pAbs = Math.abs(parseFloat(p_mw) || 0);
    const style = attrs.curve_style || 'straightLineYValues';
    const qMin = interpQCapabilityAtP(pts, pAbs, 'q_min_mvar', style);
    const qMax = interpQCapabilityAtP(pts, pAbs, 'q_max_mvar', style);
    if (qMin == null || qMax == null) return null;
    return { q_min_mvar: qMin, q_max_mvar: qMax };
}

/** Effective Q for load flow when curve + setpoint mode is used (symmetric vs |P|). */
export function resolveStorageQSetpoint(p_mw, attrs = {}) {
    const curveOn = String(attrs.reactive_capability_curve || '').toLowerCase() === 'true'
        || attrs.reactive_capability_curve === true;
    const pts = parseCurvePoints(attrs.q_capability_curve_json) || [];
    const pAbs = Math.abs(parseFloat(p_mw) || 0);
    const result = computeEffectiveSgenQSetpoint({
        pMw: pAbs,
        qMvar: parseFloat(attrs.q_mvar) || 0,
        qSetpointMode: attrs.q_setpoint_mode || 'manual',
        reactiveCapabilityCurve: curveOn,
        curveStyle: attrs.curve_style || 'straightLineYValues',
        curvePoints: pts
    });
    return result;
}
