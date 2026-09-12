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
        const form = (!Array.isArray(values) && typeof values === 'object')
            ? values
            : (typeof dialog.getFormValues === 'function' ? dialog.getFormValues() : {});
        if (!form.storageId) {
            alert('Please select a Storage (BESS) element. Open the Storage element on the canvas so it appears in the study dialog list.');
            return;
        }
        values = form;

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
                q_source: values.qSource || values.q_source || 'inverter',
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
            const backendUrl = getBackendUrl();
            const body = JSON.stringify(in_data);
            console.log('BESS Dispatch Reversal - Using backend URL:', backendUrl);
            console.log('BESS Dispatch Reversal - POST starting', {
                origin: window.location.origin,
                backendUrl,
                bytes: body.length,
                aborted: !!simProgress.signal?.aborted
            });
            const requestStart = performance.now();
            const response = await fetch(backendUrl, {
                mode: 'cors',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body,
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
            console.error('BESS Dispatch Reversal failed:', err);
            const settled = await settleSimulationProgress(overlay, err, simProgress.abortController);
            if (settled.aborted) {
                overlay?.append?.('Request aborted (Stop or tab pause).', { time: true });
                return;
            }
            alert('BESS Dispatch Reversal failed: ' + (err?.message || err));
        }
    });
}

window.bessDispatchReversalStudy = bessDispatchReversalStudy;
export { bessDispatchReversalStudy };
export default bessDispatchReversalStudy;
