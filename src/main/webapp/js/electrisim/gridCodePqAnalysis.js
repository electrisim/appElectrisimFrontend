import {
    getGridTemplateRequirementsMw,
    getGridTemplateDisplayName,
    estimateRpcInstalledMw
} from './dialogs/RPCDialog.js';
import { GridCodePqDialog } from './dialogs/GridCodePqDialog.js';
import { GridCodePqResultsDialog } from './dialogs/GridCodePqResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    createSimulationProgressOverlay,
    isAbortError,
    isNetworkStreamError,
    readNdjsonStream
} from './utils/simulationProgressOverlay.js';

console.log('gridCodePqAnalysis.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function _setPqStreamFlag(in_data, useStream) {
    const keys = Object.keys(in_data);
    for (const key of keys) {
        const item = in_data[key];
        if (item && item.typ === 'GridCodePqPandaPower Parameters') {
            in_data[key] = { ...item, rpc_stream: !!useStream };
            return;
        }
    }
}

async function _fetchPqResults(in_data, backendUrl, useStream, overlay, signal) {
    _setPqStreamFlag(in_data, useStream);

    const response = await fetch(backendUrl, {
        mode: 'cors',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: useStream ? 'application/x-ndjson, application/json' : 'application/json',
            'Accept-Encoding': 'identity'
        },
        body: JSON.stringify(in_data),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const ct = (response.headers.get('Content-Type') || '').toLowerCase();
    let dataJson = null;

    if (useStream && ct.includes('ndjson') && response.body && typeof response.body.getReader === 'function') {
        dataJson = await readNdjsonStream(response, {
            onProgress: (msg) => overlay && overlay.append(msg)
        });
    } else {
        let responseData;
        const contentEncoding = response.headers.get('Content-Encoding');
        if (contentEncoding === 'gzip' || contentEncoding === 'br') {
            const buf = await response.arrayBuffer();
            responseData = new TextDecoder('utf-8').decode(buf);
        } else {
            responseData = await response.text();
        }
        dataJson = JSON.parse(responseData);
    }

    if (!dataJson) {
        throw new Error('empty response');
    }
    if (dataJson.error) {
        throw new Error(dataJson.error);
    }
    return dataJson;
}

function _getCellNetworkName(cell) {
    try {
        if (!cell) return null;
        if (cell.mxObjectId) return cell.mxObjectId.replace('#', '_');
        return null;
    } catch (e) {
        return null;
    }
}

function _getCellAttr(cell, name) {
    try {
        if (!cell?.value?.getAttribute) return null;
        return cell.value.getAttribute(name);
    } catch (e) {
        return null;
    }
}

function _getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) return user.email;
        }
        return 'unknown@user.com';
    } catch (e) {
        return 'unknown@user.com';
    }
}

function coerceBool(v) {
    if (typeof v === 'string') {
        return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
    }
    return !!v;
}

