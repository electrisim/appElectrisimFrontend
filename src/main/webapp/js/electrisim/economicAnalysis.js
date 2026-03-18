import { prepareNetworkData, getEconomicProfileRelevance } from './utils/networkDataPreparation.js';
import { EconomicAnalysisDialog } from './dialogs/EconomicAnalysisDialog.js';
import { EconomicAnalysisResultsDialog } from './dialogs/EconomicAnalysisResultsDialog.js';

function getBackendUrl() {
    if (window.ENV && window.ENV.backendUrl) return window.ENV.backendUrl;
    return 'https://sim.electrisim.com';
}

function createProgressOverlay() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10002'
    });
    const card = document.createElement('div');
    Object.assign(card.style, {
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '24px 32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        minWidth: '280px'
    });
    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
        width: '40px',
        height: '40px',
        border: '3px solid #e9ecef',
        borderTopColor: '#48d800',
        borderRadius: '50%',
        animation: 'economicProgressSpin 0.8s linear infinite'
    });
    const style = document.createElement('style');
    style.textContent = '@keyframes economicProgressSpin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '14px', color: '#333', fontWeight: '500' });
    msg.textContent = 'Preparing...';
    card.appendChild(spinner);
    card.appendChild(msg);
    overlay.appendChild(card);
    return {
        overlay,
        setMessage(text) {
            msg.textContent = text;
        },
        remove() {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }
    };
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
        const progress = createProgressOverlay();
        document.body.appendChild(progress.overlay);

        try {
            progress.setMessage('Preparing network data...');
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

            progress.setMessage('Running economic analysis...');
            const response = await fetch(url, {
                mode: 'cors',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                body: JSON.stringify(networkData)
            });

            if (response.status !== 200) {
                progress.remove();
                const errText = await response.text();
                console.error('Economic Analysis error:', errText);
                let errMsg = 'Economic analysis failed.';
                try {
                    const errJson = JSON.parse(errText);
                    if (errJson.error) errMsg = errJson.error;
                } catch (e) {}
                alert(errMsg);
                return;
            }

            progress.setMessage('Processing results...');
            let text = await response.text();
            text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
            let results;
            try {
                results = JSON.parse(text);
            } catch (parseErr) {
                progress.remove();
                console.error('Economic Analysis: invalid JSON response', parseErr);
                console.error('Response text (first 500 chars):', text.substring(0, 500));
                alert('Invalid response from server. Check browser console for details.');
                return;
            }
            progress.remove();
            console.log('Economic Analysis results received:', results);

            const resultsDialog = new EconomicAnalysisResultsDialog(results, editorUi, { hasLoads, hasGenerators });
            resultsDialog.show();
        } catch (error) {
            progress.remove();
            console.error('Error in economic analysis:', error);
            alert('Error: ' + (error.message || 'Unknown error'));
        }
    });
}

globalThis.economicAnalysisPandaPower = economicAnalysisPandaPower;
