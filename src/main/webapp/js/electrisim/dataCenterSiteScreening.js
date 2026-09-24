import { DataCenterSiteScreeningDialog } from './dialogs/DataCenterSiteScreeningDialog.js';
import { DataCenterSiteScreeningResultsDialog } from './dialogs/DataCenterSiteScreeningResultsDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs,
    readNdjsonStream,
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

function dataCenterSiteScreeningPandaPower(a, b, c) {
    const graph = b;
    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) return;

    const dialog = new DataCenterSiteScreeningDialog(a);
    dialog.show(async (values) => {
        let simProgress = startSimulationProgress({
            title: 'Site screening progress',
            statusText: 'Running data center site screening…',
            filePrefix: 'site-screening'
        });
        try {
            const simulationParameters = {
                typ: 'DataCenterSiteScreeningPandaPower Parameters',
                site_load_ids: values.site_load_ids,
                mw_sizes: values.mw_sizes || '300,500,1000',
                power_factor: values.power_factor || '0.95',
                include_n11: values.include_n11 || 'true',
                element_type: values.element_type || 'all',
                voltage_limits: values.voltage_limits || 'true',
                thermal_limits: values.thermal_limits || 'true',
                min_vm_pu: values.min_vm_pu || '0.95',
                max_vm_pu: values.max_vm_pu || '1.05',
                max_loading_percent: values.max_loading_percent || '100',
                user_email: getUserEmail(),
                rpc_stream: true
            };

            simProgress.overlay.setStatus('Preparing diagram data…');
            simProgress.overlay.append('Preparing diagram data…', { time: true });
            const obj = prepareNetworkData(graph, simulationParameters, { removeResultCells: false });
            simProgress.overlay.setStatus('Sending request…');
            simProgress.overlay.append('Sending request…', { time: true });
            const t0 = performance.now();
            const response = await fetch(ENV.backendUrl + '/', {
                mode: 'cors',
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/x-ndjson, application/json',
                    'Accept-Encoding': 'identity'
                },
                body: JSON.stringify(obj),
                signal: simProgress.signal
            });
            if (response.status !== 200) {
                throw new Error(await response.text() || response.statusText);
            }
            const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
            let dataJson;
            if (contentType.includes('ndjson') && response.body?.getReader) {
                dataJson = await readNdjsonStream(response, {
                    onProgress: (msg) => {
                        simProgress.overlay.append(msg, { time: true });
                        simProgress.overlay.setStatus(msg);
                    }
                });
            } else {
                let text = await response.text();
                text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
                dataJson = JSON.parse(text);
            }
            if (!dataJson) {
                throw new Error('Site screening returned no result.');
            }
            simProgress.overlay.append(`Response in ${formatDurationMs(performance.now() - t0)}`, { time: true });

            if (dataJson.error) {
                alert('Site screening failed: ' + dataJson.error);
                await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
                return;
            }

            new DataCenterSiteScreeningResultsDialog(dataJson, graph).show();
            simProgress.overlay.append('Done.', { time: true });
            await settleSimulationProgress(simProgress.overlay, null, simProgress.abortController);
        } catch (err) {
            const aborted = isAbortError(err) || simProgress.abortController?.signal?.aborted;
            await settleSimulationProgress(simProgress.overlay, err, simProgress.abortController);
            if (!aborted) alert('Site screening failed: ' + (err.message || err));
        }
    });
}

globalThis.dataCenterSiteScreeningPandaPower = dataCenterSiteScreeningPandaPower;
export { dataCenterSiteScreeningPandaPower };
