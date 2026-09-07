// transientStability.js - ANDES time-domain (transient stability) engine
import { TransientStabilityDialog } from './dialogs/TransientStabilityDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs
} from './utils/simulationProgressOverlay.js';

function getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user?.email) return user.email;
        }
        if (typeof getCurrentUser === 'function') {
            const currentUser = getCurrentUser();
            if (currentUser?.email) return currentUser.email;
        }
        if (window.getCurrentUser?.()?.email) return window.getCurrentUser().email;
        if (window.authHandler?.getCurrentUser?.()?.email) {
            return window.authHandler.getCurrentUser().email;
        }
    } catch (error) {
        console.warn('Error getting user email:', error);
    }
    return 'unknown@user.com';
}

async function processResults(url, obj, simProgress) {
    const overlay = simProgress?.overlay;
    try {
        overlay?.append('Sending request…', { time: true });
        const requestStart = performance.now();
        const response = await fetch(url, {
            mode: 'cors',
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify(obj),
            signal: simProgress?.signal
        });
        if (response.status !== 200) {
            throw new Error('server');
        }
        overlay?.append(`Response ${response.status} in ${formatDurationMs(performance.now() - requestStart)}`, { time: true });
        overlay?.append('Processing results…', { time: true });
        let text = await response.text();
        text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
        const dataJson = JSON.parse(text);
        if (dataJson.error) {
            overlay?.remove();
            const msg = dataJson.message || 'Transient stability calculation failed.';
            const detail = dataJson.exception ? `\n\n${dataJson.exception}` : '';
            alert(msg + detail);
            return;
        }
        overlay?.append('Done.', { time: true });
        await settleSimulationProgress(overlay, null, simProgress?.abortController);
        if (window.TransientStabilityResultsDialog) {
            new window.TransientStabilityResultsDialog(dataJson).show();
        } else {
            await import('./dialogs/TransientStabilityResultsDialog.js');
            new window.TransientStabilityResultsDialog(dataJson).show();
        }
    } catch (err) {
        const settled = await settleSimulationProgress(overlay, err, simProgress?.abortController);
        if (settled.aborted) return;
        if (err.message === 'server') {
            alert('Transient stability server error. Check that the backend is running and ANDES is installed.');
            return;
        }
        console.error('Transient stability error:', err);
        alert('Error processing transient stability results: ' + (err.message || err));
    }
}

window.transientStabilityAndes = function (a, b, c) {
    const apka = a;
    const graph = b;

    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) {
        return;
    }

    const dialog = new TransientStabilityDialog(a);
    dialog.show(async function (values) {
        if (!values || typeof values !== 'object') return;
        const simProgress = startSimulationProgress({
            title: 'Transient stability progress',
            statusText: 'Running transient stability (ANDES)…',
            filePrefix: 'transient-stability'
        });
        simProgress.overlay.append('Preparing network data…', { time: true });

        const simulationParameters = {
            typ: 'TransientStabilityAndes Parameters',
            frequency: String(values.frequency ?? '50'),
            sn_mva: String(values.sn_mva ?? '100'),
            tf: String(values.tf ?? '10'),
            tstep: String(values.tstep ?? '0'),
            fault_bus: values.fault_bus || '',
            fault_enabled: values.fault_bus ? 'true' : 'false',
            fault_tf: String(values.fault_tf ?? '1.0'),
            fault_tc: String(values.fault_tc ?? '1.1'),
            toggle_line: values.toggle_line || '',
            toggle_t: String(values.toggle_t ?? '2.0'),
            user_email: getUserEmail()
        };

        try {
            const obj = prepareNetworkData(graph, simulationParameters, { removeResultCells: true });
            await processResults(ENV.backendUrl + '/', obj, simProgress);
        } catch (error) {
            const settled = await settleSimulationProgress(simProgress.overlay, error, simProgress.abortController);
            if (settled.aborted) return;
            console.error('Transient stability preparation failed:', error);
            alert('Preparation failed: ' + (error.message || error));
        }
    });
};

export const transientStabilityAndes = window.transientStabilityAndes;
