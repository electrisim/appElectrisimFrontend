// bessPreliminaryDesign.js - BESS preliminary design study orchestrator
import { BessPreliminaryDesignDialog } from './dialogs/BessPreliminaryDesignDialog.js';
import { BessPreliminaryDesignResultsDialog } from './dialogs/BessPreliminaryDesignResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import { findBessPlantElements } from './bessPlantBuilder.js';
import { applyBessPreliminaryResultsToSld } from './utils/bessPreliminarySldResults.js';
import { getBackendUrlCandidates } from './config/environment.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    readNdjsonStream,
    isNetworkStreamError,
    isAbortError,
} from './utils/simulationProgressOverlay.js';

const LOCAL_BACKEND = 'http://127.0.0.1:5000/';

function withSlash(url) {
    const s = String(url || '');
    return s.endsWith('/') ? s : `${s}/`;
}

function getBackendUrls() {
    const fromEnv = (typeof getBackendUrlCandidates === 'function' ? getBackendUrlCandidates() : [])
        .map(withSlash);
    const urls = fromEnv.length ? fromEnv : [withSlash(window.ENV?.backendUrl || LOCAL_BACKEND)];
    if (!urls.includes(LOCAL_BACKEND) && String(window.location.protocol).toLowerCase() !== 'https:') {
        urls.push(LOCAL_BACKEND);
    }
    return urls;
}

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
        powerFactor: wizardParams.powerFactor,
        specifyQDirectly: wizardParams.specifyQDirectly === true,
        pMaxDischarge_MW: wizardParams.pMaxDischarge_MW,
        pMaxCharge_MW: wizardParams.pMaxCharge_MW,
        batteryPmax_MW: wizardParams.batteryPmax_MW,
        unom_pu: wizardParams.unom_pu,
        umin_pu: wizardParams.umin_pu,
        umax_pu: wizardParams.umax_pu,
        frequency: wizardParams.frequency,
        vmin_pu: wizardParams.vmin_allow_pu ?? 0.9,
        vmax_pu: wizardParams.vmax_allow_pu ?? 1.1,
        max_loading_percent: 100,
        algorithm: 'nr',
        user_email: getUserEmail(),
        rpc_stream: true,
        oltcEnabled: wizardParams.oltcEnabled !== false,
        oltcVmLower: wizardParams.oltcVmLower,
        oltcVmUpper: wizardParams.oltcVmUpper,
        tapSweep: wizardParams.tapSweep === true,
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

function describeFetchError(error, urls) {
    const msg = String(error?.message || error);
    if (!/failed to fetch|network error/i.test(msg)) return msg;
    return (
        `Failed to reach the simulation backend (${urls.join(', ')}). ` +
        'Open the app at http://127.0.0.1:5501 and keep python app.py running on port 5000. ' +
        'If localStorage.electrisimBackend is set to "tunnel", remove it or add ?backend=local to the URL.'
    );
}

async function fetchStudyOnce(backendUrl, in_data, overlay, signal, useStream) {
    in_data.bess_preliminary_params.rpc_stream = !!useStream;

    const response = await fetch(backendUrl, {
        mode: 'cors',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: useStream ? 'application/x-ndjson, application/json' : 'application/json',
            'Accept-Encoding': 'identity',
        },
        body: JSON.stringify(in_data),
        signal,
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt}`);
    }

    const ct = (response.headers.get('Content-Type') || '').toLowerCase();
    if (useStream && ct.includes('ndjson') && response.body?.getReader) {
        return readNdjsonStream(response, {
            onProgress: (msg) => overlay?.append(msg),
        });
    }
    return JSON.parse(await response.text());
}

async function fetchStudy(in_data, overlay, signal) {
    const urls = getBackendUrls();
    overlay?.append(`Using backend ${urls[0]}`, { time: true });
    let lastErr = null;

    for (let i = 0; i < urls.length; i++) {
        const backendUrl = urls[i];
        try {
            return await fetchStudyOnce(backendUrl, in_data, overlay, signal, true);
        } catch (firstError) {
            lastErr = firstError;
            if (isAbortError(firstError) || signal?.aborted) throw firstError;
            if (isNetworkStreamError(firstError)) {
                overlay?.append(`Streaming unavailable at ${backendUrl} — retrying…`, { time: true });
                try {
                    return await fetchStudyOnce(backendUrl, in_data, overlay, signal, false);
                } catch (secondError) {
                    lastErr = secondError;
                    if (isAbortError(secondError) || signal?.aborted) throw secondError;
                }
            } else {
                throw firstError;
            }
            if (i + 1 < urls.length) {
                overlay?.append(`Retrying at ${urls[i + 1]}…`, { time: true });
            }
        }
    }
    throw new Error(describeFetchError(lastErr, urls));
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
            try {
                applyBessPreliminaryResultsToSld(graph, dataJson?.bess_preliminary_results || dataJson, {
                    umin_pu: values.umin_pu,
                    umax_pu: values.umax_pu,
                });
            } catch (paintErr) {
                console.warn('BESS preliminary SLD paint failed', paintErr);
            }
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
