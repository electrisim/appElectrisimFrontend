// gridFormingStatcom.js - Grid-Forming STATCOM Sizing (converter rating and supercapacitor bank) runner
import { GridFormingStatcomDialog } from './dialogs/GridFormingStatcomDialog.js';
import { GridFormingStatcomResultsDialog } from './dialogs/GridFormingStatcomResultsDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs,
    isAbortError
} from './utils/simulationProgressOverlay.js';

const SETTINGS_ATTR = 'electrisim_study_settings';

function getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user?.email) return user.email;
        }
    } catch (e) { /* ignore */ }
    return 'unknown@user.com';
}

/** Load Flow settings remembered in the diagram, so the operating point is solved the way the user runs it. */
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
    } catch (e) { /* defaults */ }
    return {};
}

async function runGridFormingStatcomStudy(graph, values) {
    const simProgress = startSimulationProgress({
        title: 'Grid-forming STATCOM sizing progress',
        statusText: 'Solving the model, then sizing the supercapacitor bank…',
        filePrefix: 'grid-forming-statcom'
    });
    try {
        const saved = savedLoadFlowSettings(graph);
        const flag = (key) => (key in saved ? !!saved[key] : true);
        const rc2 = flag('run_control_trafo2w');
        const rc3 = flag('run_control_trafo3w');
        const rcs = flag('run_control_shunt');
        // the dialog returns its values by position and by field id; only the named ones are sent
        const named = {};
        Object.keys(values || {}).forEach((key) => { if (!/^\d+$/.test(key)) named[key] = values[key]; });
        const simulationParameters = {
            ...named,
            typ: 'GridFormingStatcomSizing Parameters',
            // the load flow that gives the reactive power of the STATCOM in normal operation
            algorithm: 'nr',
            calculate_voltage_angles: 'auto',
            initialization: 'auto',
            enforce_q_lims: !!saved.enforceLimits,
            max_iteration: String(saved.maxIterations || '100'),
            tolerance_mva: String(saved.tolerance || '1e-6'),
            run_control: rc2 || rc3 || rcs,
            run_control_trafo2w: rc2,
            run_control_trafo3w: rc3,
            run_control_shunt: rcs,
            user_email: getUserEmail()
        };

        simProgress.overlay.append('Preparing network data…', { time: true });
        const obj = prepareNetworkData(graph, simulationParameters, { removeResultCells: false });
        simProgress.overlay.append('Sending request…', { time: true });
        const t0 = performance.now();
        const response = await fetch(ENV.backendUrl + '/', {
            mode: 'cors',
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obj),
            signal: simProgress.signal
        });
        let text = await response.text();
        let dataJson = null;
        try {
            text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
            dataJson = JSON.parse(text);
        } catch (e) { /* not JSON */ }
        if (response.status !== 200 && !(dataJson && dataJson.error)) {
            throw new Error(text || response.statusText);
        }
        if (!dataJson) throw new Error('The study returned no result.');
        simProgress.overlay.append(`Response in ${formatDurationMs(performance.now() - t0)}`, { time: true });

        if (dataJson.error) {
            alert('Grid-forming STATCOM sizing could not run.\n\n' +
                (typeof dataJson.error === 'string' ? dataJson.error : String(dataJson.message || dataJson.error)));
            await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
            return;
        }

        if (typeof window !== 'undefined') window.__electrisimLastGridFormingStatcomResultJson = dataJson;
        new GridFormingStatcomResultsDialog(dataJson).show();
        simProgress.overlay.append('Done.', { time: true });
        await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
    } catch (err) {
        const aborted = isAbortError(err) || simProgress.abortController?.signal?.aborted;
        await settleSimulationProgress(simProgress.overlay, err, simProgress.abortController);
        if (!aborted) alert('Grid-forming STATCOM sizing failed: ' + (err.message || err));
    }
}

function gridFormingStatcomSizing(a, b, c) {
    const graph = b;
    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) return;
    new GridFormingStatcomDialog(a).show((values) => runGridFormingStatcomStudy(graph, values));
}

globalThis.gridFormingStatcomSizing = gridFormingStatcomSizing;
export { gridFormingStatcomSizing };
export default gridFormingStatcomSizing;
