import { prepareNetworkData, getEconomicProfileRelevance } from './utils/networkDataPreparation.js';
import { EconomicAnalysisDialog } from './dialogs/EconomicAnalysisDialog.js';
import { EconomicAnalysisResultsDialog } from './dialogs/EconomicAnalysisResultsDialog.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs
} from './utils/simulationProgressOverlay.js';

function getBackendUrl() {
    if (window.ENV && window.ENV.backendUrl) return window.ENV.backendUrl;
    return 'https://sim.electrisim.com';
}

export async function economicAnalysisPandaPower(app, graph, editor) {
    const editorUi = app?.main?.editor?.editorUi || editor?.editorUi || window.App?.main?.editor?.editorUi;
    const g = graph || editorUi?.editor?.graph;
    if (!g) {
        alert('No graph available for Economic Analysis.');
        return;
    }

    const dialog = new EconomicAnalysisDialog(editorUi);
    dialog.graph = g;
    dialog.show(async (values) => {
        const simProgress = startSimulationProgress({
            title: 'Economic analysis progress',
            statusText: 'Running economic analysis…',
            filePrefix: 'economic'
        });
        const overlay = simProgress.overlay;

        try {
            overlay.append('Preparing network data…', { time: true });
            const v = Array.isArray(values) ? values : values;
            const { hasLoads, hasGenerators } = getEconomicProfileRelevance(g);
            let idx = 0;
            const frequency = (v[idx++] ?? values?.frequency) || '50';
            const currency = (v[idx++] ?? values?.currency) || 'EUR';
            const timeSteps = parseInt(v[idx++] ?? values?.time_steps ?? '8760', 10) || 8760;
            const lifetimeYears = parseInt(v[idx++] ?? values?.lifetime_years ?? '30', 10) || 30;
            const loadProfile = hasLoads ? (v[idx++] ?? values?.load_profile ?? 'constant') : 'constant';
            const generationProfile = hasGenerators ? (v[idx++] ?? values?.generation_profile ?? 'constant') : 'constant';
            const energyPricePerMwh = parseFloat(v[idx++] ?? values?.energy_price_per_mwh ?? '') || null;
            const energyPriceCurrency = currency;
            const algorithm = values?.algorithm || 'nr';
            const calculate_voltage_angles = values?.calculate_voltage_angles || 'auto';
            const init = values?.init || 'dc';
            const simulationParameters = {
                typ: 'EconomicAnalysisPandaPower Parameters',
                frequency: String(frequency),
                currency: String(currency),
                algorithm,
                calculate_voltage_angles,
                init,
                use_generation_profile: true,
                time_steps: Math.max(1, Math.min(8760, timeSteps)),
                lifetime_years: Math.max(1, Math.min(100, lifetimeYears)),
                calculation_mode: 'lookup_table',
                load_profile: String(loadProfile),
                generation_profile: String(generationProfile),
                energy_price_per_mwh: energyPricePerMwh,
                energy_price_currency: String(energyPriceCurrency)
            };

            const networkData = prepareNetworkData(g, simulationParameters, { removeResultCells: false });
            const backendUrl = getBackendUrl();
            const url = backendUrl.endsWith('/') ? backendUrl : backendUrl + '/';

            overlay.append('Sending request…', { time: true });
            const requestStart = performance.now();
            const response = await fetch(url, {
                mode: 'cors',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                body: JSON.stringify(networkData),
                signal: simProgress.signal
            });

            if (response.status !== 200) {
                const errText = await response.text();
                console.error('Economic Analysis error:', errText);
                let errMsg = 'Economic analysis failed.';
                try {
                    const errJson = JSON.parse(errText);
                    if (errJson.error) errMsg = errJson.error;
                } catch (e) {}
                const settled = await settleSimulationProgress(overlay, new Error(errMsg), simProgress.abortController);
                if (!settled.aborted) alert(errMsg);
                return;
            }

            overlay.append(`Response ${response.status} in ${formatDurationMs(performance.now() - requestStart)}`, { time: true });
            overlay.append('Processing results…', { time: true });
            let text = await response.text();
            text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
            let results;
            try {
                results = JSON.parse(text);
            } catch (parseErr) {
                console.error('Economic Analysis: invalid JSON response', parseErr);
                console.error('Response text (first 500 chars):', text.substring(0, 500));
                const settled = await settleSimulationProgress(overlay, parseErr, simProgress.abortController);
                if (!settled.aborted) alert('Invalid response from server. Check browser console for details.');
                return;
            }
            overlay.append('Done.', { time: true });
            await settleSimulationProgress(overlay, null, simProgress.abortController);
            console.log('Economic Analysis results received:', results);

            const resultsDialog = new EconomicAnalysisResultsDialog(results, editorUi, { hasLoads, hasGenerators });
            resultsDialog.show();
        } catch (error) {
            const settled = await settleSimulationProgress(overlay, error, simProgress.abortController);
            if (settled.aborted) return;
            console.error('Error in economic analysis:', error);
            alert('Error: ' + (error.message || 'Unknown error'));
        }
    });
}

globalThis.economicAnalysisPandaPower = economicAnalysisPandaPower;
