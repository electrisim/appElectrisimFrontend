/**
 * Apply enabled Wind Turbine Controllers to Wind Turbine payloads (snapshot Pref from P(v)).
 */
import { computeWindTurbinePMw } from '../windTurbineDialog.js';

function parseCellStyle(style) {
    if (!style) return null;
    const o = {};
    String(style).split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) o[part.slice(0, i)] = part.slice(i + 1);
    });
    return o;
}

function cellAttr(cell, name) {
    if (!cell?.value?.getAttribute) return undefined;
    return cell.value.getAttribute(name);
}

/** Explicit bool from XML/JSON attrs (default when missing/empty). */
function attrBool(v, defaultValue = true) {
    if (v == null || v === '') return defaultValue;
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    return defaultValue;
}

/**
 * Collect enabled WindTurbineController cells from the graph.
 * @param {Object} graph
 * @returns {Array<Object>}
 */
export function collectWindTurbineControllers(graph) {
    const out = [];
    if (!graph?.getModel) return out;
    const cells = graph.getModel().getDescendants?.() || [];
    for (const cell of cells) {
        const style = parseCellStyle(cell.getStyle?.() || '') || {};
        if (style.shapeELXXX !== 'WindTurbineController') continue;
        const enabled = cellAttr(cell, 'enabled');
        if (enabled != null && !attrBool(enabled, true)) continue;
        out.push({
            name: cellAttr(cell, 'name') || '',
            wind_turbine: cellAttr(cell, 'wind_turbine') || '',
            power_curve_type: cellAttr(cell, 'power_curve_type') || 'Turbine Power Curve',
            wind_speed_ms: cellAttr(cell, 'wind_speed_ms'),
            use_turbine_wind_speed: attrBool(cellAttr(cell, 'use_turbine_wind_speed'), true),
            wind_power_curve_json: cellAttr(cell, 'wind_power_curve_json'),
            wind_curve_approx: cellAttr(cell, 'wind_curve_approx') || 'linear',
            enabled: true
        });
    }
    return out;
}

/**
 * Collect enabled WindTurbineDynamicController cells (documented in export; not applied to snapshot LF).
 * @param {Object} graph
 * @returns {Array<Object>}
 */
export function collectWindTurbineDynamicControllers(graph) {
    const out = [];
    if (!graph?.getModel) return out;
    const cells = graph.getModel().getDescendants?.() || [];
    for (const cell of cells) {
        const style = parseCellStyle(cell.getStyle?.() || '') || {};
        if (style.shapeELXXX !== 'WindTurbineDynamicController') continue;
        const enabled = cellAttr(cell, 'enabled');
        if (enabled != null && !attrBool(enabled, true)) continue;
        out.push({
            typ: 'WindTurbineDynamicController',
            name: cellAttr(cell, 'name') || 'WindTurbineController (dynamic)',
            id: cell.mxObjectId || cell.id,
            wind_turbine: cellAttr(cell, 'wind_turbine') || '',
            enabled: true,
            wind_avg_T: cellAttr(cell, 'wind_avg_T') || '1',
            wind_avg_Tavg: cellAttr(cell, 'wind_avg_Tavg') || '10',
            power_avg_T: cellAttr(cell, 'power_avg_T') || '1',
            power_avg_Tavg: cellAttr(cell, 'power_avg_Tavg') || '10',
            gradient_T: cellAttr(cell, 'gradient_T') || '1',
            gradient_max: cellAttr(cell, 'gradient_max') || '0.5'
        });
    }
    return out;
}

/**
 * Payload objects for LF / Python & results export (steady-state + dynamic).
 * @param {Object} graph
 * @returns {Array<Object>}
 */
export function collectWindTurbineControllersForPayload(graph) {
    const ss = collectWindTurbineControllers(graph).map((c) => ({
        typ: 'WindTurbineController',
        id: c.id,
        name: c.name || 'WindTurbineController (steady-state)',
        wind_turbine: c.wind_turbine,
        enabled: true,
        power_curve_type: c.power_curve_type,
        wind_speed_ms: c.wind_speed_ms,
        use_turbine_wind_speed: c.use_turbine_wind_speed,
        wind_power_curve_json: c.wind_power_curve_json,
        wind_curve_approx: c.wind_curve_approx
    }));
    return ss.concat(collectWindTurbineDynamicControllers(graph));
}

/**
 * Mutate wind turbine / static-generator payload objects: set p_mw from controller Pref.
 * Matches controller.wind_turbine to payload.userFriendlyName or payload.name.
 * @param {Array<Object>} windLikePayloads
 * @param {Array<Object>} controllers
 */
