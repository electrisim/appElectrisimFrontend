import { devLog } from './utils/devLog.js';
import { parseVoltageLevels, voltageLevelsErrorMessage } from './utils/voltageLevelsInput.js';
import {
    RPCDialog,
    getGridTemplateRequirementsMw,
    getGridTemplateDisplayName,
    getUqGridTemplateRequirementsMw,
    getUqGridTemplateDisplayName,
    estimateRpcInstalledMw,
    PQ_TO_UQ_TEMPLATE
} from './dialogs/RPCDialog.js';
import { RPCResultsDialog } from './dialogs/RPCResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    createSimulationProgressOverlay,
    isAbortError,
    isNetworkStreamError,
    readNdjsonStream
} from './utils/simulationProgressOverlay.js';

devLog('rpcAnalysis.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function _setRpcStreamFlag(in_data, useStream) {
    const keys = Object.keys(in_data);
    for (const key of keys) {
        const item = in_data[key];
        if (item && item.typ === 'RPCAnalysisPandaPower Parameters') {
            in_data[key] = { ...item, rpc_stream: !!useStream };
            return;
        }
    }
}

function _isRpcStreamFriendlyUrl(backendUrl) {
    // Prefer NDJSON streaming everywhere, including dev tunnels (devtunnels.ms / ngrok / loca.lt).
    // Streaming emits periodic progress events that keep the tunnel connection warm; a plain
    // (non-streaming) POST sends no bytes until the computation finishes and long RPC runs then
    // exceed the tunnel idle timeout -> 504 Gateway Timeout (surfaced in the browser as a CORS
    // error because the 504 error page carries no Access-Control-Allow-Origin header).
    return true;
}

function _isRpcNetworkStreamError(error) {
    return isNetworkStreamError(error);
}

