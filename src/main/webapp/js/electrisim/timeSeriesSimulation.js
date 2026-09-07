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
        if (window.getCurrentUser?.()) {
            const currentUser = window.getCurrentUser();
            if (currentUser?.email) return currentUser.email;
        }
        if (window.authHandler?.getCurrentUser) {
            const currentUser = window.authHandler.getCurrentUser();
            if (currentUser?.email) return currentUser.email;
        }
    } catch (error) {
        console.warn('Error getting user email:', error);
    }
    return 'unknown@user.com';
}

function timeSeriesSimulationPandaPower(apka, graph) {
    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) {
        return;
    }

    function tryCreateDialog() {
        const DialogClass = globalThis.TimeSeriesSimulationDialog || window.TimeSeriesSimulationDialog;
        if (!DialogClass) {
            setTimeout(tryCreateDialog, 100);
            return;
        }

        const dialog = new DialogClass(graph);
        dialog.show(async (params) => {
            const runNumber = (globalThis.timeSeriesRunCount = (globalThis.timeSeriesRunCount || 0) + 1);
            console.log(`=== TIME SERIES SIMULATION #${runNumber} STARTED ===`, params);

            const simProgress = startSimulationProgress({
                title: 'Time series progress',
                statusText: 'Running time series simulation…',
                filePrefix: 'timeseries'
            });
            simProgress.overlay.append('Preparing network data…', { time: true });

            try {
                const simulationParameters = {
                    typ: 'TimeSeriesSimulationPandaPower Parameters',
                    time_steps: String(params.time_steps ?? 24),
                    load_profile: params.load_profile || 'constant',
                    generation_profile: params.generation_profile || 'constant',
                    profile_mode: params.profile_mode || 'custom',
                    element_profiles: params.element_profiles || {},
                    frequency: String(params.frequency ?? '50'),
                    algorithm: params.algorithm || 'nr',
                    calculate_voltage_angles: params.calculate_voltage_angles || 'auto',
                    init: params.init || 'auto',
                    user_email: getUserEmail()
                };

                const networkData = prepareNetworkData(graph, simulationParameters, { removeResultCells: true });
                await processNetworkData(
                    ENV.backendUrl + '/',
                    networkData,
                    graph,
                    apka,
                    { exportToExcel: !!params.export_to_xlsx },
                    simProgress
                );
            } catch (err) {
                const settled = await settleSimulationProgress(simProgress.overlay, err, simProgress.abortController);
                if (settled.aborted) return;
                console.error('Time series simulation failed:', err);
                alert('Time series simulation failed: ' + (err.message || 'Unknown error'));
            }
        });
    }

    tryCreateDialog();
}

async function processNetworkData(url, obj, graph, apka, options = {}, simProgress = null) {
    const overlay = simProgress?.overlay;
    try {
        overlay?.append('Sending request…', { time: true });
        const requestStart = performance.now();
        const response = await fetch(url, {
            mode: 'cors',
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
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
        console.log('Time Series Simulation Results:', dataJson);

        if (dataJson.error && dataJson.diagnostic) {
            overlay?.remove();
            if (window.DiagnosticReportDialog) {
                new window.DiagnosticReportDialog(dataJson.diagnostic).show();
            } else {
                alert(`Time Series Simulation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return;
        }

        if (dataJson.error) {
            overlay?.remove();
            alert('Time Series Simulation Error: ' + dataJson.error);
            return;
        }

        overlay?.append('Done.', { time: true });
        await settleSimulationProgress(overlay, null, simProgress?.abortController);

        if (window.TimeSeriesSimulationResultsDialog) {
            const dlg = new window.TimeSeriesSimulationResultsDialog(dataJson, {
                exportToExcel: options.exportToExcel
            });
            dlg.show();
        } else {
            alert('Time series simulation completed. Results dialog not available.');
        }
    } catch (err) {
        const settled = await settleSimulationProgress(overlay, err, simProgress?.abortController);
        if (settled.aborted) return;
        if (err.message === 'server') {
            alert('Time series simulation server error. Check that the backend is running.');
            return;
        }
        console.error('Error processing time series simulation data:', err);
        alert('Error processing time series results: ' + (err.message || 'Unknown error'));
    }
}

globalThis.timeSeriesSimulationPandaPower = timeSeriesSimulationPandaPower;
export { timeSeriesSimulationPandaPower };
