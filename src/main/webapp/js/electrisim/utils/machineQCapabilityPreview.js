/**
 * Operating P and Qmin/Qmax preview for park controller / plant control UIs.
 */
import { interpQCapabilityAtP } from '../staticGeneratorDialog.js';
import {
    computeWindTurbinePMw,
    defaultWindPowerCurveJson,
    DEFAULT_WIND_SPEED_MS
} from '../windTurbineDialog.js';
import { loadQCap2dFromAttrs, interpQCap2dMvar } from './qCapabilityVoltageDependent.js';

const WIND_ATTR_KEYS = [
    'name',
    'p_mw',
    'sn_mva',
    'max_p_mw',
    'wind_speed_ms',
    'wind_power_curve_json',
    'wind_curve_approx',
    'reactive_capability_curve',
    'q_capability_curve_json',
    'curve_style',
    'q_cap_u_json',
    'q_cap_p_json',
    'q_cap_qmax_json',
    'q_cap_qmin_json',
    'q_cap_voltage_dependent',
    'q_cap_input_model',
    'q_cap_scale_min_percent',
    'q_cap_scale_max_percent'
];

/** Read mxGraph cell attributes (NamedNodeMap + getAttribute fallback). */
export function cellAttrMap(cell) {
    const m = {};
    const val = cell?.value;
    if (!val) return m;
    if (val.attributes?.length) {
        for (let i = 0; i < val.attributes.length; i++) {
            const a = val.attributes[i];
            if (a?.name) m[a.name] = a.value;
        }
    }
    if (typeof val.getAttribute === 'function') {
        for (const k of WIND_ATTR_KEYS) {
            if (m[k] === undefined) {
                const v = val.getAttribute(k);
                if (v != null) m[k] = v;
            }
        }
    }
    return m;
}

/** Active power [MW] for Q-at-P preview (Wind Turbine: wind curve, same as Wind Turbine dialog). */
export function machineOperatingPMw(typ, attrs) {
    if (typ !== 'Wind Turbine') {
        const p = Number(attrs.p_mw);
        return Number.isFinite(p) ? p : 0;
    }
    const vRaw = attrs.wind_speed_ms;
    const v =
        vRaw != null && String(vRaw).trim() !== '' ? Number(vRaw) : DEFAULT_WIND_SPEED_MS;
    const curveRaw = attrs.wind_power_curve_json;
    const curve =
        curveRaw != null && String(curveRaw).trim() !== ''
            ? curveRaw
            : defaultWindPowerCurveJson;
    const approx = attrs.wind_curve_approx || 'linear';
    if (Number.isFinite(v)) {
        const pWind = computeWindTurbinePMw(v, curve, approx);
        if (Number.isFinite(pWind)) return pWind;
    }
    const p = Number(attrs.p_mw);
    return Number.isFinite(p) ? p : 0;
}

/** Qmin/Qmax [Mvar] at operating P (U = 1.0 p.u. for voltage-dependent tables). */
export function machineQCapabilityBand(attrs, pMw) {
    const sn = Number(attrs.sn_mva);
    const baseSn = Number.isFinite(sn) && sn > 0 ? sn : 2.5;
    const qCapOn =
        attrs.reactive_capability_curve === true || attrs.reactive_capability_curve === 'true';
    const curveStyle = attrs.curve_style || 'straightLineYValues';

    const qCap2d = loadQCap2dFromAttrs(attrs, baseSn);
    const has2d =
        Array.isArray(qCap2d?.p) &&
        qCap2d.p.length >= 2 &&
        Array.isArray(qCap2d?.qmax) &&
        Array.isArray(qCap2d?.qmin);
    if (qCapOn || has2d) {
        const lim = interpQCap2dMvar(qCap2d, pMw, 1.0, baseSn);
        if (lim && Number.isFinite(lim.q_min_mvar) && Number.isFinite(lim.q_max_mvar)) {
            return {
                q_min_mvar: lim.q_min_mvar,
                q_max_mvar: lim.q_max_mvar,
                has_q_capability: true
            };
        }
    }

    const qCapJson = attrs.q_capability_curve_json;
    if (qCapJson) {
        try {
            const pts = JSON.parse(qCapJson);
            if (Array.isArray(pts) && pts.length >= 2) {
                const qMin = interpQCapabilityAtP(pts, pMw, 'q_min_mvar', curveStyle);
                const qMax = interpQCapabilityAtP(pts, pMw, 'q_max_mvar', curveStyle);
                if (qMin != null && qMax != null) {
                    return {
                        q_min_mvar: qMin,
                        q_max_mvar: qMax,
                        has_q_capability: qCapOn || true
                    };
                }
            }
        } catch {
            /* ignore */
        }
    }
    return { q_min_mvar: null, q_max_mvar: null, has_q_capability: false };
}

export function listMachineCandidates(graph) {
    const out = [];
    if (!graph?.getModel) return out;
    const cells = graph.getModel().getDescendants?.() || [];
    const allowed = new Set(['Wind Turbine', 'Static Generator', 'Generator', 'PVSystem', 'PV System']);
    for (const cell of cells) {
        const style = cell.getStyle?.() || '';
        const m = style.match(/shapeELXXX=([^;]+)/);
        if (!m || !allowed.has(m[1])) continue;
        const attrs = cellAttrMap(cell);
        let name = attrs.name;
        if (!name) name = (cell.mxObjectId || cell.id || '').toString().replace('#', '_');
        const typ = m[1];
        const pMw = machineOperatingPMw(typ, attrs);
        const qBand = machineQCapabilityBand(attrs, pMw);
        out.push({
            name,
            typ,
            sn_mva: attrs.sn_mva,
            p_mw: pMw,
            has_q_capability: qBand.has_q_capability,
            q_min_mvar: qBand.q_min_mvar,
            q_max_mvar: qBand.q_max_mvar
        });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
}