async function _fetchRpcResults(in_data, backendUrl, useStream, overlay, signal) {
    _setRpcStreamFlag(in_data, useStream);

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

function _mergeRpcVoltageLevels(voltageLevels, extraU) {
    const seen = new Set();
    const out = [];
    for (const v of [...(voltageLevels || []), ...(extraU || [])]) {
        const n = parseFloat(v);
        if (isNaN(n)) continue;
        const key = n.toFixed(4);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(Number(key));
    }
    out.sort((a, b) => a - b);
    return out.length ? out : [1.0];
}

function rpcAnalysis(a, b, c) {
    devLog('RPC Analysis started');

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

    const dialog = new RPCDialog(editorUi);

    dialog.show(async (values) => {
        if (!values) {
            devLog('RPC dialog cancelled');
            return;
        }

        devLog('RPC parameters:', values);

        if (!values.pccBusId) {
            alert('Please select a PCC Bus');
            return;
        }
        if (!values.extGridId) {
            alert('Please select an External Grid');
            return;
        }

        const selectedGenIds = (values.generatorIds || []).filter(id => id);
        if (selectedGenIds.length === 0) {
            alert('Please select at least one static generator or wind turbine generator');
            return;
        }

        const tplKeyPre = values.gridCodeTemplateKey || 'none';
        let reqRowsPre = Array.isArray(values.requirements) ? [...values.requirements] : [];
        reqRowsPre = reqRowsPre.filter(r => {
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

        // Voltage levels: accept "0.9, 0.95" and "0,9; 0,95"; refuse values that are not p.u.
        const vlParsed = parseVoltageLevels(values.voltageLevels, { fallback: [1.0] });
        const vlError = voltageLevelsErrorMessage(values.voltageLevels, vlParsed);
        if (vlError) {
            alert(vlError);
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
            let voltageLevels = vlParsed.levels;

            // Resolve cell names from IDs
            const model = graph.getModel();
            const pccCell = model.getCell(values.pccBusId);
            const extGridCell = model.getCell(values.extGridId);

            const pccBusName = _getCellNetworkName(pccCell);
            const extGridName = _getCellNetworkName(extGridCell);

            const generatorNames = selectedGenIds.map(id => {
                const cell = model.getCell(id);
                return _getCellNetworkName(cell);
            }).filter(n => n !== null);

            // Build requirements: table rows, or scale the selected grid template if table is empty
            // (so the chosen grid code appears on the PQ chart without an extra "Apply" click).
            let requirementRows = Array.isArray(values.requirements) ? [...values.requirements] : [];
            // Drop placeholder rows (e.g. user clicked + Add Row but left 0,0,0) so template fallback still runs
            requirementRows = requirementRows.filter(r => {
                const p = parseFloat(r.p) || 0;
                const qn = parseFloat(r.qMin) || 0;
                const qx = parseFloat(r.qMax) || 0;
                return Math.abs(p) + Math.abs(qn) + Math.abs(qx) > 1e-9;
            });
            const tplKey = values.gridCodeTemplateKey || 'none';
            // Match backend / dialog "P Max = 0 → auto": use installed sgen / wind-turbine sum for template scaling
            let pRated = values.pRatedMw;
            if (!(pRated > 0)) {
                const pMax = parseFloat(values.pMaxMw);
                if (!isNaN(pMax) && pMax > 0) {
                    pRated = pMax;
                }
            }
            if (!(pRated > 0)) {
                pRated = estimateRpcInstalledMw(graph, selectedGenIds);
            }
            if (requirementRows.length === 0 && tplKey !== 'none' && tplKey !== 'custom_manual' && pRated > 0) {
                requirementRows = getGridTemplateRequirementsMw(tplKey, pRated);
            }
            const gridCodeTemplateName = tplKey !== 'none' ? getGridTemplateDisplayName(tplKey) : '';

            // U-Q/Pmax requirements (voltage-indexed at P = Pmax)
            let uqRequirementRows = Array.isArray(values.uqRequirements) ? [...values.uqRequirements] : [];
            uqRequirementRows = uqRequirementRows.filter(r => {
                const u = parseFloat(r.u) || 0;
                const qn = parseFloat(r.qMin) || 0;
                const qx = parseFloat(r.qMax) || 0;
                return Math.abs(u) + Math.abs(qn) + Math.abs(qx) > 1e-9;
            });
            let uqTplKey = values.uqGridCodeTemplateKey || 'none';
            if ((uqTplKey === 'none' || !uqTplKey) && PQ_TO_UQ_TEMPLATE[tplKey]) {
                uqTplKey = PQ_TO_UQ_TEMPLATE[tplKey];
            }
            if (uqRequirementRows.length === 0 && uqTplKey !== 'none' && uqTplKey !== 'custom_manual' && pRated > 0) {
                uqRequirementRows = getUqGridTemplateRequirementsMw(uqTplKey, pRated);
            }
            const uqGridCodeTemplateName = uqTplKey !== 'none' ? getUqGridTemplateDisplayName(uqTplKey) : '';

            let uqRequirements = null;
            if (uqRequirementRows.length > 0) {
                const sortedUq = [...uqRequirementRows].sort((a, b) => a.u - b.u);
                uqRequirements = {
                    u_pu: sortedUq.map(r => r.u),
                    q_req_max_mvar: sortedUq.map(r => r.qMax),
                    q_req_min_mvar: sortedUq.map(r => r.qMin)
                };
                voltageLevels = _mergeRpcVoltageLevels(voltageLevels, uqRequirements.u_pu);
            }

            // { "vKey": { p_mw: [...], q_req_max_mvar: [...], q_req_min_mvar: [...] } }
            let requirements = null;
            if (requirementRows.length > 0) {
                const sorted = [...requirementRows].sort((a, b) => a.p - b.p);
                const reqObj = {};
                voltageLevels.forEach(v => {
                    const vKey = String(parseFloat(v).toFixed(4));
                    reqObj[vKey] = {
                        p_mw: sorted.map(r => r.p),
                        q_req_max_mvar: sorted.map(r => r.qMax),
                        q_req_min_mvar: sorted.map(r => r.qMin)
                    };
                });
                requirements = reqObj;
            }

            const coerceBool = (v) => {
                if (typeof v === 'string') {
                    return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
                }
                return !!v;
            };

            const runControl2w = coerceBool(values.run_control_trafo2w);
            const runControl3w = coerceBool(values.run_control_trafo3w);
            const runControlSh = coerceBool(values.run_control_shunt);
            const rpcParams = {
                typ: 'RPCAnalysisPandaPower Parameters',
                pcc_bus_name: pccBusName,
                ext_grid_name: extGridName,
                generator_names: generatorNames,
                voltage_levels: voltageLevels,
                p_min_mw: 0,
                p_max_mw: parseFloat(values.pMaxMw) || 0,
                p_steps: parseInt(values.pSteps, 10) || 10,
                q_capability_mode: values.qCapabilityMode || 'from_rating',
                limit_overloads: values.limitOverloads || false,
                run_control: runControl2w || runControl3w || runControlSh,
                run_control_trafo2w: runControl2w,
                run_control_trafo3w: runControl3w,
                run_control_shunt: runControlSh,
                max_loading_percent: parseFloat(values.maxLoadingPercent) || 100,
                requirements: requirements,
                uq_requirements: uqRequirements,
                grid_code_template_key: tplKey !== 'none' ? tplKey : null,
                grid_code_template_name: gridCodeTemplateName || null,
                uq_grid_code_template_key: uqTplKey !== 'none' ? uqTplKey : null,
                uq_grid_code_template_name: uqGridCodeTemplateName || null,
                frequency: parseFloat(values.frequency) || 50,
                user_email: _getUserEmail(),
                rpc_stream: true
            };

            const networkData = prepareNetworkData(graph, rpcParams, { removeResultCells: false });

            const in_data = {};
            const keys = Object.keys(networkData);
            for (const key of keys) {
                const item = networkData[key];
                if (item && item.typ) {
                    in_data[key] = item;
                }
            }

            const backendUrl = getBackendUrl();
            devLog('RPC Analysis - Sending to backend:', backendUrl);
            devLog('RPC Analysis - Generator names:', generatorNames);
            devLog('RPC Analysis - PCC bus name:', pccBusName);

            overlay = createSimulationProgressOverlay({
                title: 'RPC progress',
                statusText: 'Running grid code compliance analysis (P-Q & U-Q)…',
                filePrefix: 'rpc',
                onStop: stopRun
            });
            overlay.append('Sending request…', { time: true });
            const preferStream = _isRpcStreamFriendlyUrl(backendUrl);
            let dataJson = null;

            try {
                dataJson = await _fetchRpcResults(in_data, backendUrl, preferStream, overlay, abortController.signal);
            } catch (firstError) {
                if (isAbortError(firstError) || abortController.signal.aborted) {
                    throw firstError;
                }
                if (preferStream && _isRpcNetworkStreamError(firstError)) {
                    console.warn('RPC streaming request failed, retrying without stream:', firstError);
                    overlay.append('Streaming unavailable — retrying with standard response…', { time: true });
                    dataJson = await _fetchRpcResults(in_data, backendUrl, false, overlay, abortController.signal);
                } else {
                    throw firstError;
                }
            }

            overlay.remove();
            devLog('RPC Analysis response:', dataJson);

            const resultsDialog = new RPCResultsDialog(editorUi);
            resultsDialog.show(dataJson);

        } catch (error) {
            if (isAbortError(error) || abortController.signal.aborted) {
                if (overlay) overlay.remove();
                devLog('RPC analysis stopped by user');
                return;
            }
            console.error('RPC Analysis failed:', error);
            const msg = String(error && error.message ? error.message : error).toLowerCase();
            let hint = '';
            if (msg.includes('504') || msg.includes('gateway timeout')) {
                hint = ' The backend took too long and the tunnel/proxy timed out (504). ' +
                    'Reduce the number of voltage levels or P steps, or run the backend on localhost for large models.';
            } else if (_isRpcNetworkStreamError(error)) {
                hint = ' Network/streaming error reaching the backend. ' +
                    'Check the dev tunnel (devtunnels.ms) is running and reachable, or run the backend on localhost.';
            }
            if (overlay) {
                overlay.append('Error: ' + error.message + hint, { time: true });
                overlay.setStatus('Failed');
                overlay.setFinished();
                await overlay.waitUntilClosed();
            }
            alert('Grid code compliance analysis failed: ' + error.message + hint);
        }
    });
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

window.rpcAnalysis = rpcAnalysis;
