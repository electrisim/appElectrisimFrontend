// bessDispatchReversal.js - BESS charge/discharge P-step voltage screening (OpenDER + OpenDSS)
import { BessDispatchReversalDialog } from './dialogs/BessDispatchReversalDialog.js';
import { BessDispatchReversalResultsDialog } from './dialogs/BessDispatchReversalResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs
} from './utils/simulationProgressOverlay.js';
import ENV from './config/environment.js';

const getBackendUrl = () => {
    if (window.ENV?.backendUrl) return window.ENV.backendUrl + '/';
    if (ENV?.backendUrl) return ENV.backendUrl + '/';
    return 'http://localhost:5000/';
};

function bessDispatchReversalStudy(a, b, c) {
    const editorUi = a || window.App?.main?.editor?.editorUi;
    if (!editorUi) {
        console.error('Editor UI not found');
        return;
    }
    const graph = editorUi.editor?.graph;
    if (!graph) {
        console.error('Graph not found');
        return;
    }

    const dialog = new BessDispatchReversalDialog(editorUi);
    dialog.show(async (values) => {
        if (!values) return;
        if (!values.storageId) {
            alert('Please select a Storage (BESS) element.');
            return;
        }

        const simProgress = startSimulationProgress({
            title: 'BESS dispatch reversal progress',
            statusText: 'Running BESS P-step study (OpenDER + OpenDSS)…',
            filePrefix: 'bess-dispatch-reversal'
        });
        const overlay = simProgress.overlay;

        try {
            overlay.append('Preparing network data…', { time: true });
            const studyParams = {
                typ: 'BessDispatchReversalOpenDss',
                storage_id: values.storageId,
                poc_bus_id: values.pocBusId || '',
                p_start_mw: parseFloat(values.pStartMw || '45'),
                p_end_mw: parseFloat(values.pEndMw || '-45'),
                pre_hold_s: parseFloat(values.preHoldS || '2'),
                ramp_s: parseFloat(values.rampS || '10'),
                post_hold_s: parseFloat(values.postHoldS || '60'),
                dt: parseFloat(values.dt || '0.1'),
                vmin_pu: parseFloat(values.vminPu || '0.98'),
                vmax_pu: parseFloat(values.vmaxPu || '1.02'),
                olrt_s: parseFloat(values.olrtS || '5'),
                engine: values.engine || 'opender',
                frequency: parseFloat(values.frequency || '50'),
                user_email: window.userEmail || window.USER_EMAIL || 'unknown@user.com'
            };

            const networkData = prepareNetworkData(graph, studyParams, {
                removeResultCells: false
            });

            const in_data = {};
            for (const key of Object.keys(networkData)) {
                const item = networkData[key];
                if (item && item.typ === 'BessDispatchReversalOpenDss') {
                    in_data.bess_dispatch_reversal_params = { ...studyParams, ...item };
                } else {
                    in_data[key] = item;
                }
            }
            if (!in_data.bess_dispatch_reversal_params) {
                in_data.bess_dispatch_reversal_params = studyParams;
            }

            overlay.append('Sending request…', { time: true });
            const requestStart = performance.now();
            const response = await fetch(getBackendUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip'
                },
                body: JSON.stringify(in_data),
                signal: simProgress.signal
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const dataJson = await response.json();
            overlay.append(`Response ${response.status} in ${formatDurationMs(performance.now() - requestStart)}`, { time: true });
            overlay.append('Processing results…', { time: true });

            if (dataJson.error) {
                const err = new Error(dataJson.message || 'unknown error');
                const settled = await settleSimulationProgress(overlay, err, simProgress.abortController);
                if (!settled.aborted) {
                    alert('BESS Dispatch Reversal: ' + (dataJson.message || 'unknown error'));
                }
                return;
            }

            overlay.append('Done.', { time: true });
            await settleSimulationProgress(overlay, null, simProgress.abortController);

            new BessDispatchReversalResultsDialog(dataJson).show();
        } catch (err) {
            const settled = await settleSimulationProgress(overlay, err, simProgress.abortController);
            if (settled.aborted) return;
            console.error('BESS Dispatch Reversal failed:', err);
            alert('BESS Dispatch Reversal failed: ' + (err?.message || err));
        }
    });
}

window.bessDispatchReversalStudy = bessDispatchReversalStudy;
export { bessDispatchReversalStudy };
export default bessDispatchReversalStudy;