export function applyWindTurbineControllerPrefs(windLikePayloads, controllers) {
    if (!Array.isArray(windLikePayloads) || !Array.isArray(controllers) || !controllers.length) return;
    for (const ctrl of controllers) {
        const target = (ctrl.wind_turbine || '').trim();
        if (!target) continue;
        const turbine = windLikePayloads.find(
            (w) =>
                w &&
                (w.typ === 'Wind Turbine' || String(w.typ || '').startsWith('Wind Turbine')) &&
                (w.userFriendlyName === target || w.name === target)
        );
        if (!turbine) continue;

        const useTurbineSpeed = attrBool(ctrl.use_turbine_wind_speed, true);
        let windSpeed = useTurbineSpeed
            ? Number(turbine.wind_speed_ms)
            : Number(ctrl.wind_speed_ms);
        if (!Number.isFinite(windSpeed)) {
            windSpeed = Number(ctrl.wind_speed_ms);
        }
        if (!Number.isFinite(windSpeed)) {
            windSpeed = Number(turbine.wind_speed_ms) || 0;
        }

        let curveJson = turbine.wind_power_curve_json;
        let approx = turbine.wind_curve_approx || 'linear';
        if (ctrl.power_curve_type === 'Controller Curve' && ctrl.wind_power_curve_json) {
            curveJson = ctrl.wind_power_curve_json;
            approx = ctrl.wind_curve_approx || approx;
        }

        const pref = computeWindTurbinePMw(windSpeed, curveJson, approx);
        turbine.p_mw = pref;
        turbine._wind_controller = ctrl.name || 'WindTurbineController';
        // Keep payload wind speed aligned with Pref so backend curve recompute matches
        turbine.wind_speed_ms = windSpeed;
        if (typeof console !== 'undefined' && console.log) {
            console.log(
                `[WindTurbineController] '${ctrl.name || ''}': '${target}' Pref=${pref} MW at v=${windSpeed} m/s` +
                    (useTurbineSpeed ? ' (turbine wind speed)' : ' (controller override)')
            );
        }
    }
}

/**
 * After Apply on a Wind Turbine Controller dialog: write Pref / wind speed onto the linked turbine cell.
 * @param {Object} graph
 * @param {Object} values - getFormValues() from WindTurbineControllerDialog
 */
export function syncWindTurbineFromController(graph, values) {
    if (!graph?.getModel || !values) return;
    const target = String(values.wind_turbine || '').trim();
    if (!target) return;
    if (!attrBool(values.enabled, true)) return;

    let turbineCell = null;
    for (const cell of graph.getModel().getDescendants?.() || []) {
        const style = parseCellStyle(cell.getStyle?.() || '') || {};
        if (style.shapeELXXX !== 'Wind Turbine') continue;
        const n = cellAttr(cell, 'name');
        if (n === target) {
            turbineCell = cell;
            break;
        }
    }
    if (!turbineCell?.value?.setAttribute) return;

    const useTurbineSpeed = attrBool(values.use_turbine_wind_speed, true);
    let windSpeed = useTurbineSpeed
        ? Number(cellAttr(turbineCell, 'wind_speed_ms'))
        : Number(values.wind_speed_ms);
    if (!Number.isFinite(windSpeed)) windSpeed = Number(values.wind_speed_ms) || 0;

    let curveJson = cellAttr(turbineCell, 'wind_power_curve_json');
    let approx = cellAttr(turbineCell, 'wind_curve_approx') || 'linear';
    if (values.power_curve_type === 'Controller Curve' && values.wind_power_curve_json) {
        curveJson = values.wind_power_curve_json;
        approx = values.wind_curve_approx || approx;
    }
    const pref = computeWindTurbinePMw(windSpeed, curveJson, approx);

    const model = graph.getModel();
    model.beginUpdate();
    try {
        // When overriding, also store wind speed on the turbine so LF curve recompute is consistent
        if (!useTurbineSpeed) {
            turbineCell.value.setAttribute('wind_speed_ms', String(windSpeed));
        }
        turbineCell.value.setAttribute('p_mw', String(pref));
        model.setValue(turbineCell, turbineCell.value);
        graph.refresh?.(turbineCell);
    } finally {
        model.endUpdate();
    }
}

if (typeof window !== 'undefined') {
    window.collectWindTurbineControllers = collectWindTurbineControllers;
    window.collectWindTurbineDynamicControllers = collectWindTurbineDynamicControllers;
    window.collectWindTurbineControllersForPayload = collectWindTurbineControllersForPayload;
    window.applyWindTurbineControllerPrefs = applyWindTurbineControllerPrefs;
    window.syncWindTurbineFromController = syncWindTurbineFromController;
}
