// voltageStability.js - Voltage Stability Margin (P-V curves) study runner
import { VoltageStabilityDialog } from './dialogs/VoltageStabilityDialog.js';
import { VoltageStabilityResultsDialog } from './dialogs/VoltageStabilityResultsDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs,
    isAbortError
} from './utils/simulationProgressOverlay.js';

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

function voltageStabilityPandaPower(a, b, c) {
    const graph = b;
    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) return;

    const dialog = new VoltageStabilityDialog(a);
    dialog.show(async (values) => {
        const simProgress = startSimulationProgress({
            title: 'Voltage stability progress',
            statusText: 'Raising the load until the network no longer solves…',
            filePrefix: 'voltage-stability'
        });
        try {
            const simulationParameters = {
                typ: 'VoltageStabilityPandaPower Parameters',
                mode: values.mode || 'all_loads',
                bus_id: values.bus_id || '',
                bus_name: values.bus_label || '',
                power_factor: values.power_factor || '0.95',
                min_vm_pu: values.min_vm_pu || '0.95',
                max_loading_percent: values.max_loading_percent || '100',
                frequency: values.frequency || '50',
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
                alert('Voltage stability study could not run.\n\n' +
                    (typeof dataJson.error === 'string' ? dataJson.error : String(dataJson.message || dataJson.error)));
                await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
                return;
            }

            if (typeof window !== 'undefined') window.__electrisimLastVoltageStabilityResultJson = dataJson;
            new VoltageStabilityResultsDialog(dataJson).show();
            simProgress.overlay.append('Done.', { time: true });
            await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
        } catch (err) {
            const aborted = isAbortError(err) || simProgress.abortController?.signal?.aborted;
            await settleSimulationProgress(simProgress.overlay, err, simProgress.abortController);
            if (!aborted) alert('Voltage stability study failed: ' + (err.message || err));
        }
    });
}

globalThis.voltageStabilityPandaPower = voltageStabilityPandaPower;
export { voltageStabilityPandaPower };
export default voltageStabilityPandaPower;
