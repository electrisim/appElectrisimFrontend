// dgInterconnection.js - DG Interconnection Screening (OpenDSS) entry point
import { DgInterconnectionDialog } from './dialogs/DgInterconnectionDialog.js';
import { DgInterconnectionResultsDialog } from './dialogs/DgInterconnectionResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs
} from './utils/simulationProgressOverlay.js';

console.log('dgInterconnection.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function dgInterconnectionOpenDss(a, b, c) {
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

    const dialog = new DgInterconnectionDialog(editorUi);
    dialog.show(async (values) => {
        if (!values) return;
        if (!values.derId) {
            alert('Please select a DER element (PVSystem, Storage, or Generator).');
            return;
        }

        const simProgress = startSimulationProgress({
            title: 'DG interconnection progress',
            statusText: 'Running DG interconnection screening…',
            filePrefix: 'dg-interconnection'
        });
        const overlay = simProgress.overlay;

        try {
            overlay.append('Preparing network data…', { time: true });
            const studyParams = {
                typ: 'DgInterconnectionOpenDss',
                poc_bus_id: values.pocBusId || '',
                der_id: values.derId,
                der_type: values.derType || 'PVSystem',
                proposed_kw: parseFloat(values.proposedKw || '500'),
                proposed_kva: values.proposedKva !== '' && values.proposedKva != null
                    ? parseFloat(values.proposedKva) : null,
                vmin_pu: parseFloat(values.vminPu || '0.95'),
                vmax_pu: parseFloat(values.vmaxPu || '1.05'),
                max_loading_percent: parseFloat(values.maxLoadingPercent || '100'),
                run_hosting_capacity: !!values.runHostingCapacity,
                hc_max_kw: parseFloat(values.hcMaxKw || '5000'),
                compare_invcontrol: !!values.compareInvControl,
                frequency: parseFloat(values.frequency || '50'),
                user_email: window.userEmail || window.USER_EMAIL || 'unknown@user.com'
            };

            const networkData = prepareNetworkData(graph, studyParams, {
                removeResultCells: false
            });

            // Restructure like BESS sizing: nested params + network elements
            const in_data = {};
            for (const key of Object.keys(networkData)) {
                const item = networkData[key];
                if (item && item.typ === 'DgInterconnectionOpenDss') {
                    in_data.dg_interconnection_params = { ...studyParams, ...item };
                } else {
                    in_data[key] = item;
                }
            }
            if (!in_data.dg_interconnection_params) {
                in_data.dg_interconnection_params = studyParams;
            }

            const url = getBackendUrl();
            overlay.append('Sending request…', { time: true });
            const requestStart = performance.now();
            const response = await fetch(url, {
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
                if (!settled.aborted) alert('DG Interconnection Screening: ' + (dataJson.message || 'unknown error'));
                return;
            }
            overlay.append('Done.', { time: true });
            await settleSimulationProgress(overlay, null, simProgress.abortController);
            const resultsDialog = new DgInterconnectionResultsDialog(editorUi, dataJson);
            resultsDialog.show();
        } catch (err) {
            const settled = await settleSimulationProgress(overlay, err, simProgress.abortController);
            if (settled.aborted) return;
            console.error('DG Interconnection Screening failed:', err);
            alert('DG Interconnection Screening failed: ' + (err?.message || err));
        }
    });
}

window.dgInterconnectionOpenDss = dgInterconnectionOpenDss;
export { dgInterconnectionOpenDss };
export default dgInterconnectionOpenDss;
