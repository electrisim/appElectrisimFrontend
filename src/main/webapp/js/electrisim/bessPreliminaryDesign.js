// bessPreliminaryDesign.js - BESS preliminary design study orchestrator
import { BessPreliminaryDesignDialog } from './dialogs/BessPreliminaryDesignDialog.js';
import { BessPreliminaryDesignResultsDialog } from './dialogs/BessPreliminaryDesignResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import { findBessPlantElements } from './bessPlantBuilder.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    readNdjsonStream,
} from './utils/simulationProgressOverlay.js';

const getBackendUrl = () => {
    if (window.ENV?.backendUrl) return window.ENV.backendUrl + '/';
    return 'http://localhost:5000/';
};

function getUserEmail() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user?.email || 'unknown@user.com';
    } catch {
        return 'unknown@user.com';
    }
}

function buildStudyPayload(graph, wizardParams) {
    const plant = findBessPlantElements(graph);
    const pocName = plant.pocBus?.value?.getAttribute?.('name') || wizardParams.pocBusName || 'POC_HV';
    const extName = plant.extGrid?.value?.getAttribute?.('name') || wizardParams.extGridName || 'Grid';
    const storageNames = plant.storages.map((c) => c.value?.getAttribute?.('name')).filter(Boolean);

    const studyParams = {
        typ: 'BessPreliminaryPandaPower',
        pocBusName: pocName,
        extGridName: extName,
        storageNames,
        hvTrafoName: wizardParams.hvTrafoName || 'POC_Transformer',
        pocP_MW: wizardParams.pocP_MW,
        pocQ_Mvar: wizardParams.pocQ_Mvar,
        pMaxDischarge_MW: wizardParams.pMaxDischarge_MW,
        pMaxCharge_MW: wizardParams.pMaxCharge_MW,
        unom_pu: wizardParams.unom_pu,
        umin_pu: wizardParams.umin_pu,
        umax_pu: wizardParams.umax_pu,
        frequency: wizardParams.frequency,
        vmin_pu: wizardParams.umin_pu,
        vmax_pu: wizardParams.umax_pu,
        max_loading_percent: 100,
        algorithm: 'nr',
        user_email: getUserEmail(),
        rpc_stream: true,
        oltcEnabled: wizardParams.oltcEnabled !== false,
        tapSweep: true,
        tapQCapability: true,
        storageSnMva: wizardParams.storageSnMva,
        useQCurve: wizardParams.useQCurve === true,
    };

    const networkData = prepareNetworkData(graph, studyParams, { removeResultCells: false });
    const in_data = {};

    for (const key of Object.keys(networkData)) {
        const item = networkData[key];
        if (item?.typ === 'BessPreliminaryPandaPower') {
            in_data.bess_preliminary_params = { ...item };
        } else if (item?.typ) {
            in_data[key] = item;
        }
    }

    if (!in_data.bess_preliminary_params) {
        throw new Error('Failed to prepare BESS preliminary design parameters');
    }
    return in_data;
}

async function fetchStudy(in_data, overlay, signal) {
    const backendUrl = getBackendUrl();
    in_data.bess_preliminary_params.rpc_stream = true;

    const response = await fetch(backendUrl, {
        mode: 'cors',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/x-ndjson, application/json',
        },
        body: JSON.stringify(in_data),
        signal,
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt}`);
    }

    const ct = (response.headers.get('Content-Type') || '').toLowerCase();
    if (ct.includes('ndjson') && response.body?.getReader) {
        return readNdjsonStream(response, {
            onProgress: (msg) => overlay?.append(msg),
        });
    }
    return JSON.parse(await response.text());
}

function bessPreliminaryDesign(a, b, c) {
    const editorUi = a || window.App?.main?.editor?.editorUi;
    const graph = editorUi?.editor?.graph;
    if (!graph) {
        alert('Editor not ready');
        return;
    }

    const dialog = new BessPreliminaryDesignDialog(editorUi);
    dialog.show(async (values) => {
        if (!values) return;

        const simProgress = startSimulationProgress({
            title: 'BESS preliminary design',
            statusText: 'Running study…',
            filePrefix: 'bess-preliminary',
        });
        const overlay = simProgress.overlay;

        try {
            overlay.append('Preparing network…', { time: true });
            const in_data = buildStudyPayload(graph, values);
            overlay.append('Running load-flow cases and P/Q envelope…', { time: true });
            const dataJson = await fetchStudy(in_data, overlay, simProgress.signal);

            if (!dataJson) {
                throw new Error('Empty study response from the server');
            }
            if (dataJson?.error) {
                alert('Study error: ' + dataJson.error);
                return;
            }

            overlay.append('Done.', { time: true });
            await settleSimulationProgress(overlay, null, simProgress.abortController);
            const resultsDlg = new BessPreliminaryDesignResultsDialog(editorUi, dataJson, graph, values);
            resultsDlg.show();
        } catch (err) {
            const settled = await settleSimulationProgress(overlay, err, simProgress.abortController);
            if (!settled.aborted) {
                console.error(err);
                alert('BESS Preliminary Design failed: ' + (err?.message || err));
            }
        }
    });
}

window.bessPreliminaryDesign = bessPreliminaryDesign;
export { bessPreliminaryDesign };
export default bessPreliminaryDesign;
