import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

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

            apka.spinner.spin(document.body, 'Waiting for time series simulation results...');

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
                    { exportToExcel: !!params.export_to_xlsx }
                );
            } catch (err) {
                console.error('Time series simulation failed:', err);
                alert('Time series simulation failed: ' + (err.message || 'Unknown error'));
            } finally {
                stopSpinner(apka);
            }
        });
    }

    tryCreateDialog();
}

function stopSpinner(apka) {
    try {
        apka?.spinner?.stop();
        window.apka?.spinner?.stop();
        document.querySelectorAll('.spinner, [class*="spinner"]').forEach(el => {
            el.style.display = 'none';
            el.remove();
        });
        document.querySelectorAll('div, span, p').forEach(el => {
            if (el.textContent?.includes('Waiting for time series simulation results')) {
                el.style.display = 'none';
                el.remove();
            }
        });
        apka?.editor?.setStatus?.('');
    } catch (e) {
        console.warn('Spinner cleanup failed:', e);
    }
}

async function processNetworkData(url, obj, graph, apka, options = {}) {
    try {
        const response = await fetch(url, {
            mode: 'cors',
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obj)
        });

        if (response.status !== 200) {
            throw new Error('server');
        }

        let text = await response.text();
        text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
        const dataJson = JSON.parse(text);
        console.log('Time Series Simulation Results:', dataJson);

        if (dataJson.error && dataJson.diagnostic) {
            if (window.DiagnosticReportDialog) {
                new window.DiagnosticReportDialog(dataJson.diagnostic).show();
            } else {
                alert(`Time Series Simulation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return;
        }

        if (dataJson.error) {
            alert('Time Series Simulation Error: ' + dataJson.error);
            return;
        }

        if (window.TimeSeriesSimulationResultsDialog) {
            const dlg = new window.TimeSeriesSimulationResultsDialog(dataJson, {
                exportToExcel: options.exportToExcel
            });
            dlg.show();
        } else {
            alert('Time series simulation completed. Results dialog not available.');
        }
    } catch (err) {
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