function gridCodePqAnalysis(a, b, c) {
    console.log('Grid Code Compliance (P-Q) started');

    const editorUi = a || window.App?.main?.editor?.editorUi;
    if (!editorUi) {
        console.error('Editor UI not found');
        return;
    }
    const graph = editorUi.editor.graph;
    if (!graph) {
        console.error('Graph not found');
        return;
    }

    const dialog = new GridCodePqDialog(editorUi);

    dialog.show(async (values) => {
        if (!values) {
            console.log('P-Q dialog cancelled');
            return;
        }

        if (!values.pccBusId) {
            alert('Please select a PCC Bus');
            return;
        }
        if (!values.extGridId) {
            alert('Please select an External Grid');
            return;
        }

        const selectedGenIds = (values.generatorIds || []).filter((id) => id);
        if (selectedGenIds.length === 0) {
            alert('Please select at least one static generator or wind turbine generator');
            return;
        }

        const parkOn = values.qDispatchMode === 'park' || coerceBool(values.iParkCtrl);
        if (parkOn && !values.parkControllerId) {
            alert('Plant Q dispatch is set to Park Controller: select a Park Controller, or switch to Local Q on each unit.');
            return;
        }

        const tplKeyPre = values.gridCodeTemplateKey || 'none';
        let reqRowsPre = Array.isArray(values.requirements) ? [...values.requirements] : [];
        reqRowsPre = reqRowsPre.filter((r) => {
            const p = parseFloat(r.p) || 0;
            const qn = parseFloat(r.qMin) || 0;
            const qx = parseFloat(r.qMax) || 0;
            return Math.abs(p) + Math.abs(qn) + Math.abs(qx) > 1e-9;
        });
        if (reqRowsPre.length > 0 && tplKeyPre === 'none') {
            alert(
                'The requirements table has data. Please select a Grid Code Template above. ' +
                'Choose "Custom (manual table)" if you entered the points yourself, or pick a standard code. ' +
                'To run without grid-code overlay, remove all rows and keep "-- Select Grid Code Template --".'
            );
            return;
        }

        const abortController = new AbortController();
        let overlay = null;
        const stopRun = () => {
            if (abortController.signal.aborted) return;
            if (overlay) {
                overlay.setStopping();
                overlay.append('Stop requested…', { time: true });
            }
            abortController.abort();
        };

        try {
            const voltageLevels = (values.voltageLevels || '1.0')
                .split(',')
                .map((s) => parseFloat(s.trim()))
                .filter((v) => !isNaN(v));

            const model = graph.getModel();
            const pccCell = model.getCell(values.pccBusId);
            const extGridCell = model.getCell(values.extGridId);
            const pccBusName = _getCellNetworkName(pccCell);
            const extGridName = _getCellNetworkName(extGridCell);

            const generatorNames = selectedGenIds.map((id) => {
                const cell = model.getCell(id);
                return _getCellNetworkName(cell);
            }).filter((n) => n !== null);

            const excludeIds = (values.excludeGeneratorIds || []).filter((id) => id);
            const excludeNames = excludeIds.map((id) => _getCellNetworkName(model.getCell(id))).filter((n) => n);

            const shuntNames = (values.shuntIds || []).filter((id) => id).map((id) => {
                return _getCellNetworkName(model.getCell(id));
            }).filter((n) => n);

            let parkControllerName = null;
            let parkControllerId = null;
            if (values.parkControllerId) {
                const parkCell = model.getCell(values.parkControllerId);
                parkControllerName = _getCellAttr(parkCell, 'name') || _getCellNetworkName(parkCell);
                parkControllerId = parkCell?.mxObjectId || parkCell?.id || null;
            }

            let requirementRows = Array.isArray(values.requirements) ? [...values.requirements] : [];
            requirementRows = requirementRows.filter((r) => {
                const p = parseFloat(r.p) || 0;
                const qn = parseFloat(r.qMin) || 0;
                const qx = parseFloat(r.qMax) || 0;
                return Math.abs(p) + Math.abs(qn) + Math.abs(qx) > 1e-9;
            });
            const tplKey = values.gridCodeTemplateKey || 'none';
            let pRated = values.pRatedMw;
            if (!(pRated > 0)) {
                const pn = parseFloat(values.pnMw);
                if (!isNaN(pn) && pn > 0) pRated = pn;
            }
            if (!(pRated > 0)) {
                pRated = estimateRpcInstalledMw(graph, selectedGenIds);
            }
            if (requirementRows.length === 0 && tplKey !== 'none' && tplKey !== 'custom_manual' && pRated > 0) {
                requirementRows = getGridTemplateRequirementsMw(tplKey, pRated);
            }
            const gridCodeTemplateName = tplKey !== 'none' ? getGridTemplateDisplayName(tplKey) : '';

            let requirements = null;
            if (requirementRows.length > 0) {
                const sorted = [...requirementRows].sort((a, b) => a.p - b.p);
                const reqObj = {};
                voltageLevels.forEach((v) => {
                    const vKey = String(parseFloat(v).toFixed(4));
                    reqObj[vKey] = {
                        p_mw: sorted.map((r) => r.p),
                        q_req_max_mvar: sorted.map((r) => r.qMax),
                        q_req_min_mvar: sorted.map((r) => r.qMin)
                    };
                });
                requirements = reqObj;
            }

            const runControl2w = coerceBool(values.iTrfCtrl);
            const runControl3w = coerceBool(values.iTrf3wCtrl);
            const runControlSh = coerceBool(values.run_control_shunt);
            const shuntOnOff = coerceBool(values.shntCtrl);

            const pqParams = {
                typ: 'GridCodePqPandaPower Parameters',
                pcc_bus_name: pccBusName,
                ext_grid_name: extGridName,
                generator_names: generatorNames,
                exclude_generator_names: excludeNames,
                shunt_names: shuntNames,
                park_controller_name: parkControllerName,
                park_controller_id: parkControllerId,
                i_park_ctrl: parkOn,
                q_dispatch_mode: parkOn ? 'park' : 'local',
                voltage_levels: voltageLevels,
                pn_mw: parseFloat(values.pnMw) || 0,
                un_kv: parseFloat(values.unKv) || 0,
                uc_kv: parseFloat(values.ucKv) || 0,
                p_start_pct: parseFloat(values.pStartPct),
                p_step_pct: parseFloat(values.pStepPct),
                p_end_pct: parseFloat(values.pEndPct),
                q_step_pct: parseFloat(values.qStepPct),
                i_op_range: parseInt(values.iOpRange, 10) || 0,
                q_capability_mode: 'from_sgen_curve',
                i_trf_ctrl: runControl2w,
                i_trf3w_ctrl: runControl3w,
                shnt_ctrl: shuntOnOff,
                limit_overloads: coerceBool(values.limitOverloads),
                max_loading_percent: parseFloat(values.maxLoadingPercent) || 100,
                lim_q_uprot: coerceBool(values.limQUprot),
                u_max_prot: parseFloat(values.uMaxProt) || 1.15,
                u_min_prot: parseFloat(values.uMinProt) || 0.85,
                i_show_pq0: coerceBool(values.iShowPQ0),
                i_output: coerceBool(values.iOutput),
                run_control: runControl2w || runControl3w || runControlSh,
                run_control_trafo2w: runControl2w,
                run_control_trafo3w: runControl3w,
                run_control_shunt: runControlSh,
                requirements: requirements,
                grid_code_template_key: tplKey !== 'none' ? tplKey : null,
                grid_code_template_name: gridCodeTemplateName || null,
                frequency: parseFloat(values.frequency) || 50,
                user_email: _getUserEmail(),
                rpc_stream: true
            };

            const networkData = prepareNetworkData(graph, pqParams, { removeResultCells: false });

            const in_data = {};
            const keys = Object.keys(networkData);
            for (const key of keys) {
                const item = networkData[key];
                if (item && item.typ) {
                    in_data[key] = item;
                }
            }

            const backendUrl = getBackendUrl();
            overlay = createSimulationProgressOverlay({
                title: 'P-Q progress',
                statusText: 'Running grid code compliance analysis (P-Q)…',
                filePrefix: 'pq',
                onStop: stopRun
            });
            overlay.append('Preparing network data…', { time: true });
            let dataJson = null;

            try {
                overlay.append('Sending request…', { time: true });
                dataJson = await _fetchPqResults(
                    in_data, backendUrl, true, overlay, abortController.signal);
            } catch (firstError) {
                if (isAbortError(firstError) || abortController.signal.aborted) {
                    throw firstError;
                }
                if (isNetworkStreamError(firstError)) {
                    console.warn('P-Q streaming request failed, retrying without stream:', firstError);
                    overlay.append('Streaming unavailable — retrying with standard response…', { time: true });
                    dataJson = await _fetchPqResults(
                        in_data, backendUrl, false, overlay, abortController.signal);
                } else {
                    throw firstError;
                }
            }

            overlay.remove();

            const resultsDialog = new GridCodePqResultsDialog(editorUi);
            resultsDialog.show(dataJson);
        } catch (error) {
            if (isAbortError(error) || (typeof abortController !== 'undefined' && abortController.signal.aborted)) {
                if (overlay) overlay.remove();
                console.log('Grid Code Compliance (P-Q) stopped by user');
                return;
            }
            console.error('Grid Code Compliance (P-Q) failed:', error);
            const msg = String(error && error.message ? error.message : error).toLowerCase();
            let hint = '';
            if (msg.includes('504') || msg.includes('gateway timeout')) {
                hint = ' The backend took too long and the tunnel/proxy timed out (504). ' +
                    'Increase the sweep step or reduce voltage levels, or run the backend on localhost.';
            } else if (isNetworkStreamError(error)) {
                hint = ' Network/streaming error reaching the backend. ' +
                    'Check the dev tunnel is running, or run the backend on localhost.';
            }
            if (overlay) {
                overlay.append('Error: ' + error.message + hint, { time: true });
                overlay.setStatus('Failed');
                overlay.setFinished();
                await overlay.waitUntilClosed();
            }
            alert('Grid code compliance (P-Q) analysis failed: ' + error.message + hint);
        }
    });
}

window.gridCodePqAnalysis = gridCodePqAnalysis;
export default gridCodePqAnalysis;
