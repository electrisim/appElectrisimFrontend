// harmonicOperatingPoint.js - The pandapower load-flow request that fixes the operating point
// of the OpenDSS harmonic study.
//
// OpenDSS has no park controller, plant supervisory controller, STATCOM or tap control. The
// backend therefore runs the pandapower load flow (which has them) on this request first and
// writes its result (turbine Q, STATCOM Q, reactor steps, tap positions) into the OpenDSS data.
import { prepareNetworkData } from './networkDataPreparation.js';

const SETTINGS_ATTR = 'electrisim_study_settings';

/** Load Flow settings remembered in the diagram (studySettingsMemory.js), or {}. */
function savedLoadFlowSettings(graph) {
    try {
        const attrs = graph?.getModel?.().getRoot?.()?.value?.attributes;
        if (!attrs) return {};
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === SETTINGS_ATTR) {
                const all = JSON.parse(attrs[i].nodeValue);
                return (all && typeof all.loadFlow === 'object' && all.loadFlow) || {};
            }
        }
    } catch (e) { /* missing or malformed settings: defaults */ }
    return {};
}

/**
 * @param {object} graph - mxGraph
 * @param {string|number} frequency - base frequency of the harmonic study (Hz)
 * @param {string} userEmail
 * @returns {object|null} request for the pandapower load flow, or null when it cannot be built
 */
export function buildHarmonicOperatingPointNetwork(graph, frequency, userEmail) {
    try {
        const saved = savedLoadFlowSettings(graph);
        const flag = (key) => (key in saved ? !!saved[key] : true);
        const rc2 = flag('run_control_trafo2w');
        const rc3 = flag('run_control_trafo3w');
        const rcs = flag('run_control_shunt');
        const parameters = {
            typ: 'PowerFlowPandaPower Parameters',
            frequency: String(frequency || '50'),
            algorithm: 'nr',
            calculate_voltage_angles: 'auto',
            initialization: 'auto',
            exportPython: false,
            enforce_q_lims: !!saved.enforceLimits,
            max_iteration: String(saved.maxIterations || '100'),
            tolerance_mva: String(saved.tolerance || '1e-6'),
            run_control: rc2 || rc3 || rcs,
            run_control_trafo2w: rc2,
            run_control_trafo3w: rc3,
            run_control_shunt: rcs,
            user_email: userEmail || 'unknown@user.com'
        };
        const network = prepareNetworkData(graph, parameters, { removeResultCells: false });
        return network && typeof network === 'object' ? network : null;
    } catch (e) {
        console.warn('Harmonic analysis: the controlled load-flow request could not be built', e);
        return null;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.buildHarmonicOperatingPointNetwork = buildHarmonicOperatingPointNetwork;
}
